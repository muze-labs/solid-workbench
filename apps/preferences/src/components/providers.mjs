import styles from './providers.css' with { type: 'text' };
import template from '../provider.html' with { type: 'text' };

export const swbProviderPreferences = {
  styles: { 'swb-provider-preferences': styles },
  templates: { 'swb-provider-preferences': template },
  events: {
    swbProviderDraft: {
      target() {
        return this.container;
      },
      type: 'input',
      action: 'swb_preserveProviderDraft'
    }
  },
  commands: {
    swb_chooseProviderKind(select) {
      if (!['browseProvider', 'recipientProvider'].includes(select.value)) {
        return;
      }
      this.data.swb_providerKind = select.value;
      this.runtime.providerKey = select.value;
      this.runtime.customProvider = false;
      this.runtime.providerModel.state.data = [];
      return this.actions.swb_loadProviders();
    },
    swb_chooseProvider(select) {
      if (select.value === 'custom') {
        this.runtime.customProvider = true;
        this.actions.swb_renderProvider();
        return;
      }
      const choice = this.runtime.providerModel.state.data.find(
        (row) => row.id === select.value
      );
      if (choice) {
        return this.actions.swb_saveProvider(choice.choice);
      }
    },
    swb_customProvider(input) {
      return this.actions.swb_saveProvider({
        application: input.value,
        url: input.value
      });
    },
    swb_resetProvider() {
      return this.actions.swb_saveProvider(null);
    },
    swb_refreshProviders() {
      return this.actions.swb_loadProviders();
    }
  },
  actions: {
    swb_providerKey() {
      return this.runtime.providerKey || 'browseProvider';
    },
    swb_providerCapability() {
      return this.actions.swb_providerKey() === 'browseProvider'
        ? this.api.browseCapability : this.api.selectRecipientCapability;
    },
    swb_initializeProviders() {
      const owner = this;
      const list = this.api.model({ data: [], options: {} });
      list.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return owner.api.effect(() =>
          owner.api
            .from(input.current)
            .where(owner.actions.swb_isProvider)
            .toArray()
        );
      });
      this.runtime.providerModel = list;
      this.runtime.providerEffect = this.api.effect(() => {
        this.runtime.providerRows = list.view.current;
        this.actions.swb_renderProvider();
      });
    },
    swb_isProvider(row) {
      return row.supported;
    },
    swb_cleanupProviders() {
      this.runtime.providerGeneration =
        (this.runtime.providerGeneration || 0) + 1;
      this.api.destroy(this.runtime.providerEffect);
      for (const effect of this.runtime.providerModel.effects.slice(1)) {
        this.api.destroy(effect);
      }
    },
    swb_providerLabel(value, key = this.actions.swb_providerKey()) {
      return value
        ? value.url + ' (' + value.application + ')'
        : key === 'browseProvider'
          ? 'Built-in Files' : 'Built-in Contacts';
    },
    swb_renderProvider() {
      const state = this.runtime.settings;
      if (!state) {
        return;
      }
      const key = this.actions.swb_providerKey();
      const choice = state.settings()[key];
      const rows = this.runtime.providerRows || [];
      const known = rows.find(
        (row) =>
          row.choice &&
          choice &&
          row.choice.application === choice.application &&
          row.choice.url === choice.url
      );
      const draft = state.drafts()[key];
      this.data.swb_providerCurrent = this.actions.swb_providerLabel(choice);
      this.data.swb_providerUrl = draft || choice?.url || '';
      const custom =
        this.runtime.customProvider ||
        Boolean(draft) ||
        Boolean(choice && !known);
      this.data.swb_providerCustom = { hidden: custom ? null : '' };
      this.data.swb_providerSelect = {
        options: [
          { value: 'builtin', text: this.actions.swb_providerLabel(null) },
          ...rows.map((row) => ({ value: row.id, text: row.label })),
          { value: 'custom', text: 'Custom app URL' }
        ],
        selected: custom ? 'custom' : known?.id || 'builtin'
      };
    },
    async swb_preserveProviderDraft(event) {
      if (event.target.name !== 'swb_providerUrl') {
        return;
      }
      this.actions.swb_localWriteStarted();
      try {
        await this.runtime.settings.draft(
          this.actions.swb_providerKey(), event.target.value
        );
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
      finally {
        this.actions.swb_localWriteFinished();
      }
    },
    async swb_saveProvider(choice) {
      this.actions.swb_localWriteStarted();
      try {
        const state = this.runtime.settings;
        const owner = this.runtime.host.selectedWebId || '';
        if (!owner) {
          throw new Error(
            'preferences: Select a WebID before choosing a provider.'
          );
        }
        if (state.owner !== owner) {
          throw new Error('preferences: Identity changed; reopen Preferences.');
        }
        await state.change(this.actions.swb_providerKey(), choice);
        this.runtime.customProvider = false;
        this.actions.swb_renderProvider();
        this.api.announcePreferences(owner);
        this.data.swb_status = 'Default app saved on this device.';
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
    async swb_loadProviders() {
      const generation = (this.runtime.providerGeneration || 0) + 1;
      this.runtime.providerGeneration = generation;
      const owner = this.runtime.host.selectedWebId || '';
      const key = this.actions.swb_providerKey();
      const capability = this.actions.swb_providerCapability();
      this.actions.swb_renderProvider();
      const candidates = new Map();
      this.data.swb_providerDiscovery = 'Checking saved app declarations…';
      let unavailable = 0;
      let applications = [];
      try {
        const snapshot = await this.actions.swb_callWorkspace({
          operation: 'read'
        });
        applications = snapshot.applications || [];
      }
      catch {
        this.data.swb_providerDiscovery =
          'Open Preferences from Workbench to list its saved apps. Custom URLs remain available.';
      }
      for (const app of applications) {
        let choice = null;
        try {
          if ((app.capabilities?.includes(capability) ||
              (app.live && capability === this.api.browseCapability)) && app.url) {
            choice = { application: app.url, url: app.url };
          }
          else if (app.manifest) {
            const session = this.runtime.host.session;
            const client =
              session?.client ||
              this.api.createSolidMetroClient(location.origin, {
                oidc: false,
                oldm: false
              });
            const read = () => this.api.loadDocument(client, app.manifest);
            const document = session
              ? await session.perform(read, { interactive: false })
              : await read();
            const descriptions = [...document.graph.data].filter((node) =>
              []
                .concat(node.a || [])
                .includes(this.api.prefixes.schema + 'SoftwareApplication')
            );
            if (descriptions.length === 1) {
              const node = descriptions[0];
              const capabilities = [].concat(
                this.api.valueAt(
                  node,
                  'https://vocab.muze.nl/capability#provides'
                ) || []
              );
              if (
                capabilities.some(
                  (term) => this.api.idOf(term) === capability
                )
              ) {
                choice = {
                  application: new URL(node.id).href,
                  url: this.api.httpUrl(
                    this.api.idOf(
                      this.api.valueAt(node, this.api.prefixes.schema + 'url')
                    )
                  )
                };
              }
            }
          }
          const candidate = choice || { application: app.url, url: app.url };
          if (candidate.url) {
            const id = candidate.application + '\n' + candidate.url;
            candidates.set(id, {
              id,
              choice: candidate,
              supported: Boolean(choice),
              label:
                (app.name || 'Saved app') +
                ' — ' +
                new URL(candidate.url).origin
            });
          }
        }
        catch {
          unavailable += 1;
        }
      }
      if (
        generation !== this.runtime.providerGeneration ||
        key !== this.actions.swb_providerKey() ||
        owner !== (this.runtime.host.selectedWebId || '')
      ) {
        return;
      }
      this.runtime.providerModel.state.data = [...candidates.values()];
      if (applications.length) {
        this.data.swb_providerDiscovery = unavailable
          ? 'Some manifests are unavailable. Custom URL entry is still available.'
          : 'Available apps checked. Undeclared apps can be entered by URL.';
      }
      else if (this.data.swb_providerDiscovery.startsWith('Checking')) {
        this.data.swb_providerDiscovery =
          'No saved apps declare this selection operation yet.';
      }
      this.actions.swb_renderProvider();
    }
  }
};
