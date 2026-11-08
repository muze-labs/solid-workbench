import { local } from '@muze-labs/solid-workspace';
import {
  StateGraph,
  apps,
  named,
  literal
} from '@muze-labs/solid-app-data/state-rdf.mjs';

// Incomplete workspace text is separate from effective workspace configuration.
export class PreferenceDrafts {
  constructor(owner, source) {
    this.owner = owner || '';
    this.source =
      source ||
      local.indexedDB('solid-apps-preference-drafts', {
        key: this.owner || 'anonymous'
      });
    this.work = Promise.resolve();
  }
  async open() {
    this.graph = new StateGraph(
      await this.source.load(),
      'urn:muze:preferences:drafts:'
    );
  }
  subject(workspace) {
    return named('urn:muze:preferences:draft:' + encodeURIComponent(workspace));
  }
  read(workspace, key) {
    return this.graph.one(this.subject(workspace), apps + key, 'string')?.value;
  }
  write(workspace, key, text) {
    const operation = async () => {
      await this.open();
      this.graph.set(
        this.subject(workspace),
        apps + key,
        text === undefined ? undefined : literal(text)
      );
      await this.source.save(this.graph.write());
    };
    this.work = this.work
      .catch(() => {})
      .then(() => {
        if (globalThis.navigator?.locks) {
          return navigator.locks.request(
            'preferences-drafts:' + this.owner,
            operation
          );
        }
        return operation();
      });
    return this.work;
  }
}
