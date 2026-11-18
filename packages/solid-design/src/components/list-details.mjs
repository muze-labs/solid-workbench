import styles from '../list-details.css' with { type: 'text' };
import search from '../search.css' with { type: 'text' };

export const solidListDetails = {
  styles: {
    'solid-list-details': styles,
    'solid-search': search
  },
  shortcuts: {
    'solidSections.arrowdown': function (event) {
      return this.actions.solidMoveSection(event, 1);
    },
    'solidSections.arrowup': function (event) {
      return this.actions.solidMoveSection(event, -1);
    },
    'solidSections.tab': function (event) {
      return this.actions.solidSectionControls(event);
    },
    'solidSections.Shift+tab': function (event) {
      return this.actions.solidReturnSection(event);
    }
  },
  actions: {
    solidMoveSection(event, direction) {
      if (!this.container.contains(event.target)) {
        return true;
      }
      const list = event.target.closest('[data-solid-sections]');
      const current = event.target.closest('button');
      if (!list || !current) {
        return true;
      }
      const buttons = [];
      for (const button of list.querySelectorAll('button')) {
        if (!button.matches(':disabled') && button.getClientRects().length) {
          buttons.push(button);
        }
      }
      const index = buttons.indexOf(current);
      if (index === -1 || !buttons.length) {
        return true;
      }
      let next = index + direction;
      if (next < 0) {
        next = buttons.length - 1;
      }
      else if (next === buttons.length) {
        next = 0;
      }
      buttons[next].focus();
    },
    solidFirstSectionControl(layout) {
      const details = layout.querySelector('.ds-panels-details');
      const controls =
        details?.querySelectorAll(
          'input, select, textarea, button, a[href], [tabindex]'
        ) || [];
      for (const control of controls) {
        if (
          control.tabIndex >= 0 &&
          !control.matches(':disabled') &&
          !control.classList.contains('solid-list-back') &&
          !control.closest('[inert]') &&
          control.getClientRects().length
        ) {
          return control;
        }
      }
    },
    solidSectionControls(event) {
      if (
        !this.container.contains(event.target) ||
        !event.target.closest('[data-solid-sections] button')
      ) {
        return true;
      }
      const layout = event.target.closest('.solid-list-details');
      const control = this.actions.solidFirstSectionControl(layout);
      if (!control) {
        return true;
      }
      control.focus();
    },
    solidReturnSection(event) {
      if (!this.container.contains(event.target)) {
        return true;
      }
      const layout = event.target.closest('.solid-list-details');
      const list = layout?.querySelector('[data-solid-sections]');
      if (
        !list ||
        event.target !== this.actions.solidFirstSectionControl(layout)
      ) {
        return true;
      }
      const selected = list.querySelector('[aria-current="page"]');
      if (!selected) {
        return true;
      }
      list.scrollIntoView({ block: 'nearest' });
      selected.focus({ preventScroll: true });
    }
  },
  commands: {
    solidShowList(button) {
      const layout = button.closest('.solid-list-details');
      layout
        .querySelector('.ds-panels-list')
        .scrollIntoView({ block: 'nearest' });
      const selected = layout.querySelector(
        '.ds-panels-list [aria-current="page"]'
      );
      (selected || layout.querySelector('input, button, a'))?.focus({
        preventScroll: true
      });
    }
  }
};
