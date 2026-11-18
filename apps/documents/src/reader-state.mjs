import {
  StateGraph,
  named,
  literal,
  xsd
} from '@muze-labs/solid-app-data/state-rdf.mjs';

const doc = 'https://vocab.muze.nl/documents#';
const root = named('urn:muze:documents:reader');

function validateSpreadWidth(width) {
  if (!Number.isSafeInteger(width) || width < 720) {
    throw new Error('documents/reader-state: Invalid spread reference width.');
  }
}

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
  const mode =
    graph.one(root, doc + 'readingMode', 'string')?.value ?? 'continuous';
  if (!['continuous', 'single', 'spread'].includes(mode)) {
    throw new Error('documents/reader-state: Unsupported reading mode.');
  }
  const width = graph.one(root, doc + 'spreadReferenceWidth', 'integer');
  const spreadReferenceWidth = width ? Number(width.value) : null;
  if (width) {
    validateSpreadWidth(spreadReferenceWidth);
  }
  return {
    spreadReferenceWidth,
    mode,
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
  async bookmarks() {
    await this.pending;
    const graph = new StateGraph((await this.store.load()) || '');
    return graph.values(root, doc + 'bookmark').map((subject) => ({
      id: subject.id,
      document: graph.one(subject, doc + 'document', 'iri', true).id,
      label: graph.one(subject, doc + 'label', 'string', true).value,
      page: Number(
        graph.one(subject, doc + 'readingPage', 'integer', true).value
      ),
      fraction: Number(
        graph.one(subject, doc + 'readingFraction', 'decimal', true).value
      ),
      digest: graph.one(subject, doc + 'readingDigest', 'string', true).value
    }));
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
        return this.locks.request(this.lockName, async () => {
          const graph = new StateGraph((await this.store.load()) || '');
          let { spreadReferenceWidth } = settings(graph);
          if (change.spreadReferenceWidth !== undefined && !spreadReferenceWidth) {
            validateSpreadWidth(change.spreadReferenceWidth);
            spreadReferenceWidth = change.spreadReferenceWidth;
            graph.set(
              root,
              doc + 'spreadReferenceWidth',
              literal(spreadReferenceWidth, xsd + 'integer')
            );
          }
          if (change.settings) {
            const { zoom, outlineOpen, annotationsOpen, mode } =
              change.settings;
            if (mode !== undefined) {
              if (!['continuous', 'single', 'spread'].includes(mode)) {
                throw new Error(
                  'documents/reader-state: Invalid reading mode.'
                );
              }
              graph.set(root, doc + 'readingMode', literal(mode));
            }
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
          if (change.bookmark) {
            const saved = change.bookmark;
            validatePosition(saved);
            if (
              typeof saved.label !== 'string' ||
              typeof saved.id !== 'string' ||
              !saved.id.startsWith('urn:uuid:')
            ) {
              throw new Error('documents/reader-state: Invalid bookmark.');
            }
            const subject = named(saved.id);
            const members = graph.values(root, doc + 'bookmark');
            if (!members.some((item) => item.id === saved.id)) {
              graph.add(root, doc + 'bookmark', subject);
            }
            graph.set(subject, doc + 'document', named(saved.document));
            graph.set(subject, doc + 'label', literal(saved.label));
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
          }
          if (change.removeBookmark) {
            // Detach membership only; retain unknown/shared bookmark statements.
            graph.quads = graph.quads.filter(
              (quad) =>
                !(
                  quad.subject.id === root.id &&
                  quad.predicate.id === doc + 'bookmark' &&
                  quad.object.id === change.removeBookmark
                )
            );
          }
          await this.store.save(graph.write());
          return spreadReferenceWidth;
        });
      });
    return this.pending;
  }
}
