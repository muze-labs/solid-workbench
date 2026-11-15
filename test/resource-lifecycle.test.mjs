import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { ResourceLifecycle } from '../packages/solid-app-data/src/resource-lifecycle.mjs';
import { resolveResource } from '../packages/solid-app-data/src/resource-resolution.mjs';
import {
  StateGraph,
  named,
  literal,
  sameGraph
} from '../packages/solid-app-data/src/state-rdf.mjs';
import { prefixes } from '../packages/solid-app-data/src/index.mjs';
const origin = 'https://pod.example';
const source = origin + '/storage/source.ttl';
const target = origin + '/storage/target.ttl';
const turtle =
  '<> <urn:related> <relative>; <urn:unknown> _:cycle. _:cycle <urn:loop> _:cycle.';
function fixture() {
  let sequence = 0;
  const files = new Map();
  const requests = [];
  const put = (url, body, type = 'text/turtle') =>
    files.set(url, {
      body,
      type,
      etag: '"v' + ++sequence + '"'
    });
  put(source, turtle);
  put(origin + '/.meta', '');
  put(origin + '/storage/.meta', '<urn:other> <urn:foreign> "keep".');
  let fail = '';
  let lose = '';
  const response = (status, item) =>
    new Response(item?.body || null, {
      status,
      headers: {
        'Content-Type': item?.type || 'text/turtle',
        ETag: item?.etag || '"empty"'
      }
    });
  const client = {
    async head(url, options) {
      requests.push({ method: 'HEAD', url, ...options });
      return new Response(null, {
        status: 200,
        headers: { Link: '<.meta>; rel="describedby"' }
      });
    },
    async get(url, options) {
      requests.push({ method: 'GET', url, ...options });
      const item = files.get(url);
      return response(item ? 200 : 404, item);
    },
    async put(url, options) {
      requests.push({ method: 'PUT', url, ...options });
      if (fail === url) {
        throw new Error('fixture: offline');
      }
      const item = files.get(url);
      if (
        item
          ? options.headers['If-Match'] !== item.etag
          : options.headers['If-None-Match'] !== '*'
      ) {
        return response(412);
      }
      put(url, options.body, options.headers['Content-Type']);
      if (lose === url) {
        lose = '';
        throw new Error('fixture: response lost');
      }
      return response(200, files.get(url));
    },
    async delete(url, options) {
      requests.push({ method: 'DELETE', url, ...options });
      const item = files.get(url);
      if (!item || options.headers['If-Match'] !== item.etag) {
        return response(412);
      }
      files.delete(url);
      if (lose === 'DELETE') {
        lose = '';
        throw new Error('fixture: response lost');
      }
      return response(204);
    }
  };
  const session = {
    client,
    webId: origin + '/profile#me',
    perform: (work) => work()
  };
  return {
    files,
    put,
    requests,
    session,
    fail(url) {
      fail = url;
    },
    lose(url) {
      lose = url;
    },
    operation(store = local.memory(crypto.randomUUID())) {
      return new ResourceLifecycle({ owner: session.webId, session, store });
    }
  };
}
test('confirmed permanent deletion removes bytes before publishing a conditional tombstone', async () => {
  const server = fixture();
  const op = await server.operation().open();
  await assert.rejects(
    () => op.begin({ kind: 'delete', source }),
    /confirmation/
  );
  assert(server.files.has(source));
  await op.begin({ kind: 'delete', source, confirmed: true });
  assert(!server.files.has(source));
  const writes = server.requests.filter((r) =>
    ['PUT', 'DELETE'].includes(r.method)
  );
  assert.deepEqual(
    writes.map((r) => r.method),
    ['DELETE', 'PUT']
  );
  assert(writes.every((r) => r.redirect === 'error' && r.headers['If-Match']));
  const metadata = new StateGraph(
    server.files.get(origin + '/storage/.meta').body,
    origin + '/storage/.meta'
  );
  assert.equal(
    metadata.one(named('urn:other'), 'urn:foreign', 'string').value,
    'keep'
  );
  assert.equal(
    (await resolveResource(server.session.client, source)).status,
    'deleted'
  );
  assert.equal(op.pending.stage, 'complete');
  await op.acknowledge();
  assert.equal(op.pending, null);
});
test('move verifies the copy and preserves native RDF identity, cycles and relative meaning', async () => {
  const server = fixture();
  const op = await server.operation().open();
  await op.begin({ kind: 'move', source, target, confirmed: true });
  assert(!server.files.has(source));
  assert(
    sameGraph(
      turtle,
      new TextDecoder().decode(server.files.get(target).body),
      source
    )
  );
  const resolution = await resolveResource(
    server.session.client,
    source + '#block'
  );
  assert.equal(resolution.current, target + '#block');
  assert.equal(resolution.temporary, false);
  assert.equal(resolution.steps.length, 1);
});
test('metadata failure after removal and lost DELETE response remain retryable through reload', async () => {
  for (const failure of ['metadata', 'DELETE']) {
    const server = fixture();
    const store = local.memory(crypto.randomUUID());
    const op = await server.operation(store).open();
    if (failure === 'metadata') {
      server.fail(origin + '/storage/.meta');
    }
    else {
      server.lose('DELETE');
    }
    await assert.rejects(() =>
      op.begin({ kind: 'delete', source, confirmed: true })
    );
    assert(!server.files.has(source));
    assert(['removed', 'deleting'].includes(op.pending.stage));
    server.fail('');
    const retry = await server.operation(store).open();
    await retry.retry();
    assert.equal(retry.pending.stage, 'complete');
    assert.equal(
      server.requests.filter((r) => r.method === 'DELETE').length,
      1
    );
  }
});
test('lost copy response is verified; occupied destination and concurrent source changes retain source', async () => {
  const server = fixture();
  const store = local.memory(crypto.randomUUID());
  const op = await server.operation(store).open();
  server.lose(target);
  await assert.rejects(
    () => op.begin({ kind: 'move', source, target, confirmed: true }),
    /response lost/
  );
  assert(server.files.has(source));
  const retry = await server.operation(store).open();
  await retry.retry();
  assert.equal(retry.pending.stage, 'complete');
  assert.equal(
    server.requests.filter((r) => r.method === 'PUT' && r.url === target)
      .length,
    1
  );
  const other = fixture();
  other.put(target, 'different content', 'text/plain');
  const conflict = await other.operation().open();
  await assert.rejects(
    () => conflict.begin({ kind: 'move', source, target, confirmed: true }),
    (e) => e.status === 412
  );
  await assert.rejects(() => conflict.retry(), /destination already exists/);
  assert.equal(conflict.pending.stage, 'copy-conflict');
  assert(other.files.has(source));
  assert(!other.requests.some((r) => r.method === 'DELETE'));
  await conflict.cancel();
});
test('parent/ancestor authority overrides own-sidecar and temporary forwarding never repairs identity', async () => {
  const server = fixture();
  const metadata = new StateGraph('', origin + '/.meta');
  metadata.set(
    named(origin + '/storage/'),
    prefixes.lm + 'redirectTemporary',
    named(origin + '/new/')
  );
  server.put(origin + '/.meta', metadata.write());
  server.put(
    source + '.meta',
    `<${source}> <${prefixes.lm}deleted> "untrusted".`
  );
  const result = await resolveResource(server.session.client, source);
  assert.equal(result.current, origin + '/new/source.ttl');
  assert.equal(result.temporary, true);
  metadata.add(
    named(origin + '/storage/'),
    prefixes.lm + 'deleted',
    literal('conflict')
  );
  server.put(origin + '/.meta', metadata.write());
  await assert.rejects(
    () => resolveResource(server.session.client, source),
    /Conflicting/
  );
});

test('binary move is byte-exact and a source edit after copying prevents removal', async () => {
  const server = fixture();
  const bytes = new Uint8Array([0, 255, 7, 128, 10]);
  server.put(source, bytes, 'application/octet-stream');
  const op = await server.operation().open();
  await op.begin({ kind: 'move', source, target, confirmed: true });
  assert.deepEqual(new Uint8Array(server.files.get(target).body), bytes);
  const changed = fixture();
  const originalPut = changed.session.client.put;
  changed.session.client.put = async (url, options) => {
    const response = await originalPut(url, options);
    if (url === target) {
      changed.put(source, '<urn:new> <urn:value> "concurrent edit".');
    }
    return response;
  };
  const conflict = await changed.operation().open();
  await assert.rejects(
    () => conflict.begin({ kind: 'move', source, target, confirmed: true }),
    /source changed/
  );
  assert(changed.files.get(source).body.includes('concurrent edit'));
  assert(!changed.requests.some((r) => r.method === 'DELETE'));
});

test('weak validators, structured references and ambiguous descriptions refuse removal', async () => {
  const weak = fixture();
  weak.files.get(source).etag = 'W/"one"';
  await assert.rejects(
    () => weak.operation().begin({ kind: 'delete', source, confirmed: true }),
    /strong file validator/
  );
  assert(weak.files.has(source));
  assert(
    !weak.requests.some((request) => ['PUT', 'DELETE'].includes(request.method))
  );
  const structured = fixture();
  for (const uri of [source + '#subject', origin + '/storage/']) {
    await assert.rejects(
      () =>
        structured
          .operation()
          .begin({ kind: 'delete', source: uri, confirmed: true }),
      /whole file/
    );
  }
  assert.equal(structured.requests.length, 0);
  const ambiguous = fixture();
  ambiguous.session.client.head = async () =>
    new Response(null, {
      headers: { Link: '<.one>; rel="describedby", <.two>; rel="describedby"' }
    });
  await assert.rejects(
    () =>
      ambiguous.operation().begin({ kind: 'delete', source, confirmed: true }),
    /Ambiguous/
  );
  assert(ambiguous.files.has(source));
  assert(!ambiguous.requests.some((request) => request.method === 'DELETE'));
});
