import { local } from '@muze-labs/solid-workspace';
import {
  StateGraph,
  named,
  literal,
  rdf,
  xsd
} from '@muze-labs/solid-app-data/state-rdf.mjs';
import { DeckDocument, presenter } from './deck-data.mjs';

const registry = named('urn:muze:solid-presenter:drafts');

// Per-copy recovery policy stays in Presenter. Workspace owns the local sources;
// DeckDocument/DocumentSession retain native editing and conditional Pod saves.
export class PresenterDecks {
  constructor({ owner = '', store, baselineFor } = {}) {
    this.owner = owner;
    this.store =
      store ||
      ((id) =>
        local.indexedDB('solid-presenter-drafts', {
          key: owner + '\n' + id
        }));
    this.baselineFor = baselineFor;
    this.pending = Promise.resolve();
    this.removed = new Set();
  }
  async open() {
    this.index = new StateGraph(await this.store('index').load());
    this.removed = new Set(
      this.index
        .values(registry, presenter + 'deletedDraft')
        .map((term) => term.id)
    );
    await this.finishDiscards();
    const selected = this.index.one(
      registry,
      presenter + 'selectedDraft',
      'iri'
    );
    if (selected) {
      await this.select(selected.id);
    }
    else {
      await this.create({ initial: true });
    }
    return this;
  }
  async updateIndex(change) {
    const write = this.pending
      .catch(() => {})
      .then(async () => {
        const next = this.index.clone();
        change(next);
        await this.store('index').save(next.write());
        this.index = next;
      });
    this.pending = write;
    return write;
  }
  async record(id, text) {
    if (this.removed.has(id)) {
      throw new Error('presenter-drafts: This local deck has been deleted.');
    }
    const graph = new StateGraph(text);
    const root = graph.quads.find(
      (quad) =>
        quad.predicate.id === rdf + 'type' &&
        quad.object.id === presenter + 'Deck'
    )?.subject;
    if (!root) {
      throw new Error('presenter-drafts: A native deck is required.');
    }
    const title = graph.one(root, presenter + 'title', 'string', true).value;
    const url =
      graph.one(root, presenter + 'local-remote', 'string')?.value || '';
    const target =
      graph.one(root, presenter + 'local-target', 'string')?.value || '';
    const dirty =
      graph.one(root, presenter + 'local-dirty', 'string')?.value === 'true';
    const initialFields = new Set(
      [
        'title',
        'local-remote',
        'local-target',
        'local-dirty',
        'local-etag',
        'local-missing'
      ].map((field) => presenter + field)
    );
    initialFields.add(rdf + 'type');
    const extraData = graph.quads.some(
      (quad) =>
        quad.subject.id !== root.id || !initialFields.has(quad.predicate.id)
    );
    const listed =
      dirty || url || target || title !== 'Untitled deck' || extraData;
    await this.updateIndex((index) => {
      if (this.removed.has(id)) {
        throw new Error('presenter-drafts: This local deck has been deleted.');
      }
      const subject = named(id);
      index.add(registry, presenter + 'draft', subject);
      index.set(subject, presenter + 'title', literal(title));
      index.set(subject, presenter + 'remote', url ? named(url) : undefined);
      index.set(
        subject,
        presenter + 'target',
        target ? named(target) : undefined
      );
      index.set(subject, presenter + 'dirty', literal(dirty, xsd + 'boolean'));
      index.set(
        subject,
        presenter + 'listed',
        literal(Boolean(listed), xsd + 'boolean')
      );
    });
  }
  entries() {
    return this.index
      .values(registry, presenter + 'draft')
      .filter((subject) => !this.removed.has(subject.id))
      .map((subject) => ({
        id: subject.id,
        title:
          this.index.one(subject, presenter + 'title', 'string')?.value ||
          'Untitled deck',
        url: this.index.one(subject, presenter + 'remote', 'iri')?.id || '',
        target: this.index.one(subject, presenter + 'target', 'iri')?.id || '',
        dirty:
          this.index.one(subject, presenter + 'dirty', 'boolean')?.value ===
          'true',
        listed:
          this.index.one(subject, presenter + 'listed', 'boolean')?.value ===
          'true'
      }))
      .filter((entry) => entry.listed);
  }
  matches(entry, address) {
    return (
      entry.id === address ||
      [entry.url, entry.target].includes(address) ||
      this.index
        .values(named(entry.id), presenter + 'alias')
        .some((alias) => alias.id === address)
    );
  }
  find(address) {
    return this.entries().find((entry) => this.matches(entry, address));
  }
  candidate(id) {
    return new DeckDocument({
      owner: this.owner,
      source: this.store(id),
      baselineFor: this.baselineFor,
      onPersist: (text) => this.record(id, text),
      isRemoved: () => this.removed.has(id)
    });
  }
  async read(id) {
    if (this.removed.has(id)) {
      throw new Error('presenter-drafts: This local deck has been deleted.');
    }
    if (
      !this.index
        .values(registry, presenter + 'draft')
        .some((term) => term.id === id)
    ) {
      throw new Error('presenter-drafts: This local deck is not registered.');
    }
    if (!(await this.store(id).load())) {
      throw new Error(
        'presenter-drafts: This local deck is unavailable. Its reference is retained.'
      );
    }
    return this.candidate(id).open();
  }
  async activate(id, candidate) {
    await candidate.persist();
    await this.updateIndex((index) => {
      index.set(registry, presenter + 'selectedDraft', named(id));
    });
    this.current = candidate;
    this.activeId = id;
    return candidate;
  }
  async select(id) {
    if (id === this.activeId) {
      return this.current;
    }
    if (this.current) {
      await this.current.persist();
    }
    const candidate = await this.read(id);
    return this.activate(id, candidate);
  }
  async create({ target = '', initial = false } = {}) {
    await this.current?.persist();
    const id = 'urn:uuid:' + crypto.randomUUID();
    const candidate = await this.candidate(id).open();
    candidate.target = target;
    if (!initial) {
      candidate.changed();
    }
    return this.activate(id, candidate);
  }
  async openAddress(session, address) {
    const cached = this.find(address);
    if (cached) {
      return this.select(cached.id);
    }
    await this.current.persist();
    const id = 'urn:uuid:' + crypto.randomUUID();
    const candidate = await this.candidate(id).open();
    await candidate.load(session, address);
    return this.activate(id, candidate);
  }
  async rememberReference(id, address) {
    await this.updateIndex((index) => {
      index.add(named(id), presenter + 'alias', named(address));
    });
  }
  pendingPurges() {
    return this.index
      .values(registry, presenter + 'purgeAddress')
      .map((term) => term.id);
  }
  async acknowledgePurges(addresses) {
    if (!addresses.length) {
      return;
    }
    const cleared = new Set(addresses);
    await this.updateIndex((index) => {
      index.quads = index.quads.filter(
        (quad) =>
          !(
            quad.subject.id === registry.id &&
            quad.predicate.id === presenter + 'purgeAddress' &&
            cleared.has(quad.object.id)
          )
      );
    });
  }
  async discard(address) {
    await this.current?.pending.catch(() => {});
    const affected = this.entries().filter((entry) =>
      this.matches(entry, address)
    );
    await this.updateIndex((index) => {
      index.add(registry, presenter + 'purgeAddress', named(address));
      for (const entry of affected) {
        index.add(registry, presenter + 'deletedDraft', named(entry.id));
        const addresses = [
          entry.id,
          entry.url,
          entry.target,
          ...index
            .values(named(entry.id), presenter + 'alias')
            .map((term) => term.id)
        ];
        for (const value of addresses.filter(Boolean)) {
          index.add(registry, presenter + 'purgeAddress', named(value));
        }
        if (entry.id === this.activeId) {
          index.set(registry, presenter + 'selectedDraft');
        }
      }
    });
    for (const entry of affected) {
      this.removed.add(entry.id);
    }
    // Drain any source write that started before the durable deletion marker.
    await this.current?.pending.catch(() => {});
    await this.finishDiscards();
    await this.ensureCurrent();
    return this.pendingPurges();
  }
  async ensureCurrent() {
    if (!this.current || this.removed.has(this.activeId)) {
      this.current = null;
      this.activeId = '';
      await this.create({ initial: true });
    }
    return this.current;
  }
  async finishDiscards() {
    const ids = this.index
      .values(registry, presenter + 'draft')
      .filter((term) => this.removed.has(term.id))
      .map((term) => term.id);
    for (const id of ids) {
      const subject = named(id);
      const addresses = [
        ...this.index.values(subject, presenter + 'remote'),
        ...this.index.values(subject, presenter + 'target'),
        ...this.index.values(subject, presenter + 'alias')
      ];
      await this.store(id).save('');
      for (const address of addresses) {
        await this.candidate(id).baselineFor(address.id).save('');
      }
      await this.updateIndex((index) => {
        index.quads = index.quads.filter(
          (quad) =>
            quad.subject.id !== id &&
            !(
              quad.subject.id === registry.id &&
              quad.predicate.id === presenter + 'draft' &&
              quad.object.id === id
            )
        );
        if (
          index.one(registry, presenter + 'selectedDraft', 'iri')?.id === id
        ) {
          index.set(registry, presenter + 'selectedDraft');
        }
      });
    }
  }
  async applyFileOperation(operation, session) {
    if (session?.webId !== this.owner) {
      throw new Error('presenter-drafts: Reconnect the owning account first.');
    }
    const affected = this.entries().filter((entry) =>
      [entry.url, entry.target].includes(operation.source)
    );
    for (const entry of affected) {
      const deck =
        entry.id === this.activeId ? this.current : await this.read(entry.id);
      await deck.applyFileOperation(operation, session);
      // A prior attempt may have stored the repaired copy before its registry
      // write failed. Refresh the summary even when the repair is already done.
      await this.record(entry.id, deck.graph.write());
      if (operation.kind === 'move') {
        await this.rememberReference(entry.id, operation.source);
      }
    }
  }
}
