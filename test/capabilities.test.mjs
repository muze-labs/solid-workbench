import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PortConnection,
  ManagedApp,
  CapabilityParticipant,
  capabilityError,
  browseRequest,
  selectionUrl,
  serializable
} from '../packages/solid-app-data/src/capabilities.mjs';
import { WorkspaceBroker } from '../packages/solid-app-data/src/workspace-broker.mjs';

const restoration = (value) => ({
  turtle:
    '<urn:muze:solid-apps:state:root> <https://example.org/draft> "' +
    value +
    '" .'
});

test('resource picking distinguishes existing files and new save destinations', () => {
  assert.deepEqual(browseRequest({}), { mode: 'resource', suggestedName: '' });
  assert.deepEqual(browseRequest({ mode: 'open' }), {
    mode: 'open', suggestedName: ''
  });
  assert.deepEqual(browseRequest({ mode: 'save', suggestedName: 'Notes.ttl' }), {
    mode: 'save', suggestedName: 'Notes.ttl'
  });
  for (const request of [null, [], { mode: null }, { mode: 'delete' }, { write: true },
    { mode: 'open', suggestedName: 'Notes.ttl' },
    { mode: 'save', suggestedName: { path: 'Notes.ttl' } }]) {
    assert.throws(() => browseRequest(request), (error) => error.code === 'invalid');
  }
});

function pair(t, handle, options) {
  const channel = new MessageChannel();
  const caller = new PortConnection(channel.port1, () => {}, options);
  const provider = new PortConnection(channel.port2, handle, options);
  t.after(() => {
    caller.close();
    provider.close();
  });
  return { caller, provider };
}
test('private ports carry results and errors without shared storage or a service', async (t) => {
  const { caller } = pair(t, async (method, input) => {
    if (method !== 'select') {
      throw capabilityError('Not allowed.', 'denied');
    }
    return { '@id': input.url };
  });
  const url = 'https://pod.example/file?view=all#subject';
  assert.equal(selectionUrl(await caller.call('select', { url })), url);
  await assert.rejects(
    caller.call('wrong', {}),
    (error) => error.code === 'denied'
  );
});
test('cancel, timeout and disconnect settle outstanding calls', async (t) => {
  let observe;
  const cancelled = new Promise((resolve) => {
    observe = resolve;
  });
  const { caller, provider } = pair(
    t,
    (_method, _input, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          observe();
          reject(capabilityError('Cancelled.', 'cancelled'));
        });
      }),
    { timeout: 30 }
  );
  const controller = new AbortController();
  const pending = caller.call('wait', {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error.code === 'cancelled');
  await cancelled;
  await assert.rejects(
    caller.call('wait', {}),
    (error) => error.code === 'timeout'
  );
  const outstanding = caller.call('wait', {});
  caller.close();
  provider.close();
  await assert.rejects(outstanding, (error) => error.code === 'disconnected');
});
test('Transport values reject lossy or unsafe representations', () => {
  const value = {
    selected: 'https://pod.example/#me',
    extra: ['unknown', null]
  };
  assert.deepEqual(serializable(value), value);
  for (const unsupported of [undefined, { f() {} }, new Date(), { n: NaN }]) {
    assert.throws(() => serializable(unsupported), /JSON/);
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => serializable(cyclic), /nesting/);
  assert.throws(() => selectionUrl({ '@id': 'javascript:alert(1)' }));
});
test('workspace drafts cannot mutate a clean persistence snapshot by alias', (t) => {
  const snapshot = {
    version: 2,
    launcher: { resource: '' },
    apps: [
      {
        id: 'one',
        url: 'https://files.example/',
        state: restoration('original')
      }
    ]
  };
  const broker = new WorkspaceBroker({
    snapshot,
    target: { addEventListener() {}, removeEventListener() {} }
  });
  t.after(() => broker.dispose());
  broker.launcherState.resource = 'https://pod.example/latest';
  broker.instances.get('one').entry.state.turtle =
    restoration('changed').turtle;
  assert.equal(snapshot.launcher.resource, '');
  assert.deepEqual(snapshot.apps[0].state, restoration('original'));
  assert.equal(
    broker.snapshot().launcher.resource,
    'https://pod.example/latest'
  );
});
test('workspace state is bound to one instance and rejects stale owners', async (t) => {
  const peers = [];
  let focused = 0;
  const target = {
    location: { origin: 'https://launcher.example' },
    addEventListener() {},
    removeEventListener() {},
    open() {
      return {
        closed: false,
        focus() {
          focused++;
        },
        close() {
          this.closed = true;
        },
        postMessage(message, origin, ports) {
          assert.equal(origin, 'https://files.example');
          const peer = new PortConnection(ports[0], (method) => {
            assert.equal(method, 'capability');
            return { result: { '@id': 'https://pod.example/resource' } };
          });
          peers.push(peer);
        }
      };
    }
  };
  const broker = new WorkspaceBroker({
    target,
    onChange: async () => {}
  });
  t.after(() => {
    broker.dispose();
    peers.forEach((peer) => peer.close());
  });
  const record = broker.open('https://files.example/app');
  broker.offer(record);
  const peer = peers[0];
  await peer.call('register', { capabilities: ['https://example.org/select'] });
  await peer.call('state', restoration('unknown-42'));
  assert.deepEqual(broker.snapshot().apps[0].state, restoration('unknown-42'));
  assert(!JSON.stringify(broker.snapshot()).includes(record.key));
  const existingWindow = record.win;
  broker.resume({
    data: { type: 'solid-apps:resume', id: record.entry.id, key: record.key },
    origin: 'https://evil.example',
    source: {}
  });
  assert.equal(record.win, existingWindow);
  broker.resume({
    data: { type: 'solid-apps:resume', id: record.entry.id, key: record.key },
    origin: 'https://files.example',
    source: {}
  });
  assert.equal(record.win, existingWindow);
  broker.closing = true;
  await assert.rejects(
    peer.call('state', restoration('stale state')),
    /active/
  );
  assert.deepEqual(broker.snapshot().apps[0].state, restoration('unknown-42'));
});

async function checkpointFixture(t, handle, options = {}) {
  const peers = [];
  const target = {
    addEventListener() {},
    removeEventListener() {},
    open() {
      return {
        closed: false,
        focus() {},
        close() {
          this.closed = true;
        },
        postMessage(message, _origin, ports) {
          peers.push(
            new PortConnection(ports[0], (method, input, options) =>
              handle(method, input, options, message.id)
            )
          );
        }
      };
    }
  };
  const snapshots = [];
  const broker = new WorkspaceBroker({
    target,
    ...options,
    onChange: async (snapshot) => {
      snapshots.push(snapshot);
    }
  });
  t.after(() => {
    broker.dispose();
    peers.forEach((peer) => peer.close());
  });
  const record = broker.open('https://files.example/', { label: 'My Files' });
  broker.offer(record);
  await peers[0].call('register', {
    capabilities: [],
    generation: 'one',
    restoring: true
  });
  return { broker, record, peers, snapshots };
}

test('a healthy three-second checkpoint captures fresh state', async (t) => {
  const { broker, record, peers } = await checkpointFixture(t, async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return restoration('fresh');
  });
  await peers[0].call('ready', null);
  await broker.checkpoint();
  assert.deepEqual(record.entry.state, restoration('fresh'));
});

test('restoration is distinct from readiness and failures name the app', async (t) => {
  let calls = 0;
  const { broker, record, peers } = await checkpointFixture(t, () => {
    calls++;
  });
  await assert.rejects(broker.checkpoint(), /My Files.*still restoring/);
  assert.equal(calls, 0);
  await peers[0].call('restore-error', { message: 'Pod sign-in required.' });
  await assert.rejects(broker.checkpoint(), /My Files.*Pod sign-in required/);
  assert.equal(record.entry.state, null);
});

test('timeout keeps previous state and permits a fresh checkpoint after reconnect', async (t) => {
  let responsive = false;
  let slowId;
  const { broker, record, peers } = await checkpointFixture(
    t,
    (_method, _input, _options, id) => {
      if (!responsive && id === slowId) {
        return new Promise(() => {});
      }
      return restoration('still-live');
    },
    { checkpointTimeout: 30 }
  );
  slowId = record.entry.id;
  await peers[0].call('state', restoration('previous'));
  await peers[0].call('ready', null);
  const sibling = broker.open('https://contacts.example/', {
    label: 'Contacts'
  });
  broker.offer(sibling);
  await peers[1].call('register', {
    capabilities: [],
    generation: 'sibling',
    restoring: true
  });
  await peers[1].call('ready', null);
  await assert.rejects(broker.checkpoint(), /My Files.*timed out/);
  assert.deepEqual(record.entry.state, restoration('previous'));
  assert.deepEqual(sibling.entry.state, restoration('still-live'));
  assert.equal(record.win.closed, false);
  assert.equal(record.registered, false);
  responsive = true;
  broker.offer(record);
  await peers[2].call('register', {
    capabilities: [],
    generation: 'one',
    restoring: true
  });
  await peers[2].call('ready', null);
  await broker.checkpoint();
  assert.deepEqual(record.entry.state, restoration('still-live'));
});

test('older clients require reload after timeout to protect their live drafts', async (t) => {
  const { broker, record, peers } = await checkpointFixture(
    t,
    () => new Promise(() => {}),
    { checkpointTimeout: 30 }
  );
  await peers[0].call('register', {
    capabilities: [],
    generation: 'old-client'
  });
  await assert.rejects(broker.checkpoint(), /timed out/);
  broker.inspect();
  assert.equal(peers.length, 1);
  assert.match(record.restoreError, /Reload this app/);
  assert.equal(record.win.closed, false);
});

test('embedded providers are scoped to a caller and excluded from durable workspace state', async (t) => {
  const capability = 'https://vocab.muze.nl/capabilities/edit-profile';
  const target = {
    name: '',
    location: { origin: 'https://launcher.example' },
    addEventListener() {},
    removeEventListener() {}
  };
  const broker = new WorkspaceBroker({
    target,
    onChange: async () => {},
    embeddedProviders: [{ url: 'https://profile.example/', capability }]
  });
  t.after(() => broker.dispose());
  const owner = broker.add({
    id: 'caller',
    url: 'https://contacts.example/',
    state: null
  });
  owner.win = { focus() {} };
  owner.registered = true;
  const ticket = await broker.handle(
    owner,
    'embed',
    {
      url: 'https://profile.example/?solid-apps-task',
      capability
    },
    {}
  );
  assert.equal(broker.snapshot().apps.length, 1);
  assert.deepEqual(Object.keys(broker.keys()), ['caller']);
  target.open = () => {
    throw new Error('Transient providers must not open as tabs on restore.');
  };
  broker.restore();
  assert.throws(
    () => broker.beginEmbedded('https://evil.example/', capability),
    /not configured/
  );
  assert.throws(
    () => broker.beginEmbedded('https://profile.example/', 'another'),
    /not configured/
  );
  assert.throws(
    () =>
      broker.beginEmbedded('https://profile.example/', capability, 'caller'),
    /current capability/
  );
  await assert.rejects(
    broker.requestEmbedded(ticket.id, {}, { requester: 'other' }),
    /another caller/
  );

  const channel = new MessageChannel();
  t.after(() => channel.port2.close());
  broker.attachEmbedded({
    source: {},
    origin: 'https://contacts.example',
    data: ticket,
    ports: [channel.port1]
  });
  assert.equal(broker.instances.get(ticket.id).peer, null);
  broker.attachEmbedded({
    source: owner.win,
    origin: 'https://evil.example',
    data: ticket,
    ports: [channel.port1]
  });
  assert.equal(broker.instances.get(ticket.id).peer, null);
  broker.attachEmbedded({
    source: owner.win,
    origin: 'https://contacts.example',
    data: ticket,
    ports: [channel.port1]
  });
  const provider = new PortConnection(channel.port2, async (method, input) => {
    if (method === 'can-close') {
      return { allowed: false };
    }
    assert.equal(method, 'capability');
    assert.equal(input.requester.origin, 'https://contacts.example');
    return { result: { '@id': input.input['@id'] } };
  });
  t.after(() => provider.close());
  await provider.call('register', { capabilities: [capability] });
  const result = await broker.requestEmbedded(
    ticket.id,
    { '@id': 'https://pod.example/profile#me' },
    { requester: 'caller' }
  );
  assert.deepEqual(result, { '@id': 'https://pod.example/profile#me' });
  assert.deepEqual(await broker.canCloseEmbedded(ticket.id, 'caller'), {
    allowed: false
  });
  assert.throws(() => broker.endEmbedded(ticket.id, 'other'), /another caller/);
  await assert.rejects(broker.checkpoint(), /Finish or discard/);
  assert.equal(broker.snapshot().apps.length, 1);
  broker.endEmbedded(ticket.id, 'caller');
  assert.equal(broker.instances.has(ticket.id), false);
});

test('interactive capability calls wait for a result or explicit cancellation', async (t) => {
  const { caller } = pair(
    t,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { saved: true };
    },
    { timeout: 5 }
  );
  assert.deepEqual(await caller.call('edit', {}, { timeout: null }), {
    saved: true
  });
});

test('presentation focus accepts only the ready task parent and current ticket', async () => {
  const parent = {};
  let focused = 0;
  const app = {
    parent,
    task: true,
    ready: true,
    peer: { closed: false },
    resume: {
      id: 'task',
      key: 'private-key',
      origin: 'https://caller.example'
    },
    onFocus: async () => {
      focused += 1;
    }
  };
  const message = {
    source: parent,
    origin: 'https://caller.example',
    data: {
      type: 'solid-apps:presentation-focus',
      id: 'task',
      key: 'private-key'
    }
  };
  await ManagedApp.prototype.offer.call(app, message);
  assert.equal(focused, 1);
  for (const event of [
    { ...message, source: {} },
    { ...message, origin: 'https://other.example' },
    { ...message, data: { ...message.data, id: 'old-task' } },
    { ...message, data: { ...message.data, key: 'wrong-key' } }
  ]) {
    await ManagedApp.prototype.offer.call(app, event);
  }
  for (const blocked of [
    { ...app, ready: false },
    { ...app, task: false },
    { ...app, peer: { closed: true } }
  ]) {
    await ManagedApp.prototype.offer.call(blocked, message);
  }
  assert.equal(focused, 1);
});

test('registered providers do not gain account-control authority by declaring a capability', async (t) => {
  const target = new EventTarget();
  const broker = new WorkspaceBroker({ target });
  t.after(() => broker.dispose());
  const record = broker.add({ id: 'external', url: 'https://external.example/files/' });
  record.registered = true;
  record.capabilities = ['https://vocab.muze.nl/solid-apps#account-controls'];
  await assert.rejects(broker.handle(record, 'account-controls', {}, {}),
    (error) => error.code === 'denied');
});


test('presentation close is scoped to an attached iframe, including port loss', () => {
  const messages = [];
  const app = {
    embedded: true, ready: true,
    parent: { postMessage: (...args) => messages.push(args) },
    resume: { id: 'task', key: 'secret', origin: 'https://caller.example' },
    peer: { closed: true }
  };
  const close = () => ManagedApp.prototype.requestPresentationClose.call(app);
  assert.equal(close(), true);
  assert.deepEqual(messages, [[{
    type: 'solid-apps:presentation-close', id: 'task', key: 'secret'
  }, 'https://caller.example']]);
  for (const [name, value] of [
    ['embedded', false], ['ready', false], ['parent', null], ['resume', null]
  ]) {
    const original = app[name];
    app[name] = value;
    assert.equal(close(), false);
    app[name] = original;
  }
  assert.equal(messages.length, 1);
});

test('cooperative remote close settles unbounded calls and aborts active work',
  { timeout: 1000 }, async (t) => {
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    let activeSignal;
    const { caller, provider } = pair(t, (_method, _input, { signal }) => {
      activeSignal = signal;
      started();
      return new Promise(() => {});
    });
    const pending = caller.call('edit', {}, { timeout: null });
    await ready;
    provider.close();
    await assert.rejects(pending, (error) => error.code === 'disconnected');
    assert.equal(caller.pending.size, 0);
    assert.equal(provider.active.size, 0);
    assert.equal(activeSignal.aborted, true);
  });

test('independent peers send large structured values without a global byte cap',
  async (t) => {
    const channel = new MessageChannel();
    const connection = new PortConnection(channel.port1, () => {});
    t.after(() => { connection.close(); channel.port2.close(); });
    channel.port2.onmessage = ({ data }) => {
      if (data.type === 'call') {
        channel.port2.postMessage({ type: 'reply', id: data.id,
          result: new Map([['text', data.input.text]]) });
      }
    };
    const value = serializable({ text: 'é'.repeat(40000) });
    const response = await connection.call('inspect', value);
    assert.equal(response.get('text'), value.text);
  });

test('malformed frames settle pending calls without invoking a handler',
  { timeout: 1000 }, async (t) => {
    for (const invalid of [null, [], { type: 'call', id: 'x' },
      { type: 'reply', id: 'x', error: { message: {} } }]) {
      const channel = new MessageChannel();
      let handled = false;
      const connection = new PortConnection(channel.port1, () => { handled = true; });
      t.after(() => { connection.close(); channel.port2.close(); });
      const pending = connection.call('wait', null, { timeout: null });
      channel.port2.postMessage(invalid);
      await assert.rejects(pending, /Invalid capability frame/);
      assert.equal(handled, false);
      assert.equal(connection.pending.size, 0);
    }
  });

test('disconnected embedded calls release their owner slot without replay',
  { timeout: 1000 }, async (t) => {
    const target = { location: { origin: 'https://caller.example' },
      addEventListener() {}, removeEventListener() {} };
    const capability = 'https://example.org/edit';
    const url = 'https://provider.example/';
    const broker = new WorkspaceBroker({ target,
      embeddedProviders: [{ url, capability }] });
    t.after(() => broker.dispose());
    const ticket = broker.beginEmbedded(url, capability);
    const channel = new MessageChannel();
    broker.attachEmbedded({ source: target, origin: target.location.origin,
      data: ticket, ports: [channel.port1] });
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    let invocations = 0;
    const provider = new PortConnection(channel.port2, () => {
      invocations++;
      started();
      return new Promise(() => {});
    });
    t.after(() => provider.close());
    await provider.call('register', { capabilities: [capability] });
    const pending = broker.requestEmbedded(ticket.id, {});
    await ready;
    provider.close();
    await assert.rejects(pending, (error) => error.code === 'disconnected');
    assert.equal(invocations, 1);
    assert.equal(broker.instances.has(ticket.id), false);
    const next = broker.beginEmbedded(url, capability);
    assert.notEqual(next.id, ticket.id);
    assert.equal(invocations, 1);
    broker.endEmbedded(next.id);
  });


test('managed embedded calls transport reactive inputs as plain wire values',
  async (t) => {
    const { caller } = pair(t, async (method, input) => {
      return { method, input };
    });
    const fragment = new Proxy({ text: 'Retain this text', annotations: [] }, {});
    const app = { peer: caller };
    const result = await ManagedApp.prototype.requestEmbedded.call(
      app, 'view', { fragment }
    );
    assert.deepEqual(result, {
      method: 'embed-call',
      input: { id: 'view', input: {
        fragment: { text: 'Retain this text', annotations: [] }
      } }
    });
    assert.equal(fragment.text, 'Retain this text');
  });

function participantHost(t, participant, receive = () => null) {
  const channel = new MessageChannel();
  const frames = [];
  const host = new PortConnection(channel.port1, async (method, input) => {
    frames.push({ method, input });
    return receive(method, input);
  });
  t.after(() => {
    participant.disconnect();
    host.close();
  });
  return { host, frames, port: channel.port2 };
}

test('direct participation restores native state and registers without browser launch globals', async (t) => {
  const state = {
    turtle:
      '<urn:draft> a <urn:Note>, <urn:Foreign>; <urn:text> "keep". _:extra <urn:unknown> "foreign".',
    opaque: 'app-owned experiment'
  };
  let restored;
  let context;
  const participant = new CapabilityParticipant({
    name: 'Independent editor',
    capabilities: ['urn:edit'],
    restoreState: (value) => {
      restored = value;
    },
    getState: () => restored,
    onContext: (value) => {
      context = value;
    },
    beforeCheckpoint: () => {
      restored = { ...restored, opaque: 'checkpoint' };
    }
  });
  const connection = participantHost(t, participant, (method) =>
    method === 'register' ? { context: { resource: 'urn:document' } } : null
  );
  await participant.connect(connection.port, { state, identity: 'owned-slot' });
  assert(participant.ready);
  assert.deepEqual(restored, state);
  assert.deepEqual(context, { resource: 'urn:document' });
  assert.deepEqual(
    connection.frames.map((frame) => frame.method),
    ['register', 'state', 'ready']
  );
  assert.equal(typeof connection.frames[0].input.generation, 'string');
  assert.deepEqual(await connection.host.call('checkpoint', null), {
    ...state,
    opaque: 'checkpoint'
  });
  assert.equal(
    restored.turtle,
    state.turtle,
    'Participation does not parse or flatten native RDF'
  );
});

test('a transient participant publishes no checkpoint automatically and retains app close vetoes', async (t) => {
  let dirty = true;
  const participant = new CapabilityParticipant({
    transient: true,
    canClose: () => ({ allowed: !dirty, message: 'Keep this draft' }),
    getState: () => {
      throw new Error('Must not publish automatically');
    }
  });
  const connection = participantHost(t, participant);
  await participant.connect(connection.port);
  assert.deepEqual(
    connection.frames.map((frame) => frame.method),
    ['register', 'ready']
  );
  assert.deepEqual(await connection.host.call('can-close', null), {
    allowed: false,
    message: 'Keep this draft'
  });
  dirty = false;
  assert.equal((await connection.host.call('can-close', null)).allowed, true);
});

test('direct request completion, cancellation and reconnect never replay a selection', async (t) => {
  const requests = [];
  const cancelled = [];
  const participant = new CapabilityParticipant({
    transient: true,
    capabilities: ['urn:choose'],
    onRequest: (request) => {
      requests.push(request);
    },
    onCancel: (request) => {
      cancelled.push(request.id);
    }
  });
  let connection = participantHost(t, participant);
  await participant.connect(connection.port);
  const waitRequest = async (count) => {
    while (requests.length < count) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    return requests[count - 1];
  };
  const first = connection.host.call('capability', {
    capability: 'urn:choose',
    input: { title: 'Choose' }
  });
  const request = await waitRequest(1);
  await participant.respond(request.id, { result: { '@id': 'urn:chosen' } });
  assert.deepEqual(await first, { result: { '@id': 'urn:chosen' } });
  await assert.rejects(participant.respond(request.id, {}), /no longer active/);
  const controller = new AbortController();
  const second = connection.host.call(
    'capability',
    { capability: 'urn:choose' },
    { signal: controller.signal }
  );
  const toCancel = await waitRequest(2);
  controller.abort();
  await assert.rejects(second, (error) => error.code === 'cancelled');
  while (!cancelled.includes(toCancel.id)) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  await assert.rejects(
    participant.respond(toCancel.id, {}),
    /no longer active/
  );
  const third = connection.host.call('capability', {
    capability: 'urn:choose'
  });
  const rejection = assert.rejects(
    third,
    (error) => error.code === 'disconnected'
  );
  const toRetire = await waitRequest(3);
  connection = participantHost(t, participant);
  await participant.connect(connection.port);
  await rejection;
  assert(cancelled.includes(toRetire.id));
  assert.equal(requests.length, 3);
  await assert.rejects(
    connection.host.call('capability', { capability: 'urn:other' }),
    (error) => error.code === 'denied'
  );
});

test('reconnecting the same restoration identity keeps newer local edits, while a new identity restores', async (t) => {
  let document;
  let restores = 0;
  const participant = new CapabilityParticipant({
    restoreState: (state) => {
      document = state;
      restores += 1;
    },
    getState: () => document
  });
  let connection = participantHost(t, participant);
  await participant.connect(connection.port, {
    identity: 'one',
    state: restoration('original')
  });
  document = restoration('newer local edits');
  connection = participantHost(t, participant);
  await participant.connect(connection.port, {
    identity: 'one',
    state: restoration('old checkpoint')
  });
  assert.equal(restores, 1);
  assert.deepEqual(
    connection.frames.find((frame) => frame.method === 'state').input,
    restoration('newer local edits')
  );
  connection = participantHost(t, participant);
  await participant.connect(connection.port, {
    identity: 'two',
    state: restoration('different document')
  });
  assert.equal(restores, 2);
  assert.deepEqual(document, restoration('different document'));
});

test('failed startup reports restore error without ready or checkpoint, and a fresh identity can recover', async (t) => {
  let failure = true;
  const participant = new CapabilityParticipant({
    restoreState: () => {
      if (failure) {
        throw new Error('Local recovery unavailable');
      }
    }
  });
  let connection = participantHost(t, participant);
  await participant.connect(connection.port, { identity: 'failed' });
  assert.equal(participant.ready, false);
  assert.deepEqual(
    connection.frames.map((frame) => frame.method),
    ['register', 'restore-error']
  );
  await assert.rejects(
    connection.host.call('checkpoint', null),
    (error) => error.code === 'restoring'
  );
  failure = false;
  connection = participantHost(t, participant);
  await participant.connect(connection.port, { identity: 'fresh' });
  assert(participant.ready);
});

test('retired registration cannot restore, publish or report readiness on its replacement', async (t) => {
  let release;
  let registered;
  const seen = new Promise((resolve) => {
    registered = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const restored = [];
  const contexts = [];
  const participant = new CapabilityParticipant({
    transient: true,
    restoreState: (state) => {
      restored.push(state);
    },
    onContext: (context) => {
      contexts.push(context);
    }
  });
  const old = participantHost(t, participant, async (method) => {
    if (method === 'register') {
      registered();
      await held;
    }
    return { context: 'retired' };
  });
  const connecting = participant.connect(old.port, {
    identity: 'old',
    state: restoration('old')
  });
  await seen;
  const current = participantHost(t, participant, () => ({
    context: 'current'
  }));
  await participant.connect(current.port, {
    identity: 'current',
    state: restoration('current')
  });
  release();
  await connecting;
  assert.deepEqual(restored, [restoration('current')]);
  assert.deepEqual(contexts, ['current']);
  assert(participant.ready);
});

test('a retired context callback cannot restore an old checkpoint after a replacement is ready', async (t) => {
  let entered;
  let release;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const restored = [];
  const participant = new CapabilityParticipant({
    transient: true,
    onContext: async (context) => {
      if (context === 'old') {
        entered();
        await held;
      }
    },
    restoreState: (state) => {
      restored.push(state);
    }
  });
  const previous = participantHost(t, participant, () => ({ context: 'old' }));
  const connecting = participant.connect(previous.port, {
    identity: 'old',
    state: restoration('old')
  });
  await started;
  const current = participantHost(t, participant, () => ({
    context: 'current'
  }));
  await participant.connect(current.port, {
    identity: 'current',
    state: restoration('current')
  });
  release();
  await connecting;
  assert.deepEqual(restored, [restoration('current')]);
  assert(participant.ready);
});

test('a failed resume-ticket write still retires the previous browser channel', async (t) => {
  const participant = new CapabilityParticipant({ transient: true });
  Object.setPrototypeOf(participant, ManagedApp.prototype);
  participant.parent = {};
  participant.task = false;
  const connection = participantHost(t, participant);
  await participant.connect(connection.port);
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage'
  );
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      setItem() {
        throw new Error('Resume storage unavailable');
      }
    }
  });
  const offered = new MessageChannel();
  try {
    await assert.rejects(
      participant.offer({
        source: participant.parent,
        origin: 'https://caller.example',
        data: { type: 'solid-apps:offer', id: 'new', key: 'private-key' },
        ports: [offered.port2]
      }),
      /Resume storage unavailable/
    );
    assert.equal(participant.ready, false);
    await assert.rejects(
      participant.peer.call('checkpoint', null),
      (error) => error.code === 'failed'
    );
  }
  finally {
    offered.port1.close();
    offered.port2.close();
    if (previous) {
      Object.defineProperty(globalThis, 'sessionStorage', previous);
    }
    else {
      delete globalThis.sessionStorage;
    }
  }
});
