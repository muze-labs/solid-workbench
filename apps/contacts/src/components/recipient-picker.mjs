import template from '../recipient-picker.html' with { type: 'text' };
import styles from './recipient-picker.css' with { type: 'text' };

export const swbRecipientPicker = {
  templates: { 'swb-contacts-recipient-picker': template },
  styles: { 'swb-contacts-recipient-picker': styles },
  commands: {
    swb_searchRecipients(input) {
      this.data.swb_recipientSearch = input.value;
      this.runtime.people.state.options.search = input.value;
    },
    swb_chooseRecipient(_button, id) {
      return this.runtime.host.run(() =>
        this.actions.swb_prepareRecipient(id));
    },
    swb_useRecipient() {
      return this.runtime.host.run(() => this.actions.swb_returnRecipient());
    },
    swb_cancelRecipient() {
      return this.runtime.host.run(() => this.actions.swb_finishRecipient({
        error: { code: 'cancelled', message: 'Recipient selection cancelled.' }
      }));
    }
  },
  actions: {
    async swb_prepareRecipient(id) {
      const request = this.runtime.recipientRequest;
      const node = this.runtime.store.collection.get(id);
      if (!request || !node || !this.api.isPerson(node)) {
        return;
      }
      this.data.swb_recipientUse = { disabled: '' };
      this.runtime.recipientId = null;
      this.runtime.preparedRecipient = null;
      const preparation = (this.runtime.recipientPreparation || 0) + 1;
      this.runtime.recipientPreparation = preparation;
      const prepared = await this.api.describeRecipient(
        node, this.runtime.contactsResource
      );
      if (this.runtime.recipientRequest !== request ||
          this.runtime.recipientPreparation !== preparation) {
        return;
      }
      this.runtime.recipientId = id;
      this.runtime.preparedRecipient = prepared;
      this.data.swb_recipientSelected = this.api.profileLabel(node) + ' — ' + id;
      this.data.swb_recipientDescription = prepared.description.turtle;
      this.data.swb_recipientUse = { disabled: null };
    },
    swb_renderRecipientPicker() {
      const pending = this.runtime.recipientRequest;
      this.data.swb_recipientPicker = {
        hidden: pending || this.runtime.host.task ? null : ''
      };
      this.data.swb_contactEditor = {
        hidden: pending || this.runtime.host.task ? '' : null
      };
      this.data.swb_recipientUse = { disabled: '' };
      this.data.swb_recipientSelected = '';
      this.data.swb_recipientDescription = '';
      this.runtime.preparedRecipient = null;
      this.runtime.recipientId = null;
    },
    swb_receiveRecipient(event) {
      let error;
      if (this.runtime.recipientRequest || this.runtime.returningRecipient) {
        error = { code: 'busy', message: 'Contacts is selecting a recipient.' };
      }
      else if (event.capability !== this.api.selectRecipientCapability ||
          !event.input || typeof event.input !== 'object' ||
          Array.isArray(event.input) ||
          Object.keys(event.input).some((key) => key !== '@context')) {
        error = { code: 'invalid', message: 'Unsupported recipient request.' };
      }
      if (error) {
        return this.runtime.host.managed.respond(event.id, { error });
      }
      this.runtime.recipientSearch = this.data.search;
      this.runtime.recipientOwner = this.runtime.host.selectedWebId || '';
      this.runtime.recipientBook = this.runtime.collectionKey;
      this.runtime.recipientRequest = event;
      this.data.swb_recipientSearch = '';
      this.runtime.people.state.options.search = '';
      this.actions.swb_renderRecipientPicker();
      this.data.swb_recipientSource = this.runtime.contactsResource;
      this.data.swb_recipientRequester = event.requester?.origin || '';
      this.data.swb_recipientStatus =
        'Showing contacts saved on this device. Uncached contacts are unavailable here.';
      this.runtime.host.managed.presentationReady();
    },
    swb_cancelRecipientRequest(event) {
      if (this.runtime.recipientRequest?.id !== event.id) {
        return;
      }
      this.runtime.recipientRequest = null;
      this.actions.setSearch(this.runtime.recipientSearch || '');
      this.actions.swb_renderRecipientPicker();
    },
    async swb_returnRecipient() {
      const request = this.runtime.recipientRequest;
      const id = this.runtime.recipientId;
      const node = id && this.runtime.store.collection.get(id);
      if (!node || !this.api.isPerson(node)) {
        throw new Error('contacts: Choose a recipient from the current book.');
      }
      if (this.runtime.recipientOwner !==
          (this.runtime.host.selectedWebId || '') ||
          this.runtime.recipientBook !== this.runtime.collectionKey) {
        await this.actions.swb_finishRecipient({ error: {
          code: 'cancelled', message: 'The account or address book changed.'
        } });
        return;
      }
      const result = await this.api.describeRecipient(
        node, this.runtime.contactsResource
      );
      if (this.runtime.recipientRequest !== request) {
        return;
      }
      if (this.runtime.recipientOwner !== (this.runtime.host.selectedWebId || '') ||
          this.runtime.recipientBook !== this.runtime.collectionKey) {
        await this.actions.swb_finishRecipient({ error: {
          code: 'cancelled', message: 'The account or address book changed.'
        } });
        return;
      }
      if (result.description.turtle !==
          this.runtime.preparedRecipient?.description.turtle) {
        throw new Error('contacts: Contact details changed. Select it again to review.');
      }
      await this.actions.swb_finishRecipient({ result });
    },
    async swb_finishRecipient(response) {
      const pending = this.runtime.recipientRequest;
      if (!pending || this.runtime.returningRecipient) {
        return;
      }
      this.runtime.returningRecipient = true;
      try {
        await this.runtime.host.managed.respond(pending.id, response);
      }
      finally {
        this.runtime.returningRecipient = false;
        this.actions.swb_cancelRecipientRequest(pending);
      }
    }
  }
};
