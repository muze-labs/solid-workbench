import '@muze-labs/solid-app-data/simply-runtime.mjs';
import { PortConnection } from '@muze-labs/solid-app-data/capabilities.mjs';
import {
  exposeDefinition,
  prepareDefinition
} from '@muze-labs/solid-app-data/definition.mjs';
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
const ui = simply.app(prepareDefinition(definition));
exposeDefinition(ui, sources);
simply.installEvents(ui);
ui.actions.swb_initializeAccount();
globalThis.swbAccountApp = ui;
