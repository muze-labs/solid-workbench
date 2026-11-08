import template from '../sections.html?template' with { type: 'text' };
import { settingsSections as workbench } from '../../../launcher/src/settings-sections.mjs';
import { settingsSections as contacts } from '../../../contacts/src/settings-sections.mjs';
import { settingsSections as files } from '../../../files/src/settings-sections.mjs';
import { settingsSections as profile } from '../../../profile/src/settings-sections.mjs';

const common = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'language', label: 'Language' },
  { id: 'opening', label: 'Opening applications' }
];
const contributions = { workbench, contacts, files, profile };
export const sections = {
  templates: { 'swb-preferences-sections': template },
  api: { common, contributions },
  events: {
    swbSectionFocus: {
      target() {
        return this.container;
      },
      type: 'focusin',
      action: 'swb_focusSection'
    }
  },
  commands: {
    swb_chooseSection(_button, id, event) {
      this.actions.swb_selectSection(id);
      // Keyboard activation stays in the section list; Tab enters its controls.
      if (event?.detail === 0) {
        return;
      }
      const details = this.container.querySelector('.ds-panels-details');
      details.scrollIntoView({ block: 'nearest' });
      details.querySelector('h2').focus({ preventScroll: true });
    },
    async swb_chooseApp(select) {
      this.data.swb_app = select.value;
      await this.actions.swb_loadWorkspace();
      this.actions.swb_selectSection('appearance');
    }
  },
  actions: {
    swb_focusSelectedSection() {
      this.container
        .querySelector(
          '[data-muze-solid-design-sections] [aria-current="page"]'
        )
        ?.focus();
    },
    swb_focusSection(event) {
      const button = event.target.closest(
        '[data-muze-solid-design-sections] button'
      );
      if (!button || !this.container.contains(button)) {
        return;
      }
      const id = button.dataset.muzeSolidDesignSection;
      for (const entry of this.data.swb_sections) {
        entry.attributes.tabindex = entry.id === id ? '0' : '-1';
      }
    },
    swb_selectSection(id) {
      this.runtime.section = id;
      const entries = [
        ...this.api.common,
        ...this.api.contributions[this.data.swb_app]
      ];
      const current = this.data.swb_sections;
      const sameSections =
        current.length === entries.length &&
        entries.every((entry, index) => entry.id === current[index].id);
      if (!sameSections) {
        this.data.swb_sections = entries.map((entry) => ({
          ...entry,
          attributes: {}
        }));
      }
      // Preserve row objects so an activated keyboard button keeps its focus.
      for (const entry of this.data.swb_sections) {
        entry.attributes['aria-current'] = entry.id === id ? 'page' : null;
        entry.attributes.class =
          'ds-button ds-nav swb-section-choice' + (entry.id === id ? ' ds-selected' : '');
        entry.attributes.tabindex = entry.id === id ? '0' : '-1';
        entry.attributes['data-muze-solid-design-section'] = entry.id;
      }
      this.data.swb_workspaceVisibility = {
        hidden:
          this.data.swb_app === 'workbench' &&
          this.runtime.directory &&
          !this.api.common.some((entry) => entry.id === id)
            ? null
            : ''
      };
      this.data.swb_scope = this.api.common.some((entry) => entry.id === id)
        ? 'These settings apply across all apps and workspaces.'
        : this.runtime.callerWorkspace || this.data.swb_app === 'workbench'
          ? 'These settings belong to the selected workspace.'
          : 'These are the defaults for this application.';
      const panels = {};
      for (const sections of [
        this.api.common,
        ...Object.values(this.api.contributions)
      ]) {
        for (const section of sections) {
          panels[section.id] = { hidden: section.id === id ? null : '' };
        }
      }
      this.data.swb_panels = panels;
      this.data.swb_sectionTitle =
        entries.find((entry) => entry.id === id)?.label || 'Appearance';
    }
  }
};
