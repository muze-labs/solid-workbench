import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';
import { StateGraph } from '../packages/solid-app-data/src/state-rdf.mjs';
import { readProvider } from '../packages/solid-preferences/src/providers.mjs';

let origin;
let providerOrigin;
let body = '';
let version = 1;
let calls = 0;
let blockEmbedding = false;
const namespace = 'https://vocab.muze.nl/solid-apps#';
const protocol = await readFile(new URL(
  '../packages/solid-app-data/src/capabilities.mjs', import.meta.url));
const provider = createServer((request, response) => {
  const url = new URL(request.url, providerOrigin);
  if (url.pathname === '/protocol.mjs') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(protocol);
    return;
  }
  if (blockEmbedding) {
    response.setHeader('X-Frame-Options', 'DENY');
  }
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><title>Other picker</title>
    <h1>Other picker</h1><button id="select">Select resource</button>
    <button id="cancel">Cancel</button><script type="module">
    import { ManagedApp, browseCapability } from '/protocol.mjs';
    document.querySelector('#select').disabled=true;
    document.querySelector('#cancel').disabled=true;
    window.managed = new ManagedApp({name:'Other picker',
      capabilities:${url.pathname === '/unsupported/' ? '[]' : '[browseCapability]'}, onRequest(event) {
        window.pending = event;
        document.querySelector('#select').disabled=false;
        document.querySelector('#cancel').disabled=false;
      }});
    document.querySelector('#select').onclick=()=>managed.respond(
      pending.id,{result:{'@id':'https://pod.example/chosen.ttl#item'}});
    document.querySelector('#cancel').onclick=()=>managed.respond(
      pending.id,{error:{code:'cancelled',message:'Cancelled'}});
    </script>`);
});
await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
providerOrigin = 'http://127.0.0.1:' + provider.address().port;
const server = createServer(async (request, response) => {
  const path = new URL(request.url, origin).pathname;
  if (path === '/fixture/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/fixture/profile#me>
      <http://xmlns.com/foaf/0.1/name> "Provider fixture";
      <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/fixture/prefs>;
      <http://www.w3.org/ns/pim/space#storage> <${origin}/fixture/storage/>.`);
    return;
  }
  if (path === '/fixture/prefs') {
    if (request.method === 'PUT') {
      if (request.headers['if-match'] !== '"' + version + '"') {
        response.writeHead(412).end();
        return;
      }
      body = '';
      for await (const chunk of request) {
        body += chunk;
      }
      version += 1;
      response.writeHead(205).end();
      return;
    }
    response.setHeader('Content-Type', 'text/turtle');
    response.setHeader('ETag', '"' + version + '"');
    response.end(body);
    return;
  }
  if (path === '/picker-manifest') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${providerOrigin}/#app>
      a <https://schema.org/SoftwareApplication>;
      <https://schema.org/name> "Other picker";
      <https://schema.org/url> <${providerOrigin}/pick/?mode=one#route>;
      <https://vocab.muze.nl/capability#provides>
        <https://vocab.muze.nl/capabilities/browse>.`);
    return;
  }
  if (path === '/seed') {
    response.end('<!doctype html><title>Fixture</title>');
    return;
  }
  if (path === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  try {
    const data = await readFile(new URL(
      '../www' + path + (path.endsWith('/') ? 'index.html' : ''), import.meta.url));
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript'
      : path.endsWith('.css') ? 'text/css'
      : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    response.end(data);
  }
  catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
body = `<${origin}/fixture/prefs#solid-apps> <${namespace}theme> "system".
  <urn:unrelated> <urn:keep> "retained".`;
let browser;
let page;
async function run(code, embedded = false) {
  const result = await page.send('Runtime.evaluate', {
    expression: embedded
      ? 'document.querySelector("iframe").contentWindow.eval(' +
        JSON.stringify('(async()=>{' + code + '})()') + ')'
      : '(async()=>{' + code + '})()',
    awaitPromise: true, returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(code, embedded = false, attempts = 300) {
  for (let index = 0; index < attempts; index += 1) {
    if (await run('return Boolean(' + code + ');', embedded)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('provider-browser: Timeout: ' + code + '\n' +
    await run('return document.body.innerText;', embedded) +
    '\nFocus diagnostic: ' + JSON.stringify(await run(`return {
      active: document.activeElement?.tagName,
      activeSection: document.activeElement?.dataset.muzeSolidDesignSection,
      focused: document.hasFocus(),
      selected: document.querySelector('[data-muze-solid-design-sections] [aria-current="page"]')?.dataset.muzeSolidDesignSection,
      section: window.swbPreferencesApp?.runtime.section
    };`, embedded)) + '\nPresenter diagnostic: ' + JSON.stringify(await run(`return {
      active: document.activeElement?.tagName,
      focused: document.hasFocus(),
      inert: document.querySelector('iframe')?.inert,
      requested: solidLauncher.host.view.runtime.muzeSolidUiCall?.focusRequested,
      presented: solidLauncher.host.view.runtime.muzeSolidUiCall?.presented
    };`)) + '\nPage targets: ' + JSON.stringify(
      (await page.send('Target.getTargets')).targetInfos
        .filter(target => target.type === 'page')
        .map(target => ({ url: target.url, attached: target.attached }))));
}
async function clickCaller(selector) {
  const point = await run('const element=document.querySelector(' +
    JSON.stringify(selector) + ');element.scrollIntoView({block:"nearest"});' +
    'const bounds=element.getBoundingClientRect();' +
    'return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};');
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type, ...point, button: 'left', clickCount: 1
    });
  }
}
async function openPreferences() {
  // Keep this isolated headless page active while checking in-dialog keyboard
  // behavior. Restore real activation before any picker/tab interaction.
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  // Simulate the user's return to the caller after browser-controlled tab focus.
  await page.send('Page.bringToFront');
  await wait('document.hasFocus()');
  await clickCaller('.swb-account-button');
  await wait('document.querySelector("#muze-solid-ui-account-menu").matches(":popover-open")');
  await clickCaller('[data-simply-command=preferences]');
  await wait('document.querySelector("iframe").contentWindow.swbPreferencesApp');
  await wait('swbPreferencesApp.runtime.request', true);
  await wait('document.querySelector("iframe").getAttribute("aria-busy")==="false"');
  await wait('document.activeElement.dataset.muzeSolidDesignSection==="appearance"', true);
  const section = await run(`const r=document.querySelector('[data-muze-solid-design-section=providers]').getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};`, true);
  const frame = await run(`const r=document.querySelector('iframe').getBoundingClientRect();return {x:r.x,y:r.y};`);
  for (const type of ['mousePressed','mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {type,x:frame.x+section.x,
      y:frame.y+section.y,button:'left',clickCount:1});
  }
  await wait('!swbPreferencesApp.data.swb_providerDiscovery.startsWith("Checking")', true);
  await wait('!document.querySelector("[data-simply-command=swb_chooseProvider]").disabled', true);
}
async function closePreferences() {
  await run('await solidLauncher.host.view.commands.call("muzeSolidUiCloseCapability");');
  await wait('!document.querySelector("dialog.muze-solid-ui-capability-dialog").open');
  // Native close precedes task release and the bound iframe navigation. A new
  // request must not reuse the departing provider's document/focus state.
  await wait('!solidLauncher.host.view.runtime.muzeSolidUiCall && ' +
    'document.querySelector("iframe").getAttribute("src")==="about:blank" && ' +
    'document.querySelector("iframe").contentWindow.location.href==="about:blank"');
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: false });
}
async function pickAndRespond(cancel = false, measure = false) {
  const started = await run("return performance.now();");
  await run('solidLauncher.ui.actions.handlePickResource();');
  await wait('solidLauncher.host.view.runtime.muzeSolidUiCall?.attached');
  // Cross-origin providers are controlled through their own isolated CDP realm.
  const tree = await page.send('Page.getFrameTree');
  const frame = tree.frameTree.childFrames.find((item) =>
    item.frame.url.startsWith(providerOrigin));
  const world = await page.send('Page.createIsolatedWorld', {
    frameId: frame.frame.id, worldName: 'provider-test'
  });
  const selector = cancel ? '#cancel' : '#select';
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const ready = await page.send('Runtime.evaluate', {
      contextId: world.executionContextId,
      expression: '!document.querySelector("#select").disabled', returnByValue: true
    });
    if (ready.result.value) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await page.send('Runtime.evaluate', { contextId: world.executionContextId,
    expression: 'document.querySelector(' + JSON.stringify(selector) + ').click();' });
  if (measure) {
    const cost = await page.send('Runtime.evaluate', {
      contextId: world.executionContextId, returnByValue: true,
      expression: `(()=>{const n=performance.getEntriesByType('navigation')[0];
        const r=performance.getEntriesByType('resource');return {
          bytes:n.transferSize+r.reduce((sum,e)=>sum+e.transferSize,0),
          requests:r.length+1,zeroTransferResources:r.filter(e=>!e.transferSize).length};})()`
    });
    console.log('Cold fixture provider from warm Launcher, 50 KiB/s down, 25 KiB/s up, 150ms latency:',
      {...cost.result.value, milliseconds:Math.round((await run('return performance.now();'))-started)});
  }
  calls += 1;
  await wait('!solidLauncher.ui.runtime.selection');
}
try {
  browser = await startChrome(origin + '/seed');
  page = await browser.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await run('localStorage.setItem("solid-apps.webId",location.origin+"/fixture/profile#me"); location.href="/workbench/";');
  await wait('window.solidLauncher?.store && solidLauncher.host.session');
  await run(`await solidLauncher.ui.actions.addShortcut({
    url:${JSON.stringify(providerOrigin + '/pick/?mode=one#route')},
    name:'Other picker',mode:'',anonymous:false,
    manifest:location.origin+'/picker-manifest'});`);
  await openPreferences();
  await wait('[...document.querySelector("[data-simply-command=swb_chooseProvider]").options].some(o=>o.text.startsWith("Other picker"))', true);
  // Reconstructed feature source remains usable for live edits and restoration.
  const editable = await run(`const app=swbPreferencesApp;
    const entries=app.definition.sources.swbProviderPreferences.actions;
    for(const entry of Object.values(entries)) {
      if(typeof Function('return ('+entry.source+')')()!=='function') {
        throw new Error('provider-browser: Invalid editable source');
      }
    }
    return Object.keys(entries).length;`, true);
  assert(editable > 5);
  // Focus uses the bound current section. Wait for its ARIA projection before
  // setting up native keyboard input, rather than focusing the departing row.
  await wait('document.querySelector("[data-muze-solid-design-section=providers]").getAttribute("aria-current")==="page"', true);
  await run('swbPreferencesApp.actions.swb_focusSelectedSection();', true);
  await wait('document.activeElement.dataset.muzeSolidDesignSection==="providers"', true);
  for (const key of ['Tab', 'ArrowDown']) {
    for (const type of ['keyDown', 'keyUp']) {
      await page.send('Input.dispatchKeyEvent', {type, key, code:key,
        windowsVirtualKeyCode:key==='Tab'?9:40});
    }
    if (key === 'Tab') {
      await wait('document.activeElement.matches("[data-simply-command=swb_chooseProvider]")', true);
    }
  }
  await wait('swbPreferencesApp.runtime.settings.pending().length===0 && swbPreferencesApp.runtime.settings.settings().browseProvider', true);
  const choice = readProvider(new StateGraph(body, origin + '/fixture/prefs'),
    origin + '/fixture/prefs');
  assert.equal(choice.application, providerOrigin + '/#app');
  assert.equal(choice.url, providerOrigin + '/pick/?mode=one#route');
  assert(body.includes('retained'));
  await wait('document.querySelector("[data-simply-command=swb_chooseProvider]").getBoundingClientRect().right<=innerWidth', true);
  await writeFile('/tmp/provider118-phone.png', Buffer.from(
    (await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  assert.equal(await run('return document.documentElement.scrollWidth<=innerWidth;', true), true);
  const tree = await page.send('Page.getFrameTree');
  const frame = tree.frameTree.childFrames.find((item) =>
    item.frame.url.includes('/preferences/'));
  const ax = await page.send('Accessibility.getFullAXTree', { frameId: frame.frame.id });
  assert(ax.nodes.some((node) => node.role?.value === 'combobox' &&
    node.name?.value === 'Resource picker'));
  await run('document.documentElement.style.fontSize="200%";', true);
  assert.equal(await run('const p=document.querySelector(".swb-provider-current").parentElement;return p.scrollWidth<=p.clientWidth;', true), true);
  await writeFile('/tmp/provider118-phone-text200.png', Buffer.from(
    (await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  assert.equal(await run('return document.querySelector("[data-simply-command=swb_chooseProvider]").getBoundingClientRect().width<=innerWidth;', true), true);
  await run('document.querySelector("[data-simply-command=swb_chooseProvider]").scrollIntoView({block:"center"});', true);
  await writeFile('/tmp/provider118-phone-text200-controls.png', Buffer.from(
    (await page.send('Page.captureScreenshot', {format:'png'})).data,'base64'));
  assert.equal(await run('const r=document.querySelector("[data-simply-command=swb_chooseProvider]").getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight;', true), true);
  await run('document.documentElement.style.fontSize="";', true);
  await closePreferences();
  await wait('solidLauncher.host.preferences.browseProvider');
  await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled:true });
  await page.send('Network.emulateNetworkConditions', { offline:false,
    latency:150, downloadThroughput:50*1024, uploadThroughput:25*1024 });
  await pickAndRespond(false, true);
  await page.send('Network.emulateNetworkConditions', { offline:false,
    latency:0, downloadThroughput:-1, uploadThroughput:-1 });
  await page.send('Network.setCacheDisabled', { cacheDisabled:false });
  assert.equal(await run('return solidLauncher.ui.data.resource;'),
    'https://pod.example/chosen.ttl#item');
  await run('solidLauncher.ui.data.resource="https://pod.example/previous";');
  await pickAndRespond(true);
  assert.equal(await run('return solidLauncher.ui.data.resource;'),
    'https://pod.example/previous');
  assert.equal(await run('return solidLauncher.workspace.snapshot().apps.length;'), 0);
  // Local cache reload and a second workspace preserve the identity-wide choice.
  await run('location.reload();');
  await wait('window.solidLauncher?.store && solidLauncher.host.preferences.browseProvider');
  await run(`const copy=structuredClone(solidLauncher.persistence.snapshot);
    solidLauncher.ui.api.addWorkspace(copy,'Other workspace');
    await solidLauncher.persistence.stage(copy);`);
  const other = await run('return solidLauncher.persistence.snapshot.directory.entries[1].id;');
  await run('await solidLauncher.ui.actions.swb_switchWorkspace(' + JSON.stringify(other) + ');');
  assert.equal(await run('return solidLauncher.workspace.embeddedProvider(solidLauncher.ui.api.browseCapability);'), choice.url);
  await openPreferences();
  await run(`const select=document.querySelector('[data-simply-command=swb_chooseProvider]');
    select.value='custom';select.dispatchEvent(new Event('change',{bubbles:true}));
    const input=document.querySelector('[name=swb_providerUrl]');
    input.value='unfinished';input.dispatchEvent(new Event('input',{bubbles:true}));`, true);
  await wait('swbPreferencesApp.runtime.settings.drafts().browseProvider==="unfinished"', true);
  await closePreferences();
  await openPreferences();
  assert.equal(await run('return document.querySelector("[name=swb_providerUrl]").value;', true), 'unfinished');
  await run(`const input=document.querySelector('[name=swb_providerUrl]');
    input.value=${JSON.stringify(providerOrigin + '/pick/?mode=two#other-route')};
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));`, true);
  await wait('swbPreferencesApp.runtime.settings.settings().browseProvider.url.includes("mode=two") && swbPreferencesApp.runtime.settings.pending().length===0', true);
  await closePreferences();
  await pickAndRespond();
  // A new browser context has no preference cache or live provider.
  await browser.close();
  browser = await startChrome(origin + '/seed');
  page = await browser.page();
  await page.ready();
  await run('localStorage.setItem("solid-apps.webId",location.origin+"/fixture/profile#me"); location.href="/workbench/";');
  await wait('window.solidLauncher?.store && solidLauncher.host.preferences.browseProvider?.url.includes("mode=two")');
  await pickAndRespond();
  // Refused embedding keeps the same chosen provider and task for a tab retry.
  blockEmbedding = true;
  await run('solidLauncher.ui.actions.handlePickResource();');
  await wait('solidLauncher.host.view.runtime.muzeSolidUiCall?.chooseTab', false, 800);
  await run(`const original=window.open;
    window.open=()=>null;
    document.querySelector('[data-simply-command=muzeSolidUiOpenCapabilityTab]').click();
    window.open=original;`);
  assert.match(await run('return solidLauncher.host.view.data.muzeSolidUiDialog.message;'), /Allow popups/);
  const position = await run(`const a=document.querySelector('[data-simply-command=muzeSolidUiOpenCapabilityTab]');
    a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};`);
  for (const type of ['mousePressed','mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {type,...position,button:'left',clickCount:1});
  }
  let tab;
  for (let attempt=0;attempt<300;attempt+=1) {
    const {targetInfos}=await page.send('Target.getTargets');
    const target=targetInfos.find(item=>item.type==='page' && item.url.startsWith(providerOrigin));
    if (target) {
      tab=await browser.page(target.targetId);
      break;
    }
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert(tab,'The user click opens the chosen provider tab');
  for (let attempt=0;attempt<300;attempt+=1) {
    const ready=await tab.send('Runtime.evaluate', {expression:'Boolean(window.pending)',returnByValue:true});
    if (ready.result.value) {
      break;
    }
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  await tab.send('Runtime.evaluate',{expression:'document.querySelector("#select").click();'});
  await wait('!solidLauncher.ui.runtime.selection');
  assert.equal(await run('return solidLauncher.ui.data.resource;'),'https://pod.example/chosen.ttl#item');
  assert.equal(await run('return solidLauncher.workspace.snapshot().apps.length;'),0);
  blockEmbedding = false;
  calls += 1;
  // An explicit incompatible provider fails without changing the resource draft.
  await openPreferences();
  await run(`const input=document.querySelector('[name=swb_providerUrl]');
    input.value=${JSON.stringify(providerOrigin + '/unsupported/')};
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));`, true);
  await wait('swbPreferencesApp.runtime.settings.settings().browseProvider.url.endsWith("/unsupported/") && swbPreferencesApp.runtime.settings.pending().length===0', true);
  await closePreferences();
  const beforeFailure = await run('return solidLauncher.ui.data.resource;');
  await run('solidLauncher.ui.actions.handlePickResource();');
  await wait('solidLauncher.ui.data.pickerMessage.includes("does not implement")');
  assert.equal(await run('return solidLauncher.ui.data.resource;'), beforeFailure);
  assert.equal(await run('return solidLauncher.host.preferences.browseProvider.url;'),
    providerOrigin + '/unsupported/');
  await closePreferences();
  // Reset through the same native shared editor, with no provider auto-fallback.
  await openPreferences();
  await run('document.querySelector("[data-simply-command=swb_resetProvider]").click();', true);
  await wait('swbPreferencesApp.runtime.settings.settings().browseProvider===null && swbPreferencesApp.runtime.settings.pending().length===0', true);
  assert.equal(readProvider(new StateGraph(body, origin + '/fixture/prefs'),
    origin + '/fixture/prefs'), null);
  assert(body.includes('retained'));
  console.log('PASS: phone saved-app and custom selection, native Pod binding, cross-origin picker result/cancellation, query/routes, reload, workspace scope, incomplete draft reopen and reset. Tasks completed:', calls);
}
finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => provider.close(resolve));
}
