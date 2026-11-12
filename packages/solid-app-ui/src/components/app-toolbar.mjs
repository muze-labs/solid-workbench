import { muzeSolidDesignToolbar } from '@muze-labs/solid-design';

export const muzeSolidUiAppToolbar = {
  components: { muzeSolidDesignToolbar },
  commands: {
    muzeSolidUiAppAction(_element, command) {
      return this.runtime.host.onAppAction?.(command);
    }
  }
};
