import template from './settings.html?template' with { type: 'text' };
// App-owned sections consumed by the Preferences application.
export const settingsSections = [
  {
    id: 'contacts-storage',
    label: 'Contacts \u00b7 Address book'
  }
];

export const swbContactsSettings = {
  templates: { 'swb-contacts-settings': template }
};
