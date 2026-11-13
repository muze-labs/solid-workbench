import styles from './compact-header.css' with { type: 'text' };
import { muzeSolidDesignToolbar } from '@muze-labs/solid-design';

export const muzeSolidUiAppToolbar = {
  styles: { 'muze-solid-ui-compact-header': styles },
  components: { muzeSolidDesignToolbar },
  commands: {
    muzeSolidUiAppAction(element, command) {
      // Native disclosure buttons keep their default toggle and focus behavior.
      if (element?.hasAttribute('popovertarget')) {
        return true;
      }
      return this.runtime.host.onAppAction?.(command);
    }
  }
};
