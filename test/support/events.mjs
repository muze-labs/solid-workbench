import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the exact experimental package in a disposable host, without exporting
// test-only APIs or changing the deployed application's dependency graph.
export async function checkEventBindings(page) {
  const source = await readFile(
    new URL('../../packages/simplyflow-events/src/index.mjs', import.meta.url),
    'utf8'
  );
  const moduleUrl = 'data:text/javascript;base64,' +
    Buffer.from(source).toString('base64');
  const result = await page.send('Runtime.evaluate', {
    expression: '(async () => { const { installEvents } = await import(' +
      JSON.stringify(moduleUrl) + '); return (' + checkInBrowser.toString() +
      ')(installEvents); })()',
    awaitPromise: true,
    returnByValue: true
  });
  assert.equal(result.exceptionDetails, undefined,
    JSON.stringify(result.exceptionDetails));
  assert.equal(result.result.value, true);
}

async function checkInBrowser(installEvents) {
  function check(condition, message) {
    if (!condition) {
      throw new Error('events-test: ' + message);
    }
  }
  const route = location.pathname.split('/').filter(Boolean).at(-1);
  const name = route === 'workbench' ? 'launcher' : route;
  const owner =
    globalThis['muzeSolid' + name[0].toUpperCase() + name.slice(1) + 'App'];
  const account = owner.runtime.host.view;
  check(account.events.swbAccountStorage.action === 'accountRemoved',
    'real account declarations composed');
  check(account.eventBindings && account.definition.overrides.events,
    'real account has installed bindings and exposed metadata');
  const metadata = account.definition.sources.accountLifecycle.events;
  const descriptor = Function(
    'return (' + metadata.swbAccountLaunchChange.source + ')'
  )();
  check(typeof descriptor.when === 'function', 'descriptor source reconstructs');
  check(descriptor.when.call(account) === account.runtime.acceptLaunch,
    'reconstructed predicate has explicit app context');

  const lifecycle = owner.components.lifecycle;
  if (name === 'launcher') {
    check(owner.events.swbWorkspacePageHide.action === 'attemptExit',
      'Workbench events composed');
    const original = lifecycle.actions.attemptExit;
    const beforeDraft = JSON.stringify(owner.runtime.store.collection.list());
    let calls = 0;
    try {
      owner.actions.attemptExit = function (event) {
        check(this === owner && event.type === 'pagehide',
          'Workbench event forwards current context');
        calls += 1;
      };
      owner.eventBindings.start();
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      check(calls === 1, 'Workbench event delivers once after repeated start');
    }
    finally {
      owner.actions.attemptExit = original;
    }
    check(JSON.stringify(owner.runtime.store.collection.list()) === beforeDraft,
      'Workbench data remains intact');
  }

  const element = document.createElement('section');
  document.body.append(element);
  const target = new EventTarget();
  let retained;
  let unsubscriptions = 0;
  let calls = [];
  const component = {
    events: {
      swbTestCustom: {
        target() { return this.runtime.source; },
        type: 'document-changed',
        action: 'receive'
      },
      swbTestLibrary: {
        action: 'receive',
        subscribe(notify) {
          retained = notify;
          return () => { unsubscriptions += 1; };
        }
      },
      swbTestConditional: {
        target: 'window', type: 'hashchange', action: 'receive',
        when() { return this.runtime.acceptLaunch; }
      }
    },
    actions: {
      receive(value) {
        check(this.runtime.source === target, 'custom action context');
        calls.push(['original', value]);
      }
    }
  };
  const view = owner.api.app({
    container: element,
    components: { swbTestEvents: component },
    events: { swbTestCustom: { type: 'resource-changed' } },
    runtime: { source: target, acceptLaunch: false },
    data: { draft: 'unsaved', nativeIdentity: 'urn:fixture:subject' }
  });
  const original = component.actions.receive;
  const bindings = installEvents(view);
  try {
    check(view.events.swbTestCustom.action === 'receive',
      'app override retains composed descriptor fields');
    bindings.start();
    bindings.start();
    const payload = { resource: 'urn:fixture:changed', unknown: ['keep'] };
    const event = new CustomEvent('resource-changed', { detail: payload });
    target.dispatchEvent(event);
    check(calls.length === 1 && calls[0][1].detail === payload,
      'custom event detail retains identity');
    const firstNotify = retained;
    view.actions.receive = function (value) {
      check(this === view, 'replacement context');
      calls.push(['replacement', value]);
      return value;
    };
    check(retained(payload) === payload, 'library arguments/result preserved');
    target.dispatchEvent(event);
    view.actions.receive = original;
    target.dispatchEvent(event);
    check(calls.map(([label]) => label).join(',') ===
      'original,replacement,replacement,original', 'replace/remove in place');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    check(calls.length === 4, 'false condition skips binding');
    bindings.stop();
    bindings.start();
    check(firstNotify(payload) === undefined, 'old subscription remains inert');
    view.destroy();
    bindings.start();
    target.dispatchEvent(event);
    retained(payload);
    check(calls.length === 4 && unsubscriptions === 2,
      'destroy disposes all registrations');
    check(view.data.draft === 'unsaved' &&
      view.data.nativeIdentity === 'urn:fixture:subject',
      'draft and native identity retained');
  }
  finally {
    view.destroy();
    element.remove();
  }

  const lateElement = document.createElement('section');
  document.body.append(lateElement);
  const late = owner.api.app({ container: lateElement, events: {
    swbTestLate: { target: () => target, type: 'late', action: 'receive' }
  }, actions: { receive() { throw new Error('events-test: stale delivery'); } } });
  const lateBindings = installEvents(late);
  const startup = Promise.resolve().then(() => lateBindings.start());
  late.destroy();
  await startup;
  target.dispatchEvent(new Event('late'));
  check(lateBindings.destroyed, 'late initialization cannot reactivate');
  lateElement.remove();
  return true;
}
