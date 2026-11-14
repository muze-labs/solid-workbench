import styles from './resource-picker.css' with { type: 'text' };
import sourceFilesPicker from '../picker.html' with { type: 'text' };
import sourcePickerActions from '../picker-actions.html' with { type: 'text' };

export const resourcePicker = {
  styles: { 'swb-resource-picker': styles },
  templates: {
    'files-picker': sourceFilesPicker,
    'files-picker-actions': sourcePickerActions
  },
  commands: {
    muzeSolidFilesChooseNewFile(form) {
      let url;
      try {
        if (this.runtime.pending?.selection?.mode !== 'save') {
          throw new Error('files: A save destination was not requested.');
        }
        url = this.actions.inside(
          this.actions.child(form.elements.name.value.trim())
        );
        if (this.data.entries.some((entry) => entry.url === url)) {
          throw new Error(
            'files: That name already exists. Choose a new filename.'
          );
        }
      }
      catch (error) {
        this.data.muzeSolidFilesPickerStatus = error.message;
        return;
      }
      return this.runtime.host.run(() =>
        this.actions.finishSelection({
          result: { '@id': url }
        })
      );
    },
    selectResource(_element, url) {
      return this.runtime.host.run(() => this.actions.selectFile(url));
    },
    selectFolder() {
      if (this.runtime.pending?.selection?.mode !== 'resource') {
        return;
      }
      this.runtime.host.run(() =>
        this.actions.finishSelection({
          result: { '@id': this.actions.inside(this.runtime.current) }
        })
      );
    },
    cancelSelection() {
      this.runtime.host.run(() =>
        this.actions.finishSelection({
          error: {
            code: 'cancelled',
            message: 'Selection cancelled in Files.'
          }
        })
      );
    }
  },
  actions: {
    renderPicker() {
      const pending = this.runtime.pending;
      this.data.picker = { hidden: pending ? null : '' };
      this.runtime.host.view.data.muzeSolidUiAppToolbar = {
        hidden: pending || this.runtime.host.task ? '' : null
      };
      this.data.editing = {
        hidden: pending || this.runtime.host?.task ? '' : null
      };
      this.data.swb_shareVisible = {
        hidden:
          !pending && !this.runtime.host?.task && this.runtime.shareSelection
            ? null
            : ''
      };
      this.data.requester = pending
        ? pending.requester.application + ' (' + pending.requester.origin + ')'
        : '';
      const mode = pending?.selection?.mode || 'resource';
      this.data.muzeSolidFilesPickerTitle =
        mode === 'save'
          ? 'Save a new file'
          : mode === 'open'
            ? 'Open a file'
            : 'Select a resource';
      this.data.muzeSolidFilesPickerDescription =
        mode === 'save'
          ? 'Choose a folder and enter a new filename.'
          : mode === 'open'
            ? 'Choose a file to open.'
            : 'Choose a file, or select the current folder.';
      this.data.muzeSolidFilesPickerSave = {
        hidden: pending && mode === 'save' ? null : ''
      };
      this.data.muzeSolidFilesPickerFolder = {
        hidden: pending && mode === 'resource' ? null : ''
      };
      this.runtime.files.state.options.picker = Boolean(
        pending || this.runtime.host?.task
      );
      this.runtime.files.state.options.pickerMode = mode;
    },
    finishSelection: async function (response) {
      if (!this.runtime.pending || this.runtime.selecting) {
        return;
      }
      const id = this.runtime.pending.id;
      this.runtime.selecting = true;
      try {
        await this.runtime.host.managed.respond(id, response);
        if (response.error?.code === 'cancelled') {
          this.runtime.host.message('');
        }
        else {
          this.runtime.host.message(
            response.error?.message ||
              'Resource URL returned. Return to Launcher if your browser did not switch tabs.'
          );
        }
      }
      finally {
        this.runtime.selecting = false;
        if (this.runtime.pending?.id === id) {
          this.runtime.pending = null;
          this.actions.renderPicker();
        }
      }
    },
    receiveBrowseRequest(event) {
      let error;
      let selection;
      if (
        this.runtime.pending ||
        this.runtime.selecting ||
        this.runtime.sharing
      ) {
        error = {
          code: 'busy',
          message: 'Files is handling another selection.'
        };
      }
      else if (event.capability !== this.api.browseCapability) {
        error = {
          code: 'invalid',
          message: 'Unsupported selection request.'
        };
      }
      else {
        try {
          selection = this.api.browseRequest(event.input);
        }
        catch (failure) {
          error = { code: 'invalid', message: failure.message };
        }
      }
      if (error) {
        this.runtime.host.message(error);
        this.runtime.host.run(() =>
          this.runtime.host.managed.respond(event.id, { error })
        );
        return;
      }
      this.runtime.pending = { ...event, selection };
      this.data.muzeSolidFilesPickerName = { value: selection.suggestedName };
      this.data.muzeSolidFilesPickerStatus = '';
      this.actions.renderPicker();
      this.runtime.host.message(
        this.runtime.host.task
          ? ''
          : 'A resource selection is waiting in Files.'
      );
      this.runtime.host.managed.presentationReady();
    },
    cancelBrowseRequest(event) {
      if (this.runtime.pending?.id === event.id) {
        this.runtime.pending = null;
        this.actions.renderPicker();
        this.runtime.host.message(
          event.error && event.error.code !== 'cancelled'
            ? event.error.message
            : ''
        );
      }
    },
    selectFile(url) {
      const selected = this.api
        .from(this.data.entries)
        .where({ url })
        .toArray()[0];
      if (!selected) {
        throw new Error('files: Select a resource from the current folder.');
      }
      if (
        selected.type === 'folder' &&
        this.runtime.pending?.selection?.mode !== 'resource'
      ) {
        throw new Error('files: Open a folder to select a file inside it.');
      }
      return this.actions.finishSelection({
        result: { '@id': this.actions.inside(url) }
      });
    }
  }
};
