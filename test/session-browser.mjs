import { waitForAccount, clickAccount, submitAccount } from './support/account-browser.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  generateKeyPairSync,
  sign,
  createHash,
  createPublicKey,
  verify
} from 'node:crypto';
import { startChrome } from './support/chrome.mjs';

// Disposable issuer/Pod. Tokens, state and edits never reach a real account.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
});
const codes = new Map();
const access = new Set(['cached']);
const refresh = new Set(['refresh']);
const calls = [];
let origin;
let tokenNumber = 0;
let version = 1;
let preferenceVersion = 1;
let tokenFailure = '';
let holdToken = false;
let releaseToken;
let tokenBarrier;
let denyWrites = false;
let publicPreferences = false;
let holdAuthorization = false;
let releaseAuthorization;
let profileName = 'Recovery fixture';
function json(response, data, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data));
}
function jwt(nonce) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = encode({
    iss: origin + '/',
    sub: 'fixture',
    webid: origin + '/fixture/profile#me',
    aud: 'fixture-client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...(nonce ? { nonce } : {})
  });
  const unsigned = encode({ alg: 'RS256', kid: 'fixture' }) + '.' + payload;
  return (
    unsigned +
    '.' +
    sign('sha256', Buffer.from(unsigned), privateKey).toString('base64url')
  );
}
function validProof(request) {
  try {
    const [header, payload, signature] = request.headers.dpop.split('.');
    const jwk = JSON.parse(Buffer.from(header, 'base64url')).jwk;
    const claims = JSON.parse(Buffer.from(payload, 'base64url'));
    return (
      claims.htu === origin + request.url &&
      claims.htm === request.method &&
      verify(
        'sha256',
        Buffer.from(header + '.' + payload),
        {
          key: createPublicKey({ key: jwk, format: 'jwk' }),
          dsaEncoding: 'ieee-p1363'
        },
        Buffer.from(signature, 'base64url')
      )
    );
  }
  catch {
    return false;
  }
}
const server = createServer(async (request, response) => {
  // Match the development server and keep OAuth responses/callback loads fresh.
  response.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(request.url, origin);
    const path = url.pathname;
    if (path === '/authorize') {
      calls.push({
        path,
        scope: url.searchParams.get('scope'),
        prompt: url.searchParams.get('prompt')
      });
      if (holdAuthorization) {
        await new Promise(resolve => { releaseAuthorization = resolve; });
      }
      const code = 'code-' + codes.size;
      codes.set(code, Object.fromEntries(url.searchParams));
      const redirect = new URL(url.searchParams.get('redirect_uri'));
      redirect.searchParams.set('code', code);
      redirect.searchParams.set('state', url.searchParams.get('state'));
      redirect.searchParams.set('iss', origin + '/');
      response.writeHead(302, { Location: redirect.href }).end();
      return;
    }
    if (path === '/jwks') {
      json(response, {
        keys: [
          {
            ...publicKey.export({ format: 'jwk' }),
            kid: 'fixture',
            alg: 'RS256',
            use: 'sig'
          }
        ]
      });
      return;
    }
    if (path === '/token') {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
      }
      const form = new URLSearchParams(body);
      const grant = form.get('grant_type');
      calls.push({ path, grant });
      if (holdToken) {
        // Concurrent exchanges must share one release barrier. Overwriting a
        // single resolver can leave an earlier cancelled request held forever.
        tokenBarrier ||= new Promise((resolve) => {
          releaseToken = resolve;
        });
        await tokenBarrier;
      }
      assert.ok(validProof(request), 'Token exchange has a valid DPoP proof.');
      if (tokenFailure) {
        json(response, { error: tokenFailure }, 503);
        return;
      }
      let nonce;
      if (grant === 'refresh_token') {
        if (!refresh.delete(form.get('refresh_token'))) {
          json(response, { error: 'invalid_grant' }, 400);
          return;
        }
      }
      else {
        const authorization = codes.get(form.get('code'));
        assert.ok(authorization, 'The code was issued by this provider.');
        const challenge = createHash('sha256')
          .update(form.get('code_verifier'))
          .digest('base64url');
        assert.equal(challenge, authorization.code_challenge);
        nonce = authorization.nonce;
        codes.delete(form.get('code'));
      }
      tokenNumber += 1;
      const token = 'access-' + tokenNumber;
      const nextRefresh = 'refresh-' + tokenNumber;
      access.add(token);
      refresh.add(nextRefresh);
      json(response, {
        access_token: token,
        token_type: 'DPoP',
        expires_in: 3600,
        refresh_token: nextRefresh,
        ...(nonce ? { id_token: jwt(nonce) } : {})
      });
      return;
    }
    if (path.startsWith('/fixture/')) {
      const authorized =
        access.has(request.headers.authorization?.slice(5)) &&
        validProof(request);
      calls.push({ path, method: request.method, authorized });
      if (path !== '/fixture/profile' || request.method !== 'GET') {
        if (!authorized && !(publicPreferences &&
            path === '/fixture/preferences' && request.method === 'GET')) {
          response.writeHead(401, { 'WWW-Authenticate': 'DPoP' }).end();
          return;
        }
        if (denyWrites && request.method === 'PUT') {
          response.writeHead(403).end();
          return;
        }
      }
      response.setHeader('Content-Type', 'text/turtle');
      const resourceVersion =
        path === '/fixture/profile' ? version : preferenceVersion;
      response.setHeader('ETag', '"' + resourceVersion + '"');
      if (request.method === 'PUT') {
        let body = '';
        for await (const chunk of request) {
          body += chunk;
        }
        calls.push({
          path,
          write: true,
          body,
          match: request.headers['if-match']
        });
        if (request.headers['if-match'] !== '"' + resourceVersion + '"') {
          response.writeHead(412).end();
          return;
        }
        profileName =
          body.match(/"(Retained draft|Second draft)"/)?.[1] || profileName;
        if (path === '/fixture/profile') {
          version += 1;
        }
        else {
          preferenceVersion += 1;
        }
        response.setHeader('ETag', '"' + (resourceVersion + 1) + '"');
        response.writeHead(205).end();
        return;
      }
      response.end(
        path === '/fixture/profile'
          ? `<${origin}/fixture/profile#me>
          <http://xmlns.com/foaf/0.1/name> "${profileName}";
          <http://www.w3.org/ns/solid/terms#oidcIssuer> <${origin}/>;
          <http://www.w3.org/ns/pim/space#storage> <${origin}/fixture/>;
          <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/fixture/preferences>;
          <https://example.org/unknown> "keep me".`
          : `<${origin}/fixture/preferences> <https://example.org/unknown> "keep preferences".`
      );
      return;
    }
    if (path === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    if (path === '/seed') {
      response.end('<!doctype html><title>Session fixture</title>');
      return;
    }
    const file = new URL(
      '../www' + path + (path.endsWith('/') ? 'index.html' : ''),
      import.meta.url
    );
    response.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.css')
          ? 'text/css'
          : path.endsWith('.svg')
            ? 'image/svg+xml'
            : 'text/html'
    );
    response.end(await readFile(file));
  }
  catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
let browser;
let page;
async function wait(predicate) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await page.evaluate(predicate)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    'session-browser: Timeout: ' +
      predicate +
      '\n' +
      (await page.evaluate(() => document.body.innerText)) +
      '\nFixture request trace: ' + JSON.stringify(calls.map(
        ({ path, grant, write, authorized }) => ({ path, grant, write, authorized })
      ))
  );
}
async function prefEvaluate(fn) {
  const script = '(' + fn.toString() + ')()';
  const result = await page.send('Runtime.evaluate', {
    expression:
      'document.querySelector("iframe").contentWindow.eval(' +
      JSON.stringify(script) +
      ')',
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}
async function waitPreferences(fn) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await prefEvaluate(fn)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'session Preferences timeout: ' +
      fn +
      '\n' +
      (await prefEvaluate(() => document.body.innerText))
  );
}
async function openPreferences() {
  await page.evaluate(() =>
    document.querySelector('[data-simply-command=preferences]').click()
  );
  await wait(
    () =>
      document.querySelector('iframe').contentWindow.swbPreferencesApp?.runtime
        .request
  );
}
async function closePreferences() {
  await page.evaluate(() =>
    solidProfile.host.view.actions.muzeSolidUiCheckCapabilityClose()
  );
  await wait(
    () => !document.querySelector('.muze-solid-ui-capability-dialog').open
  );
}
async function expire(refreshValue) {
  await page.send('Runtime.evaluate', {
    expression: `(() => {
    const site = location.origin + '/|' + location.origin + '/fixture/profile#me';
    localStorage.setItem(site + ':access_token', JSON.stringify({
      value: 'cached', type: 'DPoP', expires: '2000-01-01'
    }));
    localStorage.setItem(site + ':refresh_token', JSON.stringify(${JSON.stringify(refreshValue)}));
  })()`
  });
}
async function edit(name) {
  await page.evaluate(() =>
    document.querySelector('[data-simply-command="editProfile"]').click()
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
    const input = document.querySelector('textarea[name="name"]');
    input.value = ${JSON.stringify(name)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.swb-profile-card form').requestSubmit();
  })()`
  });
}
try {
  browser = await startChrome(origin + '/seed', { allowPopups: true });
  page = await browser.page();
  await page.ready();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.muzeSolidUiSessionFixtureMessages = [];
    const openWindow = window.open.bind(window);
    window.open = (...args) => {
      const popup = openWindow(...args);
      window.muzeSolidUiSessionFixturePopup = popup;
      return popup;
    };
    addEventListener('message', event => {
      window.muzeSolidUiSessionFixtureMessages.push({
        keys: Object.keys(event.data || {}),
        samePopup: event.source === window.muzeSolidUiSessionFixturePopup,
        origin: event.origin
      });
    });
  ` });
  await page.evaluate(() => {
    const issuer = location.origin + '/';
    const webId = location.origin + '/fixture/profile#me';
    localStorage.setItem('solid-apps.webId', webId);
    localStorage.setItem(
      'metro/oidc:' + issuer + ':openid_configuration',
      JSON.stringify({
        issuer,
        authorization_endpoint: issuer + 'authorize',
        token_endpoint: issuer + 'token',
        jwks_uri: issuer + 'jwks',
        scopes_supported: ['openid', 'webid', 'offline_access'],
        authorization_response_iss_parameter_supported: true
      })
    );
    localStorage.setItem(
      'metro/oidc:' + issuer + ':client_info',
      JSON.stringify({
        client_id: 'fixture-client',
        redirect_uris: [issuer + 'redirect.html'],
        token_endpoint_auth_method: 'none'
      })
    );
    location.href = '/profile/#' + new URLSearchParams({ webid: webId });
  });
  await wait(() => Boolean(window.solidProfile?.ui));
  await page.evaluate(() =>
    document.querySelector('[data-simply-command="mine"]').click()
  );
  await wait(() => !document.querySelector('.swb-profile-card').hidden);
  await wait(
    () =>
      !document.querySelector(
        '[data-simply-field="muzeSolidUiStatusButton"]'
      ).matches(':not([title="Sign in again"])')
  );
  assert.equal(
    calls.filter((call) => call.path === '/authorize').length,
    0,
    'Background restoration never opens authorization.'
  );

  // Initial protected-read failure retains an immediate local change. Explicit
  // Retry invokes the existing authentication recovery in the provider app.
  await openPreferences();
  await prefEvaluate(() =>
    swbPreferencesApp.actions.swb_applySetting('theme', 'dark')
  );
  await prefEvaluate(() => {
    swbPreferencesApp.actions.swb_synchronize({ interactive: true });
  });
  await waitPreferences(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await prefEvaluate(() =>
    document
      .querySelector('[data-simply-command=muzeSolidUiCancelSignIn]')
      .click()
  );
  await waitPreferences(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  assert.equal(
    await prefEvaluate(() => document.querySelector('[name=theme]').value),
    'dark'
  );
  await prefEvaluate(() => {
    swbPreferencesApp.actions.swb_synchronize({ interactive: true });
  });
  await waitPreferences(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await prefEvaluate(() =>
    document
      .querySelector(
        '.muze-solid-ui-recovery-dialog [data-simply-command=muzeSolidUiSignInAgain]'
      )
      .click()
  );
  await waitPreferences(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await waitPreferences(
    () => swbPreferencesApp.runtime.settings.pending().length === 0
  );
  const preferenceWrite = calls.find(
    (call) => call.write && call.path === '/fixture/preferences'
  );
  assert.ok(preferenceWrite?.body.includes('keep preferences'));
  assert.ok(preferenceWrite.body.includes('dark'));
  assert.equal(preferenceWrite.match, '"1"');
  assert.equal(preferenceVersion, 2);
  await closePreferences();
  await expire(null);
  await edit('Retained draft');
  await wait(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  assert.equal(
    calls.filter((call) => call.write && call.path === '/fixture/profile')
      .length,
    0
  );
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('.muze-solid-ui-recovery-dialog')
        .contains(document.activeElement)
    ),
    true
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await wait(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector('textarea[name="name"]').value
    ),
    'Retained draft'
  );
  await wait(() => !window.solidProfile.ui.runtime.profile.saving);
  await page.evaluate(() =>
    document.querySelector('.swb-profile-card form').requestSubmit()
  );
  await wait(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  // Cancellation after the popup returns must still stop the queued write.
  holdToken = true;
  await page.evaluate(() =>
    document
      .querySelector(
        '.muze-solid-ui-recovery-dialog [data-simply-command="muzeSolidUiSignInAgain"]'
      )
      .click()
  );
  for (let attempt = 0; !releaseToken && attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(releaseToken, 'The token exchange reached the controlled delay.');
  await page.evaluate(() =>
    document
      .querySelector(
        '.muze-solid-ui-recovery-dialog [data-simply-command="muzeSolidUiCancelSignIn"]'
      )
      .click()
  );
  holdToken = false;
  releaseToken();
  releaseToken = null;
  tokenBarrier = null;
  await wait(() => !window.solidProfile.ui.runtime.profile.saving);
  await wait(() => !document.querySelector(
    '.muze-solid-ui-recovery-dialog [data-simply-command="muzeSolidUiSignInAgain"]'
  ).disabled);
  await wait(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  assert.equal(
    calls.filter((call) => call.write && call.path === '/fixture/profile')
      .length,
    0,
    'A late token response cannot dispatch a cancelled write.'
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector('textarea[name="name"]').value
    ),
    'Retained draft'
  );
  await page.evaluate(() =>
    document.querySelector('.swb-profile-card form').requestSubmit()
  );
  await wait(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await page.evaluate(() =>
    document
      .querySelector(
        '.muze-solid-ui-recovery-dialog [data-simply-command="muzeSolidUiSignInAgain"]'
      )
      .click()
  );
  await wait(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await wait(() => document.querySelector('.swb-profile-card form').hidden);
  assert.equal(
    calls.filter((call) => call.write && call.path === '/fixture/profile')
      .length,
    1
  );
  const write = calls.find(
    (call) => call.write && call.path === '/fixture/profile'
  );
  assert.equal(write.match, '"1"');
  assert.ok(write.body.includes('keep me'));
  assert.equal(profileName, 'Retained draft');
  assert.equal(
    calls.find((call) => call.path === '/authorize').prompt,
    'consent'
  );
  assert.ok(
    calls
      .find((call) => call.path === '/authorize')
      .scope.includes('offline_access')
  );

  // Expired access with a valid refresh rotates tokens without interaction.
  await expire({ value: 'refresh-' + tokenNumber });
  const authorizations = calls.filter(
    (call) => call.path === '/authorize'
  ).length;
  await page.evaluate(() =>
    window.solidProfile.host.session.perform(() =>
      window.solidProfile.host.session.client.get(
        location.origin + '/fixture/preferences'
      )
    )
  );
  assert.equal(
    calls.filter((call) => call.path === '/authorize').length,
    authorizations
  );
  assert.equal(
    calls.filter((call) => call.grant === 'refresh_token').length,
    1
  );

  // A rejected refresh restarts only the pending conditional write.
  await expire({ value: 'revoked' });
  await edit('Second draft');
  await wait(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await page.evaluate(() =>
    document
      .querySelector(
        '.muze-solid-ui-recovery-dialog [data-simply-command="muzeSolidUiSignInAgain"]'
      )
      .click()
  );
  await wait(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await wait(() => document.querySelector('.swb-profile-card form').hidden);
  assert.equal(
    calls.filter((call) => call.write && call.path === '/fixture/profile')
      .length,
    2
  );
  assert.equal(
    calls.filter((call) => call.write && call.path === '/fixture/profile')[1]
      .match,
    '"2"'
  );

  // Provider outage and real denial must not turn into another login loop.
  tokenFailure = 'temporarily_unavailable';
  await expire({ value: 'refresh-' + tokenNumber });
  const beforeFailure = calls.filter(
    (call) => call.path === '/authorize'
  ).length;
  const error = await page.evaluate(async () => {
    try {
      await window.solidProfile.host.session.perform(() =>
        window.solidProfile.host.session.client.get(
          location.origin + '/fixture/preferences'
        )
      );
    }
    catch (error) {
      return error.message;
    }
  });
  assert.ok(error.includes('503'));
  assert.equal(
    calls.filter((call) => call.path === '/authorize').length,
    beforeFailure
  );
  tokenFailure = '';
  await page.evaluate(() => {
    const site =
      location.origin + '/|' + location.origin + '/fixture/profile#me';
    localStorage.setItem(
      site + ':access_token',
      JSON.stringify({ value: 'cached', type: 'DPoP' })
    );
  });
  // Cancelling sign-in does not discard immediate choices; closing and
  // reconnecting the caller uses the same durable native settings cache.
  await openPreferences();
  await prefEvaluate(() =>
    swbPreferencesApp.actions.swb_applySetting('theme', 'system')
  );
  await expire(null);
  await prefEvaluate(() => {
    swbPreferencesApp.actions.swb_synchronize({ interactive: true });
  });
  await waitPreferences(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await prefEvaluate(() =>
    document
      .querySelector('[data-simply-command=muzeSolidUiCancelSignIn]')
      .click()
  );
  await waitPreferences(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  assert.equal(
    await prefEvaluate(() => document.querySelector('[name=theme]').value),
    'system'
  );
  await closePreferences();
  await page.evaluate(() =>
    document
      .querySelector('[data-simply-command=muzeSolidUiSignInAgain]')
      .click()
  );
  await wait(
    () =>
      document.querySelector(
        '[data-simply-field=muzeSolidUiStatusButton]'
      ).matches(':not([title="Sign in again"])')
  );
  await openPreferences();
  assert.equal(
    await prefEvaluate(() => document.querySelector('[name=theme]').value),
    'system'
  );
  await closePreferences();
  const beforeDenial = calls.filter(
    (call) => call.path === '/authorize'
  ).length;
  denyWrites = true;
  await edit('Second draft');
  await wait(() =>
    document.querySelector('.swb-profile-card').textContent.includes('403')
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.muze-solid-ui-recovery-dialog').open
    ),
    false
  );
  assert.equal(
    calls.filter((call) => call.path === '/authorize').length,
    beforeDenial
  );

  // The same-origin embedded app uses the same expired session and can recover
  // through its own contextual action, without reloading the parent draft.
  await expire(null);
  await page.evaluate(async () => {
    const session = window.solidProfile.host.session;
    try {
      await session.perform(
        () => session.client.get(location.origin + '/fixture/preferences'),
        { interactive: false }
      );
    }
    catch (error) {
      if (error.code !== 'sign_in_required') {
        throw error;
      }
    }
  });
  await wait(
    () =>
      !document.querySelector(
        '[data-simply-field="muzeSolidUiStatusButton"]'
      ).matches(':not([title="Sign in again"])')
  );
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'session-fixture-frame';
    frame.src = '/profile/?solid-apps-task';
    document.body.append(frame);
  });
  await wait(() =>
    Boolean(
      document.querySelector('#session-fixture-frame').contentWindow
        .solidProfile
    )
  );
  await wait(
    () =>
      !document
        .querySelector('#session-fixture-frame')
        .contentDocument.querySelector(
          '[data-simply-field="muzeSolidUiStatusButton"]'
        ).matches(':not([title="Sign in again"])')
  );
  assert.equal(
    await page.evaluate(() => document
      .querySelector('#session-fixture-frame')
      .contentDocument.querySelector('.muze-solid-ui-recovery-notice')),
    null,
    'Connection state uses the toolbar without a second banner in the dialog.'
  );
  await page.evaluate(() =>
    document
      .querySelector('#session-fixture-frame')
      .contentDocument.querySelector(
        '[data-simply-command="muzeSolidUiSignInAgain"]'
      )
      .click()
  );
  await wait(
    () =>
      document
        .querySelector('#session-fixture-frame')
        .contentDocument.querySelector(
          '[data-simply-field="muzeSolidUiStatusButton"]'
        ).matches(':not([title="Sign in again"])')
  );
  await wait(
    () =>
      document.querySelector(
        '[data-simply-field="muzeSolidUiStatusButton"]'
      ).matches(':not([title="Sign in again"])')
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector('textarea[name="name"]').value
    ),
    'Second draft'
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('#session-fixture-frame').contentWindow
          .solidProfile.host.session.webId ===
        window.solidProfile.host.session.webId
    ),
    true
  );
  // Shared credentials can also release a request already waiting for sign-in.
  denyWrites = false;
  await expire(null);
  const writesBeforeShared = calls.filter(
    (call) => call.write && call.path === '/fixture/profile'
  ).length;
  await page.evaluate(() =>
    document.querySelector('.swb-profile-card form').requestSubmit()
  );
  await wait(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await page.evaluate(async () => {
    const session = document.querySelector('#session-fixture-frame')
      .contentWindow.solidProfile.host.session;
    try {
      await session.perform(
        () => session.client.get(location.origin + '/fixture/preferences'),
        { interactive: false }
      );
    }
    catch (error) {
      if (error.code !== 'sign_in_required') {
        throw error;
      }
    }
  });
  await page.evaluate(() =>
    document
      .querySelector('#session-fixture-frame')
      .contentDocument.querySelector(
        '[data-simply-command="muzeSolidUiSignInAgain"]'
      )
      .click()
  );
  await wait(
    () => !document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await wait(() => document.querySelector('.swb-profile-card form').hidden);
  assert.equal(
    calls.filter((call) => call.write && call.path === '/fixture/profile')
      .length,
    writesBeforeShared + 1
  );

  // Renewed authorization must not waive a conflicting Pod version.
  version += 1;
  const remoteVersion = version;
  await expire(null);
  await edit('Second draft');
  await wait(
    () => document.querySelector('.muze-solid-ui-recovery-dialog').open
  );
  await page.evaluate(() =>
    document
      .querySelector(
        '.muze-solid-ui-recovery-dialog [data-simply-command="muzeSolidUiSignInAgain"]'
      )
      .click()
  );
  await wait(() =>
    document
      .querySelector('.swb-profile-card')
      .textContent.includes('changed elsewhere')
  );
  assert.equal(version, remoteVersion);
  assert.equal(
    await page.evaluate(
      () => document.querySelector('textarea[name="name"]').value
    ),
    'Second draft'
  );
  // Disconnect keeps credentials/drafts but gates both the current and sibling
  // transports before a request can reach the fixture Pod.
  await page.evaluate(() => solidProfile.host.view.commands.call('connectDialog'));
  await waitForAccount(page);
  await clickAccount(page, '[data-simply-command=swb_accountDisconnect]');
  await wait(
    () =>
      document.querySelector('#session-fixture-frame').contentWindow
        .solidProfile.host.view.data.muzeSolidUiAccountStatus === 'Disconnected'
  );
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'disconnected-workbench-frame';
    frame.hidden = true;
    frame.src = '/workbench/';
    document.body.append(frame);
  });
  await wait(() => document.querySelector('#disconnected-workbench-frame')
    .contentWindow.solidLauncher?.ui.runtime.persistence);
  assert.equal(await page.evaluate(() => document.querySelector(
    '#disconnected-workbench-frame'
  ).contentWindow.solidLauncher.host.session), null,
  'Disconnected Workbench starts without a live session for its selected WebID.');
  const beforeDisconnect = calls.length;
  const disconnected = await page.evaluate(async () => {
    const sibling = document.querySelector('#session-fixture-frame')
      .contentWindow.solidProfile.host;
    const codes = [];
    for (const host of [solidProfile.host, sibling]) {
      try {
        await host.session.client.get(location.origin + '/fixture/profile');
      }
      catch (error) {
        codes.push(error.code);
      }
    }
    return {
      codes,
      token: solidProfile.host.session.hasUsableAccessToken,
      draft: document.querySelector('textarea[name="name"]').value
    };
  });
  assert.deepEqual(disconnected.codes, ['disconnected', 'disconnected']);
  assert.equal(disconnected.token, true);
  assert.equal(disconnected.draft, 'Second draft');
  assert.equal(calls.length, beforeDisconnect);
  const beforeAccountSignIn = calls.filter(call => call.path === '/authorize').length;
  const beforeAccountWrites = calls.filter(call => call.write).length;
  await expire(null);
  await submitAccount(page, { webId: origin + '/fixture/profile#me' });
  await wait(() => !document.querySelector('.connect-dialog').open &&
    solidProfile.host.session.hasUsableAccessToken);
  await wait(() => document.querySelector('#disconnected-workbench-frame')
    .contentWindow.solidLauncher.host.view.data.muzeSolidUiAccountStatus ===
      'Signed in');
  assert.equal(await page.evaluate(() => document.querySelector(
    '#disconnected-workbench-frame'
  ).contentWindow.solidLauncher.host.selectedWebId),
  origin + '/fixture/profile#me');
  assert.equal(calls.filter(call => call.path === '/authorize').length,
    beforeAccountSignIn + 1,
    'Account Connect uses one issuer flow through the caller’s live session.');
  assert.equal(calls.filter(call => call.write).length, beforeAccountWrites,
    'Account sign-in does not replay a conflicting profile write.');
  assert.equal(await page.evaluate(() => document.querySelector(
    'textarea[name="name"]'
  ).value), 'Second draft', 'Account Connect retains the open profile draft.');
  // A fresh app with public startup reads still owns an explicit sign-in.
  publicPreferences = true;
  holdAuthorization = true;
  await page.evaluate(() => {
    document.querySelector('#disconnected-workbench-frame').remove();
    document.querySelector('#session-fixture-frame').remove();
    localStorage.removeItem('solid-apps.webId');
    location.href = '/profile/';
  });
  await wait(() => globalThis.solidProfile && !solidProfile.host.session);
  await expire(null);
  const beforeFreshAuthorization = calls.filter(call => call.path === '/authorize').length;
  await page.evaluate(() => solidProfile.host.view.commands.call('connectDialog'));
  await submitAccount(page, { webId: origin + '/fixture/profile#me' });
  await wait(() => window.muzeSolidUiSessionFixturePopup &&
    !window.muzeSolidUiSessionFixturePopup.closed);
  for (let attempt = 0; attempt < 150 && !releaseAuthorization; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert(releaseAuthorization, 'First Connect reaches the issuer even with public initial reads.');
  assert.equal(await page.evaluate(() => Boolean(
    solidProfile.host.session
  )), false, 'Fresh candidate is not published while authorization is pending.');
  assert.equal(await page.evaluate(() =>
    window.muzeSolidUiSessionFixturePopup.closed
  ), false, 'The first authorization popup remains open until the issuer responds.');
  holdAuthorization = false;
  releaseAuthorization();
  await wait(() => solidProfile.host.session?.hasUsableAccessToken &&
    !document.querySelector('.connect-dialog').open);
  assert.equal(calls.filter(call => call.path === '/authorize').length,
    beforeFreshAuthorization + 1);
  console.log(
    'Session browser: refresh, recovery, cancel, conditional writes, preservation, first Connect and disconnected Workbench restoration passed.'
  );
}

catch (error) {
  const targets = (await page.send('Target.getTargets')).targetInfos
    .filter(target => target.type === 'page');
  const diagnostic = [];
  for (const target of targets) {
    const targetPage = await browser.page(target.targetId);
    const logEntry = targetPage.once('Log.entryAdded');
    await targetPage.send('Log.enable');
    const log = await Promise.race([logEntry,
      new Promise(resolve => setTimeout(() => resolve(null), 200))]);
    if (log) {
      console.error('Session browser resource error:', log.entry?.text);
    }
    diagnostic.push(await targetPage.evaluate(async () => ({
      path: location.pathname,
      ready: document.readyState,
      codePresent: new URL(location.href).searchParams.has('code'),
      moduleResult: location.pathname === '/redirect.html'
        ? await Promise.race([
          import('/assets/redirect.min.js').then(() => 'loaded', error => String(error)),
          new Promise(resolve => setTimeout(() => resolve('pending'), 500))
        ]) : undefined,
      messages: window.muzeSolidUiSessionFixtureMessages,
      resources: performance.getEntriesByType('resource').map(entry => ({
        path: new URL(entry.name).pathname,
        bytes: entry.transferSize,
        decoded: entry.decodedBodySize,
        status: entry.responseStatus,
        duration: entry.duration
      })),
      text: document.body?.innerText,
      openerPath: (() => {
        try { return window.opener?.location.pathname || ''; }
        catch { return 'different origin'; }
      })()
    })).catch(failure => ({ error: failure.message })));
    if (target.targetId !== targets.find(item => item.url.endsWith('/profile/'))?.targetId) {
      targetPage.close();
    }
  }
  console.error('Session target diagnostics:', JSON.stringify(diagnostic));
  throw error;
}
finally {
  releaseAuthorization?.();
  releaseToken?.();
  page?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
