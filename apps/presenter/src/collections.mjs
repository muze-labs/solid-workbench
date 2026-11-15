import template from './collections.html?template' with { type: 'text' };
import styles from './collections.css' with { type: 'text' };
import { muzeSolidCollectionBrowser } from '@muze-labs/solid-app-ui/components/collection-browser.mjs';
import { muzeSolidPresenterPreviews } from './previews.mjs';
import { muzeSolidDesignDialog } from '@muze-labs/solid-design';

export const muzeSolidPresenterCollections = {
  templates: { 'muze-solid-presenter-collections': template },
  styles: { 'muze-solid-presenter-collections': styles },
  components: {
    muzeSolidCollectionBrowser,
    muzeSolidDesignDialog,
    muzeSolidPresenterPreviews
  },
  api: {
    muzeSolidCollectionBrowser: {
      cards: true,
      allLabel: 'All decks',
      newLabel: 'New deck',
      create: 'muzeSolidPresenterNewDeck',
      select: 'muzeSolidPresenterCollectionSelect',
      entryAction: 'muzeSolidPresenterRemoveDeck',
      project: 'muzeSolidPresenterProjectCollection',
      route: 'muzeSolidPresenterCollectionRoute',
      link: 'muzeSolidPresenterCollectionLink'
    }
  },
  events: {
    muzeSolidPresenterCollectionNavigation: {
      target() {
        return window;
      },
      type: 'popstate',
      action: 'muzeSolidPresenterCollectionHistory'
    }
  },
  commands: {
    muzeSolidPresenterCollections() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        if (!(await this.actions.muzeSolidPresenterCloseViews())) {
          return;
        }
        await this.runtime.deck.persist();
        if (
          !this.runtime.collection &&
          !this.runtime.collectionUrl &&
          this.runtime.deck.owner
        ) {
          await this.actions.muzeSolidPresenterDefaultDeckCollection();
        }
        this.actions.muzeSolidPresenterShowCollection();
      });
    },
    muzeSolidPresenterCurrentDeck() {
      return this.actions.muzeSolidPresenterCollectionRun(() =>
        this.actions.muzeSolidPresenterShowDeck()
      );
    },
    muzeSolidPresenterCollectionTools() {
      this.actions.muzeSolidPresenterProjectCollection();
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.muze-solid-presenter-collection-dialog')
      );
    },
    muzeSolidPresenterNewDeck() {
      return this.actions.muzeSolidPresenterCollectionRun(() =>
        this.actions.muzeSolidPresenterCreateDeck()
      );
    },
    muzeSolidPresenterCollectionSelect(_element, id) {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const entry = this.runtime.collectionList.state.data.find(
          (entry) => entry.id === id && !entry.deleted
        );
        if (!entry) {
          throw new Error('presenter: This deck is unavailable.');
        }
        await this.actions.muzeSolidPresenterOpenDeck(entry.document);
        if (entry.management !== false) {
          await this.runtime.collection.updateSummary(
            id,
            this.runtime.deck.title
          );
        }
        await this.actions.muzeSolidPresenterShowDeck();
      });
    },
    muzeSolidPresenterCreateCollection() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const url =
          await this.actions.muzeSolidPresenterChooseCollectionResource(
            'save',
            'collection.ttl',
            'Create deck collection'
          );
        await this.actions.muzeSolidPresenterUseCollection(url, {
          create: { title: 'Decks', destination: new URL('./', url).href }
        });
        await this.actions.muzeSolidPresenterCloseCollectionDialogs();
        this.actions.muzeSolidPresenterShowCollection();
      });
    },
    muzeSolidPresenterOpenCollection() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const url =
          await this.actions.muzeSolidPresenterChooseCollectionResource(
            'open',
            '',
            'Open deck collection'
          );
        await this.actions.muzeSolidPresenterUseCollection(url);
        await this.actions.muzeSolidPresenterCloseCollectionDialogs();
        this.actions.muzeSolidPresenterShowCollection();
      });
    },
    muzeSolidPresenterDefaultCollection() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const collection = this.actions.muzeSolidPresenterRequireCollection();
        await collection.sync();
        await this.runtime.collectionPreference.save(collection.url);
      });
    },
    muzeSolidPresenterSyncCollection() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        await this.actions.muzeSolidPresenterFinishLocalCleanup();
        if (!this.runtime.collection) {
          if (this.runtime.collectionUrl) {
            const url = this.runtime.collectionUrl;
            const pending = this.runtime.collectionPreference.pending === url;
            await this.actions.muzeSolidPresenterUseCollection(
              url,
              pending
                ? {
                    create: {
                      title: 'Decks',
                      destination: new URL('./', url).href
                    }
                  }
                : undefined
            );
          }
          else {
            await this.actions.muzeSolidPresenterDefaultDeckCollection();
          }
        }
        const collection = this.actions.muzeSolidPresenterRequireCollection();
        await collection.sync();
        const preference = this.runtime.collectionPreference;
        if (!preference.value && preference.pending === collection.url) {
          const selected = await preference.save(collection.url, {
            onlyIfMissing: true
          });
          if (selected !== collection.url) {
            await this.actions.muzeSolidPresenterUseCollection(selected);
          }
        }
      });
    },
    muzeSolidPresenterRenameCollection(input) {
      return this.actions.muzeSolidPresenterCollectionRun(() =>
        this.actions.muzeSolidPresenterRequireCollection().rename(input.value)
      );
    },
    muzeSolidPresenterCollectionGroup(form) {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        await this.actions
          .muzeSolidPresenterRequireCollection()
          .addGroup(form.elements.title.value);
        form.reset();
      });
    },
    muzeSolidPresenterCollectionAdd() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const url =
          await this.actions.muzeSolidPresenterChooseCollectionResource(
            'open',
            '',
            'Add existing deck'
          );
        await this.actions.muzeSolidPresenterRequireCollection().addDocument({
          document: url,
          title: new URL(url).pathname.split('/').at(-1),
          kind: 'muze.presenter',
          managed: false
        });
      });
    },
    muzeSolidPresenterCollectionEntry(_element, id) {
      const entry = this.actions.muzeSolidPresenterCollectionEntry(id);
      this.runtime.collectionEntry = id;
      this.data.muzeSolidPresenterEntryTitle = entry.title;
      this.data.muzeSolidPresenterEntryUrl = entry.document;
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.muze-solid-presenter-entry-dialog')
      );
    },
    muzeSolidPresenterEntryGroup(select) {
      if (!select.value) {
        return;
      }
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const entry = this.actions.muzeSolidPresenterCollectionEntry(
          this.runtime.collectionEntry
        );
        const groups = [...new Set([...entry.groups, select.value])];
        await this.actions
          .muzeSolidPresenterRequireCollection()
          .setGroups(entry.id, groups);
        select.value = '';
      });
    },
    muzeSolidPresenterClearGroups() {
      return this.actions.muzeSolidPresenterCollectionRun(() =>
        this.actions
          .muzeSolidPresenterRequireCollection()
          .setGroups(this.runtime.collectionEntry, [])
      );
    },
    muzeSolidPresenterRemoveReference() {
      return this.commands.call('muzeSolidPresenterRemoveDeck', null, {
        id: this.runtime.collectionEntry,
        linkOnly: true
      });
    },
    muzeSolidPresenterDeleteDeck() {
      return this.commands.call(
        'muzeSolidPresenterRemoveDeck',
        null,
        this.runtime.collectionEntry
      );
    },
    muzeSolidPresenterRemoveDeck(_element, value) {
      const id = typeof value === 'string' ? value : value?.id;
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const row = this.runtime.collectionList.state.data.find(
          (entry) => entry.id === id && !entry.deleted
        );
        if (!row) {
          throw new Error('presenter: This deck is unavailable.');
        }
        const pending = this.runtime.fileOperation?.pending;
        if (pending?.kind === 'delete' && pending.source === row.document) {
          await this.runtime.fileOperation.retry();
          await this.actions.muzeSolidPresenterFinishFileOperation();
          return;
        }
        const kind = value?.linkOnly
          ? 'link'
          : this.actions.muzeSolidPresenterDeletionKind(row);
        const consequence =
          kind === 'link'
            ? 'Remove it from this collection and this device? The source file will remain.'
            : kind === 'local'
              ? 'Delete it from this device? Unsaved changes will be discarded.'
              : 'Permanently delete the Pod file and all copies on this device? Other links will stop working. Unsaved changes will be discarded.';
        const location = kind === 'local' ? '' : '\n' + row.document;
        if (!confirm(row.title + location + '\n\n' + consequence)) {
          return;
        }
        if (kind === 'pod') {
          const session = this.runtime.host.requireSession();
          const remote = await session.perform(
            () =>
              this.api.loadDocument(session.client, row.document, {
                allowMissing: true,
                redirect: 'error'
              }),
            { interactive: false }
          );
          if (!remote.missing) {
            await this.actions.muzeSolidPresenterStartFileOperation(
              'delete',
              row
            );
            return;
          }
        }
        const member = this.runtime.collection
          ?.state()
          .entries.find((entry) => entry.id === row.id && !entry.deleted);
        if (member) {
          await this.runtime.collection.removeReference(member.id);
        }
        await this.actions.muzeSolidPresenterDiscardDeck(row.document);
      });
    },
    muzeSolidPresenterMoveDeck() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        const entry = this.actions.muzeSolidPresenterCollectionEntry(
          this.runtime.collectionEntry
        );
        const target =
          await this.actions.muzeSolidPresenterChooseCollectionResource(
            'save',
            new URL(entry.document).pathname.split('/').at(-1),
            'Move deck to'
          );
        if (
          !confirm(
            'Move this file to ' +
              target +
              '? Compatible apps can follow its old address.'
          )
        ) {
          return;
        }
        await this.actions.muzeSolidPresenterStartFileOperation(
          'move',
          entry,
          target
        );
      });
    },
    muzeSolidPresenterOperationRetry() {
      return this.actions.muzeSolidPresenterCollectionRun(async () => {
        await this.runtime.fileOperation.retry();
        await this.actions.muzeSolidPresenterFinishFileOperation();
      });
    },
    muzeSolidPresenterOperationCancel() {
      return this.actions.muzeSolidPresenterCollectionRun(() =>
        this.runtime.fileOperation.cancel()
      );
    }
  },
  actions: {
    async muzeSolidPresenterCreateDeck() {
      if (!(await this.actions.muzeSolidPresenterCloseViews())) {
        throw new Error(
          'presenter: Finish the current view before starting another deck.'
        );
      }
      const collection = this.runtime.collection;
      const target = collection
        ? new URL(
            'deck-' + crypto.randomUUID() + '.ttl',
            collection.state().destination
          ).href
        : '';
      const deck = await this.runtime.decks.create({ target });
      this.runtime.deck = deck;
      if (collection) {
        const id = await collection.addDocument({
          document: target,
          title: deck.title,
          kind: 'muze.presenter',
          managed: true
        });
        const group = this.runtime.collectionList.state.options.group;
        if (group) {
          await collection.setGroups(id, [group]);
        }
      }
      this.runtime.selected = '';
      await this.actions.muzeSolidPresenterShowDeck();
      this.actions.muzeSolidPresenterFocus(
        'input[name="deck-title"]',
        this.runtime.presenting,
        true
      );
    },

    async muzeSolidPresenterInitializeCollections(owner) {
      const browser = this.actions.muzeSolidCollectionInitialize();
      this.runtime.collectionList = browser.entries;
      this.runtime.collectionGroups = browser.groups;
      browser.entries.state.options.group = '';
      browser.entries.state.options.search = '';
      this.runtime.collection = null;
      this.runtime.collectionUrl = '';
      this.runtime.collectionFailure = null;
      this.runtime.collectionPreference = new this.api.CollectionPreference({
        owner,
        app: 'urn:muze:solid-app:presenter',
        session: this.runtime.host.session
      });
      // Each app journals its own operation: opening Presenter must not replace
      // or adopt an unfinished Notebook operation for the same account.
      this.runtime.fileOperation = await new this.api.ResourceLifecycle({
        owner,
        session: this.runtime.host.session,
        store: this.api.local.indexedDB('solid-presenter-file-operation', {
          key: owner
        })
      }).open();
      await this.actions.muzeSolidPresenterCollectionRun(() =>
        this.actions.muzeSolidPresenterNavigateCollection(true)
      );
    },
    async muzeSolidPresenterDefaultDeckCollection() {
      const preference = this.runtime.collectionPreference;
      const value = await preference.load();
      if (value) {
        await this.actions.muzeSolidPresenterUseCollection(value);
        return;
      }
      if (preference.error) {
        this.runtime.collectionUrl = preference.pending || '';
        if (preference.pending) {
          try {
            await this.actions.muzeSolidPresenterUseCollection(
              preference.pending
            );
          }
          catch {
            /* Keep the reserved reference and its access error. */
          }
        }
        throw preference.error;
      }
      const destination = this.runtime.host.requireSession().storage[0];
      if (!destination) {
        throw new Error(
          'presenter: Choose a collection; this profile advertises no storage.'
        );
      }
      const url =
        preference.pending ||
        new URL(
          'presenter-collection-' + crypto.randomUUID() + '.ttl',
          destination
        ).href;
      await preference.prepareDefault(url);
      await this.actions.muzeSolidPresenterUseCollection(url, {
        create: { title: 'Decks', destination }
      });
      await this.runtime.collection.sync();
      const selected = await preference.save(url, { onlyIfMissing: true });
      if (selected !== url) {
        await this.actions.muzeSolidPresenterUseCollection(selected);
      }
    },
    async muzeSolidPresenterUseCollection(url, options) {
      await this.runtime.deck.persist();
      const deck = this.runtime.deck;
      this.runtime.collectionUrl = url;
      this.runtime.collection = null;
      this.runtime.collectionList.state.options.group = '';
      const collection = new this.api.DocumentCollection({
        url,
        owner: deck.owner,
        session: this.runtime.host.session
      });
      await collection.open(options);
      if (
        deck !== this.runtime.deck ||
        deck.owner !== this.runtime.host.selectedWebId
      ) {
        throw new Error(
          'presenter: Account changed; collection selection was not applied.'
        );
      }
      this.runtime.collection = collection;
      this.runtime.collectionFailure = null;
      this.actions.muzeSolidPresenterProjectCollection();
    },
    muzeSolidPresenterCollectionHistory() {
      if (this.runtime.busy) {
        this.runtime.pendingCollectionNavigation = true;
        return;
      }
      return this.actions.muzeSolidPresenterCollectionRun(() =>
        this.actions.muzeSolidPresenterNavigateCollection('history')
      );
    },
    async muzeSolidPresenterNavigateCollection(initial = false) {
      const first = initial === true;
      if (this.runtime.busy && !first && initial !== 'history') {
        this.runtime.pendingCollectionNavigation = true;
        return;
      }
      this.runtime.collectionRouteMode = 'replace';
      const resource =
        this.api.readLaunchContext(location.href).resource ||
        (first ? this.runtime.host.launch?.resource : '');
      try {
        const route = new URLSearchParams(location.hash.slice(1));
        if (
          route.get('webid') &&
          route.get('webid') !== this.runtime.deck.owner
        ) {
          throw new Error(
            'presenter: Connect the linked account before opening this address.'
          );
        }
        if (route.get('draft')) {
          const draft = this.runtime.decks.find(route.get('draft'));
          if (!draft) {
            throw new Error(
              'presenter: This deck is stored on another device or account.'
            );
          }
          if (resource) {
            try {
              await this.actions.muzeSolidPresenterUseCollection(resource);
            }
            catch (error) {
              this.runtime.collectionFailure = error;
            }
          }
          await this.actions.muzeSolidPresenterOpenDeck(draft.id);
          await this.actions.muzeSolidPresenterShowDeck();
          return;
        }
        if (resource) {
          try {
            await this.actions.muzeSolidPresenterUseCollection(resource);
          }
          catch (collectionError) {
            try {
              await this.actions.muzeSolidPresenterOpenDeck(resource);
              this.runtime.collection = null;
              this.runtime.collectionUrl = '';
              await this.actions.muzeSolidPresenterShowDeck();
              return;
            }
            catch {
              this.runtime.collectionFailure = collectionError;
              this.actions.muzeSolidPresenterShowCollection(false);
              return;
            }
          }
        }
        else if (this.runtime.deck.owner) {
          await this.actions.muzeSolidPresenterDefaultDeckCollection();
        }
        const group = route.get('category') || '';
        this.runtime.collectionList.state.options.group = group;
        const selected = route.get('document');
        if (
          selected &&
          this.runtime.collection
            ?.state()
            .entries.some(
              (entry) => !entry.deleted && entry.document === selected
            )
        ) {
          await this.actions.muzeSolidPresenterOpenDeck(selected);
          await this.actions.muzeSolidPresenterShowDeck();
        }
        else if (route.get('create') === 'deck') {
          await this.actions.muzeSolidPresenterCreateDeck();
        }
        else {
          this.actions.muzeSolidPresenterShowCollection(false);
        }
      }
      catch (error) {
        this.runtime.collectionFailure = error;
        this.actions.muzeSolidPresenterShowCollection(false);
      }
      finally {
        this.runtime.collectionRouteMode = 'push';
      }
    },
    async muzeSolidPresenterOpenDeck(address) {
      const deck = this.runtime.deck;
      if (
        [deck.url, deck.target, this.runtime.decks.activeId].includes(address)
      ) {
        return;
      }
      if (!(await this.actions.muzeSolidPresenterCloseViews())) {
        throw new Error(
          'presenter: Finish the current view before opening another deck.'
        );
      }
      const cached = this.runtime.decks.find(address);
      if (cached) {
        this.runtime.deck = await this.runtime.decks.select(cached.id);
        this.runtime.selected = '';
        return;
      }
      const session = this.runtime.host.requireSession();
      const resolved = await session.perform(
        () => this.api.resolveResource(session.client, address),
        { interactive: false }
      );
      if (resolved.status !== 'available') {
        throw new Error(
          'presenter: This deck is deleted or unavailable. Its reference is retained.'
        );
      }
      this.runtime.deck = await this.runtime.decks.openAddress(
        session,
        resolved.current
      );
      if (address !== resolved.current) {
        await this.runtime.decks.rememberReference(
          this.runtime.decks.activeId,
          address
        );
      }
      const entry = this.runtime.collection
        ?.state()
        .entries.find((entry) => !entry.deleted && entry.document === address);
      if (entry && address !== resolved.current && !resolved.temporary) {
        await this.runtime.collection.repairReference(
          entry.id,
          resolved.current
        );
      }
      this.runtime.selected = '';
    },
    muzeSolidPresenterShowCollection(updateRoute = true) {
      this.data.muzeSolidPresenterCollectionMode = {
        'data-muze-solid-presenter-collection-mode': 'overview'
      };
      this.data.muzeSolidPresenterOverviewVisibility = { hidden: null };
      this.data.muzeSolidPresenterEditorVisibility = { hidden: '' };
      this.actions.muzeSolidPresenterProjectCollection();
      if (updateRoute) {
        this.actions.muzeSolidPresenterCollectionRoute();
      }
      this.actions.muzeSolidPresenterUpdateCollectionTools();
      document.title = this.runtime.collection?.state().title || 'Presenter';
      if (!updateRoute) {
        requestAnimationFrame(() =>
          this.container
            .querySelector('.muze-solid-collection-browser-details')
            ?.scrollIntoView({ block: 'nearest' })
        );
      }
      if (updateRoute) {
        requestAnimationFrame(() =>
          this.container
            .querySelector(
              '.muze-solid-collection-browser-categories [aria-current="page"]'
            )
            ?.focus()
        );
      }
    },
    async muzeSolidPresenterShowDeck() {
      this.runtime.deck.requirePresent();
      this.data.muzeSolidPresenterOverviewVisibility = { hidden: '' };
      this.data.muzeSolidPresenterEditorVisibility = { hidden: null };
      this.data.muzeSolidPresenterCollectionMode = {
        'data-muze-solid-presenter-collection-mode': 'editor'
      };
      this.data.muzeSolidPresenterUrl =
        this.runtime.deck.url || this.runtime.deck.target || '';
      this.actions.muzeSolidPresenterUpdateCollectionTools();
      await this.actions.muzeSolidPresenterCloseCollectionDialogs();
      await this.actions.muzeSolidPresenterShowSlide();
      this.actions.muzeSolidPresenterCollectionRoute(
        this.runtime.deck.url ||
          this.runtime.deck.target ||
          this.runtime.decks.activeId
      );
      document.title = this.runtime.deck.title || 'Presenter';
    },
    muzeSolidPresenterUpdateCollectionTools() {
      const overview =
        this.data.muzeSolidPresenterOverviewVisibility?.hidden !== '';
      for (const tool of this.runtime.host.view.data.muzeSolidUiAppTools) {
        if (tool.command === 'add') {
          tool.label = overview ? 'New deck' : 'Add slide';
          tool.attributes['aria-label'] = tool.label;
        }
        if (tool.command === 'present') {
          tool.attributes.hidden = overview ? '' : null;
        }
        tool.attributes.disabled = tool.attributes.popovertarget
          ? null
          : this.runtime.busy ||
              (overview &&
                ['present', 'muzeSolidPresenterSave'].includes(tool.command))
            ? ''
            : null;
      }
    },
    muzeSolidPresenterRequireCollection() {
      if (!this.runtime.collection) {
        throw new Error('presenter: Create or open a collection first.');
      }
      return this.runtime.collection;
    },
    muzeSolidPresenterCollectionEntry(id) {
      const entry = this.actions
        .muzeSolidPresenterRequireCollection()
        .state()
        .entries.find((entry) => entry.id === id && !entry.deleted);
      if (!entry) {
        throw new Error('presenter: This collection entry is unavailable.');
      }
      return entry;
    },
    muzeSolidPresenterDeletionKind(row) {
      const member = this.runtime.collection
        ?.state()
        .entries.find((entry) => entry.id === row.id && !entry.deleted);
      if (member && !member.managed) {
        return 'link';
      }
      const draft = this.runtime.decks.find(row.document);
      return (draft && !draft.url) || row.document.startsWith('urn:')
        ? 'local'
        : 'pod';
    },
    async muzeSolidPresenterFinishLocalCleanup() {
      const decks = this.runtime.decks;
      await decks.finishDiscards();
      await decks.ensureCurrent();
      const changed = this.runtime.deck !== decks.current;
      this.runtime.deck = decks.current;
      if (changed) {
        this.runtime.selected = '';
        await this.actions.muzeSolidPresenterShowSlide();
      }
      if (
        this.runtime.collectionList &&
        (!this.runtime.collection ||
          this.runtime.collection.owner === decks.owner)
      ) {
        this.actions.muzeSolidPresenterProjectCollection();
      }
      const addresses = decks.pendingPurges();
      await this.actions.muzeSolidPresenterPurgePreviews(addresses);
      await decks.acknowledgePurges(addresses);
    },
    async muzeSolidPresenterDiscardDeck(address) {
      const decks = this.runtime.decks;
      if (
        decks.matches(
          {
            id: decks.activeId,
            url: this.runtime.deck.url,
            target: this.runtime.deck.target
          },
          address
        )
      ) {
        for (const [id, view] of this.runtime.views) {
          await view.close({ discard: true });
          this.runtime.views.delete(id);
        }
        await Promise.allSettled(
          [...(this.runtime.collections?.values() || [])].map(
            (collection) => collection.promise
          )
        );
        for (const url of this.runtime.thumbnailUrls.values()) {
          if (url) {
            URL.revokeObjectURL(url);
          }
        }
        this.runtime.thumbnailUrls.clear();
      }
      await decks.discard(address);
      await this.actions.muzeSolidPresenterFinishLocalCleanup();
      await this.actions.muzeSolidPresenterCloseCollectionDialogs();
      this.actions.muzeSolidPresenterShowCollection(false);
      this.actions.muzeSolidPresenterCollectionRoute();
      const next = this.data.muzeSolidCollectionEntries[0];
      if (next) {
        this.actions.muzeSolidPresenterFocus(
          '[data-muze-solid-collection-entry="' + CSS.escape(next.id) + '"]',
          this.runtime.presenting
        );
      }
    },
    muzeSolidPresenterProjectCollection() {
      const collection = this.runtime.collection;
      const state = collection?.state();
      const drafts = this.runtime.decks.entries();
      const members = state?.entries || [];
      const represented = new Set(
        members.filter((entry) => !entry.deleted).map((entry) => entry.document)
      );
      const rows = members.map((entry) => {
        const draft = this.runtime.decks.find(entry.document);
        return {
          ...entry,
          title: draft?.title || entry.title,
          localStatus: draft
            ? !draft.url
              ? 'Local only'
              : draft.dirty
                ? 'Local changes'
                : ''
            : ''
        };
      });
      for (const draft of drafts) {
        if (
          [draft.url, draft.target].some(
            (address) => address && represented.has(address)
          )
        ) {
          continue;
        }
        rows.push({
          id: 'local:' + draft.id,
          document: draft.url || draft.target || draft.id,
          title: draft.title,
          groups: [],
          management: false,
          localStatus: !draft.url
            ? 'Local only'
            : draft.dirty
              ? 'Local changes'
              : ''
        });
      }
      this.runtime.collectionList.state.data = rows.map((entry) => {
        const kind = this.actions.muzeSolidPresenterDeletionKind(entry);
        const pending = this.runtime.fileOperation?.pending;
        const label =
          pending?.kind === 'delete' && pending.source === entry.document
            ? 'Retry delete'
            : kind === 'link'
              ? 'Remove link'
              : 'Delete';
        return {
          ...entry,
          ...this.actions.muzeSolidPresenterPreviewFields(entry.document),
          entryActionVisibility: { hidden: null },
          entryActionLabel: label,
          localStatusAttributes: {
            hidden: entry.localStatus ? null : '',
            title: entry.localStatus || null,
            'aria-label': entry.localStatus || null
          },
          localStatusIcon: {
            href:
              '../assets/feather-icons.svg#' +
              (entry.localStatus === 'Local only' ? 'hard-drive' : 'edit-3')
          },
          entryActionAttributes: {
            'aria-label':
              label + (kind === 'link' ? ' to ' : ' ') + entry.title,
            title: label,
            disabled: this.runtime.busy ? '' : null
          },
          actionAttributes: { 'aria-label': 'Actions for ' + entry.title }
        };
      });
      this.runtime.collectionGroups.state.data = state?.groups || [];
      this.data.muzeSolidPresenterCollectionName = {
        value: state?.title || ''
      };
      this.data.muzeSolidPresenterCollectionMessage =
        this.runtime.collectionFailure?.message ||
        collection?.error?.message ||
        (this.runtime.collectionUrl && !collection
          ? 'This collection is unavailable. Its reference is retained. Reconnect and retry.'
          : state
            ? collection.dirty
              ? 'Collection changes are saved on this device. Sync to update the Pod.'
              : 'Collection is saved on this device and Pod.'
            : 'Connect to open a deck collection, or create a deck on this device.');
      const pending = this.runtime.fileOperation?.pending;
      this.data.muzeSolidPresenterOperationVisibility = {
        hidden: pending ? null : ''
      };
      this.data.muzeSolidPresenterOperationMessage = pending
        ? pending.kind + ': ' + pending.source + ' — ' + pending.stage
        : '';
    },
    muzeSolidPresenterCollectionLink(
      member = '',
      create = false,
      group = this.runtime.collectionList?.state.options.group || ''
    ) {
      const url = new URL(location.href);
      const route = new URLSearchParams(url.hash.slice(1));
      for (const key of [
        'resource',
        'document',
        'create',
        'draft',
        'category',
        'webid'
      ]) {
        route.delete(key);
      }
      if (this.runtime.collectionUrl) {
        route.set('resource', this.runtime.collectionUrl);
      }
      if (this.runtime.deck.owner) {
        route.set('webid', this.runtime.deck.owner);
      }
      if (member && member.startsWith('urn:uuid:')) {
        route.set('draft', member);
      }
      else if (member) {
        const belongs = this.runtime.collection
          ?.state()
          .entries.some((entry) => !entry.deleted && entry.document === member);
        if (belongs) {
          route.set('document', member);
        }
        else {
          route.set('resource', member);
        }
      }
      if (create) {
        route.set('create', 'deck');
      }
      if (group) {
        route.set('category', group);
      }
      url.hash = route.toString();
      return url.href;
    },
    muzeSolidPresenterCollectionRoute(member = '') {
      const url = this.actions.muzeSolidPresenterCollectionLink(member);
      if (url !== location.href) {
        const method =
          this.runtime.collectionRouteMode === 'replace'
            ? 'replaceState'
            : 'pushState';
        history[method](null, '', url);
      }
    },
    async muzeSolidPresenterCollectionRun(work) {
      return this.actions.muzeSolidPresenterRun(async () => {
        this.runtime.collectionFailure = null;
        try {
          await work();
        }
        catch (error) {
          this.runtime.collectionFailure = error;
          if (this.runtime.decks?.removed.has(this.runtime.decks.activeId)) {
            this.actions.muzeSolidPresenterShowCollection(false);
            await this.actions.muzeSolidPresenterCloseCollectionDialogs();
          }
          throw error;
        }
        finally {
          this.actions.muzeSolidPresenterProjectCollection();
        }
      });
    },
    async muzeSolidPresenterChooseCollectionResource(
      mode,
      suggestedName,
      title
    ) {
      const host = this.runtime.host;
      const session = host.requireSession();
      const broker = this.actions.muzeSolidPresenterBroker();
      const provider = await broker.embeddedProvider(this.api.browseCapability);
      const previous = host.capabilityBroker;
      host.capabilityBroker = broker.target ? broker : undefined;
      let result;
      try {
        result = await host.muzeSolidUiInvoke(
          this.api.browseCapability,
          this.api.launchUrl(provider, { webId: session.webId }),
          mode === 'save' ? { mode, suggestedName } : { mode },
          title
        );
      }
      finally {
        host.capabilityBroker = previous;
      }
      if (
        host.session !== session ||
        session.webId !== this.runtime.deck.owner
      ) {
        throw new Error(
          'presenter: Account changed; the selection was not applied.'
        );
      }
      return this.api.selectionUrl(result);
    },
    async muzeSolidPresenterCloseCollectionDialogs() {
      for (const selector of [
        '.muze-solid-presenter-collection-dialog',
        '.muze-solid-presenter-entry-dialog'
      ]) {
        const dialog = this.container.querySelector(selector);
        if (dialog.open) {
          await this.actions.muzeSolidDesignCloseDialog(dialog);
        }
      }
    },
    async muzeSolidPresenterUpdateCollectionSummary(previous = '') {
      const deck = this.runtime.deck;
      const collection = this.runtime.collection;
      const entry = collection
        ?.state()
        .entries.find(
          (entry) =>
            !entry.deleted && [deck.url, previous].includes(entry.document)
        );
      if (entry) {
        if (previous && previous !== deck.url) {
          await collection.repairReference(entry.id, deck.url);
        }
        await collection.updateSummary(entry.id, deck.title);
        await collection.sync();
      }
      this.actions.muzeSolidPresenterProjectCollection();
      this.actions.muzeSolidPresenterCollectionRoute(deck.url);
    },
    async muzeSolidPresenterStartFileOperation(kind, entry, target = '') {
      if (kind === 'move') {
        await this.actions.muzeSolidPresenterCollectAll();
      }
      const deck = this.runtime.deck;
      if (
        kind === 'move' &&
        [deck.url, deck.target].includes(entry.document) &&
        deck.dirty
      ) {
        throw new Error(
          'presenter: Save this deck before moving its Pod file.'
        );
      }
      await this.runtime.fileOperation.begin({
        kind,
        target,
        source: entry.document,
        collection:
          entry.management === false ? '' : this.runtime.collection.url,
        entry: entry.management === false ? '' : entry.id,
        confirmed: true
      });
      await this.actions.muzeSolidPresenterFinishFileOperation();
    },
    async muzeSolidPresenterFinishFileOperation() {
      const operation = this.runtime.fileOperation.pending;
      if (!operation || operation.stage !== 'complete') {
        return;
      }
      if (operation.collection) {
        if (this.runtime.collection?.url !== operation.collection) {
          await this.actions.muzeSolidPresenterUseCollection(
            operation.collection
          );
        }
        if (operation.kind === 'move') {
          await this.runtime.collection.repairReference(
            operation.entry,
            operation.target
          );
        }
        else {
          await this.runtime.collection.removeReference(operation.entry);
        }
        await this.runtime.collection.sync();
      }
      if (operation.kind === 'move') {
        await this.runtime.decks.applyFileOperation(
          operation,
          this.runtime.host.requireSession()
        );
      }
      else {
        await this.actions.muzeSolidPresenterDiscardDeck(operation.source);
      }
      await this.runtime.fileOperation.acknowledge();
      this.data.muzeSolidPresenterUrl =
        this.runtime.deck.url || this.runtime.deck.target || '';
      await this.actions.muzeSolidPresenterCloseCollectionDialogs();
    }
  }
};
