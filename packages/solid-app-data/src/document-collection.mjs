import {
  workspace,
  resource,
  graph,
  solid,
  local,
  collection
} from '@muze-labs/solid-workspace';
import { oldm, loadDocument, saveDocument } from './index.mjs';
import { StateGraph, named, literal, xsd, sameGraph } from './state-rdf.mjs';
import { httpUrl, documentUrl } from './url.mjs';
import {
  documentCollections as ns,
  collectionRoot,
  collectionTitle,
  collectionModified,
  collectionDeleted,
  collectionScalarPredicates,
  readDocumentCollection,
  createDocumentCollection,
  collectionEntryId,
  projectDocumentCollection,
  applyDocumentCollectionFields
} from './document-collection-rdf.mjs';
const cacheFields = ['local-dirty', 'local-creating'];

export class DocumentCollection {
  constructor({ url, owner = '', session = null, store } = {}) {
    this.url = documentUrl(httpUrl(url));
    this.owner = owner;
    this.session = session;
    this.store =
      store ||
      local.indexedDB('solid-document-collections', {
        key: owner + '\n' + this.url
      });
    this.raw = new StateGraph('', this.url);
    this.dirty = false;
    this.creating = false;
    this.error = null;
  }
  content() {
    const result = this.raw.clone();
    if (result.quads.length) {
      const root = collectionRoot(result);
      for (const field of cacheFields) {
        result.set(root, ns + field);
      }
    }
    return result;
  }
  state() {
    return readDocumentCollection(this.content());
  }
  async persist(next) {
    const cache = next.clone();
    const root = collectionRoot(cache);
    cache.set(root, ns + 'local-dirty', literal(this.dirty, xsd + 'boolean'));
    cache.set(
      root,
      ns + 'local-creating',
      literal(this.creating, xsd + 'boolean')
    );
    await this.store.save(cache.write());
    this.raw = cache;
  }
  async open({ create } = {}) {
    this.raw = new StateGraph(await this.store.load(), this.url);
    if (this.raw.quads.length) {
      const root = collectionRoot(this.raw);
      this.dirty =
        this.raw.one(root, ns + 'local-dirty', 'boolean')?.value === 'true';
      this.creating =
        this.raw.one(root, ns + 'local-creating', 'boolean')?.value === 'true';
      this.state();
    }
    else if (create) {
      this.dirty = true;
      this.creating = true;
      await this.persist(
        createDocumentCollection(this.url, create.title, create.destination)
      );
    }
    this.initializeWorkspace();
    await this.workspace.openResource('collection');
    this.error =
      this.workspace.status.sources.remote?.error ||
      this.workspace.status.sources.local?.error ||
      null;
    if (!this.raw.quads.length && this.error) {
      throw this.error;
    }
    this.state();
    return this;
  }
  requireSession() {
    if (!this.session || this.session.webId !== this.owner) {
      const error = new Error(
        'document-collection: Connect with this collection’s account.'
      );
      error.code = 'sign_in_required';
      throw error;
    }
    return this.session;
  }
  async readRemote() {
    const session = this.requireSession();
    const record = await session.perform(
      () =>
        loadDocument(session.client, this.url, {
          allowMissing: this.creating,
          redirect: 'error'
        }),
      { interactive: false }
    );
    const native = new StateGraph(record.source || '', this.url);
    if (!record.missing) {
      readDocumentCollection(native);
      if (this.creating) {
        if (!sameGraph(native.write(), this.content().write(), this.url)) {
          const error = new Error(
            'document-collection: This file already exists. Choose another file; your local collection is retained.'
          );
          error.code = 'collection_exists';
          throw error;
        }
        this.creating = false;
      }
      const root = collectionRoot(native);
      if (cacheFields.some((field) => native.values(root, ns + field).length)) {
        throw new Error(
          'document-collection: Remote collection contains local recovery fields. Data is retained.'
        );
      }
    }
    this.remote = record;
    return projectDocumentCollection(native).write();
  }
  async writeLocal(fields, options = {}) {
    const base =
      this.remote && !this.remote.missing
        ? new StateGraph(this.remote.source, this.url)
        : this.content();
    const next = applyDocumentCollectionFields(
      base,
      new StateGraph(fields, this.url)
    );
    readDocumentCollection(next);
    // This flag follows the library's admitted save, including one queued after
    // an earlier remote acknowledgement. No second save queue is needed.
    if (options.collectionEdit) {
      this.dirty = true;
    }
    await this.persist(next);
    return { ok: true };
  }
  async writeRemote(fields) {
    const session = this.requireSession();
    const base = this.remote.missing
      ? this.content()
      : new StateGraph(this.remote.source, this.url);
    const next = applyDocumentCollectionFields(
      base,
      new StateGraph(fields, this.url)
    );
    readDocumentCollection(next);
    const saved = await session.perform(
      () =>
        saveDocument(
          session.client,
          {
            ...this.remote,
            graph: next
          },
          { redirect: 'error' }
        ),
      { interactive: false }
    );
    this.remote = saved;
    this.creating = false;
    this.dirty = false;
    await this.persist(this.content());
    return saved;
  }
  initializeWorkspace() {
    this.workspace = workspace({
      context: oldm.context(),
      resources: [
        resource('collection', {
          baseURI: this.url,
          scalarPredicates: collectionScalarPredicates,
          local: graph.resource({
            id: 'local',
            url: this.store.url || 'memory://document-collection',
            local: true,
            load: async () => projectDocumentCollection(this.content()).write(),
            save: (text, options) => this.writeLocal(text, options)
          }),
          remote: solid.resource(this.url, {
            id: 'remote',
            load: () => this.readRemote(),
            save: (text) => this.writeRemote(text)
          })
        })
      ],
      collections: { records: collection({ sources: ['collection'] }) }
    });
  }
  async sync() {
    const result = await this.workspace.sync('collection');
    this.error = result.error || null;
    if (result.status === 'sync-pending') {
      this.dirty = true;
    }
    if (!result.ok) {
      throw result.error;
    }
    return result;
  }
  modified(id) {
    const previous = this.content().one(
      named(id),
      collectionModified,
      'dateTime'
    );
    const time = Math.max(Date.now(), (Date.parse(previous?.value) || 0) + 1);
    return oldm.literal(new Date(time).toISOString(), {
      type: xsd + 'dateTime'
    });
  }
  async update(id, changes) {
    const node = this.workspace.graph('collection').get(id);
    if (!node) {
      throw new Error(
        'document-collection: This collection record is unavailable.'
      );
    }
    const next = this.workspace.collections.records.update(node, {
      ...changes,
      [collectionModified]: this.modified(id)
    });
    const result = await this.workspace.collections.records.save(next, {
      collectionEdit: true
    });
    if (!result.ok) {
      throw result.error;
    }
    return id;
  }
  async rename(title) {
    if (!title.trim()) {
      throw new Error('document-collection: Choose a collection title.');
    }
    return this.update(this.state().id, { [collectionTitle]: title.trim() });
  }
  async setDestination(url) {
    const next = createDocumentCollection(this.url, this.state().title, url);
    return this.update(this.state().id, {
      [ns + 'destination']: new oldm.NamedNode(
        readDocumentCollection(next).destination
      )
    });
  }
  async addDocument({
    document,
    title = document,
    kind = '',
    managed = false
  } = {}) {
    document = httpUrl(document);
    const state = this.state();
    const existing = state.entries.find(
      (entry) =>
        entry.document === document || entry.originalDocument === document
    );
    if (existing && !existing.deleted) {
      return existing.id;
    }
    const id =
      existing?.id || (await collectionEntryId(this.url, state.id, document));
    const changes = {
      [ns + 'document']: new oldm.NamedNode(document),
      [collectionTitle]: title,
      [ns + 'kind']: kind,
      [ns + 'managed']: oldm.literal(String(managed), { type: xsd + 'boolean' })
    };
    if (existing) {
      const node = this.workspace.graph('collection').get(id);
      node.graph.delete(id, collectionDeleted);
      return this.update(id, changes);
    }
    await this.workspace.createIn(
      'collection',
      {
        id,
        a: ns + 'Entry',
        ...changes,
        [ns + 'collection']: new oldm.NamedNode(state.id),
        [collectionModified]: this.modified(id)
      },
      { collectionEdit: true }
    );
    return id;
  }
  async removeReference(id) {
    if (!this.state().entries.some((entry) => entry.id === id)) {
      throw new Error(
        'document-collection: The document entry is unavailable.'
      );
    }
    return this.update(id, {
      [collectionDeleted]: 'Removed from this collection'
    });
  }
  async repairReference(id, document) {
    document = httpUrl(document);
    const entry = this.state().entries.find((entry) => entry.id === id);
    if (!entry) {
      throw new Error(
        'document-collection: The original entry is unavailable.'
      );
    }
    if (entry.document === document) {
      return id;
    }
    return this.update(id, {
      [ns + 'originalDocument']: new oldm.NamedNode(entry.originalDocument),
      [ns + 'document']: new oldm.NamedNode(document)
    });
  }
  async updateSummary(id, title) {
    if (
      this.state().entries.find((entry) => entry.id === id)?.title === title
    ) {
      return id;
    }
    return this.update(id, { [collectionTitle]: title });
  }
  async addGroup(title) {
    if (!title.trim()) {
      throw new Error('document-collection: Choose a group title.');
    }
    const id = this.url + '#group-' + crypto.randomUUID();
    await this.workspace.createIn(
      'collection',
      {
        id,
        a: ns + 'Group',
        [collectionTitle]: title.trim(),
        [ns + 'collection']: new oldm.NamedNode(this.state().id),
        [collectionModified]: this.modified(id)
      },
      { collectionEdit: true }
    );
    return id;
  }
  async setGroups(id, groups) {
    const state = this.state();
    if (
      !state.entries.some((entry) => entry.id === id) ||
      groups.some(
        (groupId) =>
          !state.groups.some(
            (group) => group.id === groupId && !group.deleted
          ) &&
          !state.entries
            .find((entry) => entry.id === id)
            ?.groups.includes(groupId)
      )
    ) {
      throw new Error(
        'document-collection: Choose existing collection entries and groups.'
      );
    }
    if (!groups.length) {
      // OLDM's array writer emits an empty object position for []. Remove the
      // relation through its public graph API before saving the modified record.
      this.workspace.graph('collection').delete(id, ns + 'group');
      return this.update(id, {});
    }
    return this.update(id, {
      [ns + 'group']: groups.map((id) => new oldm.NamedNode(id))
    });
  }
}
