import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import {
  solidDropdown,
  solidListDetails,
  solidTheme,
  solidToolbar
} from '@muze-labs/solid-design';

app({
  container: document.querySelector('.solid-example'),
  components: {
    solidDropdown,
    solidListDetails,
    solidTheme,
    solidToolbar
  },
  data: { resources: [], status: '' },
  runtime: {},
  api: { model, effect, destroy },
  commands: {
    solidExampleSearch(input) {
      this.runtime.resources.state.options.query =
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
      resources.addEffect(function () {
        return effect(() => this.state.data);
      });
      resources.addEffect(function (input) {
        return effect(() => {
          const { query } = this.state.options;
          return input.current.filter((row) =>
            row.title.toLowerCase().includes(query)
          );
        });
      });
      this.runtime.resources = resources;
      this.runtime.results = effect(() => {
        const rows = resources.view.current;
        this.data.resources = rows;
        this.data.status = rows.length ? '' : 'No matching resources.';
      });
    },
    cleanup() {
      this.api.destroy(this.runtime.results);
      for (const signal of this.runtime.resources.effects.slice(1)) {
        this.api.destroy(signal);
      }
    }
  }
}).actions.initialize();
