import { readRecipient } from '@muze-labs/solid-app-data/recipient.mjs';
import { readProfile } from '@muze-labs/solid-profile';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import {
  muzeSolidDesignDialog,
  muzeSolidDesignListDetails
} from '@muze-labs/solid-design';
import fileDataSource from './data.mjs' with { type: 'text' };
import { listFolder, readDownload, uploadFiles } from './data.mjs';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { shell } from '@muze-labs/solid-app-ui';
import { browseCapability, selectRecipientCapability } from '@muze-labs/solid-app-data/capabilities.mjs';
import { httpUrl } from '@muze-labs/solid-app-data';
import {
  linkState,
  markResourceDeleted,
  parentContainer
} from '@muze-labs/solid-app-data/link-metadata.mjs';
import { app } from '@muze-labs/simplyflow/app';
import {
  swbFileSharing,
  fileNavigation,
  fileEditing,
  resourcePicker,
  lifecycle
} from './features.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import sources from './features.mjs?entries';
const host = shell({
  acceptLaunch: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main.querySelector('.swb-file-controls'),
  components: {
    muzeSolidDesignDialog,
    muzeSolidDesignListDetails,
    swbFileSharing,
    fileNavigation,
    fileEditing,
    resourcePicker,
    lifecycle
  },
  data: {
    entries: [],
    url: '',
    empty: '',
    picker: { hidden: '' },
    editing: { hidden: host.task ? '' : null },
    requester: '',
    pickerEntries: [],
    swb_shareVisible: { hidden: '' },
    swb_shareResource: '', swb_sharePerson: '', swb_shareId: '',
    swb_shareDocument: '', swb_shareEmail: '', swb_sharePhone: '',
    swb_shareWebId: '', swb_shareStatus: ''
  },
  api: {
    app,
    listFolder,
    readDownload,
    uploadFiles,
    model,
    effect,
    destroy,
    from,
    AppState,
    apps,
    shell,
    browseCapability,
    selectRecipientCapability, readRecipient, readProfile, launchUrl,
    httpUrl,
    linkState,
    markResourceDeleted,
    parentContainer
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
ui.definition.modules = {
  fileData: {
    source: fileDataSource,
    origin: 'apps/files/src/data.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-app-data/link-metadata.mjs'
    ]
  }
};
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view
};
window.solidFiles = { host, ui };
globalThis.muzeSolidFilesApp = ui;
