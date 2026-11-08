export const sessionServices = {
  actions: {
    notify(text) {
      this.actions.muzeSolidDesignNotify(text);
    },
    message(text) {
      this.data.message = text;
    },
    async run(operation, { network = false } = {}) {
      try {
        const session = this.runtime.session;
        return await (network && session
          ? session.perform(operation)
          : operation());
      }
      catch (error) {
        if (['cancelled', 'sign_in_required'].includes(error.code)) {
          return undefined;
        }
        this.data.message = error.message || String(error);
        return undefined;
      }
    },
    resource(name) {
      const key = name + 'Resource';
      const explicit =
        this.runtime.workspaceContext?.settings[key] ??
        this.runtime.settings[key];
      if (explicit) {
        return this.api.httpUrl(explicit);
      }
      const root = this.runtime.session?.storage[0];
      if (!root) {
        throw new Error(
          'solid-app-ui: No storage root found in your profile. Set an app storage location in Preferences.'
        );
      }
      return new URL('apps/solid-apps/' + name + '.ttl', root).href;
    },
    requireSession() {
      if (!this.runtime.session) {
        throw new Error('solid-app-ui: Connect to Solid first.');
      }
      return this.runtime.session;
    },
    manage(options) {
      const host = this.runtime.host;
      host.managed = new this.api.ManagedApp({
        name: document.title,
        ...options,
        beforeCheckpoint: async () => {
          await options.beforeCheckpoint?.();
        },
        onContext: async (context) => {
          await host.ready;
          if (!context) {
            return;
          }
          if (context.owner !== host.selectedWebId) {
            this.runtime.pendingWorkspaceOwner = context.owner;
            throw new Error(
              'solid-app-ui: Connect to the workspace WebID, then retry restoring this app.'
            );
          }
          const previous = this.runtime.workspaceContext;
          if (previous) {
            if (
              previous.id !== context.id ||
              previous.owner !== context.owner
            ) {
              throw new Error(
                'solid-app-ui: Reopen this app in the selected workspace.'
              );
            }
            return;
          }
          const settings = { ...context.settings };
          this.runtime.workspaceContext = {
            ...context,
            settings,
            save: async (values) => {
              const result = await host.managed.peer.call(
                'workspace-preferences',
                { id: context.id, values }
              );
              Object.assign(settings, result);
            }
          };
          Object.assign(this.runtime.settings, settings);

          await host.onContext?.(context);
        },
        getState: async () => {
          await host.ready;
          return options.getState();
        },
        restoreState: async (state) => {
          await host.ready;
          if (state !== null) {
            return options.restoreState(state);
          }
        },
        onState: (...args) => this.actions.message(...args)
      });
      return host.managed;
    }
  }
};
