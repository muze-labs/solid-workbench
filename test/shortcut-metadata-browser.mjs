import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';

const discovered = [];
let webOrigin;
let release;
const gated = new Promise((resolve) => { release = resolve; });
async function metadata(request, response, provider) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.authorization, undefined);
  assert.equal(request.headers.cookie, undefined);
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const { url } = JSON.parse(Buffer.concat(chunks));
  discovered.push({ url, provider });
  if (url.includes('slow')) {
    await gated;
  }
  response.writeHead(200, { 'Content-Type': 'application/json' }).end(
    JSON.stringify({ title: provider + ' title', iconUrl: '/icon.png' })
  );
}
async function icon(response) {
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'image/png'
  }).end(await readFile(new URL('../apps/launcher/src/favicon-32.png', import.meta.url)));
}
const custom = createServer((request, response) =>
  request.url === '/icon.png'
    ? icon(response)
    : metadata(request, response, 'Custom provider')
);
const workbench = createServer(async (request, response) => {
  const path = new URL(request.url, webOrigin).pathname;
  if (path === '/shortcut-metadata') {
    return metadata(request, response, 'Default provider');
  }
  if (path === '/icon.png') {
    return icon(response);
  }
  try {
    const file = path.endsWith('/') ? path + 'index.html' : path;
    const types = {
      html: 'text/html', js: 'text/javascript', css: 'text/css',
      svg: 'image/svg+xml', png: 'image/png', ttl: 'text/turtle'
    };
    response.setHeader('Content-Type', types[file.split('.').pop()] || 'application/octet-stream');
    response.end(await readFile(new URL('../www' + file, import.meta.url)));
  }
  catch {
    response.writeHead(404).end();
  }
});
function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () =>
    resolve('http://127.0.0.1:' + server.address().port)
  ));
}
const customOrigin = await listen(custom);
webOrigin = await listen(workbench);
let chrome;
try {
  chrome = await startChrome(webOrigin + '/workbench/');
  const page = await chrome.page();
  await page.ready();
  const evaluate = async (expression) => {
    const result = await page.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate('Boolean(' + expression + ')')) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const state = await evaluate(`JSON.stringify({
      shortcuts: solidLauncher.ui.data.shortcuts,
      alert: document.body.innerText
    })`);
    throw new Error('Timed out: ' + expression + '\n' + state + '\n' +
      JSON.stringify(discovered));

  };
  await wait('window.solidLauncher?.store');
  const deepLink = 'https://example.org/a?view=all#section';
  await evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.setData('text/uri-list', '# Browser link\\r\\n' + ${JSON.stringify(deepLink)});
    const screen = document.querySelector('[data-muze-solid-launcher-screen=""]');
    for (const type of ['dragover', 'drop']) {
      screen.dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }
  })()`);
  await wait('document.querySelector(".swb-shortcut-link")?.title === "Default provider title"');
  await wait('document.querySelector(".swb-shortcut-image").naturalWidth > 0');
  assert.deepEqual(discovered[0], {
    url: 'https://example.org/a?view=all',
    provider: 'Default provider'
  });
  assert.equal(await evaluate('document.querySelector(".swb-shortcut-link").href'), deepLink);
  assert.match(await evaluate('document.querySelector(".swb-shortcut-link").rel'), /noopener/);

  const customEndpoint = customOrigin + '/shortcut-metadata';
  await evaluate(`(async () => {
    const host = solidLauncher.host;
    await host.readLocalPreferences();
    const state = host.view.runtime.preferences.state;
    const url = ${JSON.stringify(customEndpoint)};
    await state.change('shortcutMetadataProvider', { application: url, url });
  })()`);
  await evaluate(`solidLauncher.ui.actions.addShortcut({
    url: 'https://example.org/slow', mode: '',
    destination: { before: solidLauncher.ui.data.shortcuts[0].id }
  }).then(() => true)`);
  await wait('document.querySelector(".swb-shortcut-link")?.title === "example.org"');
  const firstId = await evaluate('solidLauncher.ui.data.shortcuts[0].id');
  await evaluate(`(() => {
    const li = document.querySelector('.swb-shortcut');
    const dialog = li.querySelector('dialog');
    dialog.showModal();
    dialog.querySelector('[name="swb_shortcutName"]').value = 'My name';
    return solidLauncher.ui.commands.call('swb_editShortcut',
      dialog.querySelector('button'), ${JSON.stringify(firstId)}).then(() => true);
  })()`);
  release();
  await wait('document.querySelector(".swb-shortcut-image")?.src.startsWith(' +
    JSON.stringify(customOrigin) + ')');
  assert.equal(await evaluate('document.querySelector(".swb-shortcut-link").title'), 'My name');
  assert.deepEqual(discovered[1], {
    url: 'https://example.org/slow',
    provider: 'Custom provider'
  });
  await page.send('Page.navigate', { url: webOrigin + '/workbench/' });
  await page.ready();
  await wait('document.querySelector(".swb-shortcut-link")?.title === "My name"');
  assert.equal(await evaluate('document.querySelectorAll(".swb-shortcut-link")[1].href'), deepLink);
  assert.equal(discovered.length, 2);
  assert.equal(await evaluate(`solidLauncher.host.readLocalPreferences()
    .then((preferences) => preferences.values.shortcutMetadataProvider.url)`),
  customEndpoint);
  await evaluate(`(() => {
    const form = document.querySelector('.muze-solid-catalog-manual-form');
    form.elements.url.value = 'https://example.net/offline?entry=1#start';
    form.elements.localOnly.checked = true;
    form.requestSubmit();
  })()`);
  await wait('solidLauncher.ui.data.shortcuts.some(row => row.label === "example.net")');
  assert.equal(discovered.length, 2);
  console.log('PASS shortcut drop, provider origins, manual name, placement, reload and local-only paste');
}
finally {
  release();
  await chrome?.close();
  await Promise.all([custom, workbench].map((server) =>
    new Promise((resolve) => server.close(resolve))
  ));
}
