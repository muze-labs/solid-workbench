import assert from 'node:assert/strict';
import test from 'node:test';
import { PreferenceState } from '../packages/solid-preferences/src/state.mjs';
import {
  StateGraph,
  apps,
  named,
  literal
} from '../packages/solid-app-data/src/state-rdf.mjs';

import { writeProvider } from '../packages/solid-preferences/src/providers.mjs';

const url = 'https://pod.example/preferences.ttl';
const owner = 'https://pod.example/profile#me';
function fixture() {
  let cached = '';
  let remote =
    `<${url}#solid-apps> <${apps}theme> "system" .\n` +
    '<urn:unrelated> <urn:unknown> "preserve" .';
  let version = 1;
  let failure = false;
  let writeFailure = false;
  let lostReply = false;
  let release;
  let delay;
  const writes = [];
  const source = {
    async load() {
      return cached;
    },
    async save(text) {
      if (writeFailure) {
        throw new Error('disk full');
      }
      cached = text;
    }
  };
  const session = {
    webId: owner,
    preferencesUrl: url,
    client: {
      async get() {
        if (failure) {
          throw new Error('offline');
        }
        return new Response(remote, {
          headers: {
            'Content-Type': 'text/turtle',
            ETag: '"' + version + '"'
          }
        });
      },
      async put(_url, request) {
        if (failure) {
          throw new Error('offline');
        }
        if (delay) {
          await delay;
        }
        if (request.headers['If-Match'] !== '"' + version + '"') {
          return new Response(null, { status: 412 });
        }
        remote = request.body;
        version += 1;
        writes.push(request);
        if (lostReply) {
          lostReply = false;
          throw new Error('response lost after commit');
        }
        return new Response(null, { status: 205 });
      }
    }
  };
  return {
    source,
    session,
    writes,
    get cached() {
      return cached;
    },
    get remote() {
      return remote;
    },
    offline(value) {
      failure = value;
    },
    diskFull(value) {
      writeFailure = value;
    },
    loseNextReply() { lostReply = true; },
    remoteProvider(choice) {
      const graph = new StateGraph(remote, url);
      writeProvider(graph, url, choice);
      remote = graph.write();
      version += 1;
    },
    remoteChange(theme) {
      const graph = new StateGraph(remote, url);
      graph.set(named(url + '#solid-apps'), apps + 'theme', literal(theme));
      remote = graph.write();
      version += 1;
    },
    removeTheme() {
      const graph = new StateGraph(remote, url);
      graph.set(named(url + '#solid-apps'), apps + 'theme', undefined);
      remote = graph.write();
      version += 1;
    },
    delayWrite() {
      delay = new Promise((resolve) => {
        release = resolve;
      });
    },
    releaseWrite() {
      release();
    }
  };
}
function state(f) {
  return new PreferenceState({ owner, url, source: f.source });
}

test('immediate choices and incomplete drafts survive reload/offline without JSON snapshots', async () => {
  const f = fixture();
  const editor = state(f);
  await editor.refresh(f.session);
  f.offline(true);
  await editor.draft('language', 'unfinished!');
  await editor.change('theme', 'dark');
  await assert.rejects(editor.synchronize(f.session), /offline/);
  const reopened = state(f);
  await reopened.open();
  assert.equal(reopened.settings().theme, 'dark');
  assert.equal(reopened.drafts().language, 'unfinished!');
  assert(!f.cached.includes('rdf:JSON'));
  f.offline(false);
  await reopened.synchronize(f.session);
  assert.equal(reopened.pending().length, 0);
  assert(f.remote.includes('preserve'));
});
test('remote conflicts preserve both choices until explicit resolution', async () => {
  const f = fixture();
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.change('theme', 'light');
  f.remoteChange('dark');
  await assert.rejects(editor.synchronize(f.session), /Changed elsewhere/);
  assert.equal(f.writes.length, 0);
  assert.equal(editor.confirmed('theme'), 'dark');
  assert.equal(editor.settings().theme, 'light');
  await editor.resolve('theme', true);
  await editor.synchronize(f.session);
  assert.equal(f.writes.length, 1);
  assert(f.remote.includes('preserve'));
});
test('a newer edit made during an older write remains pending against its acknowledged baseline', async () => {
  const f = fixture();
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.change('theme', 'light');
  f.delayWrite();
  const syncing = editor.synchronize(f.session);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await editor.change('theme', 'dark');
  f.releaseWrite();
  await syncing;
  assert.equal(editor.settings().theme, 'dark');
  assert.deepEqual(editor.pending(), ['theme']);
  await editor.synchronize(f.session);
  assert.equal(editor.pending().length, 0);
  assert.equal(f.writes.length, 2);
});
test('failed local writes and invalid edits never replace the last effective setting', async () => {
  const f = fixture();
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.draft('theme', 'invalid');
  await assert.rejects(editor.change('theme', 'invalid'), /supported theme/);
  assert.equal(editor.settings().theme, 'system');
  f.diskFull(true);
  await assert.rejects(editor.change('theme', 'dark'), /disk full/);
  assert.equal(editor.settings().theme, 'system');
  await assert.rejects(
    editor.synchronize({ ...f.session, webId: 'https://other.example/#me' }),
    /owner/
  );
});
test('an uncached offline field cannot silently overwrite existing remote choices', async () => {
  const f = fixture();
  f.remoteChange('dark');
  const editor = state(f);
  await editor.open();
  await editor.change('theme', 'light');
  await assert.rejects(editor.synchronize(f.session), /Changed elsewhere/);
  assert.equal(f.writes.length, 0);
  await editor.resolve('theme', false);
  assert.equal(editor.settings().theme, 'dark');
});

test('a stale conflict choice cannot acknowledge a different editor choice', async () => {
  const f = fixture();
  const first = state(f);
  await first.refresh(f.session);
  await first.change('theme', 'light');
  f.remoteChange('dark');
  await assert.rejects(first.synchronize(f.session), /Changed elsewhere/);
  const second = state(f);
  await second.open();
  await second.change('theme', 'system');
  await assert.rejects(first.resolve('theme', true), /changed/);
  assert.equal(f.writes.length, 0);
});

test('choosing a fallback explicitly writes its native term when the Pod omits it', async () => {
  const f = fixture();
  f.removeTheme();
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.change('theme', 'system');
  await editor.synchronize(f.session);
  assert.equal(f.writes.length, 1);
  assert(f.remote.includes('system'));
});

const pickerA = { application: 'https://apps.example/#first',
  url: 'https://apps.example/picker/?mode=one#route' };
const pickerB = { application: 'https://apps.example/#second',
  url: 'https://apps.example/picker/?mode=two#route' };

test('native provider choice survives offline reload and conflicts as a whole binding', async () => {
  const f = fixture();
  f.remoteProvider(pickerA);
  const editor = state(f);
  await editor.refresh(f.session);
  f.offline(true);
  await editor.draft('browseProvider', 'unfinished');
  await editor.change('browseProvider', pickerB);
  const reopened = state(f);
  await reopened.open();
  assert.deepEqual(reopened.settings().browseProvider, pickerB);
  assert.equal(reopened.drafts().browseProvider, 'unfinished');
  assert(f.cached.includes(pickerB.application));
  assert(!f.cached.includes('application\"'));
  f.offline(false);
  const competing = { ...pickerA, url: 'https://other.example/picker/' };
  f.remoteProvider(competing);
  await assert.rejects(reopened.synchronize(f.session), /Changed elsewhere/);
  assert.deepEqual(reopened.confirmed('browseProvider'), competing);
  assert.deepEqual(reopened.settings().browseProvider, pickerB);
  assert.equal(f.writes.length, 0);
  await reopened.resolve('browseProvider', true);
  await reopened.synchronize(f.session);
  assert.deepEqual(reopened.settings().browseProvider, pickerB);
  assert.equal(reopened.pending().length, 0);
  assert(f.remote.includes('preserve'));
});

test('explicit built-in reset does not fall back to the cached custom provider', async () => {
  const f = fixture();
  f.remoteProvider(pickerA);
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.change('browseProvider', null);
  const reopened = state(f);
  await reopened.open();
  assert.equal(reopened.settings().browseProvider, null);
  await reopened.synchronize(f.session);
  assert.equal(reopened.confirmed('browseProvider'), null);
  assert.equal(reopened.pending().length, 0);
  await assert.rejects(reopened.synchronize({ ...f.session,
    webId: 'https://different.example/#me' }), /owner/);
});

test('an uncached provider edit cannot overwrite a competing remote binding', async () => {
  const f = fixture();
  f.remoteProvider(pickerA);
  const editor = state(f);
  await editor.open();
  await editor.change('browseProvider', pickerB);
  await assert.rejects(editor.synchronize(f.session), /Changed elsewhere/);
  await editor.resolve('browseProvider', false);
  assert.deepEqual(editor.settings().browseProvider, pickerA);
  assert.equal(f.writes.length, 0);
});


test('saving a provider clears its matching draft but preserves a newer incomplete draft', async () => {
  const f = fixture();
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.draft('browseProvider', pickerA.url);
  await editor.change('browseProvider', pickerA);
  assert.equal(editor.drafts().browseProvider, undefined);
  await editor.draft('browseProvider', 'a newer unfinished input');
  await editor.change('browseProvider', pickerA);
  assert.equal(editor.drafts().browseProvider, 'a newer unfinished input');
});


test('an uncertain provider write is acknowledged from the native remote binding without replay', async () => {
  const f = fixture();
  const editor = state(f);
  await editor.refresh(f.session);
  await editor.change('browseProvider', pickerA);
  f.loseNextReply();
  await assert.rejects(editor.synchronize(f.session), { code: 'save_unconfirmed' });
  assert.deepEqual(editor.pending(), ['browseProvider']);
  const reopened = state(f);
  await reopened.open();
  await reopened.synchronize(f.session);
  assert.deepEqual(reopened.pending(), []);
  assert.deepEqual(reopened.confirmed('browseProvider'), pickerA);
  assert.equal(f.writes.length, 1);
  assert(f.remote.includes('preserve'));
});
