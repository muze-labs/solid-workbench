import { local } from '@muze-labs/solid-workspace';
import {
  StateGraph,
  named,
  literal,
  rdf,
  xsd
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import { loadDocument, saveDocument, httpUrl } from '@muze-labs/solid-app-data';
import { from, asc } from '@muze-nl/jaqt';
import {
  readFragment,
  writeFragment
} from '@muze-labs/solid-app-data/cobalt-fragment.mjs';

export const presenter = 'https://vocab.muze.nl/presenter#';
const localFields = ['remote', 'etag', 'dirty', 'missing'];
const cachePredicate = (field) => presenter + 'local-' + field;

// Presenter policy over existing native graph, local Turtle and conditional
// document APIs. Remote replica sync does not supply conditional writes.
export class DeckDocument {
  constructor({ owner = '', source, baselineFor } = {}) {
    this.source =
      source ||
      local.indexedDB('solid-presenter', {
        key: owner || 'anonymous'
      });
    this.owner = owner;
    this.baselineFor =
      baselineFor ||
      ((url) =>
        local.indexedDB('solid-presenter-baselines', {
          key: owner + '\n' + url
        }));
    this.pending = Promise.resolve();
    this.revision = 0;
  }
  async open() {
    const text = await this.source.load();
    this.graph = new StateGraph(text);
    const roots = this.graph.quads.filter(
      (quad) =>
        quad.predicate.id === rdf + 'type' &&
        quad.object.id === presenter + 'Deck'
    );
    if (!roots.length && !text.trim()) {
      this.root = named('urn:uuid:' + crypto.randomUUID());
      this.graph.add(this.root, rdf + 'type', named(presenter + 'Deck'));
      this.graph.set(this.root, presenter + 'title', literal('Untitled deck'));
      this.dirty = false;
      await this.persist();
    }
    else {
      if (roots.length !== 1 || roots[0].subject.termType !== 'NamedNode') {
        throw new Error(
          'presenter: Expected one named deck. Local data is retained.'
        );
      }
      this.root = roots[0].subject;
      this.url = this.cacheValue('remote');
      this.etag = this.cacheValue('etag') || null;
      this.dirty = this.cacheValue('dirty') === 'true';
      this.missing = this.cacheValue('missing') === 'true';
      this.validate();
    }
    return this;
  }
  async create() {
    if (this.dirty) {
      throw new Error('presenter: Save this deck before starting another.');
    }
    await this.pending;
    const candidate = await new DeckDocument({
      owner: this.owner,
      source: local.memory('new-deck')
    }).open();
    await this.source.save(candidate.graph.write());
    this.graph = candidate.graph;
    this.root = candidate.root;
    this.url = '';
    this.etag = null;
    this.dirty = false;
    this.missing = false;
    this.revision += 1;
  }
  cacheValue(field) {
    return (
      this.graph.one(this.root, cachePredicate(field), 'string')?.value || ''
    );
  }
  value(subject, property, kind = 'string') {
    const term = this.graph.one(named(subject), presenter + property, kind);
    return kind === 'iri' ? term?.id || '' : term?.value || '';
  }
  get title() {
    return this.value(this.root.id, 'title');
  }
  slides() {
    return this.graph.values(this.root, presenter + 'slide').map((term) => {
      if (term.termType !== 'NamedNode') {
        throw new Error('presenter: Slide identities must be named resources.');
      }
      const position = Number(
        this.graph.one(term, presenter + 'position', 'integer', true).value
      );
      if (!Number.isSafeInteger(position) || position < 0) {
        throw new Error('presenter: Unsupported slide order.');
      }
      return {
        id: term.id,
        position,
        title: this.value(term.id, 'title'),
        layout: this.value(term.id, 'layout')
      };
    });
  }
  regions(slide) {
    return from(
      this.graph.values(named(slide), presenter + 'region').map((term) => {
        if (term.termType !== 'NamedNode') {
          throw new Error(
            'presenter: Region identities must be named resources.'
          );
        }
        return {
          id: term.id,
          name: this.value(term.id, 'name'),
          kind: this.value(term.id, 'kind'),
          text: this.value(term.id, 'text'),
          fragment: readFragment(
            this.graph,
            term.id,
            this.value(term.id, 'text')
          ),
          resource: this.value(term.id, 'resource', 'iri'),
          provider: this.value(term.id, 'provider', 'iri')
        };
      })
    )
      .orderBy({
        name: (left, right) =>
          (left.name === 'title' ? 0 : 1) - (right.name === 'title' ? 0 : 1)
      })
      .toArray();
  }
  validate() {
    this.graph.one(this.root, presenter + 'title', 'string', true);
    const positions = new Set();
    for (const slide of this.slides()) {
      if (
        !['text', 'image'].includes(slide.layout) ||
        positions.has(slide.position)
      ) {
        throw new Error(
          'presenter: Unsupported layout or duplicate slide order.'
        );
      }
      positions.add(slide.position);
      const regions = this.regions(slide.id);
      const names = new Set(regions.map((region) => region.name));
      if (regions.length !== 2 || !names.has('title') || !names.has('body')) {
        throw new Error(
          'presenter: This layout requires title and body regions.'
        );
      }
      for (const region of regions) {
        if (region.kind !== (region.name === 'title' ? 'text' : slide.layout)) {
          throw new Error('presenter: Unsupported region kind.');
        }
        if (region.resource) {
          httpUrl(region.resource);
        }
        if (region.provider) {
          httpUrl(region.provider);
        }
      }
    }
  }
  change(subject, property, value, kind = 'string') {
    // Refuse replacing an interpreted multi-value or structured field.
    this.graph.one(named(subject), presenter + property, kind);
    this.graph.set(
      named(subject),
      presenter + property,
      kind === 'iri'
        ? value
          ? named(value)
          : undefined
        : literal(value, xsd + kind)
    );
    this.revision += 1;
    this.dirty = true;
  }
  editText(id, fragment) {
    this.graph.one(named(id), presenter + 'text', 'string');
    writeFragment(this.graph, id, fragment);
    this.change(id, 'text', fragment.text);
  }
  addSlide(layout = 'text') {
    if (!['text', 'image'].includes(layout)) {
      throw new Error('presenter: Choose a supported layout.');
    }
    const id = 'urn:uuid:' + crypto.randomUUID();
    const position =
      Math.max(-1, ...this.slides().map((slide) => slide.position)) + 1;
    this.graph.add(this.root, presenter + 'slide', named(id));
    this.change(id, 'position', position, 'integer');
    this.change(id, 'layout', layout);
    for (const name of ['title', 'body']) {
      const region = 'urn:uuid:' + crypto.randomUUID();
      this.graph.add(named(id), presenter + 'region', named(region));
      this.change(region, 'name', name);
      this.change(region, 'kind', name === 'title' ? 'text' : layout);
      if (name === 'title' || layout === 'text') {
        this.change(region, 'text', '');
      }
    }
    return id;
  }
  moveSlide(id, offset) {
    const slides = from(this.slides()).orderBy({ position: asc }).toArray();
    const index = slides.findIndex((slide) => slide.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= slides.length) {
      return;
    }
    this.change(
      slides[index].id,
      'position',
      slides[target].position,
      'integer'
    );
    this.change(
      slides[target].id,
      'position',
      slides[index].position,
      'integer'
    );
  }
  removeSlide(id) {
    // Detach only the owned membership; preserve content and unknown statements.
    const keep = this.graph
      .values(this.root, presenter + 'slide')
      .filter((term) => term.id !== id);
    this.graph.set(this.root, presenter + 'slide');
    for (const term of keep) {
      this.graph.add(this.root, presenter + 'slide', term);
    }
    this.revision += 1;
    this.dirty = true;
  }
  content() {
    const graph = this.graph.clone();
    for (const field of localFields) {
      graph.set(this.root, cachePredicate(field));
    }
    return graph;
  }
  persist() {
    for (const [field, value] of Object.entries({
      remote: this.url || '',
      etag: this.etag || '',
      dirty: String(Boolean(this.dirty)),
      missing: String(Boolean(this.missing))
    })) {
      this.graph.set(this.root, cachePredicate(field), literal(value));
    }
    const text = this.graph.write();
    this.pending = this.pending
      .catch(() => {})
      .then(() => this.source.save(text));
    return this.pending;
  }
  async save(session, address) {
    if (!session || session.webId !== this.owner) {
      throw new Error(
        'presenter: Connect with this deck’s account before saving.'
      );
    }
    const url = httpUrl(address);
    if (new URL(url).hash) {
      throw new Error('presenter: Use a deck document URL without a fragment.');
    }
    await this.persist();
    const revision = this.revision;
    const graph = this.content();
    let document;
    if (this.url === url) {
      document = {
        url,
        etag: this.etag,
        missing: this.missing,
        graph,
        source: this.etag ? undefined : await this.baselineFor(url).load()
      };
    }
    else {
      document = await session.perform(() =>
        loadDocument(session.client, url, {
          allowMissing: true
        })
      );
      if (!document.missing) {
        throw new Error(
          'presenter: A document already exists there. Open it or choose a new URL.'
        );
      }
      document.graph = graph;
    }
    const saved = await session.perform(() =>
      saveDocument(session.client, document)
    );
    if (!saved.etag) {
      // A separate native Turtle document supplies the existing helper's
      // comparison baseline after 205/no-ETag replies, including after reload.
      await this.baselineFor(url).save(saved.source);
    }
    this.url = url;
    this.etag = saved.etag;
    this.missing = false;
    this.dirty = revision !== this.revision;
    await this.persist();
    return saved;
  }
  async load(session, address) {
    if (this.dirty) {
      throw new Error(
        'presenter: Save the local deck before opening another document.'
      );
    }
    if (!session || session.webId !== this.owner) {
      throw new Error(
        'presenter: Connect with this deck’s account before opening.'
      );
    }
    const revision = this.revision;
    const document = await session.perform(() =>
      loadDocument(session.client, address)
    );
    if (revision !== this.revision) {
      throw new Error(
        'presenter: The local deck changed while opening. Its edits are retained.'
      );
    }
    const candidate = new DeckDocument({
      owner: this.owner,
      source: local.memory('candidate', {
        turtle: new StateGraph(document.source, document.url).write()
      })
    });
    await candidate.open();
    if (!document.etag) {
      await this.baselineFor(document.url).save(
        new StateGraph(document.source, document.url).write()
      );
    }
    this.graph = candidate.graph;
    this.root = candidate.root;
    this.url = document.url;
    this.etag = document.etag;
    this.dirty = false;
    this.revision += 1;
    await this.persist();
  }
}
