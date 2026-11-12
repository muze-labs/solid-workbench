import { turtleWriter } from '@muze-labs/oldm-turtle';
import { oldm, prefixes, loadDocument, documentUrl, valueAt } from './index.mjs';
import { recipientId, serializable } from './capabilities.mjs';
import { StateGraph, ownedQuads } from './state-rdf.mjs';

const valuePredicates = [
  prefixes.vcard + 'hasEmail', prefixes.vcard + 'hasTelephone'
];
const personTypes = [prefixes.vcard + 'Individual', prefixes.foaf + 'Person',
  prefixes.schema + 'Person', 'http://schema.org/Person'];
function descriptionSubjects(node) {
  const subjects = { [node.id]: node };
  for (const predicate of valuePredicates) {
    for (const value of [].concat(valueAt(node, predicate) || [])) {
      if (value instanceof oldm.NamedNode &&
          (valueAt(value, prefixes.vcard + 'value') !== undefined ||
            valueAt(value, prefixes.vcard + 'hasValue') !== undefined) &&
          ![].concat(value.a || []).some((type) => personTypes.includes(type))) {
        subjects[value.id] = value;
      }
    }
  }
  return subjects;
}

// OLDM's writer accepts a graph, but has no selected-subject option. Supply
// its read-only interface over the selected contact and its value nodes,
// retaining native literals without walking into other named contacts.
export async function describeRecipient(node, document) {
  const graph = node.graph;
  const anonymous = new Set();
  function inspect(value, depth = 0) {
    if (depth > 24) {
      throw new Error('recipient: Contact structure is too deeply nested.');
    }
    if (value instanceof oldm.NamedNode) {
      return;
    }
    if (value instanceof oldm.BlankNode || value instanceof oldm.Collection) {
      if (anonymous.has(value)) {
        throw new Error('recipient: Shared or cyclic anonymous values cannot be exported safely.');
      }
      anonymous.add(value);
      for (const item of Object.values(value)) {
        inspect(item, depth + 1);
      }
    }
    else if (Array.isArray(value)) {
      for (const item of value) {
        inspect(item, depth + 1);
      }
    }
  }
  const subjects = descriptionSubjects(node);
  for (const subject of Object.values(subjects)) {
    for (const value of Object.values(subject)) {
      inspect(value);
    }
  }
  const turtle = await turtleWriter({
    subjects,
    baseURI: graph.baseURI,
    prefixEntries: (preference) => graph.prefixEntries(preference),
    fullURI: (value) => graph.fullURI(value),
    relativeURI: (value) => graph.relativeURI(value),
    getType: (value) => graph.getType(value)
  });
  const result = { '@id': recipientId({ '@id': node.id }),
    description: { turtle } };
  if (document && /^https?:/.test(document)) {
    result.document = documentUrl(document);
  }
  // Check the full provider reply shape; broker request IDs are UUIDs.
  serializable({ type: 'reply',
    id: '00000000-0000-0000-0000-000000000000', result: { result } });
  if (new TextEncoder().encode(turtle).length > 60000) {
    throw new Error('recipient: Selected contact is too large to return.');
  }
  return result;
}

export async function readRecipient(result, session) {
  serializable(result);
  const id = recipientId(result);
  const document = result.document ? documentUrl(result.document) : '';
  let graph;
  let source;
  if (result.description) {
    if (typeof result.description.turtle !== 'string') {
      throw new Error('recipient: Unsupported contact description.');
    }
    const native = new StateGraph(result.description.turtle, document || id);
    graph = oldm.context({ prefixes }).parse(
      result.description.turtle, document || id, 'text/turtle'
    );
    const selected = graph.get(id);
    if (!selected) {
      throw new Error('recipient: Description has no selected contact.');
    }
    const allowed = new Set(Object.keys(descriptionSubjects(selected)));
    if (native.quads.some((quad) => quad.subject.termType === 'NamedNode' &&
        !allowed.has(quad.subject.id))) {
      throw new Error('recipient: Description contains another named entity.');
    }
    const included = new Set();
    for (const subject of allowed) {
      for (const quad of ownedQuads(native, subject)) {
        included.add(quad);
      }
    }
    if (included.size !== native.quads.length) {
      throw new Error('recipient: Description contains unattached information.');
    }
    source = 'Selected contact data';
  }
  else if (document && session) {
    const read = () => loadDocument(session.client, document);
    graph = (await session.perform(read, { interactive: false })).graph;
    source = 'Address-book document';
  }
  else {
    throw new Error('recipient: The selected contact needs a document or RDF description.');
  }
  const node = graph.get(id);
  if (!node || Object.keys(node).length <= 1) {
    throw new Error('recipient: The document does not describe the selected contact.');
  }
  return { id, document, node, source };
}
