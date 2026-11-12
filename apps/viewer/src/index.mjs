import { app } from '@muze-labs/simplyflow/app';
import { shell } from '@muze-labs/solid-app-ui';
import {
  createSolidMetroClient,
  requireOk,
  httpUrl
} from '@muze-labs/solid-app-data';
import {
  viewResourceCapability,
  viewAppearance,
  viewPresentation
} from '@muze-labs/solid-app-data/embedded-view.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { installEvents } from '@muze-labs/simplyflow-events';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { muzeSolidViewer } from './features.mjs';
import sources from './features.mjs?entries';
const host = shell({
  acceptLaunch: true,
  embeddedContentOnly: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main.querySelector('.muze-solid-viewer'),
  components: { muzeSolidViewer },
  data: {
    muzeSolidViewerResource: host.launch?.resource || '',
    muzeSolidViewerStatus: 'Choose a text or image resource.',
    muzeSolidViewerText: '',
    muzeSolidViewerAppearance: { style: '' },
    muzeSolidViewerImage: { hidden: '' },
    muzeSolidViewerStandalone: { hidden: host.task ? '' : null }
  },
  api: {
    createSolidMetroClient,
    requireOk,
    httpUrl,
    viewResourceCapability,
    viewAppearance,
    viewPresentation
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
installEvents(ui);
await ui.actions.muzeSolidViewerInitialize();
globalThis.muzeSolidViewerApp = ui;
