import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';

let origin;
const folders = new Set();
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);

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
try {
  chrome = await startChrome(origin + '/contacts/');
  page = await chrome.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await wait('window.solidContacts?.store');
  await click('[data-simply-command=newContact]');
  await click('.new-contact-dialog [name=name]');
  await page.send('Input.insertText', { text: 'Demo colleague' });
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    'document.querySelector(".swb-person-list").textContent.includes("Demo colleague")'
  );
  await wait('!document.querySelector(".new-contact-dialog").open');
  await wait('!document.getAnimations().some(a => a.playState === "running")');
  const searchPosition = await evaluate(`(() => {
    const toolbar = document.querySelector('.swb-contacts-toolbar').getBoundingClientRect();
    const list = document.querySelector('.swb-contacts-list').getBoundingClientRect();
    return { bottom: toolbar.bottom, listBottom: list.bottom, top: toolbar.top };
  })()`);
  assert.ok(Math.abs(searchPosition.bottom - searchPosition.listBottom) < 12);
  assert.ok(
    searchPosition.top > 600,
    'Contacts search stays within phone thumb reach'
  );
  await evaluate(`(() => {
    globalThis.muzeSolidContactsTestRows = solidContacts.ui.runtime.people.state.data;
    const example = muzeSolidContactsTestRows[0];
    solidContacts.ui.runtime.people.state.data = Array.from({ length: 50 }, (_, index) => ({
      ...example, id: 'urn:contacts-scroll-fixture:' + index,
      label: 'Example contact ' + index
    }));
  })()`);
  await wait('document.querySelectorAll(".swb-contact-select").length === 50');
  const listPoint = await evaluate(`(() => {
    const box = document.querySelector('.swb-contacts-scroll').getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })()`);
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    ...listPoint,
    deltaX: 0,
    deltaY: 500
  });
  await wait('document.querySelector(".swb-contacts-scroll").scrollTop > 0');
  assert.equal(
    await evaluate(
      'document.querySelector(".swb-contacts-toolbar").getBoundingClientRect().top'
    ),
    searchPosition.top
  );
  await evaluate(
    'solidContacts.ui.runtime.people.state.data = muzeSolidContactsTestRows'
  );
  await wait('document.querySelectorAll(".swb-contact-select").length === 1');
  await click('[aria-label="Search contacts"]');
  await page.send('Input.insertText', { text: 'missing contact' });
  await wait('!document.querySelector(".swb-contact-select")');
  await key('Escape', 'Escape', 27);
  // Native search Escape clears the search text and updates the list.
  await wait('document.querySelector(".swb-contact-select")');
  await capture('contacts-phone');
  await click('.swb-contact-select');
  await wait(
    'document.querySelector(".muze-solid-profile-edit").checkVisibility()'
  );
  await click('[data-simply-command=editProfile]');
  await wait('document.querySelector(".swb-profile-form").checkVisibility()');
  await capture('contacts-edit-phone');
  await click('[data-simply-command=cancelProfile]');
  await wait('!document.querySelector(".swb-profile-form").checkVisibility()');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await capture('contacts-desktop');
  await visit('preferences');
  await wait('window.swbPreferencesApp?.runtime');
  await wait('document.querySelector("[name=theme]").checkVisibility()');
  await click('[name=theme]');
  await key('l', 'KeyL', 76, 'l');
  await key('Enter', 'Enter', 13, '\r');
  await capture('preferences-desktop');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await capture('preferences-phone');
  await evaluate(
    `localStorage.setItem('solid-apps.webId', '${origin}/profile#me')`
  );
  await visit('files');
  await wait(
    'window.solidFiles?.host.session && solidFiles.ui.runtime.current'
  );
  await click('[aria-label="New folder"]');
  await click('.muze-solid-files-create-form [name=name]');
  assert.equal(
    await evaluate('document.activeElement.name'),
    'name',
    'folder input can be reached by a real click in an empty folder'
  );
  await page.send('Input.insertText', { text: 'Unavailable' });
  await key('Enter', 'Enter', 13, String.fromCharCode(13));
  await wait(
    'document.querySelector("#muze-solid-files-create-status").textContent.includes("503")'
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-files-create-form [name=name]").value'
    ),
    'Unavailable'
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-files-create-dialog").open'
    ),
    true
  );
  await click('.muze-solid-files-create-form [name=name]');
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
  await page.send('Input.insertText', { text: 'Demo folder' });
  await capture('files-create-phone');
  await key('Enter', 'Enter', 13, '\r');
  await wait(
    'solidFiles.ui.data.entries.some(entry => entry.name === "Demo folder")'
  );
  await wait('!document.querySelector(".muze-solid-files-create-dialog").open');
  assert.equal(
    await evaluate(
      'document.querySelector(".muze-solid-files-create-dialog").open'
    ),
    false
  );
  assert.equal(
    await evaluate('solidFiles.ui.data.muzeSolidFilesAncestors.length'),
    0
  );
  assert.equal(
    await evaluate('solidFiles.ui.data.muzeSolidFilesFolders.length'),
    1
  );
  await evaluate(
    `solidFiles.ui.actions.browse(location.origin + '/storage/Parent/Child/')`
  );
  await wait('solidFiles.ui.data.muzeSolidFilesFolderName === "Child"');
  await click('.muze-solid-files-current-folder');
  await wait(
    'document.querySelector(".muze-solid-files-location-sheet").matches(":popover-open")'
  );
  const indents = await evaluate(`Array.from(document.querySelectorAll(
    '.muze-solid-files-folder-options .muze-solid-files-folder-option'), button => ({
      label: button.textContent.trim(),
      padding: parseFloat(getComputedStyle(button).paddingInlineStart)
    }))`);
  assert.deepEqual(
    indents.map((item) => item.label),
    ['storage', 'Parent', 'Child']
  );
  assert.ok(indents[1].padding > indents[0].padding);
  assert.ok(indents[2].padding > indents[1].padding);
  await capture('files-phone-nested-location');
  await key('Escape', 'Escape', 27);
  await evaluate(`solidFiles.ui.actions.browse(location.origin + '/storage/')`);
  await wait('solidFiles.ui.data.muzeSolidFilesAncestors.length === 0');
  await capture('files-phone');
  await click('[aria-label="Edit folder address"]');
  await wait(
    'document.querySelector(".muze-solid-files-location-sheet").matches(":popover-open") && document.activeElement.name === "url"'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 480,
    deviceScaleFactor: 1,
    mobile: true
  });
  await wait(
    `(() => { const box=document.querySelector('.muze-solid-files-location-sheet').getBoundingClientRect(); return box.left>=0 && box.right<=innerWidth+1 && box.bottom<=innerHeight+1; })()`
  );
  await key('Escape', 'Escape', 27);
  await wait(
    '!document.querySelector(".muze-solid-files-location-sheet").matches(":popover-open")'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await click('[aria-label="More file actions"]');
  await wait(
    'document.querySelector(".muze-solid-files-more-menu").matches(":popover-open")'
  );
  await click('[aria-label="More file actions"]');
  await wait(
    '!document.querySelector(".muze-solid-files-more-menu").matches(":popover-open")'
  );
  await click('[aria-label="More file actions"]');
  await wait(
    'document.querySelector(".muze-solid-files-more-menu").matches(":popover-open")'
  );
  await key('Escape', 'Escape', 27);
  await wait(
    'document.activeElement.getAttribute("aria-label") === "More file actions"'
  );
  await click('[aria-label="More file actions"]');
  await click('[data-simply-command=muzeSolidFilesRefresh]');
  await wait(
    '!document.querySelector(".muze-solid-files-more-menu").matches(":popover-open")'
  );
  await wait('!solidFiles.ui.runtime.busy');
  await wait('!document.getAnimations().some(a => a.playState === "running")');
  await click('.muze-solid-files-entry-more');
  await wait(
    'document.querySelector(".muze-solid-files-entry-menu").matches(":popover-open")'
  );
  await key('Escape', 'Escape', 27);

  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await capture('files-desktop');
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await capture('files-dark');
  console.log(
    'PASS: real Contacts create/edit/cancel, Preferences controls and Files folder create in empty phone list; phone/desktop layouts and theme captures.'
  );
}
catch (error) {
  await capture('contacts-failure');
  console.error(await evaluate('document.body.innerText'));
  throw error;
}
finally {
  page?.close();
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
}
