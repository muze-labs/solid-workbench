import '@muze-labs/solid-app-data/simply-runtime.mjs';
import {
  edit as editCobalt,
  defaultRegistry,
  createLinkAnnotationTag,
  readFragmentsFromClipboard,
  writeFragmentsToClipboard,
  COBALT_NOTEBOOK_CLIPBOARD_MIME
} from '@muze-labs/cobalt-rich-text-note';
import { NotebookController } from '@muze-labs/cobalt-notebook';
import { shell } from '@muze-labs/solid-app-ui';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import {
  launchUrl,
  readLaunchContext
} from '@muze-labs/solid-app-data/launch.mjs';
import {
  browseCapability,
  selectionUrl
} from '@muze-labs/solid-app-data/capabilities.mjs';
import {
  exposeDefinition,
  prepareDefinition
} from '@muze-labs/solid-app-data/definition.mjs';
import { DocumentSession } from '@muze-labs/solid-app-data/document-session.mjs';
import documentSessionSource from '../../../packages/solid-app-data/src/document-session.mjs?source';
import { validateFragment } from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { NotebookDocuments } from './document.mjs';
import { DocumentCollection } from '@muze-labs/solid-app-data/document-collection.mjs';
import { CollectionPreference } from '@muze-labs/solid-app-data/collection-preference.mjs';
import { ResourceLifecycle } from '@muze-labs/solid-app-data/resource-lifecycle.mjs';
import { CollectionFileOperation } from '@muze-labs/solid-app-data/collection-file-operation.mjs';
import collectionOperationSource from '../../../packages/solid-app-data/src/collection-file-operation.mjs?source';
import { resolveResource } from '@muze-labs/solid-app-data/resource-resolution.mjs';
import documentSource from './document.mjs?source';
import {
  muzeSolidNotebook,
  muzeSolidNotebookTitle,
  muzeSolidNotebookBlockTools,
  muzeSolidNotebookRichTextTools,
  muzeSolidNotebookInteractions,
  muzeSolidNotebookCollections,
  muzeSolidCollectionBrowser
} from './features.mjs';
import sources from './features.mjs?entries';
import accountTemplate from './account-view.html?template' with { type: 'text' };
const host = shell({
  acceptLaunch: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main.querySelector('[data-notebook-app]'),
  components: {
    muzeSolidNotebook,
    muzeSolidNotebookTitle,
    muzeSolidNotebookBlockTools,
    muzeSolidNotebookRichTextTools,
    muzeSolidNotebookInteractions,
    muzeSolidNotebookCollections,
    muzeSolidCollectionBrowser
  },
  data: {
    muzeSolidNotebookTitleAttributes: {},
    muzeSolidNotebookLinkDraft: { value: '' },
    muzeSolidNotebookUrl: '',
    muzeSolidNotebookStatus: 'Opening local notebook…',
    muzeSolidNotebookStatusKind: 'busy',
    muzeSolidNotebookStatusDisplay: 'Opening local notebook…',
    muzeSolidNotebookAnnouncement: '',
    muzeSolidNotebookBlocks: [],
    muzeSolidNotebookDocuments: [],
    muzeSolidNotebookOverviewVisibility: { hidden: null },
    muzeSolidNotebookMode: { 'data-muze-solid-notebook-mode': 'overview' },
    muzeSolidNotebookEditorVisibility: { hidden: '' },
    muzeSolidCollectionEntries: [],
    muzeSolidCollectionManagementEntries: [],
    muzeSolidCollectionCategories: [],
    muzeSolidCollectionGroups: [],
    muzeSolidCollectionEntryGroups: [],
    muzeSolidNotebookCollectionVisibility: { hidden: '' },
    muzeSolidNotebookOperationVisibility: { hidden: '' },
    muzeSolidNotebookBusy: { disabled: null },
    muzeSolidNotebookLocked: { inert: null },
    muzeSolidNotebookBlockTools: [],
    muzeSolidNotebookBlockToolbar: {
      style: 'visibility:hidden;',
      inert: '',
      'aria-hidden': 'true'
    }
  },
  api: {
    DocumentSession,
    editCobalt,
    NotebookController,
    NotebookDocuments,
    DocumentCollection,
    CollectionPreference,
    ResourceLifecycle,
    CollectionFileOperation,
    resolveResource,
    WorkspaceBroker,
    launchUrl,
    readLaunchContext,
    browseCapability,
    selectionUrl,
    defaultRegistry,
    createLinkAnnotationTag,
    readFragmentsFromClipboard,
    writeFragmentsToClipboard,
    validateFragment,
    COBALT_NOTEBOOK_CLIPBOARD_MIME
  },
  runtime: { host, busy: false }
};
const ui = simply.app(prepareDefinition(definition));
exposeDefinition(ui, sources);
host.inspectApp = ui;
ui.definition.modules = {
  collectionFileOperation: {
    sourceUrl: collectionOperationSource,
    origin: 'packages/solid-app-data/src/collection-file-operation.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  documentSession: {
    sourceUrl: documentSessionSource,
    origin: 'packages/solid-app-data/src/document-session.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  documents: {
    sourceUrl: documentSource,
    origin: 'apps/notebook/src/document.mjs',
    dependencies: ['@muze-labs/solid-workspace', '@muze-labs/solid-app-data']
  }
};
simply.installEvents(ui);
globalThis.muzeSolidNotebookApp = ui;
try {
  await ui.actions.muzeSolidNotebookInitialize();
}
catch (error) {
  ui.actions.muzeSolidNotebookReport(
    error.message + ' Local notebooks are retained.'
  );
}
