import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EmbeddedView,
  viewAppearance,
  viewPresentation,
  viewResourceCapability
} from '../packages/solid-app-data/src/embedded-view.mjs';
import { WorkspaceBroker } from '../packages/solid-app-data/src/workspace-broker.mjs';
import { StateGraph } from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  readProvider,
  writeProvider
} from '../packages/solid-preferences/src/providers.mjs';

const presentation = {
  interaction: 'interactive',
  geometry: 'scroll',
  visible: true,
  width: 390,
  height: 400
};

test('appearance is typed, complete and cannot import arbitrary CSS', () => {
  assert.deepEqual(viewAppearance({}), {});
  assert.deepEqual(
    viewAppearance({
      font: 'serif',
      foreground: '#123456',
      fontSize: 18,
      lineHeight: 1.6
    }),
    { font: 'serif', foreground: '#123456', fontSize: 18, lineHeight: 1.6 }
  );
  for (const invalid of [
    { font: 'url(https://elsewhere)' },
    { foreground: 'red;display:none' },
    { fontSize: Infinity },
    { fontSize: 0 },
    { script: 'alert(1)' }
  ]) {
    assert.throws(() => viewAppearance(invalid));
  }
  assert.deepEqual(viewPresentation(presentation), presentation);
  assert.throws(() =>
    viewPresentation({ ...presentation, geometry: 'bounded' })
  );
});

test('persistent ticket is owner scoped, transient and can coexist with a task', async (t) => {
  const url = 'https://viewer.example/';
  const target = {
    name: '',
    location: { origin: 'https://host.example' },
    addEventListener() {},
    removeEventListener() {}
  };
  const broker = new WorkspaceBroker({ target, resolveProvider: () => url });
  t.after(() => broker.dispose());
  const view = broker.beginEmbedded(
    url,
    viewResourceCapability,
    'launcher',
    'view'
  );
  const task = broker.beginEmbedded(url, 'urn:task');
  assert.equal(broker.snapshot().apps.length, 0);
  assert.throws(
    () => broker.embeddedRecord(view.id, 'other'),
    /another caller/
  );
  assert.throws(
    () => broker.beginEmbedded(url, 'urn:task'),
    /current capability/
  );
  await assert.rejects(
    broker.updateEmbeddedView(task.id, { operation: 'prepare' })
  );
  broker.endEmbedded(task.id);
  broker.endEmbedded(view.id);
});

test('view close requires a frozen acknowledgement; failure retains working frame', async () => {
  let ended = 0;
  let result = { allowed: false, message: 'Unsaved draft' };
  const broker = {
    updateEmbeddedView: async () => result,
    endEmbedded: async () => {
      ended += 1;
    }
  };
  const events = [];
  const view = new EmbeddedView({
    broker,
    frame: {},
    change: (value) => events.push(value)
  });
  view.ticket = { id: 'view' };
  view.attached = true;
  assert.equal(await view.close(), false);
  assert.equal(ended, 0);
  result = { allowed: true };
  assert.equal(
    await view.close(),
    false,
    'A stale canClose flag is insufficient'
  );
  broker.updateEmbeddedView = async () => {
    throw new Error('Disconnected');
  };
  await assert.rejects(view.close(), /Disconnected/);
  assert.equal(ended, 0);
  assert.equal(view.retired, undefined);
  broker.updateEmbeddedView = async () => ({ allowed: true, frozen: true });
  assert.equal(await view.close(), true);
  assert.equal(ended, 1);
  assert.equal(events.at(-1).closed, true);
});

test('explicit discard works without permission from an unreachable provider', async () => {
  const view = new EmbeddedView({
    frame: {},
    broker: {
      updateEmbeddedView: async () => {
        throw new Error('Must not ask');
      },
      endEmbedded: async () => ({ closed: true })
    }
  });
  view.ticket = { id: 'view' };
  view.attached = true;
  assert.equal(await view.close({ discard: true }), true);
});

test('view provider preferences preserve other native bindings and unknown RDF', () => {
  const url = 'https://pod.example/prefs';
  const graph = new StateGraph('<urn:other> <urn:keep> "preserved" .', url);
  const choice = { application: 'urn:viewer', url: 'https://viewer.example/' };
  writeProvider(graph, url, choice, viewResourceCapability);
  writeProvider(graph, url, { ...choice, application: 'urn:picker' });
  assert.deepEqual(readProvider(graph, url, viewResourceCapability), choice);
  writeProvider(graph, url, null, viewResourceCapability);
  assert.equal(readProvider(graph, url).application, 'urn:picker');
  assert.match(graph.write(), /preserved/);
});

test('parent removal and workspace close retain views when their owner refuses', async (t) => {
  const url = 'https://viewer.example/';
  const target = {
    name: '',
    location: { origin: 'https://host.example' },
    addEventListener() {},
    removeEventListener() {}
  };
  const broker = new WorkspaceBroker({ target, resolveProvider: () => url });
  t.after(() => broker.dispose());
  const owner = broker.add({
    id: 'owner',
    url: 'https://files.example/',
    state: null
  });
  owner.registered = true;
  const view = broker.beginEmbedded(
    url,
    viewResourceCapability,
    'owner',
    'view'
  );
  owner.peer = {
    closed: false,
    close() {},
    call: async () => ({ allowed: false })
  };
  await assert.rejects(broker.remove('owner'), /Finish the open view/);
  await assert.rejects(broker.closeApps(), /Finish the open view/);
  assert(broker.instances.has(view.id));
  assert.equal(broker.closing, false);
  owner.peer.call = async () => {
    broker.endEmbedded(view.id, 'owner');
    return { allowed: true };
  };
  await broker.remove('owner');
  assert.equal(broker.instances.has(view.id), false);
  assert.equal(broker.instances.has('owner'), false);
});
