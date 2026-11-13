import {
  oldm,
  loadDocument,
  createSolidMetroClient,
  httpUrl,
  prefixes
} from '@muze-labs/solid-app-data';
import { local } from '@muze-labs/solid-workspace';
import {
  StateGraph,
  named,
  literal,
  apps
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import { applicationManifest } from './manifests.mjs';

const schema = prefixes.schema;
const root = named('urn:muze:solid-workbench:catalogs');
const sourcePredicate = apps + 'catalogSource';
const initializedPredicate = apps + 'catalogInitialized';

export function catalogEntries(text, url) {
  const graph = new StateGraph(text, url);
  const index = named(url);
  return graph.values(index, schema + 'hasPart').map((subject) => {
    const name = graph.one(subject, schema + 'name', 'string', true).value;
    const manifest = graph.one(subject, schema + 'subjectOf', 'iri', true).id;
    const icon = graph.one(subject, schema + 'image', 'iri', true).id;
    const description = graph.one(subject, schema + 'description', 'string');
    const category = graph.one(
      subject,
      schema + 'applicationCategory',
      'string'
    );
    const details = graph.one(subject, schema + 'text', 'string');
    const screenshot = graph.one(subject, schema + 'screenshot', 'iri');
    return {
      id: url + '|' + subject.id,
      source: url,
      name,
      manifest: httpUrl(manifest),
      icon: httpUrl(icon),
      description: description?.value || '',
      category: category?.value || 'Other apps',
      details: details?.value || '',
      screenshot: screenshot ? httpUrl(screenshot.id) : ''
    };
  });
}

// Device-local catalog choices and native RDF caches. Shortcut storage stays
// in the existing collection; catalog failures never rewrite that collection.
export class AppCatalog {
  constructor({ owner = '', defaultUrl, session, storage } = {}) {
    this.session = session;
    this.defaultUrl = httpUrl(defaultUrl);
    this.storage =
      storage ||
      ((key) =>
        local.indexedDB('solid-workbench-app-catalogs', {
          key: owner + '|' + key
        }));
    this.config = this.storage('sources');
    this.graph = new StateGraph();
    this.sources = new Map();
  }
  async open() {
    this.graph = new StateGraph(await this.config.load());
    if (!this.graph.values(root, initializedPredicate).length) {
      this.graph.add(root, sourcePredicate, named(this.defaultUrl));
      this.graph.set(
        root,
        initializedPredicate,
        literal(true, 'http://www.w3.org/2001/XMLSchema#boolean')
      );
      await this.config.save(this.graph.write());
    }
    for (const term of this.graph.values(root, sourcePredicate)) {
      const url = httpUrl(term.id);
      const cached = await this.storage(url).load();
      this.sources.set(url, {
        url,
        entries: cached ? catalogEntries(cached, url) : [],
        status: cached ? 'Saved on this device' : 'Not loaded yet'
      });
    }
  }
  async addSource(url) {
    url = httpUrl(url);
    if (this.sources.has(url)) {
      return url;
    }
    const next = this.graph.clone();
    next.add(root, sourcePredicate, named(url));
    await this.config.save(next.write());
    this.graph = next;
    this.sources.set(url, { url, entries: [], status: 'Not loaded yet' });
    return url;
  }
  async removeSource(url) {
    const next = this.graph.clone();
    next.set(root, sourcePredicate);
    for (const current of this.sources.keys()) {
      if (current !== url) {
        next.add(root, sourcePredicate, named(current));
      }
    }
    await this.config.save(next.write());
    this.graph = next;
    this.sources.delete(url);
  }
  client() {
    return (
      this.session?.client ||
      createSolidMetroClient(location.origin, {
        oidc: false,
        oldm: false
      })
    );
  }
  async refresh(url) {
    const source = this.sources.get(url);
    try {
      const document = await loadDocument(this.client(), url);
      const entries = catalogEntries(document.source, url);
      // Write resolved RDF so relative catalog links remain meaningful offline.
      const turtle = new StateGraph(document.source, url).write();
      await this.storage(url).save(turtle);
      source.entries = entries;
      source.status = 'Up to date';
    }
    catch (error) {
      source.status =
        (source.entries.length ? 'Showing saved apps. ' : 'Unavailable. ') +
        error.message;
    }
  }
  async manifest(url) {
    const cache = this.storage('manifest|' + httpUrl(url));
    let document;
    try {
      document = await loadDocument(this.client(), url);
    }
    catch (error) {
      const text = await cache.load();
      if (!text) {
        throw error;
      }
      document = {
        graph: oldm.context({ prefixes }).parse(text, url, 'text/turtle')
      };
    }
    const result = applicationManifest(document);
    if (document.source !== undefined) {
      await cache.save(new StateGraph(document.source, url).write());
    }
    return result;
  }
}
