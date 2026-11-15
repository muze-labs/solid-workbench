import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import {
  StateGraph,
  named
} from '../packages/solid-app-data/src/state-rdf.mjs';
import { startChrome } from './support/chrome.mjs';

let origin;
const resources = new Map();
const calls = [];
let version = 1;
let preferences = '';
let preferencesTag = '"prefs"';
let authoringRequests = 0;
let unavailable = '';
let podOffline = false;
let deleteFailures = 0;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  response.setHeader('Cache-Control', 'no-store');
  calls.push({
    method: request.method,
    path: url.pathname,
    headers: request.headers
  });
  if (url.pathname === '/seed') {
    response.end('<!doctype html>');
    return;
  }
  if (url.pathname === '/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/profile#me> <http://xmlns.com/foaf/0.1/name> "Presenter owner";
      <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/prefs>;
      <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`);
    return;
  }
  if (url.pathname === unavailable) {
    response.writeHead(503).end();
    return;
  }
  if (
    podOffline &&
    (url.pathname === '/prefs' || url.pathname.startsWith('/storage/'))
  ) {
    response.writeHead(503).end();
    return;
  }
  if (url.pathname === '/prefs') {
    if (request.method === 'PUT') {
      assert.equal(request.headers['if-match'], preferencesTag);
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      preferences = Buffer.concat(chunks).toString();
      preferencesTag = '"prefs-' + ++version + '"';
      response.writeHead(200, { ETag: preferencesTag }).end();
    }
    else {
      response.writeHead(200, {
        ETag: preferencesTag,
        'Content-Type': 'text/turtle'
      });
      response.end(preferences || '<urn:other-app> <urn:setting> "keep".');
    }
    return;
  }
  if (url.pathname.startsWith('/storage/') && url.pathname.endsWith('/')) {
    response.setHeader('Link', '<.meta>; rel="describedby"');
    response.setHeader('Content-Type', 'text/turtle');
    response.end(
      `<${url.href}> a <http://www.w3.org/ns/ldp#BasicContainer>.` +
        [...resources.keys()]
          .map(
            (path) =>
              `<${url.href}> <http://www.w3.org/ns/ldp#contains> <${origin}${path}>.`
          )
          .join('\n')
    );
    return;
  }
  if (url.pathname.startsWith('/storage/')) {
    const prior = resources.get(url.pathname);
    if (request.method === 'DELETE') {
      assert(prior);
      if (deleteFailures > 0) {
        deleteFailures -= 1;
        assert.equal(request.headers['if-match'], prior.etag);
        response.writeHead(503).end();
        return;
      }
      assert.equal(request.headers['if-match'], prior.etag);
      resources.delete(url.pathname);
      response.writeHead(204).end();
      return;
    }
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      if (
        prior
          ? request.headers['if-match'] !== prior.etag
          : request.headers['if-none-match'] !== '*'
      ) {
        response.writeHead(412).end();
        return;
      }
      const next = {
        text: Buffer.concat(chunks).toString(),
        etag: '"' + ++version + '"'
      };
      resources.set(url.pathname, next);
      response.writeHead(201, { ETag: next.etag }).end();
      return;
    }
    if (!prior) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': prior.type || 'text/turtle',
      ETag: prior.etag
    });
    response.end(prior.text);
    return;
  }
  if (url.pathname.startsWith('/assets/authoring/')) {
    authoringRequests++;
    response.writeHead(404).end();
    return;
  }
  try {
    const path =
      url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
    const content = await readFile(new URL('../www' + path, import.meta.url));
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
    response.end(content);
  }
  catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const app = 'globalThis.muzeSolidPresenterApp';
let chrome;
let page;
async function run(code) {
  try {
    // Keep the evaluated promise reachable while CDP awaits local storage work.
    return await page.evaluate(
      '()=>globalThis.muzeSolidPresenterTestEvaluation=(async()=>{' +
        code +
        '})()'
    );
  }
  catch (error) {
    throw new Error(
      'presenter-collections-browser: Evaluation failed: ' + code,
      { cause: error }
    );
  }
}
async function until(expression) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (await run('return Boolean(' + expression + ')')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'presenter-collections-browser: Timed out: ' +
      expression +
      '\n' +
      (await run('return document.body.innerText'))
  );
}
async function idle() {
  await run(
    'await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'
  );
  await until(`${app} && !${app}.runtime.busy`);
}
async function click(selector) {
  await idle();
  await until(
    `(() => {const element=document.querySelector(${JSON.stringify(selector)});
      return element?.checkVisibility() && !element.matches(':disabled');})()`
  );
  await run(`await Promise.all(document.getAnimations().filter(animation =>
    animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))`);
  const point =
    await run(`const element=document.querySelector(${JSON.stringify(selector)});
    element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=element.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await until(`document.querySelector(${JSON.stringify(selector)}).contains(
    document.elementFromPoint(${point.x},${point.y}))`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1
    });
  }
  await idle();
}
const command = (name) =>
  '[data-simply-command="muzeSolidPresenter' + name + '"]';
const tool = (name) =>
  '[data-muze-solid-action="muzeSolidPresenter' + name + '"]';
const cardAction = (id) =>
  '.muze-solid-collection-browser-item:has(' +
  '[data-muze-solid-collection-entry=' +
  JSON.stringify(id) +
  ']) ' +
  '[data-simply-command="muzeSolidCollectionEntryAction"]';
async function confirmAction(selector, accept = true, keyboard = false) {
  await idle();
  await until(`(() => {const control=document.querySelector(${JSON.stringify(selector)});
    return control?.checkVisibility() && !control.matches(':disabled');})()`);
  const opening = page.once('Page.javascriptDialogOpening');
  let activation;
  if (keyboard) {
    await page.send('Page.bringToFront');
    await run(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    activation = (async () => {
      for (const type of ['keyDown', 'keyUp']) {
        await page.send('Input.dispatchKeyEvent', {
          type,
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          ...(type === 'keyDown' ? { text: '\r' } : {})
        });
      }
    })();
  }
  else {
    activation = click(selector);
  }
  let timer;
  const dialog = await Promise.race([
    opening,
    new Promise((_, reject) => {
      timer = setTimeout(async () => {
        const state =
          await run(`return {message:${app}.data.muzeSolidPresenterCollectionMessage,
        status:${app}.data.muzeSolidPresenterStatus,busy:${app}.runtime.busy,
        active:document.activeElement.outerHTML.slice(0,900),
        button:document.querySelector(${JSON.stringify(selector)}).outerHTML,
        configured:${app}.api.muzeSolidCollectionBrowser.entryAction}`);
        reject(
          new Error(
            'presenter-collections-browser: No confirmation for ' +
              selector +
              ' keyboard=' +
              keyboard +
              ' ' +
              JSON.stringify(state)
          )
        );
      }, 20000);
    })
  ]).finally(() => clearTimeout(timer));
  await page.send('Page.handleJavaScriptDialog', { accept });
  await activation;
  await idle();
  return dialog.message;
}
async function capture(name) {
  await until("!document.querySelector('dialog[open]')");
  await run(
    'await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))'
  );
  assert(
    await run('return document.documentElement.scrollWidth <= innerWidth')
  );
  await writeFile(
    '/tmp/presenter-collections-' + name + '.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
}
async function reload() {
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await loaded;
  await until(app);
  await idle();
}
try {
  chrome = await startChrome(origin + '/seed', {
    allowPopups: true,
    hoverPointer: true
  });
  page = await chrome.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    mobile: true,
    deviceScaleFactor: 1
  });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await run(
    'localStorage.setItem("solid-apps.webId",location.origin+"/profile#me")'
  );
  await page.send('Page.navigate', { url: origin + '/presenter/' });
  await page.ready();
  await until(`${app}?.runtime.collection`);
  await idle();
  const collectionUrl = await run(`return ${app}.runtime.collection.url`);
  assert.equal(
    await run(`return ${app}.data.muzeSolidCollectionEntries.length`),
    1
  );
  assert.equal(
    await run(`return ${app}.data.muzeSolidCollectionEntries[0].title`),
    'New deck'
  );
  assert(preferences.includes('<urn:muze:solid-app:presenter>'));
  assert(preferences.includes('urn:other-app'));
  const preferenceSnapshot = preferences;
  assert.equal(
    await run(`return document.activeElement.classList.contains(
    'muze-solid-collection-browser-heading')`),
    false,
    'Startup does not focus a noninteractive heading'
  );
  assert.equal(
    await run(`return document.querySelector(
    '.muze-solid-presenter-collections-overview').innerText.includes('Collection is saved')`),
    false
  );
  assert.equal(
    await run(`return document.querySelector(
    '#muze-solid-presenter-status').matches(':popover-open')`),
    false
  );
  await click(tool('Status'));
  await until(
    `document.querySelector('#muze-solid-presenter-status').matches(':popover-open')`
  );
  assert(
    (
      await run(
        `return document.querySelector('#muze-solid-presenter-status').innerText`
      )
    ).includes('Collection is saved')
  );
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
  }
  await until(
    `!document.querySelector('#muze-solid-presenter-status').matches(':popover-open')`
  );
  await capture('empty-phone');
  // The category and native Enter/Tab route to New deck are real controls.
  await run(
    `document.querySelector('.muze-solid-collection-browser-categories a').focus()`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
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
    `document.activeElement.matches('[data-muze-solid-collection-category][aria-current="page"]')`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9
  });
  assert.equal(
    await run('return document.activeElement.dataset.muzeSolidCollectionEntry'),
    'new',
    await run('return document.activeElement.outerHTML.slice(0,400)')
  );
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key: 'Tab',
      code: 'Tab',
      modifiers: 8,
      windowsVirtualKeyCode: 9
    });
  }
  assert.equal(
    await run(
      'return document.activeElement.dataset.muzeSolidCollectionCategory'
    ),
    '',
    'Shift+Tab returns to All decks'
  );
  // Existing unsaved local decks must be visible without Pod membership.
  await run(`const deck=${app}.runtime.deck;
    deck.change(deck.root.id,'title','Older unsaved local deck');
    await deck.persist()`);
  await reload();
  await until(`${app}.data.muzeSolidCollectionEntries.some(entry=>
    entry.title==='Older unsaved local deck' && entry.management===false)`);
  assert.equal(await run(`return ${app}.runtime.deck.dirty`), true);
  assert.equal(
    await run(`return ${app}.runtime.collection.state().entries.length`),
    0,
    'Showing the old local deck does not import it into the Pod collection'
  );
  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify('[data-muze-solid-action="add"]')}).textContent.trim()`
    ),
    'New deck'
  );
  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify('[data-muze-solid-action="add"]')}).disabled`
    ),
    false
  );
  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify('[data-muze-solid-action="present"]')}).checkVisibility()`
    ),
    false
  );
  assert.equal(
    await run(
      `return document.querySelector('.muze-solid-collection-browser-details [data-muze-solid-collection-entry]').dataset.muzeSolidCollectionEntry`
    ),
    'new'
  );
  assert.equal(
    await run(`const link=document.querySelector('[data-muze-solid-collection-entry="new"]');
    return getComputedStyle(link.closest('li')).borderStyle==='dotted' &&
      link.querySelector('.muze-solid-collection-browser-preview-body').textContent==='New deck' &&
      parseFloat(getComputedStyle(link.querySelector('.muze-solid-collection-browser-preview-title')).fontSize)>32`),
    true
  );
  await capture('new-deck-toolbar-phone');
  await click('[data-muze-solid-action="add"]');
  await until(
    `document.querySelector(${JSON.stringify('[data-muze-solid-action="add"]')}).textContent.trim()==='Add slide'`
  );
  await until(
    `document.querySelector(${JSON.stringify('[data-muze-solid-action="present"]')}).checkVisibility()`
  );
  await until('document.activeElement.name==="deck-title"');
  await click('[data-muze-solid-action="add"]');
  await until(`${app}.runtime.deck.slides().length===1`);
  await capture('editor-tools-phone');
  // Restore the empty collection fixture before its separate offline checks.
  await click(command('Remove'));
  await until(`${app}.runtime.deck.slides().length===0`);
  assert.equal(
    await run(`return ${app}.runtime.selected`),
    '',
    'Removing the only slide clears selection'
  );
  const target = await run(`return ${app}.runtime.deck.target`);
  assert(target.startsWith(origin + '/storage/deck-'));
  assert(
    await run(`return ${app}.runtime.decks.entries().some(entry=>
    entry.title==='Older unsaved local deck')`),
    'New retains the older dirty deck'
  );
  const managedEntryId =
    await run(`return ${app}.runtime.collection.state().entries.find(
    entry=>entry.document===${JSON.stringify(target)}).id`);
  const managedCard =
    '[data-muze-solid-collection-entry="' + managedEntryId + '"]';

  assert.equal(
    await run(`return ${app}.runtime.collection.state().entries[0].managed`),
    true
  );
  assert(!resources.has(new URL(target).pathname));
  // Title editing uses native input and the existing local document writer.
  await click('input[name="deck-title"]');
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
  await page.send('Input.insertText', { text: 'Reusable deck' });
  await until(`${app}.runtime.deck.title==='Reusable deck'`);
  resources.set('/storage/first-slide.png', {
    text: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4Z8AAAAASUVORK5CYII=',
      'base64'
    ),
    type: 'image/png',
    etag: '"image"'
  });
  await click(tool('Save'));
  await until(
    `${app}.runtime.deck.url===${JSON.stringify(target)} && !${app}.runtime.deck.dirty`
  );
  assert(resources.has(new URL(target).pathname));
  await click(tool('Collections'));
  await until(
    `${app}.data.muzeSolidCollectionEntries.some(entry=>entry.title==='Reusable deck')`
  );
  assert.equal(
    preferences,
    preferenceSnapshot,
    'ordinary navigation does not change default'
  );
  assert.equal(
    await run(`return getComputedStyle(document.querySelector(
    '.muze-solid-collection-browser-layout[data-layout="cards"] .muze-solid-collection-browser-details > .muze-solid-collection-browser-entries')).gridTemplateColumns.split(' ').length`),
    1
  );

  await click('[data-muze-solid-collection-category=""]');
  await until(
    `document.querySelector('.muze-solid-collection-browser-layout').scrollLeft>0`
  );
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  assert.equal(await run(`return matchMedia('(hover: none)').matches`), true);
  assert.equal(
    await run(`const card=document.querySelector(${JSON.stringify(managedCard)}).closest('li');
    return getComputedStyle(card.querySelector('.muze-solid-collection-browser-overlay')).opacity`),
    '1'
  );
  assert.equal(
    await run(`return document.querySelector(${JSON.stringify(managedCard)})
    .querySelector('[role=img]').hidden`),
    true,
    'Saved clean decks have no local badge'
  );
  await capture('delete-cards-phone');
  await click(managedCard);
  await click('input[name="deck-title"]');
  await until('document.activeElement.name==="deck-title"');
  await page.send('Input.insertText', { text: ' offline' });
  await until(`${app}.runtime.deck.dirty`);
  await page.send('Network.enable');
  podOffline = true;
  await reload();
  await click(tool('CurrentDeck'));
  assert((await run(`return ${app}.runtime.deck.title`)).includes('offline'));
  podOffline = false;
  await click(tool('Save'));
  await until(`!${app}.runtime.deck.dirty`);
  await click(tool('Collections'));
  await click(tool('CollectionTools'));
  // Native group creation and category navigation share the Notebook browser.
  await click('.muze-solid-presenter-collection-form input');
  await page.send('Input.insertText', { text: 'Work' });
  await click('.muze-solid-presenter-collection-form button');
  await until(`${app}.runtime.collection.state().groups.length===1`);
  await click(
    '.muze-solid-presenter-collection-dialog [data-simply-command="muzeSolidPresenterCollectionEntry"]'
  );
  await click('.muze-solid-presenter-entry-dialog select');
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'ArrowDown',
    code: 'ArrowDown',
    windowsVirtualKeyCode: 40
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'ArrowDown',
    code: 'ArrowDown',
    windowsVirtualKeyCode: 40
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await idle();
  await click(
    '.muze-solid-presenter-entry-dialog [data-simply-command="muzeSolidDesignCloseDialog"]'
  );
  await click(
    '.muze-solid-presenter-collection-dialog [data-simply-command="muzeSolidDesignCloseDialog"]'
  );
  // Chrome retains touch's no-hover media after disabling touch. A fresh tab
  // shares persisted app data while restoring the launch-time desktop pointer.
  const desktopUrl = await run('return location.href');
  const { targetInfo: phoneTarget } = await page.send('Target.getTargetInfo');
  const { targetId: desktopTarget } = await page.send('Target.createTarget', {
    url: 'about:blank'
  });
  await page.send('Target.closeTarget', { targetId: phoneTarget.targetId });
  page = await chrome.page(desktopTarget);
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    mobile: false,
    deviceScaleFactor: 1
  });
  await page.send('Page.navigate', { url: desktopUrl });
  await page.ready();
  await until(`${app}?.runtime.collection && !${app}.runtime.openingAccount`);
  await idle();
  await capture('desktop');
  assert.equal(
    await run(`return getComputedStyle(document.querySelector(
    '.muze-solid-collection-browser-layout[data-layout="cards"] .muze-solid-collection-browser-details > .muze-solid-collection-browser-entries')).gridTemplateColumns.split(' ').length`),
    2
  );

  // Add a linked reference through the real data API, then verify membership-only removal.
  const linked = origin + '/storage/linked.ttl';
  resources.set('/storage/linked.ttl', {
    text: await run(`const owner=${app}.runtime.deck.owner;
      const deck=await new ${app}.api.DeckDocument({owner,source:${app}.api.local.memory('fixture-preview')}).open();
      const first=deck.addSlide('image');
      const title=deck.regions(first).find(region=>region.name==='title');
      const image=deck.regions(first).find(region=>region.kind==='image');
      deck.change(title.id,'text','First slide preview');
      deck.change(image.id,'resource',location.origin+'/storage/first-slide.png','iri');
      const second=deck.addSlide('image');
      deck.change(deck.regions(second).find(region=>region.kind==='image').id,
        'resource',location.origin+'/storage/second-slide.png','iri');
      return deck.content().write()`),
    etag: '"linked"'
  });
  await run(`await ${app}.runtime.collection.addDocument({document:${JSON.stringify(linked)},title:'Linked deck',kind:'muze.presenter',managed:false});
    ${app}.actions.muzeSolidPresenterProjectCollection()`);
  await until(
    `${app}.data.muzeSolidCollectionEntries.some(entry=>entry.document===${JSON.stringify(linked)} && entry.previewTitle==='First slide preview')`
  );
  await until(
    `Array.from(document.querySelectorAll('.muze-solid-collection-browser-preview-image')).some(image=>image.src.startsWith('blob:'))`
  );
  assert.equal(
    calls.filter((call) => call.path === '/storage/second-slide.png').length,
    0,
    'Preview loads no later-slide image'
  );
  const currentAddress = await run(`return ${app}.runtime.deck.url`);
  podOffline = true;
  await reload();
  await until(
    `${app}.data.muzeSolidCollectionEntries.some(entry=>entry.document===${JSON.stringify(linked)} && entry.previewTitle==='First slide preview')`
  );
  await until(
    `Array.from(document.querySelectorAll('.muze-solid-collection-browser-preview-image')).some(image=>image.src.startsWith('blob:'))`
  );
  assert.equal(
    await run(`return ${app}.runtime.deck.url`),
    currentAddress,
    'Remote preview and offline reload preserve the current deck'
  );
  podOffline = false;
  await capture('cards-desktop');
  const olderId = await run(`return ${app}.runtime.decks.entries().find(
    entry=>entry.title==='Older unsaved local deck').id`);
  const olderCard =
    '[data-muze-solid-collection-entry="local:' + olderId + '"]';
  const olderDelete = cardAction('local:' + olderId);
  assert.equal(
    await run(`return document.querySelector(${JSON.stringify(olderCard)})
    .querySelector('[role=img]').getAttribute('title')`),
    'Local only'
  );
  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify(olderDelete)}).textContent.trim()`
    ),
    ''
  );
  assert.equal(
    await run(`return document.querySelector(${JSON.stringify(olderDelete)})
    .querySelector('use').getAttribute('href')`),
    '../assets/feather-icons.svg#trash-2'
  );
  assert.equal(
    await run(`const card=document.querySelector(${JSON.stringify(olderCard)});
    const title=card.querySelector('.muze-solid-collection-browser-title');
    return getComputedStyle(title).whiteSpace==='nowrap' &&
      !card.querySelector('.muze-solid-collection-browser-detail').textContent &&
      getComputedStyle(card.closest('li').querySelector('.muze-solid-collection-browser-overlay')).position==='absolute'`),
    true
  );
  await run(
    `document.querySelector('.muze-solid-collection-browser-categories a').focus()`
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 1,
    y: 1
  });
  assert.equal(await run(`return matchMedia('(hover: hover)').matches`), true);
  const olderOverlay = `document.querySelector(${JSON.stringify(olderDelete)}).parentElement`;
  await until(`getComputedStyle(${olderOverlay}).opacity==='0'`);
  const hoverPoint =
    await run(`const card=document.querySelector(${JSON.stringify(olderCard)});
    card.scrollIntoView({block:'nearest',behavior:'instant'});
    const rect=card.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+20}`);
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    ...hoverPoint
  });
  await until(`getComputedStyle(${olderOverlay}).opacity==='1'`);
  await capture('overlay-hover-desktop');
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 1,
    y: 1
  });
  await run(`document.querySelector(${JSON.stringify(olderCard)}).focus()`);
  await until(`getComputedStyle(${olderOverlay}).opacity==='1'`);
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9
    });
  }
  assert.equal(
    await run(
      `return document.activeElement===document.querySelector(${JSON.stringify(olderDelete)})`
    ),
    true
  );
  await capture('overlay-focus-desktop');

  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify(olderDelete)}).getAttribute('title')`
    ),
    'Delete'
  );
  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify(olderDelete)}).closest('a')`
    ),
    null,
    'Card action is separate from its open link'
  );
  const cancelled = await confirmAction(olderDelete, false, true);
  assert.match(cancelled, /this device/);
  assert(
    await run(
      `return Boolean(${app}.runtime.decks.find(${JSON.stringify(olderId)}))`
    )
  );

  // Local-only deletion works offline and leaves unrelated current edits alone.
  const discardId = await run(`const host=${app};const decks=host.runtime.decks;
    const previous=decks.activeId;
    const draft=await decks.create();const id=decks.activeId;
    draft.change(draft.root.id,'title','Discard this local draft');await draft.persist();
    await decks.select(previous);host.runtime.deck=decks.current;
    host.actions.muzeSolidPresenterProjectCollection();return id`);
  const currentBeforeLocalDelete = await run(
    `return ${app}.runtime.decks.activeId`
  );
  const remoteDeletes = calls.filter((call) => call.method === 'DELETE').length;
  podOffline = true;
  await confirmAction(cardAction('local:' + discardId));
  await until(`!${app}.runtime.decks.find(${JSON.stringify(discardId)})`);
  assert.equal(
    await run(`return ${app}.runtime.decks.activeId`),
    currentBeforeLocalDelete
  );
  assert.equal(
    await run(
      `return ${app}.runtime.decks.store(${JSON.stringify(discardId)}).load()`
    ),
    ''
  );
  assert.equal(
    calls.filter((call) => call.method === 'DELETE').length,
    remoteDeletes
  );
  podOffline = false;

  const linkedId =
    await run(`return ${app}.runtime.collection.state().entries.find(
    entry=>entry.document===${JSON.stringify(linked)}&&!entry.deleted).id`);
  assert.equal(
    await run(
      `return document.querySelector(${JSON.stringify(cardAction(linkedId))}).getAttribute('title')`
    ),
    'Remove link'
  );
  assert(
    (
      await run(`return ${app}.api.local.indexedDB('solid-presenter-previews', {
    key:${app}.runtime.deck.owner+String.fromCharCode(10)+${JSON.stringify(linked)}
  }).load()`)
    ).includes('First slide preview')
  );
  assert.match(
    await confirmAction(cardAction(linkedId)),
    /source file will remain/
  );
  assert(resources.has('/storage/linked.ttl'));
  assert.equal(
    calls.filter((call) => call.method === 'DELETE').length,
    remoteDeletes
  );
  assert.equal(
    await run(`return ${app}.api.local.indexedDB('solid-presenter-previews',{
    key:${app}.runtime.deck.owner+String.fromCharCode(10)+${JSON.stringify(linked)}}).load()`),
    ''
  );

  assert.equal(
    await run(`const cache=await caches.open('solid-presenter-preview-images');
    return Boolean(await cache.match(${app}.actions.muzeSolidPresenterPreviewImageKey(
      ${app}.runtime.deck.owner,location.origin+'/storage/first-slide.png')))`),
    false
  );

  // Pod failure keeps local data; the same overlay offers an explicit retry.
  const managedId =
    await run(`return ${app}.runtime.collection.state().entries.find(
    entry=>entry.document===${JSON.stringify(target)}&&!entry.deleted).id`);
  const removedCopyId = await run(
    `return ${app}.runtime.decks.find(${JSON.stringify(target)}).id`
  );
  await click(managedCard);
  await run(`${app}.runtime.deck.change(${app}.runtime.deck.root.id,'title',
    'Throw away these unsaved changes');await ${app}.runtime.deck.persist();
    ${app}.actions.muzeSolidPresenterProjectCollection()`);
  await click(tool('Collections'));
  await until(`document.querySelector(${JSON.stringify(cardAction(managedId))})
    .closest('li').querySelector('[role=img]').getAttribute('title')==='Local changes'`);
  deleteFailures = 1;
  assert.match(
    await confirmAction(cardAction(managedId)),
    /Pod file and all copies/
  );
  await until(`${app}.runtime.fileOperation.pending`);
  assert(resources.has(new URL(target).pathname));
  assert.equal(await run(`return ${app}.runtime.deck.dirty`), true);
  assert(
    await run(
      `return Boolean(${app}.runtime.decks.find(${JSON.stringify(target)}))`
    )
  );
  await until(
    `document.querySelector(${JSON.stringify(cardAction(managedId))}).getAttribute('title')==='Retry delete'`
  );
  await click(cardAction(managedId));
  await until(`!${app}.runtime.fileOperation.pending`);
  assert(!resources.has(new URL(target).pathname));
  assert(resources.get('/storage/.meta').text.includes('deleted'));
  assert.equal(
    await run(`return ${app}.runtime.decks.find(${JSON.stringify(target)})`),
    undefined
  );
  assert.equal(
    await run(
      `return ${app}.runtime.decks.store(${JSON.stringify(removedCopyId)}).load()`
    ),
    ''
  );
  assert.equal(await run(`return ${app}.runtime.deck.dirty`), false);
  assert.equal(
    await run(
      `return ${app}.runtime.decks.entries().some(entry=>entry.id===${JSON.stringify(removedCopyId)})`
    ),
    false
  );
  await capture('deletion-desktop');
  await reload();
  assert.equal(
    await run(`return ${app}.runtime.decks.find(${JSON.stringify(target)})`),
    undefined
  );
  assert.equal(
    await run(
      `return ${app}.runtime.decks.store(${JSON.stringify(removedCopyId)}).load()`
    ),
    ''
  );
  await click(olderCard);
  await until(`${app}.runtime.decks.activeId===${JSON.stringify(olderId)}`);
  assert.equal(await run(`return ${app}.runtime.deck.dirty`), true);
  await click(tool('Collections'));
  assert.equal(
    authoringRequests,
    0,
    'normal task never requests authoring assets'
  );
  // Defined but unavailable defaults retain the reference and do not create a replacement.
  unavailable = new URL(collectionUrl).pathname;
  const creates = calls.filter(
    (call) =>
      call.method === 'PUT' && call.path.includes('presenter-collection-')
  ).length;
  await page.send('Page.navigate', { url: origin + '/presenter/' });
  await page.ready();
  await until(app);
  await idle();
  assert.equal(preferences, preferenceSnapshot);
  assert.equal(
    calls.filter(
      (call) =>
        call.method === 'PUT' && call.path.includes('presenter-collection-')
    ).length,
    creates
  );
  assert.equal(await run(`return ${app}.runtime.collectionUrl`), collectionUrl);
  // Exercise collection commands with a controlled capability selection.
  // Picker interaction itself is covered by the suite's picker/Notebook tests.
  unavailable = '';
  const second = origin + '/storage/second-collection.ttl';
  await run(`globalThis.collectionPicker = ${app}.runtime.host.muzeSolidUiInvoke;
    ${app}.runtime.host.muzeSolidUiInvoke = async () => ({'@id':${JSON.stringify(second)}})`);
  await click(tool('CollectionTools'));
  await click(command('CreateCollection'));
  await until(`${app}.runtime.collection?.url===${JSON.stringify(second)}`);
  assert.equal(preferences, preferenceSnapshot, 'switching retains default');
  assert.equal(
    await run(`return ${app}.runtime.deck.dirty`),
    true,
    'switching collection retains detached local draft'
  );
  const retainedId = await run(`return ${app}.runtime.decks.activeId`);
  const retainedTitle = await run(`return ${app}.runtime.deck.title`);
  const writesBeforeNew = calls.filter((call) => call.method === 'PUT').length;
  await click('[data-muze-solid-collection-entry="new"]');
  await until(`${app}.runtime.decks.activeId!==${JSON.stringify(retainedId)} &&
    !document.querySelector('.muze-solid-presenter-editor').hidden`);
  assert(
    (await run(`return ${app}.runtime.deck.target`)).startsWith(
      origin + '/storage/deck-'
    )
  );
  assert.equal(
    calls.filter((call) => call.method === 'PUT').length,
    writesBeforeNew,
    'New preserves the dirty deck locally without forcing a Pod save'
  );
  const laterLocalId = await run(`return ${app}.runtime.decks.activeId`);
  const laterLocalTarget = await run(`return ${app}.runtime.deck.target`);

  await click(tool('Collections'));
  const retainedCard =
    '[data-muze-solid-collection-entry="local:' + retainedId + '"]';
  await until(`document.querySelector(${JSON.stringify(retainedCard)})`);
  assert(
    (
      await run(
        `return document.querySelector(${JSON.stringify(retainedCard)}).querySelector('[role=img]').getAttribute('aria-label')`
      )
    ).startsWith('Local ')
  );
  await click(retainedCard);
  await until(`${app}.runtime.decks.activeId===${JSON.stringify(retainedId)}`);
  assert.equal(await run(`return ${app}.runtime.deck.title`), retainedTitle);
  assert.equal(await run(`return ${app}.runtime.deck.dirty`), true);
  podOffline = true;
  await reload();
  await until(`${app}.runtime.decks.activeId===${JSON.stringify(retainedId)} &&
    !document.querySelector('.muze-solid-presenter-editor').hidden`);
  assert.equal(await run(`return ${app}.runtime.deck.title`), retainedTitle);
  podOffline = false;
  await click(tool('Collections'));
  await click(tool('CollectionTools'));
  await click(command('DefaultCollection'));
  assert(resources.has('/storage/second-collection.ttl'));
  assert(
    new StateGraph(preferences, origin + '/prefs').quads.some(
      (quad) =>
        quad.object.termType === 'NamedNode' && quad.object.id === second
    )
  );
  assert(preferences.includes('urn:other-app'));
  await run(
    `${app}.runtime.host.muzeSolidUiInvoke = async () => ({'@id':${JSON.stringify(collectionUrl)}})`
  );
  await click(command('OpenCollection'));
  await until(
    `${app}.runtime.collection?.url===${JSON.stringify(collectionUrl)}`
  );
  assert(
    new StateGraph(preferences, origin + '/prefs').quads.some(
      (quad) =>
        quad.object.termType === 'NamedNode' && quad.object.id === second
    ),
    'opening does not change default'
  );
  await run(
    `${app}.runtime.host.muzeSolidUiInvoke = globalThis.collectionPicker`
  );
  await reload();
  assert.equal(
    await run(`return ${app}.runtime.collection.url`),
    collectionUrl,
    'explicit route takes precedence over default'
  );
  const loadedDefault = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url: origin + '/presenter/' });
  await loadedDefault;
  await until(`${app}?.runtime.collection?.url===${JSON.stringify(second)}`);
  await idle();
  // Delete the active reserved deck while offline, with no Pod file or backup.
  const localMemberId =
    await run(`return ${app}.runtime.collection.state().entries.find(
    entry=>entry.document===${JSON.stringify(laterLocalTarget)})?.id`);
  const activeLocalCard =
    '[data-muze-solid-collection-entry="' + localMemberId + '"]';
  await click(activeLocalCard);
  await until(
    `${app}.runtime.decks.activeId===${JSON.stringify(laterLocalId)}`
  );
  await click(tool('Collections'));
  const deleteCount = calls.filter((call) => call.method === 'DELETE').length;
  podOffline = true;
  await confirmAction(cardAction(localMemberId));
  assert.equal(
    calls.filter((call) => call.method === 'DELETE').length,
    deleteCount
  );
  assert.equal(
    await run(
      `return ${app}.runtime.decks.find(${JSON.stringify(laterLocalId)})`
    ),
    undefined
  );
  assert.equal(
    await run(
      `return ${app}.runtime.decks.store(${JSON.stringify(laterLocalId)}).load()`
    ),
    ''
  );
  assert.notEqual(
    await run(`return ${app}.runtime.decks.activeId`),
    laterLocalId
  );
  await reload();
  assert.equal(
    await run(
      `return ${app}.runtime.decks.find(${JSON.stringify(laterLocalId)})`
    ),
    undefined
  );
  assert(
    await run(
      `return Boolean(${app}.runtime.decks.find(${JSON.stringify(olderId)}))`
    )
  );
  podOffline = false;
  console.log(
    'PASS: Presenter default/native preferences, phone reversible category focus, explicit status disclosure, first-slide cards in one/two columns, cached native/image previews without later-slide reads, create/edit/save, collection reuse, loaded-offline draft/reload, grouping, linked removal, icon overlay deletion, confirmation/cancellation, local offline deletion, conditional Pod failure/retry without a retained copy, unavailable-default retention, create/open/default switching, visible separate local drafts, New without a forced Pod save and local-card reload recovery.'
  );
}
finally {
  if (chrome) {
    await chrome.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
