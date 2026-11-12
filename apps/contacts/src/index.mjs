import { describeRecipient } from '@muze-labs/solid-app-data/recipient.mjs';
import { selectRecipientCapability, recipientId }
  from '@muze-labs/solid-app-data/capabilities.mjs';
import {
  muzeSolidDesignDialog,
  muzeSolidDesignListDetails
} from '@muze-labs/solid-design';
import accountTemplate from './account-view.html?template' with { type: 'text' };
import { app } from '@muze-labs/simplyflow/app';
import { model } from '@muze-labs/simplyflow/model';
import { effect, destroy } from '@muze-labs/simplyflow/state';
import { from } from '@muze-nl/jaqt';
import { shell } from '@muze-labs/solid-app-ui';
import {
  openCollection,
  recoverCollection,
  isPerson
} from '@muze-labs/solid-app-data/collection.mjs';
import { prefixes } from '@muze-labs/solid-app-data';
import { AppState } from '@muze-labs/solid-app-data/app-state.mjs';
import { apps } from '@muze-labs/solid-app-data/state-rdf.mjs';
import { exposeDefinition } from '@muze-labs/solid-app-data/definition.mjs';
import {
  profileLabel,
  readProfile,
  applyProfileEdits,
  scalarPredicates
} from '@muze-labs/solid-profile';
import {
  profileView,
  profileComponents,
  profileDefaults,
  profileSources
} from '@muze-labs/solid-profile/view.mjs';
import { writeDraft, readDraft } from '@muze-labs/solid-profile/state.mjs';
import { contactList, contactEditing, contactSession, swbRecipientPicker } from './features.mjs';
import sources from './features.mjs?entries';

const host = shell({
  templates: { account: accountTemplate }
});
const definition = {
  container: host.main,
  components: {
    muzeSolidDesignDialog,
    muzeSolidDesignListDetails,
    ...profileComponents,
    contactList,
    contactEditing,
    contactSession,
    swbRecipientPicker
  },
  data: {
    swb_recipientPicker: { hidden: '' },
    swb_contactEditor: { hidden: host.task ? '' : null },
    swb_recipientUse: { disabled: '' },
    swb_recipientSearch: '',
    swb_recipientSource: '',
    swb_recipientRequester: '',
    swb_recipientSelected: '',
    swb_recipientDescription: '',
    swb_recipientStatus: 'Waiting for a recipient request…',
    profile: profileDefaults(),
    people: [],
    empty: '',
    search: '',
    visibility: { hidden: '' }
  },
  api: {
    app,
    selectRecipientCapability,
    recipientId,
    describeRecipient,
    model,
    effect,
    destroy,
    from,
    openCollection,
    recoverCollection,
    isPerson,
    prefixes,
    AppState,
    apps,
    profileLabel,
    readProfile,
    applyProfileEdits,
    scalarPredicates,
    profileView,
    writeDraft,
    readDraft
  },
  runtime: { host, selected: null }
};
const ui = app(definition);
exposeDefinition(ui, definition, { ...profileSources, ...sources });
await ui.actions.initialize();
ui.definition.instances = {
  account: host.view
};
window.solidContacts = {
  host,
  ui,
  get store() {
    return ui.runtime.store;
  }
};
globalThis.muzeSolidContactsApp = ui;
