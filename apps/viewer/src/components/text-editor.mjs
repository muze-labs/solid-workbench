import template from '../text-editor.html' with { type: 'text' };

export const muzeSolidTextEditor = {
  templates: { 'muze-solid-text-editor': template },
  events: {
    muzeSolidTextInput: {
      target() {
        return this.container;
      },
      type: 'input',
      action: 'muzeSolidTextChanged'
    }
  },
  commands: {
    muzeSolidTextNew() {
      return this.runtime.host.run(() =>
        this.actions.muzeSolidTextOpen({
          input: {
            version: 1,
            access: 'host-draft',
            id: 'standalone',
            text: ''
          }
        })
      );
    },
    muzeSolidTextApply() {
      return this.runtime.host.run(this.actions.muzeSolidTextApply);
    },
    muzeSolidTextCancel() {
      return this.runtime.host.run(this.actions.muzeSolidTextCancel);
    }
  },
  actions: {
    async muzeSolidTextOpen({ id, input, requester }) {
      const draft = this.api.textDraft(input);
      this.runtime.textRequest = id || null;
      this.runtime.textInput = draft;
      this.runtime.textSource = this.api.local.indexedDB(
        'solid-viewer-text-drafts',
        {
          key: [
            this.runtime.host.selectedWebId || 'anonymous',
            requester?.origin || location.origin,
            draft.id
          ].join('\n')
        }
      );
      const state = new this.api.AppState();
      state.restore({
        turtle:
          (await this.runtime.textSource.load()) ||
          new this.api.AppState().snapshot().turtle
      });
      const recovered = state.read(this.api.apps + 'textDraft');
      const hasDraft = state.read(this.api.apps + 'hasTextDraft') === 'true';
      const base = state.read(this.api.apps + 'textBase');
      this.runtime.textState = state;
      this.data.muzeSolidTextDraft = hasDraft ? recovered : draft.text;
      this.runtime.textDirty = hasDraft && recovered !== draft.text;
      this.data.muzeSolidTextTitle = id ? 'Edit text' : 'Write text';
      this.data.muzeSolidTextStatus = hasDraft
        ? base === draft.text
          ? 'Recovered your local draft.'
          : 'Recovered an older draft. Review it before using it with the current deck.'
        : 'Text stays in this editor until you choose Use text.';
      this.data.muzeSolidTextVisibility = { hidden: null };
      this.data.muzeSolidViewerDisplay = { hidden: '' };
      this.runtime.textPending = Promise.resolve();
    },
    muzeSolidTextChanged(event) {
      if (!event.target.classList.contains('muze-solid-text-input')) {
        return;
      }
      this.data.muzeSolidTextDraft = event.target.value;
      this.runtime.textDirty =
        event.target.value !== this.runtime.textInput.text;
      this.runtime.textState.set(this.api.apps + 'hasTextDraft', 'true');
      this.runtime.textState.set(
        this.api.apps + 'textDraft',
        event.target.value
      );
      this.runtime.textState.set(
        this.api.apps + 'textBase',
        this.runtime.textInput.text
      );
      const turtle = this.runtime.textState.snapshot().turtle;
      this.runtime.textPending = this.runtime.textPending
        .catch(() => {})
        .then(() => this.runtime.textSource.save(turtle));
      this.runtime.textPending
        .then(() => {
          this.data.muzeSolidTextStatus =
            'Draft saved on this device. Choose Use text to update the deck.';
        })
        .catch((error) => {
          this.data.muzeSolidTextStatus = error.message;
        });
    },
    async muzeSolidTextApply() {
      await this.runtime.textPending;
      const text = this.data.muzeSolidTextDraft;
      const wasDirty = this.runtime.textDirty;
      this.runtime.textDirty = false;
      if (this.runtime.textRequest) {
        try {
          await this.runtime.host.managed.respond(this.runtime.textRequest, {
            result: { version: 1, id: this.runtime.textInput.id, text }
          });
        }
        catch (error) {
          this.runtime.textDirty = wasDirty;
          throw error;
        }
      }
      else {
        this.data.muzeSolidViewerText = text;
        this.data.muzeSolidViewerImage = { hidden: '' };
        this.data.muzeSolidViewerStatus = '';
        this.data.muzeSolidViewerDisplay = { hidden: null };
      }
      this.runtime.textDirty = false;
      this.runtime.textRequest = null;
      this.data.muzeSolidTextVisibility = { hidden: '' };
      // Keep the provider's recoverable draft until the next explicit session;
      // a reply alone does not prove the caller durably saved it.
    },
    async muzeSolidTextCancel() {
      await this.runtime.textPending;
      this.runtime.textDirty = false;
      await this.runtime.textSource.save(
        new this.api.AppState().snapshot().turtle
      );
      if (this.runtime.textRequest) {
        await this.runtime.host.managed.respond(this.runtime.textRequest, {
          error: { code: 'cancelled', message: 'Text editing cancelled.' }
        });
      }
      this.runtime.textRequest = null;
      this.data.muzeSolidTextVisibility = { hidden: '' };
      this.data.muzeSolidViewerDisplay = { hidden: null };
    }
  }
};
