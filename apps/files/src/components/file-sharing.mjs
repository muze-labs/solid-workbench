import template from '../sharing.html' with { type: 'text' };
import styles from './file-sharing.css' with { type: 'text' };

export const swbFileSharing = {
  templates: { 'swb-files-sharing': template },
  styles: { 'swb-files-sharing': styles },
  commands: {
    swb_shareResource(_button, url) {
      _button?.closest('[popover]')?.hidePopover();
      return this.runtime.host.run(() => this.actions.swb_chooseShareRecipient(url));
    },
    swb_changeShareRecipient() {
      return this.runtime.host.run(() =>
        this.actions.swb_chooseShareRecipient(this.runtime.shareSelection?.resource));
    }
  },
  actions: {
    swb_renderShare() {
      const choice = this.runtime.shareSelection;
      this.data.swb_shareVisible = {
        hidden: choice && !this.runtime.host.task && !this.runtime.pending ? null : ''
      };
      this.data.swb_shareResource = choice?.resource || '';
      this.data.swb_sharePerson = choice?.label || '';
      this.data.swb_shareId = choice?.id || '';
      this.data.swb_shareDocument = choice?.document || '';
      this.data.swb_shareEmail = choice?.email || '';
      this.data.swb_sharePhone = choice?.phone || '';
      this.data.swb_shareWebId = choice?.webId || '';
    },
    async swb_chooseShareRecipient(url) {
      if (this.runtime.sharing || this.runtime.pending || this.runtime.host.task) {
        return;
      }
      const host = this.runtime.host;
      if (!host.managed?.ready) {
        throw new Error('files: Open Files from Workbench to choose a recipient.');
      }
      const resource = this.actions.inside(url);
      const entry = this.api.from(this.runtime.files.state.data)
        .where({ url: resource }).toArray()[0];
      if (!entry || entry.deleted) {
        throw new Error('files: Choose a resource from this folder.');
      }
      const owner = host.selectedWebId;
      const workspace = host.workspaceContext?.id;
      this.runtime.sharing = true;
      try {
        const provider = this.api.launchUrl(
          new URL('../contacts/', location.href).href, { webId: owner }
        );
        const result = await host.muzeSolidUiInvoke(
          this.api.selectRecipientCapability, provider, {},
          'Choose someone for ' + entry.name
        );
        if (owner !== host.selectedWebId || workspace !== host.workspaceContext?.id) {
          return;
        }
        const contact = await this.api.readRecipient(result, host.session);
        if (owner !== host.selectedWebId || workspace !== host.workspaceContext?.id) {
          return;
        }
        const profile = this.api.readProfile(contact.node);
        this.runtime.shareSelection = {
          resource, id: contact.id, document: contact.document,
          label: profile.name || contact.id,
          email: profile.email, phone: profile.phone, webId: profile.webId
        };
        this.actions.swb_renderShare();
        this.data.swb_shareStatus = 'Recipient selected. Permissions unchanged.';
        await host.managed.publish();
      }
      catch (error) {
        if (error.code === 'cancelled') {
          this.data.swb_shareStatus = 'Selection cancelled. Previous choice retained.';
          return;
        }
        throw error;
      }
      finally {
        this.runtime.sharing = false;
      }
    }
  }
};
