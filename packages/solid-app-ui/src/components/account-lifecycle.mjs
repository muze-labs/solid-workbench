export const accountLifecycle = {
  events: {
    muzeSolidUiOffline: {
      target: 'window',
      type: 'offline',
      action: 'muzeSolidUiAccountStatus'
    },
    swbAccountStorage: {
      target: 'window',
      type: 'storage',
      action: 'accountRemoved'
    },
    swbPreferencesOnline: {
      target: 'window',
      type: 'online',
      action: 'swb_refreshPreferences'
    },
    swbPreferencesVisible: {
      target() {
        return this.container.ownerDocument;
      },
      type: 'visibilitychange',
      action: 'swb_refreshPreferences'
    },
    swbAccountLaunchChange: {
      target: 'window',
      type: 'hashchange',
      action: 'launchChanged',
      when() {
        return this.runtime.acceptLaunch;
      }
    }
  },
  actions: {
    initialize() {
      this.runtime.preferences = this.api.preferenceConsumer({
        getSession: () => this.runtime.session,
        getOwner: () => this.runtime.host.selectedWebId,
        onChange: (values) => {
          this.runtime.settings = {
            ...values,
            ...this.runtime.workspaceContext?.settings
          };
          this.runtime.host.onPreferences?.(this.runtime.settings);
          this.actions.muzeSolidUiPublishAccount?.();
        }
      });
      this.api.applyPreferences(this.runtime.settings);
      this.actions.muzeSolidUiAccountStatus();
      let remembered = '';
      try {
        remembered = localStorage.getItem('solid-apps.webId') || '';
        if (remembered) {
          remembered = this.api.httpUrl(remembered);
        }
      }
      catch {}
      const launch = this.runtime.host.launch;
      const different =
        launch.webId && remembered && launch.webId !== remembered;
      const webId = launch.webId || remembered;
      this.runtime.selectedWebId = remembered || launch.webId || '';
      this.runtime.preferences
        .refresh()
        .catch((error) => this.actions.message(error));

      this.runtime.host.ready = Promise.resolve();
      if (different) {
        this.actions.message(
          'This link names a different WebID. Use WebID / connection to connect before opening it.'
        );
      }
      else if (webId && !this.runtime.host.launchError) {
        this.runtime.host.ready = new Promise((resolve) => {
          setTimeout(
            () =>
              this.actions
                .run(() => this.actions.restoreAccount(webId))
                .finally(resolve),
            0
          );
        });
      }
      this.eventBindings.start();
    },
    async swb_refreshPreferences() {
      this.actions.muzeSolidUiAccountStatus();
      if (document.visibilityState !== 'hidden') {
        try {
          await this.runtime.preferences.refresh();
          const session = this.runtime.session;
          if (session && navigator.onLine) {
            await session.perform(
              () => this.runtime.preferences.load(session),
              { interactive: false }
            );
          }
        }
        catch (error) {
          this.actions.message(error);
        }
      }
    },
    launchChanged() {
      try {
        const parsed = this.api.parseLaunchUrl(location.href);
        const next = parsed.context;
        const address = this.runtime.addressLaunch;
        if (
          !this.runtime.host.launchError &&
          next.webId === address.webId &&
          next.resource === address.resource
        ) {
          if (parsed.url !== location.href) {
            history.replaceState(history.state, '', parsed.url);
            this.runtime.addressLaunch = { webId: '', resource: '' };
          }
          return;
        }
      }
      catch {}
      window.location.reload();
    },
    cleanup() {
      this.actions.muzeSolidUiCleanupAccount();
      this.actions.muzeSolidUiCleanupCapability();
      this.runtime.preferenceBroker?.dispose();
    }
  }
};
