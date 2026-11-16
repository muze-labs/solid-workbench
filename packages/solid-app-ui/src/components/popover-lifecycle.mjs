export const muzeSolidUiPopoverLifecycle = {
  events: {
    muzeSolidUiFrameFocus: {
      target: 'window',
      type: 'blur',
      action: 'muzeSolidUiDismissPopoversForFrame'
    }
  },
  actions: {
    muzeSolidUiDismissPopoversForFrame() {
      // Iframe pointer events do not reach the parent's native light dismiss.
      // Wait until the browser has moved focus to the frame element.
      requestAnimationFrame(() => {
        const root = this.runtime.root;
        const focused = root.ownerDocument.activeElement;
        if (focused?.tagName !== 'IFRAME' || !root.contains(focused)) {
          return;
        }
        for (const popup of root.querySelectorAll('[popover]:popover-open')) {
          if (popup.popover === 'auto' && !popup.contains(focused)) {
            popup.hidePopover();
          }
        }
      });
    }
  }
};
