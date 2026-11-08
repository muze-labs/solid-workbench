import styles from '../list-details.css' with { type: 'text' };

export const muzeSolidDesignListDetails = {
  styles: { 'muze-solid-design-list-details': styles },
  shortcuts: {
    'muzeSolidDesignSections.arrowdown': function (event) {
      return this.actions.muzeSolidDesignMoveSection(event, 1);
    },
    'muzeSolidDesignSections.arrowup': function (event) {
      return this.actions.muzeSolidDesignMoveSection(event, -1);
    },
    'muzeSolidDesignSections.tab': function (event) {
      return this.actions.muzeSolidDesignSectionControls(event);
    },
    'muzeSolidDesignSections.Shift+tab': function (event) {
      return this.actions.muzeSolidDesignReturnSection(event);
    }
  },
  actions: {
    muzeSolidDesignMoveSection(event, direction) {
      if (!this.container.contains(event.target)) {
        return true;
      }
      const list = event.target.closest('[data-muze-solid-design-sections]');
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
    muzeSolidDesignFirstSectionControl(layout) {
      const details = layout.querySelector('.ds-panels-details');
      const controls =
        details?.querySelectorAll(
          'input, select, textarea, button, a[href], [tabindex]'
        ) || [];
      for (const control of controls) {
        if (
          control.tabIndex >= 0 &&
          !control.matches(':disabled') &&
          !control.classList.contains('muze-solid-design-list-back') &&
          !control.closest('[inert]') &&
          control.getClientRects().length
        ) {
          return control;
        }
      }
    },
    muzeSolidDesignSectionControls(event) {
      if (
        !this.container.contains(event.target) ||
        !event.target.closest('[data-muze-solid-design-sections] button')
      ) {
        return true;
      }
      const layout = event.target.closest('.muze-solid-design-list-details');
      const control = this.actions.muzeSolidDesignFirstSectionControl(layout);
      if (!control) {
        return true;
      }
      control.focus();
    },
    muzeSolidDesignReturnSection(event) {
      if (!this.container.contains(event.target)) {
        return true;
      }
      const layout = event.target.closest('.muze-solid-design-list-details');
      const list = layout?.querySelector('[data-muze-solid-design-sections]');
      if (
        !list ||
        event.target !== this.actions.muzeSolidDesignFirstSectionControl(layout)
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
    muzeSolidDesignShowList(button) {
      const layout = button.closest('.muze-solid-design-list-details');
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
