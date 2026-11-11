import template from '../account-dialog.html?template' with { type: 'text' };
export const muzeSolidUiAccountPresenter = {
  templates: { 'muze-solid-ui-account-dialog': template },
  behaviors: {
    muzeSolidUiAccountFrame(frame) {
      const observer = new MutationObserver(() =>
        this.actions.muzeSolidUiFocusAccount()
      );
      observer.observe(frame, {
        attributes: true, attributeFilter: ['hidden']
      });
      return () => observer.disconnect();
    },
    muzeSolidUiConnectionDialog(dialog) {
      const cancel = (event) => {
        if (event.cancelable) {
          event.preventDefault();
        }
        this.commands.call('closeConnect');
      };
      dialog.addEventListener('cancel', cancel);
      return () => dialog.removeEventListener('cancel', cancel);
    }
  },
  actions: {
    muzeSolidUiInitializeAccount() {
      const frame = this.runtime.root.querySelector(
        '.muze-solid-ui-account-frame'
      );
      this.runtime.accountFrame = frame;
      this.runtime.accountUrl = new URL('../account/', location.href).href;
      this.runtime.accountListener = (event) =>
        this.actions.muzeSolidUiAttachAccount(event);
      window.addEventListener('message', this.runtime.accountListener);
      // A MessagePort cannot transfer a popup WindowProxy. Reserve it directly
      // in the trusted frame's click stack, so Metro receives a real user gesture.
      this.runtime.accountHost = {
        reserveSignIn: (source) => {
          if (!this.actions.muzeSolidUiAccountSource(source) ||
              !this.runtime.accountPeer) {
            throw new Error('solid-app-ui: Account controls are unavailable.');
          }
          this.runtime.accountPopup?.close();
          this.runtime.accountPopup = window.open(
            '', '_blank', 'popup,width=520,height=720'
          );
          return Boolean(this.runtime.accountPopup);
        }
      };
      globalThis.muzeSolidUiAccountHost = this.runtime.accountHost;
    },
    muzeSolidUiAccountSource(source) {
      const frame = this.runtime.accountFrame;
      return this.runtime.dialog.open && source === frame.contentWindow &&
        frame.src === this.runtime.accountUrl;
    },
    muzeSolidUiAccountSnapshot() {
      return {
        owner: this.runtime.host.selectedWebId,
        webId: this.runtime.accountDraft ?? this.data.webId,
        status: this.data.muzeSolidUiAccountStatus,
        controls: { hidden: this.data.logoutVisibility.hidden },
        message: this.data.message,
        settings: {
          theme: this.runtime.settings.theme,
          textScale: this.runtime.settings.textScale,
          density: this.runtime.settings.density,
          language: this.runtime.settings.language
        }
      };
    },
    muzeSolidUiPublishAccount() {
      this.runtime.accountPeer?.call(
        'state', this.actions.muzeSolidUiAccountSnapshot(), { timeout: 2000 }
      ).catch(() => {});
    },
    async muzeSolidUiOpenAccount() {
      this.runtime.accountPeer?.close();
      this.runtime.accountPeer = null;
      clearTimeout(this.runtime.accountLoadTimer);
      this.runtime.accountPresented = false;
      this.runtime.accountFocusRequested = false;
      this.data.muzeSolidUiAccountLoading = 'Loading Account…';
      this.data.muzeSolidUiAccountRetry = { hidden: '' };
      const generation = (this.runtime.accountGeneration || 0) + 1;
      this.runtime.accountGeneration = generation;
      // Workbench can request controls while a previous presentation is closing.
      await this.runtime.accountClosing;
      if (generation !== this.runtime.accountGeneration) {
        return;
      }
      this.data.muzeSolidUiAccountFrame = { src: 'about:blank', hidden: '' };
      this.actions.muzeSolidDesignOpenDialog(this.runtime.dialog);
      // Commit the blank binding before reloading, including on Retry.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (generation !== this.runtime.accountGeneration) {
        return;
      }
      this.data.muzeSolidUiAccountFrame = {
        src: this.runtime.accountUrl, hidden: ''
      };
      this.runtime.accountLoadTimer = setTimeout(() => {
        if (!this.runtime.accountPresented && this.runtime.dialog.open) {
          this.data.muzeSolidUiAccountLoading =
            'Account could not load. Reconnect and retry. Your edits are retained.';
          this.data.muzeSolidUiAccountRetry = { hidden: null };
        }
      }, 8000);
    },
    muzeSolidUiAttachAccount(event) {
      if (event.origin !== location.origin ||
          event.data?.type !== 'solid-apps:account-ready' ||
          !this.actions.muzeSolidUiAccountSource(event.source) ||
          this.runtime.accountPeer) {
        return;
      }
      const channel = new MessageChannel();
      const peer = new this.api.PortConnection(channel.port1,
        (method, input) => this.actions.muzeSolidUiAccountRequest(
          peer, method, input
        ));
      this.runtime.accountPeer = peer;
      event.source.postMessage(
        { type: 'solid-apps:account-port' }, location.origin, [channel.port2]
      );
    },
    muzeSolidUiFocusAccount() {
      if (!this.runtime.accountPresented ||
          this.runtime.accountFocusRequested ||
          !this.runtime.accountPeer || this.runtime.accountFrame.hidden ||
          !this.runtime.dialog.open) {
        return;
      }
      this.runtime.accountFocusRequested = true;
      this.runtime.accountPeer.call('focus', null).catch(() => {});
    },
    async muzeSolidUiAccountRequest(peer, method, input) {
      if (peer !== this.runtime.accountPeer || !this.runtime.dialog.open) {
        throw new Error('solid-app-ui: Account dialog is no longer active.');
      }
      if (method === 'ready') {
        this.runtime.accountPresented = true;
        clearTimeout(this.runtime.accountLoadTimer);
        this.data.muzeSolidUiAccountLoading = '';
        this.data.muzeSolidUiAccountRetry = { hidden: '' };
        this.data.muzeSolidUiAccountFrame = {
          src: this.runtime.accountUrl, hidden: null
        };
        this.actions.muzeSolidUiFocusAccount();
        return this.actions.muzeSolidUiAccountSnapshot();
      }
      if (method === 'draft' && typeof input === 'string') {
        this.runtime.accountDraft = input;
        return null;
      }
      if (method === 'close') {
        // Reply before disposing the port/frame that owns this request.
        setTimeout(() => {
          if (peer === this.runtime.accountPeer) {
            this.commands.call('closeConnect');
          }
        }, 0);
        return null;
      }
      if (input?.owner !== this.runtime.host.selectedWebId) {
        throw new Error('solid-app-ui: Account changed. Reopen account controls.');
      }
      if (method === 'connect') {
        const popup = this.runtime.accountPopup;
        this.runtime.accountPopup = null;
        this.runtime.accountActivePopup = popup;
        if (!popup) {
          throw new Error('solid-app-ui: Allow the sign-in popup, then retry.');
        }
        try {
          const webId = this.api.httpUrl(input.webId);
          const host = this.runtime.host;
          if (host.selectedWebId && webId !== host.selectedWebId &&
              host.managed?.peer) {
            await host.managed.peer.call('account-controls', {});
            this.actions.message(
              'Switch accounts in Workbench. Your edits are retained.'
            );
          }
          else if (await this.actions.connectAccount(webId, popup)) {
            this.runtime.accountDraft = undefined;
            setTimeout(() => {
              if (peer === this.runtime.accountPeer) {
                this.commands.call('closeConnect');
              }
            }, 0);
          }
        }
        finally {
          popup.close();
          this.runtime.accountActivePopup = null;
        }
      }
      else if (method === 'disconnect') {
        await this.commands.call('muzeSolidUiDisconnect');
      }
      else if (method === 'logout') {
        this.runtime.accountDraft = undefined;
        await this.commands.call('logout');
      }
      else {
        throw new Error('solid-app-ui: Unsupported account operation.');
      }
      return this.actions.muzeSolidUiAccountSnapshot();
    },
    async muzeSolidUiCloseAccount() {
      const generation = (this.runtime.accountGeneration || 0) + 1;
      this.runtime.accountGeneration = generation;
      clearTimeout(this.runtime.accountLoadTimer);
      this.runtime.accountPeer?.close();
      this.runtime.accountPeer = null;
      this.runtime.accountPopup?.close();
      this.runtime.accountActivePopup?.close();
      this.runtime.accountPopup = null;
      // Keep the focused child document until native close restores its caller.
      const closing = this.actions.muzeSolidDesignCloseDialog(this.runtime.dialog);
      this.runtime.accountClosing = closing;
      await closing;
      if (this.runtime.accountClosing === closing) {
        this.runtime.accountClosing = null;
      }
      if (generation === this.runtime.accountGeneration) {
        this.data.muzeSolidUiAccountFrame = { src: 'about:blank', hidden: '' };
      }
    },
    muzeSolidUiCleanupAccount() {
      this.actions.muzeSolidUiCloseAccount();
      window.removeEventListener('message', this.runtime.accountListener);
      if (globalThis.muzeSolidUiAccountHost === this.runtime.accountHost) {
        delete globalThis.muzeSolidUiAccountHost;
      }
    }
  }
};
