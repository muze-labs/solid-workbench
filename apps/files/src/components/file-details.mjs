import resourceTemplate from '../resource.html' with { type: 'text' };
import template from '../details.html' with { type: 'text' };
import styles from './file-details.css' with { type: 'text' };

export const muzeSolidFileDetails = {
  templates: {
    'muze-solid-file-details': template,
    'muze-solid-files-resource': resourceTemplate
  },
  styles: { 'muze-solid-file-details': styles },
  events: {
    muzeSolidFilesDetailsFocus: {
      subscribe(notify) {
        const observer = new MutationObserver(notify);
        observer.observe(this.container, {
          subtree: true,
          attributes: true,
          attributeFilter: ['hidden', 'data-muze-solid-files-detail']
        });
        return () => observer.disconnect();
      },
      action: 'muzeSolidFilesFocusDetails'
    },
    muzeSolidFilesViewMessage: {
      target: 'window',
      type: 'message',
      action: 'muzeSolidFilesViewMessage'
    },
    muzeSolidFilesViewIntersection: {
      subscribe(notify) {
        const owner = this;
        const observer = new IntersectionObserver((entries) => {
          owner.runtime.viewInViewport = entries.some(
            (entry) => entry.isIntersecting
          );
          notify();
        });
        observer.observe(
          this.container.querySelector('.muze-solid-files-frame')
        );
        return () => observer.disconnect();
      },
      action: 'muzeSolidFilesViewUpdate'
    },
    muzeSolidFilesViewResize: {
      subscribe(notify) {
        const observer = new ResizeObserver(notify);
        observer.observe(
          this.container.querySelector('.muze-solid-files-frame')
        );
        return () => observer.disconnect();
      },
      action: 'muzeSolidFilesViewUpdate'
    },
    muzeSolidFilesViewVisible: {
      target() {
        return this.container.ownerDocument;
      },
      type: 'visibilitychange',
      action: 'muzeSolidFilesViewUpdate'
    }
  },
  commands: {
    muzeSolidFilesRetryView() {
      return this.runtime.host.run(this.actions.muzeSolidFilesOpenView);
    },
    muzeSolidFilesDiscardView() {
      return this.runtime.host.run(async () => {
        await this.actions.muzeSolidFilesReleaseView(true);
        this.actions.muzeSolidFilesReturnToList();
      });
    },
    muzeSolidFilesBack() {
      this.actions.muzeSolidFilesReturnToList();
    }
  },
  actions: {
    muzeSolidFilesInitializeDetails() {
      this.runtime.viewSelection = 0;
      this.runtime.host.beforeAccountLeave = async () => {
        this.runtime.viewSelection += 1;
        if (!(await this.actions.muzeSolidFilesReleaseView())) {
          throw new Error(
            'files: Finish the resource view before changing account.'
          );
        }
      };
      this.eventBindings.start();
    },
    muzeSolidFilesViewMessage(event) {
      const view = this.runtime.resourceView;
      if (
        event.data?.type === 'solid-apps:presentation-close' &&
        view?.ticket &&
        event.source === view.frame.contentWindow &&
        event.origin === view.url.origin &&
        event.data.id === view.ticket.id &&
        event.data.key === view.ticket.key
      ) {
        this.runtime.host.run(async () => {
          if (await this.actions.muzeSolidFilesReleaseView()) {
            this.actions.muzeSolidFilesReturnToList();
          }
        });
        return;
      }
      view?.receive(event);
    },
    muzeSolidFilesPresentation() {
      const frame = this.container.querySelector('.muze-solid-files-frame');
      const size = frame.getBoundingClientRect();
      return {
        interaction: 'interactive',
        geometry: 'scroll',
        width: size.width,
        height: size.height,
        visible:
          !document.hidden &&
          !frame.hidden &&
          this.runtime.viewInViewport === true
      };
    },
    async muzeSolidFilesViewUpdate() {
      const view = this.runtime.resourceView;
      if (!view?.support || view.retired) {
        return;
      }
      try {
        await view.update({}, this.actions.muzeSolidFilesPresentation());
      }
      catch (error) {
        if (this.runtime.resourceView === view) {
          this.actions.muzeSolidFilesViewFailure(error.message);
        }
      }
    },
    muzeSolidFilesViewFailure(message) {
      this.data.muzeSolidFilesViewStatus = message;
      this.data.muzeSolidFilesRecovery = { hidden: null };
      this.data.muzeSolidFilesLoading = { hidden: '' };
      this.data.muzeSolidFilesFrame = {
        ...this.data.muzeSolidFilesFrame,
        inert: null,
        'aria-hidden': null,
        'aria-busy': 'false',
        'data-muze-solid-ui-loading': null
      };
    },
    muzeSolidFilesFocusDetails() {
      // SimplyFlow applies panel visibility asynchronously. Focus only after
      // the destination is visible, without scrolling the surrounding chrome.
      if (this.runtime.focusList) {
        const selected = this.container.querySelector(
          '.swb-file-name[aria-current="page"]'
        );
        if (selected?.checkVisibility()) {
          this.runtime.focusList = false;
          selected.focus({ preventScroll: true });
        }
        return;
      }
      if (!this.runtime.focusDetails) {
        return;
      }
      const control = this.container.querySelector('.muze-solid-files-title');
      if (control.getClientRects().length && !control.closest('[hidden]')) {
        this.runtime.focusDetails = false;
        control.focus({ preventScroll: true });
      }
    },
    muzeSolidFilesReturnToList() {
      this.data.muzeSolidFilesLocation = {
        'data-muze-solid-files-detail': null
      };
      this.runtime.focusDetails = false;
      this.runtime.focusList = true;
      this.actions.muzeSolidFilesFocusDetails();
    },
    async muzeSolidFilesSelectDetails(url) {
      const resource = this.actions.inside(url);
      const selection = ++this.runtime.viewSelection;
      // Keep the old resource label and selection until its provider permits
      // removal. Concurrent selection requests share the same close decision.
      if (
        !(await this.actions.muzeSolidFilesReleaseView()) ||
        selection !== this.runtime.viewSelection
      ) {
        return;
      }
      this.runtime.detailsResource = resource;
      this.runtime.files.state.options.selected = resource;
      this.data.muzeSolidFilesDetailName = this.actions.decodeName(resource);
      this.data.muzeSolidFilesDetailResource = resource;
      this.data.muzeSolidFilesDetails = { hidden: null };
      const host = this.runtime.host;
      const provider =
        host.preferences.viewProvider?.url ||
        new URL('../viewer/', location.href).href;
      this.data.muzeSolidFilesProvider = provider;
      this.data.muzeSolidFilesStandalone = {
        title: this.data.muzeSolidFilesDetailName,
        href: this.api.launchUrl(provider, {
          webId: host.selectedWebId,
          resource
        })
      };
      this.data.muzeSolidFilesViewStatus = '';
      this.data.muzeSolidFilesRecovery = { hidden: '' };
      this.data.muzeSolidFilesLocation = { 'data-muze-solid-files-detail': '' };
      this.runtime.focusList = false;
      this.runtime.focusDetails = true;
      this.actions.muzeSolidFilesFocusDetails();
      await this.actions.muzeSolidFilesOpenView();
    },
    async muzeSolidFilesOpenView() {
      const resource = this.runtime.detailsResource;
      const selection = this.runtime.viewSelection;
      if (!resource || this.runtime.openingView === selection) {
        return;
      }
      this.runtime.openingView = selection;
      try {
        if (
          !(await this.actions.muzeSolidFilesReleaseView()) ||
          selection !== this.runtime.viewSelection
        ) {
          return;
        }
        const host = this.runtime.host;
        let broker = host.managed?.ready ? host.managed : null;
        if (!broker) {
          this.runtime.viewBroker ||= new this.api.WorkspaceBroker({
            resolveProvider: (capability) =>
              capability === this.api.viewResourceCapability
                ? host.preferences.viewProvider?.url ||
                  new URL('../viewer/', location.href).href
                : undefined
          });
          broker = this.runtime.viewBroker;
        }
        const provider = await broker.embeddedProvider(
          this.api.viewResourceCapability
        );
        if (selection !== this.runtime.viewSelection) {
          return;
        }
        const url = this.api.launchUrl(provider, {
          webId: host.selectedWebId,
          resource
        });
        this.data.muzeSolidFilesProvider = provider;
        this.data.muzeSolidFilesStandalone = {
          href: url,
          title: this.data.muzeSolidFilesDetailName
        };
        this.data.muzeSolidFilesViewStatus = '';
        this.data.muzeSolidFilesRecovery = { hidden: '' };
        const view = new this.api.EmbeddedView({
          broker,
          frame: this.container.querySelector('.muze-solid-files-frame'),
          change: (state) => {
            if (this.runtime.resourceView !== view) {
              return;
            }
            if (state.src) {
              this.data.muzeSolidFilesFrame = {
                src: state.src,
                hidden: state.closed ? '' : null,
                inert: state.closed ? null : '',
                'aria-hidden': state.closed ? null : 'true',
                'aria-busy': state.closed ? 'false' : 'true',
                'data-muze-solid-ui-loading': state.closed ? null : ''
              };
              this.data.muzeSolidFilesLoading = {
                hidden: state.closed ? '' : null
              };
            }
            if (state.ready || state.closed) {
              this.data.muzeSolidFilesViewStatus = '';
              this.data.muzeSolidFilesLoading = { hidden: '' };
              this.data.muzeSolidFilesFrame = {
                ...this.data.muzeSolidFilesFrame,
                inert: null,
                'aria-hidden': null,
                'aria-busy': 'false',
                'data-muze-solid-ui-loading': null
              };
            }
            else if (state.failed || (!state.src && state.status)) {
              this.actions.muzeSolidFilesViewFailure(state.status);
            }
            this.data.muzeSolidFilesDiscard = {
              hidden: state.failed ? null : ''
            };
          }
        });
        this.runtime.resourceView = view;
        await view.open(url, {
          resource,
          appearance: {},
          presentation: this.actions.muzeSolidFilesPresentation()
        });
        await this.actions.muzeSolidFilesViewUpdate();
      }
      catch (error) {
        if (selection === this.runtime.viewSelection) {
          this.actions.muzeSolidFilesViewFailure(error.message);
        }
      }
      finally {
        if (this.runtime.openingView === selection) {
          this.runtime.openingView = null;
        }
      }
    },
    async muzeSolidFilesReleaseView(discard = false) {
      const view = this.runtime.resourceView;
      if (!view) {
        return true;
      }
      if (!discard && this.runtime.closingView) {
        return this.runtime.closingView;
      }
      const close = async () => {
        try {
          const allowed = await view.close({ discard });
          if (allowed && this.runtime.resourceView === view) {
            this.runtime.resourceView = null;
          }
          return allowed;
        }
        catch (error) {
          this.actions.muzeSolidFilesViewFailure(
            'Could not confirm safe closure. ' + error.message
          );
          this.data.muzeSolidFilesDiscard = { hidden: null };
          return false;
        }
        finally {
          this.runtime.closingView = null;
        }
      };
      this.runtime.closingView = close();
      return this.runtime.closingView;
    }
  }
};
