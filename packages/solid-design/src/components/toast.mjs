import template from '../toast.html' with { type: 'text' };
import styles from '../toast.css' with { type: 'text' };

export const solidToast = {
  templates: { 'solid-toast': template },
  styles: { 'solid-toast': styles },
  behaviors: {
    solidToast(element) {
      this.runtime.solidToastElement = element;
      const rememberFocus = (event) => {
        if (!element.contains(event.relatedTarget)) {
          this.runtime.solidToastReturn = event.relatedTarget;
        }
      };
      element.addEventListener('focusin', rememberFocus);
      return () => {
        clearTimeout(this.runtime.solidToastTimer);
        element.removeEventListener('focusin', rememberFocus);
      };
    }
  },
  commands: {
    solidDismissToast() {
      this.actions.solidHideToast();
    }
  },
  actions: {
    solidNotify(text) {
      clearTimeout(this.runtime.solidToastTimer);
      if (!text) {
        this.actions.solidHideToast();
        return;
      }
      this.data.solidNotice.text = text;
      this.data.solidNotice.visibility = {
        hidden: null,
        inert: null,
        'data-solid-toast-closing': null
      };
      this.runtime.solidToastTimer = setTimeout(
        () => this.actions.solidExpireToast(),
        8000
      );
    },
    solidExpireToast() {
      const element = this.runtime.solidToastElement;
      if (element?.matches(':hover, :focus-within')) {
        this.runtime.solidToastTimer = setTimeout(
          () => this.actions.solidExpireToast(),
          1000
        );
        return;
      }
      this.actions.solidHideToast();
    },
    solidHideToast() {
      clearTimeout(this.runtime.solidToastTimer);
      const element = this.runtime.solidToastElement;
      if (element?.contains(document.activeElement)) {
        this.runtime.solidToastReturn?.focus({ preventScroll: true });
      }
      if (
        !element ||
        element.hidden ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        this.actions.solidFinishToast();
        return;
      }
      this.data.solidNotice.visibility = {
        hidden: null,
        inert: '',
        'data-solid-toast-closing': ''
      };
      this.runtime.solidToastTimer = setTimeout(
        () => this.actions.solidFinishToast(),
        300
      );
    },
    solidFinishToast() {
      this.data.solidNotice.visibility = {
        hidden: '',
        inert: null,
        'data-solid-toast-closing': null
      };
      this.data.solidNotice.text = '';
    }
  }
};
