import { render } from '@muze-labs/cobalt-rich-text-note';
import { named, literal, rdf } from './state-rdf.mjs';
import { validateFragment, writeFragment } from './cobalt-fragment.mjs';

const format = 'http://purl.org/dc/terms/format';
const hasFormat = 'http://purl.org/dc/terms/hasFormat';
const textualBody = 'http://www.w3.org/ns/oa#TextualBody';

// Editing produces both a native value and a portable HTML representation.
// Kept outside cobalt-fragment so readers do not import the editor engine.
export function cobaltBody(value) {
  const fragment = validateFragment(value);
  return { fragment, html: render(fragment) };
}

export function writeCobaltFragment(graph, id, value) {
  const body = cobaltBody(value);
  const root = named(id);
  const candidates = graph
    .values(root, hasFormat)
    .filter((node) =>
      graph.values(node, format).some((term) => term.value === 'text/html')
    );
  if (candidates.length > 1) {
    throw new Error('cobalt-html: Multiple HTML representations need review.');
  }
  const htmlNode = candidates[0] || named('urn:uuid:' + crypto.randomUUID());
  // Validate interpreted fields before any native graph mutation. Unrelated
  // formats and unknown statements remain authoritative and are preserved.
  if (candidates.length) {
    graph.one(htmlNode, format, 'string', true);
    graph.one(htmlNode, rdf + 'value', 'string', true);
  }
  writeFragment(graph, id, body.fragment);
  graph.add(root, hasFormat, htmlNode);
  graph.add(htmlNode, rdf + 'type', named(textualBody));
  graph.set(htmlNode, format, literal('text/html'));
  graph.set(htmlNode, rdf + 'value', literal(body.html));
  return htmlNode;
}
