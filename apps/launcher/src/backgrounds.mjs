import {
  createSolidMetroClient,
  httpUrl,
  requireOk
} from '@muze-labs/solid-app-data';

export const presetPrefix = 'urn:muze:solid-workbench:background:';
const fileTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
export const isUpload = (id) => id.startsWith('urn:uuid:');

// Solid Workspace's local adapters accept Turtle only. CacheStorage holds just
// binary images; the authoritative choice remains a native workspace RDF link.
function cacheKey(id) {
  return 'https://background-cache.invalid/' + encodeURIComponent(id);
}
function imageCache(owner) {
  return caches.open('solid-workbench-backgrounds:' + (owner || 'anonymous'));
}
export function backgroundUrl(id) {
  if (id.startsWith(presetPrefix)) {
    return new URL(
      '../assets/backgrounds/' + id.slice(presetPrefix.length) + '.jpg',
      location.href
    ).href;
  }
  return httpUrl(id);
}
export async function cachedImage(id, owner) {
  const cache = await imageCache(owner);
  const response = await cache.match(cacheKey(id));
  return response ? response.blob() : null;
}
async function cacheImage(id, owner, blob) {
  const cache = await imageCache(owner);
  await cache.put(
    cacheKey(id),
    new Response(blob, {
      headers: { 'Content-Type': blob.type }
    })
  );
}
export async function adoptAnonymousImages(directory, owner) {
  for (const entry of directory.entries) {
    const id = entry.background;
    if (id && !(await cachedImage(id, owner))) {
      const blob = await cachedImage(id, '');
      if (blob) {
        await cacheImage(id, owner, blob);
      }
    }
  }
}
export async function storeUpload(file, owner) {
  if (!fileTypes[file.type] || file.size > 5 * 1024 * 1024) {
    throw new Error(
      'backgrounds: Choose a JPEG, PNG or WebP image up to 5 MB.'
    );
  }
  let image;
  try {
    image = await createImageBitmap(file);
  }
  catch {
    throw new Error('backgrounds: This file could not be decoded as an image.');
  }
  image.close();
  const id = 'urn:uuid:' + crypto.randomUUID();
  await cacheImage(id, owner, file);
  return id;
}
export async function loadBackground(id, owner, session) {
  const local = await cachedImage(id, owner);
  if (local) {
    return local;
  }
  if (isUpload(id)) {
    throw new Error(
      'backgrounds: This device has no copy of the chosen file. Choose it again.'
    );
  }
  const client =
    session?.client ||
    createSolidMetroClient(location.origin, {
      oidc: false,
      oldm: false
    });
  const response = requireOk(
    await client.get(backgroundUrl(id), {
      headers: { Accept: 'image/*' }
    })
  );
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('backgrounds: This URL did not return an image.');
  }
  await cacheImage(id, owner, blob);
  return blob;
}
async function sameBytes(first, second) {
  if (first.size !== second.size || first.type !== second.type) {
    return false;
  }
  const a = new Uint8Array(await first.arrayBuffer());
  const b = new Uint8Array(await second.arrayBuffer());
  return a.every((value, index) => value === b[index]);
}
export async function uploadBackground(id, owner, session, workspaceUrl) {
  const blob = await cachedImage(id, owner);
  if (!blob || !fileTypes[blob.type]) {
    throw new Error(
      'backgrounds: The pending image is unavailable on this device. Choose the file again.'
    );
  }
  const url = new URL(
    './background-' + id.slice('urn:uuid:'.length) + '.' + fileTypes[blob.type],
    workspaceUrl
  ).href;
  const response = await session.client.put(url, {
    body: blob,
    headers: { 'Content-Type': blob.type, 'If-None-Match': '*' }
  });
  if (response.status === 412) {
    // A previous upload may have succeeded while its response was lost. Check
    // the bytes before acknowledging it; never overwrite a different image.
    const existing = requireOk(await session.client.get(url));
    if (!(await sameBytes(blob, await existing.blob()))) {
      throw new Error(
        'backgrounds: The upload location has different contents. Your local image is retained.'
      );
    }
  }
  else {
    requireOk(response);
  }
  await cacheImage(url, owner, blob);
  return url;
}
