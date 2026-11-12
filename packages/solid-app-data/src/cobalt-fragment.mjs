import { named, literal, rdf, xsd } from './state-rdf.mjs';

export const cobalt = 'https://vocab.muze.nl/cobalt#';

export function validateFragment(value) {
  if (
    !value ||
    typeof value.text !== 'string' ||
    !Array.isArray(value.annotations)
  ) {
    throw new Error('cobalt-fragment: Expected text and annotations.');
  }
  for (const item of value.annotations) {
    if (
      !Array.isArray(item.range) ||
      item.range.length !== 2 ||
      !item.range.every(Number.isSafeInteger) ||
      item.range[0] < 0 ||
      item.range[1] < item.range[0] ||
      item.range[1] > value.text.length ||
      !Number.isSafeInteger(item.order) ||
      typeof item.tag !== 'string'
    ) {
      throw new Error('cobalt-fragment: Invalid formatting range.');
    }
    // Cobalt 0.1.0 emits stored attributes. Only interpret the formatting this
    // integration can safely render; never flatten unsupported stored content.
    if (/^<\/?(?:strong|em|u|a)>$/.test(item.tag)) {
      continue;
    }
    const link = /^<a href="([^"<>]*)">$/.exec(item.tag);
    if (!link) {
      throw new Error('cobalt-fragment: Unsupported formatting is retained.');
    }
    const href = link[1]
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    if (!['http:', 'https:', 'mailto:'].includes(new URL(href).protocol)) {
      throw new Error('cobalt-fragment: Unsupported link address.');
    }
  }
  return {
    text: value.text,
    annotations: value.annotations.map((item) => ({
      range: [...item.range],
      tag: item.tag,
      order: item.order
    }))
  };
}

function members(graph, root) {
  let node = graph.one(root, cobalt + 'annotations', 'node');
  const result = [];
  const seen = new Set();
  while (node && node.id !== rdf + 'nil') {
    if (seen.has(node.id)) {
      throw new Error('cobalt-fragment: Cyclic annotation list.');
    }
    seen.add(node.id);
    const item = graph.one(node, rdf + 'first', 'node', true);
    result.push({ node, item });
    node = graph.one(node, rdf + 'rest', 'node', true);
  }
  return result;
}

export function readFragment(graph, id, fallback = '') {
  const root = named(id);
  const text = graph.one(root, rdf + 'value', 'string')?.value ?? fallback;
  return validateFragment({
    text,
    annotations: members(graph, root).map(({ item }) => ({
      range: ['start', 'end'].map((key) =>
        Number(graph.one(item, cobalt + key, 'integer', true).value)
      ),
      tag: graph.one(item, cobalt + 'tag', 'string', true).value,
      order: Number(graph.one(item, cobalt + 'order', 'integer', true).value)
    }))
  });
}

export function writeFragment(graph, id, value) {
  const fragment = validateFragment(value);
  const root = named(id);
  readFragment(graph, id);
  const old = members(graph, root);
  const entries = fragment.annotations.map((item, index) => ({
    item,
    node: old[index]?.node || named('urn:uuid:' + crypto.randomUUID()),
    subject: old[index]?.item || named('urn:uuid:' + crypto.randomUUID())
  }));
  graph.add(root, rdf + 'type', named(cobalt + 'Fragment'));
  graph.set(root, rdf + 'value', literal(fragment.text));
  graph.set(
    root,
    cobalt + 'annotations',
    entries[0]?.node || named(rdf + 'nil')
  );
  entries.forEach(({ item, node, subject }, index) => {
    graph.set(node, rdf + 'first', subject);
    graph.set(
      node,
      rdf + 'rest',
      entries[index + 1]?.node || named(rdf + 'nil')
    );
    graph.set(
      subject,
      cobalt + 'start',
      literal(item.range[0], xsd + 'integer')
    );
    graph.set(subject, cobalt + 'end', literal(item.range[1], xsd + 'integer'));
    graph.set(subject, cobalt + 'tag', literal(item.tag));
    graph.set(subject, cobalt + 'order', literal(item.order, xsd + 'integer'));
  });
  // Detached list members remain in the graph, including unknown statements.
}
