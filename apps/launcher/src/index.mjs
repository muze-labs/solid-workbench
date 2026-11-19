import '@muze-labs/solid-app-data/simply-runtime.mjs';
import '@muze-labs/solid-app-data/jaqt-runtime.mjs';
import * as shortcutMetadata from './shortcut-metadata.mjs';
import shortcutMetadataSource from './shortcut-metadata.mjs?source';
import { launcherGroups } from './groups.mjs';
import groupSource from './groups.mjs?source';
import { AppCatalog } from './catalog.mjs';
import catalogSource from './catalog.mjs?source';
import { providerCapabilities } from '@muze-labs/solid-preferences/providers.mjs';
import { viewResourceCapability } from '@muze-labs/solid-app-data/embedded-view.mjs';
import * as backgrounds from './backgrounds.mjs';
import backgroundSource from './backgrounds.mjs?source';
import manifestSource from './manifests.mjs?source';
import { readApplicationManifest } from './manifests.mjs';
import * as directory from '@muze-labs/solid-app-data/workspace-directory.mjs';
import {
  solidDialog,
  solidListDetails,
  solidDropdown,
  solidToolbar
} from '@muze-labs/solid-design';
import shortcutSource from './shortcuts.mjs?source';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { shell } from '@muze-labs/solid-app-ui';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import { WorkspaceState } from '@muze-labs/solid-app-data/workspace-state.mjs';
import {
  editProfileCapability,
  editPreferencesCapability,
  browseCapability,
  selectRecipientCapability,
  selectionUrl
} from '@muze-labs/solid-app-data/capabilities.mjs';
import {
  openCollection,
  recoverCollection
} from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes, valueAt, idOf, httpUrl } from '@muze-labs/solid-app-data';
import {
  launchUrl,
  parseLaunchUrl
} from '@muze-labs/solid-app-data/launch.mjs';
import {
  shortcutOrder,
  applyShortcutOrder,
  shortcutOrderPredicate,
  shortcutLaunch,
  applyLaunchOverride,
  overridePredicate,
  applyAnonymousLaunch,
  applyIconOverride,
  anonymousPredicate,
  webShortcutPredicate
} from './shortcuts.mjs';
import {
  workspaceControls,
  workspaceSettingsService,
  workspaceHome,
  workspaceMenu,
  launcherBackground,
  resourceSelection,
  shortcuts,
  muzeSolidLauncherCatalog,
  lifecycle
} from './features.mjs';
import {
  exposeDefinition,
  prepareDefinition
} from '@muze-labs/solid-app-data/definition.mjs';
import sources from './features.mjs?entries';
const host = shell({
  accountOptions: {
    components: { workspaceMenu },
    sources: { workspaceMenu: sources.workspaceMenu }
  },
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main,
  components: {
    solidDialog,
    solidListDetails,
    solidToolbar,
    solidDropdown,
    workspaceControls,
    workspaceSettingsService,
    workspaceHome,
    launcherBackground,
    resourceSelection,
    shortcuts,
    muzeSolidLauncherCatalog,
    lifecycle
  },
  data: {
    muzeSolidLauncherDropScreen: {hidden: ''},
    muzeSolidLauncherDragScreens: {class: 'muze-solid-launcher-screens'},
    muzeSolidLauncherPrevious: {hidden: ''},
    muzeSolidLauncherNext: {hidden: ''},
    muzeSolidLauncherNavigation: {hidden: ''},
    muzeSolidCatalogApps: [],
    muzeSolidCatalogSources: [],
    muzeSolidCatalogStatus: '',
    muzeSolidCatalogCategories: [],
    muzeSolidCatalogCategoryTitle: 'All apps',
    muzeSolidCatalogAppsPanel: { hidden: null },
    muzeSolidCatalogManualPanel: { hidden: '' },
    muzeSolidCatalogSourcesPanel: { hidden: '' },
    muzeSolidCatalogInfoPanel: { hidden: '' },
    muzeSolidCatalogInfo: {
      name: '',
      text: '',
      screenshot: { src: null, hidden: '' },
      add: {}
    },
    muzeSolidCatalogEmpty: '',
    muzeSolidCatalogBusy: { disabled: null },
    swb_background: { src: null, hidden: '' },
    swb_workspaceTitle: 'Solid Workbench',
    swb_workspaceMenu: [],
    swb_restoreApps: { hidden: '' },
    shortcuts: [],
    empty: '',
    resource: '',
    pickerMessage: '',
    pickState: { 'aria-disabled': 'false' },
    cancelState: { hidden: '' },
    workspaceEntries: [],
    workspaceMessage: 'Loading workspace…',
    workspaceButtons: { disabled: null },
    conflictAction: { hidden: '' },
    conflictReview: { hidden: '' },
    localVersion: '',
    podVersion: '',
    contactsLink: { href: '../contacts/' },
    filesLink: { href: '../files/' },
    presenterLink: { href: '../presenter/' },
    notebookLink: { href: '../notebook/' },
    profileLink: { href: '../profile/' }
  },
  api: {
    AppCatalog,
    viewResourceCapability,
    providerCapabilities,
    backgrounds,
    ...directory,
    readApplicationManifest,
    shell,
    WorkspaceBroker,
    WorkspaceState,
    editProfileCapability,
    editPreferencesCapability,
    browseCapability,
    selectRecipientCapability,
    selectionUrl,
    openCollection,
    recoverCollection,
    prefixes,
    valueAt,
    idOf,
    httpUrl,
    launchUrl,
    parseLaunchUrl,
    launcherGroups: { ...launcherGroups },
    shortcutMetadata,
    shortcutOrder,
    applyShortcutOrder,
    shortcutOrderPredicate,
    shortcutLaunch,
    applyLaunchOverride,
    overridePredicate,
    applyAnonymousLaunch,
    applyIconOverride,
    anonymousPredicate,
    webShortcutPredicate
  },
  runtime: { host }
};
const ui = simply.app(prepareDefinition(definition));
exposeDefinition(ui, sources);
host.inspectApp = ui;
simply.installEvents(ui);
ui.definition.modules = {
  launcherGroups: {
    sourceUrl: groupSource,
    origin: 'apps/launcher/src/groups.mjs',
    dependencies: ['oldm', './shortcuts.mjs', '@muze-labs/solid-app-data']
  },
  shortcutMetadata: {
    sourceUrl: shortcutMetadataSource,
    origin: 'apps/launcher/src/shortcut-metadata.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-app-data/url.mjs',
      '@muze-labs/solid-preferences/providers.mjs'
    ]
  },
  catalog: {
    sourceUrl: catalogSource,
    origin: 'apps/launcher/src/catalog.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-app-data/state-rdf.mjs',
      '@muze-labs/solid-workspace',
      './manifests.mjs'
    ]
  },
  backgrounds: {
    sourceUrl: backgroundSource,
    origin: 'apps/launcher/src/backgrounds.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  manifests: {
    sourceUrl: manifestSource,
    origin: 'apps/launcher/src/manifests.mjs',
    dependencies: ['@muze-labs/solid-app-data', './shortcuts.mjs']
  },
  shortcuts: {
    sourceUrl: shortcutSource,
    origin: 'apps/launcher/src/shortcuts.mjs',
    dependencies: [
      '@muze-labs/solid-app-data',
      '@muze-labs/solid-app-data/launch.mjs'
    ]
  }
};
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view
};
window.solidLauncher = {
  host,
  ui,
  get workspace() {
    return ui.runtime.workspace;
  },
  get persistence() {
    return ui.runtime.persistence;
  },
  get store() {
    return ui.runtime.store;
  }
};
globalThis.muzeSolidLauncherApp = ui;
