import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

export async function checkAppIcons(page, origin) {
  for (const app of ['workbench', 'files', 'contacts', 'profile']) {
    const html = await (await fetch(origin + '/' + app + '/')).text();
    assert.match(html, /rel="icon" href="icon.svg"[^>]+sizes="any"/);
    assert.match(html, /rel="icon" href="favicon.ico"/);
    for (const asset of ['icon.svg', 'favicon.ico', 'favicon-32.png']) {
      const response = await fetch(origin + '/' + app + '/' + asset);
      assert.equal(response.status, 200);
      const sourceApp = app === 'workbench' ? 'launcher' : app;
      const source = await readFile(new URL(
        '../../apps/' + sourceApp + '/src/' + asset, import.meta.url
      ));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), source);
    }
  }
  const result = await page.evaluate(() => {
    const app = solidLauncher.ui;
    const schema = app.api.prefixes.schema;
    const apps = app.api.prefixes.apps;
    const node = {
      id: 'urn:test:icon',
      [schema + 'url']: { id: location.origin + '/files/#resource=example' },
      [schema + 'image']: {
        id: location.origin + '/assets/feather-icons.svg#folder'
      }
    };
    const before = JSON.stringify(node);
    const current = app.actions.shortcutRow(node).view;
    const unchanged = before === JSON.stringify(node);
    node[apps + 'iconOverride'] = { id: 'https://custom.example/icon.svg' };
    const custom = app.actions.shortcutRow(node).view;
    delete node[apps + 'iconOverride'];
    node[schema + 'url'] = { id: 'https://external.example/files/' };
    const external = app.actions.shortcutRow(node).view;
    return {
      current: current.icon.src, unchanged, custom: custom.icon.src,
      external: external.spriteIcon.href,
      labels: [...document.querySelectorAll('.swb-shortcut-link')]
        .every(link => link.textContent.trim().length > 0)
    };
  });
  assert.equal(result.current, origin + '/files/icon.svg');
  assert.equal(result.unchanged, true, 'Default refresh preserves stored RDF');
  assert.equal(result.custom, 'https://custom.example/icon.svg');
  assert.equal(result.external, origin + '/assets/feather-icons.svg#folder');
  assert.equal(result.labels, true);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await page.evaluate(() => [...document.querySelectorAll(
      '.swb-shortcut-image:not([hidden])'
    )].every(image => image.complete && image.naturalWidth > 0))) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(
    '.swb-shortcut-image:not([hidden])'
  )].every(image => image.complete && image.naturalWidth > 0)), true);
  await writeFile('/tmp/cyc163-icons-phone.png', Buffer.from(
    (await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'
  ));
  console.log('PASS: supplied favicon bytes, colour Launcher defaults, cached old defaults, override/external preservation and phone labels.');
}
