import test from 'node:test';
import assert from 'node:assert/strict';
import { shape, field, id, uri } from '@muze-labs/oldm-shape';
import { workspace, resource, graph, solid }
  from '@muze-labs/solid-workspace';
import {
  createSolidMetroClient, loadDocument, oldm
} from '../packages/solid-app-data/src/index.mjs';
import { sameGraph } from '../packages/solid-app-data/src/state-rdf.mjs';

const url = 'https://pod.example/notes.ttl';
const source = '@base <' + url + '> . <#note> a <urn:Note>, <urn:Foreign>; ' +
  '<urn:title> "Before"; <urn:unknown> "a", "b". ' +
  '<#other> <urn:title> "Untouched".';

test('globals use the client and RDF types used by Workbench data APIs', async () => {
  const client = createSolidMetroClient(url, { oidc: false }).with(
    () => metro.response(new Response(source, {
      headers: { 'Content-Type': 'text/turtle' }
    }))
  );
  assert(client instanceof metro.Client);
  assert.equal(globalThis.oldm, oldm);
  const requests = [];
  metro.trace.add('workbench-fixture', {
    request(request) {
      requests.push(request.url);
    }
  });
  try {
    const document = await loadDocument(client, url);
    assert(document.graph.get(url + '#note') instanceof oldm.NamedNode);
    assert(requests.includes(url));
  }
  finally {
    metro.trace.remove('workbench-fixture');
  }
});

test('published shape updates retain additional RDF types and unknown facts', async () => {
  const context = oldm.context();
  const native = context.parse(source, url, 'text/turtle');
  const Note = shape('urn:Note', {
    id: id(uri()),
    title: field('urn:title', String)
  });
  const subject = native.get(url + '#note');
  const draft = Note.fromOldm(subject);
  const updated = Note.toOldm({ ...draft, title: 'After' }, native);
  assert.equal(updated.id, subject.id);
  // Repeated mappings must retain the foreign class without duplicating types.
  Note.toOldm({ ...draft, title: 'After' }, native);
  const saved = await native.write();
  assert(sameGraph(saved, source.replace('Before', 'After'), url));
  assert.equal(Note.fromOldm(updated).title, 'After');
});

test('published workspace classifies HTTP failures while local RDF stays usable', async () => {
  const cases = [
    { status: 401, state: 'auth-needed' },
    { status: 403, state: 'auth-needed' },
    { status: 412, state: 'error' },
    { status: 503, state: 'error' }
  ];
  for (const { status, state } of cases) {
    for (const location of ['direct', 'cause', 'typed', 'precedence']) {
      const failure = location === 'typed'
        ? new TypeError('HTTP failure') : new Error('HTTP failure');
      if (location === 'cause') {
        failure.cause = { status };
      }
      else {
        failure.status = status;
        if (location === 'precedence') {
          failure.cause = { status: status === 401 ? 503 : 401 };
        }
      }
      const ws = workspace({
        context: oldm.context(),
        resources: [resource('notes', {
          baseURI: url,
          local: graph.resource({
            id: 'local', url: 'memory://notes', local: true,
            load: async () => source
          }),
          remote: solid.resource(url, {
            id: 'remote',
            load: async () => { throw failure; }
          })
        })]
      });
      await ws.openResource('notes');
      assert.equal(ws.status.sources.remote.state, state,
        location + ' HTTP ' + status);
      assert.equal(ws.status.sources.remote.error, failure);
      assert.equal(ws.status.sources.local.state, 'ready');
      const retained = await ws.graph('notes').write();
      assert(sameGraph(retained, source, url), retained);
    }
  }
  const offline = new TypeError('Network unavailable');
  const ws = workspace({
    sources: [solid.resource(url, {
      id: 'remote', load: async () => { throw offline; }
    })]
  });
  await ws.load({ throwOnError: false });
  assert.equal(ws.status.sources.remote.state, 'offline');
  assert.equal(ws.status.sources.remote.error, offline);
});
