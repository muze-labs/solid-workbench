import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StateGraph,
  named,
  literal,
  rdf
} from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  cobalt,
  readFragment,
  writeFragment,
  validateFragment
} from '../packages/solid-app-data/src/cobalt-fragment.mjs';

const id = 'urn:slide:text';
const value = {
  text: 'Hello 🌍',
  annotations: [
    { range: [0, 5], tag: '<strong>', order: 1 },
    { range: [3, 8], tag: '<em>', order: 2 },
    { range: [0, 5], tag: '<a href="https://example.test/">', order: 3 }
  ]
};

test('Cobalt native RDF round trip retains annotation order, overlap and Unicode offsets', () => {
  const graph = new StateGraph();
  writeFragment(graph, id, value);
  const turtle = graph.write();
  assert.deepEqual(readFragment(new StateGraph(turtle), id), value);
  assert(!turtle.includes('rdf:JSON'));
  assert(graph.values(named(id), cobalt + 'annotations').length === 1);
});

test('editing preserves identities, unknown RDF and detached annotations', () => {
  const graph = new StateGraph('<urn:other> <urn:keep> "untouched" .');
  writeFragment(graph, id, value);
  const head = graph.one(named(id), cobalt + 'annotations', 'node');
  const annotation = graph.one(head, rdf + 'first', 'node');
  graph.add(annotation, 'urn:keep', literal('private metadata'));
  writeFragment(graph, id, { ...value, text: 'Hello 🌍!' });
  assert.equal(
    graph.one(named(id), cobalt + 'annotations', 'node').id,
    head.id
  );
  writeFragment(graph, id, { text: '', annotations: [] });
  assert.deepEqual(readFragment(new StateGraph(graph.write()), id), {
    text: '',
    annotations: []
  });
  assert.match(graph.write(), /private metadata/);
  assert.match(graph.write(), /untouched/);
});

test('invalid input and unsupported stored formatting refuse edits without changing the graph', () => {
  const graph = new StateGraph();
  writeFragment(graph, id, value);
  const before = graph.write();
  assert.throws(() =>
    writeFragment(graph, id, {
      text: 'x',
      annotations: [{ range: [0, 2], tag: '<strong>', order: 1 }]
    })
  );
  assert.equal(graph.write(), before);
  const head = graph.one(named(id), cobalt + 'annotations', 'node');
  const item = graph.one(head, rdf + 'first', 'node');
  graph.set(item, cobalt + 'tag', literal('<strong onclick="evil()">'));
  const retained = graph.write();
  assert.throws(() => writeFragment(graph, id, { text: '', annotations: [] }));
  assert.equal(graph.write(), retained);
});

test('links cannot introduce active HTML or executable URL schemes', () => {
  for (const tag of [
    '<img src=x onerror=evil()>',
    '<a href="javascript:alert(1)">',
    '<a href="&#106;avascript:alert(1)">',
    '<a href="https://safe.test" onclick="evil()">'
  ]) {
    assert.throws(() =>
      validateFragment({
        text: 'test',
        annotations: [{ range: [0, 4], tag, order: 0 }]
      })
    );
  }
  assert.doesNotThrow(() =>
    validateFragment({
      text: 'mail',
      annotations: [
        { range: [0, 4], tag: '<a href="mailto:hello@example.test">', order: 0 }
      ]
    })
  );
});

test('cyclic or unordered annotation structures are retained and rejected', () => {
  const graph = new StateGraph();
  writeFragment(graph, id, value);
  const head = graph.one(named(id), cobalt + 'annotations', 'node');
  graph.set(head, rdf + 'rest', head);
  assert.throws(() => readFragment(graph, id), /Cyclic/);
});
