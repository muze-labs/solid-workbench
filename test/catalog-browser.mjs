import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';

let origin;
let unavailable = false;
const requests = [];
const handler = async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(request.url, origin);
  requests.push(url.pathname);
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/other/index.ttl') {
    if (unavailable) {
      response.writeHead(503).end('Unavailable');
      return;
    }
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`@prefix s: <https://schema.org/>.
      <> s:hasPart <#app>.
      <#app> s:name "Independent app"; s:image <../catalog/external-app.svg>;
        s:description "Independent catalog"; s:subjectOf <app.ttl>;
        s:text "Detailed information from another source.";
        s:screenshot <../contacts/icon.svg>.`);
    return;
  }
  if (url.pathname === '/other/app.ttl') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`@prefix s: <https://schema.org/>.
      @prefix apps: <https://vocab.muze.nl/solid-apps#>.
      <> a s:SoftwareApplication; s:name "Independent app";
        s:url <${origin}/external/>; s:image <../catalog/external-app.svg>;
        apps:anonymousLaunch true.`);
    return;
  }
  if (url.pathname === '/external/') {
    response.end('<!doctype html><h1>Independent app</h1>');
    return;
  }
  if (
    unavailable && url.pathname.startsWith('/catalog/') &&
    url.pathname.endsWith('.ttl')
  ) {
    response.writeHead(503).end('Unavailable');
    return;
  }
  try {
    const path =
      url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
    const data = await readFile(new URL('../www' + path, import.meta.url));
    const extension = path.split('.').pop();
    response.setHeader(
      'Content-Type',
      {
        js: 'text/javascript',
        css: 'text/css',
        svg: 'image/svg+xml',
        ttl: 'text/turtle',
        png: 'image/png',
        ico: 'image/x-icon'
      }[extension] || 'text/html'
    );
    response.end(data);
  }
  catch {
    response.writeHead(404).end();
  }
};
const server = createServer(handler);
const secondServer = createServer(handler);
await new Promise((resolve) => secondServer.listen(0, '127.0.0.1', resolve));
const secondOrigin = 'http://127.0.0.1:' + secondServer.address().port;
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
let chrome, page;
async function evaluate(code) {
  const result = await page.send('Runtime.evaluate', {
    expression: code,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(code) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    if (await evaluate('Boolean(' + code + ')')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out: ' + code);
}
async function click(selector, sourceUrl = '') {
  await wait('!document.getAnimations().some(a => a.playState === "running")');
  const target = `(() => {
    const candidates = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const sourceUrl = ${JSON.stringify(sourceUrl)};
    return sourceUrl
      ? candidates.find(button => button.closest('li').querySelector('.swb-resource-url').textContent === sourceUrl)
      : candidates[0];
  })()`;
  await evaluate(
    `${target}.scrollIntoView({ behavior: 'instant', block: 'center' })`
  );
  await evaluate(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  );
  const point = await evaluate(`(() => {
    const element = ${target};
    const rect = element.getBoundingClientRect();
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    if (!element.contains(document.elementFromPoint(point.x, point.y))) {
      throw new Error('Pointer target is covered: ' + element.outerHTML);
    }
    return point;
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
async function category(id) {
  const needsBack = await evaluate(`innerWidth < 720 &&
    document.querySelector('.muze-solid-catalog-layout').scrollLeft > 10`);
  if (needsBack) {
    await click(
      '.muze-solid-catalog-dialog [data-simply-command=muzeSolidDesignShowList]'
    );
    await wait(
      'document.querySelector(".muze-solid-catalog-layout").scrollLeft < 2'
    );
  }
  await click(
    '[data-simply-command="muzeSolidCatalogCategory"][data-muze-solid-catalog-category="' +
      id +
      '"]'
  );
  await wait('document.activeElement.matches(".muze-solid-catalog-heading")');
  await wait('!document.getAnimations().some(a => a.playState === "running")');
}
async function reopen() {
  await wait('!muzeSolidLauncherApp.runtime.catalogBusy');
  await click('[data-simply-command=muzeSolidCatalogOpen]');
  await wait(
    'document.querySelector(".muze-solid-catalog-dialog").open && !muzeSolidLauncherApp.runtime.catalogBusy'
  );
  await category('all');
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
async function screenshot(name) {
  await wait('!document.getAnimations().some(a => a.playState === "running")');
  const result = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    '/tmp/demo-' + name + '.png',
    Buffer.from(result.data, 'base64')
  );
}
try {
  chrome = await startChrome(origin + '/external/', { allowPopups: true });
  page = await chrome.page();
  await page.ready();
  await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 51200,
    uploadThroughput: 51200
  });
  await page.send('Page.navigate', { url: origin + '/workbench/' });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await wait('window.solidLauncher?.store');
  assert.equal(
    requests.includes('/catalog/index.ttl'),
    false,
    'catalog is loaded on demand'
  );
  await click('[data-simply-command=muzeSolidCatalogOpen]');
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogApps.length === 8 && !muzeSolidLauncherApp.runtime.catalogBusy'
  );
  await wait(
    'document.querySelectorAll(".muze-solid-catalog-card").length === 8'
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-catalog-dialog").scrollWidth <= innerWidth'
    ),
    true
  );
  await wait(
    `[...document.querySelectorAll('.muze-solid-catalog-icon')].filter(img => img.getBoundingClientRect().top < innerHeight).every(img => img.complete && img.naturalWidth > 0)`
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-catalog-dialog .muze-solid-design-dialog-close").getBoundingClientRect().right >= innerWidth - 2'
    ),
    true
  );
  assert.equal(
    await evaluate(
      'Array.from(document.querySelectorAll(".muze-solid-catalog-dialog button"), b => b.textContent.trim()).includes("Done")'
    ),
    false
  );
  assert.equal(requests.includes('/catalog/screenshots/presenter.png'), false);
  await screenshot('catalog-phone-categories');
  await category('category:People');
  await wait('muzeSolidLauncherApp.data.muzeSolidCatalogApps.length === 2');
  await screenshot('catalog-phone-category');
  const cold = await evaluate(
    `({ elapsedMs: performance.now(), bytes: performance.getEntriesByType('navigation').concat(performance.getEntriesByType('resource')).reduce((n, e) => n + e.transferSize, 0), entries: performance.getEntriesByType('resource').length + 1 })`
  );
  await writeFile('/tmp/demo-catalog-cold.json', JSON.stringify(cold));
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await click('[data-simply-command=muzeSolidDesignShowList]');
  await wait('document.activeElement.getAttribute("aria-current") === "page"');
  await key('ArrowDown', 'ArrowDown', 40);
  assert.equal(
    await evaluate('document.activeElement.dataset.muzeSolidCatalogCategory'),
    'category:Productivity'
  );
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogCategoryTitle === "Productivity"'
  );
  await key('Tab', 'Tab', 9);
  await wait(
    'document.activeElement.getAttribute("aria-label") === "Search apps"'
  );
  await category('all');
  await click('[data-simply-command=muzeSolidCatalogInfo]');
  await wait(
    'document.querySelector("#muze-solid-catalog-info").checkVisibility()'
  );
  assert.ok(
    await evaluate(
      'muzeSolidLauncherApp.data.muzeSolidCatalogInfo.text.length > 30'
    )
  );
  await screenshot('catalog-phone-info');
  await click('[data-simply-command=muzeSolidCatalogInfoBack]');
  await wait(
    'document.activeElement.dataset.simplyCommand === "muzeSolidCatalogInfo"'
  );
  await category('category:Productivity');
  await click('[aria-label="More info about Presenter"]');
  await wait(
    'document.querySelector(".muze-solid-catalog-screenshot").naturalWidth > 0'
  );
  assert.equal(requests.includes('/catalog/screenshots/presenter.png'), true);
  await screenshot('catalog-presenter-info');
  await click('[data-simply-command=muzeSolidCatalogInfoBack]');
  await category('all');
  await screenshot('catalog-phone');
  await click('[aria-label="Search apps"]');
  await key('Tab', 'Tab', 9);
  await key('Tab', 'Tab', 9);
  assert.equal(
    await evaluate('document.activeElement.dataset.simplyCommand'),
    'muzeSolidCatalogAdd'
  );
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogStatus.includes("added to your apps")'
  );
  await wait('!document.querySelector(".muze-solid-catalog-dialog").open');
  const firstName = await evaluate(
    'muzeSolidLauncherApp.data.muzeSolidCatalogApps[0].name'
  );
  await reopen();
  await click(
    '.muze-solid-catalog-card [data-simply-command=muzeSolidCatalogAdd]'
  );
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogStatus.includes("already")'
  );
  assert.equal(
    await evaluate(
      'solidLauncher.store.collection.list().filter(n => String(n.schema$name) === ' +
        JSON.stringify(firstName) +
        ').length'
    ),
    1
  );
  await reopen();
  await category('sources');
  await click('.muze-solid-catalog-source-panel summary');
  await evaluate(
    `document.querySelector('[name=catalogUrl]').value = '${secondOrigin}/other/index.ttl'`
  );
  await click('[data-simply-command=muzeSolidCatalogAddSource] button');
  await wait(
    'muzeSolidLauncherApp.runtime.catalogModel?.state.data.length === 9 && !muzeSolidLauncherApp.runtime.catalogBusy'
  );
  await category('all');
  await click('[aria-label="Search apps"]');
  await page.send('Input.insertText', { text: 'Independent catalog' });
  await wait(
    'document.querySelectorAll(".muze-solid-catalog-card").length === 1'
  );
  await click('[data-simply-command=muzeSolidCatalogInfo]');
  await wait(
    'document.querySelector("#muze-solid-catalog-info").checkVisibility()'
  );
  await click(
    '#muze-solid-catalog-info [data-simply-command=muzeSolidCatalogAdd]'
  );
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogStatus.includes("Independent app added")'
  );
  assert.equal(
    await evaluate(
      `muzeSolidLauncherApp.data.shortcuts.find(s => s.label === 'Independent app').link.href`
    ),
    origin + '/external/'
  );
  await wait('!document.querySelector(".muze-solid-catalog-dialog").open');
  await reopen();
  await click('[data-simply-command=muzeSolidCatalogInfo]');
  await wait(
    'document.querySelector(".muze-solid-catalog-screenshot").naturalWidth > 0'
  );
  assert.equal(
    await evaluate('muzeSolidLauncherApp.data.muzeSolidCatalogInfo.text'),
    'Detailed information from another source.'
  );
  await screenshot('catalog-phone-screenshot');
  await click('[data-simply-command=muzeSolidCatalogInfoBack]');
  unavailable = true;
  await click('[data-simply-command=muzeSolidCatalogRefresh]');
  await wait('!muzeSolidLauncherApp.runtime.catalogBusy');
  assert.equal(
    await evaluate(
      'muzeSolidLauncherApp.data.muzeSolidCatalogSources.every(s => s.status.includes("Showing saved apps"))'
    ),
    true
  );
  await page.send('Page.reload');
  await page.ready();
  await wait('window.solidLauncher?.store');
  await click('[data-simply-command=muzeSolidCatalogOpen]');
  await wait(
    'muzeSolidLauncherApp.runtime.catalogModel?.state.data.length === 9 && !muzeSolidLauncherApp.runtime.catalogBusy'
  );
  assert.equal(
    await evaluate(
      `muzeSolidLauncherApp.data.shortcuts.some(s => s.label === 'Independent app')`
    ),
    true
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await category('all');
  await screenshot('catalog-desktop');
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await screenshot('catalog-dark');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await category('manual');
  await wait(
    'document.querySelector(".muze-solid-catalog-manual-form").checkVisibility()'
  );
  await click('.muze-solid-catalog-manual-form [name=name]');
  await page.send('Input.insertText', { text: 'Manual app' });
  await click('[aria-label="Close app catalog"]');
  await wait('!document.querySelector(".muze-solid-catalog-dialog").open');
  await reopen();
  await category('manual');
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-catalog-manual-form [name=name]").value'
    ),
    'Manual app'
  );
  await click('.muze-solid-catalog-manual-form [name=url]');
  await page.send('Input.insertText', { text: origin + '/external/?manual=1' });
  await click('.muze-solid-catalog-manual-form [name=manifest]');
  await page.send('Input.insertText', {
    text: origin + '/missing-manifest.ttl'
  });
  await click('.muze-solid-catalog-manual-form button');
  await wait('!muzeSolidLauncherApp.runtime.catalogBusy');
  assert.equal(
    await evaluate('document.querySelector(".muze-solid-catalog-dialog").open'),
    true
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-catalog-manual-form [name=name]").value'
    ),
    'Manual app'
  );
  await screenshot('catalog-manual-error');
  await click('.muze-solid-catalog-manual-form [name=manifest]');
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'a',
    code: 'KeyA',
    modifiers: 2,
    windowsVirtualKeyCode: 65
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'a',
    code: 'KeyA',
    modifiers: 2,
    windowsVirtualKeyCode: 65
  });
  await key('Backspace', 'Backspace', 8);
  await click('.muze-solid-catalog-manual-form button');
  await wait('!document.querySelector(".muze-solid-catalog-dialog").open');
  await wait(
    'muzeSolidLauncherApp.data.shortcuts.some(s => s.label === "Manual app")'
  );
  await reopen();
  await category('sources');
  await click('.muze-solid-catalog-source-panel summary');
  await wait(
    'document.querySelectorAll("[data-simply-command=muzeSolidCatalogRemoveSource]").length === 2'
  );
  await click(
    '[data-simply-command=muzeSolidCatalogRemoveSource]',
    origin + '/catalog/index.ttl'
  );
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogSources.length === 1 && !muzeSolidLauncherApp.runtime.catalogBusy'
  );
  assert.equal(await evaluate('muzeSolidLauncherApp.data.shortcuts.length'), 3);
  await page.send('Page.reload');
  await page.ready();
  await wait('window.solidLauncher?.store');
  await click('[data-simply-command=muzeSolidCatalogOpen]');
  await wait(
    'muzeSolidLauncherApp.data.muzeSolidCatalogApps.length === 1 && !muzeSolidLauncherApp.runtime.catalogBusy'
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
  await wait('!document.querySelector(".muze-solid-catalog-dialog").open');
  assert.equal(
    await evaluate('document.activeElement.dataset.simplyCommand'),
    'muzeSolidCatalogOpen'
  );
  // Open the saved external link with an ordinary native click.
  const selector = '.swb-shortcut-link[href="' + origin + '/external/"]';
  await click(selector);
  let external;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const targets = await page.send('Target.getTargets');
    external = targets.targetInfos.find((t) => t.url === origin + '/external/');
    if (external) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(external, 'external app launches at its unchanged URL');
  await page.send('Target.closeTarget', { targetId: external.targetId });
  console.log(
    'PASS: native catalog open/add/launch, duplicate prevention, two sources, search, cached failure/reload, phone/desktop/dark and Escape focus return.'
  );
}
catch (error) {
  await screenshot('catalog-failure');
  console.error(await evaluate('document.body.innerText'));
  throw error;
}
finally {
  page?.close();
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => secondServer.close(resolve));
}
