import { launcherScreens } from './screens.mjs';
import { shortcutMenu } from './shortcut-menu.mjs';
import styles from './shortcuts.css' with { type: 'text' };
import sourceLauncherNavigation from '../navigation.html' with { type: 'text' };
import sourceLauncherShortcuts from '../shortcuts.html' with { type: 'text' };

export const shortcuts = {
  components: { shortcutMenu, launcherScreens },
  styles: { 'swb-workbench-shortcuts': styles },
  templates: {
    'launcher-navigation': sourceLauncherNavigation,
    'launcher-shortcuts': sourceLauncherShortcuts
  },
  events: {
    swbShortcutIconError: {
      subscribe(notify) {
        this.container.addEventListener('error', notify, true);
        return () => this.container.removeEventListener('error', notify, true);
      },
      action: 'swbShortcutIconError'
    }
  },
  commands: {
    async muzeSolidLauncherAddDialog() {
      await this.commands.call('muzeSolidCatalogOpen');
      this.actions.muzeSolidCatalogSelectCategory('manual');
      this.actions.muzeSolidCatalogFocusDetails();
    },
    swb_shortcutSettings(button) {
      button.closest('[popover]')?.hidePopover();
      return this.actions.solidOpenDialog(
        button.closest('li').querySelector('dialog')
      );
    },
    swb_editShortcut(button, id) {
      const details = button.closest('dialog');
      return this.runtime.host.run(async () => {
        const node = this.runtime.store.collection.get(id);
        const name = details
          .querySelector('[name="swb_shortcutName"]')
          .value.trim();
        const icon = details
          .querySelector('[name="swb_shortcutIcon"]')
          .value.trim();
        const previous = this.api.valueAt(
          node,
          this.api.prefixes.schema + 'name'
        );
        if (
          Array.isArray(previous) ||
          previous?.language ||
          (previous &&
            typeof previous !== 'string' &&
            !(previous instanceof String))
        ) {
          throw new Error(
            'launcher: This shortcut has a structured name and cannot be renamed here.'
          );
        }
        const request = this.runtime.shortcutLookups?.get(id);
        if (request) {
          request.useTitle &&= name === String(previous);
          request.useIcon &&= !icon;
        }
        this.api.applyIconOverride(node, icon);
        node.schema$name = name;
        await this.runtime.store.collection.save(node);
        await this.actions.solidCloseDialog(details);
        this.actions.render();
      });
    },
    setAnonymous(element, id) {
      const value = element.checked;
      return this.runtime.host.run(() =>
        this.actions.setShortcutIdentity(id, value)
      );
    },
    setLaunchMode(element, id) {
      const value = element.value;
      return this.runtime.host.run(() =>
        this.actions.setShortcutMode(id, value)
      );
    },
    launchApp(element) {
      if (Date.now() < (this.runtime.swbShortcutIgnoreClickUntil || 0)) {
        return;
      }
      if (this.runtime.swbShortcutMoving) {
        const id = element.closest('[data-swb-shortcut]').dataset.swbShortcut;
        const moving = this.runtime.swbShortcutMoving;
        this.actions.swbShortcutCancelMove();
        return this.actions.swbMoveShortcut(moving, id);
      }
      if (element.relList.contains('noopener')) {
        return this.runtime.host.run(() => {
          this.actions.swb_requireOwner();
          window.open(element.href, '_blank', 'noopener,noreferrer');
        });
        return;
      }
      this.runtime.host.run(() => {
        if (!element.getAttribute('href')) {
          throw new Error('launcher: Connect to Solid to open this resource.');
        }
        this.actions.openApplication(element.href, {
          label: element.textContent.trim()
        });
      });
    },
    add(form) {
      const values = {
        url: form.elements.url.value,
        name: form.elements.name.value.trim(),
        mode: form.elements.launchMode.value,
        anonymous: form.elements.anonymous.checked,
        manifest: form.elements.manifest.value.trim(),
        icon: form.elements.icon.value.trim(),
        localOnly: form.elements.localOnly.checked
      };
      return this.actions.muzeSolidCatalogOperation(async () => {
        await this.actions.addShortcut(values);
        form.reset();
        await this.actions.solidCloseDialog(form.closest('dialog'));
      });
    },
    remove(_element, id) {
      return this.actions.handleRemove(id);
    },
    sync(...values) {
      return this.actions.handleSync(...values);
    }
  },
  actions: {
    swbShortcutIconError(event) {
      const image = event.target;
      if (!image.matches?.('.swb-shortcut-image') ||
          image.crossOrigin !== 'anonymous' || !image.currentSrc) {
        return;
      }
      const failures = (this.runtime.shortcutIconFailures ||= new Set());
      if (!failures.has(image.currentSrc)) {
        failures.add(image.currentSrc);
        this.actions.render();
      }
    },
    openApplication: function (href, options) {
      this.actions.swb_requireOwner();
      if (!this.runtime.workspace) {
        throw new Error('launcher: Workspace is still loading.');
      }
      return this.runtime.workspace.open(href, options);
    },
    renderLinks: function () {
      for (const name of ['contacts', 'files', 'profile', 'presenter']) {
        const target = new URL('../' + name + '/', location.href).href;
        let href = target;
        if (this.runtime.host.session) {
          href = this.api.launchUrl(target, {
            webId: this.runtime.host.session.webId
          });
        }
        this.data[name + 'Link'] = { href };
      }
    },
    render() {
      if (!this.runtime.store) {
        return;
      }
      const groups = this.api
        .from(this.runtime.store.collection.list())
        .select(this.api.launcherGroups.groupDescription)
        .where(Boolean)
        .toArray();
      const shortcuts = this.api.from(this.runtime.store.collection.list())
        .select(this.actions.shortcutRow).toArray();
      this.api.batch(() => {
        const previousGroups = this.runtime.launcherScreens.state.data;
        if (groups.length !== previousGroups.length || groups.some((group, index) =>
          group.id !== previousGroups[index].id || group.order !== previousGroups[index].order)) {
          this.runtime.launcherScreens.state.data = groups;
        }
        this.runtime.shortcuts.state.data = shortcuts;
      });
    },
    handleRemove(id) {
      this.runtime.shortcutLookups?.delete(id);
      return this.runtime.host.run(async () => {
        await this.runtime.store.collection.delete(id);
        await this.actions.muzeSolidLauncherTrimScreens();
        this.actions.render();
        this.runtime.host.notify('Shortcut marked deleted.');
      });
    },
    handleSync() {
      this.actions.swb_requireOwner();
      this.runtime.host.run(
        async () => {
          await this.runtime.store.connect(
            this.runtime.host.requireSession(),
            this.runtime.store.resourceUrl ||
              this.runtime.host.resource('launcher')
          );
          this.actions.render();
          this.runtime.host.notify('Shortcuts synchronized with Solid.');
        },
        { network: true }
      );
    },
    async setShortcutIdentity(id, value) {
      const subject = this.runtime.store.collection.get(id);
      this.api.applyAnonymousLaunch(subject, value);
      await this.runtime.store.collection.save(subject);
      this.actions.render();
      this.runtime.host.notify('Launch identity saved on this device.');
    },
    async setShortcutMode(id, value) {
      const subject = this.runtime.store.collection.get(id);
      this.api.applyLaunchOverride(subject, value);
      await this.runtime.store.collection.save(subject);
      this.actions.render();
      this.runtime.host.notify('Launch mode saved on this device.');
    },
    async addShortcut({
      url,
      name,
      mode,
      anonymous,
      manifest = '',
      icon = '',
      description,
      localOnly = false,
      destination
    }) {
      this.actions.swb_requireOwner();
      const override = icon;
      let manifestIcon = '';
      if (manifest) {
        description ||= await this.api.readApplicationManifest(
          manifest,
          this.runtime.host.session
        );
        url ||= description.url;
        name ||= description.name;
        manifestIcon = description.icon;
      }
      url = this.api.httpUrl(url);
      if (icon) {
        icon = this.api.httpUrl(icon);
      }
      if (!['', 'fragment', 'query'].includes(mode)) {
        throw new Error('launcher: Choose a supported launch mode.');
      }
      const web = !manifest && (Boolean(destination) || (!mode && !anonymous)) &&
        !this.api.shortcutMetadata.isWorkbenchLink(url, location.href);
      const fallbackName = name || new URL(url).hostname;
      const store = this.runtime.store;
      const row = destination?.before && this.data.shortcuts.find(
        (item) => item.id === destination.before
      );
      if (destination?.before && !row) {
        throw new Error('launcher: The destination changed; drop the link again.');
      }
      let group = destination
        ? row?.group ?? destination.group
        : this.runtime.launcherAddScreen;
      if (group === 'new') {
        group = await this.actions.muzeSolidLauncherCreateScreen();
      }
      const subject = await store.collection.create({
        id: 'urn:uuid:' + crypto.randomUUID(),
        a: this.api.prefixes.schema + 'SoftwareApplication',
        schema$name: fallbackName,
        ...(web ? { [this.api.webShortcutPredicate]: true } : {}),
        ...(group ? { [this.api.launcherGroups.groupPredicate]: { id: group } } : {}),
        schema$url: { id: url },
        ...(manifestIcon ? { schema$image: { id: manifestIcon } } : {}),
        ...(manifest
          ? { schema$subjectOf: { id: this.api.httpUrl(manifest) } }
          : {}),
        dcterms$modified: new Date().toISOString()
      }, { save: !row });
      if (override) {
        this.api.applyIconOverride(subject, override);
      }
      if (mode) {
        this.api.applyLaunchOverride(subject, mode);
      }
      if (anonymous) {
        this.api.applyAnonymousLaunch(subject, true);
      }
      if (row) {
        const subjects = this.data.shortcuts
          .filter((item) => item.group === group)
          .map((item) => store.collection.get(item.id));
        const index = subjects.findIndex((item) => item.id === row.id);
        subjects.splice(index, 0, subject);
        this.api.applyShortcutOrder(subjects);
      }
      if (mode || anonymous || override || row) {
        await store.collection.save(subject);
      }
      this.actions.render();
      this.runtime.host.notify('Shortcut saved on this device.');
      if (web && !localOnly && (!name || !icon)) {
        const owner = this.runtime.host.selectedWebId;
        this.actions.swbDiscoverShortcut({
          store, owner, id: subject.id, url, fallbackName,
          useTitle: !name, useIcon: !icon
        });
      }
    },
    async swbDiscoverShortcut(request) {
      const { store, owner, id, url, fallbackName } = request;
      const host = this.runtime.host;
      const pending = (this.runtime.shortcutLookups ||= new Map());
      pending.set(id, request);
      const current = () => this.runtime.store === store &&
        host.selectedWebId === owner && pending.get(id) === request;
      try {
        await host.ready;
        if (!current() || !navigator.onLine) {
          return;
        }
        const preferences = await host.readLocalPreferences();
        if (!current() || preferences.owner !== owner) {
          return;
        }
        const metadata = await this.api.shortcutMetadata.discoverShortcutMetadata(
          url, preferences.values.shortcutMetadataProvider, location.origin
        );
        if (!current()) {
          return;
        }
        const subject = store.collection.list().find((item) => item.id === id);
        const { idOf, valueAt, prefixes } = this.api;
        if (!subject || idOf(valueAt(subject, prefixes.schema + 'url')) !== url) {
          return;
        }
        let changed = false;
        if (request.useTitle && metadata.title
          && String(valueAt(subject, prefixes.schema + 'name')) === fallbackName) {
          subject.schema$name = metadata.title;
          changed = true;
        }
        if (request.useIcon && metadata.icon
          && !valueAt(subject, prefixes.apps + 'iconOverride')
          && !valueAt(subject, prefixes.schema + 'image')) {
          subject.graph.set(
            id, prefixes.schema + 'image', subject.graph.addNamedNode(metadata.icon)
          );
          changed = true;
        }
        if (changed) {
          subject.dcterms$modified = new Date().toISOString();
          await store.collection.save(subject);
          if (current()) {
            this.actions.render();
          }
        }
      }
      catch {
        // Discovery is optional. Keep the locally saved shortcut usable.
      }
      finally {
        if (pending.get(id) === request) {
          pending.delete(id);
        }
      }
    },
    shortcutRow(node) {
      const application = []
        .concat(node.a || [])
        .includes(this.api.prefixes.schema + 'SoftwareApplication');
      if (!application) {
        return { application: false };
      }
      const url = this.api.idOf(
        this.api.valueAt(node, this.api.prefixes.schema + 'url')
      );
      let settings = {
        href: null,
        override: '',
        location: '',
        anonymous: false
      };
      let problem = '';
      try {
        settings = this.api.shortcutLaunch(
          node,
          this.runtime.host.session?.webId
        );
      }
      catch (error) {
        problem = error.message;
      }
      let modeNote = '';
      if (settings.location === 'query') {
        modeNote =
          'Query mode sends your WebID and resource URL to the app’s server.';
        if (settings.anonymous) {
          modeNote =
            'Query mode sends only a specified resource URL to the app’s server.';
        }
      }
      else if (settings.location === 'fragment') {
        modeNote = 'Uses URL fragment (#).';
      }
      let icon = '';
      let override = '';
      try {
        const custom = this.api.idOf(
          this.api.valueAt(node, this.api.prefixes.apps + 'iconOverride')
        );
        override = custom ? this.api.httpUrl(custom) : '';
        const value = this.api.idOf(
          this.api.valueAt(node, this.api.prefixes.schema + 'image')
        );
        icon = override || (value ? this.api.httpUrl(value) : '');
      }
      catch {}
      const sprite = new URL('../assets/feather-icons.svg', location.href);
      if (!override) {
        for (const [app, symbol] of Object.entries({
          files: 'folder',
          contacts: 'users',
          profile: 'user',
          workbench: 'grid'
        })) {
          const appUrl = new URL('../' + app + '/', location.href);
          const isLocalApp = url?.split(/[?#]/, 1)[0] === appUrl.href;
          const oldDefault = sprite.href + '#' + symbol;
          if (isLocalApp && (!icon || icon === oldDefault)) {
            // Update the view of cached default artwork without rewriting RDF
            // or replacing a user-selected or external application's image.
            icon = new URL('icon.svg', appUrl).href;
          }
        }
      }
      const discoveredIcon = settings.web && icon && !override;
      if (discoveredIcon && this.runtime.shortcutIconFailures?.has(icon)) {
        icon = '';
      }
      icon ||= sprite.href + '#grid';
      const usesSprite = icon.startsWith(sprite.href + '#');
      let order = null;
      try {
        order = this.api.shortcutOrder(node);
      }
      catch (error) {
        problem ||= error.message;
      }
      const label = String(
        this.api.valueAt(node, this.api.prefixes.schema + 'name') || url
      );
      const view = {
        id: node.id,
        order,
        group: this.api.launcherGroups.shortcutGroup(node),
        menuPlacement: {},
        shortcutAttributes: {
          'data-swb-shortcut': node.id,
          class: 'swb-shortcut swb-list-item'
        },
        iconUrl: override,
        icon: {
          src: usesSprite ? null : icon,
          hidden: usesSprite ? '' : null,
          crossorigin: !usesSprite && discoveredIcon ? 'anonymous' : null
        },
        spriteIcon: { href: usesSprite ? icon : null },
        spriteVisibility: { hidden: usesSprite ? null : '' },
        label,
        labelAttributes: {
          class: 'muze-solid-launcher-label ' +
            (/\s/.test(label) ? 'solid-label-two-lines'
              : 'solid-label-one-line')
        },
        mode: settings.override,
        anonymous: settings.anonymous,
        modeNote,
        problem,
        link: {
          href: settings.href,
          target: '_blank',
          rel: settings.web ? 'noopener noreferrer' : 'opener',
          title: label
        }
      };
      return {
        application,
        view
      };
    },
    initializeShortcuts() {
      const owner = this;
      const list = this.api.model({ data: [], options: { insertBefore: '' } });
      list.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return owner.api.effect(() =>
          owner.api
            .from(input.current)
            .where(owner.actions.isShortcut)
            .select(owner.actions.shortcutView)
            .orderBy({ order: owner.actions.swbCompareShortcutOrder })
            .toArray()
        );
      });
      this.runtime.shortcuts = list;
      this.actions.muzeSolidLauncherInitializeScreens();
      this.runtime.shortcutEffect = this.api.effect(() => {
        this.data.shortcuts = list.view.current;
        this.data.empty = list.view.current.length
          ? ''
          : 'Add links to other applications you use.';
      });
      this.runtime.shortcutPreviewEffect = this.api.effect(() => {
        const target = list.state.options.insertBefore;
        const firstInGroup = new Set();
        for (const row of list.view.current) {
          const first = !firstInGroup.has(row.group);
          firstInGroup.add(row.group);
          row.shortcutAttributes.class =
            row.id === target
              ? 'swb-shortcut swb-list-item solid-insert-before' +
                (first ? ' solid-insert-inside' : '')
              : 'swb-shortcut swb-list-item';
        }

        for (const screen of this.runtime.launcherScreens.view.current || []) {
          screen.endAttributes.class =
            'solid-tool muze-solid-launcher-screen-end' +
            (target === 'end:' + screen.id
              ? ' solid-insert-before' +
                (screen.shortcuts.length ? '' : ' solid-insert-inside')
              : '');
        }
      });
    },
    isShortcut(row) {
      return row.application;
    },
    swbCompareShortcutOrder(a, b) {
      // Unpositioned new shortcuts follow the explicitly ordered ones.
      return (
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER)
      );
    },
    shortcutView(row) {
      return row.view;
    }
  }
};
