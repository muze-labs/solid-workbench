import { app } from '@muze-labs/simplyflow/app';
import { installEvents } from '@muze-labs/simplyflow-events';
import { PortConnection } from '@muze-labs/solid-app-data/capabilities.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { applyPreferences } from '@muze-labs/solid-preferences';
import { swbAccount, suiteAppearance } from './features.mjs';
import sources from './features.mjs?entries';

const definition = {
  container: document.querySelector('#app'),
  components: { suiteAppearance, swbAccount },
  data: {
    webId: '',
    swb_accountStatus: '',
    swb_accountMessage: 'Open Account from an app’s WebID / connection control.',
    swb_accountControls: { hidden: '' },
    swb_accountDisabled: { disabled: '' }
  },
  api: { PortConnection, applyPreferences },
  runtime: {}
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
installEvents(ui);
ui.actions.swb_initializeAccount();
globalThis.swbAccountApp = ui;
