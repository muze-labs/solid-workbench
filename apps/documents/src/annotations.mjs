import {
  StateGraph,
  named,
  literal,
  rdf,
  sameGraph,
  xsd
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import { loadDocument, saveDocument, httpUrl } from '@muze-labs/solid-app-data';

import {
  cobalt,
  readFragment,
  writeFragment,
  validateFragment
} from '@muze-labs/solid-app-data/cobalt-fragment.mjs';

export const oa = 'http://www.w3.org/ns/oa#';
export const dct = 'http://purl.org/dc/terms/';
export const doc = 'https://vocab.muze.nl/documents#';
export const member = 'http://www.w3.org/2000/01/rdf-schema#member';
const uuid = () => 'urn:uuid:' + crypto.randomUUID();

// Native group data. View projections never replace this graph.
export class AnnotationGroup {
  constructor(turtle = '', base = uuid()) {
    this.graph = new StateGraph(turtle, base);
    const roots = this.graph.quads.filter(
      (quad) =>
        quad.predicate.id === rdf + 'type' &&
        quad.object.id === oa + 'AnnotationCollection'
    );
    if (turtle && roots.length !== 1) {
      throw new Error('documents/annotations: Expected one annotation group.');
    }
    this.root = roots[0]?.subject || named(base);
    if (this.root.termType !== 'NamedNode') {
      throw new Error(
        'documents/annotations: A group needs a stable named identity.'
      );
    }
    if (!turtle) {
      this.graph.add(
        this.root,
        rdf + 'type',
        named(oa + 'AnnotationCollection')
      );
      this.rename('My notes');
    }
    else {
      const source = this.graph.one(this.root, doc + 'document', 'iri', true);
      for (const annotation of this.annotations()) {
        if (annotation.document !== source.id) {
          throw new Error(
            'documents/annotations: A group resource contains another PDF.'
          );
        }
      }
    }
  }
  get name() {
    return this.graph.one(this.root, dct + 'title', 'string', true).value;
  }
  get isSaved() {
    return Boolean(
      this.remote?.source &&
        !this.remote.missing &&
        sameGraph(this.write(), this.remote.source, this.remote.url)
    );
  }
  rename(name) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('documents/annotations: Give the group a name.');
    }
    this.graph.set(this.root, dct + 'title', literal(name.trim()));
  }
  annotations() {
    return this.graph.values(this.root, member).map((subject) => {
      if (subject.termType !== 'NamedNode') {
        throw new Error(
          'documents/annotations: Anonymous annotation identities are unsupported and retained.'
        );
      }
      const graph = this.graph;
      const target = graph.one(subject, oa + 'hasTarget', 'node', true);
      const body = graph.one(subject, oa + 'hasBody', 'node');
      const page = Number(
        graph.one(target, doc + 'page', 'integer', true).value
      );
      if (!Number.isSafeInteger(page) || page < 1) {
        throw new Error('documents/annotations: Invalid page marker.');
      }
      if (
        body &&
        graph.one(body, dct + 'format', 'string', true).value !== 'text/html'
      ) {
        throw new Error(
          'documents/annotations: Unsupported body format retained.'
        );
      }
      const selector = graph.one(target, oa + 'hasSelector', 'node');
      return {
        id: subject.id,
        authors: graph.values(subject, dct + 'creator').map((agent) => ({
          id: agent.id || '',
          label:
            agent.termType === 'Literal'
              ? agent.value
              : graph.values(agent, 'http://xmlns.com/foaf/0.1/nick')[0]
                  ?.value ||
                graph.values(agent, 'http://xmlns.com/foaf/0.1/givenName')[0]
                  ?.value ||
                graph.values(agent, 'http://xmlns.com/foaf/0.1/name')[0]
                  ?.value ||
                graph.values(agent, 'http://schema.org/name')[0]?.value ||
                agent.id ||
                'Unknown author'
        })),
        document: graph.one(target, oa + 'hasSource', 'iri', true).id,
        digest: graph.one(target, doc + 'sha256', 'string', true).value,
        page,
        quote: selector
          ? graph.one(selector, oa + 'exact', 'string')?.value || ''
          : '',
        html: body ? graph.one(body, rdf + 'value', 'string', true).value : '',
        paragraph: graph.one(target, doc + 'paragraph', 'string')?.value || '',
        start: graph.one(target, doc + 'pageTextStart', 'integer')?.value,
        end: graph.one(target, doc + 'pageTextEnd', 'integer')?.value
      };
    });
  }
  add({
    document,
    digest,
    page,
    quote = '',
    paragraph = '',
    start,
    end,
    html = '',
    creator = ''
  }) {
    if (
      ![document, digest, quote, paragraph, creator].every(
        (value) => typeof value === 'string'
      )
    ) {
      throw new Error('documents/annotations: Anchor fields must be text.');
    }
    if (typeof html !== 'string') {
      throw new Error('documents/annotations: Expected an HTML body.');
    }
    if (!document || !digest || !Number.isSafeInteger(page) || page < 1) {
      throw new Error(
        'documents/annotations: A document revision and page are required.'
      );
    }
    const source = this.graph.one(this.root, doc + 'document', 'iri');
    if (source && source.id !== document) {
      throw new Error(
        'documents/annotations: Each PDF needs its own group resource.'
      );
    }
    this.graph.set(this.root, doc + 'document', named(document));
    const subject = named(uuid());
    const target = named(uuid());
    const graph = this.graph;
    graph.add(this.root, member, subject);
    graph.add(subject, rdf + 'type', named(oa + 'Annotation'));
    graph.set(subject, oa + 'hasTarget', target);
    graph.set(
      subject,
      oa + 'motivatedBy',
      named(oa + (html ? 'commenting' : 'highlighting'))
    );
    graph.set(
      subject,
      dct + 'created',
      literal(new Date().toISOString(), xsd + 'dateTime')
    );
    if (creator) {
      graph.set(subject, dct + 'creator', named(creator));
    }
    graph.add(target, rdf + 'type', named(oa + 'SpecificResource'));
    graph.set(target, oa + 'hasSource', named(document));
    graph.set(target, doc + 'sha256', literal(digest));
    graph.set(target, doc + 'page', literal(page, xsd + 'integer'));
    if (paragraph) {
      graph.set(target, doc + 'paragraph', literal(paragraph));
    }
    if (quote) {
      const selector = named(uuid());
      graph.set(target, oa + 'hasSelector', selector);
      graph.add(selector, rdf + 'type', named(oa + 'TextQuoteSelector'));
      graph.set(selector, oa + 'exact', literal(quote));
      // PDF.js page text offsets are app hints, not global OA text positions.
      if (Number.isSafeInteger(start) && Number.isSafeInteger(end)) {
        graph.set(
          target,
          doc + 'pageTextStart',
          literal(start, xsd + 'integer')
        );
        graph.set(target, doc + 'pageTextEnd', literal(end, xsd + 'integer'));
      }
    }
    this.setBody(subject.id, html);
    return subject.id;
  }
  remove(id) {
    const subject = named(id);
    if (!this.graph.values(this.root, member).some((node) => node.id === id)) {
      return false;
    }
    const graph = this.graph.clone();
    const links = new Set([
      oa + 'hasBody',
      oa + 'hasTarget',
      oa + 'hasSelector',
      dct + 'hasFormat',
      cobalt + 'annotations',
      rdf + 'first',
      rdf + 'rest'
    ]);
    const owned = new Set([id]);
    const collect = (set) => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const quad of graph.quads) {
          if (
            set.has(quad.subject.id) &&
            links.has(quad.predicate.id) &&
            quad.object.termType !== 'Literal' &&
            quad.object.id !== rdf + 'nil' &&
            !set.has(quad.object.id)
          ) {
            set.add(quad.object.id);
            changed = true;
          }
        }
      }
    };
    collect(owned);
    // A body/selector shared by another annotation must survive this deletion.
    const shared = new Set(
      graph.quads
        .filter(
          (quad) =>
            !owned.has(quad.subject.id) &&
            owned.has(quad.object.id) &&
            quad.object.id !== id
        )
        .map((quad) => quad.object.id)
    );
    collect(shared);
    graph.quads = graph.quads.filter(
      (quad) =>
        !(owned.has(quad.subject.id) && !shared.has(quad.subject.id)) &&
        !(
          quad.subject.id === this.root.id &&
          quad.predicate.id === member &&
          quad.object.id === id
        )
    );
    this.graph = graph;
  }
  copyEmptyNoteTo(id, destination) {
    const note = this.annotations().find((entry) => entry.id === id);
    if (!note || note.html || this.fragment(id)) {
      throw new Error(
        'documents/annotations: Only a new empty marker can change destination.'
      );
    }
    if (destination.annotations().some((entry) => entry.id === id)) {
      throw new Error(
        'documents/annotations: Destination already contains this note.'
      );
    }
    const document = destination.graph.one(
      destination.root,
      doc + 'document',
      'iri'
    );
    if (document && document.id !== note.document) {
      throw new Error(
        'documents/annotations: Destination belongs to another PDF.'
      );
    }
    const subject = named(id);
    const target = this.graph.one(subject, oa + 'hasTarget', 'node', true);
    const body = this.graph.one(subject, oa + 'hasBody', 'node');
    const selector = this.graph.one(target, oa + 'hasSelector', 'node');
    const nodes = [subject, target, body, selector]
      .filter(Boolean)
      .map((node) => node.id);
    const graph = destination.graph.clone();
    for (const quad of this.graph.quads) {
      if (nodes.includes(quad.subject.id)) {
        graph.add(quad.subject, quad.predicate.id, quad.object);
      }
    }
    graph.add(destination.root, member, subject);
    graph.set(destination.root, doc + 'document', named(note.document));
    destination.graph = graph;
  }
  detachEmptyNote(id) {
    const note = this.annotations().find((entry) => entry.id === id);
    if (!note || note.html || this.fragment(id)) {
      throw new Error(
        'documents/annotations: The original marker changed; it is retained.'
      );
    }
    const members = this.graph.values(this.root, member);
    this.graph.set(this.root, member, undefined);
    for (const item of members) {
      if (item.id !== id) {
        this.graph.add(this.root, member, item);
      }
    }
    // Retain every other statement, including unknown metadata.
  }
  fragment(id) {
    const body = this.graph.one(named(id), oa + 'hasBody', 'node');
    const source = body && this.cobaltBody(this.graph, body);
    return source ? readFragment(this.graph, source.id) : undefined;
  }
  cobaltBody(graph, body) {
    const candidates = graph
      .values(body, dct + 'hasFormat')
      .filter((node) =>
        graph
          .values(node, rdf + 'type')
          .some((type) => type.id === cobalt + 'Fragment')
      );
    if (candidates.length > 1) {
      throw new Error(
        'documents/annotations: Multiple native Cobalt bodies are retained.'
      );
    }
    if (candidates[0] && candidates[0].termType !== 'NamedNode') {
      throw new Error(
        'documents/annotations: Anonymous native bodies are retained.'
      );
    }
    return candidates[0];
  }
  setBody(id, html, fragment) {
    if (typeof html !== 'string') {
      throw new Error('documents/annotations: Expected an HTML body.');
    }
    const subject = named(id);
    if (fragment !== undefined) {
      validateFragment(fragment);
    }
    const graph = this.graph.clone();
    if (!graph.values(this.root, member).some((node) => node.id === id)) {
      throw new Error('documents/annotations: This note is not in the group.');
    }
    const existing = graph.one(subject, oa + 'hasBody', 'node');
    if (existing) {
      if (
        graph.one(existing, dct + 'format', 'string', true).value !==
        'text/html'
      ) {
        throw new Error('documents/annotations: Unsupported body retained.');
      }
      graph.one(existing, rdf + 'value', 'string', true);
    }
    const body = existing || named(uuid());
    const native = this.cobaltBody(graph, body);
    if (fragment !== undefined) {
      const source = native || named(uuid());
      writeFragment(graph, source.id, fragment);
      graph.add(body, dct + 'hasFormat', source);
    }
    else if (
      native &&
      graph.one(body, rdf + 'value', 'string')?.value !== html
    ) {
      // An HTML-only replacement editor cannot update a native Cobalt value.
      // Retain that graph, but detach its now-stale representation link.
      const formats = graph.values(body, dct + 'hasFormat');
      graph.set(body, dct + 'hasFormat', undefined);
      for (const format of formats) {
        if (format.id !== native.id) {
          graph.add(body, dct + 'hasFormat', format);
        }
      }
    }
    graph.set(subject, oa + 'hasBody', body);
    graph.add(body, rdf + 'type', named(oa + 'TextualBody'));
    graph.set(body, dct + 'format', literal('text/html'));
    graph.set(body, rdf + 'value', literal(html));
    graph.set(
      subject,
      dct + 'modified',
      literal(new Date().toISOString(), xsd + 'dateTime')
    );
    this.graph = graph;
  }
  write() {
    return this.graph.write();
  }
}

export async function openGroup(session, address) {
  const url = httpUrl(address);
  const document = await session.perform(() =>
    loadDocument(session.client, url, { redirect: 'error' })
  );
  const group = new AnnotationGroup(document.source, url);
  annotationFolder(
    new URL('.', url).href,
    group.graph.one(group.root, doc + 'document', 'iri', true).id
  );
  group.remote = { ...document, graph: group.graph };
  group.owner = session.webId;
  return group;
}

// The destination is explicitly selected independently of the source PDF.
// Never resolve a relative annotation path against a document on another Pod.
export function annotationFolder(address, source) {
  const folder = new URL(httpUrl(address));
  if (!folder.pathname.endsWith('/') || folder.search || folder.hash) {
    throw new Error(
      'documents/annotations: Choose an annotations folder URL ending in /.'
    );
  }
  if (/^https?:/.test(source) && new URL('.', source).href === folder.href) {
    throw new Error(
      'documents/annotations: Choose a separate folder from the PDF.'
    );
  }
  return folder.href;
}

export async function createGroupDestination(session, group, address) {
  if (group.remote) {
    throw new Error(
      'documents/annotations: This group already has a Pod resource.'
    );
  }
  const source = group.graph.one(group.root, doc + 'document', 'iri', true).id;
  const folder = annotationFolder(address, source);
  const identity = new TextEncoder().encode(source + '\n' + group.root.id);
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', identity)
  );
  const filename =
    Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('') +
    '.ttl';
  group.remote = { url: new URL(filename, folder).href, missing: true };
  group.owner = session.webId;
  return group.remote.url;
}

export async function saveGroup(session, group) {
  if (group.localConflict) {
    throw new Error(
      'documents/annotations: Export this recovered draft before resolving the conflict.'
    );
  }
  if (!group.remote || group.owner !== session.webId) {
    throw new Error(
      'documents/annotations: Open a group with this account first.'
    );
  }
  annotationFolder(
    new URL('.', httpUrl(group.remote.url)).href,
    group.graph.one(group.root, doc + 'document', 'iri', true).id
  );
  const snapshot = { ...group.remote, graph: group.graph.clone() };
  const saved = await session.perform(() =>
    saveDocument(session.client, snapshot, { redirect: 'error' })
  );
  group.remote = saved;
  return saved;
}
