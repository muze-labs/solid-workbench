// Notebook-level interaction policy follows Cobalt's example app. The controller
// owns ranges and editing algorithms; this feature applies results to native RDF.
export const muzeSolidNotebookInteractions = {
  events: {
    muzeSolidNotebookInteraction: {
      subscribe(notify) {
        const target = this.container.ownerDocument.defaultView;
        const types = [
          'keydown',
          'beforeinput',
          'copy',
          'cut',
          'paste',
          'mousedown',
          'mousemove',
          'mouseup',
          'compositionstart',
          'touchstart',
          'focusin'
        ];
        for (const type of types) {
          target.addEventListener(type, notify, true);
        }
        return () => {
          for (const type of types) {
            target.removeEventListener(type, notify, true);
          }
          this.runtime.notebookPointer = false;
        };
      },
      action: 'muzeSolidNotebookInteraction'
    }
  },
  actions: {
    muzeSolidNotebookPoint() {
      const rows = this.actions.muzeSolidNotebookRows();
      const noteIndex = rows.findIndex((row) => row.id === this.runtime.active);
      const editor = this.runtime.editors.get(this.runtime.active);
      const range = editor?.getSelection() || this.runtime.range;
      return noteIndex >= 0 && range
        ? { noteIndex, offset: range.start }
        : null;
    },
    muzeSolidNotebookInteraction(event) {
      const controller = this.runtime.controller;
      if (!controller) {
        return;
      }
      const field = event.target.closest?.('.muze-solid-notebook-editor');
      const inside = field && this.container.contains(field);
      if (['mousedown', 'mousemove', 'mouseup'].includes(event.type)) {
        return this.actions.muzeSolidNotebookPointer(event, inside);
      }
      if (event.type === 'focusin') {
        controller.setSelectionActive(Boolean(inside));
        return;
      }
      if (!inside || this.runtime.busy) {
        return;
      }
      if (event.type === 'touchstart') {
        // Leave touch caret handles and selection menus to the browser/editor.
        controller.clearSelection();
        return;
      }
      if (event.type === 'compositionstart') {
        // Keep native IME local to the active editor; never delete other notes
        // on provisional candidates or a cancelled composition.
        controller.clearSelection();
        return;
      }
      const id = field.closest('[data-block-id]').dataset.blockId;
      this.runtime.active = id;
      const editor = this.runtime.editors.get(id);
      if (!editor || editor.isComposing() || event.isComposing) {
        return;
      }
      const point = this.actions.muzeSolidNotebookPoint();
      if (!point) {
        return;
      }
      const stop = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (['copy', 'cut', 'paste'].includes(event.type)) {
        return this.actions.muzeSolidNotebookClipboard(event, point);
      }
      if (event.type === 'beforeinput') {
        if (
          controller.hasSelection() &&
          [
            'deleteContentBackward',
            'deleteContentForward',
            'deleteByCut'
          ].includes(event.inputType)
        ) {
          stop();
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.deleteSelection()
          );
        }
        if (event.inputType === 'insertParagraph') {
          stop();
          return this.actions.muzeSolidNotebookEditStructure('split');
        }
        const range = editor.getSelection();
        if (range && range.start === range.end) {
          if (
            event.inputType === 'deleteContentBackward' &&
            range.start === 0 &&
            point.noteIndex > 0
          ) {
            stop();
            return this.actions.muzeSolidNotebookEditStructure('join');
          }
          if (
            event.inputType === 'deleteContentForward' &&
            range.end === editor.getLength() &&
            point.noteIndex < this.actions.muzeSolidNotebookRows().length - 1
          ) {
            stop();
            return this.actions.muzeSolidNotebookEditStructure('joinNext');
          }
        }
        if (
          controller.hasSelection() &&
          event.inputType === 'insertText' &&
          event.data
        ) {
          stop();
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.replaceSelectionWithFragments([
              this.actions.muzeSolidNotebookFragment(event.data)
            ])
          );
        }
        return;
      }
      if (event.type !== 'keydown') {
        return;
      }
      const key = event.key;
      if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k') {
        stop();
        return this.commands.muzeSolidNotebookEditLink.call(this);
      }
      if (key === 'Escape' && controller.hasSelection()) {
        stop();
        controller.clearSelection();
        this.actions.muzeSolidNotebookStatus();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'a') {
        controller.clearSelection(); // Let the editor select its native text.
        return;
      }
      if (key === 'Enter' && !event.altKey && !event.metaKey) {
        if (!event.shiftKey) {
          stop();
          return this.actions.muzeSolidNotebookEditStructure('split');
        }
        if (controller.hasSelection()) {
          stop();
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.replaceSelectionWithFragments([
              this.actions.muzeSolidNotebookFragment('\n')
            ])
          );
        }
        return;
      }
      if (controller.hasSelection() && (event.ctrlKey || event.metaKey)) {
        const definition = this.api.defaultRegistry.findByShortcut(event);
        if (definition) {
          stop();
          return this.actions.muzeSolidNotebookFormat(definition.name);
        }
      }
      if (
        key.startsWith('Arrow') &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        if (['ArrowUp', 'ArrowDown'].includes(key)) {
          controller.prepareVerticalNavigation(point.noteIndex);
        }
        else {
          controller.resetVerticalNavigation();
        }
        const direction = key.slice(5);
        if (event.shiftKey) {
          const moved = controller['extend' + direction](
            point.noteIndex,
            point.offset
          );
          if (moved) {
            stop();
            this.actions.muzeSolidNotebookSelectionFeedback();
          }
        }
        else {
          controller.clearSelection();
          const range = editor.getSelection();
          if (
            range &&
            range.start === range.end &&
            controller['move' + direction](point.noteIndex, point.offset)
          ) {
            stop();
          }
        }
        return;
      }
      controller.resetVerticalNavigation();
      if (controller.hasSelection()) {
        if (['Backspace', 'Delete'].includes(key)) {
          stop();
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.deleteSelection()
          );
        }
        if (
          key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          return; // beforeinput owns replacement with actual native input text.
        }
      }
      const range = editor.getSelection();
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        range &&
        range.start === range.end
      ) {
        if (key === 'Backspace' && range.start === 0 && point.noteIndex > 0) {
          stop();
          return this.actions.muzeSolidNotebookEditStructure('join');
        }
        if (
          key === 'Delete' &&
          range.end === editor.getLength() &&
          point.noteIndex < this.actions.muzeSolidNotebookRows().length - 1
        ) {
          stop();
          return this.actions.muzeSolidNotebookEditStructure('joinNext');
        }
      }
    },
    muzeSolidNotebookSelectionFeedback() {
      this.actions.muzeSolidNotebookScheduleTools();
      const controller = this.runtime.controller;
      const range = controller.getOrderedSelection();
      if (!range) {
        return;
      }
      if (!controller.hasSelection()) {
        this.actions.muzeSolidNotebookStatus();
        return;
      }
      const text = controller.copySelection()?.text || '';
      let location = 'note ' + range.start.noteIndex;
      if (range.start.noteIndex === 0) {
        location =
          range.end.noteIndex === 0
            ? 'the title'
            : 'the title to note ' + range.end.noteIndex;
      }
      else if (range.start.noteIndex !== range.end.noteIndex) {
        location =
          'notes ' + range.start.noteIndex + ' to ' + range.end.noteIndex;
      }
      this.actions.muzeSolidNotebookReport(
        'Selected ' + text.length + ' characters in ' + location + '.',
        'selection'
      );
    },
    muzeSolidNotebookFragment(text) {
      return { type: 'cobalt.rich-text', data: { text, annotations: [] } };
    },
    muzeSolidNotebookEditStructure(operation) {
      const point = this.actions.muzeSolidNotebookPoint();
      if (!point) {
        return;
      }
      const controller = this.runtime.controller;
      return this.actions.muzeSolidNotebookEdit(() => {
        if (controller.hasSelection()) {
          return operation === 'split'
            ? controller.replaceSelectionWithFragments([
                this.actions.muzeSolidNotebookFragment(''),
                this.actions.muzeSolidNotebookFragment('')
              ])
            : controller.deleteSelection();
        }
        if (operation === 'split') {
          const editor = this.runtime.editors.get(this.runtime.active);
          const split = editor.splitFragment(point.offset);
          return {
            focus: { noteIndex: point.noteIndex + 1, offset: 0 },
            replacement: {
              noteIndex: point.noteIndex,
              removeNoteIndex: point.noteIndex,
              fragments: [split.before, split.after]
            }
          };
        }
        const joined =
          operation === 'joinNext'
            ? controller.joinWithNext(point.noteIndex, point.offset)
            : controller.joinWithPrevious(point.noteIndex);
        return joined
          ? {
              focus: joined.focus,
              replacement: {
                noteIndex: joined.noteIndex,
                removeNoteIndex: joined.removeNoteIndex,
                fragment: joined.fragment
              }
            }
          : null;
      });
    },
    muzeSolidNotebookEdit(work) {
      if (
        this.runtime.busy ||
        [...this.runtime.editors.values()].some((e) => e.isComposing())
      ) {
        this.actions.muzeSolidNotebookReport(
          'Finish the current edit before changing notes.'
        );
        return;
      }
      this.runtime.structuring = true;
      try {
        const rows = this.actions.muzeSolidNotebookRows();
        const result = work();
        if (!result) {
          return;
        }
        const documents = this.runtime.documents;
        for (const row of rows) {
          const editor = this.runtime.editors.get(row.id);
          if (editor) {
            documents.edit(row.id, editor.getValue());
          }
        }
        const ids = rows.map((row) => row.id);
        const replacement = result.replacement;
        if (replacement) {
          const fragments = replacement.fragments || [replacement.fragment];
          const start = replacement.noteIndex;
          const end = replacement.removeNoteIndex;
          const inserted = [rows[start].id];
          documents.edit(
            inserted[0],
            this.api.validateFragment(fragments[0].data)
          );
          for (let i = start + 1; i <= end; i++) {
            documents.remove(rows[i].id);
          }
          for (let i = 1; i < fragments.length; i++) {
            inserted.push(
              documents.add(
                this.api.validateFragment(fragments[i].data),
                start + i - 1
              )
            );
          }
          ids.splice(start, end - start + 1, ...inserted);
        }
        this.runtime.focusBlock = {
          id: ids[result.focus.noteIndex],
          offset: result.focus.offset
        };
        this.actions.muzeSolidNotebookProject();
        return this.actions.muzeSolidNotebookRun(() => documents.persist());
      }
      catch (error) {
        this.actions.muzeSolidNotebookReport(error.message);
      }
      finally {
        this.runtime.structuring = false;
      }
    },
    muzeSolidNotebookClipboardFragments(clipboard) {
      const serialized = clipboard.getData(
        this.api.COBALT_NOTEBOOK_CLIPBOARD_MIME
      );
      if (!serialized) {
        return this.api
          .readFragmentsFromClipboard(clipboard)
          .map((fragment) => ({
            type: 'cobalt.rich-text',
            data: this.api.validateFragment(fragment)
          }));
      }
      // Cobalt's example wraps typed fragments; its public rich-text writer
      // emits raw fragments. Retain empty notes and refuse unknown note types.
      const value = JSON.parse(serialized);
      if (!Array.isArray(value.fragments)) {
        throw new Error('notebook: Unsupported notebook clipboard data.');
      }
      return value.fragments.map((fragment) => {
        if (
          fragment.type !== undefined &&
          fragment.type !== 'cobalt.rich-text'
        ) {
          throw new Error(
            'notebook: This clipboard note type cannot be edited here.'
          );
        }
        return {
          type: 'cobalt.rich-text',
          data: this.api.validateFragment(
            fragment.type ? fragment.data : fragment
          )
        };
      });
    },
    muzeSolidNotebookClipboard(event, point) {
      if (!event.clipboardData) {
        return;
      }
      const controller = this.runtime.controller;
      try {
        if (event.type === 'paste') {
          const fragments = this.actions.muzeSolidNotebookClipboardFragments(
            event.clipboardData
          );
          if (
            !fragments.length ||
            (!controller.hasSelection() && fragments.length === 1)
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.hasSelection()
              ? controller.replaceSelectionWithFragments(fragments)
              : controller.pasteFragments(
                  point.noteIndex,
                  point.offset,
                  fragments
                )
          );
        }
        if (!controller.hasSelection()) {
          return;
        }
        const clipboard = controller.copySelection();
        if (!clipboard) {
          return;
        }
        this.api.writeFragmentsToClipboard(
          event.clipboardData,
          clipboard.fragments.map((fragment) =>
            this.api.validateFragment(fragment.data)
          )
        );
        event.preventDefault();
        event.stopPropagation();
        if (event.type === 'cut') {
          return this.actions.muzeSolidNotebookEdit(() =>
            controller.deleteSelection()
          );
        }
      }
      catch (error) {
        event.preventDefault();
        event.stopPropagation();
        this.actions.muzeSolidNotebookReport(error.message);
      }
    },
    muzeSolidNotebookPointer(event, inside) {
      const controller = this.runtime.controller;
      if (this.runtime.busy || event.sourceCapabilities?.firesTouchEvents) {
        return;
      }
      if (event.type === 'mousedown') {
        if (!inside || event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.detail >= 3) {
          this.runtime.notebookPointer = false;
          controller.selectParagraphAtClientPosition(
            event.clientX,
            event.clientY
          );
        }
        else if (event.detail === 2) {
          this.runtime.notebookPointer = false;
          controller.selectWordAtClientPosition(event.clientX, event.clientY);
        }
        else {
          const point = controller.getPointAtClientPosition(
            event.clientX,
            event.clientY
          );
          if (point) {
            this.runtime.notebookPointer = true;
            controller.startPointerSelection(point);
          }
        }
      }
      else if (this.runtime.notebookPointer) {
        const point = controller.getPointAtClientPosition(
          event.clientX,
          event.clientY
        );
        if (point) {
          controller.updatePointerSelection(point);
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.type === 'mouseup') {
          this.runtime.notebookPointer = false;
          controller.finishPointerSelection();
          if (controller.hasSelection()) {
            this.actions.muzeSolidNotebookSelectionFeedback();
          }
        }
      }
    }
  }
};
