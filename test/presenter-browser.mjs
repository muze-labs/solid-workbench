import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { independentViewPeer } from './support/independent-view-peer.mjs';
import { startChrome } from './support/chrome.mjs';
let origin, other;
let deckText = '';
let etag = '"1"';
let providerStartupError = '';
const writes = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/seed') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Fixture</title>');
    return;
  }
  if (url.pathname === '/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/profile#me> <http://xmlns.com/foaf/0.1/name> "Deck owner";
      <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`);
    return;
  }
  if (url.pathname === '/storage/') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/storage/> a <http://www.w3.org/ns/ldp#BasicContainer>;
      <http://www.w3.org/ns/ldp#contains> <${origin}/storage/image.jpg>.`);
    return;
  }
  if (url.pathname === '/storage/image.jpg') {
    response.setHeader('Content-Type', 'image/jpeg');
    response.end(
      await readFile(
        new URL('../apps/launcher/src/backgrounds/bg1.jpg', import.meta.url)
      )
    );
    return;
  }
  if (url.pathname === '/storage/deck.ttl') {
    if (request.method === 'PUT') {
      const body = [];
      for await (const chunk of request) {
        body.push(chunk);
      }
      writes.push(request.headers);
      if (deckText && request.headers['if-match'] !== etag) {
        response.writeHead(412).end();
        return;
      }
      if (!deckText && request.headers['if-none-match'] !== '*') {
        response.writeHead(428).end();
        return;
      }
      deckText = Buffer.concat(body).toString();
      response.writeHead(201, { ETag: etag }).end();
    } else if (!deckText) {
      response.writeHead(404).end();
    } else {
      response
        .writeHead(200, { 'Content-Type': 'text/turtle', ETag: etag })
        .end(deckText);
    }
    return;
  }
  try {
    let path = url.pathname;
    if (path.endsWith('/')) {
      path += 'index.html';
    }
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
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const external = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(independentViewPeer(origin, 'passive-bounded', {
    startupError: providerStartupError
  }));
});
await new Promise((resolve) => external.listen(0, '127.0.0.1', resolve));
other = 'http://127.0.0.1:' + external.address().port;
let chrome;
const measureCold = process.env.PRESENTER_COLD !== '0';
const app = 'globalThis.muzeSolidPresenterApp';
const editor = `document.querySelector('[data-kind="text"] iframe')?.contentWindow?.muzeSolidViewerApp`;
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
    'presenter-browser: Timed out: ' +
      expression +
      '\n' +
      (await run(page, 'return document.body.innerText'))
  );
}
async function click(page, command, index = 0) {
  await until(
    page,
    `document.querySelectorAll('[data-simply-command="${command}"]')[${index}] && !document.querySelectorAll('[data-simply-command="${command}"]')[${index}].matches(':disabled')`
  );
  await run(
    page,
    `const button=document.querySelectorAll('[data-simply-command="${command}"]')[${index}];
     for(let parent=button.parentElement;parent;parent=parent.parentElement){
       if(parent.tagName==='DETAILS'&&!parent.open)parent.querySelector('summary').click();
     }button.click()`
  );
}
async function idle(page) {
  await until(page, `${app} && !${app}.runtime.busy`);
}
async function editText(page, index, text) {
  await until(
    page,
    `${editor}?.runtime.cobaltEditor && ${editor}.runtime.cobaltInput.id===${app}.runtime.deck.regions(${app}.runtime.selected)[0]?.id && [...${app}.runtime.views.values()].some(view=>view.support?.editable && view.frame.checkVisibility())`
  );
  // Provider readiness can precede the first layout of its editable field.
  // Measuring it then gives a zero rectangle and taps the iframe's corner.
  await until(
    page,
    `(()=>{
      const field=${editor}.runtime.cobaltEditor.element;
      const bounds=field.getBoundingClientRect();
      return field.checkVisibility() && bounds.width>0 && bounds.height>0;
    })()`
  );
  const point = await run(
    page,
    `const ui=${editor};
    const field=ui.runtime.cobaltEditor.element;
    const frame=document.querySelector('[data-kind="text"] iframe');
    globalThis.presenterPointerClick=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Slide did not receive click')),3000);
      field.addEventListener('click',()=>{clearTimeout(timeout);resolve()},{once:true});
    });
    const inner=field.getBoundingClientRect();
    const outer=frame.getBoundingClientRect();
    return {x:outer.x+inner.x+inner.width/2,
      y:outer.y+inner.y+inner.height/2};`
  );
  if (await run(page, 'return innerWidth <= 650')) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point]
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
  } else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', {
        type,
        ...point,
        button: 'left',
        clickCount: 1
      });
    }
  }
  await run(page, 'await globalThis.presenterPointerClick');
  await until(
    page,
    `${editor}.runtime.cobaltEditor.element ===
    ${editor}.runtime.cobaltEditor.element.ownerDocument.activeElement`
  );
  // Use native selection and input so pointer-blocking CSS cannot be bypassed
  // by the editor API or a synthetic beforeinput event.
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'a',
    code: 'KeyA',
    windowsVirtualKeyCode: 65,
    modifiers: 2
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'a',
    code: 'KeyA',
    windowsVirtualKeyCode: 65,
    modifiers: 2
  });
  await page.send('Input.insertText', { text });
  await until(
    page,
    `${app}.runtime.deck.regions(${app}.runtime.selected)[0]?.fragment.text===${JSON.stringify(text)}`
  );
}
async function recoverEditor(page, text, viewport) {
  await run(
    page,
    `document.querySelector('[data-kind="text"] iframe').contentWindow.location.reload()`
  );
  await until(
    page,
    `/restarted|unavailable/.test(${app}.data.muzeSolidPresenterRegions[0].status)`
  );
  // A real size change exercises the disconnected provider's failed update.
  await page.send('Emulation.setDeviceMetricsOverride', {
    ...viewport,
    width: viewport.width + 1,
    deviceScaleFactor: 1
  });
  await until(
    page,
    `document.querySelector('[data-kind="text"] iframe').style.visibility==='hidden'`
  );
  await click(page, 'muzeSolidPresenterDiscardRegion', 0);
  await idle(page);
  await click(page, 'muzeSolidPresenterRetryRegion', 0);
  await idle(page);
  await until(
    page,
    `${editor}?.runtime.cobaltEditor?.getText()===${JSON.stringify(text)}`
  );
  await run(
    page,
    `document.querySelector('.muze-solid-presenter-view-options summary').click()`
  );
  await until(
    page,
    `document.querySelector('[data-kind="text"] iframe').checkVisibility()`
  );
  await editText(page, 0, text + ' after recovery');
  await editText(page, 0, text);
  await writeFile(
    viewport.mobile
      ? '/tmp/presenter-recovered-phone.png'
      : '/tmp/presenter-recovered-desktop.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    ...viewport,
    deviceScaleFactor: 1
  });
  console.log(
    `Provider restart recovery preserved text and native ${
      viewport.mobile ? 'touch' : 'mouse'
    } editing.`
  );
}
try {
  chrome = await startChrome(origin + '/seed', { allowPopups: true });
  const page = await chrome.page();
  await page.ready();
  let browserException;
  page.once('Runtime.exceptionThrown').then((value) => {
    browserException = value;
  });
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: measureCold ? 150 : 0,
    downloadThroughput: measureCold ? 50 * 1024 : -1,
    uploadThroughput: measureCold ? 25 * 1024 : -1
  });
  const coldStarted = Date.now();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await run(
    page,
    'localStorage.setItem("solid-apps.webId", location.origin+"/profile#me");location.href="/presenter/"'
  );
  await until(page, app);
  await click(page, 'muzeSolidUiAppAction', 0);
  await idle(page);
  await editText(page, 0, 'Our first deck');
  const cold = await run(
    page,
    `const entries=[...performance.getEntriesByType('resource'),...performance.getEntriesByType('navigation'),...[...document.querySelectorAll('.muze-solid-presenter-frame')].flatMap(f=>[...f.contentWindow.performance.getEntriesByType('resource'),...f.contentWindow.performance.getEntriesByType('navigation')])];return {bytes:entries.reduce((sum,e)=>sum+e.transferSize,0),requests:entries.length};`
  );
  console.log(
    'Cold editable slide: ' +
      JSON.stringify({
        throttled: measureCold,
        ms: Date.now() - coldStarted,
        ...cold
      })
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await recoverEditor(page, 'Our first deck', {
    width: 390,
    height: 844,
    mobile: true
  });
  await run(page, `const ui=${editor};ui.runtime.cobaltEditor.focus(0,3);`);
  await until(page, `${editor}.data.muzeSolidCobaltTools.hidden===null`);
  await run(
    page,
    `${editor}.container.querySelector('[data-simply-command="muzeSolidCobaltFormat"]').click()`
  );
  await until(
    page,
    `${app}.runtime.deck.regions(${app}.runtime.selected)[0].fragment.annotations.some(a=>a.tag==='<strong>')`
  );
  await run(
    page,
    `${editor}.container.querySelector('[data-simply-command="muzeSolidCobaltDock"]').click()`
  );
  await until(page, `${editor}.runtime.cobaltDocked===true`);
  await writeFile(
    '/tmp/presenter-toolbar-phone-docked.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await run(
    page,
    `${editor}.container.querySelector('[data-simply-command="muzeSolidCobaltDock"]').click()`
  );
  await run(
    page,
    `const ui=${editor};ui.runtime.cobaltEditor.focus(4,9);ui.container.querySelector('[data-simply-command="muzeSolidCobaltLink"]').click()`
  );
  await until(
    page,
    `${editor}.container.querySelector('.muze-solid-cobalt-link').checkVisibility()`
  );
  await until(
    page,
    `${editor}.container.querySelector('.muze-solid-cobalt-link input')===${editor}.container.ownerDocument.activeElement`
  );
  await run(
    page,
    `const ui=${editor};const form=ui.container.querySelector('.muze-solid-cobalt-link');form.elements.href.value='https://example.test/';form.requestSubmit()`
  );
  await until(
    page,
    `${app}.runtime.deck.regions(${app}.runtime.selected)[0].fragment.annotations.some(a=>a.tag.includes('https://example.test/'))`
  );
  assert.equal(
    await run(page, 'return document.documentElement.scrollWidth<=innerWidth'),
    true
  );
  assert(
    await run(
      page,
      `const ui=${editor};const r=ui.container.querySelector('.muze-solid-cobalt-tools').getBoundingClientRect();const w=ui.container.ownerDocument.defaultView;return r.left>=0&&r.top>=0&&r.right<=w.innerWidth+1&&r.bottom<=w.innerHeight+1;`
    )
  );
  await writeFile(
    '/tmp/presenter-toolbar-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await click(page, 'muzeSolidPresenterBackground');
  await until(
    page,
    `document.querySelector('.muze-solid-ui-capability-frame').contentWindow.solidFiles?.ui.runtime.pending`
  );
  await until(
    page,
    `document.querySelector('.muze-solid-ui-capability-frame').contentWindow.document.querySelector('[data-simply-command="selectResource"]')?.checkVisibility()`
  );
  await run(
    page,
    `document.querySelector('.muze-solid-ui-capability-frame').contentWindow.document.querySelector('[data-simply-command="selectResource"]').click()`
  );
  await idle(page);
  await until(
    page,
    `[...${app}.runtime.views.values()].filter(v=>v.support).length===2`
  );
  await until(
    page,
    `document.querySelector('.muze-solid-presenter-thumbnail-image').getAttribute('src')?.startsWith('blob:')`
  );
  await click(page, 'muzeSolidUiAppAction', 0);
  await idle(page);
  await editText(page, 0, 'Second slide');
  await click(page, 'muzeSolidPresenterMove', 0);
  await idle(page);
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '1 / 2'
  );
  await run(
    page,
    `${app}.data.muzeSolidPresenterUrl=location.origin+'/storage/deck.ttl'`
  );
  await click(page, 'muzeSolidPresenterSave');
  await idle(page);
  assert.equal(writes[0]['if-none-match'], '*');
  assert(deckText.includes('cobalt'));
  etag = '"other"';
  await editText(page, 0, 'Changed second slide');
  await click(page, 'muzeSolidPresenterSave');
  await idle(page);
  assert.match(
    await run(page, `return ${app}.data.muzeSolidPresenterStatus`),
    /changed elsewhere/
  );
  await until(
    page,
    `document.querySelector('[data-muze-solid-action="present"]')?.matches(':enabled')`
  );
  await page.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-muze-solid-action="present"]').click()`,
    userGesture: true
  });
  await idle(page);
  await until(page, `${app}.runtime.presenting && document.fullscreenElement`);
  await until(
    page,
    `document.activeElement?.dataset.simplyCommand==='muzeSolidPresenterExit'`
  );
  await writeFile(
    '/tmp/presenter-presentation-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'ArrowRight',
    code: 'ArrowRight',
    windowsVirtualKeyCode: 39
  });
  await until(page, `${app}.data.muzeSolidPresenterPosition==='2 / 2'`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await until(
    page,
    `!${app}.runtime.presenting && document.activeElement?.dataset.muzeSolidAction==='present'`
  );
  await run(page, 'location.reload()');
  await until(page, `${app}?.runtime.deck.slides().length===2`);
  await click(page, 'muzeSolidPresenterSelect', 1);
  await idle(page);
  await until(page, `${editor}?.runtime.cobaltEditor`);
  assert(
    await run(
      page,
      `return ${editor}.runtime.cobaltEditor.getValue().annotations.some(a=>a.tag==='<strong>')`
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await writeFile(
    '/tmp/presenter-toolbar-wide.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await run(page, `const ui=${editor};ui.runtime.cobaltEditor.focus(0,3);`);
  await writeFile(
    '/tmp/presenter-toolbar-wide-floating.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  const accessibility = await page.send('Accessibility.getFullAXTree');
  for (const label of ['Add slide', 'Present', 'Background']) {
    assert(
      accessibility.nodes.some(
        (node) => node.role?.value === 'button' && node.name?.value === label
      )
    );
  }
  await run(
    page,
    `for(const doc of [document,...[...document.querySelectorAll('.muze-solid-presenter-frame')].map(f=>f.contentDocument)]){doc.body.classList.remove('ds-darkmode','ds-darkmode-auto');doc.body.classList.add('ds-lightmode')}`
  );
  await writeFile(
    '/tmp/presenter-toolbar-wide-light.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await run(
    page,
    `for(const doc of [document,...[...document.querySelectorAll('.muze-solid-presenter-frame')].map(f=>f.contentDocument)]){doc.body.classList.remove('ds-lightmode');doc.body.classList.add('ds-darkmode')}`
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await editText(page, 0, 'Locally saved offline');
  assert.equal(await run(page, `return ${app}.runtime.deck.dirty`), true);
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  // A failing deck cache must not retire the provider's recovery copy.
  await run(
    page,
    `const deck=${app}.runtime.deck;window.restoreDeckSave=deck.persist;
    deck.persist=async()=>{throw new Error('fixture: local storage failed')};`
  );
  await editText(page, 0, 'Keep this draft');
  await until(
    page,
    `${editor}.runtime.cobaltRevision>${editor}.runtime.cobaltAcknowledged`
  );
  await click(page, 'muzeSolidPresenterSelect', 0);
  await idle(page);
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '2 / 2'
  );
  assert(
    await run(
      page,
      `return Boolean(await ${editor}.runtime.cobaltSource.load())`
    )
  );
  await run(page, `${app}.runtime.deck.persist=window.restoreDeckSave`);
  await click(page, 'muzeSolidPresenterSelect', 0);
  await idle(page);
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '1 / 2'
  );
  await click(page, 'muzeSolidPresenterSelect', 1);
  await idle(page);
  await until(page, `${editor}?.runtime.cobaltEditor`);
  assert.equal(
    await run(page, `return ${editor}.runtime.cobaltEditor.getText()`),
    'Keep this draft'
  );
  assert.equal(
    await run(page, `return await ${editor}.runtime.cobaltSource.load()`),
    ''
  );
  await run(
    page,
    `const ui=${editor};let rejected=false;
    try{await ui.actions.muzeSolidCobaltOperation({operation:'acknowledge',generation:ui.runtime.viewGeneration,revision:NaN})}
    catch{rejected=true}if(!rejected)throw new Error('Invalid revision accepted');`
  );
  await recoverEditor(page, 'Keep this draft', {
    width: 1280,
    height: 900,
    mobile: false
  });
  // Formatting is keyboard reachable; Escape dismisses without changing text.
  await run(
    page,
    `const ui=${editor};ui.runtime.cobaltEditor.focus(0,4);
    ui.runtime.cobaltEditor.element.dispatchEvent(new KeyboardEvent('keydown',{key:' ',ctrlKey:true,bubbles:true,cancelable:true}));`
  );
  await until(page, `${editor}.data.muzeSolidCobaltTools.hidden===null`);
  await until(
    page,
    `${editor}.container.querySelector('[data-simply-value="em"]')?.checkVisibility()`
  );
  await run(
    page,
    `const ui=${editor};const button=ui.container.querySelector('[data-simply-value="em"]');button.focus();`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    text: '\r',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await until(
    page,
    `${editor}.runtime.cobaltEditor.getValue().annotations.some(a=>a.tag==='<em>')`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27
  });
  await until(page, `${editor}.data.muzeSolidCobaltTools.hidden!==null`);
  assert.equal(
    await run(page, `return ${editor}.runtime.cobaltEditor.getText()`),
    'Keep this draft'
  );
  // Unsupported link schemes and markup leave the current fragment unchanged.
  await run(
    page,
    `const ui=${editor};ui.runtime.cobaltEditor.focus(0,4);
    ui.commands.muzeSolidCobaltLink.call(ui);const form=ui.container.querySelector('.muze-solid-cobalt-link');
    form.elements.href.value='javascript:alert(1)';ui.commands.muzeSolidCobaltApplyLink.call(ui,form);`
  );
  assert.match(
    await run(page, `return ${editor}.data.muzeSolidCobaltStatus`),
    /Unsupported link/
  );
  await run(
    page,
    `const ui=${editor};ui.data.muzeSolidCobaltLinkPanel={hidden:''};
    const clipboard=new DataTransfer();clipboard.setData('application/x-cobalt-fragment+json',JSON.stringify({text:'unsafe',annotations:[{range:[0,6],order:0,tag:'<a href="javascript:alert(1)">'}]}));
    ui.runtime.cobaltEditor.element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));`
  );
  assert.equal(
    await run(page, `return ${editor}.runtime.cobaltEditor.getText()`),
    'Keep this draft'
  );
  // Bounded read-only slides refuse overflow, then restore the editable surface.
  await editText(page, 0, 'More text than fits. '.repeat(100));
  await click(page, 'muzeSolidUiAppAction', 1);
  await idle(page);
  await until(
    page,
    `${app}.data.muzeSolidPresenterRegions[0].status.includes('does not fit')`
  );
  await click(page, 'muzeSolidPresenterExit');
  await until(page, `${editor}?.runtime.cobaltReadOnly===false`);
  await editText(page, 0, 'A recovered slide');
  // Independent image providers keep their existing close veto and authority.
  await run(
    page,
    `window.presenterReports=[];addEventListener('message',event=>{
    if(event.origin===${JSON.stringify(other)}&&event.data?.type==='fixture-report')presenterReports.push(event.data);
  });${app}.runtime.host.preferences.viewProvider={application:${JSON.stringify(other)},url:${JSON.stringify(other + '/')}};`
  );
  providerStartupError = 'Sign in again to continue with Solid.';
  await click(page, 'muzeSolidPresenterUseProvider', 1);
  await idle(page);
  await until(
    page,
    `${app}.data.muzeSolidPresenterRegions[1].status.includes('Sign in again')`
  );
  await click(page, 'muzeSolidPresenterSelect', 0);
  await idle(page);
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '1 / 2'
  );
  await click(page, 'muzeSolidPresenterSelect', 1);
  await idle(page);
  providerStartupError = '';
  await run(
    page,
    `${app}.runtime.host.view.actions.muzeSolidUiAuthenticationRestored()`
  );
  await click(page, 'muzeSolidPresenterRetryRegion', 1);
  await idle(page);
  await until(page, 'presenterReports.some(r=>r.delegation==="denied")');
  console.log('Failed startup permits slide navigation and retry after restored access.');
  await click(page, 'muzeSolidPresenterSelect', 0);
  await idle(page);
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '2 / 2'
  );
  assert.equal(
    await run(page, 'return presenterReports.at(-1).draft'),
    'keep this draft'
  );
  await run(
    page,
    `const view=[...${app}.runtime.views.values()].find(v=>v.url.origin===${JSON.stringify(other)});
    view.frame.contentWindow.postMessage({type:'fixture-control',allowed:true},${JSON.stringify(other)});`
  );
  await click(page, 'muzeSolidPresenterSelect', 0);
  await idle(page);
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '1 / 2'
  );
  // The same UI also works as a Workbench-managed app and routes through its broker.
  await run(page, 'location.href="/workbench/"');
  await until(page, 'globalThis.solidLauncher?.workspace');
  await until(
    page,
    `new URLSearchParams(new URL(document.querySelector('[data-simply-field="presenterLink"]').href).hash.slice(1)).get('webid')===location.origin+'/profile#me'`
  );
  await run(
    page,
    `document.querySelector('.muze-solid-launcher-suite-apps').open=true;
    localStorage.setItem('solid-apps.webId',location.origin+'/other-profile#me');
    document.querySelector('[data-simply-field="presenterLink"]').click()`
  );
  let managedPage;
  for (let attempt = 0; attempt < 100; attempt++) {
    const targets = (await page.send('Target.getTargets')).targetInfos;
    const target = targets.find(
      (target) => target.type === 'page' && target.url.includes('/presenter/')
    );
    if (target) {
      managedPage = await chrome.page(target.targetId);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(managedPage, 'Presenter opened through the Suite apps link');
  await managedPage.ready();
  await until(managedPage, `${app}?.runtime.host.managed?.ready`);
  assert.equal(
    await run(
      managedPage,
      `return Boolean(${app}.runtime.host.capabilityBroker)`
    ),
    false
  );
  assert.equal(
    await run(managedPage, `return ${app}.runtime.host.selectedWebId`),
    origin + '/other-profile#me'
  );
  assert.equal(
    await run(managedPage, `return ${app}.runtime.host.launch.webId`),
    origin + '/profile#me'
  );
  assert.match(
    await run(managedPage, 'return document.body.innerText'),
    /different WebID/
  );
  await run(
    managedPage,
    `localStorage.setItem('solid-apps.webId',location.origin+'/profile#me');location.reload()`
  );
  await until(
    managedPage,
    `${app}?.runtime.host.managed?.ready && ${app}.runtime.host.selectedWebId===location.origin+'/profile#me'`
  );
  await run(
    managedPage,
    `const ui=${app}.runtime.host.view;
    await ui.commands.muzeSolidUiDisconnect.call(ui);`
  );
  assert.equal(
    await run(managedPage, `return ${app}.runtime.host.session?.disconnected`),
    true
  );
  await click(managedPage, 'muzeSolidPresenterSelect', 1);
  await idle(managedPage);
  await editText(managedPage, 0, 'Managed disconnected slide');
  await click(managedPage, 'muzeSolidPresenterSelect', 0);
  await idle(managedPage);
  await editText(managedPage, 0, 'Managed Presenter');
  console.log('Managed Disconnect, slide switching and native editing passed.');
  // Exercise the native browser IME, then the real broker/local RDF save path.
  await run(
    managedPage,
    `const ui=${editor};
    globalThis.compositionChanges=[];
    ui.runtime.cobaltEditor.element.addEventListener('cobalt:change',event=>{
      globalThis.compositionChanges.push(event.detail.fragment.text);
    });
    ui.runtime.cobaltEditor.focus(0,ui.runtime.cobaltEditor.getLength());`
  );
  await managedPage.send('Input.imeSetComposition', {
    text: 'café',
    selectionStart: 4,
    selectionEnd: 4
  });
  assert.deepEqual(
    await run(
      managedPage,
      `const ui=${editor};return {
    composing:ui.runtime.cobaltEditor.isComposing(),
    model:ui.runtime.cobaltEditor.getText(),
    visible:ui.runtime.cobaltEditor.element.textContent,
    changes:globalThis.compositionChanges
  }`
    ),
    {
      composing: true,
      model: 'Managed Presenter',
      visible: 'café',
      changes: []
    }
  );
  await run(
    managedPage,
    `const ui=${editor};
    const generation=ui.runtime.viewGeneration;
    const result=await ui.actions.muzeSolidCobaltOperation({operation:'prepare',generation});
    if(result.allowed||result.frozen)throw new Error('Composition was discarded');
    for(const operation of ['read','update']){
      let rejected=false;
      try{await ui.actions.muzeSolidCobaltOperation({operation,generation,
        presentation:{interaction:'passive',geometry:'bounded',fit:'contain',visible:true,width:640,height:360}})}
      catch{rejected=true}
      if(!rejected)throw new Error('Composition did not guard '+operation);
    }
    if(!ui.runtime.cobaltEditor.isComposing())throw new Error('Composition lost');
    const view=[...${app}.runtime.views.values()].find(view=>view.support?.editable);
    const close=await view.broker.canCloseEmbedded(view.ticket.id);
    if(close.allowed)throw new Error('Broker allowed unfinished composition closure');`
  );
  await managedPage.send('Input.insertText', { text: 'café' });
  await until(
    managedPage,
    `${app}.runtime.deck.regions(${app}.runtime.selected)[0]?.fragment.text==='café'`
  );
  assert.deepEqual(
    await run(managedPage, 'return globalThis.compositionChanges'),
    ['café']
  );
  // A second language and supplementary-plane character use the same path.
  await run(
    managedPage,
    `const ui=${editor};ui.runtime.cobaltEditor.focus(0,4)`
  );
  await managedPage.send('Input.imeSetComposition', {
    text: '日本語😀',
    selectionStart: 5,
    selectionEnd: 5
  });
  await managedPage.send('Input.insertText', { text: '日本語😀' });
  await until(
    managedPage,
    `${app}.runtime.deck.regions(${app}.runtime.selected)[0]?.fragment.text==='日本語😀'`
  );
  await run(managedPage, `const ui=${editor};ui.runtime.cobaltEditor.focus(5)`);
  await managedPage.send('Input.imeSetComposition', {
    text: 'pending',
    selectionStart: 7,
    selectionEnd: 7
  });
  await managedPage.send('Input.imeSetComposition', {
    text: '',
    selectionStart: 0,
    selectionEnd: 0
  });
  assert.equal(
    await run(managedPage, `return ${editor}.runtime.cobaltEditor.getText()`),
    '日本語😀'
  );
  assert.deepEqual(
    await run(managedPage, 'return globalThis.compositionChanges'),
    ['café', '日本語😀']
  );
  await run(
    managedPage,
    `await ${app}.actions.muzeSolidPresenterCollectAll();location.reload()`
  );
  await until(
    managedPage,
    `${app}?.runtime.host.managed?.ready && ${editor}?.runtime.cobaltEditor?.getText()==='日本語😀'`
  );
  console.log(
    'Native Chrome composition commits, guarded teardown and RDF reload passed.'
  );

  await until(
    managedPage,
    `[...${app}.runtime.views.values()].some(view=>view.support)`
  );
  await run(
    managedPage,
    `const ui=${editor};const field=ui.runtime.cobaltEditor.element;
    await ${app}.actions.muzeSolidPresenterCollectAll();
    const result=await ui.actions.muzeSolidCobaltOperation({operation:'prepare',generation:ui.runtime.viewGeneration});
    if(!result.frozen||field.isContentEditable||!field.inert)throw new Error('Editor did not freeze');
    let rejected=false;try{await ui.actions.muzeSolidCobaltOperation({operation:'update',generation:ui.runtime.viewGeneration,presentation:{interaction:'interactive',geometry:'bounded',fit:'contain'}})}catch{rejected=true}
    if(!rejected)throw new Error('Prepared editor resumed');`
  );
  assert.equal(browserException, undefined, JSON.stringify(browserException));
  console.log(
    'Presenter inline formatting, dock/float, image selection, thumbnails, native reload, conditional conflict, keyboard presentation and loaded-offline autosave passed.'
  );
} finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => external.close(resolve));
}
