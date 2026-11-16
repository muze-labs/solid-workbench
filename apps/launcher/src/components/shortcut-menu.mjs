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
      target: container,
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
      action: 'swbShortcutClearPreview'
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
      const moving = this.runtime.swbShortcutMoving;
      if (moving) {
        this.actions.swbShortcutCancelMove();
        return this.actions.swbMoveShortcut(moving, null);
      }
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
      this.data.swbShortcutAddLabel = 'Move to end';
      this.runtime.host.notify(
        'Choose a shortcut to move before it, or Move to end. Escape cancels.'
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
        style: this.actions.muzeSolidDesignToolbarPlacement(
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
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'text/plain',
        this.runtime.swbShortcutDragging
      );
    },
    swbShortcutDragOver(event) {
      const target = this.actions.swbShortcutDestination(event.target);
      this.actions.swbShortcutPreview(target);
      if (this.runtime.swbShortcutDragging && target) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    },
    swbShortcutDragLeave(event) {
      if (!this.actions.swbShortcutDestination(event.relatedTarget)) {
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
    swbShortcutClearPreview() {
      this.actions.swbShortcutPreview();
    },
    swbShortcutCancelMove() {
      this.runtime.swbShortcutMoving = null;
      this.data.swbShortcutAddLabel = 'Add apps';
      this.actions.swbShortcutClearPreview();
    },
    swbShortcutDestination(element) {
      const shortcut = element?.closest?.('[data-swb-shortcut]');
      if (shortcut) {
        return shortcut.dataset.swbShortcut;
      }
      return element?.closest?.('.swb-add-shortcut') ? 'end' : '';
    },
    swbShortcutPreview(target = '') {
      const moving =
        this.runtime.swbShortcutDragging || this.runtime.swbShortcutMoving;
      const destination = moving && target !== moving ? target : '';
      this.runtime.shortcuts.state.options.insertBefore = destination;
    },
    swbShortcutDrop(event) {
      const target = this.actions.swbShortcutDestination(event.target);
      const id = this.runtime.swbShortcutDragging;
      if (!target || !id) {
        return;
      }
      event.preventDefault();
      this.actions.swbShortcutDragEnd();
      return this.actions.swbMoveShortcut(id, target === 'end' ? null : target);
    },
    swbShortcutDragEnd() {
      this.runtime.swbShortcutDragging = null;
      this.actions.swbShortcutClearPreview();
      this.runtime.swbShortcutIgnoreClickUntil = Date.now() + 300;
    },
    swbShortcutStep(button, id, direction) {
      this.actions.swbShortcutCloseMenu(button);
      const ids = this.data.shortcuts.map((row) => row.id);
      const index = ids.indexOf(id);
      const next = index + direction;
      if (next < 0 || next >= ids.length) {
        return;
      }
      return this.actions.swbMoveShortcut(id, ids[next], direction > 0);
    },
    swbMoveShortcut(id, target, after = false) {
      return this.runtime.host.run(async () => {
        this.actions.swb_requireOwner();
        if (id === target) {
          return;
        }
        const ids = this.data.shortcuts.map((row) => row.id);
        if (!ids.includes(id) || (target !== null && !ids.includes(target))) {
          throw new Error('launcher: The shortcut changed; choose it again.');
        }
        ids.splice(ids.indexOf(id), 1);
        const position = target === null
          ? ids.length : ids.indexOf(target) + (after ? 1 : 0);
        ids.splice(position, 0, id);
        const subjects = ids.map((key) =>
          this.runtime.store.collection.get(key)
        );
        this.api.applyShortcutOrder(subjects);
        // Collection resource writes snapshot the entire shared native graph.
        await this.runtime.store.collection.save(subjects[0]);
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
