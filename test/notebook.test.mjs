import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { NotebookDocuments, notebook } from '../apps/notebook/src/document.mjs';
import { named, literal } from '../packages/solid-app-data/src/state-rdf.mjs';
function stores() {
  const values = new Map();
  return (id) => {
    if (!values.has(id)) {
      values.set(id, local.memory(id));
    }
    return values.get(id);
  };
}
const owner = 'https://pod.example/profile#me';
const text = (value) => ({ text: value, annotations: [] });
test('rich title preserves legacy text, native formatting and unknown RDF through reload', async () => {
  const store = stores();
  const docs = await new NotebookDocuments({ store }).open();
  const titleId = docs.root.id;
  const bodyId = docs.blocks()[0].id;
  assert.deepEqual(docs.titleFragment(), text('Untitled notebook'));
  assert.equal(
    docs.graph.values(docs.root, notebook + 'title-content').length,
    0
  );
  docs.graph.add(
    docs.root,
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#value',
    literal('Unrelated value')
  );
  const fragment = {
    text: 'Rich title',
    annotations: [{ range: [0, 4], tag: '<em>', order: 0 }]
  };
  docs.edit(titleId, fragment);
  const content = docs.graph.one(docs.root, notebook + 'title-content', 'iri');
  docs.graph.add(content, 'urn:unknown', literal('Retain title data'));
  await docs.persist();
  const reopened = await new NotebookDocuments({ store }).open();
  assert.equal(reopened.title, 'Rich title');
  assert.equal(reopened.editorBlocks()[0].id, titleId);
  assert.equal(reopened.blocks()[0].id, bodyId);
  assert.deepEqual(reopened.titleFragment(), fragment);
  assert.equal(
    reopened.graph.one(content, 'urn:unknown', 'string').value,
    'Retain title data'
  );
  assert.equal(
    reopened.graph.one(
      reopened.root,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#value',
      'string'
    ).value,
    'Unrelated value'
  );
  const before = reopened.content().write();
  assert.throws(() => reopened.remove(titleId), /title cannot be removed/);
  assert.throws(
    () =>
      reopened.edit(titleId, {
        text: 'Unsupported',
        annotations: [{ range: [0, 1], tag: '<table>', order: 0 }]
      }),
    /Unsupported formatting/
  );
  assert.equal(reopened.content().write(), before);
  reopened.graph.set(
    reopened.root,
    notebook + 'title',
    literal('Conflicting title')
  );
  assert.throws(() => reopened.validate(reopened.graph), /Conflicting title/);
});
test('separate local notebooks survive New, selection and reload with native unknown data', async () => {
  const store = stores();
  const docs = await new NotebookDocuments({ owner, store }).open();
  const first = docs.id;
  const block = docs.blocks()[0].id;
  docs.edit(block, text('First'));
  docs.graph.add(named(block), 'urn:unknown', literal('retain'));
  await docs.create();
  const second = docs.id;
  docs.edit(docs.blocks()[0].id, text('Second'));
  await docs.persist();
  await docs.select(first);
  assert.equal(docs.blocks()[0].fragment.text, 'First');
  assert.equal(
    docs.graph.one(named(block), 'urn:unknown', 'string').value,
    'retain'
  );
  const reopened = await new NotebookDocuments({ owner, store }).open();
  assert.equal(reopened.id, first);
  await reopened.select(second);
  assert.equal(reopened.blocks()[0].fragment.text, 'Second');
  assert.equal(reopened.entries().length, 2);
  assert(!reopened.content().write().includes('local-dirty'));
});
test('block editing/removal preserves unrelated native statements and refuses unsupported blocks', async () => {
  const docs = await new NotebookDocuments({ store: stores() }).open();
  const old = docs.blocks()[0].id;
  docs.graph.add(named(old), 'urn:unknown', literal('retain'));
  docs.add(text('Later'));
  docs.remove(old);
  assert.equal(docs.blocks()[0].position, 0);
  assert.equal(
    docs.graph.one(named(old), 'urn:unknown', 'string').value,
    'retain'
  );
  docs.graph.set(
    named(docs.blocks()[0].id),
    notebook + 'kind',
    literal('unknown')
  );
  assert.throws(() => docs.validate(docs.graph), /block type/);
});
test('conditional saves, Save As and conflicts retain documents and account boundaries', async () => {
  const docs = await new NotebookDocuments({ owner, store: stores() }).open();
  const remotes = new Map();
  const requests = [];
  const session = {
    webId: owner,
    perform: (fn) => fn(),
    client: {
      get: async (url) =>
        remotes.has(url)
          ? new Response(remotes.get(url), {
              headers: { 'Content-Type': 'text/turtle', ETag: '"1"' }
            })
          : new Response('', { status: 404 }),
      put: async (url, options) => {
        requests.push(options);
        remotes.set(url, options.body);
        return new Response('', { status: 201, headers: { ETag: '"1"' } });
      }
    }
  };
  const first = 'https://pod.example/first.ttl';
  const copy = 'https://pod.example/copy.ttl';
  docs.edit(docs.blocks()[0].id, text('Saved notebook'));
  const title = {
    text: 'Pod heading',
    annotations: [{ range: [0, 3], tag: '<em>', order: 0 }]
  };
  docs.edit(docs.root.id, title);
  await docs.save(session, first);
  assert.equal(requests[0].headers['If-None-Match'], '*');
  await docs.save(session, copy, true);
  assert.equal(remotes.size, 2);
  await assert.rejects(docs.save(session, first, true), /exists/);
  await assert.rejects(
    docs.save({ ...session, webId: 'https://other.example/#me' }, copy),
    /account/
  );
  docs.edit(docs.blocks()[0].id, text('Keep local edit'));
  session.client.put = async () => new Response('', { status: 412 });
  await assert.rejects(docs.save(session, copy), /changed|412/);
  assert.equal(docs.dirty, true);
  const draft = docs.id;
  await docs.load(session, first);
  assert.deepEqual(docs.titleFragment(), title);
  assert.equal(docs.blocks()[0].fragment.text, 'Saved notebook');
  await docs.select(draft);
  assert.equal(docs.blocks()[0].fragment.text, 'Keep local edit');
});
test('failed preservation and invalid remote data cannot replace an open notebook', async () => {
  const base = stores();
  let fail = false;
  const store = (id) => ({
    load: () => base(id).load(),
    save: (value) => {
      if (fail) {
        throw new Error('fixture: storage failed');
      }
      return base(id).save(value);
    }
  });
  const docs = await new NotebookDocuments({ owner, store }).open();
  const id = docs.id;
  docs.edit(docs.blocks()[0].id, text('Retain edits'));
  fail = true;
  await assert.rejects(docs.create(), /storage failed/);
  assert.equal(docs.id, id);
  fail = false;
  const session = {
    webId: owner,
    perform: (fn) => fn(),
    client: {
      get: async () =>
        new Response('<urn:other> <urn:value> "unrelated".', {
          headers: { 'Content-Type': 'text/turtle' }
        })
    }
  };
  await assert.rejects(
    docs.load(session, 'https://pod.example/bad.ttl'),
    /Notebook/
  );
  assert.equal(docs.id, id);
  assert.equal(docs.blocks()[0].fragment.text, 'Retain edits');
});

test('failed activation of a new cache restores the open document and registry', async () => {
  const base = stores();
  let current;
  let fail = false;
  const store = (id) => ({
    load: () => base(id).load(),
    save: (value) => {
      if (fail && id !== current && id !== 'index') {
        throw new Error('fixture: new cache failed');
      }
      return base(id).save(value);
    }
  });
  const docs = await new NotebookDocuments({ store }).open();
  current = docs.id;
  docs.edit(docs.blocks()[0].id, text('Keep the open notebook'));
  fail = true;
  await assert.rejects(docs.create(), /new cache failed/);
  assert.equal(docs.id, current);
  assert.equal(docs.entries().length, 1);
  assert.equal(docs.blocks()[0].fragment.text, 'Keep the open notebook');
  fail = false;
  const reopened = await new NotebookDocuments({ store }).open();
  assert.equal(reopened.id, current);
  assert.equal(reopened.blocks()[0].fragment.text, 'Keep the open notebook');
});

test('no-ETag baseline survives reload and refuses unsafe subsequent saves', async () => {
  const store = stores();
  const docs = await new NotebookDocuments({ owner, store }).open();
  const url = 'https://pod.example/no-etag.ttl';
  let remote = '';
  let validator = null;
  let condition;
  const session = {
    webId: owner,
    perform: (fn) => fn(),
    client: {
      get: async () =>
        remote
          ? new Response(remote, {
              headers: {
                'Content-Type': 'text/turtle',
                ...(validator ? { ETag: validator } : {})
              }
            })
          : new Response('', { status: 404 }),
      put: async (_url, options) => {
        remote = options.body;
        condition = options.headers;
        return new Response('', { status: 201 });
      }
    }
  };
  await docs.save(session, url);
  const reopened = await new NotebookDocuments({ owner, store }).open();
  reopened.edit(reopened.blocks()[0].id, text('Retain this edit'));
  await assert.rejects(reopened.save(session, url), /version information/);
  assert.equal(reopened.dirty, true);
  validator = '"safe"';
  await reopened.save(session, url);
  assert.equal(condition['If-Match'], '"safe"');
  assert.equal(reopened.dirty, false);
});
