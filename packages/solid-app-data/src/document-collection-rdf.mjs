import {
  StateGraph,
  named,
  literal,
  rdf,
  xsd,
  sameTerm
} from './state-rdf.mjs';
import { httpUrl, documentUrl } from './url.mjs';

export const documentCollections = 'https://vocab.muze.nl/collections#';
export const collectionTitle = 'http://purl.org/dc/terms/title';
export const collectionModified = 'http://purl.org/dc/terms/modified';
export const collectionDeleted =
  'https://purl.org/pdsinterop/link-metadata#deleted';
const collectionTypes = ['Collection', 'Entry', 'Group'];
const fields = {
  Collection: ['version', 'destination'],
  Entry: [
    'collection',
    'document',
    'originalDocument',
    'kind',
    'managed',
    'group'
  ],
  Group: ['collection']
};

function error(message) {
  throw new Error('document-collection-rdf: ' + message);
}
function classSubjects(graph, type) {
  if (
    graph.quads.some(
      (quad) =>
        quad.predicate.id === rdf + 'type' &&
        quad.object.id === documentCollections + type &&
        quad.subject.termType !== 'NamedNode'
    )
  ) {
    error('Collection records need stable named identities.');
  }
  return [
    ...new Set(
      graph.quads
        .filter(
          (quad) =>
            quad.predicate.id === rdf + 'type' &&
            quad.object.id === documentCollections + type
        )
        .map((quad) => quad.subject.id)
    )
  ].map(named);
}
export function collectionRoot(graph) {
  const roots = classSubjects(graph, 'Collection');
  if (roots.length !== 1) {
    error('Expected one named Collection; the source is retained.');
  }
  return roots[0];
}
function folder(value) {
  const url = httpUrl(value);
  if (!new URL(url).pathname.endsWith('/') || new URL(url).hash) {
    error('Choose a document folder ending in /.');
  }
  return url;
}
function members(graph, root, type) {
  return classSubjects(graph, type).filter((subject) =>
    graph
      .values(subject, documentCollections + 'collection')
      .some((value) => sameTerm(value, root))
  );
}
function deleted(graph, subject) {
  return graph.values(subject, collectionDeleted).length > 0;
}
export function readDocumentCollection(graph) {
  const root = collectionRoot(graph);
  const version = graph.one(
    root,
    documentCollections + 'version',
    'integer',
    true
  );
  if (version.value !== '1') {
    error('This collection version is unsupported; the source is retained.');
  }
  const title = graph.one(root, collectionTitle, 'string', true).value;
  const destination = folder(
    graph.one(root, documentCollections + 'destination', 'iri', true).id
  );
  const groups = members(graph, root, 'Group').map((subject) => {
    graph.one(subject, documentCollections + 'collection', 'iri', true);
    return {
      id: subject.id,
      title: graph.one(subject, collectionTitle, 'string', true).value,
      deleted: deleted(graph, subject)
    };
  });
  const entries = members(graph, root, 'Entry').map((subject) => {
    graph.one(subject, documentCollections + 'collection', 'iri', true);
    const uri = httpUrl(
      graph.one(subject, documentCollections + 'document', 'iri', true).id
    );
    const groups = graph.values(subject, documentCollections + 'group');
    if (groups.some((value) => value.termType !== 'NamedNode')) {
      error('Group references must be named resources.');
    }
    const managed = graph.one(
      subject,
      documentCollections + 'managed',
      'boolean'
    );
    if (managed && !['true', 'false', '1', '0'].includes(managed.value)) {
      error('Invalid document management flag.');
    }
    return {
      id: subject.id,
      document: uri,
      originalDocument: httpUrl(
        graph.one(subject, documentCollections + 'originalDocument', 'iri')
          ?.id || uri
      ),
      title: graph.one(subject, collectionTitle, 'string')?.value || uri,
      kind:
        graph.one(subject, documentCollections + 'kind', 'string')?.value || '',
      managed: ['true', '1'].includes(managed?.value),
      groups: groups.map((value) => value.id),
      deleted: deleted(graph, subject)
    };
  });
  return { id: root.id, title, destination, groups, entries };
}
export function createDocumentCollection(uri, title, destination) {
  if (typeof title !== 'string' || !title.trim()) {
    error('Choose a collection title.');
  }
  const url = httpUrl(uri);
  const root = named(new URL(url).hash ? url : url + '#collection');
  const graph = new StateGraph('', documentUrl(url));
  graph.add(root, rdf + 'type', named(documentCollections + 'Collection'));
  graph.set(root, documentCollections + 'version', literal(1, xsd + 'integer'));
  graph.set(root, collectionTitle, literal(title.trim()));
  graph.set(
    root,
    documentCollections + 'destination',
    named(folder(destination))
  );
  graph.set(
    root,
    collectionModified,
    literal(new Date().toISOString(), xsd + 'dateTime')
  );
  readDocumentCollection(graph);
  return graph;
}
export async function collectionEntryId(collectionUrl, root, uri) {
  const value = root + '\n' + httpUrl(uri);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return documentUrl(collectionUrl) + '#entry-' + hash;
}
function editableSubjects(graph) {
  const result = new Map();
  if (!graph.quads.length) {
    return result;
  }
  const root = collectionRoot(graph);
  result.set(root.id, 'Collection');
  for (const type of ['Entry', 'Group']) {
    for (const subject of members(graph, root, type)) {
      if (result.has(subject.id)) {
        error('Collection records cannot have conflicting roles.');
      }
      result.set(subject.id, type);
    }
  }
  return result;
}
function editableTriple(quad, subjects) {
  const type = subjects.get(quad.subject.id);
  if (!type) {
    return false;
  }
  if (quad.predicate.id === rdf + 'type') {
    return quad.object.id === documentCollections + type;
  }
  return [
    collectionTitle,
    collectionModified,
    collectionDeleted,
    ...fields[type].map((field) => documentCollections + field)
  ].includes(quad.predicate.id);
}
// The library merges editable fields. Full native graphs remain authoritative;
// Unconnected anonymous structures must bypass the object-graph writer, which
// still omits them even though reachable shared/cyclic nodes now round-trip.
export function projectDocumentCollection(graph) {
  const subjects = editableSubjects(graph);
  const projection = graph.clone();
  projection.quads = graph.quads.filter((quad) =>
    editableTriple(quad, subjects)
  );
  return projection;
}
export function applyDocumentCollectionFields(graph, projection) {
  const subjects = editableSubjects(projection);
  const next = graph.clone();
  next.quads = graph.quads.filter((quad) => !editableTriple(quad, subjects));
  next.quads.push(
    ...projection.quads.filter((quad) => editableTriple(quad, subjects))
  );
  return next;
}
export const collectionScalarPredicates = [
  collectionTitle,
  collectionModified,
  collectionDeleted,
  ...new Set(
    collectionTypes.flatMap((type) =>
      fields[type].map((field) => documentCollections + field)
    )
  )
];
