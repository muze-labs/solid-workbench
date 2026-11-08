import { local } from '@muze-labs/solid-workspace';
import { StateGraph, sameTerm } from './state-rdf.mjs';
import { simplySolid } from '@muze-labs/simplysolid';
import { oldm, prefixes, valueAt } from './index.mjs';

// One native RDF resource with an IndexedDB replica; shared by both people apps.
export async function openCollection(
  name,
  { scalarPredicates = [], indexedDBFactory, localKey = name } = {}
) {
  const service = simplySolid({
    context: oldm.context({ prefixes }),
    localFirst: true,
    app: { slug: 'solid-apps' },
    data: {
      [name]: {
        kind: 'resource',
        local: { indexedDB: 'solid-apps', key: localKey, indexedDBFactory },
        prefixes,
        scalarPredicates
      }
    }
  });
  await service.open();
  return {
    service,
    localKey,
    collection: service.data[name],
    async connect(session, url) {
      await service.connect({
        solid: session.solid,
        resources: { [name]: { url } }
      });
      const status = await service.sync(name);
      if (status?.ok === false || status?.status === 'sync-pending') {
        throw new Error('collection: Synchronization is pending. Local changes are retained.');
      }
      return status;
    },
    async sync() {
      return service.sync(name);
    },
    pending() {
      return service.status.resources;
    }
  };
}
export function isPerson(node) {
  return (
    [
      'http://www.w3.org/2006/vcard/ns#Individual',
      'http://xmlns.com/foaf/0.1/Person',
      'https://schema.org/Person',
      'http://schema.org/Person'
    ].some((type) => [].concat(node.a || []).includes(type)) ||
    valueAt(node, prefixes.vcard + 'fn') !== undefined
  );
}

// Earlier releases used origin-wide collection keys with no recorded owner.
// Only an explicit recovery action may associate that data with a selected app.
export async function recoverCollection(name, localKey) {
  if (name === localKey) {
    throw new Error('collection: Choose an isolated destination for recovery.');
  }
  const source = local.indexedDB('solid-apps', { key: name });
  const destination = local.indexedDB('solid-apps', { key: localKey });
  const previous = await source.load();
  if (!previous) {
    throw new Error('collection: No previous device collection was found.');
  }
  const graph = new StateGraph(await destination.load());
  const recovered = new StateGraph(previous);
  const occupied = new Set(
    graph.quads
      .flatMap((quad) => [quad.subject, quad.object])
      .filter((term) => term.termType === 'BlankNode')
      .map((term) => term.id)
  );
  const blanks = new Map();
  function remap(term) {
    if (term.termType !== 'BlankNode') {
      return term;
    }
    if (!blanks.has(term.id)) {
      let id = 'recovered' + blanks.size;
      while (occupied.has(id)) {
        id += 'x';
      }
      occupied.add(id);
      blanks.set(term.id, { ...term, id });
    }
    return blanks.get(term.id);
  }
  for (const quad of recovered.quads) {
    const next = {
      ...quad,
      subject: remap(quad.subject),
      object: remap(quad.object)
    };
    if (
      !graph.quads.some(
        (existing) =>
          sameTerm(existing.subject, next.subject) &&
          sameTerm(existing.predicate, next.predicate) &&
          sameTerm(existing.object, next.object)
      )
    ) {
      graph.quads.push(next);
    }
  }
  await destination.save(graph.write());
}
