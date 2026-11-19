import '@muze-labs/solid-app-data/simply-runtime.mjs';
import { connectInspector, dockSelector } from './bridge.mjs';
import styles from './panel.css' with { type: 'text' };

let connection;
let themeObserver;
const view = simply.app({
  container: document.querySelector('#inspector'),
  styles: { 'swb-inspector': styles },
  data: {
    status: 'This inspector is disconnected.',
    presentationAttributes: {
      'aria-label': 'Open in new window', title: 'Open in new window'
    },
    presentationIcon: { href: '../assets/feather-icons.svg#external-link' },
    trail: [],
    links: [],
    parents: [],
    trailVisibility: { hidden: '' },
    linksVisibility: { hidden: '' },
    parentsVisibility: { hidden: '' }
  },
  commands: {
    swbInspectPick() {
      connection?.pick();
    },
    swbInspectTogglePresentation() {
      connection?.togglePresentation();
    },
    swbInspectClose() {
      connection?.close();
    },
    swbInspectParent(_button, index) {
      connection?.navigate(index);
      return this.actions.swbInspectFocusBreadcrumb();
    },
    swbInspectBreadcrumb(_button, index) {
      connection?.revisit(index);
      return this.actions.swbInspectFocusBreadcrumb();
    },
    swbInspectSource(button, id) {
      return this.actions.swbInspectToggleSource(button, id);
    },
    swbInspectParentSource(button, index) {
      return this.actions.swbInspectToggleSource(button, index, true);
    },
    swbInspectCloseSource(button) {
      connection?.closeSource();
      button.closest('li').querySelector(
        '[data-simply-command="swbInspectSource"], ' +
        '[data-simply-command="swbInspectParentSource"]'
      ).focus();
    }
  },
  actions: {
    async swbInspectFocusBreadcrumb() {
      await this.binding.whenIdle();
      this.container.querySelector('[aria-current="location"]:not([hidden])')?.focus();
    },
    async swbInspectToggleSource(button, id, parent) {
      connection?.toggleSource(id, parent);
      await this.binding.whenIdle();
      button.closest('li')?.querySelector('.swb-inspector-preview:not([hidden])')?.focus();
    }
  }
});

try {
  const host = window.parent === window ? window.opener : window.parent;
  const connect = host?.document.querySelector(dockSelector)?.[connectInspector];
  connection = connect?.(window, (details) => {
    Object.assign(view.data, details);
  });
  if (connection) {
    const themeClasses = ['ds-darkmode-auto', 'ds-lightmode', 'ds-darkmode'];
    const applyTheme = () => {
      for (const name of themeClasses) {
        document.body.classList.toggle(name, host.document.body.classList.contains(name));
      }
    };
    applyTheme();
    themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(host.document.body, { attributeFilter: ['class'] });
  }
}
catch {
  // A standalone or cross-origin visit has no app inspection to connect to.
}

window.addEventListener('pagehide', () => {
  themeObserver?.disconnect();
  connection?.disconnect();
  view.destroy();
}, { once: true });
