import test from 'node:test';
import assert from 'node:assert/strict';
import { swbRecipientPicker } from '../apps/contacts/src/features.mjs';
import {
  recipientId, selectRecipientCapability as capability
} from '../packages/solid-app-data/src/capabilities.mjs';
import { StateGraph } from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  readProvider, writeProvider, providerCapabilities
} from '../packages/solid-preferences/src/providers.mjs';
import { PreferenceState } from '../packages/solid-preferences/src/state.mjs';

const id = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
function picker() {
  const replies = [];
  const node = { id };
  const view = {
    runtime: {
      host: { selectedWebId: 'https://person.example/#me', task: false,
        managed: { respond: async (...args) => replies.push(args),
          presentationReady() {} } },
      people: { state: { options: { search: 'original filter' } } },
      collectionKey: 'book', contactsResource: 'https://pod.example/book.ttl',
      store: { collection: { get: (key) => key === id ? node : null } }
    },
    data: { search: 'original filter' },
    api: { selectRecipientCapability: capability, recipientId, isPerson: () => true,
      describeRecipient: async () => ({ '@id': id, description: { turtle: '<urn:fixture> <urn:name> "Selected" .' } }) },
    actions: {}
  };
  for (const [name, action] of Object.entries(swbRecipientPicker.actions)) {
    view.actions[name] = action.bind(view);
  }
  view.actions.setSearch = (value) => { view.data.search = value; };
  return { view, replies };
}
test('recipient identities preserve named contacts and reject unsafe/nonidentities', () => {
  for (const value of [id, 'https://person.example/card#me', 'https://PERSON.example']) {
    assert.equal(recipientId({ '@id': value }), value);
  }
  for (const value of ['_:blank', 'javascript:alert(1)', 'mailto:a@b.test',
    'https://user:secret@person.example/', 'urn:uuid:invalid', null]) {
    assert.throws(() => recipientId({ '@id': value }));
  }
});
test('selection is explicit, busy requests do not replace it, cancellation restores filter', async () => {
  const { view, replies } = picker();
  const request = { id: 'one', capability, input: {} };
  view.actions.swb_receiveRecipient(request);
  assert.equal(replies.length, 0);
  await view.actions.swb_receiveRecipient({ ...request, id: 'two' });
  assert.equal(replies[0][1].error.code, 'busy');
  assert.equal(view.runtime.recipientRequest, request);
  view.actions.swb_cancelRecipientRequest({ id: 'stale' });
  assert.equal(view.runtime.recipientRequest, request);
  view.actions.swb_cancelRecipientRequest(request);
  assert.equal(view.data.search, 'original filter');
  assert.equal(view.runtime.recipientRequest, null);
});
test('changed owner or book cannot receive a late selected identity', async () => {
  for (const change of ['owner', 'book']) {
    const { view, replies } = picker();
    view.actions.swb_receiveRecipient({ id: 'one', capability, input: {} });
    view.runtime.recipientId = id;
    if (change === 'owner') {
      view.runtime.host.selectedWebId = 'https://other.example/#me';
    }
    else {
      view.runtime.collectionKey = 'other book';
    }
    await view.actions.swb_returnRecipient();
    assert.equal(replies[0][1].error.code, 'cancelled');
    assert.equal(view.data.search, 'original filter');
  }
});
test('recipient preference cache and reset preserve browse and unknown RDF', async () => {
  const url = 'https://pod.example/preferences.ttl';
  const graph = new StateGraph('<urn:unknown> <urn:keep> "preserve" .', url);
  const browse = { application: 'urn:app:browse', url: 'https://apps.example/files/' };
  const recipient = { application: 'urn:app:contacts', url: 'https://apps.example/contacts/' };
  writeProvider(graph, url, browse);
  writeProvider(graph, url, recipient, capability);
  assert.deepEqual(readProvider(graph, url), browse);
  assert.deepEqual(readProvider(graph, url, capability), recipient);
  writeProvider(graph, url, null, capability);
  assert.deepEqual(readProvider(graph, url), browse);
  assert.equal(readProvider(graph, url, capability), null);
  assert.match(graph.write(), /preserve/);
  let body = '';
  const state = new PreferenceState({ owner: 'https://person.example/#me',
    source: { load: async () => body, save: async (text) => { body = text; } } });
  await state.open();
  await state.change('browseProvider', browse);
  await state.change('recipientProvider', recipient);
  await state.draft('recipientProvider', 'https://unfinished');
  await state.open();
  assert.deepEqual(state.settings().browseProvider, browse);
  assert.deepEqual(state.settings().recipientProvider, recipient);
  assert.equal(state.drafts().recipientProvider, 'https://unfinished');
  await state.change('recipientProvider', null);
  assert.deepEqual(state.settings().browseProvider, browse);
  assert.equal(state.settings().recipientProvider, null);
  assert.equal(state.drafts().recipientProvider, undefined);
  assert.equal(providerCapabilities.recipientProvider, capability);
});

test('successful selection returns selected data and restores the filter', async () => {
  const { view, replies } = picker();
  await view.actions.swb_receiveRecipient({ id: 'one', capability, input: {} });
  view.runtime.recipientId = id;
  const expected = await view.api.describeRecipient();
  view.runtime.preparedRecipient = expected;
  await view.actions.swb_returnRecipient();
  assert.deepEqual(replies, [['one', { result: expected }]]);
  assert.equal(view.data.search, 'original filter');
  assert.equal(view.runtime.recipientId, null);
  assert.equal(view.runtime.recipientRequest, null);
});
