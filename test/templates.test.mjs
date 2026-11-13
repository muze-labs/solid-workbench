import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rollup } from 'rollup';
import { editableSources } from '../scripts/templates.mjs';
import raw from '../apps/contacts/src/account-view.html' with { type: 'text' };
import compiled from '../apps/contacts/src/account-view.html?template' with { type: 'text' };

// The Node test loader and browser bundler must agree on the same imports.
// In particular, ordinary text must retain even template-looking characters.
test('text imports preserve source; explicit template imports compose HTML', async () => {
  const filename = fileURLToPath(
    new URL('../apps/contacts/src/account-view.html', import.meta.url)
  );
  assert.equal(raw, await readFile(filename, 'utf8'));
  assert.match(raw, /\{\{include:/);
  assert.doesNotMatch(compiled, /\{\{/);
  assert.match(compiled, /Contacts/);

  const directory = await mkdtemp(path.join(tmpdir(), 'solid-text-import-'));
  const moduleFile = path.join(directory, 'fixture.mjs');
  const moduleSource = 'export default 42;';
  await writeFile(moduleFile, moduleSource);
  const nativeText = await import(moduleFile, { with: { type: 'text' } });
  const executable = await import(moduleFile);
  assert.equal(nativeText.default, moduleSource);
  assert.equal(executable.default, 42);
  const bundle = await rollup({
    input: 'text-fixture',
    plugins: [
      {
        name: 'text-fixture',
        resolveId(id) {
          if (id === 'text-fixture') {
            return id;
          }
        },
        load(id) {
          if (id === 'text-fixture') {
            return `
              import raw from ${JSON.stringify(filename)}
                with { type: 'text' };
              import compiled from ${JSON.stringify(filename + '?template')}
                with { type: 'text' };
              import moduleText from ${JSON.stringify(moduleFile)}
                with { type: 'text' };
              import executable from ${JSON.stringify(moduleFile)};
              export { raw, compiled, moduleText, executable };
            `;
          }
        }
      },
      editableSources()
    ]
  });
  try {
    const { output } = await bundle.generate({ format: 'es' });
    const url =
      'data:text/javascript;base64,' +
      Buffer.from(output[0].code).toString('base64');
    const result = await import(url);
    assert.equal(result.raw, raw);
    assert.equal(result.compiled, compiled);
    assert.equal(result.moduleText, moduleSource);
    assert.equal(result.executable, 42);
  }
  finally {
    await bundle.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('authoring sources are optional, inert, versioned assets with re-export identity', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'solid-authoring-'));
  const featureFile = path.join(directory, 'feature.mjs');
  const apiFile = path.join(directory, 'api.mjs');
  const apiSource = '// Authored API text: café\nexport const answer = 42;\n';
  await writeFile(apiFile, apiSource);
  await writeFile(
    path.join(directory, 'features.mjs'),
    "export { feature as renamedFeature } from './feature.mjs';"
  );
  await writeFile(
    path.join(directory, 'entry.mjs'),
    `
    import sources from './features.mjs?entries';
    import sourceUrl from './api.mjs?source';
    import { feature } from './feature.mjs';
    export { sources, sourceUrl, feature };
  `
  );
  async function build(version) {
    const outputDirectory = path.join(directory, version);
    const bundle = await rollup({
      input: path.join(directory, 'entry.mjs'),
      plugins: [editableSources()]
    });
    try {
      await bundle.write({
        dir: outputDirectory,
        format: 'es',
        entryFileNames: 'runtime.mjs',
        assetFileNames: 'authoring/[name]-[hash][extname]'
      });
      await writeFile(
        path.join(outputDirectory, 'package.json'),
        '{"type":"module"}'
      );
      return import(
        pathToFileURL(path.join(outputDirectory, 'runtime.mjs')).href
      );
    }
    finally {
      await bundle.close();
    }
  }
  try {
    await writeFile(
      featureFile,
      `export const feature = {
      actions: { save() {
        // First authored revision, preserved for inspection.
        return this.data.draft;
      } },
      events: { update: { target: 'window', type: 'change', action: 'save' } }
    };`
    );
    const first = await build('first');
    const descriptor = first.sources.renamedFeature;
    assert.equal(
      descriptor.actions,
      undefined,
      'runtime retains a source location, not its body'
    );
    assert.equal(
      first.feature.actions.save.call({ data: { draft: 'kept' } }),
      'kept'
    );
    assert.match(descriptor.url, /\/authoring\/.*\.js$/);
    const metadata = (await import(descriptor.url)).default;
    assert.match(metadata.actions.save.source, /First authored revision/);
    assert.match(metadata.actions.save.origin, /feature\.mjs$/);
    const action = Function('return (' + metadata.actions.save.source + ')')();
    assert.equal(
      action.call({ data: { draft: 'reconstructed' } }),
      'reconstructed'
    );
    assert.equal(metadata.events.update.kind, 'event');
    assert.equal(
      Function('return (' + metadata.events.update.source + ')')().action,
      'save'
    );
    assert.equal((await import(first.sourceUrl)).default, apiSource);
    await writeFile(
      featureFile,
      (await readFile(featureFile, 'utf8')).replace(
        'First authored revision',
        'Second authored revision'
      )
    );
    const second = await build('second');
    assert.notEqual(
      path.basename(new URL(second.sources.renamedFeature.url).pathname),
      path.basename(new URL(descriptor.url).pathname),
      'changed source changes its asset identity'
    );
    assert.match(
      (await import(second.sources.renamedFeature.url)).default.actions.save
        .source,
      /Second authored revision/
    );
    assert.match(
      metadata.actions.save.source,
      /First authored revision/,
      'old version stays unchanged'
    );
  }
  finally {
    await rm(directory, { recursive: true, force: true });
  }
});
