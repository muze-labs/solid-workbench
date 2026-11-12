export const lifecycle = {
  actions: {
    async initialize() {
      this.actions.initializeFiles();
      this.runtime.container =
        this.runtime.host.main.querySelector('.swb-file-controls');
      this.runtime.current = '';
      this.runtime.root = '';
      this.runtime.busy = false;
      this.runtime.pending = null;
      this.runtime.selecting = false;
      this.runtime.restoredFolder = '';
      this.runtime.managedOptions = {
        capabilities: [this.api.browseCapability],
        waitForPresentation: true,
        onRequest: (...args) => this.actions.receiveBrowseRequest(...args),
        onCancel: (...args) => this.actions.cancelBrowseRequest(...args)
      };
      this.runtime.host.onConnect = async () => {
        const url = this.runtime.restoredFolder || this.actions.locationValue();
        if (url) {
          await this.actions.browse(url);
        }
      };
      this.runtime.host.onContext = async () => {
        const url = this.runtime.restoredFolder || this.actions.locationValue();
        if (this.runtime.host.session && url && this.runtime.current !== url) {
          await this.actions.browse(url);
        }
      };
      this.runtime.appState = new this.api.AppState();
      this.runtime.host.manage({
        ...this.runtime.managedOptions,
        getState: (...args) => this.actions.captureState(...args),
        restoreState: (...args) => this.actions.restoreState(...args)
      });
    },
    cleanup() {
      this.api.destroy(this.runtime.listEffect);
      for (const signal of this.runtime.files.effects.slice(1)) {
        this.api.destroy(signal);
      }
    },
    captureState() {
      this.runtime.appState.set(
        this.api.apps + 'folder',
        this.runtime.current || this.runtime.restoredFolder,
        'iri'
      );
      const share = this.runtime.shareSelection;
      for (const [field, key] of [['shareResource', 'resource'],
        ['shareRecipient', 'id'], ['shareDocument', 'document']]) {
        this.runtime.appState.set(this.api.apps + field, share?.[key], 'iri');
      }
      this.runtime.appState.set(this.api.apps + 'shareLabel', share?.label);
      return this.runtime.appState.snapshot();
    },
    async restoreState(state) {
      this.runtime.appState.restore(state);
      const shareId = this.runtime.appState.read(this.api.apps + 'shareRecipient', 'iri');
      if (shareId) {
        this.runtime.shareSelection = {
          id: shareId,
          resource: this.runtime.appState.read(this.api.apps + 'shareResource', 'iri'),
          document: this.runtime.appState.read(this.api.apps + 'shareDocument', 'iri'),
          label: this.runtime.appState.read(this.api.apps + 'shareLabel')
        };
        this.actions.swb_renderShare();
        this.data.swb_shareStatus = 'Selection restored. Choose again to load current details. Permissions unchanged.';
      }
      this.runtime.restoredFolder = this.runtime.appState.read(
        this.api.apps + 'folder',
        'iri'
      );
      if (this.runtime.host.session && this.runtime.restoredFolder) {
        await this.actions.browse(this.runtime.restoredFolder);
      }
    }
  }
};
