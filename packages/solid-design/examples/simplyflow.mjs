import '@muze-labs/solid-app-data/simply-runtime.mjs';
import {
  solidDropdown,
  solidListDetails,
  solidTheme,
  solidToolbar
} from '@muze-labs/solid-design';

function matchesResource(row, query) {
  return row.title.toLowerCase().includes(query);
}

simply.app({
  container: document.querySelector('.solid-example'),
  components: {
    solidDropdown,
    solidListDetails,
    solidTheme,
    solidToolbar
  },
  data: { resourceModel: null, status: '' },
  runtime: {},
  commands: {
    solidExampleSearch(input) {
      this.data.resourceModel.state.options.query =
        input.value.trim().toLowerCase();
    }
  },
  actions: {
    initialize() {
      const resources = simply.model({
        data: [{ title: 'Contacts' }, { title: 'Notes' }, { title: 'Slides' }],
        options: { query: '' }
      });
      resources.addEffect(function (input) {
        return simply.effect(() => {
          const { query } = this.state.options;
          return input.current.filter((row) => matchesResource(row, query));
        });
      });
      this.data.resourceModel = resources;
      this.runtime.results = simply.effect(() => {
        this.data.status = resources.view.current.length
          ? ''
          : 'No matching resources.';
      });
    },
    cleanup() {
      simply.destroy(this.runtime.results);
      for (const signal of this.data.resourceModel.effects.slice(1)) {
        simply.destroy(signal);
      }
    }
  }
}).actions.initialize();
