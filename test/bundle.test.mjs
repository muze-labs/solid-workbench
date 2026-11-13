import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { bundleApplications } from '../scripts/bundle.mjs';

test('readable and minified apps preserve isolated module graphs', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = await bundleApplications(root);
  const allChunks = output.filter((item) => item.type === 'chunk');
  const authoring = new Map(
    output
      .filter(
        (item) =>
          item.type === 'asset' && item.fileName.startsWith('authoring/')
      )
      .map((item) => [item.fileName, item])
  );
  assert(authoring.size > 20, 'authored feature data is separately deployed');
  let reconstructed = 0;
  for (const asset of authoring.values()) {
    const value = (
      await import(
        'data:text/javascript;base64,' +
          Buffer.from(asset.source).toString('base64')
      )
    ).default;
    if (typeof value === 'string') {
      assert(value.length > 0, 'API source text is retained outside runtime');
      continue;
    }
    for (const entries of Object.values(value)) {
      for (const metadata of Object.values(entries)) {
        assert(metadata.origin, 'authoring data retains its file identity');
        if (metadata.source) {
          const body = Function('return (' + metadata.source + ')')();
          assert.equal(
            typeof body,
            metadata.kind === 'event' ? 'object' : 'function'
          );
          reconstructed += 1;
        }
      }
    }
  }
  assert(reconstructed > 100, 'authored behaviors survive extraction');

  for (const suffix of ['', '.min']) {
    const filename = (name) => name + suffix + '.js';
    const chunks = new Map(
      allChunks
        .filter((item) => item.fileName.endsWith('.min.js') === Boolean(suffix))
        .map((item) => [item.fileName, item])
    );
    const apps = [
      'contacts',
      'files',
      'launcher',
      'profile',
      'preferences',
      'account',
      'viewer',
      'presenter'
    ];
    assert.deepEqual(
      [...chunks.keys()].sort(),
      [
        ...apps.map((name) => filename(name + '/src/index')),
        ...[
          'redirect',
          'shared/data',
          'shared/ui',
          'shared/profile',
          'shared/backgrounds',
          'shared/cobalt'
        ].map(filename)
      ].sort()
    );
    const data = chunks.get(filename('shared/data'));
    const ui = chunks.get(filename('shared/ui'));
    assert.deepEqual(data.imports, []);
    assert.deepEqual(ui.imports, [data.fileName]);
    assert.deepEqual(chunks.get(filename('redirect')).imports, [data.fileName]);
    const dataModules = Object.keys(data.modules).join('\n');
    const uiModules = Object.keys(ui.modules).join('\n');
    for (const library of [
      'metro-core',
      'oldm-core',
      'oldm-turtle',
      'solid-workspace'
    ]) {
      assert(dataModules.includes('/' + library + '/'), library);
    }
    assert(!/simplyflow|simplysolid/.test(dataModules));
    assert.match(uiModules, /simplyflow-app/);
    assert.match(uiModules, /simplysolid/);
    const profile = chunks.get(filename('shared/profile'));
    assert(
      Object.keys(profile.modules).some((id) =>
        id.includes('/solid-profile/src/view.mjs')
      )
    );
    const moduleOwners = new Map();
    for (const [name, chunk] of chunks) {
      assert(!chunk.imports.some((file) => file.startsWith('authoring/')));
      assert(
        !chunk.dynamicImports.some((file) => file.startsWith('authoring/'))
      );
      for (const id of Object.keys(chunk.modules)) {
        assert(!moduleOwners.has(id), 'Duplicated module: ' + id);
        moduleOwners.set(id, name);
        assert(!/\/node_modules\/(?:n3|@muze-nl\/oldm-n3)\//.test(id));
        const app = /\/apps\/([^/]+)\//.exec(id)?.[1];
        if (app) {
          assert(
            name === filename(app + '/src/index') ||
              name === filename('preferences/src/index') ||
              (app === 'launcher' && name === filename('shared/backgrounds')),
            'App contributions belong only to their owner or Preferences: ' + id
          );
        }
      }
      for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) {
        assert(
          chunks.has(dependency),
          'Mixed or missing graph import: ' + dependency
        );
      }
      const map = output.find((item) => item.fileName === name + '.map');
      assert(map, 'Missing source map for ' + name);
      const sourceMap = JSON.parse(map.source);
      assert(sourceMap.mappings.length > 0);
      assert(sourceMap.sourcesContent.some((source) => source?.length > 0));
      assert(
        chunk.code.includes(
          'sourceMappingURL=' + name.split('/').at(-1) + '.map'
        )
      );
      if (suffix) {
        const original = allChunks.find(
          (item) => item.fileName === name.replace(/\.min\.js$/, '.js')
        );
        assert.deepEqual(
          [...chunk.exports].sort(),
          [...original.exports].sort()
        );
      }
    }
    assert.equal(
      moduleOwners.get(
        root + 'packages/solid-app-data/src/workspace-broker.mjs'
      ),
      filename('shared/data')
    );
    assert.equal(
      moduleOwners.get(root + 'packages/solid-app-data/src/link-metadata.mjs'),
      filename('files/src/index')
    );
    for (const name of apps) {
      const imports = chunks.get(filename(name + '/src/index')).imports;
      const required = [data.fileName, ui.fileName];
      if (['launcher', 'preferences'].includes(name)) {
        required.push(filename('shared/backgrounds'));
      }
      if (['presenter', 'viewer'].includes(name)) {
        required.push(filename('shared/cobalt'));
      }
      if (['contacts', 'profile'].includes(name)) {
        required.push(filename('shared/profile'));
      }
      assert.deepEqual([...imports].sort(), required.sort());
    }
  }
  const bytes = (minified) =>
    allChunks
      .filter((item) => item.fileName.endsWith('.min.js') === minified)
      .reduce((total, item) => total + Buffer.byteLength(item.code), 0);
  assert(bytes(true) < bytes(false), 'Minified payload must be smaller.');
});
