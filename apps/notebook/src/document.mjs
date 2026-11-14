import { local } from '@muze-labs/solid-workspace';
import {
  StateGraph,
  named,
  literal,
  rdf,
  xsd
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import {
  readFragment,
  writeFragment
} from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { loadDocument, saveDocument, httpUrl } from '@muze-labs/solid-app-data';

export const notebook = 'https://vocab.muze.nl/notebook#';
const registryRoot = named('urn:muze:solid-notebook:library');
const fields = ['url', 'etag', 'dirty'];

// App policy only: native graphs, local sources and HTTP remain library-owned.
export class NotebookDocuments {
  constructor({ owner = '', store } = {}) {
    this.owner = owner;
    this.store =
      store ||
      ((id) =>
        local.indexedDB('solid-notebook', {
          key: owner + '\n' + id
        }));
    this.queue = Promise.resolve();
    this.revision = 0;
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
  changed() {
    this.dirty = true;
    this.revision++;
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
      etag: this.etag || '',
      dirty: String(this.dirty)
    })) {
      this.graph.set(this.root, notebook + 'local-' + field, literal(value));
    }
    const source = this.graph.write();
    const id = this.id;
    this.index.add(registryRoot, notebook + 'document', named(id));
    this.index.set(named(id), notebook + 'title', literal(this.title));
    this.index.set(registryRoot, notebook + 'selected', named(id));
    const index = this.index.write();
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        await this.store(id).save(source);
        await this.store('index').save(index);
      });
    return this.queue;
  }
  session(session) {
    if (!session || session.webId !== this.owner) {
      throw new Error('notebook: Connect with this notebook’s account first.');
    }
  }
  async save(session, address, asNew = false) {
    this.session(session);
    const url = httpUrl(address);
    if (new URL(url).hash) {
      throw new Error('notebook: Use a document URL without a fragment.');
    }
    await this.persist();
    const revision = this.revision;
    const graph = this.content();
    let document;
    if (!asNew && this.url === url) {
      document = {
        url,
        graph,
        etag: this.etag,
        missing: false,
        source: (await this.store('baseline:' + url).load()) || undefined
      };
    }
    else {
      document = await session.perform(() =>
        loadDocument(session.client, url, { allowMissing: true })
      );
      if (!document.missing) {
        throw new Error(
          'notebook: A file exists there. Choose another filename in Save As.'
        );
      }
      document.graph = graph;
    }
    const saved = await session.perform(() =>
      saveDocument(session.client, document)
    );
    await this.store('baseline:' + url).save(saved.source);
    this.url = url;
    this.etag = saved.etag;
    this.dirty = revision !== this.revision;
    await this.persist();
  }
  async load(session, address) {
    this.session(session);
    await this.persist();
    const revision = this.revision;
    const document = await session.perform(() =>
      loadDocument(session.client, address)
    );
    const graph = new StateGraph(document.source, document.url);
    const root = this.validate(graph);
    if (revision !== this.revision) {
      throw new Error(
        'notebook: Your edits changed while opening. They are retained.'
      );
    }
    await this.store('baseline:' + document.url).save(document.source);
    // New recovery identity even for copies with the same native RDF root.
    await this.activate(() => {
      this.id = 'urn:uuid:' + crypto.randomUUID();
      this.graph = graph;
      this.root = root;
      this.url = document.url;
      this.etag = document.etag;
      this.dirty = false;
      this.revision++;
    });
  }
}
