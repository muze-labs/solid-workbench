import { app } from '@muze-labs/simplyflow/app';
import { installEvents } from '@muze-labs/simplyflow-events';
import { shell } from '@muze-labs/solid-app-ui';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import { PreferenceState } from '@muze-labs/solid-preferences/state.mjs';
import { PreferenceDrafts } from '@muze-labs/solid-preferences/drafts.mjs';
import { announcePreferences } from '@muze-labs/solid-preferences/consumer.mjs';
import { editPreferenceSectionCapability } from '@muze-labs/solid-app-data/preference-sections.mjs';
import { muzeSolidFilesSettingsView } from './settings-view.mjs';
import sources from './settings-view.mjs?entries';
const host = shell({ acceptLaunch: true, embeddedContentOnly: true });
const definition = {
  container: host.main,
  components: { muzeSolidFilesSettingsView },
  api: {
    PreferenceState,
    PreferenceDrafts,
    announcePreferences,
    editPreferenceSectionCapability
  },
  runtime: { host }
};
const ui = app(definition);
exposeDefinition(ui, definition, sources);
installEvents(ui);
await ui.actions.muzeSolidFilesSettingsStart();
globalThis.muzeSolidFilesSettingsApp = ui;
