import '@muze-labs/solid-app-data/simply-runtime.mjs';
export const muzeDocumentsNavigation = {
  commands: {
    muzeDocumentsNavigation(_button, mode) {
      const open =
        this.data.muzeDocumentsNavigationPanel.hidden !== null ||
        this.data.muzeDocumentsNavigationMode !== mode;
      this.actions.muzeDocumentsHideSidebars();
      this.data.muzeDocumentsNavigationMode = mode;
      this.data.muzeDocumentsNavigationPanel.hidden = open ? null : '';
      this.data.muzeDocumentsSearchSection.hidden =
        mode === 'search' ? null : '';
      this.data.muzeDocumentsBookmarksSection.hidden =
        mode === 'bookmarks' ? null : '';
      this.data.muzeDocumentsSearchToggle = {
        'aria-expanded': String(open && mode === 'search')
      };
      this.data.muzeDocumentsBookmarksToggle = {
        'aria-expanded': String(open && mode === 'bookmarks')
      };
      requestAnimationFrame(async () => {
        const target = this.container.querySelector(
          open
            ? mode === 'search'
              ? '.muze-documents-navigation [name="query"]'
              : '.muze-documents-navigation [name="label"]'
            : '.muze-documents-paper-scroll'
        );
        for (
          let frame = 0;
          frame < 10 && !target?.checkVisibility();
          frame += 1
        ) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        target?.focus();
      });
      if (open && mode === 'bookmarks') {
        return this.runtime.host.run(() =>
          this.actions.muzeDocumentsBookmarks()
        );
      }
    },
    muzeDocumentsSearch(form) {
      return this.runtime.host.run(async () => {
        const pdf = this.runtime.pdf;
        const generation = (this.runtime.searchGeneration || 0) + 1;
        this.runtime.searchGeneration = generation;
        this.data.muzeDocumentsSearchResults = [];
        const query = form.elements.query.value.trim();
        this.data.muzeDocumentsSearchStatus = query ? 'Searching…' : '';
        if (!pdf || !query) {
          return;
        }
        await pdf.search(
          query,
          () =>
            pdf === this.runtime.pdf &&
            generation === this.runtime.searchGeneration,
          (match) => {
            this.data.muzeDocumentsSearchResults.push({
              ...match,
              id: String(this.data.muzeDocumentsSearchResults.length),
              label: 'Page ' + match.page + ' · ' + match.context
            });
          }
        );
        if (
          generation === this.runtime.searchGeneration &&
          pdf === this.runtime.pdf
        ) {
          this.data.muzeDocumentsSearchStatus = this.data
            .muzeDocumentsSearchResults.length
            ? this.data.muzeDocumentsSearchResults.length +
              (this.data.muzeDocumentsSearchResults.length === 1
                ? ' match'
                : ' matches')
            : 'No matches. Scanned pages may have no text.';
        }
      });
    },
    muzeDocumentsSearchResult(_button, id) {
      return this.runtime.host.run(async () => {
        const match = this.data.muzeDocumentsSearchResults.find(
          (item) => item.id === id
        );
        if (!match) {
          return;
        }
        await this.actions.muzeDocumentsShow(match.page);
        if (matchMedia('(max-width: 719px)').matches) {
          this.actions.muzeDocumentsHideSidebars();
        }
        const layer = this.runtime.pdf.views.get(match.page)?.layer;
        if (layer?.textContent.slice(match.start, match.end) === match.quote) {
          const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          let offset = 0;
          let began = false;
          let node;
          while ((node = walker.nextNode())) {
            if (!began && match.start <= offset + node.length) {
              range.setStart(node, match.start - offset);
              began = true;
            }
            if (began && match.end <= offset + node.length) {
              range.setEnd(node, match.end - offset);
              CSS.highlights?.set('muze-document-search', new Highlight(range));
              node.parentElement.scrollIntoView({
                block: 'center',
                inline: 'nearest'
              });
              break;
            }
            offset += node.length;
          }
        }
        this.container.querySelector('.muze-documents-paper-scroll').focus();
      });
    },
    muzeDocumentsBookmark(form) {
      return this.runtime.host.run(async () => {
        const position = this.actions.muzeDocumentsCapturePosition();
        if (!position) {
          throw new Error(
            'documents/navigation: Open a document before bookmarking.'
          );
        }
        await this.runtime.readerState.save({
          bookmark: {
            ...position,
            id: 'urn:uuid:' + crypto.randomUUID(),
            label: form.elements.label.value.trim()
          }
        });
        form.reset();
        await this.actions.muzeDocumentsBookmarks();
      });
    },
    muzeDocumentsBookmarkScope(input) {
      this.runtime.bookmarks.state.options.document = input.checked
        ? ''
        : this.runtime.document || '__none__';
    },
    muzeDocumentsOpenBookmark(_button, id) {
      return this.runtime.host.run(async () => {
        const bookmark = this.runtime.bookmarks.state.data.find(
          (item) => item.id === id
        );
        if (!bookmark) {
          return;
        }
        if (bookmark.document !== this.runtime.document) {
          if (!/^https?:/.test(bookmark.document)) {
            throw new Error(
              'documents/navigation: Reopen the local PDF before using this bookmark.'
            );
          }
          await this.actions.muzeDocumentsLoad(bookmark.document);
        }
        if (bookmark.digest !== this.runtime.digest) {
          this.data.muzeDocumentsStatus =
            'This document has changed. The original bookmark is retained.';
          return;
        }
        await this.actions.muzeDocumentsShow(bookmark.page, bookmark.fraction);
        this.runtime.activeBookmark = bookmark.id;
        for (const item of this.runtime.bookmarks.state.data) {
          item.selection = {
            'aria-current': item.id === bookmark.id ? 'true' : null,
            title: item.document
          };
        }

        if (matchMedia('(max-width: 719px)').matches) {
          this.actions.muzeDocumentsHideSidebars();
        }
        this.container.querySelector('.muze-documents-paper-scroll').focus();
      });
    },
    muzeDocumentsRemoveBookmark(_button, id) {
      return this.runtime.host.run(async () => {
        await this.runtime.readerState.save({ removeBookmark: id });
        await this.actions.muzeDocumentsBookmarks();
      });
    }
  },
  actions: {
    async muzeDocumentsBookmarks() {
      if (!this.runtime.bookmarks) {
        const model = simply.model({ data: [], options: { document: '' } });
        model.addEffect(function () {
          return simply.effect(() => this.state.data);
        });
        model.addEffect(function (input) {
          return simply.effect(() =>
            input.current.filter(
              (item) =>
                !this.state.options.document ||
                item.document === this.state.options.document
            )
          );
        });
        model.addEffect(
          simply.model.sort({
            sortBy: 'page',
            direction: 'asc',
            sortFn(left, right) {
              return (
                left.document.localeCompare(right.document) ||
                left.page - right.page
              );
            }
          })
        );
        this.runtime.bookmarks = model;
        this.runtime.bookmarkEffect = simply.effect(() => {
          this.data.muzeDocumentsBookmarks = model.view.current;
          this.data.muzeDocumentsBookmarksEmpty = model.view.current.length
            ? ''
            : 'No bookmarks.';
        });
      }
      const reader = this.runtime.readerState;
      const entries = await reader.bookmarks();
      if (reader !== this.runtime.readerState) {
        return;
      }
      this.runtime.bookmarks.state.data = entries.map((item) => ({
        ...item,
        location: 'Page ' + item.page,
        selection: {
          'aria-current':
            item.id === this.runtime.activeBookmark ? 'true' : null,
          title: item.document
        },
        source: item.document.startsWith('urn:')
          ? 'Local document'
          : item.document
      }));
    }
  }
};
