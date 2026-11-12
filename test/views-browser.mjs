import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';
import { independentViewPeer } from './support/independent-view-peer.mjs';
let origin, other;
let textReads = 0;
const longName =
  'A long filename that should remain readable through its tooltip while the list and the complete available details heading width stay inside the viewport '.repeat(
    3
  ) + '.txt';
let textContent =
  '<script>this is plain text</script>\nHello from the resource.';
let unavailable = false;
const writes = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  if (!['GET', 'HEAD'].includes(request.method)) {
    writes.push(url.pathname);
  }
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/profile#me> <http://xmlns.com/foaf/0.1/name> "View owner";
      <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`);
    return;
  }
  if (url.pathname === '/storage/') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/storage/> a <http://www.w3.org/ns/ldp#BasicContainer>;
      <http://www.w3.org/ns/ldp#contains> <${origin}/storage/note.txt>,
      <${origin}/storage/image.png>, <${origin}/storage/unsupported.bin>,
      <${origin}/storage/${encodeURIComponent(longName)}>.`);
    return;
  }
  if (
    url.pathname === '/storage/note.txt' ||
    url.pathname === '/storage/' + encodeURIComponent(longName)
  ) {
    textReads += 1;
    if (unavailable) {
      response.writeHead(503).end('Unavailable');
      return;
    }
    response.setHeader('Content-Type', 'text/plain');
    response.end(textContent);
    return;
  }
  if (url.pathname === '/storage/image.png') {
    response.setHeader('Content-Type', 'image/jpeg');
    response.end(
      await readFile(
        new URL('../apps/launcher/src/backgrounds/bg1.jpg', import.meta.url)
      )
    );
    return;
  }
  if (url.pathname === '/storage/unsupported.bin') {
    response.setHeader('Content-Type', 'application/octet-stream');
    response.end('unsupported binary');
    return;
  }
  if (url.pathname === '/storage/source') {
    response.setHeader('Content-Type', url.searchParams.get('type'));
    response.end('<script>parent.unsafeExecuted=true</script>');
    return;
  }
  if (url.pathname === '/seed') {
    response.end('<!doctype html><title>Seed</title>');
    return;
  }
  try {
    const path =
      url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
    const data = await readFile(new URL('../www' + path, import.meta.url));
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
    response.end(data);
  }
  catch {
    response.writeHead(404).end();
  }
});
const external = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(independentViewPeer(origin));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
await new Promise((resolve) => external.listen(0, '127.0.0.1', resolve));
other = 'http://127.0.0.1:' + external.address().port;
let chrome;
async function run(page, source) {
  return page.evaluate('async()=>{' + source + '}');
}
async function until(page, expression) {
  for (let attempt = 0; attempt < 800; attempt++) {
    if (await run(page, 'return Boolean(' + expression + ')')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'views-browser: Timed out: ' +
      expression +
      '\n' +
      (await run(page, 'return document.body.innerText'))
  );
}
async function click(page, command) {
  await until(
    page,
    'document.querySelector(' +
      JSON.stringify('[data-simply-command="' + command + '"]') +
      ')'
  );
  await run(
    page,
    'document.querySelector(' +
      JSON.stringify('[data-simply-command="' + command + '"]') +
      ').click()'
  );
}
const viewer =
  'document.querySelector(".muze-solid-files-frame").contentWindow.muzeSolidViewerApp';
try {
  chrome = await startChrome(origin + '/seed', { allowPopups: true });
  const page = await chrome.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await run(
    page,
    'localStorage.setItem("solid-apps.webId",location.origin+"/profile#me");location.href="/files/"'
  );
  await until(page, 'window.solidFiles?.ui.data.entries.length===4');
  await until(page, 'document.querySelector(".swb-file-name")');
  await run(page, 'document.querySelector(".swb-file-name").focus()');
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  const started = Date.now();
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r'
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await until(
    page,
    'document.querySelector(".muze-solid-files-details .muze-solid-ui-capability-loading").checkVisibility()'
  );
  assert.equal(
    await run(
      page,
      `const frame=document.querySelector('.muze-solid-files-frame');
    return frame.inert && frame.getAttribute('aria-busy')==='true' &&
      getComputedStyle(frame).visibility==='hidden';`
    ),
    true
  );
  await writeFile(
    '/tmp/cyc168-files-loading-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await until(page, 'solidFiles.ui.runtime.resourceView?.support?.ready');
  const readyMilliseconds = Date.now() - started;
  await until(
    page,
    'document.querySelector(".muze-solid-files-frame").getAttribute("aria-busy")==="false"'
  );
  assert.equal(
    await run(page, 'return solidFiles.ui.data.muzeSolidFilesViewStatus'),
    ''
  );
  assert.equal(
    await run(
      page,
      'return getComputedStyle(document.querySelector(".muze-solid-files-frame")).borderTopWidth'
    ),
    '0px'
  );
  assert.deepEqual(
    await run(
      page,
      `return [...document.querySelectorAll('.muze-solid-files-details button')]
    .filter(button=>button.checkVisibility()).map(button=>button.textContent.trim());`
    ),
    ['Back to files']
  );
  assert.equal(
    await run(
      page,
      'return document.querySelector(".muze-solid-files-title").title'
    ),
    'note.txt'
  );

  assert.equal(
    await run(page, 'return ' + viewer + '.runtime.host.selectedWebId'),
    origin + '/profile#me'
  );
  assert.equal(
    await run(page, 'return ' + viewer + '.runtime.host.session?.webId'),
    origin + '/profile#me'
  );
  assert.deepEqual(
    await run(
      page,
      `const app=${viewer};
    const doc=app.container.ownerDocument;
    return [...doc.querySelectorAll('button, input, select, a[href]')]
      .filter(control=>control.checkVisibility()).map(control=>control.textContent.trim());`
    ),
    [],
    'Embedded content has no duplicate account, preferences or resource controls'
  );
  assert.equal(
    await run(
      page,
      `const doc=${viewer}.container.ownerDocument;
    return doc.querySelector('.swb-suite-header').getClientRects().length;`
    ),
    0,
    'No empty toolbar space remains above the content'
  );
  await run(
    page,
    `const account=${viewer}.runtime.host.view;
    account.actions.message('Fixture: this resource needs attention.');`
  );
  await until(
    page,
    viewer +
      `.runtime.host.view.container.querySelector('.swb-suite-status').checkVisibility()`
  );
  await run(
    page,
    `const account=${viewer}.runtime.host.view;
    account.actions.message('');
    const dialog=account.container.querySelector('.muze-solid-ui-recovery-dialog');
    await account.actions.muzeSolidDesignOpenDialog(dialog);`
  );
  await until(
    page,
    viewer +
      `.runtime.host.view.container.querySelector('.muze-solid-ui-recovery-dialog').open`
  );
  assert.equal(
    await run(
      page,
      `return ${viewer}.runtime.host.view.container.querySelector(
    '[data-simply-command=muzeSolidUiSignInAgain]').checkVisibility();`
    ),
    true,
    'Request-specific recovery remains usable in a content-only view'
  );
  await run(
    page,
    `const account=${viewer}.runtime.host.view;
    await account.actions.muzeSolidDesignCloseDialog(
      account.container.querySelector('.muze-solid-ui-recovery-dialog'));`
  );
  const cold = await run(
    page,
    `const view=document.querySelector('.muze-solid-files-frame').contentWindow;
    const entries=[...view.performance.getEntriesByType('navigation'),
      ...view.performance.getEntriesByType('resource')];
    return {bytes:entries.reduce((sum,entry)=>sum+entry.transferSize,0),requests:entries.length};`
  );
  console.log('Cold usable viewer from Files at 50 KiB/s, 150ms:', {
    ...cold,
    milliseconds: readyMilliseconds
  });
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  assert.match(
    await run(page, 'return ' + viewer + '.data.muzeSolidViewerText'),
    /<script>/
  );
  assert.equal(await run(page, 'return Boolean(window.unsafeExecuted)'), false);
  assert.equal(
    await run(page, 'return ' + viewer + '.runtime.host.managed.incoming.size'),
    0
  );
  assert.equal(
    await run(
      page,
      'return [...solidFiles.ui.runtime.viewBroker.instances.values()][0].peer.pending.size'
    ),
    0
  );
  await run(
    page,
    `window.fixtureEvents=[];addEventListener('message',event=>{
    if(event.data?.type==='fixture-report')fixtureEvents.push(event.data);
  });
  await solidFiles.ui.runtime.resourceView.update({font:'serif',fontSize:20},
    solidFiles.ui.actions.muzeSolidFilesPresentation());`
  );
  assert.equal(
    await run(
      page,
      'return ' +
        viewer +
        '.data.muzeSolidViewerAppearance.style.includes("serif")'
    ),
    true
  );
  await run(
    page,
    'await solidFiles.ui.runtime.resourceView.update({},solidFiles.ui.actions.muzeSolidFilesPresentation())'
  );
  assert.equal(
    await run(
      page,
      'return ' +
        viewer +
        '.data.muzeSolidViewerAppearance.style.includes("monospace")'
    ),
    true
  );
  await writeFile(
    '/tmp/cyc168-files-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  for (const theme of ['light', 'dark']) {
    await run(
      page,
      `const app=${viewer};
      app.runtime.host.view.api.applyPreferences({theme:${JSON.stringify(theme)},textScale:'100'});
      const win=app.container.ownerDocument.defaultView;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
      const paint=canvas.getContext('2d');
      const rgba=value=>{paint.clearRect(0,0,1,1);paint.fillStyle=value;
        paint.fillRect(0,0,1,1);return [...paint.getImageData(0,0,1,1).data].join(',');};
      window.viewColours={text:rgba(win.getComputedStyle(app.container.querySelector('pre')).color),
        expected:rgba(win.getComputedStyle(app.container.ownerDocument.body).color)};`
    );
    const colours = await run(page, 'return window.viewColours');
    assert.equal(
      colours.text,
      colours.expected,
      'Viewer uses the theme foreground'
    );
  }
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert.equal(
    await run(
      page,
      `const list=document.querySelector('.ds-panels-list').getBoundingClientRect();
    const details=document.querySelector('.muze-solid-files-details').getBoundingClientRect();
    return details.left >= list.right;`
    ),
    true
  );
  assert.equal(
    await run(
      page,
      'return document.querySelector("[data-simply-command=browse]").checkVisibility()'
    ),
    true
  );
  await writeFile(
    '/tmp/cyc168-files-desktop.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });
  await run(
    page,
    'try {await solidFiles.ui.runtime.resourceView.operation("refresh");} catch {}'
  );
  assert.match(
    await run(page, 'return ' + viewer + '.data.muzeSolidViewerText'),
    /Hello/
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  const link = await run(
    page,
    `const link=document.querySelector('.muze-solid-files-title');
    link.scrollIntoView({block:'center'});
    const rect=link.getBoundingClientRect();return {href:link.href,x:rect.x+10,y:rect.y+10};`
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: link.x,
    y: link.y,
    button: 'left',
    clickCount: 1,
    modifiers: 2
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: link.x,
    y: link.y,
    button: 'left',
    clickCount: 1,
    modifiers: 2
  });
  let linkedTarget;
  for (let attempt = 0; attempt < 200; attempt++) {
    linkedTarget = (await page.send('Target.getTargets')).targetInfos.find(
      (target) =>
        target.type === 'page' && target.url.startsWith(origin + '/viewer/')
    );
    if (linkedTarget) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert(
    linkedTarget,
    'Ctrl-clicking the filename opens its viewer in a new tab'
  );
  const linkedPage = await chrome.page(linkedTarget.targetId);
  await until(
    linkedPage,
    'window.muzeSolidViewerApp?.data.muzeSolidViewerText.includes("Hello")'
  );
  await page.send('Target.closeTarget', { targetId: linkedTarget.targetId });
  await page.send('Page.bringToFront');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  unavailable = true;
  await run(
    page,
    'try {await solidFiles.ui.runtime.resourceView.operation("refresh");} catch {}'
  );
  await until(page, '!solidFiles.host.view.runtime.busy');
  assert.match(
    await run(page, 'return ' + viewer + '.data.muzeSolidViewerText'),
    /Hello/
  );
  unavailable = false;
  textContent = 'Updated through explicit refresh.';
  await run(
    page,
    'try {await solidFiles.ui.runtime.resourceView.operation("refresh");} catch {}'
  );
  await until(page, viewer + '.data.muzeSolidViewerText.includes("Updated")');
  await click(page, 'muzeSolidFilesBack');
  await until(
    page,
    'document.activeElement.getAttribute("aria-current")==="page"'
  );
  await run(
    page,
    'await solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/image.png")'
  );
  await until(page, 'solidFiles.ui.runtime.resourceView?.support?.ready');
  assert(
    (await run(
      page,
      'return ' + viewer + '.container.querySelector("img").naturalWidth'
    )) > 0
  );
  for (const type of [
    'Text/HTML; charset=utf-8',
    'text/turtle',
    'text/javascript',
    'text/css',
    'text/x-custom-format'
  ]) {
    const resource =
      origin + '/storage/source?type=' + encodeURIComponent(type);
    await run(
      page,
      'await solidFiles.ui.actions.muzeSolidFilesSelectDetails(' +
        JSON.stringify(resource) +
        ')'
    );
    await until(page, 'solidFiles.ui.runtime.resourceView?.support?.ready');
    assert.equal(
      await run(
        page,
        'return ' + viewer + '.container.querySelector("pre").textContent'
      ),
      '<script>parent.unsafeExecuted=true</script>'
    );
    assert.equal(
      await run(
        page,
        'return ' + viewer + '.container.querySelector("pre").children.length'
      ),
      0
    );
    assert.equal(
      await run(page, 'return Boolean(window.unsafeExecuted)'),
      false
    );
  }
  await run(
    page,
    'await solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/unsupported.bin")'
  );
  await until(
    page,
    'solidFiles.ui.data.muzeSolidFilesViewStatus.includes("unsupported")'
  );
  assert.equal(await run(page, 'return Boolean(window.unsafeExecuted)'), false);
  console.log(
    'PASS: built-in text/image rendering, refresh preservation and unsupported formats'
  );
  await run(
    page,
    'await solidFiles.ui.actions.muzeSolidFilesSelectDetails(' +
      JSON.stringify(origin + '/storage/' + encodeURIComponent(longName)) +
      ')'
  );
  await until(page, 'solidFiles.ui.runtime.resourceView?.support?.ready');
  for (const width of [390, 1280]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width === 390
    });
    const names = await run(
      page,
      `const title=document.querySelector('.muze-solid-files-title');
      const row=[...document.querySelectorAll('.swb-file-name')].find(button=>button.title===${JSON.stringify(longName)});
      const pane=document.querySelector('.muze-solid-files-details').getBoundingClientRect();
      const bounds=title.getBoundingClientRect();
      return {title:title.title,row:row.title,titleText:title.textContent.trim(),
        titleEllipsis:getComputedStyle(title).textOverflow,rowEllipsis:getComputedStyle(row).textOverflow,
        titleClipped:title.scrollWidth>title.clientWidth,rowClipped:row.scrollWidth>row.clientWidth,
        inside:bounds.width<=pane.width && bounds.right<=innerWidth+1,
        fullWidth:bounds.width>=pane.width-2};`
    );
    assert.equal(names.title, longName);
    assert.equal(names.row, longName);
    assert.equal(names.titleText, longName);
    assert.equal(names.titleEllipsis, 'ellipsis');
    assert.equal(names.rowEllipsis, 'ellipsis');
    assert(
      names.titleClipped && names.rowClipped && names.inside && names.fullWidth,
      JSON.stringify({ width, ...names })
    );
  }
  await until(page, 'getComputedStyle(document.querySelector(".muze-solid-files-frame")).opacity==="1"');
  await writeFile(
    '/tmp/cyc168-long-filenames.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  console.log(
    'PASS: automatic viewing, native Ctrl-click title link, no toolbar/border/Ready, shared loading UI and bounded filenames with full tooltips'
  );
  // An independent origin owns its draft and refuses transition without host DOM access.
  await run(
    page,
    'solidFiles.host.preferences.viewProvider={application:' +
      JSON.stringify(other) +
      ',url:' +
      JSON.stringify(other + '/') +
      '};await solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/note.txt")'
  );
  await until(page, 'solidFiles.ui.runtime.resourceView?.support?.ready');
  await until(page, 'fixtureEvents.some(value=>value.delegation==="denied")');
  await run(
    page,
    'await solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/image.png")'
  );
  assert.equal(
    await run(page, 'return solidFiles.ui.runtime.detailsResource'),
    origin + '/storage/note.txt'
  );
  assert.match(
    await run(page, 'return solidFiles.ui.data.muzeSolidFilesViewStatus'),
    /Finish the draft/
  );
  await run(
    page,
    'await solidFiles.ui.runtime.resourceView.update({font:"serif"},solidFiles.ui.actions.muzeSolidFilesPresentation())'
  );
  await until(
    page,
    'fixtureEvents.some(value=>value.draft==="keep this draft" && value.appearance?.font==="serif")'
  );
  await run(
    page,
    'document.querySelector(".muze-solid-files-frame").contentWindow.postMessage({type:"fixture-control",allowed:true},' +
      JSON.stringify(other) +
      ')'
  );
  await run(
    page,
    'await Promise.all([solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/image.png"),solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/note.txt")])'
  );
  assert.equal(
    await run(page, 'return solidFiles.ui.runtime.detailsResource'),
    origin + '/storage/note.txt'
  );
  await until(page, 'solidFiles.ui.runtime.resourceView?.support?.ready');
  await run(
    page,
    'document.querySelector(".muze-solid-files-frame").contentWindow.postMessage({type:"fixture-control",disconnect:true},' +
      JSON.stringify(other) +
      ')'
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await run(
    page,
    'await solidFiles.ui.actions.muzeSolidFilesSelectDetails(location.origin+"/storage/image.png")'
  );
  await until(page, 'document.querySelector("[data-simply-command=muzeSolidFilesDiscardView]").checkVisibility()');
  assert.equal(
    await run(page, 'return Boolean(solidFiles.ui.runtime.resourceView)'),
    true
  );
  await click(page, 'muzeSolidFilesDiscardView');
  await until(page, '!solidFiles.ui.runtime.resourceView');
  // The provider URL is also a useful app without a Workbench or parent.
  await run(
    page,
    'location.href="/viewer/#resource="+encodeURIComponent(location.origin+"/storage/note.txt")'
  );
  await until(
    page,
    'window.muzeSolidViewerApp?.data.muzeSolidViewerText.includes("Updated")'
  );
  await until(
    page,
    'document.querySelector(".swb-account-button").checkVisibility()'
  );
  assert.equal(
    await run(
      page,
      'return document.querySelector(".muze-solid-viewer-open").checkVisibility()'
    ),
    true
  );
  await run(page, 'document.querySelector(".swb-account-button").click()');
  await until(
    page,
    'document.querySelector("[data-simply-command=preferences]").checkVisibility()'
  );
  console.log(
    'PASS: embedded viewer has only view-specific content; standalone account/preferences and request recovery remain available'
  );
  await run(page, 'location.href="/workbench/"');
  await until(
    page,
    'window.solidLauncher?.workspace && solidLauncher.host.session'
  );
  await run(page, 'solidLauncher.workspace.open(location.origin+"/files/")');
  let managedFiles;
  for (let attempt = 0; attempt < 200; attempt++) {
    const targets = (await page.send('Target.getTargets')).targetInfos;
    const target = targets.find((item) => item.url === origin + '/files/');
    if (target) {
      managedFiles = await chrome.page(target.targetId);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert(managedFiles);
  await managedFiles.ready();
  await until(
    managedFiles,
    'window.solidFiles?.host.managed?.ready && solidFiles.ui.data.entries.length===4'
  );
  await click(managedFiles, 'open');
  await until(managedFiles, 'solidFiles.ui.runtime.detailsResource');
  await until(
    managedFiles,
    'solidFiles.ui.runtime.resourceView?.support?.ready'
  );
  const ticket = await run(
    managedFiles,
    'return solidFiles.ui.runtime.resourceView.ticket.id'
  );
  assert.equal(
    await run(
      page,
      'return solidLauncher.workspace.instances.has(' +
        JSON.stringify(ticket) +
        ')'
    ),
    true
  );
  await run(
    page,
    `const owner=solidLauncher.workspace.instances.get(${JSON.stringify(ticket)}).owner;
    await solidLauncher.workspace.remove(owner);`
  );
  assert.equal(
    await run(
      page,
      'return solidLauncher.workspace.instances.has(' +
        JSON.stringify(ticket) +
        ')'
    ),
    false
  );
  console.log(
    'PASS: managed Files routes views through Workbench and safely closes owned views'
  );
  assert.equal(writes.length, 0, 'Viewing does not write Pod resources');
  console.log(
    'PASS: Files phone view, finite ready, text/image rendering, unsupported refusal, refresh preservation, appearance reset, independent guarded transition, rapid selection, scoped denial, disconnect/discard and standalone viewing.'
  );
}
finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => external.close(resolve));
}
