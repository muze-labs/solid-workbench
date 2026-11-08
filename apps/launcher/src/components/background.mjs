import template from '../background.html' with { type: 'text' };
import styles from './background.css' with { type: 'text' };

export const launcherBackground = {
  templates: { 'swb-background': template },
  styles: { 'swb-background': styles },
  events: {
    swbBackgroundError: {
      target() {
        return this.container.querySelector('.swb-launcher-background');
      },
      type: 'error',
      action: 'swb_backgroundFailed'
    }
  },
  actions: {
    swb_backgroundFailed() {
      this.data.swb_background = { hidden: '', src: null };
      const preferences = this.runtime.host.preferenceView;
      preferences.data.swb_backgroundPreview = { hidden: '', src: null };
      preferences.data.swb_backgroundMessage =
        'The image could not be displayed. Your background choice is retained.';
    },
    swb_renderBackground() {
      const entry = this.api.activeWorkspace(this.runtime.persistence.snapshot);
      const id = entry.background || '';
      const preferences = this.runtime.host.preferenceView;
      preferences.data.swb_backgroundChoice = !id
        ? 'none'
        : id.startsWith(this.api.backgrounds.presetPrefix)
          ? id.slice(this.api.backgrounds.presetPrefix.length)
          : this.api.backgrounds.isUpload(id)
            ? 'uploaded'
            : 'url';
      preferences.data.swb_backgroundUrl = id.startsWith('http') ? id : '';
      const owner = this.runtime.persistence.owner;
      const selection = owner + '\n' + id;
      if (this.runtime.backgroundSelection === selection) {
        return;
      }
      this.runtime.backgroundSelection = selection;
      this.actions.swb_showBackground(id, owner).catch((error) => {
        if (this.runtime.backgroundSelection === selection) {
          this.actions.swb_backgroundFailed();
          preferences.data.swb_backgroundMessage =
            error.message +
            ' Your choice is retained; the normal theme is used.';
        }
      });
    },
    async swb_showBackground(id, owner) {
      const selection = owner + '\n' + id;
      const preferences = this.runtime.host.preferenceView;
      this.data.swb_background = { hidden: '', src: null };
      preferences.data.swb_backgroundPreview = { hidden: '', src: null };
      if (this.runtime.backgroundObjectUrl) {
        URL.revokeObjectURL(this.runtime.backgroundObjectUrl);
        this.runtime.backgroundObjectUrl = null;
      }
      preferences.data.swb_backgroundMessage = '';
      if (!id) {
        return;
      }
      const blob = await this.api.backgrounds.loadBackground(
        id,
        owner,
        this.runtime.host.session
      );
      if (this.runtime.backgroundSelection !== selection) {
        return;
      }
      const url = URL.createObjectURL(blob);
      this.runtime.backgroundObjectUrl = url;
      this.data.swb_background = { hidden: null, src: url };
      preferences.data.swb_backgroundPreview = { hidden: null, src: url };
      if (this.api.backgrounds.isUpload(id)) {
        preferences.data.swb_backgroundMessage =
          'Image saved on this device. Save to Pod to use it elsewhere.';
      }
    },
    async swb_stageBackground(id) {
      this.actions.swb_requireOwner();
      const persistence = this.runtime.persistence;
      const previous = structuredClone(persistence.snapshot);
      const next = structuredClone(previous);
      this.api.activeWorkspace(next).background = id;
      try {
        await persistence.stage(next);
      }
      catch (error) {
        persistence.snapshot = previous;
        throw error;
      }
      this.runtime.workspace.extra.directory = next.directory;
      this.runtime.backgroundSelection = null;
    },
    async swb_syncBackgrounds(session, url) {
      for (const entry of this.runtime.persistence.snapshot.directory.entries) {
        if (this.api.backgrounds.isUpload(entry.background || '')) {
          const uploaded = await this.api.backgrounds.uploadBackground(
            entry.background,
            this.runtime.persistence.owner,
            session,
            url
          );
          const previous = structuredClone(this.runtime.persistence.snapshot);
          const next = structuredClone(previous);
          next.directory.entries.find(
            (item) => item.id === entry.id
          ).background = uploaded;
          try {
            await this.runtime.persistence.stage(next);
          }
          catch (error) {
            this.runtime.persistence.snapshot = previous;
            throw error;
          }
          this.runtime.workspace.extra.directory = next.directory;
        }
      }
      this.actions.swb_renderBackground();
    },
    swb_releaseBackground() {
      this.runtime.backgroundSelection = null;
      if (this.runtime.backgroundObjectUrl) {
        URL.revokeObjectURL(this.runtime.backgroundObjectUrl);
      }
    }
  }
};

export const backgroundPreferences = {
  commands: {
    swb_saveBackground(button) {
      const form = button.form;
      return this.actions.swb_workspaceChange(async (workbench) => {
        const choice = form.elements.swb_backgroundChoice.value;
        let id = '';
        if (/^bg[1-6]$/.test(choice)) {
          id = workbench.api.backgrounds.presetPrefix + choice;
        }
        else if (choice === 'url') {
          id = workbench.api.httpUrl(form.elements.swb_backgroundUrl.value);
        }
        else if (choice === 'uploaded') {
          id =
            workbench.api.activeWorkspace(
              workbench.runtime.persistence.snapshot
            ).background || '';
          if (!workbench.api.backgrounds.isUpload(id)) {
            throw new Error('backgrounds: Choose an image file first.');
          }
        }
        await workbench.actions.swb_stageBackground(id);
      }, 'Background applied on this device. Save to Pod to synchronize.');
    },
    swb_uploadBackground(button) {
      const input = button.form.elements.swb_backgroundFile;
      const file = input.files[0];
      return this.actions.swb_workspaceChange(async (workbench) => {
        if (!file) {
          throw new Error('backgrounds: Choose an image file first.');
        }
        const id = await workbench.api.backgrounds.storeUpload(
          file,
          workbench.runtime.persistence.owner
        );
        await workbench.actions.swb_stageBackground(id);
        input.value = '';
      }, 'Image saved on this device. Save to Pod to upload it.');
    }
  }
};
