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
import {
  providerCapabilities,
  providerChoice,
  setProviderChoice,
  sameProvider,
  writeProvider
} from './providers.mjs';

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
  if (Object.hasOwn(providerCapabilities, key) && scope !== 'draft' && entry) {
    return entry.termType === 'NamedNode' ? providerChoice(graph, entry) : null;
  }
  return entry?.termType === 'NamedNode' ? entry.id : entry?.value;
}
function put(graph, scope, key, text) {
  if (Object.hasOwn(providerCapabilities, key) && scope !== 'draft') {
    const suffix = key === 'browseProvider' ? 'provider' : key;
    const node = named(root + scope + ':' + suffix);
    setProviderChoice(graph, node, text);
    graph.set(
      subject(scope),
      apps + key,
      text === undefined ? undefined : text === null ? literal('') : node
    );
    return;
  }
  graph.set(
    subject(scope),
    apps + key,
    text === undefined ? undefined : term(key, text)
  );
}
function equal(key, left, right) {
  return Object.hasOwn(providerCapabilities, key)
    ? sameProvider(left, right) : left === right;
}
function lock(name, operation) {
  if (globalThis.navigator?.locks) {
    return navigator.locks.request(name, operation);
  }
  return operation();
}

// Cache native fields and baselines; remote graphs retain unknown RDF.
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
      Object.entries(defaults).map(([key, fallback]) => {
        const pending = value(this.graph, 'pending', key);
        const confirmed = value(this.graph, 'confirmed', key);
        const effective = pending === undefined ? confirmed : pending;
        return [key, effective === undefined ? fallback : effective];
      })
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
        put(this.graph, 'baseline', key, baseline);
      }
      put(this.graph, 'pending', key, text);
      const draft = value(this.graph, 'draft', key);
      if (draft === text || (Object.hasOwn(providerCapabilities, key) &&
          (text === null || draft === text.url))) {
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
        put(this.graph, 'confirmed', key, text);
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
              ? remote.missing || equal(key, current[key], defaults[key])
              : equal(key, current[key], baseline);
          if (!unchanged && !equal(key, current[key], desired)) {
            this.conflicts.push(key);
          }
          patch[key] = desired;
        }
        for (const [key, text] of Object.entries(current)) {
          put(this.graph, 'confirmed', key, text);
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
      const remoteGraph = new StateGraph(remote.source || '', this.url);
      const graph = remoteGraph.clone();
      for (const [key, text] of Object.entries(patch)) {
        if (Object.hasOwn(providerCapabilities, key)) {
          writeProvider(graph, this.url, text, providerCapabilities[key]);
          continue;
        }
        graph.set(
          named(this.url + '#solid-apps'),
          apps + key,
          resources.includes(key) && !text ? undefined : term(key, text)
        );
      }
      // A fallback is not evidence of an acknowledged native write.
      const reachedPod = (key) => {
        if (Object.hasOwn(providerCapabilities, key)) {
          return sameProvider(current[key], patch[key]);
        }
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
          put(this.graph, 'confirmed', key, text);
          if (equal(key, value(this.graph, 'pending', key), text)) {
            put(this.graph, 'pending', key, undefined);
            put(this.graph, 'baseline', key, undefined);
          }
          else {
            put(this.graph, 'baseline', key, text);
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
        !equal(key, shownPending, value(this.graph, 'pending', key)) ||
        !equal(key, shownRemote, value(this.graph, 'confirmed', key))
      ) {
        throw new Error(
          'preferences-state: These choices changed. Review them again.'
        );
      }
      if (keepLocal) {
        put(this.graph, 'baseline', key, this.confirmed(key));
      }
      else {
        for (const scope of ['pending', 'baseline', 'draft']) {
          put(this.graph, scope, key, undefined);
        }
      }
    });
  }
}
