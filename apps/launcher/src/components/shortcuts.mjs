import styles from './shortcuts.css' with { type: 'text' };
import sourceLauncherNavigation from '../navigation.html' with { type: 'text' };
import sourceLauncherShortcuts from '../shortcuts.html' with { type: 'text' };

export const shortcuts = {
  styles: { 'swb-workbench-shortcuts': styles },
  templates: {
    'launcher-navigation': sourceLauncherNavigation,
    'launcher-shortcuts': sourceLauncherShortcuts
  },
  commands: {
    async muzeSolidLauncherAddDialog() {
      await this.commands.call('muzeSolidCatalogOpen');
      this.actions.muzeSolidCatalogSelectCategory('manual');
      this.actions.muzeSolidCatalogFocusDetails();
    },
    swb_shortcutSettings(button) {
      return this.actions.muzeSolidDesignOpenDialog(
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
        this.api.applyIconOverride(node, icon);
        node.schema$name = name;
        await this.runtime.store.collection.save(node);
        await this.actions.muzeSolidDesignCloseDialog(details);
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
        name: form.elements.name.value,
        mode: form.elements.launchMode.value,
        anonymous: form.elements.anonymous.checked,
        manifest: form.elements.manifest.value.trim(),
        icon: form.elements.icon.value.trim()
      };
      return this.actions.muzeSolidCatalogOperation(async () => {
        await this.actions.addShortcut(values);
        form.reset();
        await this.actions.muzeSolidDesignCloseDialog(form.closest('dialog'));
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
      this.runtime.shortcuts.state.data = this.api
        .from(this.runtime.store.collection.list())
        .select(this.actions.shortcutRow)
        .toArray();
    },
    handleRemove(id) {
      this.runtime.host.run(async () => {
        await this.runtime.store.collection.delete(id);
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
      description
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
      const subject = await this.runtime.store.collection.create({
        id: 'urn:uuid:' + crypto.randomUUID(),
        a: this.api.prefixes.schema + 'SoftwareApplication',
        schema$name: name,
        schema$url: { id: url },
        ...(manifestIcon ? { schema$image: { id: manifestIcon } } : {}),
        ...(manifest
          ? { schema$subjectOf: { id: this.api.httpUrl(manifest) } }
          : {}),
        dcterms$modified: new Date().toISOString()
      });
      if (override) {
        this.api.applyIconOverride(subject, override);
      }
      if (mode) {
        this.api.applyLaunchOverride(subject, mode);
      }
      if (anonymous) {
        this.api.applyAnonymousLaunch(subject, true);
      }
      if (mode || anonymous || override) {
        await this.runtime.store.collection.save(subject);
      }
      this.actions.render();
      this.runtime.host.notify('Shortcut saved on this device.');
    },
    shortcutRow(node) {
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
      icon ||= sprite.href + '#grid';
      const usesSprite = icon.startsWith(sprite.href + '#');
      const view = {
        id: node.id,
        iconUrl: override,
        icon: { src: usesSprite ? null : icon, hidden: usesSprite ? '' : null },
        spriteIcon: { href: usesSprite ? icon : null },
        spriteVisibility: { hidden: usesSprite ? null : '' },
        label: String(
          this.api.valueAt(node, this.api.prefixes.schema + 'name') || url
        ),
        mode: settings.override,
        anonymous: settings.anonymous,
        modeNote,
        problem,
        link: { href: settings.href, target: '_blank', rel: 'opener' }
      };
      return {
        application: []
          .concat(node.a || [])
          .includes(this.api.prefixes.schema + 'SoftwareApplication'),
        view
      };
    },
    initializeShortcuts() {
      const owner = this;
      const list = this.api.model({ data: [], options: {} });
      list.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return owner.api.effect(() =>
          owner.api
            .from(input.current)
            .where(owner.actions.isShortcut)
            .select(owner.actions.shortcutView)
            .toArray()
        );
      });
      this.runtime.shortcuts = list;
      this.runtime.shortcutEffect = this.api.effect(() => {
        this.data.shortcuts = list.view.current;
        this.data.empty = list.view.current.length
          ? ''
          : 'Add links to other applications you use.';
      });
    },
    isShortcut(row) {
      return row.application;
    },
    shortcutView(row) {
      return row.view;
    }
  }
};
