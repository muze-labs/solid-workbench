import styles from './account.css' with { type: 'text' };
export const account = {
  styles: { 'swb-account': styles },
  commands: {
    muzeSolidUiOwnProfile() {
      return this.actions.run(async () => {
        const session = this.actions.requireSession();
        const provider = this.api.launchUrl(
          new URL('../profile/', location.href).href,
          {
            webId: session.webId,
            resource: session.webId
          }
        );
        const result = await this.actions.muzeSolidUiInvokeCapability(
          this.api.editProfileCapability,
          provider,
          { '@id': session.webId },
          'Your profile'
        );
        if (result?.['@id'] !== session.webId) {
          throw new Error(
            'solid-app-ui: The provider returned a different profile.'
          );
        }
        const document = await session.perform(() =>
          this.api.loadDocument(session.client, session.webId)
        );
        session.profile = document.graph.get(session.webId);
        this.actions.muzeSolidUiShowAccount(session);
        this.actions.notify('Profile saved to Solid.');
      });
    },
    preferences() {
      this.runtime.menu.hidePopover();
      if (this.runtime.host.onOpenPreferences) {
        return this.runtime.host.onOpenPreferences();
      }
      return this.actions.run(async () => {
        const host = this.runtime.host;
        if (!(host.capabilityBroker || host.managed?.ready)) {
          this.runtime.preferenceBroker ||= new this.api.WorkspaceBroker({
            embeddedProviders: [
              {
                capability: this.api.editPreferencesCapability,
                url: new URL('../preferences/', location.href).href
              }
            ]
          });
        }
        const provider = this.api.launchUrl(
          new URL('../preferences/', location.href).href,
          { webId: host.selectedWebId }
        );
        const result = await this.actions.muzeSolidUiInvokeCapability(
          this.api.editPreferencesCapability,
          provider,
          {
            owner: host.selectedWebId,
            app:
              this.runtime.appName ||
              location.pathname.split('/').filter(Boolean).at(-1) ||
              'launcher',
            workspace: host.workspaceContext?.id || ''
          },
          'Preferences'
        );
        await host.onPreferencesTaskComplete?.(result);
      });
    },
    connectDialog() {
      this.runtime.menu.hidePopover();
      return this.actions.muzeSolidUiOpenAccount();
    },
    closeConnect() {
      this.runtime.accountAttempt = (this.runtime.accountAttempt || 0) + 1;
      if (this.runtime.connecting) {
        this.runtime.session?.cancelSignIn();
      }
      return this.actions.muzeSolidUiCloseAccount();
    },
    muzeSolidUiDisconnect() {
      this.runtime.accountAttempt = (this.runtime.accountAttempt || 0) + 1;
      return this.actions.run(async () => {
        this.runtime.session?.disconnect();
        this.data.muzeSolidUiRecoveryVisibility = { hidden: '' };
        this.actions.muzeSolidUiAccountStatus();
      });
    },
    logout() {
      this.runtime.accountAttempt = (this.runtime.accountAttempt || 0) + 1;
      return this.actions.run(async () => {
        await this.runtime.host.beforeAccountLeave?.();
        this.runtime.host.capabilityBroker?.closeApps();
        this.api.logoutAccount(this.runtime.host.selectedWebId);
        this.runtime.session?.logout();
        localStorage.setItem(
          'solid-apps.disconnected:' + this.runtime.host.selectedWebId, 'true'
        );
        const owner = this.runtime.host.selectedWebId;
        if (localStorage.getItem('solid-apps.webId') === owner) {
          localStorage.removeItem('solid-apps.webId');
        }
        localStorage.setItem('solid-apps.logout:' + owner, crypto.randomUUID());
        this.actions.muzeSolidUiSignedOut();
      });
    }
  },
  actions: {
    muzeSolidUiSignedOut() {
      this.runtime.accountDraft = undefined;
      this.runtime.accountSignedOut = true;
      this.runtime.accountAttempt = (this.runtime.accountAttempt || 0) + 1;
      this.runtime.selectedWebId = this.runtime.host.selectedWebId;
      this.runtime.session?.logout();
      this.runtime.session = null;
      this.data.logoutVisibility = { hidden: '' };
      this.data.accountName = '';
      this.data.webId = '';
      this.actions.message('');
      this.actions.muzeSolidUiCloseAccount();
      this.data.muzeSolidUiRecoveryVisibility = { hidden: '' };
      this.actions.muzeSolidUiAccountStatus();
    },
    muzeSolidUiAccountStatus() {
      const session = this.runtime.session;
      let status = 'Not connected';
      let icon = 'cloud-off';
      if (this.runtime.accountSignedOut && !session) {
        status = 'Not connected';
      }
      else if (
        session?.disconnected ||
        (!session &&
          localStorage.getItem(
            'solid-apps.disconnected:' + this.runtime.host.selectedWebId
          ) === 'true')
      ) {
        status = 'Disconnected';
      }
      else if (this.runtime.connecting) {
        status = 'Connecting';
      }
      else if (this.data.muzeSolidUiRecoveryVisibility.hidden === null) {
        status = 'Sign in again';
        icon = 'alert-circle';
      }
      else if (session) {
        status = 'Public access';
        if (session.hasUsableAccessToken) {
          status = 'Signed in';
        }
        else if (session.hasStoredAuthorization) {
          status = 'Session available';
        }
        icon = 'cloud';
      }
      if (!navigator.onLine) {
        status += ' · Offline';
      }
      this.data.muzeSolidUiAccountStatus = status;
      this.data.muzeSolidUiStatusButton = {
        'aria-label': status + '. Open account controls',
        title: status
      };
      this.data.muzeSolidUiStatusIcon = {
        href: '../assets/feather-icons.svg#' + icon
      };
      this.actions.muzeSolidUiPublishAccount?.();
    },
    muzeSolidUiShowAccount(session) {
      this.data.accountName =
        this.api.readProfile(session.profile).name.trim() || 'Connected';
      this.data.muzeSolidUiProfileButton = {
        'aria-label': 'View and edit profile for ' + this.data.accountName
      };
      this.actions.muzeSolidUiAccountStatus();
    },
    async connectAccount(webId, popup) {
      const attempt = (this.runtime.accountAttempt || 0) + 1;
      this.runtime.accountAttempt = attempt;
      const requireCurrent = () => {
        if (attempt !== this.runtime.accountAttempt) {
          const error = new Error('solid-app-ui: Connection cancelled.');
          error.code = 'cancelled';
          throw error;
        }
      };
      this.data.connectButton = { disabled: '' };
      this.runtime.connecting = true;
      this.actions.muzeSolidUiAccountStatus();
      this.actions.message('Reading profile…');
      try {
        const previous = this.runtime.session;
        const switching =
          this.runtime.host.selectedWebId &&
          this.runtime.host.selectedWebId !== webId;
        if (switching) {
          await this.runtime.host.beforeAccountLeave?.();
        }
        requireCurrent();
        localStorage.removeItem('solid-apps.disconnected:' + webId);
        if (previous?.webId === webId) {
          previous.reconnect();
          await previous.signIn(popup);
          requireCurrent();
          this.actions.muzeSolidUiAuthenticationRestored();
          this.actions.muzeSolidUiConnectionConfirmed(webId);
          this.actions.message('');
          return true;
        }
        const session = await this.api.connectSession(webId, popup, {
          onAuthenticationRequired: (...args) =>
            this.actions.muzeSolidUiAuthenticationRequired(...args),
          onAuthenticationRestored: (...args) => {
            if (this.runtime.session?.webId === webId) {
              this.actions.muzeSolidUiAuthenticationRestored(...args);
            }
          }
        });
        requireCurrent();
        // Discovery and initial app reads may all be public. Explicit Connect
        // must finish sign-in before publishing the new session or closing its UI.
        await session.signIn(popup);
        requireCurrent();
        this.actions.muzeSolidUiConnectionConfirmed(webId);
        if (switching && this.runtime.host.accountChanged) {
          await this.runtime.host.accountChanged(session);
          return true;
        }
        previous?.cancelSignIn();
        this.runtime.accountSignedOut = false;
        this.runtime.session = session;
        this.data.webId = session.webId;
        this.data.logoutVisibility = { hidden: null };
        try {
          localStorage.setItem('solid-apps.webId', webId);
        }
        catch {}
        this.runtime.preferences.reset();
        this.actions.muzeSolidUiShowAccount(session);
        let preferenceError = '';
        await session.perform(async () => {
          try {
            await this.runtime.preferences.load(session);
          }
          catch (error) {
            preferenceError =
              error.code === 'sign_in_required' ? '' : error.message;
          }
          await this.runtime.host.onConnect?.(session);
          if (this.runtime.pendingWorkspaceOwner === session.webId) {
            this.runtime.pendingWorkspaceOwner = null;
            this.runtime.host.managed?.peer?.close();
            this.runtime.host.managed?.announce();
          }
        });
        this.data.message = preferenceError;
        this.actions.notify('Connected to Solid.');
        return true;
      }
      catch (error) {
        this.actions.message(error);
        return false;
      }
      finally {
        this.runtime.connecting = false;
        this.data.connectButton = { disabled: null };
        this.actions.muzeSolidUiAccountStatus();
      }
    },
    async restoreAccount(webId) {
      const attempt = this.runtime.accountAttempt || 0;
      if (
        this.runtime.session ||
        localStorage.getItem('solid-apps.disconnected:' + webId) === 'true'
      ) {
        this.data.webId = webId;
        this.data.logoutVisibility = { hidden: null };
        this.actions.muzeSolidUiAccountStatus();
        return;
      }
      const session = await this.api.connectSession(webId, null, {
        interactive: false,
        onAuthenticationRequired: (...args) =>
          this.actions.muzeSolidUiAuthenticationRequired(...args),
        onAuthenticationRestored: (...args) =>
          this.actions.muzeSolidUiAuthenticationRestored(...args)
      });
      if (attempt !== (this.runtime.accountAttempt || 0)) {
        session.cancelSignIn();
        return;
      }
      this.runtime.accountSignedOut = false;
      this.runtime.session = session;
      this.data.webId = session.webId;
      this.data.logoutVisibility = { hidden: null };
      this.actions.muzeSolidUiShowAccount(session);
      await session.perform(
        async () => {
          try {
            await this.runtime.preferences.load(session);
          }
          catch (error) {
            if (error.code !== 'sign_in_required') {
              this.actions.message(error);
            }
          }
          await this.runtime.host.onConnect?.(session);
        },
        { interactive: false }
      );
    },
    muzeSolidUiConnectionConfirmed(webId) {
      // Raw OAuth store events occur during authorization. A sessionless peer
      // must wait for completion before starting its noninteractive restoration.
      localStorage.setItem('solid-apps.connected:' + webId, crypto.randomUUID());
    },
    muzeSolidUiRestoreSharedAccount() {
      const host = this.runtime.host;
      const webId = host.selectedWebId;
      if (this.runtime.session || this.runtime.connecting || !webId ||
          localStorage.getItem('solid-apps.disconnected:' + webId) === 'true') {
        return;
      }
      if (this.runtime.sharedAccountRestore) {
        return this.runtime.sharedAccountRestore;
      }
      const attempt = this.runtime.accountAttempt || 0;
      const restoring = this.actions.run(async () => {
        await host.ready;
        if (this.runtime.session || this.runtime.connecting ||
            host.selectedWebId !== webId ||
            attempt !== (this.runtime.accountAttempt || 0) ||
            localStorage.getItem('solid-apps.disconnected:' + webId) === 'true') {
          return;
        }
        // Reuse startup's noninteractive path for this already-selected owner.
        await this.actions.restoreAccount(webId);
        if (this.runtime.session?.hasUsableAccessToken) {
          this.actions.muzeSolidUiSharedAuthorization();
        }
      }).finally(() => {
        if (this.runtime.sharedAccountRestore === restoring) {
          this.runtime.sharedAccountRestore = null;
        }
      });
      this.runtime.sharedAccountRestore = restoring;
      return restoring;
    },
    accountRemoved(event) {
      if (event.key === 'solid-apps.preferences-change') {
        if (
          event.newValue?.startsWith(
            (this.runtime.host.selectedWebId || '') + '\n'
          )
        ) {
          this.runtime.preferences
            .refresh()
            .catch((error) => this.actions.message(error));
        }
        return;
      }
      if (!this.runtime.session && event.key ===
          'solid-apps.connected:' + this.runtime.host.selectedWebId) {
        return this.actions.muzeSolidUiRestoreSharedAccount();
      }
      if (event.key === 'solid-apps.webId' && event.newValue === null) {
        if (event.oldValue === this.runtime.host.selectedWebId) {
          this.actions.muzeSolidUiSignedOut();
        }
        return;
      }
      if (event.key === 'solid-apps.logout:' + this.runtime.host.selectedWebId) {
        this.actions.muzeSolidUiSignedOut();
        return;
      }
      if (event.key?.startsWith('solid-apps.disconnected:')) {
        if (event.key !==
            'solid-apps.disconnected:' + this.runtime.host.selectedWebId) {
          return;
        }
        if (this.runtime.session?.disconnected) {
          this.runtime.session.cancelSignIn();
          this.data.muzeSolidUiRecoveryVisibility = { hidden: '' };
        }
        if (event.newValue !== 'true' &&
            this.runtime.session?.hasUsableAccessToken) {
          this.actions.muzeSolidUiSharedAuthorization();
        }
        this.actions.muzeSolidUiAccountStatus();
        return;
      }
      if (
        !this.runtime.session?.disconnected &&
        this.runtime.session?.hasUsableAccessToken
      ) {
        this.actions.muzeSolidUiSharedAuthorization();
      }
    }
  }
};
