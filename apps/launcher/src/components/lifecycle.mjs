export const lifecycle = {
  events: {
    swbWorkspaceOnline: {
      target: 'window',
      type: 'online',
      action: 'swb_queueSettingsSync'
    },
    swbWorkspaceBeforeUnload: {
      target: 'window',
      type: 'beforeunload',
      action: 'attemptExit'
    },
    swbWorkspacePageHide: {
      target: 'window',
      type: 'pagehide',
      action: 'attemptExit'
    }
  },
  actions: {
    async initialize() {
      this.actions.initializeShortcuts();
      this.runtime.store = undefined;
      this.runtime.selection = undefined;
      this.runtime.workspace = undefined;
      this.runtime.persistence = undefined;
      this.runtime.workspaceBusy = false;
      this.runtime.container = this.runtime.host.main;
      this.runtime.host.onPreferencesTaskComplete = (result) => {
        if (result?.diagnostics) {
          return this.actions.swb_openDiagnostics();
        }
      };
      this.runtime.host.onAuthenticationRestored = () => {
        const error = this.runtime.workspaceError;
        if (
          error?.code === 'sign_in_required' &&
          this.data.workspaceMessage === error.message
        ) {
          this.actions.workspaceMessage('');
          sessionStorage.removeItem('solid-apps.workspace-message');
        }
      };
      this.runtime.host.beforeAccountLeave = async () => {
        await this.runtime.workspace?.checkpoint();
        await this.runtime.persistence?.work;
        await this.runtime.persistence?.persist();
      };
      this.runtime.host.accountChanged = async (session) => {
        // Other app windows can acquire edits while the sign-in popup is open.
        await this.runtime.host.beforeAccountLeave();
        await this.runtime.workspace?.closeApps();
        localStorage.setItem('solid-apps.webId', session.webId);
        window.location.reload();
      };
      this.runtime.host.onConnect = async () => {
        this.actions.renderLinks();
        if (this.runtime.store) {
          this.actions.render();
        }
        if (this.runtime.persistence) {
          try {
            await this.actions.preparePod();
            await this.actions.swb_initializeDirectory();
          }
          catch (error) {
            this.actions.workspaceFailure(error);
          }
        }
      };
      this.actions.renderLinks();
      await this.runtime.host.ready;
      await this.runtime.host.run(async () => {
        this.runtime.persistence = new this.api.WorkspaceState({
          owner: this.runtime.host.selectedWebId || '',
          onStatus: (message) =>
            this.actions.workspaceFailure(new Error(message))
        });
        await this.runtime.persistence.open();
        this.api.initializeDirectory(
          this.runtime.persistence.snapshot,
          this.actions.swb_defaultSettings()
        );
        this.actions.createWorkspace();
        this.actions.workspaceMessage(
          'Saved on this device. Save to Pod to use your workspace elsewhere.'
        );
        try {
          const previous = JSON.parse(
            sessionStorage.getItem('solid-apps.workspace-message')
          );
          if (previous?.owner === (this.runtime.host.session?.webId || '')) {
            this.actions.workspaceMessage(
              'Previous attempt: ' + previous.message
            );
          }
        }
        catch {}
        if (this.runtime.host.session) {
          try {
            await this.actions.preparePod();
          }
          catch (error) {
            this.actions.workspaceFailure(error);
          }
        }
        await this.actions.swb_initializeDirectory();
        this.runtime.workspace.extra.directory =
          this.runtime.persistence.snapshot.directory;
        this.runtime.restoreTimer = setTimeout(
          () => this.runtime.workspace.restore(),
          900
        );
      });
      this.runtime.host.onPreferences = (values) => {
        if (this.runtime.workspace) {
          this.runtime.workspace.presentation = values.launchTarget;
        }
      };
      this.runtime.exitAttempted = false;
      this.eventBindings.start();
    },
    cleanup() {
      this.actions.swb_releaseBackground();
      clearTimeout(this.runtime.restoreTimer);
      clearTimeout(this.runtime.settingsSyncTimer);
      this.runtime.selection?.abort();
      this.runtime.workspace?.dispose();
      this.api.destroy(this.runtime.shortcutEffect);
      for (const signal of this.runtime.shortcuts.effects.slice(1)) {
        this.api.destroy(signal);
      }
    }
  }
};
