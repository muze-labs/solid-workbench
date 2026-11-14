import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect, signal } from '@muze-labs/simplyflow/state';
import { installEvents } from '@muze-labs/simplyflow-events';
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
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import {
  browseCapability,
  selectionUrl
} from '@muze-labs/solid-app-data/capabilities.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { validateFragment } from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { NotebookDocuments } from './document.mjs';
import documentSource from './document.mjs?source';
import {
  muzeSolidNotebook,
  muzeSolidNotebookTitle,
  muzeSolidNotebookBlockTools,
  muzeSolidNotebookRichTextTools,
  muzeSolidNotebookInteractions
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
    muzeSolidNotebookInteractions
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
    model,
    effect,
    signal,
    editCobalt,
    NotebookController,
    NotebookDocuments,
    WorkspaceBroker,
    launchUrl,
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
const ui = app(definition);
exposeDefinition(ui, definition, sources);
ui.definition.modules = {
  documents: {
    sourceUrl: documentSource,
    origin: 'apps/notebook/src/document.mjs',
    dependencies: ['@muze-labs/solid-workspace', '@muze-labs/solid-app-data']
  }
};
installEvents(ui);
globalThis.muzeSolidNotebookApp = ui;
try {
  await ui.actions.muzeSolidNotebookInitialize();
}
catch (error) {
  ui.actions.muzeSolidNotebookReport(
    error.message + ' Local notebooks are retained.'
  );
}
