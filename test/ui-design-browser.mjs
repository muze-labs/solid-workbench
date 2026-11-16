import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';

let origin;
let authoringRequests = 0;
const folders = new Set();
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  if (url.pathname.startsWith('/assets/authoring/')) {
    authoringRequests += 1;
    response.writeHead(404).end('Optional authoring sources unavailable');
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
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
    expression,
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
  throw new Error('Timed out: ' + expression);
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

async function checkMarker(selector) {
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 1,
    y: 800
  });
  await evaluate('document.activeElement?.blur()');
  const normal = await evaluate(`getComputedStyle(
    document.querySelector(${JSON.stringify(selector)}), '::before').backgroundColor`);
  const point = await evaluate(`(() => {
    const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  const hover = await evaluate(`(() => {
    const button=document.querySelector(${JSON.stringify(selector)});
    return {color:getComputedStyle(button,'::before').backgroundColor,
      shadow:getComputedStyle(button).boxShadow};
  })()`);
  assert.notEqual(hover.color, normal, selector + ' hover changes marker');
  assert.equal(hover.shadow, 'none');
  await key('Tab', 'Tab', 9);
  const focus = await evaluate(`(() => {
    const button=document.querySelector(${JSON.stringify(selector)});button.focus();
    const style=getComputedStyle(button);
    return {color:getComputedStyle(button,'::before').backgroundColor,
      shadow:style.boxShadow,outline:style.outlineStyle};
  })()`);
  assert.equal(focus.color, hover.color);
  assert.equal(focus.shadow, 'none');
  assert.equal(focus.outline, 'solid');
}

try {
  chrome = await startChrome(origin + '/workbench/', { hoverPointer: true });
  page = await chrome.page();
  await page.ready();
  await wait('window.solidLauncher?.store');
  await evaluate(`(async () => {
    const app = solidLauncher.ui;
    for (const name of ['Alpha', 'Beta', 'Gamma',
      'An application with a deliberately long name that exceeds two lines']) {
      await app.actions.addShortcut({ name, url: location.origin + '/files/?test=' + name,
        mode: '', anonymous: false });
    }
  })()`);
  await wait('document.querySelectorAll(".swb-shortcut-link").length >= 3');
  for (const width of [390, 1280]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 720
    });
    for (const scale of [100, 120]) {
      const label = await evaluate(`(() => {
        document.documentElement.style.fontSize = '${scale}%';
        const label = [...document.querySelectorAll('.muze-solid-design-label-two-lines')]
          .find(element => element.textContent.includes('deliberately long'));
        const style=getComputedStyle(label);
        return {headerSize:parseFloat(getComputedStyle(document.querySelector('.swb-header-title')).fontSize),
          height:label.getBoundingClientRect().height,
          line:parseFloat(style.lineHeight),clamp:style.webkitLineClamp,
          title:label.closest('a').title,text:label.textContent.trim(),
          gap:getComputedStyle(document.querySelector('.swb-launcher-grid')).gap};
      })()`);
      assert.ok(Math.abs(label.headerSize - 24 * scale / 100) < 0.01);
      assert.equal(label.clamp, '2');
      assert.ok(label.height <= label.line * 2 + 1);
      assert.equal(label.title, label.text);
      assert.equal(label.gap, '12px');
      await capture('ui-launcher-' + width + '-text-' + scale);
    }
  }
  await evaluate("document.documentElement.style.fontSize = '100%'");
  const order = () =>
    evaluate('solidLauncher.ui.data.shortcuts.map(row => row.label)');
  const original = await order();
  const label = original.at(-1);
  const selector = '[data-swb-shortcut]:last-child .swb-shortcut-link';
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'F10',
    code: 'F10',
    windowsVirtualKeyCode: 121,
    modifiers: 8
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'F10',
    code: 'F10',
    windowsVirtualKeyCode: 121,
    modifiers: 8
  });
  await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
  assert.equal(
    await evaluate('document.activeElement.textContent.trim()'),
    'Settings'
  );
  await key('ArrowDown', 'ArrowDown', 40);
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    `solidLauncher.ui.data.shortcuts.at(-2).label === ${JSON.stringify(label)}`
  );
  await wait(`document.activeElement.matches('.swb-shortcut-link') && document.activeElement.textContent.trim() === ${JSON.stringify(label)}`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'F10',
    code: 'F10',
    windowsVirtualKeyCode: 121,
    modifiers: 8
  });
  await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
  await key('Tab', 'Tab', 9);
  await wait('!document.querySelector(".swb-shortcut-menu:popover-open")');
  assert.equal(
    await evaluate('!!document.activeElement.closest("[role=menu]")'),
    false
  );
  const moved = await order();
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });
  // This app is already loaded: movement still writes locally while offline.
  await evaluate(`(async () => {
    const app = solidLauncher.ui;
    await app.actions.swbMoveShortcut(app.data.shortcuts.at(-1).id,
      app.data.shortcuts[0].id);
  })()`);
  const offlineOrder = await order();
  assert.notDeepEqual(offlineOrder, moved);
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await page.send('Page.reload');
  await page.ready();
  await wait('window.solidLauncher?.store');
  assert.deepEqual(await order(), offlineOrder);
  console.log(
    'PASS keyboard menu, local reorder, loaded-offline move and reload preservation'
  );

  for (const width of [390, 1280]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: width === 390
    });
    const point = await evaluate(`(() => {
      const link = document.querySelector('.swb-shortcut-link');
      link.scrollIntoView({block:'center'});
      const rect = link.getBoundingClientRect();
      return {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
    })()`);
    if (width === 390) {
      await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      await page.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [point]
      });
      await new Promise((resolve) => setTimeout(resolve, 650));
      await page.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
    }
    else {
      await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await page.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        ...point,
        button: 'right',
        clickCount: 1
      });
      await page.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        ...point,
        button: 'right',
        clickCount: 1
      });
    }
    await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
    const popupThemes = {};
    for (const mode of ['light', 'dark']) {
      popupThemes[mode] = await evaluate(`(() => {
        document.body.classList.remove('ds-lightmode','ds-darkmode','ds-darkmode-auto');
        document.body.classList.add('ds-${mode}mode');
        const style = getComputedStyle(document.querySelector('.swb-shortcut-menu:popover-open'));
        return {
          border:style.borderTopWidth, shadow:style.boxShadow,
          titleShadow:getComputedStyle(document.querySelector('.swb-header-title')).textShadow,
          labelShadow:getComputedStyle(document.querySelector('.swb-shortcut-link')).textShadow
        };
      })()`);
      assert.equal(popupThemes[mode].border, '0px');
      assert.notEqual(popupThemes[mode].shadow, 'none');
      assert.equal(popupThemes[mode].titleShadow, popupThemes[mode].labelShadow);
      assert.equal(popupThemes[mode].titleShadow === 'none', mode === 'light');
    }
    assert.notEqual(popupThemes.light.shadow, popupThemes.dark.shadow);
    assert.match(popupThemes.dark.shadow, /0px 0px/);
    assert.equal(
      await evaluate(`(() => {
      const rect = document.querySelector('.swb-shortcut-menu:popover-open').getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    })()`),
      true
    );
    await capture('ui-menu-' + width);
    await key('Escape', 'Escape', 27);
    await wait('!document.querySelector(".swb-shortcut-menu:popover-open")');
    assert.equal(
      await evaluate('document.activeElement.matches(".swb-shortcut-link")'),
      true
    );
    assert.equal(
      await evaluate(`(() => {
      const link = document.querySelector('.swb-shortcut-link');
      const icon = link.querySelector('img:not([hidden]),svg:not([hidden])');
      return getComputedStyle(link).backgroundColor === 'rgba(0, 0, 0, 0)' &&
        getComputedStyle(link).borderWidth === '0px' &&
        getComputedStyle(icon).backgroundColor === 'rgba(0, 0, 0, 0)' &&
        parseFloat(getComputedStyle(link).gap) <= 4;
    })()`),
      true
    );
  }
  console.log(
    'PASS phone long touch, desktop context menu, focus return and transparent shortcuts'
  );
  // Initiate a genuine mouse drag, then use Chrome's intercepted native drag
  // data for delivery. No application command substitutes for the gesture.
  for (const dropAtEnd of [false, true]) {
    await page.send('Input.setInterceptDrags', { enabled: true });
    const dragPoints = await evaluate(`(() => {
      const links = [...document.querySelectorAll('.swb-shortcut-link')];
      return ${dropAtEnd ? "[links[0], document.querySelector('.swb-add-shortcut')]" : '[links.at(-1), links[0]]'}.map(link => {
        const r = link.getBoundingClientRect();
        return {x:r.x+r.width/2, y:r.y+r.height/2};
      });
    })()`);
    const beforeDrag = await order();
    const intercepted = page.once('Input.dragIntercepted');
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...dragPoints[0]
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...dragPoints[0],
      button: 'left',
      clickCount: 1
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: dragPoints[0].x + 20,
      y: dragPoints[0].y + 10,
      button: 'left',
      buttons: 1
    });
    const drag = await Promise.race([
      intercepted,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Native drag did not start')), 5000)
      )
    ]);
    for (const type of ['dragEnter', 'dragOver']) {
      await page.send('Input.dispatchDragEvent', {
        type,
        ...dragPoints[1],
        data: drag.data
      });
    }
    await wait('document.querySelector(".muze-solid-design-insert-before")');
    assert.deepEqual(await order(), beforeDrag, 'Preview does not reorder data');
    assert.equal(
      await evaluate(`(() => {
      const target=document.querySelector('.muze-solid-design-insert-before');
      return target===document.querySelector(${JSON.stringify(dropAtEnd ? '.swb-add-shortcut' : '[data-swb-shortcut]')}) &&
        getComputedStyle(target,'::before').width==='4px';
    })()`),
      true,
      'Marker shows insertion before the actual drop target'
    );
    await capture(dropAtEnd ? 'ui-drag-end-marker' : 'ui-drag-marker');
    await page.send('Input.dispatchDragEvent', {
      type: 'drop',
      ...dragPoints[1],
      data: drag.data
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...dragPoints[1],
      button: 'left',
      clickCount: 1
    });
    await wait(
      `solidLauncher.ui.data.shortcuts${dropAtEnd ? '.at(-1)' : '[0]'}.label === ${JSON.stringify(dropAtEnd ? beforeDrag[0] : beforeDrag.at(-1))}`
    );
    await wait(`document.activeElement.matches('.swb-shortcut-link') && document.activeElement.textContent.trim() === ${JSON.stringify(dropAtEnd ? beforeDrag[0] : beforeDrag.at(-1))}`);
    await page.send('Input.setInterceptDrags', { enabled: false });
    await wait('!document.querySelector(".muze-solid-design-insert-before")');
    console.log('PASS native mouse drag reorders the responsive grid');
  }
  const beforeMovePreview = await order();
  await evaluate('document.querySelector(".swb-shortcut-link").focus()');
  await key('ContextMenu', 'ContextMenu', 93);
  await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
  for (let index = 0; index < 3; index += 1) {
    await key('ArrowDown', 'ArrowDown', 40);
  }
  await key('Enter', 'Enter', 13, '\r');
  await key('Tab', 'Tab', 9);
  await wait('document.querySelector(".muze-solid-design-insert-before")');
  await key('Escape', 'Escape', 27);
  await wait('!document.querySelector(".muze-solid-design-insert-before")');
  assert.deepEqual(await order(), beforeMovePreview);
  console.log('PASS keyboard move preview cancels without changing order');

  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  const coldLoaded = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await coldLoaded;
  await wait('window.solidLauncher?.ui.data.shortcuts.length');
  await evaluate(`document.querySelector('.swb-shortcut-link').focus()`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'F10',
    code: 'F10',
    windowsVirtualKeyCode: 121,
    modifiers: 8
  });
  await wait('document.querySelector(".swb-shortcut-menu:popover-open")');
  console.log(
    'Cold usable Launcher menu, no-store, 50 KiB/s',
    await evaluate(`({
    bytes:performance.getEntriesByType('resource').reduce((n,e)=>n+e.transferSize,0)+performance.getEntriesByType('navigation')[0].transferSize,
    requests:performance.getEntriesByType('resource').length+1,
    milliseconds:Math.round(performance.now())
  })`)
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await key('Escape', 'Escape', 27);

  // Compare state appearance in actual app compositions, while forcing only
  // presentation attributes so resource selection has no unrelated effects.
  const states = [];
  for (const route of ['preferences', 'contacts', 'notebook', 'files']) {
    if (route === 'files') {
      folders.add('/storage/Examples/');
      await evaluate(
        `localStorage.setItem('solid-apps.webId', '${origin}/profile#me')`
      );
    }
    console.log('Checking list composition', route);
    await visit(route);
    if (route === 'contacts') {
      await wait('window.solidContacts?.store');
      const search = await evaluate(`(() => {
        const input = document.querySelector('.muze-solid-design-list-search-input');
        const icon = document.querySelector('.muze-solid-design-list-search-icon');
        const field = input.getBoundingClientRect();
        const glyph = icon.getBoundingClientRect();
        return {inside: glyph.left >= field.left && glyph.right <= field.right
          && glyph.top >= field.top && glyph.bottom <= field.bottom,
          textClear: field.left + parseFloat(getComputedStyle(input).paddingLeft)
            > glyph.right,
          backgrounds: [input, document.querySelector('.swb-contacts-toolbar')]
            .map(element => getComputedStyle(element).backgroundColor)};
      })()`);
      assert.equal(search.inside, true, 'Search icon stays inside the field');
      assert.equal(search.textClear, true, 'Search text clears the icon');
      assert.deepEqual(search.backgrounds, [
        'rgba(0, 0, 0, 0)',
        'rgba(0, 0, 0, 0)'
      ]);
      await click('[data-simply-command=newContact]');
      await evaluate(`Promise.all(document.querySelector('.new-contact-dialog')
        .getAnimations({subtree:true}).map(animation => animation.finished))`);
      const dialogChrome = await evaluate(`(() => {
        const dialog = document.querySelector('.new-contact-dialog');
        const header = dialog.querySelector('.muze-solid-design-dialog-header');
        const title = header.querySelector('.swb-dialog-title');
        const close = header.querySelector('.muze-solid-design-dialog-close');
        return {font:getComputedStyle(title).fontSize,
          header:header.getBoundingClientRect().height,
          title:title.getBoundingClientRect().height,
          close:close.getBoundingClientRect().height,
          slant:getComputedStyle(close,'::before').clipPath,
          background:getComputedStyle(close,'::before').backgroundColor};
      })()`);
      assert.equal(dialogChrome.header, 44);
      assert.equal(dialogChrome.font, '20px');
      assert.equal(dialogChrome.title, 44);
      assert.equal(dialogChrome.close, 44);
      assert.match(dialogChrome.slant, /polygon/);
      assert.notEqual(dialogChrome.background, 'rgba(0, 0, 0, 0)');
      await checkMarker('.new-contact-dialog .muze-solid-design-marker-button');
      await click('.new-contact-dialog [name=name]');
      await page.send('Input.insertText', { text: 'UI review' });
      await key('Enter', 'Enter', 13, '\r');
      await wait('!document.querySelector(".new-contact-dialog").open');
    }
    await wait('document.querySelector(".muze-solid-design-list-row")');
    await evaluate(
      `document.body.classList.remove('ds-darkmode','ds-darkmode-auto'); document.body.classList.add('ds-lightmode')`
    );
    const row = '.muze-solid-design-list-row';
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 0,
      y: 0
    });
    const normal = await evaluate(`(() => {
      const row = document.querySelector('${row}'); row.removeAttribute('aria-current');
      const s = getComputedStyle(row);
      return {background:s.backgroundColor,color:s.color,font:s.fontSize,
        border:s.borderTopWidth,decoration:s.textDecorationLine};
    })()`);
    const point = await evaluate(`(() => {
      const r=document.querySelector('${row}').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`);
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...point
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const hover = await evaluate(
      `getComputedStyle(document.querySelector('${row}')).backgroundColor`
    );
    const selected = await evaluate(`(() => {
      const row=document.querySelector('${row}');row.setAttribute('aria-current','page');
      return getComputedStyle(row).backgroundColor;
    })()`);
    await key('Tab', 'Tab', 9);
    const focus = await evaluate(`(() => {
      const row = document.querySelector('${row}'); row.focus();
      const style = getComputedStyle(row);
      return {width:style.outlineWidth, style:style.outlineStyle,
        color:style.outlineColor,offset:style.outlineOffset};
    })()`);
    if (route === 'preferences') {
      assert.equal(
        await evaluate('document.title'),
        'Appearance · Preferences'
      );
    }
    if (route === 'contacts') {
      await click('.swb-contact-select');
      await wait('document.title === "UI review · Contacts"');
      const actions = await evaluate(`(() => {
        const edit = document.querySelector('[data-simply-command=editProfile]');
        const remove = document.querySelector('[data-simply-command=remove]');
        const profile = document.querySelector('.swb-contact-profile');
        return {sameToolbar: edit.parentElement === remove.parentElement,
          sameRow: edit.getBoundingClientRect().top === remove.getBoundingClientRect().top,
          aboveProfile: edit.getBoundingClientRect().bottom <= profile.getBoundingClientRect().top};
      })()`);
      assert.deepEqual(actions, {
        sameToolbar: true,
        sameRow: true,
        aboveProfile: true
      });
    }
    if (route === 'files') {
      assert.equal(await evaluate('document.title'), 'storage');
      await click('.swb-file-name');
      await wait('document.title === "Examples"');
    }
    const chromeStyle = await evaluate(`(() => {
      const header=document.querySelector('.swb-suite-header');
      const title=header.querySelector('.swb-header-title');
      const button=header.querySelector('.swb-account-button');
      const toolbar=header.querySelector('.muze-solid-ui-app-toolbar');
      return {background:getComputedStyle(header).backgroundColor,
        font:getComputedStyle(title).fontSize,
        title:title.getBoundingClientRect().height,
        button:button.getBoundingClientRect().height,
        toolbar:toolbar.checkVisibility()?toolbar.getBoundingClientRect().height:null,
        slant:getComputedStyle(button,'::before').clipPath,
        marker:getComputedStyle(button,'::before').backgroundColor};
    })()`);
    assert.equal(chromeStyle.background, 'rgba(0, 0, 0, 0)');
    assert.equal(chromeStyle.title, 44, route + ' title row');
    assert.equal(chromeStyle.font, '20px', route + ' title hierarchy');
    assert.equal(chromeStyle.button, 44, route + ' dropdown height');
    if (chromeStyle.toolbar !== null) {
      assert.equal(chromeStyle.toolbar, 44, route + ' main actions height');
    }
    assert.match(chromeStyle.slant, /polygon/);
    assert.notEqual(chromeStyle.marker, 'rgba(0, 0, 0, 0)');
    await checkMarker('.swb-account-button');
    const divider = await evaluate(`(() => {
      const pane = document.querySelector('.swb-list-pane.ds-panels-list');
      const style = getComputedStyle(pane);
      return {paneWidth:pane.getBoundingClientRect().width,width:style.borderInlineEndWidth, color:style.borderInlineEndColor,
        style:style.borderInlineEndStyle};
    })()`);
    states.push({
      route,
      normal,
      hover,
      selected,
      chromeStyle,
      divider,
      focus
    });
    assert.equal(
      await evaluate(
        `[...document.querySelectorAll('.swb-suite-header input,.swb-suite-header select,.swb-suite-header textarea')].filter(el=>!el.closest('dialog,[popover]')).length`
      ),
      0
    );
    await capture('ui-' + route + '-desktop');
  }
  console.log('Row styles', JSON.stringify(states));
  for (const state of states.slice(1)) {
    assert.deepEqual(
      state.divider,
      states[0].divider,
      state.route + ' divider'
    );
    assert.deepEqual(
      state.focus,
      states[0].focus,
      state.route + ' keyboard focus'
    );
    assert.equal(state.chromeStyle.font, states[0].chromeStyle.font);
    assert.equal(
      state.chromeStyle.background,
      states[0].chromeStyle.background
    );
    assert.deepEqual(
      state.normal,
      states[0].normal,
      state.route + ' normal state'
    );
    assert.equal(state.hover, states[0].hover, state.route + ' hover state');
    assert.equal(
      state.selected,
      states[0].selected,
      state.route + ' selected state'
    );
  }
  console.log('PASS identical list states and no main-bar form inputs');
  for (const mode of ['light', 'dark']) {
    const surfaces = await evaluate(`(() => {
      document.body.classList.remove('ds-lightmode','ds-darkmode','ds-darkmode-auto');
      document.body.classList.add('ds-${mode}mode');
      return ['.swb-suite-status', '.swb-file-controls'].map(selector =>
        getComputedStyle(document.querySelector(selector)).backgroundColor);
    })()`);
    assert.equal(surfaces[0], surfaces[1], mode + ' Files status surface');
    assert.equal(surfaces[0], 'rgba(0, 0, 0, 0)');
  }
  for (const width of [390, 1920]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 720
    });
    const widths = await evaluate(`[
      '.swb-suite-header', '.swb-app-content',
      '.muze-solid-files-context', '.muze-solid-design-list-details'
    ].map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {selector, left:rect.left, width:rect.width};
    })`);
    for (const box of widths) {
      assert.equal(box.left, 0, box.selector + ' starts at viewport edge');
      assert.equal(box.width, width, box.selector + ' fills viewport');
    }
    await capture('ui-files-width-' + width);
  }
  console.log('PASS Files fills phone and wide desktop viewport');
  await page.send('Page.navigate', {
    url:
      origin +
      '/viewer/#resource=' +
      encodeURIComponent(origin + '/storage/report%20one.txt?version=2')
  });
  await page.ready();
  await wait('document.title === "report one.txt"');
  console.log(
    'PASS resource/section/person tab titles describe current content'
  );
  await visit('notebook');
  await wait('document.querySelector(".muze-solid-design-toolbar-floating")');
  const shadows = {};
  for (const mode of ['light', 'dark']) {
    shadows[mode] = await evaluate(`(() => {
      document.body.classList.remove('ds-lightmode','ds-darkmode','ds-darkmode-auto');
      document.body.classList.add('ds-${mode}mode');
      return getComputedStyle(document.querySelector('.muze-solid-design-toolbar-floating')).boxShadow;
    })()`);
  }
  assert.notEqual(shadows.light, shadows.dark);
  assert.match(
    shadows.dark,
    /0px 0px/,
    'dark floating toolbar uses nondirectional glow'
  );
  console.log('PASS dark floating toolbar glow', shadows);

  for (const route of [
    'workbench',
    'contacts',
    'files',
    'profile',
    'preferences',
    'account',
    'viewer',
    'presenter',
    'notebook'
  ]) {
    console.log('Checking app widths', route);
    await visit(route);
    await wait(
      'document.querySelector(".swb-suite-main,.swb-account-controls")'
    );
    for (const width of [390, 1920]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 720
      });
      if (route === 'account') {
        // Account is an embedded form and deliberately has no suite shell.
        assert.equal(
          await evaluate('document.querySelector(".swb-app-content") === null'),
          true
        );
        await capture('ui-width-' + route + '-' + width);
        continue;
      }
      const layout = await evaluate(`(() => {
        const main = document.querySelector('.swb-suite-main');
        const content = document.querySelector('.swb-app-content');
        const style = getComputedStyle(main);
        return {
          available: main.clientWidth - parseFloat(style.paddingLeft)
            - parseFloat(style.paddingRight),
          content: content.getBoundingClientRect().width,
          maximum: getComputedStyle(content).maxWidth,
          fits: document.documentElement.scrollWidth <= innerWidth
        };
      })()`);
      assert.equal(layout.maximum, 'none', route + ' has no shell width cap');
      assert.ok(
        Math.abs(layout.content - layout.available) < 1,
        route + ' fills main within fractional pixel rounding'
      );
      assert.equal(layout.fits, true, route + ' fits viewport');
      if (route === 'notebook') {
        const collection = await evaluate(`(() => {
          const overview = document.querySelector('.muze-solid-notebook-collections-overview');
          return {visible:overview.checkVisibility(),
            width:overview.getBoundingClientRect().width,
            documentMax:getComputedStyle(document.querySelector('.muze-solid-notebook-editor-container')).maxWidth};
        })()`);
        assert.equal(collection.visible, true);
        assert.ok(Math.abs(collection.width - layout.available) < 1);
        assert.equal(collection.documentMax, '928px');
      }
      await capture('ui-width-' + route + '-' + width);
    }
  }
  console.log('PASS all nine apps fit phone/desktop; eight shells fill main');
  // An opaque-origin frame verifies dismissal without reading frame contents.
  for (const route of ['contacts', 'files']) {
    await visit(route);
    await wait(
      'document.querySelector(".swb-account-button")?.checkVisibility()'
    );
    await evaluate(`(() => {
      const frame = document.createElement('iframe');
      frame.title = 'Cross-origin focus fixture';
      frame.id = 'test-focus-frame';
      frame.src = 'data:text/html,<button style="width:100vw;height:100vh">Focus</button>';
      frame.style = 'position:fixed;left:16px;bottom:16px;width:100px;height:100px;z-index:1000';
      document.querySelector('.swb-root').append(frame);
    })()`);
    await click('.swb-account-button');
    await wait('document.querySelector(".swb-account-menu:popover-open")');
    await click('#test-focus-frame');
    await wait('document.activeElement?.id === "test-focus-frame"');
    await wait('!document.querySelector(".swb-account-menu:popover-open")');
  }
  console.log('PASS shared popup dismissal on opaque-origin iframe focus');
  assert.equal(authoringRequests, 0);
}
finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
}
