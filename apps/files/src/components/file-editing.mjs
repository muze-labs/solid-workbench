import styles from './file-editing.css' with { type: 'text' };
import sourceFilesEditing from '../editing.html' with { type: 'text' };

export const fileEditing = {
  styles: { 'swb-file-editing': styles },
  templates: { 'files-editing': sourceFilesEditing },
  commands: {
    muzeSolidFilesRefresh(button) {
      button.closest('[popover]')?.hidePopover();
      return this.actions.operation(() =>
        this.actions.browse(
          this.runtime.current || this.actions.locationValue()
        )
      );
    },
    muzeSolidFilesNewFolder() {
      this.data.muzeSolidFilesCreateStatus = '';
      return this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.muze-solid-files-create-dialog')
      );
    },
    mkdir(form) {
      const name = form.elements.name.value;
      return this.actions.operation(async () => {
        this.data.muzeSolidFilesCreateStatus = 'Creating folder…';
        try {
          await this.actions.makeFolder(name);
          this.data.muzeSolidFilesCreateStatus = '';
          form.reset();
          await this.actions.muzeSolidDesignCloseDialog(form.closest('dialog'));
        }
        catch (error) {
          this.data.muzeSolidFilesCreateStatus =
            'Could not create folder. ' + error.message;
          throw error;
        }
      });
    },
    upload(input) {
      const files = [...input.files];
      return this.actions.operation(async () => {
        try {
          await this.actions.uploadFiles(files);
        }
        finally {
          input.value = '';
        }
      });
    },
    remove(_element, url) {
      _element?.closest('[popover]')?.hidePopover();
      if (
        confirm(
          'Mark this resource deleted? Its contents will be retained; link-metadata-aware clients will hide it.'
        )
      ) {
        return this.actions.operation(() => this.actions.deleteResource(url));
      }
    }
  },
  actions: {
    muzeSolidFilesInitializeTools() {
      const host = this.runtime.host;
      host.view.data.muzeSolidUiHeader = {
        ...host.view.data.muzeSolidUiHeader,
        'data-muze-solid-ui-header-layout': 'compact'
      };
      host.view.data.muzeSolidUiAppTools = [
        {
          command: 'new-folder',
          label: 'New',
          icon: { href: '../assets/feather-icons.svg#folder-plus' },
          attributes: { 'aria-label': 'New folder', title: 'New folder' }
        },
        {
          command: 'upload',
          label: 'Upload',
          icon: { href: '../assets/feather-icons.svg#upload' },
          attributes: { 'aria-label': 'Upload files', title: 'Upload files' }
        },
        {
          command: 'refresh',
          label: 'Refresh',
          icon: { href: '../assets/feather-icons.svg#refresh-cw' },
          attributes: {
            'aria-label': 'Refresh folder',
            title: 'Refresh folder',
            'data-muze-solid-action': 'muzeSolidFilesRefresh'
          }
        },
        {
          command: 'more',
          label: '',
          icon: { href: '../assets/feather-icons.svg#more-horizontal' },
          attributes: {
            'aria-label': 'More file actions',
            title: 'More file actions',
            'data-muze-solid-action': 'muzeSolidFilesMore',
            popovertarget: 'muze-solid-files-more-menu'
          }
        }
      ];
      host.view.data.muzeSolidUiAppToolbar = { hidden: host.task ? '' : null };
      host.onAppAction = (command) => {
        if (command === 'new-folder') {
          return this.commands.call('muzeSolidFilesNewFolder');
        }
        if (command === 'upload') {
          this.container.querySelector('.swb-file-upload-input').click();
        }
        if (command === 'refresh') {
          return this.actions.operation(() =>
            this.actions.browse(
              this.runtime.current || this.actions.locationValue()
            )
          );
        }
      };
    },
    async makeFolder(name) {
      // Metro's empty-string body loses its replayable data when the Solid
      // API composes the request. A Turtle comment is still an empty graph.
      await this.runtime.host
        .requireSession()
        .solid.createContainer(this.actions.child(name) + '/', {
          body: '# Empty container description.\n',
          headers: { 'Content-Type': 'text/turtle' }
        });
      await this.actions.browse(this.runtime.current);
    },
    async uploadFiles(files) {
      const saved = await this.api.uploadFiles(
        this.runtime.host.requireSession(),
        files,
        (...args) => this.actions.child(...args)
      );
      await this.actions.browse(this.runtime.current);
      this.runtime.host.notify(saved + ' files uploaded.');
    },
    async deleteResource(url) {
      const session = this.runtime.host.requireSession();
      await this.api.markResourceDeleted(
        session.client,
        this.actions.inside(url)
      );
      await this.actions.browse(this.runtime.current);
      this.runtime.host.notify('Marked deleted. Contents retained.');
    }
  }
};
