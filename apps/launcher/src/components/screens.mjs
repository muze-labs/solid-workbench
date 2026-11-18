const container = function () {
  return this.container;
};

export const launcherScreens = {
  events: {
    muzeSolidLauncherScreenScroll: {
      target() {
        return this.container.querySelector('.muze-solid-launcher-screens');
      },
      type: 'scroll',
      action: 'muzeSolidLauncherScrollAvailability'
    },
    muzeSolidLauncherScreenResize: {
      subscribe(notify) {
        const observer = new ResizeObserver(notify);
        observer.observe(
          this.container.querySelector('.muze-solid-launcher-screens')
        );
        return () => observer.disconnect();
      },
      action: 'muzeSolidLauncherScrollAvailability'
    },
    muzeSolidLauncherScreenFocus: {
      target: container,
      type: 'focusin',
      action: 'muzeSolidLauncherRevealFocus'
    }
  },
  commands: {
    muzeSolidLauncherPreviousScreen() {
      this.actions.muzeSolidLauncherScrollScreens(-1);
    },
    muzeSolidLauncherNextScreen() {
      this.actions.muzeSolidLauncherScrollScreens(1);
    },
    muzeSolidLauncherMoveHere(button) {
      const id = this.runtime.swbShortcutMoving;
      if (id) {
        const group = button.closest('[data-muze-solid-launcher-screen]')
          .dataset.muzeSolidLauncherScreen;
        this.actions.swbShortcutCancelMove();
        return this.actions.swbMoveShortcut(id, null, false, group);
      }
    },
    muzeSolidLauncherDropOnNewScreen() {
      const id = this.runtime.swbShortcutMoving;
      if (id) {
        this.actions.swbShortcutCancelMove();
        return this.actions.swbMoveShortcut(id, null, false, 'new');
      }
    }
  },
  actions: {
    muzeSolidLauncherScrollAvailability() {
      const scroller = this.container.querySelector(
        '.muze-solid-launcher-screens'
      );
      const left = scroller.scrollLeft > 1;
      const right =
        scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1;
      const focused = document.activeElement;
      const command = focused?.dataset?.simplyCommand;
      const focusWillHide =
        (!left && command === 'muzeSolidLauncherPreviousScreen') ||
        (!right && command === 'muzeSolidLauncherNextScreen');
      this.data.muzeSolidLauncherPrevious = { hidden: left ? null : '' };
      this.data.muzeSolidLauncherNext = { hidden: right ? null : '' };
      this.data.muzeSolidLauncherNavigation = {
        hidden: left || right ? null : ''
      };
      if (focusWillHide) {
        const selector = left
          ? '[data-simply-command=muzeSolidLauncherPreviousScreen]'
          : right
            ? '[data-simply-command=muzeSolidLauncherNextScreen]'
            : '.swb-add-shortcut';
        requestAnimationFrame(() => {
          if (
            document.activeElement === focused ||
            document.activeElement === document.body
          ) {
            this.container.querySelector(selector)?.focus();
          }
        });
      }
    },
    muzeSolidLauncherDragScroll() {
      if (
        this.runtime.launcherDragScroll ||
        !this.runtime.swbShortcutDragging
      ) {
        return;
      }
      const step = () => {
        const point = this.runtime.launcherDragPoint;
        if (!point || !this.runtime.swbShortcutDragging) {
          this.runtime.launcherDragScroll = null;
          return;
        }
        const scroller = this.container.querySelector(
          '.muze-solid-launcher-screens'
        );
        const edgeSpeed = (position, size) => {
          const band = Math.min(64, size / 4);
          if (position < band) {
            return -12 * Math.max(0, 1 - position / band);
          }
          if (position > size - band) {
            return 12 * Math.max(0, 1 - (size - position) / band);
          }
          return 0;
        };
        scroller.scrollLeft += edgeSpeed(point.x, innerWidth);
        scroller.scrollTop += edgeSpeed(point.y, innerHeight);
        this.runtime.launcherDragScroll = requestAnimationFrame(step);
      };
      this.runtime.launcherDragScroll = requestAnimationFrame(step);
    },
    muzeSolidLauncherInitializeScreens() {
      const owner = this;
      const screens = this.api.model({ data: [] });
      screens.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      screens.addEffect(function (input) {
        return owner.api.effect(() => {
          const shortcuts = owner.runtime.shortcuts.view.current;
          const descriptions = owner.api
            .from(input.current)
            .orderBy({ order: owner.actions.swbCompareShortcutOrder })
            .toArray();
          const known = new Set(descriptions.map((group) => group.id));
          // Keep unknown group links intact and visible on a recoverable screen.
          for (const row of shortcuts) {
            if (row.group && !known.has(row.group)) {
              descriptions.push({ id: row.group });
              known.add(row.group);
            }
          }
          const rows = [{ id: '' }, ...descriptions];

          return rows.map((group, index) => ({
            ...group,
            attributes: {
              'data-muze-solid-launcher-screen': group.id,
              'aria-label': 'Screen ' + (index + 1),
              class: 'muze-solid-launcher-screen'
            },
            shortcuts: owner.api
              .from(shortcuts)
              .where((row) => row.group === group.id)
              .toArray(),
            endAttributes: {
              class: 'solid-tool muze-solid-launcher-screen-end'
            }
          }));
        });
      });
      this.runtime.launcherScreens = screens;
      this.runtime.launcherScreenEffect = this.api.effect(() => {
        this.data.muzeSolidLauncherScreens = screens.view.current;
        cancelAnimationFrame(this.runtime.launcherScreenLayout);
        this.runtime.launcherScreenLayout = requestAnimationFrame(() => {
          this.runtime.launcherScreenLayout = requestAnimationFrame(() =>
            this.actions.muzeSolidLauncherScrollAvailability()
          );
        });
      });
    },
    async muzeSolidLauncherTrimScreens() {
      const collection = this.runtime.store.collection;
      const subjects = collection.list();
      const occupied = new Set(
        subjects
          .filter((subject) =>
            []
              .concat(subject.a || [])
              .includes(this.api.prefixes.schema + 'SoftwareApplication')
          )
          .map(this.api.launcherGroups.shortcutGroup)
      );
      const groups = this.api
        .from(subjects)
        .select(this.api.launcherGroups.groupDescription)
        .where(Boolean)
        .orderBy({ order: this.actions.swbCompareShortcutOrder })
        .toArray();
      for (const group of groups.reverse()) {
        if (occupied.has(group.id)) {
          break;
        }
        await collection.delete(group.id);
        if (this.runtime.launcherAddScreen === group.id) {
          this.runtime.launcherAddScreen = '';
        }
      }
    },
    async muzeSolidLauncherCreateScreen() {
      this.actions.swb_requireOwner();
      const subject = await this.runtime.store.collection.create(
        this.api.launcherGroups.newGroupData(
          this.runtime.launcherScreens.state.data.length
        )
      );
      this.actions.render();
      return subject.id;
    },
    muzeSolidLauncherScrollScreens(direction) {
      const scroller = this.container.querySelector(
        '.muze-solid-launcher-screens'
      );
      scroller.scrollBy({
        left: direction * scroller.clientWidth * 0.9,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth'
      });
    },
    muzeSolidLauncherRevealFocus(event) {
      if (event.target.closest('.muze-solid-launcher-screens')) {
        event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }
};
