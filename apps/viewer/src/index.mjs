import { signal, effect, destroy } from '@muze-labs/simplyflow/state';
import {
  edit as editCobalt,
  render as renderCobalt,
  createLinkAnnotationTag,
  readFragmentFromClipboard
} from '@muze-labs/cobalt-rich-text-note';
import { StateGraph } from '@muze-labs/solid-app-data/state-rdf.mjs';
import {
  readFragment,
  writeFragment,
  validateFragment
} from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { local } from '@muze-labs/solid-workspace';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import {
  viewTextCapability,
  createTextCapability,
  editTextCapability,
  textDraft
} from '@muze-labs/solid-app-data/text-capabilities.mjs';
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
import {
  muzeSolidViewer,
  muzeSolidTextEditor,
  muzeSolidCobaltEditor
} from './features.mjs';
import sources from './features.mjs?entries';
const host = shell({
  acceptLaunch: true,
  embeddedContentOnly: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main.querySelector('.muze-solid-viewer'),
  components: { muzeSolidViewer, muzeSolidTextEditor, muzeSolidCobaltEditor },
  data: {
    muzeSolidCobaltVisibility: { hidden: '' },
    muzeSolidCobaltFragment: { text: '', annotations: [] },
    muzeSolidCobaltTools: { hidden: '' },
    muzeSolidCobaltLinkPanel: { hidden: '' },
    muzeSolidCobaltDockLabel: 'Dock',
    muzeSolidCobaltStatus: '',
    muzeSolidCobaltBold: {},
    muzeSolidCobaltItalic: {},
    muzeSolidViewerDisplay: { hidden: null },
    muzeSolidTextVisibility: { hidden: '' },
    muzeSolidTextTitle: '',
    muzeSolidTextDraft: '',
    muzeSolidTextStatus: '',
    muzeSolidViewerResource: host.launch?.resource || '',
    muzeSolidViewerStatus: 'Choose a text or image resource.',
    muzeSolidViewerText: '',
    muzeSolidViewerAppearance: { style: '' },
    muzeSolidViewerImage: { hidden: '' },
    muzeSolidViewerStandalone: { hidden: host.task ? '' : null }
  },
  api: {
    signal,
    effect,
    destroy,
    editCobalt,
    renderCobalt,
    createLinkAnnotationTag,
    readFragmentFromClipboard,
    StateGraph,
    readFragment,
    writeFragment,
    validateFragment,
    local,
    AppState,
    apps,
    viewTextCapability,
    createTextCapability,
    editTextCapability,
    textDraft,
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
