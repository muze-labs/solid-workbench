import http from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { startChrome, formatBrowserException } from './support/chrome.mjs';

// Static protocol fixtures exercise actual activation/startup modules without
// invoking workspace persistence. Dependencies use the same browser bundler.
const dataDirectory = new URL(
  '../packages/solid-app-data/src/',
  import.meta.url
);
const brokerBundle = await rollup({
  input: new URL(
    '../packages/solid-app-data/src/workspace-broker.mjs',
    import.meta.url
  ).pathname,
  plugins: [nodeResolve({ browser: true })]
});
const broker = await brokerBundle.generate({ format: 'es' });
await brokerBundle.close();
let port;
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://fixture.invalid').pathname;
  if (path === '/workspace-broker.mjs') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(broker.output[0].code);
    return;
  }
  if (path === '/capabilities.mjs') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(await readFile(new URL(path.slice(1), dataDirectory)));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  if (path === '/files/') {
    res.end(`<!doctype html><title>Files protocol fixture</title>
      <h1>Files</h1><button id="select">Select resource</button>
      <button id="cancel">Cancel selection</button>
      <script type="module">
        import { ManagedApp, browseCapability } from '/capabilities.mjs';
        window.managed = new ManagedApp({ name: 'Files',
          capabilities: [browseCapability],
          onRequest: event => {
            window.pending = event;
            if (event.input.fixtureComplete) {
              managed.respond(event.id, { result: { '@id': 'https://pod.example/embedded.ttl#subject' } });
            }
          }
        });
        document.querySelector('#select').onclick = () => managed.respond(
          pending.id, { result: { '@id': 'https://pod.example/file.ttl#subject' } }
        );
        document.querySelector('#cancel').onclick = () => managed.respond(
          pending.id, { error: { code: 'cancelled', message: 'Selection cancelled.' } }
        );
      </script>`);
    return;
  }
  res.end(`<!doctype html><title>Launcher protocol fixture</title>
    <h1>Launcher</h1>
    <button id="embedded-pick">Embedded selection</button>
    <dialog id="embedded-dialog"><iframe title="Cross-origin provider"></iframe>
      <button id="embedded-cancel">Cancel embedded selection</button></dialog>
    <script type="module">
      import { WorkspaceBroker } from '/workspace-broker.mjs';
      import { browseCapability } from '/capabilities.mjs';
      window.broker = new WorkspaceBroker({
        onChange: async () => {},
        embeddedProviders: [{ url: 'http://localhost:${port}/files/', capability: browseCapability }]
      });
      const dialog = document.querySelector('#embedded-dialog');
      const frame = dialog.querySelector('iframe');
      window.addEventListener('message', event => {
        if (event.data?.type !== 'solid-apps:embedded-ready' ||
          event.source !== frame.contentWindow || event.origin !== 'http://localhost:${port}') {
          return;
        }
        const channel = new MessageChannel();
        window.postMessage({ type: 'solid-apps:embed-port', ...window.embedTicket },
          location.origin, [channel.port1]);
        frame.contentWindow.postMessage({ type: 'solid-apps:offer', ...window.embedTicket,
          state: null }, 'http://localhost:${port}', [channel.port2]);
      });
      document.querySelector('#embedded-cancel').onclick = () => window.embedController.abort();
      document.querySelector('#embedded-pick').onclick = async () => {
        window.embedResult = null;
        window.embedFailure = null;
        window.embedController = new AbortController();
        window.embedTicket = broker.beginEmbedded('http://localhost:${port}/files/?solid-apps-task', browseCapability);
        dialog.showModal();
        frame.src = 'http://localhost:${port}/files/?solid-apps-task';
        try {
          window.embedResult = await broker.requestEmbedded(embedTicket.id,
            { fixtureComplete: !window.embedWait }, { signal: embedController.signal });
        }
        catch (error) { window.embedFailure = error.code; }
        finally {
          broker.endEmbedded(embedTicket.id);
          frame.src = 'about:blank';
          dialog.close();
        }
      };
    </script>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
port = server.address().port;
let chrome;
const pages = [];
async function value(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(formatBrowserException(result.exceptionDetails));
  }
  return result.result.value;
}
async function until(page, expression) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await value(page, expression)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('picker-browser: Timed out: ' + expression);
}
async function click(page, selector) {
  await page.send('Page.bringToFront');
  const point = await value(
    page,
    `(() => {
    const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`
  );
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type,
      button: 'left',
      clickCount: 1,
      ...point
    });
  }
}
try {
  chrome = await startChrome('about:blank');
  const control = await chrome.page();
  pages.push(control);
  await control.ready();
  const root = await control.send('Target.createTarget', {
    url: 'http://127.0.0.1:' + port + '/'
  });
  const launcher = await chrome.page(root.targetId);
  pages.push(launcher);
  await launcher.ready();
  await until(launcher, 'Boolean(window.broker)');
  await click(launcher, '#embedded-pick');
  await until(launcher, 'Boolean(window.embedResult)');
  assert.equal(
    await value(launcher, 'window.embedResult["@id"]'),
    'https://pod.example/embedded.ttl#subject'
  );
  assert.equal(
    await value(
      launcher,
      'broker.snapshot().apps.some(entry=>entry.id===embedTicket.id)'
    ),
    false
  );
  await value(launcher, 'window.embedWait=true');
  await click(launcher, '#embedded-pick');
  await until(launcher, 'broker.instances.get(embedTicket.id)?.ready');
  await click(launcher, '#embedded-cancel');
  await until(launcher, 'window.embedFailure === "cancelled"');
  assert.equal(
    await value(launcher, 'broker.instances.has(embedTicket.id)'),
    false
  );
  console.log(
    'PASS: cross-origin iframe startup, private-port result, cancellation and transient workspace exclusion.'
  );

}
catch (error) {
  for (const page of pages) {
    try {
      console.error(
        await value(
          page,
          `JSON.stringify({
        url: location.href, focused: document.hasFocus(),
        visibility: document.visibilityState, result: window.result,
        pending: Boolean(window.pending), progress: window.progress,
        failure: window.failure, childReady: window.managed?.ready,
        instances: window.broker && [...broker.instances.values()].map(record => ({
          registered: record.registered, ready: record.ready,
          restoreError: record.restoreError, url: record.entry.url
        }))
      })`
        )
      );
    }
    catch {}
  }
  throw error;
}
finally {
  pages.forEach((page) => page.close());
  await chrome?.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
}
