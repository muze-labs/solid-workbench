import '@muze-labs/solid-app-data/simply-runtime.mjs';
import template from './notebook.html?template' with { type: 'text' };
import styles from './notebook.css' with { type: 'text' };
import {
  solidDialog,
  solidToolbar
} from '@muze-labs/solid-design';

export const muzeSolidNotebook = {
  templates: { 'muze-solid-notebook': template },
  styles: { 'muze-solid-notebook': styles },
  components: { solidDialog, solidToolbar },
  api: {
    muzeSolidNotebookStatusIcons: {
      local: { icon: 'hard-drive', label: 'Saved on this device' },
      synced: { icon: 'check-circle', label: 'Saved on this device and Pod' },
      busy: { icon: 'loader', label: 'Notebook operation in progress' },
      attention: { icon: 'alert-triangle', label: 'Notebook needs attention' },
      selection: { icon: 'type', label: 'Notebook selection' }
    }
  },
  events: {
    muzeSolidNotebookMount: {
      subscribe(notify) {
        const observer = new MutationObserver((changes) => {
          if (
            changes.some(
              (change) =>
                !change.target.closest?.('.muze-solid-notebook-editor')
            )
          ) {
            notify();
          }
        });
        observer.observe(this.container, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-block-id', 'inert', 'hidden']
        });
        notify();
        return () => {
          observer.disconnect();
          this.runtime.pickerBroker?.dispose();
          this.runtime.pickerBroker = null;
        };
      },
      action: 'muzeSolidNotebookMount'
    },
    muzeSolidNotebookChange: {
      target() {
        return this.container;
      },
      type: 'cobalt:change',
      action: 'muzeSolidNotebookChange'
    },
    muzeSolidNotebookFocus: {
      target() {
        return this.container;
      },
      type: 'focusin',
      action: 'muzeSolidNotebookFocus'
    },
    muzeSolidNotebookSelection: {
      target() {
        return document;
      },
      type: 'selectionchange',
      action: 'muzeSolidNotebookSelection'
    },
    muzeSolidNotebookLinkClose: {
      target() {
        return this.container.querySelector('.muze-solid-notebook-link-dialog');
      },
      type: 'close',
      action: 'muzeSolidNotebookRestoreLinkFocus'
    }
  },
  commands: {
    muzeSolidNotebookNew() {
      return this.actions.muzeSolidNotebookRun(() =>
        this.actions.muzeSolidNotebookCreateDocument()
      );
    },
    async muzeSolidNotebookSelect(element, id) {
      const dialog = element?.closest('dialog');
      const selected = await this.actions.muzeSolidNotebookRun(async () => {
        await this.actions.muzeSolidNotebookFlush();
        await this.runtime.documents.select(id);
        this.runtime.collection = null;
        this.runtime.collectionUrl = '';
        this.actions.muzeSolidNotebookDocumentRoute();
        this.actions.muzeSolidNotebookProject({ focusFirst: true });
        this.actions.muzeSolidNotebookShowEditor();
      });
      if (selected && dialog) {
        await this.actions.solidCloseDialog(dialog);
        this.actions.muzeSolidNotebookMount();
      }
    },
    muzeSolidNotebookOpen() {
      return this.actions.muzeSolidNotebookPickDocument('open');
    },
    muzeSolidNotebookSave() {
      if (!this.runtime.documents.url && !this.runtime.documents.target) {
        return this.actions.muzeSolidNotebookPickDocument('save');
      }
      return this.actions.muzeSolidNotebookSave(false);
    },
    muzeSolidNotebookSaveAs() {
      return this.actions.muzeSolidNotebookPickDocument('save');
    },
    muzeSolidNotebookRecent() {
      if (!this.runtime.busy) {
        this.runtime.documentsList.state.data =
          this.runtime.documents.entries();
        return this.actions.solidOpenDialog(
          this.container.querySelector('.muze-solid-notebook-document-dialog')
        );
      }
    },
    async muzeSolidNotebookEditLink() {
      if (this.runtime.busy) {
        return;
      }
      const editor = this.runtime.editors.get(this.runtime.active);
      const range = editor?.getSelection() ||
        this.runtime.range || { start: 0, end: 0 };
      this.runtime.linkTarget = {
        id: this.runtime.active,
        range: { start: range.start, end: range.end }
      };
      this.data.muzeSolidNotebookLinkDraft = { value: '' };
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return this.actions.solidOpenDialog(
        this.container.querySelector('.muze-solid-notebook-link-dialog')
      );
    },
    async muzeSolidNotebookLink(form) {
      const target = this.runtime.linkTarget;
      this.runtime.active = target.id;
      this.runtime.range = target.range;
      const applied = await this.actions.muzeSolidNotebookFormat(
        'link',
        form.elements.href.value
      );
      if (applied) {
        const inserted = target.range.start === target.range.end;
        const offset =
          target.range.end +
          (inserted ? new URL(form.elements.href.value).href.length : 0);
        this.runtime.linkTarget = {
          id: this.runtime.active,
          range: { start: offset, end: offset }
        };
        await this.actions.solidCloseDialog(form.closest('dialog'));
      }
    }
  },
  actions: {
    async muzeSolidNotebookCreateDocument() {
      await this.actions.muzeSolidNotebookFlush();
      if (this.runtime.documents.owner && !this.runtime.collection) {
        await this.actions.muzeSolidNotebookEnsureDefaultCollection();
      }
      await this.runtime.documents.create();
      await this.actions.muzeSolidNotebookCollectionCreateDraft();
      this.actions.muzeSolidNotebookProject({ focusFirst: true });
      this.actions.muzeSolidNotebookShowEditor();
      this.actions.muzeSolidNotebookDocumentRoute();
    },

    muzeSolidNotebookRestoreLinkFocus() {
      const target = this.runtime.linkTarget;
      const editor = this.runtime.editors.get(target?.id);
      if (editor) {
        editor.focus(target.range.start, target.range.end);
      }
      this.runtime.linkTarget = null;
    },
    async muzeSolidNotebookInitialize() {
      const host = this.runtime.host;
      host.view.data.muzeSolidUiTitle = 'Notebook';
      host.view.data.muzeSolidUiHeader = {
        ...host.view.data.muzeSolidUiHeader,
        'data-muze-solid-ui-header-layout': 'compact'
      };
      host.view.data.muzeSolidUiAppToolbar = { hidden: null };
      const tools = [
        ['New', 'New', 'file-plus', 'New notebook'],
        ['Open', 'Open', 'folder', 'Open notebook'],
        ['Recent', '', 'clock', 'Notebooks on this device'],
        ['Collections', 'Collections', 'book-open', 'Notebook collections'],
        ['CollectionTools', '', 'more-vertical', 'Collection options'],
        ['Save', 'Save', 'save', 'Save notebook'],
        ['SaveAs', 'Save As', 'copy', 'Save notebook as'],
        ['Status', '', 'loader', 'Notebook status']
      ];
      host.view.data.muzeSolidUiAppTools = tools.map(
        ([action, label, icon, description]) => ({
          command: action,
          label,
          icon: { href: '../assets/feather-icons.svg#' + icon },
          attributes: {
            title: description,
            'aria-label': description,
            'data-muze-solid-action': 'muzeSolidNotebook' + action,
            popovertarget:
              action === 'Status' ? 'muze-solid-notebook-status' : null
          }
        })
      );
      const status = host.view.data.muzeSolidUiAppTools.find(
        (tool) => tool.command === 'Status'
      );
      simply.effect(() => {
        const busy = this.data.muzeSolidNotebookBusy.disabled === '';
        const kind = busy ? 'busy' : this.data.muzeSolidNotebookStatusKind;
        const state = this.api.muzeSolidNotebookStatusIcons[kind];
        const message = busy
          ? 'Notebook operation in progress. Your edits are retained.'
          : this.data.muzeSolidNotebookStatus;
        status.icon.href = '../assets/feather-icons.svg#' + state.icon;
        status.attributes['aria-label'] =
          state.label + '. Show notebook status';
        status.attributes.title = message;
        this.data.muzeSolidNotebookStatusDisplay = message;
      });
      host.onAppAction = (command) => {
        if (command.startsWith('block:')) {
          return this.commands.call(
            'muzeSolidNotebookBlockCommand',
            null,
            command.slice('block:'.length)
          );
        }
        return this.commands.call('muzeSolidNotebook' + command);
      };
      this.runtime.controller = new this.api.NotebookController();
      this.runtime.editors = new Map();
      this.actions.muzeSolidNotebookInitializeTools();
      for (const key of ['blocks', 'documentsList']) {
        const projection = simply.model({ data: [], options: {} });
        projection.addEffect(function () {
          return simply.effect(() => this.state.data);
        });
        projection.addEffect(function (input) {
          return simply.effect(() =>
            [...input.current].sort((a, b) =>
              key === 'blocks'
                ? a.position - b.position
                : a.title.localeCompare(b.title)
            )
          );
        });
        this.runtime[key] = projection;
      }
      simply.effect(() => {
        this.data.muzeSolidNotebookBlocks = this.runtime.blocks.view.current;
        this.data.muzeSolidNotebookDocuments =
          this.runtime.documentsList.view.current;
      });
      host.manage({
        capabilities: [],
        getState: () => null,
        canClose: async () => {
          if (this.runtime.busy) {
            return { allowed: false };
          }
          try {
            await this.actions.muzeSolidNotebookFlush();
            return { allowed: true };
          }
          catch {
            return { allowed: false };
          }
        }
      });
      host.beforeAccountLeave = () => {
        if (this.runtime.busy) {
          throw new Error('notebook: Wait for the current document operation.');
        }
        return this.actions.muzeSolidNotebookFlush();
      };
      host.onConnect = () => this.actions.muzeSolidNotebookAccount();
      this.eventBindings.start();
      await host.ready;
      await this.actions.muzeSolidNotebookAccount();
    },
    async muzeSolidNotebookAccount() {
      const owner = this.runtime.host.selectedWebId || '';
      if (this.runtime.documents?.owner === owner) {
        for (const item of [
          'collection',
          'fileOperation',
          'collectionPreference'
        ]) {
          if (this.runtime[item]) {
            this.runtime[item].session = this.runtime.host.session;
          }
        }
        return;
      }
      if (this.runtime.documents) {
        await this.actions.muzeSolidNotebookFlush();
      }
      const documents = await new this.api.NotebookDocuments({ owner }).open();
      if (owner !== (this.runtime.host.selectedWebId || '')) {
        return;
      }
      this.runtime.documents = documents;
      this.actions.muzeSolidNotebookProject({ focusFirst: true });
      this.runtime.collectionRouteMode = 'replace';
      try {
        await this.actions.muzeSolidNotebookRun(() =>
          this.actions.muzeSolidNotebookInitializeCollections(owner)
        );
      }
      finally {
        this.runtime.collectionRouteMode = 'push';
      }
    },
    muzeSolidNotebookProject({ focusFirst = false } = {}) {
      if (
        this.container.contains(document.activeElement) &&
        document.activeElement.matches('.muze-solid-notebook-editor')
      ) {
        document.activeElement.blur();
      }
      this.actions.muzeSolidNotebookResetTools();
      this.runtime.controller.clearSelection();
      for (const editor of this.runtime.editors.values()) {
        editor.destroy();
      }
      this.runtime.editors.clear();
      const documents = this.runtime.documents;
      const blocks = documents.editorBlocks();
      this.runtime.focusFirst = focusFirst;
      if (focusFirst) {
        this.runtime.focusBlock = null;
      }
      if (this.runtime.focusBlock) {
        this.runtime.active = this.runtime.focusBlock.id;
      }
      else if (
        this.runtime.active !== null &&
        !blocks.some((block) => block.id === this.runtime.active)
      ) {
        this.runtime.active = blocks[0]?.id;
        this.runtime.range = null;
      }
      this.actions.muzeSolidNotebookProjectTitle();
      this.data.muzeSolidNotebookUrl = documents.url;
      this.runtime.blocks.state.data = documents.blocks().map((block) => ({
        ...block,
        attributes: { 'data-block-id': block.id }
      }));
      this.runtime.documentsList.state.data = documents.entries();
      this.actions.muzeSolidNotebookStatus();
      requestAnimationFrame(() => this.actions.muzeSolidNotebookMount());
    },
    muzeSolidNotebookMount() {
      if (!this.runtime.documents) {
        return;
      }
      const ordered = [];
      for (const row of this.container.querySelectorAll('[data-block-id]')) {
        const id = row.dataset.blockId;
        const field = row.querySelector('.muze-solid-notebook-editor');
        const block = this.runtime.documents
          .editorBlocks()
          .find((item) => item.id === id);
        if (!field || !block) {
          continue;
        }
        let editor = this.runtime.editors.get(id);
        if (editor && editor.element !== field) {
          editor.destroy();
          this.runtime.editors.delete(id);
          editor = null;
        }
        if (!editor) {
          editor = this.api.editCobalt(field, block.fragment);
          this.runtime.editors.set(id, editor);
        }
        ordered.push(editor);
      }
      this.runtime.controller.setAdapters(ordered);
      if (this.data.muzeSolidNotebookOverviewVisibility.hidden !== '') {
        return;
      }
      this.actions.muzeSolidNotebookScheduleTools();
      if (this.runtime.focusFirst && ordered.length) {
        // The model's displayed order can differ from native RDF subject order.
        const firstBody = this.runtime.blocks.view.current[0]?.id;
        if (
          (this.runtime.documents.blocks().length && !firstBody) ||
          (firstBody && !this.runtime.editors.has(firstBody))
        ) {
          return;
        }
        const first = (
          this.runtime.editors.get(firstBody) || ordered[0]
        ).element.closest('[data-block-id]');
        this.runtime.focusBlock = { id: first.dataset.blockId, offset: 0 };
      }
      if (this.runtime.focusBlock) {
        const editor = this.runtime.editors.get(this.runtime.focusBlock.id);
        if (
          editor &&
          editor.element.checkVisibility({ visibilityProperty: true }) &&
          !this.runtime.busy &&
          !editor.element.closest('[inert]') &&
          !this.container.querySelector('dialog[open]')
        ) {
          this.runtime.active = this.runtime.focusBlock.id;
          editor.focus(this.runtime.focusBlock.offset);
          if (document.activeElement === editor.element) {
            this.runtime.focusBlock = null;
            this.runtime.focusFirst = false;
          }
        }
      }
    },
    muzeSolidNotebookFocus(event) {
      const row = event.target.closest('[data-block-id]');
      if (row) {
        this.runtime.active = row.dataset.blockId;
        if (this.runtime.focusFirst && !this.runtime.busy) {
          this.runtime.focusFirst = false;
          this.runtime.focusBlock = null;
        }
      }
    },
    muzeSolidNotebookSelection() {
      const editor = this.runtime.editors.get(this.runtime.active);
      const range = editor?.getSelection();
      if (range) {
        this.runtime.range = range;
      }
    },
    muzeSolidNotebookChange(event) {
      if (this.runtime.structuring) {
        return;
      }
      const id = event.target.closest('[data-block-id]')?.dataset.blockId;
      if (!id || !this.runtime.editors.has(id)) {
        return;
      }
      try {
        this.runtime.documents.edit(id, event.detail.fragment);
        document.title =
          this.runtime.documents.title.trim() || 'Untitled notebook';
        return this.actions.muzeSolidNotebookStoreEdit();
      }
      catch (error) {
        this.actions.muzeSolidNotebookReport(error.message);
      }
    },
    muzeSolidNotebookStoreEdit() {
      const documents = this.runtime.documents;
      this.actions.muzeSolidNotebookReport(
        'Saving changes on this device.',
        'busy'
      );
      const feedbackVersion = this.runtime.feedbackVersion;
      return documents
        .persist()
        .then(() => {
          // A late acknowledgement must not replace newer feedback or another file.
          if (
            documents === this.runtime.documents &&
            feedbackVersion === this.runtime.feedbackVersion
          ) {
            this.actions.muzeSolidNotebookStatus();
          }
        })
        .catch((error) => {
          if (documents === this.runtime.documents) {
            this.actions.muzeSolidNotebookReport(error.message);
          }
        });
    },
    muzeSolidNotebookStatus() {
      const local = this.runtime.documents.dirty;
      this.actions.muzeSolidNotebookReport(
        local
          ? 'Saved on this device. Pod copy has not been updated.'
          : 'Saved on this device and Pod.',
        local ? 'local' : 'synced'
      );
    },
    muzeSolidNotebookReport(message, kind = 'attention') {
      this.runtime.feedbackVersion = (this.runtime.feedbackVersion || 0) + 1;
      this.data.muzeSolidNotebookStatus = message;
      this.data.muzeSolidNotebookStatusKind = kind;
      this.data.muzeSolidNotebookAnnouncement =
        kind === 'attention' ? message : '';
    },
    muzeSolidNotebookPickDocument(mode) {
      return this.actions.muzeSolidNotebookRun(async () => {
        await this.actions.muzeSolidNotebookFlush();
        const host = this.runtime.host;
        const session = host.requireSession();
        const documents = this.runtime.documents;
        let suggestedName = '';
        if (mode === 'save') {
          const title =
            documents.title.replaceAll('/', '-').replaceAll('\\', '-').trim() ||
            'notebook';
          suggestedName = /\.ttl$/i.test(title) ? title : title + '.ttl';
        }
        const url = await this.actions.muzeSolidNotebookChooseResource(
          mode,
          suggestedName,
          mode === 'open' ? 'Open notebook' : 'Save notebook as'
        );
        if (
          documents !== this.runtime.documents ||
          documents.owner !== host.selectedWebId ||
          host.session !== session
        ) {
          throw new Error(
            'notebook: Account changed; selection was not applied.'
          );
        }
        if (new URL(url).pathname.endsWith('/')) {
          throw new Error('notebook: Choose a notebook file, not a folder.');
        }
        if (mode === 'open') {
          await documents.load(session, url);
          await this.actions.muzeSolidNotebookUpdateCollectionEntry('', false);
        }
        else {
          const reserved = documents.target;
          await documents.save(session, url, true);
          await this.actions.muzeSolidNotebookUpdateCollectionEntry(reserved);
        }
        this.actions.muzeSolidNotebookProject({ focusFirst: mode === 'open' });
        this.actions.muzeSolidNotebookDocumentRoute();
        this.actions.muzeSolidNotebookShowEditor();
      });
    },
    async muzeSolidNotebookFlush() {
      await this.runtime.collectionEdit;
      if (!this.runtime.documents) {
        return;
      }
      for (const editor of this.runtime.editors.values()) {
        if (editor.isComposing()) {
          throw new Error(
            'notebook: Finish composing text before changing documents.'
          );
        }
      }
      await this.runtime.documents.persist();
    },
    async muzeSolidNotebookRun(work) {
      if (this.runtime.busy) {
        return;
      }
      for (const editor of this.runtime.editors.values()) {
        if (editor.isComposing()) {
          this.actions.muzeSolidNotebookReport(
            'Finish composing text before changing documents.'
          );
          return;
        }
      }
      this.runtime.busy = true;
      this.data.muzeSolidNotebookLocked = { inert: '' };
      this.data.muzeSolidNotebookBusy = { disabled: '' };
      for (const tool of this.runtime.host.view.data.muzeSolidUiAppTools) {
        tool.attributes.disabled = tool.command === 'Status' ? null : '';
      }
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await work();
        return true;
      }
      catch (error) {
        if (error.code === 'cancelled') {
          this.actions.muzeSolidNotebookStatus();
        }
        else {
          this.actions.muzeSolidNotebookReport(error.message);
        }
        return false;
      }
      finally {
        this.data.muzeSolidNotebookLocked = { inert: null };
        this.runtime.busy = false;
        this.data.muzeSolidNotebookBusy = { disabled: null };
        this.actions.muzeSolidNotebookUpdateDocumentTools();
        if (this.runtime.pendingNavigation) {
          this.runtime.pendingNavigation = false;
          this.actions.muzeSolidNotebookNavigate();
        }
      }
    },
    muzeSolidNotebookSave(asNew) {
      return this.actions.muzeSolidNotebookRun(async () => {
        await this.actions.muzeSolidNotebookFlush();
        await this.runtime.documents.save(
          this.runtime.host.requireSession(),
          this.runtime.documents.url || this.runtime.documents.target,
          asNew || !this.runtime.documents.url
        );
        await this.actions.muzeSolidNotebookUpdateCollectionEntry();
        this.actions.muzeSolidNotebookDocumentRoute();
        this.actions.muzeSolidNotebookStatus();
      });
    },
    muzeSolidNotebookFormat(command, value) {
      try {
        if (this.runtime.busy) {
          return false;
        }
        if (
          [...this.runtime.editors.values()].some((editor) =>
            editor.isComposing()
          )
        ) {
          throw new Error('notebook: Finish composing text before formatting.');
        }
        const controller = this.runtime.controller;
        if (command === 'link') {
          const href = new URL(value);
          if (!['http:', 'https:', 'mailto:'].includes(href.protocol)) {
            throw new Error('notebook: Unsupported link address.');
          }
          value = href.href;
        }
        if (controller.hasSelection()) {
          // Each adapter's cobalt:change event uses the normal autosave path.
          const result = controller.applyCommandToSelection(
            command,
            value ?? controller.getSelectionCommandState(command) === undefined
          );
          if (result) {
            const row =
              this.actions.muzeSolidNotebookRows()[result.focus.noteIndex];
            this.runtime.editors.get(row.id).focus(result.focus.offset);
          }
          return Boolean(result);
        }
        const editor = this.runtime.editors.get(this.runtime.active);
        const range = this.runtime.range;
        if (!editor || !range) {
          throw new Error('notebook: Select text to format it.');
        }
        if (command === 'link' && range.start === range.end) {
          const point = this.actions.muzeSolidNotebookPoint();
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.pasteFragments(point.noteIndex, range.start, [
              {
                type: 'cobalt.rich-text',
                data: {
                  text: value,
                  annotations: [
                    {
                      range: [0, value.length],
                      order: 0,
                      tag: this.api.createLinkAnnotationTag(value)
                    }
                  ]
                }
              }
            ])
          );
        }
        if (range.start === range.end) {
          throw new Error('notebook: Select text to format it.');
        }
        editor.focus(range.start, range.end);
        editor.applyCommand(
          command,
          range,
          value ?? !editor.getCommandState(command, range.start)
        );
        return true;
      }
      catch (error) {
        this.actions.muzeSolidNotebookReport(error.message);
        return false;
      }
    }
  }
};
