import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceSettingsService } from '../apps/launcher/src/components/workspace-settings-service.mjs';
import {
  initializeDirectory,
  addWorkspace,
  removeWorkspace,
  validateDirectory,
  activeWorkspace
} from '../packages/solid-app-data/src/workspace-directory.mjs';

function fixture(t) {
  const before = globalThis.location;
  globalThis.location = new URL('https://apps.example/workbench/');
  t.after(() => {
    globalThis.location = before;
  });
  const snapshot = { version: 2, apps: [], launcher: {} };
  initializeDirectory(snapshot, {});
  addWorkspace(snapshot, 'Private');
  const id = snapshot.directory.entries[1].id;
  const owner = 'https://pod.example/profile#me';
  const host = { selectedWebId: owner, workspaceContext: { settings: {} } };
  const runtime = {
    host,
    preferencesRevision: 3,
    store: { collection: { list: () => [] } },
    workspace: { extra: {} },
    persistence: {
      owner,
      snapshot,
      dirty: false,
      async stage(next) {
        this.snapshot = next;
        this.dirty = true;
      }
    }
  };
  const context = {
    runtime,
    api: {
      addWorkspace,
      removeWorkspace,
      validateDirectory,
      activeWorkspace,
      workspaceSettingKeys: [
        'filesRoot',
        'contactsResource',
        'launcherResource'
      ],
      httpUrl(text) {
        const url = new URL(text);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('invalid URL');
        }
        return url.href;
      },
      backgrounds: { isUpload: (id) => id.startsWith('urn:uuid:') }
    },
    actions: {}
  };
  for (const [key, fn] of Object.entries(workspaceSettingsService.actions)) {
    context.actions[key] = fn.bind(context);
  }
  Object.assign(context.actions, {
    swb_requireOwner() {
      assert.equal(runtime.host.selectedWebId, runtime.persistence.owner);
    },
    swb_renderDirectory() {
      runtime.preferencesRevision += 1;
    },
    swb_queueSettingsSync() {}
  });
  const record = { entry: { url: 'https://apps.example/preferences/' } };
  const call = (operation, extra = {}) =>
    context.actions.swb_editPreferences(record, {
      owner,
      id,
      operation,
      revision: runtime.preferencesRevision,
      ...extra
    });
  return { context, call, runtime, record, id, owner };
}
test('inactive workspace mutations preserve active context and unrelated settings', async (t) => {
  const f = fixture(t);
  const active = f.runtime.persistence.snapshot.directory.active;
  await f.call('settings', {
    values: { filesRoot: 'https://pod.example/private/' }
  });
  await f.call('background', {
    background: 'urn:muze:solid-workbench:background:bg6'
  });
  assert.equal(f.runtime.persistence.snapshot.directory.active, active);
  const privateEntry = f.runtime.persistence.snapshot.directory.entries[1];
  assert.equal(privateEntry.settings.filesRoot, 'https://pod.example/private/');
  assert.equal(
    privateEntry.background,
    'urn:muze:solid-workbench:background:bg6'
  );
  assert.equal(
    f.runtime.persistence.snapshot.directory.entries[0].background,
    undefined
  );
});
test('owner, provider, stale revision, missing target and protected deletion fail without mutation', async (t) => {
  const f = fixture(t);
  const original = structuredClone(f.runtime.persistence.snapshot);
  await assert.rejects(
    f.call('rename', { owner: 'https://other.example/#me', title: 'bad' }),
    /authorized/
  );
  await assert.rejects(
    f.call('rename', { revision: 0, title: 'bad' }),
    /changed/
  );
  await assert.rejects(
    f.call('rename', { id: 'missing', title: 'bad' }),
    /no longer/
  );
  await assert.rejects(f.call('delete', { id: 'default' }), /default|active/i);
  f.record.entry.url = 'https://other.example/preferences/';
  await assert.rejects(f.call('rename', { title: 'bad' }), /authorized/);
  assert.deepEqual(f.runtime.persistence.snapshot, original);
});
test('a failed local stage rolls back before acknowledging or synchronizing', async (t) => {
  const f = fixture(t);
  const original = structuredClone(f.runtime.persistence.snapshot);
  f.runtime.persistence.stage = async function (next) {
    this.snapshot = next;
    throw new Error('disk full');
  };
  await assert.rejects(
    f.call('rename', { title: 'Retained original' }),
    /disk full/
  );
  assert.deepEqual(f.runtime.persistence.snapshot, original);
  assert.equal(f.runtime.workspaceBusy, false);
});


test('Preferences receives saved app metadata and verified live support for a nonempty Launcher', (t) => {
  const f = fixture(t);
  const saved = { id: 'urn:saved-app' };
  f.runtime.store.collection.list = () => [saved];
  f.context.actions.shortcutRow = (node) => {
    assert.equal(node, saved);
    return { view: { label: 'Picker', link: { href: 'https://apps.example/picker/' } } };
  };
  f.context.api.prefixes = { schema: 'https://schema.org/' };
  f.context.api.valueAt = () => 'https://apps.example/manifest.ttl';
  f.context.api.idOf = (value) => value;
  f.context.api.browseCapability = 'https://vocab.muze.nl/capabilities/browse';
  f.runtime.workspace.instances = new Map([['live', {
    registered: true, entry: { url: 'https://apps.example/picker/' },
    capabilities: [f.context.api.browseCapability]
  }]]);
  const snapshot = f.context.actions.swb_preferencesSnapshot();
  assert.deepEqual(snapshot.applications, [{ name: 'Picker',
    url: 'https://apps.example/picker/', manifest: 'https://apps.example/manifest.ttl',
    live: true }]);
});
