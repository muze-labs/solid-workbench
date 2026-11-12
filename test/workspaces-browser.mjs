import { checkAppIcons } from './support/app-icons.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome, formatBrowserException } from './support/chrome.mjs';

const records = new Map();
const writes = [];
const binaryTypes = new Map();
const testImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPQDZ0GAAHLARkOVeqpAAAAAElFTkSuQmCC',
  'base64'
);
await writeFile('/tmp/cycle100-background.png', testImage);
records.set('/fixture/custom-background.png', testImage);
binaryTypes.set('/fixture/custom-background.png', 'image/png');
let origin;
let version = 1;
let profileStatus = 200;
const server = http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url, origin).pathname;
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const contentType = request.headers['content-type'] || '';
      const body = contentType.startsWith('image/')
        ? Buffer.concat(chunks)
        : Buffer.concat(chunks).toString();
      if (contentType.startsWith('image/')) {
        binaryTypes.set(path, contentType);
      }
      writes.push({
        path,
        body,
        condition:
          request.headers['if-match'] || request.headers['if-none-match']
      });
      records.set(path, body);
      response.writeHead(201, { ETag: '"' + ++version + '"' }).end();
      return;
    }
    if (path === '/fixture/profile') {
      if (profileStatus !== 200) {
        response.writeHead(profileStatus).end();
        return;
      }
      response.setHeader('Content-Type', 'text/turtle');
      response.end(`<${origin}/fixture/profile#me>
        <http://xmlns.com/foaf/0.1/name> "Workspace fixture";
        <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/fixture/prefs>;
        <http://www.w3.org/ns/pim/space#storage> <${origin}/fixture/storage/>, <${origin}/fixture/second/>.`);
      return;
    }
    if (path === '/fixture/prefs') {
      response.writeHead(200, {
        'Content-Type': 'text/turtle',
        ETag: '"prefs"'
      });
      response.end(`<#solid-apps>
        <https://vocab.muze.nl/solid-apps#workspaceResource> <${origin}/fixture/workspace.ttl>;
        <https://vocab.muze.nl/solid-apps#launcherResource> <${origin}/fixture/shortcuts.ttl>;
        <https://vocab.muze.nl/solid-apps#contactsResource> <${origin}/fixture/contacts.ttl>.
        <#other> <https://example.test/unknown> "keep global preferences".`);
      return;
    }
    if (path === '/fixture/contacts.ttl') {
      response.writeHead(200, {
        'Content-Type': 'text/turtle',
        ETag: '"book"'
      });
      response.end(
        '<#person> a <http://www.w3.org/2006/vcard/ns#Individual>; <http://www.w3.org/2006/vcard/ns#fn> "Existing default book".'
      );
      return;
    }
    if (path.startsWith('/fixture/')) {
      const body = path.endsWith('/')
        ? `<${origin}${path}> a <http://www.w3.org/ns/ldp#BasicContainer>.`
        : records.get(path);
      if (body === undefined) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(200, {
          'Content-Type': binaryTypes.get(path) || 'text/turtle',
          ETag: '"' + version + '"'
        })
        .end(body);
      return;
    }
    if (path === '/seed') {
      response.end('<!doctype html><title>Seed</title>');
      return;
    }
    const file = new URL(
      '../www' + path + (path.endsWith('/') ? 'index.html' : ''),
      import.meta.url
    );
    const content = await readFile(file);
    const type = path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.svg')
          ? 'image/svg+xml'
          : path.endsWith('.ico')
            ? 'image/vnd.microsoft.icon'
            : path.endsWith('.png')
              ? 'image/png'
              : path.endsWith('.jpg')
            ? 'image/jpeg'
            : path.endsWith('.ttl')
              ? 'text/turtle'
              : 'text/html';
    response
      .writeHead(200, {
        'Content-Type': type,
        'Content-Encoding': 'gzip'
      })
      .end(gzipSync(content));
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const browser = await startChrome(origin + '/seed', { allowPopups: true });
const page = await browser.page();
let appPage;
async function run(code, embedded = false) {
  const expression = embedded
    ? 'document.querySelector("iframe").contentWindow.eval(' +
      JSON.stringify('(async()=>{' + code + '})()') +
      ')'
    : '(async()=>{' + code + '})()';
  const result = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(formatBrowserException(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(code, embedded = false) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (await run('return Boolean(' + code + ');', embedded)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'workspace Preferences timeout: ' +
      code +
      '\n' +
      (await run('return document.body.innerText;', embedded))
  );
}
async function click(selector, embedded = false) {
  await run(
    'for(const dialog of document.querySelectorAll("dialog[open]")){await Promise.all(dialog.getAnimations().map(a=>a.finished.catch(()=>{})));}'
  );
  const point = await run(
    'const d=' +
      (embedded
        ? 'document.querySelector("iframe").contentDocument'
        : 'document') +
      ';const e=d.querySelector(' +
      JSON.stringify(selector) +
      ');e.scrollIntoView({block:"center"});' +
      'const r=e.getBoundingClientRect();' +
      (embedded
        ? 'const f=document.querySelector("iframe").getBoundingClientRect();return {x:f.x+r.x+r.width/2,y:f.y+r.y+r.height/2};'
        : 'return {x:r.x+r.width/2,y:r.y+r.height/2};')
  );
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type,
      button: 'left',
      clickCount: 1,
      ...point
    });
  }
}
async function section(id) {
  const index = await run(
    'return swbPreferencesApp.data.swb_sections.findIndex(s=>s.id===' +
      JSON.stringify(id) +
      ');',
    true
  );
  await click(
    '.ds-navbar-nav li:nth-of-type(' + (index + 1) + ') button',
    true
  );
  await wait(
    '!document.querySelector(' +
      JSON.stringify('[data-simply-field="swb_panels.' + id + '"]') +
      ').hidden',
    true
  );
}
async function change(selector, value) {
  await wait(
    '[...document.querySelectorAll(' + JSON.stringify(selector) +
      ')].some(element=>element.getClientRects().length && !element.disabled)',
    true
  );
  await run(
    'const e=[...document.querySelectorAll(' +
      JSON.stringify(selector) +
      ')].find(e=>e.getClientRects().length);e.value=' +
      JSON.stringify(value) +
      ';e.dispatchEvent(new Event("change",{bubbles:true}));',
    true
  );
}
async function openPreferences() {
  await click('.swb-account-button');
  await click('[data-simply-command=preferences]');
  await wait(
    'document.querySelector("iframe").contentWindow.swbPreferencesApp?.runtime.directory'
  );
  await wait('swbPreferencesApp.runtime.request', true);
  await wait(
    'document.querySelector("iframe").getAttribute("aria-busy")==="false"'
  );
}
async function closePreferences() {
  await click('[aria-label="Close dialog"]');
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
}
try {
  await page.ready();
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  await run(
    'localStorage.setItem("solid-apps.webId",location.origin+"/fixture/profile#me");location.href="/workbench/";'
  );
  await wait(
    'window.solidLauncher?.ui.runtime.persistence?.snapshot.directory?.entries[0].seeded'
  );
  await wait('document.querySelectorAll(".swb-shortcut-list>li").length>=2');
  console.log(
    'Cold usable phone/home:',
    await run(
      'return {milliseconds:Math.round(performance.now()),requests:performance.getEntriesByType("resource").length+1,bytes:performance.getEntriesByType("navigation")[0].transferSize+performance.getEntriesByType("resource").reduce((n,r)=>n+r.transferSize,0)};'
    )
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await checkAppIcons(page, origin);
  const initial = await run(
    'return solidLauncher.ui.runtime.persistence.snapshot.directory.active;'
  );
  await openPreferences();
  assert.equal(
    await run('return !!document.querySelector(".preferences-dialog");'),
    false
  );
  await section('workspaces');
  await change('[name=swb_newWorkspace]', 'Private');
  await click('[data-simply-command=swb_createWorkspace]', true);
  await wait('swbPreferencesApp.runtime.directory.entries.length===2', true);
  const privateId = await run(
    'return swbPreferencesApp.runtime.directory.entries.find(e=>e.title==="Private").id;',
    true
  );
  await change('[data-simply-command=swb_chooseWorkspace]', privateId);
  await wait(
    'swbPreferencesApp.data.swb_workspaceId===' + JSON.stringify(privateId),
    true
  );
  assert.equal(
    await run(
      'return solidLauncher.ui.runtime.persistence.snapshot.directory.active;'
    ),
    initial
  );
  await change('[name=title]', 'Preferences');
  await wait(
    'solidLauncher.ui.runtime.persistence.snapshot.directory.entries.some(e=>e.title==="Preferences")'
  );
  await section('storage');
  await change('[name=filesRoot]', origin + '/fixture/private/');
  await wait(
    'solidLauncher.ui.runtime.persistence.snapshot.directory.entries.find(e=>e.id===' +
      JSON.stringify(privateId) +
      ').settings.filesRoot.endsWith("/private/")'
  );
  await section('background');
  await change('[name=swb_backgroundChoice]', 'bg6');
  await wait(
    '!document.querySelector(".muze-solid-design-list-preview").hidden',
    true
  );
  assert.equal(
    await run(
      'return solidLauncher.ui.runtime.persistence.snapshot.directory.active;'
    ),
    initial
  );
  assert.equal(
    await run('return !!solidLauncher.ui.data.swb_background.src;'),
    false,
    'Inactive background does not change the current home'
  );
  await closePreferences();
  await click('.swb-account-button');
  assert.equal(
    await run(
      `return document.querySelector('[aria-label="Switch to workspace: Preferences"] use').getAttribute('href');`
    ),
    '../assets/feather-icons.svg#layers'
  );
  assert.equal(
    await run(
      `return getComputedStyle(document.querySelector('[aria-label="Switch to workspace: Preferences"] svg')).verticalAlign;`
    ),
    'middle'
  );
  await click('[aria-label="Switch to workspace: Preferences"]');
  await wait(
    'window.solidLauncher?.ui.runtime.persistence.snapshot.directory.active===' +
      JSON.stringify(privateId)
  );
  await wait('!document.querySelector(".swb-launcher-background").hidden');
  await openPreferences();
  await section('workspaces');
  assert.equal(
    await run(
      'return document.querySelector("[data-simply-command=swb_deleteWorkspace]").disabled;',
      true
    ),
    true
  );
  await change('[data-simply-command=swb_chooseWorkspace]', 'default');
  assert.equal(
    await run(
      'return document.querySelector("[data-simply-command=swb_deleteWorkspace]").disabled;',
      true
    ),
    true
  );
  await change('[data-simply-command=swb_chooseWorkspace]', privateId);
  await section('background');
  const file = await page.send('DOM.getDocument', { depth: -1, pierce: true });
  const setFile = await page.send('Runtime.evaluate', {
    expression:
      'document.querySelector("iframe").contentDocument.querySelector("[name=swb_backgroundFile]")'
  });
  await page.send('DOM.setFileInputFiles', {
    objectId: setFile.result.objectId,
    files: ['/tmp/cycle100-background.png']
  });
  await wait(
    'solidLauncher.ui.runtime.persistence.snapshot.directory.entries.find(e=>e.id===' +
      JSON.stringify(privateId) +
      ').background.startsWith("urn:uuid:") || solidLauncher.ui.runtime.persistence.snapshot.directory.entries.find(e=>e.id===' +
      JSON.stringify(privateId) +
      ').background.includes(".png")'
  );
  await closePreferences();
  await wait('!solidLauncher.ui.runtime.persistence.dirty');
  assert(
    writes.some(
      (w) => String(w.path).includes('background') || w.condition === '*'
    )
  );
  await openPreferences();
  await section('appearance');
  await change('[name=theme]', 'light');
  await wait('document.body.classList.contains("ds-lightmode")');
  assert.deepEqual(
    await run(
      'const s=getComputedStyle(document.querySelector("h1"));return {color:s.color,shadow:s.textShadow};'
    ),
    { color: 'rgb(0, 0, 0)', shadow: 'none' }
  );
  await change('[name=theme]', 'dark');
  await wait('document.body.classList.contains("ds-darkmode")');
  assert.notEqual(
    await run(
      'return getComputedStyle(document.querySelector("h1")).textShadow;'
    ),
    'none'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await writeFile(
    '/tmp/cycle106-workspace-preferences-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await closePreferences();
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await loaded;
  await page.ready();
  await wait(
    'window.solidLauncher?.ui.runtime.persistence.snapshot.directory.active===' +
      JSON.stringify(privateId)
  );
  await wait('!document.querySelector(".swb-launcher-background").hidden');
  await openPreferences();
  await section('advanced');
  await click('[data-simply-command=swb_openDiagnostics]', true);
  await wait('document.querySelector(".swb-diagnostics").open');
  assert(
    writes.some(
      (w) => typeof w.body === 'string' && w.body.includes('directory')
    )
  );
  console.log(
    'PASS: contributed Workbench sections, inactive workspace/title/storage/background edits, protected deletion, icon menu disambiguation, switching, image upload/sync/reload, theme contrast, phone and diagnostics handoff.'
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
