import test from 'node:test';
import assert from 'node:assert/strict';
import { from } from '@muze-nl/jaqt';
import { swbFileSharing, resourcePicker } from '../apps/files/src/features.mjs';
import { readRecipient } from '../packages/solid-app-data/src/recipient.mjs';
import { readProfile } from '../packages/solid-profile/src/index.mjs';

const resource = 'https://pod.example/files/report.pdf';
const recipient = { '@id': 'urn:uuid:12345678-1234-1234-1234-123456789abc',
  description: { turtle: '<urn:uuid:12345678-1234-1234-1234-123456789abc> <http://www.w3.org/2006/vcard/ns#fn> "Chosen person"; <http://www.w3.org/2006/vcard/ns#hasEmail> <mailto:chosen@example.org> .' } };
function fixture(t) {
  const previous = globalThis.location;
  globalThis.location = new URL('https://apps.example/files/');
  t.after(() => { globalThis.location = previous; });
  const calls = [];
  const view = { data: {}, api: { from, readRecipient, readProfile,
    launchUrl: (url) => url, selectRecipientCapability: 'select-recipient' },
    runtime: { current: 'https://pod.example/files/',
      files: { state: { data: [{ url: resource, name: 'report.pdf' }] } },
      host: { selectedWebId: 'https://person.example/#me',
        workspaceContext: { id: 'workspace' },
        managed: { ready: true, publish: async () => calls.push('checkpoint') },
        muzeSolidUiInvoke: async (...args) => { calls.push(args); return recipient; } } },
    actions: {} };
  for (const [name, action] of Object.entries(swbFileSharing.actions)) {
    view.actions[name] = action.bind(view);
  }
  view.actions.inside = (url) => url;
  return { view, calls };
}
test('Files consumes local selected RDF without resource writes or guessed WebIDs', async (t) => {
  const { view, calls } = fixture(t);
  await view.actions.swb_chooseShareRecipient(resource);
  assert.equal(view.data.swb_sharePerson, 'Chosen person');
  assert.equal(view.data.swb_shareEmail, 'chosen@example.org');
  assert.equal(view.data.swb_shareId, recipient['@id']);
  assert.equal(view.data.swb_shareWebId, '');
  assert.equal(view.runtime.shareSelection.resource, resource);
  assert(calls.includes('checkpoint'));
  assert.equal(view.runtime.sharing, false);
});
test('cancel and late cross-account results preserve a previous selection', async (t) => {
  const { view } = fixture(t);
  const previous = { resource, id: 'https://previous.example/#me', label: 'Previous' };
  view.runtime.shareSelection = previous;
  view.runtime.host.muzeSolidUiInvoke = async () => { throw Object.assign(new Error('cancel'), { code: 'cancelled' }); };
  await view.actions.swb_chooseShareRecipient(resource);
  assert.equal(view.runtime.shareSelection, previous);
  view.runtime.host.muzeSolidUiInvoke = async () => {
    view.runtime.host.selectedWebId = 'https://other.example/#me'; return recipient;
  };
  await view.actions.swb_chooseShareRecipient(resource);
  assert.equal(view.runtime.shareSelection, previous);
});


test('a legacy browse request cannot interrupt a Files recipient choice', async (t) => {
  const { view } = fixture(t);
  const replies = [];
  view.runtime.sharing = true;
  view.runtime.host.message = () => {};
  view.runtime.host.run = (operation) => operation();
  view.runtime.host.managed.respond = async (...args) => replies.push(args);
  resourcePicker.actions.receiveBrowseRequest.call(view, {
    id: 'other-request', capability: 'browse', input: {}
  });
  await Promise.resolve();
  assert.equal(replies[0][1].error.code, 'busy');
  assert.equal(view.runtime.pending, undefined);
  assert.equal(view.runtime.sharing, true);
});
