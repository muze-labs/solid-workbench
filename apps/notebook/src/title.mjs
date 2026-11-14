import template from './title.html?template' with { type: 'text' };
import styles from './title.css' with { type: 'text' };

export const muzeSolidNotebookTitle = {
  templates: { 'muze-solid-notebook-title': template },
  styles: { 'muze-solid-notebook-title': styles },
  actions: {
    muzeSolidNotebookProjectTitle() {
      this.data.muzeSolidNotebookTitleAttributes = {
        'data-block-id': this.runtime.documents.root.id
      };
      document.title =
        this.runtime.documents.title.trim() || 'Untitled notebook';
    },
    muzeSolidNotebookRows() {
      return [
        { id: this.runtime.documents.root.id },
        ...this.runtime.blocks.view.current
      ];
    }
  }
};
