import template from '../controls.html?template' with { type: 'text' };
import styles from './account.css' with { type: 'text' };
export const swbAccount = {
  templates: { 'swb-account-controls': template },
  styles: { 'swb-account-controls': styles },
  events: {
    swbAccountOffer: {
      target: 'window', type: 'message', action: 'swb_accountOffer'
    },
    swbAccountDraft: {
      target() {
        return this.container;
      },
      type: 'input', action: 'swb_accountDraft'
    },
    swbAccountEscape: {
      target: 'window', type: 'keydown', action: 'swb_accountEscape'
    },
    swbAccountUnload: {
      target: 'window', type: 'pagehide', action: 'swb_closeAccountPort'
    }
  },
  commands: {
    swb_accountConnect(form) {
      // The trusted host reserves the popup synchronously in this user gesture.
      // Only session operations stay in the host; the app owns form feedback.
      try {
        if (!parent.muzeSolidUiAccountHost.reserveSignIn(window)) {
          throw new Error('account: Allow the sign-in popup, then retry.');
        }
        return this.actions.swb_accountOperation('connect', {
          webId: form.elements.webId.value
        });
      }
      catch (error) {
        this.data.swb_accountMessage = error.message;
      }
    },
    swb_accountDisconnect() {
      return this.actions.swb_accountOperation('disconnect');
    },
    swb_accountLogout() {
      return this.actions.swb_accountOperation('logout');
    },
    swb_accountClose() {
      return this.runtime.peer?.call('close', null);
    }
  },
  actions: {
    swb_initializeAccount() {
      this.eventBindings.start();
      if (parent !== window) {
        parent.postMessage({ type: 'solid-apps:account-ready' }, location.origin);
      }
    },
    async swb_accountOffer(event) {
      if (event.source !== parent || event.origin !== location.origin ||
          event.data?.type !== 'solid-apps:account-port' || !event.ports[0] ||
          this.runtime.peer) {
        return;
      }
      this.runtime.peer = new this.api.PortConnection(event.ports[0],
        (method, input) => {
          if (method === 'state') {
            this.actions.swb_accountState(input);
            return null;
          }
          if (method === 'focus') {
            this.container.querySelector('[name=webId]').focus();
            return null;
          }
          throw new Error('account: Unsupported host operation.');
        });
      try {
        const state = await this.runtime.peer.call('ready', null);
        this.actions.swb_accountState(state);
      }
      catch (error) {
        this.data.swb_accountMessage = error.message;
      }
    },
    swb_accountState(state) {
      this.runtime.owner = state.owner;
      if (!this.runtime.draftChanged) {
        this.data.webId = state.webId || '';
      }
      this.data.swb_accountStatus = state.status;
      this.data.swb_accountControls = state.controls;
      this.data.swb_accountMessage = state.message;
      this.data.swb_accountDisabled = {
        disabled: this.runtime.busy ? '' : null
      };
      this.api.applyPreferences(state.settings);
    },
    swb_accountEscape(event) {
      // Escape in a child document does not reach the parent's native dialog.
      if (event.key === 'Escape' && !event.defaultPrevented &&
          !event.isComposing && !event.repeat &&
          !this.container.ownerDocument.querySelector(':modal, :popover-open')) {
        event.preventDefault();
        this.runtime.peer?.call('close', null).catch(() => {});
      }
    },
    swb_accountDraft(event) {
      if (event.target.name === 'webId') {
        this.runtime.draftChanged = true;
        this.runtime.peer?.call('draft', event.target.value).catch(() => {});
      }
    },
    async swb_accountOperation(method, input = {}) {
      if (this.runtime.busy || !this.runtime.peer) {
        return;
      }
      this.runtime.busy = true;
      this.data.swb_accountDisabled = { disabled: '' };
      this.data.swb_accountMessage = 'Working…';
      try {
        const state = await this.runtime.peer.call(method, {
          ...input, owner: this.runtime.owner
        }, { timeout: null });
        this.actions.swb_accountState(state);
      }
      catch (error) {
        this.data.swb_accountMessage = error.message;
      }
      finally {
        this.runtime.busy = false;
        this.data.swb_accountDisabled = { disabled: null };
      }
    },
    swb_closeAccountPort() {
      this.runtime.peer?.close();
      this.eventBindings.stop();
    }
  }
};
