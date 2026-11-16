import test from 'node:test';
import assert from 'node:assert/strict';
import { preferenceSections } from '../packages/solid-app-data/src/preference-sections.mjs';
import { preferences } from '../apps/preferences/src/components/preferences.mjs';
import { muzeSolidFilesSettingsView } from '../apps/files/src/settings-view.mjs';

const origin = 'https://independent.example';
const section = {
  id: 'notes-settings',
  label: 'Notes',
  url: origin + '/settings'
};
test('contributions preserve metadata and enforce actual caller origin', () => {
  assert.deepEqual(preferenceSections([section], origin), [
    { ...section, workspaceKeys: [] }
  ]);
  assert.deepEqual(preferenceSections(undefined, undefined), []);
  for (const values of [
    [{ ...section, url: 'https://other.example/settings' }],
    [{ ...section, url: 'javascript:alert(1)' }],
    [{ ...section, url: 'https://name:secret@independent.example/settings' }],
    [{ ...section, id: 'appearance' }],
    [section, section],
    [{ ...section, workspaceKeys: ['theme'] }]
  ]) {
    assert.throws(
      () => preferenceSections(values, origin),
      (error) => error.code === 'denied'
    );
  }
  assert.throws(() => preferenceSections([section], undefined));
});

test('independent caller opens common settings without app allowlist', async () => {
  const responses = [];
  const owner = origin + '/profile#me';
  const context = {
    runtime: {
      host: {
        selectedWebId: owner,
        managed: {
          respond: async (_id, result) => responses.push(result),
          presentationReady() {}
        }
      }
    },
    api: { editPreferencesCapability: 'urn:preferences', preferenceSections },
    data: {},
    actions: {
      swb_closeContribution: async () => true,
      swb_loadSettings: async () => {},
      swb_loadWorkspace: async () => {},
      swb_selectSection() {}
    }
  };
  const request = {
    id: 'request',
    capability: 'urn:preferences',
    requester: { origin },
    input: { app: origin + '/app', owner, sections: [] }
  };
  await preferences.actions.swb_receivePreferences.call(context, request);
  assert.equal(context.runtime.request, request);
  assert.deepEqual(context.runtime.contributions, []);
  assert.equal(responses.length, 0);
  for (const invalid of [
    { ...request, capability: 'urn:other' },
    { ...request, input: { ...request.input, owner: origin + '/other' } },
    {
      ...request,
      input: {
        ...request.input,
        sections: [{ ...section, url: 'https://other.example/section' }]
      }
    }
  ]) {
    await preferences.actions.swb_receivePreferences.call(context, invalid);
    assert.equal(responses.at(-1).error.code, 'denied');
  }
});

test('Files settings refuse closure until drafts are durable then freeze edits', () => {
  const context = { runtime: { generation: 'view', writes: 1 }, data: {} };
  const prepare = { generation: 'view', operation: 'prepare' };
  const view = muzeSolidFilesSettingsView.actions.muzeSolidFilesSettingsView;
  assert.equal(view.call(context, prepare).allowed, false);
  context.runtime.writes = 0;
  context.runtime.draftFailed = true;
  assert.equal(view.call(context, prepare).allowed, false);
  context.runtime.draftFailed = false;
  assert.deepEqual(view.call(context, prepare), {
    allowed: true,
    frozen: true
  });
  assert.equal(context.runtime.frozen, true);
  assert.throws(() =>
    view.call(context, { ...prepare, generation: 'retired' })
  );
});

test('workspace delegation exposes only granted keys in the calling workspace', async () => {
  const { muzeSolidPreferenceContributions } = await import(
    '../apps/preferences/src/components/contributions.mjs'
  );
  let options;
  const calls = [];
  const context = {
    runtime: { host: { selectedWebId: origin + '/me' }, callerWorkspace: 'mine' },
    data: {}, container: { querySelector: () => ({ clientWidth: 390, clientHeight: 400 }) },
    api: {
      launchUrl: (url) => url, editPreferenceSectionCapability: 'urn:section',
      WorkspaceBroker: class { constructor(value) { options = value; } },
      EmbeddedView: class { async open() {} }
    },
    actions: { swb_callWorkspace: async (input) => {
      calls.push(input);
      return { revision: 2, pending: true, entries: [
        { id: 'mine', settings: { filesRoot: origin + '/files/', contactsResource: 'private' } },
        { id: 'other', settings: { filesRoot: 'other' } }
      ] };
    } }
  };
  await muzeSolidPreferenceContributions.actions.swb_openContribution.call(context,
    { ...section, workspaceKeys: ['filesRoot'] });
  const record = { capability: 'urn:section' };
  const read = { owner: origin + '/me', operation: 'read' };
  assert.deepEqual(await options.editPreferences(record, read), {
    revision: 2, pending: true, settings: { filesRoot: origin + '/files/' }
  });
  assert.equal(calls[0].id, 'mine');
  await assert.rejects(options.editPreferences(record, {
    ...read, operation: 'settings', values: { contactsResource: 'overwrite' }
  }));
  await assert.rejects(options.editPreferences(record, { ...read, operation: 'delete' }));
  context.runtime.host.selectedWebId = origin + '/other';
  await assert.rejects(options.editPreferences(record, read));
  assert.equal(calls.length, 1);
});
