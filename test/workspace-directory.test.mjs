import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WorkspaceState,
  emptyWorkspace,
  validateWorkspace
} from '../packages/solid-app-data/src/workspace-state.mjs';
import {
  StateGraph,
  apps,
  named,
  literal,
  stateRoot
} from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  readWorkspace,
  writeWorkspace,
  sameWorkspace
} from '../packages/solid-app-data/src/workspace-rdf.mjs';
import {
  initializeDirectory,
  activeWorkspace,
  addWorkspace,
  selectWorkspace,
  removeWorkspace
} from '../packages/solid-app-data/src/workspace-directory.mjs';

const url = 'https://pod.test/workspace.ttl';
const owner = 'https://user.test/#me';
function initial() {
  const snapshot = { ...emptyWorkspace(), owner };
  initializeDirectory(snapshot, {
    contactsResource: 'https://pod.test/contacts.ttl',
    launcherResource: 'https://pod.test/launcher.ttl',
    filesRoot: 'https://pod.test/'
  });
  return snapshot;
}
function roundtrip(snapshot, source = '') {
  const graph = new StateGraph(source, url);
  writeWorkspace(graph, url + '#workspace', snapshot);
  return {
    graph,
    snapshot: readWorkspace(
      new StateGraph(graph.write(), url),
      url + '#workspace'
    )
  };
}

test('native directory roundtrip preserves inactive drafts, private roots and unrelated RDF', () => {
  let snapshot = initial();
  const work = addWorkspace(snapshot, 'Work');
  assert.equal(
    work.settings.contactsResource,
    activeWorkspace(snapshot).settings.contactsResource
  );
  assert.notEqual(
    work.settings.launcherResource,
    activeWorkspace(snapshot).settings.launcherResource
  );
  snapshot.apps.push({
    id: 'private-editor',
    url: 'https://app.test/',
    state: {
      turtle: '<' + stateRoot + '> <' + apps + 'draft> "Unsaved private text".'
    }
  });
  snapshot = selectWorkspace(snapshot, work.id);
  activeWorkspace(snapshot).storage.push('https://private.test/storage/');
  activeWorkspace(snapshot).settings.contactsResource =
    'https://work.test/book.ttl';
  snapshot.apps.push({
    id: 'work-editor',
    url: 'https://app.test/',
    state: null
  });
  snapshot.directory.entries[0].background =
    'urn:muze:solid-workbench:background:bg2';
  const { graph, snapshot: restored } = roundtrip(
    snapshot,
    '<#other> <https://example.test/unknown> [<https://example.test/name> "keep"].'
  );
  assert.equal(sameWorkspace(snapshot, restored), true);
  assert.match(graph.write(), /Unsaved private text/);
  assert.match(graph.write(), /keep/);
  assert.doesNotMatch(graph.write(), /rdf:JSON|snapshot|reconnectKey/);
  const switched = selectWorkspace(restored, 'default');
  assert.equal(switched.apps[0].id, 'private-editor');
  assert.match(switched.apps[0].state.turtle, /Unsaved private text/);
  assert.equal(
    switched.directory.entries.find((entry) => entry.id === work.id).saved
      .apps[0].id,
    'work-editor'
  );
  validateWorkspace(switched);
});

test('only inactive non-default definitions can be deleted; shared data stays referenced', () => {
  const snapshot = initial();
  const work = addWorkspace(snapshot, 'Work');
  const { graph } = roundtrip(snapshot);
  const subject = named(url + '#workspace/directory/' + work.id);
  graph.add(
    subject,
    'https://example.test/unknown',
    literal('preserve definition metadata')
  );
  graph.add(
    named('https://pod.test/contacts.ttl'),
    'https://example.test/unknown',
    literal('keep contacts')
  );
  assert.throws(
    () => removeWorkspace(snapshot, 'default'),
    /cannot be deleted/
  );
  const active = selectWorkspace(snapshot, work.id);
  assert.throws(() => removeWorkspace(active, work.id), /cannot be deleted/);
  const returned = selectWorkspace(active, 'default');
  removeWorkspace(returned, work.id);
  writeWorkspace(graph, url + '#workspace', returned);
  const restored = readWorkspace(graph, url + '#workspace');
  assert.equal(restored.directory.entries.length, 1);
  assert.match(graph.write(), /preserve definition metadata/);
  assert.match(graph.write(), /keep contacts/);
});

test('catalogue changes mark state dirty, survive local reload and retain conditional saves', async () => {
  let cached = '';
  let write;
  const source = {
    load: async () => cached,
    save: async (value) => {
      cached = value;
    }
  };
  const state = new WorkspaceState({ owner, source });
  const session = {
    webId: owner,
    client: {
      get: async () => new Response('', { status: 404 }),
      put: async (_url, options) => {
        write = options;
        return new Response(null, {
          status: 201,
          headers: { ETag: '"saved"' }
        });
      }
    }
  };
  await state.open();
  await state.bind(session, url);
  await state.stage(initial());
  const next = structuredClone(state.snapshot);
  addWorkspace(next, 'Work');
  await state.stage(next);
  assert.equal(state.dirty, true);
  const reloaded = new WorkspaceState({ owner, source });
  await reloaded.open();
  assert.equal(reloaded.snapshot.directory.entries[1].title, 'Work');
  await state.save(session, url);
  assert.equal(write.headers['If-None-Match'], '*');
  assert.equal(
    readWorkspace(new StateGraph(write.body, url), url + '#workspace').directory
      .entries.length,
    2
  );
});

test('confirmed missing default is recreated without treating failed reads as absence', () => {
  const snapshot = initial();
  const work = addWorkspace(snapshot, 'Work');
  const switched = selectWorkspace(snapshot, work.id);
  const { graph } = roundtrip(switched);
  const subject = named(url + '#workspace/directory/default');
  graph.set(subject, apps + 'workspaceId', undefined);
  const restored = readWorkspace(graph, url + '#workspace');
  assert.equal(restored.directory.entries.length, 1);
  initializeDirectory(restored, activeWorkspace(restored).settings);
  assert.equal(restored.directory.entries[0].id, 'default');
  assert.equal(restored.directory.active, work.id);
  const broken = initial();
  activeWorkspace(broken).settings.filesRoot =
    'https://pod.test/not-a-container';
  assert.throws(() => validateWorkspace(broken), /must end with/);
});

test('confirmed remote deletion resets a clean default and preserves native local recovery', async () => {
  let cached = '';
  let missing = false;
  const snapshot = initial();
  activeWorkspace(snapshot).title = 'My old default';
  const { graph } = roundtrip(snapshot);
  const source = {
    load: async () => cached,
    save: async (value) => {
      cached = value;
    }
  };
  const session = {
    webId: owner,
    client: {
      get: async () =>
        missing
          ? new Response('', { status: 404 })
          : new Response(graph.write(), { headers: { ETag: '"one"' } })
    }
  };
  const state = new WorkspaceState({ owner, source });
  await state.open();
  await state.bind(session, url);
  assert.equal(activeWorkspace(state.snapshot).title, 'My old default');
  missing = true;
  await state.bind(session, url);
  assert.equal(activeWorkspace(state.snapshot).title, 'Solid Workbench');
  assert.match(cached, /My old default/);
  assert.match(cached, /recoveredDefault/);
  const current = structuredClone(state.snapshot);
  session.client.get = async () => new Response('', { status: 403 });
  await assert.rejects(state.bind(session, url));
  assert.equal(sameWorkspace(state.snapshot, current), true);
});

test('managed app settings are limited to the bound suite app and selected identity', async (t) => {
  const { workspaceHome } = await import(
    '../apps/launcher/src/components/workspace-home.mjs'
  );
  const { launchUrl, parseLaunchUrl } = await import(
    '../packages/solid-app-data/src/launch.mjs'
  );
  const { httpUrl } = await import('../packages/solid-app-data/src/index.mjs');
  const { workspaceSettingKeys } = await import(
    '../packages/solid-app-data/src/workspace-settings.mjs'
  );
  const previous = globalThis.location;
  globalThis.location = new URL('https://suite.test/workbench/');
  t.after(() => {
    globalThis.location = previous;
  });
  const snapshot = initial();
  let writes = 0;
  const context = {
    api: {
      activeWorkspace,
      parseLaunchUrl,
      httpUrl,
      workspaceSettingKeys,
      validateDirectory: (directory) =>
        validateWorkspace({ ...snapshot, directory })
    },
    runtime: {
      host: {
        selectedWebId: owner,
        session: { webId: owner },
        workspaceContext: {}
      },
      workspace: { extra: {} },
      persistence: {
        owner,
        snapshot,
        async stage(value) {
          this.snapshot = value;
          writes += 1;
        }
      }
    }
  };
  context.actions = Object.fromEntries(
    Object.entries(workspaceHome.actions).map(([key, action]) => [
      key,
      action.bind(context)
    ])
  );
  context.actions.swb_renderDirectory = () => {};
  const contact = {
    entry: { url: launchUrl('https://suite.test/contacts/', { webId: owner }) }
  };
  const files = {
    entry: { url: launchUrl('https://suite.test/files/', { webId: owner }) }
  };
  assert.deepEqual(
    Object.keys(context.actions.swb_contextFor(contact).settings),
    ['contactsResource']
  );
  assert.deepEqual(
    Object.keys(context.actions.swb_contextFor(files).settings),
    ['filesRoot']
  );
  assert.equal(
    context.actions.swb_contextFor({
      entry: { url: 'https://suite.test/contacts/' }
    }),
    null
  );
  assert.equal(
    context.actions.swb_contextFor({
      entry: {
        url: launchUrl('https://other.test/contacts/', { webId: owner })
      }
    }),
    null
  );
  await assert.rejects(
    context.actions.swb_saveAppPreferences(files, {
      id: 'default',
      values: { contactsResource: 'https://elsewhere.test/book' }
    }),
    /cannot change/
  );
  assert.equal(writes, 0);
  await context.actions.swb_saveAppPreferences(contact, {
    id: 'default',
    values: { contactsResource: 'https://work.test/book' }
  });
  assert.equal(
    activeWorkspace(context.runtime.persistence.snapshot).settings
      .contactsResource,
    'https://work.test/book'
  );
  assert.equal(writes, 1);
});

test('failed checkpoint or local switch save leaves current apps and state intact', async () => {
  const { workspaceHome } = await import(
    '../apps/launcher/src/components/workspace-home.mjs'
  );
  for (const failurePoint of ['checkpoint', 'view', 'storage']) {
    const snapshot = initial();
    const work = addWorkspace(snapshot, 'Work');
    let closed = false;
    const failure = new Error('fixture: ' + failurePoint);
    const persistence = {
      owner,
      snapshot,
      work: Promise.resolve(),
      async stage(next) {
        this.snapshot = next;
        throw failure;
      }
    };
    const context = {
      api: { selectWorkspace, activeWorkspace },
      runtime: {
        persistence,
        host: { selectedWebId: owner, session: { webId: owner } },
        workspace: {
          async checkpoint() {
            if (failurePoint === 'checkpoint') {
              throw failure;
            }
          },
          async prepareViewsForClose() {
            if (failurePoint === 'view') {
              throw failure;
            }
          },
          closeApps() {
            closed = true;
          }
        }
      }
    };
    context.actions = Object.fromEntries(
      Object.entries(workspaceHome.actions).map(([key, action]) => [
        key,
        action.bind(context)
      ])
    );
    context.actions.workspaceMessage = () => {};
    context.actions.swb_openShortcuts = async () => ({});
    await assert.rejects(
      context.actions.swb_switchWorkspace(work.id),
      (error) => error === failure
    );
    assert.equal(closed, false);
    assert.equal(persistence.snapshot.directory.active, 'default');
  }
});
