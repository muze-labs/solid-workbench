import assert from 'node:assert/strict';

// Explicit authoring-tool coverage; normal startup must not load these assets.
// All storage APIs in the second host are explicit fixture doubles.
export async function checkFeatureSources(page, appName) {
  const result = await page.evaluate(async () => {
    const route = location.pathname.split('/').filter(Boolean).at(-1);
    const name = route === 'workbench' ? 'launcher' : route;
    let owner = globalThis.swbPreferencesApp;
    if (name !== 'preferences') {
      owner =
        globalThis['muzeSolid' + name[0].toUpperCase() + name.slice(1) + 'App'];
    }
    const entries = [];
    const instances = owner.definition.instances || {
      account: owner.runtime.host.view
    };
    const definitions = [
      owner.definition,
      ...Object.values(instances).map((view) => view.definition)
    ];
    const automaticSources = performance
      .getEntriesByType('resource')
      .filter((entry) => new URL(entry.name).pathname.includes('/authoring/'));
    if (automaticSources.length) {
      throw new Error(
        'feature-test: Startup requested optional authoring sources'
      );
    }
    // This fixture explicitly acts as an authoring tool, after checking startup.
    // No equivalent loader is installed in the application runtime.
    for (const definition of definitions) {
      for (const [name, descriptor] of Object.entries(definition.sources)) {
        if (!descriptor.url) {
          throw new Error(
            'feature-test: Missing same-build source URL for ' + name
          );
        }
        const metadata = (await import(descriptor.url)).default;
        definition.sources[name] = { ...metadata, ...descriptor };
      }
      for (const module of Object.values(definition.modules || {})) {
        if (typeof (await import(module.sourceUrl)).default !== 'string') {
          throw new Error(
            'feature-test: API module source is not readable text'
          );
        }
      }
      for (const component of Object.values(definition.sources)) {
        for (const [section, values] of Object.entries(component)) {
          for (const [entry, metadata] of Object.entries(values)) {
            if (metadata.source) {
              if (!metadata.origin.includes('/components/')) {
                throw new Error(
                  'feature-test: Source must identify its component file'
                );
              }
              const reconstructed = Function(
                'return (' + metadata.source + ')'
              )();
              const expected =
                metadata.kind === 'event' ? 'object' : 'function';
              if (typeof reconstructed !== expected) {
                throw new Error(
                  'feature-test: Invalid ' + section + '.' + entry
                );
              }
              entries.push(metadata.origin + '#' + section + '.' + entry);
            }
          }
        }
      }
    }
    return {
      count: entries.length,
      components: Object.keys(owner.components),
      views: [...document.querySelectorAll('[data-feature]')].map(
        (node) => node.dataset.feature
      )
    };
  });
  assert(result.count > 10, appName + ' must retain authored entries');
  assert(
    result.components.length > 1,
    appName + ' must register named features'
  );
  assert(result.views.length > 1, appName + ' must wire named views');
  if (appName !== 'contacts') {
    return;
  }
  assert(
    await page.evaluate(async () => {
      const owner = globalThis.muzeSolidContactsApp;
      const original = owner.components.contactList;
      const sources = owner.definition.sources.contactList;
      const actions = Object.fromEntries(
        Object.entries(sources.actions).map(([name, entry]) => [
          name,
          Function('return (' + entry.source + ')')()
        ])
      );
      const component = { ...original, actions };
      const sample = [
        { id: 'sample:b', label: 'Beta' },
        { id: 'sample:a', label: 'Alpha' }
      ];
      const mount = document.createElement('section');
      mount.innerHTML =
        '<div data-simply-field="layout"><template id="contacts-list"></template></div>';
      document.body.append(mount);
      const app = owner.api.app({
        container: mount,
        components: { contactList: component },
        templates: {
          'contacts-list': original.templates['contacts-list'].replaceAll(
            'Search contacts',
            'Find sample people'
          )
        },
        data: { people: [], search: '', empty: '' },
        api: {
          model: owner.api.model,
          effect: owner.api.effect,
          from: owner.api.from,
          isPerson: () => true,
          readProfile: (node) => ({ name: node.label }),
          profileLabel: (node) => node.label
        },
        runtime: { host: {}, store: { collection: { list: () => sample } } }
      });
      try {
        app.actions.initializeList();
        app.actions.refreshPeople();
        app.actions.setSearch('be');
        await new Promise((resolve) => setTimeout(resolve, 100));
        return (
          app.data.people.length === 1 &&
          app.data.people[0].id === 'sample:b' &&
          mount.querySelector('[aria-label="Find sample people"]') !== null &&
          mount
            .querySelector('.swb-person-list')
            .textContent.includes('Beta') &&
          original.templates['contacts-list'].includes('Search contacts') &&
          !sample[0].search
        );
      }
      finally {
        owner.api.destroy(app.runtime.listEffect);
        for (const signal of app.runtime.people.effects.slice(1)) {
          owner.api.destroy(signal);
        }
        app.destroy();
        mount.remove();
      }
    }),
    'migrated Contacts source works in a separately wired host with a template override'
  );
}
