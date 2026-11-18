import { createSolidMetroClient } from '@muze-labs/solid-app-data';
import { documentUrl, httpUrl } from '@muze-labs/solid-app-data/url.mjs';
import {
  shortcutMetadataEndpoint
} from '@muze-labs/solid-preferences/providers.mjs';

export function droppedWebUrl(transfer) {
  const uri = transfer.getData('text/uri-list')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  try {
    return httpUrl(uri || transfer.getData('text/plain').trim());
  }
  catch {
    return '';
  }
}

export function isWorkbenchLink(url, from) {
  const target = new URL(url);
  const root = new URL('../', from);
  return target.origin === root.origin &&
    /^(workbench|contacts|files|profile|presenter|notebook|documents|viewer|preferences|account)\/$/
      .test(target.pathname.slice(root.pathname.length)) &&
    target.pathname.startsWith(root.pathname);
}

export async function discoverShortcutMetadata(url, preference, origin) {
  const endpoint = new URL(shortcutMetadataEndpoint(preference, origin));
  if (endpoint.hash) {
    throw new Error('shortcut-metadata: Use an endpoint URL without a fragment.');
  }
  const client = createSolidMetroClient(endpoint.origin, {
    oidc: false,
    oldm: false
  });
  const response = await client.post(endpoint.href, {
    body: JSON.stringify({ url: documentUrl(url) }),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error('shortcut-metadata: Discovery was unavailable.');
  }
  const metadata = await response.json();
  const title = typeof metadata?.title === 'string'
    ? metadata.title.trim().slice(0, 180)
    : '';
  let icon = '';
  if (typeof metadata?.iconUrl === 'string') {
    try {
      const candidate = new URL(httpUrl(metadata.iconUrl, endpoint));
      if (candidate.origin === endpoint.origin) {
        icon = candidate.href;
      }
    }
    catch {}
  }
  return { title, icon };
}
