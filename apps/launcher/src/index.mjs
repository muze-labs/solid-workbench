import * as backgrounds from './backgrounds.mjs';
import backgroundSource from './backgrounds.mjs' with { type: 'text' };
import manifestSource from './manifests.mjs' with { type: 'text' };
import { readApplicationManifest } from './manifests.mjs';
import * as directory from '@muze-labs/solid-app-data/workspace-directory.mjs';
import { installEvents } from '@muze-labs/simplyflow-events';
import {
  muzeSolidDesignDialog,
  muzeSolidDesignListDetails,
  muzeSolidDesignDropdown
} from '@muze-labs/solid-design';
import shortcutSource from './shortcuts.mjs' with { type: 'text' };
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
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
  shortcutLaunch,
  applyLaunchOverride,
  overridePredicate,
  applyAnonymousLaunch,
  applyIconOverride,
  anonymousPredicate
} from './shortcuts.mjs';
import { app } from '@muze-labs/simplyflow/app';
import {
  workspaceControls,
  workspaceSettingsService,
  workspaceHome,
  workspaceMenu,
  launcherBackground,
  resourceSelection,
  shortcuts,
  lifecycle
} from './features.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
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
    muzeSolidDesignDialog,
    muzeSolidDesignListDetails,
    muzeSolidDesignDropdown,
    workspaceControls,
    workspaceSettingsService,
    workspaceHome,
    launcherBackground,
    resourceSelection,
    shortcuts,
    lifecycle
  },
  data: {
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
    profileLink: { href: '../profile/' }
  },
  api: {
    backgrounds,
    ...directory,
    readApplicationManifest,
    app,
    model,
    effect,
    destroy,
    from,
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
    shortcutLaunch,
    applyLaunchOverride,
    overridePredicate,
    applyAnonymousLaunch,
    applyIconOverride,
    anonymousPredicate
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
installEvents(ui);
ui.definition.modules = {
  backgrounds: {
    source: backgroundSource,
    origin: 'apps/launcher/src/backgrounds.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  manifests: {
    source: manifestSource,
    origin: 'apps/launcher/src/manifests.mjs',
    dependencies: ['@muze-labs/solid-app-data']
  },
  shortcuts: {
    source: shortcutSource,
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
