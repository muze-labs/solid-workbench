export const preferences = {
  events: {
    swbPreferencesInput: {
      target() {
        return this.container;
      },
      type: 'input',
      action: 'swb_preserveDraft'
    },
    swbPreferencesEnter: {
      target() {
        return this.container;
      },
      type: 'keydown',
      action: 'swb_commitText'
    },
    swbPreferencesOnline: {
      target: 'window',
      type: 'online',
      action: 'swb_synchronize'
    }
  },
  commands: {
    swb_changeSetting(input) {
      return this.actions.swb_applySetting(input.name, input.value);
    },
    async swb_retrySync() {
      await this.actions.swb_synchronize({ interactive: true });
      if (this.runtime.directory) {
        await this.actions.swb_workspaceOperation('sync');
      }
    },
    swb_keepLocal(_button, id) {
      return this.actions.swb_resolveConflict(id, true);
    },
    swb_useRemote(_button, id) {
      return this.actions.swb_resolveConflict(id, false);
    }
  },
  actions: {
    swb_commitText(event) {
      const input = event.target;
      const command = input.dataset?.simplyCommand;
      if (
        event.key !== 'Enter' ||
        input.tagName !== 'INPUT' ||
        input.type === 'file' ||
        !command
      ) {
        return;
      }
      event.preventDefault();
      return this.commands.call(command, input, input.value, event);
    },
    cleanup() {
      this.actions.swb_cleanupProviders();
      clearTimeout(this.runtime.syncTimer);
      if (this.runtime.previewUrl) {
        URL.revokeObjectURL(this.runtime.previewUrl);
      }
    },
    swb_localWriteStarted() {
      this.runtime.localWrites = (this.runtime.localWrites || 0) + 1;
      this.runtime.localSaving = true;
    },
    swb_localWriteFinished() {
      this.runtime.localWrites -= 1;
      this.runtime.localSaving = this.runtime.localWrites > 0;
    },
    async swb_initializePreferences() {
      const host = this.runtime.host;
      host.onAuthenticationRestored = () => {
        if (this.runtime.syncError?.code === 'sign_in_required' &&
            this.data.swb_status === this.runtime.syncErrorMessage) {
          this.data.swb_status =
            'Signed in. Your choices are retained; retry synchronization.';
        }
      };
      host.onConnect = () => this.actions.swb_loadSettings();
      host.onPreferences = () => this.actions.swb_receiveSharedSettings();
      await host.ready;
      this.actions.swb_initializeProviders();
      await this.actions.swb_loadSettings();
      host.manage({
        capabilities: [this.api.editPreferencesCapability],
        waitForPresentation: true,
        onFocus: () => this.actions.swb_focusSelectedSection(),
        onRequest: (event) => this.actions.swb_receivePreferences(event),
        onCancel: () => {
          this.runtime.request = null;
        },
        onPreferences: (snapshot) => this.actions.swb_workspaceStatus(snapshot),
        getState: () => null,
        restoreState: () => {},
        canClose: () => ({
          allowed: !this.runtime.localWrites,
          saving: Boolean(this.runtime.localWrites)
        })
      });
      this.actions.swb_selectSection('appearance');
      this.eventBindings.start();
    },
    async swb_receiveSharedSettings() {
      const state = this.runtime.settings;
      if (!state || state.owner !== this.runtime.host.selectedWebId) {
        return;
      }
      try {
        await state.open();
        const drafts = state.drafts();
        const values = state.settings();
        for (const key of Object.keys(this.api.defaults)) {
          if (!Object.hasOwn(drafts, key)) {
            this.data[key] = values[key];
          }
        }
        this.api.applyPreferences(values);
        this.actions.swb_renderProvider();
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
    },
    async swb_receivePreferences(event) {
      const host = this.runtime.host;
      const input = event.input;
      if (
        event.capability !== this.api.editPreferencesCapability ||
        input?.owner !== host.selectedWebId ||
        !['workbench', 'launcher', 'contacts', 'files', 'profile'].includes(
          input.app
        )
      ) {
        await host.managed.respond(event.id, {
          error: {
            code: 'denied',
            message: 'preferences: Invalid app or owner context.'
          }
        });
        return;
      }
      this.runtime.request = event;
      this.data.swb_app = input.app === 'launcher' ? 'workbench' : input.app;
      this.runtime.callerWorkspace = input.workspace;
      await this.actions.swb_loadSettings();
      await this.actions.swb_loadWorkspace();
      this.data.swb_applicationChoice = { hidden: '' };
      this.actions.swb_selectSection('appearance');
      host.managed.presentationReady();
    },
    async swb_loadSettings() {
      const host = this.runtime.host;
      const owner = host.selectedWebId || '';
      const url =
        host.session?.preferencesUrl ||
        localStorage.getItem('solid-apps.preferences-url:' + owner) ||
        '';
      this.runtime.settings = new this.api.PreferenceState({ owner, url });
      this.runtime.drafts = new this.api.PreferenceDrafts(owner);
      await this.runtime.drafts.open();
      await this.runtime.settings.open();
      Object.assign(
        this.data,
        this.runtime.settings.settings(),
        this.runtime.settings.drafts()
      );
      this.api.applyPreferences(this.runtime.settings.settings());
      await this.actions.swb_synchronize();
      this.actions.swb_renderProvider();
    },
    async swb_preserveDraft(event) {
      const input = event.target;
      if (!input.name || input.type === 'file') {
        return;
      }
      this.actions.swb_localWriteStarted();
      try {
        const workspaceField =
          input.closest('[data-swb-preferences-workspace]') ||
          (this.runtime.callerWorkspace &&
            ['filesRoot', 'contactsResource', 'launcherResource'].includes(
              input.name
            ));
        if (workspaceField) {
          await this.runtime.drafts.write(
            this.data.swb_workspaceId || 'new',
            input.name,
            input.value
          );
        }
        else if (Object.hasOwn(this.api.defaults, input.name)) {
          await this.runtime.settings.draft(input.name, input.value);
        }
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
      finally {
        this.actions.swb_localWriteFinished();
      }
    },
    async swb_applySetting(key, text) {
      if (
        this.runtime.callerWorkspace &&
        ['filesRoot', 'contactsResource', 'launcherResource'].includes(key)
      ) {
        this.actions.swb_localWriteStarted();
        try {
          await this.runtime.drafts.write(
            this.runtime.callerWorkspace,
            key,
            text
          );
          await this.actions.swb_workspaceOperation('settings', {
            values: { [key]: text }
          });
        }
        finally {
          this.actions.swb_localWriteFinished();
        }
        return;
      }
      this.actions.swb_localWriteStarted();
      try {
        // Keep invalid input as a recoverable draft before validation.
        await this.runtime.settings.draft(key, text);
        const values = await this.runtime.settings.change(key, text);
        this.data[key] = text;
        this.api.applyPreferences(values);
        this.api.announcePreferences(this.runtime.host.selectedWebId || '');
        this.data.swb_status = 'Saved on this device. Synchronizing…';
        clearTimeout(this.runtime.syncTimer);
        this.runtime.syncTimer = setTimeout(
          () => this.actions.swb_synchronize(),
          400
        );
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
      finally {
        this.actions.swb_localWriteFinished();
      }
    },
    async swb_synchronize({ interactive = false } = {}) {
      if (!this.runtime.settings) {
        return;
      }
      const session = this.runtime.host.session;
      if (!session?.preferencesUrl || session.disconnected ||
          !navigator.onLine) {
        this.data.swb_status = '';
        return;
      }
      try {
        await session.perform(
          () => this.runtime.settings.synchronize(session),
          { interactive }
        );
        Object.assign(
          this.data,
          this.runtime.settings.settings(),
          this.runtime.settings.drafts()
        );
        this.api.applyPreferences(this.runtime.settings.settings());
        this.actions.swb_renderProvider();
        this.api.announcePreferences(session.webId);
        this.data.swb_status = 'Preferences synchronized with your Pod.';
        this.data.swb_conflicts = [];
      }
      catch (error) {
        const connectionRequired =
          ['sign_in_required', 'disconnected'].includes(error.code);
        this.data.swb_status = connectionRequired
          ? '' : 'Your choices are retained. ' + error.message;
        this.runtime.syncError = error;
        this.runtime.syncErrorMessage = this.data.swb_status;
        this.data.swb_conflicts = (this.runtime.settings.conflicts || []).map(
          (id) => ({
            id,
            label:
              id +
              ': your choice “' +
              this.actions.swb_preferenceLabel(id, this.runtime.settings.settings()[id]) +
              '”; Pod choice “' +
              this.actions.swb_preferenceLabel(id, this.runtime.settings.confirmed(id)) +
              '”.'
          })
        );
      }
    },
    swb_preferenceLabel(id, value) {
      return ['browseProvider', 'recipientProvider', 'viewProvider'].includes(id)
        ? this.actions.swb_providerLabel(value, id) : String(value);
    },
    async swb_resolveConflict(id, keepLocal) {
      try {
        await this.runtime.settings.resolve(id, keepLocal);
        Object.assign(
          this.data,
          this.runtime.settings.settings(),
          this.runtime.settings.drafts()
        );
        this.api.applyPreferences(this.runtime.settings.settings());
        this.actions.swb_renderProvider();
        this.api.announcePreferences(this.runtime.host.selectedWebId || '');
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
      await this.actions.swb_synchronize();
    }
  }
};
