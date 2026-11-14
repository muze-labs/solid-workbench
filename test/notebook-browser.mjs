import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome } from './support/chrome.mjs';
import { checkPickerReflow } from './support/style-contracts.mjs';
let origin;
const pods = new Map();
const writes = [];
let authoringRequests = 0;
let preferredPickerVisits = 0;
let measuredFirstSave = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/seed') {
    response.end('<!doctype html><title>Fixture</title>');
    return;
  }
  if (url.pathname === '/profile') {
    response.setHeader('Content-Type', 'text/turtle');
    response.end(`<${origin}/profile#me> <http://xmlns.com/foaf/0.1/name> "Writer";
      <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/prefs>;
      <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`);
    return;
  }
  if (url.pathname === '/prefs') {
    response.writeHead(200, { 'Content-Type': 'text/turtle', ETag: '"prefs"' });
    response.end(`<${origin}/prefs#solid-apps>
      <https://vocab.muze.nl/capability#registry> <${origin}/prefs#providers>.
      <${origin}/prefs#providers> <http://www.w3.org/2000/01/rdf-schema#member> <${origin}/prefs#picker>.
      <${origin}/prefs#picker> <https://vocab.muze.nl/capability#provides> <https://vocab.muze.nl/capabilities/browse>;
      <https://vocab.muze.nl/capability#application> <${origin}/preferred-files/#app>;
      <https://schema.org/url> <${origin}/preferred-files/>.`);
    return;
  }
  if (url.pathname.startsWith('/storage/') && url.pathname.endsWith('/')) {
    const children = [...pods.keys()].filter(
      (path) =>
        path.startsWith(url.pathname) &&
        !path.slice(url.pathname.length).includes('/')
    );
    if (url.pathname === '/storage/') {
      children.push('/storage/projects/');
    }
    response.setHeader('Content-Type', 'text/turtle');
    response.end(
      `<${url.href}> a <http://www.w3.org/ns/ldp#BasicContainer>.` +
        children
          .map(
            (
              path
            ) => `<${url.href}> <http://www.w3.org/ns/ldp#contains> <${origin}${path}>.
      <${origin}${path}> a <http://www.w3.org/ns/ldp#${path.endsWith('/') ? 'BasicContainer' : 'Resource'}>.`
          )
          .join('\n')
    );
    return;
  }
  if (url.pathname.startsWith('/storage/')) {
    const prior = pods.get(url.pathname);
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      writes.push(request.headers);
      if (
        prior
          ? request.headers['if-match'] !== prior.etag
          : request.headers['if-none-match'] !== '*'
      ) {
        response.writeHead(412).end();
        return;
      }
      const entry = {
        text: Buffer.concat(chunks).toString(),
        etag: '"' + (writes.length + 1) + '"'
      };
      pods.set(url.pathname, entry);
      response.writeHead(201, { ETag: entry.etag }).end();
      return;
    }
    if (!prior) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/turtle',
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
    if (url.pathname === '/preferred-files/') {
      preferredPickerVisits++;
      url.pathname = '/files/';
    }
    const path =
      url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
    let bytes = await readFile(new URL('../www' + path, import.meta.url));
    if (path === '/notebook/index.html') {
      // Firefox uses relative strong weight. Chrome's absolute UA weight hides
      // that regression; a lower reset layer reproduces Firefox's baseline.
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(
            '</head>',
            '<style>@layer reset {strong {font-weight:bolder}}</style></head>'
          )
      );
    }
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
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
let chrome;
const app = 'globalThis.muzeSolidNotebookApp';
async function run(page, code) {
  return page.evaluate('async()=>{' + code + '}');
}
async function until(page, expression) {
  for (let i = 0; i < 400; i++) {
    if (await run(page, 'return Boolean(' + expression + ')')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'notebook-browser: Timed out: ' +
      expression +
      '\n' +
      (await run(
        page,
        `const frame=document.querySelector('.muze-solid-ui-capability-frame');
        return JSON.stringify({page:document.body.innerText,
          frame:frame?.contentDocument?.body?.innerText,
          picker:frame?.contentWindow?.solidFiles?.ui.data.pickerEntries,
          errors:window.notebookErrors,
          focused:document.activeElement?.outerHTML.slice(0,500),
          active:window.muzeSolidNotebookApp?.runtime.active,
          focusBlock:window.muzeSolidNotebookApp?.runtime.focusBlock,
          busy:window.muzeSolidNotebookApp?.runtime.busy,
          selection:window.muzeSolidNotebookApp?.runtime.controller.getOrderedSelection(),
          blocks:window.muzeSolidNotebookApp?.runtime.documents.blocks(),
          values:window.muzeSolidNotebookApp?.runtime.editors && [...muzeSolidNotebookApp.runtime.editors.values()].map(e=>e.getValue().text)})`
      ))
  );
}
async function click(page, name, index = 0) {
  const selector = '[data-muze-solid-action="muzeSolidNotebook' + name + '"]';
  await until(page, `${app} && !${app}.runtime.busy`);
  await until(
    page,
    `document.querySelectorAll('${selector}')[${index}]?.matches(':enabled') && document.querySelectorAll('${selector}')[${index}].checkVisibility({visibilityProperty:true})`
  );
  const point = await run(
    page,
    `const e=document.querySelectorAll('${selector}')[${index}];
    e.scrollIntoView({block:'nearest'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=e.getBoundingClientRect();
    const point={x:r.x+r.width/2,y:r.y+r.height/2};
    const target=document.elementFromPoint(point.x,point.y);
    if(!e.contains(target)){throw new Error('notebook-browser: Covered control ${name}: '+target?.outerHTML);}
    window.notebookClickedAction=null;
    document.addEventListener('click', event=>{
      window.notebookClickedAction=event.target.closest('[data-muze-solid-action]')?.dataset.muzeSolidAction;
    },{once:true,capture:true});
    return point;`
  );
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1
    });
  }
  assert.equal(
    await run(page, 'return window.notebookClickedAction'),
    'muzeSolidNotebook' + name,
    'Native pointer activates the intended control'
  );
  await until(
    page,
    `!${app}.runtime.busy || ${app}.runtime.host.view.runtime.muzeSolidUiCall`
  );
  if (name === 'New') {
    await until(
      page,
      `document.activeElement===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)?.element`
    );
  }
}
async function pickerRun(page, code) {
  return run(
    page,
    `return document.querySelector('.muze-solid-ui-capability-frame').contentWindow.eval(${JSON.stringify('(async()=>{' + code + '})()')})`
  );
}
async function pickerReady(page) {
  await until(
    page,
    `document.querySelector('.muze-solid-ui-capability-frame')?.contentWindow.solidFiles?.ui.runtime.pending &&
    document.querySelector('.muze-solid-ui-capability-frame').contentWindow.solidFiles.ui.runtime.current`
  );
  await until(
    page,
    `document.querySelector('.muze-solid-ui-capability-frame').checkVisibility() &&
    !document.querySelector('.muze-solid-ui-capability-frame').inert &&
    document.querySelector('.muze-solid-ui-capability-dialog').getAnimations().length===0 &&
    document.querySelector('.muze-solid-ui-capability-loading').hidden`
  );
}
async function pickerClick(page, selector, index = 0) {
  await until(
    page,
    `(()=>{const frame=document.querySelector('.muze-solid-ui-capability-frame');
      const button=frame?.contentDocument?.querySelectorAll(${JSON.stringify(selector)})[${index}];
      return frame?.checkVisibility() && button?.checkVisibility() &&
        button.getBoundingClientRect().width>0;})()`
  );
  const point = await run(
    page,
    `const frame=document.querySelector('.muze-solid-ui-capability-frame');
    const button=frame.contentDocument.querySelectorAll(${JSON.stringify(selector)})[${index}];
    button.scrollIntoView({block:'nearest'});const r=button.getBoundingClientRect();
    const f=frame.getBoundingClientRect();return {x:f.x+r.x+r.width/2,y:f.y+r.y+r.height/2}`
  );
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1
    });
  }
}
async function documentOperation(page, operation, path) {
  await click(page, operation);
  await pickerReady(page);
  assert.equal(
    await pickerRun(page, 'return location.pathname'),
    '/preferred-files/'
  );
  assert.equal(
    await pickerRun(page, 'return solidFiles.ui.runtime.pending.input.mode'),
    operation === 'Open' ? 'open' : 'save'
  );
  const folders = path.slice('/storage/'.length).split('/').slice(0, -1);
  let folder = '/storage/';
  for (const segment of folders) {
    folder += segment + '/';
    const index = await pickerRun(
      page,
      `return solidFiles.ui.data.pickerEntries.findIndex(e=>new URL(e.url).pathname===${JSON.stringify(folder)})`
    );
    await pickerClick(
      page,
      '.swb-resource-choice [data-simply-command=open]',
      index
    );
    await until(
      page,
      `document.querySelector('.muze-solid-ui-capability-frame').contentWindow.solidFiles.ui.runtime.current===location.origin+${JSON.stringify(folder)}`
    );
  }
  if (operation === 'Open') {
    const index = await pickerRun(
      page,
      `return solidFiles.ui.data.pickerEntries.findIndex(e=>new URL(e.url).pathname===${JSON.stringify(path)})`
    );
    await writeFile(
      '/tmp/notebook-picker-open-phone.png',
      Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
    );
    await pickerClick(page, '[data-simply-command=selectResource]', index);
  } else {
    if (!measuredFirstSave) {
      measuredFirstSave = true;
      console.log(
        'First save picker transfers (Notebook and iframe, uncompressed/no-store)',
        await run(
          page,
          `const child=document.querySelector('.muze-solid-ui-capability-frame').contentWindow;
        const entries=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource'),
          ...child.performance.getEntriesByType('navigation'),...child.performance.getEntriesByType('resource')];
        return {bytes:entries.reduce((sum,e)=>sum+e.transferSize,0),requests:entries.length};`
        )
      );
    }
    await pickerRun(
      page,
      'document.querySelector(".muze-solid-files-picker-name").focus()'
    );
    await key(page, 'a', 'KeyA', 65, 2);
    await page.send('Input.insertText', {
      text: decodeURIComponent(path.split('/').at(-1))
    });
    await writeFile(
      '/tmp/notebook-picker-save-phone.png',
      Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
    );
    await pickerClick(page, '.muze-solid-files-picker-save button');
  }
  await until(
    page,
    `!${app}.runtime.host.view.runtime.muzeSolidUiCall && !${app}.runtime.busy`
  );
  if (operation === 'Open') {
    await until(
      page,
      `document.activeElement===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)?.element`
    );
  }
}
async function verifyPickerPreservation(page) {
  const baseline = await run(
    page,
    `return {
    id:${app}.runtime.documents.id, url:${app}.runtime.documents.url,
    turtle:${app}.runtime.documents.content().write()
  }`
  );
  const count = writes.length;
  await click(page, 'SaveAs');
  await pickerReady(page);
  await checkPickerReflow(page);
  for (const [name, message] of [
    ['../escape.ttl', 'filename'],
    ['first.ttl', 'already exists']
  ]) {
    await pickerRun(
      page,
      'document.querySelector(".muze-solid-files-picker-name").focus()'
    );
    await key(page, 'a', 'KeyA', 65, 2);
    await page.send('Input.insertText', { text: name });
    await pickerClick(page, '.muze-solid-files-picker-save button');
    assert.match(
      await pickerRun(
        page,
        'return solidFiles.ui.data.muzeSolidFilesPickerStatus'
      ),
      new RegExp(message)
    );
    assert.equal(writes.length, count);
  }
  await pickerClick(page, '[data-simply-command=cancelSelection]');
  await until(
    page,
    `!${app}.runtime.busy && !${app}.runtime.host.view.runtime.muzeSolidUiCall`
  );
  assert.deepEqual(
    await run(
      page,
      `return {
    id:${app}.runtime.documents.id, url:${app}.runtime.documents.url,
    turtle:${app}.runtime.documents.content().write()
  }`
    ),
    baseline
  );
  await click(page, 'Open');
  await pickerReady(page);
  await pickerClick(page, '[data-simply-command=cancelSelection]');
  await until(
    page,
    `!${app}.runtime.busy && !${app}.runtime.host.view.runtime.muzeSolidUiCall`
  );
  assert.equal(writes.length, count);
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    baseline.turtle
  );
  console.log(
    'PASS: preferred picker cancellation, filename/path validation and duplicate refusal preserve the notebook without writing placeholders.'
  );
}
async function verifySaveDestinationRace(page) {
  const url = await run(page, `return ${app}.runtime.documents.url`);
  const content = await run(
    page,
    `return ${app}.runtime.documents.content().write()`
  );
  const count = writes.length;
  await click(page, 'SaveAs');
  await pickerReady(page);
  // Another writer creates the destination after this folder was listed.
  const remote = '<urn:remote> <urn:keep> "Preserve remote bytes" .';
  pods.set('/storage/raced.ttl', { text: remote, etag: '"raced"' });
  await pickerRun(
    page,
    'document.querySelector(".muze-solid-files-picker-name").focus()'
  );
  await key(page, 'a', 'KeyA', 65, 2);
  await page.send('Input.insertText', { text: 'raced.ttl' });
  await pickerClick(page, '.muze-solid-files-picker-save button');
  await until(
    page,
    `!${app}.runtime.busy && !${app}.runtime.host.view.runtime.muzeSolidUiCall`
  );
  assert.match(
    await run(page, `return ${app}.data.muzeSolidNotebookStatus`),
    /file exists/
  );
  assert.equal(writes.length, count);
  assert.equal(pods.get('/storage/raced.ttl').text, remote);
  assert.equal(await run(page, `return ${app}.runtime.documents.url`), url);
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    content
  );
  console.log(
    'PASS: a destination created after picker listing is refused without overwriting either notebook or remote file.'
  );
}
async function openLocalDocument(page, id) {
  await click(page, 'Recent');
  await until(
    page,
    `document.querySelector('.muze-solid-notebook-document-dialog').open`
  );
  await until(
    page,
    `(()=>{
    const rows=${app}.runtime.documentsList.view.current;
    const index=rows.findIndex(item=>item.id===${JSON.stringify(id)});
    const buttons=document.querySelectorAll('.muze-solid-notebook-documents button');
    return index>=0 && buttons.length===rows.length && buttons[index].textContent===rows[index].title;
  })()`
  );
  await until(
    page,
    `!document.querySelector('.muze-solid-notebook-document-dialog')
    .getAnimations().some(animation=>animation.playState==='running')`
  );
  const point = await run(
    page,
    `const index=${app}.runtime.documentsList.view.current.findIndex(item=>item.id===${JSON.stringify(id)});
    let button=document.querySelectorAll('.muze-solid-notebook-documents button')[index];
    button.scrollIntoView({block:'nearest'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    button=document.querySelectorAll('.muze-solid-notebook-documents button')[index];
    const r=button.getBoundingClientRect();
    const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    if(!button.contains(target)){
      return {error: 'Local document button is covered', rect:r.toJSON(), target:target?.outerHTML.slice(0,700)};
    }
    return {x:r.x+r.width/2,y:r.y+r.height/2}`
  );
  if (point.error) {
    await writeFile(
      '/tmp/notebook-local-picker-covered.png',
      Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
    );
    throw new Error('notebook-browser: ' + JSON.stringify(point));
  }
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1
    });
  }
  await until(
    page,
    `${app}.runtime.documents.id===${JSON.stringify(id)} && !document.querySelector('.muze-solid-notebook-document-dialog').open && !${app}.runtime.busy && document.activeElement===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)?.element`
  );
}
async function type(page, text, index = 0) {
  await until(page, `${app}.runtime.editors.size>${index + 1}`);
  await until(
    page,
    `(()=>{const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[${index}].id)?.element;
    return e && e.checkVisibility() && !e.closest('[inert]') && e.getBoundingClientRect().height>0;})()`
  );
  const point = await run(
    page,
    `const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[${index}].id).element;
    e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+20,y:r.y+20};`
  );
  if (await run(page, 'return innerWidth<=650')) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point]
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
  } else {
    for (const event of ['mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', {
        type: event,
        ...point,
        button: 'left',
        clickCount: 1
      });
    }
  }
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
  await page.send('Input.insertText', { text });
  await until(
    page,
    `${app}.runtime.documents.blocks().some(b=>b.fragment.text===${JSON.stringify(text)})`
  );
  await run(page, `await ${app}.runtime.documents.queue`);
}
async function key(page, name, code, number, modifiers = 0) {
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key: name,
      code,
      windowsVirtualKeyCode: number,
      modifiers,
      ...(type === 'keyDown' && name === 'Enter' ? { text: '\r' } : {})
    });
  }
}
async function caret(page, index, offset) {
  await until(
    page,
    `${app}.runtime.blocks.view.current[${index}] &&
    (()=>{const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[${index}].id);
      return e && e.element.checkVisibility() && !e.element.closest('[inert]') &&
        !${app}.runtime.busy && !${app}.runtime.focusBlock;})()`
  );
  await run(
    page,
    `const id=${app}.runtime.blocks.view.current[${index}].id;
    const editor=${app}.runtime.editors.get(id);editor.element.scrollIntoView({block:'center'});editor.focus(${offset});`
  );
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[${index}].id && ${app}.runtime.range?.start===${offset}`
  );
}
async function selectNotes(page) {
  await caret(page, 0, 0);
  await key(page, 'Escape', 'Escape', 27);
  await caret(page, 0, 0);
  for (let i = 0; i < 10; i++) {
    await key(page, 'ArrowRight', 'ArrowRight', 39, 8);
  }
  await until(page, `${app}.runtime.controller.hasSelection()`);
}
async function verifyAccountCorner(page) {
  const status = await run(
    page,
    `const button=document.querySelector('.muze-solid-ui-account-status');
    const rect=button.getBoundingClientRect();
    return {visible:button.checkVisibility({visibilityProperty:true}),width:rect.width,height:rect.height};`
  );
  assert(
    status.visible && status.width >= 44 && status.height >= 44,
    'Connection status remains a visible touch target at narrow widths'
  );
  const corner = await run(
    page,
    `const account=document.querySelector('.swb-account').getBoundingClientRect();
    const header=document.querySelector('.swb-suite-header').getBoundingClientRect();
    return {top:account.top,headerTop:header.top,right:account.right,width:document.documentElement.clientWidth};`
  );
  assert(
    Math.abs(corner.top - corner.headerTop) <= 1,
    'Account menu stays at the top'
  );
  assert(
    Math.abs(corner.right - corner.width) <= 1,
    'Account menu stays at the right'
  );
}
async function verifyNotebookChrome(page) {
  const title = `document.querySelector('.muze-solid-notebook-title-editor')`;
  const titleEditor = `${app}.runtime.editors.get(${app}.runtime.documents.root.id)`;
  const initial = await run(page, `return ${app}.runtime.documents.title`);
  assert.equal(await run(page, 'return document.title'), initial);
  assert.equal(
    await run(page, 'return document.querySelector("h1").textContent.trim()'),
    'Notebook'
  );
  assert.equal(
    await run(page, `return ${titleEditor}.getValue().text`),
    initial
  );
  assert.equal(
    await run(
      page,
      `return ${app}.container.querySelectorAll('details').length`
    ),
    0
  );
  assert.equal(
    await run(
      page,
      `return document.querySelector('[data-muze-solid-action="muzeSolidNotebookEditTitle"]')`
    ),
    null
  );
  for (const name of ['New', 'Open', 'Save', 'SaveAs']) {
    assert(
      await run(
        page,
        `return document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebook${name}"]').checkVisibility()`
      )
    );
  }
  await run(
    page,
    `window.notebookTitleEditor=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)`
  );
  async function changeTitle(text) {
    await until(page, `!${title}.closest('[inert]')`);
    await run(page, `${titleEditor}.focus(0)`);
    await key(page, 'a', 'KeyA', 65, 2);
    await page.send('Input.insertText', { text });
    await until(
      page,
      `${app}.runtime.documents.title===${JSON.stringify(text)} && document.title===${JSON.stringify(text)}`
    );
    await run(page, `await ${app}.runtime.documents.queue`);
  }
  const longTitle = 'Notebook'.repeat(16);
  await changeTitle(longTitle);
  await until(page, `${title}.getBoundingClientRect().height>80`);
  await verifyAccountCorner(page);
  assert(
    await run(page, 'return document.documentElement.scrollWidth<=innerWidth')
  );
  await writeFile(
    '/tmp/notebook-title-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  for (const width of [320, 500, 501]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await verifyAccountCorner(page);
    assert(
      await run(page, 'return document.documentElement.scrollWidth<=innerWidth')
    );
    if (width === 320) {
      await writeFile(
        '/tmp/notebook-header-320.png',
        Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
      );
      await run(
        page,
        `document.querySelector('.muze-solid-ui-account-status').focus()`
      );
      await key(page, 'Tab', 'Tab', 9);
      await until(
        page,
        `document.activeElement.matches('.swb-account-button')`
      );
      await key(page, 'Tab', 'Tab', 9, 8);
      await until(
        page,
        `document.activeElement.matches('.muze-solid-ui-account-status')`
      );
    }
  }
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await run(
    page,
    `await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`
  );
  await verifyAccountCorner(page);
  await writeFile(
    '/tmp/notebook-title-desktop.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await changeTitle('Field notes <2026> & ideas');
  assert.equal(
    await run(page, `return ${titleEditor}.getValue().text`),
    'Field notes <2026> & ideas'
  );
  assert(
    await run(
      page,
      `return notebookTitleEditor===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)`
    )
  );
  assert.equal(
    await run(
      page,
      `return ${app}.runtime.documents.blocks()[0].fragment.text`
    ),
    'First notebook'
  );
  const id = await run(page, `return ${app}.runtime.documents.id`);
  await key(page, 'a', 'KeyA', 65, 2);
  await page.send('Input.imeSetComposition', {
    text: '日',
    selectionStart: 1,
    selectionEnd: 1
  });
  await until(page, `${titleEditor}.isComposing()`);
  await run(
    page,
    `document.querySelector('[data-muze-solid-action="muzeSolidNotebookNew"]').click()`
  );
  assert.equal(await run(page, `return ${app}.runtime.documents.id`), id);
  assert.equal(
    await run(page, `return ${app}.runtime.documents.title`),
    'Field notes <2026> & ideas'
  );
  await page.send('Input.insertText', { text: '日' });
  await until(
    page,
    `!${titleEditor}.isComposing() && ${app}.runtime.documents.title==='日'`
  );
  await changeTitle('Field notes <2026> & ideas');
  await key(page, 'Tab', 'Tab', 9);
  await until(
    page,
    `document.activeElement===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id).element`
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.blocks().length`),
    1
  );
  assert.equal(
    await run(page, `return getComputedStyle(${title}).outlineWidth`),
    '0px'
  );
  await key(page, 'Tab', 'Tab', 9, 8);
  await until(page, `document.activeElement===${title}`);
  await key(page, 'Tab', 'Tab', 9);
  await verifyAccountCorner(page);
  assert.equal(
    await run(
      page,
      `return getComputedStyle(document.querySelector('.muze-solid-notebook-blocks')).listStyleType`
    ),
    'none'
  );
  assert.equal(
    await run(
      page,
      `return getComputedStyle(document.querySelector('.muze-solid-notebook-editor')).borderTopWidth`
    ),
    '0px'
  );
  await until(
    page,
    `document.querySelector('[data-muze-solid-action="muzeSolidNotebookStatus"] use').getAttribute('href').endsWith('#hard-drive')`
  );
  assert(
    await run(
      page,
      `return !${app}.container.innerText.includes('Pod copy has not been updated')`
    )
  );
  await click(page, 'Status');
  await until(
    page,
    `document.querySelector('#muze-solid-notebook-status').matches(':popover-open')`
  );
  assert.match(
    await run(
      page,
      `return document.querySelector('#muze-solid-notebook-status').innerText`
    ),
    /Saved on this device/
  );
  await key(page, 'Escape', 'Escape', 27);
  await until(
    page,
    `!document.querySelector('#muze-solid-notebook-status').matches(':popover-open')`
  );
  console.log(
    'PASS: inline wrapping title autosave, escaped tab title, IME guard, native Tab focus, stable notes, phone/desktop top-right account and compact header.'
  );
}
async function verifyTitleCursor(page) {
  const title = `${app}.runtime.editors.get(${app}.runtime.documents.root.id)`;
  const body = `${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)`;
  const original = await run(
    page,
    `return ${app}.runtime.documents.content().write()`
  );
  await caret(page, 0, 0);
  await key(page, 'ArrowLeft', 'ArrowLeft', 37);
  await until(
    page,
    `document.activeElement===${title}.element && ${title}.getSelection().start===${title}.getLength()`
  );
  await key(page, 'ArrowRight', 'ArrowRight', 39);
  await until(
    page,
    `document.activeElement===${body}.element && ${body}.getSelection().start===0`
  );
  await caret(page, 0, 4);
  const x = await run(page, `return ${body}.getCaretClientRect().left`);
  await key(page, 'ArrowUp', 'ArrowUp', 38);
  await until(page, `document.activeElement===${title}.element`);
  await key(page, 'ArrowDown', 'ArrowDown', 40);
  await until(page, `document.activeElement===${body}.element`);
  assert(
    Math.abs(
      (await run(page, `return ${body}.getCaretClientRect().left`)) - x
    ) < 20
  );
  await caret(page, 0, 0);
  await key(page, 'ArrowLeft', 'ArrowLeft', 37, 8);
  await until(
    page,
    `${app}.runtime.controller.hasSelection() && ${app}.runtime.controller.getOrderedSelection().start.noteIndex===0 && ${app}.runtime.controller.getOrderedSelection().end.noteIndex===1`
  );
  await key(page, 'Escape', 'Escape', 27);
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    original
  );
  console.log(
    'PASS: shared Cobalt title/body cursor movement and Shift+Arrow selection preserve native RDF.'
  );
}
async function verifyTitleSplit(page) {
  const original = await run(page, `return ${app}.runtime.documents.id`);
  const joinedTitle = 'Heading\nRemainder';
  const title = `${app}.runtime.editors.get(${app}.runtime.documents.root.id)`;
  await click(page, 'New');
  const previousParagraph = await run(
    page,
    `return ${app}.runtime.blocks.view.current[0].id`
  );
  await run(page, `${title}.focus(0,${title}.getLength())`);
  await page.send('Input.insertText', { text: 'HeadingRemainder' });
  await until(page, `${app}.runtime.documents.title==='HeadingRemainder'`);
  await run(page, `${title}.focus(0,${title}.getLength())`);
  await key(page, 'i', 'KeyI', 73, 2);
  await until(
    page,
    `${app}.runtime.documents.titleFragment().annotations.some(a=>a.tag==='<em>')`
  );
  await run(page, `${title}.focus(7)`);
  await key(page, 'Enter', 'Enter', 13);
  await until(
    page,
    `!${app}.runtime.busy && ${app}.runtime.documents.title==='Heading' && ${app}.runtime.documents.blocks().length===2`
  );
  const first = `${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id)`;
  await until(
    page,
    `document.activeElement===${first}.element && ${first}.getValue().text==='Remainder' && ${first}.getSelection().start===0`
  );
  assert.equal(await run(page, `return ${title}.element.tagName`), 'H1');
  assert.equal(
    await run(page, `return ${app}.runtime.blocks.view.current[1].id`),
    previousParagraph
  );
  assert(
    await run(
      page,
      `return ${app}.runtime.documents.titleFragment().annotations.some(a=>a.tag==='<em>' && a.range[0]===0 && a.range[1]===7)`
    )
  );
  assert.equal(await run(page, 'return document.title'), 'Heading');
  await writeFile(
    '/tmp/notebook-cobalt-title-split-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  assert(
    await run(
      page,
      `return ${first}.getValue().annotations.some(a=>a.tag==='<em>' && a.range[0]===0 && a.range[1]===9)`
    )
  );
  await key(page, 'Backspace', 'Backspace', 8);
  await until(
    page,
    `!${app}.runtime.busy && ${app}.runtime.documents.title===${JSON.stringify(joinedTitle)} && ${app}.runtime.documents.blocks().length===1 && document.activeElement===${title}.element`
  );
  await run(page, `${title}.focus(${title}.getLength())`);
  await key(page, 'Enter', 'Enter', 13);
  await until(
    page,
    `!${app}.runtime.busy && ${app}.runtime.documents.blocks().length===2 && document.activeElement===${first}.element && ${first}.getValue().text===''`
  );
  await key(page, 'Backspace', 'Backspace', 8);
  await until(
    page,
    `!${app}.runtime.busy && ${app}.runtime.documents.blocks().length===1`
  );
  await type(page, 'Body');
  await caret(page, 0, 2);
  for (let i = 0; i < 4; i++) {
    await key(page, 'ArrowLeft', 'ArrowLeft', 37, 8);
  }
  await until(
    page,
    `${app}.runtime.controller.hasSelection() && ${app}.runtime.controller.getOrderedSelection().start.noteIndex===0`
  );
  await key(page, 'b', 'KeyB', 66, 2);
  await until(
    page,
    `${app}.runtime.documents.titleFragment().annotations.some(a=>a.tag==='<strong>') && ${app}.runtime.documents.blocks()[0].fragment.annotations.some(a=>a.tag==='<strong>') && !${app}.runtime.busy`
  );
  await caret(page, 0, 2);
  for (let i = 0; i < 4; i++) {
    await key(page, 'ArrowLeft', 'ArrowLeft', 37, 8);
  }
  const copied = await run(
    page,
    `const clipboard=new DataTransfer();
    ${app}.runtime.editors.get(${app}.runtime.active).element.dispatchEvent(new ClipboardEvent('copy',{clipboardData:clipboard,bubbles:true,cancelable:true}));
    return clipboard.getData('text/plain');`
  );
  assert.equal(copied, 'r\nBo');
  await key(page, 'Escape', 'Escape', 27);
  await run(page, `await ${app}.runtime.documents.queue`);
  const previous = await run(page, 'return performance.timeOrigin');
  await page.send('Page.reload');
  await until(
    page,
    `performance.timeOrigin!==${previous} && ${app}?.runtime.editors.size===2`
  );
  assert.equal(await run(page, `return ${title}.getValue().text`), joinedTitle);
  assert(await run(page, `return ${title}.element.querySelector('em')!==null`));
  await openLocalDocument(page, original);
  console.log(
    'PASS: Cobalt H1 Enter splits formatted remainder into a paragraph, boundary Backspace uses Cobalt joining, end Enter creates an empty paragraph, cross-title selection formats/copies, and rich title survives reload.'
  );
}
async function verifyNotebookInteractions(page) {
  const original = await run(page, `return ${app}.runtime.documents.id`);
  await click(page, 'New');
  await key(page, 'ArrowUp', 'ArrowUp', 38);
  await until(
    page,
    `document.activeElement.matches('.muze-solid-notebook-title-editor')`
  );
  await key(page, 'End', 'End', 35, 2);
  await key(page, 'ArrowRight', 'ArrowRight', 39);
  await until(
    page,
    `document.activeElement===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id).element`
  );
  await type(page, 'Alpha');
  await caret(page, 0, 5);
  await key(page, 'Enter', 'Enter', 13);
  await until(page, `${app}.runtime.editors.size===3 && !${app}.runtime.busy`);
  await type(page, 'Beta', 1);
  await caret(page, 1, 4);
  await key(page, 'Enter', 'Enter', 13, 8);
  await until(
    page,
    `${app}.runtime.documents.blocks().some(b=>b.fragment.text===${JSON.stringify('Beta\n')})`
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.blocks().length`),
    2
  );
  await type(page, 'Beta', 1);
  await caret(page, 1, 0);
  await key(page, 'ArrowUp', 'ArrowUp', 38);
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[0].id`
  );
  await key(page, 'ArrowDown', 'ArrowDown', 40);
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[1].id`
  );
  await caret(page, 1, 0);
  await key(page, 'ArrowLeft', 'ArrowLeft', 37);
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[0].id`
  );
  await key(page, 'ArrowRight', 'ArrowRight', 39);
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[1].id`
  );
  await key(page, 'ArrowLeft', 'ArrowLeft', 37, 8);
  await key(page, 'ArrowLeft', 'ArrowLeft', 37, 8);
  await until(
    page,
    `${app}.runtime.controller.hasSelection() && ${app}.runtime.controller.getOrderedSelection().start.noteIndex===1`
  );
  await selectNotes(page);
  assert.match(
    await run(page, `return ${app}.data.muzeSolidNotebookStatus`),
    /notes 1 to 2/
  );
  await click(page, 'Blockstrong');
  await until(
    page,
    `${app}.runtime.documents.blocks().every(b=>b.fragment.annotations.some(a=>a.tag==='<strong>'))`
  );
  assert.equal(
    await run(
      page,
      `return document.querySelectorAll('.muze-solid-notebook-editor strong').length`
    ),
    2
  );
  await selectNotes(page);
  const copied = await run(
    page,
    `window.notebookClipboard=new DataTransfer();
    const editor=${app}.runtime.editors.get(${app}.runtime.active);
    editor.element.dispatchEvent(new ClipboardEvent('copy',{clipboardData:notebookClipboard,bubbles:true,cancelable:true}));
    return notebookClipboard.getData('text/plain');`
  );
  assert.equal(copied, 'Alpha\nBeta');
  await run(
    page,
    `const editor=${app}.runtime.editors.get(${app}.runtime.active);
    editor.element.dispatchEvent(new ClipboardEvent('cut',{clipboardData:notebookClipboard,bubbles:true,cancelable:true}));`
  );
  await until(page, `${app}.runtime.editors.size===2 && !${app}.runtime.busy`);
  assert.equal(
    await run(
      page,
      `return ${app}.runtime.documents.blocks()[0].fragment.text`
    ),
    ''
  );
  await run(
    page,
    `const editor=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);editor.focus(0);
    editor.element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:notebookClipboard,bubbles:true,cancelable:true}));`
  );
  await until(page, `${app}.runtime.editors.size===3 && !${app}.runtime.busy`);
  assert.deepEqual(
    await run(
      page,
      `return ${app}.runtime.blocks.view.current.map(b=>b.fragment.text)`
    ),
    ['Alpha', 'Beta']
  );
  assert(
    await run(
      page,
      `return ${app}.runtime.documents.blocks().every(b=>b.fragment.annotations.some(a=>a.tag==='<strong>'))`
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await caret(page, 0, 0);
  await key(page, 'Escape', 'Escape', 27);
  await run(
    page,
    `await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`
  );
  const points = await run(
    page,
    `return [...document.querySelectorAll('.muze-solid-notebook-blocks .muze-solid-notebook-editor')].map(e=>{
    const r=e.getBoundingClientRect();return {x:r.left+14,y:r.top+20};});`
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...points[0],
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: points[1].x + 40,
    y: points[1].y,
    buttons: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: points[1].x + 40,
    y: points[1].y,
    button: 'left',
    clickCount: 1
  });
  await until(
    page,
    `${app}.runtime.controller.hasSelection() && ${app}.runtime.controller.getOrderedSelection().end.noteIndex===2`
  );
  await until(
    page,
    `document.querySelector('.muze-solid-notebook-block-tools').checkVisibility({visibilityProperty:true})`
  );
  await run(
    page,
    `await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`
  );
  await writeFile(
    '/tmp/notebook-cross-note-selection.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await key(page, 'Escape', 'Escape', 27);
  await until(page, `!${app}.runtime.controller.hasSelection()`);
  await caret(page, 0, 5);
  await key(page, 'Delete', 'Delete', 46);
  await until(page, `${app}.runtime.editors.size===2 && !${app}.runtime.busy`);
  await click(page, 'New');
  await run(
    page,
    `const mime=${app}.api.COBALT_NOTEBOOK_CLIPBOARD_MIME;
    const rich=JSON.parse(notebookClipboard.getData(mime)).fragments;
    notebookClipboard.setData(mime,JSON.stringify({fragments:[
      {type:'cobalt.rich-text',data:rich[0]},
      {type:'cobalt.rich-text',data:{text:'',annotations:[]}},
      {type:'cobalt.rich-text',data:rich[1]}
    ]}));
    const editor=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);editor.focus(0);
    editor.element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:notebookClipboard,bubbles:true,cancelable:true}));`
  );
  await until(page, `${app}.runtime.editors.size===4 && !${app}.runtime.busy`);
  assert.deepEqual(
    await run(
      page,
      `return ${app}.runtime.blocks.view.current.map(b=>b.fragment.text)`
    ),
    ['Alpha', '', 'Beta']
  );
  await until(page, `!${app}.runtime.busy`);
  const preserved = await run(
    page,
    `return ${app}.runtime.documents.content().write()`
  );
  await run(
    page,
    `notebookClipboard.setData(${app}.api.COBALT_NOTEBOOK_CLIPBOARD_MIME,JSON.stringify({fragments:[{type:'cobalt.image',data:{src:'https://example.org/image'}}]}));
    const editor=${app}.runtime.editors.get(${app}.runtime.active);
    editor.element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:notebookClipboard,bubbles:true,cancelable:true}));`
  );
  assert.match(
    await run(page, `return ${app}.data.muzeSolidNotebookStatus`),
    /clipboard note type/
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    preserved
  );
  await openLocalDocument(page, original);
  await until(
    page,
    `${app}.runtime.documents.id===${JSON.stringify(original)} && ${app}.runtime.editors.size===2`
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  console.log(
    'PASS: Enter/Shift+Enter, all cursor directions, keyboard and pointer cross-note selection, rich formatting/copy/cut/paste and forward join.'
  );
}

async function verifyNotebookBold(page) {
  const editor = `${app}.runtime.editors.get(${app}.runtime.active)`;
  async function selectFirstWord() {
    await caret(page, 0, 0);
    await key(page, 'Escape', 'Escape', 27);
    for (let i = 0; i < 5; i++) {
      await key(page, 'ArrowRight', 'ArrowRight', 39, 8);
    }
    await until(page, `${app}.runtime.controller.hasSelection()`);
  }
  await selectFirstWord();
  await click(page, 'Blockstrong');
  await until(page, `${editor}.element.querySelector('strong')`);
  const style = await run(
    page,
    `const e=${editor}.element;return {normal:getComputedStyle(e).fontWeight,bold:getComputedStyle(e.querySelector('strong')).fontWeight,font:getComputedStyle(e).fontFamily}`
  );
  console.log('Native bold rendering', style);
  assert(
    Number(style.bold) >= 600,
    'Bold must render with a visibly bold weight'
  );
  await writeFile(
    '/tmp/notebook-bold-selected.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await selectFirstWord();
  await key(page, 'b', 'KeyB', 66, 2);
  await until(page, `!${editor}.element.querySelector('strong')`);
  await selectFirstWord();
  await key(page, 'b', 'KeyB', 66, 2);
  await until(
    page,
    `${editor}.element.querySelector('strong') && Number(getComputedStyle(${editor}.element.querySelector('strong')).fontWeight)>=600`
  );
  await selectFirstWord();
  await click(page, 'Blockstrong');
  await until(page, `!${editor}.element.querySelector('strong')`);
  console.log(
    'PASS: visible Bold through toolbar and Ctrl+B, including toggling off without changing text.'
  );
}
async function verifyFormattingStability(page) {
  const original = await run(page, `return ${app}.runtime.documents.id`);
  await click(page, 'New');
  const spacer = 'Unrelated text above the selection. '.repeat(80);
  await type(page, spacer);
  await caret(page, 0, spacer.length);
  await key(page, 'Enter', 'Enter', 13);
  await until(page, `${app}.runtime.editors.size===3 && !${app}.runtime.busy`);
  await type(page, 'Alpha', 1);
  await caret(page, 1, 5);
  await key(page, 'Enter', 'Enter', 13);
  await until(page, `${app}.runtime.editors.size===4 && !${app}.runtime.busy`);
  await type(page, 'Beta', 2);

  async function select(count) {
    await caret(page, 1, 0);
    for (let i = 0; i < count; i++) {
      await key(page, 'ArrowRight', 'ArrowRight', 39, 8);
    }
    await until(page, `${app}.runtime.controller.hasSelection()`);
  }
  async function observe() {
    await run(
      page,
      `await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      window.notebookFormatObservation={
        editors:[...${app}.runtime.editors.entries()],
        untouched:[${app}.runtime.documents.root.id,${app}.runtime.blocks.view.current[0].id]
          .map(id=>${app}.runtime.editors.get(id).element.firstChild),
        locks:0,documentDisabled:0,scrollY,
        scrollTop:document.querySelector('.swb-suite-main').scrollTop
      };
      const observation=notebookFormatObservation;
      observation.observer=new MutationObserver(changes=>{
        for(const change of changes){
          if(change.attributeName==='inert' && change.target.matches('[data-simply-field="muzeSolidNotebookLocked"]')){
            observation.locks++;
          }
          if(change.attributeName==='disabled' && /^muzeSolidNotebook(New|Open|Recent|Save|SaveAs)$/.test(change.target.dataset.muzeSolidAction||'')){
            observation.documentDisabled++;
          }
        }
      });
      observation.observer.observe(document.querySelector('#app'),{
        subtree:true,attributes:true,attributeFilter:['inert','disabled']
      });`
    );
  }
  async function stable(index, offset, { saveFailed = false } = {}) {
    await run(
      page,
      `${saveFailed ? '' : `await ${app}.runtime.documents.queue;`}
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));`
    );
    const result = await run(
      page,
      `const observation=notebookFormatObservation;
      observation.observer.disconnect();
      const editor=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[${index}].id);
      return {
        retained:observation.editors.every(([id,editor])=>${app}.runtime.editors.get(id)===editor && editor.element.isConnected),
        untouched:observation.untouched.every(node=>node.isConnected),
        locks:observation.locks,documentDisabled:observation.documentDisabled,
        sameScroll:Math.abs(scrollY-observation.scrollY)<=1 &&
          Math.abs(document.querySelector('.swb-suite-main').scrollTop-observation.scrollTop)<=1,
        focused:document.activeElement===editor.element,
        range:editor.getSelection()
      };`
    );
    assert.deepEqual(
      result,
      {
        retained: true,
        untouched: true,
        locks: 0,
        documentDisabled: 0,
        sameScroll: true,
        focused: true,
        range: { start: offset, end: offset }
      },
      'Formatting preserves live editors, unrelated content, document controls, scroll and caret'
    );
  }
  await select(5);
  assert(
    await run(
      page,
      "return document.querySelector('.swb-suite-main').scrollTop>0"
    ),
    'Exercise formatting in a scrolled notebook'
  );
  await observe();
  await click(page, 'Blockstrong');
  await until(
    page,
    `${app}.runtime.documents.blocks().find(b=>b.position===1).fragment.annotations.some(a=>a.tag==='<strong>')`
  );
  await stable(1, 5);

  await select(10);
  await observe();
  await key(page, 'i', 'KeyI', 73, 2);
  await until(
    page,
    `${app}.runtime.documents.blocks().filter(b=>b.position>0).every(b=>b.fragment.annotations.some(a=>a.tag==='<em>'))`
  );
  await stable(2, 4);

  await run(
    page,
    `const documents=${app}.runtime.documents;
    window.notebookFormatStore=documents.store;
    documents.store=id=>({load:()=>notebookFormatStore(id).load(),save:()=>{throw new Error('fixture: formatting cache unavailable');}});`
  );
  await select(5);
  await observe();
  await key(page, 'u', 'KeyU', 85, 2);
  await until(
    page,
    `${app}.data.muzeSolidNotebookStatus.includes('formatting cache unavailable')`
  );
  await stable(1, 5, { saveFailed: true });
  assert(
    await run(
      page,
      `return ${app}.runtime.documents.blocks().find(b=>b.position===1).fragment.annotations.some(a=>a.tag==='<u>') && ${app}.runtime.documents.dirty`
    )
  );
  await run(page, `${app}.runtime.documents.store=notebookFormatStore;`);
  // A subsequent normal edit retries autosave with the complete in-memory graph.
  await select(5);
  await key(page, 'u', 'KeyU', 85, 2);
  await run(page, `await ${app}.runtime.documents.queue`);
  await until(page, `${app}.data.muzeSolidNotebookStatusKind==='local'`);
  const previous = await run(page, 'return performance.timeOrigin');
  await page.send('Page.reload');
  await until(
    page,
    `performance.timeOrigin!==${previous} && ${app}?.runtime.editors.size===4`
  );
  assert(
    await run(
      page,
      `return ${app}.runtime.documents.blocks().find(b=>b.position===1).fragment.annotations.some(a=>a.tag==='<strong>') && ${app}.runtime.documents.blocks().filter(b=>b.position>0).every(b=>b.fragment.annotations.some(a=>a.tag==='<em>'))`
    )
  );
  await openLocalDocument(page, original);
  console.log(
    'PASS: in-place toolbar/keyboard formatting retains editors, unrelated DOM, scroll/caret and enabled document controls; cache failure preserves edits and later autosave/reload recovers.'
  );
}
async function verifyBlockTools(page) {
  const toolbar = `document.querySelector('.muze-solid-notebook-block-tools')`;
  const editor = `${app}.runtime.editors.get(${app}.runtime.active)`;
  await caret(page, 0, 0);
  await until(page, `!${toolbar}.checkVisibility({visibilityProperty:true})`);
  assert.equal(
    await run(
      page,
      `return document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockstrong"]')`
    ),
    null
  );
  await key(page, ' ', 'Space', 32, 2);
  await until(
    page,
    `${toolbar}.checkVisibility({visibilityProperty:true}) && ${toolbar}.contains(document.activeElement)`
  );
  assert(
    await run(
      page,
      `return ${toolbar}.querySelector('[data-muze-solid-action="muzeSolidNotebookBlockstrong"]').disabled`
    )
  );
  await key(page, 'Escape', 'Escape', 27);
  await until(
    page,
    `!${toolbar}.checkVisibility({visibilityProperty:true}) && document.activeElement===${editor}.element`
  );
  await run(page, `${editor}.focus(0,5)`);
  await until(page, `${toolbar}.checkVisibility({visibilityProperty:true})`);
  assert(await run(page, `return document.activeElement===${editor}.element`));
  assert(
    await run(
      page,
      `const r=${toolbar}.getBoundingClientRect();return r.x>=7 && r.y>=7 && r.right<=innerWidth-7 && r.bottom<=innerHeight-7`
    )
  );
  await click(page, 'Blockem');
  await until(
    page,
    `${app}.runtime.documents.blocks()[0].fragment.annotations.some(a=>a.tag==='<em>') &&
    ${toolbar}.querySelector('[data-muze-solid-action="muzeSolidNotebookBlockem"]').getAttribute('aria-pressed')==='true'`
  );
  await click(page, 'BlockDock');
  await until(
    page,
    `${app}.runtime.toolsDocked && !${toolbar}.checkVisibility({visibilityProperty:true}) &&
    document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockem"]')?.checkVisibility()`
  );
  await until(
    page,
    `document.querySelector('.swb-suite-header').contains(document.activeElement) && document.activeElement.dataset.muzeSolidAction?.startsWith('muzeSolidNotebookBlock')`
  );
  await key(page, 'Escape', 'Escape', 27);
  await until(page, `document.activeElement===${editor}.element`);
  await click(page, 'BlockDock');
  await until(
    page,
    `!${app}.runtime.toolsDocked && ${toolbar}.checkVisibility({visibilityProperty:true})`
  );
  await click(page, 'BlockDock');
  await until(
    page,
    `${app}.runtime.toolsDocked && !${toolbar}.checkVisibility({visibilityProperty:true})`
  );
  await run(
    page,
    `document.querySelector('.muze-solid-notebook-title-editor').focus()`
  );
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.documents.root.id && document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockem"]').getAttribute('aria-pressed')==='false'`
  );
  await verifyAccountCorner(page);
  await caret(page, 0, 1);
  await until(
    page,
    `document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockstrong"]')`
  );
  const end = await run(
    page,
    `return ${app}.runtime.blocks.view.current[0].fragment.text.length`
  );
  await caret(page, 0, end);
  await key(page, 'Enter', 'Enter', 13);
  await until(page, `${app}.runtime.editors.size===3 && !${app}.runtime.busy`);
  await type(page, 'Second toolbar block', 1);
  await until(
    page,
    `document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockem"]').getAttribute('aria-pressed')==='false'`
  );
  await caret(page, 0, 1);
  await until(
    page,
    `document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockem"]').getAttribute('aria-pressed')==='true'`
  );
  await run(page, `${editor}.focus(0,5)`);
  await click(page, 'Blockem');
  await until(
    page,
    `document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockem"]').getAttribute('aria-pressed')==='false' && !${editor}.element.querySelector('em')`
  );
  await click(page, 'Blockem');
  await until(
    page,
    `${editor}.element.querySelector('em') && document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockem"]').getAttribute('aria-pressed')==='true'`
  );
  // A fixture adapter advertises another type; no new persisted block kind.
  await run(
    page,
    `const other=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[1].id);
    window.notebookOriginalType=other.getType;other.getType=()=> 'fixture.media';
    ${app}.api.muzeSolidNotebookToolbars['fixture.media']={label:'Media tools',tools:[{
      id:'FixtureMedia',label:'Media action',icon:'image',command:'muzeSolidNotebookFixtureMedia'
    }]};
    ${app}.commands.muzeSolidNotebookFixtureMedia=function(){window.notebookToolTarget=this.runtime.active;};`
  );
  await caret(page, 1, 0);
  await until(
    page,
    `document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockFixtureMedia"]')?.checkVisibility()`
  );
  assert.equal(
    await run(
      page,
      `return document.querySelector('.swb-suite-header [data-muze-solid-action="muzeSolidNotebookBlockstrong"]')`
    ),
    null
  );
  const content = await run(
    page,
    `return ${app}.runtime.documents.content().write()`
  );
  await click(page, 'BlockFixtureMedia');
  assert.equal(
    await run(page, 'return notebookToolTarget'),
    await run(page, `return ${app}.runtime.blocks.view.current[1].id`)
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    content
  );
  await run(
    page,
    `const other=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[1].id);
    other.getType=notebookOriginalType;
    delete ${app}.api.muzeSolidNotebookToolbars['fixture.media'];
    delete ${app}.commands.muzeSolidNotebookFixtureMedia;`
  );
  await caret(page, 0, 0);
  await caret(page, 1, 0);
  await key(page, 'a', 'KeyA', 65, 2);
  await key(page, 'Backspace', 'Backspace', 8);
  await until(
    page,
    `${app}.runtime.documents.blocks().some(b=>b.fragment.text==='')`
  );
  await caret(page, 1, 0);
  await key(page, 'Backspace', 'Backspace', 8);
  await until(page, `${app}.runtime.editors.size===2 && !${app}.runtime.busy`);
  await click(page, 'BlockDock');
  await until(
    page,
    `!${app}.runtime.toolsDocked && !${toolbar}.checkVisibility({visibilityProperty:true})`
  );
  await run(page, `${editor}.focus(0,5)`);
  await until(page, `${toolbar}.checkVisibility({visibilityProperty:true})`);
  await writeFile(
    '/tmp/notebook-floating-tools-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    mobile: true
  });
  await run(page, `document.documentElement.style.fontSize='200%'`);
  await until(
    page,
    `(()=>{const r=${toolbar}.getBoundingClientRect();return r.left>=7 && r.right<=innerWidth-7 && r.top>=7 && r.bottom<=innerHeight-7})()`
  );
  assert(
    await run(
      page,
      `return [...${toolbar}.querySelectorAll('button')].every(e=>{const r=e.getBoundingClientRect(),t=${toolbar}.getBoundingClientRect();return r.left>=t.left && r.right<=t.right && r.top>=t.top && r.bottom<=t.bottom})`
    )
  );
  await writeFile(
    '/tmp/notebook-floating-tools-reflow.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  const ax = await page.send('Accessibility.getFullAXTree');
  assert(
    ax.nodes.some((n) => n.role?.value === 'button' && n.name?.value === 'Bold')
  );
  await run(page, `document.documentElement.style.fontSize=''`);
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await key(page, 'Escape', 'Escape', 27);
  await until(page, `!${toolbar}.checkVisibility({visibilityProperty:true})`);
  assert.equal(
    await run(
      page,
      `return ${app}.runtime.documents.blocks()[0].fragment.text`
    ),
    'First notebook'
  );
  console.log(
    'PASS: floating selection/keyboard tools, Escape focus, formatting, docking and active block/type toolbar replacement without document mutation.'
  );
}
async function verifyNotebookLinks(page) {
  await run(
    page,
    `const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);e.focus(0,5)`
  );
  await until(page, `${app}.runtime.range?.end===5`);
  const original = await run(
    page,
    `return ${app}.runtime.documents.content().write()`
  );
  await key(page, 'k', 'KeyK', 75, 2);
  await until(
    page,
    `document.querySelector('.muze-solid-notebook-link-dialog').open && document.activeElement.name==='href'`
  );
  await page.send('Input.insertText', {
    text: 'https://example.org/cancelled'
  });
  await key(page, 'Escape', 'Escape', 27);
  await until(
    page,
    `!document.querySelector('.muze-solid-notebook-link-dialog').open && ${app}.runtime.linkTarget===null && document.activeElement.classList.contains('muze-solid-notebook-editor')`
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    original
  );
  await key(page, 'k', 'KeyK', 75, 2);
  await until(
    page,
    `document.querySelector('.muze-solid-notebook-link-dialog').open && document.activeElement.name==='href'`
  );
  await page.send('Input.insertText', { text: 'javascript:alert(1)' });
  await key(page, 'Enter', 'Enter', 13);
  await until(
    page,
    `${app}.data.muzeSolidNotebookStatus.includes('Unsupported link')`
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.content().write()`),
    original
  );
  await run(
    page,
    `document.querySelector('.muze-solid-notebook-link-dialog input').focus()`
  );
  await key(page, 'a', 'KeyA', 65, 2);
  await page.send('Input.insertText', { text: 'https://example.org/selected' });
  await key(page, 'Enter', 'Enter', 13);
  await until(
    page,
    `!document.querySelector('.muze-solid-notebook-link-dialog').open && ${app}.runtime.linkTarget===null && document.activeElement.classList.contains('muze-solid-notebook-editor')`
  );
  assert(
    await run(
      page,
      `return ${app}.runtime.documents.blocks().some(b=>b.fragment.annotations.some(a=>a.tag.includes('https://example.org/selected')))`
    )
  );
  assert.equal(
    await run(
      page,
      `return ${app}.runtime.documents.blocks()[0].fragment.text`
    ),
    'First notebook'
  );
  const length = await run(
    page,
    `return ${app}.runtime.blocks.view.current[0].fragment.text.length`
  );
  await caret(page, 0, length);
  await key(page, 'k', 'KeyK', 75, 2);
  await until(page, `document.activeElement.name==='href'`);
  await page.send('Input.insertText', { text: 'https://example.org/inserted' });
  await key(page, 'Enter', 'Enter', 13);
  await until(
    page,
    `!document.querySelector('.muze-solid-notebook-link-dialog').open && !${app}.runtime.busy && ${app}.runtime.linkTarget===null && document.activeElement.classList.contains('muze-solid-notebook-editor')`
  );
  assert(
    await run(
      page,
      `return ${app}.runtime.blocks.view.current[0].fragment.text.endsWith('https://example.org/inserted')`
    )
  );
  console.log(
    'PASS: Ctrl+K native link dialog, cancel, rejected address preservation, selected-text link and caret insertion with editing focus restored.'
  );
}

try {
  chrome = await startChrome(origin + '/seed', { allowPopups: true });
  const page = await chrome.page();
  await page.ready();
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      'window.notebookErrors=[];addEventListener("error",event=>notebookErrors.push(event.error?.stack||event.message));'
  });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  const started = Date.now();
  await run(
    page,
    'localStorage.setItem("solid-apps.webId",location.origin+"/profile#me");location.href="/notebook/"'
  );
  await until(page, `${app}?.runtime.editors.size===2`);
  await until(
    page,
    `document.activeElement===${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id).element`
  );
  await type(page, 'First notebook');
  console.log('Cold usable Notebook', {
    milliseconds: Date.now() - started,
    ...(await run(
      page,
      `const e=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')];return {bytes:e.reduce((sum,x)=>sum+x.transferSize,0),requests:e.length};`
    ))
  });
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await verifyNotebookChrome(page);
  await verifyTitleCursor(page);
  await verifyTitleSplit(page);
  await verifyNotebookBold(page);
  await verifyFormattingStability(page);
  await verifyBlockTools(page);
  await verifyNotebookLinks(page);
  const composingId = await run(page, `return ${app}.runtime.documents.id`);
  await run(
    page,
    `const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);e.focus(0);`
  );
  await page.send('Input.imeSetComposition', {
    text: '日',
    selectionStart: 1,
    selectionEnd: 1
  });
  // Keep provisional IME focus: a real pointer blur can commit composition
  // before the command, which correctly permits the document transition.
  await run(
    page,
    `document.querySelector('[data-muze-solid-action="muzeSolidNotebookNew"]').click()`
  );
  assert.equal(
    await run(page, `return ${app}.runtime.documents.id`),
    composingId
  );
  assert(
    await run(
      page,
      `return ${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id).isComposing()`
    )
  );
  await page.send('Input.imeSetComposition', {
    text: '',
    selectionStart: 0,
    selectionEnd: 0
  });
  await verifyNotebookInteractions(page);
  const firstId = await run(page, `return ${app}.runtime.documents.id`);
  await caret(
    page,
    0,
    await run(
      page,
      `return ${app}.runtime.blocks.view.current[0].fragment.text.length`
    )
  );
  await key(page, 'Enter', 'Enter', 13);
  await until(page, `${app}.runtime.editors.size===3 && !${app}.runtime.busy`);
  await type(page, 'Second block', 1);
  await caret(page, 1, 0);
  await key(page, 'Backspace', 'Backspace', 8);
  await until(page, `${app}.runtime.editors.size===2`);
  assert.match(
    await run(
      page,
      `return ${app}.runtime.blocks.view.current[0].fragment.text`
    ),
    /First notebook.*Second block/s
  );
  await run(
    page,
    `const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);e.focus(5);${app}.runtime.range={start:5,end:5};`
  );
  await caret(page, 0, 5);
  await key(page, 'Enter', 'Enter', 13);
  await until(page, `${app}.runtime.editors.size===3`);
  await documentOperation(page, 'Save', '/storage/first.ttl');
  await until(
    page,
    `document.querySelector('[data-muze-solid-action="muzeSolidNotebookStatus"] use').getAttribute('href').endsWith('#check-circle')`
  );
  assert.equal(writes[0]['if-none-match'], '*');
  assert(pods.get('/storage/first.ttl').text.includes('First'));
  await verifyPickerPreservation(page);
  await click(page, 'New');
  assert.equal(await run(page, 'return document.title'), 'Untitled notebook');
  await type(page, 'Different document');
  await documentOperation(page, 'SaveAs', '/storage/second.ttl');
  assert.equal(pods.size, 2);
  await documentOperation(page, 'SaveAs', '/storage/projects/third.ttl');
  assert.match(
    pods.get('/storage/projects/third.ttl').text,
    /Different document/
  );
  await verifySaveDestinationRace(page);
  await documentOperation(page, 'Open', '/storage/first.ttl');
  await until(page, `${app}.runtime.editors.size===3`);
  assert.equal(
    await run(page, 'return document.title'),
    'Field notes <2026> & ideas'
  );
  assert.match(
    await run(
      page,
      `return ${app}.runtime.blocks.view.current[0].fragment.text`
    ),
    /First/
  );
  await type(page, 'Conflict retained');
  pods.get('/storage/first.ttl').etag = '"changed"';
  await click(page, 'Save');
  await until(
    page,
    `document.querySelector('[data-muze-solid-action="muzeSolidNotebookStatus"] use').getAttribute('href').endsWith('#alert-triangle')`
  );
  assert.match(
    await run(page, `return ${app}.data.muzeSolidNotebookStatus`),
    /changed|412/i
  );
  await click(page, 'New');
  await openLocalDocument(page, firstId);
  await until(page, `${app}.runtime.documents.id===${JSON.stringify(firstId)}`);
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await type(page, 'Offline recovery');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  const previousPage = await run(page, 'return performance.timeOrigin');
  await run(page, 'location.reload()');
  await until(
    page,
    `performance.timeOrigin!==${previousPage} && ${app}?.runtime.editors.size>0`
  );
  await until(
    page,
    `${app}?.runtime.documents.blocks().some(b=>b.fragment.text==='Offline recovery')`
  );
  assert.equal(
    await run(page, 'return document.title'),
    'Field notes <2026> & ideas'
  );
  const blockCount = await run(page, `return ${app}.runtime.editors.size`);
  await run(
    page,
    `const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);e.focus(e.getLength());`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    modifiers: 2,
    windowsVirtualKeyCode: 13
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    modifiers: 2,
    windowsVirtualKeyCode: 13
  });
  await until(
    page,
    `${app}.runtime.editors.size===${blockCount + 1} && !${app}.runtime.busy`
  );
  await until(
    page,
    `(()=>{const e=${app}.runtime.editors.get(${app}.runtime.active);return e && e.element===document.activeElement && !e.element.closest('[inert]');})()`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'ArrowLeft',
    code: 'ArrowLeft',
    windowsVirtualKeyCode: 37
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'ArrowLeft',
    code: 'ArrowLeft',
    windowsVirtualKeyCode: 37
  });
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[0].id`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'ArrowRight',
    code: 'ArrowRight',
    windowsVirtualKeyCode: 39
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'ArrowRight',
    code: 'ArrowRight',
    windowsVirtualKeyCode: 39
  });
  await until(
    page,
    `${app}.runtime.active===${app}.runtime.blocks.view.current[1].id`
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Backspace',
    code: 'Backspace',
    windowsVirtualKeyCode: 8
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Backspace',
    code: 'Backspace',
    windowsVirtualKeyCode: 8
  });
  await until(
    page,
    `${app}.runtime.editors.size===${blockCount} && !${app}.runtime.busy`
  );
  await run(page, 'scrollTo(0,0)');
  await writeFile(
    '/tmp/notebook-phone.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  assert.equal(authoringRequests, 0);
  assert.deepEqual(await run(page, 'return window.notebookErrors'), []);
  assert(preferredPickerVisits >= 7);
  assert(
    await run(page, 'return document.documentElement.scrollWidth<=innerWidth')
  );
  const ax = await page.send('Accessibility.getFullAXTree');
  assert(
    ax.nodes.some(
      (n) =>
        n.role?.value === 'heading' &&
        n.name?.value === 'Notebook title' &&
        n.properties?.some(
          (property) =>
            property.name === 'editable' && property.value.value === 'richtext'
        )
    )
  );
  assert(
    ax.nodes.some(
      (n) => n.role?.value === 'textbox' && n.name?.value === 'Rich text block'
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await run(
    page,
    "document.body.classList.remove('ds-darkmode-auto');document.body.classList.add('ds-lightmode')"
  );
  await run(
    page,
    `const e=${app}.runtime.editors.get(${app}.runtime.blocks.view.current[0].id);e.focus(0,Math.min(5,e.getLength()))`
  );
  await until(
    page,
    `document.querySelector('.muze-solid-notebook-block-tools').checkVisibility({visibilityProperty:true})`
  );
  await run(
    page,
    `await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`
  );
  await writeFile(
    '/tmp/notebook-desktop.png',
    Buffer.from((await page.send('Page.captureScreenshot')).data, 'base64')
  );
  console.log(
    'PASS: Notebook native editing, blocks, separate documents, New/Open/Save As, conditional conflict, local offline reload and optional-source isolation.'
  );
} finally {
  await chrome?.close();
  await new Promise((resolve) => server.close(resolve));
}
