import template from '../catalog.html?template' with { type: 'text' };
import styles from './catalog.css' with { type: 'text' };
import manual from '../catalog-manual.html' with { type: 'text' };

export const muzeSolidLauncherCatalog = {
  templates: {
    'muze-solid-launcher-catalog': template,
    'muze-solid-catalog-manual': manual
  },
  styles: { 'muze-solid-launcher-catalog': styles },
  commands: {
    async muzeSolidCatalogOpen() {
      this.actions.muzeSolidDesignOpenDialog(
        this.container.querySelector('.muze-solid-catalog-dialog')
      );
      return this.actions.muzeSolidCatalogOperation(async () => {
        if (!this.runtime.catalog) {
          await this.runtime.host.ready;
          const catalog = new this.api.AppCatalog({
            owner: this.runtime.host.selectedWebId || '',
            session: this.runtime.host.session,
            defaultUrl: new URL('../catalog/index.ttl', location.href).href
          });
          await catalog.open();
          this.runtime.catalog = catalog;
          this.actions.muzeSolidCatalogInitializeList();
          this.actions.muzeSolidCatalogRender();
          await this.actions.muzeSolidCatalogRefresh();
        }
        else {
          this.actions.muzeSolidCatalogRender();
        }
      });
    },
    muzeSolidCatalogClose(button) {
      return this.actions.muzeSolidDesignCloseDialog(button.closest('dialog'));
    },
    muzeSolidCatalogCategory(_button, id, event) {
      this.actions.muzeSolidCatalogSelectCategory(id);
      if (event?.detail !== 0) {
        this.actions.muzeSolidCatalogFocusDetails();
      }
    },
    muzeSolidCatalogInfo(_link, id) {
      const entry = this.runtime.catalogModel.state.data.find(
        (row) => row.id === id
      );
      if (!entry) {
        return;
      }
      this.runtime.catalogInfo = id;
      this.data.muzeSolidCatalogInfo = {
        name: entry.name,
        text: entry.details || entry.description,
        screenshot: {
          src: entry.screenshot || null,
          alt: entry.name + ' app preview',
          hidden: entry.screenshot ? null : ''
        },
        add: {
          'data-simply-value': entry.id,
          'aria-label': 'Add ' + entry.name
        }
      };
      this.actions.muzeSolidCatalogPanels('info');
      this.actions.muzeSolidCatalogFocusDetails('h4');
    },
    async muzeSolidCatalogInfoBack() {
      const id = this.runtime.catalogInfo;
      this.actions.muzeSolidCatalogPanels('apps');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const links = this.container.querySelectorAll(
        '[data-simply-command="muzeSolidCatalogInfo"]'
      );
      for (const link of links) {
        if (link.getAttribute('data-muze-solid-catalog-entry') === id) {
          link.focus();
          break;
        }
      }
    },
    muzeSolidCatalogSearch(input) {
      this.runtime.catalogModel.state.options.search = input.value;
    },
    muzeSolidCatalogRefresh() {
      return this.actions.muzeSolidCatalogOperation(() =>
        this.actions.muzeSolidCatalogRefresh()
      );
    },
    muzeSolidCatalogAddSource(form) {
      const url = form.elements.catalogUrl.value.trim();
      return this.actions.muzeSolidCatalogOperation(async () => {
        const source = await this.runtime.catalog.addSource(url);
        form.reset();
        await this.runtime.catalog.refresh(source);
        this.actions.muzeSolidCatalogRender();
      });
    },
    muzeSolidCatalogRemoveSource(_button, url) {
      return this.actions.muzeSolidCatalogOperation(async () => {
        await this.runtime.catalog.removeSource(url);
        this.actions.muzeSolidCatalogRender();
      });
    },
    muzeSolidCatalogAdd(_button, id) {
      return this.actions.muzeSolidCatalogOperation(async () => {
        this.actions.swb_requireOwner();
        const entry = this.runtime.catalogModel.state.data.find(
          (row) => row.id === id
        );
        if (!entry) {
          throw new Error('launcher/catalog: App is no longer listed.');
        }
        this.runtime.catalog.session = this.runtime.host.session;
        const description = await this.runtime.catalog.manifest(entry.manifest);
        const alreadyAdded = this.runtime.store.collection
          .list()
          .some(
            (node) =>
              this.api.idOf(
                this.api.valueAt(node, this.api.prefixes.schema + 'url')
              ) === description.url
          );
        if (!alreadyAdded) {
          await this.actions.addShortcut({
            manifest: entry.manifest,
            description,
            url: description.url,
            name: description.name,
            mode: '',
            anonymous: description.anonymous,
            icon: ''
          });
        }
        this.data.muzeSolidCatalogStatus = alreadyAdded
          ? description.name + ' is already in your apps.'
          : description.name + ' added to your apps.';
        this.runtime.host.notify(this.data.muzeSolidCatalogStatus);
        await this.actions.muzeSolidDesignCloseDialog(
          this.container.querySelector('.muze-solid-catalog-dialog')
        );
      });
    }
  },
  actions: {
    muzeSolidCatalogPanels(panel) {
      for (const name of ['Apps', 'Manual', 'Sources', 'Info']) {
        this.data['muzeSolidCatalog' + name + 'Panel'] = {
          hidden: name.toLowerCase() === panel ? null : ''
        };
      }
    },
    async muzeSolidCatalogFocusDetails(heading = 'h3') {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const pane = this.container.querySelector('.muze-solid-catalog-details');
      pane.scrollIntoView({ block: 'nearest' });
      pane.querySelector(heading).focus({ preventScroll: true });
    },
    muzeSolidCatalogSelectCategory(id) {
      const choices = this.data.muzeSolidCatalogCategories;
      const choice = choices.find((entry) => entry.id === id) || choices[0];
      const selected = choice?.id || 'all';
      this.runtime.catalogCategory = selected;
      if (this.runtime.catalogModel) {
        this.runtime.catalogModel.state.options.category = selected;
      }
      // Update attributes in place so category activation preserves focus.
      for (const entry of choices) {
        entry.attributes['aria-current'] =
          entry.id === selected ? 'page' : null;
        entry.attributes.tabindex = entry.id === selected ? '0' : '-1';
      }
      this.data.muzeSolidCatalogCategoryTitle = choice?.label || 'All apps';
      this.actions.muzeSolidCatalogPanels(
        selected === 'manual' || selected === 'sources' ? selected : 'apps'
      );
    },
    muzeSolidCatalogRenderCategories() {
      const entries = this.runtime.catalogModel?.state.data || [];
      const names = new Set(entries.map((entry) => entry.category));
      const categories = this.api
        .from(
          [...names].map((label) => ({
            id: 'category:' + label,
            label
          }))
        )
        .orderBy({ label: (a, b) => a.label.localeCompare(b.label) })
        .toArray();
      const choices = [
        { id: 'all', label: 'All apps' },
        ...categories,
        { id: 'manual', label: 'Add a link manually' },
        { id: 'sources', label: 'Catalog sources' }
      ];
      const selected = this.runtime.catalogCategory || 'all';
      this.data.muzeSolidCatalogCategories = choices.map((choice) => ({
        ...choice,
        attributes: {
          class: 'ds-button swb-section-choice',
          'data-muze-solid-catalog-category': choice.id,
          'aria-current': choice.id === selected ? 'page' : null,
          tabindex: choice.id === selected ? '0' : '-1'
        }
      }));
      this.data.muzeSolidCatalogCategoryTitle =
        choices.find((choice) => choice.id === selected)?.label || 'All apps';
    },
    async muzeSolidCatalogOperation(action) {
      if (this.runtime.catalogBusy) {
        return;
      }
      this.runtime.catalogBusy = true;
      this.data.muzeSolidCatalogBusy = { disabled: '' };
      this.data.muzeSolidCatalogStatus = 'Loading…';
      try {
        await action();
        if (this.data.muzeSolidCatalogStatus === 'Loading…') {
          this.data.muzeSolidCatalogStatus =
            'Choose an app to add to Workbench.';
        }
      }
      catch (error) {
        this.data.muzeSolidCatalogStatus = error.message;
      }
      finally {
        this.runtime.catalogBusy = false;
        this.data.muzeSolidCatalogBusy = { disabled: null };
      }
    },
    async muzeSolidCatalogRefresh() {
      const catalog = this.runtime.catalog;
      catalog.session = this.runtime.host.session;
      // A failed source records its own status and keeps the previous entries.
      await Promise.all(
        [...catalog.sources.keys()].map((url) => catalog.refresh(url))
      );
      this.actions.muzeSolidCatalogRender();
    },
    muzeSolidCatalogRender() {
      const sources = [...this.runtime.catalog.sources.values()];
      this.data.muzeSolidCatalogSources = sources.map((source) => ({
        id: source.url,
        url: source.url,
        status: source.status
      }));
      this.runtime.catalogModel.state.data = sources.flatMap((source) =>
        source.entries.map((entry) => ({
          ...entry,
          image: { src: entry.icon },
          addAttributes: { 'aria-label': 'Add ' + entry.name },
          infoAttributes: {
            'aria-label': 'More info about ' + entry.name,
            'data-muze-solid-catalog-entry': entry.id
          }
        }))
      );
      this.actions.muzeSolidCatalogRenderCategories();
      this.actions.muzeSolidCatalogSelectCategory(
        this.runtime.catalogCategory || 'all'
      );
    },
    muzeSolidCatalogInitializeList() {
      const owner = this;
      const list = this.api.model({
        data: [],
        options: { search: '', category: this.runtime.catalogCategory || 'all' }
      });
      list.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      list.addEffect(function (input) {
        return owner.api.effect(() =>
          owner.api
            .from(input.current)
            .where((entry) =>
              owner.actions.muzeSolidCatalogMatches(
                entry,
                this.state.options.search,
                this.state.options.category
              )
            )
            .orderBy({ name: owner.actions.muzeSolidCatalogCompare })
            .toArray()
        );
      });
      this.runtime.catalogModel = list;
      this.runtime.catalogEffect = this.api.effect(() => {
        this.data.muzeSolidCatalogApps = list.view.current;
        this.data.muzeSolidCatalogEmpty = list.view.current.length
          ? ''
          : 'No apps found. Try another search or catalog source.';
      });
    },
    muzeSolidCatalogCompare(a, b) {
      return a.name.localeCompare(b.name);
    },
    muzeSolidCatalogMatches(entry, search, category) {
      const inCategory =
        category === 'all' || category === 'category:' + entry.category;
      return (
        inCategory &&
        (entry.name + ' ' + entry.description)
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );
    }
  }
};
