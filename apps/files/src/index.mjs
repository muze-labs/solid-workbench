import '@muze-labs/solid-app-data/simply-runtime.mjs';
import '@muze-labs/solid-app-data/jaqt-runtime.mjs';
import {
  EmbeddedView,
  viewResourceCapability
} from '@muze-labs/solid-app-data/embedded-view.mjs';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import { readRecipient } from '@muze-labs/solid-app-data/recipient.mjs';
import { readProfile } from '@muze-labs/solid-profile';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import {
  solidDialog,
  solidListDetails,
  solidToolbar
} from '@muze-labs/solid-design';
import fileDataSource from './data.mjs?source';
import { listFolder, readDownload, uploadFiles } from './data.mjs';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { shell } from '@muze-labs/solid-app-ui';
import {
  browseCapability,
  browseRequest,
  selectRecipientCapability
} from '@muze-labs/solid-app-data/capabilities.mjs';
import { httpUrl } from '@muze-labs/solid-app-data';
import {
  linkState,
  markResourceDeleted,
  parentContainer
} from '@muze-labs/solid-app-data/link-metadata.mjs';
import {
  muzeSolidFileDetails,
  swbFileSharing,
  fileNavigation,
  fileEditing,
  resourcePicker,
  lifecycle
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
host.preferenceSections = [{
  id: 'files-storage', label: 'Files · Storage',
  url: new URL('./settings.html', location.href).href,
  workspaceKeys: ['filesRoot']
}];
const definition = {
  // The browser's own mode attribute must also be inside the binding scope.
  container: host.main,
  components: {
    solidDialog,
    solidListDetails,
    solidToolbar,
    muzeSolidFileDetails,
    swbFileSharing,
    fileNavigation,
    fileEditing,
    resourcePicker,
    lifecycle
  },
  data: {
    muzeSolidFilesCreateStatus: '',
    muzeSolidFilesFolderName: 'Folder',
    muzeSolidFilesAncestors: [],
    muzeSolidFilesFolders: [],
    muzeSolidFilesParent: { disabled: '' },
    muzeSolidFilesLocationPlacement: {},
    muzeSolidFilesLocation: { 'data-muze-solid-files-detail': null },
    muzeSolidFilesDetails: { hidden: '' },
    muzeSolidFilesDetailName: '',
    muzeSolidFilesDetailResource: '',
    muzeSolidFilesProvider: '',
    muzeSolidFilesViewStatus: '',
    muzeSolidFilesRecovery: { hidden: '' },
    muzeSolidFilesLoading: { hidden: '' },
    muzeSolidFilesStandalone: {},
    muzeSolidFilesDiscard: { hidden: '' },
    muzeSolidFilesFrame: { src: 'about:blank', hidden: '' },
    entries: [],
    url: '',
    empty: '',
    picker: { hidden: '' },
    editing: { hidden: host.task ? '' : null },
    requester: '',
    muzeSolidFilesPickerTitle: 'Select a resource',
    muzeSolidFilesPickerDescription: '',
    muzeSolidFilesPickerSave: { hidden: '' },
    muzeSolidFilesPickerFolder: { hidden: '' },
    muzeSolidFilesPickerName: { value: '' },
    muzeSolidFilesPickerStatus: '',
    pickerEntries: [],
    swb_shareVisible: { hidden: '' },
    swb_shareResource: '',
    swb_sharePerson: '',
    swb_shareId: '',
    swb_shareDocument: '',
    swb_shareEmail: '',
    swb_sharePhone: '',
    swb_shareWebId: '',
    swb_shareStatus: ''
  },
  api: {
    EmbeddedView,
    WorkspaceBroker,
    viewResourceCapability,
    listFolder,
    readDownload,
    uploadFiles,
    AppState,
    apps,
    shell,
    browseCapability,
    browseRequest,
    selectRecipientCapability,
    readRecipient,
    readProfile,
    launchUrl,
    httpUrl,
    linkState,
    markResourceDeleted,
    parentContainer
  },
  runtime: { host }
};
const ui = simply.app(prepareDefinition(definition));
exposeDefinition(ui, sources);
ui.definition.modules = {
  fileData: {
    sourceUrl: fileDataSource,
    origin: 'apps/files/src/data.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-app-data/link-metadata.mjs'
    ]
  }
};
simply.installEvents(ui);
await ui.actions.initialize();
ui.actions.muzeSolidFilesInitializeDetails();
ui.definition.instances = {
  account: host.view
};
window.solidFiles = { host, ui };
globalThis.muzeSolidFilesApp = ui;
