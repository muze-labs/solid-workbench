import template from './settings.html?template' with { type: 'text' };
// App-owned sections consumed by the Preferences application.
export const settingsSections = [
  {
    id: 'files-storage',
    label: 'Files \u00b7 Storage'
  }
];

export const swbFilesSettings = {
  templates: { 'swb-files-settings': template }
};
