import '@muze-labs/solid-app-data/simply-runtime.mjs';
import '@muze-labs/solid-app-data/jaqt-runtime.mjs';
import {
  solidToolbar,
  solidDialog
} from '@muze-labs/solid-design';
import template from '../presenter.html?template' with { type: 'text' };
import thumbnail from '../thumbnail.html' with { type: 'text' };
import styles from './presenter.css' with { type: 'text' };

export const muzeSolidPresenter = {
  components: { solidToolbar, solidDialog },
  transformers: {
    muzeSolidPresenterRichText(context, next) {
      const api = this.app.api;
      context.value = {
        innerHTML: api.renderCobalt(
          api.validateFragment(context.value || { text: '', annotations: [] })
        )
      };
      return next(context);
    }
  },
  templates: {
    'muze-solid-presenter': template,
    'muze-solid-presenter-thumbnail': thumbnail
  },
  styles: { 'muze-solid-presenter': styles },
  events: {
    muzeSolidPresenterFullscreen: {
      target() {
        return document;
      },
      type: 'fullscreenchange',
      action: 'muzeSolidPresenterFullscreen'
    },
    muzeSolidPresenterKey: {
      target: 'window',
      type: 'keydown',
      action: 'muzeSolidPresenterKey'
    }
  },
  commands: {
    muzeSolidPresenterEditTitle() {
      this.data.muzeSolidPresenterTitleDraft = this.runtime.deck.title;
      return this.actions.solidOpenDialog(
        this.container.querySelector('.muze-solid-presenter-title-dialog')
      );
    },
    muzeSolidPresenterSaveTitle(form) {
      const title = new FormData(form).get('deck-title');
      return this.actions.muzeSolidPresenterRun(
        async () => {
          this.runtime.deck.change(this.runtime.deck.root.id, 'title', title);
          await this.actions.muzeSolidPresenterPersist();
          await this.actions.solidCloseDialog(form.closest('dialog'));
        },
        { disableControls: false }
      );
    },
    muzeSolidPresenterBackground() {
      const image = this.data.muzeSolidPresenterRegions.find(
        (region) => region.kind === 'image'
      );
      if (image) {
        return this.actions.muzeSolidPresenterRun(() =>
          this.actions.muzeSolidPresenterEditRegion(image.id)
        );
      }
    },
    muzeSolidPresenterNew() {
      return this.commands.call('muzeSolidPresenterNewDeck');
    },
    muzeSolidPresenterImportLocal() {
      return this.actions.muzeSolidPresenterRun(async () => {
        const deck = this.runtime.deck;
        if (!deck.owner) {
          throw new Error(
            'presenter: Choose an account first to copy your signed-out deck.'
          );
        }
        if (deck.dirty || deck.slides().length) {
          throw new Error(
            'presenter: Start an empty deck before copying your signed-out deck.'
          );
        }
        const signedOut = await new this.api.PresenterDecks().open();
        const saved = signedOut.current;
        if (!saved.slides().length) {
          throw new Error(
            'presenter: No signed-out deck was found on this device.'
          );
        }
        deck.graph = saved.content();
        deck.root = saved.root;
        deck.url = '';
        deck.etag = null;
        deck.dirty = true;
        deck.revision += 1;
        await this.actions.muzeSolidPresenterPersist();
        await this.actions.muzeSolidPresenterShowSlide();
      });
    },
    muzeSolidPresenterAdd(_element, layout) {
      return this.actions.muzeSolidPresenterRun(async () => {
        if (!(await this.actions.muzeSolidPresenterCloseViews())) {
          return;
        }
        this.runtime.selected = this.runtime.deck.addSlide(
          layout,
          this.runtime.selected
        );
        await this.actions.muzeSolidPresenterPersist();
        await this.actions.muzeSolidPresenterShowSlide();
        await this.actions.muzeSolidPresenterRevealSlide();
      });
    },
    muzeSolidPresenterSelect(_element, id) {
      return this.actions.muzeSolidPresenterRun(() =>
        this.actions.muzeSolidPresenterSelect(id)
      );
    },
    muzeSolidPresenterMove(_element, offset) {
      return this.actions.muzeSolidPresenterRun(
        async () => {
          this.runtime.deck.moveSlide(this.runtime.selected, Number(offset));
          await this.actions.muzeSolidPresenterPersist();
          this.data.muzeSolidPresenterStatus =
            'Slide position: ' +
            this.data.muzeSolidPresenterPosition.replace(' / ', ' of ') +
            '. ' +
            this.data.muzeSolidPresenterStatus;
          await this.actions.muzeSolidPresenterRevealSlide();
        },
        { disableControls: false }
      );
    },
    muzeSolidPresenterRemove() {
      return this.actions.muzeSolidPresenterRun(async () => {
        if (!(await this.actions.muzeSolidPresenterCloseViews())) {
          return;
        }
        const slides = this.runtime.slides.view.current;
        const index = slides.findIndex(
          (slide) => slide.id === this.runtime.selected
        );
        const previous = slides[index - 1]?.id || '';
        this.runtime.deck.removeSlide(this.runtime.selected);
        this.runtime.selected = previous;
        await this.actions.muzeSolidPresenterPersist();
        await this.actions.muzeSolidPresenterShowSlide();
        await this.actions.muzeSolidPresenterRevealSlide();
      });
    },
    muzeSolidPresenterSave() {
      return this.actions.muzeSolidPresenterRun(async () => {
        await this.actions.muzeSolidPresenterCollectAll();
        const previous = this.runtime.deck.target;
        await this.runtime.deck.save(
          this.runtime.host.requireSession(),
          this.data.muzeSolidPresenterUrl
        );
        await this.actions.muzeSolidPresenterPersist();
        await this.actions.muzeSolidPresenterUpdateCollectionSummary(previous);
      });
    },
    muzeSolidPresenterOpen() {
      return this.actions.muzeSolidPresenterRun(async () => {
        await this.actions.muzeSolidPresenterOpenDeck(
          this.data.muzeSolidPresenterUrl
        );
        await this.actions.muzeSolidPresenterShowDeck();
      });
    },
    muzeSolidPresenterPresent() {
      const workspace = this.container.querySelector(
        '.muze-solid-presenter-workspace'
      );
      const fullscreen = this.runtime.selected
        ? workspace.requestFullscreen?.().catch(() => {})
        : null;
      return this.actions.muzeSolidPresenterRun(async () => {
        if (!this.runtime.selected) {
          throw new Error('presenter: Add a slide before presenting.');
        }
        await this.actions.muzeSolidPresenterCollectAll();
        await fullscreen;
        this.runtime.presenting = true;
        this.data.muzeSolidPresenterMode = { 'data-muze-solid-presenting': '' };
        await new Promise((resolve) => requestAnimationFrame(resolve));
        this.runtime.focusPresentation = true;
        await this.actions.muzeSolidPresenterResize();
      });
    },
    muzeSolidPresenterExit() {
      this.actions.muzeSolidPresenterExit();
    },
    muzeSolidPresenterStep(_element, offset) {
      return this.actions.muzeSolidPresenterRun(() =>
        this.actions.muzeSolidPresenterStep(Number(offset))
      );
    }
  },
  actions: {
    async muzeSolidPresenterInitialize() {
      const host = this.runtime.host;
      host.onAppAction = (command) => {
        if (command.startsWith('muzeSolidPresenter')) {
          return this.commands.call(command);
        }
        if (command === 'add') {
          if (this.data.muzeSolidPresenterOverviewVisibility.hidden !== '') {
            return this.commands.call('muzeSolidPresenterNewDeck');
          }
          return this.commands.muzeSolidPresenterAdd.call(this, null, 'image');
        }
        if (command === 'present') {
          return this.commands.muzeSolidPresenterPresent.call(this);
        }
      };
      host.view.data.muzeSolidUiAppTools = [
        {
          command: 'add',
          label: 'Add slide',
          icon: { href: '../assets/feather-icons.svg#plus' },
          attributes: { 'data-muze-solid-action': 'add' }
        },
        {
          command: 'present',
          label: 'Present',
          icon: { href: '../assets/feather-icons.svg#play' },
          attributes: { 'data-muze-solid-action': 'present' }
        }
      ];
      for (const [command, label, icon] of [
        ['Collections', 'Collections', 'book-open'],
        ['CollectionTools', '', 'more-vertical'],
        ['CurrentDeck', 'Current deck', 'file-text'],
        ['Save', 'Save', 'save'],
        ['Status', '', 'info']
      ]) {
        host.view.data.muzeSolidUiAppTools.push({
          command: 'muzeSolidPresenter' + command,
          label,
          icon: { href: '../assets/feather-icons.svg#' + icon },
          attributes: {
            'aria-label':
              command === 'Status'
                ? 'Presenter status'
                : label || 'Collection options',
            popovertarget:
              command === 'Status' ? 'muze-solid-presenter-status' : null,
            'data-muze-solid-action': 'muzeSolidPresenter' + command
          }
        });
      }
      const statusTool = host.view.data.muzeSolidUiAppTools.find(
        (tool) => tool.command === 'muzeSolidPresenterStatus'
      );
      simply.effect(() => {
        const overview =
          this.data.muzeSolidPresenterOverviewVisibility.hidden !== '';
        this.data.muzeSolidPresenterStatusDisplay = overview
          ? this.data.muzeSolidPresenterCollectionMessage
          : this.data.muzeSolidPresenterStatus;
        const busy = this.data.muzeSolidPresenterBusy.disabled === '';
        for (const entry of this.data.muzeSolidCollectionEntries) {
          if (entry.entryActionAttributes) {
            entry.entryActionAttributes.disabled = busy ? '' : null;
          }
        }
        const attention =
          overview &&
          (this.runtime.collectionFailure ||
            this.runtime.collection?.error ||
            !this.runtime.collection);
        const dirty = overview
          ? this.runtime.collection?.dirty
          : this.runtime.deck?.dirty;
        const icon = busy
          ? 'loader'
          : attention
            ? 'alert-triangle'
            : dirty
              ? 'hard-drive'
              : 'check-circle';
        statusTool.icon.href = '../assets/feather-icons.svg#' + icon;
        statusTool.attributes['aria-label'] = attention
          ? 'Presenter needs attention. Show status'
          : 'Show Presenter status';
      });
      host.view.data.muzeSolidUiAppToolbar = { hidden: null };
      this.runtime.thumbnailUrls = new Map();
      const slides = simply.model({ data: [], options: {} });
      slides.addEffect(function (input) {
        return simply.effect(() =>
          jaqt.from(input.current)
            .orderBy({ position: jaqt.asc })
            .toArray()
        );
      });
      this.runtime.slides = slides;
      this.runtime.slideEffect = simply.effect(() => {
        this.data.muzeSolidPresenterSlides = slides.view.current;
      });
      this.runtime.appState = new this.api.AppState();
      host.manage({
        capabilities: [],
        canClose: async () => ({
          allowed:
            !this.runtime.busy &&
            (await this.actions.muzeSolidPresenterCloseViews())
        }),
        getState: () => {
          this.runtime.appState.set(
            this.api.apps + 'presenterSlide',
            this.runtime.selected,
            'iri'
          );
          return this.runtime.appState.snapshot();
        },
        restoreState: async (state) => {
          this.runtime.appState.restore(state);
          const selected = this.runtime.appState.read(
            this.api.apps + 'presenterSlide',
            'iri'
          );
          // Initial managed state can arrive after the local deck has opened.
          // An absent bookmark must not erase that deck's current selection.
          if (!selected || selected === this.runtime.selected) {
            return;
          }
          if (
            this.runtime.deck &&
            this.data.muzeSolidPresenterEditorVisibility.hidden === null
          ) {
            await this.actions.muzeSolidPresenterSelect(selected);
          }
          else {
            this.runtime.selected = selected;
          }
        }
      });
      host.beforeAccountLeave = async () => {
        if (
          this.runtime.busy ||
          !(await this.actions.muzeSolidPresenterCloseViews())
        ) {
          throw new Error(
            'presenter: Finish the current task before changing accounts.'
          );
        }
        await this.runtime.deck?.persist();
      };
      host.onConnect = () => this.actions.muzeSolidPresenterAccount();
      host.onContext = () => this.actions.muzeSolidPresenterAccount();
      this.eventBindings.start();
      await host.ready;
      if (host.managed?.ready) {
        host.capabilityBroker = undefined;
      }
      await this.actions.muzeSolidPresenterAccount();
    },
    async muzeSolidPresenterAccount() {
      const host = this.runtime.host;
      const owner = host.selectedWebId || '';
      if (this.runtime.deck?.owner === owner) {
        return;
      }
      if (this.runtime.openingAccount) {
        return this.runtime.openingAccount;
      }
      const open = async () => {
        await this.runtime.deck?.persist();
        if (!(await this.actions.muzeSolidPresenterCloseViews())) {
          return;
        }
        for (const url of this.runtime.thumbnailUrls.values()) {
          if (url) {
            URL.revokeObjectURL(url);
          }
        }
        this.runtime.thumbnailUrls.clear();
        this.runtime.decks = await new this.api.PresenterDecks({
          owner
        }).open();
        this.runtime.deck = this.runtime.decks.current;
        this.runtime.collection = null;
        this.runtime.collectionUrl = '';
        if (this.runtime.collectionList) {
          this.runtime.collectionList.state.data = [];
          this.runtime.collectionGroups.state.data = [];
        }
        await this.actions.muzeSolidPresenterFinishLocalCleanup();
        if (!host.managed?.ready) {
          this.runtime.broker ||= new this.api.WorkspaceBroker({
            resolveProvider: (capability) => {
              const key = Object.keys(this.api.providerCapabilities).find(
                (key) => this.api.providerCapabilities[key] === capability
              );
              return host.preferences[key]?.url;
            },
            embeddedProviders: [
              ...[
                this.api.viewResourceCapability,
                this.api.viewTextCapability,
                this.api.createTextCapability,
                this.api.editTextCapability
              ].map((capability) => ({
                capability,
                url: new URL('../viewer/', location.href).href
              })),
              {
                capability: this.api.browseCapability,
                url: new URL('../files/', location.href).href
              },
              {
                capability:
                  'https://vocab.muze.nl/capabilities/edit-preferences',
                url: new URL('../preferences/', location.href).href
              }
            ]
          });
        }
        this.data.muzeSolidPresenterUrl = this.runtime.deck.url || '';
        this.actions.muzeSolidPresenterProject();
        this.data.muzeSolidPresenterStatus =
          'Local deck restored on this device.';
        await this.actions.muzeSolidPresenterInitializeCollections(owner);
      };
      this.runtime.openingAccount = open();
      try {
        await this.runtime.openingAccount;
      }
      finally {
        this.runtime.openingAccount = null;
      }
    },
    async muzeSolidPresenterRun(operation, { disableControls = true } = {}) {
      if (this.runtime.busy) {
        return;
      }
      this.runtime.busy = true;
      if (disableControls) {
        for (const tool of this.runtime.host.view.data.muzeSolidUiAppTools) {
          tool.attributes = {
            ...tool.attributes,
            disabled: tool.attributes.popovertarget ? null : ''
          };
        }
        this.data.muzeSolidPresenterBusy = { disabled: '' };
      }
      try {
        await operation();
      }
      catch (error) {
        if (error.code !== 'cancelled') {
          this.data.muzeSolidPresenterStatus = error.message;
        }
      }
      finally {
        this.runtime.busy = false;
        if (disableControls) {
          for (const tool of this.runtime.host.view.data.muzeSolidUiAppTools) {
            tool.attributes = { ...tool.attributes, disabled: null };
          }
          this.data.muzeSolidPresenterBusy = { disabled: null };
        }
        this.actions.muzeSolidPresenterUpdateCollectionTools();
        if (this.runtime.pendingCollectionNavigation) {
          this.runtime.pendingCollectionNavigation = false;
          await this.actions.muzeSolidPresenterCollectionHistory();
        }
        if (this.runtime.focusPresentation) {
          this.runtime.focusPresentation = false;
          this.actions.muzeSolidPresenterFocus(
            '[data-simply-command="muzeSolidPresenterExit"]',
            true
          );
        }
      }
    },
    cleanup() {
      if (this.runtime.slideEffect) {
        simply.destroy(this.runtime.slideEffect);
      }
      this.runtime.slides?.destroy();
    },
    muzeSolidPresenterProject() {
      const deck = this.runtime.deck;
      this.data.muzeSolidPresenterTitle = deck.title || 'Untitled presentation';
      if (this.data.muzeSolidPresenterEditorVisibility?.hidden !== '') {
        document.title = deck.title.trim() || 'Untitled presentation';
      }
      simply.untracked(() => {
        this.runtime.slides.state.data = deck.slides().map((slide) => {
          const regions = deck.regions(slide.id);
          const text = regions.find((region) => region.name === 'title');
          const image = regions.find((region) => region.kind === 'image');
          const number = slide.position + 1;
          const url =
            image?.resource && this.runtime.thumbnailUrls.get(image.resource);
          return {
            ...slide,
            number,
            fragment: text?.fragment || { text: '', annotations: [] },
            image: { src: url || null, hidden: url ? null : '' },
            attributes: {
              'data-muze-solid-slide': slide.id,
              'aria-current':
                slide.id === this.runtime.selected ? 'true' : null,
              'aria-label':
                'Slide ' +
                number +
                (text?.fragment.text ? ': ' + text.fragment.text : ''),
              title: text?.fragment.text || 'Slide ' + number
            }
          };
        });
      });
      this.actions.muzeSolidPresenterThumbnails();
      const ordered = jaqt.from(deck.slides())
        .orderBy({ position: jaqt.asc })
        .toArray();
      this.data.muzeSolidPresenterPosition =
        ordered.findIndex((slide) => slide.id === this.runtime.selected) +
        1 +
        ' / ' +
        ordered.length;
    },
    async muzeSolidPresenterPersist() {
      await this.runtime.deck.persist();
      this.actions.muzeSolidPresenterProject();
      this.data.muzeSolidPresenterStatus = this.runtime.deck.dirty
        ? 'Saved on this device. Pod copy has not been updated.'
        : this.runtime.deck.url
          ? 'Saved on this device and Pod.'
          : 'Saved on this device.';
      await this.runtime.host.managed?.publish();
    },
    async muzeSolidPresenterSelect(id) {
      if (!(await this.actions.muzeSolidPresenterCloseViews())) {
        return;
      }
      this.runtime.selected = id;
      await this.actions.muzeSolidPresenterShowSlide();
    },
    async muzeSolidPresenterShowSlide() {
      const slides = jaqt.from(this.runtime.deck.slides())
        .orderBy({ position: jaqt.asc })
        .toArray();
      const slide =
        slides.find((slide) => slide.id === this.runtime.selected) || slides[0];
      this.runtime.selected = slide?.id || '';
      this.data.muzeSolidPresenterSelection = { hidden: slide ? null : '' };
      this.data.muzeSolidPresenterEmpty = { hidden: slide ? '' : null };
      this.data.muzeSolidPresenterSlideTitle = slide?.title || '';
      this.actions.muzeSolidPresenterProject();
      this.data.muzeSolidPresenterBackgroundVisibility = {
        hidden:
          slide &&
          this.runtime.deck
            .regions(slide.id)
            .some((region) => region.kind === 'image')
            ? null
            : ''
      };
      this.data.muzeSolidPresenterRegions = slide
        ? this.runtime.deck.regions(slide.id).map((region) => ({
            ...region,
            label: region.name === 'title' ? 'Title' : 'Content',
            editLabel:
              region.kind === 'image'
                ? 'Choose image'
                : region.text
                  ? 'Edit text'
                  : 'Create text',
            attributes: {
              'data-region': region.name,
              'data-kind': region.kind,
              'aria-label': region.name
            },
            status: '',
            discard: { hidden: '' },
            frame: {
              hidden: '',
              src: 'about:blank',
              title: region.name,
              'data-region-id': region.id
            }
          }))
        : [];
      const results = await Promise.allSettled(
        this.data.muzeSolidPresenterRegions.map((region) =>
          this.actions.muzeSolidPresenterOpenRegion(region.id)
        )
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          this.data.muzeSolidPresenterStatus = result.reason.message;
        }
      }
    },
    async muzeSolidPresenterStep(offset) {
      const slides = this.runtime.slides.view.current;
      const index = slides.findIndex(
        (slide) => slide.id === this.runtime.selected
      );
      const next = slides[index + offset];
      if (next) {
        await this.actions.muzeSolidPresenterSelect(next.id);
      }
    },
    async muzeSolidPresenterRevealSlide() {
      const deck = this.runtime.deck;
      const selected = this.runtime.selected;
      if (!deck.slides().some((slide) => slide.id === selected)) {
        return;
      }
      await this.binding.whenIdle();
      if (this.runtime.deck !== deck || this.runtime.selected !== selected) {
        return;
      }
      const button = this.container.querySelector(
        '[data-muze-solid-slide="' + CSS.escape(selected) + '"]'
      );
      button?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant'
      });
    },
    async muzeSolidPresenterFocus(selector, presenting, selectText = false) {
      const deck = this.runtime.deck;
      const focus = () => {
        if (
          this.runtime.presenting !== presenting ||
          this.runtime.deck !== deck ||
          (selectText &&
            this.data.muzeSolidPresenterEditorVisibility.hidden === '')
        ) {
          return;
        }
        const button = this.container.closest('#app').querySelector(selector);
        if (!button?.isConnected) {
          return;
        }
        if (button.matches(':disabled') || !button.checkVisibility()) {
          requestAnimationFrame(focus);
          return;
        }
        button.focus();
        if (selectText) {
          button.select?.();
        }
      };
      await Promise.all([
        this.binding.whenIdle(),
        this.runtime.host.view.binding.whenIdle()
      ]);
      focus();
    },
    async muzeSolidPresenterExit() {
      this.runtime.presenting = false;
      if (document.fullscreenElement) {
        await document.exitFullscreen?.().catch(() => {});
      }
      this.data.muzeSolidPresenterMode = { 'data-muze-solid-presenting': null };
      this.actions.muzeSolidPresenterFocus(
        '[data-muze-solid-action="present"]',
        false
      );
      requestAnimationFrame(() => this.actions.muzeSolidPresenterResize());
    },
    muzeSolidPresenterFullscreen() {
      if (!document.fullscreenElement && this.runtime.presenting) {
        this.actions.muzeSolidPresenterExit();
      }
    },
    async muzeSolidPresenterThumbnails() {
      const deck = this.runtime.deck;
      const owner = deck.owner;
      for (const slide of deck.slides()) {
        const image = deck
          .regions(slide.id)
          .find((region) => region.kind === 'image' && region.resource);
        if (!image || this.runtime.thumbnailUrls.has(image.resource)) {
          continue;
        }
        this.runtime.thumbnailUrls.set(image.resource, null);
        try {
          const host = this.runtime.host;
          const client =
            host.session?.client ||
            this.api.createSolidMetroClient(image.resource, {
              oidc: false,
              oldm: false
            });
          const read = async () =>
            this.api.requireOk(await client.get(image.resource));
          const response = host.session
            ? await host.session.perform(read)
            : await read();
          const blob = await response.blob();
          if (
            !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(
              blob.type
            )
          ) {
            continue;
          }
          if (this.runtime.deck.owner !== owner) {
            continue;
          }
          this.runtime.thumbnailUrls.set(
            image.resource,
            URL.createObjectURL(blob)
          );
          this.actions.muzeSolidPresenterProject();
        }
        catch {
          /* Keep the text thumbnail usable when image bytes are offline. */
        }
      }
    },
    muzeSolidPresenterKey(event) {
      if (
        !this.runtime.presenting ||
        event.defaultPrevented ||
        event.target.closest('input, textarea, select, dialog')
      ) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.actions.muzeSolidPresenterExit();
      }
      else if (
        ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp'].includes(event.key)
      ) {
        event.preventDefault();
        const offset = ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 1;
        this.actions.muzeSolidPresenterRun(() =>
          this.actions.muzeSolidPresenterStep(offset)
        );
      }
    }
  }
};
