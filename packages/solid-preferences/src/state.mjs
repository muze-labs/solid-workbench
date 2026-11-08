import { local } from '@muze-labs/solid-workspace';
import { loadDocument, saveDocument } from '@muze-labs/solid-app-data';
import {
  StateGraph,
  apps,
  named,
  literal,
  sameTerm
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import { defaults, readPreferences, validatePreferences } from './index.mjs';

const root = 'urn:muze:preferences:';
const resources = [
  'workspaceResource',
  'contactsResource',
  'launcherResource',
  'filesRoot'
];
const subject = (scope) => named(root + scope);
function term(key, value) {
  return resources.includes(key) && value ? named(value) : literal(value);
}
function value(graph, scope, key) {
  const values = graph.values(subject(scope), apps + key);
  if (values.length > 1) {
    throw new Error('preferences-state: Multiple cached values for ' + key);
  }
  const entry = values[0];
  return entry?.termType === 'NamedNode' ? entry.id : entry?.value;
}
function lock(name, operation) {
  if (globalThis.navigator?.locks) {
    return navigator.locks.request(name, operation);
  }
  return operation();
}

// The native cache records interpreted fields, pending choices and their field
// baselines. Remote unknown RDF stays in the freshly loaded authoritative graph.
export class PreferenceState {
  constructor({ owner, url = '', source, onChange = () => {} }) {
    this.owner = owner || '';
    this.url = url;
    this.key = this.owner + '\n' + url;
    this.source =
      source ||
      local.indexedDB('solid-apps-preferences-native', {
        key: this.key
      });
    this.onChange = onChange;
    this.graph = new StateGraph('', root);
  }
  async open() {
    this.graph = new StateGraph(await this.source.load(), root);
    return this.settings();
  }
  settings() {
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        value(this.graph, 'pending', key) ??
          value(this.graph, 'confirmed', key) ??
          fallback
      ])
    );
  }
  drafts() {
    return Object.fromEntries(
      Object.keys(defaults)
        .filter((key) => value(this.graph, 'draft', key) !== undefined)
        .map((key) => [key, value(this.graph, 'draft', key)])
    );
  }
  confirmed(key) {
    return value(this.graph, 'confirmed', key) ?? defaults[key];
  }
  pending() {
    return Object.keys(defaults).filter(
      (key) => value(this.graph, 'pending', key) !== undefined
    );
  }
  async update(operation) {
    return lock('preferences-data:' + this.key, async () => {
      await this.open();
      const previous = this.graph.clone();
      try {
        await operation();
        await this.source.save(this.graph.write());
      }
      catch (error) {
        this.graph = previous;
        throw error;
      }
      this.onChange(this.settings());
      return this.settings();
    });
  }
  async draft(key, text) {
    if (!Object.hasOwn(defaults, key)) {
      throw new Error('preferences-state: Unknown setting.');
    }
    return this.update(() => {
      this.graph.set(subject('draft'), apps + key, literal(text));
    });
  }
  async change(key, text) {
    if (!Object.hasOwn(defaults, key)) {
      throw new Error('preferences-state: Unknown setting.');
    }
    return this.update(() => {
      validatePreferences({ ...this.settings(), [key]: text });
      if (value(this.graph, 'pending', key) === undefined) {
        const baseline = value(this.graph, 'confirmed', key);
        // No confirmed baseline means this field was not available offline.
        this.graph.set(
          subject('baseline'),
          apps + key,
          baseline === undefined ? undefined : term(key, baseline)
        );
      }
      this.graph.set(subject('pending'), apps + key, term(key, text));
      if (value(this.graph, 'draft', key) === text) {
        this.graph.set(subject('draft'), apps + key, undefined);
      }
    });
  }
  async refresh(session) {
    this.assertOwner(session);
    const document = await loadDocument(session.client, this.url, {
      allowMissing: true
    });
    const settings = readPreferences(document);
    await this.update(() => {
      for (const [key, text] of Object.entries(settings)) {
        this.graph.set(subject('confirmed'), apps + key, term(key, text));
      }
    });
    return document;
  }
  assertOwner(session) {
    if (
      !session ||
      session.webId !== this.owner ||
      session.preferencesUrl !== this.url
    ) {
      throw new Error('preferences-state: Connect as this preferences owner.');
    }
  }
  async synchronize(session) {
    this.assertOwner(session);
    return lock('preferences-sync:' + this.key, async () => {
      await this.open();
      if (!this.pending().length) {
        await this.refresh(session);
        return;
      }
      const remote = await loadDocument(session.client, this.url, {
        allowMissing: true
      });
      const current = readPreferences(remote);
      const patch = {};
      await this.update(() => {
        this.conflicts = [];
        for (const key of this.pending()) {
          const desired = value(this.graph, 'pending', key);
          const baseline = value(this.graph, 'baseline', key);
          const unchanged =
            baseline === undefined
              ? remote.missing || current[key] === defaults[key]
              : current[key] === baseline;
          if (!unchanged && current[key] !== desired) {
            this.conflicts.push(key);
          }
          patch[key] = desired;
        }
        for (const [key, text] of Object.entries(current)) {
          this.graph.set(subject('confirmed'), apps + key, term(key, text));
        }
      });
      if (this.conflicts.length) {
        const error = new Error(
          'preferences-state: Changed elsewhere: ' +
            this.conflicts.join(', ') +
            '. Review both choices before retrying.'
        );
        error.code = 'document_conflict';
        throw error;
      }
      const graph = new StateGraph(remote.source || '', this.url);
      for (const [key, text] of Object.entries(patch)) {
        graph.set(
          named(this.url + '#solid-apps'),
          apps + key,
          resources.includes(key) && !text ? undefined : term(key, text)
        );
      }
      // Only matching native terms acknowledge an earlier write. An omitted
      // field's fallback does not mean an explicit choice reached the Pod.
      const remoteGraph = new StateGraph(remote.source || '', this.url);
      const reachedPod = (key) => {
        const terms = remoteGraph.values(
          named(this.url + '#solid-apps'),
          apps + key
        );
        if (resources.includes(key) && !patch[key]) {
          return terms.length === 0;
        }
        return terms.length === 1 && sameTerm(terms[0], term(key, patch[key]));
      };
      if (Object.keys(patch).some((key) => !reachedPod(key))) {
        await saveDocument(session.client, { ...remote, graph });
      }
      await this.update(() => {
        for (const [key, text] of Object.entries(patch)) {
          this.graph.set(subject('confirmed'), apps + key, term(key, text));
          if (value(this.graph, 'pending', key) === text) {
            this.graph.set(subject('pending'), apps + key, undefined);
            this.graph.set(subject('baseline'), apps + key, undefined);
          }
          else {
            this.graph.set(subject('baseline'), apps + key, term(key, text));
          }
        }
      });
    });
  }
  async resolve(key, keepLocal) {
    const shownPending = value(this.graph, 'pending', key);
    const shownRemote = value(this.graph, 'confirmed', key);
    return this.update(() => {
      if (
        shownPending !== value(this.graph, 'pending', key) ||
        shownRemote !== value(this.graph, 'confirmed', key)
      ) {
        throw new Error(
          'preferences-state: These choices changed. Review them again.'
        );
      }
      if (keepLocal) {
        this.graph.set(
          subject('baseline'),
          apps + key,
          term(key, value(this.graph, 'confirmed', key) ?? defaults[key])
        );
      }
      else {
        for (const scope of ['pending', 'baseline', 'draft']) {
          this.graph.set(subject(scope), apps + key, undefined);
        }
      }
    });
  }
}
