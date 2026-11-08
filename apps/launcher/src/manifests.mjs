import {
  createSolidMetroClient,
  loadDocument,
  httpUrl,
  idOf,
  valueAt,
  prefixes
} from '@muze-labs/solid-app-data';

// An explicit RDF application description supplies presentation, not authority.
export async function readApplicationManifest(url, session) {
  url = httpUrl(url);
  const client =
    session?.client ||
    createSolidMetroClient(location.origin, {
      oidc: false,
      oldm: false
    });
  const document = await loadDocument(client, url);
  const descriptions = [...document.graph.data].filter((subject) =>
    [].concat(subject.a || []).includes(prefixes.schema + 'SoftwareApplication')
  );
  if (descriptions.length !== 1) {
    throw new Error(
      'launcher: Manifest must describe exactly one application.'
    );
  }
  const node = descriptions[0];
  const image = idOf(valueAt(node, prefixes.schema + 'image'));
  const launch = idOf(valueAt(node, prefixes.schema + 'url'));
  return {
    name: String(valueAt(node, prefixes.schema + 'name') || ''),
    url: httpUrl(launch),
    icon: image ? httpUrl(image) : ''
  };
}
