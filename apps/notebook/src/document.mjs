import { local } from '@muze-labs/solid-workspace';
import {
  StateGraph,
  named,
  literal,
  rdf,
  xsd,
  sameGraph
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import {
  readFragment,
  writeFragment
} from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { loadDocument, httpUrl } from '@muze-labs/solid-app-data';
import { DocumentSession }
  from '@muze-labs/solid-app-data/document-session.mjs';
import { resolveResource } from '@muze-labs/solid-app-data/resource-resolution.mjs';

export const notebook = 'https://vocab.muze.nl/notebook#';
const registryRoot = named('urn:muze:solid-notebook:library');
const fields = ['url', 'etag', 'dirty', 'target', 'alias'];

// App policy only: native graphs, local sources and HTTP remain library-owned.
export class NotebookDocuments extends DocumentSession {
  constructor({ owner = '', store } = {}) {
    super({
      owner,
      requestOptions: { redirect: 'error' },
      keepBaselineWithETag: true,
      messages: {
        account: 'notebook: Connect with this notebook’s account first.',
        address: 'notebook: Use a document URL without a fragment.',
        exists: 'notebook: A file exists there. Choose another filename in Save As.'
      }
    });
    this.store =
      store ||
      ((id) =>
        local.indexedDB('solid-notebook', {
          key: owner + '\n' + id
        }));
  }
  async open() {
    this.index = new StateGraph(await this.store('index').load());
    const selected = this.index.one(registryRoot, notebook + 'selected', 'iri');
    if (selected) {
      await this.select(selected.id);
    }
    else {
      await this.create();
    }
    return this;
  }
  entries() {
    return this.index
      .values(registryRoot, notebook + 'document')
      .map((term) => ({
        id: term.id,
        title:
          this.index.one(term, notebook + 'title', 'string')?.value ||
          'Untitled notebook'
      }));
  }
  async select(id) {
    if (this.graph) {
      await this.persist();
    }
    const graph = new StateGraph(await this.store(id).load());
    const root = this.validate(graph);
    await this.activate(() => {
      this.id = id;
      this.graph = graph;
      this.root = root;
      this.url = graph.one(root, notebook + 'local-url', 'string')?.value || '';
      this.target =
        graph.one(root, notebook + 'local-target', 'string')?.value || '';
      this.etag =
        graph.one(root, notebook + 'local-etag', 'string')?.value || null;
      this.dirty =
        graph.one(root, notebook + 'local-dirty', 'string')?.value === 'true';
      this.revision++;
    });
  }
  async activate(change) {
    const previous = {
      id: this.id,
      graph: this.graph,
      root: this.root,
      url: this.url,
      target: this.target,
      etag: this.etag,
      dirty: this.dirty,
      revision: this.revision,
      index: this.index.clone()
    };
    try {
      change();
      await this.persist();
    }
    catch (error) {
      Object.assign(this, previous);
      throw error;
    }
  }
  validate(graph) {
    const roots = graph.quads.filter(
      (q) =>
        q.predicate.id === rdf + 'type' && q.object.id === notebook + 'Notebook'
    );
    if (roots.length !== 1 || roots[0].subject.termType !== 'NamedNode') {
      throw new Error(
        'notebook: Expected one named Notebook. Data is retained.'
      );
    }
    const root = roots[0].subject;
    this.titleFragment(graph, root);
    const positions = new Set();
    for (const term of graph.values(root, notebook + 'block')) {
      if (term.termType !== 'NamedNode') {
        throw new Error('notebook: Block identities must be named resources.');
      }
      const position = Number(
        graph.one(term, notebook + 'position', 'integer', true).value
      );
      if (
        !Number.isSafeInteger(position) ||
        position < 0 ||
        positions.has(position)
      ) {
        throw new Error('notebook: Invalid or repeated block position.');
      }
      positions.add(position);
      const type = graph.one(term, notebook + 'kind', 'string', true).value;
      if (type !== 'cobalt.rich-text') {
        throw new Error('notebook: This block type cannot be edited here.');
      }
      readFragment(graph, term.id);
    }
    return root;
  }
  get title() {
    return this.graph.one(this.root, notebook + 'title', 'string', true).value;
  }
  titleFragment(graph = this.graph, root = this.root) {
    const title = graph.one(root, notebook + 'title', 'string', true).value;
    const content = graph.one(root, notebook + 'title-content', 'iri');
    if (!content) {
      return { text: title, annotations: [] };
    }
    const fragment = readFragment(graph, content.id);
    if (fragment.text !== title) {
      throw new Error('notebook: Conflicting title content is retained.');
    }
    return fragment;
  }
  editorBlocks() {
    return [
      { id: this.root.id, position: -1, fragment: this.titleFragment() },
      ...this.blocks()
    ];
  }
  blocks() {
    return this.graph.values(this.root, notebook + 'block').map((term) => ({
      id: term.id,
      position: Number(
        this.graph.one(term, notebook + 'position', 'integer', true).value
      ),
      fragment: readFragment(this.graph, term.id)
    }));
  }
  changeTitle(value) {
    this.edit(this.root.id, { text: value, annotations: [] });
  }
  edit(id, fragment) {
    if (id === this.root.id) {
      this.titleFragment();
      const content =
        this.graph.one(this.root, notebook + 'title-content', 'iri') ||
        named('urn:uuid:' + crypto.randomUUID());
      writeFragment(this.graph, content.id, fragment);
      this.graph.set(this.root, notebook + 'title-content', content);
      this.graph.set(this.root, notebook + 'title', literal(fragment.text));
      this.changed();
      return;
    }
    writeFragment(this.graph, id, fragment);
    this.changed();
  }
  add(
    fragment = { text: '', annotations: [] },
    position = this.blocks().length
  ) {
    const id = 'urn:uuid:' + crypto.randomUUID();
    for (const block of this.blocks()) {
      if (block.position >= position) {
        this.graph.set(
          named(block.id),
          notebook + 'position',
          literal(block.position + 1, xsd + 'integer')
        );
      }
    }
    this.graph.add(this.root, notebook + 'block', named(id));
    this.graph.set(
      named(id),
      notebook + 'position',
      literal(position, xsd + 'integer')
    );
    this.graph.set(named(id), notebook + 'kind', literal('cobalt.rich-text'));
    this.edit(id, fragment);
    return id;
  }
  remove(id) {
    if (id === this.root.id) {
      throw new Error('notebook: The title cannot be removed.');
    }
    const blocks = this.blocks().filter((b) => b.id !== id);
    this.graph.set(this.root, notebook + 'block');
    blocks
      .sort((a, b) => a.position - b.position)
      .forEach((b, i) => {
        this.graph.add(this.root, notebook + 'block', named(b.id));
        this.graph.set(
          named(b.id),
          notebook + 'position',
          literal(i, xsd + 'integer')
        );
      });
    // Detached content/unknown statements remain in the native graph.
    this.changed();
  }
  async create() {
    if (this.graph) {
      await this.persist();
    }
    await this.activate(() => {
      this.id = 'urn:uuid:' + crypto.randomUUID();
      this.root = named('urn:uuid:' + crypto.randomUUID());
      this.graph = new StateGraph();
      this.graph.add(this.root, rdf + 'type', named(notebook + 'Notebook'));
      this.graph.set(
        this.root,
        notebook + 'title',
        literal('Untitled notebook')
      );
      this.url = '';
      this.target = '';
      this.etag = null;
      this.add();
    });
  }
  content() {
    const graph = this.graph.clone();
    for (const field of fields) {
      graph.set(this.root, notebook + 'local-' + field);
    }
    return graph;
  }
  persist() {
    for (const [field, value] of Object.entries({
      url: this.url || '',
      target: this.target || '',
      etag: this.etag || '',
      dirty: String(this.dirty)
    })) {
      this.graph.set(this.root, notebook + 'local-' + field, literal(value));
    }
    const source = this.graph.write();
    const id = this.id;
    this.index.add(registryRoot, notebook + 'document', named(id));
    this.index.set(named(id), notebook + 'title', literal(this.title));
    this.index.set(
      named(id),
      notebook + 'url',
      literal(this.url || this.target || '')
    );
    this.index.set(named(id), notebook + 'alias');
    for (const alias of this.graph.values(
      this.root,
      notebook + 'local-alias'
    )) {
      this.index.add(named(id), notebook + 'alias', alias);
    }
    this.index.set(registryRoot, notebook + 'selected', named(id));
    const index = this.index.write();
    return this.enqueueRecoveryWrite(async () => {
      await this.store(id).save(source);
      await this.store('index').save(index);
    });
  }
  baselineFor() {
    return this.store('baseline:' + this.id);
  }
  creationFor(url) {
    return this.store('pending:' + this.id + ':' + url);
  }
  savedCopy(url, asNew) {
    if (asNew && url !== this.url) {
      this.graph.set(this.root, notebook + 'local-alias');
    }
  }
  async acknowledgeSave(saved, revision) {
    this.target = '';
    // Notebook's existing save API resolves without returning a remote record.
    await super.acknowledgeSave(saved, revision);
  }
  async load(session, address) {
    this.requireAccount(session);
    await this.persist();
    const revision = this.revision;
    let document;
    try {
      document = await session.perform(() =>
        loadDocument(session.client, address, { redirect: 'error' })
      );
    }
    catch (originalError) {
      let resolution;
      try {
        resolution = await session.perform(
          () => resolveResource(session.client, address),
          { interactive: false }
        );
      }
      catch {
        throw originalError;
      }
      if (resolution.status !== 'available' || resolution.current === address) {
        throw originalError;
      }
      document = await session.perform(() =>
        loadDocument(session.client, resolution.current, { redirect: 'error' })
      );
    }
    const graph = new StateGraph(document.source, document.url);
    const root = this.validate(graph);
    if (revision !== this.revision) {
      throw new Error(
        'notebook: Your edits changed while opening. They are retained.'
      );
    }
    // Each recovery copy keeps the exact native source it was based on.
    const id = 'urn:uuid:' + crypto.randomUUID();
    await this.store('baseline:' + id).save(document.source);
    await this.activate(() => {
      this.id = id;
      this.graph = graph;
      this.root = root;
      this.url = document.url;
      this.target = '';
      this.etag = document.etag;
      this.dirty = false;
      this.revision++;
    });
    if (document.url !== address) {
      await this.rememberReference(address);
    }
  }
  cachedEntry(address) {
    return this.entries().find(
      (entry) =>
        this.index.one(named(entry.id), notebook + 'url', 'string')?.value ===
          address ||
        this.index
          .values(named(entry.id), notebook + 'alias')
          .some((alias) => alias.id === address)
    );
  }
  async openCached(session, address) {
    if (this.url === address || this.target === address) {
      return;
    }
    const cached = this.cachedEntry(address);
    if (cached) {
      await this.select(cached.id);
    }
    else {
      await this.load(session, address);
    }
  }
  hasCached(address) {
    return (
      this.url === address ||
      this.target === address ||
      Boolean(this.cachedEntry(address))
    );
  }
  async rememberReference(address) {
    address = httpUrl(address);
    if (
      address === this.url ||
      this.graph
        .values(this.root, notebook + 'local-alias')
        .some((alias) => alias.id === address)
    ) {
      return;
    }
    this.graph.add(
      this.root,
      notebook + 'local-alias',
      named(httpUrl(address))
    );
    await this.persist();
  }
  async applyFileOperation(operation, session) {
    let remote;
    if (operation.kind === 'move') {
      remote = await session.perform(
        () =>
          loadDocument(session.client, operation.target, { redirect: 'error' }),
        { interactive: false }
      );
    }
    for (const entry of this.entries()) {
      const url = this.index.one(
        named(entry.id),
        notebook + 'url',
        'string'
      )?.value;
      if (url !== operation.source) {
        continue;
      }
      const graph =
        entry.id === this.id
          ? this.graph
          : new StateGraph(await this.store(entry.id).load());
      const root = this.validate(graph);
      const baseline = await this.store('baseline:' + entry.id).load();
      const previousEtag = graph.one(
        root,
        notebook + 'local-etag',
        'string'
      )?.value;
      const matches =
        remote &&
        ((previousEtag && previousEtag === operation.etag) ||
          (baseline && sameGraph(baseline, remote.source, operation.source)));
      const nextEtag = matches ? remote.etag : null;
      const needsReview = operation.kind === 'move' && !matches;
      if (matches) {
        await this.store('baseline:' + entry.id).save(remote.source);
      }
      const nextUrl = operation.kind === 'move' ? operation.target : '';
      if (operation.kind === 'move') {
        graph.add(root, notebook + 'local-alias', named(operation.source));
      }
      graph.set(root, notebook + 'local-url', literal(nextUrl));
      graph.set(root, notebook + 'local-target', literal(''));
      graph.set(root, notebook + 'local-etag', literal(nextEtag || ''));
      if (operation.kind === 'delete' || needsReview) {
        graph.set(root, notebook + 'local-dirty', literal('true'));
      }
      await this.store(entry.id).save(graph.write());
      this.index.set(named(entry.id), notebook + 'url', literal(nextUrl));
      for (const alias of graph.values(root, notebook + 'local-alias')) {
        this.index.add(named(entry.id), notebook + 'alias', alias);
      }
      if (entry.id === this.id) {
        this.url = nextUrl;
        this.target = '';
        this.etag = nextEtag;
        if (operation.kind === 'delete' || needsReview) {
          this.changed();
        }
      }
    }
    await this.persist();
  }
}
