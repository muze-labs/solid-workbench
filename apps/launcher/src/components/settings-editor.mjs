import template from '../settings.html?template' with { type: 'text' };

// This contribution is loaded by Preferences, not by Workbench's home screen.
export const swbWorkbenchSettings = {
  templates: { 'swb-workbench-settings': template },
  commands: {
    swb_refreshWorkspace() {
      return this.actions.swb_loadWorkspace();
    },
    swb_chooseWorkspace(select) {
      this.data.swb_workspaceId = select.value;
      return this.actions.swb_showWorkspace();
    },
    swb_createWorkspace() {
      return this.actions.swb_workspaceOperation('create', {
        title: this.container.querySelector('[name=swb_newWorkspace]').value
      });
    },
    swb_renameWorkspace(input) {
      return this.actions.swb_workspaceOperation('rename', {
        title: input.value
      });
    },
    swb_deleteWorkspace() {
      return this.actions.swb_workspaceOperation('delete');
    },
    swb_workspaceSetting(input) {
      return this.actions.swb_workspaceOperation('settings', {
        values: { [input.name]: input.value.trim() }
      });
    },
    swb_workspaceStorage(input) {
      return this.actions.swb_workspaceOperation('settings', {
        storage: input.value.split(/\s+/).filter(Boolean)
      });
    },
    swb_changeBackground(input) {
      this.data[input.name] = input.value;
      let id = '';
      const choice = this.data.swb_backgroundChoice;
      if (/^bg[1-6]$/.test(choice)) {
        id = this.api.backgrounds.presetPrefix + choice;
      }
      else if (choice === 'url') {
        id = this.data.swb_backgroundUrl;
        if (!id || !input.checkValidity()) {
          return;
        }
      }
      else if (choice === 'uploaded') {
        return;
      }
      return this.actions.swb_workspaceOperation('background', {
        background: id
      });
    },
    async swb_uploadBackground(input) {
      try {
        const file = input.files[0];
        if (!file) {
          return;
        }
        const id = await this.api.backgrounds.storeUpload(
          file,
          this.runtime.host.selectedWebId || ''
        );
        await this.actions.swb_workspaceOperation('background', {
          background: id
        });
        input.value = '';
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
    },
    swb_recoverShortcuts() {
      return this.actions.swb_workspaceOperation('recover-shortcuts');
    },
    async swb_openDiagnostics() {
      const result = await this.actions.swb_workspaceOperation('diagnostics');
      const request = this.runtime.request;
      if (request && result) {
        await this.runtime.host.managed.respond(request.id, {
          result: { diagnostics: true }
        });
      }
    }
  },
  actions: {
    async swb_workspaceStatus(snapshot) {
      if (snapshot?.owner !== (this.runtime.host.selectedWebId || '')) {
        return;
      }
      this.runtime.directory = snapshot;
      if (
        ['workspaces', 'background', 'storage', 'advanced'].includes(
          this.runtime.section
        )
      ) {
        this.data.swb_status =
          snapshot.message ||
          (snapshot.pending
            ? 'Saved on this device. Waiting to synchronize with your Pod.'
            : 'Workspace synchronized with your Pod.');
      }
    },
    async swb_loadWorkspace() {
      this.data.swb_openWorkbench = { hidden: '' };
      if (this.data.swb_app !== 'workbench' && !this.runtime.callerWorkspace) {
        this.data.swb_workspaceVisibility = { hidden: '' };
        return;
      }
      try {
        const result = await this.actions.swb_callWorkspace({
          operation: 'read'
        });
        this.runtime.directory = result;
        this.data.swb_workspaces = result.entries.map((entry) => ({
          ...entry,
          option: { value: entry.id, text: entry.title }
        }));
        this.data.swb_workspaceId ||= this.runtime.callerWorkspace || '';
        this.data.swb_workspaceId ||= result.active;
        this.data.swb_workspaceVisibility = {
          hidden: this.data.swb_app === 'workbench' ? null : ''
        };
        this.data.swb_workspaceSelect = {
          options: result.entries.map((entry) => ({
            value: entry.id,
            text: entry.title
          })),
          selected: this.data.swb_workspaceId
        };
        await this.actions.swb_showWorkspace();
      }
      catch (error) {
        if (this.data.swb_app !== 'workbench') {
          return;
        }
        this.data.swb_openWorkbench = { hidden: null };
        this.data.swb_workspaceFields = { disabled: '' };
        this.data.swb_status =
          'Open Preferences from Workbench to edit ' +
          'workspaces. ' +
          error.message;
        this.data.swb_workspaceVisibility = { hidden: '' };
      }
    },
    swb_callWorkspace(input) {
      const peer = this.runtime.host.managed?.peer;
      if (!peer) {
        throw new Error('preferences: No connected Workbench host.');
      }
      return peer.call('preferences-workspace', {
        ...input,
        owner: this.runtime.host.selectedWebId || ''
      });
    },
    async swb_workspaceOperation(operation, values = {}) {
      this.actions.swb_localWriteStarted();
      try {
        const previousIds =
          this.runtime.directory?.entries.map((entry) => entry.id) || [];
        const previousTarget = this.data.swb_workspaceId;
        const result = await this.actions.swb_callWorkspace({
          operation,
          ...values,
          id: this.data.swb_workspaceId,
          revision: this.runtime.directory?.revision
        });
        this.runtime.directory = result;
        if (operation === 'delete') {
          this.data.swb_workspaceId = result.active;
        }
        if (operation === 'create') {
          await this.runtime.drafts.write(previousTarget, 'swb_newWorkspace');
          this.data.swb_newWorkspace = '';
          this.data.swb_workspaceId = result.entries.find(
            (entry) => !previousIds.includes(entry.id)
          ).id;
        }
        const keys =
          operation === 'rename'
            ? ['title']
            : operation === 'settings'
              ? [
                  ...Object.keys(values.values || {}),
                  ...(values.storage ? ['storage'] : [])
                ]
              : operation === 'background'
                ? ['swb_backgroundUrl']
                : [];
        for (const key of keys) {
          await this.runtime.drafts.write(this.data.swb_workspaceId, key);
        }
        this.data.swb_status = result.pending
          ? 'Saved on this device. Workbench will synchronize with your Pod.'
          : 'Workspace synchronized with your Pod.';
        if (operation !== 'diagnostics') {
          await this.actions.swb_loadWorkspace();
        }
        return result;
      }
      catch (error) {
        this.data.swb_status = error.message;
      }
      finally {
        this.actions.swb_localWriteFinished();
      }
    },
    async swb_showWorkspace() {
      const entry = this.runtime.directory?.entries.find(
        (item) => item.id === this.data.swb_workspaceId
      );
      this.data.swb_workspaceFields = { disabled: entry ? null : '' };
      if (!entry) {
        this.data.swb_status =
          'This workspace no longer exists. Your drafts ' +
          'are retained. Choose another workspace.';
        return;
      }
      this.data.swb_newWorkspace =
        this.runtime.drafts.read(entry.id, 'swb_newWorkspace') || '';
      if (this.data.swb_app !== 'workbench') {
        Object.assign(this.data, entry.settings);
      }
      this.data.swb_workspace = {
        title: entry.title,
        ...entry.settings,
        storage: entry.storage.join('\n')
      };
      this.data.swb_deleteButton = {
        disabled:
          entry.id === 'default' || entry.id === this.runtime.directory.active
            ? ''
            : null
      };
      const id = entry.background || '';
      this.data.swb_backgroundChoice = !id
        ? 'none'
        : id.startsWith(this.api.backgrounds.presetPrefix)
          ? id.slice(this.api.backgrounds.presetPrefix.length)
          : this.api.backgrounds.isUpload(id)
            ? 'uploaded'
            : 'url';
      this.data.swb_backgroundUrl =
        this.runtime.drafts.read(entry.id, 'swb_backgroundUrl') ??
        (id.startsWith('http') ? id : '');
      for (const key of ['title', 'storage', ...Object.keys(entry.settings)]) {
        const text = this.runtime.drafts.read(entry.id, key);
        if (text !== undefined) {
          this.data.swb_workspace[key] = text;
          if (
            this.data.swb_app !== 'workbench' &&
            Object.hasOwn(entry.settings, key)
          ) {
            this.data[key] = text;
          }
        }
      }
      const selection = entry.id + '\n' + id;
      this.runtime.previewSelection = selection;
      if (this.runtime.previewUrl) {
        URL.revokeObjectURL(this.runtime.previewUrl);
      }
      this.data.swb_preview = { hidden: '', src: null };
      if (id) {
        try {
          const blob = await this.api.backgrounds.loadBackground(
            id,
            this.runtime.host.selectedWebId || '',
            this.runtime.host.session
          );
          if (this.runtime.previewSelection !== selection) {
            return;
          }
          this.runtime.previewUrl = URL.createObjectURL(blob);
          this.data.swb_preview = {
            hidden: null,
            src: this.runtime.previewUrl
          };
        }
        catch (error) {
          this.data.swb_status = error.message;
        }
      }
    }
  }
};
