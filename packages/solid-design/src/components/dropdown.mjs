import styles from '../dropdown.css' with { type: 'text' };

export const solidDropdown = {
  styles: { 'solid-dropdown': styles },
  shortcuts: {
    'solidDropdown.arrowdown': function (event) {
      return this.actions.solidMoveDropdown(event, 1);
    },
    'solidDropdown.arrowup': function (event) {
      return this.actions.solidMoveDropdown(event, -1);
    }
  },
  actions: {
    solidMoveDropdown(event, direction) {
      if (!this.container.contains(event.target)) {
        return true;
      }
      const dropdown = event.target.closest('.solid-dropdown');
      const menu = dropdown?.querySelector('[popover]');
      const trigger = dropdown?.querySelector('[popovertarget]');
      if (!menu || !trigger ||
          (event.target !== trigger && !menu.contains(event.target))) {
        return true;
      }
      if (!menu.matches(':popover-open')) {
        // The native invoker supplies the popover's implicit anchor and focus.
        trigger.click();
      }
      if (!menu.matches(':popover-open')) {
        return true;
      }
      const items = [];
      for (const item of menu.querySelectorAll('.ds-dropdown-link')) {
        if (!item.matches(':disabled') && item.getClientRects().length) {
          items.push(item);
        }
      }
      if (!items.length) {
        return;
      }
      const current = items.indexOf(document.activeElement);
      let next = current + direction;
      if (current === -1) {
        next = direction > 0 ? 0 : items.length - 1;
      }
      else if (next < 0) {
        next = items.length - 1;
      }
      else if (next >= items.length) {
        next = 0;
      }
      items[next].focus();
    }
  }
};
