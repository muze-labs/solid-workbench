import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { CollectionFileOperation } from '../packages/solid-app-data/src/collection-file-operation.mjs';
import { DocumentCollection } from '../packages/solid-app-data/src/document-collection.mjs';
import { NotebookDocuments } from '../apps/notebook/src/document.mjs';
import { PresenterDecks } from '../apps/presenter/src/deck-drafts.mjs';
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

const operationRoot = named('urn:muze:solid-apps:file-operation');
const operationNamespace = 'https://vocab.muze.nl/collections#';
const collectionUrl = origin + '/storage/collection.ttl';
const memberId = collectionUrl + '#member';
const owner = origin + '/profile#me';
function memoryStores() {
  const sources = new Map();
  return (id) => {
    if (!sources.has(id)) {
      sources.set(id, local.memory(id));
    }
    return sources.get(id);
  };
}
function collectionOperation(server, store) {
  return new CollectionFileOperation({ owner, session: server.session, store });
}

test('generic operation context preserves native foreign RDF through failed replies and stage writes', async () => {
  const server = fixture();
  const store = local.memory('native-context');
  const operation = await server.operation(store).open();
  const context = new StateGraph(
    '<urn:caller> <urn:job> "caller-owned"; a <urn:ExtraType>; <urn:cycle> _:loop. _:loop <urn:next> _:loop. _:unattached <urn:note> "retain anonymous".'
  );
  server.lose('DELETE');
  await assert.rejects(
    operation.begin({ kind: 'delete', source, confirmed: true, context }),
    /response lost/
  );
  assert.equal(operation.pending.stage, 'deleting');
  assert.equal(Object.hasOwn(operation.pending, 'collection'), false);
  assert.equal(Object.hasOwn(operation.pending, 'entry'), false);
  const reopened = await server.operation(store).open();
  await reopened.retry();
  assert.equal(reopened.pending.stage, 'complete');
  assert.equal(
    reopened.graph.one(named('urn:caller'), 'urn:job', 'string').value,
    'caller-owned'
  );
  assert.equal(
    reopened.graph.one(
      named('urn:caller'),
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'iri'
    ).id,
    'urn:ExtraType'
  );
  assert(reopened.graph.write().includes('retain anonymous'));
  assert(reopened.graph.write().includes('urn:next'));
  assert.equal(
    server.requests.filter((request) => request.method === 'DELETE').length,
    1
  );
  await reopened.acknowledge();
  assert.equal(await store.load(), '');
  const nextSource = origin + '/storage/next.ttl';
  server.put(nextSource, turtle);
  await reopened.begin({ kind: 'delete', source: nextSource, confirmed: true });
  assert.equal(
    reopened.graph.values(named('urn:caller'), 'urn:job').length,
    0,
    'Acknowledgement does not leak context into the next operation'
  );
});

test('context and operation intent commit together; failed persistence or conflicting context never removes bytes', async () => {
  const server = fixture();
  const memory = local.memory('atomic-context');
  const store = {
    load: () => memory.load(),
    save: async () => {
      throw new Error('fixture: journal write failed');
    }
  };
  const operation = await collectionOperation(server, store).open();
  await assert.rejects(
    operation.begin({
      kind: 'delete',
      source,
      confirmed: true,
      collection: collectionUrl,
      entry: memberId
    }),
    /journal write failed/
  );
  assert.equal(operation.pending, null);
  assert.equal(await memory.load(), '');
  assert(server.files.has(source));
  assert(!server.requests.some((request) => request.method === 'DELETE'));
  const context = new StateGraph('');
  context.set(operationRoot, operationNamespace + 'stage', literal('complete'));
  await assert.rejects(
    server
      .operation()
      .begin({ kind: 'delete', source, confirmed: true, context }),
    /Context cannot replace/
  );
  assert(server.files.has(source));
  assert(!server.requests.some((request) => request.method === 'DELETE'));
});

test('an existing native collection journal completes without replaying physical removal', async () => {
  const server = fixture();
  const store = local.memory('legacy-native-operation');
  await store.save(String.raw`<urn:muze:solid-apps:file-operation>
    <${operationNamespace}kind> "delete";
    <${operationNamespace}source> <${source}>;
    <${operationNamespace}etag> "\"v1\"";
    <${operationNamespace}digest> "${'0'.repeat(64)}";
    <${operationNamespace}stage> "complete";
    <${operationNamespace}collection> <${collectionUrl}>;
    <${operationNamespace}entry> <${memberId}>;
    <urn:unrelated> "keep".`);
  const operation = await collectionOperation(server, store).open();
  assert.equal(operation.pending.collection, collectionUrl);
  assert.equal(operation.pending.entry, memberId);
  const steps = [];
  await operation.finish({
    openCollection: async (url) => {
      assert.equal(url, collectionUrl);
      return {
        removeReference: async (id) => {
          assert.equal(id, memberId);
          steps.push('membership');
        },
        sync: async () => steps.push('sync')
      };
    },
    applyLocal: async (completed) => {
      assert.equal(completed.source, source);
      steps.push('local');
    }
  });
  assert.deepEqual(steps, ['membership', 'sync', 'local']);
  assert.equal(await store.load(), '');
  assert.equal(server.requests.length, 0);
});

for (const failure of ['open', 'membership', 'sync', 'local', 'acknowledge']) {
  test(
    'completion remains recoverable across ' + failure + ' failure and reload',
    async () => {
      const server = fixture();
      const memory = local.memory('finish-' + failure);
      let failing = true;
      const store = {
        load: () => memory.load(),
        save: async (value) => {
          if (failing && failure === 'acknowledge' && !value) {
            throw new Error('fixture: acknowledge failed');
          }
          await memory.save(value);
        }
      };
      let operation = await collectionOperation(server, store).open();
      await operation.begin({
        kind: 'delete',
        source,
        confirmed: true,
        collection: collectionUrl,
        entry: memberId
      });
      const steps = [];
      const step = async (name) => {
        steps.push(name);
        if (failing && name === failure) {
          throw new Error('fixture: ' + name + ' failed');
        }
      };
      const collection = {
        url: collectionUrl,
        removeReference: async (id) => {
          assert.equal(id, memberId);
          await step('membership');
        },
        sync: () => step('sync')
      };
      const complete = () =>
        operation.finish({
          openCollection: async () => {
            await step('open');
            return collection;
          },
          applyLocal: () => step('local')
        });
      await assert.rejects(complete(), new RegExp(failure + ' failed'));
      assert.equal(operation.pending.stage, 'complete');
      assert((await memory.load()).includes(memberId));
      if (['open', 'membership', 'sync'].includes(failure)) {
        assert(!steps.includes('local'));
      }
      failing = false;
      operation = await collectionOperation(server, store).open();
      const requests = server.requests.length;
      await operation.retry();
      await complete();
      assert.equal(operation.pending, null);
      assert.equal(await memory.load(), '');
      assert.equal(
        server.requests.length,
        requests,
        'Complete retries never repeat destructive HTTP'
      );
      assert.equal(
        server.requests.filter((request) => request.method === 'DELETE').length,
        1
      );
    }
  );
}

test('associated operation stays journaled across offline metadata, authentication failure and reconnection', async () => {
  const server = fixture();
  const store = local.memory('reconnect-operation');
  let operation = await collectionOperation(server, store).open();
  server.fail(origin + '/storage/.meta');
  await assert.rejects(
    operation.begin({
      kind: 'delete',
      source,
      confirmed: true,
      collection: collectionUrl,
      entry: memberId
    }),
    /confirm|offline/
  );
  assert.equal(operation.pending.stage, 'removed');
  const get = server.session.client.get;
  server.session.client.get = async () => new Response(null, { status: 401 });
  operation = await collectionOperation(server, store).open();
  await assert.rejects(operation.retry(), /401/);
  assert.equal(operation.pending.collection, collectionUrl);
  server.session.client.get = get;
  server.fail('');
  await operation.retry();
  await operation.finish({
    collection: {
      url: collectionUrl,
      removeReference: async () => {},
      sync: async () => {}
    },
    applyLocal: async () => {}
  });
  assert.equal(operation.pending, null);
  assert.equal(
    server.requests.filter((request) => request.method === 'DELETE').length,
    1
  );
});

test('completion refuses another account and incomplete collection associations without clearing intent', async () => {
  const server = fixture();
  const store = local.memory('owned-operation');
  const operation = await collectionOperation(server, store).open();
  await operation.begin({ kind: 'delete', source, confirmed: true });
  const other = await new CollectionFileOperation({
    owner: 'https://other.example/#me',
    session: server.session,
    store
  }).open();
  let applied = false;
  await assert.rejects(
    other.finish({
      applyLocal: async () => {
        applied = true;
      }
    }),
    /account/
  );
  assert.equal(applied, false);
  assert.equal(other.pending.stage, 'complete');
  const before = await store.load();
  const graph = new StateGraph(before);
  graph.set(
    operationRoot,
    operationNamespace + 'collection',
    named(collectionUrl)
  );
  await store.save(graph.write());
  const broken = await collectionOperation(server, store).open();
  await assert.rejects(broken.retry(), /Incomplete collection association/);
  assert((await store.load()).includes(collectionUrl));
});

for (const app of ['notebook', 'presenter']) {
  for (const kind of ['move', 'delete']) {
    test(
      'shared completion keeps ' +
        app +
        ' ' +
        kind +
        ' recovery policy with real native stores and collection sync',
      async () => {
        const server = fixture();
        server.files.delete(source);
        const store = memoryStores();
        let documents;
        let decks;
        let options;
        if (app === 'notebook') {
          documents = await new NotebookDocuments({ owner, store }).open();
          documents.changeTitle('Retained notebook');
          documents.edit(documents.blocks()[0].id, {
            text: 'Preserve this local text',
            annotations: []
          });
          await documents.save(server.session, source);
          await documents.persist();
        }
        else {
          options = {
            owner,
            store,
            baselineFor: (address) => store('baseline:' + address)
          };
          decks = await new PresenterDecks(options).open();
          decks.current.change(
            decks.current.root.id,
            'title',
            'Delete this deck'
          );
          decks.current.addSlide();
          await decks.current.save(server.session, source);
          await decks.current.persist();
        }
        const removedId = decks?.activeId;
        const collection = await new DocumentCollection({
          owner,
          url: collectionUrl,
          session: server.session,
          store: store('collection')
        }).open({
          create: { title: 'Documents', destination: origin + '/storage/' }
        });
        const entry = await collection.addDocument({
          document: source,
          title: app,
          kind: app,
          managed: true
        });
        await collection.sync();
        const operation = await collectionOperation(
          server,
          store('operation')
        ).open();
        await operation.begin({
          kind,
          target: kind === 'move' ? target : '',
          source,
          confirmed: true,
          collection: collectionUrl,
          entry
        });
        await operation.finish({
          collection,
          applyLocal: (completed) =>
            app === 'notebook'
              ? documents.applyFileOperation(completed, server.session)
              : kind === 'move'
                ? decks.applyFileOperation(completed, server.session)
                : decks.discard(completed.source)
        });
        assert.equal(operation.pending, null);
        assert(!server.files.has(source));
        const membership = collection
          .state()
          .entries.find((value) => value.id === entry);
        if (kind === 'move') {
          assert.equal(membership.document, target);
          assert.equal(membership.deleted, false);
        }
        else {
          assert(membership.deleted);
        }
        if (app === 'notebook') {
          const reopened = await new NotebookDocuments({ owner, store }).open();
          assert.equal(reopened.url, kind === 'move' ? target : '');
          assert.equal(
            reopened.blocks()[0].fragment.text,
            'Preserve this local text'
          );
          assert.equal(reopened.dirty, kind === 'delete');
        }
        else {
          const reopened = await new PresenterDecks(options).open();
          if (kind === 'move') {
            assert.equal(reopened.current.url, target);
            assert.equal(reopened.find(target).id, removedId);
            assert.equal(reopened.current.title, 'Delete this deck');
            assert.equal(reopened.current.dirty, false);
          }
          else {
            assert.equal(await store(removedId).load(), '');
            assert.equal(reopened.find(source), undefined);
            assert.equal(reopened.entries().length, 0);
          }
        }
      }
    );
  }
}

test('cancelling a pending copy retains the source and clears native context before reuse', async () => {
  const server = fixture();
  const store = local.memory('cancel-context');
  const operation = await server.operation(store).open();
  const context = new StateGraph(
    '<urn:caller> <urn:job> "do not carry forward".'
  );
  server.fail(target);
  await assert.rejects(
    operation.begin({ kind: 'move', source, target, confirmed: true, context }),
    /offline/
  );
  assert.equal(operation.pending.stage, 'copying');
  await operation.cancel();
  assert(server.files.has(source));
  assert.equal(await store.load(), '');
  server.fail('');
  await operation.begin({ kind: 'delete', source, confirmed: true });
  assert.equal(
    operation.graph.values(named('urn:caller'), 'urn:job').length,
    0
  );
});

test('unfinished physical work cannot trigger local completion or journal acknowledgement', async () => {
  const server = fixture();
  const store = local.memory('not-yet-complete');
  const operation = await collectionOperation(server, store).open();
  server.fail(target);
  await assert.rejects(
    operation.begin({
      kind: 'move',
      source,
      target,
      confirmed: true,
      collection: collectionUrl,
      entry: memberId
    }),
    /offline/
  );
  const before = await store.load();
  let applied = false;
  const result = await operation.finish({
    applyLocal: async () => {
      applied = true;
    }
  });
  assert.equal(result, null);
  assert.equal(applied, false);
  assert.equal(await store.load(), before);
  assert(server.files.has(source));
});
