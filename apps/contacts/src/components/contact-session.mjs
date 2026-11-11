import styles from './contact-session.css' with { type: 'text' };
export const contactSession = {
  styles: { 'swb-contact-layout': styles },
  commands: {
    swb_recoverContacts() {
      return this.runtime.host.run(async () => {
        await this.api.recoverCollection(
          'contacts',
          this.runtime.collectionKey
        );
        this.runtime.store = await this.api.openCollection('contacts', {
          scalarPredicates: this.api.scalarPredicates,
          localKey: this.runtime.collectionKey
        });
        this.actions.refreshPeople();
        this.runtime.host.notify(
          'Previous device contacts imported. Original data retained.'
        );
      });
    }
  },
  actions: {
    swb_contactsResource() {
      const host = this.runtime.host;
      const owner = host.selectedWebId || 'anonymous';
      const workspace = host.workspaceContext?.id || 'standalone';
      const cacheKey = 'solid-apps.contacts-resource:' + owner + ':' + workspace;
      const configured = host.workspaceContext?.settings.contactsResource ??
        host.preferences.contactsResource;
      let resource = localStorage.getItem(cacheKey) || 'contacts';
      if (host.session || configured) {
        resource = host.resource('contacts');
      }
      // Remember the local dataset's address, not a copy of its native RDF.
      localStorage.setItem(cacheKey, resource);
      return resource;
    },
    async initialize() {
      this.actions.initializeList();
      this.runtime.widget = this.api.profileView(
        this.container.querySelector('.swb-contact-profile'),
        {
          app: this,
          emptyText: 'Select a contact to view their profile.',
          onChange: (...args) => this.actions.publish(...args)
        }
      );
      await this.runtime.host.ready;
      await this.runtime.host.run(async () => {
        const owner = this.runtime.host.selectedWebId || 'anonymous';
        const resource = this.actions.swb_contactsResource();
        this.runtime.collectionKey = owner + ':' + resource;
        this.runtime.collectionOwner = this.runtime.host.selectedWebId || '';
        this.runtime.contactsResource = resource;
        this.runtime.store = await this.api.openCollection('contacts', {
          scalarPredicates: this.api.scalarPredicates,
          localKey: this.runtime.collectionKey
        });
        this.actions.refreshPeople();
      });
      this.runtime.host.onContext = async () => {
        const owner = this.runtime.host.selectedWebId || 'anonymous';
        const resource = this.actions.swb_contactsResource();
        const key = owner + ':' + resource;
        if (this.runtime.collectionKey === key) {
          return;
        }
        this.runtime.collectionKey = key;
        this.runtime.collectionOwner = this.runtime.host.selectedWebId || '';
        this.runtime.contactsResource = resource;
        this.runtime.store = await this.api.openCollection('contacts', {
          scalarPredicates: this.api.scalarPredicates,
          localKey: key
        });
        this.actions.refreshPeople();
      };
      this.runtime.host.onConnect = () =>
        this.runtime.host.message(
          'Connected. Choose Sync with Solid to attach your address book.'
        );
      this.runtime.appState = new this.api.AppState();
      this.runtime.host.manage({
        getState: (...args) => this.actions.captureState(...args),
        restoreState: (...args) => this.actions.restoreState(...args)
      });
    },
    captureState() {
      const state = this.runtime.appState;
      state.set(this.api.apps + 'selected', this.runtime.selected, 'iri');
      state.set(this.api.apps + 'filter', this.data.search);
      this.api.writeDraft(state, this.runtime.widget.draft());
      return state.snapshot();
    },
    restoreState(snapshot) {
      const state = this.runtime.appState;
      state.restore(snapshot);
      this.actions.setSearch(state.read(this.api.apps + 'filter'));
      this.actions.selectContact(
        state.read(this.api.apps + 'selected', 'iri') || null
      );
      this.runtime.widget.restoreDraft(this.api.readDraft(state));
    },
    cleanup() {
      this.runtime.widget.destroy();
      this.api.destroy(this.runtime.listEffect);
      for (const signal of this.runtime.people.effects.slice(1)) {
        this.api.destroy(signal);
      }
    }
  }
};
