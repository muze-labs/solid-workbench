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
    }
    else if (!deckText) {
      response.writeHead(404).end();
    }
    else {
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
  }
  catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const external = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(
    independentViewPeer(origin, 'passive-bounded', {
      startupError: providerStartupError
    })
  );
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
  }
  else {
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
    `document.querySelector('.muze-solid-presenter-view-options > button').click()`
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
  await click(page, 'muzeSolidCollectionChoose');
  await idle(page);
  await click(page, 'muzeSolidUiAppAction', 0);
  await idle(page);
  await editText(page, 0, 'Our first deck');
  await run(page, `const trigger=document.querySelector(
    '.muze-solid-presenter-deck-menu > button');trigger.focus();trigger.click();`);
  await until(page, 'document.querySelector("#muze-solid-presenter-deck-sheet:popover-open")');
  await editText(page, 0, 'Our first deck');
  await until(page, '!document.querySelector("#muze-solid-presenter-deck-sheet:popover-open")');
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
  await page.evaluate(async () => {
    const owner = globalThis.muzeSolidPresenterApp;
    const name = 'muzeSolidPresenterRichText';
    if (performance.getEntriesByType('resource').some(
      (entry) => new URL(entry.name).pathname.includes('/authoring/')
    )) {
      throw new Error('Presenter fetched authoring sources during normal use.');
    }
    const { source } = (await import(
      owner.definition.sources.muzeSolidPresenter.url
    )).default.transformers[name];
    const row = owner.data.muzeSolidPresenterSlides.find(
      (slide) => slide.id === owner.runtime.selected
    );
    const element = owner.container.querySelector(
      '[aria-current="true"] .muze-solid-presenter-thumbnail-text'
    );
    const deck = owner.runtime.deck;
    const native = await deck.graph.write();
    const original = owner.transformers[name];
    const fragment = row.fragment;
    const frame = owner.container.querySelector('[data-kind="text"] iframe');
    const editor = frame?.contentWindow?.muzeSolidViewerApp?.runtime.cobaltEditor;
    const draft = JSON.stringify(editor.getValue());
    const reconstruct = (body) => Function('return (' + body + ')')();
    try {
      owner.transformers[name] = reconstruct(
        source.replace(
          'return next(context);',
          'context.value.innerHTML = "<mark>" + context.value.innerHTML + "</mark>";\n' +
            'return next(context);'
        )
      );
      const previewText = 'Replacement thumbnail';
      row.fragment = { text: previewText, annotations: [] };
      await owner.binding.whenIdle();
      if (element.querySelector('mark')?.textContent !== previewText) {
        throw new Error('Replacement did not render the current thumbnail.');
      }
      owner.transformers[name] = original;
      row.fragment = fragment;
      await owner.binding.whenIdle();
      if (element.querySelector('mark') || element.textContent !== fragment.text) {
        throw new Error('Restoring the transformer did not restore the thumbnail.');
      }
      if (
        owner.runtime.deck !== deck || (await deck.graph.write()) !== native ||
        frame !== owner.container.querySelector('[data-kind="text"] iframe') ||
        JSON.stringify(editor.getValue()) !== draft
      ) {
        throw new Error('Replacing the transformer changed the deck or open draft.');
      }
    }
    finally {
      owner.transformers[name] = original;
      row.fragment = fragment;
    }
  });
  console.log('PASS live Cobalt thumbnail transformer replacement and restoration');
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
  const writesBeforeTemplateEdit = writes.length;
  await page.evaluate(async () => {
    const owner = globalThis.muzeSolidPresenterApp;
    await owner.binding.whenIdle();
    const name = 'muze-solid-presenter-thumbnail';
    const list = owner.container.querySelector('.muze-solid-presenter-list');
    const template = owner.container.querySelector('template#' + name);
    const authored = owner.components.muzeSolidPresenter.templates;
    const original = authored[name];
    const originalMarkup = template.innerHTML;
    const parsed = document.createElement('template');
    parsed.innerHTML = original;
    if (
      owner.templates[name] !== original ||
      originalMarkup !== parsed.innerHTML
    ) {
      throw new Error('Presenter did not mount the named thumbnail definition.');
    }
    const selected = owner.runtime.selected;
    const deck = owner.runtime.deck;
    const native = await deck.graph.write();
    const frame = owner.container.querySelector('[data-kind="text"] iframe');
    const editor = frame.contentWindow.muzeSolidViewerApp.runtime.cobaltEditor;
    const draft = JSON.stringify(editor.getValue());
    const buttons = () => [...list.querySelectorAll('button')];
    const ids = () => buttons().map((button) => button.dataset.muzeSolidSlide);
    const slideIds = ids();
    const focusId = slideIds.find((id) => id !== selected);
    const focusTarget = () => buttons().find(
      (button) => button.dataset.muzeSolidSlide === focusId
    );
    const toolbar = owner.container.querySelector(
      '.muze-solid-presenter-deck-menu > button'
    );
    const focused = focusTarget();
    focused.focus();
    if (
      document.activeElement !== focused ||
      owner.binding.rerender(list, template) ||
      !focused.isConnected
    ) {
      throw new Error('SimplyFlow did not preserve the focused thumbnail.');
    }

    async function refresh(markup) {
      toolbar.focus();
      owner.templates[name] = markup;
      template.innerHTML = markup;
      if (!owner.binding.rerender(list, template)) {
        throw new Error('SimplyFlow did not refresh the thumbnail template.');
      }
      await owner.binding.whenIdle();
      if (document.activeElement !== toolbar) {
        throw new Error('Refreshing thumbnails displaced focus outside them.');
      }
      const replacement = focusTarget();
      replacement.focus();
      const current = list.querySelector('[aria-current="true"]');
      if (
        document.activeElement !== replacement ||
        JSON.stringify(ids()) !== JSON.stringify(slideIds) ||
        owner.runtime.selected !== selected ||
        current?.dataset.muzeSolidSlide !== selected
      ) {
        throw new Error('Refreshing thumbnails changed order, focus or selection.');
      }
      if (
        owner.runtime.deck !== deck ||
        (await deck.graph.write()) !== native ||
        owner.container.querySelector('[data-kind="text"] iframe') !== frame ||
        JSON.stringify(editor.getValue()) !== draft
      ) {
        throw new Error('Refreshing thumbnails changed the deck or open draft.');
      }
    }

    const edited = original.replace(
      '</li>',
      '<small data-template-preview aria-hidden="true">Preview</small></li>'
    );
    await refresh(edited);
    const previews = [...list.querySelectorAll('[data-template-preview]')];
    if (
      previews.length !== slideIds.length ||
      previews.some((element) => !element.checkVisibility())
    ) {
      throw new Error('The live template edit did not render every thumbnail.');
    }
    await refresh(authored[name]);
    if (
      list.querySelector('[data-template-preview]') ||
      owner.templates[name] !== original ||
      template.innerHTML !== originalMarkup
    ) {
      throw new Error('Undo did not restore the original thumbnail template.');
    }
  });
  assert.equal(writes.length, writesBeforeTemplateEdit);
  console.log('PASS live thumbnail template edit and undo with focus and deck continuity');
  const dock = 'document.querySelector("[data-swb-inspector-dock]")';
  const panel = dock + '.querySelector("iframe").contentDocument';
  const pick = '[data-simply-command="swbInspectPick"]';
  const move = '[data-simply-command="swbInspectTogglePresentation"]';
  const pickButton = `${panel}?.querySelector(${JSON.stringify(pick)})`;
  const moveButton = `${panel}?.querySelector(${JSON.stringify(move)})`;
  const selectedBeforeInspect = await run(page, `return ${app}.runtime.selected`);
  assert.equal(await run(page, `return ${dock}.open`), false);
  assert.equal(await run(page, `return Boolean(${dock}.querySelector('iframe'))`), false);
  assert.equal(await run(page, `return performance.getEntriesByType('resource')
    .some(entry => new URL(entry.name).pathname.includes('/inspector/'))`), false);
  assert.equal(await run(page, `return document.querySelector('[data-kind="text"] iframe')
    .contentDocument.querySelector('[data-simply-command="swbInspectApp"]')
    .closest('li').hidden`), true, 'The embedded editor has no Inspect menu item');
  await run(page, `document.querySelector(
    '[popovertarget="muze-solid-ui-account-menu"]').click();`);
  await click(page, 'swbInspectApp');
  await until(page, `${dock}.open && ${pickButton}`);
  await until(page, `${panel}.querySelector('[role="status"]')
    .textContent.includes('Dimmed frames are outside this inspection')`);
  const panelBackground = `(() => {
    const surface = ${panel}.querySelector('#inspector');
    const context = document.createElement('canvas').getContext('2d');
    context.fillStyle = getComputedStyle(surface).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[0];
  })()`;
  const previousTheme = await run(page, 'return document.body.className;');
  await run(page, `document.body.classList.remove('ds-darkmode-auto', 'ds-darkmode');
    document.body.classList.add('ds-lightmode');`);
  await until(page, `${panelBackground} > 240 && ${panelBackground} < 255`);
  await run(page, `document.body.classList.replace('ds-lightmode', 'ds-darkmode');`);
  await until(page, `${panelBackground} > 34 && ${panelBackground} < 48`);
  await run(page, `document.body.className = ${JSON.stringify(previousTheme)};`);
  const resizeHandle = `${dock}.querySelector('[role="separator"]')`;
  assert.equal(await run(page, `return ${resizeHandle}.checkVisibility()`), false);
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
  });
  await until(page, `${resizeHandle}.checkVisibility() &&
    ${resizeHandle}.hasAttribute('aria-valuenow')`);
  const edge = await run(page, `const rect = ${resizeHandle}.getBoundingClientRect();
    return { x: rect.left + 4, y: rect.top + 180 };`);
  const dockWidth = `${dock}.getBoundingClientRect().width`;
  const beforeResize = await run(page, `return ${dockWidth}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...edge });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', ...edge, button: 'left', buttons: 1, clickCount: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: edge.x - 20, y: edge.y, button: 'left', buttons: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: edge.x - 96, y: edge.y, button: 'left', buttons: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: edge.x - 96, y: edge.y, button: 'left', clickCount: 1
  });
  await until(page, `${dockWidth} === ${beforeResize + 96}`);
  assert.equal(await run(page, `return getComputedStyle(${dock}.parentElement).paddingInlineEnd`),
    `${beforeResize + 96}px`);
  await run(page, `${resizeHandle}.focus();`);
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39
    });
  }
  await until(page, `${dockWidth} === ${beforeResize + 72} &&
    ${resizeHandle}.getAttribute('aria-valuenow') === '${beforeResize + 72}'`);
  await run(page, `document.querySelector(
    '[popovertarget="muze-solid-ui-account-menu"]').click();`);
  assert.equal(await run(page, `const menu = document.querySelector('.swb-account-menu');
    const button = document.querySelector('[popovertarget="muze-solid-ui-account-menu"]');
    const menuBounds = menu.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    return menu.matches(':popover-open') && menuBounds.right <= ${dock}.getBoundingClientRect().left
      && Math.abs(menuBounds.right - buttonBounds.right) <= 12;`), true);
  await run(page, "document.querySelector('.swb-account-menu').hidePopover();");
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await run(page, `${pickButton}.click();
    document.querySelector('.muze-solid-presenter-slide-button:not([aria-current])').focus();`);
  assert.equal(await run(page, `return getComputedStyle(document.activeElement).cursor;`),
    'crosshair');
  assert.equal(await run(page, `return getComputedStyle(
    document.querySelector('[data-kind="text"] iframe')).filter;`), 'brightness(0.55)');
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13
    });
  }
  const showingTemplate = `body.innerText.includes('muze-solid-presenter-thumbnail')`;
  const closeInspector = '.solid-dialog-close[aria-label="Close inspector"]';
  const visiblePreviews = `${panel}.querySelectorAll('.swb-inspector-preview:not([hidden])')`;
  const sourcePreview = (button) =>
    `${button}.closest('li').querySelector('.swb-inspector-preview')`;
  const sourceCode = (button) =>
    `${sourcePreview(button)}.querySelector('[aria-label="Read-only source"]')`;
  const dataCode = (button) =>
    `${sourcePreview(button)}.querySelector('[aria-label="Bound data"]')`;
  const sourceButton = (label) => `[...${panel}.querySelectorAll(
    '[data-simply-command="swbInspectSource"]:not([hidden])')].find(button =>
      button.firstElementChild.textContent === '${label}')`;
  await until(page, `${dock}.open && ${panel}.${showingTemplate} &&
    ${panel}.body.innerText.includes('muzeSolidPresenterSlides.1.attributes') &&
    ${panel}.body.innerText.includes('muzeSolidPresenterSelect') &&
    ${sourceButton('Component')}?.textContent.includes('muzeSolidPresenter')`);
  assert.equal(await run(page, `return document.querySelector('.swb-root')
    .hasAttribute('data-swb-inspector-picking');`), false);
  assert.notEqual(await run(page, `return getComputedStyle(
    document.querySelector('[data-kind="text"] iframe')).filter;`), 'brightness(0.55)');
  const dataSource = sourceButton('Data');
  const componentSource = sourceButton('Component');
  const commandSource = sourceButton('Command');
  const parentSource = `${panel}.querySelector(
    '[data-simply-command="swbInspectParentSource"]:not([hidden])')`;
  assert.equal(await run(page, `return ${visiblePreviews}.length`), 0);
  await run(page, `${dataSource}.click();`);
  await until(page, `!${sourcePreview(dataSource)}.hidden && ${sourceCode(dataSource)}.textContent
    .includes('data-simply-field="attributes"') &&
    ${sourcePreview(dataSource)}.querySelector('.swb-inspector-preview-origin')
      .textContent.includes('apps/presenter/src/thumbnail.html') &&
    ${dataCode(dataSource)}.textContent === JSON.stringify(
      ${app}.data.muzeSolidPresenterSlides[1].attributes, null, 2)`);
  assert.equal(await run(page, `const preview = ${sourcePreview(dataSource)};
    const content = preview.querySelector('.swb-inspector-preview-content');
    const close = preview.querySelector('[aria-label="Close preview"]');
    return content.getBoundingClientRect().top < close.getBoundingClientRect().bottom;`), true);
  await run(page, `${sourcePreview(dataSource)}
    .querySelector('[aria-label="Close preview"]').click();`);
  await until(page, `${visiblePreviews}.length === 0 &&
    ${panel}.activeElement === ${dataSource} &&
    ${dataSource}.getAttribute('aria-expanded') === 'false'`);
  await run(page, `${commandSource}.click();`);
  await until(page, `${sourceCode(commandSource)}.textContent
    .includes('this.actions.muzeSolidPresenterRun')`);
  await run(page, `${componentSource}.click();`);
  await until(page, `${sourceCode(componentSource)}.textContent
    .includes('export const muzeSolidPresenter =')`);
  assert.equal(await run(page, `const content = ${sourcePreview(componentSource)}
    .querySelector('.swb-inspector-preview-content');
    return content.scrollHeight > content.clientHeight && content.clientHeight > 0;`), true);
  await run(page, `${parentSource}.click();`);
  await until(page, `${visiblePreviews}.length === 1 &&
    !${sourcePreview(parentSource)}.hidden && ${sourceCode(parentSource)}.textContent
      .includes('data-simply-field="attributes"') &&
    ${parentSource}.getAttribute('aria-expanded') === 'true'`);
  await run(page, `${parentSource}.focus(); ${parentSource}.click();`);
  await until(page, `${visiblePreviews}.length === 0 &&
    ${parentSource}.getAttribute('aria-expanded') === 'false' &&
    ${panel}.activeElement === ${parentSource}`);
  await run(page, `${parentSource}.click();`);
  await until(page, `${visiblePreviews}.length === 1`);
  await run(page, `const parent = ${panel}.querySelector('[data-simply-command="swbInspectParent"]');
    if (parent.textContent.trim() !== 'muze-solid-presenter-thumbnail') {
      throw new Error('The thumbnail row is the first navigable parent.');
    }
    parent.click();`);
  await until(page, `${visiblePreviews}.length === 0 &&
    ${sourceButton('Data')}?.querySelector('code').textContent === 'muzeSolidPresenterSlides' &&
    !${sourceButton('Command')}`);
  const currentBreadcrumb = `${panel}.querySelector('[aria-current="location"]:not([hidden])')`;
  assert.equal(await run(page, `return ${currentBreadcrumb}.textContent.trim()`),
    'muze-solid-presenter-thumbnail');
  assert.equal(await run(page, `const current = ${currentBreadcrumb};
    const label = current.querySelector('.swb-inspector-trail-label');
    const item = current.closest('li');
    const divider = item.querySelector('.swb-inspector-trail-divider');
    return label.scrollWidth > label.clientWidth &&
      getComputedStyle(label).textOverflow === 'ellipsis' &&
      current.title === label.textContent &&
      getComputedStyle(item).marginInlineStart === '0px' &&
      divider.checkVisibility() &&
      divider.querySelector('use').getAttribute('href').endsWith('#chevron-right');`), true);
  await run(page, `${panel}.querySelector(
    '[data-simply-command="swbInspectBreadcrumb"]:not([hidden])').click();`);
  await until(page, `${sourceButton('Data')}?.textContent.includes('.attributes') &&
    ${sourceButton('Command')} && ${currentBreadcrumb}?.textContent.trim() === 'Picked element' &&
    ${panel}.activeElement === ${currentBreadcrumb}`);
  assert.equal(await run(page, `return ${app}.runtime.selected`), selectedBeforeInspect);
  await run(page, `const open = window.open;
    try { window.open = () => null; ${moveButton}.click(); }
    finally { window.open = open; }`);
  await until(page, `${dock}.open && ${panel}.body.innerText.includes('browser blocked') &&
    ${moveButton}.getAttribute('aria-label') === 'Dock as sidebar'`);
  await run(page, `${moveButton}.click();`);
  await until(page, `${moveButton}.getAttribute('aria-label') === 'Open in new window'`);
  const openFromMenu = `document.querySelector(
    '[popovertarget="muze-solid-ui-account-menu"]').click();
    document.querySelector('[data-simply-command="swbInspectApp"]').click();`;
  const openInspectorPopup = (target, trigger) => run(target, `const open = window.open;
    try {
      window.open = (...args) => {
        window.inspectorFeatures = args[2];
        return window.inspectorPopup = open.apply(window, args);
      };
      ${trigger}
    }
    finally { window.open = open; }`);
  await openInspectorPopup(page, `${moveButton}.click();`);
  const popupDocument = 'window.inspectorPopup?.document';
  await until(page, `!${dock}.open && ${popupDocument}?.body &&
    ${popupDocument}.${showingTemplate} &&
    ${popupDocument}.querySelector(${JSON.stringify(move)}).getAttribute('aria-label') === 'Dock as sidebar'`);
  assert.equal(await run(page, `return ${popupDocument}.querySelector('[role="status"]')
    .textContent`), '');
  assert.match(await run(page, 'return window.inspectorFeatures'), /\bpopup\b/);
  const { targetInfos } = await page.send('Target.getTargets');
  const inspectorTarget = targetInfos.find(
    (target) => target.type === 'page' && target.url === origin + '/inspector/'
  );
  assert(inspectorTarget, 'Inspector has its own top-level Chrome target');
  const appWindow = await page.send('Browser.getWindowForTarget');
  const inspectorWindow = await page.send('Browser.getWindowForTarget', {
    targetId: inspectorTarget.targetId
  });
  assert.notEqual(inspectorWindow.windowId, appWindow.windowId);
  const sibling = await page.send('Target.createTarget', {
    url: origin + '/presenter/',
    background: true
  });
  try {
    const otherPresenter = await chrome.page(sibling.targetId);
    await otherPresenter.ready();
    await until(otherPresenter, app);
    assert.equal(await run(otherPresenter, `return ${dock}.open`), false);
    await openInspectorPopup(otherPresenter, openFromMenu);
    await until(otherPresenter, `!${dock}.open && ${popupDocument}?.querySelector(
      ${JSON.stringify(move)})?.getAttribute('aria-label') === 'Dock as sidebar'`);
    assert.equal(await run(otherPresenter, `return ${popupDocument}.${showingTemplate}`), false);
    await run(otherPresenter, 'window.inspectorPopup.close();');
  }
  finally {
    await page.send('Target.closeTarget', { targetId: sibling.targetId });
  }
  await run(page, `${popupDocument}.querySelector(${JSON.stringify(move)}).click();`);
  await until(page, `window.inspectorPopup.closed && ${dock}.open &&
    ${panel}.${showingTemplate} && ${moveButton}.getAttribute('aria-label') === 'Open in new window'`);
  await openInspectorPopup(page, `${moveButton}.click();`);
  await until(page, `!${dock}.open && ${popupDocument}?.body &&
    ${popupDocument}.${showingTemplate}`);
  await run(page, 'window.inspectorPopup.close();');
  await until(page, `window.inspectorPopup.closed && !${dock}.open &&
     document.activeElement.matches('[popovertarget="muze-solid-ui-account-menu"]')`);
  await openInspectorPopup(page, openFromMenu);
  await until(page, `!${dock}.open && ${popupDocument}?.body &&
    ${popupDocument}.${showingTemplate}`);
  await run(page, `${popupDocument}
    .querySelector(${JSON.stringify(closeInspector)}).click();`);
  await until(page, `window.inspectorPopup.closed && !${dock}.open`);
  await openInspectorPopup(page, openFromMenu);
  await until(page, `${popupDocument}?.querySelector(${JSON.stringify(move)})
    ?.getAttribute('aria-label') === 'Dock as sidebar'`);
  await run(page, `${popupDocument}.querySelector(${JSON.stringify(move)}).click();`);
  await until(page, `window.inspectorPopup.closed && ${dock}.open`);
  await run(page, `${panel}.querySelector(${JSON.stringify(closeInspector)}).click();
    delete window.inspectorFeatures;
    delete window.inspectorPopup;`);
  assert.equal(await run(page, `return ${dock}.open`), false);
  await run(page, openFromMenu);
  await until(page, `${dock}.open && ${panel}.${showingTemplate}`);
  await run(page, `const owner = ${app};
    const fixture = document.createElement('div');
    fixture.id = 'swb-inspector-test-binding';
    fixture.dataset.simplyField = 'swbFixtureData';
    fixture.dataset.simplyTransform = 'attributes';
    fixture.dataset.simplyAttributes = 'title';
    const target = document.createElement('button');
    target.textContent = 'Runtime-only binding';
    target.dataset.simplyCommand = 'swbFixtureMissingCommand';
    fixture.append(target);
    owner.data.swbFixtureData = { title: '<em>Fixture-only data</em>', values: [1, 2] };
    owner.container.append(fixture);
    ${pickButton}.click();
    target.click();`);
  await until(page, `${panel}.querySelector('div.swb-inspector-relationship:not([hidden]) code')
    ?.textContent === 'swbFixtureMissingCommand' && !${sourceButton('Command')} &&
    ${dataSource}?.querySelector('code').textContent === 'swbFixtureData'`);
  assert.equal(await run(page, `const button = ${panel}.querySelector(
    '[aria-label="Show source for swbFixtureData"]');
    return button.hidden && !button.checkVisibility();`), true);
  await run(page, `${dataSource}.click();`);
  await until(page, `${dataCode(dataSource)}.checkVisibility() &&
    ${dataCode(dataSource)}.textContent === JSON.stringify(${app}.data.swbFixtureData, null, 2) &&
    !${sourceCode(dataSource)}.checkVisibility()`);
  await run(page, `${dataSource}.click();`);
  await until(page, `${visiblePreviews}.length === 0 &&
    ${dataSource}.getAttribute('aria-expanded') === 'false'`);
  await run(page, `const rdf = oldm.context().parse(
    '<#person> <urn:label> "Hoi"@nl; <urn:code> "01"^^<urn:custom> . ' +
    '<#unrelated> <urn:label> "Unrelated" .',
    'https://example.test/people', 'text/turtle'
  );
  ${app}.data.swbFixtureData = rdf.get('#person');
  ${dataSource}.click();`);
  await until(page, `${sourcePreview(dataSource)}.querySelector('h3').textContent === 'Turtle' &&
    ${dataCode(dataSource)}.textContent.includes('"Hoi"@nl')`);
  assert.equal(await run(page, `const turtle = ${dataCode(dataSource)}.textContent;
    const { quads } = oldm.turtleParser(turtle, 'https://example.test/people');
    return quads.length === 2 &&
      quads.every(quad => quad.subject.id === 'https://example.test/people#person') &&
      quads.some(quad => quad.object.datatype?.id === 'urn:custom' && quad.object.value === '01');`), true);
  await run(page, `document.querySelector('#swb-inspector-test-binding').remove();
    delete ${app}.data.swbFixtureData;`);
  await run(page, `${panel}.querySelector(${JSON.stringify(closeInspector)}).click();`);
  assert.equal(writes.length, writesBeforeTemplateEdit);
  console.log('PASS inspector previews, closes and reopens in its chosen presentation');
  const originalOrder = await run(
    page,
    `return ${app}.runtime.slides.view.current.map(slide=>slide.id)`
  );
  const originalSelected = await run(page, `return ${app}.runtime.selected`);
  await click(page, 'muzeSolidUiAppAction', 0);
  await until(
    page,
    `${app}.runtime.deck.slides().length===3 && !${app}.runtime.busy`
  );
  const inserted = await run(page, `return ${app}.runtime.selected`);
  assert.deepEqual(
    await run(
      page,
      `return ${app}.runtime.slides.view.current.map(slide=>slide.id)`
    ),
    [originalOrder[0], inserted, originalOrder[1]],
    'New slide follows the current slide'
  );
  await until(
    page,
    `!document.querySelector('.muze-solid-presenter-controls').disabled &&
    !document.querySelector('[data-muze-solid-action="add"]').disabled`
  );
  await run(
    page,
    `globalThis.muzeSolidMoveContinuity={
    buttons:[...document.querySelectorAll('.muze-solid-presenter-slide-button')],
    frames:[...${app}.runtime.views.values()].map(view=>view.frame),
    disabling:[]};
    globalThis.muzeSolidMoveObserver=new MutationObserver(records=>{
      for(const record of records){
        if(record.target.matches('.muze-solid-presenter-controls, .muze-solid-ui-app-toolbar button')){
          globalThis.muzeSolidMoveContinuity.disabling.push(record.target.tagName);
        }
      }
    });
    globalThis.muzeSolidMoveObserver.observe(document.querySelector('#app'),{
      subtree:true,attributes:true,attributeFilter:['disabled']});`
  );
  for (const [offset, position] of [
    [1, '3 / 3'],
    [-1, '2 / 3']
  ]) {
    await run(
      page,
      `document.querySelector('[data-simply-command="muzeSolidPresenterMove"][data-simply-value="'+${offset}+'"]').focus()`
    );
    for (const type of ['keyDown', 'keyUp']) {
      await page.send('Input.dispatchKeyEvent', {
        type,
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        ...(type === 'keyDown' ? { text: '\r' } : {})
      });
    }
    await until(
      page,
      `${app}.data.muzeSolidPresenterPosition===${JSON.stringify(position)} && !${app}.runtime.busy`
    );
    await until(
      page,
      `document.activeElement.matches('[data-simply-command="muzeSolidPresenterMove"]')`
    );
    assert.equal(await run(page, `return ${app}.runtime.selected`), inserted);
    assert.equal(
      await run(
        page,
        `return globalThis.muzeSolidMoveContinuity.buttons.every(button=>
      button.isConnected && [...document.querySelectorAll('.muze-solid-presenter-slide-button')].includes(button))`
      ),
      true,
      'Reordering retains every thumbnail button'
    );
    assert.equal(
      await run(
        page,
        `return globalThis.muzeSolidMoveContinuity.frames.every(frame=>
      frame.isConnected && [...${app}.runtime.views.values()].some(view=>view.frame===frame))`
      ),
      true,
      'Reordering retains the existing editor frames'
    );

    assert.equal(
      await run(
        page,
        `return document.activeElement.matches('[data-simply-command="muzeSolidPresenterMove"]')`
      ),
      true,
      'Native keyboard move retains focus on its control'
    );
    assert.equal(
      await run(page, `return document.activeElement.textContent.trim()`),
      offset === 1 ? 'Move later' : 'Move earlier'
    );
    assert.match(
      await run(page, `return ${app}.data.muzeSolidPresenterStatus`),
      /Slide position: [23] of 3/
    );
  }
  await run(page, 'globalThis.muzeSolidMoveObserver.disconnect()');
  assert.deepEqual(
    await run(page, 'return globalThis.muzeSolidMoveContinuity.disabling'),
    [],
    'Moving never toggles disabled styling on the editor or toolbar'
  );
  await writeFile(
    '/tmp/presenter-slide-order-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  const extraSlides = await run(
    page,
    `const ids=[];
    for(let index=0;index<4;index++){ids.push(${app}.runtime.deck.addSlide('image'));}
    await ${app}.actions.muzeSolidPresenterPersist();return ids`
  );
  // Persistence finishes before SimplyFlow's next layout. Wait for the
  // observable fixture geometry before testing the scroll interaction.
  await until(page, `(() => {
    const strip=document.querySelector('.muze-solid-presenter-filmstrip');
    return strip.scrollWidth>strip.clientWidth;
  })()`);
  assert.equal(
    await run(
      page,
      `const strip=document.querySelector('.muze-solid-presenter-filmstrip');
    return strip.scrollWidth>strip.clientWidth`
    ),
    true,
    'The phone fixture really overflows'
  );
  const selectedInView = `(()=>{
    const button=document.querySelector('.muze-solid-presenter-slide-button[aria-current="true"]');
    const strip=document.querySelector('.muze-solid-presenter-filmstrip');
    const rect=button.getBoundingClientRect(), bounds=strip.getBoundingClientRect();
    return rect.left>=Math.max(0,bounds.left)-1 &&
      rect.right<=Math.min(innerWidth,bounds.right)+1;
  })()`;
  await until(
    page,
    `!document.querySelector('[data-simply-command="muzeSolidPresenterSelect"]').matches(':disabled')`
  );
  await click(page, 'muzeSolidPresenterSelect', 6);
  await idle(page);
  const beforeLastAdd = await run(page, `return ${app}.runtime.selected`);
  await run(
    page,
    `document.querySelector('.muze-solid-presenter-slide-button[aria-current="true"]').scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})`
  );
  await until(
    page,
    `!document.querySelector('[data-muze-solid-action="add"]').matches(':disabled')`
  );
  await click(page, 'muzeSolidUiAppAction', 0);
  await until(
    page,
    `${app}.runtime.deck.slides().length===8 && !${app}.runtime.busy`
  );
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '8 / 8'
  );
  assert.equal(
    await run(page, `return ${selectedInView}`),
    true,
    'Add reveals the new selected slide beyond the previously visible last slide'
  );
  await writeFile(
    '/tmp/presenter-slide-add-scroll-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await until(
    page,
    `!document.querySelector('[data-simply-command="muzeSolidPresenterRemove"]').matches(':disabled')`
  );
  await click(page, 'muzeSolidPresenterRemove');
  await until(
    page,
    `${app}.runtime.deck.slides().length===7 && !${app}.runtime.busy`
  );
  assert.equal(
    await run(page, `return ${app}.runtime.selected`),
    beforeLastAdd,
    'Removing the last slide selects its immediate predecessor'
  );
  assert.equal(
    await run(page, `return ${app}.data.muzeSolidPresenterPosition`),
    '7 / 7'
  );
  assert.equal(
    await run(page, `return ${selectedInView}`),
    true,
    'The predecessor remains visible after removing the last slide'
  );
  await until(
    page,
    `!document.querySelector('[data-simply-command="muzeSolidPresenterSelect"]').matches(':disabled')`
  );
  await click(page, 'muzeSolidPresenterSelect', 1);
  await until(
    page,
    `${app}.runtime.selected===${JSON.stringify(inserted)} && !${app}.runtime.busy`
  );
  let slideIndex = 1;
  for (const offset of [1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1]) {
    await until(
      page,
      `!document.querySelector('[data-simply-command="muzeSolidPresenterMove"][data-simply-value="'+${offset}+'"]').matches(':disabled')`
    );
    await click(page, 'muzeSolidPresenterMove', offset < 0 ? 0 : 1);
    slideIndex += offset;
    await until(
      page,
      `${app}.data.muzeSolidPresenterPosition===${JSON.stringify(String(slideIndex + 1) + ' / 7')} && !${app}.runtime.busy`
    );
    assert.equal(await run(page, `return ${app}.runtime.selected`), inserted);
    assert.equal(
      await run(page, `return ${selectedInView}`),
      true,
      'Moving a slide keeps its thumbnail inside the overflowing phone filmstrip: ' +
        JSON.stringify(
          await run(
            page,
            `const button=document.querySelector('.muze-solid-presenter-slide-button[aria-current="true"]');
          const strip=document.querySelector('.muze-solid-presenter-filmstrip');
          return {offset:${offset},rect:button.getBoundingClientRect().toJSON(),strip:strip.getBoundingClientRect().toJSON(),
            scrollLeft:strip.scrollLeft,width:strip.clientWidth,scrollWidth:strip.scrollWidth,
            viewport:innerWidth,documentScroll:document.documentElement.scrollLeft,position:${app}.data.muzeSolidPresenterPosition}`
          )
        )
    );
  }
  await writeFile(
    '/tmp/presenter-slide-scroll-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await run(
    page,
    `for(const id of ${JSON.stringify(extraSlides)}){${app}.runtime.deck.removeSlide(id);}
    await ${app}.actions.muzeSolidPresenterPersist()`
  );
  await until(
    page,
    `!document.querySelector('[data-simply-command="muzeSolidPresenterRemove"]').matches(':disabled')`
  );
  await click(page, 'muzeSolidPresenterRemove');
  await until(
    page,
    `${app}.runtime.deck.slides().length===2 && !${app}.runtime.busy`
  );
  assert.deepEqual(
    await run(
      page,
      `return ${app}.runtime.slides.view.current.map(slide=>slide.id)`
    ),
    originalOrder
  );
  assert.equal(
    await run(page, `return ${app}.runtime.selected`),
    originalSelected,
    'Removing the first slide selects the first remaining slide'
  );
  assert.equal(
    await run(
      page,
      `return ${app}.runtime.deck.regions(${app}.runtime.selected)[0].fragment.text`
    ),
    'Second slide'
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
  console.log(
    'Failed startup permits slide navigation and retry after restored access.'
  );
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
  const managedReload = managedPage.once('Page.loadEventFired');
  await run(
    managedPage,
    `localStorage.setItem('solid-apps.webId',location.origin+'/profile#me');location.reload()`
  );
  await managedReload;
  await until(
    managedPage,
    `${app}?.runtime.host.managed?.ready && !${app}.runtime.busy && ${app}.runtime.host.session && ${app}.runtime.host.selectedWebId===location.origin+'/profile#me'`
  );
  await run(
    managedPage,
    `document.querySelector('[data-muze-solid-action="muzeSolidPresenterCurrentDeck"]').click()`
  );
  await idle(managedPage);
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
}
finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => external.close(resolve));
}
