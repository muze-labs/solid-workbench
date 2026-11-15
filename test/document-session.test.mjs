import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { NotebookDocuments } from '../apps/notebook/src/document.mjs';
import { DeckDocument } from '../apps/presenter/src/deck-data.mjs';
import { StateGraph, named, literal, sameGraph }
  from '../packages/solid-app-data/src/state-rdf.mjs';

const owner = 'https://pod.example/me#id';
const url = 'https://pod.example/document.ttl';

function recovery() {
  const sources = new Map();
  let fail = false;
  let beforeWrite = async () => {};
  const store = (key) => {
    if (!sources.has(key)) {
      sources.set(key, local.memory(key));
    }
    const source = sources.get(key);
    return {
      load: () => source.load(),
      async save(text) {
        if (fail) {
          throw new Error('fixture: recovery storage unavailable');
        }
        await beforeWrite(key, text);
        return source.save(text);
      }
    };
  };
  return {
    store,
    fail(value) { fail = value; },
    onWrite(work) { beforeWrite = work; }
  };
}
function app(name, cache = recovery()) {
  const options = name === 'Notebook'
    ? { owner, store: cache.store }
    : { owner, source: cache.store('deck'),
        baselineFor: (url) => cache.store('baseline:' + url) };
  const Type = name === 'Notebook' ? NotebookDocuments : DeckDocument;
  return { cache, open: () => new Type(options).open() };
}
function change(document, title) {
  if (document instanceof NotebookDocuments) {
    document.changeTitle(title);
  }
  else {
    document.change(document.root.id, 'title', title);
  }
}
function server() {
  let remote = '';
  let etag = '"one"';
  let failure = null;
  let duringWrite = async () => {};
  const requests = [];
  const connection = {
    webId: owner,
    perform: (work) => work(),
    client: {
      async get(address, options) {
        requests.push({ method: 'GET', address, ...options });
        return new Response(remote || null, {
          status: remote ? 200 : 404,
          headers: etag ? { ETag: etag } : {}
        });
      },
      async put(address, options) {
        requests.push({ method: 'PUT', address, ...options });
        if (failure) {
          return new Response(null, { status: failure });
        }
        remote = options.body;
        await duringWrite();
        return new Response(null, {
          status: 205, headers: etag ? { ETag: etag } : {}
        });
      }
    }
  };
  return {
    connection, requests,
    source: () => remote,
    status(value) { failure = value; },
    validator(value) { etag = value; },
    onWrite(work) { duringWrite = work; }
  };
}

for (const name of ['Notebook', 'Presenter']) {
  test(name + ' finishes queued native recovery snapshots in edit order',
    async () => {
      const fixture = app(name);
      const document = await fixture.open();
      let entered;
      let release;
      const started = new Promise((resolve) => { entered = resolve; });
      const held = new Promise((resolve) => { release = resolve; });
      let holdFirst = true;
      fixture.cache.onWrite(async () => {
        if (holdFirst) {
          holdFirst = false;
          entered();
          await held;
        }
      });
      change(document, 'First queued edit');
      const first = document.persist();
      await started;
      change(document, 'Latest queued edit');
      const second = document.persist();
      await new Promise((resolve) => setImmediate(resolve));
      release();
      await Promise.all([first, second]);
      const reopened = await fixture.open();
      assert.equal(reopened.title, 'Latest queued edit');
      assert.equal(reopened.dirty, true);
    });

  test(name + ' keeps native recovery data and retries a failed local queue',
    async () => {
      const fixture = app(name);
      const document = await fixture.open();
      change(document, 'Keep this draft');
      document.graph.quads.push(...new StateGraph(
        '_:a <urn:next> _:b. _:b <urn:next> _:a; ' +
        '<urn:unknown> "007"^^<http://www.w3.org/2001/XMLSchema#integer>.',
        url
      ).quads);
      const expected = document.content().write();
      const pod = server();
      fixture.cache.fail(true);
      await assert.rejects(document.save(pod.connection, url), /storage/);
      assert.equal(pod.requests.length, 0);
      assert(sameGraph(document.content().write(), expected));
      fixture.cache.fail(false);
      await document.persist();
      const reopened = await fixture.open();
      assert(sameGraph(reopened.content().write(), expected));
      await reopened.save(pod.connection, url);
      assert(sameGraph(pod.source(), expected, url));
      assert.equal(reopened.dirty, false);
    });

  test(name + ' preserves draft and binding on HTTP and account failures',
    async () => {
      for (const status of [401, 403, 412, 503]) {
        const fixture = app(name);
        const document = await fixture.open();
        const pod = server();
        await document.save(pod.connection, url);
        change(document, 'Retained after HTTP ' + status);
        const before = document.content().write();
        pod.status(status);
        await assert.rejects(document.save(pod.connection, url),
          (error) => error.status === status);
        const reopened = await fixture.open();
        assert(sameGraph(reopened.content().write(), before));
        assert.equal(reopened.dirty, true);
        assert.equal(reopened.url, url);
        assert.equal(reopened.etag, '"one"');
        const count = pod.requests.length;
        await assert.rejects(reopened.save({
          ...pod.connection, webId: 'https://other.example/#me'
        }, url), /account/);
        assert.equal(pod.requests.length, count);
        assert(sameGraph(reopened.content().write(), before));
      }
    });

  test(name + ' acknowledges only the snapshot sent and retains newer edits',
    async () => {
      const fixture = app(name);
      const document = await fixture.open();
      const pod = server();
      change(document, 'Sent snapshot');
      const snapshot = document.content().write();
      pod.onWrite(async () => {
        change(document, 'Newer local edit');
        await document.persist();
      });
      await document.save(pod.connection, url);
      assert(sameGraph(pod.source(), snapshot, url));
      assert.equal(document.dirty, true);
      assert.equal(document.title, 'Newer local edit');
      const reopened = await fixture.open();
      assert.equal(reopened.dirty, true);
      assert.equal(reopened.title, 'Newer local edit');
      pod.onWrite(async () => {});
      await reopened.save(pod.connection, url);
      assert.equal(reopened.dirty, false);
      assert.equal(pod.requests.filter((item) => item.method === 'PUT')
        .at(-1).headers['If-Match'], '"one"');
    });

  test(name + ' keeps the durable draft if local acknowledgement fails',
    async () => {
      const fixture = app(name);
      const document = await fixture.open();
      const pod = server();
      change(document, 'Remote receipt with local recovery failure');
      const expected = document.content().write();
      pod.onWrite(async () => { fixture.cache.fail(true); });
      await assert.rejects(document.save(pod.connection, url), /storage/);
      assert(sameGraph(pod.source(), expected, url));
      fixture.cache.fail(false);
      const reopened = await fixture.open();
      assert(sameGraph(reopened.content().write(), expected));
      assert.equal(reopened.dirty, true);
      assert.equal(reopened.url || '', '');
    });

  test(name + ' preserves its existing lost-creation response policy on reload',
    async () => {
      const fixture = app(name);
      const document = await fixture.open();
      const pod = server();
      change(document, 'Creation whose receipt was lost');
      const expected = document.content().write();
      pod.onWrite(async () => {
        throw new Error('fixture: response lost');
      });
      await assert.rejects(document.save(pod.connection, url),
        (error) => error.code === 'save_unconfirmed');
      const reopened = await fixture.open();
      assert(sameGraph(reopened.content().write(), expected));
      assert.equal(reopened.dirty, true);
      pod.onWrite(async () => {});
      if (name === 'Notebook') {
        // Its persisted per-copy intent can reconcile the matching creation.
        await reopened.save(pod.connection, url);
        assert.equal(reopened.dirty, false);
        assert.equal(reopened.url, url);
      }
      else {
        // Presenter has no creation journal; do not silently grant overwrite.
        await assert.rejects(reopened.save(pod.connection, url), /exists/);
        assert.equal(pod.requests.filter((item) => item.method === 'PUT')
          .length, 1);
        assert.equal(reopened.dirty, true);
      }
    });

  test(name + ' keeps a native baseline and refuses weak or absent validators',
    async () => {
      const fixture = app(name);
      const document = await fixture.open();
      const pod = server();
      pod.validator(null);
      change(document, 'Created without a validator');
      await document.save(pod.connection, url);
      const reopened = await fixture.open();
      change(reopened, 'Still safe after reload');
      const writes = pod.requests.filter((item) => item.method === 'PUT').length;
      for (const etag of [null, 'W/"weak"']) {
        pod.validator(etag);
        await assert.rejects(reopened.save(pod.connection, url),
          (error) => error.code === 'validator_missing');
        assert.equal(reopened.dirty, true);
      }
      assert.equal(pod.requests.filter((item) => item.method === 'PUT').length,
        writes);
      pod.validator('"strong"');
      await reopened.save(pod.connection, url);
      assert.equal(pod.requests.at(-1).headers['If-Match'], '"strong"');
      assert.equal(reopened.title, 'Still safe after reload');
    });
}
