import { viewResourceCapability } from '@muze-labs/solid-app-data/embedded-view.mjs';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import {
  loadDocument,
  createSolidMetroClient,
  prefixes,
  idOf,
  valueAt,
  httpUrl
} from '@muze-labs/solid-app-data';
import { browseCapability, selectRecipientCapability } from '@muze-labs/solid-app-data/capabilities.mjs';
import { app } from '@muze-labs/simplyflow/app';
import { installEvents } from '@muze-labs/simplyflow-events';
import { shell } from '@muze-labs/solid-app-ui';
import { muzeSolidDesignListDetails } from '@muze-labs/solid-design';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { editPreferencesCapability } from '@muze-labs/solid-app-data/capabilities.mjs';
import { PreferenceDrafts } from '@muze-labs/solid-preferences/drafts.mjs';
import { PreferenceState } from '@muze-labs/solid-preferences/state.mjs';
import { announcePreferences } from '@muze-labs/solid-preferences/consumer.mjs';
import { applyPreferences, defaults } from '@muze-labs/solid-preferences';
import * as backgrounds from '../../launcher/src/backgrounds.mjs';
import { preferences } from './components/preferences.mjs';
import { sections } from './components/sections.mjs';
import {
  swbProviderPreferences,
  swbWorkbenchSettings,
  swbContactsSettings,
  swbFilesSettings,
  swbProfileSettings
} from './features.mjs';
import sources from './features.mjs?entries';
import accountTemplate from './account-view.html?template' with { type: 'text' };

const host = shell({
  acceptLaunch: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main,
  components: {
    muzeSolidDesignListDetails,
    preferences,
    swbProviderPreferences,
    sections,
    swbWorkbenchSettings,
    swbContactsSettings,
    swbFilesSettings,
    swbProfileSettings
  },
  data: {
    swb_applicationChoice: { hidden: null },
    swb_sections: [],
    swb_sectionTitle: 'Appearance',
    swb_panels: {},
    swb_app: 'workbench',
    swb_workspaceFields: { disabled: null },
    swb_workspace: {},
    swb_workspaces: [],
    swb_workspaceId: '',
    swb_workspaceVisibility: { hidden: '' },
    swb_openWorkbench: { hidden: '' },
    swb_scope: '',
    swb_status: '',
    swb_conflicts: [],
    swb_newWorkspace: '',
    swb_providerCurrent: 'Built-in Files',
    swb_providerUrl: '',
    swb_providerKind: 'browseProvider',
    swb_providerSelect: { options: [], selected: 'builtin' },
    swb_providerCustom: { hidden: '' },
    swb_providerDiscovery: '',
    swb_backgroundChoice: 'none',
    swb_backgroundUrl: '',
    swb_preview: { hidden: '', src: null },
    swb_advanced: { hidden: '' },
    ...defaults
  },
  api: {
    viewResourceCapability,
    model,
    effect,
    destroy,
    from,
    loadDocument,
    createSolidMetroClient,
    prefixes,
    idOf,
    valueAt,
    httpUrl,
    browseCapability,
    selectRecipientCapability,
    PreferenceState,
    PreferenceDrafts,
    announcePreferences,
    applyPreferences,
    defaults,
    editPreferencesCapability,
    backgrounds
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
installEvents(ui);
host.onOpenPreferences = () => ui.actions.swb_selectSection('appearance');
await ui.actions.swb_initializePreferences();
globalThis.swbPreferencesApp = ui;
