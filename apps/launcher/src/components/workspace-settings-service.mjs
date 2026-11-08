// Preferences requests domain operations; Workbench keeps the live writer.
export const workspaceSettingsService = {
  actions: {
    async swb_editPreferences(record, input) {
      const expected = new URL('../preferences/', location.href);
      const caller = new URL(record.entry.url);
      if (
        caller.origin !== expected.origin ||
        caller.pathname !== expected.pathname ||
        input?.owner !== this.runtime.persistence.owner
      ) {
        throw new Error('launcher: This settings request is not authorized.');
      }
      this.actions.swb_requireOwner();
      if (input.operation === 'read') {
        return this.actions.swb_preferencesSnapshot();
      }
      if (
        this.runtime.workspaceBusy ||
        input.revision !== this.runtime.preferencesRevision
      ) {
        throw new Error(
          'launcher: Workspace changed. Refresh settings before retrying.'
        );
      }
      this.runtime.workspaceBusy = true;
      try {
        const next = structuredClone(this.runtime.persistence.snapshot);
        const entry = next.directory.entries.find(
          (item) => item.id === input.id
        );
        if (input.operation !== 'create' && !entry) {
          throw new Error('launcher: This workspace no longer exists.');
        }
        if (input.operation === 'sync') {
          this.actions.swb_queueSettingsSync();
          return this.actions.swb_preferencesSnapshot();
        }
        if (input.operation === 'create') {
          this.api.addWorkspace(next, input.title);
        }
        else if (input.operation === 'delete') {
          this.api.removeWorkspace(next, input.id);
        }
        else if (input.operation === 'rename') {
          entry.title = input.title;
        }
        else if (input.operation === 'settings') {
          for (const [key, text] of Object.entries(input.values || {})) {
            if (!this.api.workspaceSettingKeys.includes(key)) {
              throw new Error('launcher: Unsupported workspace setting.');
            }
            entry.settings[key] = text ? this.api.httpUrl(text) : '';
            if (key === 'filesRoot' && text && !text.endsWith('/')) {
              throw new Error(
                'launcher: Files starting folder must end with /.'
              );
            }
          }
          if (input.storage) {
            entry.storage = input.storage.map((url) => this.api.httpUrl(url));
            if (entry.storage.some((url) => !url.endsWith('/'))) {
              throw new Error('launcher: Storage endpoints must end with /.');
            }
            entry.seeded = false;
          }
        }
        else if (input.operation === 'background') {
          const id = input.background;
          if (
            id &&
            !this.api.backgrounds.isUpload(id) &&
            !/^urn:muze:solid-workbench:background:bg[1-6]$/.test(id)
          ) {
            this.api.httpUrl(id);
          }
          entry.background = id;
        }
        else if (input.operation === 'recover-shortcuts') {
          const active = next.directory.active === entry.id;
          const store = active
            ? this.runtime.store
            : await this.actions.swb_openShortcuts(entry);
          await this.api.recoverCollection('launcher', store.localKey);
          if (active) {
            this.runtime.store = await this.actions.swb_openShortcuts(entry);
            this.actions.render();
          }
        }
        else if (input.operation === 'diagnostics') {
          return this.actions.swb_preferencesSnapshot();
        }
        else {
          throw new Error('launcher: Unsupported settings operation.');
        }
        this.api.validateDirectory(next.directory);
        const previous = this.runtime.persistence.snapshot;
        try {
          await this.runtime.persistence.stage(next);
        }
        catch (error) {
          this.runtime.persistence.snapshot = previous;
          throw error;
        }
        this.runtime.workspace.extra.directory = next.directory;
        this.runtime.host.workspaceContext.settings =
          this.api.activeWorkspace(next).settings;
        this.actions.swb_renderDirectory();
        this.actions.swb_queueSettingsSync();
        return this.actions.swb_preferencesSnapshot();
      }
      finally {
        this.runtime.workspaceBusy = false;
      }
    },
    swb_preferencesSnapshot() {
      const directory = this.runtime.persistence.snapshot.directory;
      return {
        owner: this.runtime.persistence.owner,
        revision: this.runtime.preferencesRevision,
        active: directory.active,
        entries: directory.entries.map(
          ({ id, title, settings, storage, background }) => ({
            id,
            title,
            settings,
            storage,
            background
          })
        ),
        pending: this.runtime.persistence.dirty,
        message: this.runtime.settingsSyncError || ''
      };
    },
    swb_notifyPreferences() {
      for (const record of this.runtime.workspace.instances.values()) {
        if (
          record.registered &&
          record.capabilities.includes(this.api.editPreferencesCapability)
        ) {
          record.peer
            .call('preferences-update', this.actions.swb_preferencesSnapshot())
            .catch(() => {});
        }
      }
    },
    swb_queueSettingsSync() {
      clearTimeout(this.runtime.settingsSyncTimer);
      this.runtime.settingsSyncTimer = setTimeout(async () => {
        if (!this.runtime.host.session || !navigator.onLine) {
          return;
        }
        if (this.runtime.workspaceBusy) {
          this.actions.swb_queueSettingsSync();
          return;
        }
        this.runtime.workspaceBusy = true;
        try {
          await this.runtime.host.session.perform(
            () => this.actions.saveWorkspace(),
            { interactive: false }
          );
          this.runtime.settingsSyncError = '';
        }
        catch (error) {
          this.runtime.settingsSyncError = error.message;
          this.actions.workspaceFailure(error);
        }
        finally {
          this.runtime.workspaceBusy = false;
          this.actions.swb_notifyPreferences();
        }
      }, 700);
    }
  }
};
