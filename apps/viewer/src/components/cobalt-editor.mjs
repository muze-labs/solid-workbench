import { render as renderCobalt } from '@muze-labs/cobalt-rich-text-note';
import { validateFragment } from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import template from '../cobalt-editor.html' with { type: 'text' };
import styles from './cobalt-editor.css' with { type: 'text' };
import { muzeSolidDesignToolbar } from '@muze-labs/solid-design';

export const muzeSolidCobaltEditor = {
  templates: { 'muze-solid-cobalt-editor': template },
  styles: { 'muze-solid-cobalt-editor': styles },
  components: { muzeSolidDesignToolbar },
  transformers: {
    muzeSolidCobaltRender(context, next) {
      context.value = {
        innerHTML: renderCobalt(
          validateFragment(context.value || { text: '', annotations: [] })
        )
      };
      return next(context);
    }
  },
  events: {
    muzeSolidCobaltSelection: {
      target() {
        return document;
      },
      type: 'selectionchange',
      action: 'muzeSolidCobaltSelection'
    },
    muzeSolidCobaltViewport: {
      subscribe(notify) {
        window.addEventListener('resize', notify);
        window.visualViewport?.addEventListener('resize', notify);
        window.visualViewport?.addEventListener('scroll', notify);
        return () => {
          window.removeEventListener('resize', notify);
          window.visualViewport?.removeEventListener('resize', notify);
          window.visualViewport?.removeEventListener('scroll', notify);
        };
      },
      action: 'muzeSolidCobaltPosition'
    },
    muzeSolidCobaltGuard: {
      subscribe(notify) {
        for (const type of ['keydown', 'paste', 'pointerdown', 'click']) {
          this.container.addEventListener(type, notify, true);
        }
        return () => {
          for (const type of ['keydown', 'paste', 'pointerdown', 'click']) {
            this.container.removeEventListener(type, notify, true);
          }
        };
      },
      action: 'muzeSolidCobaltGuard'
    }
  },
  commands: {
    muzeSolidCobaltTools() {
      this.runtime.cobaltToolsRequested = true;
      this.runtime.cobaltDismissedRange = '';
      this.actions.muzeSolidCobaltSelection();
    },
    muzeSolidCobaltFormat(_element, command) {
      const editor = this.runtime.cobaltEditor;
      const range = this.runtime.cobaltRange;
      if (!range || range.start === range.end) {
        this.data.muzeSolidCobaltStatus = 'Select text to format it.';
        return;
      }
      editor.focus(range.start, range.end);
      editor.applyCommand(
        command,
        range,
        !editor.getCommandState(command, range.start)
      );
      this.actions.muzeSolidCobaltSelection();
    },
    muzeSolidCobaltDock() {
      this.runtime.cobaltDocked = !this.runtime.cobaltDocked;
      this.runtime.cobaltToolsRequested = true;
      this.data.muzeSolidCobaltDockLabel = this.runtime.cobaltDocked
        ? 'Float'
        : 'Dock';
      this.actions.muzeSolidCobaltPosition();
    },
    muzeSolidCobaltLink() {
      this.actions.muzeSolidCobaltLink();
    },
    muzeSolidCobaltApplyLink(form) {
      try {
        const href = new URL(form.elements.href.value).href;
        const range = this.runtime.cobaltRange;
        const tag = this.api.createLinkAnnotationTag(href);
        this.api.validateFragment({
          text: this.runtime.cobaltEditor.getText(),
          annotations: [{ range: [range.start, range.end], tag, order: 0 }]
        });
        this.runtime.cobaltEditor.focus(range.start, range.end);
        this.runtime.cobaltEditor.applyCommand('link', range, href);
        this.data.muzeSolidCobaltLinkPanel = { hidden: '' };
        this.data.muzeSolidCobaltStatus = '';
      } catch (error) {
        this.data.muzeSolidCobaltStatus = error.message;
      }
    },
    muzeSolidCobaltUnlink() {
      const editor = this.runtime.cobaltEditor;
      const range = this.runtime.cobaltRange;
      if (range?.end > range?.start) {
        const fragment = editor.getValue();
        fragment.annotations.push({
          range: [range.start, range.end],
          tag: '</a>',
          order: Math.max(0, ...fragment.annotations.map((a) => a.order)) + 1
        });
        editor.setValue(fragment);
        editor.focus(range.start, range.end);
      }
      this.data.muzeSolidCobaltLinkPanel = { hidden: '' };
    }
  },
  actions: {
    async muzeSolidCobaltOpen(input, requester) {
      this.actions.muzeSolidCobaltPresentation(input.presentation);
      const fragment = this.api.validateFragment(input.fragment);
      this.runtime.cobaltActive = true;
      this.runtime.cobaltFrozen = false;
      this.runtime.viewGeneration = input.generation;
      this.runtime.cobaltInput = input;
      this.runtime.cobaltParentOrigin =
        requester?.origin || this.runtime.host.managed.resume.origin;
      this.runtime.cobaltRevision = 0;
      this.runtime.cobaltAcknowledged = 0;
      this.runtime.cobaltPending = Promise.resolve();
      this.runtime.cobaltReadOnly =
        input.presentation.interaction === 'passive';
      this.runtime.cobaltSource = this.api.local.indexedDB(
        'solid-viewer-cobalt-drafts',
        {
          key: [
            this.runtime.host.selectedWebId || '',
            requester?.origin || location.origin,
            input.id
          ].join('\n')
        }
      );
      const saved = this.runtime.cobaltReadOnly
        ? ''
        : await this.runtime.cobaltSource.load();
      const graph = new this.api.StateGraph(saved || '');
      const recovered = saved
        ? this.api.readFragment(graph, input.id)
        : fragment;
      this.runtime.cobaltGraph = graph;
      this.runtime.cobaltEditor?.destroy();
      if (this.runtime.cobaltEffect) {
        this.api.destroy(this.runtime.cobaltEffect);
      }
      this.data.muzeSolidViewerDisplay = { hidden: '' };
      this.data.muzeSolidCobaltVisibility = {
        hidden: null,
        'data-readonly': this.runtime.cobaltReadOnly ? '' : null
      };
      this.data.muzeSolidCobaltFragment = recovered;
      const surface = this.container.querySelector('.muze-solid-cobalt-edit');
      const state = this.api.signal(this.api.validateFragment(recovered));
      this.runtime.cobaltEditor = this.api.editCobalt(surface, state);
      surface.inert = this.runtime.cobaltReadOnly;
      this.runtime.cobaltLastValue = JSON.stringify(fragment);
      // The published Cobalt API edits this reactive fragment directly. Defer
      // observation until an operation has updated both text and all ranges.
      this.runtime.cobaltEffect = this.api.effect(() => {
        JSON.stringify(state);
        if (!this.runtime.cobaltChangeQueued) {
          this.runtime.cobaltChangeQueued = true;
          queueMicrotask(() => {
            this.runtime.cobaltChangeQueued = false;
            this.actions.muzeSolidCobaltChanged();
          });
        }
      });
      await this.actions.muzeSolidCobaltFit();
      return {
        version: 1,
        generation: input.generation,
        ready: true,
        presentation: input.presentation.interaction + '-bounded',
        editable: true
      };
    },
    muzeSolidCobaltChanged() {
      if (!this.runtime.cobaltActive || this.runtime.cobaltReadOnly) {
        return;
      }
      try {
        const value = this.api.validateFragment(
          this.runtime.cobaltEditor.getValue()
        );
        const key = JSON.stringify(value);
        if (key === this.runtime.cobaltLastValue) {
          return;
        }
        this.runtime.cobaltLastValue = key;
        this.runtime.cobaltRevision += 1;
        this.data.muzeSolidCobaltFragment = value;
        this.api.writeFragment(
          this.runtime.cobaltGraph,
          this.runtime.cobaltInput.id,
          value
        );
        const turtle = this.runtime.cobaltGraph.write();
        this.runtime.cobaltPending = this.runtime.cobaltPending
          .catch(() => {})
          .then(() => this.runtime.cobaltSource.save(turtle));
        this.runtime.cobaltPending
          .then(() => {
            this.data.muzeSolidCobaltStatus = '';
            window.parent.postMessage(
              {
                type: 'solid-apps:text-changed',
                generation: this.runtime.viewGeneration
              },
              this.runtime.cobaltParentOrigin
            );
          })
          .catch((error) => {
            this.data.muzeSolidCobaltStatus = error.message;
          });
      } catch (error) {
        this.data.muzeSolidCobaltStatus = error.message;
      }
    },
    async muzeSolidCobaltOperation(input) {
      if (input.generation !== this.runtime.viewGeneration) {
        throw new Error('viewer: Retired text editor.');
      }
      const composing = this.runtime.cobaltEditor.isComposing();
      if (composing && ['read', 'update'].includes(input.operation)) {
        throw new Error(
          'viewer: Finish composing text before leaving this slide.'
        );
      }
      if (input.operation === 'prepare' && composing) {
        return {
          allowed: false,
          frozen: false,
          message: 'Finish composing text before leaving this slide.'
        };
      }
      if (input.operation === 'read') {
        this.actions.muzeSolidCobaltChanged();
        await this.runtime.cobaltPending.catch(async () => {
          this.runtime.cobaltPending = this.runtime.cobaltSource.save(
            this.runtime.cobaltGraph.write()
          );
          await this.runtime.cobaltPending;
        });
        if (this.runtime.cobaltEditor.isComposing()) {
          throw new Error(
            'viewer: Finish composing text before leaving this slide.'
          );
        }
        return {
          id: this.runtime.cobaltInput.id,
          revision: this.runtime.cobaltRevision,
          fragment: this.api.validateFragment(
            this.runtime.cobaltEditor.getValue()
          )
        };
      }
      if (input.operation === 'acknowledge') {
        if (
          !Number.isSafeInteger(input.revision) ||
          input.revision < 0 ||
          input.revision > this.runtime.cobaltRevision
        ) {
          throw new Error('viewer: Invalid saved text revision.');
        }
        if (input.revision === this.runtime.cobaltRevision) {
          // Presenter has durably stored this revision. Retiring its recovery
          // copy prevents an old provider draft replacing a later Pod edit.
          this.runtime.cobaltPending = this.runtime.cobaltPending
            .catch(() => {})
            .then(() => this.runtime.cobaltSource.save(''));
          await this.runtime.cobaltPending;
        }
        this.runtime.cobaltAcknowledged = Math.max(
          this.runtime.cobaltAcknowledged,
          Math.min(input.revision, this.runtime.cobaltRevision)
        );
        return { saved: true };
      }
      if (input.operation === 'prepare') {
        this.actions.muzeSolidCobaltChanged();
        await this.runtime.cobaltPending;
        const allowed =
          !this.runtime.cobaltEditor.isComposing() &&
          this.runtime.cobaltRevision === this.runtime.cobaltAcknowledged;
        if (allowed) {
          this.runtime.cobaltReadOnly = true;
          this.runtime.cobaltFrozen = true;
          this.runtime.cobaltEditor.element.inert = true;
          this.runtime.cobaltEditor.destroy();
        }
        return {
          allowed,
          frozen: allowed,
          message: 'Keep this editor open until its text is saved to the deck.'
        };
      }
      if (input.operation === 'update') {
        if (this.runtime.cobaltFrozen) {
          throw new Error('viewer: This editor is prepared for removal.');
        }
        this.actions.muzeSolidCobaltPresentation(input.presentation);
        this.runtime.cobaltReadOnly =
          input.presentation.interaction === 'passive';
        this.runtime.cobaltEditor.element.inert = this.runtime.cobaltReadOnly;
        if (this.runtime.cobaltReadOnly) {
          // Release the editable selection before the host takes focus for
          // read-only presentation.
          this.runtime.cobaltEditor.element.blur();
          window.getSelection()?.removeAllRanges();
        }
        this.data.muzeSolidCobaltVisibility = {
          hidden: null,
          'data-readonly': this.runtime.cobaltReadOnly ? '' : null
        };
        this.actions.muzeSolidCobaltPosition();
        await this.actions.muzeSolidCobaltFit();
        return { updated: true };
      }
      throw new Error('viewer: Unsupported text editor operation.');
    },
    muzeSolidCobaltPresentation(value) {
      const presentation = this.api.viewPresentation(value);
      if (
        presentation.geometry !== 'bounded' ||
        presentation.fit !== 'contain'
      ) {
        throw new Error(
          'viewer: Slide text requires bounded contain presentation.'
        );
      }
    },
    async muzeSolidCobaltFit() {
      if (!this.runtime.cobaltReadOnly) {
        return;
      }
      const surface = this.container.querySelector('.muze-solid-cobalt-read');
      // Binding the new text and revealing its read-only surface are deferred.
      // Measuring a still-hidden surface reports zero height and misses overflow.
      await new Promise((resolve, reject) => {
        const finish = (error) => {
          clearTimeout(timer);
          observer.disconnect();
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };
        const check = () => {
          if (!this.runtime.cobaltReadOnly) {
            finish();
            return;
          }
          const sentinel = surface.querySelector('[data-cobalt-sentinel]');
          const expected =
            this.data.muzeSolidCobaltFragment.text +
            (sentinel?.textContent || '');
          if (!surface.checkVisibility() || surface.textContent !== expected) {
            return;
          }
          const overflows =
            surface.scrollHeight > surface.clientHeight + 1 ||
            surface.scrollWidth > surface.clientWidth + 1;
          finish(
            overflows
              ? new Error(
                  'viewer: This text does not fit the slide. Shorten it before presenting.'
                )
              : null
          );
        };
        const observer = new MutationObserver(check);
        observer.observe(this.container, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true
        });
        const timer = setTimeout(
          () =>
            finish(
              new Error('viewer: The slide text did not finish rendering.')
            ),
          3000
        );
        check();
      });
    },
    muzeSolidCobaltSelection() {
      const editor = this.runtime.cobaltEditor;
      if (!editor || this.runtime.cobaltReadOnly) {
        return;
      }
      const range = editor.getSelection();
      if (range) {
        this.runtime.cobaltRange = range;
      }
      const selected = this.runtime.cobaltRange;
      const rangeKey = range ? range.start + ':' + range.end : '';
      const dismissed =
        rangeKey && rangeKey === this.runtime.cobaltDismissedRange;
      const visible =
        !dismissed &&
        (this.runtime.cobaltDocked ||
          this.runtime.cobaltToolsRequested ||
          (range && range.end > range.start));
      this.data.muzeSolidCobaltTools = {
        ...this.data.muzeSolidCobaltTools,
        hidden: visible ? null : ''
      };
      this.data.muzeSolidCobaltBold = {
        'aria-pressed': String(
          Boolean(selected && editor.getCommandState('strong', selected.start))
        )
      };
      this.data.muzeSolidCobaltItalic = {
        'aria-pressed': String(
          Boolean(selected && editor.getCommandState('em', selected.start))
        )
      };
      this.actions.muzeSolidCobaltPosition();
    },
    muzeSolidCobaltPosition() {
      if (!this.runtime.cobaltEditor) {
        return;
      }
      const toolbar = this.container.querySelector('.muze-solid-cobalt-tools');
      const selection = window.getSelection();
      const range = this.runtime.cobaltEditor.getSelection();
      const anchor =
        range && selection.rangeCount
          ? selection.getRangeAt(0).getBoundingClientRect()
          : this.runtime.cobaltEditor.element.getBoundingClientRect();
      this.data.muzeSolidCobaltTools = {
        ...this.data.muzeSolidCobaltTools,
        'data-docked': this.runtime.cobaltDocked ? '' : null,
        style: this.runtime.cobaltDocked
          ? ''
          : this.actions.muzeSolidDesignToolbarPlacement(toolbar, anchor)
      };
    },
    muzeSolidCobaltLink() {
      const range = this.runtime.cobaltRange;
      if (!range || range.start === range.end) {
        this.data.muzeSolidCobaltStatus = 'Select the text to link.';
        return;
      }
      this.runtime.cobaltToolsRequested = true;
      this.data.muzeSolidCobaltTools = {
        ...this.data.muzeSolidCobaltTools,
        hidden: null
      };
      this.data.muzeSolidCobaltLinkPanel = { hidden: null };
      const focusLink = () => {
        if (this.data.muzeSolidCobaltLinkPanel.hidden !== null) {
          return;
        }
        const input = this.container.querySelector(
          '.muze-solid-cobalt-link input'
        );
        if (!input.checkVisibility()) {
          requestAnimationFrame(focusLink);
          return;
        }
        this.actions.muzeSolidCobaltPosition();
        input.focus();
      };
      requestAnimationFrame(focusLink);
    },
    muzeSolidCobaltGuard(event) {
      if (!this.runtime.cobaltActive) {
        return;
      }
      const editing = event.target.closest('.muze-solid-cobalt-edit');
      if (event.type === 'click' && editing && event.target.closest('a')) {
        event.preventDefault();
      }
      if (
        event.type === 'pointerdown' &&
        event.target.closest('.muze-solid-cobalt-tools button')
      ) {
        event.preventDefault();
      }
      if (event.type === 'paste' && editing) {
        try {
          const fragment = this.api.validateFragment(
            this.api.readFragmentFromClipboard(event.clipboardData)
          );
          if (!fragment.text) {
            throw new Error('viewer: Clipboard contains no supported text.');
          }
        } catch (error) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.data.muzeSolidCobaltStatus = error.message;
        }
      }
      if (
        event.type !== 'keydown' ||
        event.isComposing ||
        this.runtime.cobaltEditor.isComposing()
      ) {
        return;
      }
      if (
        event.key === 'Escape' &&
        this.data.muzeSolidCobaltTools.hidden === null
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.runtime.cobaltToolsRequested = false;
        const selected = this.runtime.cobaltRange;
        this.runtime.cobaltDismissedRange = selected
          ? selected.start + ':' + selected.end
          : '';
        this.runtime.cobaltDocked = false;
        this.data.muzeSolidCobaltDockLabel = 'Dock';
        this.data.muzeSolidCobaltTools = { hidden: '' };
        this.data.muzeSolidCobaltLinkPanel = { hidden: '' };
        const range = this.runtime.cobaltRange;
        this.runtime.cobaltEditor.focus(range?.start || 0, range?.end || 0);
      } else if (
        editing &&
        event.ctrlKey &&
        [' ', 'k'].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.runtime.cobaltToolsRequested = true;
        this.runtime.cobaltDismissedRange = '';
        if (event.key.toLowerCase() === 'k') {
          this.actions.muzeSolidCobaltLink();
        } else {
          this.actions.muzeSolidCobaltSelection();
        }
      }
    }
  }
};
