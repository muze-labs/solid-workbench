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
    },
    swb_renderBackground() {
      const entry = this.api.activeWorkspace(this.runtime.persistence.snapshot);
      const id = entry.background || '';
      const owner = this.runtime.persistence.owner;
      const selection = owner + '\n' + id;
      if (this.runtime.backgroundSelection === selection) {
        return;
      }
      this.runtime.backgroundSelection = selection;
      this.actions.swb_showBackground(id, owner).catch((error) => {
        if (this.runtime.backgroundSelection === selection) {
          this.actions.swb_backgroundFailed();
          this.runtime.host.message(
            error.message + ' Your background choice is retained.'
          );
        }
      });
    },
    async swb_showBackground(id, owner) {
      const selection = owner + '\n' + id;
      this.data.swb_background = { hidden: '', src: null };
      if (this.runtime.backgroundObjectUrl) {
        URL.revokeObjectURL(this.runtime.backgroundObjectUrl);
        this.runtime.backgroundObjectUrl = null;
      }
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
