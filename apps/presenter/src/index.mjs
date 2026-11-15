import { render as renderCobalt } from '@muze-labs/cobalt-rich-text-note';
import { validateFragment } from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import {
  createSolidMetroClient,
  requireOk,
  loadDocument
} from '@muze-labs/solid-app-data';
import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect } from '@muze-labs/simplyflow/state';
import { from, asc } from '@muze-nl/jaqt';
import { installEvents } from '@muze-labs/simplyflow-events';
import { shell } from '@muze-labs/solid-app-ui';
import {
  EmbeddedView,
  viewResourceCapability
} from '@muze-labs/solid-app-data/embedded-view.mjs';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import {
  browseCapability,
  selectionUrl
} from '@muze-labs/solid-app-data/capabilities.mjs';
import { local } from '@muze-labs/solid-workspace';
import { DocumentCollection } from '@muze-labs/solid-app-data/document-collection.mjs';
import { CollectionPreference } from '@muze-labs/solid-app-data/collection-preference.mjs';
import { ResourceLifecycle } from '@muze-labs/solid-app-data/resource-lifecycle.mjs';
import { resolveResource } from '@muze-labs/solid-app-data/resource-resolution.mjs';
import { readLaunchContext } from '@muze-labs/solid-app-data/launch.mjs';
import {
  viewTextCapability,
  createTextCapability,
  editTextCapability,
  textDraft
} from '@muze-labs/solid-app-data/text-capabilities.mjs';
import { providerCapabilities } from '@muze-labs/solid-preferences/providers.mjs';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import { httpUrl } from '@muze-labs/solid-app-data';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { DocumentSession } from '@muze-labs/solid-app-data/document-session.mjs';
import documentSessionSource from '../../../packages/solid-app-data/src/document-session.mjs?source';
import { PresenterDecks } from './deck-drafts.mjs';
import draftsSource from './deck-drafts.mjs?source';
import { DeckDocument } from './deck-data.mjs';
import deckSource from './deck-data.mjs?source';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import {
  muzeSolidPresenter,
  muzeSolidPresenterRegions,
  muzeSolidPresenterCollections,
  muzeSolidCollectionBrowser
} from './features.mjs';
import sources from './features.mjs?entries';
const host = shell({
  acceptLaunch: true,
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main.querySelector('.muze-solid-presenter'),
  components: {
    muzeSolidPresenter,
    muzeSolidPresenterRegions,
    muzeSolidPresenterCollections,
    muzeSolidCollectionBrowser
  },
  data: {
    muzeSolidPresenterOverviewVisibility: { hidden: null },
    muzeSolidPresenterEditorVisibility: { hidden: '' },
    muzeSolidPresenterCollectionMode: {
      'data-muze-solid-presenter-collection-mode': 'overview'
    },
    muzeSolidPresenterCollectionMessage: 'Opening deck collections…',
    muzeSolidPresenterOperationVisibility: { hidden: '' },
    muzeSolidCollectionEntries: [],
    muzeSolidCollectionCategories: [],
    muzeSolidPresenterEmpty: { hidden: null },
    muzeSolidPresenterBusy: { disabled: null },
    muzeSolidPresenterTitle: '',
    muzeSolidPresenterUrl: '',
    muzeSolidPresenterStatus: 'Opening local deck…',
    muzeSolidPresenterSlides: [],
    muzeSolidPresenterRegions: [],
    muzeSolidPresenterSlideTitle: '',
    muzeSolidPresenterBackgroundVisibility: { hidden: '' },
    muzeSolidPresenterPosition: '',
    muzeSolidPresenterSelection: { hidden: '' },
    muzeSolidPresenterMode: { 'data-muze-solid-presenting': null }
  },
  api: {
    local,
    loadDocument,
    DocumentCollection,
    CollectionPreference,
    ResourceLifecycle,
    resolveResource,
    readLaunchContext,
    selectionUrl,
    DocumentSession,
    renderCobalt,
    validateFragment,
    createSolidMetroClient,
    requireOk,
    model,
    effect,
    from,
    asc,
    DeckDocument,
    PresenterDecks,
    EmbeddedView,
    WorkspaceBroker,
    viewResourceCapability,
    browseCapability,
    viewTextCapability,
    createTextCapability,
    editTextCapability,
    textDraft,
    providerCapabilities,
    launchUrl,
    httpUrl,
    AppState,
    apps
  },
  runtime: { host, views: new Map(), selected: '', busy: false }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
ui.definition.modules = {
  documentSession: {
    sourceUrl: documentSessionSource,
    origin: 'packages/solid-app-data/src/document-session.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  deckDrafts: {
    sourceUrl: draftsSource,
    origin: 'apps/presenter/src/deck-drafts.mjs',
    dependencies: ['@muze-labs/solid-app-data', '@muze-labs/solid-workspace']
  },
  deckData: {
    sourceUrl: deckSource,
    origin: 'apps/presenter/src/deck-data.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-workspace',
      '@muze-nl/jaqt'
    ]
  }
};
installEvents(ui);
await ui.actions.muzeSolidPresenterInitialize();
globalThis.muzeSolidPresenterApp = ui;
