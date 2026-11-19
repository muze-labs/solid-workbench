import '@muze-labs/solid-app-data/simply-runtime.mjs';
import '@muze-labs/solid-app-data/jaqt-runtime.mjs';
import styles from './contact-list.css' with { type: 'text' };
import sourceContactsList from '../list.html?template' with { type: 'text' };

export const contactList = {
  styles: { 'swb-contact-list': styles },
  templates: { 'contacts-list': sourceContactsList },
  actions: {
    initializeList() {
      const model = simply.model({
        data: [],
        options: { search: '', recipientSearch: '', pickingRecipient: false }
      });
      const owner = this;
      model.addEffect(function () {
        return simply.effect(() => this.state.data);
      });
      model.addEffect(function (input) {
        return simply.effect(() => {
          const options = this.state.options;
          const search = options.pickingRecipient
            ? options.recipientSearch
            : options.search;
          return owner.actions.filterPeople(input.current, search);
        });
      });
      this.data.peopleModel = model;
      this.runtime.emptyListEffect = simply.effect(() => {
        this.data.empty = model.view.current.length ? '' : 'No contacts yet.';
      });
    },
    filterPeople(rows, search) {
      return jaqt
        .from(rows)
        .where((row) => this.actions.matchesPerson(row, search))
        .orderBy({
          label: (left, right) => this.actions.comparePeople(left, right)
        })
        .toArray();
    },
    refreshPeople() {
      const nodes = this.runtime.store.collection.list();
      this.data.peopleModel.state.data = jaqt
        .from(nodes)
        .where((node) => this.api.isPerson(node))
        .select((node) => ({
          id: node.id,
          selection: {
            'aria-current': node.id === this.runtime.selected ? 'page' : null
          },
          label: this.api.profileLabel(node),
          search: Object.values(this.api.readProfile(node))
            .join(' ')
            .toLowerCase()
        }))
        .toArray();
    },
    setSearch(value) {
      this.data.peopleModel.state.options.search = value ?? '';
      return this.actions.publish();
    },
    selectContact(id) {
      this.runtime.selected = id;
      for (const person of this.data.peopleModel.state.data) {
        person.selection['aria-current'] = person.id === id ? 'page' : null;
      }
      const node = id ? this.runtime.store.collection.get(id) : null;
      document.title = node
        ? this.api.profileLabel(node) + ' · Contacts'
        : 'Contacts';
      this.data.visibility = { hidden: node ? null : '' };
      this.runtime.widget.show(node, {
        editable: true,
        showEditButton: false,
        sourceLabel: 'Your private address book',
        onSave: (edits) => this.actions.saveContact(id, edits)
      });
      return this.actions.publish();
    },
    publish() {
      return this.runtime.host.managed
        ?.publish()
        .catch((error) => this.runtime.host.message(error));
    },
    matchesPerson(row, search) {
      return row.search.includes(search.toLowerCase());
    },
    comparePeople(a, b) {
      return a.label.localeCompare(b.label);
    }
  },
  commands: {
    search(element) {
      this.actions.setSearch(element.value);
    },
    select(_element, id) {
      this.actions.selectContact(id);
      if (matchMedia('(max-width: 719px)').matches) {
        this.container.querySelector('.swb-contact-details').scrollIntoView({
          block: 'nearest',
          inline: 'start'
        });
      }
    }
  }
};
