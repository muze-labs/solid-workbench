import {
  StateGraph,
  named,
  literal,
  xsd
} from '@muze-labs/solid-app-data/state-rdf.mjs';

const doc = 'https://vocab.muze.nl/documents#';
const root = named('urn:muze:documents:reader');

function settings(graph) {
  const zoom = Number(graph.one(root, doc + 'zoom', 'decimal')?.value ?? 1);
  if (!Number.isFinite(zoom) || zoom < 0.5 || zoom > 3) {
    throw new Error('documents/reader-state: Unsupported saved zoom.');
  }
  const boolean = (name) => {
    const value = graph.one(root, doc + name, 'boolean')?.value ?? 'false';
    if (!['true', 'false', '1', '0'].includes(value)) {
      throw new Error('documents/reader-state: Unsupported saved visibility.');
    }
    return value === 'true' || value === '1';
  };
  return {
    zoom,
    outlineOpen: boolean('outlineOpen'),
    annotationsOpen: boolean('annotationsOpen')
  };
}

function position(graph, document) {
  if (!document) {
    return null;
  }
  const subject = named(document);
  const page = graph.one(subject, doc + 'readingPage', 'integer');
  if (!page) {
    return null;
  }
  const result = {
    document,
    page: Number(page.value),
    fraction: Number(
      graph.one(subject, doc + 'readingFraction', 'decimal', true).value
    ),
    digest: graph.one(subject, doc + 'readingDigest', 'string', true).value,
    readAt: Number(graph.one(subject, doc + 'lastRead', 'integer', true).value)
  };
  validatePosition(result);
  return result;
}

function validatePosition(value) {
  if (
    !value.document ||
    typeof value.digest !== 'string' ||
    !Number.isSafeInteger(value.page) ||
    value.page < 1 ||
    !Number.isFinite(value.fraction) ||
    value.fraction < 0 ||
    value.fraction >= 1 ||
    !Number.isSafeInteger(value.readAt) ||
    value.readAt < 0
  ) {
    throw new Error('documents/reader-state: Invalid reading position.');
  }
}

// Account-scoped, device-local reader preferences and per-document bookmarks.
// Re-read under a shared lock, changing only the fields this action owns.
export class ReaderState {
  constructor(store, owner, locks = globalThis.navigator?.locks) {
    this.store = store;
    this.lockName = 'muze-documents-reader:' + owner;
    this.locks = locks;
    this.pending = Promise.resolve();
  }
  async read(document, digest) {
    await this.pending;
    const graph = new StateGraph((await this.store.load()) || '');
    const saved = position(graph, document);
    return {
      ...settings(graph),
      position: saved?.digest === digest ? saved : null
    };
  }
  save(update) {
    const change = structuredClone(update);
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        if (!this.locks) {
          throw new Error(
            'documents/reader-state: Local storage coordination is unavailable.'
          );
        }
        await this.locks.request(this.lockName, async () => {
          const graph = new StateGraph((await this.store.load()) || '');
          settings(graph);
          if (change.settings) {
            const { zoom, outlineOpen, annotationsOpen } = change.settings;
            if (zoom !== undefined) {
              if (!Number.isFinite(zoom) || zoom < 0.5 || zoom > 3) {
                throw new Error('documents/reader-state: Invalid zoom.');
              }
              graph.set(root, doc + 'zoom', literal(zoom, xsd + 'decimal'));
            }
            for (const [key, value] of Object.entries({
              outlineOpen,
              annotationsOpen
            })) {
              if (value !== undefined) {
                if (typeof value !== 'boolean') {
                  throw new Error(
                    'documents/reader-state: Invalid visibility.'
                  );
                }
                graph.set(root, doc + key, literal(value, xsd + 'boolean'));
              }
            }
          }
          if (change.position) {
            validatePosition(change.position);
            const previous = position(graph, change.position.document);
            // A delayed flush must not replace a more recently observed position
            // from another open reader of the same document.
            if (!previous || change.position.readAt >= previous.readAt) {
              const saved = change.position;
              const subject = named(saved.document);
              graph.set(
                subject,
                doc + 'readingPage',
                literal(saved.page, xsd + 'integer')
              );
              graph.set(
                subject,
                doc + 'readingFraction',
                literal(saved.fraction, xsd + 'decimal')
              );
              graph.set(subject, doc + 'readingDigest', literal(saved.digest));
              graph.set(
                subject,
                doc + 'lastRead',
                literal(saved.readAt, xsd + 'integer')
              );
            }
          }
          await this.store.save(graph.write());
        });
      });
    return this.pending;
  }
}
