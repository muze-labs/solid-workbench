import styles from './file-navigation.css' with { type: 'text' };
import sourceFilesLocation from '../location.html' with { type: 'text' };
import sourceFilesNavigation from '../navigation.html' with { type: 'text' };

export const fileNavigation = {
  styles: { 'swb-file-list': styles },
  templates: {
    'files-navigation': sourceFilesNavigation,
    'files-location': sourceFilesLocation
  },
  events: {
    muzeSolidFilesLocationResize: {
      target() {
        return window.visualViewport || window;
      },
      type: 'resize',
      action: 'muzeSolidFilesPlaceLocation'
    },
    muzeSolidFilesLocationDisclosure: {
      target() {
        return this.container.querySelector('#muze-solid-files-location-sheet');
      },
      type: 'toggle',
      action: 'muzeSolidFilesPlaceLocation'
    }
  },
  commands: {
    muzeSolidFilesBrowseFolder(_button, url) {
      return this.actions.operation(() => this.actions.browse(url));
    },
    browse(form) {
      const url = form.elements.url.value;
      return this.actions.operation(() => this.actions.browse(url));
    },
    open(_element, url) {
      const kind = this.actions.resourceKind(url);
      if (kind === 'folder') {
        return this.actions.operation(() => this.actions.browse(url));
      }
      if (kind === 'selection') {
        return this.runtime.host.run(() => this.actions.selectFile(url));
      }
      return this.runtime.host.run(() =>
        this.actions.muzeSolidFilesSelectDetails(url)
      );
    },
    up() {
      this.actions.operation(() =>
        this.actions.browse(
          this.actions.inside(this.api.parentContainer(this.runtime.current))
        )
      );
    },
    downloadResource(_element, url) {
      return this.actions.operation(async () => {
        const blob = await this.api.readDownload(
          this.runtime.host.requireSession(),
          this.actions.inside(url)
        );
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = this.actions.decodeName(url);
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      });
    }
  },
  actions: {
    muzeSolidFilesPlaceLocation(event) {
      const sheet = this.container.querySelector(
        '#muze-solid-files-location-sheet'
      );
      if (!sheet.matches(':popover-open')) {
        return;
      }
      const button =
        this.container.querySelector(
          '[popovertarget="muze-solid-files-location-sheet"]:focus'
        ) || this.container.querySelector('.muze-solid-files-current-folder');
      this.data.muzeSolidFilesLocationPlacement = {
        style: this.actions.muzeSolidDesignToolbarPlacement(
          sheet,
          button.getBoundingClientRect()
        )
      };
      if (
        event.type === 'toggle' &&
        button.hasAttribute('data-muze-solid-files-edit-location')
      ) {
        const input = sheet.querySelector('[name=url]');
        input.focus({ preventScroll: true });
        input.select();
      }
    },
    muzeSolidFilesRenderLocation(url) {
      const folder = new URL(url);
      const root = new URL(this.runtime.root);
      const relative = folder.pathname.slice(root.pathname.length);
      const segments = relative.split('/').filter(Boolean);
      const ancestors = segments.length
        ? [{
            label: this.actions.decodeName(root.href) || root.host,
            url: root.href
          }]
        : [];
      let current = root.href;
      for (const segment of segments.slice(0, -1)) {
        current = new URL(segment + '/', current).href;
        ancestors.push({
          label: this.actions.decodeName(current),
          url: current
        });
      }
      this.data.muzeSolidFilesAncestors = ancestors;
      const folders = [
        ...ancestors,
        { label: this.actions.decodeName(url) || folder.host, url }
      ];
      this.data.muzeSolidFilesFolders = folders.map((item, depth) => ({
        ...item,
        attributes: { style: '--muze-files-folder-depth:' + depth }
      }));
      this.data.muzeSolidFilesFolderName =
        this.actions.decodeName(url) || folder.host;
      this.data.muzeSolidFilesParent = {
        disabled: url === root.href ? '' : null
      };
    },
    locationValue: function () {
      return (
        this.runtime.host.launch?.resource ||
        this.runtime.host.preferences.filesRoot ||
        this.runtime.host.session?.storage[0] ||
        ''
      );
    },
    inside: function (url) {
      const normalized = this.api.httpUrl(url);
      if (!this.runtime.root || !normalized.startsWith(this.runtime.root)) {
        throw new Error(
          'files: Choose a folder within the configured files root.'
        );
      }
      return normalized;
    },
    browse: async function (url) {
      if (!(await this.actions.muzeSolidFilesReleaseView())) {
        return;
      }
      const session = this.runtime.host.requireSession();
      this.runtime.root = this.actions.locationValue();
      if (!this.runtime.root) {
        throw new Error('files: Set the files root in Preferences.');
      }
      url = this.actions.inside(url);
      if (!new URL(url).pathname.endsWith('/')) {
        throw new Error('files: Folder URLs must end with /.');
      }
      const { entries, metadata } = await this.api.listFolder(
        session,
        this.runtime.root,
        url
      );
      if (this.runtime.current !== url) {
        this.runtime.detailsResource = '';
        this.runtime.files.state.options.selected = '';
        this.data.muzeSolidFilesDetails = { hidden: '' };
      }
      this.runtime.current = url;
      this.data.url = url;
      this.actions.muzeSolidFilesRenderLocation(url);
      const locationSheet = this.container.querySelector(
        '#muze-solid-files-location-sheet'
      );
      if (locationSheet.matches(':popover-open')) {
        locationSheet.hidePopover();
      }
      this.runtime.files.state.data = this.api
        .from(entries)
        .select((entry) => ({
          url: entry.url,
          name: this.actions.decodeName(entry.url),
          type: entry.type,
          deleted: this.api.linkState(metadata, entry.url).deleted
        }))
        .toArray();
      this.actions.renderPicker();
      this.runtime.host.message(
        !this.runtime.host.task && !metadata
          ? 'This server did not advertise link metadata; deletion is unavailable.'
          : ''
      );
      this.runtime.host.managed
        ?.publish()
        .catch((error) => this.runtime.host.message(error));
    },
    decodeName: function (url) {
      try {
        return decodeURIComponent(
          new URL(url).pathname.replace(/\/$/, '').split('/').pop()
        );
      }
      catch {
        return url;
      }
    },
    child: function (name) {
      if (!this.runtime.current) {
        throw new Error('files: Open a folder first.');
      }
      if (!name.trim() || /[\/\\]/.test(name) || ['.', '..'].includes(name)) {
        throw new Error('files: Use a filename without path separators.');
      }
      return new URL(encodeURIComponent(name), this.runtime.current).href;
    },
    operation: function (fn) {
      if (this.runtime.busy) {
        return;
      }
      this.runtime.busy = true;
      return this.runtime.host
        .run(
          async () => {
            try {
              return await fn();
            }
            catch (error) {
              if (this.runtime.pending) {
                await this.actions
                  .finishSelection({
                    error: {
                      code: 'failed',
                      message:
                        'Files could not complete selection. ' + error.message
                    }
                  })
                  .catch(() => {});
              }
              throw error;
            }
          },
          { network: true }
        )
        .finally(() => (this.runtime.busy = false));
    },

    initializeFiles() {
      const owner = this;
      const list = this.api.model({ data: [], options: { picker: false } });
      list.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return owner.api.effect(() => {
          const picking = this.state.options.picker;
          const selected = this.state.options.selected;
          return owner.api
            .from(input.current)
            .where(owner.actions.visibleFile)
            .select((entry) => owner.actions.fileRow(entry, picking, selected))
            .toArray();
        });
      });
      this.runtime.files = list;
      this.runtime.listEffect = this.api.effect(() => {
        this.data.entries = list.view.current;
        this.data.pickerEntries = list.view.current;
        this.data.empty =
          list.view.current.length || !this.runtime.current
            ? ''
            : 'This folder is empty.';
      });
    },
    visibleFile(entry) {
      return !entry.deleted;
    },
    fileRow(entry, picking, selected) {
      const menuId =
        'muze-solid-files-entry-menu-' + encodeURIComponent(entry.url);
      return {
        icon: {
          href:
            '../assets/feather-icons.svg#' +
            (entry.type === 'folder' ? 'folder' : 'file-text')
        },
        menu: { id: menuId },
        menuButton: {
          popovertarget: menuId,
          'aria-label': 'Actions for ' + entry.name
        },
        selected: {
          'aria-current': selected === entry.url ? 'page' : null,
          title: entry.name
        },
        url: entry.url,
        name: entry.name,
        type: entry.type,
        pick: { hidden: picking ? null : '' },
        edit: { hidden: picking ? '' : null }
      };
    },
    resourceKind(url) {
      const entry = this.api
        .from(this.data.entries)
        .where({ url })
        .toArray()[0];
      return entry?.type === 'folder'
        ? 'folder'
        : this.runtime.pending
          ? 'selection'
          : 'download';
    }
  }
};
