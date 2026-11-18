// The existing SimplyFlow event extension owns registration and cleanup.
const container = function () {
  return this.container;
};

export const shortcutMenu = {
  events: {
    swbShortcutContext: {
      target: container,
      type: 'contextmenu',
      action: 'swbShortcutContext'
    },
    swbShortcutPress: {
      target: container,
      type: 'pointerdown',
      action: 'swbShortcutPress'
    },
    swbShortcutMotion: {
      target: container,
      type: 'pointermove',
      action: 'swbShortcutMotion'
    },
    swbShortcutRelease: {
      target: container,
      type: 'pointerup',
      action: 'swbShortcutRelease'
    },
    swbShortcutCancel: {
      target: container,
      type: 'pointercancel',
      action: 'swbShortcutCancelPress'
    },
    swbShortcutKeys: {
      target: container,
      type: 'keydown',
      action: 'swbShortcutKeys'
    },
    swbShortcutDrag: {
      target: container,
      type: 'dragstart',
      action: 'swbShortcutDrag'
    },
    swbShortcutDragOver: {
      target() {
        return this.container.ownerDocument;
      },
      type: 'dragover',
      action: 'swbShortcutDragOver'
    },
    swbShortcutDragLeave: {
      target: container,
      type: 'dragleave',
      action: 'swbShortcutDragLeave'
    },
    swbShortcutMoveFocus: {
      target: container,
      type: 'focusin',
      action: 'swbShortcutMovePreview'
    },
    swbShortcutPointerLeave: {
      target: container,
      type: 'pointerleave',
      action: 'swbShortcutPointerLeave'
    },
    swbShortcutDrop: {
      target: container,
      type: 'drop',
      action: 'swbShortcutDrop'
    },
    swbShortcutDragEnd: {
      target: container,
      type: 'dragend',
      action: 'swbShortcutDragEnd'
    }
  },
  commands: {
    swbShortcutAdd() {
      // The floating action adds to the screen occupying the largest visible area.
      const viewport = this.container
        .querySelector('.muze-solid-launcher-screens')
        .getBoundingClientRect();
      let selected = '';
      let largest = -1;
      for (const screen of this.container.querySelectorAll(
        '[data-muze-solid-launcher-screen]:not([hidden])'
      )) {
        const rect = screen.getBoundingClientRect();
        const visible = Math.max(
          0,
          Math.min(rect.right, viewport.right) -
            Math.max(rect.left, viewport.left)
        );
        if (
          visible > largest &&
          screen.dataset.muzeSolidLauncherScreen !== 'new'
        ) {
          selected = screen.dataset.muzeSolidLauncherScreen;
          largest = visible;
        }
      }
      this.actions.swbShortcutCancelMove();
      this.runtime.launcherAddScreen = selected;
      return this.commands.call('muzeSolidCatalogOpen');
    },
    swbShortcutMoveEarlier(button, id) {
      return this.actions.swbShortcutStep(button, id, -1);
    },
    swbShortcutMoveLater(button, id) {
      return this.actions.swbShortcutStep(button, id, 1);
    },
    swbShortcutMoveTo(button, id) {
      this.actions.swbShortcutCloseMenu(button);
      this.runtime.swbShortcutMoving = id;
      this.data.muzeSolidLauncherDropScreen = {
        hidden: null,
        'aria-label':
          'Screen ' + (this.data.muzeSolidLauncherScreens.length + 1)
      };
      this.data.muzeSolidLauncherDragScreens = {
        class:
          'muze-solid-launcher-screens muze-solid-launcher-screens-moving'
      };
      this.runtime.host.notify(
        'Choose a shortcut or a screen’s Move here control. Escape cancels.'
      );
    },
    async swbShortcutDelete(button, id) {
      this.actions.swbShortcutCloseMenu(button);
      await this.actions.handleRemove(id);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const next =
        this.container.querySelector('.swb-shortcut-link') ||
        this.container.querySelector('.swb-add-shortcut');
      next?.focus();
    }
  },
  actions: {
    swbShortcutRelease() {
      const link = this.runtime.swbShortcutHeldLink;
      this.runtime.swbShortcutHeldLink = null;
      this.actions.swbShortcutCancelPress();
      if (link?.isConnected) {
        // Native popover light-dismiss may run after the pointer release that
        // ended a hold outside the newly opened menu. Restore it afterward.
        requestAnimationFrame(() => {
          if (link.isConnected) {
            this.actions.swbShortcutShowMenu(link);
          }
        });
      }
    },
    swbShortcutCancelPress() {
      clearTimeout(this.runtime.swbShortcutPress?.timer);
      this.runtime.swbShortcutPress = null;
    },
    swbShortcutPress(event) {
      const link = event.target.closest('.swb-shortcut-link');
      if (!link || event.button !== 0) {
        return;
      }
      this.actions.swbShortcutCancelPress();
      const press = { x: event.clientX, y: event.clientY };
      press.timer = setTimeout(() => {
        if (!link.isConnected || this.runtime.swbShortcutPress !== press) {
          return;
        }
        this.runtime.swbShortcutIgnoreClickUntil = Date.now() + 1200;
        this.runtime.swbShortcutHeldLink = link;
        this.actions.swbShortcutShowMenu(link);
      }, 550);
      this.runtime.swbShortcutPress = press;
    },
    swbShortcutMotion(event) {
      this.actions.swbShortcutMovePreview(event);
      const press = this.runtime.swbShortcutPress;
      if (
        press &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10
      ) {
        this.actions.swbShortcutCancelPress();
      }
    },
    swbShortcutContext(event) {
      const link = event.target.closest('.swb-shortcut-link');
      if (link) {
        event.preventDefault();
        this.actions.swbShortcutCancelPress();
        this.runtime.swbShortcutHeldLink = link;
        this.actions.swbShortcutShowMenu(link);
      }
    },
    swbShortcutShowMenu(link) {
      const shortcut = link.closest('[data-swb-shortcut]');
      const menu = shortcut.querySelector('[popover]');
      menu.showPopover();
      const row = this.data.shortcuts.find(
        (item) => item.id === shortcut.dataset.swbShortcut
      );
      row.menuPlacement = {
        style: this.actions.solidToolbarPlacement(
          menu,
          link.getBoundingClientRect()
        )
      };
      menu.querySelector('button').focus();
    },
    swbShortcutCloseMenu(button) {
      const shortcut = button.closest('[data-swb-shortcut]');
      shortcut.querySelector('[popover]').hidePopover();
      shortcut.querySelector('.swb-shortcut-link').focus();
    },
    swbShortcutKeys(event) {
      const link = event.target.closest('.swb-shortcut-link');
      if (
        link &&
        (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
      ) {
        event.preventDefault();
        this.actions.swbShortcutShowMenu(link);
        return;
      }
      if (event.key === 'Escape' && this.runtime.swbShortcutMoving) {
        this.actions.swbShortcutCancelMove();
        this.runtime.host.notify('Move cancelled.');
      }
      const menu = event.target.closest('.swb-shortcut-menu');
      if (!menu) {
        return;
      }
      if (event.key === 'Tab') {
        // Leave the composite menu using the browser's normal Tab order.
        this.actions.swbShortcutCloseMenu(event.target);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.actions.swbShortcutCloseMenu(event.target);
        return;
      }
      const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(event.target);
      let next;
      if (event.key === 'ArrowDown') {
        next = (index + 1) % buttons.length;
      }
      if (event.key === 'ArrowUp') {
        next = (index + buttons.length - 1) % buttons.length;
      }
      if (event.key === 'Home') {
        next = 0;
      }
      if (event.key === 'End') {
        next = buttons.length - 1;
      }
      if (next !== undefined) {
        event.preventDefault();
        buttons[next].focus();
      }
    },
    swbShortcutDrag(event) {
      const link = event.target.closest('.swb-shortcut-link');
      if (!link) {
        return;
      }
      this.actions.swbShortcutCancelPress();
      this.runtime.swbShortcutDragging = link.closest(
        '[data-swb-shortcut]'
      ).dataset.swbShortcut;
      this.data.muzeSolidLauncherDragScreens = {
        class:
          'muze-solid-launcher-screens muze-solid-launcher-screens-dragging'
      };
      this.data.muzeSolidLauncherDropScreen = {
        hidden: null,
        'aria-label':
          'Screen ' + (this.data.muzeSolidLauncherScreens.length + 1)
      };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'text/plain',
        this.runtime.swbShortcutDragging
      );
    },
    swbShortcutDragOver(event) {
      this.runtime.launcherDragPoint = { x: event.clientX, y: event.clientY };
      this.actions.muzeSolidLauncherDragScroll();
      const target = this.actions.swbShortcutDestination(event.target);
      const internal = this.runtime.swbShortcutDragging;
      const external = this.container.contains(event.target) &&
        event.dataTransfer.types.some((type) =>
          type === 'text/uri-list' || type === 'text/plain'
        );
      this.actions.swbShortcutPreview(target, external && !internal);
      if ((internal || external) && target) {
        event.preventDefault();
        event.dataTransfer.dropEffect = internal ? 'move' : 'copy';
      }
    },
    swbShortcutDragLeave(event) {
      if (!this.runtime.swbShortcutDragging &&
          !this.actions.swbShortcutDestination(event.relatedTarget)) {
        this.actions.swbShortcutClearPreview();
      }
    },
    swbShortcutMovePreview(event) {
      if (this.runtime.swbShortcutMoving) {
        this.actions.swbShortcutPreview(
          this.actions.swbShortcutDestination(event.target)
        );
      }
    },
    swbShortcutPointerLeave() {
      if (!this.runtime.swbShortcutDragging) {
        this.actions.swbShortcutClearPreview();
      }
    },
    swbShortcutClearPreview() {
      clearTimeout(this.runtime.shortcutPreviewTimer);
      this.runtime.shortcutPreviewTarget = '';
      this.runtime.shortcuts.state.options.insertBefore = '';
    },
    swbShortcutCancelMove() {
      this.runtime.swbShortcutMoving = null;
      this.data.muzeSolidLauncherDropScreen = { hidden: '' };
      this.data.muzeSolidLauncherDragScreens = {
        class: 'muze-solid-launcher-screens'
      };
      this.actions.swbShortcutClearPreview();
    },
    swbShortcutDestination(element) {
      const shortcut = element?.closest?.('[data-swb-shortcut]');
      if (shortcut) {
        return shortcut.dataset.swbShortcut;
      }
      const end = element?.closest?.('.muze-solid-launcher-screen-end');
      const screen = element?.closest?.('[data-muze-solid-launcher-screen]');
      if (end || screen) {
        const id = (end || screen).closest('[data-muze-solid-launcher-screen]')
          .dataset.muzeSolidLauncherScreen;
        return 'end:' + id;
      }
      return '';
    },
    swbShortcutPreview(target = '', external = false) {
      const moving =
        this.runtime.swbShortcutDragging || this.runtime.swbShortcutMoving;
      const destination = (moving || external) && target !== moving
        ? target : '';
      if (!this.runtime.swbShortcutDragging) {
        this.runtime.shortcuts.state.options.insertBefore = destination;
        return;
      }
      if (this.runtime.shortcutPreviewTarget === destination) {
        return;
      }
      clearTimeout(this.runtime.shortcutPreviewTimer);
      this.runtime.shortcutPreviewTarget = destination;
      // Native dragleave fires between child nodes as well as whole screens.
      // Wait for a stable successor instead of flashing an intermediate slot.
      this.runtime.shortcutPreviewTimer = setTimeout(() => {
        this.runtime.shortcuts.state.options.insertBefore = destination;
      }, 100);
    },
    swbShortcutDrop(event) {
      const target = this.actions.swbShortcutDestination(event.target);
      const id = this.runtime.swbShortcutDragging;
      if (!target) {
        return;
      }
      if (!id) {
        const url = this.api.shortcutMetadata.droppedWebUrl(event.dataTransfer);
        this.actions.swbShortcutClearPreview();
        if (!url) {
          return;
        }
        event.preventDefault();
        const destination = target.startsWith('end:')
          ? { group: target.slice(4) }
          : { before: target };
        return this.runtime.host.run(() =>
          this.actions.addShortcut({ url, destination, mode: '' })
        );
      }
      event.preventDefault();
      this.actions.swbShortcutDragEnd();
      return target.startsWith('end:')
        ? this.actions.swbMoveShortcut(id, null, false, target.slice(4))
        : this.actions.swbMoveShortcut(id, target);
    },
    swbShortcutDragEnd() {
      if (!this.runtime.swbShortcutDragging) {
        return;
      }
      cancelAnimationFrame(this.runtime.launcherDragScroll);
      this.runtime.launcherDragScroll = null;
      this.runtime.launcherDragPoint = null;
      this.data.muzeSolidLauncherDragScreens = {
        class: 'muze-solid-launcher-screens'
      };
      this.data.muzeSolidLauncherDropScreen = { hidden: '' };
      this.runtime.swbShortcutDragging = null;
      this.actions.swbShortcutClearPreview();
      this.runtime.swbShortcutIgnoreClickUntil = Date.now() + 300;
    },
    swbShortcutStep(button, id, direction) {
      this.actions.swbShortcutCloseMenu(button);
      const group = this.data.shortcuts.find((row) => row.id === id)?.group;
      const ids = this.data.shortcuts
        .filter((row) => row.group === group)
        .map((row) => row.id);
      const index = ids.indexOf(id);
      const next = index + direction;
      if (next < 0 || next >= ids.length) {
        return;
      }
      return this.actions.swbMoveShortcut(id, ids[next], direction > 0);
    },
    swbMoveShortcut(id, target, after = false, group) {
      return this.runtime.host.run(async () => {
        this.actions.swb_requireOwner();
        if (id === target) {
          return;
        }
        const source = this.data.shortcuts.find((row) => row.id === id);
        const destination = this.data.shortcuts.find(
          (row) => row.id === target
        );
        if (!source || (target !== null && !destination)) {
          throw new Error('launcher: The shortcut changed; choose it again.');
        }
        group ??= destination?.group ?? source.group;
        if (group === 'new') {
          group = await this.actions.muzeSolidLauncherCreateScreen();
        }
        const ids = this.data.shortcuts
          .filter((row) => row.group === group && row.id !== id)
          .map((row) => row.id);
        const position =
          target === null ? ids.length : ids.indexOf(target) + (after ? 1 : 0);
        ids.splice(position, 0, id);
        const subjects = ids.map((key) =>
          this.runtime.store.collection.get(key)
        );
        this.api.launcherGroups.shortcutGroup(
          this.runtime.store.collection.get(id)
        );
        this.api.applyShortcutOrder(subjects);
        this.api.launcherGroups.setShortcutGroup(
          this.runtime.store.collection.get(id),
          group
        );
        // Collection resource writes snapshot the entire shared native graph.
        await this.runtime.store.collection.save(subjects[0]);
        await this.actions.muzeSolidLauncherTrimScreens();
        this.actions.render();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        for (const item of this.container.querySelectorAll(
          '[data-swb-shortcut]'
        )) {
          if (item.dataset.swbShortcut === id) {
            item.querySelector('.swb-shortcut-link').focus();
          }
        }
        this.runtime.host.notify('Shortcut order saved on this device.');
      });
    }
  }
};
