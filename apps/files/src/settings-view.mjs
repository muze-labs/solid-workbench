import template from './settings-view.html?template' with { type: 'text' };

export const muzeSolidFilesSettingsView = {
  templates: { 'muze-solid-files-settings-view': template },
  data: {
    muzeSolidFilesSettingsValue: '',
    muzeSolidFilesSettingsStatus: '',
    muzeSolidFilesSettingsDisabled: { inert: '' },
    muzeSolidFilesSettingsConflict: { hidden: '' }
  },
  events: {
    muzeSolidFilesSettingsSubmit: {
      target() {
        return this.container;
      },
      type: 'submit',
      action: 'muzeSolidFilesSettingsSubmit'
    },
    muzeSolidFilesSettingsInput: {
      target() {
        return this.container;
      },
      type: 'input',
      action: 'muzeSolidFilesSettingsDraft'
    },
    muzeSolidFilesSettingsOnline: {
      target: 'window',
      type: 'online',
      action: 'muzeSolidFilesSettingsSync'
    }
  },
  commands: {
    muzeSolidFilesSettingsSave(input) {
      return this.actions.muzeSolidFilesSettingsSave(input.value);
    },
    muzeSolidFilesSettingsRetry() {
      return this.actions.muzeSolidFilesSettingsSync();
    },
    async muzeSolidFilesSettingsKeep() {
      await this.runtime.state.resolve('filesRoot', true);
      await this.actions.muzeSolidFilesSettingsSync();
    },
    async muzeSolidFilesSettingsRemote() {
      await this.runtime.state.resolve('filesRoot', false);
      await this.actions.muzeSolidFilesSettingsSync();
    }
  },
  actions: {
    muzeSolidFilesSettingsSubmit(event) {
      event.preventDefault();
      return this.actions.muzeSolidFilesSettingsSave(
        this.container.querySelector('[name="filesRoot"]').value
      );
    },
    async muzeSolidFilesSettingsStart() {
      const host = this.runtime.host;
      await host.ready;
      host.manage({
        capabilities: [this.api.editPreferenceSectionCapability],
        onRequest: (event) => this.actions.muzeSolidFilesSettingsRequest(event),
        onView: (input) => this.actions.muzeSolidFilesSettingsView(input),
        canClose: () => ({
          allowed: !this.runtime.writes,
          saving: Boolean(this.runtime.writes)
        }),
        getState: () => null,
        restoreState: () => {}
      });
      this.eventBindings.start();
    },
    async muzeSolidFilesSettingsRequest(event) {
      const host = this.runtime.host;
      const input = event.input;
      try {
        if (
          event.capability !== this.api.editPreferenceSectionCapability ||
          input?.owner !== (host.selectedWebId || '') ||
          input.section !== 'files-storage' ||
          input.version !== 1 ||
          input.presentation?.interaction !== 'interactive' ||
          input.presentation?.geometry !== 'scroll'
        ) {
          throw new Error('files-settings: Invalid settings context.');
        }
        this.runtime.generation = input.generation;
        this.runtime.workspace = input.workspace;
        this.runtime.owner = input.owner;
        this.runtime.drafts = new this.api.PreferenceDrafts(input.owner);
        await this.runtime.drafts.open();
        const url =
          host.session?.preferencesUrl ||
          localStorage.getItem('solid-apps.preferences-url:' + input.owner) ||
          '';
        this.runtime.state = new this.api.PreferenceState({
          owner: input.owner,
          url
        });
        await this.runtime.state.open();
        if (input.workspace) {
          const snapshot =
            await this.actions.muzeSolidFilesSettingsWorkspace('read');
          this.runtime.revision = snapshot.revision;
          this.data.muzeSolidFilesSettingsValue =
            this.runtime.drafts.read(input.workspace, 'filesRoot') ??
            snapshot.settings.filesRoot;
        }
        else {
          this.data.muzeSolidFilesSettingsValue =
            this.runtime.state.drafts().filesRoot ??
            this.runtime.state.settings().filesRoot;
        }
        this.data.muzeSolidFilesSettingsDisabled = { inert: null };
        await host.managed.respond(event.id, {
          result: {
            version: 1,
            generation: input.generation,
            ready: true,
            presentation: 'interactive-scroll'
          }
        });
      }
      catch (error) {
        this.data.muzeSolidFilesSettingsStatus = error.message;
        await host.managed.respond(event.id, {
          error: { code: 'denied', message: error.message }
        });
      }
    },
    muzeSolidFilesSettingsWorkspace(operation, values) {
      return this.runtime.host.managed.peer.call('preferences-workspace', {
        owner: this.runtime.owner,
        operation,
        revision: this.runtime.revision,
        values
      });
    },
    async muzeSolidFilesSettingsDraft(event) {
      if (event.target.name !== 'filesRoot' || this.runtime.frozen) {
        return;
      }
      const text = event.target.value;
      this.runtime.writes = (this.runtime.writes || 0) + 1;
      try {
        if (this.runtime.workspace) {
          await this.runtime.drafts.write(
            this.runtime.workspace,
            'filesRoot',
            text
          );
        }
        else {
          await this.runtime.state.draft('filesRoot', text);
        }
        this.runtime.draftFailed = false;
      }
      catch (error) {
        this.runtime.draftFailed = true;
        this.data.muzeSolidFilesSettingsStatus = error.message;
      }
      finally {
        this.runtime.writes -= 1;
      }
    },
    async muzeSolidFilesSettingsSave(text) {
      if (this.runtime.frozen) {
        return;
      }
      this.runtime.writes = (this.runtime.writes || 0) + 1;
      try {
        if (this.runtime.workspace) {
          this.runtime.draftFailed = true;
          await this.runtime.drafts.write(
            this.runtime.workspace,
            'filesRoot',
            text
          );
          this.runtime.draftFailed = false;
          const snapshot = await this.actions.muzeSolidFilesSettingsWorkspace(
            'settings',
            { filesRoot: text }
          );
          this.runtime.revision = snapshot.revision;
          await this.runtime.drafts.write(this.runtime.workspace, 'filesRoot');
        }
        else {
          this.runtime.draftFailed = true;
          await this.runtime.state.draft('filesRoot', text);
          this.runtime.draftFailed = false;
          await this.runtime.state.change('filesRoot', text);
          this.api.announcePreferences(this.runtime.owner);
        }
        this.data.muzeSolidFilesSettingsStatus = 'Saved on this device.';
        this.runtime.draftFailed = false;
      }
      catch (error) {
        this.data.muzeSolidFilesSettingsStatus = error.message;
      }
      finally {
        this.runtime.writes -= 1;
      }
      if (!this.runtime.workspace) {
        await this.actions.muzeSolidFilesSettingsSync();
      }
    },
    async muzeSolidFilesSettingsSync() {
      const session = this.runtime.host.session;
      if (!this.runtime.state || this.runtime.frozen) {
        return;
      }
      try {
        if (this.runtime.workspace) {
          const snapshot =
            await this.actions.muzeSolidFilesSettingsWorkspace('read');
          this.runtime.revision = snapshot.revision;
          this.data.muzeSolidFilesSettingsStatus =
            'Workspace refreshed. Your draft is retained; save it to retry.';
          return;
        }
        if (
          !session?.preferencesUrl ||
          session.disconnected ||
          !navigator.onLine
        ) {
          return;
        }
        await session.perform(() => this.runtime.state.synchronize(session));
        this.data.muzeSolidFilesSettingsValue =
          this.runtime.state.drafts().filesRoot ??
          this.runtime.state.settings().filesRoot;
        this.data.muzeSolidFilesSettingsConflict = { hidden: '' };
        this.data.muzeSolidFilesSettingsStatus = 'Preferences synchronized.';
        this.api.announcePreferences(this.runtime.owner);
      }
      catch (error) {
        this.data.muzeSolidFilesSettingsStatus =
          'Your choice is retained. ' + error.message;
        this.data.muzeSolidFilesSettingsConflict = {
          hidden: this.runtime.state.conflicts?.includes('filesRoot')
            ? null
            : ''
        };
      }
    },
    muzeSolidFilesSettingsView(input) {
      if (input.generation !== this.runtime.generation) {
        throw new Error('files-settings: Retired settings view.');
      }
      if (input.operation === 'prepare') {
        if (this.runtime.writes || this.runtime.draftFailed) {
          return {
            allowed: false,
            message: 'Wait for local draft storage or retry.'
          };
        }
        this.runtime.frozen = true;
        this.data.muzeSolidFilesSettingsDisabled = { inert: '' };
        return { allowed: true, frozen: true };
      }
      if (input.operation === 'update') {
        return { ready: true };
      }
      throw new Error('files-settings: Unsupported view operation.');
    }
  }
};
