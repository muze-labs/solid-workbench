import { apps, named, literal, rdf, xsd } from './state-rdf.mjs';
import {
  readWorkspace,
  writeWorkspace,
  sameWorkspace
} from './workspace-rdf.mjs';
import { httpUrl } from './index.mjs';

import { workspaceSettingKeys } from './workspace-settings.mjs';
export { workspaceSettingKeys };
const titlePredicate = 'http://purl.org/dc/terms/title';
const emptyState = () => ({ version: 2, apps: [], launcher: {} });
function error(message) {
  throw new Error('workspace-directory: ' + message);
}
export function validateDirectory(directory) {
  if (
    !directory ||
    !Array.isArray(directory.entries) ||
    directory.entries.length > 40 ||
    typeof directory.active !== 'string'
  ) {
    error('Unsupported workspace directory.');
  }
  if (
    directory.profileStorage !== undefined &&
    (!Array.isArray(directory.profileStorage) ||
      directory.profileStorage.some((url) => typeof url !== 'string'))
  ) {
    error('Cached profile endpoints must be URL strings.');
  }
  for (const url of directory.profileStorage || []) {
    httpUrl(url);
  }
  const ids = new Set();
  for (const entry of directory.entries) {
    if (
      !/^(default|[a-f0-9-]{36})$/.test(entry.id) ||
      ids.has(entry.id) ||
      typeof entry.title !== 'string' ||
      !entry.title.trim() ||
      entry.title.length > 100 ||
      !Array.isArray(entry.storage) ||
      !entry.settings ||
      Object.keys(entry.settings).some(
        (key) => !workspaceSettingKeys.includes(key)
      )
    ) {
      error('Invalid workspace definition.');
    }
    ids.add(entry.id);
    if (
      entry.storage.length > 40 ||
      [...entry.storage, ...Object.values(entry.settings)].some(
        (url) => typeof url !== 'string'
      )
    ) {
      error('Workspace locations must be URL strings.');
    }
    for (const url of [...entry.storage, ...Object.values(entry.settings)]) {
      if (url) {
        httpUrl(url);
      }
    }
    if (
      entry.storage.some((url) => !new URL(url).pathname.endsWith('/')) ||
      (entry.settings.filesRoot &&
        !new URL(entry.settings.filesRoot).pathname.endsWith('/'))
    ) {
      error('Storage folders must end with /.');
    }
    if (entry.background !== undefined) {
      if (typeof entry.background !== 'string') {
        error('The background must be a resource URL.');
      }
      if (
        entry.background &&
        !/^urn:muze:solid-workbench:background:bg[1-6]$/.test(
          entry.background
        ) &&
        !/^urn:uuid:[a-f0-9-]{36}$/.test(entry.background)
      ) {
        httpUrl(entry.background);
      }
    }
    if (entry.saved?.directory) {
      error('Nested workspace directories are unsupported.');
    }
  }
  if (!ids.has(directory.active)) {
    error('The active workspace is missing.');
  }
  return directory;
}
export function activeWorkspace(snapshot) {
  return snapshot.directory?.entries.find(
    (entry) => entry.id === snapshot.directory.active
  );
}
export function initializeDirectory(snapshot, settings = {}) {
  if (snapshot.directory) {
    if (!snapshot.directory.entries.some((entry) => entry.id === 'default')) {
      snapshot.directory.entries.unshift({
        id: 'default',
        title: 'Solid Workbench',
        storage: [],
        settings: { ...settings },
        saved: emptyState()
      });
    }
    return false;
  }
  snapshot.directory = {
    active: 'default',
    profileStorage: [],
    entries: [
      {
        id: 'default',
        title: 'Solid Workbench',
        storage: [],
        settings: { ...settings }
      }
    ]
  };
  return true;
}
export function resetDefaultWorkspace(snapshot) {
  const next = structuredClone(snapshot);
  const previous = next.directory.entries.find(
    (entry) => entry.id === 'default'
  );
  const settings = { ...previous?.settings };
  if (settings.launcherResource) {
    settings.launcherResource = new URL(
      './launcher-' + crypto.randomUUID() + '.ttl',
      settings.launcherResource
    ).href;
  }
  const replacement = {
    id: 'default',
    title: 'Solid Workbench',
    storage: [],
    settings
  };
  next.directory.entries = [
    replacement,
    ...next.directory.entries.filter((entry) => entry.id !== 'default')
  ];
  if (next.directory.active === 'default') {
    next.apps = [];
    next.launcher = {};
  }
  else {
    replacement.saved = emptyState();
  }
  return next;
}
export function addWorkspace(snapshot, title) {
  const directory = snapshot.directory;
  if (directory.entries.length >= 40 || !title.trim() || title.length > 100) {
    error('Choose a workspace title of 1–100 characters.');
  }
  const defaults = directory.entries.find((entry) => entry.id === 'default');
  const id = crypto.randomUUID();
  const settings = { ...defaults.settings };
  if (settings.launcherResource) {
    settings.launcherResource = new URL(
      './launcher-' + id + '.ttl',
      settings.launcherResource
    ).href;
  }
  const entry = {
    id,
    title: title.trim(),
    storage: [],
    settings,
    saved: emptyState()
  };
  directory.entries.push(entry);
  return entry;
}
export function removeWorkspace(snapshot, id) {
  if (id === 'default' || id === snapshot.directory.active) {
    error('The default and active workspaces cannot be deleted.');
  }
  snapshot.directory.entries = snapshot.directory.entries.filter(
    (entry) => entry.id !== id
  );
}
export function selectWorkspace(snapshot, id) {
  const target = snapshot.directory.entries.find((entry) => entry.id === id);
  if (!target) {
    error('Workspace no longer exists.');
  }
  if (snapshot.directory.active === id) {
    return snapshot;
  }
  const current = activeWorkspace(snapshot);
  current.saved = {
    version: 2,
    apps: snapshot.apps,
    launcher: snapshot.launcher
  };
  const next = {
    ...(target.saved || emptyState()),
    owner: snapshot.owner,
    directory: snapshot.directory
  };
  delete target.saved;
  next.directory.active = id;
  return next;
}
export function sameDirectory(a, b) {
  if (!a || !b) {
    return a === b;
  }
  return (
    (a.profileStorage || []).slice().sort().join('\n') ===
      (b.profileStorage || []).slice().sort().join('\n') &&
    a.active === b.active &&
    a.entries.length === b.entries.length &&
    a.entries.every((entry, index) => {
      const other = b.entries[index];
      return (
        entry.id === other.id &&
        entry.title === other.title &&
        (entry.background || '') === (other.background || '') &&
        Boolean(entry.seeded) === Boolean(other.seeded) &&
        entry.storage.slice().sort().join('\n') ===
          other.storage.slice().sort().join('\n') &&
        workspaceSettingKeys.every(
          (key) => (entry.settings[key] || '') === (other.settings[key] || '')
        ) &&
        sameWorkspace(entry.saved || null, other.saved || null)
      );
    })
  );
}
export function readDirectory(graph, workspaceRoot) {
  const directory = graph.one(named(workspaceRoot), apps + 'directory', 'iri');
  if (!directory) {
    return undefined;
  }
  const active = graph.one(
    directory,
    apps + 'activeWorkspace',
    'string',
    true
  ).value;
  const entries = graph
    .list(directory, apps + 'workspaces')
    .values.map((node) => {
      const id = graph.one(node, apps + 'workspaceId', 'string');
      // A confirmed absent default record can be recreated by initial setup.
      if (!id && node.id === directory.id + '/default') {
        return null;
      }
      if (!id) {
        error('Workspace definition is incomplete.');
      }
      const settings = {};
      for (const key of workspaceSettingKeys) {
        const value = graph.one(node, apps + key, 'iri');
        if (value) {
          settings[key] = value.id;
        }
      }
      const entry = {
        id: id.value,
        title: graph.one(node, titlePredicate, 'string', true).value,
        background: graph.one(node, apps + 'background', 'iri')?.id || '',
        storage: graph.values(node, apps + 'storageEndpoint').map((term) => {
          if (term.termType !== 'NamedNode') {
            error('Storage endpoints must be resource URLs.');
          }
          return term.id;
        }),
        settings,
        seeded: graph.one(node, apps + 'seeded', 'boolean')?.value === 'true'
      };
      if (entry.id !== active) {
        entry.saved = readWorkspace(graph, node.id + '/saved') || emptyState();
      }
      return entry;
    })
    .filter(Boolean);
  if (!entries.some((entry) => entry.id === active) && active === 'default') {
    entries.unshift({
      id: 'default',
      title: 'Solid Workbench',
      storage: [],
      settings: {}
    });
  }
  const profileStorage = graph
    .values(directory, apps + 'profileStorageEndpoint')
    .map((term) => {
      if (term.termType !== 'NamedNode') {
        error('Cached profile storage must use resource URLs.');
      }
      return term.id;
    });
  return validateDirectory({ active, entries, profileStorage });
}
export function writeDirectory(graph, workspaceRoot, directory) {
  if (!directory) {
    return;
  }
  validateDirectory(directory);
  const root = named(workspaceRoot);
  const node =
    graph.one(root, apps + 'directory', 'iri') ||
    named(workspaceRoot + '/directory');
  graph.set(root, apps + 'directory', node);
  graph.set(node, apps + 'activeWorkspace', literal(directory.active));
  graph.set(node, apps + 'profileStorageEndpoint', undefined);
  for (const endpoint of directory.profileStorage || []) {
    graph.add(node, apps + 'profileStorageEndpoint', named(endpoint));
  }
  const order = directory.entries.map((entry, index) => {
    const subject = named(node.id + '/' + entry.id);
    graph.set(subject, apps + 'workspaceId', literal(entry.id));
    graph.set(subject, titlePredicate, literal(entry.title));
    graph.set(
      subject,
      apps + 'background',
      entry.background ? named(entry.background) : undefined
    );
    graph.set(
      subject,
      apps + 'seeded',
      literal(Boolean(entry.seeded), xsd + 'boolean')
    );
    for (const key of workspaceSettingKeys) {
      graph.set(
        subject,
        apps + key,
        entry.settings[key] ? named(entry.settings[key]) : undefined
      );
    }
    graph.set(subject, apps + 'storageEndpoint', undefined);
    for (const endpoint of entry.storage) {
      graph.add(subject, apps + 'storageEndpoint', named(endpoint));
    }
    if (entry.id !== directory.active) {
      writeWorkspace(graph, subject.id + '/saved', entry.saved || emptyState());
    }
    return { node: named(node.id + '/order/' + index), subject };
  });
  graph.set(node, apps + 'workspaces', order[0]?.node || named(rdf + 'nil'));
  for (const [index, item] of order.entries()) {
    graph.set(item.node, rdf + 'first', item.subject);
    graph.set(
      item.node,
      rdf + 'rest',
      order[index + 1]?.node || named(rdf + 'nil')
    );
  }
}
