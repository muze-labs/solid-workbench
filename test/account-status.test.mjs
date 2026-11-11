import { preferences } from '../apps/preferences/src/components/preferences.mjs';
import { muzeSolidUiAccountPresenter } from '../packages/solid-app-ui/src/components/account-presenter.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { muzeSolidUiCapabilityDialog } from '../packages/solid-app-ui/src/components/capability-dialog.mjs';
import { contactSession } from '../apps/contacts/src/components/contact-session.mjs';
import { account } from '../packages/solid-app-ui/src/components/account.mjs';
import { sessionRecovery } from '../packages/solid-app-ui/src/components/session-recovery.mjs';
import { sessionServices } from '../packages/solid-app-ui/src/components/session-services.mjs';

function owner(t) {
  const values = new Map();
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true
  });
  t.after(() => {
    delete navigator.onLine;
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, 'localStorage', previous);
    }
    else {
      delete globalThis.localStorage;
    }
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  });
  const view = {
    data: { message: '', muzeSolidUiRecoveryVisibility: { hidden: '' } },
    runtime: { host: { selectedWebId: 'https://pod.example/#me' } },
    api: {},
    actions: {}
  };
  for (const [name, action] of Object.entries({
    ...account.actions,
    ...sessionRecovery.actions,
    ...sessionServices.actions
  })) {
    view.actions[name] = action.bind(view);
  }
  view.actions.muzeSolidUiCloseAccount = () => Promise.resolve();
  return view;
}

test('authentication feedback uses toolbar state and preserves other messages', (t) => {
  const view = owner(t);
  const error = new Error('Sign in again');
  error.code = 'sign_in_required';
  view.actions.message(error);
  assert.equal(view.data.message, '');
  view.actions.muzeSolidUiAuthenticationRestored();
  assert.equal(view.data.message, '');
  const conflict = new Error('Remote changes need review');
  conflict.code = 'document_conflict';
  view.actions.message(conflict);
  view.actions.muzeSolidUiAuthenticationRestored();
  assert.equal(view.data.message, conflict.message);
  view.actions.message(error);
  assert.equal(view.data.message, conflict.message);
  view.runtime.session = { disconnected: true };
  const disconnected = new Error('Disconnected');
  disconnected.code = 'disconnected';
  view.actions.message(disconnected);
  assert.equal(view.data.message, conflict.message);
  view.runtime.session.disconnected = false;
  view.actions.message(disconnected);
  assert.equal(view.data.message, disconnected.message,
    'A disconnected capability is still an actionable task error.');
  view.data.message = 'Unsynchronized local edits';
  view.actions.muzeSolidUiAuthenticationRestored();
  assert.equal(view.data.message, 'Unsynchronized local edits');
});

test('disconnection takes priority over credentials and recovery notices', (t) => {
  const view = owner(t);
  view.runtime.session = { disconnected: true, hasUsableAccessToken: true };
  view.data.muzeSolidUiRecoveryVisibility = { hidden: null };
  view.actions.muzeSolidUiAccountStatus();
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Disconnected');
  assert.match(
    view.data.muzeSolidUiStatusButton['aria-label'],
    /account controls/
  );
  view.runtime.session.disconnected = false;
  view.actions.muzeSolidUiAccountStatus();
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Sign in again');
  view.actions.muzeSolidUiAuthenticationRestored();
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Signed in');
  view.runtime.session.hasUsableAccessToken = false;
  view.actions.muzeSolidUiAccountStatus();
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Public access');
  view.runtime.session.hasStoredAuthorization = true;
  view.actions.muzeSolidUiAccountStatus();
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Session available');
});

test('failed workspace checkpoint prevents connecting another account', async (t) => {
  const view = owner(t);
  let connections = 0;
  view.api = { connectSession: async () => { connections += 1; } };
  view.runtime.host.beforeAccountLeave = async () => {
    throw new Error('fixture: app checkpoint failed');
  };
  const original = { webId: view.runtime.host.selectedWebId };
  view.runtime.session = original;
  view.data.webId = original.webId;
  assert.equal(await view.actions.connectAccount('https://other.example/#me'), false);
  assert.equal(connections, 0);
  assert.equal(view.runtime.session, original);
  assert.equal(view.data.webId, original.webId);
  assert.match(view.data.message, /checkpoint failed/);
});

test('late startup discovery cannot restore an account after logout', async (t) => {
  const view = owner(t);
  let finishDiscovery;
  let cancelled = false;
  view.api = {
    connectSession: () => new Promise((resolve) => { finishDiscovery = resolve; })
  };
  view.actions.muzeSolidDesignCloseDialog = () => Promise.resolve();
  const restoring = view.actions.restoreAccount(view.runtime.host.selectedWebId);
  view.actions.muzeSolidUiSignedOut();
  finishDiscovery({ cancelSignIn() { cancelled = true; } });
  await restoring;
  assert.equal(view.runtime.session, null);
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Not connected');
  assert.equal(cancelled, true);
});


test('disconnected Contacts reuses only its owner/workspace local dataset', (t) => {
  const view = owner(t);
  const host = view.runtime.host;
  host.preferences = {};
  host.workspaceContext = { id: 'one', settings: {} };
  host.session = {};
  host.resource = () => 'https://pod.example/one.ttl';
  const resource = () => contactSession.actions.swb_contactsResource.call(view);
  assert.equal(resource(), 'https://pod.example/one.ttl');
  host.workspaceContext.id = 'two';
  host.resource = () => 'https://pod.example/two.ttl';
  assert.equal(resource(), 'https://pod.example/two.ttl');
  host.session = null;
  host.resource = () => assert.fail('Disconnected discovery is unavailable');
  assert.equal(resource(), 'https://pod.example/two.ttl');
  host.workspaceContext.id = 'one';
  assert.equal(resource(), 'https://pod.example/one.ttl');
  host.selectedWebId = 'https://other.example/#me';
  assert.equal(resource(), 'contacts');
});


test('logout notifications preserve open sessions for another WebID', (t) => {
  const view = owner(t);
  const original = { webId: view.runtime.host.selectedWebId };
  view.runtime.session = original;
  let signedOut = 0;
  view.actions.muzeSolidUiSignedOut = () => { signedOut += 1; };
  view.actions.accountRemoved({ key: 'solid-apps.webId',
    oldValue: 'https://other.example/#me', newValue: null });
  view.actions.accountRemoved({ key: 'solid-apps.logout:https://other.example/#me',
    newValue: 'changed' });
  assert.equal(signedOut, 0);
  assert.equal(view.runtime.session, original);
  view.actions.accountRemoved({ key: 'solid-apps.logout:' + original.webId,
    newValue: 'changed' });
  assert.equal(signedOut, 1);
});

test('logging out preserves a different remembered identity', async (t) => {
  const view = owner(t);
  const other = 'https://other.example/#me';
  localStorage.setItem('solid-apps.webId', other);
  const cleared = [];
  view.api = { logoutAccount: (webId) => cleared.push(webId) };
  view.actions.muzeSolidDesignCloseDialog = () => Promise.resolve();
  await account.commands.logout.call(view);
  assert.deepEqual(cleared, [view.runtime.host.selectedWebId]);
  assert.equal(localStorage.getItem('solid-apps.webId'), other);
  assert(localStorage.getItem('solid-apps.logout:' + view.runtime.host.selectedWebId));
  assert.equal(localStorage.getItem('solid-apps.disconnected:' +
    view.runtime.host.selectedWebId), 'true');
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Not connected');
});


test('presentation fallback waits for real provider readiness before focus', (t) => {
  const view = owner(t);
  const messages = [];
  const frame = { inert: false, hidden: false,
    getAttribute: () => 'false' };
  view.container = { ownerDocument: { activeElement: {} } };
  view.api = { editPreferencesCapability: 'urn:preferences' };
  const call = {
    ticket: { id: 'current', key: 'private' },
    url: 'https://suite.example/preferences/',
    capability: 'urn:preferences',
    controller: new AbortController(),
    attached: true, presented: true, waitForPresentation: true,
    window: { postMessage: (message) => messages.push(message) }
  };
  view.runtime.muzeSolidUiCall = call;
  view.runtime.muzeSolidUiFrame = frame;
  view.runtime.muzeSolidUiDialog = { open: true };
  for (const [name, action] of Object.entries(muzeSolidUiCapabilityDialog.actions)) {
    view.actions[name] = action.bind(view);
  }
  view.actions.muzeSolidUiFocusPresentation();
  assert.equal(messages.length, 0, 'Visual fallback is not provider readiness.');
  const ready = { source: call.window, origin: 'https://suite.example',
    data: { type: 'solid-apps:presentation-ready', id: 'current' } };
  view.actions.muzeSolidUiAttachCapability(ready);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'current');
  view.actions.muzeSolidUiAttachCapability(ready);
  assert.equal(messages.length, 1, 'Readiness does not repeatedly steal focus.');
  call.focusRequested = false;
  view.container.ownerDocument.activeElement = frame;
  view.actions.muzeSolidUiFocusPresentation();
  assert.equal(messages.length, 1, 'Preserve focus after entering the provider.');
});

test('explicit sign-in reconciles auth feedback without a successful resource callback', async (t) => {
  const view = owner(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, 'window', previous);
    }
    else {
      delete globalThis.window;
    }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true, value: { open: () => ({ close() {} }) }
  });
  const error = new Error('Sign in again');
  error.code = 'sign_in_required';
  view.actions.message(error);
  view.runtime.session = { signIn: async () => {}, hasUsableAccessToken: true };
  view.runtime.preferences = { recover: async () => {} };
  view.runtime.root = { querySelector: () => ({}) };
  view.actions.muzeSolidDesignCloseDialog = async () => {};
  view.actions.notify = () => {};
  await sessionRecovery.commands.muzeSolidUiSignInAgain.call(view);
  assert.equal(view.data.message, '');
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Signed in');
  assert.equal(view.data.muzeSolidUiRecoveryVisibility.hidden, '');
});

// The privileged Account app controls its caller's session, not a second one.
function accountHost(t) {
  const view = owner(t);
  for (const [name, action] of Object.entries(
    muzeSolidUiAccountPresenter.actions
  )) {
    view.actions[name] = action.bind(view);
  }
  view.runtime.dialog = { open: true };
  view.runtime.settings = { theme: 'dark', textScale: '100',
    density: 'comfortable', language: 'en' };
  view.data.logoutVisibility = { hidden: null };
  view.data.webId = view.runtime.host.selectedWebId;
  view.runtime.accountPeer = { call: async () => null };
  return view;
}

test('account controls reject obsolete ports and changed owners', async (t) => {
  const view = accountHost(t);
  const request = view.actions.muzeSolidUiAccountRequest;
  await assert.rejects(request({}, 'logout', {
    owner: view.runtime.host.selectedWebId
  }), /no longer active/);
  await assert.rejects(request(view.runtime.accountPeer, 'logout', {
    owner: 'https://other.example/#me'
  }), /Account changed/);
  view.runtime.dialog.open = false;
  await assert.rejects(request(view.runtime.accountPeer, 'connect', {
    owner: view.runtime.host.selectedWebId
  }), /no longer active/);
});

test('Account snapshots contain cloneable display data and retain a WebID draft', async (t) => {
  const view = accountHost(t);
  view.data.logoutVisibility = new Proxy({ hidden: null }, {});
  view.runtime.settings = new Proxy(view.runtime.settings, {});
  await view.actions.muzeSolidUiAccountRequest(
    view.runtime.accountPeer, 'draft', 'https://incomplete.'
  );
  const state = structuredClone(view.actions.muzeSolidUiAccountSnapshot());
  assert.equal(state.webId, 'https://incomplete.');
  assert.equal(state.owner, view.runtime.host.selectedWebId);
  assert.deepEqual(Object.keys(state.settings),
    ['theme', 'textScale', 'density', 'language']);
  assert.equal(state.controls.hidden, null);
  assert(!('session' in state));
});

test('Account switches in a managed child request Workbench without replacing its session', async (t) => {
  const view = accountHost(t);
  const requests = [];
  const original = { webId: view.runtime.host.selectedWebId };
  view.runtime.session = original;
  view.runtime.host.managed = {
    peer: { call: async (...args) => requests.push(args) }
  };
  let closed = 0;
  view.runtime.accountPopup = { close() { closed += 1; } };
  view.api = { httpUrl: (value) => value };
  await view.actions.muzeSolidUiAccountRequest(
    view.runtime.accountPeer, 'connect', {
      owner: original.webId, webId: 'https://other.example/#me'
    }
  );
  assert.deepEqual(requests, [['account-controls', {}]]);
  assert.equal(view.runtime.session, original);
  assert.equal(closed, 1);
  assert.match(view.data.message, /Workbench/);
});

test('closing Account releases its popup and port without touching the active editor', async (t) => {
  const view = accountHost(t);
  const editor = { draft: 'incomplete preference', controller: {} };
  view.runtime.muzeSolidUiCall = editor;
  let closed = 0;
  view.runtime.accountPeer.close = () => { closed += 1; };
  view.runtime.accountActivePopup = { close() { closed += 1; } };
  view.actions.muzeSolidDesignCloseDialog = () => Promise.resolve();
  await view.actions.muzeSolidUiCloseAccount();
  assert.equal(closed, 2);
  assert.equal(view.runtime.accountPeer, null);
  assert.equal(view.runtime.muzeSolidUiCall, editor);
  assert.equal(view.data.muzeSolidUiAccountFrame.src, 'about:blank');
});

test('Account retains its focused frame until native dialog close completes', async (t) => {
  const view = accountHost(t);
  const current = { src: 'https://suite.example/account/', hidden: null };
  view.data.muzeSolidUiAccountFrame = current;
  view.runtime.accountPeer.close = () => {};
  let finish;
  view.actions.muzeSolidDesignCloseDialog = () => new Promise(resolve => {
    finish = resolve;
  });
  const closing = view.actions.muzeSolidUiCloseAccount();
  assert.equal(view.data.muzeSolidUiAccountFrame, current,
    'Unloading a focused iframe early prevents native focus restoration.');
  finish();
  await closing;
  assert.equal(view.data.muzeSolidUiAccountFrame.src, 'about:blank');
});

test('Account waits for visible bindings before its single focus request', (t) => {
  const view = accountHost(t);
  const calls = [];
  view.runtime.accountPeer.call = async (...args) => calls.push(args);
  view.runtime.accountPresented = true;
  view.runtime.accountFrame = { hidden: true };
  view.actions.muzeSolidUiFocusAccount();
  assert.equal(calls.length, 0);
  view.runtime.accountFrame.hidden = false;
  view.actions.muzeSolidUiFocusAccount();
  view.actions.muzeSolidUiFocusAccount();
  assert.deepEqual(calls, [['focus', null]]);
});

test('a coordinated reopen waits for previous native closure', async (t) => {
  const view = accountHost(t);
  view.runtime.accountPeer.close = () => {};
  view.runtime.accountUrl = 'https://suite.example/account/';
  const current = { src: view.runtime.accountUrl, hidden: null };
  view.data.muzeSolidUiAccountFrame = current;
  let finish;
  let opens = 0;
  view.actions.muzeSolidDesignCloseDialog = () => new Promise(resolve => {
    finish = resolve;
  });
  view.actions.muzeSolidDesignOpenDialog = () => { opens += 1; };
  const closing = view.actions.muzeSolidUiCloseAccount();
  const reopening = view.actions.muzeSolidUiOpenAccount();
  assert.equal(opens, 0);
  assert.equal(view.data.muzeSolidUiAccountFrame, current);
  finish();
  await closing;
  await reopening;
  clearTimeout(view.runtime.accountLoadTimer);
  assert.equal(opens, 1);
  assert.equal(view.data.muzeSolidUiAccountFrame.src, view.runtime.accountUrl);
});

test('only the configured Account frame can obtain its caller control port', (t) => {
  const view = accountHost(t);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', {
    configurable: true, value: { origin: 'https://suite.example' }
  });
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'location', descriptor);
    }
    else {
      delete globalThis.location;
    }
  });
  const trusted = {};
  view.runtime.accountUrl = 'https://suite.example/account/';
  view.runtime.accountFrame = {
    contentWindow: trusted, src: view.runtime.accountUrl
  };
  view.runtime.accountPeer = null;
  assert.equal(view.actions.muzeSolidUiAccountSource(trusted), true);
  const ready = { type: 'solid-apps:account-ready' };
  view.actions.muzeSolidUiAttachAccount({
    source: trusted, origin: 'https://external.example', data: ready
  });
  view.actions.muzeSolidUiAttachAccount({
    source: {}, origin: location.origin, data: ready
  });
  view.runtime.accountFrame.src = 'https://suite.example/preferences/';
  view.actions.muzeSolidUiAttachAccount({
    source: trusted, origin: location.origin, data: ready
  });
  assert.equal(view.runtime.accountPeer, null);
});

test('first Connect waits for authorization even when all initial reads are public', async (t) => {
  const view = owner(t);
  let authorize;
  const authorization = new Promise(resolve => { authorize = resolve; });
  let signIns = 0;
  let connected = 0;
  const session = {
    webId: view.runtime.host.selectedWebId,
    issuer: 'https://issuer.example/',
    hasUsableAccessToken: false,
    profile: {},
    async signIn() {
      signIns += 1;
      await authorization;
      this.hasUsableAccessToken = true;
    },
    async perform(operation) { return operation(); }
  };
  view.api = {
    connectSession: async () => session,
    readProfile: () => ({ name: 'Fixture' })
  };
  view.runtime.preferences = { reset() {}, async load() {} };
  view.runtime.host.onConnect = () => { connected += 1; };
  view.actions.notify = () => {};
  const connecting = view.actions.connectAccount(session.webId, {});
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(signIns, 1, 'Fresh Connect must explicitly request sign-in.');
    assert.equal(view.runtime.session, undefined,
      'A candidate session is not published before sign-in completes.');
    assert.equal(connected, 0);
    assert.equal(localStorage.getItem(
      'solid-apps.connected:' + session.webId
    ), null, 'Peers are not notified during authorization.');
  }
  finally {
    authorize();
    await connecting;
  }
  assert.equal(view.runtime.session, session);
  assert.equal(connected, 1);
  assert.equal(session.hasUsableAccessToken, true);
  assert(localStorage.getItem('solid-apps.connected:' + session.webId));
});

test('shared Connect restores the same owner once after a disconnected startup', async (t) => {
  const view = owner(t);
  const webId = view.runtime.host.selectedWebId;
  const draft = { name: 'Unfinished local edit' };
  view.runtime.editor = draft;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const owners = [];
  let reconciled = 0;
  view.actions.restoreAccount = async (owner) => {
    owners.push(owner);
    await pending;
    view.runtime.session = { webId: owner, hasUsableAccessToken: true };
  };
  view.actions.muzeSolidUiSharedAuthorization = () => { reconciled += 1; };
  const first = view.actions.accountRemoved({
    key: 'solid-apps.connected:' + webId, newValue: 'completed'
  });
  const second = view.actions.accountRemoved({
    key: 'solid-apps.connected:' + webId, newValue: 'completed-again'
  });
  assert.equal(first, second, 'Notifications join one restoration.');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(owners, [webId]);
  finish();
  await first;
  assert.equal(reconciled, 1);
  assert.equal(view.runtime.session.webId, webId);
  assert.equal(view.runtime.editor, draft);
});

test('shared restoration respects disconnection, other accounts and interactive attempts', async (t) => {
  const view = owner(t);
  let restores = 0;
  view.actions.restoreAccount = async () => { restores += 1; };
  const webId = view.runtime.host.selectedWebId;
  await view.actions.accountRemoved({
    key: 'solid-apps.disconnected:https://other.example/#me', newValue: null
  });
  await view.actions.accountRemoved({
    key: 'solid-apps.connected:https://other.example/#me'
  });
  localStorage.setItem('solid-apps.disconnected:' + webId, 'true');
  await view.actions.accountRemoved({
    key: 'solid-apps.connected:' + view.runtime.host.selectedWebId
  });
  localStorage.removeItem('solid-apps.disconnected:' + webId);
  view.runtime.connecting = true;
  await view.actions.accountRemoved({
    key: 'solid-apps.connected:' + view.runtime.host.selectedWebId
  });
  assert.equal(restores, 0);
  assert.equal(view.runtime.session, undefined);
});

test('logout invalidates a shared restoration still waiting for startup', async (t) => {
  const view = owner(t);
  let finishStartup;
  view.runtime.host.ready = new Promise(resolve => { finishStartup = resolve; });
  let restores = 0;
  view.actions.restoreAccount = async () => { restores += 1; };
  const restoring = view.actions.accountRemoved({
    key: 'solid-apps.connected:' + view.runtime.host.selectedWebId
  });
  view.actions.muzeSolidUiSignedOut();
  finishStartup();
  await restoring;
  assert.equal(restores, 0);
  assert.equal(view.runtime.session, null);
});

test('failed first authorization leaves the prior account and local draft intact', async (t) => {
  const view = owner(t);
  const previous = { webId: view.runtime.host.selectedWebId };
  const draft = { name: 'Retained' };
  view.runtime.session = previous;
  view.runtime.editor = draft;
  view.data.webId = previous.webId;
  view.api.connectSession = async () => ({
    async signIn() { throw new Error('fixture: authorization cancelled'); }
  });
  let connected = 0;
  view.runtime.host.onConnect = () => { connected += 1; };
  const result = await view.actions.connectAccount('https://other.example/#me', {});
  assert.equal(result, false);
  assert.equal(view.runtime.session, previous);
  assert.equal(view.runtime.editor, draft);
  assert.equal(view.data.webId, previous.webId);
  assert.equal(connected, 0);
});

test('raw OAuth hints cannot start a second session during authorization', async (t) => {
  const view = owner(t);
  let restores = 0;
  view.actions.restoreAccount = async () => { restores += 1; };
  const webId = view.runtime.host.selectedWebId;
  await view.actions.accountRemoved({ key: webId + ':access_token' });
  await view.actions.accountRemoved({
    key: 'solid-apps.disconnected:' + webId, newValue: null
  });
  assert.equal(restores, 0);
  await view.actions.accountRemoved({ key: 'solid-apps.connected:' + webId });
  assert.equal(restores, 1);
});

test('Connect completion also reconciles a retained live session', (t) => {
  const view = owner(t);
  view.runtime.session = { disconnected: false, hasUsableAccessToken: true };
  let reconciled = 0;
  view.actions.muzeSolidUiSharedAuthorization = () => { reconciled += 1; };
  view.actions.accountRemoved({
    key: 'solid-apps.connected:' + view.runtime.host.selectedWebId
  });
  assert.equal(reconciled, 1);
});


test('new authorization loss toasts once and retains the native retry dialog', (t) => {
  const view = owner(t);
  const notices = [];
  let opened = 0;
  view.actions.notify = (text) => notices.push(text);
  view.runtime.root = { querySelector: () => ({}) };
  view.actions.muzeSolidDesignOpenDialog = () => { opened += 1; };
  view.actions.muzeSolidUiAuthenticationRequired({ pending: false });
  view.actions.muzeSolidUiAuthenticationRequired({ pending: false });
  assert.equal(notices.length, 1);
  assert.equal(opened, 0);
  assert.equal(view.data.message, '');
  assert.equal(view.data.muzeSolidUiAccountStatus, 'Sign in again');
  view.actions.muzeSolidUiAuthenticationRequired({ pending: true });
  assert.equal(opened, 1);
  assert.equal(notices.length, 1);
  view.actions.muzeSolidUiAuthenticationRestored();
  view.actions.muzeSolidUiAuthenticationRequired({ pending: false });
  assert.equal(notices.length, 2);
});


test('disconnected Preferences keep local choices without a passive sync notice', async (t) => {
  const view = owner(t);
  view.runtime.settings = {
    synchronize: () => assert.fail('Disconnected settings must stay local')
  };
  for (const session of [null, {
    preferencesUrl: 'https://pod.example/preferences', disconnected: true
  }]) {
    view.runtime.host.session = session;
    view.data.swb_status = 'Synchronizing…';
    await preferences.actions.swb_synchronize.call(view);
    assert.equal(view.data.swb_status, '');
  }
});
