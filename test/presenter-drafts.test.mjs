import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { PresenterDecks } from '../apps/presenter/src/deck-drafts.mjs';
import { DeckDocument } from '../apps/presenter/src/deck-data.mjs';
import {
  StateGraph,
  named,
  literal,
  sameGraph
} from '../packages/solid-app-data/src/state-rdf.mjs';

const owner = 'https://pod.example/profile#me';
const url = 'https://pod.example/deck.ttl';
function cache() {
  const sources = new Map();
  let fails = () => false;
  return {
    fail(work) {
      fails = work;
    },
    store(id) {
      if (!sources.has(id)) {
        sources.set(id, local.memory(id));
      }
      const source = sources.get(id);
      return {
        load: () => source.load(),
        async save(text) {
          if (fails(id, text)) {
            throw new Error('fixture: local write refused');
          }
          return source.save(text);
        }
      };
    }
  };
}
async function setup() {
  const recovery = cache();
  const options = {
    owner,
    store: recovery.store,
    baselineFor: (address) => recovery.store('baseline:' + address)
  };
  const decks = await new PresenterDecks(options).open();
  const old = decks.current;
  old.change(old.root.id, 'title', 'Existing local deck');
  old.addSlide();
  old.graph.add(named('urn:foreign'), 'urn:retained', literal('unknown'));
  await old.persist();
  return { recovery, old, options, decks };
}

test('existing local deck remains visible and separate dirty drafts survive reload', async () => {
  const { decks, options, recovery, old } = await setup();
  const first = decks.activeId;
  const original = await recovery.store(first).load();
  assert.equal(decks.entries()[0].title, 'Existing local deck');
  const second = await decks.create();
  second.change(second.root.id, 'title', 'Second unsaved deck');
  await second.persist();
  const secondId = decks.activeId;
  await decks.create();
  assert.equal(decks.entries().length, 3);
  const restored = await new PresenterDecks(options).open();
  assert.equal(restored.entries().length, 3);
  await restored.select(first);
  assert.equal(restored.current.dirty, true);
  assert(sameGraph(restored.current.content().write(), old.content().write()));
  await restored.select(secondId);
  assert.equal(restored.current.title, 'Second unsaved deck');
  assert.equal(restored.current.dirty, true);
  assert.equal(
    await recovery.store(first).load(),
    original,
    'The previous recovery copy is retained'
  );
  assert(!restored.current.content().write().includes('selectedDraft'));
});

test('a failed recovery write vetoes New without changing current deck or selection', async () => {
  const { decks, recovery } = await setup();
  const current = decks.current;
  const id = decks.activeId;
  const text = current.graph.write();
  recovery.fail((key) => key === id);
  await assert.rejects(decks.create(), /local write refused/);
  assert.equal(decks.current, current);
  assert.equal(decks.activeId, id);
  assert.equal(current.graph.write(), text);
  recovery.fail(() => false);
  await decks.create();
  await decks.select(id);
  assert.equal(decks.current.title, 'Existing local deck');
});

test('failed selection acknowledgement retains previous current draft across reload', async () => {
  const { decks, recovery, options } = await setup();
  const oldId = decks.activeId;
  const current = decks.current;
  recovery.fail(
    (key, text) =>
      key === 'index' &&
      new StateGraph(text).quads.some(
        (quad) =>
          quad.predicate.id.endsWith('selectedDraft') &&
          quad.object.id !== oldId
      )
  );
  await assert.rejects(decks.create(), /local write refused/);
  assert.equal(decks.current, current);
  assert.equal(decks.activeId, oldId);
  recovery.fail(() => false);
  const restored = await new PresenterDecks(options).open();
  assert.equal(restored.activeId, oldId);
  assert.equal(restored.current.title, 'Existing local deck');
});

test('cached dirty decks reopen locally without a session or network access', async () => {
  const { decks } = await setup();
  decks.current.url = url;
  decks.current.etag = '"one"';
  await decks.current.persist();
  const first = decks.activeId;
  const second = await decks.create({ target: 'https://pod.example/new.ttl' });
  second.change(second.root.id, 'title', 'Other draft');
  await second.persist();
  await decks.openAddress(null, url);
  assert.equal(decks.activeId, first);
  assert.equal(decks.current.title, 'Existing local deck');
  assert.equal(decks.current.dirty, true);
  assert.equal(decks.current.etag, '"one"');
  assert.equal(decks.entries().length, 2);
});

test('conditional conflict after switching preserves the owning copy and other draft', async () => {
  const { decks, options } = await setup();
  const first = decks.activeId;
  decks.current.url = url;
  decks.current.etag = '"original"';
  await decks.current.persist();
  await decks.create();
  const second = decks.activeId;
  await decks.select(first);
  await assert.rejects(
    decks.current.save(
      {
        webId: owner,
        perform: (work) => work(),
        client: {
          put: async (_address, request) => {
            assert.equal(request.headers['If-Match'], '"original"');
            return new Response(null, { status: 412 });
          }
        }
      },
      url
    ),
    /changed elsewhere/
  );
  const restored = await new PresenterDecks(options).open();
  assert.equal(restored.current.title, 'Existing local deck');
  assert.equal(restored.current.dirty, true);
  await restored.select(second);
  assert.equal(restored.current.dirty, true);
});

test('confirmed file deletion repairs a parked draft without changing selection', async () => {
  const { decks } = await setup();
  const first = decks.activeId;
  decks.current.url = url;
  await decks.current.persist();
  const content = decks.current.content().write();
  await decks.create();
  const selected = decks.activeId;
  await assert.rejects(
    decks.applyFileOperation(
      { kind: 'delete', source: url },
      { webId: 'https://other.example/me' }
    ),
    /owning account/
  );
  await decks.applyFileOperation(
    { kind: 'delete', source: url },
    { webId: owner }
  );
  assert.equal(decks.activeId, selected);
  await decks.select(first);
  assert.equal(decks.current.url, '');
  assert.equal(decks.current.dirty, true);
  assert(sameGraph(decks.current.content().write(), content));
});

test('local registries reject missing and foreign references without replacing recovery data', async () => {
  const first = await setup();
  const secondCache = cache();
  const second = await new PresenterDecks({
    owner: 'https://other.example/me',
    store: secondCache.store
  }).open();
  const before = second.current;
  assert.equal(second.find(first.decks.activeId), undefined);
  await assert.rejects(second.select(first.decks.activeId), /not registered/);
  assert.equal(second.current, before);
  const ownId = first.decks.activeId;
  await first.recovery.store(ownId).save('');
  await assert.rejects(first.decks.read(ownId), /unavailable/);
  assert.equal(first.decks.activeId, ownId);
  assert.equal(first.decks.current.title, 'Existing local deck');
});

test('operation retry repairs a registry after native copy storage already succeeded', async () => {
  const { decks, recovery, options } = await setup();
  const parked = decks.activeId;
  decks.current.url = url;
  await decks.current.persist();
  await decks.create();
  const active = decks.activeId;
  let failOnce = true;
  recovery.fail((key) => {
    if (key === 'index' && failOnce) {
      failOnce = false;
      return true;
    }
    return false;
  });
  const operation = { kind: 'delete', source: url };
  await assert.rejects(
    decks.applyFileOperation(operation, { webId: owner }),
    /local write refused/
  );
  assert.equal(
    decks.find(parked).url,
    url,
    'The failed summary still needs repair'
  );
  await decks.applyFileOperation(operation, { webId: owner });
  assert.equal(decks.find(parked).url, '');
  assert.equal(decks.find(parked).dirty, true);
  assert.equal(decks.activeId, active);
  const restored = await new PresenterDecks(options).open();
  await restored.select(parked);
  assert.equal(restored.current.url, '');
  assert.equal(restored.current.title, 'Existing local deck');
});

test('confirmed local discard removes its native copy and blocks late saves after reload', async () => {
  const { decks, recovery, options } = await setup();
  const id = decks.activeId;
  const deleted = decks.current;
  deleted.target = url;
  await deleted.persist();
  await recovery.store('baseline:' + url).save(deleted.content().write());
  const purges = await decks.discard(id);
  assert(purges.includes(id));
  assert(purges.includes(url));
  assert.equal(await recovery.store(id).load(), '');
  assert.equal(await recovery.store('baseline:' + url).load(), '');
  assert.equal(decks.find(id), undefined);
  assert.notEqual(decks.activeId, id);
  await assert.rejects(deleted.persist(), /deleted/);
  await assert.rejects(deleted.create(), /deleted/);
  await assert.rejects(deleted.save({ webId: owner }, url), /deleted/);
  const restored = await new PresenterDecks(options).open();
  assert.equal(restored.find(id), undefined);
  await assert.rejects(restored.read(id), /deleted/);
  assert.equal(await recovery.store(id).load(), '');
  await restored.acknowledgePurges(purges);
  assert.deepEqual(restored.pendingPurges(), []);
});

test('discarding a parked deck preserves unrelated current edits and unknown registry data', async () => {
  const { decks, recovery } = await setup();
  const parked = decks.activeId;
  await decks.create();
  const current = decks.current;
  current.change(current.root.id, 'title', 'Keep my current edits');
  await current.persist();
  const selected = decks.activeId;
  const before = current.content().write();
  await decks.updateIndex((index) =>
    index.add(named('urn:other'), 'urn:unknown', literal('retain'))
  );
  await decks.discard(parked);
  assert.equal(decks.activeId, selected);
  assert.equal(decks.current, current);
  assert.equal(current.content().write(), before);
  assert.equal(
    decks.index.one(named('urn:other'), 'urn:unknown', 'string').value,
    'retain'
  );
  assert.equal(await recovery.store(parked).load(), '');
});

test('failed deletion markers leave the deck intact; failed cleanup resumes without resurrection', async () => {
  const { decks, recovery, options } = await setup();
  const id = decks.activeId;
  const copy = decks.current;
  recovery.fail((key) => key === 'index');
  await assert.rejects(decks.discard(id), /local write refused/);
  assert.equal(decks.find(id).title, 'Existing local deck');
  assert((await recovery.store(id).load()).includes('Existing local deck'));
  recovery.fail((key) => key === id);
  await assert.rejects(decks.discard(id), /local write refused/);
  assert.equal(decks.find(id), undefined);
  await assert.rejects(copy.persist(), /deleted/);
  recovery.fail(() => false);
  const restored = await new PresenterDecks(options).open();
  assert.equal(restored.find(id), undefined);
  assert.equal(await recovery.store(id).load(), '');
  assert(restored.pendingPurges().includes(id));
});
