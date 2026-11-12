import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { DeckDocument, presenter } from '../apps/presenter/src/deck-data.mjs';
import {
  named,
  literal,
  sameGraph
} from '../packages/solid-app-data/src/state-rdf.mjs';

const owner = 'https://pod.example/profile#me';
const url = 'https://pod.example/deck.ttl';
function session(client) {
  return { webId: owner, client, perform: (work) => work() };
}

test('deck keeps native identities, unknown RDF and detached content through reload', async () => {
  const source = local.memory('deck');
  const deck = await new DeckDocument({ source, owner }).open();
  const first = deck.addSlide('text');
  const second = deck.addSlide('image');
  const text = deck.regions(first)[0];
  deck.change(text.id, 'text', 'A <script> is text, not markup.');
  deck.graph.add(named(text.id), 'urn:unknown', literal('retain'));
  deck.moveSlide(second, -1);
  deck.removeSlide(first);
  await deck.persist();
  const reopened = await new DeckDocument({ source, owner }).open();
  assert.equal(reopened.slides()[0].id, second);
  assert.equal(
    reopened.value(text.id, 'text'),
    'A <script> is text, not markup.'
  );
  assert.equal(
    reopened.graph.one(named(text.id), 'urn:unknown', 'string').value,
    'retain'
  );
  assert(sameGraph(deck.content().write(), reopened.content().write()));
  assert(!reopened.content().write().includes('local-dirty'));
});

test('deck refuses interpreted multiple values while preserving unknown data', async () => {
  const deck = await new DeckDocument({ source: local.memory('bad') }).open();
  deck.graph.add(deck.root, presenter + 'title', literal('another'));
  const before = deck.graph.write();
  assert.throws(
    () => deck.change(deck.root.id, 'title', 'replacement'),
    /Expected one/
  );
  assert.equal(deck.graph.write(), before);
});

test('Pod creation is conditional and concurrent local edits remain dirty', async () => {
  const source = local.memory('save');
  const deck = await new DeckDocument({ source, owner }).open();
  deck.addSlide();
  let sent;
  await deck.save(
    session({
      get: async () => new Response('', { status: 404 }),
      put: async (_url, options) => {
        sent = options;
        deck.change(deck.root.id, 'title', 'Changed during save');
        return new Response('', { status: 201, headers: { ETag: '"1"' } });
      }
    }),
    url
  );
  assert.equal(sent.headers['If-None-Match'], '*');
  assert(!sent.body.includes('local-dirty'));
  assert.equal(deck.dirty, true);
  assert.equal(
    (await new DeckDocument({ source, owner }).open()).title,
    'Changed during save'
  );
});

test('conflict and account mismatch preserve deck, bindings and local dirty state', async () => {
  const source = local.memory('conflict');
  const deck = await new DeckDocument({ source, owner }).open();
  deck.addSlide();
  deck.url = url;
  deck.etag = '"old"';
  let writes = 0;
  await assert.rejects(
    deck.save(
      session({
        put: async (_url, options) => {
          writes += 1;
          assert.equal(options.headers['If-Match'], '"old"');
          return new Response('', { status: 412 });
        }
      }),
      url
    ),
    /changed elsewhere/
  );
  assert.equal(writes, 1);
  assert.equal(deck.dirty, true);
  const restored = await new DeckDocument({ source, owner }).open();
  assert.equal(restored.slides().length, 1);
  assert.equal(restored.etag, '"old"');
  await assert.rejects(
    deck.save({ webId: 'https://other.example/me' }, url),
    /account/
  );
});

test('opening cannot discard local edits or overwrite an existing unrelated document', async () => {
  const deck = await new DeckDocument({
    source: local.memory('keep'),
    owner
  }).open();
  deck.addSlide();
  let reads = 0;
  const connection = session({
    get: async () => {
      reads += 1;
      return new Response('<urn:unrelated> <urn:value> "keep".', {
        headers: { 'Content-Type': 'text/turtle', ETag: '"1"' }
      });
    }
  });
  await assert.rejects(deck.load(connection, url), /local deck/);
  assert.equal(reads, 0);
  await assert.rejects(deck.save(connection, url), /already exists/);
  assert.equal(deck.slides().length, 1);
});

test('layout region order survives RDF serialization and missing order is refused', async () => {
  const source = local.memory('region-order');
  const deck = await new DeckDocument({ source }).open();
  const slide = deck.addSlide('image');
  await deck.persist();
  const reopened = await new DeckDocument({ source }).open();
  assert.deepEqual(
    reopened.regions(slide).map((region) => region.name),
    ['title', 'body']
  );
  reopened.graph.set(named(slide), presenter + 'position');
  assert.throws(() => reopened.validate(), /Expected one integer/);
});

test('opening cannot replace edits made during the read or cross accounts', async () => {
  const deck = await new DeckDocument({
    source: local.memory('opening'),
    owner
  }).open();
  const original = deck.content().write();
  const connection = session({
    get: async () => {
      deck.change(deck.root.id, 'title', 'Retain my concurrent edit');
      return new Response(original, {
        headers: { 'Content-Type': 'text/turtle' }
      });
    }
  });
  await assert.rejects(deck.load(connection, url), /changed while opening/);
  assert.equal(deck.title, 'Retain my concurrent edit');
  deck.dirty = false;
  await assert.rejects(deck.load({ webId: 'other' }, url), /account/);
});

test('new deck refuses dirty content and failed local replacement preserves current graph', async () => {
  const source = { ...local.memory('new') };
  const deck = await new DeckDocument({ source, owner }).open();
  const id = deck.addSlide();
  await assert.rejects(deck.create(), /Save this deck/);
  deck.dirty = false;
  const save = source.save;
  source.save = async () => {
    throw new Error('storage unavailable');
  };
  await assert.rejects(deck.create(), /storage unavailable/);
  assert.equal(deck.slides()[0].id, id);
  source.save = save;
  await deck.create();
  assert.equal(deck.slides().length, 0);
});

test('Pod-relative deck and unknown terms retain their resolved identity locally', async () => {
  const source = local.memory('relative');
  const deck = await new DeckDocument({ source, owner }).open();
  const body = `@prefix p: <${presenter}> .
    <#deck> a p:Deck; p:title "Relative deck"; <#unknown> <other> .`;
  await deck.load(
    session({
      get: async () =>
        new Response(body, {
          headers: { 'Content-Type': 'text/turtle', ETag: '"relative"' }
        })
    }),
    url
  );
  assert.equal(deck.root.id, url + '#deck');
  const reopened = await new DeckDocument({ source, owner }).open();
  assert.equal(
    reopened.graph.one(reopened.root, url + '#unknown', 'iri').id,
    'https://pod.example/other'
  );
});

test('205 without ETag retains a native baseline and safely refreshes the validator after reload', async () => {
  const source = local.memory('no-etag');
  const baseline = local.memory('baseline');
  const options = { source, owner, baselineFor: () => baseline };
  const deck = await new DeckDocument(options).open();
  deck.addSlide();
  let remote = '';
  const connection = session({
    get: async () =>
      remote
        ? new Response(remote, {
            headers: { 'Content-Type': 'text/turtle', ETag: '"next"' }
          })
        : new Response('', { status: 404 }),
    put: async (_url, options) => {
      assert.equal(
        options.headers[remote ? 'If-Match' : 'If-None-Match'],
        remote ? '"next"' : '*'
      );
      remote = options.body;
      return new Response(null, { status: 205 });
    }
  });
  await deck.save(connection, url);
  const reopened = await new DeckDocument(options).open();
  reopened.change(reopened.root.id, 'title', 'Second save');
  await reopened.save(connection, url);
  assert.equal(reopened.dirty, false);
  assert.match(remote, /Second save/);
  remote += '<urn:someone-else> <urn:note> "retain" .';
  reopened.change(reopened.root.id, 'title', 'Third save');
  await assert.rejects(reopened.save(connection, url), /changed elsewhere/);
  assert.equal(reopened.dirty, true);
});

test('formatted slide text survives native reload without replacing unrelated RDF', async () => {
  const source = local.memory('formatted-slide');
  const deck = await new DeckDocument({ source, owner }).open();
  const slide = deck.addSlide('image');
  const region = deck.regions(slide)[0];
  deck.graph.add(named(region.id), 'urn:unknown', literal('keep'));
  const fragment = {
    text: 'Hello slide',
    annotations: [
      { range: [0, 5], tag: '<strong>', order: 0 },
      { range: [6, 11], tag: '<a href="https://example.test/">', order: 1 }
    ]
  };
  deck.editText(region.id, fragment);
  await deck.persist();
  const reopened = await new DeckDocument({ source, owner }).open();
  assert.deepEqual(reopened.regions(slide)[0].fragment, fragment);
  assert.equal(
    reopened.graph.one(named(region.id), 'urn:unknown', 'string').value,
    'keep'
  );
  const before = reopened.graph.write();
  assert.throws(
    () =>
      reopened.editText(region.id, {
        text: '',
        annotations: fragment.annotations
      }),
    /range/
  );
  assert.equal(reopened.graph.write(), before);
});
