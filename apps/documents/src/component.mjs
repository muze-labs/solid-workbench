import DOMPurify from 'dompurify';
import template from './documents.html' with { type: 'text' };
import styles from './documents.css' with { type: 'text' };

const viewCapability = 'https://vocab.muze.nl/capabilities/view-resource';
const editCapability = 'https://vocab.muze.nl/capabilities/edit-note-body';

export const muzeDocuments = {
  templates: { 'muze-documents': template },
  styles: { 'muze-documents': styles },
  transformers: {
    muzeDocumentsHtml(context, next) {
      context.value = {
        innerHTML: DOMPurify.sanitize(context.value, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: [
            'img',
            'video',
            'audio',
            'iframe',
            'form',
            'input',
            'style'
          ],
          FORBID_ATTR: ['style', 'src', 'srcset']
        })
      };
      return next(context);
    }
  },
  behaviors: {
    muzeDocumentsAnnotationDialog(dialog) {
      const cancel = (event) => {
        event.preventDefault();
        this.commands.muzeDocumentsCloseNote.call(this);
      };
      dialog.addEventListener('cancel', cancel);
      return () => dialog.removeEventListener('cancel', cancel);
    }
  },
  events: {
    muzeDocumentsNoteCards: {
      subscribe(notify) {
        const list = this.container.querySelector('.muze-documents-note-list');
        const observer = new MutationObserver(notify);
        observer.observe(list, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-note-key', 'data-active']
        });
        return () => observer.disconnect();
      },
      action: 'muzeDocumentsRevealNotes'
    },
    muzeDocumentsCardClick: {
      target() {
        return this.container.querySelector('.muze-documents-notes');
      },
      type: 'click',
      action: 'muzeDocumentsCardClick'
    },
    muzeDocumentsThumbnailsScroll: {
      target() {
        return this.container.querySelector('.muze-documents-thumbnails');
      },
      type: 'scroll',
      action: 'muzeDocumentsRenderThumbnails'
    },
    muzeDocumentsParagraphPointer: {
      subscribe(notify) {
        const surface = this.container.querySelector(
          '.muze-documents-paper-scroll'
        );
        surface.addEventListener('pointermove', notify);
        surface.addEventListener('pointerup', notify);
        surface.addEventListener('pointerleave', notify);
        return () => {
          surface.removeEventListener('pointermove', notify);
          surface.removeEventListener('pointerup', notify);
          surface.removeEventListener('pointerleave', notify);
        };
      },
      action: 'muzeDocumentsParagraphPointer'
    },
    muzeDocumentsNoteSelection: {
      target() {
        return document;
      },
      type: 'selectionchange',
      action: 'muzeDocumentsNoteSelection'
    },
    muzeDocumentsNoteViewport: {
      subscribe(notify) {
        window.addEventListener('resize', notify);
        window.visualViewport?.addEventListener('resize', notify);
        this.container.addEventListener('scroll', notify, true);
        return () => {
          window.removeEventListener('resize', notify);
          window.visualViewport?.removeEventListener('resize', notify);
          this.container.removeEventListener('scroll', notify, true);
        };
      },
      action: 'muzeDocumentsNotePosition'
    },
    muzeDocumentsNoteGuard: {
      subscribe(notify) {
        for (const type of ['keydown', 'pointerdown', 'click']) {
          this.container.addEventListener(type, notify, true);
        }
        return () => {
          for (const type of ['keydown', 'pointerdown', 'click']) {
            this.container.removeEventListener(type, notify, true);
          }
        };
      },
      action: 'muzeDocumentsNoteGuard'
    },
    muzeDocumentsReaderPageHide: {
      target() {
        return window;
      },
      type: 'pagehide',
      action: 'muzeDocumentsFlushReader'
    },
    muzeDocumentsReaderScroll: {
      target() {
        return this.container.querySelector('.muze-documents-paper-scroll');
      },
      type: 'scroll',
      action: 'muzeDocumentsScroll'
    },
    muzeDocumentsFiles: {
      target() {
        return this.container;
      },
      type: 'change',
      action: 'muzeDocumentsChange'
    },
    muzeDocumentsEditorInput: {
      target() {
        return this.container;
      },
      type: 'cobalt:change',
      action: 'muzeDocumentsEditorChanged'
    }
  },
  commands: {
    muzeDocumentsDialog(_button, name) {
      const dialog = this.container.querySelector(
        '[data-document-dialog="' + name + '"]'
      );
      return this.actions.muzeSolidDesignOpenDialog(dialog);
    },
    async muzeDocumentsNotes() {
      if (
        matchMedia('(max-width: 719px)').matches &&
        this.data.muzeDocumentsNotesPanel.hidden !== null
      ) {
        this.actions.muzeDocumentsHideSidebars();
      }
      const hidden = this.data.muzeDocumentsNotesPanel.hidden === null;
      this.data.muzeDocumentsNotesPanel.hidden = hidden ? '' : null;
      if (!hidden) {
        this.actions.muzeDocumentsActivateNotes(
          this.runtime.activeNoteKeys || []
        );
      }
      if (hidden) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        this.container
          .querySelector(
            (matchMedia('(max-width: 719px)').matches
              ? '.muze-documents-panel-handles '
              : '.muze-documents-tools ') +
              '[data-simply-command="muzeDocumentsNotes"]'
          )
          ?.focus();
      }
      await this.runtime.host.run(() =>
        this.runtime.readerState.save({
          settings: { annotationsOpen: !hidden }
        })
      );
    },
    muzeDocumentsOpen(form) {
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsLoad(form.elements.url.value)
      );
    },
    muzeDocumentsCancel() {
      this.runtime.loading?.abort();
    },
    muzeDocumentsPage(_button, direction) {
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsShow(this.runtime.page + Number(direction))
      );
    },
    muzeDocumentsZoom(_button, amount) {
      const position = this.actions.muzeDocumentsCapturePosition();
      this.runtime.zoom = Math.min(
        3,
        Math.max(0.5, this.runtime.zoom + Number(amount))
      );
      return this.runtime.host.run(async () => {
        await this.runtime.readerState.save({
          settings: { zoom: this.runtime.zoom }
        });
        await this.actions.muzeDocumentsShow(
          this.runtime.page,
          position?.fraction || 0
        );
      });
    },
    muzeDocumentsRotate() {
      this.runtime.rotation = (this.runtime.rotation + 90) % 360;
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsShow(this.runtime.page)
      );
    },
    muzeDocumentsFind(form) {
      return this.runtime.host.run(async () => {
        if (!this.runtime.pdf) {
          return;
        }
        const page = await this.runtime.pdf.find(
          form.elements.query.value,
          this.runtime.page
        );
        if (page) {
          await this.actions.muzeDocumentsShow(page);
          await this.actions.muzeSolidDesignCloseDialog(form.closest('dialog'));
        }
        else {
          this.data.muzeDocumentsStatus =
            'Text not found. Scanned pages may have no text.';
        }
      });
    },
    muzeDocumentsDownload() {
      if (this.runtime.bytes) {
        this.actions.muzeDocumentsDownloadBlob(
          new Blob([this.runtime.bytes], { type: 'application/pdf' }),
          'document.pdf'
        );
      }
    },
    muzeDocumentsNewGroup(form) {
      return this.runtime.host.run(async () => {
        if (!this.runtime.document) {
          throw new Error('documents: Open a PDF before creating a group.');
        }
        const group = new this.api.AnnotationGroup();
        group.rename(form.elements.name.value);
        group.graph.set(
          group.root,
          this.api.doc + 'document',
          this.api.named(this.runtime.document)
        );
        this.runtime.groups.set(group.root.id, group);
        this.runtime.group = group;
        await this.actions.muzeDocumentsPersist();
        this.actions.muzeDocumentsRefresh();
        form.reset();
      });
    },
    muzeDocumentsPageNote() {
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsAddNote({ page: this.runtime.page })
      );
    },
    async muzeDocumentsChooseDestination(form) {
      const group = this.runtime.groups.get(form.elements.destination.value);
      if (!group || (group.external && !group.allowWriting)) {
        return;
      }
      const anchor = this.runtime.pendingAnchor;
      this.runtime.pendingAnchor = null;
      this.runtime.group = group;
      await this.actions.muzeSolidDesignCloseDialog(form.closest('dialog'));
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsAddNote(anchor, true)
      );
    },
    muzeDocumentsInlineParagraph(_button, key) {
      const marker = this.runtime.paragraphMarkers?.find(
        (item) => item.key === key
      );
      if (marker) {
        return this.runtime.host.run(() =>
          this.actions.muzeDocumentsAddNote({
            page: marker.page,
            paragraph: marker.paragraph
          })
        );
      }
    },
    muzeDocumentsEnableWriting(_button, id) {
      return this.runtime.host.run(async () => {
        const group = this.runtime.groups.get(id);
        group.allowWriting = !group.allowWriting;
        await this.actions.muzeDocumentsPersist(group);
        this.actions.muzeDocumentsRefresh();
      });
    },
    muzeDocumentsParagraphNote(_button, paragraph) {
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsAddNote({
          page: this.runtime.page,
          paragraph
        })
      );
    },
    async muzeDocumentsToggleThumbnails() {
      const open = this.data.muzeDocumentsThumbnailsPanel.hidden !== null;
      this.data.muzeDocumentsThumbnailsPanel.hidden = open ? null : '';
      this.data.muzeDocumentsThumbnailsToggle['aria-expanded'] = String(open);
      if (open) {
        if (matchMedia('(max-width: 719px)').matches) {
          this.data.muzeDocumentsNotesPanel.hidden = '';
        }
        this.data.muzeDocumentsOutlinePanel.hidden = '';
        this.data.muzeDocumentsOutlineToggle['aria-expanded'] = 'false';
        this.actions.muzeDocumentsThumbnailRows();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return this.runtime.host.run(() =>
          this.actions.muzeDocumentsRenderThumbnails()
        );
      }
      this.runtime.pdf?.retainThumbnails();
    },
    muzeDocumentsToggleOutline() {
      const expanded = this.data.muzeDocumentsOutlinePanel.hidden !== null;
      if (expanded) {
        if (matchMedia('(max-width: 719px)').matches) {
          this.data.muzeDocumentsNotesPanel.hidden = '';
        }
        this.data.muzeDocumentsThumbnailsPanel.hidden = '';
        this.data.muzeDocumentsThumbnailsToggle['aria-expanded'] = 'false';
        this.runtime.pdf?.retainThumbnails();
      }
      this.data.muzeDocumentsOutlinePanel.hidden = expanded ? null : '';
      this.data.muzeDocumentsOutlineToggle['aria-expanded'] = String(expanded);
      return this.runtime.host.run(() =>
        this.runtime.readerState.save({
          settings: { outlineOpen: expanded }
        })
      );
    },
    muzeDocumentsOutline(_button, page) {
      return this.runtime.host.run(async () => {
        await this.actions.muzeDocumentsShow(Number(page));
        if (matchMedia('(max-width: 719px)').matches) {
          this.actions.muzeDocumentsHideSidebars();
        }
      });
    },
    muzeDocumentsSelectionNote() {
      const selection = this.runtime.pdf?.selection();
      if (!selection) {
        this.data.muzeDocumentsStatus =
          'Select PDF text first, or use Note on page.';
        return;
      }
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsAddNote(selection)
      );
    },
    muzeDocumentsEditNote(_button, key) {
      const item = this.runtime.notes.state.data.find(
        (note) => note.key === key
      );
      const group = item
        ? this.runtime.groups.get(item.groupId)
        : this.runtime.group;
      if (!group || (group.external && !group.allowWriting)) {
        return;
      }
      this.runtime.group = group;
      const id = item?.id || key;
      this.runtime.newNote = false;
      return this.runtime.host.run(() => this.actions.muzeDocumentsEdit(id));
    },
    muzeDocumentsAnnotationScope() {
      const all = this.runtime.notes.state.options.scope !== 'all';
      this.runtime.notes.state.options.scope = all ? 'all' : 'visible';
      this.data.muzeDocumentsAnnotationScope['aria-pressed'] = String(all);
      this.actions.muzeDocumentsRefresh();
    },
    muzeDocumentsSearchAnnotations(input) {
      this.runtime.notes.state.options.search = input.value
        .trim()
        .toLowerCase();
    },
    muzeDocumentsGoNote(_button, id) {
      return this.runtime.host.run(async () => {
        const note = this.runtime.notes.state.data.find(
          (item) => item.key === id || item.id === id
        );
        if (!note) {
          return;
        }
        if (note.digest !== this.runtime.digest) {
          this.data.muzeDocumentsStatus =
            'This annotation belongs to a different PDF revision. Its original anchor is retained.';
          return;
        }
        await this.actions.muzeDocumentsShow(note.page);
        if (matchMedia('(max-width: 719px)').matches) {
          this.actions.muzeDocumentsHideSidebars();
        }
        this.container.querySelector('.muze-documents-paper-scroll')?.focus();
        this.actions.muzeDocumentsActivateNotes([note.key]);
        const paragraph = this.runtime.pdf.paragraphs.find(
          (entry) => entry.id === note.paragraph
        );
        if (paragraph) {
          this.runtime.pdf.layer
            .querySelector('#' + CSS.escape(paragraph.ids[0]))
            ?.scrollIntoView({ block: 'nearest' });
        }
      });
    },
    muzeDocumentsExport() {
      if (this.runtime.group) {
        this.actions.muzeDocumentsDownloadBlob(
          new Blob([this.runtime.group.write()], { type: 'text/turtle' }),
          'annotations.ttl'
        );
      }
    },
    muzeDocumentsOpenGroup(form) {
      return this.runtime.host.run(async () => {
        const address = form.elements.url.value;
        const session = this.runtime.host.session || {
          client: this.api.createSolidMetroClient(address, {
            oidc: false,
            oldm: false
          }),
          perform: (operation) => operation(),
          webId: ''
        };
        const group = await this.api.openGroup(session, address);
        const source = group.graph.one(
          group.root,
          this.api.doc + 'document',
          'iri',
          true
        );
        if (source.id !== this.runtime.document) {
          throw new Error('documents: This group belongs to another PDF URI.');
        }
        if (
          this.runtime.editing ||
          this.runtime.saving ||
          this.runtime.persistFailed
        ) {
          throw new Error(
            'documents: Finish or preserve the current edit first.'
          );
        }
        await this.actions.muzeDocumentsAttachGroup(group);
      });
    },
    muzeDocumentsSave() {
      const group = this.runtime.group;
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsSaveGroup(group)
      );
    },
    muzeDocumentsPublish(form) {
      const group = this.runtime.group;
      const folder = form.elements.folder.value;
      return this.runtime.host.run(() =>
        this.actions.muzeDocumentsSaveGroup(group, folder)
      );
    },
    muzeDocumentsFormat(_button, command) {
      const editor = this.runtime.noteEditor?.editor;
      const range = this.runtime.noteRange;
      if (editor && range && range.end > range.start) {
        editor.focus(range.start, range.end);
        editor.applyCommand(
          command,
          range,
          !editor.getCommandState(command, range.start)
        );
        this.actions.muzeDocumentsNoteSelection();
      }
    },
    async muzeDocumentsSaveNote() {
      if (this.runtime.finishingNote) {
        return;
      }
      this.runtime.finishingNote = true;
      try {
        await this.actions.muzeDocumentsFinishNote(true);
      }
      catch (error) {
        this.data.muzeDocumentsEditorStatus = error.message;
      }
      finally {
        this.runtime.finishingNote = false;
      }
    },
    async muzeDocumentsCloseNote() {
      if (this.runtime.finishingNote) {
        return;
      }
      try {
        await this.actions.muzeDocumentsFinishNote(false);
      }
      catch (error) {
        this.data.muzeDocumentsEditorStatus = error.message;
      }
    },
    async muzeDocumentsLink() {
      const range = this.runtime.noteRange;
      if (!range || range.end <= range.start) {
        this.data.muzeDocumentsEditorStatus = 'Select the text to link.';
        return;
      }
      const dialog = this.container.querySelector(
        '[data-document-dialog="annotation-link"]'
      );
      dialog.querySelector('form').reset();
      // The dialog moves focus away from Cobalt and changes its selection.
      this.runtime.noteLinkRange = { ...range };
      this.data.muzeDocumentsLinkStatus = '';
      await this.actions.muzeSolidDesignOpenDialog(dialog);
      dialog.querySelector('input').focus();
    },
    async muzeDocumentsApplyLink(form) {
      try {
        const editor = this.runtime.noteEditor.editor;
        const range = this.runtime.noteLinkRange;
        const href = new URL(form.elements.href.value).href;
        this.api.validateFragment({
          text: editor.getText(),
          annotations: [
            {
              range: [range.start, range.end],
              order: 0,
              tag: this.runtime.noteEditor.createLinkAnnotationTag(href)
            }
          ]
        });
        await this.actions.muzeSolidDesignCloseDialog(form.closest('dialog'));
        editor.focus(range.start, range.end);
        editor.applyCommand('link', range, href);
        this.actions.muzeDocumentsNoteSelection();
      }
      catch (error) {
        this.data.muzeDocumentsLinkStatus = error.message;
      }
    }
  },
  actions: {
    muzeDocumentsNickname(value) {
      const name = String(value || '')
        .trim()
        .split(/\s+/)[0];
      return name && !/^(?:https?:|urn:)/i.test(name) ? name.slice(0, 40) : '';
    },
    muzeDocumentsAuthorLabel(author) {
      const nickname =
        this.runtime.authorLabels?.get(author.id) ||
        (author.label !== author.id
          ? this.actions.muzeDocumentsNickname(author.label)
          : '');
      if (nickname) {
        return nickname;
      }
      let hash = 2166136261;
      for (const character of author.id || 'unknown') {
        hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
      }
      const symbols = [
        '🦊',
        '🦉',
        '🐬',
        '🦋',
        '🌿',
        '🌻',
        '🍀',
        '🌙',
        '⭐',
        '🐢',
        '🐙',
        '🦩',
        '🐼',
        '🐳',
        '🐝',
        '🪶'
      ];
      return (
        symbols[hash % symbols.length] + symbols[(hash >>> 8) % symbols.length]
      );
    },
    muzeDocumentsProfileNickname(subject) {
      for (const predicate of [
        'http://xmlns.com/foaf/0.1/nick',
        'http://xmlns.com/foaf/0.1/givenName',
        'http://xmlns.com/foaf/0.1/firstName',
        'http://www.w3.org/2006/vcard/ns#given-name',
        'https://schema.org/givenName',
        'http://schema.org/givenName'
      ]) {
        const value = this.api.many(this.api.valueAt(subject, predicate))[0];
        const nickname = this.actions.muzeDocumentsNickname(
          typeof value === 'string' || value instanceof String ? value : ''
        );
        if (nickname) {
          return nickname;
        }
      }
      return this.actions.muzeDocumentsNickname(
        this.api.readProfile(subject).name
      );
    },
    async muzeDocumentsResolveAuthors(notes) {
      this.runtime.authorLookups ||= new Set();
      this.runtime.authorLabels ||= new Map();
      this.runtime.authorQueue ||= [];
      for (const author of notes.flatMap((note) => note.authors)) {
        if (
          !/^https?:/.test(author.id) ||
          author.label !== author.id ||
          this.runtime.authorLookups.has(author.id)
        ) {
          continue;
        }
        this.runtime.authorLookups.add(author.id);
        this.runtime.authorQueue.push({
          id: author.id,
          owner: this.runtime.owner
        });
      }
      if (this.runtime.authorBusy) {
        return;
      }
      this.runtime.authorBusy = true;
      try {
        while (this.runtime.authorQueue.length) {
          const { id, owner } = this.runtime.authorQueue.shift();
          if (owner !== this.runtime.owner) {
            continue;
          }
          try {
            const store = this.actions.muzeDocumentsStore(
              'author:' + id,
              owner
            );
            const cached = await store.load();
            let subject;
            const currentSession = this.runtime.host.session;
            if (currentSession?.webId === id && currentSession.profile) {
              subject = currentSession.profile;
            }
            else if (cached) {
              subject = this.api.oldm
                .context({})
                .parse(cached, id, 'text/turtle')
                .get(id);
            }
            else {
              const session = this.runtime.host.session;
              const client =
                session?.client ||
                this.api.createSolidMetroClient(id, {
                  oidc: false,
                  oldm: false
                });
              const read = () =>
                this.api.loadDocument(client, id, { redirect: 'error' });
              const profile = session
                ? await session.perform(read)
                : await read();
              if (owner !== this.runtime.owner) {
                continue;
              }
              await store.save(profile.source);
              subject = profile.graph.get(id);
            }
            const nickname = this.actions.muzeDocumentsProfileNickname(subject);
            if (nickname && owner === this.runtime.owner) {
              this.runtime.authorLabels.set(id, nickname);
              for (const note of this.runtime.notes.state.data) {
                note.author = note.authors.length
                  ? note.authors
                      .map((author) =>
                        this.actions.muzeDocumentsAuthorLabel(author)
                      )
                      .join(', ')
                  : 'Unknown author';
              }
            }
          }
          catch {
            /* A cached/generated avatar remains usable without the profile. */
          }
        }
      }
      finally {
        this.runtime.authorBusy = false;
      }
    },
    muzeDocumentsEmptyBody(body) {
      if (
        body.fragment &&
        this.api.validateFragment(body.fragment).text.trim()
      ) {
        return false;
      }
      return !this.api.DOMPurify.sanitize(body.html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      })
        .replace(/&(?:nbsp|#0*160|#x0*a0);/gi, ' ')
        .trim();
    },
    muzeDocumentsActivateNotes(keys) {
      this.runtime.activeNoteKeys = keys;
      for (const note of this.runtime.notes.state.data) {
        note.appearance = {
          ...note.appearance,
          'data-active': keys.includes(note.key) ? '' : null
        };
      }
      requestAnimationFrame(() => this.actions.muzeDocumentsRevealNotes());
    },
    muzeDocumentsRevealNotes() {
      const keys = this.runtime.activeNoteKeys || [];
      const panel = this.container.querySelector('.muze-documents-notes');
      if (!keys.length || !panel.checkVisibility()) {
        return;
      }
      // SimplyFlow batches bindings; measure the card after its key is rendered.
      const card = [
        ...panel.querySelectorAll('[data-note-key][data-active]')
      ].find((item) => keys.includes(item.dataset.noteKey));
      if (!card) {
        return;
      }
      const bounds = panel.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      if (box.top < bounds.top) {
        panel.scrollTop += box.top - bounds.top;
      }
      else if (box.bottom > bounds.bottom) {
        panel.scrollTop += box.bottom - bounds.bottom;
      }
    },
    muzeDocumentsCardClick(event) {
      if (
        event.target.closest(
          'a, button, input, select, textarea, summary, [contenteditable]'
        )
      ) {
        return;
      }
      const card = event.target.closest('[data-note-key]');
      if (card) {
        return this.commands.muzeDocumentsGoNote.call(
          this,
          card,
          card.dataset.noteKey
        );
      }
    },
    muzeDocumentsHitNotes(event) {
      const targets =
        event.type === 'pointerleave'
          ? []
          : this.runtime.highlightTargets || [];
      const keys = targets
        .filter((entry) =>
          entry.ranges.some((range) =>
            [...range.getClientRects()].some(
              (rect) =>
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
            )
          )
        )
        .map((entry) => entry.key);
      const hit = keys.join('|');
      if (
        hit !== this.runtime.lastHitKeys ||
        (keys.length && event.type !== 'pointermove')
      ) {
        this.actions.muzeDocumentsActivateNotes(keys);
      }
      this.runtime.lastHitKeys = hit;
    },
    muzeDocumentsSourceColor(group) {
      if (
        Number.isFinite(group.colorHue) &&
        group.colorHue >= 0 &&
        group.colorHue < 360
      ) {
        return group.colorHue;
      }
      const used = new Set(
        [...this.runtime.groups.values()].map((entry) => entry.colorHue)
      );
      let index = 0;
      let hue;
      do {
        hue = Math.round(((210 + index * 137.508) % 360) * 1000) / 1000;
        index += 1;
      } while (used.has(hue));
      group.colorHue = hue;
      return hue;
    },
    muzeDocumentsRememberDesktopPanes() {
      this.runtime.desktopPanes = {
        outline: this.data.muzeDocumentsOutlinePanel.hidden,
        notes: this.data.muzeDocumentsNotesPanel.hidden,
        thumbnails: this.data.muzeDocumentsThumbnailsPanel.hidden
      };
    },
    muzeDocumentsRestoreDesktopPanes() {
      const saved = this.runtime.desktopPanes;
      if (!saved) {
        return;
      }
      this.data.muzeDocumentsOutlinePanel.hidden = saved.outline;
      this.data.muzeDocumentsNotesPanel.hidden = saved.notes;
      this.data.muzeDocumentsThumbnailsPanel.hidden = saved.thumbnails;
      this.data.muzeDocumentsOutlineToggle['aria-expanded'] = String(
        saved.outline === null
      );
      this.data.muzeDocumentsThumbnailsToggle['aria-expanded'] = String(
        saved.thumbnails === null
      );
      if (saved.thumbnails === null) {
        requestAnimationFrame(() =>
          this.actions.muzeDocumentsRenderThumbnails()
        );
      }
    },
    muzeDocumentsHideSidebars() {
      if (
        this.container.contains(document.activeElement) &&
        document.activeElement.closest(
          '.muze-documents-outline, .muze-documents-notes, .muze-documents-thumbnails'
        )
      ) {
        this.container.querySelector('.muze-documents-paper-scroll').focus();
      }
      this.data.muzeDocumentsNotesPanel.hidden = '';
      this.data.muzeDocumentsOutlinePanel.hidden = '';
      this.data.muzeDocumentsOutlineToggle['aria-expanded'] = 'false';
      this.data.muzeDocumentsThumbnailsPanel.hidden = '';
      this.data.muzeDocumentsThumbnailsToggle['aria-expanded'] = 'false';
      this.runtime.pdf?.retainThumbnails();
    },

    muzeDocumentsThumbnailRows() {
      const count = this.runtime.pdf?.document.numPages || 0;
      this.data.muzeDocumentsThumbnails = Array.from(
        { length: count },
        (_, index) => ({
          page: index + 1,
          attributes: {
            'aria-label': 'Go to page ' + (index + 1),
            'aria-current': this.runtime.page === index + 1 ? 'page' : null,
            'data-thumbnail-page': String(index + 1)
          }
        })
      );
    },
    async muzeDocumentsRenderThumbnails() {
      if (this.runtime.thumbnailRendering) {
        this.runtime.thumbnailAgain = true;
        return;
      }
      const pdf = this.runtime.pdf;
      if (!pdf || this.data.muzeDocumentsThumbnailsPanel.hidden !== null) {
        return;
      }
      this.runtime.thumbnailRendering = true;
      try {
        const panel = this.container.querySelector(
          '.muze-documents-thumbnails'
        );
        const bounds = panel.getBoundingClientRect();
        const nearby = [
          ...panel.querySelectorAll('[data-thumbnail-page]')
        ].filter((button) => {
          const rect = button.getBoundingClientRect();
          return (
            rect.bottom > bounds.top - 180 && rect.top < bounds.bottom + 180
          );
        });
        pdf.retainThumbnails(
          new Set(nearby.map((button) => Number(button.dataset.thumbnailPage)))
        );
        for (const button of nearby) {
          if (
            pdf !== this.runtime.pdf ||
            this.data.muzeDocumentsThumbnailsPanel.hidden !== null
          ) {
            break;
          }
          await pdf.thumbnail(
            button.querySelector('canvas'),
            Number(button.dataset.thumbnailPage)
          );
        }
      }
      catch (error) {
        this.data.muzeDocumentsStatus = error.message;
      }
      finally {
        this.runtime.thumbnailRendering = false;
        if (this.runtime.thumbnailAgain) {
          this.runtime.thumbnailAgain = false;
          this.actions.muzeDocumentsRenderThumbnails();
        }
      }
    },

    muzeDocumentsNoteSelection() {
      const editor = this.runtime.noteEditor?.editor;
      if (!editor || !this.runtime.editing) {
        const selection = getSelection();
        if (
          selection?.rangeCount &&
          !selection.isCollapsed &&
          selection.anchorNode?.parentElement?.closest('.muze-documents-paper')
        ) {
          const bounds = selection.getRangeAt(0).getBoundingClientRect();
          this.actions.muzeDocumentsHitNotes({
            clientX: bounds.left + 1,
            clientY: bounds.top + bounds.height / 2
          });
        }
        return;
      }
      const range = editor.getSelection();
      if (range) {
        this.runtime.noteRange = range;
      }
      const selected = this.runtime.noteRange;
      const rangeKey = selected ? selected.start + ':' + selected.end : '';
      const visible =
        selected?.end > selected?.start &&
        rangeKey !== this.runtime.noteDismissedRange;
      this.data.muzeDocumentsFormatting = {
        ...this.data.muzeDocumentsFormatting,
        hidden: visible ? null : ''
      };
      for (const [name, command] of [
        ['Bold', 'strong'],
        ['Italic', 'em']
      ]) {
        this.data['muzeDocuments' + name] = {
          'aria-pressed': String(
            Boolean(selected && editor.getCommandState(command, selected.start))
          )
        };
      }
      requestAnimationFrame(() => this.actions.muzeDocumentsNotePosition());
    },
    muzeDocumentsNotePosition() {
      if (
        !this.runtime.noteEditor ||
        !this.runtime.editing ||
        this.data.muzeDocumentsFormatting.hidden !== null
      ) {
        return;
      }
      const toolbar = this.container.querySelector('[data-note-formatting]');
      const editor = this.runtime.noteEditor.editor;
      const anchor = editor.getCaretClientRect(this.runtime.noteRange.start);
      if (!anchor) {
        return;
      }
      this.data.muzeDocumentsFormatting = {
        ...this.data.muzeDocumentsFormatting,
        style: this.actions.muzeSolidDesignToolbarPlacement(toolbar, anchor)
      };
    },
    muzeDocumentsNoteGuard(event) {
      const editor = this.runtime.noteEditor?.editor;
      if (
        !editor ||
        !this.runtime.editing ||
        event.target.closest('[data-document-dialog="annotation-link"]')
      ) {
        return;
      }
      if (
        event.type === 'pointerdown' &&
        event.target.closest('[data-note-formatting] button')
      ) {
        event.preventDefault();
      }
      if (
        event.type === 'click' &&
        event.target.closest('[data-note-editor] a')
      ) {
        event.preventDefault();
      }
      if (
        event.type !== 'keydown' ||
        event.isComposing ||
        editor.isComposing()
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          this.commands.muzeDocumentsSaveNote.call(this);
        }
        return;
      }
      if (
        event.key === 'Escape' &&
        this.data.muzeDocumentsFormatting.hidden === null
      ) {
        event.preventDefault();
        event.stopPropagation();
        const range = this.runtime.noteRange;
        this.runtime.noteDismissedRange = range.start + ':' + range.end;
        this.data.muzeDocumentsFormatting = { hidden: '' };
        editor.focus(range.start, range.end);
      }
      else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        event.target.closest('[data-note-editor]')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.actions.muzeDocumentsNoteSelection();
        this.commands.muzeDocumentsLink.call(this);
      }
    },
    async muzeDocumentsSaveGroup(group, folder = '') {
      if (!group) {
        throw new Error('documents: Select an annotation group first.');
      }
      if (this.runtime.saving) {
        throw new Error('documents: Wait for the current group save.');
      }
      const session = this.runtime.host.requireSession();
      this.runtime.saving = true;
      try {
        if (folder) {
          await this.api.createGroupDestination(session, group, folder);
        }
        await this.actions.muzeDocumentsPersist(group);
        await this.api.saveGroup(session, group);
        await this.actions.muzeDocumentsPersist(group);
        if (group === this.runtime.group) {
          this.data.muzeDocumentsGroupStatus =
            'Group saved to ' + group.remote.url;
        }
      }
      finally {
        this.runtime.saving = false;
      }
    },
    async muzeDocumentsInitialize() {
      const host = this.runtime.host;
      this.runtime.generation = 0;
      this.eventBindings.start();
      host.documentsApi = this.api;
      host.capabilityBroker = new this.api.WorkspaceBroker({
        resolveProvider: (capability) =>
          capability === editCapability
            ? host.preferences.noteBodyProvider?.url || location.href
            : undefined
      });
      const list = this.api.model({
        data: [],
        options: { document: '', visible: [], scope: 'visible', search: '' }
      });
      list.addEffect(function () {
        return host.documentsApi.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return host.documentsApi.effect(() =>
          input.current.filter(
            (note) =>
              note.document === this.state.options.document &&
              (this.state.options.scope === 'all' ||
                this.state.options.visible.includes(note.key)) &&
              (!this.state.options.search ||
                [note.searchText, note.author, note.groupName]
                  .join(' ')
                  .toLowerCase()
                  .includes(this.state.options.search))
          )
        );
      });
      this.runtime.notes = list;
      const groups = this.api.model({ data: [], options: { document: '' } });
      groups.addEffect(function () {
        return host.documentsApi.effect(() => this.state.data);
      });
      groups.addEffect(function (input) {
        return host.documentsApi.effect(() =>
          input.current.filter(
            (group) => group.document === this.state.options.document
          )
        );
      });
      this.runtime.groupList = groups;
      this.runtime.panelToggleEffect = this.api.effect(() => {
        this.data.muzeDocumentsNotesToggle = {
          'aria-expanded': String(
            this.data.muzeDocumentsNotesPanel.hidden === null
          )
        };
      });
      this.runtime.notesEffect = this.api.effect(() => {
        this.data.muzeDocumentsNotes = list.view.current;
        this.data.muzeDocumentsNotesEmpty = list.view.current.length
          ? ''
          : list.state.options.search
            ? 'No matching annotations.'
            : list.state.options.scope === 'all'
              ? 'No annotations for this document.'
              : 'No annotations on visible pages.';
        this.actions.muzeDocumentsResolveAuthors(list.view.current);
      });
      let width = 0;
      this.runtime.resizeObserver = new ResizeObserver(([entry]) => {
        const nextWidth = Math.round(entry.contentRect.width);
        if (nextWidth > 0 && nextWidth !== width) {
          width = nextWidth;
          const narrow = matchMedia('(max-width: 719px)').matches;
          if (narrow && !this.runtime.narrowReader) {
            this.actions.muzeDocumentsRememberDesktopPanes();
            this.actions.muzeDocumentsHideSidebars();
          }
          else if (!narrow && this.runtime.narrowReader) {
            this.actions.muzeDocumentsRestoreDesktopPanes();
          }
          this.runtime.narrowReader = narrow;
          const preferred = this.runtime.preferredReaderWidth || nextWidth;
          const needsResize =
            Math.min(preferred, nextWidth) !== this.runtime.readerWidth;
          // Do not enlarge past the original fit width or disturb reading
          // position when the surrounding window merely gains extra space.
          if (
            needsResize &&
            this.runtime.readerReady &&
            !this.runtime.editing
          ) {
            const position = this.actions.muzeDocumentsCapturePosition();
            host.run(() =>
              this.actions.muzeDocumentsShow(
                position?.page || this.runtime.page,
                position?.fraction || 0
              )
            );
          }
        }
      });
      this.runtime.resizeObserver.observe(
        this.container.querySelector('.muze-documents-layout')
      );
      host.manage({
        capabilities: [
          viewCapability,
          editCapability,
          'https://vocab.muze.nl/capabilities/view-pdf'
        ],
        canClose: async () => {
          try {
            await this.actions.muzeDocumentsFlushReader();
            await this.runtime.pending;
          }
          catch {
            return { allowed: false };
          }
          return {
            allowed:
              !this.runtime.editing &&
              !this.runtime.saving &&
              !this.runtime.persistFailed
          };
        },
        onRequest: (request) => this.actions.muzeDocumentsRequest(request),
        onView: async (input) => {
          if (input.generation !== this.runtime.viewGeneration) {
            throw new Error('documents: Retired view generation.');
          }
          if (input.operation === 'prepare') {
            await this.actions.muzeDocumentsFlushReader();
            await this.runtime.pending;
            if (
              this.runtime.editing ||
              this.runtime.saving ||
              this.runtime.persistFailed
            ) {
              return { allowed: false };
            }
            this.runtime.frozen = true;
            this.runtime.generation += 1;
            this.runtime.loading?.abort();
            this.data.muzeDocumentsReader = { hidden: null, inert: '' };
            return { allowed: true, frozen: true };
          }
          if (this.runtime.frozen) {
            throw new Error('documents: This view is prepared for removal.');
          }
          if (input.operation === 'refresh') {
            await this.actions.muzeDocumentsLoad(this.runtime.document);
            return { ready: true };
          }
          if (input.operation === 'update') {
            return { revision: input.revision };
          }
          throw new Error('documents: Unsupported view operation.');
        },
        onCancel: () => this.runtime.loading?.abort()
      });
      host.beforeAccountLeave = async () => {
        await this.actions.muzeDocumentsFlushReader();
        await this.runtime.pending;
        if (
          this.runtime.editing ||
          this.runtime.saving ||
          this.runtime.persistFailed
        ) {
          throw new Error(
            'documents: Finish or preserve the annotation edit first.'
          );
        }
      };
      host.onConnect = () => this.actions.muzeDocumentsAccount();
      await host.ready;
      await this.actions.muzeDocumentsAccount();
      if (!host.task && host.launch?.resource) {
        await host.run(() =>
          this.actions.muzeDocumentsLoad(host.launch.resource)
        );
      }
    },
    async muzeDocumentsAccount() {
      this.runtime.loading?.abort();
      this.runtime.generation += 1;
      if (
        this.runtime.owner !== undefined &&
        this.runtime.owner !== (this.runtime.host.selectedWebId || '')
      ) {
        await this.runtime.pdf?.dispose();
        this.runtime.pdf = null;
        this.runtime.bytes = null;
        this.runtime.document = '';
        this.runtime.digest = '';
        this.runtime.readerReady = false;
        this.runtime.positioning = false;
        this.runtime.viewportToken = (this.runtime.viewportToken || 0) + 1;
        this.data.muzeDocumentsPages = [];
        this.data.muzeDocumentsOutline = [];
        this.data.muzeDocumentsOutlineEmpty = { hidden: null };
        this.data.muzeDocumentsLocation = '';
        CSS.highlights?.delete('muze-document-notes');
      }
      const owner = this.runtime.host.selectedWebId || '';
      if (!this.runtime.readerState || owner !== this.runtime.owner) {
        this.runtime.readerState = new this.api.ReaderState(
          this.api.local.indexedDB('solid-document-reader', {
            key: owner + '\nreader'
          }),
          owner
        );
        this.runtime.readerPosition = null;
        this.actions.muzeDocumentsApplySettings(
          await this.runtime.readerState.read()
        );
      }
      if (this.runtime.owner !== owner) {
        this.runtime.authorLabels = new Map();
        this.runtime.authorLookups = new Set();
        this.runtime.authorQueue = [];
      }
      this.runtime.owner = owner;
      this.runtime.notes.state.data = [];
      this.runtime.notes.state.options.visible = [];
      this.runtime.groups.clear();
      this.runtime.group = null;
      const source = this.api.local.indexedDB('solid-document-annotations', {
        key: this.runtime.owner + '\nindex'
      });
      this.runtime.indexSource = source;
      this.runtime.index = new this.api.StateGraph((await source.load()) || '');
      const root = this.api.named('urn:muze:documents:index');
      for (const entry of this.runtime.index.values(
        root,
        this.api.doc + 'group'
      )) {
        const saved = await this.actions.muzeDocumentsStore(entry.id).load();
        if (saved) {
          const group = new this.api.AnnotationGroup(saved);
          group.external =
            this.runtime.index.one(entry, this.api.doc + 'external', 'boolean')
              ?.value === 'true';
          group.allowWriting =
            this.runtime.index.one(
              entry,
              this.api.doc + 'allowWriting',
              'boolean'
            )?.value === 'true';
          const savedHue = this.runtime.index.one(
            entry,
            this.api.doc + 'colorHue',
            'decimal'
          );
          group.colorHue = savedHue ? Number(savedHue.value) : undefined;
          group.cacheId = entry.id;
          group.localBase = saved;
          group.localConflict =
            this.runtime.index.one(
              entry,
              this.api.doc + 'conflictDraft',
              'boolean'
            )?.value === 'true';
          const remote = this.runtime.index.one(
            entry,
            this.api.doc + 'resource',
            'iri'
          );
          if (remote) {
            group.owner = this.runtime.owner;
            group.remote = {
              url: remote.id,
              missing:
                this.runtime.index.one(
                  entry,
                  this.api.doc + 'pendingCreation',
                  'boolean'
                )?.value === 'true',
              etag: this.runtime.index.one(
                entry,
                this.api.doc + 'etag',
                'string'
              )?.value,
              source:
                (await this.actions
                  .muzeDocumentsStore('baseline:' + entry.id)
                  .load()) || undefined
            };
          }
          this.runtime.groups.set(group.cacheId, group);
        }
      }
      this.actions.muzeDocumentsRefresh();
    },
    muzeDocumentsStore(id, owner = this.runtime.owner) {
      return this.api.local.indexedDB('solid-document-annotations', {
        key: owner + '\n' + id
      });
    },
    async muzeDocumentsPersist(group = this.runtime.group) {
      if (!group) {
        return;
      }
      const turtle = group.write();
      let cacheId = group.cacheId || group.root.id;
      let store = this.actions.muzeDocumentsStore(cacheId);
      const owner = this.runtime.owner;
      const indexSource = this.runtime.indexSource;
      const write = async () => {
        const current = await store.load();
        if (owner !== this.runtime.owner) {
          throw new Error('documents: Account changed before preservation.');
        }
        if (current && current !== group.localBase && current !== turtle) {
          // Preserve both versions durably; a recovery copy is not permission
          // to overwrite the other tab's version or publish a resolved merge.
          const otherVersion = new this.api.AnnotationGroup(current);
          otherVersion.cacheId = cacheId;
          otherVersion.localBase = current;
          this.runtime.groups.set(cacheId, otherVersion);
          cacheId = 'urn:uuid:' + crypto.randomUUID();
          store = this.actions.muzeDocumentsStore(cacheId, owner);
          group.cacheId = cacheId;
          group.localConflict = true;
          this.runtime.groups.set(cacheId, group);
        }
        await store.save(turtle);
        group.localBase = turtle;
        const root = this.api.named('urn:muze:documents:index');
        const entry = this.api.named(cacheId);
        const index = new this.api.StateGraph((await indexSource.load()) || '');
        index.add(root, this.api.doc + 'group', entry);
        index.set(
          entry,
          this.api.doc + 'colorHue',
          this.api.literal(
            this.actions.muzeDocumentsSourceColor(group),
            this.api.xsd + 'decimal'
          )
        );
        index.set(
          entry,
          this.api.doc + 'external',
          this.api.literal(Boolean(group.external), this.api.xsd + 'boolean')
        );
        index.set(
          entry,
          this.api.doc + 'allowWriting',
          this.api.literal(
            Boolean(group.allowWriting),
            this.api.xsd + 'boolean'
          )
        );
        index.set(
          entry,
          this.api.doc + 'conflictDraft',
          this.api.literal(
            Boolean(group.localConflict),
            this.api.xsd + 'boolean'
          )
        );
        index.set(
          entry,
          this.api.doc + 'document',
          group.graph.one(group.root, this.api.doc + 'document', 'iri', true)
        );
        if (group.remote) {
          index.set(
            entry,
            this.api.doc + 'resource',
            this.api.named(group.remote.url)
          );
          index.set(
            entry,
            this.api.doc + 'pendingCreation',
            this.api.literal(
              Boolean(group.remote.missing),
              this.api.xsd + 'boolean'
            )
          );
          index.set(
            entry,
            this.api.doc + 'etag',
            this.api.literal(group.remote.etag || '')
          );
          if (group.remote.source !== undefined) {
            await this.actions
              .muzeDocumentsStore('baseline:' + cacheId, owner)
              .save(group.remote.source);
          }
        }
        await indexSource.save(index.write());
      };
      this.runtime.pending = (this.runtime.pending || Promise.resolve())
        .catch(() => {})
        .then(async () => {
          if (owner !== this.runtime.owner) {
            throw new Error('documents: Account changed before preservation.');
          }
          if (!navigator.locks) {
            throw new Error(
              'documents: This browser cannot safely coordinate local edits. Export your group.'
            );
          }
          await navigator.locks.request('muze-documents:' + owner, write);
        });
      try {
        await this.runtime.pending;
        group.persistFailed = false;
        this.runtime.persistFailed = [...this.runtime.groups.values()].some(
          (entry) => entry.persistFailed
        );
        this.data.muzeDocumentsGroupStatus =
          'Saved on this device. Pod publication is separate.';
        if (group.localConflict) {
          this.data.muzeDocumentsGroupStatus =
            'Another tab changed this group. Your draft is saved separately on this device; export it to resolve later.';
        }
      }
      catch (error) {
        group.persistFailed = true;
        this.runtime.persistFailed = true;
        this.data.muzeDocumentsGroupStatus = error.message;
        throw error;
      }
    },
    async muzeDocumentsChange(event) {
      try {
        if (event.target.matches('[data-document-file]')) {
          const file = event.target.files[0];
          if (file) {
            if (file.size > 32 * 1024 * 1024) {
              throw new Error('documents: The PDF exceeds the 32 MiB limit.');
            }
            await this.actions.muzeDocumentsLoad(
              '',
              new Uint8Array(await file.arrayBuffer())
            );
          }
        }
        if (event.target.matches('[data-document-group]')) {
          this.runtime.group = this.runtime.groups.get(event.target.value);
          this.actions.muzeDocumentsRefresh();
        }
        if (event.target.matches('[data-group-file]')) {
          const file = event.target.files[0];
          if (file) {
            const group = new this.api.AnnotationGroup(await file.text());
            const source = group.graph.one(
              group.root,
              this.api.doc + 'document',
              'iri',
              true
            );
            if (source.id !== this.runtime.document) {
              throw new Error(
                'documents: This file belongs to a different PDF.'
              );
            }
            if (this.runtime.groups.has(group.root.id)) {
              throw new Error(
                'documents: This group is already present. Import will not overwrite it.'
              );
            }
            await this.actions.muzeDocumentsAttachGroup(group);
          }
        }
      }
      catch (error) {
        this.data.muzeDocumentsStatus = error.message;
      }
    },
    async muzeDocumentsAttachGroup(group) {
      if (
        [...this.runtime.groups.values()].some(
          (loaded) => loaded.root.id === group.root.id
        )
      ) {
        throw new Error(
          'documents: This group is already loaded; existing edits are retained.'
        );
      }
      group.external = true;
      group.allowWriting = false;
      this.runtime.groups.set(group.root.id, group);
      await this.actions.muzeDocumentsPersist(group);
      this.actions.muzeDocumentsRefresh();
    },
    async muzeDocumentsLoad(url, localBytes) {
      if (this.runtime.frozen) {
        throw new Error('documents: This view is prepared for removal.');
      }
      if (this.runtime.editing) {
        throw new Error('documents: Finish the annotation edit first.');
      }
      await this.actions.muzeDocumentsFlushReader();
      await this.runtime.pending;
      this.runtime.loading?.abort();
      const controller = new AbortController();
      this.runtime.loading = controller;
      const generation = ++this.runtime.generation;
      this.data.muzeDocumentsStatus = 'Loading PDF…';
      const engine = await import('./pdf.mjs');
      const host = this.runtime.host;
      const client =
        host.session?.client ||
        this.api.createSolidMetroClient(url || location.href, {
          oidc: false,
          oldm: false
        });
      const read = () =>
        engine.readPdfBytes(client, url, {
          signal: controller.signal,
          progress: (size) => {
            this.data.muzeDocumentsStatus =
              'Loaded ' + Math.round(size / 1024) + ' KiB…';
          }
        });
      const bytes =
        localBytes ||
        (host.session ? await host.session.perform(read) : await read());
      const digest = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
      ]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      const pdf = await engine.openPdf(bytes, { signal: controller.signal });
      if (generation !== this.runtime.generation || controller.signal.aborted) {
        await pdf.dispose();
        return;
      }
      this.runtime.readerReady = false;
      this.runtime.viewportToken = (this.runtime.viewportToken || 0) + 1;
      await this.runtime.pdf?.dispose();
      this.runtime.pdf = pdf;
      this.runtime.layoutKey = '';
      this.data.muzeDocumentsPages = Array.from(
        { length: pdf.document.numPages },
        (_unused, index) => ({
          id: index + 1,
          attributes: {
            'data-pdf-page': String(index + 1),
            'aria-label': 'Page ' + (index + 1),
            style: ''
          },
          markers: []
        })
      );
      this.runtime.bytes = bytes;
      this.runtime.document = url || 'urn:sha256:' + digest;
      this.runtime.digest = digest;
      this.runtime.group = null;
      const savedReader = await this.runtime.readerState.read(
        this.runtime.document,
        digest
      );
      this.actions.muzeDocumentsApplySettings(savedReader);
      this.runtime.readerPosition = null;
      this.runtime.rotation = 0;
      await this.actions.muzeSolidDesignCloseDialog(
        this.container.querySelector('[data-document-dialog="open"]')
      );
      this.data.muzeDocumentsOutline = await pdf.outline();
      this.actions.muzeDocumentsThumbnailRows();
      if (this.data.muzeDocumentsThumbnailsPanel.hidden === null) {
        this.data.muzeDocumentsOutlinePanel.hidden = '';
        this.data.muzeDocumentsOutlineToggle['aria-expanded'] = 'false';
        requestAnimationFrame(() =>
          this.actions.muzeDocumentsRenderThumbnails()
        );
      }
      this.data.muzeDocumentsOutlineEmpty = {
        hidden: this.data.muzeDocumentsOutline.length ? '' : null
      };
      await this.actions.muzeDocumentsShow(
        savedReader.position?.page || 1,
        savedReader.position?.fraction || 0
      );
      this.actions.muzeDocumentsRefresh();
      this.data.muzeDocumentsStatus = '';
    },
    muzeDocumentsApplySettings(settings) {
      this.runtime.zoom = settings.zoom;
      this.data.muzeDocumentsOutlinePanel.hidden = settings.outlineOpen
        ? null
        : '';
      this.data.muzeDocumentsOutlineToggle['aria-expanded'] = String(
        settings.outlineOpen
      );
      this.data.muzeDocumentsNotesPanel.hidden = settings.annotationsOpen
        ? null
        : '';
      if (matchMedia('(max-width: 719px)').matches) {
        this.actions.muzeDocumentsRememberDesktopPanes();
        this.actions.muzeDocumentsHideSidebars();
      }
    },
    muzeDocumentsCapturePosition() {
      if (
        !this.runtime.readerReady ||
        this.runtime.editing ||
        !this.runtime.pdf
      ) {
        return null;
      }
      const page = this.runtime.page;
      const slot = this.container.querySelector(
        '[data-pdf-page="' + page + '"]'
      );
      const scroller = this.container.querySelector(
        '.muze-documents-paper-scroll'
      );
      if (!slot?.offsetHeight) {
        return null;
      }
      return {
        document: this.runtime.document,
        digest: this.runtime.digest,
        page,
        fraction: Math.max(
          0,
          Math.min(
            0.999,
            (scroller.scrollTop - slot.offsetTop) / slot.offsetHeight
          )
        ),
        readAt: Date.now()
      };
    },
    muzeDocumentsRememberPosition() {
      const position = this.actions.muzeDocumentsCapturePosition();
      if (!position) {
        return;
      }
      this.runtime.readerPosition = position;
      clearTimeout(this.runtime.readerTimer);
      const reader = this.runtime.readerState;
      this.runtime.readerTimer = setTimeout(() => {
        reader.save({ position }).catch((error) => {
          this.data.muzeDocumentsStatus = error.message;
        });
      }, 100);
    },
    async muzeDocumentsFlushReader() {
      clearTimeout(this.runtime.readerTimer);
      const reader = this.runtime.readerState;
      if (reader) {
        if (this.runtime.readerPosition) {
          await reader.save({ position: this.runtime.readerPosition });
        }
        await reader.pending;
      }
    },
    muzeDocumentsScroll() {
      if (
        this.runtime.scrollFrame ||
        !this.runtime.readerReady ||
        this.runtime.editing ||
        this.runtime.positioning
      ) {
        return;
      }
      this.runtime.scrollFrame = requestAnimationFrame(() => {
        this.runtime.scrollFrame = null;
        this.runtime.host.run(() => this.actions.muzeDocumentsRenderViewport());
      });
    },
    muzeDocumentsPageSize(number) {
      const row = this.data.muzeDocumentsPages[number - 1];
      const size = this.runtime.pdf.size(
        number,
        this.runtime.readerWidth,
        this.runtime.zoom,
        this.runtime.rotation
      );
      const style = 'width:' + size.width + 'px;height:' + size.height + 'px';
      const changed = row.attributes.style !== style;
      if (changed) {
        row.attributes.style = style;
      }
      return changed;
    },
    muzeDocumentsActivate(number) {
      const pdf = this.runtime.pdf;
      this.runtime.page = number;
      pdf.page = number;
      for (const row of this.data.muzeDocumentsThumbnails) {
        row.attributes['aria-current'] = row.page === number ? 'page' : null;
      }
      for (const entry of this.data.muzeDocumentsOutline) {
        entry.current = {
          'aria-current': entry.page === number ? 'page' : null
        };
      }
      this.data.muzeDocumentsLocation =
        'Page ' + number + ' of ' + pdf.document.numPages;
      this.actions.muzeDocumentsHighlights();
    },
    async muzeDocumentsRenderViewport() {
      const pdf = this.runtime.pdf;
      if (
        !pdf ||
        !this.runtime.readerReady ||
        this.runtime.editing ||
        this.runtime.positioning
      ) {
        return;
      }
      const token = (this.runtime.viewportToken =
        (this.runtime.viewportToken || 0) + 1);
      const scroller = this.container.querySelector(
        '.muze-documents-paper-scroll'
      );
      const viewport = scroller.getBoundingClientRect();
      const nearby = [];
      let current = this.runtime.page;
      let largestVisiblePart = 0;
      let currentVisiblePart = 0;
      let currentHeight = 0;
      for (const slot of this.container.querySelectorAll('[data-pdf-page]')) {
        const bounds = slot.getBoundingClientRect();
        const visiblePart = Math.max(
          0,
          Math.min(bounds.bottom, viewport.bottom) -
            Math.max(bounds.top, viewport.top)
        );
        const number = Number(slot.dataset.pdfPage);
        if (number === this.runtime.page) {
          currentVisiblePart = visiblePart;
          currentHeight = bounds.height;
        }
        if (visiblePart > largestVisiblePart) {
          largestVisiblePart = visiblePart;
          current = number;
        }
        if (
          bounds.bottom >= viewport.top - viewport.height &&
          bounds.top <= viewport.bottom + viewport.height
        ) {
          nearby.push({ number, slot });
        }
      }
      // Keep a deliberately selected short page current while it remains
      // substantially visible alongside a neighbour.
      if (
        currentHeight > 0 &&
        currentVisiblePart >= Math.min(viewport.height, currentHeight) / 2
      ) {
        current = this.runtime.page;
      }
      if (scroller.scrollHeight > scroller.clientHeight + 1) {
        if (scroller.scrollTop <= 1) {
          current = 1;
        }
        else if (
          scroller.scrollTop + scroller.clientHeight >=
          scroller.scrollHeight - 1
        ) {
          current = pdf.document.numPages;
        }
      }
      this.actions.muzeDocumentsActivate(current);
      pdf.retain(new Set(nearby.map((entry) => entry.number)));
      // Render the page being read before its surrounding prefetch buffer.
      nearby.sort(
        (left, right) =>
          Math.abs(left.number - current) - Math.abs(right.number - current)
      );
      let resized = false;
      for (const { number, slot } of nearby) {
        await pdf.render(
          slot.querySelector('[data-pdf-surface]'),
          number,
          this.runtime.readerWidth,
          this.runtime.zoom,
          this.runtime.rotation
        );
        if (pdf !== this.runtime.pdf || token !== this.runtime.viewportToken) {
          return;
        }
        resized = this.actions.muzeDocumentsPageSize(number) || resized;
      }
      this.actions.muzeDocumentsActivate(current);
      this.actions.muzeDocumentsRememberPosition();
      if (resized) {
        this.actions.muzeDocumentsScroll();
      }
    },
    async muzeDocumentsShow(page, fraction = 0) {
      const pdf = this.runtime.pdf;
      if (!pdf) {
        return;
      }
      const number = Math.min(pdf.document.numPages, Math.max(1, page));
      const token = (this.runtime.viewportToken =
        (this.runtime.viewportToken || 0) + 1);
      this.runtime.positioning = true;
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const scroller = this.container.querySelector(
          '.muze-documents-paper-scroll'
        );
        const availableWidth = this.container.querySelector(
          '.muze-documents-layout'
        ).clientWidth;
        this.runtime.preferredReaderWidth ||= availableWidth;
        this.runtime.readerWidth = Math.min(
          this.runtime.preferredReaderWidth,
          availableWidth
        );
        const key = [
          this.runtime.readerWidth,
          this.runtime.zoom,
          this.runtime.rotation
        ].join('/');
        if (key !== this.runtime.layoutKey) {
          pdf.clearViews();
          this.runtime.layoutKey = key;
          for (let index = 1; index <= pdf.document.numPages; index += 1) {
            this.actions.muzeDocumentsPageSize(index);
          }
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const slot = this.container.querySelector(
          '[data-pdf-page="' + number + '"]'
        );
        await pdf.render(
          slot.querySelector('[data-pdf-surface]'),
          number,
          this.runtime.readerWidth,
          this.runtime.zoom,
          this.runtime.rotation
        );
        if (pdf !== this.runtime.pdf || token !== this.runtime.viewportToken) {
          return;
        }
        this.actions.muzeDocumentsPageSize(number);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        scroller.scrollTop = slot.offsetTop + slot.offsetHeight * fraction;
        this.runtime.readerReady = true;
        this.actions.muzeDocumentsActivate(number);
        this.actions.muzeDocumentsRememberPosition();
      }
      finally {
        if (token === this.runtime.viewportToken) {
          this.runtime.positioning = false;
          this.actions.muzeDocumentsScroll();
        }
      }
    },
    muzeDocumentsRefresh() {
      const list = this.runtime.groupList;
      list.state.options.document = this.runtime.document || '';
      list.state.data = [...this.runtime.groups].map(([id, group]) => ({
        id,
        document: group.graph.one(group.root, this.api.doc + 'document', 'iri')
          ?.id
      }));
      const sources = list.view.current.map((entry) =>
        this.runtime.groups.get(entry.id)
      );
      const groups = sources.filter(
        (group) => !group.external || group.allowWriting
      );
      this.data.muzeDocumentsExternalSources = sources
        .filter((group) => group.external)
        .map((group) => ({
          id: group.cacheId || group.root.id,
          name: group.name + (group.remote ? ' — ' + group.remote.url : ''),
          label: group.allowWriting ? 'Use for viewing only' : 'Enable writing'
        }));
      if (!groups.includes(this.runtime.group)) {
        this.runtime.group = groups[0] || null;
      }
      this.data.muzeDocumentsGroups = groups.map((group) => ({
        id: group.cacheId || group.root.id,
        name: group.name,
        attributes: {
          label:
            group.name +
            (group.remote ? ' — ' + group.remote.url : '') +
            (group.localConflict ? ' (conflict draft)' : ''),
          value: group.cacheId || group.root.id,
          selected: group === this.runtime.group ? '' : null
        }
      }));
      // Publish the source and its viewport filter as one model change.
      this.api.batch(() => {
        this.runtime.notes.state.options.document = this.runtime.document || '';
        this.runtime.notes.state.data = sources.flatMap((group) =>
          group.annotations().map((note) => ({
            ...note,
            groupName: group.name,
            searchText: new DOMParser().parseFromString(
              DOMPurify.sanitize(note.html, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: []
              }),
              'text/html'
            ).body.textContent,
            locationLabel: String(note.page),
            location: {
              title: 'Go to page ' + note.page,
              'aria-label': 'Go to page ' + note.page,
              hidden:
                this.runtime.notes.state.options.scope === 'all' ? null : ''
            },
            groupId: group.cacheId || group.root.id,
            key: (group.cacheId || group.root.id) + '\n' + note.id,
            author: note.authors.length
              ? note.authors
                  .map((author) =>
                    this.actions.muzeDocumentsAuthorLabel(author)
                  )
                  .join(', ')
              : 'Unknown author',
            authorDetails: {
              title: note.authors
                .map((author) => author.id)
                .filter(Boolean)
                .join('\n')
            },
            source: group.name,
            sourceDetails: { title: group.remote?.url || group.name },
            appearance: {
              'data-external': group.external ? '' : null,
              'data-note-key':
                note.key || (group.cacheId || group.root.id) + '\n' + note.id,
              'data-active': this.runtime.activeNoteKeys?.includes(
                (group.cacheId || group.root.id) + '\n' + note.id
              )
                ? ''
                : null,
              style:
                '--muze-documents-note-hue:' +
                this.actions.muzeDocumentsSourceColor(group) +
                ';'
            },
            edit: { hidden: group.external && !group.allowWriting ? '' : null }
          }))
        );
        this.data.muzeDocumentsGroupStatus = this.runtime.group?.localConflict
          ? 'Conflicting draft preserved on this device. Export it to resolve later.'
          : this.runtime.group?.remote
            ? this.runtime.group.isSaved
              ? 'Saved to Pod. Its existing access permissions apply.'
              : 'Changes saved on this device. Use Save group to Pod to publish them.'
            : 'Personal notes on this device.';
        this.actions.muzeDocumentsHighlights();
      });
    },
    muzeDocumentsHighlights() {
      if (!CSS.highlights || !this.runtime.pdf) {
        return;
      }
      this.actions.muzeDocumentsParagraphControls();
      const sourceRanges = new Map();
      for (const note of this.runtime.notes?.state.data || []) {
        if (!sourceRanges.has(note.groupId)) {
          const group = this.runtime.groups.get(note.groupId);
          if (!group) {
            continue;
          }
          sourceRanges.set(note.groupId, {
            name:
              group === this.runtime.group
                ? 'muze-document-notes'
                : 'muze-document-source-' + sourceRanges.size,
            hue: this.actions.muzeDocumentsSourceColor(group),
            ranges: []
          });
        }
      }
      const visible = [];
      this.runtime.highlightTargets = [];
      const viewport = this.container
        .querySelector('.muze-documents-paper-scroll')
        .getBoundingClientRect();
      const intersects = (bounds) =>
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > viewport.top &&
        bounds.top < viewport.bottom &&
        bounds.right > viewport.left &&
        bounds.left < viewport.right;
      for (const note of this.runtime.notes?.state.data || []) {
        if (!sourceRanges.has(note.groupId)) {
          continue;
        }
        const noteRanges = [];
        const view = this.runtime.pdf.views.get(note.page);
        const layer = view?.layer;
        if (note.digest !== this.runtime.digest || !layer) {
          continue;
        }
        if (note.paragraph) {
          const paragraph = view.paragraphs.find(
            (entry) => entry.id === note.paragraph
          );
          for (const id of paragraph?.ids || []) {
            const node = layer.querySelector('#' + CSS.escape(id));
            if (node) {
              const range = document.createRange();
              range.selectNodeContents(node);
              noteRanges.push(range);
            }
          }
        }
        else if (!note.quote) {
          if (intersects(layer.getBoundingClientRect())) {
            visible.push(note.key);
          }
          continue;
        }
        else {
          const text = layer.textContent;
          const start = Number(note.start);
          const end = Number(note.end);
          if (
            !Number.isSafeInteger(start) ||
            text.slice(start, end) !== note.quote
          ) {
            continue;
          }
          const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          let offset = 0;
          let began = false;
          let node;
          while ((node = walker.nextNode())) {
            if (!began && start <= offset + node.length) {
              range.setStart(node, start - offset);
              began = true;
            }
            if (began && end <= offset + node.length) {
              range.setEnd(node, end - offset);
              noteRanges.push(range);
              break;
            }
            offset += node.length;
          }
        }
        if (
          noteRanges.some((range) =>
            [...range.getClientRects()].some(intersects)
          )
        ) {
          visible.push(note.key);
        }
        sourceRanges.get(note.groupId).ranges.push(...noteRanges);
        this.runtime.highlightTargets.push({
          key: note.key,
          ranges: noteRanges
        });
      }
      if (
        visible.join('|') !== this.runtime.notes.state.options.visible.join('|')
      ) {
        this.runtime.notes.state.options.visible = visible;
      }
      for (const name of this.runtime.highlightNames || []) {
        CSS.highlights.delete(name);
      }
      this.runtime.highlightNames = [...sourceRanges.values()].map(
        (source) => source.name
      );
      this.data.muzeDocumentsHighlightStyles = [...sourceRanges.values()]
        .map(
          (source) =>
            '.muze-documents-paper ::highlight(' +
            source.name +
            ') { background: hsl(' +
            source.hue +
            ' 85% 78% / 0.55); }'
        )
        .join('\n');
      for (const source of sourceRanges.values()) {
        CSS.highlights.set(source.name, new Highlight(...source.ranges));
      }
    },
    muzeDocumentsParagraphControls() {
      const markers = [];
      for (const row of this.data.muzeDocumentsPages) {
        const page = Number(row.attributes['data-pdf-page']);
        const view = this.runtime.pdf.views.get(page);
        const layer = view?.layer;
        const next = [];
        if (layer) {
          const paper = layer.getBoundingClientRect();
          for (const [index, paragraph] of view.paragraphs.entries()) {
            const rects = paragraph.ids.flatMap((id) => {
              const node = layer.querySelector('#' + CSS.escape(id));
              if (!node) {
                return [];
              }
              const range = document.createRange();
              range.selectNodeContents(node);
              return [...range.getClientRects()]
                .filter((rect) => rect.width && rect.height)
                .map(({ top, left, right, bottom, width, height }) => ({
                  top,
                  left,
                  right,
                  bottom,
                  width,
                  height
                }));
            });
            if (!rects.length) {
              continue;
            }
            const top = Math.min(...rects.map((rect) => rect.top));
            const right = Math.max(...rects.map((rect) => rect.right));
            const marker = {
              key: page + ':' + paragraph.id,
              page,
              paragraph: paragraph.id,
              rects,
              attributes: {
                style:
                  'top:' +
                  Math.max(0, top - paper.top - 12) +
                  'px;left:' +
                  Math.min(paper.width - 44, right - paper.left + 4) +
                  'px;',
                'aria-label':
                  'Add note to paragraph ' + (index + 1) + ' on page ' + page,
                'data-active': null
              }
            };
            next.push(marker);
          }
        }
        if (
          row.markers?.map((item) => item.key).join('|') ===
          next.map((item) => item.key).join('|')
        ) {
          for (let index = 0; index < next.length; index += 1) {
            row.markers[index].attributes.style = next[index].attributes.style;
            next[index].attributes = row.markers[index].attributes;
          }
        }
        else {
          row.markers = next;
        }
        markers.push(...next);
      }
      this.runtime.paragraphMarkers = markers;
    },
    muzeDocumentsParagraphPointer(event) {
      this.actions.muzeDocumentsHitNotes(event);
      for (const marker of this.runtime.paragraphMarkers || []) {
        const active =
          event.type !== 'pointerleave' &&
          marker.rects.some(
            (rect) =>
              event.clientX >= rect.left &&
              event.clientX <= rect.right + 48 &&
              event.clientY >= rect.top - 12 &&
              event.clientY <= rect.bottom + 12
          );
        marker.attributes['data-active'] = active ? '' : null;
      }
    },
    async muzeDocumentsAddNote(anchor, destinationChosen = false) {
      if (
        !destinationChosen &&
        this.runtime.host.preferences.noteBodyProvider &&
        this.data.muzeDocumentsGroups.length > 1
      ) {
        this.runtime.pendingAnchor = anchor;
        this.data.muzeDocumentsDestinations = this.data.muzeDocumentsGroups;
        await this.actions.muzeSolidDesignOpenDialog(
          this.container.querySelector('[data-document-dialog="destination"]')
        );
        return;
      }
      if (this.runtime.saving) {
        throw new Error(
          'documents: Wait for the group save before adding a note.'
        );
      }
      if (!this.runtime.document) {
        throw new Error('documents: Open a PDF first.');
      }
      if (!this.runtime.group) {
        const group = new this.api.AnnotationGroup();
        this.runtime.groups.set(group.root.id, group);
        this.runtime.group = group;
      }
      const id = this.runtime.group.add({
        ...anchor,
        document: this.runtime.document,
        digest: this.runtime.digest,
        creator:
          this.runtime.owner || this.runtime.group.root.id + '#anonymous-author'
      });
      this.runtime.newNote = true;
      await this.actions.muzeDocumentsPersist();
      this.actions.muzeDocumentsRefresh();
      await this.actions.muzeDocumentsEdit(id);
    },
    async muzeDocumentsEdit(id) {
      for (const dialog of this.container.querySelectorAll('dialog[open]')) {
        await this.actions.muzeSolidDesignCloseDialog(dialog);
      }
      if (this.runtime.saving) {
        throw new Error('documents: Wait for the group save before editing.');
      }
      const group = this.runtime.group;
      if (group.external && !group.allowWriting) {
        throw new Error(
          'documents: Enable writing for this annotation source first.'
        );
      }
      const note = group.annotations().find((item) => item.id === id);
      const fragment = group.fragment(id);
      this.runtime.noteId = id;
      this.runtime.noteGroup = group;
      const host = this.runtime.host;
      const provider = host.preferences.noteBodyProvider?.url;
      if (provider) {
        this.runtime.editing = true;
        let result;
        try {
          result = await host.muzeSolidUiInvoke(
            editCapability,
            provider,
            { version: 1, id, html: note.html, fragment },
            'Edit annotation'
          );
        }
        catch (error) {
          if (this.runtime.newNote) {
            group.remove(id);
            this.runtime.newNote = false;
            await this.actions.muzeDocumentsPersist(group);
            this.actions.muzeDocumentsRefresh();
          }
          throw error;
        }
        finally {
          this.runtime.editing = false;
        }
        if (
          result?.version !== 1 ||
          result.id !== id ||
          typeof result.html !== 'string'
        ) {
          throw new Error(
            'documents: The editor returned an invalid annotation body.'
          );
        }
        if (this.actions.muzeDocumentsEmptyBody(result)) {
          group.remove(id);
        }
        else {
          group.setBody(id, result.html, result.fragment);
        }
        this.runtime.newNote = false;
        await this.actions.muzeDocumentsPersist(group);
        this.actions.muzeDocumentsRefresh();
        return;
      }
      await this.actions.muzeDocumentsOpenEditor(
        note.html,
        id,
        'local',
        fragment
      );
    },
    async muzeDocumentsOpenEditor(html, id, scope = 'local', fragment) {
      await this.actions.muzeDocumentsFlushReader();
      this.runtime.editorReturnFocus = document.activeElement;
      this.data.muzeDocumentsDestinations = this.data.muzeDocumentsGroups;
      this.data.muzeDocumentsDestinationField = {
        hidden:
          this.runtime.newNote &&
          scope === 'local' &&
          this.data.muzeDocumentsGroups.length > 1
            ? null
            : ''
      };
      const module = await import('./note-editor.mjs');
      this.runtime.noteEditor?.editor.destroy();
      this.runtime.editorId = id;
      this.runtime.editorSource = this.actions.muzeDocumentsStore(
        'draft:' + scope + ':' + id
      );
      const saved = await this.runtime.editorSource.load();
      const draft = new this.api.StateGraph(saved || '');
      this.runtime.editorGraph = draft;
      const recovered = draft.one(
        this.api.named(id),
        this.api.doc + 'draftHtml',
        'string'
      )?.value;
      const initial = draft.one(
        this.api.named(id),
        this.api.doc + 'initialHtml',
        'string'
      )?.value;
      this.runtime.editorConflict =
        recovered !== undefined && initial !== html && recovered !== html;
      // A prior provider result may already be the caller's current value.
      // Keep recovery until acknowledged by content, without blocking reopening.
      this.runtime.editorInitial =
        recovered === html ? html : (initial ?? html);
      const nativeDraft = draft
        .values(
          this.api.named(id),
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
        )
        .some((type) => type.id === this.api.cobalt + 'Fragment');
      const recoveredFragment = nativeDraft
        ? this.api.readFragment(draft, id)
        : undefined;
      this.runtime.noteEditor = module.openNoteEditor(
        this.container.querySelector('[data-note-editor]'),
        recovered ?? html,
        recovered === undefined ? fragment : recoveredFragment
      );
      this.runtime.editing = true;
      this.runtime.noteRange = null;
      this.runtime.noteDismissedRange = '';
      this.data.muzeDocumentsFormatting = { hidden: '' };
      this.data.muzeDocumentsEditorStatus =
        recovered === undefined
          ? ''
          : 'Recovered annotation draft. Review before use.';
      if (this.runtime.editorConflict) {
        this.data.muzeDocumentsEditorStatus =
          'This recovered draft conflicts with a newer note. The draft is retained on this device; saving is blocked.';
      }
      await this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('[data-document-dialog="annotation"]')
      );
      const editor = this.runtime.noteEditor.editor;
      requestAnimationFrame(() => {
        if (this.runtime.noteEditor?.editor === editor) {
          editor.focus();
        }
      });
    },
    muzeDocumentsEditorChanged() {
      if (!this.runtime.noteEditor || !this.runtime.editing) {
        return;
      }
      const body = this.runtime.noteEditor.body();
      const graph = this.runtime.editorGraph.clone();
      this.api.writeFragment(graph, this.runtime.editorId, body.fragment);
      this.runtime.editorGraph = graph;
      graph.set(
        this.api.named(this.runtime.editorId),
        this.api.doc + 'draftHtml',
        this.api.literal(body.html)
      );
      graph.set(
        this.api.named(this.runtime.editorId),
        this.api.doc + 'initialHtml',
        this.api.literal(this.runtime.editorInitial)
      );
      const source = this.runtime.editorSource;
      this.runtime.editorPending = (
        this.runtime.editorPending || Promise.resolve()
      )
        .catch(() => {})
        .then(() => source.save(graph.write()));
      this.runtime.editorPending.catch((error) => {
        this.data.muzeDocumentsStatus = error.message;
      });
    },
    async muzeDocumentsFinishNote(apply) {
      if (!this.runtime.noteEditor) {
        return;
      }
      if (apply && this.runtime.editorConflict) {
        throw new Error(
          'documents: This draft belongs to an earlier note version. It is retained; saving is blocked.'
        );
      }
      if (this.runtime.noteEditor.editor.isComposing()) {
        throw new Error('documents: Finish composing text first.');
      }
      this.actions.muzeDocumentsEditorChanged();
      await this.runtime.editorPending;
      const body = this.runtime.noteEditor.body();
      const wasNew = this.runtime.newNote;
      const remove = apply && this.actions.muzeDocumentsEmptyBody(body);
      if (this.runtime.noteRequest) {
        await this.runtime.host.managed.respond(
          this.runtime.noteRequest,
          apply
            ? { result: { version: 1, id: this.runtime.editorId, ...body } }
            : {
                error: {
                  code: 'cancelled',
                  message: 'Annotation editing cancelled.'
                }
              }
        );
      }
      else if (remove || (!apply && wasNew)) {
        this.runtime.noteGroup.remove(this.runtime.noteId);
        await this.actions.muzeDocumentsPersist(this.runtime.noteGroup);
      }
      else if (apply) {
        if (this.runtime.newNote) {
          const destinationId = this.container.querySelector(
            '[data-note-destination]'
          ).value;
          const destination = this.runtime.groups.get(destinationId);
          const source = this.runtime.noteGroup;
          if (
            !destination ||
            (destination.external && !destination.allowWriting)
          ) {
            throw new Error(
              'documents: Choose an enabled writing destination.'
            );
          }
          if (destination !== source) {
            source.copyEmptyNoteTo(this.runtime.noteId, destination);
            destination.setBody(this.runtime.noteId, body.html, body.fragment);
            await this.actions.muzeDocumentsPersist(destination);
            this.runtime.noteGroup = destination;
            this.runtime.group = destination;
            this.runtime.newNote = false;
            source.detachEmptyNote(this.runtime.noteId);
            await this.actions.muzeDocumentsPersist(source);
          }
        }
        this.runtime.noteGroup.setBody(
          this.runtime.noteId,
          body.html,
          body.fragment
        );
        await this.actions.muzeDocumentsPersist(this.runtime.noteGroup);
      }
      if ((apply || wasNew) && !this.runtime.noteRequest) {
        await this.runtime.editorSource.save('');
      }
      await this.actions.muzeSolidDesignCloseDialog(
        this.container.querySelector('[data-document-dialog="annotation-link"]')
      );
      await this.actions.muzeSolidDesignCloseDialog(
        this.container.querySelector('[data-document-dialog="annotation"]')
      );
      this.runtime.noteEditor.editor.destroy();
      this.runtime.noteEditor = null;
      this.runtime.newNote = false;
      this.runtime.noteRequest = null;
      this.runtime.editing = false;
      this.data.muzeDocumentsFormatting = { hidden: '' };
      if (
        apply &&
        this.runtime.pdf &&
        !matchMedia('(max-width: 719px)').matches
      ) {
        this.data.muzeDocumentsNotesPanel.hidden = null;
        await this.runtime.readerState.save({
          settings: { annotationsOpen: true }
        });
      }
      this.actions.muzeDocumentsRefresh();
      this.data.muzeDocumentsStatus = remove
        ? 'Annotation removed.'
        : apply
          ? 'Annotation saved on this device.'
          : wasNew
            ? 'New annotation discarded.'
            : 'Draft kept on this device.';
      this.actions.muzeDocumentsScroll();
      const previousFocus = this.runtime.editorReturnFocus;
      const focusTarget = previousFocus?.isConnected
        ? previousFocus
        : this.container.querySelector(
            '[data-simply-command="muzeDocumentsPageNote"]'
          );
      focusTarget?.focus();
    },
    async muzeDocumentsRequest({ id, capability, input, requester }) {
      this.data.muzeDocumentsSource = { hidden: '' };
      try {
        if (capability === editCapability) {
          if (
            input?.version !== 1 ||
            typeof input.html !== 'string' ||
            typeof input.id !== 'string'
          ) {
            throw new Error('documents: Invalid annotation editor input.');
          }
          this.runtime.noteRequest = id;
          await this.actions.muzeDocumentsOpenEditor(
            input.html,
            input.id,
            requester?.origin + '/' + requester?.application,
            input.fragment
          );
          return;
        }
        if (input?.access !== 'direct' || input.version !== 1) {
          throw new Error(
            'documents: PDF viewing requires direct resource access.'
          );
        }
        if (
          input.presentation?.interaction !== 'interactive' ||
          input.presentation.geometry !== 'scroll'
        ) {
          throw new Error(
            'documents: PDF reading needs an interactive scrolling view.'
          );
        }
        this.runtime.viewGeneration = input.generation;
        await this.actions.muzeDocumentsLoad(input.resource);
        await this.runtime.host.managed.respond(id, {
          result: {
            version: 1,
            generation: input.generation,
            ready: true,
            presentation:
              input.presentation.interaction +
              '-' +
              input.presentation.geometry,
            appearance: [],
            limitations: ['PDF page appearance is retained.'],
            constraints: { minWidth: 0, minHeight: 0, overflow: 'scroll' }
          }
        });
      }
      catch (error) {
        this.data.muzeDocumentsStatus = error.message;
        await this.runtime.host.managed.respond(id, {
          error: { code: 'unsupported', message: error.message }
        });
      }
    },
    muzeDocumentsDownloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
};
