import { loadContainerMetadata, parentContainer } from './link-metadata.mjs';
import { StateGraph, named } from './state-rdf.mjs';
import { httpUrl, documentUrl, prefixes } from './index.mjs';

const predicates = [
  'redirectPermanent',
  'redirectTemporary',
  'deleted',
  'forget'
];
export function metadataState(document, subject) {
  if (!document || document.missing) {
    return null;
  }
  const graph = new StateGraph(document.source, document.url);
  const markers = predicates.flatMap((kind) =>
    graph
      .values(named(subject), prefixes.lm + kind)
      .map((value) => ({ kind, value }))
  );
  if (markers.length > 1) {
    throw new Error(
      'resource-resolution: Conflicting link metadata; no action was taken.'
    );
  }
  const marker = markers[0];
  if (marker?.kind.startsWith('redirect')) {
    if (marker.value.termType !== 'NamedNode') {
      throw new Error(
        'resource-resolution: A forwarding target must be a named HTTP resource.'
      );
    }
    marker.target = httpUrl(marker.value.id);
  }
  return marker || null;
}
function containers(uri) {
  const result = [];
  let folder = parentContainer(uri);
  for (let count = 0; count < 64; count++) {
    result.unshift(folder);
    const parent = parentContainer(folder);
    if (parent === folder) {
      return result;
    }
    folder = parent;
  }
  throw new Error(
    'resource-resolution: Folder depth exceeds the supported limit.'
  );
}
// Authority comes from the advertised parent description, never a document's
// own sidecar or arbitrary assertions encountered while reading its content.
export async function resourceMetadata(client, uri) {
  const file = documentUrl(uri);
  const folders = containers(file);
  const cache = new Map();
  for (const folder of folders) {
    const parent = parentContainer(folder);
    if (parent === folder) {
      continue;
    }
    if (!cache.has(parent)) {
      cache.set(
        parent,
        await loadContainerMetadata(client, parent, {
          redirect: 'error',
          strict: true
        })
      );
    }
    const marker = metadataState(cache.get(parent), folder);
    if (marker) {
      if (marker.target) {
        if (!new URL(marker.target).pathname.endsWith('/')) {
          throw new Error(
            'resource-resolution: A folder forwarding target must end in /.'
          );
        }
        marker.target = httpUrl(file.slice(folder.length), marker.target);
      }
      return { ...marker, subject: folder, document: cache.get(parent) };
    }
  }
  const parent = parentContainer(file);
  const document = cache.has(parent)
    ? cache.get(parent)
    : await loadContainerMetadata(client, parent, {
        redirect: 'error',
        strict: true
      });
  return { ...metadataState(document, file), subject: file, document };
}
export async function resolveResource(client, original) {
  original = httpUrl(original);
  let current = original;
  let temporary = false;
  const visited = new Set();
  const steps = [];
  for (let count = 0; count < 12; count++) {
    if (visited.has(current)) {
      throw new Error(
        'resource-resolution: Forwarding loop; the original reference is retained.'
      );
    }
    visited.add(current);
    const metadata = await resourceMetadata(client, current);
    if (metadata.kind === 'deleted' || metadata.kind === 'forget') {
      return { original, current, status: 'deleted', temporary, steps };
    }
    if (metadata.target) {
      const target = new URL(metadata.target);
      if (!target.hash) {
        target.hash = new URL(current).hash;
      }
      steps.push({ from: current, to: target.href, kind: metadata.kind });
      temporary ||= metadata.kind === 'redirectTemporary';
      current = target.href;
      continue;
    }
    return { original, current, status: 'available', temporary, steps };
  }
  throw new Error(
    'resource-resolution: Too many forwarding steps; the original reference is retained.'
  );
}
