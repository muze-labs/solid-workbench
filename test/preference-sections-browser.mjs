import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { startChrome } from './support/chrome.mjs';
const build = await rollup({
  input: new URL(
    '../packages/solid-app-data/src/workspace-broker.mjs',
    import.meta.url
  ).pathname,
  plugins: [nodeResolve({ browser: true })]
});
const bundle = (await build.generate({ format: 'es' })).output[0].code;
await build.close();
let origin;
let independent;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://fixture/').pathname;
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (path === '/broker.mjs') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundle);
      return;
    }
    if (path === '/capabilities.mjs') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(
        await readFile(
          new URL(
            '../packages/solid-app-data/src/capabilities.mjs',
            import.meta.url
          )
        )
      );
      return;
    }
    if (path === '/independent') {
      res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent settings caller</title>
      <style>iframe{width:100%;height:90vh;border:0}</style><button id="open">Open preferences</button><iframe title="Preferences"></iframe>
      <script type="module">
      import {WorkspaceBroker} from '/broker.mjs';
      import {editPreferencesCapability} from '/capabilities.mjs';
      const frame=document.querySelector('iframe');
      const broker=new WorkspaceBroker({embeddedProviders:[{capability:editPreferencesCapability,url:'${origin}/preferences/'}]});
      let ticket;
      addEventListener('message',event=>{
        if(event.source!==frame.contentWindow || event.origin!=='${origin}' || event.data?.type!=='solid-apps:embedded-ready')return;
        const channel=new MessageChannel();
        window.postMessage({type:'solid-apps:embed-port',...ticket},location.origin,[channel.port1]);
        frame.contentWindow.postMessage({type:'solid-apps:offer',...ticket,state:null},'${origin}',[channel.port2]);
      });
      document.querySelector('#open').onclick=()=>{
        ticket=broker.beginEmbedded('${origin}/preferences/?solid-apps-task',editPreferencesCapability);
        frame.src='${origin}/preferences/?solid-apps-task';
        broker.requestEmbedded(ticket.id,{owner:'',app:'independent-notes',sections:
          location.search.includes('empty') ? [] : [
          {id:'notes-settings',label:'Independent notes',url:'${independent}/'+
            (location.search.includes('missing') ? 'missing' : 'section')}
        ]}).catch(e=>document.body.dataset.error=e.message);
      };
      </script>`);
      return;
    }
    if (path === '/section') {
      res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;margin:16px;background:Canvas;color:CanvasText;color-scheme:light dark}input,button{font:inherit;max-width:100%;box-sizing:border-box}label{display:grid;gap:8px}button{margin-block:12px;padding:8px}</style><label>Example setting<input id="setting"></label>
      <button id="save">Save</button><p id="status"></p>
      <script type="module">
      import {ManagedApp} from '/capabilities.mjs';
      const input=document.querySelector('input');
      input.value=localStorage.getItem('section-draft')||'';
      let dirty=false,generation;
      input.oninput=()=>{dirty=true;localStorage.setItem('section-draft',input.value)};
      document.querySelector('button').onclick=()=>{dirty=false;document.querySelector('p').textContent='Saved'};
      const participant=new ManagedApp({capabilities:['https://vocab.muze.nl/capabilities/edit-preference-section'],
        onRequest:async event=>{generation=event.input.generation;document.body.dataset.ready='true';
          await participant.respond(event.id,{result:{version:1,generation,ready:true,presentation:'interactive-scroll'}})},
        onView:request=>{if(request.generation!==generation)throw Error('retired');
          if(request.operation==='prepare')return dirty?{allowed:false,message:'Save the independent draft first.'}:{allowed:true,frozen:true};
          return {ready:true}},canClose:()=>({allowed:!dirty}),getState:()=>null,restoreState:()=>{}});
      </script>`);
      return;
    }
    const file = new URL(
      '../www' + path + (path.endsWith('/') ? 'index.html' : ''),
      import.meta.url
    );
    const type = path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : 'text/html';
    res.setHeader('Content-Type', type);
    res.end(await readFile(file));
  }
  catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const independentServer = createServer(server.listeners('request')[0]);
await new Promise((resolve) =>
  independentServer.listen(0, '127.0.0.1', resolve)
);
independent = 'http://127.0.0.1:' + independentServer.address().port;
let browser, page;
async function frameContext(fragment) {
  const tree = (await page.send('Page.getFrameTree')).frameTree;
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    if (node.frame.url.includes(fragment)) {
      return (
        await page.send('Page.createIsolatedWorld', {
          frameId: node.frame.id,
          worldName: 'settings-test'
        })
      ).executionContextId;
    }
    pending.push(...(node.childFrames || []));
  }
}
async function run(expression, fragment) {
  const contextId = fragment ? await frameContext(fragment) : undefined;
  if (fragment && !contextId) {
    return undefined;
  }
  const result = await page.send('Runtime.evaluate', {
    expression,
    ...(contextId ? { contextId } : {}),
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}
async function wait(expression, fragment) {
  for (let n = 0; n < 700; n++) {
    if (await run('Boolean(' + expression + ')', fragment)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  console.log(await run('document.body.innerText', '/preferences/'));
  console.log(await run('document.body.dataset.error'));
  console.log(await run('JSON.stringify(document.body.dataset)', '/section'));
  throw Error(
    'Timed out: ' +
      expression +
      ' ' +
      fragment +
      '\n' +
      (await run('document.body.innerText', fragment))
  );
}
try {
  browser = await startChrome('about:blank');
  page = await browser.page();
  await page.ready();
  await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 50 * 1024,
    uploadThroughput: 25 * 1024
  });
  await page.send('Page.navigate', { url: origin + '/files/' });
  await wait('globalThis.muzeSolidFilesApp');
  await run(
    'document.querySelector("[data-simply-command=preferences]").click()'
  );
  await wait(
    'document.querySelector("[data-solid-section=files-storage]")',
    '/preferences/'
  );
  await run(
    'document.querySelector("[data-solid-section=files-storage]").click()',
    '/preferences/'
  );
  await wait(
    'document.querySelector("form") && !document.querySelector("form").inert',
    '/files/settings.html'
  );
  console.log('Cold Files -> Preferences -> usable settings, no-store, 50 KiB/s:',
    await run(`(() => {
      const entries=[];
      function collect(win) {
        entries.push(...win.performance.getEntriesByType('navigation'),
          ...win.performance.getEntriesByType('resource'));
        for (let i=0;i<win.frames.length;i++) { collect(win.frames[i]); }
      }
      collect(window);
      return {bytes:entries.reduce((sum,item)=>sum+item.transferSize,0),
        requests:entries.length,milliseconds:Math.round(performance.now())};
    })()`));
  await page.send('Network.emulateNetworkConditions', {
    offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1
  });
  for (const width of [390, 1280]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width, height: 844, deviceScaleFactor: 1, mobile: width === 390
    });
    await wait('document.querySelector(".swb-suite-header").getBoundingClientRect().height===0', '/preferences/');
    await run(`(() => {
      const ui=document.querySelector('.muze-solid-ui-capability-frame')
        .contentWindow.swbPreferencesApp.runtime.host.view;
      ui.data.message='Connection needs attention';
    })()`);
    await wait('document.querySelector(".swb-suite-status").getBoundingClientRect().height>0 && document.querySelector(".swb-suite-header").getBoundingClientRect().height>0', '/preferences/');
    await run(`(() => {
      const ui=document.querySelector('.muze-solid-ui-capability-frame')
        .contentWindow.swbPreferencesApp.runtime.host.view;
      ui.data.message='';
      ui.data.muzeSolidUiHeader['data-muze-solid-ui-header-layout']='compact';
      ui.data.muzeSolidUiAppTools=[{command:'probe',label:'Example action',
        attributes:{},icon:{href:'../assets/feather-icons.svg#check'}}];
      ui.data.muzeSolidUiAppToolbar={hidden:null};
    })()`);
    await wait('document.querySelector(".muze-solid-ui-app-toolbar button")?.getBoundingClientRect().height>=44 && document.querySelector(".swb-suite-header").getBoundingClientRect().height>=44', '/preferences/');
    await run(`(() => {
      const ui=document.querySelector('.muze-solid-ui-capability-frame')
        .contentWindow.swbPreferencesApp.runtime.host.view;
      ui.data.muzeSolidUiAppToolbar={hidden:''};
      ui.data.muzeSolidUiAppTools=[];
    })()`);
    await wait('document.querySelector(".swb-suite-header").getBoundingClientRect().height===0', '/preferences/');
    assert.equal(await run(`(() => {
      const dialog=document.querySelector('.muze-solid-ui-recovery-dialog');
      dialog.showModal();
      return dialog.matches(':modal') && dialog.getBoundingClientRect().height>0 &&
        dialog.contains(document.activeElement);
    })()`, '/preferences/'), true);
    await run('document.querySelector(".muze-solid-ui-recovery-dialog").close()', '/preferences/');
    await wait('document.querySelector(".swb-suite-header").getBoundingClientRect().height===0', '/preferences/');
    await run(`(() => {
      const ui=document.querySelector('.muze-solid-ui-capability-frame')
        .contentWindow.swbPreferencesApp.runtime.host.view;
      ui.data.muzeSolidUiHeader['data-muze-solid-ui-header-layout']=null;
    })()`);
  }
  console.log('PASS empty header occupies zero space; status, compact toolbar and recovery remain usable on phone/desktop');

  await run(
    `(()=>{const input=document.querySelector('input');input.value='${origin}/folder/';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    '/files/settings.html'
  );
  await wait(
    'document.body.innerText.includes("Saved on this device")',
    '/files/settings.html'
  );
  await run(
    'document.querySelector("[data-solid-section=appearance]").click()',
    '/preferences/'
  );
  await wait(
    'document.querySelector("[aria-current=page]").dataset.solidSection==="appearance"',
    '/preferences/'
  );
  await run(
    'document.querySelector("[data-solid-section=files-storage]").click()',
    '/preferences/'
  );
  await wait(
    `document.querySelector('input')?.value==='${origin}/folder/'`,
    '/files/settings.html'
  );
  console.log('PASS Files app-hosted settings save/reopen');
  await page.send('Page.navigate', { url: independent + '/independent' });
  await wait('document.querySelector("#open")?.onclick');
  await run('document.querySelector("#open").click()');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await wait(
    'document.querySelector("[data-solid-section=notes-settings]")',
    '/preferences/'
  );
  await run(
    'document.querySelector("[data-solid-section=notes-settings]").click()',
    '/preferences/'
  );
  await wait('document.body.dataset.ready==="true"', '/section');
  await run('document.querySelector("input").focus()', '/section');
  await page.send('Input.insertText', { text: 'Keep this draft' });
  await run(
    'document.querySelector("[data-solid-section=appearance]").click()',
    '/preferences/'
  );
  await wait(
    'document.body.innerText.includes("Save the independent draft first")',
    '/preferences/'
  );
  assert.equal(
    await run(
      'document.querySelector("[aria-current=page]").dataset.solidSection',
      '/preferences/'
    ),
    'notes-settings'
  );
  await run('document.querySelector("#save").click()', '/section');
  await run(
    'document.querySelector("[data-solid-section=appearance]").click()',
    '/preferences/'
  );
  await wait(
    'document.querySelector("[aria-current=page]").dataset.solidSection==="appearance"',
    '/preferences/'
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  const point = await run(`(() => {
    const button=document.querySelector('[data-solid-section=notes-settings]');
    button.scrollIntoView({block:'center'});
    const r=button.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`, '/preferences/');
  const offset = await run(`(() => {const r=document.querySelector('iframe').getBoundingClientRect();return {x:r.x,y:r.y}})()`);
  await page.send('Input.dispatchTouchEvent', { type:'touchStart',
    touchPoints:[{x:point.x+offset.x,y:point.y+offset.y}] });
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd',touchPoints:[] });
  await wait(
    'document.querySelector("#setting")?.value==="Keep this draft"',
    '/section'
  );
  await wait('document.body.dataset.ready==="true"', '/section');
  await wait(
    'document.querySelector("[data-simply-field=swb_sectionTitle]")?.textContent==="Independent notes" && document.querySelector(".muze-solid-preferences-contribution").getAttribute("aria-busy")==="false"',
    '/preferences/'
  );
  await wait('document.querySelector(".muze-solid-preferences-settings").getBoundingClientRect().left>=0 && document.querySelector(".muze-solid-preferences-settings").getBoundingClientRect().left<innerWidth/2', '/preferences/');
  const screenshot = await page.send('Page.captureScreenshot', {
    format: 'png'
  });
  await writeFile(
    '/tmp/cyc242-independent-phone.png',
    Buffer.from(screenshot.data, 'base64')
  );
  console.log(
    'PASS cross-origin independent contribution, draft veto, save/reopen and phone'
  );
  for (const mode of ['empty', 'missing']) {
    await page.send('Page.navigate', { url: independent + '/independent?' + mode });
    await wait('document.querySelector("#open")?.onclick');
    await run('document.querySelector("#open").click()');
    await wait('document.querySelector("[data-simply-field=swb_applicationChoice]")?.hidden', '/preferences/');
    if (mode === 'missing') {
      await wait('document.querySelector("[data-solid-section=notes-settings]")', '/preferences/');
      await run('document.querySelector("[data-solid-section=notes-settings]").click()', '/preferences/');
      await wait('document.querySelector(".muze-solid-preferences-contribution").src.includes("/missing")', '/preferences/');
      await run('document.querySelector("[data-solid-section=appearance]").click()', '/preferences/');
    }
    await wait('document.querySelector("[aria-current=page]")?.dataset.solidSection==="appearance"', '/preferences/');
    assert.equal(await run('document.querySelector("[name=theme]").disabled', '/preferences/'), false);
  }
  console.log('PASS no-contribution and unavailable startup leave common settings usable');
  await page.send('Page.navigate', { url: origin + '/preferences/?solid-apps-task' });
  await wait('globalThis.swbPreferencesApp');
  await wait('!document.querySelector(".swb-account").hidden');
  assert.equal(await run('Boolean(document.querySelector(".muze-solid-ui-task-connect"))'), false);
  await run('document.querySelector(".swb-account-button").click()');
  await wait('document.querySelector(".swb-account-menu").matches(":popover-open")');
  await run('document.querySelector(".swb-account-menu [data-simply-command=connectDialog]").click()');
  await wait('document.querySelector(".connect-dialog").open && !document.querySelector(".muze-solid-ui-account-frame").hidden');
  console.log('PASS separate-window task exposes connection through its account dropdown');

}
finally {
  page?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => independentServer.close(resolve));
}
