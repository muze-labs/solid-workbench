import assert from 'node:assert/strict';
import test from 'node:test';
import { ReaderState } from '../apps/documents/src/reader-state.mjs';

function fixture() {
  let text = '<urn:extra> <urn:unknown> "preserved" .';
  let pending = Promise.resolve();
  const store = {
    load: async () => text,
    save: async (value) => {
      text = value;
    }
  };
  const locks = {
    request(_name, action) {
      const operation = pending.then(action);
      pending = operation.catch(() => {});
      return operation;
    }
  };
  return { store, locks, text: () => text };
}

const place = (document, page, readAt = 100) => ({
  document,
  page,
  readAt,
  fraction: 0.375,
  digest: 'revision-a'
});

test('reader merges individual preferences and positions without losing other instances or RDF', async () => {
  const f = fixture();
  const first = new ReaderState(f.store, 'account', f.locks);
  const second = new ReaderState(f.store, 'account', f.locks);
  await Promise.all([
    first.save({
      settings: { zoom: 1.75 },
      position: place('https://example.org/a.pdf', 7)
    }),
    second.save({
      settings: { outlineOpen: true, annotationsOpen: true },
      position: place('https://elsewhere.example/b.pdf', 2)
    })
  ]);
  const restored = await new ReaderState(f.store, 'account', f.locks).read(
    'https://example.org/a.pdf',
    'revision-a'
  );
  assert.equal(restored.zoom, 1.75);
  assert.equal(restored.outlineOpen, true);
  assert.equal(restored.annotationsOpen, true);
  assert.equal(restored.position.page, 7);
  assert.equal(restored.position.fraction, 0.375);
  assert.match(f.text(), /preserved/);
  assert(!f.text().includes('rdf:JSON'));
  assert.equal(
    (await first.read('https://elsewhere.example/b.pdf', 'revision-a')).position
      .page,
    2
  );
});

test('older deferred writes cannot replace newer reading positions; revisions remain distinct', async () => {
  const f = fixture();
  const reader = new ReaderState(f.store, '', f.locks);
  await reader.save({ position: place('urn:document:one', 9, 200) });
  await reader.save({ position: place('urn:document:one', 3, 100) });
  assert.equal(
    (await reader.read('urn:document:one', 'revision-a')).position.page,
    9
  );
  assert.equal(
    (await reader.read('urn:document:one', 'revision-b')).position,
    null
  );
  assert.equal(
    (await reader.read('urn:document:other', 'revision-a')).position,
    null
  );
});

test('invalid reader state is refused atomically and owner stores stay independent', async () => {
  const f = fixture();
  const reader = new ReaderState(f.store, 'first', f.locks);
  const before = f.text();
  await assert.rejects(reader.save({ settings: { zoom: 5 } }), /Invalid zoom/);
  assert.equal(f.text(), before);
  await assert.rejects(
    reader.save({ position: place('urn:one', -1) }),
    /Invalid reading position/
  );
  assert.equal(f.text(), before);
  await reader.save({ settings: { outlineOpen: true } });
  const other = fixture();
  assert.equal(
    (await new ReaderState(other.store, 'second', other.locks).read())
      .outlineOpen,
    false
  );
});

test('deliberate bookmarks merge across readers, survive reload and detach without losing unknown RDF', async () => {
  const f = fixture();
  const first = new ReaderState(f.store, 'owner', f.locks);
  const second = new ReaderState(f.store, 'owner', f.locks);
  const a = {
    ...place('https://example.org/a.pdf', 2),
    id: 'urn:uuid:a',
    label: 'A place'
  };
  const b = {
    ...place('https://example.org/b.pdf', 7),
    id: 'urn:uuid:b',
    label: 'B place'
  };
  await Promise.all([
    first.save({ bookmark: a }),
    second.save({ bookmark: b })
  ]);
  assert.equal(
    (await new ReaderState(f.store, 'owner', f.locks).bookmarks()).length,
    2
  );
  await first.save({ removeBookmark: a.id });
  assert.deepEqual(
    (await second.bookmarks()).map((item) => item.id),
    [b.id]
  );
  assert.match(f.text(), /preserved/);
  const before = f.text();
  await assert.rejects(first.save({ bookmark: { ...a, page: 0 } }));
  assert.equal(f.text(), before);
});

test('unnamed bookmarks retain an empty label without a generated page label', async () => {
  const f = fixture();
  const reader = new ReaderState(f.store, 'owner', f.locks);
  await reader.save({
    bookmark: {
      ...place('https://example.org/a.pdf', 3),
      id: 'urn:uuid:unnamed',
      label: ''
    }
  });
  assert.equal((await reader.bookmarks())[0].label, '');
});
