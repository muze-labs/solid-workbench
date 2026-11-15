import { loadDocument, saveDocument, httpUrl } from './index.mjs';
import { sameGraph } from './state-rdf.mjs';

// One live document's save state, over the existing native storage/HTTP APIs.
// Apps provide content(), persist() and baselineFor(url). They keep their RDF
// model, recovery metadata and Open/New policy. Optional creationFor(url) stores
// a native creation intent belonging to that recovery copy, never a URL alone.
export class DocumentSession {
  constructor({
    owner = '',
    messages = {},
    requestOptions = {},
    keepBaselineWithETag = false
  } = {}) {
    this.owner = owner;
    this.messages = messages;
    this.requestOptions = requestOptions;
    this.keepBaselineWithETag = keepBaselineWithETag;
    this.pending = Promise.resolve();
    this.revision = 0;
  }
  requireAccount(session, message = this.messages.account) {
    if (!session || session.webId !== this.owner) {
      throw new Error(message ||
        'document-session: Connect with this document’s account first.');
    }
  }
  changed() {
    this.revision += 1;
    this.dirty = true;
  }
  enqueueRecoveryWrite(write) {
    // A failed write remains visible to its caller; a later explicit edit/save
    // may retry local storage instead of inheriting a permanently rejected queue.
    this.pending = this.pending.catch(() => {}).then(write);
    return this.pending;
  }
  async save(session, address, asNew = false) {
    this.requireAccount(session);
    const url = httpUrl(address);
    if (new URL(url).hash) {
      throw new Error(this.messages.address ||
        'document-session: Use a document URL without a fragment.');
    }
    await this.persist();
    const revision = this.revision;
    const graph = this.content();
    const baseline = this.baselineFor(url);
    const creation = this.creationFor?.(url);
    let document;
    if (!asNew && this.url === url) {
      document = {
        url,
        graph,
        etag: this.etag,
        missing: Boolean(this.missing),
        source: this.keepBaselineWithETag || !this.etag
          ? (await baseline.load()) || undefined : undefined
      };
    }
    else {
      document = await session.perform(() =>
        loadDocument(session.client, url, {
          ...this.requestOptions,
          allowMissing: true
        })
      );
      const intent = creation ? await creation.load() : '';
      if (!document.missing &&
          !(intent && sameGraph(intent, document.source, url))) {
        throw new Error(this.messages.exists ||
          'document-session: A document already exists there.');
      }
      document.graph = graph;
    }
    if (creation) {
      await creation.save(graph.write());
    }
    const saved = await session.perform(() =>
      saveDocument(session.client, document, this.requestOptions)
    );
    // Notebook's Save As alias policy stays in Notebook, at its existing point
    // after the remote receipt and before local acknowledgement writes.
    this.savedCopy?.(url, asNew);
    if (this.keepBaselineWithETag || !saved.etag) {
      await baseline.save(saved.source);
    }
    if (creation) {
      await creation.save('');
    }
    return this.acknowledgeSave(saved, revision);
  }
  async acknowledgeSave(saved, revision) {
    this.url = saved.url;
    this.etag = saved.etag;
    this.missing = false;
    this.dirty = revision !== this.revision;
    await this.persist();
    return saved;
  }
}
