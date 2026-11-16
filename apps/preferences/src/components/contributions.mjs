import template from './contributions.html?template' with { type: 'text' };
import styles from './contributions.css' with { type: 'text' };
import { EmbeddedView } from '@muze-labs/solid-app-data/embedded-view.mjs';
import { WorkspaceBroker } from '@muze-labs/solid-app-data/workspace-broker.mjs';
import { launchUrl } from '@muze-labs/solid-app-data/launch.mjs';
import {
  preferenceSections,
  editPreferenceSectionCapability
} from '@muze-labs/solid-app-data/preference-sections.mjs';

export const muzeSolidPreferenceContributions = {
  templates: { 'muze-solid-preference-contributions': template },
  styles: { 'muze-solid-preference-contributions': styles },
  api: {
    EmbeddedView,
    WorkspaceBroker,
    launchUrl,
    preferenceSections,
    editPreferenceSectionCapability
  },
  data: {
    swb_contributionVisibility: { hidden: '' },
    swb_contributionFrame: { src: 'about:blank', hidden: '' },
    swb_contributionStatus: '',
    swb_contributionRecovery: { hidden: '' }
  },
  events: {
    swbContributionMessage: {
      target: 'window',
      type: 'message',
      action: 'swb_attachContribution'
    }
  },
  commands: {
    async swb_retryContribution() {
      const section = this.runtime.contributionSection;
      if (section && (await this.actions.swb_closeContribution())) {
        await this.actions.swb_openContribution(section);
      }
    },
    async swb_discardContribution() {
      if (!this.runtime.contributionFailed) {
        return;
      }
      if (
        window.confirm(
          'Discard this unavailable section? Unsaved edits may be lost.'
        )
      ) {
        await this.actions.swb_closeContribution(true);
        this.actions.swb_selectSection('appearance');
      }
    }
  },
  actions: {
    swb_attachContribution(event) {
      this.runtime.contributionView?.receive(event);
    },
    async swb_closeContribution(discard = false) {
      const view = this.runtime.contributionView;
      if (!view) {
        return true;
      }
      try {
        if (!(await view.close({ discard }))) {
          return false;
        }
      }
      catch (error) {
        this.runtime.contributionFailed = true;
        this.data.swb_contributionRecovery = { hidden: null };
        this.data.swb_contributionStatus = error.message;
        return false;
      }
      this.runtime.contributionBroker?.dispose();
      this.runtime.contributionBroker = null;
      this.runtime.contributionView = null;
      this.runtime.contributionFailed = false;
      this.data.swb_contributionRecovery = { hidden: '' };
      this.data.swb_contributionVisibility = { hidden: '' };
      return true;
    },
    async swb_openContribution(section) {
      const host = this.runtime.host;
      const owner = host.selectedWebId || '';
      const url = this.api.launchUrl(section.url, { webId: owner });
      this.runtime.contributionSection = section;
      this.runtime.contributionFailed = false;
      this.data.swb_contributionRecovery = { hidden: '' };
      this.data.swb_contributionVisibility = { hidden: null };
      const broker = new this.api.WorkspaceBroker({
        embeddedProviders: [
          {
            capability: this.api.editPreferenceSectionCapability,
            url
          }
        ],
        editPreferences: async (record, input) => {
          if (
            this.runtime.contributionBroker !== broker ||
            record.capability !== this.api.editPreferenceSectionCapability ||
            input?.owner !== owner ||
            host.selectedWebId !== owner ||
            !this.runtime.callerWorkspace ||
            !['read', 'settings'].includes(input.operation)
          ) {
            throw new Error(
              'preferences: Section operation is not authorized.'
            );
          }
          const keys = section.workspaceKeys || [];
          if (
            input.operation === 'settings' &&
            Object.keys(input.values || {}).some((key) => !keys.includes(key))
          ) {
            throw new Error('preferences: Setting is outside this section.');
          }
          const snapshot = await this.actions.swb_callWorkspace({
            operation: input.operation,
            id: this.runtime.callerWorkspace,
            revision: input.revision,
            ...(input.operation === 'settings' ? { values: input.values } : {})
          });
          const entry = snapshot.entries.find(
            (item) => item.id === this.runtime.callerWorkspace
          );
          if (!entry) {
            throw new Error('preferences: Workspace no longer exists.');
          }
          return {
            revision: snapshot.revision,
            pending: snapshot.pending,
            settings: Object.fromEntries(
              keys.map((key) => [key, entry.settings[key] || ''])
            )
          };
        }
      });
      this.runtime.contributionBroker = broker;
      const frame = this.container.querySelector(
        '.muze-solid-preferences-contribution'
      );
      const view = new this.api.EmbeddedView({
        broker,
        frame,
        capability: this.api.editPreferenceSectionCapability,
        change: (state) => {
          if (this.runtime.contributionView !== view) {
            return;
          }
          this.data.swb_contributionStatus = state.status;
          if (state.src) {
            this.data.swb_contributionFrame = {
              src: state.src,
              hidden: state.closed ? '' : null,
              title: section.label,
              'aria-busy': state.closed ? 'false' : 'true'
            };
          }
          if (state.ready) {
            this.data.swb_contributionFrame['aria-busy'] = 'false';
            this.data.swb_contributionStatus = '';
          }
          if (state.failed) {
            this.runtime.contributionFailed = true;
            this.data.swb_contributionRecovery = { hidden: null };
          }
        }
      });
      this.runtime.contributionView = view;
      try {
        await view.open(url, {
          owner,
          section: section.id,
          workspace: this.runtime.callerWorkspace || '',
          appearance: {},
          presentation: {
            interaction: 'interactive',
            geometry: 'scroll',
            visible: true,
            width: frame.clientWidth,
            height: frame.clientHeight
          }
        });
      }
      catch (error) {
        if (this.runtime.contributionView === view) {
          this.data.swb_contributionStatus = error.message;
        }
      }
    }
  }
};
