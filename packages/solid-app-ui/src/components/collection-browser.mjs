import '@muze-labs/solid-app-data/simply-runtime.mjs';
import template from '../collection-browser.html?template' with { type: 'text' };
import styles from '../collection-browser.css' with { type: 'text' };
import { solidListDetails } from '@muze-labs/solid-design';

export const muzeSolidCollectionBrowser = {
  templates: { 'muze-solid-collection-browser': template },
  styles: { 'muze-solid-collection-browser': styles },
  components: { solidListDetails },
  commands: {
    muzeSolidCollectionChoose(element, id) {
      const host = this.api.muzeSolidCollectionBrowser;
      return this.commands.call(
        id === 'new' ? host.create : host.select,
        element,
        id
      );
    },
    muzeSolidCollectionEntryAction(element, id) {
      const action = this.api.muzeSolidCollectionBrowser.entryAction;
      if (action) {
        return this.commands.call(action, element, id);
      }
    },
    muzeSolidCollectionCategory(_element, id, event) {
      this.runtime.muzeSolidCollectionBrowser.entries.state.options.group = id;
      const host = this.api.muzeSolidCollectionBrowser;
      this.actions[host.project]();
      this.actions[host.route]();
      if (event?.detail > 0) {
        requestAnimationFrame(() =>
          this.container
            .querySelector('.muze-solid-collection-browser-details')
            .scrollIntoView({ block: 'nearest' })
        );
      }
    }
  },
  actions: {
    muzeSolidCollectionInitialize() {
      const browser = (this.runtime.muzeSolidCollectionBrowser ||= {});
      this.data.muzeSolidCollectionAppearance = {
        'data-layout': this.api.muzeSolidCollectionBrowser.cards
          ? 'cards'
          : 'list'
      };
      if (!browser.entries) {
        const projection = simply.model({
          data: [],
          options: { search: '', group: '' }
        });
        projection.addEffect(function () {
          return simply.effect(() => this.state.data);
        });
        projection.addEffect(function (input) {
          return simply.effect(() => {
            const search = this.state.options.search.toLocaleLowerCase();
            const group = this.state.options.group;
            return input.current
              .filter(
                (entry) =>
                  !entry.deleted &&
                  (!group || entry.groups.includes(group)) &&
                  entry.title.toLocaleLowerCase().includes(search)
              )
              .sort((a, b) => a.title.localeCompare(b.title));
          });
        });
        browser.entries = projection;
        simply.effect(() => {
          this.data.muzeSolidCollectionManagementEntries =
            projection.view.current.filter(
              (entry) => entry.management !== false
            );
          const category = projection.state.options.group;
          const entries = projection.view.current.map((entry) => ({
            previewVisibility: { hidden: '' },
            previewImage: { hidden: '', src: null },
            previewTitle: '',
            previewBody: '',
            detail: '',
            localStatusAttributes: { hidden: '' },
            localStatusIcon: { href: null },
            entryActionVisibility: { hidden: '' },
            entryActionLabel: '',
            entryActionAttributes: {},
            ...entry,
            iconAttributes: { hidden: '' },
            linkAttributes: {
              href: this.actions[this.api.muzeSolidCollectionBrowser.link](
                entry.document,
                false,
                category
              ),
              'data-muze-solid-collection-entry': entry.id
            }
          }));
          const creationEntry = {
            id: 'new',
            title: this.api.muzeSolidCollectionBrowser.newLabel,
            previewVisibility: {
              hidden: this.api.muzeSolidCollectionBrowser.cards ? null : ''
            },
            previewImage: { hidden: '', src: null },
            previewTitle: this.api.muzeSolidCollectionBrowser.cards ? '+' : '',
            previewBody: this.api.muzeSolidCollectionBrowser.cards
              ? this.api.muzeSolidCollectionBrowser.newLabel
              : '',
            detail: '',
            localStatusAttributes: { hidden: '' },
            localStatusIcon: { href: null },
            entryActionVisibility: { hidden: '' },
            entryActionLabel: '',
            entryActionAttributes: {},
            iconAttributes: { hidden: null },
            linkAttributes: {
              href: this.actions[this.api.muzeSolidCollectionBrowser.link](
                '',
                true,
                category
              ),
              'data-muze-solid-collection-entry': 'new',
              'aria-label': this.api.muzeSolidCollectionBrowser.newLabel
            }
          };
          const rows = this.api.muzeSolidCollectionBrowser.cards
            ? [creationEntry, ...entries]
            : [...entries, creationEntry];
          simply.untracked(() => {
            const previous = browser.entryRows || new Map();
            const next = rows.map((row) => {
              const existing = previous.get(row.id);
              if (existing) {
                Object.assign(existing, row);
                return existing;
              }
              return row;
            });
            const keys = JSON.stringify(rows.map((row) => row.id));
            if (browser.entryKeys !== keys) {
              browser.entryKeys = keys;
              this.data.muzeSolidCollectionEntries = next;
            }
            browser.entryRows = new Map(
              this.data.muzeSolidCollectionEntries.map((row) => [row.id, row])
            );
          });
        });
      }
      if (!browser.groups) {
        const groups = simply.model({ data: [], options: {} });
        groups.addEffect(function () {
          return simply.effect(() => this.state.data);
        });
        groups.addEffect(function (input) {
          return simply.effect(() =>
            input.current
              .filter((group) => !group.deleted)
              .sort((a, b) => a.title.localeCompare(b.title))
          );
        });
        browser.groups = groups;
        simply.effect(() => {
          const selected = browser.entries.state.options.group;
          const options = groups.view.current.map((group) => ({
            option: {
              value: group.id,
              label: group.title
            }
          }));
          this.data.muzeSolidCollectionGroups = [
            {
              option: {
                value: '',
                label: 'All groups',
                selected: selected ? null : ''
              }
            },
            ...options.map((group) => ({
              option: {
                ...group.option,
                selected: group.option.value === selected ? '' : null
              }
            }))
          ];
          this.data.muzeSolidCollectionEntryGroups = [
            { option: { value: '', label: 'Choose group' } },
            ...options
          ];
          const categories = [
            { id: '', title: this.api.muzeSolidCollectionBrowser.allLabel },
            ...groups.view.current
          ];
          const categoryKeys = JSON.stringify(
            categories.map((category) => [category.id, category.title])
          );
          // Keep the native category links when only selection changes. Replacing
          // the rows here would remove the focused link from the document.
          if (browser.categoryKeys !== categoryKeys) {
            browser.categoryKeys = categoryKeys;
            this.data.muzeSolidCollectionCategories = categories.map(
              (category) => ({ ...category, attributes: {} })
            );
          }
          for (let index = 0; index < categories.length; index += 1) {
            const category = categories[index];
            const attributes =
              this.data.muzeSolidCollectionCategories[index].attributes;
            attributes.href = this.actions[
              this.api.muzeSolidCollectionBrowser.link
            ]('', false, category.id);
            attributes['aria-current'] =
              category.id === selected ? 'page' : null;
            attributes['data-muze-solid-collection-category'] = category.id;
          }
          this.data.muzeSolidCollectionCategoryTitle =
            categories.find((category) => category.id === selected)?.title ||
            this.api.muzeSolidCollectionBrowser.allLabel;
        });
      }
      return browser;
    }
  }
};
