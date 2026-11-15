import { local } from '@muze-labs/solid-workspace';
import { loadDocument, saveDocument } from './index.mjs';
import { StateGraph, named } from './state-rdf.mjs';
import { httpUrl } from './url.mjs';
import { documentCollections } from './document-collection-rdf.mjs';

// Apps own their preference subject; Preferences need not enumerate app names.
export class CollectionPreference {
  constructor({ owner, app, session, store }) {
    this.owner = owner;
    this.app = named(app);
    this.session = session;
    this.store =
      store ||
      local.indexedDB('solid-collection-preferences', {
        key: owner + '\n' + app
      });
    this.predicate = documentCollections + 'defaultCollection';
  }
  read(graph) {
    const value = graph.one(this.app, this.predicate, 'iri');
    return value ? httpUrl(value.id) : '';
  }
  async load() {
    const cache = new StateGraph(await this.store.load());
    this.value = this.read(cache);
    this.pending =
      cache.one(this.app, documentCollections + 'pendingDefault', 'iri')?.id ||
      '';
    this.error = null;
    try {
      const session = this.requireSession();
      this.document = await session.perform(
        () =>
          loadDocument(session.client, session.preferencesUrl, {
            allowMissing: true
          }),
        { interactive: false }
      );
      const graph = new StateGraph(
        this.document.source || '',
        this.document.url
      );
      const value = this.read(graph);
      const next = cache.clone();
      next.set(this.app, this.predicate);
      if (value) {
        next.set(this.app, this.predicate, named(value));
      }
      await this.store.save(next.write());
      this.value = value;
    }
    catch (error) {
      this.error = error;
    }
    return this.value;
  }
  requireSession() {
    if (
      !this.session ||
      this.session.webId !== this.owner ||
      !this.session.preferencesUrl
    ) {
      throw new Error(
        'collection-preference: Connect an account with a preferences file.'
      );
    }
    return this.session;
  }
  async prepareDefault(value) {
    value = httpUrl(value);
    const cache = new StateGraph(await this.store.load());
    cache.set(this.app, documentCollections + 'pendingDefault', named(value));
    await this.store.save(cache.write());
    this.pending = value;
  }
  async save(value, { onlyIfMissing = false } = {}) {
    value = httpUrl(value);
    const session = this.requireSession();
    // Re-read before each explicit change; unavailable preferences are never
    // treated as an empty document. saveDocument supplies the conditional write.
    const document = await session.perform(
      () =>
        loadDocument(session.client, session.preferencesUrl, {
          allowMissing: true
        }),
      { interactive: false }
    );
    const graph = new StateGraph(document.source || '', document.url);
    const existing = this.read(graph);
    if (onlyIfMissing && existing) {
      return this.load();
    }
    graph.set(this.app, this.predicate, named(value));
    this.document = await session.perform(
      () => saveDocument(session.client, { ...document, graph }),
      { interactive: false }
    );
    const cache = new StateGraph('');
    cache.set(this.app, this.predicate, named(value));
    await this.store.save(cache.write());
    this.value = value;
    this.pending = '';
    this.error = null;
    return value;
  }
}
