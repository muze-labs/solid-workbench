import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { DeckDocument } from '../apps/presenter/src/deck-data.mjs';
import {
  sameGraph,
  literal
} from '../packages/solid-app-data/src/state-rdf.mjs';
import { muzeSolidCollectionBrowser } from '../packages/solid-app-ui/src/components/collection-browser.mjs';
import { model } from '@muze-labs/simplyflow/model';
import { effect } from '@muze-labs/simplyflow/state';
const owner = 'https://pod.example/me#id';
const url = 'https://pod.example/deck.ttl';

test('managed deck target survives reload, stays local and clears only after save', async () => {
  const source = local.memory('reserved');
  const deck = await new DeckDocument({ owner, source }).open();
  deck.target = url;
  deck.changed();
  deck.graph.add(deck.root, 'urn:unknown', literal('retain'));
  await deck.persist();
  const reopened = await new DeckDocument({ owner, source }).open();
  assert.equal(reopened.target, url);
  assert.equal(reopened.dirty, true);
  assert(!reopened.content().write().includes('local-target'));
  const before = reopened.content().write();
  let written;
  await assert.rejects(reopened.save({ webId: 'other' }, url), /account/);
  assert.equal(reopened.target, url);
  await reopened.save(
    {
      webId: owner,
      perform: (work) => work(),
      client: {
        get: async () => new Response(null, { status: 404 }),
        put: async (_url, options) => {
          assert.equal(options.headers['If-None-Match'], '*');
          written = options.body;
          return new Response(null, {
            status: 201,
            headers: { ETag: '"one"' }
          });
        }
      }
    },
    url
  );
  assert(sameGraph(written, before, url));
  assert.equal(reopened.target, '');
  assert.equal(reopened.url, url);
  assert.equal(reopened.dirty, false);
});

test('deleted deck keeps native content and detaches its old remote binding', async () => {
  const source = local.memory('deleted');
  const deck = await new DeckDocument({ owner, source }).open();
  deck.url = url;
  deck.etag = '"one"';
  const slide = deck.addSlide();
  deck.graph.add(deck.root, 'urn:foreign', literal('keep'));
  const before = deck.content().write();
  await assert.rejects(
    deck.applyFileOperation(
      { kind: 'delete', source: url },
      { webId: 'other' }
    ),
    /account/
  );
  assert.equal(deck.url, url);
  await deck.applyFileOperation(
    { kind: 'delete', source: url },
    { webId: owner }
  );
  const restored = await new DeckDocument({ owner, source }).open();
  assert(sameGraph(restored.content().write(), before));
  assert.equal(restored.slides()[0].id, slide);
  assert.equal(restored.url, '');
  assert.equal(restored.target, '');
  assert.equal(restored.dirty, true);
});

test('moving a newer deck cannot grant an older cached graph its target validator', async () => {
  const source = local.memory('moved');
  const baseline = local.memory('baseline');
  const deck = await new DeckDocument({
    owner,
    source,
    baselineFor: () => baseline
  }).open();
  deck.url = url;
  deck.etag = '"old"';
  const original = deck.content().write();
  const target = 'https://pod.example/moved.ttl';
  const connection = {
    webId: owner,
    perform: (work) => work(),
    client: {
      get: async () =>
        new Response(original + '<urn:other> <urn:value> "new".', {
          headers: { ETag: '"target"' }
        })
    }
  };
  await deck.applyFileOperation(
    { kind: 'move', source: url, target, etag: '"newer"' },
    connection
  );
  assert.equal(deck.url, target);
  assert.equal(deck.etag, null);
  assert.equal(deck.dirty, true);
  assert(sameGraph(deck.content().write(), original));
  await assert.rejects(
    deck.save(connection, target),
    /version information|ETag/
  );
});

test('shared browser models preserve source identity and react to categories and replacement', () => {
  for (const labels of [
    ['All notebooks', 'New notebook'],
    ['All decks', 'New deck']
  ]) {
    const host = {
      runtime: {},
      data: {},
      actions: {
        link: (uri, create, group) =>
          'https://app.example/#' +
          new URLSearchParams({ uri, create: String(create), group })
      },
      api: {
        model,
        effect,
        muzeSolidCollectionBrowser: {
          allLabel: labels[0],
          newLabel: labels[1],
          cards: labels[1] === 'New deck',
          link: 'link'
        }
      }
    };
    const browser =
      muzeSolidCollectionBrowser.actions.muzeSolidCollectionInitialize.call(
        host
      );
    const rows = [
      { id: 'b', document: url + '#b', title: 'Beta', groups: ['work'] },
      { id: 'a', document: url + '#a', title: 'Alpha', groups: [] },
      {
        id: 'gone',
        document: url + '#gone',
        title: 'Gone',
        groups: [],
        deleted: true
      }
    ];
    browser.entries.state.data = rows;
    assert.deepEqual(
      browser.entries.view.current.map((row) => row.id),
      ['a', 'b']
    );
    assert.equal(
      browser.entries.view.current[0],
      browser.entries.state.data[1]
    );
    assert.deepEqual(
      host.data.muzeSolidCollectionEntries.map((row) => row.id),
      labels[1] === 'New deck' ? ['new', 'a', 'b'] : ['a', 'b', 'new'],
      'Cards keep creation first; document lists retain their ordering'
    );
    const category = host.data.muzeSolidCollectionCategories[0];
    const creation = host.data.muzeSolidCollectionEntries.find(
      (row) => row.id === 'new'
    );
    browser.entries.state.options.group = 'work';
    assert.equal(
      host.data.muzeSolidCollectionCategories[0],
      category,
      'Selection retains category row identity for native focus'
    );
    assert.deepEqual(
      browser.entries.view.current.map((row) => row.id),
      ['b']
    );
    assert.equal(
      host.data.muzeSolidCollectionEntries.find((row) => row.id === 'new'),
      creation,
      'Filtering retains the creation link for native keyboard focus'
    );
    browser.entries.state.options.search = 'missing';
    assert.equal(browser.entries.view.current.length, 0);
    browser.entries.state.options.search = '';
    browser.entries.state.options.group = '';
    browser.entries.state.data = [rows[0]];
    assert.deepEqual(
      browser.entries.view.current.map((row) => row.id),
      ['b']
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ['b', 'a', 'gone']
    );
  }
});

test('deck preview selects the first slide and reads no later-slide regions', async () => {
  const { firstSlidePreview } = await import(
    '../apps/presenter/src/previews.mjs'
  );
  const inspected = [];
  const deck = {
    slides: () => [
      { id: 'later', position: 2 },
      { id: 'first', position: 0 }
    ],
    regions: (id) => {
      inspected.push(id);
      return [
        { name: 'title', kind: 'text', fragment: { text: 'First title' } },
        {
          name: 'body',
          kind: 'image',
          resource: 'https://pod.example/first.png'
        }
      ];
    }
  };
  assert.deepEqual(firstSlidePreview(deck), {
    title: 'First title',
    body: '',
    image: 'https://pod.example/first.png'
  });
  assert.deepEqual(inspected, ['first']);
  assert.equal(firstSlidePreview({ slides: () => [] }).title, 'No slides yet');
});

test('native cached previews survive access failure without replacing the current deck', async () => {
  const { muzeSolidPresenterPreviews } = await import(
    '../apps/presenter/src/previews.mjs'
  );
  const preview = await new DeckDocument({
    owner,
    source: local.memory('preview')
  }).open();
  const slide = preview.addSlide();
  preview.change(
    preview.regions(slide).find((region) => region.name === 'title').id,
    'text',
    'Cached first slide'
  );
  const cached = local.memory('cached-preview', {
    turtle: preview.content().write()
  });
  const current = await new DeckDocument({
    owner,
    source: local.memory('current')
  }).open();
  current.addSlide();
  const before = current.content().write();
  const host = {
    runtime: {
      deck: current,
      host: {
        session: {
          webId: owner,
          perform: async () => {
            throw Error('offline');
          }
        }
      }
    },
    api: { local: { ...local, indexedDB: () => cached }, DeckDocument },
    actions: {}
  };
  for (const [name, action] of Object.entries(
    muzeSolidPresenterPreviews.actions
  )) {
    host.actions[name] = action.bind(host);
  }
  host.actions.muzeSolidPresenterProjectCollection = () => {};
  await host.actions.muzeSolidPresenterLoadPreview(owner, url);
  assert.equal(
    host.actions.muzeSolidPresenterPreviewFields(url).previewTitle,
    'Cached first slide'
  );
  assert.equal(host.runtime.deck, current);
  assert.equal(current.content().write(), before);
});

test('late preview responses cannot populate another account or overwrite its cache', async () => {
  const { muzeSolidPresenterPreviews } = await import(
    '../apps/presenter/src/previews.mjs'
  );
  const current = await new DeckDocument({
    owner,
    source: local.memory('late-current')
  }).open();
  const cached = local.memory('late-cache');
  let release;
  const response = new Promise((resolve) => {
    release = resolve;
  });
  const session = { webId: owner, perform: (work) => work(), client: {} };
  const host = {
    runtime: { deck: current, host: { session } },
    api: {
      local: { ...local, indexedDB: () => cached },
      DeckDocument,
      loadDocument: () => response
    },
    actions: {}
  };
  for (const [name, action] of Object.entries(
    muzeSolidPresenterPreviews.actions
  )) {
    host.actions[name] = action.bind(host);
  }
  host.actions.muzeSolidPresenterProjectCollection = () => {};
  const loading = host.actions.muzeSolidPresenterLoadPreview(owner, url);
  await new Promise((resolve) => setImmediate(resolve));
  host.runtime.host.session = { webId: 'https://other.example/me' };
  release({ source: current.content().write() });
  await loading;
  assert.equal(host.runtime.deckPreviews.records.size, 0);
  assert.equal(await cached.load(), '');
});

test('a late preview response cannot restore a deleted deck cache', async () => {
  const { muzeSolidPresenterPreviews } = await import(
    '../apps/presenter/src/previews.mjs'
  );
  const current = await new DeckDocument({
    owner,
    source: local.memory('delete-preview-current')
  }).open();
  const cached = local.memory('delete-preview-cache');
  let release;
  const response = new Promise((resolve) => {
    release = resolve;
  });
  const session = { webId: owner, perform: (work) => work(), client: {} };
  const host = {
    runtime: { deck: current, host: { session } },
    api: {
      local: { ...local, indexedDB: () => cached },
      DeckDocument,
      loadDocument: () => response
    },
    actions: {}
  };
  for (const [name, action] of Object.entries(
    muzeSolidPresenterPreviews.actions
  )) {
    host.actions[name] = action.bind(host);
  }
  const loading = host.actions.muzeSolidPresenterLoadPreview(owner, url);
  await new Promise((resolve) => setImmediate(resolve));
  await host.actions.muzeSolidPresenterPurgePreviews([url]);
  release({ source: current.content().write() });
  await loading;
  assert.equal(host.runtime.deckPreviews.records.size, 0);
  assert.equal(await cached.load(), '');
});

test('a native preview write already in flight is cleared after deletion', async () => {
  const { muzeSolidPresenterPreviews } = await import(
    '../apps/presenter/src/previews.mjs'
  );
  const current = await new DeckDocument({
    owner,
    source: local.memory('queued-preview-current')
  }).open();
  current.url = url;
  const cached = local.memory('queued-preview-cache');
  let release;
  const writing = new Promise((resolve) => {
    release = resolve;
  });
  let started = false;
  const source = {
    load: () => cached.load(),
    save: async (text) => {
      if (text) {
        started = true;
        await writing;
      }
      return cached.save(text);
    }
  };
  const host = {
    runtime: { deck: current, host: { session: null } },
    api: {
      local: { ...local, indexedDB: () => source },
      DeckDocument
    },
    actions: {}
  };
  for (const [name, action] of Object.entries(
    muzeSolidPresenterPreviews.actions
  )) {
    host.actions[name] = action.bind(host);
  }
  const loading = host.actions.muzeSolidPresenterLoadPreview(owner, url);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, true);
  let finished = false;
  const purging = host.actions
    .muzeSolidPresenterPurgePreviews([url])
    .then(() => {
      finished = true;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    finished,
    false,
    'Deletion waits for already-started local writes'
  );
  release();
  await Promise.all([loading, purging]);
  assert.equal(await cached.load(), '');
  assert.equal(host.runtime.deckPreviews.records.size, 0);
});
