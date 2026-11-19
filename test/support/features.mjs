import assert from 'node:assert/strict';
import { parseAst } from 'rollup/parseAst';

export async function checkLiveContactFunctions(page) {
  const source = await page.evaluate(async () => {
    const owner = globalThis.muzeSolidContactsApp;
    const { sourceUrl } = owner.definition.modules.collection;
    return (await import(sourceUrl)).default;
  });
  const personExport = parseAst(source).body.find(
    (entry) =>
      entry.type === 'ExportNamedDeclaration' &&
      entry.declaration?.id?.name === 'isPerson'
  );
  assert(personExport, 'The shared Contacts helper has readable source');
  const { start, end } = personExport.declaration;
  const verify = async (personSource) => {
    const owner = globalThis.muzeSolidContactsApp;
    const descriptor = owner.definition.sources.contactList;
    const { actions } = (await import(descriptor.url)).default;
    const model = owner.data.peopleModel;
    const originalFilter = owner.components.contactList.actions.filterPeople;
    const originalIsPerson = owner.api.isPerson;
    const collection = owner.runtime.store.collection;
    const draft = JSON.stringify(owner.runtime.widget.draft());
    const input = owner.container.querySelector('.solid-list-search-input');
    const initialQuery = input.value;
    const nativeRows = collection.list();
    const record = model.state.data.find((row) => row.label === 'Sparse person');
    const chosen = collection.get(record.id);
    const check = (condition, message) => {
      if (!condition) {
        throw new Error('live-contact-test: ' + message);
      }
    };
    function search(query) {
      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    async function waitFor(condition) {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (condition()) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error('live-contact-test: model did not update');
    }
    const reconstructedFilter = Function(
      'return (' + actions.filterPeople.source + ')'
    )();
    const reconstructedIsPerson = Function(
      'return (' + personSource + ')'
    )();
    check(typeof metro.trace.add === 'function', 'Metro trace is available');
    check(chosen instanceof oldm.NamedNode, 'the app and oldm share types');
    check(reconstructedIsPerson(chosen), 'shared helper works without imports');
    try {
      owner.actions.filterPeople = Function(
        'return (' + actions.filterPeople.source.replace(
          'this.actions.matchesPerson(row, search)',
          "!this.actions.matchesPerson(row, search)"
        ) + ')'
      )();
      search(record.label);
      await waitFor(() => model.state.options.search === record.label &&
        !model.view.current.some((row) => row.id === record.id));

      owner.actions.filterPeople = reconstructedFilter;
      search(record.label + ' ');
      search(record.label);
      await waitFor(() => model.view.current.some((row) => row.id === record.id));
      owner.actions.filterPeople = originalFilter;

      owner.api.isPerson = Function(
        'return (' + personSource.replace(
          'const personTypes =',
          'if (node instanceof oldm.NamedNode && node.id === ' +
            JSON.stringify(record.id) +
            ') { return false; }\n  const personTypes ='
        ) + ')'
      )();
      const refresh = owner.actions.refreshPeople;
      refresh();
      check(!model.state.data.some((row) => row.id === record.id),
        'existing refresh calls the replacement helper');
      owner.api.isPerson = originalIsPerson;
      refresh();
      check(model.state.data.some((row) => row.id === record.id),
        'existing refresh calls the restored helper');
      check(owner.data.peopleModel === model, 'the same model remains mounted');
      check(JSON.stringify(owner.runtime.widget.draft()) === draft,
        'the open draft survives replacement and restoration');
      return nativeRows.every((node) => node === collection.get(node.id));
    }
    finally {
      owner.actions.filterPeople = originalFilter;
      owner.api.isPerson = originalIsPerson;
      owner.actions.refreshPeople();
      search(initialQuery);
    }
  };
  const result = await page.evaluate(
    '() => (' + verify + ')(' + JSON.stringify(source.slice(start, end)) + ')'
  );
  assert(result, 'Replacing functions preserves authoritative RDF identity');
}

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
      const app = simply.app({
        container: mount,
        components: { contactList: component },
        templates: {
          'contacts-list': original.templates['contacts-list'].replaceAll(
            'Search contacts',
            'Find sample people'
          )
        },
        data: { peopleModel: null, empty: '' },
        api: {
          isPerson: () => true,
          readProfile: (node) => ({ name: node.label }),
          profileLabel: (node) => node.label
        },
        runtime: { host: {}, store: { collection: { list: () => sample } } }
      });
      try {
        app.actions.initializeList();
        app.actions.refreshPeople();
        const input = mount.querySelector('input[type="search"]');
        input.value = 'be';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 100));
        return (
          app.data.peopleModel.view.current.length === 1 &&
          app.data.peopleModel.view.current[0].id === 'sample:b' &&
          input.labels[0]?.textContent.trim() === 'Find sample people' &&
          input.value === app.data.peopleModel.state.options.search &&
          mount
            .querySelector('.swb-person-list')
            .textContent.includes('Beta') &&
          original.templates['contacts-list'].includes('Search contacts') &&
          !sample[0].search
        );
      }
      finally {
        simply.destroy(app.runtime.emptyListEffect);
        for (const signal of app.data.peopleModel.effects.slice(1)) {
          simply.destroy(signal);
        }
        app.destroy();
        mount.remove();
      }
    }),
    'migrated Contacts source works in a separately wired host with a template override'
  );
}
