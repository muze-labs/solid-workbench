import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StateGraph,
  named,
  literal,
  rdf
} from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  cobaltBody,
  writeCobaltFragment
} from '../packages/solid-app-data/src/cobalt-html.mjs';
import { readFragment } from '../packages/solid-app-data/src/cobalt-fragment.mjs';

const dct = 'http://purl.org/dc/terms/';
const id = 'urn:test:fragment';
const value = {
  text: 'Bold <text>',
  annotations: [{ range: [0, 4], tag: '<strong>', order: 0 }]
};

test('standard Cobalt output has portable HTML and round-trippable native data', () => {
  const graph = new StateGraph();
  const body = writeCobaltFragment(graph, id, value);
  const restored = new StateGraph(graph.write());
  assert.deepEqual(readFragment(restored, id), value);
  assert.equal(restored.one(named(id), dct + 'hasFormat', 'iri').id, body.id);
  assert.equal(restored.one(body, dct + 'format', 'string').value, 'text/html');
  assert.equal(
    restored.one(body, rdf + 'value', 'string').value,
    '<strong>Bold</strong> &lt;text&gt;'
  );
  assert.equal(cobaltBody(value).html, '<strong>Bold</strong> &lt;text&gt;');
});

test('edits update the same HTML body and preserve other formats and unknown RDF', () => {
  const graph = new StateGraph();
  const body = writeCobaltFragment(graph, id, value);
  graph.add(body, 'urn:unknown', literal('keep'));
  graph.add(named(id), dct + 'hasFormat', named('urn:other:format'));
  writeCobaltFragment(graph, id, { text: 'New', annotations: [] });
  assert.equal(graph.one(body, rdf + 'value', 'string').value, 'New');
  assert.equal(graph.one(body, 'urn:unknown', 'string').value, 'keep');
  assert.equal(graph.values(named(id), dct + 'hasFormat').length, 2);
});

test('ambiguous HTML bodies refuse edits without changing the graph', () => {
  const graph = new StateGraph();
  writeCobaltFragment(graph, id, value);
  const extra = named('urn:extra:html');
  graph.add(named(id), dct + 'hasFormat', extra);
  graph.add(extra, dct + 'format', literal('text/html'));
  graph.add(extra, rdf + 'value', literal('<p>Other</p>'));
  const before = graph.write();
  assert.throws(() => writeCobaltFragment(graph, id, value), /Multiple HTML/);
  assert.equal(graph.write(), before);
});
