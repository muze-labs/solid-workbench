import styles from './capability-dialog.css' with { type: 'text' };
import template from '../capability-dialog.html' with { type: 'text' };

export const muzeSolidUiCapabilityDialog = {
  styles: { 'swb-capability-dialog': styles },
  templates: { 'muze-solid-ui-capability-dialog': template },
  commands: {
    muzeSolidUiOpenCapabilityTab() {
      const call = this.runtime.muzeSolidUiCall;
      if (!call) {
        return true;
      }
      if (!call.chooseTab) {
        this.data.muzeSolidUiDialog.message =
          'Finish or discard this task before opening another.';
        return;
      }
      // Reserve the tab during the user's click, before any asynchronous work.
      const popup = window.open('', '_blank');
      if (!popup) {
        this.data.muzeSolidUiDialog.message =
          'Allow popups to continue in a separate tab.';
        return;
      }
      call.chooseTab(popup);
    },
    muzeSolidUiCloseCapability() {
      return this.actions.run(this.actions.muzeSolidUiCheckCapabilityClose);
    },
    async muzeSolidUiDiscardCapability() {
      const call = this.runtime.muzeSolidUiCall;
      call?.controller.abort();
      if (call?.failed) {
        await this.actions.muzeSolidUiReleaseCapability(call, true);
      }
    },
    muzeSolidUiKeepCapability() {
      this.data.muzeSolidUiDialog.discard = { hidden: '' };
      const call = this.runtime.muzeSolidUiCall;
      if (call?.popup) {
        call.popup.focus();
      }
      else {
        this.runtime.muzeSolidUiFrame.focus();
      }
    }
  },
  actions: {
    muzeSolidUiInitializeCapability() {
      const dialog = this.container.querySelector(
        '.muze-solid-ui-capability-dialog'
      );
      const frame = dialog.querySelector('iframe');
      this.runtime.muzeSolidUiDialog = dialog;
      this.runtime.muzeSolidUiFrame = frame;
      this.runtime.muzeSolidUiCancel = (event) => {
        event.preventDefault();
        this.actions.run(this.actions.muzeSolidUiCheckCapabilityClose);
      };
      this.runtime.muzeSolidUiLoad = (event) =>
        this.actions.muzeSolidUiAttachCapability(event);
      dialog.addEventListener('cancel', this.runtime.muzeSolidUiCancel);
      window.addEventListener('message', this.runtime.muzeSolidUiLoad);
      this.runtime.muzeSolidUiFrameLoad = (event) =>
        this.actions.muzeSolidUiCapabilityLoaded(event);
      frame.addEventListener('load', this.runtime.muzeSolidUiFrameLoad);
      // SimplyFlow removes inert after its bound attributes render. Focus must
      // wait for that native state, rather than race the visibility binding.
      this.runtime.muzeSolidUiFocusObserver = new MutationObserver(() =>
        this.actions.muzeSolidUiFocusPresentation()
      );
      this.runtime.muzeSolidUiFocusObserver.observe(frame, {
        attributes: true,
        attributeFilter: ['inert', 'hidden', 'aria-busy']
      });
    },
    muzeSolidUiFocusPresentation() {
      const call = this.runtime.muzeSolidUiCall;
      const frame = this.runtime.muzeSolidUiFrame;
      if (
        !call?.presented ||
        call.popup ||
        call.close ||
        call.focusRequested ||
        (call.waitForPresentation && !call.presentationReady) ||
        this.container.ownerDocument.activeElement === frame ||
        call.capability !== this.api.editPreferencesCapability ||
        call.controller.signal.aborted ||
        !this.runtime.muzeSolidUiDialog.open ||
        frame.inert ||
        frame.hidden ||
        frame.getAttribute('aria-busy') !== 'false'
      ) {
        return;
      }
      call.focusRequested = true;
      call.window.postMessage(
        {
          type: 'solid-apps:presentation-focus',
          ...call.ticket
        },
        new URL(call.url).origin
      );
    },
    muzeSolidUiAttachCapability(event) {
      const call = this.runtime.muzeSolidUiCall;
      if (
        !call?.ticket ||
        event.source !== call.window ||
        event.origin !== new URL(call.url).origin
      ) {
        return;
      }
      if (event.data?.type === 'solid-apps:presentation-ready') {
        if (call.attached && event.data.id === call.ticket.id) {
          call.presentationReady = true;
          this.actions.muzeSolidUiRevealCapability(call);
          this.actions.muzeSolidUiFocusPresentation();
        }
        return;
      }
      if (event.data?.type !== 'solid-apps:embedded-ready') {
        return;
      }
      if (call.attached) {
        if (typeof event.data.generation === 'string' &&
            event.data.generation !== call.generation) {
          this.actions.muzeSolidUiInterruptCapability(call);
        }
        return;
      }
      call.generation = event.data.generation;
      call.attached = true;
      call.waitForPresentation = event.data.presentation === 'explicit';
      if (call.waitForPresentation && !call.popup) {
        call.presentationTimer = setTimeout(
          () => this.actions.muzeSolidUiRevealCapability(call),
          5000
        );
      }
      else if (call.frameLoaded) {
        this.actions.muzeSolidUiRevealCapability(call);
      }
      const channel = new MessageChannel();
      const brokerWindow = call.broker.target || call.broker.parent;
      const brokerOrigin = call.broker.target
        ? location.origin
        : call.broker.resume.origin;
      brokerWindow.postMessage(
        {
          type: 'solid-apps:embed-port',
          ...call.ticket
        },
        brokerOrigin,
        [channel.port1]
      );
      call.window.postMessage(
        {
          type: 'solid-apps:offer',
          ...call.ticket,
          state: null
        },
        new URL(call.url).origin,
        [channel.port2]
      );
    },
    muzeSolidUiCapabilityLoaded() {
      const call = this.runtime.muzeSolidUiCall;
      const frame = this.runtime.muzeSolidUiFrame;
      if (!call || call.popup || frame.src !== call.url) {
        return;
      }
      // An initial about:blank load can arrive after assigning the provider URL.
      if (!call.frameLoaded && frame.contentDocument?.URL === 'about:blank') {
        return;
      }
      if (call.frameLoaded) {
        this.actions.muzeSolidUiInterruptCapability(call);
        return;
      }
      call.frameLoaded = true;
      if (call.attached && !call.waitForPresentation) {
        this.actions.muzeSolidUiRevealCapability(call);
      }
    },
    muzeSolidUiInterruptCapability(call) {
      if (this.runtime.muzeSolidUiCall !== call || call.close ||
          call.interrupted || call.controller.signal.aborted) {
        return;
      }
      call.interrupted = true;
      this.actions.muzeSolidUiShowInterruption(call);
      // Ending this ticket rejects its pending call; it never starts another.
      this.actions.run(() => this.actions.muzeSolidUiEndConnection(call));
    },
    muzeSolidUiShowInterruption(call) {
      this.data.muzeSolidUiDialog.loading = { hidden: '' };
      this.data.muzeSolidUiDialog.frame = {
        src: call.url, hidden: '', inert: ''
      };
      this.data.muzeSolidUiDialog.fallback = { hidden: '' };
      this.data.muzeSolidUiDialog.discard = { hidden: '' };
      this.data.muzeSolidUiDialog.message =
        'The app reloaded or navigated away. Close this dialog and ' +
        'start the task again. It has not been restarted automatically.';
    },
    muzeSolidUiRevealCapability(call) {
      if (
        this.runtime.muzeSolidUiCall !== call ||
        call.popup ||
        call.presented ||
        call.close ||
        call.interrupted ||
        call.controller.signal.aborted
      ) {
        return;
      }
      clearTimeout(call.presentationTimer);
      call.presented = true;
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      this.data.muzeSolidUiDialog.loading = {
        hidden: reduceMotion ? '' : null,
        'data-muze-solid-ui-fading': '',
        'aria-hidden': 'true'
      };
      if (!reduceMotion) {
        call.fadeTimer = setTimeout(() => {
          if (this.runtime.muzeSolidUiCall === call) {
            this.data.muzeSolidUiDialog.loading = { hidden: '' };
          }
        }, 300);
      }
      this.data.muzeSolidUiDialog.frame = {
        src: call.url,
        hidden: null,
        inert: null,
        'aria-hidden': null,
        'aria-busy': 'false',
        'data-muze-solid-ui-loading': null
      };
      this.actions.muzeSolidUiFocusPresentation();
    },
    async muzeSolidUiInvokeCapability(
      capability,
      providerUrl,
      input,
      title = ''
    ) {
      if (this.runtime.muzeSolidUiCall) {
        throw new Error('solid-app-ui: Finish the current dialog task first.');
      }
      providerUrl = this.api.httpUrl(providerUrl);
      const call = {
        broker:
          this.runtime.host.capabilityBroker ||
          (this.runtime.host.managed?.ready
            ? this.runtime.host.managed
            : this.runtime.preferenceBroker),
        controller: new AbortController(),
        capability,
        attached: false
      };
      this.runtime.muzeSolidUiCall = call;
      const dialog = this.runtime.muzeSolidUiDialog;
      Object.assign(this.data.muzeSolidUiDialog, {
        title,
        message: '',
        loading: {
          hidden: null,
          'data-muze-solid-ui-fading': null,
          'aria-hidden': null
        },
        loadingText: title ? 'Loading ' + title + '…' : 'Loading app…',
        frame: { src: 'about:blank', hidden: '' },
        fallback: { href: providerUrl, hidden: '' },
        discard: { hidden: '' }
      });
      this.actions.muzeSolidDesignOpenDialog(dialog);
      try {
        if (!call.broker || !(call.broker.target || call.broker.ready)) {
          throw new Error(
            'solid-app-ui: Open this app through Launcher for embedded tasks, or open the app separately.'
          );
        }
        const configured = new URL(
          await call.broker.embeddedProvider(capability)
        );
        if (call.controller.signal.aborted) {
          throw this.api.capabilityError('Task cancelled.', 'cancelled');
        }
        // Preserve routes when transferring launch context.
        const source = this.api.parseLaunchUrl(providerUrl).context;
        const selected = this.api.launchUrl(configured.href, {
          ...source,
          resource: source.resource ||
            this.api.parseLaunchUrl(configured.href).context.resource
        });
        configured.href = selected;
        call.fallback = configured.href;
        configured.searchParams.set('solid-apps-task', '');
        call.url = configured.href;
        let result;
        try {
          result = await this.actions.muzeSolidUiRunTask(call, input);
        }
        catch (error) {
          if (
            call.attached ||
            call.interrupted ||
            call.controller.signal.aborted ||
            error.code === 'cancelled'
          ) {
            throw error;
          }
          await this.actions.muzeSolidUiEndConnection(call);
          this.data.muzeSolidUiDialog.loading = { hidden: '' };
          this.data.muzeSolidUiDialog.frame = {
            src: 'about:blank',
            hidden: ''
          };
          this.data.muzeSolidUiDialog.message =
            'The app could not open here. You can continue the same task in a separate tab.';
          this.data.muzeSolidUiDialog.fallback = {
            href: call.fallback,
            hidden: null
          };
          call.popup = await this.actions.muzeSolidUiWaitForTab(call);
          result = await this.actions.muzeSolidUiRunTask(call, input);
        }
        call.close = true;
        return result;
      }
      catch (error) {
        if (error.code === 'cancelled' || call.controller.signal.aborted) {
          call.close = true;
        }
        else if (call.interrupted) {
          call.failed = true;
          await this.actions.muzeSolidUiEndConnection(call);
          this.actions.muzeSolidUiShowInterruption(call);
        }
        else {
          call.failed = call.attached;
          if (call.attached) {
            this.actions.muzeSolidUiRevealCapability(call);
          }
          this.data.muzeSolidUiDialog.loading = { hidden: '' };
          this.data.muzeSolidUiDialog.message = error.message;
          this.data.muzeSolidUiDialog.fallback = {
            href: call.fallback || providerUrl,
            hidden: null
          };
        }
        throw error;
      }
      finally {
        // Keep a running provider visible after a routing failure: it may still
        // contain an unsaved draft. Explicit close/discard releases it later.
        if (!call.failed) {
          await this.actions.muzeSolidUiReleaseCapability(
            call,
            Boolean(call.close)
          );
        }
      }
    },
    async muzeSolidUiRunTask(call, input) {
      call.ticket = await call.broker.beginEmbedded(call.url, call.capability);
      call.attached = false;
      call.frameLoaded = false;
      call.presented = false;
      call.waitForPresentation = false;
      this.data.muzeSolidUiDialog.message = call.popup
        ? 'Continue in the app tab.'
        : '';
      this.data.muzeSolidUiDialog.fallback = {
        href: call.fallback,
        hidden: ''
      };
      if (call.popup) {
        this.data.muzeSolidUiDialog.loading = { hidden: '' };
        call.window = call.popup;
        call.popup.location.href = call.url;
        call.popupTimer = setInterval(() => {
          if (call.popup.closed && !call.close) {
            call.controller.abort();
            if (call.failed) {
              this.actions.run(() =>
                this.actions.muzeSolidUiReleaseCapability(call, true)
              );
            }
          }
        }, 400);
      }
      else {
        call.window = this.runtime.muzeSolidUiFrame.contentWindow;
        this.data.muzeSolidUiDialog.loading = {
          hidden: null,
          'data-muze-solid-ui-fading': null,
          'aria-hidden': null
        };
        this.data.muzeSolidUiDialog.frame = {
          src: call.url,
          hidden: null,
          inert: '',
          'aria-hidden': 'true',
          'aria-busy': 'true',
          'data-muze-solid-ui-loading': ''
        };
      }
      return call.broker.requestEmbedded(call.ticket.id, input, {
        signal: call.controller.signal
      });
    },
    muzeSolidUiWaitForTab(call) {
      return new Promise((resolve, reject) => {
        const cancel = () => {
          call.chooseTab = null;
          reject(this.api.capabilityError('Task cancelled.', 'cancelled'));
        };
        call.chooseTab = (popup) => {
          call.controller.signal.removeEventListener('abort', cancel);
          call.chooseTab = null;
          resolve(popup);
        };
        call.controller.signal.addEventListener('abort', cancel, {
          once: true
        });
        if (call.controller.signal.aborted) {
          cancel();
        }
      });
    },
    async muzeSolidUiEndConnection(call) {
      clearTimeout(call.presentationTimer);
      clearTimeout(call.fadeTimer);
      if (call.ticket) {
        const ticket = call.ticket;
        call.ticket = null;
        try {
          await call.broker.endEmbedded(ticket.id);
        }
        catch {
          // The workspace may already have released this transient instance.
        }
      }
    },
    async muzeSolidUiReleaseCapability(call, close) {
      await this.actions.muzeSolidUiEndConnection(call);
      clearInterval(call.popupTimer);
      call.popup?.close();
      if (close) {
        await this.actions.muzeSolidDesignCloseDialog(
          this.runtime.muzeSolidUiDialog
        );
      }
      this.data.muzeSolidUiDialog.frame = { src: 'about:blank', hidden: '' };
      this.data.muzeSolidUiDialog.loading = { hidden: '' };
      this.runtime.muzeSolidUiCall = null;
    },
    async muzeSolidUiCheckCapabilityClose() {
      const call = this.runtime.muzeSolidUiCall;
      if (!call?.ticket) {
        call?.controller.abort();
        if (call?.failed) {
          await this.actions.muzeSolidUiReleaseCapability(call, true);
        }
        else {
          await this.actions.muzeSolidDesignCloseDialog(
            this.runtime.muzeSolidUiDialog
          );
        }
        return;
      }
      let status;
      try {
        status = await call.broker.canCloseEmbedded(call.ticket.id);
      }
      catch (error) {
        this.data.muzeSolidUiDialog.message =
          'The app is not responding. Closing may discard unsaved edits.';
        this.data.muzeSolidUiDialog.discard = { hidden: null };
        return;
      }
      if (status.saving) {
        this.data.muzeSolidUiDialog.message = 'Wait for the save to finish.';
      }
      else if (!status.allowed) {
        this.data.muzeSolidUiDialog.message = '';
        this.data.muzeSolidUiDialog.discard = { hidden: null };
      }
      else {
        call.controller.abort();
        if (call.failed) {
          await this.actions.muzeSolidUiReleaseCapability(call, true);
        }
      }
    },
    muzeSolidUiCleanupCapability() {
      this.runtime.muzeSolidUiFocusObserver?.disconnect();
      const call = this.runtime.muzeSolidUiCall;
      call?.controller.abort();
      if (call?.failed) {
        this.actions.run(() =>
          this.actions.muzeSolidUiReleaseCapability(call, true)
        );
      }
      this.runtime.muzeSolidUiDialog.removeEventListener(
        'cancel',
        this.runtime.muzeSolidUiCancel
      );
      window.removeEventListener('message', this.runtime.muzeSolidUiLoad);
      this.runtime.muzeSolidUiFrame.removeEventListener(
        'load',
        this.runtime.muzeSolidUiFrameLoad
      );
    }
  }
};
