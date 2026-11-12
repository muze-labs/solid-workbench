import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';
import { StateGraph } from '../packages/solid-app-data/src/state-rdf.mjs';
import { readProvider } from '../packages/solid-preferences/src/providers.mjs';
import { independentPeer } from './support/independent-recipient-peer.mjs';

let origin, other;
let body = '', version = 1;
const storageWrites = [];
let referenceReads = 0;
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, origin);
  if (url.pathname === '/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/profile#me>
      <http://xmlns.com/foaf/0.1/name> "Recipient owner";
      <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/prefs>;
      <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`);
    return;
  }
  if (url.pathname === '/prefs') {
    if (request.method === 'PUT') {
      if (request.headers['if-match'] !== '"' + version + '"') {
        response.writeHead(412).end(); return;
      }
      body = '';
      for await (const chunk of request) { body += chunk; }
      version += 1;
    }
    response.setHeader('Content-Type', 'text/turtle');
    response.setHeader('ETag', '"' + version + '"');
    response.end(body); return;
  }
  if (url.pathname.startsWith('/storage/') &&
      url.pathname !== '/storage/apps/solid-apps/launcher.ttl' &&
      !['GET', 'HEAD'].includes(request.method)) {
    storageWrites.push({ method: request.method, url: url.href });
  }
  if (url.pathname === '/storage/') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/storage/> a <http://www.w3.org/ns/ldp#BasicContainer>;
      <http://www.w3.org/ns/ldp#contains> <${origin}/storage/report.pdf>.`);
    return;
  }
  if (url.pathname === '/reference-contact') {
    referenceReads += 1;
    response.setHeader('Content-Type', 'text/turtle');
    response.end('<https://independent.example/person#me> <http://www.w3.org/2006/vcard/ns#fn> "Reference contact"; <http://www.w3.org/2006/vcard/ns#hasEmail> <mailto:reference@example.org>.');
    return;
  }
  if (url.pathname === '/seed') {
    response.end('<!doctype html><title>Seed</title>'); return;
  }
  try {
    const path = url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
    const content = await readFile(new URL('../www' + path, import.meta.url));
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript'
      : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg')
        ? 'image/svg+xml' : 'text/html');
    response.end(content);
  }
  catch { response.writeHead(404).end(); }
});
const external = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(independentPeer({ suiteOrigin: origin, callerOrigin: other,
    provider: request.url.startsWith('/provider') || request.url.startsWith('/reference-provider'),
    referenceDocument: request.url.startsWith('/reference-provider') ? origin+'/reference-contact' : null }));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
await new Promise((resolve) => external.listen(0, '127.0.0.1', resolve));
other = 'http://127.0.0.1:' + external.address().port;
body = '<urn:unrelated> <urn:keep> "preserve" .';
let chrome;
async function run(page, code) {
  const result = await page.send('Runtime.evaluate', {
    expression: '(async()=>{' + code + '})()', awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}
async function until(page, condition) {
  for (let attempt = 0; attempt < 350; attempt += 1) {
    if (await run(page, 'return Boolean(' + condition + ');')) { return; }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('recipient-browser: Timed out: ' + condition + '\n' +
    await run(page, 'return document.body.innerText;'));
}
async function key(page, value, code) {
  const physical = value === ' ' ? 'Space' : value;
  await page.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: value, code: physical,
    windowsVirtualKeyCode: code, nativeVirtualKeyCode: code
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'char', key: value, code: physical,
    text: value === 'Enter' ? '\r' : value,
    unmodifiedText: value === 'Enter' ? '\r' : value
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: value, code: physical,
    windowsVirtualKeyCode: code, nativeVirtualKeyCode: code
  });
}

try {
  chrome = await startChrome(origin + '/seed', { allowPopups: true });
  const page = await chrome.page();
  await page.ready();
  await run(page, 'localStorage.setItem("solid-apps.webId",location.origin+"/profile#me");location.href="/contacts/";');
  await until(page, 'window.solidContacts?.store');
  const identity = await run(page, `const app=muzeSolidContactsApp;
    await app.actions.addContact('Alpha long contact name for a narrow phone view');
    await app.actions.addContact('Beta');
    await app.actions.saveContact(app.runtime.selected,{email:'beta@example.org',phone:'+3112345'});
    return app.runtime.selected;`);
  // Reload proves the selected book is durable before invoking a transient picker.
  await page.send('Page.reload');
  await until(page, 'window.solidContacts?.store?.collection.list().length===2');
  await run(page, 'location.href="/workbench/";');
  await until(page, 'window.solidLauncher?.workspace && solidLauncher.host.session');
  // The shipped presenter also hosts Contacts and delivers cancellation.
  await run(page, `window.cancelled=false;
    solidLauncher.host.muzeSolidUiInvoke(
      'https://vocab.muze.nl/capabilities/select-recipient',
      location.origin+'/contacts/',{},'Select a recipient')
      .catch(error=>window.cancelled=error.code==='cancelled');`);
  await until(page, 'document.querySelector("iframe")?.contentWindow.muzeSolidContactsApp?.runtime.recipientRequest');
  await run(page, `const doc=document.querySelector('iframe').contentDocument;
    doc.querySelector('[data-simply-command=swb_cancelRecipient]').click();`);
  await until(page, 'window.cancelled && !solidLauncher.host.view.runtime.muzeSolidUiCall');
  // Real Files UI is the consumer: Share starts selection, not ACL editing.
  await run(page, `solidLauncher.workspace.open(location.origin+'/files/');`);
  let files;
  for (let attempt=0; attempt<200; attempt+=1) {
    const targets=(await page.send('Target.getTargets')).targetInfos;
    const target=targets.find(row=>row.url===origin+'/files/');
    if(target){files=await chrome.page(target.targetId);break;}
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert(files);
  await files.ready();
  await files.send('Emulation.setDeviceMetricsOverride', {
    width:390,height:844,deviceScaleFactor:1,mobile:true
  });
  await until(files,'window.solidFiles?.host.managed?.ready');
  await run(files, `const form=document.querySelector('[data-simply-command=browse]');
    form.elements.url.value=location.origin+'/storage/';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
  await until(files,'solidFiles.ui.data.entries.length===1');
  await files.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await files.send('Page.bringToFront');
  await until(files,'!solidFiles.ui.runtime.busy');
  await until(files,'document.querySelector("[data-simply-command=swb_shareResource]")?.checkVisibility()');
  await run(files,'document.querySelector("[data-simply-command=swb_shareResource]").focus();');
  await until(files,'document.activeElement.dataset.simplyCommand==="swb_shareResource"');
  await key(files,'Enter',13);
  await until(files,'document.querySelector("iframe")?.contentWindow.muzeSolidContactsApp?.runtime.recipientRequest');
  await until(files,'document.querySelector("iframe").getAttribute("aria-busy")==="false"');
  await run(files, `const doc=document.querySelector('iframe').contentDocument;
    doc.querySelectorAll('[data-simply-command=swb_chooseRecipient]')[1].click();`);
  await until(files,'!document.querySelector("iframe").contentDocument.querySelector("[data-simply-command=swb_useRecipient]").disabled');
  assert.equal(await run(files, `return document.querySelector('iframe').contentWindow.muzeSolidContactsApp.data.swb_recipientDescription.includes('beta@example.org');`),true);
  assert.equal(await run(files, `return document.querySelector('iframe').contentWindow.muzeSolidContactsApp.data.swb_recipientDescription.includes('Alpha long');`),false);
  await run(files, `document.querySelector('iframe').contentDocument.querySelector('[data-simply-command=swb_useRecipient]').focus();`);
  await key(files,'Enter',13);
  await until(files,'solidFiles.ui.data.swb_shareEmail==="beta@example.org" && !solidFiles.ui.runtime.sharing');
  assert.equal(await run(files,'return solidFiles.ui.data.swb_sharePerson;'),'Beta');
  assert.equal(await run(files,'return solidFiles.ui.data.swb_shareId;'),identity);
  assert.equal(await run(files,'return solidFiles.ui.data.swb_shareResource;'),origin+'/storage/report.pdf');
  assert.match(await run(files,'return solidFiles.ui.data.swb_shareStatus;'),/Permissions unchanged/);
  await run(files,'document.querySelector(".swb-files-sharing").scrollIntoView();');
  await writeFile('/tmp/contacts139-files-share-phone.png',Buffer.from(
    (await files.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await run(files,'document.querySelector("[data-simply-command=swb_changeShareRecipient]").click();');
  await until(files,'document.querySelector("iframe")?.contentWindow.muzeSolidContactsApp?.runtime.recipientRequest');
  await run(files, `document.querySelector('iframe').contentDocument.querySelector('[data-simply-command=swb_cancelRecipient]').click();`);
  await until(files,'!solidFiles.ui.runtime.sharing');
  assert.equal(await run(files,'return solidFiles.ui.data.swb_shareId;'),identity);
  const restoredState=await run(files,'return solidFiles.ui.actions.captureState().turtle;');
  assert(!restoredState.includes('beta@example.org'),'Workspace state retains references rather than contact payloads');
  await files.send('Page.reload');
  await until(files,'window.solidFiles?.ui.data.swb_shareId');
  assert.equal(await run(files,'return solidFiles.ui.data.swb_shareId;'),identity);
  assert.equal(await run(files,'return solidFiles.ui.data.swb_sharePerson;'),'Beta');
  // Resource picking has its own selection list; normal management stays hidden.
  await run(page, `window.filePicked=null;
    solidLauncher.host.muzeSolidUiInvoke('https://vocab.muze.nl/capabilities/browse',
      location.origin+'/files/',{},'Choose a resource').then(value=>window.filePicked=value);`);
  await until(page,'document.querySelector("iframe")?.contentWindow.solidFiles?.ui.runtime.pending');
  await until(page,'document.querySelector("iframe").contentWindow.solidFiles.ui.data.entries.length===1');
  assert.equal(await run(page,'return document.querySelector("iframe").contentDocument.querySelector("table.swb-file-list").checkVisibility();'),false);
  await until(page,'document.querySelector("iframe").getAttribute("aria-busy")==="false"');
  await until(page,'document.querySelector("iframe").contentDocument.querySelector(".swb-resource-choices").checkVisibility()');
  await run(page, `document.querySelector('iframe').contentDocument.querySelector('.swb-resource-choices [data-simply-command=selectResource]').click();`);
  await until(page,'window.filePicked && !solidLauncher.host.view.runtime.muzeSolidUiCall');
  assert.equal(await run(page,'return filePicked["@id"];'),origin+'/storage/report.pdf');
  assert.deepEqual(storageWrites,[]);
  await files.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await run(page, `solidLauncher.workspace.open(${JSON.stringify(other + '/caller')});`);
  let caller;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const targets = (await page.send('Target.getTargets')).targetInfos;
    const target = targets.find((row) => row.url === other + '/caller');
    if (target) { caller = await chrome.page(target.targetId); break; }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert(caller, 'Independent caller opens');
  await caller.ready();
  await until(caller, 'window.registered');
  await caller.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await caller.send('Network.enable');
  await caller.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150,
    downloadThroughput: 50 * 1024, uploadThroughput: 25 * 1024
  });
  const started = await run(caller, 'return performance.now();');
  await run(caller, 'document.querySelector("#choose").click();');
  await until(caller, 'document.querySelector("iframe")');
  let frame;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const tree = await caller.send('Page.getFrameTree');
    frame = tree.frameTree.childFrames?.find((item) => item.frame.url.includes('/contacts/'));
    if (frame) { break; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert(frame, 'Independent caller hosts the real Contacts picker');
  const world = await caller.send('Page.createIsolatedWorld', {
    frameId: frame.frame.id, worldName: 'recipient-test'
  });
  async function inside(code) {
    const value = await caller.send('Runtime.evaluate', {
      contextId: world.executionContextId,
      expression: code, returnByValue: true, awaitPromise: true
    });
    if (value.exceptionDetails) { throw new Error(JSON.stringify(value.exceptionDetails)); }
    return value.result.value;
  }
  let requestReady = false;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    requestReady = await inside('Boolean(document.querySelector("[data-simply-field=swb_recipientSource]")?.textContent.trim())');
    if (requestReady) { break; }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert(requestReady, 'The cold provider receives its request before interaction');
  assert.equal(await inside('document.querySelectorAll("[data-simply-command=swb_chooseRecipient]").length'), 2);
  console.log('Cold Contacts picker from warm independent caller with cached book, 50 KiB/s down, 25 KiB/s up, 150 ms latency:', {
    ...await inside(`(()=>{
      const navigation=performance.getEntriesByType('navigation')[0];
      const resources=performance.getEntriesByType('resource');
      return {bytes:navigation.transferSize+resources.reduce((sum,row)=>sum+row.transferSize,0),
        requests:resources.length+1};
    })()`),
    milliseconds: Math.round((await run(caller, 'return performance.now();')) - started)
  });
  assert.equal(await inside('document.documentElement.scrollWidth<=innerWidth'), true);
  assert.equal(await inside('document.querySelector("[data-simply-command=newContact]").checkVisibility()'), false);
  await writeFile('/tmp/contacts139-phone-normal.png', Buffer.from(
    (await caller.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  // Loaded cached rows remain selectable with no network connection.
  await caller.send('Network.enable');
  await caller.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  // Activate this tab and wait for bound button readiness before native keys.
  await caller.send('Page.bringToFront');
  await until(caller, 'document.hasFocus()');
  await inside('document.querySelector(".swb-recipient-picker input").focus();');
  await caller.send('Input.insertText', { text: 'Beta' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await inside('document.querySelectorAll("[data-simply-command=swb_chooseRecipient]").length===1')) { break; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(await inside('document.querySelectorAll("[data-simply-command=swb_chooseRecipient]").length'), 1);
  await inside('document.querySelector("[data-simply-command=swb_chooseRecipient]").focus();');
  await key(caller, 'Enter', 13);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await inside('!document.querySelector("[data-simply-command=swb_useRecipient]").disabled')) { break; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(await inside('document.querySelector("[data-simply-command=swb_useRecipient]").disabled'), false,
    await inside('JSON.stringify({focus:document.activeElement.outerHTML,status:document.body.innerText,values:[...document.querySelectorAll("[data-simply-command=swb_chooseRecipient]")].map(b=>b.dataset.simplyValue)})'));

  await inside('document.documentElement.style.fontSize="200%";');
  assert.equal(await inside('document.documentElement.scrollWidth<=innerWidth'), true);
  await writeFile('/tmp/contacts139-phone.png', Buffer.from(
    (await caller.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const ax = await caller.send('Accessibility.getFullAXTree', { frameId: frame.frame.id });
  assert(ax.nodes.some((node) => node.role?.value === 'button' &&
    node.name?.value === 'Use this contact'));
  await inside('document.querySelector("[data-simply-command=swb_useRecipient]").focus();');
  assert.equal(await inside(`(()=>{
    const button=document.querySelector('[data-simply-command=swb_useRecipient]');
    const bounds=button.getBoundingClientRect();
    return bounds.left>=0 && bounds.right<=innerWidth &&
      button.scrollWidth<=button.clientWidth;
  })()`), true, 'Confirmation remains fully readable at 200% phone text');
  await writeFile('/tmp/contacts139-phone-controls.png', Buffer.from(
    (await caller.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await key(caller, 'Enter', 13);
  await until(caller, 'window.outcome');
  assert.equal(await run(caller, 'return outcome["@id"];'), identity);
  await caller.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
  });
  // Actual preferences presentation changes the next provider, without caller edits.
  await run(page, 'solidLauncher.host.view.commands.call("preferences");');
  await until(page, 'document.querySelector("iframe")?.contentWindow.swbPreferencesApp?.runtime.request && document.querySelector("iframe").contentWindow.swbPreferencesApp.runtime.settings && document.querySelector("iframe").getAttribute("aria-busy")=="false"');
  await run(page, `const app=document.querySelector('iframe').contentWindow.swbPreferencesApp;
    app.actions.swb_selectSection('providers');
    app.commands.call('swb_chooseProviderKind',{value:'recipientProvider'});`);
  await run(page, `const app=document.querySelector('iframe').contentWindow.swbPreferencesApp;
    await app.actions.swb_saveProvider({application:'urn:independent:recipient',url:${JSON.stringify(other + '/provider')}});`);
  await until(page, 'solidLauncher.host.preferences.recipientProvider?.application==="urn:independent:recipient"');
  await until(page, 'document.querySelector("iframe").contentWindow.swbPreferencesApp.runtime.settings.pending().length===0');
  assert.equal(readProvider(new StateGraph(body, origin+'/prefs'), origin+'/prefs',
    'https://vocab.muze.nl/capabilities/select-recipient').application,
    'urn:independent:recipient');
  await run(page, 'await solidLauncher.host.view.commands.call("muzeSolidUiCloseCapability");');
  await until(page, '!solidLauncher.host.view.runtime.muzeSolidUiCall');
  await run(caller, 'document.querySelector("#choose").click();');
  await until(caller, 'document.querySelector("iframe")');
  await until(caller, 'document.querySelector("iframe").contentWindow.pending !== undefined || document.querySelector("iframe").contentDocument.body.innerText.includes("Selection requested")');
  await run(caller, 'document.querySelector("iframe").contentDocument.querySelector("#choose").click();');
  await until(caller, 'window.outcome');
  assert.equal(await run(caller, 'return outcome["@id"];'), 'https://independent.example/person#me');
  // Cancellation leaves the previous chosen contact intact in the caller view.
  await run(caller, 'document.querySelector("#choose").click();');
  await until(caller, 'document.querySelector("iframe")?.contentDocument.body.innerText.includes("Selection requested")');
  await run(caller, 'document.querySelector("iframe").contentDocument.querySelector("#cancel").click();');
  await until(caller, 'window.failure');
  assert.equal(await run(caller, 'return failure.code;'), 'cancelled');
  assert.equal(await run(caller, 'return window.selected;'), 'https://independent.example/person#me');
  // A second browse provider through the same independent caller and broker.
  await run(page, 'solidLauncher.host.view.commands.call("preferences");');
  await until(page, 'document.querySelector("iframe")?.contentWindow.swbPreferencesApp?.runtime.request && document.querySelector("iframe").contentWindow.swbPreferencesApp.runtime.settings && document.querySelector("iframe").getAttribute("aria-busy")=="false"');
  await run(page, `const app=document.querySelector('iframe').contentWindow.swbPreferencesApp;
    app.actions.swb_selectSection('providers');
    await app.actions.swb_saveProvider({application:'urn:independent:browse',url:${JSON.stringify(other + '/provider')}});`);
  await until(page, 'solidLauncher.host.preferences.browseProvider?.application==="urn:independent:browse"');
  await until(page, 'document.querySelector("iframe").contentWindow.swbPreferencesApp.runtime.settings.pending().length===0');
  const saved = new StateGraph(body, origin+'/prefs');
  assert.equal(readProvider(saved, origin+'/prefs').application, 'urn:independent:browse');
  assert.equal(readProvider(saved, origin+'/prefs',
    'https://vocab.muze.nl/capabilities/select-recipient').application,
    'urn:independent:recipient');
  await run(page, 'await solidLauncher.host.view.commands.call("muzeSolidUiCloseCapability");');
  await until(page, '!solidLauncher.host.view.runtime.muzeSolidUiCall');
  await run(caller, 'window.invoke("https://vocab.muze.nl/capabilities/browse");');
  await until(caller, 'document.querySelector("iframe")?.contentDocument.body.innerText.includes("Selection requested")');
  await run(caller, 'document.querySelector("iframe").contentDocument.querySelector("#choose").click();');
  await until(caller, 'window.outcome');
  assert.equal(await run(caller, 'return outcome["@id"];'), 'https://independent.example/person#me');
  await run(page, 'solidLauncher.host.view.commands.call("preferences");');
  await until(page, 'document.querySelector("iframe")?.contentWindow.swbPreferencesApp?.runtime.request && document.querySelector("iframe").contentWindow.swbPreferencesApp.runtime.settings && document.querySelector("iframe").getAttribute("aria-busy")=="false"');
  await run(page, `const app=document.querySelector('iframe').contentWindow.swbPreferencesApp;
    app.actions.swb_selectSection('providers');
    app.commands.call('swb_chooseProviderKind',{value:'recipientProvider'});
    await app.actions.swb_saveProvider({application:'urn:independent:reference',url:${JSON.stringify(other + '/reference-provider')}});`);
  await until(page, 'solidLauncher.host.preferences.recipientProvider?.application==="urn:independent:reference"');
  await run(page, 'await solidLauncher.host.view.commands.call("muzeSolidUiCloseCapability");');
  await until(page, '!solidLauncher.host.view.runtime.muzeSolidUiCall');
  await run(files, 'document.querySelector("[data-simply-command=swb_changeShareRecipient]").click();');
  await until(files, 'solidFiles.host.view.runtime.muzeSolidUiCall?.attached');
  const providerFrames=await files.send('Page.getFrameTree');
  const remoteFrame=providerFrames.frameTree.childFrames.find(row=>row.frame.url.startsWith(other));
  const remoteWorld=await files.send('Page.createIsolatedWorld',{frameId:remoteFrame.frame.id,worldName:'reference-provider'});
  for(let attempt=0;attempt<200;attempt+=1){
    const result=await files.send('Runtime.evaluate',{contextId:remoteWorld.executionContextId,
      expression:'document.body.innerText.includes("Selection requested")',returnByValue:true});
    if(result.result.value){break;}
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  await files.send('Runtime.evaluate',{contextId:remoteWorld.executionContextId,
    expression:'document.querySelector("#choose").click();'});
  await until(files,'solidFiles.ui.data.swb_shareEmail==="reference@example.org"');
  assert(referenceReads>0,'The caller reads the provided document through its own session');
  assert.equal(await run(files,'return solidFiles.ui.data.swb_shareId;'),'https://independent.example/person#me');
  assert.deepEqual(storageWrites,[],'Selection makes no sharing-target, address-book or permission writes');
  assert(body.includes('preserve'));
  await writeFile('/tmp/contacts139-caller.png', Buffer.from(
    (await caller.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  console.log('PASS: real Files Share UI consumes local RDF and source-document references; cancellation/reload preservation, dedicated Files picker, independent Contacts caller/provider replacement, phone/keyboard/offline selection and no sharing-target or permission writes.');
}
finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => external.close(resolve));
}
