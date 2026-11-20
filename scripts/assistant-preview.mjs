import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const source = new URL('../examples/assistant/', import.meta.url);

async function bundle(entries) {
  // Build the trusted app independently. It has no Workbench runtime or
  // authoring-source entry points.
  const build = await rollup({
    input: Object.fromEntries(
      entries.map((name) => [
        name,
        fileURLToPath(new URL(name + '.mjs', source))
      ])
    ),
    plugins: [nodeResolve({ browser: true }), terser({ maxWorkers: 2 })],
    onwarn(warning, warn) {
      // These are internal SimplyFlow cycles also present in the suite build.
      if (warning.code !== 'CIRCULAR_DEPENDENCY') {
        warn(warning);
      }
    }
  });
  try {
    const { output } = await build.generate({ format: 'es' });
    return new Map(
      output.map(({ fileName, code }) => [
        '/' + fileName,
        { body: code, type: 'text/javascript' }
      ])
    );
  } finally {
    await build.close();
  }
}

function listen(assets, pages, policy, port) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const page = pages.get(url.pathname);
    const asset = assets.get(url.pathname);
    const status = page || asset ? 200 : 404;
    const data = page
      ? { body: page, type: 'text/html' }
      : asset || { body: 'Not found', type: 'text/plain' };
    response
      .writeHead(status, {
        'Content-Type': data.type + '; charset=utf-8',
        'Content-Security-Policy': policy(url.pathname),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store'
      })
      .end(data.body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function policy({ child = "'none'", parent = "'none'" }) {
  return (
    "default-src 'none'; script-src 'self'; style-src 'self'; " +
    "base-uri 'none'; form-action 'none'; connect-src 'none'; " +
    "object-src 'none'; frame-src " +
    child +
    '; frame-ancestors ' +
    parent
  );
}

export async function startAssistantPreview({
  callerPort = 0,
  assistantPort = 0
} = {}) {
  const [fixtureAssets, assistantAssets, style, index, bookmarks, panel] =
    await Promise.all([
      bundle(['bookmarks']),
      bundle(['panel']),
      ...['preview.css', 'index.html', 'bookmarks.html', 'panel.html'].map(
        (file) => readFile(new URL(file, source), 'utf8')
      )
    ]);
  const css = { body: style, type: 'text/css' };
  fixtureAssets.set('/preview.css', css);
  assistantAssets.set('/preview.css', css);
  const fixturePages = new Map();
  const assistantPages = new Map();
  let assistantOrigin;
  let callerOrigin;
  const fixtureServer = await listen(
    fixtureAssets,
    fixturePages,
    (route) =>
      route === '/bookmarks'
        ? policy({ child: assistantOrigin, parent: "'self'" })
        : policy({ child: "'self'" }),
    callerPort
  );
  try {
    const assistantServer = await listen(
      assistantAssets,
      assistantPages,
      (route) =>
        policy({ parent: route === '/panel' ? callerOrigin : "'none'" }),
      assistantPort
    );
    callerOrigin = 'http://localhost:' + fixtureServer.address().port;
    assistantOrigin = 'http://127.0.0.1:' + assistantServer.address().port;
    fixturePages.set('/', index);
    fixturePages.set(
      '/bookmarks',
      bookmarks.replace('{{assistantOrigin}}', assistantOrigin)
    );
    assistantPages.set(
      '/panel',
      panel.replace('{{callerOrigin}}', callerOrigin)
    );
    return {
      callerOrigin,
      assistantOrigin,
      sizes: Object.fromEntries(
        [
          ...fixtureAssets,
          ...assistantAssets,
          ...[...fixturePages, ...assistantPages].map(([key, body]) => [
            key,
            { body }
          ])
        ].map(([name, { body }]) => [name, gzipSync(body).length])
      ),
      close() {
        fixtureServer.close();
        assistantServer.close();
      }
    };
  } catch (error) {
    fixtureServer.close();
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const preview = await startAssistantPreview({
    callerPort: 4310,
    assistantPort: 4311
  });
  console.log('Social Bookmarks fixture: ' + preview.callerOrigin);
}
