export const muzeSolidNotebookRichTextTools = {
  api: {
    muzeSolidNotebookToolbars: {
      'cobalt.rich-text': {
        label: 'Rich text tools',
        state: 'muzeSolidNotebookRichTextToolState',
        tools: [
          {
            id: 'strong',
            label: 'Bold',
            icon: 'bold',
            command: 'muzeSolidNotebookBlockFormat',
            value: 'strong'
          },
          {
            id: 'em',
            label: 'Italic',
            icon: 'italic',
            command: 'muzeSolidNotebookBlockFormat',
            value: 'em'
          },
          {
            id: 'underline',
            label: 'Underline',
            icon: 'underline',
            command: 'muzeSolidNotebookBlockFormat',
            value: 'underline'
          },
          {
            id: 'EditLink',
            label: 'Link',
            icon: 'link',
            command: 'muzeSolidNotebookEditLink'
          }
        ]
      }
    }
  },
  commands: {
    muzeSolidNotebookBlockFormat(_button, command) {
      return this.actions.muzeSolidNotebookFormat(command);
    }
  },
  actions: {
    muzeSolidNotebookRichTextToolState(tool, editor, range) {
      const controller = this.runtime.controller;
      const selected = controller.hasSelection() || range?.end > range?.start;
      if (tool.id === 'EditLink') {
        return { disabled: null };
      }
      const state = controller.hasSelection()
        ? controller.getSelectionCommandState(tool.value)
        : range && editor.getCommandState(tool.value, range.start);
      return {
        disabled: selected ? null : '',
        'aria-pressed': String(Boolean(state))
      };
    }
  }
};
