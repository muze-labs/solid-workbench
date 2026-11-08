import sourceContactsDetails from '../details.html' with { type: 'text' };

export const contactEditing = {
  templates: { 'contacts-details': sourceContactsDetails },
  actions: {
    async addContact(name) {
      if (!this.runtime.store) {
        return;
      }
      const node = await this.runtime.store.collection.create({
        id: 'urn:uuid:' + crypto.randomUUID(),
        a: this.api.prefixes.vcard + 'Individual',
        vcard$fn: name,
        dcterms$modified: new Date().toISOString()
      });
      this.actions.refreshPeople();
      this.actions.selectContact(node.id);
    },
    async saveContact(id, edits) {
      const node = this.runtime.store.collection.get(id);
      this.api.applyProfileEdits(node, edits);
      await this.runtime.store.collection.save(node);
      this.actions.refreshPeople();
      this.actions.selectContact(id);
      this.runtime.host.notify(
        'Saved on this device. Use Sync with Solid to synchronize.'
      );
    },
    async deleteContact(id) {
      await this.runtime.store.collection.delete(id);
      this.actions.refreshPeople();
      this.actions.selectContact(null);
      this.runtime.host.notify('Contact marked deleted.');
    },
    async synchronizeContacts() {
      const session = this.runtime.host.requireSession();
      if (
        this.runtime.collectionOwner &&
        this.runtime.collectionOwner !== session.webId
      ) {
        throw new Error(
          'contacts: Reopen Contacts for the selected WebID. Previous data is retained.'
        );
      }
      if (!this.runtime.collectionOwner) {
        const resource = this.runtime.host.resource('contacts');
        const key = session.webId + ':' + resource;
        if (this.runtime.store.collection.list().length) {
          await this.api.recoverCollection(this.runtime.collectionKey, key);
        }
        this.runtime.store = await this.api.openCollection('contacts', {
          scalarPredicates: this.api.scalarPredicates,
          localKey: key
        });
        this.runtime.collectionKey = key;
        this.runtime.collectionOwner = session.webId;
        this.runtime.contactsResource = resource;
      }
      await this.runtime.store.connect(session, this.runtime.contactsResource);
      this.actions.refreshPeople();
      if (this.runtime.selected) {
        this.actions.selectContact(this.runtime.selected);
      }
      this.runtime.host.notify('Contacts synchronized with Solid.');
    }
  },
  commands: {
    newContact() {
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.new-contact-dialog')
      );
    },
    cancelNew() {
      return this.actions.muzeSolidDesignCloseDialog(
        this.container.querySelector('.new-contact-dialog')
      );
    },
    add(form) {
      const name = form.elements.name.value.trim();
      return this.runtime.host.run(async () => {
        await this.actions.addContact(name);
        form.reset();
        await this.actions.muzeSolidDesignCloseDialog(
          this.container.querySelector('.new-contact-dialog')
        );
      });
    },
    remove() {
      const id = this.runtime.selected;
      if (
        id &&
        confirm(
          'Delete this contact? A tombstone will remain in your address book.'
        )
      ) {
        return this.runtime.host.run(() => this.actions.deleteContact(id));
      }
    },
    sync() {
      return this.runtime.host.run(this.actions.synchronizeContacts, {
        network: true
      });
    }
  }
};
