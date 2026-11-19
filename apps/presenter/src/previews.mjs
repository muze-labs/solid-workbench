import '@muze-labs/solid-app-data/jaqt-runtime.mjs';
import { StateGraph } from '@muze-labs/solid-app-data/state-rdf.mjs';

// Preview data is a projection. It never becomes the current editable deck.
export function firstSlidePreview(deck) {
  const slide = jaqt.from(deck.slides()).orderBy({ position: jaqt.asc }).toArray()[0];
  if (!slide) {
    return { title: 'No slides yet', body: '', image: '' };
  }
  const regions = deck.regions(slide.id);
  return {
    title:
      regions.find((region) => region.name === 'title')?.fragment.text || '',
    body:
      regions.find((region) => region.name === 'body' && region.kind === 'text')
        ?.fragment.text || '',
    image: regions.find((region) => region.kind === 'image')?.resource || ''
  };
}

export const muzeSolidPresenterPreviews = {
  events: {
    muzeSolidPresenterPreviewCards: {
      subscribe(notify) {
        const visible = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              visible.unobserve(entry.target);
              notify(entry.target.dataset.muzeSolidCollectionEntry);
            }
          }
        });
        const observe = () => {
          for (const link of this.container.querySelectorAll(
            '[data-muze-solid-collection-entry]:not([data-muze-solid-collection-entry="new"])'
          )) {
            visible.observe(link);
          }
        };
        const changes = new MutationObserver(observe);
        changes.observe(this.container, { childList: true, subtree: true });
        observe();
        return () => {
          changes.disconnect();
          visible.disconnect();
          for (const record of this.runtime.deckPreviews?.records.values() ||
            []) {
            if (record.imageUrl) {
              URL.revokeObjectURL(record.imageUrl);
            }
          }
        };
      },
      action: 'muzeSolidPresenterRequestPreview'
    }
  },
  actions: {
    muzeSolidPresenterPreviewState() {
      return (this.runtime.deckPreviews ||= {
        records: new Map(),
        attempted: new Set(),
        queue: Promise.resolve(),
        generation: 0,
        writes: new Set()
      });
    },
    muzeSolidPresenterPreviewFields(address) {
      const deck = this.runtime.deck;
      const state = this.actions.muzeSolidPresenterPreviewState();
      const record = state.records.get(deck.owner + '\n' + address);
      const current = [
        deck.url,
        deck.target,
        this.runtime.decks?.activeId
      ].includes(address);
      const preview = current ? firstSlidePreview(deck) : record;
      const imageUrl = preview?.image === record?.image ? record?.imageUrl : '';
      return {
        previewVisibility: { hidden: null },
        previewTitle: preview ? preview.title : 'Loading preview…',
        previewBody: preview?.body || '',
        previewImage: { src: imageUrl || null, hidden: imageUrl ? null : '' }
      };
    },
    muzeSolidPresenterProjectPreview(address) {
      const entry = this.runtime.collectionList?.state.data.find(
        (entry) => entry.document === address
      );
      if (entry) {
        Object.assign(
          entry,
          this.actions.muzeSolidPresenterPreviewFields(address)
        );
      }
    },
    muzeSolidPresenterRequestPreview(id) {
      const entry = this.runtime.collectionList?.state.data.find(
        (entry) => entry.id === id && !entry.deleted
      );
      if (!entry) {
        return;
      }
      const owner = this.runtime.deck.owner;
      const address = entry.document;
      const state = this.actions.muzeSolidPresenterPreviewState();
      const key =
        owner +
        '\n' +
        address +
        '\n' +
        ([
          this.runtime.deck.url,
          this.runtime.deck.target,
          this.runtime.decks?.activeId
        ].includes(address)
          ? this.runtime.deck.revision
          : 'remote');
      if (state.attempted.has(key)) {
        return;
      }
      state.attempted.add(key);
      // Serial reads bound optional traffic even when several cards intersect.
      state.queue = state.queue
        .catch(() => {})
        .then(async () => {
          const stillListed = this.runtime.collectionList?.state.data.some(
            (entry) =>
              entry.id === id && entry.document === address && !entry.deleted
          );
          if (
            !stillListed ||
            this.runtime.deck.owner !== owner ||
            this.data.muzeSolidPresenterOverviewVisibility.hidden === ''
          ) {
            state.attempted.delete(key);
            return;
          }
          await this.actions.muzeSolidPresenterLoadPreview(owner, address);
        });
      return state.queue;
    },
    async muzeSolidPresenterLoadPreview(owner, address) {
      const state = this.actions.muzeSolidPresenterPreviewState();
      const key = owner + '\n' + address;
      const source = this.api.local.indexedDB('solid-presenter-previews', {
        key
      });
      const session = this.runtime.host.session;
      const generation = state.generation;
      const active = () =>
        this.runtime.deck.owner === owner &&
        this.runtime.host.session === session &&
        state.generation === generation;
      const project = async (text) => {
        const deck = await new this.api.DeckDocument({
          owner,
          source: this.api.local.memory(key, {
            turtle: new StateGraph(text, address).write()
          })
        }).open();
        if (!active()) {
          return;
        }
        const previous = state.records.get(key);
        if (previous?.imageUrl) {
          URL.revokeObjectURL(previous.imageUrl);
        }
        const record = firstSlidePreview(deck);
        state.records.set(key, record);
        this.actions.muzeSolidPresenterProjectPreview(address);
        if (record.image) {
          await this.actions.muzeSolidPresenterPreviewImage(
            record,
            owner,
            session,
            address,
            generation
          );
        }
        if (active()) {
          this.actions.muzeSolidPresenterProjectPreview(address);
        }
      };
      try {
        const current = this.runtime.deck;
        const local = this.runtime.decks?.find(address);
        if (local || [current.url, current.target].includes(address)) {
          const deck =
            !local || local.id === this.runtime.decks.activeId
              ? current
              : await this.runtime.decks.read(local.id);
          const text = deck.content().write();
          if (!active()) {
            return;
          }
          await this.actions.muzeSolidPresenterPreviewWrite(() =>
            source.save(text)
          );
          if (!active()) {
            await source.save('');
            return;
          }
          await project(text);
          return;
        }
        const cached = await source.load();
        if (cached) {
          try {
            await project(cached);
          }
          catch {
            // A malformed preview cache must not prevent a fresh native read.
          }
        }
        if (!session || session.webId !== owner) {
          return;
        }
        const remote = await session.perform(
          () =>
            this.api.loadDocument(session.client, address, {
              redirect: 'error'
            }),
          { interactive: false }
        );
        if (active()) {
          await project(remote.source);
          if (active()) {
            await this.actions.muzeSolidPresenterPreviewWrite(() =>
              source.save(remote.source)
            );
            if (!active()) {
              await source.save('');
            }
          }
        }
      }
      catch {
        if (active() && !state.records.has(key)) {
          state.records.set(key, {
            title: 'Preview unavailable',
            body: '',
            image: ''
          });
          this.actions.muzeSolidPresenterProjectPreview(address);
        }
        // An optional preview never replaces the current draft or opens sign-in.
      }
    },
    muzeSolidPresenterPreviewWrite(work) {
      const state = this.actions.muzeSolidPresenterPreviewState();
      const write = Promise.resolve().then(work);
      state.writes.add(write);
      return write.finally(() => state.writes.delete(write));
    },
    async muzeSolidPresenterPurgePreviews(addresses) {
      if (!addresses.length) {
        return;
      }
      const owner = this.runtime.deck.owner;
      const state = this.actions.muzeSolidPresenterPreviewState();
      state.generation += 1;
      state.attempted.clear();
      // Wait only for local cache writes already started, never network reads.
      // Clearing afterwards prevents a pending commit from restoring raw bytes.
      await Promise.allSettled([...state.writes]);
      for (const address of addresses) {
        const key = owner + '\n' + address;
        const source = this.api.local.indexedDB('solid-presenter-previews', {
          key
        });
        const record = state.records.get(key);
        let image = record?.image;
        const text = await source.load();
        if (!image && text) {
          try {
            const deck = await new this.api.DeckDocument({
              owner,
              source: this.api.local.memory(key, {
                turtle: new StateGraph(text, address).write()
              })
            }).open();
            image = firstSlidePreview(deck).image;
          }
          catch {
            /* A malformed cached preview is still removed below. */
          }
        }
        await source.save('');
        if (record?.imageUrl) {
          URL.revokeObjectURL(record.imageUrl);
        }
        state.records.delete(key);
        if (image && globalThis.caches) {
          const cache = await caches.open('solid-presenter-preview-images');
          await cache.delete(
            this.actions.muzeSolidPresenterPreviewImageKey(owner, image)
          );
        }
      }
    },
    muzeSolidPresenterPreviewImageKey(owner, image) {
      return new URL(
        '/.muze-solid-presenter-preview/' +
          encodeURIComponent(owner) +
          '/' +
          encodeURIComponent(image),
        location.origin
      ).href;
    },
    async muzeSolidPresenterPreviewImage(
      record,
      owner,
      session,
      address,
      generation
    ) {
      const active = () =>
        this.runtime.deck.owner === owner &&
        this.runtime.host.session === session &&
        this.actions.muzeSolidPresenterPreviewState().generation === generation;
      let cache;
      const cacheKey = this.actions.muzeSolidPresenterPreviewImageKey(
        owner,
        record.image
      );
      const apply = async (response) => {
        const blob = await response.blob();
        if (
          !active() ||
          !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
            blob.type
          )
        ) {
          return;
        }
        if (record.imageUrl) {
          URL.revokeObjectURL(record.imageUrl);
        }
        record.imageUrl = URL.createObjectURL(blob);
      };
      try {
        cache = await caches.open('solid-presenter-preview-images');
        const cached = await cache.match(cacheKey);
        if (cached) {
          await apply(cached);
          this.actions.muzeSolidPresenterProjectPreview(address);
        }
      }
      catch {
        /* A blocked browser cache must not block the card. */
      }
      try {
        if (!session || session.webId !== owner) {
          return;
        }
        const response = await session.perform(
          async () =>
            this.api.requireOk(await session.client.get(record.image)),
          { interactive: false }
        );
        if (active()) {
          const copy = response.clone();
          await apply(response);
          if (active() && record.imageUrl && cache) {
            await this.actions.muzeSolidPresenterPreviewWrite(() =>
              cache.put(cacheKey, copy)
            );
          }
        }
      }
      catch {
        /* Keep cached image bytes or the native text preview. */
      }
    }
  }
};
