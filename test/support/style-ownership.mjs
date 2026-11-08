import assert from 'node:assert/strict';
import { checkStyleContracts } from './style-contracts.mjs';

// Simulate the future IDE: retain originals, store a source override and update
// the existing named style element. No runtime updater is added to the apps.
export async function checkStyleOwnership(page) {
  await checkStyleContracts(page);
  const result = await page.evaluate(() => {
    const route = location.pathname.split('/').filter(Boolean).at(-1);
    const name = route === 'workbench' ? 'launcher' : route;
    let owner = globalThis.swbPreferencesApp;
    if (name !== 'preferences') {
      owner = globalThis[
        'muzeSolid' + name[0].toUpperCase() + name.slice(1) + 'App'
      ];
    }
    const instances = owner.definition.instances || {
      account: owner.runtime.host.view
    };
    const views = [owner, ...Object.values(instances)];
    const control = [...document.querySelectorAll('button')].find(
      (button) => button.getClientRects().length
    );
    const originalColor = getComputedStyle(control).backgroundColor;
    const names = new Set();
    let checked = 0;
    function check(condition, message) {
      if (!condition) {
        throw new Error('style-ownership-test: ' + name + ': ' + message);
      }
    }
    check(
      !document.querySelector('link[href$="/apps.css"]'),
      'coarse stylesheet is not downloaded a second time'
    );
    check(
      !document.getElementById('suite-appearance.css'),
      'coarse runtime stylesheet has been replaced'
    );
    control.setAttribute('data-swb-style-probe', '');
    try {
      for (const view of views) {
        for (const [componentName, component] of Object.entries(
          view.components
        )) {
          for (const [styleName, source] of Object.entries(
            component.styles || {}
          )) {
            if (!styleName.startsWith('swb-')) {
              continue;
            }
            names.add(styleName);
            const metadata =
              view.definition.sources[componentName]?.styles?.[styleName];
            check(
              metadata?.origin.endsWith('.css'),
              styleName + ' has an authored CSS origin'
            );
            const elements = [
              ...view.container.querySelectorAll('style')
            ].filter((element) => element.id === styleName + '.css');
            check(
              elements.length === 1,
              styleName + ' has one linked element in its view'
            );
            const element = elements[0];
            const original = element.textContent;
            const overrides = view.definition.overrides.styles;
            const hadOverride = Object.hasOwn(overrides, styleName);
            const previousOverride = overrides[styleName];
            const edited =
              original +
              '\n[data-swb-style-probe] {' +
              ' background-color: rgb(7, 77, 177) !important; }';
            try {
              overrides[styleName] = edited;
              element.textContent = edited;
              check(
                getComputedStyle(control).backgroundColor === 'rgb(7, 77, 177)',
                styleName + ' edits the existing view live'
              );
              check(
                component.styles[styleName] === source,
                styleName + ' retains its component original'
              );
            }
            finally {
              element.textContent = original;
              if (hadOverride) {
                overrides[styleName] = previousOverride;
              }
              else {
                delete overrides[styleName];
              }
            }
            check(
              getComputedStyle(control).backgroundColor === originalColor,
              styleName + ' restores original appearance without remounting'
            );
            checked += 1;
          }
        }
      }
    }
    finally {
      control.removeAttribute('data-swb-style-probe');
    }
    const required = {
      contacts: [
        'swb-contact-list',
        'swb-contact-layout',
        'swb-profile-details',
        'swb-profile-editing'
      ],
      files: ['swb-file-list', 'swb-file-editing', 'swb-resource-picker'],
      launcher: [
        'swb-workbench-shortcuts',
        'swb-workspace',
        'swb-resource-selection'
      ],
      preferences: [],
      profile: [
        'swb-profile-details',
        'swb-profile-editing',
        'swb-profile-resource'
      ]
    };
    for (const style of [
      ...required[name],
      'swb-foundation',
      'swb-account',
      'swb-capability-dialog',
      'swb-session-recovery'
    ]) {
      check(names.has(style), 'missing feature-owned style ' + style);
    }
    return { checked, name };
  });
  // Preferences owns section datasets and reuses the shared layout styles.
  let minimum = 7;
  if (result.name === 'preferences') {
    minimum = 4;
  }
  assert.ok(
    result.checked >= minimum,
    'Named styles support live edits and restoration in each app'
  );
}
