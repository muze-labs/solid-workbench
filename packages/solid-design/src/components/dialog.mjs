import styles from '../dialog.css' with { type: 'text' };

export const solidDialog = {
  api: { solidDialogClosing: new WeakMap() },
  styles: { 'solid-dialog': styles },
  behaviors: {
    solidDialog(dialog) {
      const cancel = (event) => {
        // A nested app and its shell can both compose this behavior. Let the
        // first handler own cancellation, including its pending close animation.
        if (event.defaultPrevented) {
          return;
        }
        event.preventDefault();
        this.actions.solidCloseDialog(dialog);
      };
      dialog.addEventListener('cancel', cancel);
      return () => {
        dialog.removeEventListener('cancel', cancel);
        for (const animation of dialog.getAnimations()) {
          animation.cancel();
        }
      };
    }
  },
  commands: {
    solidCloseDialog(button) {
      return this.actions.solidCloseDialog(button.closest('dialog'));
    }
  },
  actions: {
    solidOpenDialog(dialog) {
      // Lifecycle belongs to the element even when two composed apps use it.
      const pending = this.api.solidDialogClosing.get(dialog);
      if (pending) {
        return pending.then(() =>
          this.actions.solidOpenDialog(dialog)
        );
      }
      if (dialog.open) {
        return;
      }
      dialog.showModal();
      return this.actions.solidAnimateDialog(dialog, true);
    },
    solidCloseDialog(dialog) {
      if (!dialog.open) {
        return Promise.resolve();
      }
      const closing = this.api.solidDialogClosing;
      if (closing.has(dialog)) {
        return closing.get(dialog);
      }
      const completed = this.actions
        .solidAnimateDialog(dialog, false)
        .then(() => {
          dialog.close();
          closing.delete(dialog);
        });
      closing.set(dialog, completed);
      return completed;
    },
    async solidAnimateDialog(dialog, opening) {
      const surfaceStyle = getComputedStyle(dialog);
      const currentSurface = {
        opacity: surfaceStyle.opacity,
        transform: surfaceStyle.transform
      };
      const backdropColor = getComputedStyle(
        dialog,
        '::backdrop'
      ).backgroundColor;
      for (const animation of dialog.getAnimations()) {
        animation.cancel();
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      const collapsed = { opacity: 0, transform: 'scale(0.7)' };
      const expanded = { opacity: 1, transform: 'scale(1)' };
      const options = { duration: 300, easing: 'ease', fill: 'both' };
      const surface = dialog.animate(
        opening ? [collapsed, expanded] : [currentSurface, collapsed],
        options
      );
      const backdrop = dialog.animate(
        opening
          ? [
              { backgroundColor: 'transparent' },
              { backgroundColor: backdropColor }
            ]
          : [
              { backgroundColor: backdropColor },
              { backgroundColor: 'transparent' }
            ],
        { ...options, pseudoElement: '::backdrop' }
      );
      let deadline;
      try {
        // Background tabs may defer animation finish events. Always release
        // native modality even when those events are not delivered promptly.
        await Promise.race([
          Promise.all([surface.finished, backdrop.finished]),
          new Promise((resolve) => {
            deadline = setTimeout(resolve, 350);
          })
        ]);
      }
      catch {
        // Closing during entry cancels that entry animation. Native close and
        // focus restoration still complete through the caller's close action.
      }
      finally {
        clearTimeout(deadline);
        surface.cancel();
        backdrop.cancel();
      }
    }
  }
};
