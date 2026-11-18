import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';

const requests = [];
const mime = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  svg: 'image/svg+xml'
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const route = url.pathname;
  requests.push(route);
  const file = route.endsWith('/') ? route + 'index.html' : route;
  try {
    const bytes = await readFile(new URL('../www' + file, import.meta.url));
    response.writeHead(200, {
      'Content-Type': mime[file.split('.').pop()] || 'application/octet-stream'
    }).end(bytes);
  }
  catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let chrome;
try {
  chrome = await startChrome('about:blank');
  const page = await chrome.page();
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await page.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    assert.equal(exceptionDetails, undefined, JSON.stringify(exceptionDetails));
    return result.value;
  };
  const wait = async (expression) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (await evaluate('Boolean(' + expression + ')')) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Design extension browser timeout: ' + expression);
  };
  async function visit(path) {
    await page.send('Page.navigate', { url: origin + path });
    await page.ready();
  }
  async function key(key, code) {
    for (const type of ['keyDown', 'keyUp']) {
      await page.send('Input.dispatchKeyEvent', {
        type, key, code: key, windowsVirtualKeyCode: code
      });
    }
  }
  async function hasAccessibilityRole(role, name) {
    const { nodes } = await page.send('Accessibility.getFullAXTree');
    return nodes.some((node) => !node.ignored && node.role?.value === role &&
      (name === undefined || node.name?.value === name));
  }
  const menu = (name) => '#solid-example-' + name;
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await visit('/design-examples/');
  assert.equal(await evaluate('document.scripts.length'), 0);
  assert(!requests.some((request) => request.endsWith('.js')));
  assert.equal(await evaluate(
    'document.querySelector("input").labels[0].textContent.trim()'
  ), 'Search example');
  assert(await hasAccessibilityRole('search'));
  assert(await hasAccessibilityRole('searchbox', 'Search example'));

  // Different block offsets expose any accidental reuse of one trigger.
  await evaluate(`(() => {
    const group = document.querySelector(
      '[popovertarget="solid-example-first"]'
    ).parentElement.parentElement;
    group.style.flexDirection = 'column';
    group.style.alignItems = 'start';
  })()`);
  for (const name of ['first', 'second']) {
    const id = menu(name).slice(1);
    await evaluate(`(() => {
      const trigger = document.querySelector('[popovertarget="${id}"]');
      trigger.focus();
      trigger.click();
      document.querySelector('${menu(name)} a').focus();
    })()`);
    assert.equal(await evaluate(`document.querySelector('${menu(name)}').matches(':popover-open')`), true);
    assert(await hasAccessibilityRole('list'));
    const geometry = await evaluate(`(() => {
      const trigger = document.querySelector('[popovertarget="${id}"]');
      const panel = document.querySelector('${menu(name)}');
      const button = trigger.getBoundingClientRect();
      const rectangle = panel.getBoundingClientRect();
      return {
        separation: rectangle.top - button.bottom,
        offset: Math.abs(rectangle.left - button.left),
        visible: rectangle.left >= 0 && rectangle.right <= innerWidth,
        button: button.toJSON(),
        rectangle: rectangle.toJSON(),
        area: getComputedStyle(panel).positionArea,
        anchor: getComputedStyle(panel).positionAnchor,
        supports: CSS.supports('position-area: block-end')
      };
    })()`);
    assert(geometry.visible && geometry.separation >= 0 &&
      geometry.separation <= 12, JSON.stringify(geometry));
    if (name === 'first') {
      assert(geometry.offset <= 12, JSON.stringify(geometry));
    }
    await key('Escape', 27);
    await wait(`document.activeElement.getAttribute('popovertarget') === '${id}'`);
  }

  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await wait('getComputedStyle(document.querySelector("main")).colorScheme === "dark"');
  await evaluate('document.documentElement.style.fontSize="200%"');
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));

  await visit('/design-examples/simplyflow.html');
  await wait('document.querySelectorAll("#results li").length === 3');
  assert.equal(await evaluate(
    'document.querySelector("input").labels[0].textContent.trim()'
  ), 'Filter resources');
  assert(await hasAccessibilityRole('search'));
  assert(await hasAccessibilityRole('searchbox', 'Filter resources'));
  assert(await hasAccessibilityRole('status'));
  await evaluate(`(() => {
    const input = document.querySelector('input');
    input.focus();
  })()`);
  await page.send('Input.insertText', { text: 'slide' });
  await wait('document.querySelectorAll("#results li").length === 1');
  assert.equal(await evaluate('document.querySelector("#results li").textContent'), 'Slides');
  await page.send('Input.insertText', { text: 'xyz' });
  await wait('document.querySelector("output").textContent === "No matching resources." && ' +
    'document.querySelectorAll("#results li").length === 0');
  await evaluate(`document.querySelector('[popovertarget="solid-example-menu"]').focus()`);
  await key('ArrowDown', 40);
  await wait('document.activeElement.textContent.trim() === "Native HTML example"');
  await key('ArrowDown', 40);
  await wait('document.activeElement.textContent.trim() === "Results"');
  await key('Escape', 27);
  await wait('document.activeElement.matches("[popovertarget]")');
  assert.equal(await evaluate('document.querySelector("#solid-example-menu").matches(":popover-open")'), false);

  requests.length = 0;
  await visit('/contacts/');
  await wait('window.solidContacts && document.querySelector(".solid-list-search-icon")');
  for (const sheet of ['search', 'anchored-menu']) {
    assert.equal(await evaluate(
      `document.querySelectorAll('style[id="solid-${sheet}.css"]').length`
    ), 1, sheet);
  }
  assert(!requests.some((request) =>
    request.includes('design-examples') || request.endsWith('workbench-design.css')
  ));
  console.log('PASS native component sheet, distinct popovers, focus, dark/phone layout, SimplyFlow search and optional asset isolation.');
}
finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
}
