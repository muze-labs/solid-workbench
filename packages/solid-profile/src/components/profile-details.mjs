import '@muze-labs/solid-app-data/simply-runtime.mjs';
import '@muze-labs/solid-app-data/jaqt-runtime.mjs';
import styles from './profile-details.css' with { type: 'text' };
import editorTemplate from '../editor.html' with { type: 'text' };

export const profileDetails = {
  styles: { 'swb-profile-details': styles },
  templates: { 'profile-editor': editorTemplate },
  actions: {
    initializeProfileDetails() {
      const owner = this;
      const list = simply.model({
        data: this.api.profile.fields,
        options: { values: {} }
      });
      list.addEffect(function (input) {
        return simply.effect(() => {
          const values = this.state.options.values;
          return jaqt
            .from(input.current)
            .where((field) => owner.actions.hasProfileDetail(field, values))
            .select((field) => owner.actions.profileDetail(field, values))
            .toArray();
        });
      });
      this.runtime.profile.details = list;
      this.runtime.profile.detailEffect = simply.effect(() => {
        this.data.profile.details = list.view.current;
      });
    },
    showProfile(subject, settings = {}) {
      this.runtime.profile.subject = subject;
      this.runtime.profile.options = settings;
      const values = subject
        ? this.api.profile.readProfile(subject)
        : Object.fromEntries(
            this.api.profile.fields.map((field) => [field.name, ''])
          );
      this.runtime.profile.values = values;
      this.runtime.profile.draftValues = { ...values };
      this.runtime.profile.details.state.options.values = values;
      Object.assign(this.data.profile, values, {
        visibility: { hidden: subject ? null : '' },
        empty: subject ? '' : this.runtime.profile.emptyText,
        detailsVisibility: { hidden: null },
        formVisibility: { hidden: '' },
        // A host may place its edit action beside other app-owned actions.
        editVisibility: {
          hidden:
            subject && settings.editable && settings.showEditButton !== false
              ? null
              : ''
        },
        title: subject ? this.api.profile.profileLabel(subject) : '',
        id: subject?.id || '',
        sourceLabel: settings.sourceLabel || '',
        noDetails: Object.values(values).some(Boolean)
          ? ''
          : 'No profile details yet.',
        error: ''
      });
    },
    cleanupProfile() {
      simply.destroy(this.runtime.profile.detailEffect);
      for (const signal of this.runtime.profile.details.effects.slice(1)) {
        simply.destroy(signal);
      }
    },
    hasProfileDetail(field, values) {
      return Boolean(values[field.name]);
    },
    profileDetail(field, values) {
      return { label: field.label, value: values[field.name] };
    }
  }
};
