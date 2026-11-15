import template from './collections.html?template' with { type: 'text' };
import styles from './collections.css' with { type: 'text' };
import { muzeSolidCollectionBrowser } from '@muze-labs/solid-app-ui/components/collection-browser.mjs';
export const muzeSolidNotebookCollections = {
  templates: { 'muze-solid-notebook-collections': template },
  styles: { 'muze-solid-notebook-collections': styles },
  components: { muzeSolidCollectionBrowser },
  api: {
    muzeSolidCollectionBrowser: {
      allLabel: 'All notebooks',
      newLabel: 'New notebook',
      create: 'muzeSolidNotebookCollectionNew',
      select: 'muzeSolidNotebookCollectionSelect',
      project: 'muzeSolidNotebookProjectCollection',
      route: 'muzeSolidNotebookCollectionRoute',
      link: 'muzeSolidNotebookCollectionLink'
    }
  },
  events: {
    muzeSolidNotebookEntryClose: {
      target() {
        return this.container.querySelector(
          '.muze-solid-notebook-entry-dialog'
        );
      },
      type: 'close',
      action: 'muzeSolidNotebookRestoreEntryFocus'
    },
    muzeSolidNotebookNavigation: {
      target() {
        return window;
      },
      type: 'popstate',
      action: 'muzeSolidNotebookNavigate'
    }
  },
  commands: {
    muzeSolidNotebookCollectionTools() {
      this.actions.muzeSolidNotebookProjectCollection();
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.muze-solid-notebook-collection-dialog')
      );
    },
    async muzeSolidNotebookCollections() {
      if (this.runtime.busy) {
        return;
      }
      if (
        !this.runtime.collection &&
        !this.runtime.collectionUrl &&
        this.runtime.documents.owner
      ) {
        await this.actions.muzeSolidNotebookCollectionRun(() =>
          this.actions.muzeSolidNotebookEnsureDefaultCollection()
        );
      }
      this.actions.muzeSolidNotebookShowOverview();
      requestAnimationFrame(() =>
        this.actions.muzeSolidNotebookShowCategories()
      );
    },
    muzeSolidNotebookCreateCollection() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const url = await this.actions.muzeSolidNotebookChooseResource(
          'save',
          'collection.ttl',
          'Create collection'
        );
        await this.actions.muzeSolidNotebookUseCollection(url, {
          create: {
            title: 'Notebooks',
            destination: new URL('./', url).href
          }
        });
        await this.actions.muzeSolidNotebookCloseCollectionDialogs();
        this.actions.muzeSolidNotebookShowOverview();
      });
    },
    muzeSolidNotebookOpenCollection() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const url = await this.actions.muzeSolidNotebookChooseResource(
          'open',
          '',
          'Open collection'
        );
        await this.actions.muzeSolidNotebookUseCollection(url);
        await this.actions.muzeSolidNotebookCloseCollectionDialogs();
        this.actions.muzeSolidNotebookShowOverview();
      });
    },
    muzeSolidNotebookDefaultCollection() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const collection = this.actions.muzeSolidNotebookRequireCollection();
        await collection.sync();
        await this.runtime.collectionPreference.save(collection.url);
        this.runtime.collectionFailure = null;
      });
    },
    muzeSolidNotebookSyncCollection() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        if (!this.runtime.collection && this.runtime.collectionUrl) {
          const pending =
            this.runtime.collectionPreference.pending ===
            this.runtime.collectionUrl;
          await this.actions.muzeSolidNotebookUseCollection(
            this.runtime.collectionUrl,
            pending
              ? {
                  create: {
                    title: 'Notebooks',
                    destination: new URL('./', this.runtime.collectionUrl).href
                  }
                }
              : undefined
          );
          await this.runtime.collection.sync();
        }
        else {
          await this.actions.muzeSolidNotebookRequireCollection().sync();
        }
        const preference = this.runtime.collectionPreference;
        if (
          !preference.value &&
          preference.pending === this.runtime.collection?.url
        ) {
          const selected = await preference.save(preference.pending, {
            onlyIfMissing: true
          });
          if (selected !== this.runtime.collection.url) {
            await this.actions.muzeSolidNotebookUseCollection(selected);
          }
        }
        this.runtime.collectionFailure = null;
      });
    },
    muzeSolidNotebookRenameCollection(input) {
      if (!input.value.trim()) {
        input.setCustomValidity('Choose a collection title.');
        return;
      }
      input.setCustomValidity('');
      return this.actions.muzeSolidNotebookEditCollection((collection) =>
        collection.rename(input.value)
      );
    },
    muzeSolidNotebookCollectionDestination() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const url = await this.actions.muzeSolidNotebookChooseResource(
          'resource',
          '',
          'Choose creation folder'
        );
        await this.actions
          .muzeSolidNotebookRequireCollection()
          .setDestination(url);
      });
    },
    async muzeSolidNotebookCollectionNew() {
      const created = await this.commands.call('muzeSolidNotebookNew');
      if (!created) {
        await this.commands.call('muzeSolidNotebookCollectionTools');
      }
      return created;
    },
    muzeSolidNotebookCollectionAdd() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const url = await this.actions.muzeSolidNotebookChooseResource(
          'open',
          '',
          'Add existing notebook'
        );
        await this.actions.muzeSolidNotebookRequireCollection().addDocument({
          document: url,
          title: new URL(url).pathname.split('/').at(-1),
          kind: 'cobalt.notebook',
          managed: false
        });
      });
    },
    muzeSolidNotebookCollectionAddCurrent() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const documents = this.runtime.documents;
        if (!documents.url && !documents.target) {
          throw new Error(
            'notebook: Save this local notebook before adding it to a collection.'
          );
        }
        await this.actions.muzeSolidNotebookRequireCollection().addDocument({
          document: documents.url || documents.target,
          title: documents.title,
          kind: 'cobalt.notebook',
          managed: Boolean(documents.target)
        });
      });
    },
    muzeSolidNotebookCollectionFilter(element) {
      this.runtime.collectionList.state.options.search = element.value;
    },
    muzeSolidNotebookCollectionGroupFilter(element) {
      this.runtime.collectionList.state.options.group = element.value;
    },
    muzeSolidNotebookCollectionCreateGroup(form) {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        await this.actions
          .muzeSolidNotebookRequireCollection()
          .addGroup(form.elements.title.value);
        form.reset();
      });
    },
    muzeSolidNotebookCollectionAssignGroup(select) {
      return this.actions.muzeSolidNotebookEditCollection(() => {
        const entry = this.actions.muzeSolidNotebookCollectionEntry(
          this.runtime.collectionEntry
        );
        const group = select.value;
        if (!group) {
          return;
        }
        return this.runtime.collection.setGroups(entry.id, [
          ...new Set([...entry.groups, group])
        ]);
      });
    },
    muzeSolidNotebookCollectionClearGroups() {
      return this.actions.muzeSolidNotebookCollectionRun(() =>
        this.actions
          .muzeSolidNotebookRequireCollection()
          .setGroups(this.runtime.collectionEntry, [])
      );
    },
    async muzeSolidNotebookCollectionSelect(element, id) {
      const selected = await this.actions.muzeSolidNotebookCollectionRun(
        async () => {
          await this.actions.muzeSolidNotebookOpenCollectionEntry(id);
        }
      );
      if (selected) {
        this.actions.muzeSolidNotebookShowEditor();
      }
    },
    muzeSolidNotebookCollectionEntry(element, id) {
      const entry = this.actions.muzeSolidNotebookCollectionEntry(id);
      this.runtime.collectionEntry = id;
      this.data.muzeSolidNotebookEntryTitle = entry.title;
      this.data.muzeSolidNotebookEntryUrl = entry.document;
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.muze-solid-notebook-entry-dialog')
      );
    },
    muzeSolidNotebookCollectionRefresh() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const entry = this.actions.muzeSolidNotebookCollectionEntry(
          this.runtime.collectionEntry
        );
        await this.runtime.documents.load(
          this.runtime.host.requireSession(),
          entry.document
        );
        await this.runtime.collection.updateSummary(
          entry.id,
          this.runtime.documents.title
        );
        this.actions.muzeSolidNotebookProject({ focusFirst: true });
        this.actions.muzeSolidNotebookShowEditor();
        this.actions.muzeSolidNotebookCollectionRoute(entry.document);
        await this.actions.muzeSolidNotebookCloseCollectionDialogs();
      });
    },
    muzeSolidNotebookCollectionRemove() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        await this.actions
          .muzeSolidNotebookRequireCollection()
          .removeReference(this.runtime.collectionEntry);
        await this.actions.muzeSolidDesignCloseDialog(
          this.container.querySelector('.muze-solid-notebook-entry-dialog')
        );
      });
    },
    muzeSolidNotebookCollectionMove() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const entry = this.actions.muzeSolidNotebookCollectionEntry(
          this.runtime.collectionEntry
        );
        const target = await this.actions.muzeSolidNotebookChooseResource(
          'save',
          new URL(entry.document).pathname.split('/').at(-1),
          'Move notebook to'
        );
        if (
          !confirm(
            'Move this file to ' +
              target +
              '? Compatible apps can follow the old address to the new file.'
          )
        ) {
          return;
        }
        await this.actions.muzeSolidNotebookStartOperation(
          'move',
          entry,
          target
        );
      });
    },
    muzeSolidNotebookCollectionDelete() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        const entry = this.actions.muzeSolidNotebookCollectionEntry(
          this.runtime.collectionEntry
        );
        if (
          !confirm(
            'Permanently delete ' +
              entry.title +
              '? This removes the Pod file. Other links to it will stop working. There is no recovery copy. Local drafts are retained.'
          )
        ) {
          return;
        }
        await this.actions.muzeSolidNotebookStartOperation('delete', entry);
      });
    },
    muzeSolidNotebookOperationRetry() {
      return this.actions.muzeSolidNotebookCollectionRun(async () => {
        await this.runtime.fileOperation.retry();
        await this.actions.muzeSolidNotebookFinishOperation();
      });
    },
    muzeSolidNotebookOperationCancel() {
      return this.actions.muzeSolidNotebookCollectionRun(() =>
        this.runtime.fileOperation.cancel()
      );
    }
  },
  actions: {
    async muzeSolidNotebookOpenCollectionEntry(id) {
      await this.actions.muzeSolidNotebookFlush();
      const entry = this.actions.muzeSolidNotebookCollectionEntry(id);
      const documents = this.runtime.documents;
      let url = entry.document;
      let selectionURI = entry.document;
      // Cached drafts stay available even when metadata cannot be reached.
      if (!documents.hasCached(url)) {
        const session = this.runtime.host.requireSession();
        const result = await session.perform(
          () => this.api.resolveResource(session.client, url),
          { interactive: false }
        );
        if (result.status !== 'available') {
          throw new Error(
            'notebook: This file has been deleted. Its collection reference is retained.'
          );
        }
        url = result.current;
        if (url !== entry.document && !result.temporary) {
          await this.runtime.collection.repairReference(entry.id, url);
          selectionURI = url;
        }
      }
      await documents.openCached(this.runtime.host.session, url);
      await documents.rememberReference(entry.document);
      await this.runtime.collection.updateSummary(entry.id, documents.title);
      this.actions.muzeSolidNotebookProject({ focusFirst: true });
      this.actions.muzeSolidNotebookCollectionRoute(selectionURI);
    },
    async muzeSolidNotebookNavigate() {
      if (this.runtime.busy) {
        this.runtime.pendingNavigation = true;
        return;
      }
      this.runtime.collectionRouteMode = 'replace';
      try {
        await this.actions.muzeSolidNotebookCollectionRun(async () => {
          await this.actions.muzeSolidNotebookFlush();
          const launch = this.api.readLaunchContext(location.href);
          if (launch.webId && launch.webId !== this.runtime.documents.owner) {
            throw new Error(
              'notebook: Switch to the linked account before opening this address.'
            );
          }
          const member = new URLSearchParams(location.hash.slice(1)).get(
            'document'
          );
          const category =
            new URLSearchParams(location.hash.slice(1)).get('category') || '';
          const resource =
            launch.resource || (await this.runtime.collectionPreference.load());
          if (!resource) {
            this.runtime.collection = null;
            this.runtime.collectionUrl = '';
            this.actions.muzeSolidNotebookShowOverview();
            return;
          }
          try {
            await this.actions.muzeSolidNotebookUseCollection(resource);
          }
          catch (error) {
            if (!launch.resource) {
              throw error;
            }
            await this.runtime.documents.openCached(
              this.runtime.host.session,
              resource
            );
            this.runtime.collection = null;
            this.runtime.collectionUrl = '';
            this.actions.muzeSolidNotebookProject({ focusFirst: true });
            this.actions.muzeSolidNotebookShowEditor();
            return;
          }
          this.runtime.collectionList.state.options.group = category;
          this.actions.muzeSolidNotebookProjectCollection();
          const entry = this.runtime.collection
            .state()
            .entries.find(
              (entry) => !entry.deleted && entry.document === member
            );
          if (entry) {
            await this.actions.muzeSolidNotebookOpenCollectionEntry(entry.id);
            this.actions.muzeSolidNotebookShowEditor();
          }
          else {
            this.actions.muzeSolidNotebookShowOverview();
          }
        });
      }
      finally {
        this.runtime.collectionRouteMode = 'push';
      }
    },
    muzeSolidNotebookRestoreEntryFocus() {
      if (this.data.muzeSolidNotebookOverviewVisibility.hidden === '') {
        this.actions.muzeSolidNotebookMount();
        return;
      }
      const previousFocus = document.activeElement;
      requestAnimationFrame(() => {
        if (
          document.activeElement !== previousFocus &&
          document.activeElement !== document.body
        ) {
          return;
        }
        const index = this.runtime.collectionList.view.current.findIndex(
          (entry) => entry.id === this.runtime.collectionEntry
        );
        const buttons = this.container.querySelectorAll(
          '[data-simply-command="muzeSolidNotebookCollectionEntry"]'
        );
        const target =
          buttons[index] ||
          (this.container.querySelector(
            '.muze-solid-notebook-collection-dialog'
          ).open
            ? this.container.querySelector(
                '#muze-solid-notebook-collection-options-heading'
              )
            : this.container.querySelector(
                '.muze-solid-collection-browser-categories [aria-current="page"]'
              ));
        target.focus();
      });
    },
    muzeSolidNotebookShowOverview() {
      const previousFocus = document.activeElement;
      this.actions.muzeSolidNotebookResetTools();
      this.runtime.controller.clearSelection();
      this.runtime.active = null;
      this.actions.muzeSolidNotebookProjectCollection();
      this.runtime.documentsList.state.data = this.runtime.documents.entries();
      this.data.muzeSolidNotebookMode = {
        'data-muze-solid-notebook-mode': 'overview'
      };
      this.data.muzeSolidNotebookEditorVisibility = { hidden: '' };
      this.data.muzeSolidNotebookOverviewVisibility = { hidden: null };
      if (this.runtime.collection) {
        this.actions.muzeSolidNotebookCollectionRoute();
      }
      this.actions.muzeSolidNotebookUpdateDocumentTools();
      document.title = this.runtime.collection?.state().title || 'Notebook';
      this.actions.muzeSolidNotebookReport(
        this.data.muzeSolidNotebookCollectionMessage,
        this.runtime.collectionFailure ||
          this.runtime.collection?.error ||
          !this.runtime.collection
          ? 'attention'
          : this.runtime.collection.dirty
            ? 'local'
            : 'synced'
      );
      requestAnimationFrame(() => {
        if (
          document.activeElement === previousFocus ||
          document.activeElement === document.body
        ) {
          this.container
            .querySelector('.muze-solid-collection-browser-details')
            ?.scrollIntoView({ block: 'nearest' });
        }
      });
    },
    muzeSolidNotebookShowEditor() {
      this.data.muzeSolidNotebookMode = {
        'data-muze-solid-notebook-mode': 'editor'
      };
      this.data.muzeSolidNotebookOverviewVisibility = { hidden: '' };
      this.data.muzeSolidNotebookEditorVisibility = { hidden: null };
      this.actions.muzeSolidNotebookUpdateDocumentTools();
      document.title =
        this.runtime.documents.title.trim() || 'Untitled notebook';
      requestAnimationFrame(() => this.actions.muzeSolidNotebookMount());
    },
    muzeSolidNotebookUpdateDocumentTools() {
      const overview =
        this.data.muzeSolidNotebookOverviewVisibility.hidden !== '';
      for (const tool of this.runtime.host.view.data.muzeSolidUiAppTools) {
        const documentSave = ['Save', 'SaveAs'].includes(tool.command);
        tool.attributes.disabled =
          tool.command !== 'Status' &&
          (this.runtime.busy || (overview && documentSave))
            ? ''
            : null;
      }
    },
    async muzeSolidNotebookEnsureDefaultCollection() {
      const preference = this.runtime.collectionPreference;
      const url = await preference.load();
      if (url) {
        await this.actions.muzeSolidNotebookUseCollection(url);
        return;
      }
      if (preference.error) {
        if (preference.pending) {
          try {
            await this.actions.muzeSolidNotebookUseCollection(
              preference.pending
            );
          }
          catch {
            // Preserve the reserved URI even when its local cache is absent.
          }
        }
        throw preference.error;
      }
      const session = this.runtime.host.requireSession();
      const destination = session.storage[0];
      if (!destination) {
        throw new Error(
          'notebook: Your profile does not advertise storage for a default collection. Choose Create collection or Open collection.'
        );
      }
      const next =
        preference.pending ||
        new URL(
          'notebook-collection-' + crypto.randomUUID() + '.ttl',
          destination
        ).href;
      await preference.prepareDefault(next);
      await this.actions.muzeSolidNotebookUseCollection(next, {
        create: { title: 'Notebooks', destination }
      });
      await this.runtime.collection.sync();
      const selected = await preference.save(next, { onlyIfMissing: true });
      if (selected !== next) {
        await this.actions.muzeSolidNotebookUseCollection(selected);
      }
    },
    muzeSolidNotebookRequireCollection() {
      if (!this.runtime.collection) {
        throw new Error('notebook: Create or open a collection first.');
      }
      return this.runtime.collection;
    },
    muzeSolidNotebookCollectionEntry(id) {
      const entry = this.actions
        .muzeSolidNotebookRequireCollection()
        .state()
        .entries.find((entry) => entry.id === id && !entry.deleted);
      if (!entry) {
        throw new Error('notebook: This collection entry is unavailable.');
      }
      return entry;
    },
    async muzeSolidNotebookInitializeCollections(owner) {
      this.runtime.collection = null;
      this.runtime.collectionUrl = '';
      this.runtime.fileOperation = await new this.api.CollectionFileOperation({
        owner,
        session: this.runtime.host.session
      }).open();
      this.runtime.collectionPreference = new this.api.CollectionPreference({
        owner,
        app: 'urn:muze:solid-app:notebook',
        session: this.runtime.host.session
      });
      const browser = this.actions.muzeSolidCollectionInitialize();
      this.runtime.collectionList = browser.entries;
      this.runtime.collectionGroups = browser.groups;
      const launch = this.runtime.host.launch?.resource;
      if (launch) {
        const address = new URLSearchParams(location.hash.slice(1));
        const member = address.get('document');
        const category = address.get('category') || '';
        const create = address.get('create') === 'notebook';
        try {
          await this.actions.muzeSolidNotebookUseCollection(launch);
        }
        catch (error) {
          try {
            await this.runtime.documents.openCached(
              this.runtime.host.session,
              launch
            );
            this.runtime.collectionUrl = '';
            this.actions.muzeSolidNotebookProject({ focusFirst: true });
            this.actions.muzeSolidNotebookProjectCollection();
            this.actions.muzeSolidNotebookShowEditor();
            return;
          }
          catch {
            this.runtime.collectionFailure = error;
            this.actions.muzeSolidNotebookProjectCollection();
            this.actions.muzeSolidNotebookShowOverview();
            return;
          }
        }
        this.runtime.collectionList.state.options.group = category;
        this.actions.muzeSolidNotebookProjectCollection();
        if (create) {
          await this.actions.muzeSolidNotebookCreateDocument();
          return;
        }
        const entry = this.runtime.collection
          .state()
          .entries.find((entry) => entry.document === member && !entry.deleted);
        if (entry) {
          await this.actions.muzeSolidNotebookOpenCollectionEntry(entry.id);
          this.actions.muzeSolidNotebookShowEditor();
        }
        else {
          this.actions.muzeSolidNotebookShowOverview();
        }
        return;
      }
      if (owner) {
        try {
          await this.actions.muzeSolidNotebookEnsureDefaultCollection();
        }
        catch (error) {
          this.runtime.collectionFailure = error;
        }
      }
      if (
        new URLSearchParams(location.hash.slice(1)).get('create') === 'notebook'
      ) {
        await this.actions.muzeSolidNotebookCreateDocument();
        return;
      }
      this.actions.muzeSolidNotebookShowOverview();
    },
    async muzeSolidNotebookUseCollection(url, options) {
      await this.actions.muzeSolidNotebookFlush();
      const documents = this.runtime.documents;
      if (url !== this.runtime.collectionUrl) {
        this.runtime.collectionList.state.options.group = '';
        this.runtime.collectionList.state.options.search = '';
      }
      this.runtime.collectionUrl = url;
      this.runtime.collection = null;
      this.runtime.collectionFailure = null;
      const collection = new this.api.DocumentCollection({
        url,
        owner: this.runtime.documents.owner,
        session: this.runtime.host.session
      });
      await collection.open(options);
      if (
        documents !== this.runtime.documents ||
        documents.owner !== this.runtime.host.selectedWebId
      ) {
        throw new Error(
          'notebook: Account changed; collection selection was not applied.'
        );
      }
      this.runtime.collection = collection;
      this.actions.muzeSolidNotebookCollectionRoute();
      this.actions.muzeSolidNotebookProjectCollection();
    },
    muzeSolidNotebookCollectionLink(
      document = '',
      create = false,
      category = this.runtime.collectionList?.state.options.group || ''
    ) {
      const url = new URL(location.href);
      const route = new URLSearchParams(url.hash.slice(1));
      for (const key of [
        'resource',
        'document',
        'create',
        'category',
        'webid'
      ]) {
        route.delete(key);
      }
      if (this.runtime.collectionUrl) {
        route.set('resource', this.runtime.collectionUrl);
      }
      if (this.runtime.documents.owner) {
        route.set('webid', this.runtime.documents.owner);
      }
      if (document) {
        route.set('document', document);
      }
      if (create) {
        route.set('create', 'notebook');
      }
      if (category) {
        route.set('category', category);
      }
      url.hash = route.toString();
      return url.href;
    },
    async muzeSolidNotebookCloseCollectionDialogs() {
      for (const selector of [
        '.muze-solid-notebook-entry-dialog',
        '.muze-solid-notebook-collection-dialog'
      ]) {
        const dialog = this.container.querySelector(selector);
        if (dialog.open) {
          await this.actions.muzeSolidDesignCloseDialog(dialog);
        }
      }
    },
    muzeSolidNotebookShowCategories() {
      const category = this.container.querySelector(
        '.muze-solid-collection-browser-categories a[aria-current="page"]'
      );
      if (category && !category.closest('[hidden]')) {
        this.commands.call('muzeSolidDesignShowList', category);
      }
    },
    muzeSolidNotebookDocumentRoute() {
      const documents = this.runtime.documents;
      const address = documents.url || documents.target;
      if (
        this.runtime.collection
          ?.state()
          .entries.some((entry) => !entry.deleted && entry.document === address)
      ) {
        this.actions.muzeSolidNotebookCollectionRoute(address);
        return;
      }
      const url = new URL(location.href);
      const route = new URLSearchParams(url.hash.slice(1));
      route.delete('document');
      route.delete('create');
      route.delete('category');
      if (documents.url) {
        route.set('resource', documents.url);
      }
      else {
        route.delete('resource');
      }
      if (documents.owner) {
        route.set('webid', documents.owner);
      }
      else {
        route.delete('webid');
      }
      url.hash = route.toString();
      if (url.href !== location.href) {
        const method =
          this.runtime.collectionRouteMode === 'push'
            ? 'pushState'
            : 'replaceState';
        history[method](null, '', url);
      }
    },
    muzeSolidNotebookCollectionRoute(documentUrl = '') {
      if (!this.runtime.collectionUrl) {
        return;
      }
      const url = this.actions.muzeSolidNotebookCollectionLink(documentUrl);
      if (url !== location.href) {
        const method =
          this.runtime.collectionRouteMode === 'push'
            ? 'pushState'
            : 'replaceState';
        history[method](null, '', url);
      }
    },
    muzeSolidNotebookProjectCollection({ preserveTitleInput = false } = {}) {
      const collection = this.runtime.collection;
      const state = collection?.state();
      if (!preserveTitleInput) {
        this.data.muzeSolidNotebookCollectionName = {
          value: state?.title || ''
        };
      }
      this.data.muzeSolidNotebookCollectionVisibility = {
        hidden: state ? null : ''
      };
      this.runtime.collectionList.state.data = (state?.entries || []).map(
        (entry) => ({
          ...entry,
          ownership: entry.managed ? 'Created here' : 'Linked file',
          actionAttributes: { 'aria-label': 'Actions for ' + entry.title }
        })
      );
      this.runtime.collectionGroups.state.data = state?.groups || [];
      const unavailable = this.runtime.collectionUrl && !collection;
      this.data.muzeSolidNotebookCollectionMessage = unavailable
        ? 'This collection is unavailable. Its reference is retained. Reconnect and retry.'
        : collection?.error?.message ||
          (state
            ? collection.dirty
              ? 'Collection changes are saved on this device. Sync to update the Pod.'
              : 'Collection is saved on this device and Pod.'
            : this.runtime.collectionFailure?.message ||
              this.runtime.collectionPreference?.error?.message ||
              'Create or open a collection, then make it your default. Local notebooks remain available through Recent.');
      const operation = this.runtime.fileOperation?.pending;
      if (this.runtime.collectionFailure) {
        this.data.muzeSolidNotebookCollectionMessage =
          this.runtime.collectionFailure.message;
      }
      this.data.muzeSolidNotebookCollectionFeedbackVisibility = {
        hidden:
          !state || this.runtime.collectionFailure || collection?.error
            ? null
            : ''
      };
      this.data.muzeSolidNotebookOperationVisibility = {
        hidden: operation ? null : ''
      };
      this.data.muzeSolidNotebookOperationMessage = operation
        ? operation.kind +
          ': ' +
          operation.source +
          ' — ' +
          operation.stage +
          '. Retry to finish; local drafts remain available.'
        : '';
    },
    async muzeSolidNotebookEditCollection(work) {
      const collection = this.actions.muzeSolidNotebookRequireCollection();
      const version = (this.runtime.collectionEditVersion || 0) + 1;
      this.runtime.collectionEditVersion = version;
      // The workspace admits and orders saves. Track its latest promise so
      // account changes and document navigation wait for local persistence.
      const pending = work(collection);
      this.runtime.collectionEdit = pending;
      try {
        await pending;
        if (
          collection === this.runtime.collection &&
          version === this.runtime.collectionEditVersion
        ) {
          this.actions.muzeSolidNotebookProjectCollection({
            preserveTitleInput: true
          });
          this.actions.muzeSolidNotebookReport(
            this.data.muzeSolidNotebookCollectionMessage,
            'local'
          );
        }
      }
      catch (error) {
        this.actions.muzeSolidNotebookReport(error.message, 'attention');
        this.data.muzeSolidNotebookCollectionMessage = error.message;
      }
      finally {
        if (this.runtime.collectionEdit === pending) {
          this.runtime.collectionEdit = null;
        }
      }
    },
    async muzeSolidNotebookCollectionRun(work) {
      const result = await this.actions.muzeSolidNotebookRun(work);
      this.actions.muzeSolidNotebookProjectCollection();
      if (!result) {
        this.data.muzeSolidNotebookCollectionMessage =
          this.data.muzeSolidNotebookStatus;
        this.data.muzeSolidNotebookCollectionFeedbackVisibility = {
          hidden: null
        };
      }
      if (
        result &&
        this.data.muzeSolidNotebookOverviewVisibility.hidden !== ''
      ) {
        const collection = this.runtime.collection;
        this.actions.muzeSolidNotebookReport(
          this.data.muzeSolidNotebookCollectionMessage,
          this.runtime.collectionFailure || collection?.error || !collection
            ? 'attention'
            : collection.dirty
              ? 'local'
              : 'synced'
        );
      }
      return result;
    },
    async muzeSolidNotebookCollectionCreateDraft() {
      const collection = this.runtime.collection;
      if (!collection) {
        return;
      }
      const documents = this.runtime.documents;
      documents.target = new URL(
        'notebook-' + crypto.randomUUID() + '.ttl',
        collection.state().destination
      ).href;
      await documents.persist();
      const entry = await collection.addDocument({
        document: documents.target,
        title: documents.title,
        kind: 'cobalt.notebook',
        managed: true
      });
      const category = this.runtime.collectionList.state.options.group;
      if (category) {
        await collection.setGroups(entry, [category]);
      }
      this.actions.muzeSolidNotebookCollectionRoute(documents.target);
      this.actions.muzeSolidNotebookProjectCollection();
    },
    async muzeSolidNotebookUpdateCollectionEntry(reserved = '', sync = true) {
      const collection = this.runtime.collection;
      const documents = this.runtime.documents;
      const entry = collection
        ?.state()
        .entries.find(
          (entry) =>
            [documents.url, reserved].includes(entry.document) && !entry.deleted
        );
      if (entry) {
        if (reserved && reserved !== documents.url) {
          await collection.repairReference(entry.id, documents.url);
        }
        await collection.updateSummary(entry.id, documents.title);
        if (sync) {
          await collection.sync();
        }
      }
    },
    async muzeSolidNotebookStartOperation(kind, entry, target = '') {
      const documents = this.runtime.documents;
      if (
        (documents.url === entry.document ||
          documents.target === entry.document) &&
        documents.dirty
      ) {
        throw new Error(
          'notebook: Save this notebook’s Pod changes before moving or deleting its file.'
        );
      }
      await this.runtime.fileOperation.begin({
        kind,
        source: entry.document,
        target,
        confirmed: true,
        collection: this.runtime.collection.url,
        entry: entry.id
      });
      await this.actions.muzeSolidNotebookFinishOperation();
    },
    async muzeSolidNotebookFinishOperation() {
      const operation = await this.runtime.fileOperation.finish({
        collection: this.runtime.collection,
        openCollection: async (url) => {
          await this.actions.muzeSolidNotebookUseCollection(url);
          return this.runtime.collection;
        },
        applyLocal: (completed) =>
          this.runtime.documents.applyFileOperation(
            completed,
            this.runtime.host.requireSession()
          )
      });
      if (!operation) {
        return;
      }
      const dialog = this.container.querySelector(
        '.muze-solid-notebook-entry-dialog'
      );
      if (dialog.open) {
        await this.actions.muzeSolidDesignCloseDialog(dialog);
      }
    },
    async muzeSolidNotebookChooseResource(mode, suggestedName, title) {
      const host = this.runtime.host;
      const session = host.requireSession();
      let broker = host.managed?.ready ? host.managed : null;
      if (!broker) {
        this.runtime.pickerBroker ||= new this.api.WorkspaceBroker({
          resolveProvider: (capability) =>
            capability === this.api.browseCapability
              ? host.preferences.browseProvider?.url
              : undefined,
          embeddedProviders: [
            {
              capability: this.api.browseCapability,
              url: new URL('../files/', location.href).href
            }
          ]
        });
        broker = this.runtime.pickerBroker;
      }
      const provider = await broker.embeddedProvider(this.api.browseCapability);
      const previous = host.capabilityBroker;
      if (broker.target) {
        host.capabilityBroker = broker;
      }
      let result;
      try {
        result = await host.muzeSolidUiInvoke(
          this.api.browseCapability,
          this.api.launchUrl(provider, { webId: this.runtime.documents.owner }),
          mode === 'save' ? { mode, suggestedName } : { mode },
          title
        );
      }
      finally {
        host.capabilityBroker = previous;
      }
      if (
        host.session !== session ||
        session.webId !== this.runtime.documents.owner
      ) {
        throw new Error(
          'notebook: Account changed; the selection was not applied.'
        );
      }
      return this.api.selectionUrl(result);
    }
  }
};
