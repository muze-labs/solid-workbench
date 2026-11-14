import template from './block-tools.html?template' with { type: 'text' };
import styles from './block-tools.css' with { type: 'text' };
import { muzeSolidDesignToolbar } from '@muze-labs/solid-design';

export const muzeSolidNotebookBlockTools = {
  templates: { 'muze-solid-notebook-block-tools': template },
  styles: { 'muze-solid-notebook-block-tools': styles },
  components: { muzeSolidDesignToolbar },
  events: {
    muzeSolidNotebookToolsEvents: {
      subscribe(notify) {
        const target = this.container.ownerDocument.defaultView;
        const types = [
          'keydown',
          'pointerdown',
          'pointerup',
          'focusin',
          'selectionchange',
          'cobalt:change',
          'compositionstart',
          'compositionend'
        ];
        for (const type of types) {
          target.addEventListener(type, notify, true);
        }
        return () => {
          for (const type of types) {
            target.removeEventListener(type, notify, true);
          }
          cancelAnimationFrame(this.runtime.toolsFrame);
        };
      },
      action: 'muzeSolidNotebookToolsEvent'
    },
    muzeSolidNotebookToolsViewport: {
      subscribe(notify) {
        const target = this.container.ownerDocument.defaultView;
        target.addEventListener('scroll', notify, true);
        target.addEventListener('resize', notify);
        target.visualViewport?.addEventListener('resize', notify);
        target.visualViewport?.addEventListener('scroll', notify);
        const observer = new ResizeObserver(notify);
        observer.observe(
          this.container.querySelector('.muze-solid-notebook-block-tools')
        );
        return () => {
          observer.disconnect();
          target.removeEventListener('scroll', notify, true);
          target.removeEventListener('resize', notify);
          target.visualViewport?.removeEventListener('resize', notify);
          target.visualViewport?.removeEventListener('scroll', notify);
        };
      },
      action: 'muzeSolidNotebookPositionTools'
    }
  },
  commands: {
    muzeSolidNotebookBlockCommand(button, id) {
      if (this.runtime.busy) {
        return;
      }
      if (id === 'Dock') {
        this.runtime.toolsDocked = !this.runtime.toolsDocked;
        this.runtime.toolsRequested = false;
        this.runtime.toolsDismissed = '';
        const editor = this.runtime.editors.get(this.runtime.active);
        const range = editor?.getSelection();
        const focusTools =
          this.runtime.toolsDocked ||
          this.runtime.controller.hasSelection() ||
          range?.end > range?.start;
        this.runtime.toolsFocusRequested = focusTools;
        this.actions.muzeSolidNotebookRefreshTools();
        if (!focusTools) {
          editor?.focus(this.runtime.range?.end || 0);
        }
        return;
      }
      if (id === 'Close') {
        return this.actions.muzeSolidNotebookDismissTools();
      }
      const editor = this.runtime.editors.get(this.runtime.active);
      const definition =
        editor && this.api.muzeSolidNotebookToolbars[editor.getType()];
      const tool = definition?.tools.find((item) => item.id === id);
      if (!tool) {
        return;
      }
      const state = definition.state
        ? this.actions[definition.state](tool, editor, this.runtime.range)
        : {};
      if (state.disabled !== null && state.disabled !== undefined) {
        return;
      }
      return this.commands.call(tool.command, button, tool.value);
    }
  },
  actions: {
    muzeSolidNotebookInitializeTools() {
      this.runtime.documentTools =
        this.runtime.host.view.data.muzeSolidUiAppTools;
      this.runtime.toolsDocked = false;
      this.runtime.toolsRows = [];
      this.runtime.toolsContext = '';
      this.runtime.toolsDockControl = this.api.signal({
        id: 'Dock',
        command: 'block:Dock',
        icon: { href: '../assets/feather-icons.svg#layout' },
        attributes: {
          'data-muze-solid-action': 'muzeSolidNotebookBlockDock'
        }
      });
      this.api.effect(() => {
        this.data.muzeSolidNotebookBusy.disabled;
        this.actions.muzeSolidNotebookScheduleTools();
      });
    },
    muzeSolidNotebookScheduleTools() {
      cancelAnimationFrame(this.runtime.toolsFrame);
      this.runtime.toolsFrame = requestAnimationFrame(() =>
        this.actions.muzeSolidNotebookRefreshTools()
      );
    },
    muzeSolidNotebookToolsEvent(event) {
      const field = event.target.closest?.('.muze-solid-notebook-editor');
      const editing = field && this.container.contains(field);
      const button = event.target.closest?.('[data-muze-solid-action]');
      const tools = button?.dataset.muzeSolidAction.startsWith(
        'muzeSolidNotebookBlock'
      );
      if (event.type === 'pointerdown' && tools) {
        // Keep the editor's native selection while activating its controls.
        event.preventDefault();
      }
      if (event.type === 'focusin') {
        if (editing) {
          const id = field.closest('[data-block-id]').dataset.blockId;
          if (id !== this.runtime.active) {
            this.runtime.range = this.runtime.editors
              .get(id)
              ?.getSelection() || { start: 0, end: 0 };
          }
          this.runtime.active = id;
        }
        else if (!tools) {
          this.runtime.toolsRequested = false;
          this.runtime.toolsFocusRequested = false;
        }
      }
      if (
        event.type === 'keydown' &&
        !event.isComposing &&
        !this.runtime.editors.get(this.runtime.active)?.isComposing?.()
      ) {
        if (editing && event.ctrlKey && event.code === 'Space') {
          event.preventDefault();
          event.stopImmediatePropagation();
          const editor = this.runtime.editors.get(this.runtime.active);
          this.runtime.toolsRequested =
            this.runtime.active + '\n' + editor.getType();
          this.runtime.toolsDismissed = '';
          this.runtime.toolsFocusRequested = true;
        }
        else if (
          event.key === 'Escape' &&
          (tools ||
            (editing &&
              !this.runtime.toolsDocked &&
              this.runtime.toolsVisible))
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (editing && this.runtime.controller.hasSelection()) {
            this.runtime.controller.clearSelection();
            this.actions.muzeSolidNotebookStatus();
          }
          return this.actions.muzeSolidNotebookDismissTools();
        }
      }
      this.actions.muzeSolidNotebookScheduleTools();
    },
    muzeSolidNotebookDismissTools() {
      this.runtime.toolsRequested = false;
      this.runtime.toolsFocusRequested = false;
      this.runtime.toolsDismissed = this.runtime.toolsSelection || '';
      this.actions.muzeSolidNotebookRefreshTools();
      const editor = this.runtime.editors.get(this.runtime.active);
      const range = this.runtime.range;
      editor?.focus(range?.start || 0, range?.end || 0);
    },
    muzeSolidNotebookResetTools() {
      this.runtime.toolsRequested = false;
      this.runtime.toolsDismissed = '';
      this.runtime.toolsFocusRequested = false;
      this.runtime.toolsContext = null;
      this.actions.muzeSolidNotebookScheduleTools();
    },
    muzeSolidNotebookRefreshTools() {
      if (this.runtime.busy) {
        this.runtime.toolsFocusRequested = false;
      }
      const focused = document.activeElement?.closest(
        '.muze-solid-notebook-editor'
      );
      if (focused && this.container.contains(focused)) {
        this.runtime.active =
          focused.closest('[data-block-id]').dataset.blockId;
      }
      const editor = this.runtime.editors?.get(this.runtime.active);
      const definition =
        editor && this.api.muzeSolidNotebookToolbars[editor.getType()];
      const context =
        editor && definition
          ? this.runtime.active + '\n' + editor.getType()
          : '';
      const changed = context !== this.runtime.toolsContext;
      if (changed) {
        this.runtime.toolsContext = context;
        if (this.runtime.toolsRequested !== context) {
          this.runtime.toolsRequested = false;
          this.runtime.toolsFocusRequested = false;
        }
        this.runtime.toolsDismissed = '';
        this.runtime.toolsRows = this.api.signal(
          definition
            ? definition.tools.map((tool) => ({
                id: tool.id,
                command: 'block:' + tool.id,
                label: tool.label,
                icon: { href: '../assets/feather-icons.svg#' + tool.icon },
                attributes: {
                  'aria-label': tool.label,
                  title: tool.label,
                  'data-muze-solid-action': 'muzeSolidNotebookBlock' + tool.id
                }
              }))
            : []
        );
      }
      const range = editor?.getSelection();
      if (range) {
        this.runtime.range = range;
      }
      const selection = this.runtime.controller?.getSelection();
      const selected =
        this.runtime.controller?.hasSelection() || range?.end > range?.start;
      const signature = selected
        ? context +
          '\n' +
          JSON.stringify(
            this.runtime.controller.hasSelection() ? selection : range
          )
        : '';
      this.runtime.toolsSelection = signature;
      if (!selected) {
        this.runtime.toolsDismissed = '';
      }
      for (const row of this.runtime.toolsRows) {
        const tool = definition.tools.find((item) => item.id === row.id);
        Object.assign(
          row.attributes,
          definition.state
            ? this.actions[definition.state](tool, editor, this.runtime.range)
            : {}
        );
        if (this.runtime.busy || editor.isComposing?.()) {
          row.attributes.disabled = '';
        }
      }
      const docked = Boolean(this.runtime.toolsDocked);
      const dock = this.runtime.toolsDockControl;
      dock.label = docked ? 'Float' : 'Dock';
      Object.assign(dock.attributes, {
        title: docked ? 'Float block toolbar' : 'Dock block toolbar',
        'aria-label': docked ? 'Float block toolbar' : 'Dock block toolbar',
        disabled: this.runtime.busy ? '' : null
      });
      if (changed || docked !== this.runtime.toolsWasDocked) {
        this.runtime.toolsWasDocked = docked;
        this.runtime.host.view.data.muzeSolidUiAppTools = [
          ...this.runtime.documentTools,
          ...(docked && definition
            ? [
                ...this.runtime.toolsRows.map((row) => ({ ...row, label: '' })),
                dock
              ]
            : [])
        ];
        this.data.muzeSolidNotebookBlockTools = definition
          ? [
              ...this.runtime.toolsRows,
              dock,
              {
                id: 'Close',
                label: 'Close',
                icon: { href: '../assets/feather-icons.svg#x' },
                attributes: {
                  'aria-label': 'Close block toolbar',
                  'data-muze-solid-action': 'muzeSolidNotebookBlockClose'
                }
              }
            ]
          : [];
      }
      const active = document.activeElement;
      const inEditor = editor?.element.contains(active);
      const inTools = active?.dataset?.muzeSolidAction?.startsWith(
        'muzeSolidNotebookBlock'
      );
      const visible =
        definition &&
        !docked &&
        !this.runtime.busy &&
        !editor.isComposing?.() &&
        !this.runtime.notebookPointer &&
        (inEditor || inTools) &&
        ((selected && signature !== this.runtime.toolsDismissed) ||
          this.runtime.toolsRequested);
      this.runtime.toolsVisible = Boolean(visible);
      this.data.muzeSolidNotebookBlockToolbar = {
        ...this.data.muzeSolidNotebookBlockToolbar,
        style: visible
          ? this.data.muzeSolidNotebookBlockToolbar.style
          : 'visibility:hidden;',
        inert: visible ? null : '',
        'aria-hidden': visible ? null : 'true',
        'aria-label': definition?.label || 'Block tools',
        'data-muze-solid-notebook-tool-block': this.runtime.active || ''
      };
      this.actions.muzeSolidNotebookPositionTools();
    },
    muzeSolidNotebookPositionTools() {
      const toolbar = this.container.querySelector(
        '.muze-solid-notebook-block-tools'
      );
      const editor = this.runtime.editors?.get(this.runtime.active);
      if (!editor) {
        return;
      }
      if (this.runtime.toolsVisible) {
        const selection = document.getSelection();
        const range = editor.getSelection();
        const anchor =
          range &&
          selection.rangeCount &&
          editor.element.contains(selection.anchorNode)
            ? selection.getRangeAt(0).getBoundingClientRect()
            : editor.getCaretClientRect(this.runtime.range?.end || 0) ||
              editor.getClientRect();
        const viewport = window.visualViewport;
        const width = Math.max(0, (viewport?.width || innerWidth) - 16);
        const height = Math.max(0, (viewport?.height || innerHeight) - 16);
        this.data.muzeSolidNotebookBlockToolbar.style =
          'visibility:visible;max-inline-size:' +
          width +
          'px;max-block-size:' +
          height +
          'px;' +
          this.actions.muzeSolidDesignToolbarPlacement(toolbar, anchor);
      }
      if (this.runtime.toolsFocusRequested) {
        const root = this.runtime.toolsDocked
          ? this.runtime.host.view.container
          : toolbar;
        const button = root.querySelector(
          '[data-muze-solid-action^="muzeSolidNotebookBlock"]:not(:disabled)'
        );
        if (
          button?.checkVisibility({ visibilityProperty: true }) &&
          !button.closest('[inert]')
        ) {
          button.focus();
          this.runtime.toolsFocusRequested = false;
        }
        else {
          this.runtime.toolsFrame = requestAnimationFrame(() =>
            this.actions.muzeSolidNotebookPositionTools()
          );
        }
      }
    }
  }
};
