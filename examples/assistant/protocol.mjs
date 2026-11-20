import {
  capabilityError,
  PortConnection
} from '../../packages/solid-app-data/src/capabilities.mjs';

export const suggestTopics =
  'https://vocab.muze.nl/capabilities/suggest-topics';
export const readBookmarkSelection =
  'https://vocab.muze.nl/capabilities/read-bookmark-selection';

export function selectionFrom(input) {
  if (!Array.isArray(input) || !input.length || input.length > 12) {
    throw capabilityError('Select between 1 and 12 bookmarks.', 'invalid');
  }
  const ids = new Set();
  return input.map(({ id, title, url }) => {
    if (
      typeof id !== 'string' ||
      id.length > 100 ||
      !id ||
      ids.has(id) ||
      typeof title !== 'string' ||
      title.length > 250 ||
      typeof url !== 'string' ||
      url.length > 2000
    ) {
      throw capabilityError('Invalid bookmark selection.', 'invalid');
    }
    const address = new URL(url);
    if (
      !['http:', 'https:'].includes(address.protocol) ||
      address.username ||
      address.password
    ) {
      throw capabilityError('Invalid bookmark URL.', 'invalid');
    }
    ids.add(id);
    return { id, title, url };
  });
}

export function offerPort(target, origin, key, handle) {
  const channel = new MessageChannel();
  target.postMessage({ type: 'solid-assistant:connect', key }, origin, [
    channel.port2
  ]);
  return new PortConnection(channel.port1, handle);
}

export function acceptPort(event, source, origin, key, handle) {
  if (
    source &&
    key &&
    event.source === source &&
    event.origin === origin &&
    event.data?.type === 'solid-assistant:connect' &&
    event.data.key === key &&
    event.ports.length === 1
  ) {
    return new PortConnection(event.ports[0], handle);
  }
}
