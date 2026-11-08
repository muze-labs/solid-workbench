export const workspacePreferences = {
  commands: {
    async swb_openDiagnostics() {
      const workbench = this.runtime.workbench;
      await this.actions.muzeSolidDesignCloseDialog(this.container);
      await workbench.actions.swb_openDiagnostics();
    },
    swb_recoverShortcuts() {
      return this.actions.swb_workspaceChange(async (workbench) => {
        await workbench.api.recoverCollection(
          'launcher',
          workbench.runtime.store.localKey
        );
        workbench.runtime.store = await workbench.actions.swb_openShortcuts(
          workbench.api.activeWorkspace(workbench.runtime.persistence.snapshot)
        );
        workbench.actions.render();
      });
    },
    swb_createWorkspace(button) {
      const input = button.form.elements.swb_newWorkspace;
      return this.actions.swb_workspaceChange(async (workbench) => {
        const snapshot = structuredClone(
          workbench.runtime.persistence.snapshot
        );
        workbench.api.addWorkspace(snapshot, input.value);
        await workbench.runtime.persistence.stage(snapshot);
        workbench.runtime.workspace.extra.directory = snapshot.directory;
        input.value = '';
      });
    },
    swb_renameWorkspace(button, id) {
      const title = button.closest('li').querySelector('input').value.trim();
      return this.actions.swb_workspaceChange(async (workbench) => {
        const snapshot = structuredClone(
          workbench.runtime.persistence.snapshot
        );
        snapshot.directory.entries.find((entry) => entry.id === id).title =
          title;
        workbench.api.validateDirectory(snapshot.directory);
        await workbench.runtime.persistence.stage(snapshot);
        workbench.runtime.workspace.extra.directory = snapshot.directory;
      });
    },
    swb_deleteWorkspace(_button, id) {
      return this.actions.swb_workspaceChange(async (workbench) => {
        const snapshot = structuredClone(
          workbench.runtime.persistence.snapshot
        );
        workbench.api.removeWorkspace(snapshot, id);
        await workbench.runtime.persistence.stage(snapshot);
        workbench.runtime.workspace.extra.directory = snapshot.directory;
      });
    },
    swb_saveWorkspaceSettings(button) {
      return this.actions.swb_workspaceChange(async (workbench) => {
        const form = button.form;
        const values = Object.fromEntries(
          workbench.api.workspaceSettingKeys.map((key) => [
            key,
            form.elements['swb_' + key].value.trim()
          ])
        );
        const storage = form.elements.swb_workspaceStorage.value
          .split(/\s+/)
          .filter(Boolean)
          .map((value) => workbench.api.httpUrl(value));
        if (storage.some((url) => !url.endsWith('/'))) {
          throw new Error('launcher: Storage endpoint URLs must end with /.');
        }
        await workbench.actions.swb_saveWorkspaceSettings(values, [
          ...new Set(storage)
        ]);
      });
    }
  },
  actions: {
    async swb_workspaceChange(operation, message) {
      const workbench = this.runtime.workbench;
      if (!workbench || workbench.runtime.workspaceBusy) {
        this.data.message = 'Wait for the workspace operation to finish.';
        return;
      }
      workbench.actions.swb_requireOwner();
      workbench.runtime.workspaceBusy = true;
      this.actions.swb_preferences_busy(true);
      try {
        await operation(workbench);
        workbench.actions.swb_renderDirectory();
        this.data.message = message ||
          'Workspace changes saved on this device. ' +
          'Use Save to Pod to synchronize. App settings apply on the next launch.';
      }
      catch (error) {
        this.data.message = error.message;
      }
      finally {
        workbench.runtime.workspaceBusy = false;
        this.actions.swb_preferences_busy(false);
      }
    }
  }
};
