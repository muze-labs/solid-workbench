import { ResourceLifecycle } from './resource-lifecycle.mjs';
import { StateGraph, named } from './state-rdf.mjs';

const ns = 'https://vocab.muze.nl/collections#';
const root = named('urn:muze:solid-apps:file-operation');

// The native association shares the physical journal's atomic local write.
// Keep the existing predicates so already-recorded operations can resume.
export class CollectionFileOperation {
  constructor(options) {
    this.resource = new ResourceLifecycle(options);
  }
  async open() {
    await this.resource.open();
    return this;
  }
  get pending() {
    const operation = this.resource.pending;
    if (!operation) {
      return null;
    }
    const graph = this.resource.graph;
    const collection = graph.one(root, ns + 'collection', 'iri')?.id || '';
    const entry = graph.one(root, ns + 'entry', 'iri')?.id || '';
    if (Boolean(collection) !== Boolean(entry)) {
      throw new Error(
        'collection-file-operation: Incomplete collection association; the journal is retained.'
      );
    }
    return { ...operation, collection, entry };
  }
  async begin({ collection = '', entry = '', ...operation }) {
    if (Boolean(collection) !== Boolean(entry)) {
      throw new Error(
        'collection-file-operation: Supply both collection and entry, or neither.'
      );
    }
    const context = new StateGraph('');
    if (collection) {
      context.set(root, ns + 'collection', named(collection));
      context.set(root, ns + 'entry', named(entry));
    }
    await this.resource.begin({ ...operation, context });
    return this.pending;
  }
  async retry() {
    if (!this.pending) {
      return null;
    }
    await this.resource.retry();
    return this.pending;
  }
  async cancel() {
    await this.resource.cancel();
  }
  async finish({ collection, openCollection, applyLocal }) {
    const operation = this.pending;
    if (!operation || operation.stage !== 'complete') {
      return null;
    }
    this.resource.requireSession();
    if (typeof applyLocal !== 'function') {
      throw new Error(
        'collection-file-operation: Local reconciliation is required before acknowledgement.'
      );
    }
    if (operation.collection) {
      if (collection?.url !== operation.collection) {
        if (typeof openCollection !== 'function') {
          throw new Error(
            'collection-file-operation: Open the associated collection before completion.'
          );
        }
        collection = await openCollection(operation.collection);
      }
      if (!collection) {
        throw new Error(
          'collection-file-operation: The associated collection is unavailable.'
        );
      }
      if (operation.kind === 'move') {
        await collection.repairReference(operation.entry, operation.target);
      }
      else {
        await collection.removeReference(operation.entry);
      }
      await collection.sync();
    }
    await applyLocal(operation);
    await this.resource.acknowledge();
    return operation;
  }
}
