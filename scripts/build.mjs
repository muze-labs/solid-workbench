import { composeTemplate, applicationTitle } from './templates.mjs';
import { bundleApplications } from './bundle.mjs';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import theds from '@muze-nl/theds';
const root = fileURLToPath(new URL('../', import.meta.url));
const readable = process.argv.includes('--readable');
let scriptSuffix = '.min';
if (readable) {
  scriptSuffix = '';
}
const bundles = await bundleApplications(root);
// Everything in assets is generated. Drop retired hashed chunks as well as
// current outputs so deployment contains only this build's import graph.
await rm(path.join(root, 'www/assets'), { recursive: true, force: true });
await mkdir(path.join(root, 'www/assets'), { recursive: true });
// The maintainer explicitly retires the old entry; no compatibility page.
await rm(path.join(root, 'www/launcher'), { recursive: true, force: true });
// Use the DS's stylesheet composition API without its optional remote fonts.
// The installed distribution's unterminated import also consumes layer order;
// composing its named local sheets preserves the rules and explicit layers.
const localDesignStyles = { ...theds.css };
delete localDesignStyles.import;
await writeFile(
  path.join(root, 'www/assets/theds.css'),
  await theds.actions.dsBuildSheet.call({ css: localDesignStyles })
);
await copyFile(
  path.join(root, 'packages/solid-app-ui/src/feather-icons.svg'),
  path.join(root, 'www/assets/feather-icons.svg')
);
await copyFile(
  path.join(root, 'packages/solid-app-ui/src/feather-icons.LICENSE.txt'),
  path.join(root, 'www/assets/feather-icons.LICENSE.txt')
);
await mkdir(path.join(root, 'www/assets/backgrounds'), { recursive: true });
for (let number = 1; number <= 6; number += 1) {
  await copyFile(
    path.join(root, 'apps/launcher/src/backgrounds/bg' + number + '.jpg'),
    path.join(root, 'www/assets/backgrounds/bg' + number + '.jpg')
  );
}
for (const output of bundles) {
  const destination = path.join(root, 'www/assets', output.fileName);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(
    destination,
    output.type === 'chunk' ? output.code : output.source
  );
}
for (const name of [
  'launcher',
  'contacts',
  'files',
  'profile',
  'preferences'
]) {
  const route = name === 'launcher' ? 'workbench' : name;
  const title = applicationTitle(name);
  const pageTitle = name === 'launcher' ? title : title + ' · Solid Workbench';
  const content = await composeTemplate(
    path.join(root, `apps/${name}/src/index.html`),
    { appName: name }
  );
  const shell = await composeTemplate(
    path.join(root, 'packages/solid-app-ui/src/shell.html'),
    { appName: name }
  );
  const body = shell.replace('{{content}}', content);
  await mkdir(path.join(root, `www/${route}`), { recursive: true });
  for (const asset of ['manifest.ttl', 'icon.svg']) {
    await copyFile(
      path.join(root, `apps/${name}/src/${asset}`),
      path.join(root, `www/${route}/${asset}`)
    );
  }
  await writeFile(
    path.join(root, `www/${route}/index.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageTitle}</title><link rel="describedby" type="text/turtle" href="manifest.ttl"><style>@layer reset, setup, theme, base, component, page, utility;</style><link rel="stylesheet" href="../assets/theds.css"></head><body class="ds-darkmode-auto swb-${name}"><div id="app" class="swb-root">${body}</div><script type="module" src="../assets/${name}/src/index${scriptSuffix}.js"></script></body></html>`
  );
}
await writeFile(
  path.join(root, 'www/redirect.html'),
  '<!doctype html><meta charset="utf-8"><title>Solid connection</title><p>Completing sign-in…</p><script type="module" src="assets/redirect' +
    scriptSuffix +
    '.js"></script>'
);
await writeFile(
  path.join(root, 'www/index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=workbench/"><a href="workbench/">Open Solid Workbench</a>'
);
console.log('Built all five apps in www/');
const outputs = Object.fromEntries(
  bundles
    .filter((item) => item.type === 'chunk')
    .map((item) => ['www/assets/' + item.fileName, item])
);
const gzipSizes = new Map();
for (const [name, output] of Object.entries(outputs)) {
  gzipSizes.set(name, gzipSync(output.code, { level: 6 }).byteLength);
}
function importGraph(name, seen = new Set()) {
  if (seen.has(name)) {
    return seen;
  }
  seen.add(name);
  for (const dependency of [
    ...outputs[name].imports,
    ...outputs[name].dynamicImports
  ]) {
    importGraph('www/assets/' + dependency, seen);
  }
  return seen;
}
function appSizes(suffix) {
  const sizes = {};
  for (const name of [
    'launcher',
    'contacts',
    'files',
    'profile',
    'preferences'
  ]) {
    const files = importGraph(`www/assets/${name}/src/index${suffix}.js`);
    importGraph('www/assets/redirect' + suffix + '.js', files);
    const total = [...files].reduce(
      (sum, file) => sum + gzipSizes.get(file),
      0
    );
    sizes[name] = { gzipBytes: total, scripts: [...files] };
    // CYC100: maintainer-approved temporary readable Workbench allowance.
    const budget = name === 'launcher' && suffix === '' ? 220000 : 200000;
    if (total >= budget) {
      throw new Error(
        'build: ' +
          name +
          suffix +
          ' exceeds its ' +
          budget +
          ' byte gzip JavaScript budget.'
      );
    }
  }
  return sizes;
}
const sizes = appSizes('.min');
const readableSizes = appSizes('');
await writeFile(
  path.join(root, 'www/size-report.json'),
  JSON.stringify(
    {
      gzipLevel: 6,
      node: process.versions.node,
      apps: sizes,
      readableApps: readableSizes,
      servedVariant: readable ? 'readable' : 'minified'
    },
    null,
    2
  )
);
await writeFile(
  path.join(root, 'www/bundle-report.json'),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(outputs).map(([name, output]) => [
        name,
        {
          gzipBytes: gzipSizes.get(name),
          imports: output.imports,
          modules: Object.keys(output.modules).map((id) =>
            path.relative(root, id)
          )
        }
      ])
    ),
    null,
    2
  )
);
for (const [variant, report] of [
  ['minified', sizes],
  ['readable', readableSizes]
]) {
  console.log(
    'Gzip JS including auth callback (' +
      variant +
      '): ' +
      Object.entries(report)
        .map(([name, size]) => `${name} ${size.gzipBytes} B`)
        .join(', ')
  );
}
