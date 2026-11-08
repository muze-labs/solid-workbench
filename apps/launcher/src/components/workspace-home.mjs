import template from '../workspace-home.html' with { type: 'text' };
import styles from './workspace-home.css' with { type: 'text' };

export const workspaceHome = {
  templates: { 'swb-workspace-home': template },
  styles: { 'swb-workspace-home': styles },
  commands: {
    swb_workspaceRecovery() {
      return this.actions.swb_openDiagnostics();
    }
  },
  actions: {
    swb_openDiagnostics() {
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.swb-diagnostics')
      );
    },
    swb_requireOwner() {
      const selected = this.runtime.host.selectedWebId || '';
      if (selected !== this.runtime.persistence?.owner) {
        throw new Error(
          'launcher: Reopen Workbench for the selected WebID. Your other workspace is retained.'
        );
      }
    },
    swb_defaultSettings() {
      const settings = {};
      for (const key of this.api.workspaceSettingKeys) {
        const name = key.replace(/Resource$/, '');
        settings[key] =
          this.runtime.host.preferences[key] ||
          (key === 'filesRoot'
            ? this.runtime.host.session?.storage[0] || ''
            : this.runtime.host.session
              ? this.runtime.host.resource(name)
              : '');
      }
      return settings;
    },
    async swb_initializeDirectory() {
      const persistence = this.runtime.persistence;
      const next = structuredClone(persistence.snapshot);
      this.api.initializeDirectory(next, this.actions.swb_defaultSettings());
      if (this.runtime.host.session) {
        next.directory.profileStorage = [...this.runtime.host.session.storage];
      }
      const entry = this.api.activeWorkspace(next);
      if (persistence.owner) {
        const defaults = this.actions.swb_defaultSettings();
        for (const key of this.api.workspaceSettingKeys) {
          entry.settings[key] ||= defaults[key];
        }
      }
      let store = await this.actions.swb_openShortcuts(entry);
      const previous = this.runtime.store;
      if (previous?.localKey.startsWith('anonymous:') && persistence.owner) {
        await this.api.backgrounds.adoptAnonymousImages(
          next.directory,
          persistence.owner
        );
      }
      if (
        previous?.localKey.startsWith('anonymous:') &&
        persistence.owner &&
        previous.collection.list().length &&
        previous.localKey !== store.localKey
      ) {
        await this.api.recoverCollection(previous.localKey, store.localKey);
        store = await this.actions.swb_openShortcuts(entry);
      }
      await persistence.stage(next);
      this.runtime.store = store;
      this.runtime.host.workspaceContext = {
        id: entry.id,
        title: entry.title,
        owner: persistence.owner,
        settings: entry.settings,
        save: (values) => this.actions.swb_saveWorkspaceSettings(values)
      };
      this.runtime.workspace.extra.directory = next.directory;
      this.actions.swb_renderDirectory();
      this.actions.render();
    },
    async swb_openShortcuts(entry) {
      const owner = this.runtime.persistence.owner || 'anonymous';
      const resourceKey = entry.settings.launcherResource || entry.id;
      const store = await this.api.openCollection('launcher', {
        localKey: owner + ':' + resourceKey,
        scalarPredicates: [
          this.api.prefixes.schema + 'name',
          this.api.prefixes.schema + 'url',
          this.api.overridePredicate,
          this.api.anonymousPredicate,
          this.api.prefixes.schema + 'image',
          this.api.prefixes.apps + 'iconOverride'
        ]
      });
      if (this.runtime.host.session && entry.settings.launcherResource) {
        try {
          await this.runtime.host.session.perform(
            () =>
              store.service.connect({
                solid: this.runtime.host.session.solid,
                resources: {
                  launcher: { url: entry.settings.launcherResource }
                }
              }),
            { interactive: false }
          );
        }
        catch (error) {
          store.readError = error;
        }
      }
      if (!entry.seeded) {
        const roots = [
          ...new Set([
            ...(this.runtime.host.session?.storage ||
              this.runtime.persistence.snapshot.directory?.profileStorage ||
              []),
            ...entry.storage
          ])
        ];
        for (const root of roots) {
          const url = this.api.launchUrl(
            new URL('../files/', location.href).href,
            { webId: this.runtime.host.session?.webId, resource: root }
          );
          if (
            !store.collection
              .list()
              .some(
                (node) =>
                  this.api.idOf(
                    this.api.valueAt(node, this.api.prefixes.schema + 'url')
                  ) === url
              )
          ) {
            await store.collection.create({
              id: 'urn:uuid:' + crypto.randomUUID(),
              a: this.api.prefixes.schema + 'SoftwareApplication',
              schema$name:
                'Files · ' +
                (new URL(root).pathname.split('/').filter(Boolean).at(-1) ||
                  new URL(root).hostname),
              schema$url: { id: url },
              schema$image: {
                id: new URL('../assets/feather-icons.svg#folder', location.href)
                  .href
              }
            });
          }
        }
        // An anonymous start cannot yet discover profile storage locations.
        entry.seeded = roots.length > 0;
      }
      store.resourceUrl = entry.settings.launcherResource;
      return store;
    },
    swb_renderDirectory() {
      const snapshot = this.runtime.persistence.snapshot;
      const entry = this.api.activeWorkspace(snapshot);
      this.data.swb_workspaceTitle = entry.title;
      const account = this.runtime.host.view;
      account.runtime.workbench = this;
      account.data.muzeSolidUiTitle = entry.title;
      account.data.swb_workspaceMenuVisibility = {
        hidden: snapshot.directory.entries.length > 1 ? null : ''
      };
      account.data.swb_workspaceMenu = snapshot.directory.entries.map(
        (item) => ({
          id: item.id,
          title: item.title,
          attributes: {
            'aria-current': item.id === entry.id ? 'true' : null,
            'aria-label':
              (item.id === entry.id
                ? 'Current workspace: '
                : 'Switch to workspace: ') + item.title,
            disabled: item.id === entry.id ? '' : null
          }
        })
      );
      this.runtime.preferencesRevision =
        (this.runtime.preferencesRevision || 0) + 1;
      this.actions.swb_renderBackground();
    },
    async swb_saveWorkspaceSettings(values, storage) {
      this.actions.swb_requireOwner();
      const next = structuredClone(this.runtime.persistence.snapshot);
      const entry = this.api.activeWorkspace(next);
      for (const [key, value] of Object.entries(values)) {
        if (!this.api.workspaceSettingKeys.includes(key)) {
          throw new Error('launcher: Unsupported workspace setting.');
        }
        entry.settings[key] = value ? this.api.httpUrl(value) : '';
      }
      if (storage) {
        entry.storage = storage;
        entry.seeded = false;
      }
      this.api.validateDirectory(next.directory);
      await this.runtime.persistence.stage(next);
      this.runtime.workspace.extra.directory = next.directory;
      this.runtime.host.workspaceContext.settings = entry.settings;
      this.actions.swb_renderDirectory();
      return entry.settings;
    },
    async swb_switchWorkspace(id) {
      this.actions.swb_requireOwner();
      const persistence = this.runtime.persistence;
      if (persistence.snapshot.directory.active === id) {
        return;
      }
      this.actions.workspaceMessage('Saving current workspace on this device…');
      await this.runtime.workspace.checkpoint();
      await persistence.work;
      const previous = structuredClone(persistence.snapshot);
      const next = this.api.selectWorkspace(structuredClone(previous), id);
      const entry = this.api.activeWorkspace(next);
      const store = await this.actions.swb_openShortcuts(entry);
      try {
        await persistence.stage(next, {});
      }
      catch (error) {
        persistence.snapshot = previous;
        throw error;
      }
      this.runtime.workspace.closeApps();
      this.runtime.store = store;
      this.actions.createWorkspace();
      this.runtime.host.workspaceContext = {
        id,
        title: entry.title,
        owner: persistence.owner,
        settings: entry.settings,
        save: (values) => this.actions.swb_saveWorkspaceSettings(values)
      };
      this.actions.render();
      this.actions.swb_renderDirectory();
      this.runtime.workspace.restore();
      this.actions.workspaceMessage(
        'Opened ' + entry.title + '. Changes are saved on this device.'
      );
      this.runtime.host.view.container
        .querySelector('.ds-panels-title')
        ?.focus();
    },
    swb_contextFor(record) {
      const url = new URL(record.entry.url);
      let keys = [];
      for (const [app, settings] of [
        ['contacts', ['contactsResource']],
        ['files', ['filesRoot']],
        ['profile', url.searchParams.has('contact') ? ['contactsResource'] : []]
      ]) {
        const expected = new URL('../' + app + '/', location.href);
        if (
          url.origin === expected.origin &&
          url.pathname === expected.pathname
        ) {
          keys = settings;
        }
      }
      const snapshot = this.runtime.persistence.snapshot;
      const active = this.api.activeWorkspace(snapshot);
      const identity =
        this.api.parseLaunchUrl(record.entry.url).context.webId || '';
      if (!keys.length || identity !== this.runtime.persistence.owner) {
        return null;
      }
      return {
        id: active.id,
        title: active.title,
        owner: this.runtime.persistence.owner,
        settings: Object.fromEntries(
          keys.map((key) => [key, active.settings[key] || ''])
        )
      };
    },
    async swb_saveAppPreferences(record, input) {
      const context = this.actions.swb_contextFor(record);
      if (
        !context ||
        !input ||
        input.id !== context.id ||
        !input.values ||
        Object.keys(input.values).some(
          (key) => !Object.hasOwn(context.settings, key)
        )
      ) {
        throw new Error(
          'launcher: App cannot change these workspace settings.'
        );
      }
      await this.actions.swb_saveWorkspaceSettings(input.values);
      return this.actions.swb_contextFor(record).settings;
    }
  }
};

// The shared header owns the menu DOM; workspace policy stays in Workbench.
export const workspaceMenu = {
  commands: {
    swb_switchWorkspace(button, id) {
      button.closest('[popover]').hidePopover();
      const workbench = this.runtime.workbench;
      return workbench.actions.workspaceOperation(() =>
        workbench.actions.swb_switchWorkspace(id)
      );
    }
  }
};
