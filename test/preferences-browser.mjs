import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { startChrome } from './support/chrome.mjs';
import {
  StateGraph,
  named,
  literal
} from '../packages/solid-app-data/src/state-rdf.mjs';

let origin;
let body = '';
let version = 1;
let readStatus = 200;
let getValidator = true;
const writes = [];
const namespace = 'https://vocab.muze.nl/solid-apps#';
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, origin).pathname;
    if (path === '/fixture/profile') {
      response.setHeader('Content-Type', 'text/turtle');
      response.end(`<${origin}/fixture/profile#me>
        <http://xmlns.com/foaf/0.1/name> "Preferences fixture";
        <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/fixture/prefs>;
        <http://www.w3.org/ns/pim/space#storage> <${origin}/fixture/storage/>.`);
      return;
    }
    if (path === '/fixture/prefs') {
      if (request.method === 'PUT') {
        let source = '';
        for await (const chunk of request) {
          source += chunk;
        }
        if (request.headers['if-match'] !== '"' + version + '"') {
          response.writeHead(412).end();
          return;
        }
        writes.push({ source, etag: request.headers['if-match'] });
        body = source;
        version += 1;
        // Reproduce the reported provider pattern: acknowledged PUT without ETag.
        response.writeHead(205).end();
        return;
      }
      if (readStatus !== 200) {
        response.writeHead(readStatus).end();
        return;
      }
      response.setHeader('Content-Type', 'text/turtle');
      if (getValidator) {
        response.setHeader('ETag', '"' + version + '"');
      }
      response.end(body);
      return;
    }
    if (path === '/seed') {
      response.end('<!doctype html><title>Preferences fixture</title>');
      return;
    }
    if (path === '/favicon.ico') {
      response.writeHead(204).end();
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
          : 'text/html';
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Encoding': 'gzip'
    });
    response.end(gzipSync(content));
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404).end();
      return;
    }
    console.error(error);
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
body = `<${origin}/fixture/prefs#solid-apps> <${namespace}theme> "system".
  <#other> <https://example.org/unknown> "keep".`;
let browser;
let page;
async function run(code, embedded = false) {
  const expression = embedded
    ? 'document.querySelector(".muze-solid-ui-capability-frame").contentWindow.eval(' +
      JSON.stringify('(async()=>{' + code + '})()') +
      ')'
    : '(async()=>{' + code + '})()';
  const result = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
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
    'preferences-browser: Timeout: ' +
      code +
      '\n' +
      (await run('return document.body.innerText;', embedded))
  );
}
async function change(key, value) {
  await run(
    'const input=document.querySelector("[name=' +
      key +
      ']");' +
      'input.value=' +
      JSON.stringify(value) +
      ';' +
      'input.dispatchEvent(new Event("change",{bubbles:true}));',
    true
  );
}
async function selectedSection(id) {
  await wait(
    `(() => {
    const list = document.querySelector('[data-muze-solid-design-sections]');
    const tabStops = list.querySelectorAll('button[tabindex="0"]');
    const selected = list.querySelectorAll('[aria-current="page"]');
    const panel = document.querySelector(
      '[data-simply-field="swb_panels.${id}"]'
    );
    return tabStops.length === 1 && selected.length === 1 &&
      selected[0].dataset.muzeSolidDesignSection === ${JSON.stringify(id)} &&
      !panel.hidden;
  })()`,
    true
  );
}
async function key(key, modifiers = 0) {
  const codes = { ArrowDown: 40, ArrowUp: 38, Enter: 13, Tab: 9 };
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: codes[key],
      modifiers,
      ...(key === 'Enter' && type === 'keyDown' ? { text: '\r' } : {})
    });
  }
}
function remoteChange(theme, density) {
  const graph = new StateGraph(body, origin + '/fixture/prefs');
  const subject = named(origin + '/fixture/prefs#solid-apps');
  graph.set(subject, namespace + 'theme', literal(theme));
  graph.set(subject, namespace + 'density', literal(density));
  body = graph.write();
  version += 1;
}
async function openPreferences() {
  await run(
    'document.querySelector("[data-simply-command=preferences]").click();'
  );
  await wait(
    'document.querySelector("iframe").contentWindow.swbPreferencesApp'
  );
  await wait(
    'swbPreferencesApp.runtime.request && swbPreferencesApp.data.swb_sections.some(s=>s.id==="contacts-storage")',
    true
  );
  await wait(
    'document.querySelector("iframe").getAttribute("aria-busy")==="false"'
  );
}
try {
  browser = await startChrome(origin + '/seed');
  page = await browser.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await run(
    'localStorage.setItem("solid-apps.webId",location.origin+"/fixture/profile#me"); location.href="/contacts/";'
  );
  await wait('window.solidContacts?.host.session');
  await run('await solidContacts.host.ready;');
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  const firstOpen = await run('return performance.now();');
  await openPreferences();
  await wait(
    'document.activeElement.dataset.muzeSolidDesignSection==="appearance"',
    true
  );
  // No setup click/focus: arrows must work as soon as Preferences opens.
  await key('ArrowDown');
  await wait(
    'document.activeElement.dataset.muzeSolidDesignSection==="language"',
    true
  );
  assert.equal(
    await run('return swbPreferencesApp.runtime.section;', true),
    'appearance'
  );
  await key('ArrowUp');
  await wait(
    'document.activeElement.dataset.muzeSolidDesignSection==="appearance"',
    true
  );
  const firstOpenCost = await run(
    `const n=performance.getEntriesByType('navigation')[0];const r=performance.getEntriesByType('resource');return {bytes:n.transferSize+r.reduce((sum,e)=>sum+e.transferSize,0),requests:r.length+1,zeroTransferResources:r.filter(e=>e.transferSize===0).length};`,
    true
  );
  firstOpenCost.milliseconds = Math.round(
    (await run('return performance.now();')) - firstOpen
  );
  console.log(
    'First usable Preferences from already-open Contacts, 50 KiB/s down, 25 KiB/s up, 150ms latency:',
    firstOpenCost
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  assert.deepEqual(
    await run('return swbPreferencesApp.data.swb_sections.map(s=>s.id);', true),
    ['appearance', 'language', 'opening', 'providers', 'contacts-storage']
  );
  assert.equal(
    await run('return !!document.querySelector(".preferences-dialog");'),
    false
  );
  await wait(
    'document.querySelector(".muze-solid-ui-capability-loading").hidden'
  );
  await writeFile(
    '/tmp/cycle106-preferences-desktop.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await change('theme', 'light');
  await wait(
    'swbPreferencesApp.runtime.settings.settings().theme==="light" && !swbPreferencesApp.runtime.localSaving',
    true
  );
  await wait(
    'swbPreferencesApp.data.swb_status.includes("synchronized")',
    true
  );
  await wait('document.body.classList.contains("ds-lightmode")');
  await wait('swbPreferencesApp.runtime.settings.pending().length===0', true);
  assert.equal(writes.length, 1);
  await change('theme', 'dark');
  await wait(
    'swbPreferencesApp.runtime.settings.settings().theme==="dark" && !swbPreferencesApp.runtime.localSaving',
    true
  );
  await wait(
    'swbPreferencesApp.data.swb_status.includes("synchronized")',
    true
  );
  assert.deepEqual(
    writes.map((w) => w.etag),
    ['"1"', '"2"']
  );
  assert(body.includes('keep'));
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await change('theme', 'light');
  await wait(
    'swbPreferencesApp.runtime.settings.settings().theme==="light"',
    true
  );
  await wait('document.body.classList.contains("ds-lightmode")');
  assert.equal(writes.length, 2);
  await run('swbPreferencesApp.actions.swb_selectSection("language");', true);
  await run(
    'const input=document.querySelector("[name=language]");input.value="unfinished!";input.dispatchEvent(new Event("input",{bubbles:true}));',
    true
  );
  await wait(
    'swbPreferencesApp.runtime.settings.drafts().language==="unfinished!"',
    true
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await run(
    'await solidContacts.host.view.actions.muzeSolidUiCheckCapabilityClose();'
  );
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  await openPreferences();
  await wait(
    'swbPreferencesApp.runtime.settings.settings().theme==="light"',
    true
  );
  assert.equal(
    await run('return swbPreferencesApp.data.language;', true),
    'unfinished!'
  );
  await wait(
    'swbPreferencesApp.data.swb_status.includes("synchronized")',
    true
  );
  remoteChange('dark', 'compact');
  readStatus = 503;
  await change('theme', 'system');
  await wait('swbPreferencesApp.data.swb_status.includes("retained")', true);
  readStatus = 200;
  await run('await swbPreferencesApp.actions.swb_synchronize();', true);
  assert.equal(
    await run('return swbPreferencesApp.data.swb_conflicts.length;', true),
    1
  );
  assert.equal(writes.length, 3);
  await run(
    'await swbPreferencesApp.actions.swb_resolveConflict("theme",true);',
    true
  );
  assert.equal(writes.length, 4);
  assert(body.includes('compact') && body.includes('keep'));
  getValidator = false;
  await change('theme', 'light');
  await wait(
    'swbPreferencesApp.data.swb_status.includes("version information")',
    true
  );
  assert.equal(writes.length, 4);
  getValidator = true;
  await run('await swbPreferencesApp.actions.swb_synchronize();', true);
  await wait(
    'swbPreferencesApp.data.swb_status.includes("synchronized")',
    true
  );
  for (const viewport of [
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }
  ]) {
    await page.send('Emulation.setDeviceMetricsOverride', viewport);
    await run(
      'swbPreferencesApp.actions.swb_selectSection("appearance");',
      true
    );
    await wait(
      'document.querySelector("[data-muze-solid-design-section=appearance]").getAttribute("aria-current")==="page"',
      true
    );
    await run(
      'document.querySelector("[data-muze-solid-design-section=appearance]").focus();',
      true
    );
    await wait(
      `document.querySelectorAll('[data-muze-solid-design-sections] button[tabindex="0"]').length===1 && document.querySelector('[data-muze-solid-design-section="appearance"]').tabIndex===0`,
      true
    );
    assert.deepEqual(
      await run(
        'return [...document.querySelectorAll("[data-muze-solid-design-sections] button")].map(b=>b.tabIndex);',
        true
      ),
      [0, -1, -1, -1, -1]
    );
    await key('ArrowDown');
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="language"',
      true
    );
    assert.equal(
      await run('return swbPreferencesApp.runtime.section;', true),
      'appearance'
    );
    await key('ArrowDown');
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="opening"',
      true
    );
    await key('ArrowUp');
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="language"',
      true
    );
    await run('window.swbFocusedSection=document.activeElement;', true);
    await key('Enter');
    await selectedSection('language');
    assert.equal(
      await run(
        'return document.activeElement===window.swbFocusedSection;',
        true
      ),
      true,
      'Activation preserves the focused section button'
    );
    await key('ArrowDown');
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="opening"',
      true
    );
    assert.equal(
      await run('return swbPreferencesApp.runtime.section;', true),
      'language'
    );
    await key('Tab');
    await wait('document.activeElement.name==="language"', true);
    assert.equal(
      await run(
        'const r=document.activeElement.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;',
        true
      ),
      true,
      'Tab reveals the section controls on phones too'
    );
    await key('ArrowDown');
    assert.equal(
      await run('return document.activeElement.name;', true),
      'language',
      'Arrows inside controls keep their native behavior'
    );
    await key('Tab', 8);
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="language"',
      true
    );
    await key('ArrowUp');
    await key('ArrowUp');
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="contacts-storage"',
      true
    );
    await key('Enter');
    await selectedSection('contacts-storage');
    await key('Tab');
    await wait('document.activeElement.name==="contactsResource"', true);
    await key('Tab', 8);
    await key('ArrowDown');
    await wait(
      'document.activeElement.dataset.muzeSolidDesignSection==="appearance"',
      true
    );
    await key('Enter');
    await selectedSection('appearance');
    await key('Tab');
    await wait('document.activeElement.name==="theme"', true);
    await key('ArrowDown');
    assert.equal(
      await run('return document.activeElement.name;', true),
      'theme',
      'Select arrows do not navigate sections'
    );
    assert.equal(
      await run('return swbPreferencesApp.runtime.section;', true),
      'appearance'
    );
    const point = await run(
      `const frame=document.querySelector('iframe');const button=frame.contentDocument.querySelector('[data-muze-solid-design-section="language"]');button.scrollIntoView({block:'nearest'});const r=button.getBoundingClientRect();const f=frame.getBoundingClientRect();return {x:f.x+r.x+r.width/2,y:f.y+r.y+r.height/2};`
    );
    for (const type of ['mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', {
        type,
        button: 'left',
        clickCount: 1,
        ...point
      });
    }
    await wait('document.activeElement.tagName==="H2"', true);
    await selectedSection('language');
    if (viewport.mobile) {
      await key('Tab', 8);
      await wait(
        'document.activeElement.dataset.simplyCommand==="muzeSolidDesignShowList"',
        true
      );
      await key('Enter');
      await wait(
        'document.activeElement.dataset.muzeSolidDesignSection==="language"',
        true
      );
    } else {
      await key('Tab', 8);
      await wait(
        'document.activeElement.dataset.muzeSolidDesignSection==="language"',
        true
      );
    }
    await key('Tab');
    await wait('document.activeElement.name==="language"', true);
  }
  await run(
    'const input=document.querySelector("[name=language]");input.value="nl";input.dispatchEvent(new Event("input",{bubbles:true}));',
    true
  );
  await key('Enter');
  await wait(
    'swbPreferencesApp.runtime.settings.settings().language==="nl"',
    true
  );
  const frameTree = await page.send('Page.getFrameTree');
  const frameId = frameTree.frameTree.childFrames[0].frame.id;
  const accessibility = await page.send('Accessibility.getFullAXTree', {
    frameId
  });
  assert(
    accessibility.nodes.some(
      (node) =>
        node.role?.value === 'button' && node.name?.value === 'Appearance'
    )
  );
  await writeFile(
    '/tmp/cycle106-preferences-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  // The same app works independently and exposes the selected app's section.
  await run(
    'await solidContacts.host.view.actions.muzeSolidUiCheckCapabilityClose();'
  );
  await wait(
    '!document.querySelector(".muze-solid-ui-capability-dialog").open'
  );
  await run('location.href="/preferences/";');
  await wait('window.swbPreferencesApp?.runtime.host.managed');
  await run(
    `const select=document.querySelector('[aria-label="Application settings"]');select.value="files";select.dispatchEvent(new Event("change",{bubbles:true}));`
  );
  await wait(
    'swbPreferencesApp.data.swb_sections.some(section=>section.id==="files-storage")'
  );
  await run('swbPreferencesApp.actions.swb_selectSection("files-storage");');
  await wait(
    `!document.querySelector('[data-simply-field="swb_panels.files-storage"]').hidden`
  );
  await run(
    'const input=[...document.querySelectorAll("[name=filesRoot]")].find(e=>e.getClientRects().length);input.value=location.origin+"/fixture/storage/";input.dispatchEvent(new Event("change",{bubbles:true}));'
  );
  await wait(
    'swbPreferencesApp.runtime.settings.settings().filesRoot.endsWith("/fixture/storage/") && !swbPreferencesApp.runtime.localSaving'
  );
  await wait('swbPreferencesApp.runtime.settings.pending().length===0');
  assert(body.includes('keep'));
  console.log(
    'PASS: independent embedded Preferences, app sections, immediate shared updates, repeated conditional saves, offline retention, draft reopen, conflicts, validator recovery phone focus, section arrows/activation, roving Tab stops, control handoff and native input keys.'
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
