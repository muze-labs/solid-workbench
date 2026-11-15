import test from 'node:test';
import assert from 'node:assert/strict';
import {
  documentCollections as ns,
  createDocumentCollection,
  readDocumentCollection,
  collectionEntryId,
  projectDocumentCollection,
  applyDocumentCollectionFields,
  collectionTitle
} from '../packages/solid-app-data/src/document-collection-rdf.mjs';
import {
  StateGraph,
  named,
  literal,
  rdf,
  xsd,
  sameGraph
} from '../packages/solid-app-data/src/state-rdf.mjs';
const file = 'https://pod.example/collections/notes.ttl';
const document = 'https://pod.example/notes/one.ttl#notebook';

test('portable collection has independent documents, stable membership and typed lifecycle ownership', async () => {
  const graph = createDocumentCollection(
    file,
    'Notes',
    'https://pod.example/notes/'
  );
  const root = named(readDocumentCollection(graph).id);
  const id = await collectionEntryId(file, root.id, document);
  assert.equal(await collectionEntryId(file, root.id, document), id);
  assert.notEqual(
    await collectionEntryId(file, root.id, document + '-other'),
    id
  );
  const entry = named(id);
  graph.add(entry, rdf + 'type', named(ns + 'Entry'));
  graph.set(entry, ns + 'collection', root);
  graph.set(entry, ns + 'document', named(document));
  graph.set(entry, collectionTitle, literal('One'));
  graph.set(entry, ns + 'managed', literal(false, xsd + 'boolean'));
  graph.set(entry, ns + 'kind', literal('cobalt.notebook'));
  const reopened = readDocumentCollection(new StateGraph(graph.write(), file));
  assert.equal(reopened.entries[0].document, document);
  assert.equal(reopened.entries[0].managed, false);
  assert.equal(reopened.title, 'Notes');
  assert.equal(reopened.destination, 'https://pod.example/notes/');
  assert(!graph.write().includes('rdf:JSON'));
});
test('editable projection preserves unrelated cyclic RDF, unknown types and multiple values on write', () => {
  const graph = createDocumentCollection(
    file,
    'Notes',
    'https://pod.example/notes/'
  );
  const root = named(readDocumentCollection(graph).id);
  const foreign = new StateGraph(
    `<${root.id}> <urn:foreign> _:cycle; a <urn:Other>; <urn:values> "a","b". _:cycle <urn:loop> _:cycle.`,
    file
  );
  graph.quads.push(...foreign.quads);
  const projection = projectDocumentCollection(graph);
  assert(!projection.write().includes('urn:loop'));
  projection.set(root, collectionTitle, literal('Renamed'));
  const updated = applyDocumentCollectionFields(graph, projection);
  const expected = graph.clone();
  expected.set(root, collectionTitle, literal('Renamed'));
  assert(sameGraph(updated.write(), expected.write(), file));
  assert.equal(readDocumentCollection(updated).title, 'Renamed');
  assert.equal(readDocumentCollection(graph).title, 'Notes');
});
test('unsupported collection versions, blank identities and ambiguous ownership are retained without flattening', () => {
  const graph = createDocumentCollection(
    file,
    'Notes',
    'https://pod.example/notes/'
  );
  const root = named(readDocumentCollection(graph).id);
  graph.set(root, ns + 'version', literal(2, xsd + 'integer'));
  assert.throws(() => readDocumentCollection(graph), /version is unsupported/);
  assert.equal(graph.one(root, ns + 'version', 'integer').value, '2');
  assert.throws(
    () =>
      readDocumentCollection(
        new StateGraph(`_:root a <${ns}Collection>.`, file)
      ),
    /stable named identities/
  );
  graph.set(root, ns + 'version', literal(1, xsd + 'integer'));
  const entry = named(file + '#entry');
  graph.add(entry, rdf + 'type', named(ns + 'Entry'));
  graph.add(entry, ns + 'collection', root);
  graph.add(entry, ns + 'collection', named(file + '#other'));
  graph.set(entry, ns + 'document', named(document));
  const original = graph.write();
  assert.throws(() => readDocumentCollection(graph), /Expected one iri/);
  assert.equal(graph.write(), original);
});

import { DocumentCollection } from '../packages/solid-app-data/src/document-collection.mjs';
import { local } from '@muze-labs/solid-workspace';
function fixture(source = '') {
  let body = source;
  let version = 1;
  const requests = [];
  const response = (status, text = '') =>
    new Response(text, {
      status,
      headers: { ETag: '"' + version + '"' }
    });
  const session = {
    webId: 'https://pod.example/me#id',
    perform: (work) => work(),
    client: {
      async get(url, options) {
        requests.push({ method: 'GET', ...options });
        return response(body ? 200 : 404, body);
      },
      async put(url, options) {
        requests.push({ method: 'PUT', ...options });
        if (
          options.headers['If-None-Match'] === '*'
            ? body
            : options.headers['If-Match'] !== '"' + version + '"'
        ) {
          return response(412);
        }
        body = options.body;
        version++;
        return response(200);
      }
    }
  };
  return {
    session,
    requests,
    source: () => body,
    replace(value) {
      body = value;
      version++;
    },
    replica(store = local.memory(crypto.randomUUID())) {
      return new DocumentCollection({
        url: file,
        owner: session.webId,
        session,
        store
      });
    }
  };
}
test('collection replica saves separate entries and groups, reloads offline, and preserves foreign RDF', async () => {
  const graph = createDocumentCollection(
    file,
    'Notes',
    'https://pod.example/notes/'
  );
  graph.quads.push(
    ...new StateGraph('_:cycle <urn:loop> _:cycle.', file).quads
  );
  const server = fixture(graph.write());
  const store = local.memory(crypto.randomUUID());
  const replica = await server.replica(store).open();
  const entry = await replica.addDocument({ document, title: 'One' });
  const group = await replica.addGroup('Work');
  await replica.setGroups(entry, [group]);
  assert.equal(replica.state().entries[0].managed, false);
  assert.deepEqual(replica.state().entries[0].groups, [group]);
  assert.equal(replica.dirty, true);
  await replica.sync();
  assert.equal(replica.dirty, false);
  assert(server.source().includes('urn:loop'));
  assert(!server.source().includes('local-dirty'));
  assert(
    server.requests
      .filter((r) => r.method === 'PUT')
      .every((r) => r.redirect === 'error')
  );
  server.session.client.get = async () => {
    throw new Error('offline');
  };
  const reopened = await server.replica(store).open();
  assert.equal(reopened.state().entries[0].title, 'One');
  await reopened.rename('Offline title');
  await assert.rejects(() => reopened.sync(), /offline/);
  const again = await server.replica(store).open();
  assert.equal(again.state().title, 'Offline title');
  assert.equal(again.dirty, true);
});
test('collection retry merges concurrent additions without replacing native unknown data', async () => {
  const graph = createDocumentCollection(
    file,
    'Notes',
    'https://pod.example/notes/'
  );
  graph.quads.push(
    ...new StateGraph('<urn:other> <urn:values> "a","b".', file).quads
  );
  const server = fixture(graph.write());
  const a = await server.replica().open();
  const b = await server.replica().open();
  await a.addDocument({ document, title: 'One', managed: true });
  await b.addDocument({ document: document + '-two', title: 'Two' });
  await a.sync();
  await b.sync();
  const state = readDocumentCollection(new StateGraph(server.source(), file));
  assert.deepEqual(state.entries.map((e) => e.title).sort(), ['One', 'Two']);
  assert.equal(
    new StateGraph(server.source(), file).values(
      named('urn:other'),
      'urn:values'
    ).length,
    2
  );
});
test('unavailable default never creates a replacement; explicit creation refuses an existing unrelated file', async () => {
  const missing = fixture();
  await assert.rejects(
    () => missing.replica().open(),
    (e) => e.status === 404
  );
  assert(!missing.requests.some((r) => r.method === 'PUT'));
  const occupied = fixture(
    createDocumentCollection(
      file,
      'Existing',
      'https://pod.example/notes/'
    ).write()
  );
  const created = await occupied.replica().open({
    create: {
      title: 'New',
      destination: 'https://pod.example/notes/'
    }
  });
  assert.equal(created.error.code, 'collection_exists');
  assert.equal(created.state().title, 'New');
  await assert.rejects(
    () => created.sync(),
    (e) => e.code === 'collection_exists'
  );
  assert(!occupied.requests.some((r) => r.method === 'PUT'));
});

test('membership removal retains the file reference and grouping can be cleared', async () => {
  const server = fixture(
    createDocumentCollection(
      file,
      'Notes',
      'https://pod.example/notes/'
    ).write()
  );
  const replica = await server.replica().open();
  const id = await replica.addDocument({
    document,
    title: 'One',
    managed: true
  });
  const group = await replica.addGroup('Work');
  await replica.setGroups(id, [group]);
  await replica.sync();
  await replica.setGroups(id, []);
  await replica.sync();
  assert.deepEqual(replica.state().entries[0].groups, []);
  await replica.removeReference(id);
  await replica.sync();
  assert(replica.state().entries[0].deleted);
  assert.equal(replica.state().entries[0].document, document);
  assert(
    server.requests.every((request) => ['GET', 'PUT'].includes(request.method))
  );
  await replica.addDocument({ document, title: 'Again' });
  await replica.sync();
  assert.equal(replica.state().entries[0].deleted, false);
});

import { CollectionPreference } from '../packages/solid-app-data/src/collection-preference.mjs';
test('app-owned collection preference preserves unknown RDF and keeps its cached default on authentication failure', async () => {
  const server = fixture(
    '<urn:foreign> <urn:value> "a", "b". _:c <urn:cycle> _:c.'
  );
  server.session.preferencesUrl = file;
  const store = local.memory(crypto.randomUUID());
  const preference = new CollectionPreference({
    owner: server.session.webId,
    app: 'urn:example:unlisted-app',
    session: server.session,
    store
  });
  assert.equal(await preference.load(), '');
  await preference.save('https://pod.example/collections/default.ttl');
  assert(server.source().includes('urn:cycle'));
  assert.equal(
    new StateGraph(server.source(), file).values(
      named('urn:foreign'),
      'urn:value'
    ).length,
    2
  );
  server.session.client.get = async () => new Response(null, { status: 401 });
  const reopened = new CollectionPreference({
    owner: server.session.webId,
    app: 'urn:example:unlisted-app',
    session: server.session,
    store
  });
  assert.equal(
    await reopened.load(),
    'https://pod.example/collections/default.ttl'
  );
  assert.equal(reopened.error.status, 401);
  const writes = server.requests.filter(
    (request) => request.method === 'PUT'
  ).length;
  await assert.rejects(
    () => reopened.save('https://pod.example/other.ttl'),
    (e) => e.status === 401
  );
  assert.equal(
    server.requests.filter((request) => request.method === 'PUT').length,
    writes
  );
});

test('a local edit admitted during remote acknowledgement remains pending and survives reload', async () => {
  const server = fixture(createDocumentCollection(file, 'Notes', 'https://pod.example/notes/').write());
  const store = local.memory(crypto.randomUUID());
  const replica = await server.replica(store).open();
  await replica.addDocument({ document, title: 'One' });
  let release;
  let entered;
  const arrived = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const put = server.session.client.put;
  server.session.client.put = async (...args) => {
    entered();
    await gate;
    return put(...args);
  };
  const syncing = replica.sync();
  await arrived;
  const changing = replica.rename('A newer local title');
  release();
  await Promise.all([syncing, changing]);
  assert.equal(replica.state().title, 'A newer local title');
  assert.equal(replica.dirty, true);
  server.session.client.get = async () => { throw new Error('offline'); };
  const reopened = await server.replica(store).open();
  assert.equal(reopened.state().title, 'A newer local title');
  assert.equal(reopened.dirty, true);
});

test('automatic default creation retains its intent and never replaces a concurrently defined default', async () => {
  const server = fixture('<urn:foreign> <urn:value> "keep".');
  server.session.preferencesUrl = file;
  const store = local.memory(crypto.randomUUID());
  const options = { owner: server.session.webId, app: 'urn:app:test', session: server.session, store };
  const preference = new CollectionPreference(options);
  assert.equal(await preference.load(), '');
  await preference.prepareDefault('https://pod.example/collections/created.ttl');
  const reopened = new CollectionPreference(options);
  assert.equal(await reopened.load(), '');
  assert.equal(reopened.pending, 'https://pod.example/collections/created.ttl');
  server.replace('<urn:app:test> <https://vocab.muze.nl/collections#defaultCollection> <https://pod.example/collections/other-device.ttl>.');
  assert.equal(await reopened.save(reopened.pending, { onlyIfMissing: true }), 'https://pod.example/collections/other-device.ttl');
  assert(!server.requests.some(request => request.method === 'PUT'));
});
