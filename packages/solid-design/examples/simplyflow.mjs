import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import {
  solidDropdown,
  solidListDetails,
  solidTheme,
  solidToolbar
} from '@muze-labs/solid-design';

function matchesResource(row, query) {
  return row.title.toLowerCase().includes(query);
}

app({
  container: document.querySelector('.solid-example'),
  components: {
    solidDropdown,
    solidListDetails,
    solidTheme,
    solidToolbar
  },
  data: { resourceModel: null, status: '' },
  runtime: {},
  api: { model, effect, destroy },
  commands: {
    solidExampleSearch(input) {
      this.data.resourceModel.state.options.query =
        input.value.trim().toLowerCase();
    }
  },
  actions: {
    initialize() {
      const resources = this.api.model({
        data: [{ title: 'Contacts' }, { title: 'Notes' }, { title: 'Slides' }],
        options: { query: '' }
      });
      const { effect } = this.api;
      resources.addEffect(function (input) {
        return effect(() => {
          const { query } = this.state.options;
          return input.current.filter((row) => matchesResource(row, query));
        });
      });
      this.data.resourceModel = resources;
      this.runtime.results = effect(() => {
        this.data.status = resources.view.current.length
          ? ''
          : 'No matching resources.';
      });
    },
    cleanup() {
      this.api.destroy(this.runtime.results);
      for (const signal of this.data.resourceModel.effects.slice(1)) {
        this.api.destroy(signal);
      }
    }
  }
}).actions.initialize();
