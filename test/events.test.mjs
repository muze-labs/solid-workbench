import test from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '@muze-labs/simplyflow/actions';
import { installEvents } from '../packages/simplyflow-events/src/index.mjs';
import { exposeDefinition } from '../packages/solid-app-data/src/definition.mjs';

function createApp(events, definitions = {}, onError) {
  const window = new EventTarget();
  const app = {
    container: { ownerDocument: { defaultView: window } },
    events,
    runtime: {},
    data: { draft: 'keep me' },
    onError,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
  app.actions = actions({ app, actions: definitions });
  return { app, window, definitions };
}

function windowEvent(action = 'receive') {
  return { target: 'window', type: 'change', action };
}

test('native events dispatch synchronously to current actions and retain state', () => {
  const calls = [];
  const original = function (event) {
    assert.equal(this.data.draft, 'keep me');
    event.preventDefault();
    calls.push(['original', event]);
  };
  const { app, window, definitions } = createApp(
    { changed: windowEvent() }, { receive: original }
  );
  const bindings = installEvents(app);
  assert.equal(installEvents(app), bindings);
  window.dispatchEvent(new Event('change'));
  assert.equal(calls.length, 0, 'installation must not activate');
  bindings.start();
  bindings.start();
  const event = new Event('change', { cancelable: true });
  assert.equal(window.dispatchEvent(event), false);
  assert.deepEqual(calls, [['original', event]]);
  definitions.receive = function (event) {
    calls.push(['replacement', event]);
  };
  window.dispatchEvent(event);
  definitions.receive = original;
  window.dispatchEvent(event);
  assert.deepEqual(calls.map(([name]) => name), [
    'original', 'replacement', 'original'
  ]);
  bindings.stop();
  bindings.stop();
  window.dispatchEvent(event);
  assert.equal(calls.length, 3);
  bindings.start();
  app.destroy();
  bindings.start();
  window.dispatchEvent(event);
  assert.equal(calls.length, 3);
  assert.equal(app.data.draft, 'keep me');
  assert.throws(() => installEvents(app), /destroyed app/);
});

test('library EventTarget resolver receives app context and preserves detail', () => {
  const source = new EventTarget();
  const { app } = createApp({
    library: {
      target() { return this.runtime.source; },
      type: 'library-update',
      action: 'receive'
    }
  }, {
    receive(event) { this.runtime.payload = event.detail; }
  });
  app.runtime.source = source;
  installEvents(app).start();
  const payload = { id: 'native:identity', values: ['one', 'two'] };
  source.dispatchEvent(new CustomEvent('library-update', { detail: payload }));
  assert.equal(app.runtime.payload, payload);
  app.destroy();
});

test('custom subscriptions forward arguments, results, context and current actions', () => {
  let notify;
  let unsubscribed = 0;
  const { app, definitions } = createApp({
    library: {
      subscribe(callback) {
        assert.equal(this, app);
        notify = callback;
        return () => { unsubscribed += 1; };
      },
      action: 'receive'
    }
  }, {
    receive(...args) {
      assert.equal(this, app);
      return args;
    }
  });
  const bindings = installEvents(app);
  bindings.start();
  const oldNotify = notify;
  const payload = { native: 'data' };
  assert.deepEqual(notify(payload, 2), [payload, 2]);
  definitions.receive = () => 'new';
  assert.equal(notify(), 'new');
  bindings.stop();
  assert.equal(unsubscribed, 1);
  assert.equal(oldNotify(), undefined);
  bindings.start();
  assert.equal(oldNotify(), undefined, 'restart must not revive old callbacks');
  assert.equal(notify(), 'new');
  app.destroy();
  assert.equal(unsubscribed, 2);
  assert.equal(notify(), undefined);
});

test('activation conditions and resolver disposal do not attach stale listeners', () => {
  let count = 0;
  const { app, window } = createApp({
    conditional: {
      ...windowEvent(),
      when() { return this.runtime.enabled === true; }
    },
    stopped: {
      target() { this.eventBindings.stop(); return window; },
      type: 'change', action: 'receive'
    }
  }, { receive() { count += 1; } });
  const bindings = installEvents(app);
  bindings.start();
  window.dispatchEvent(new Event('change'));
  assert.equal(count, 0);
  delete app.events.stopped;
  app.runtime.enabled = true;
  bindings.start();
  window.dispatchEvent(new Event('change'));
  assert.equal(count, 1);
  app.destroy();
});

test('synchronous subscription notifications can destroy during setup', () => {
  let cleanups = 0;
  let secondSource = false;
  let retained;
  const { app } = createApp({
    first: {
      action: 'receive',
      subscribe(notify) {
        retained = notify;
        notify();
        return () => { cleanups += 1; };
      }
    },
    second: {
      action: 'receive',
      subscribe() {
        secondSource = true;
        return () => {};
      }
    }
  }, { receive() { this.destroy(); } });
  installEvents(app).start();
  assert.equal(cleanups, 1);
  assert.equal(secondSource, false);
  assert.equal(retained(), undefined);
  assert.equal(app.destroyed, true);
});

test('partial activation failure rolls back all connections and allows retry', () => {
  let retained;
  let cleanups = 0;
  let received = 0;
  const failure = new Error('source: unavailable');
  const { app, window } = createApp({
    native: windowEvent(),
    first: {
      action: 'receive',
      subscribe(notify) {
        retained = notify;
        return () => { cleanups += 1; };
      }
    },
    broken: { action: 'receive', subscribe() { throw failure; } }
  }, { receive() { received += 1; } });
  const bindings = installEvents(app);
  assert.throws(() => bindings.start(), (error) => error === failure);
  window.dispatchEvent(new Event('change'));
  retained();
  assert.equal(received, 0);
  assert.equal(cleanups, 1);
  delete app.events.broken;
  bindings.start();
  window.dispatchEvent(new Event('change'));
  assert.equal(received, 1);
  app.destroy();
});

test('all sources and underlying app are disposed when unsubscribe fails', () => {
  let notify;
  let otherCleanup = false;
  let calls = 0;
  const failure = new Error('source: cannot unsubscribe');
  const { app } = createApp({
    first: {
      action: 'receive',
      subscribe(callback) {
        notify = callback;
        return () => { otherCleanup = true; };
      }
    },
    second: {
      action: 'receive',
      subscribe() {
        return () => {
          notify();
          app.eventBindings.start();
          throw failure;
        };
      }
    }
  }, { receive() { calls += 1; } });
  installEvents(app).start();
  assert.throws(() => app.destroy(), (error) => error === failure);
  assert.equal(otherCleanup, true);
  assert.equal(app.destroyed, true);
  assert.equal(calls, 0);
  app.destroy();
});

test('suite cleanup errors still destroy native bindings and SimplyFlow resources', () => {
  let deliveries = 0;
  const failure = new Error('fixture: cleanup failed');
  const { app, window } = createApp({ change: windowEvent() }, {
    receive() { deliveries += 1; },
    cleanup() {
      window.dispatchEvent(new Event('change'));
      throw failure;
    }
  });
  exposeDefinition(app, {}, {});
  installEvents(app).start();
  assert.throws(() => app.destroy(), (error) => error === failure);
  assert.equal(app.destroyed, true);
  assert.equal(deliveries, 0);
});

test('owners remain isolated on a shared EventTarget', () => {
  const target = new EventTarget();
  let first = 0;
  let second = 0;
  const descriptor = { target: () => target, type: 'change', action: 'receive' };
  const a = createApp({ shared: descriptor }, { receive() { first += 1; } });
  const b = createApp({ shared: descriptor }, { receive() { second += 1; } });
  installEvents(a.app).start();
  installEvents(b.app).start();
  a.app.destroy();
  target.dispatchEvent(new Event('change'));
  assert.equal(first, 0);
  assert.equal(second, 1);
  b.app.destroy();
});

test('actions retain SimplyFlow synchronous and async error handling exactly once', async () => {
  const errors = [];
  let notify;
  const sync = new Error('fixture: sync');
  const async = new Error('fixture: async');
  const { app, definitions } = createApp({
    library: { action: 'receive', subscribe(callback) {
      notify = callback;
      return () => {};
    } }
  }, { receive() { throw sync; } }, (error) => { errors.push(error); });
  installEvents(app).start();
  notify();
  definitions.receive = async function () { throw async; };
  await notify();
  assert.deepEqual(errors, [sync, async]);
  delete definitions.receive;
  assert.throws(() => notify(), /simplyflow-events:.*Missing action/);
  app.destroy();
});

test('invalid descriptors and asynchronous setup are refused', () => {
  const invalid = [
    null,
    { ...windowEvent(), action: '' },
    { ...windowEvent(), when: true },
    { ...windowEvent(), subscribe() { return () => {}; } },
    { ...windowEvent(), target: () => Promise.resolve(new EventTarget()) },
    { ...windowEvent(), when: () => Promise.resolve(true) },
    { action: 'receive', subscribe: () => Promise.resolve(() => {}) }
  ];
  for (const descriptor of invalid) {
    const { app } = createApp({ invalid: descriptor }, { receive() {} });
    const bindings = installEvents(app);
    assert.throws(() => bindings.start(), /simplyflow-events:/);
    app.destroy();
  }
  const { app } = createApp({ unknown: windowEvent('missing') });
  assert.throws(() => installEvents(app).start(), /Missing action/);
  app.destroy();
});

test('late initialization and repeated destruction cannot activate disposed bindings', async () => {
  let ready;
  let calls = 0;
  const { app, window } = createApp({ late: windowEvent() }, {
    receive() { calls += 1; }
  });
  const bindings = installEvents(app);
  const startup = new Promise((resolve) => { ready = resolve; })
    .then(() => bindings.start());
  app.destroy();
  ready();
  await startup;
  window.dispatchEvent(new Event('change'));
  assert.equal(calls, 0);
  assert.equal(bindings.destroyed, true);
  assert.throws(() => installEvents(app), /destroyed/);
});
