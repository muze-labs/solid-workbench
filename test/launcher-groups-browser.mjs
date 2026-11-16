import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';

let origin;
let authoringRequests = 0;
let remoteApps = '<#root> <urn:unrelated> "preserve".';
let remoteVersion = 1;
const folders = new Set();
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  if (url.pathname.startsWith('/assets/authoring/')) {
    authoringRequests += 1;
    response.writeHead(404).end('Optional authoring sources unavailable');
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/remote-apps.ttl') {
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      remoteApps = Buffer.concat(chunks).toString();
      remoteVersion += 1;
    }
    response.writeHead(200, {
      'Content-Type': 'text/turtle',
      ETag: '"' + remoteVersion + '"'
    });
    response.end(request.method === 'GET' ? remoteApps : '');
    return;
  }
  if (url.pathname === '/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/profile#me> <http://xmlns.com/foaf/0.1/name> "Demo user";
      <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`);
    return;
  }
  if (request.method === 'PUT' && url.pathname.startsWith('/storage/')) {
    assert.equal(request.headers['if-none-match'], '*');
    assert.match(request.headers.link, /BasicContainer/);
    assert.equal(request.headers['content-type'], 'text/turtle');
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    assert.equal(
      Buffer.concat(chunks).byteLength,
      0,
      'Metro replays the normal empty container body without a dummy comment'
    );
    if (url.pathname.includes('/Unavailable/')) {
      response.writeHead(503).end('Unavailable');
      return;
    }
    folders.add(url.pathname);
    response.writeHead(201, { ETag: '"demo"' }).end();
    return;
  }
  if (url.pathname.startsWith('/storage/')) {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${url.href}> a <http://www.w3.org/ns/ldp#BasicContainer>.
      ${[...folders].map((path) => `<${origin}/storage/> <http://www.w3.org/ns/ldp#contains> <${origin}${path}>.`).join('\n')}`);
    return;
  }
  try {
    const path =
      url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
    const data = await readFile(new URL('../www' + path, import.meta.url));
    response.setHeader(
      'Content-Type',
      {
        js: 'text/javascript',
        css: 'text/css',
        svg: 'image/svg+xml',
        ttl: 'text/turtle',
        ico: 'image/x-icon',
        png: 'image/png'
      }[path.split('.').pop()] || 'text/html'
    );
    response.end(data);
  }
  catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
let chrome, page;
async function evaluate(expression) {
  const result = await page.send('Runtime.evaluate', {
    expression:
      'globalThis.muzeSolidLauncherTestEvaluation = (' + expression + ')',
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(expression) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await evaluate('Boolean(' + expression + ')')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    'Timed out: ' +
      expression +
      '\n' +
      (await evaluate(
        `JSON.stringify({text:document.body.innerText,dragPoint:solidLauncher?.ui.runtime.launcherDragPoint,dragging:solidLauncher?.ui.runtime.swbShortcutDragging,scroll:document.querySelector('.muze-solid-launcher-screens')?.scrollTop,loop:solidLauncher?.ui.runtime.launcherDragScroll})`
      ))
  );
}
async function click(selector) {
  const point = await evaluate(`(() => {
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.checkVisibility());
    element.scrollIntoView({ block: 'center' });
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...point,
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...point,
    button: 'left',
    clickCount: 1
  });
}
async function key(key, code, virtual, text) {
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: virtual,
    ...(text ? { text } : {})
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: virtual
  });
}
async function visit(route) {
  await page.send('Page.navigate', { url: origin + '/' + route + '/' });
  await page.ready();
}
async function capture(name) {
  await wait('!document.getAnimations().some(a => a.playState === "running")');
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
    name + ' fits viewport'
  );
  await writeFile(
    '/tmp/demo-' + name + '.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
}

try {
  chrome = await startChrome(origin + '/workbench/', { hoverPointer: true });
  page = await chrome.page();
  page
    .once('Runtime.exceptionThrown')
    .then((error) => console.log('Browser exception', JSON.stringify(error)));
  page
    .once('Runtime.consoleAPICalled')
    .then((error) => console.log('Browser console', JSON.stringify(error)));
  await page.send('Runtime.enable');
  await page.ready();
  await wait('window.solidLauncher?.store');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await evaluate(`(async () => {
    const app=solidLauncher.ui;
    for (const name of ['Notebook','Presenter','Preferences','Contacts and profiles','Files']) {
      await app.actions.addShortcut({name,url:location.origin+'/files/?'+name,
        mode:'',anonymous:false});
    }
  })()`);
  await wait('document.querySelectorAll(".swb-shortcut-link").length===5');
  await evaluate(`(async () => {
    const session=await solidLauncher.host.view.api.connectSession(location.origin+'/profile#me',undefined,{interactive:false});
    await solidLauncher.ui.runtime.store.connect(session,location.origin+'/remote-apps.ttl');
    solidLauncher.ui.actions.render();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);

  await wait(
    'document.querySelector("[data-simply-command=muzeSolidLauncherPreviousScreen]").hidden && document.querySelector("[data-simply-command=muzeSolidLauncherNextScreen]").hidden'
  );
  const floating = {};
  for (const mode of ['light', 'dark']) {
    floating[mode] = await evaluate(`(() => {
      document.body.classList.remove('ds-lightmode','ds-darkmode','ds-darkmode-auto');
      document.body.classList.add('ds-${mode}mode');
      const button=document.querySelector('.swb-add-shortcut');
      const style=getComputedStyle(button);
      return {label:button.getAttribute('aria-label'),text:button.textContent.trim(),
        radius:style.borderRadius,shadow:style.boxShadow,background:style.backgroundColor,
        width:button.getBoundingClientRect().width};
    })()`);
    assert.equal(floating[mode].label, 'Add apps');
    assert.equal(floating[mode].text, '');
    assert.equal(floating[mode].radius, '50%');
    assert.equal(floating[mode].width, 56);
    assert.notEqual(floating[mode].shadow, 'none');
    assert.notEqual(floating[mode].background, 'rgba(0, 0, 0, 0)');
  }
  assert.notEqual(floating.light.shadow, floating.dark.shadow);
  assert.equal(
    await evaluate(`(() => {
    const label=document.querySelector('.muze-solid-launcher-label');
    return getComputedStyle(label).fontSize==='16px' &&
      label.getBoundingClientRect().width>=90;
  })()`),
    true
  );
  assert.equal(
    await evaluate(`(() => {
    const scroller=document.querySelector('.muze-solid-launcher-screens');
    const screen=scroller.querySelector('.muze-solid-launcher-screen');
    const add=document.querySelector('.swb-add-shortcut').getBoundingClientRect();
    return Math.abs(scroller.getBoundingClientRect().bottom-innerHeight)<1 &&
      screen.getBoundingClientRect().height+0.5>=scroller.clientHeight && add.left===16;
  })()`),
    true,
    'Screens fill available viewport; scrollbar stays at bottom and Add is at left'
  );
  await capture('launcher-four-column-labels-phone');
  await evaluate(`document.documentElement.style.fontSize='120%'`);
  assert.equal(await evaluate(`(() => {
    const labels=[...document.querySelectorAll('.muze-solid-design-label-one-line')];
    return labels.some(label=>label.scrollWidth>label.clientWidth) &&
      labels.every(label=>getComputedStyle(label).textOverflow==='ellipsis' &&
        getComputedStyle(label).whiteSpace==='nowrap' && getComputedStyle(label).display==='block');
  })()`),true,'Overflowing single-word names use native ellipsis at enlarged text size');
  await capture('launcher-label-ellipsis-phone-120');
  await evaluate(`document.documentElement.style.fontSize='100%'`);

  const initialIconTop = await evaluate(
    "document.querySelector('.swb-shortcut-link').getBoundingClientRect().top"
  );
  await evaluate(
    `solidLauncher.ui.actions.muzeSolidLauncherCreateScreen('Work')`
  );
  await wait(
    'document.querySelectorAll(".muze-solid-launcher-screen:not([hidden])").length===2'
  );
  await wait(
    '!document.querySelector("[data-simply-command=muzeSolidLauncherNextScreen]").hidden'
  );
  assert.equal(
    await evaluate(
      'document.querySelector("[data-simply-command=muzeSolidLauncherPreviousScreen]").hidden'
    ),
    true
  );
  await click('[data-simply-command=muzeSolidLauncherNextScreen]');
  await wait(
    '!document.querySelector("[data-simply-command=muzeSolidLauncherPreviousScreen]").hidden'
  );
  await wait(
    'document.querySelector("[data-simply-command=muzeSolidLauncherNextScreen]").hidden'
  );
  await click('[data-simply-command=muzeSolidLauncherPreviousScreen]');
  await wait(
    'document.querySelector("[data-simply-command=muzeSolidLauncherPreviousScreen]").hidden'
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.swb-shortcut-link').getBoundingClientRect().top"
    ),
    initialIconTop
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.muze-solid-launcher-chevron')).position"
    ),
    'fixed'
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.muze-solid-launcher-chevron')).fontSize"
    ),
    '48px'
  );
  console.log(
    'PASS independent chevrons, readable labels and round floating Add action with shadow/glow'
  );
  const group = await evaluate(
    'solidLauncher.ui.runtime.launcherScreens.state.data[0].id'
  );
  await evaluate(`solidLauncher.ui.actions.swbMoveShortcut(
    solidLauncher.ui.data.shortcuts[0].id,null,false,${JSON.stringify(group)})`);
  await wait(
    `document.querySelectorAll('[data-muze-solid-launcher-screen="${group}"] .swb-shortcut-link').length===1`
  );
  await capture('launcher-groups-phone');
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('.swb-launcher-grid')).gridTemplateColumns.split(' ').length`
    ),
    4
  );
  await page.send('Page.reload');
  await page.ready();
  await wait('window.solidLauncher?.store');
  await wait(
    'document.querySelectorAll(".muze-solid-launcher-screen:not([hidden])").length===2'
  );
  assert.equal(
    await evaluate(
      `solidLauncher.ui.data.shortcuts.filter(row=>row.group===${JSON.stringify(group)}).length`
    ),
    1
  );
  console.log('PASS four columns, group move and reload');
  await evaluate(`(async () => {
    const session=await solidLauncher.host.view.api.connectSession(location.origin+'/profile#me',undefined,{interactive:false});
    await solidLauncher.ui.runtime.store.connect(session,location.origin+'/remote-apps.ttl');
    solidLauncher.ui.actions.render();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);

  // Keyboard/menu move to another screen's end uses the same saved operation.
  await wait(
    `document.querySelectorAll('[data-muze-solid-launcher-screen="${group}"] .swb-shortcut-link').length===1 && document.querySelectorAll('[data-muze-solid-launcher-screen=""] .swb-shortcut-link').length===4`
  );

  await evaluate(`(() => {
    const screen=document.querySelector('[data-muze-solid-launcher-screen=""]');
    screen.querySelector('.swb-shortcut-link').focus();
  })()`);
  await wait("document.activeElement.matches('.swb-shortcut-link')");
  await key('ContextMenu', 'ContextMenu', 93);
  await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    `solidLauncher.ui.runtime.swbShortcutMoving && getComputedStyle(document.querySelector('[data-muze-solid-launcher-screen="${group}"] .muze-solid-launcher-screen-end')).display !== 'none'`
  );
  await evaluate(
    `document.querySelector('[data-muze-solid-launcher-screen="${group}"] .muze-solid-launcher-screen-end').focus()`
  );
  await wait(
    "document.activeElement.matches('.muze-solid-launcher-screen-end')"
  );
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    `solidLauncher.ui.data.shortcuts.filter(row=>row.group===${JSON.stringify(group)}).length===2`
  );
  console.log('PASS keyboard context-menu movement between screens');

  await wait(
    `document.querySelector('.swb-shortcut-link')?.getBoundingClientRect().width > 0`
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await page.send('Input.setInterceptDrags', { enabled: true });
  const source = await evaluate(`(async () => {
    const link=[...document.querySelectorAll('[data-muze-solid-launcher-screen=""] .swb-shortcut-link')].at(-1);
    link.focus(); link.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=link.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await capture('launcher-groups-before-drag');
  const intercepted = page.once('Input.dragIntercepted');
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    ...source
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...source,
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: source.x + 20,
    y: source.y + 10,
    button: 'left',
    buttons: 1
  });
  const drag = await Promise.race([
    intercepted,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Drag did not start')), 5000)
    )
  ]);
  await wait(
    'document.querySelectorAll(".muze-solid-launcher-screen:not([hidden])").length===3'
  );
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('.muze-solid-launcher-screen')].every(screen=>getComputedStyle(screen).borderTopStyle==='dashed')`
    ),
    true
  );
  assert.equal(await evaluate(`[...document.querySelectorAll('.muze-solid-launcher-move-label')].every(label=>getComputedStyle(label).display==='none')`),true,
    'Drag targets use borders without Move here text');
  const markerHeights=[];
  for (const index of [0,1]) {
    const point=await evaluate(`(() => {
      const row=document.querySelectorAll('[data-muze-solid-launcher-screen=""] [data-swb-shortcut]')[${index}];
      const r=row.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+30};
    })()`);
    await page.send('Input.dispatchDragEvent',{type:'dragEnter',...point,data:drag.data});
    const previousPreview=await evaluate('solidLauncher.ui.runtime.shortcuts.state.options.insertBefore');
    await page.send('Input.dispatchDragEvent',{type:'dragOver',...point,data:drag.data});
    if (index===1) {
      assert.equal(await evaluate('solidLauncher.ui.runtime.shortcuts.state.options.insertBefore'),previousPreview,
        'Brief traversal does not flash an intermediate marker');
    }
    await wait(`document.querySelector('.muze-solid-design-insert-before')===document.querySelectorAll('[data-muze-solid-launcher-screen=""] [data-swb-shortcut]')[${index}]`);
    const marker=await evaluate(`(() => {
      const row=document.querySelector('.muze-solid-design-insert-before');
      const style=getComputedStyle(row,'::before');
      return {height:style.height,left:style.left};
    })()`);
    markerHeights.push(marker.height);
    if (index===0) { assert.equal(marker.left,'4px'); }
  }
  assert.deepEqual(markerHeights,['64px','64px']);
  console.log('PASS first-slot marker stays inside its screen and all markers have icon height');
  const before = await evaluate(
    'document.querySelector(".muze-solid-launcher-screens").scrollLeft'
  );
  await page.send('Input.dispatchDragEvent', {
    type: 'dragEnter',
    x: 385,
    y: 300,
    data: drag.data
  });
  await page.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    x: 385,
    y: 300,
    data: drag.data
  });
  await wait(
    `document.querySelector('.muze-solid-launcher-screens').scrollLeft > ${before}+80`
  );
  await wait(
    `document.querySelector('.muze-solid-launcher-screens').scrollLeft > 600`
  );
  const drop = await evaluate(`(() => {
    const r=document.querySelector('[data-muze-solid-launcher-screen="new"]').getBoundingClientRect();
    return {x:Math.min(innerWidth-20,r.x+40),y:r.y+r.height/2};
  })()`);
  await page.send('Input.dispatchDragEvent', {
    type: 'dragEnter',
    ...drop,
    data: drag.data
  });
  await page.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    ...drop,
    data: drag.data
  });
  await page.send('Input.dispatchDragEvent', {
    type: 'drop',
    ...drop,
    data: drag.data
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...drop,
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.setInterceptDrags', { enabled: false });
  await wait('solidLauncher.ui.runtime.launcherScreens.state.data.length===2');
  await wait(
    'document.querySelector("[data-muze-solid-launcher-screen=new]").hidden'
  );
  assert.equal(
    await evaluate('solidLauncher.ui.runtime.launcherDragScroll'),
    null
  );
  console.log(
    'PASS native drag outlines, empty trailing screen, horizontal edge scroll and drop-created group'
  );
  await evaluate(
    '(async()=>{await solidLauncher.ui.runtime.store.sync(); return true;})()'
  );
  assert.match(remoteApps, /shortcutGroup/);
  const beforeNativeReload = await evaluate(
    'solidLauncher.ui.data.shortcuts.map(row=>({id:row.id,group:row.group,order:row.order}))'
  );
  await page.send('Page.reload');
  await page.ready();
  await wait('window.solidLauncher?.store');
  await wait('solidLauncher.ui.data.shortcuts.length===5');
  assert.deepEqual(
    await evaluate(
      'solidLauncher.ui.data.shortcuts.map(row=>({id:row.id,group:row.group,order:row.order}))'
    ),
    beforeNativeReload
  );
  console.log('PASS native drop membership and order survive reload');
  await evaluate(`(async () => {
    const session=await solidLauncher.host.view.api.connectSession(location.origin+'/profile#me',undefined,{interactive:false});
    await solidLauncher.ui.runtime.store.connect(session,location.origin+'/remote-apps.ttl');
    solidLauncher.ui.actions.render();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);
  assert.deepEqual(
    await evaluate(
      'solidLauncher.ui.data.shortcuts.map(row=>({id:row.id,group:row.group,order:row.order}))'
    ),
    beforeNativeReload
  );
  console.log('PASS native drop membership survives Pod sync and reconnect');

  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await capture('launcher-groups-desktop');
  assert.equal(
    await evaluate(
      `document.querySelector('[data-simply-command=muzeSolidLauncherRenameScreen]')`
    ),
    null
  );
  // An empty intermediate group stays while the screen to its right is occupied.
  await evaluate(`(async () => {
    const app=solidLauncher.ui;
    for (const row of app.data.shortcuts.filter(row=>row.group===${JSON.stringify(group)})) {
      await app.actions.swbMoveShortcut(row.id,null,false,'');
    }
  })()`);
  await wait(
    `solidLauncher.ui.data.shortcuts.filter(row=>row.group===${JSON.stringify(group)}).length===0`
  );
  assert.equal(
    await evaluate(
      'solidLauncher.ui.runtime.launcherScreens.state.data.length'
    ),
    2
  );
  await evaluate(`(async () => {
    const app=solidLauncher.ui;
    for (const row of app.data.shortcuts.filter(row=>row.group)) {
      await app.actions.swbMoveShortcut(row.id,null,false,'');
    }
  })()`);
  await wait('solidLauncher.ui.runtime.launcherScreens.state.data.length===0');
  assert.equal(await evaluate('solidLauncher.ui.data.shortcuts.length'), 5);
  console.log(
    'PASS empty intermediate screens stay; trailing empty screens trim without deleting apps'
  );
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });
  await wait(`document.querySelectorAll('.muze-solid-launcher-screen:not([hidden])').length===1 &&
    document.querySelectorAll('[data-muze-solid-launcher-screen=""] .swb-shortcut-link').length===5`);
  // Native fixtures can issue the next key before the binding throttle publishes
  // a just-completed multi-move. Wait for that rendered state before focusing.
  await new Promise(resolve=>setTimeout(resolve,100));
  await evaluate(`document.querySelector('.swb-shortcut-link').focus()`);
  await wait("document.activeElement.matches('.swb-shortcut-link')");
  await key('ContextMenu', 'ContextMenu', 93);
  await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
  for (let index = 0; index < 3; index++) {
    await key('ArrowDown', 'ArrowDown', 40);
  }
  await wait("document.activeElement.dataset.simplyCommand==='swbShortcutMoveTo'");
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    `document.querySelector('[data-simply-command=muzeSolidLauncherDropOnNewScreen]').checkVisibility()`
  );
  await evaluate(
    `document.querySelector('[data-simply-command=muzeSolidLauncherDropOnNewScreen]').focus()`
  );
  await wait(
    `document.activeElement.dataset.simplyCommand==='muzeSolidLauncherDropOnNewScreen'`
  );
  await key('Enter', 'Enter', 13, '\r');
  await wait('solidLauncher.ui.runtime.launcherScreens.state.data.length===1');
  await wait(
    'document.querySelector("[data-muze-solid-launcher-screen=new]").hidden'
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await page.send('Page.reload');
  await page.ready();
  await wait('window.solidLauncher?.store');
  await wait('solidLauncher.ui.runtime.launcherScreens.state.data.length===1');
  await evaluate(`solidLauncher.ui.actions.swbMoveShortcut(
    solidLauncher.ui.data.shortcuts.find(row=>row.group).id,null,false,'')`);
  await wait('solidLauncher.ui.runtime.launcherScreens.state.data.length===0');
  console.log(
    'PASS keyboard-only screen creation works loaded offline and survives reload'
  );

  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await evaluate(`(async () => {
    const app=solidLauncher.ui;
    app.runtime.launcherAddScreen='';
    for (let index=0;index<36;index++) {
      await app.actions.addShortcut({name:'App '+index,url:location.origin+'/files/?extra='+index,
        mode:'',anonymous:false});
    }
  })()`);
  await wait('document.querySelectorAll(".swb-shortcut-link").length===41');
  await wait(
    'document.querySelector(".swb-shortcut-link").getBoundingClientRect().width>0'
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await page.send('Input.setInterceptDrags', { enabled: true });
  const tallSource = await evaluate(`(async () => {
    const link=document.querySelector('.swb-shortcut-link');
    link.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=link.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  const tallIntercepted = page.once('Input.dragIntercepted');
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    ...tallSource
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...tallSource,
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: tallSource.x + 20,
    y: tallSource.y + 10,
    button: 'left',
    buttons: 1
  });
  const tallDrag = await tallIntercepted;
  await page.send('Input.dispatchDragEvent', {
    type: 'dragEnter',
    x: 195,
    y: 839,
    data: tallDrag.data
  });
  await page.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    x: 195,
    y: 839,
    data: tallDrag.data
  });
  await wait(
    'document.querySelector(".muze-solid-launcher-screens").scrollTop>100'
  );
  assert.equal(
    await evaluate(`(() => {
    const scroller=document.querySelector('.muze-solid-launcher-screens');
    return scroller.querySelector('.muze-solid-launcher-screen').getBoundingClientRect().height>scroller.clientHeight &&
      Math.abs(scroller.getBoundingClientRect().bottom-innerHeight)<1;
  })()`),
    true,
    'Tall screens grow while the horizontal scrollbar stays at the viewport bottom'
  );

  await page.send('Input.dispatchDragEvent', {
    type: 'dragEnter',
    x: 195,
    y: 5,
    data: tallDrag.data
  });
  await page.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    x: 195,
    y: 5,
    data: tallDrag.data
  });
  await wait(
    'document.querySelector(".muze-solid-launcher-screens").scrollTop<10'
  );
  await page.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    x: 385,
    y: 300,
    data: tallDrag.data
  });
  await wait(
    'document.querySelector(".muze-solid-launcher-screens").scrollLeft>300'
  );
  await page.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    x: 5,
    y: 300,
    data: tallDrag.data
  });
  await wait(
    'document.querySelector(".muze-solid-launcher-screens").scrollLeft<30'
  );
  await page.send('Input.dispatchDragEvent', {
    type: 'dragCancel',
    x: 195,
    y: 300,
    data: tallDrag.data
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 195,
    y: 300,
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.setInterceptDrags', { enabled: false });
  await wait(
    'document.querySelector("[data-muze-solid-launcher-screen=new]").hidden'
  );
  assert.equal(
    await evaluate(
      'solidLauncher.ui.runtime.launcherScreens.state.data.length'
    ),
    0
  );
  assert.equal(
    await evaluate('solidLauncher.ui.runtime.launcherDragScroll'),
    null
  );
  console.log(
    'PASS native drag scrolls down/up/right/left and cancellation saves no empty group'
  );
}
finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
}
