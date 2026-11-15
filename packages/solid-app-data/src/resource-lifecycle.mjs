import { local } from '@muze-labs/solid-workspace';
import { requireOk, strongETag, saveDocument, prefixes } from './index.mjs';
import { StateGraph, named, literal } from './state-rdf.mjs';
import { httpUrl } from './url.mjs';
import { resourceMetadata, metadataState } from './resource-resolution.mjs';
import { loadContainerMetadata, parentContainer } from './link-metadata.mjs';
const ns = 'https://vocab.muze.nl/collections#';
const root = named('urn:muze:solid-apps:file-operation');
const fields = [
  'kind',
  'source',
  'target',
  'etag',
  'digest',
  'targetDigest',
  'targetEtag',
  'stage'
];
const links = new Set(['source', 'target']);
function file(value) {
  const url = new URL(httpUrl(value));
  if (url.hash || url.search || url.pathname.endsWith('/')) {
    throw new Error(
      'resource-lifecycle: Choose a whole file without a query or fragment.'
    );
  }
  return url.href;
}
async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
async function readFile(client, url) {
  const response = await client.get(url, {
    redirect: 'error',
    headers: { Accept: '*/*' }
  });
  if (response.status === 404) {
    return null;
  }
  requireOk(response);
  const etag = response.headers.get('ETag');
  if (!strongETag(etag)) {
    throw new Error(
      'resource-lifecycle: This server supplies no strong file validator. No content was removed.'
    );
  }
  const type =
    response.headers.get('Content-Type') || 'application/octet-stream';
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, etag, type, digest: await digest(bytes) };
}
function copyBytes(content, operation) {
  const type = content.type.split(';')[0].trim().toLowerCase();
  if (type === 'text/turtle') {
    const graph = new StateGraph(
      new TextDecoder('utf-8', { fatal: true }).decode(content.bytes),
      operation.source
    );
    graph.base = operation.target;
    return new TextEncoder().encode(graph.write());
  }
  if (
    [
      'text/n3',
      'application/trig',
      'application/n-quads',
      'application/rdf+xml',
      'application/ld+json'
    ].includes(type)
  ) {
    throw new Error(
      'resource-lifecycle: This RDF format cannot be relocated safely here. The source is retained.'
    );
  }
  return content.bytes;
}
export class ResourceLifecycle {
  constructor({ owner, session, store }) {
    this.owner = owner;
    this.session = session;
    this.store =
      store || local.indexedDB('solid-file-operation', { key: owner });
    this.pending = null;
    this.graph = new StateGraph('');
  }
  async open() {
    const graph = new StateGraph(await this.store.load());
    this.graph = graph;
    if (graph.quads.length) {
      this.pending = Object.fromEntries(
        fields.map((field) => [
          field,
          links.has(field)
            ? graph.one(root, ns + field, 'iri')?.id || ''
            : graph.one(root, ns + field, 'string')?.value || ''
        ])
      );
      file(this.pending.source);
      if (this.pending.kind === 'move') {
        file(this.pending.target);
      }
      if (
        !['move', 'delete'].includes(this.pending.kind) ||
        ![
          'prepared',
          'copying',
          'copy-conflict',
          'copied',
          'deleting',
          'removed',
          'complete'
        ].includes(this.pending.stage) ||
        !strongETag(this.pending.etag) ||
        !/^[a-f0-9]{64}$/.test(this.pending.digest)
      ) {
        throw new Error(
          'resource-lifecycle: Unsupported operation journal; data is retained.'
        );
      }
    }
    return this;
  }
  // Caller-owned native RDF shares the durable intent write, without teaching
  // this engine how to interpret that context.
  async record(changes, context = null) {
    const next = { ...this.pending, ...changes };
    const graph = this.graph.clone();
    if (context) {
      for (const quad of context.clone().quads) {
        if (
          quad.subject.termType === root.termType &&
          quad.subject.id === root.id &&
          quad.predicate.id.startsWith(ns) &&
          fields.includes(quad.predicate.id.slice(ns.length))
        ) {
          throw new Error(
            'resource-lifecycle: Context cannot replace operation state.'
          );
        }
        graph.add(quad.subject, quad.predicate.id, quad.object);
      }
    }
    for (const field of fields) {
      graph.set(root, ns + field);
      if (next[field]) {
        graph.set(
          root,
          ns + field,
          links.has(field) ? named(next[field]) : literal(next[field])
        );
      }
    }
    await this.store.save(graph.write());
    this.graph = graph;
    this.pending = next;
  }
  requireSession() {
    if (!this.session || this.session.webId !== this.owner) {
      throw new Error(
        'resource-lifecycle: Reconnect this operation’s account before retrying.'
      );
    }
    return this.session;
  }
  async begin({
    kind,
    source,
    target = '',
    confirmed = false,
    context = null
  }) {
    if (!confirmed || !['move', 'delete'].includes(kind)) {
      throw new Error('resource-lifecycle: Explicit confirmation is required.');
    }
    if (this.pending) {
      throw new Error(
        'resource-lifecycle: Finish the recorded file operation first.'
      );
    }
    source = file(source);
    target = kind === 'move' ? file(target) : '';
    if (source === target) {
      throw new Error('resource-lifecycle: Choose a different destination.');
    }
    const session = this.requireSession();
    await session.perform(
      async () => {
        const metadata = await resourceMetadata(session.client, source);
        if (metadata.kind || !metadata.document) {
          throw new Error(
            'resource-lifecycle: The original file must have an unambiguous advertised parent description.'
          );
        }
        if (metadata.document.url === source) {
          throw new Error(
            'resource-lifecycle: A folder description cannot be moved or deleted as an ordinary file.'
          );
        }
        if (kind === 'move') {
          const destination = await resourceMetadata(session.client, target);
          if (destination.kind || !destination.document) {
            throw new Error(
              'resource-lifecycle: Choose a new destination with an advertised parent description. Retired addresses cannot be reused.'
            );
          }
        }
        const content = await readFile(session.client, source);
        if (!content) {
          throw new Error(
            'resource-lifecycle: The source file is unavailable.'
          );
        }
        await this.record(
          {
            kind,
            source,
            target,
            etag: content.etag,
            digest: content.digest,
            stage: 'prepared'
          },
          context
        );
      },
      { interactive: false }
    );
    return this.retry();
  }
  async retry() {
    const session = this.requireSession();
    if (!this.pending) {
      return null;
    }
    return session.perform(() => this.perform(session.client), {
      interactive: false
    });
  }
  async perform(client) {
    const operation = this.pending;
    if (operation.stage === 'complete') {
      return operation;
    }
    if (operation.stage === 'copy-conflict') {
      throw new Error(
        'resource-lifecycle: The destination already exists. Stop this operation and choose another file; the source is retained.'
      );
    }
    if (operation.stage === 'prepared' && operation.kind === 'move') {
      const source = await readFile(client, operation.source);
      if (
        !source ||
        source.etag !== operation.etag ||
        source.digest !== operation.digest
      ) {
        throw new Error(
          'resource-lifecycle: The source changed. Its content was retained.'
        );
      }
      const bytes = copyBytes(source, operation);
      await this.record({
        targetDigest: await digest(bytes),
        stage: 'copying'
      });
      // The intent is durable before PUT. A lost response is reconciled by
      // reading the destination; retry never blindly replaces an existing file.
      const response = await client.put(operation.target, {
        redirect: 'error',
        body: bytes,
        headers: { 'Content-Type': source.type, 'If-None-Match': '*' }
      });
      if (response.status === 412) {
        await this.record({ stage: 'copy-conflict' });
      }
      requireOk(response);
    }
    if (this.pending.stage === 'copying') {
      let target = await readFile(client, operation.target);
      if (!target) {
        const source = await readFile(client, operation.source);
        if (
          !source ||
          source.etag !== operation.etag ||
          source.digest !== operation.digest
        ) {
          throw new Error(
            'resource-lifecycle: The source changed before the copy completed.'
          );
        }
        const bytes = copyBytes(source, operation);
        if ((await digest(bytes)) !== this.pending.targetDigest) {
          throw new Error(
            'resource-lifecycle: The pending copy no longer matches.'
          );
        }
        const response = await client.put(operation.target, {
          redirect: 'error',
          body: bytes,
          headers: { 'Content-Type': source.type, 'If-None-Match': '*' }
        });
        if (response.status === 412) {
          await this.record({ stage: 'copy-conflict' });
        }
        requireOk(response);
        target = await readFile(client, operation.target);
      }
      if (!target || target.digest !== this.pending.targetDigest) {
        throw new Error(
          'resource-lifecycle: Destination content differs. The source was retained.'
        );
      }
      await this.record({ targetEtag: target.etag, stage: 'copied' });
    }
    if (['prepared', 'copied', 'deleting'].includes(this.pending.stage)) {
      const metadata = await resourceMetadata(client, operation.source);
      if (metadata.kind) {
        throw new Error(
          'resource-lifecycle: Source metadata changed. Physical removal is unconfirmed.'
        );
      }
      if (operation.kind === 'move') {
        const target = await readFile(client, operation.target);
        if (
          !target ||
          target.etag !== this.pending.targetEtag ||
          target.digest !== this.pending.targetDigest
        ) {
          throw new Error(
            'resource-lifecycle: The destination changed. The source was retained.'
          );
        }
      }
      const source = await readFile(client, operation.source);
      if (source) {
        if (
          source.etag !== operation.etag ||
          source.digest !== operation.digest
        ) {
          throw new Error(
            'resource-lifecycle: The source changed. Its content was retained.'
          );
        }
        await this.record({ stage: 'deleting' });
        requireOk(
          await client.delete(operation.source, {
            redirect: 'error',
            headers: { 'If-Match': operation.etag }
          })
        );
        if (await readFile(client, operation.source)) {
          throw new Error(
            'resource-lifecycle: The server still returns source content. Removal is unconfirmed.'
          );
        }
      }
      else if (this.pending.stage !== 'deleting') {
        throw new Error(
          'resource-lifecycle: Source disappeared before removal was requested. Review the operation.'
        );
      }
      await this.record({ stage: 'removed' });
    }
    if (this.pending.stage === 'removed') {
      const metadata = await loadContainerMetadata(
        client,
        parentContainer(operation.source),
        {
          redirect: 'error',
          strict: true
        }
      );
      if (!metadata) {
        throw new Error(
          'resource-lifecycle: Content removed; parent metadata is unavailable. Retry to finish.'
        );
      }
      const expected =
        operation.kind === 'move' ? 'redirectPermanent' : 'deleted';
      const current = metadataState(metadata, operation.source);
      if (
        current &&
        (current.kind !== expected ||
          (operation.kind === 'move' && current.target !== operation.target))
      ) {
        throw new Error(
          'resource-lifecycle: Content removed; forwarding metadata conflicts. Review before retrying.'
        );
      }
      if (!current) {
        const graph = new StateGraph(metadata.source || '', metadata.url);
        graph.set(
          named(operation.source),
          prefixes.lm + expected,
          operation.kind === 'move'
            ? named(operation.target)
            : literal('Permanently deleted by the user')
        );
        await saveDocument(
          client,
          { ...metadata, graph },
          { redirect: 'error' }
        );
      }
      await this.record({ stage: 'complete' });
    }
    return this.pending;
  }
  async acknowledge() {
    if (this.pending?.stage !== 'complete') {
      throw new Error(
        'resource-lifecycle: An unfinished operation cannot be discarded.'
      );
    }
    await this.store.save('');
    this.graph = new StateGraph('');
    this.pending = null;
  }
  async cancel() {
    if (
      !['prepared', 'copying', 'copied', 'copy-conflict'].includes(
        this.pending?.stage
      )
    ) {
      throw new Error(
        'resource-lifecycle: Removal may have started. Reconcile the operation before clearing it.'
      );
    }
    // Cancellation retains both files. It never tries to roll back a copy by
    // issuing another destructive request.
    await this.store.save('');
    this.graph = new StateGraph('');
    this.pending = null;
  }
}
