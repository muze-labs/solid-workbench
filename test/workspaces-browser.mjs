import assert from 'node:assert/strict';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome, formatBrowserException } from './support/chrome.mjs';

const records = new Map();
const writes = [];
const binaryTypes = new Map();
const testImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPQDZ0GAAHLARkOVeqpAAAAAElFTkSuQmCC',
  'base64'
);
await writeFile('/tmp/cycle100-background.png', testImage);
records.set('/fixture/custom-background.png', testImage);
binaryTypes.set('/fixture/custom-background.png', 'image/png');
let origin;
let version = 1;
let profileStatus = 200;
const server = http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url, origin).pathname;
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const contentType = request.headers['content-type'] || '';
      const body = contentType.startsWith('image/')
        ? Buffer.concat(chunks)
        : Buffer.concat(chunks).toString();
      if (contentType.startsWith('image/')) {
        binaryTypes.set(path, contentType);
      }
      writes.push({
        path,
        body,
        condition:
          request.headers['if-match'] || request.headers['if-none-match']
      });
      records.set(path, body);
      response.writeHead(201, { ETag: '"' + ++version + '"' }).end();
      return;
    }
    if (path === '/fixture/profile') {
      if (profileStatus !== 200) {
        response.writeHead(profileStatus).end();
        return;
      }
      response.setHeader('Content-Type', 'text/turtle');
      response.end(`<${origin}/fixture/profile#me>
        <http://xmlns.com/foaf/0.1/name> "Workspace fixture";
        <http://www.w3.org/ns/pim/space#preferencesFile> <${origin}/fixture/prefs>;
        <http://www.w3.org/ns/pim/space#storage> <${origin}/fixture/storage/>, <${origin}/fixture/second/>.`);
      return;
    }
    if (path === '/fixture/prefs') {
      response.writeHead(200, {
        'Content-Type': 'text/turtle',
        ETag: '"prefs"'
      });
      response.end(`<#solid-apps>
        <https://vocab.muze.nl/solid-apps#workspaceResource> <${origin}/fixture/workspace.ttl>;
        <https://vocab.muze.nl/solid-apps#launcherResource> <${origin}/fixture/shortcuts.ttl>;
        <https://vocab.muze.nl/solid-apps#contactsResource> <${origin}/fixture/contacts.ttl>.
        <#other> <https://example.test/unknown> "keep global preferences".`);
      return;
    }
    if (path === '/fixture/contacts.ttl') {
      response.writeHead(200, {
        'Content-Type': 'text/turtle',
        ETag: '"book"'
      });
      response.end(
        '<#person> a <http://www.w3.org/2006/vcard/ns#Individual>; <http://www.w3.org/2006/vcard/ns#fn> "Existing default book".'
      );
      return;
    }
    if (path.startsWith('/fixture/')) {
      const body = path.endsWith('/')
        ? `<${origin}${path}> a <http://www.w3.org/ns/ldp#BasicContainer>.`
        : records.get(path);
      if (body === undefined) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(200, {
          'Content-Type': binaryTypes.get(path) || 'text/turtle',
          ETag: '"' + version + '"'
        })
        .end(body);
      return;
    }
    if (path === '/seed') {
      response.end('<!doctype html><title>Seed</title>');
      return;
    }
    const file = new URL(
      '../www' + path + (path.endsWith('/') ? 'index.html' : ''),
      import.meta.url
    );
    const content = await readFile(file);
    const type = path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.svg')
          ? 'image/svg+xml'
          : path.endsWith('.jpg')
            ? 'image/jpeg'
            : path.endsWith('.ttl')
              ? 'text/turtle'
              : 'text/html';
    response
      .writeHead(200, {
        'Content-Type': type,
        'Content-Encoding': 'gzip'
      })
      .end(gzipSync(content));
  }
  catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const browser = await startChrome(origin + '/seed', { allowPopups: true });
const page = await browser.page();
let appPage;
async function run(code, target = page) {
  const result = await target.send('Runtime.evaluate', {
    expression: '(async()=>{' + code + '})()',
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(formatBrowserException(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(code, target = page) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await run('return Boolean(' + code + ');', target)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(
    'workspaces-browser: Timed out: ' +
      code +
      '\n' +
      (await run('return document.body.innerText;', target))
  );
}
async function click(selector, target = page) {
  await run(
    'for(const dialog of document.querySelectorAll("dialog[open]")){await Promise.all(dialog.getAnimations().map(animation=>animation.finished.catch(()=>{})));}',
    target
  );
  await wait(
    'document.querySelector(' +
      JSON.stringify(selector) +
      ') && !document.querySelector(' +
      JSON.stringify(selector) +
      ').matches(":disabled")',
    target
  );
  const point = await run(
    'const element=document.querySelector(' +
      JSON.stringify(selector) +
      ');element.scrollIntoView({block:"center"}); const r=element.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};',
    target
  );
  await target.send('Page.bringToFront');
  for (const type of ['mousePressed', 'mouseReleased']) {
    await target.send('Input.dispatchMouseEvent', {
      type,
      button: 'left',
      clickCount: 1,
      ...point
    });
  }
}
async function preferences() {
  await click('.account-button');
  await click('[data-simply-command=preferences]');
  await wait('document.querySelector(".preferences-dialog").open');
}
async function closePreferences() {
  await run(
    'await solidLauncher.host.preferenceView.actions.muzeSolidDesignCloseDialog(document.querySelector(".preferences-dialog"));'
  );
}
async function dismissPreferenceNotice() {
  if (await run('return !document.querySelector(".preferences-dialog .muze-solid-design-toast").hidden;')) {
    await click('.preferences-dialog [aria-label="Dismiss notification"]');
    await wait('document.querySelector(".preferences-dialog .muze-solid-design-toast").hidden');
  }
}
async function chooseSelectOption(selector, value) {
  const index = await run(
    'return [...document.querySelector(' + JSON.stringify(selector) + ').options].findIndex(option=>option.value===' + JSON.stringify(value) + ');'
  );
  assert(index >= 0);
  await click(selector);
  const steps = [
    ['Home', 36], ...Array.from({length:index},()=>['ArrowDown',40]), ['Enter',13]
  ];
  for (const [key, keyCode] of steps) {
    await page.send('Input.dispatchKeyEvent', {
      type:'keyDown', key, code:key, windowsVirtualKeyCode:keyCode,
      ...(key==='Enter' ? {text:'\r',unmodifiedText:'\r'} : {})
    });
    await page.send('Input.dispatchKeyEvent', {
      type:'keyUp', key, code:key, windowsVirtualKeyCode:keyCode
    });
  }
  await wait('document.querySelector(' + JSON.stringify(selector) + ').value===' + JSON.stringify(value));
}
async function switchWorkspace(title) {
  await click('.account-button');
  const selector = await run(
    'const buttons=[...document.querySelectorAll(".swb-workspace-menu button")]; return ".swb-workspace-menu li:nth-of-type("+(buttons.findIndex(button=>button.textContent.trim()===' +
      JSON.stringify(title) +
      ')+1)+") button";'
  );
  await click(selector);
  await wait(
    'solidLauncher.persistence.snapshot.directory.entries.find(entry=>entry.id===solidLauncher.persistence.snapshot.directory.active).title===' +
      JSON.stringify(title) +
      ' && !solidLauncher.ui.runtime.workspaceBusy'
  );
}
try {
  await page.ready();
  await page.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme',value:'dark'}]});
  await run(
    'localStorage.setItem("solid-apps.webId",' +
      JSON.stringify(origin + '/fixture/profile#me') +
      ');'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false
  });
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  await page.send('Page.navigate', { url: origin + '/workbench/' });
  await wait(
    'window.solidLauncher?.store && solidLauncher.ui.data.shortcuts.length===2'
  );
  assert.equal(
    await run('return document.querySelector(".swb-diagnostics").open;'),
    false
  );
  assert.equal(await run('return document.querySelectorAll("h1").length;'), 1);
  assert.equal(
    await run('return document.querySelector(".swb-workspace-menu").hidden;'),
    true
  );
  assert.equal(
    await run(
      'return document.querySelectorAll(".swb-launcher-grid details").length;'
    ),
    0
  );
  assert.equal(
    await run('return document.querySelector(".swb-add-shortcut svg")!==null;'),
    true
  );
  assert.equal(
    await run(
      'return document.querySelector(".swb-diagnostics").contains(document.querySelector("[data-simply-command=saveWorkspace]"));'
    ),
    true
  );
  assert.equal(
    await run('return document.documentElement.scrollWidth<=innerWidth;'),
    true
  );
  await wait(
    'document.querySelectorAll(".swb-shortcut-list a svg:not([hidden]) use").length===2 && [...document.querySelectorAll(".swb-shortcut-list a svg:not([hidden]) use")].every(icon=>icon.getBBox().width>0)'
  );
  console.log(
    'Cold phone home with both storage shortcuts and images, gzip, 50 KiB/s down, 25 KiB/s up, 150ms latency:',
    await run(
      'const navigation=performance.getEntriesByType("navigation")[0];' +
        'const resources=performance.getEntriesByType("resource");' +
        'return {usableMilliseconds:Math.round(performance.now()),' +
        'transferBytes:navigation.transferSize+resources.reduce((sum,entry)=>sum+entry.transferSize,0),' +
        'requests:resources.length+1};'
    )
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await writeFile(
    '/tmp/cycle100-workspace-home-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert.equal(
    await run(
      'return [...document.querySelectorAll(".swb-launcher-grid a")].every(link=>link.getBoundingClientRect().width>=100);'
    ),
    true
  );
  await writeFile(
    '/tmp/cycle100-workspace-home-desktop.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert.deepEqual(
    await run(
      'return solidLauncher.ui.data.shortcuts.map(row=>solidLauncher.ui.api.parseLaunchUrl(row.link.href).context.resource).sort();'
    ),
    [origin + '/fixture/storage/', origin + '/fixture/second/'].sort()
  );
  await click('.swb-shortcut-list li:first-of-type .swb-shortcut-settings');
  await wait(
    'document.querySelector(".muze-solid-launcher-shortcut-settings").open'
  );
  await run(
    'document.querySelector(".muze-solid-launcher-shortcut-settings [name=swb_shortcutName]").value="Personal files";'
  );
  await click(
    '.muze-solid-launcher-shortcut-settings [data-simply-command=swb_editShortcut]'
  );
  await wait(
    '!document.querySelector(".muze-solid-launcher-shortcut-settings").open && solidLauncher.ui.data.shortcuts.some(row=>row.label==="Personal files")'
  );
  const defaultBook = await run(
    'return solidLauncher.persistence.snapshot.directory.entries[0].settings.contactsResource;'
  );
  await preferences();
  await wait(
    'document.querySelector("[data-simply-command=swb_deleteWorkspace]").disabled'
  );
  await chooseSelectOption('[name=swb_backgroundChoice]', 'bg2');
  await click('[data-simply-command=swb_saveBackground]');
  await wait(
    'solidLauncher.persistence.snapshot.directory.entries[0].background?.endsWith(":bg2") && !solidLauncher.ui.runtime.workspaceBusy'
  );
  await wait(
    'document.querySelector(".swb-launcher-background").naturalWidth>0'
  );
  await run(
    'document.querySelector("[name=swb_newWorkspace]").value="Preferences";'
  );
  await click('[data-simply-command=swb_createWorkspace]');
  await wait(
    'solidLauncher.persistence.snapshot.directory.entries.length===2 && !solidLauncher.ui.runtime.workspaceBusy'
  );
  const workId = await run(
    'return solidLauncher.persistence.snapshot.directory.entries[1].id;'
  );
  assert.equal(
    await run(
      'return solidLauncher.persistence.snapshot.directory.entries[1].settings.contactsResource;'
    ),
    defaultBook
  );
  await closePreferences();
  const homePresentation = await run(`
    const surfaces=[document.querySelector('.suite-header'),
      document.querySelector('h1'), document.querySelector('.swb-shortcut-list li'),
      document.querySelector('.swb-add-shortcut'),document.querySelector('.swb-shortcut-settings')];
    const picture=document.querySelector('.swb-launcher-background').getBoundingClientRect();
    return {backgrounds:surfaces.map(element=>getComputedStyle(element).backgroundColor),
      titleShadow:getComputedStyle(document.querySelector('h1')).textShadow,
      labelShadow:getComputedStyle(document.querySelector('.swb-shortcut-list a')).textShadow,
      iconShadow:getComputedStyle(document.querySelector('.swb-app-icon')).filter,
      markerBackground:getComputedStyle(document.querySelector('.account-button')).backgroundColor,
      markerShape:getComputedStyle(document.querySelector('.account-button')).clipPath,
      icons:[...document.querySelectorAll('.swb-launcher-grid .swb-app-icon, .swb-launcher-grid img')]
        .filter(icon=>getComputedStyle(icon).display!=='none')
        .map(icon=>({background:getComputedStyle(icon).backgroundColor,
          padding:parseFloat(getComputedStyle(icon).paddingTop),
          separateFromLabel:icon.getBoundingClientRect().bottom<=icon.parentElement.querySelector(':scope > span').getBoundingClientRect().top})),
      imageCoversViewport:picture.x===0 && picture.y===0 && picture.width===innerWidth && picture.height===innerHeight};
  `);
  assert(homePresentation.backgrounds.every(color=>color==='rgba(0, 0, 0, 0)'));
  assert.notEqual(homePresentation.titleShadow,'none');
  assert.notEqual(homePresentation.labelShadow,'none');
  assert.notEqual(homePresentation.iconShadow,'none');
  assert.equal(homePresentation.imageCoversViewport,true);
  assert.notEqual(homePresentation.markerBackground,'rgba(0, 0, 0, 0)');
  assert.notEqual(homePresentation.markerShape,'none');
  assert.equal(homePresentation.icons.length,3);
  assert(homePresentation.icons.every(icon=>icon.background!=='rgba(0, 0, 0, 0)' && icon.padding>0 && icon.separateFromLabel));

  await run('await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));');
  await writeFile(
    '/tmp/cycle100-background-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await wait('document.activeElement===document.querySelector(".swb-shortcut-list a") && document.activeElement.matches(":focus-visible")');
  const focusStyle=await run('const style=getComputedStyle(document.activeElement);return {outline:style.outlineStyle,width:style.outlineWidth,shadow:style.boxShadow};');
  assert.equal(focusStyle.outline,'solid');
  assert.equal(focusStyle.width,'2px');
  assert.notEqual(focusStyle.shadow,'none');
  await preferences();
  await chooseSelectOption('[name=swb_backgroundChoice]', 'bg6');
  await click('[data-simply-command=swb_saveBackground]');
  await wait('solidLauncher.persistence.snapshot.directory.entries[0].background?.endsWith(":bg6") && document.querySelector(".swb-launcher-background").currentSrc===solidLauncher.ui.data.swb_background.src && document.querySelector(".swb-launcher-background").naturalWidth>0 && !solidLauncher.ui.runtime.workspaceBusy');
  await closePreferences();
  await run('await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));');
  await writeFile('/tmp/cycle100-background-photo6-phone.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await writeFile('/tmp/cycle100-background-photo6-desktop.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await preferences();
  await chooseSelectOption('[name=swb_backgroundChoice]', 'bg2');
  await click('[data-simply-command=swb_saveBackground]');
  await wait('solidLauncher.persistence.snapshot.directory.entries[0].background?.endsWith(":bg2") && !solidLauncher.ui.runtime.workspaceBusy');
  await closePreferences();
  const homeText = () => run(`
    const title=getComputedStyle(document.querySelector('h1'));
    const label=getComputedStyle(document.querySelector('.swb-shortcut-list a'));
    const add=getComputedStyle(document.querySelector('.swb-add-shortcut'));
    const glyph=getComputedStyle(document.querySelector('.swb-app-icon'));
    const marker=getComputedStyle(document.querySelector('.account-button'));
    return {color:title.color,shadow:title.textShadow,labelColor:label.color,
      labelShadow:label.textShadow,addColor:add.color,addShadow:add.textShadow,
      glyphColor:glyph.color,markerColor:marker.color};
  `);
  await preferences();
  await chooseSelectOption('[name=theme]', 'light');
  await dismissPreferenceNotice();
  await click('.preferences-dialog footer .ds-button-primary');
  await wait('document.body.classList.contains("ds-lightmode") && !solidLauncher.host.preferenceView.data.buttons.disabled');
  await closePreferences();
  const lightText = await homeText();
  assert.equal(lightText.color,'rgb(0, 0, 0)');
  assert.equal(lightText.labelColor,lightText.color);
  assert.equal(lightText.addColor,lightText.color);
  assert.equal(lightText.shadow,'none');
  assert.equal(lightText.labelShadow,'none');
  assert.equal(lightText.addShadow,'none');
  assert.equal(lightText.glyphColor,'rgb(255, 255, 255)');
  assert.equal(lightText.markerColor,'rgb(255, 255, 255)');
  await run('await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));');
  await writeFile('/tmp/cycle100-background-light-mode-phone.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await page.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme',value:'light'}]});
  await preferences();
  await chooseSelectOption('[name=theme]', 'dark');
  await dismissPreferenceNotice();
  await click('.preferences-dialog footer .ds-button-primary');
  await wait('document.body.classList.contains("ds-darkmode") && !solidLauncher.host.preferenceView.data.buttons.disabled');
  await closePreferences();
  const darkText = await homeText();
  assert.equal(darkText.color,'rgb(255, 255, 255)');
  assert.notEqual(darkText.shadow,'none');
  await preferences();
  await chooseSelectOption('[name=theme]', 'system');
  await dismissPreferenceNotice();
  await click('.preferences-dialog footer .ds-button-primary');
  await wait('document.body.classList.contains("ds-darkmode-auto") && !solidLauncher.host.preferenceView.data.buttons.disabled');
  await closePreferences();
  assert.equal((await homeText()).shadow,'none');
  assert.equal((await homeText()).color,'rgb(0, 0, 0)');
  await page.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme',value:'dark'}]});
  assert.notEqual((await homeText()).shadow,'none');
  assert.equal((await homeText()).color,'rgb(255, 255, 255)');
  await click('.account-button');
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
  await wait(
    'document.activeElement?.textContent.trim()==="WebID / connection"'
  );
  const menuItems = await run(
    'return [...document.querySelectorAll("#muze-solid-ui-account-menu .ds-dropdown-link")].map(button=>button.textContent.trim());'
  );
  assert.deepEqual(menuItems, [
    'WebID / connection',
    'Preferences',
    'Solid Workbench',
    'Preferences'
  ]);
  assert.equal(
    await run(
      'return document.querySelectorAll(".swb-workspace-menu button")[1].getAttribute("aria-label");'
    ),
    'Switch to workspace: Preferences'
  );
  await writeFile(
    '/tmp/cycle100-background-menu.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );

  assert.equal(
    await run(
      'return document.querySelectorAll(".swb-workspace-menu button svg use[href$=layers]").length;'
    ),
    2
  );
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
  await wait('document.activeElement?.dataset.simplyCommand==="preferences"');
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
  await wait(
    'document.activeElement?.closest(".swb-workspace-menu") && document.activeElement.textContent.trim()==="Preferences"'
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r',
    unmodifiedText: '\r'
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await wait(
    'solidLauncher.persistence.snapshot.directory.active===' +
      JSON.stringify(workId) +
      ' && !solidLauncher.ui.runtime.workspaceBusy'
  );
  assert.equal(await run('return solidLauncher.ui.data.shortcuts.length;'), 2);
  assert.equal(
    await run(
      'return document.querySelector(".swb-launcher-background").hidden;'
    ),
    true
  );
  await preferences();
  assert.equal(
    await run(
      'return [...document.querySelectorAll("[data-simply-command=swb_deleteWorkspace]")].every(button=>button.disabled);'
    ),
    true
  );
  await run(
    'document.querySelector("[name=swb_workspaceStorage]").value=' +
      JSON.stringify(origin + '/fixture/private/') +
      ';'
  );
  await click('[data-simply-command=swb_saveWorkspaceSettings]');
  await wait(
    'solidLauncher.persistence.snapshot.directory.entries[1].storage.length===1 && !solidLauncher.ui.runtime.workspaceBusy'
  );
  await closePreferences();
  // A manifest-only shortcut is a real ordinary UI path, not a metadata-only test.
  await click('[data-simply-command=muzeSolidLauncherAddDialog]');
  await run(
    'document.querySelector(".muze-solid-launcher-add-dialog [name=manifest]").value=' +
      JSON.stringify(origin + '/contacts/manifest.ttl') +
      ';'
  );
  await click(
    '.muze-solid-launcher-add-dialog button[type=submit], .muze-solid-launcher-add-dialog footer button:first-child'
  );
  await wait(
    'solidLauncher.ui.data.shortcuts.some(row=>row.label==="Contacts") && !document.querySelector(".muze-solid-launcher-add-dialog").open'
  );
  const original = await run(
    'return solidLauncher.persistence.snapshot.directory.active;'
  );
  await switchWorkspace('Solid Workbench');
  assert.equal(
    await run(
      'return solidLauncher.ui.data.shortcuts.some(row=>row.label==="Contacts");'
    ),
    false
  );
  await switchWorkspace('Preferences');
  await wait('solidLauncher.ui.data.shortcuts.length===4');
  const rowId = await run(
    'return solidLauncher.ui.data.shortcuts.find(row=>row.label==="Contacts").id;'
  );
  // Launch Contacts with a browser gesture and wait for the private context.
  const link = await run(
    'const links=[...document.querySelectorAll(".swb-launcher-grid a")];return ".swb-launcher-grid li:nth-of-type("+(links.findIndex(link=>link.textContent.trim()==="Contacts")+1)+") a";'
  );
  await page.send('Target.setDiscoverTargets', { discover: true });
  const created = page.once('Target.targetCreated');
  await click(link);
  const target = await created;
  appPage = await browser.page(target.targetInfo.targetId);
  await appPage.ready();
  await wait('window.solidContacts?.host.managed?.ready', appPage);
  assert.equal(
    await run('return document.hasFocus();', appPage),
    true,
    'An explicit shortcut launch still focuses the selected app.'
  );
  assert.equal(
    await run('return solidContacts.host.workspaceContext.id;', appPage),
    original
  );
  assert.equal(
    await run(
      'return solidContacts.host.workspaceContext.settings.contactsResource;',
      appPage
    ),
    defaultBook
  );
  await click('[data-simply-command=newContact]', appPage);
  await wait('document.querySelector(".new-contact-dialog").open', appPage);
  await run(
    'document.querySelector(".new-contact-dialog [name=name]").value="Draft person"; document.querySelector(".new-contact-dialog form").requestSubmit();',
    appPage
  );
  await wait(
    'document.querySelector(".profile-card h2")?.textContent==="Draft person"',
    appPage
  );
  await click('[data-simply-command=editProfile]', appPage);
  await wait('!document.querySelector(".profile-card form").hidden', appPage);
  await run(
    'const input=document.querySelector(".profile-card [name=notes]");input.value="Unsaved Work draft";input.dispatchEvent(new Event("input",{bubbles:true}));',
    appPage
  );
  await wait(
    'solidContacts.ui.runtime.widget.draft()?.values.notes==="Unsaved Work draft"',
    appPage
  );
  await click(link);
  await wait(
    '[...solidLauncher.workspace.instances.values()].filter(record=>record.ready).length===2'
  );
  await switchWorkspace('Solid Workbench');
  appPage.close();
  appPage = null;
  const restoredTarget = page.once('Target.targetCreated');
  await switchWorkspace('Preferences');
  const restoredInfo = await restoredTarget;
  appPage = await browser.page(restoredInfo.targetInfo.targetId);
  await appPage.ready();
  await wait('window.solidContacts?.host.managed?.ready', appPage);
  await wait(
    'document.querySelector(".profile-card [name=notes]")?.value==="Unsaved Work draft"',
    appPage
  );
  await wait(
    '[...solidLauncher.workspace.instances.values()].filter(record=>record.ready).length===2'
  );
  // Restore the app set and its native draft; popup blocking remains a visible recovery path.
  await wait('solidLauncher.workspace.instances.size===2');
  assert.match(
    await run(
      'return solidLauncher.persistence.snapshot.directory.entries.find(entry=>entry.id==="default").title;'
    ),
    /Solid Workbench/
  );
  const reloaded = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await reloaded;
  await page.ready();
  await wait(
    'window.solidLauncher?.persistence.snapshot.directory.active===' +
      JSON.stringify(workId)
  );
  await wait(
    'solidLauncher.ui.data.shortcuts.some(row=>row.id===' +
      JSON.stringify(rowId) +
      ')'
  );
  await switchWorkspace('Solid Workbench');
  await preferences();
  await wait(
    '!document.querySelectorAll("[data-simply-command=swb_deleteWorkspace]")[1].disabled'
  );
  await click(
    '.swb-workspace-management li:nth-of-type(2) [data-simply-command=swb_deleteWorkspace]'
  );
  await wait('solidLauncher.persistence.snapshot.directory.entries.length===1');
  await run(
    'document.querySelector("[name=swb_backgroundChoice]").value="url";document.querySelector("[name=swb_backgroundUrl]").value=' +
      JSON.stringify(origin + '/fixture/custom-background.png') +
      ';'
  );
  await click('[data-simply-command=swb_saveBackground]');
  await wait(
    'document.querySelector(".swb-launcher-background").naturalWidth===1 && !solidLauncher.ui.runtime.workspaceBusy'
  );
  const documentTree = await page.send('DOM.getDocument');
  const fileInput = await page.send('DOM.querySelector', {
    nodeId: documentTree.root.nodeId,
    selector: '[name=swb_backgroundFile]'
  });
  await page.send('DOM.setFileInputFiles', {
    nodeId: fileInput.nodeId,
    files: ['/tmp/cycle100-background.png']
  });
  await click('[data-simply-command=swb_uploadBackground]');
  await wait(
    'solidLauncher.persistence.snapshot.directory.entries[0].background?.startsWith("urn:uuid:") && !solidLauncher.ui.runtime.workspaceBusy'
  );
  assert.equal(
    writes.some((write) => binaryTypes.has(write.path)),
    false,
    'File selection stays local until Save to Pod.'
  );
  const pendingImage = await run(
    'return solidLauncher.persistence.snapshot.directory.entries[0].background;'
  );
  await closePreferences();
  const pendingReload = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await pendingReload;
  await wait(
    'window.solidLauncher?.store && document.querySelector(".swb-launcher-background").naturalWidth===1'
  );
  assert.equal(
    await run(
      'return solidLauncher.persistence.snapshot.directory.entries[0].background;'
    ),
    pendingImage
  );
  await preferences();

  await run(
    'const legacy=await solidLauncher.ui.api.openCollection("launcher");await legacy.collection.create({id:"urn:fixture:legacy",a:solidLauncher.ui.api.prefixes.schema+"SoftwareApplication",schema$name:"Recovered shortcut",schema$url:{id:"https://example.test/"},"https://example.test/unknown":"keep imported RDF"});document.querySelector(".swb-workspace-management details").open=true;'
  );
  await click('[data-simply-command=swb_recoverShortcuts]');
  await wait(
    'solidLauncher.ui.data.shortcuts.some(row=>row.id==="urn:fixture:legacy") && !solidLauncher.ui.runtime.workspaceBusy'
  );
  assert.match(
    await run(
      'return await solidLauncher.store.service.workspace.graph("launcher").write();'
    ),
    /keep imported RDF/
  );
  assert.equal(
    await run(
      'return (await solidLauncher.ui.api.openCollection("launcher")).collection.list().some(node=>node.id==="urn:fixture:legacy");'
    ),
    true
  );
  await closePreferences();
  await preferences();
  await click('[data-simply-command=swb_openDiagnostics]');
  await wait(
    'document.querySelector(".swb-diagnostics").open && !document.querySelector(".preferences-dialog").open'
  );
  await click('[data-simply-command=saveWorkspace]');
  await wait(
    'solidLauncher.persistence.dirty===false && !solidLauncher.ui.runtime.workspaceBusy'
  );
  assert(
    writes.some(
      (write) => write.path === '/fixture/workspace.ttl' && write.condition
    )
  );
  assert(writes.some((write) => write.path === '/fixture/shortcuts.ttl'));
  assert(
    writes.some(
      (write) => binaryTypes.has(write.path) && write.condition === '*'
    ),
    'Background upload is a conditional creation.'
  );
  assert.match(
    await run(
      'return solidLauncher.persistence.snapshot.directory.entries[0].background;'
    ),
    /background-.*\.png$/
  );

  assert.equal(
    writes.some((write) => write.path === '/fixture/contacts.ttl'),
    false
  );
  assert.equal(
    writes.some((write) => write.path === '/fixture/profile'),
    false
  );
  await writeFile(
    '/tmp/cycle100-workspace-phone.png',
    Buffer.from(
      (await page.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64'
    )
  );
  await click('[aria-label="Close diagnostics"]');
  await wait('!document.querySelector(".swb-diagnostics").open');
  profileStatus = 503;
  const offlineReload = page.once('Page.loadEventFired');
  await page.send('Page.reload');
  await offlineReload;
  await wait('document.querySelector(".swb-launcher-background")?.naturalWidth===1');
  await wait(
    'window.solidLauncher?.store && solidLauncher.ui.data.shortcuts.some(row=>row.id==="urn:fixture:legacy")'
  );
  assert.equal(
    await run('return solidLauncher.persistence.owner;'),
    origin + '/fixture/profile#me'
  );
  await preferences();
  await run(
    'document.querySelector("[name=swb_newWorkspace]").value="Offline workspace";'
  );
  await click('[data-simply-command=swb_createWorkspace]');
  await wait(
    'solidLauncher.persistence.snapshot.directory.entries.length===2 && !solidLauncher.ui.runtime.workspaceBusy'
  );
  await closePreferences();
  await switchWorkspace('Offline workspace');
  assert.equal(await run('return solidLauncher.ui.data.shortcuts.length;'), 2);
  await switchWorkspace('Solid Workbench');
  profileStatus = 200;
  // A separate browser has no IndexedDB or HTTP cache from the first one.
  const fresh = await startChrome(origin + '/seed');
  const freshPage = await fresh.page();
  try {
    await freshPage.ready();
    await run(
      'localStorage.setItem("solid-apps.webId",' +
        JSON.stringify(origin + '/fixture/profile#me') +
        ');',
      freshPage
    );
    await freshPage.send('Page.navigate', { url: origin + '/workbench/' });
    await wait(
      'window.solidLauncher?.store && solidLauncher.ui.data.shortcuts.some(row=>row.id==="urn:fixture:legacy")',
      freshPage
    );
    assert.equal(
      await run('return solidLauncher.persistence.dirty;', freshPage),
      false
    );
    await wait(
      'document.querySelector(".swb-launcher-background").naturalWidth===1',
      freshPage
    );
    records.delete('/fixture/workspace.ttl');
    const freshReload = freshPage.once('Page.loadEventFired');
    await freshPage.send('Page.reload');
    await freshReload;
    await wait(
      'window.solidLauncher?.store && solidLauncher.ui.data.shortcuts.length===2',
      freshPage
    );
    assert.equal(
      await run('return solidLauncher.ui.data.swb_workspaceTitle;', freshPage),
      'Solid Workbench'
    );
    assert(
      records.has('/fixture/shortcuts.ttl'),
      'external default deletion retains its linked shortcut data'
    );
    assert.match(
      await run(
        'return solidLauncher.persistence.localGraph.write();',
        freshPage
      ),
      /recoveredDefault/
    );
  }
  finally {
    freshPage.close();
    await fresh.close();
  }
  console.log(
    'PASS: phone home/icons, manifest shortcut, workspace Preferences/menu, private roots, scoped app context, switching/checkpoint, reload, scoped device recovery, fresh-browser restore, offline identity recovery and deletion protection.'
  );
}
catch (error) {
  console.error(
    await run(
      'return {message:document.body.innerText, directory:window.solidLauncher?.persistence.snapshot.directory, busy:window.solidLauncher?.ui.runtime.workspaceBusy, menu:[...document.querySelectorAll(".swb-workspace-menu button")].map(button=>({text:button.textContent,disabled:button.disabled}))};'
    ).catch(() => null)
  );
  throw error;
}
finally {
  appPage?.close();
  page.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
