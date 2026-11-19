import '@muze-labs/solid-app-data/simply-runtime.mjs';
import {
  solidToolbar,
  solidDialog,
  solidListDetails
} from '@muze-labs/solid-design';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { writeDraft, readDraft } from '@muze-labs/solid-profile/state.mjs';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { shell } from '@muze-labs/solid-app-ui';
import { openCollection } from '@muze-labs/solid-app-data/collection.mjs';
import { createSolidMetroClient, httpUrl } from '@muze-labs/solid-app-data';
import {
  loadDocument,
  copyDocument,
  saveDocument
} from '@muze-labs/solid-app-data';
import {
  profileView,
  profileComponents,
  profileDefaults,
  profileSources
} from '@muze-labs/solid-profile/view.mjs';
import { scalarPredicates, applyProfileEdits } from '@muze-labs/solid-profile';
import { editProfileCapability } from '@muze-labs/solid-app-data/capabilities.mjs';
import {
  profileResource,
  lifecycle,
  muzeSolidProfileCapability
} from './features.mjs';
import {
  exposeDefinition,
  prepareDefinition
} from '@muze-labs/solid-app-data/definition.mjs';
import sources from './features.mjs?entries';
const host = shell({
  acceptLaunch: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main,
  components: {
    solidToolbar,
    solidDialog,
    solidListDetails,
    ...profileComponents,
    profileResource,
    lifecycle,
    muzeSolidProfileCapability
  },
  data: { profile: profileDefaults(), url: '' },
  api: {
    editProfileCapability,
    writeDraft,
    readDraft,
    AppState,
    apps,
    shell,
    openCollection,
    createSolidMetroClient,
    httpUrl,
    loadDocument,
    copyDocument,
    saveDocument,
    profileView,
    scalarPredicates,
    applyProfileEdits
  },
  runtime: { host }
};
const ui = simply.app(prepareDefinition(definition));
exposeDefinition(ui, { ...profileSources, ...sources });
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view
};
window.solidProfile = { host, ui };
globalThis.muzeSolidProfileApp = ui;
