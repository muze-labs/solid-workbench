import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AnnotationGroup,
  saveGroup,
  createGroupDestination,
  annotationFolder,
  doc,
  oa
} from '../apps/documents/src/annotations.mjs';
import { named, literal } from '../packages/solid-app-data/src/state-rdf.mjs';

const anchor = {
  document: 'https://another-pod.example/paper.pdf',
  digest: 'abc',
  page: 2,
  html: '<strong>Important</strong>'
};

test('a group resource retains HTML, PDF identity, markers and unknown RDF', () => {
  const group = new AnnotationGroup();
  group.rename('Research');
  const id = group.add(anchor);
  group.graph.add(named(id), 'urn:keep', literal('other application'));
  group.setBody(id, '<p>Revised</p>');
  const reopened = new AnnotationGroup(group.write());
  assert.equal(reopened.name, 'Research');
  assert.equal(reopened.annotations()[0].html, '<p>Revised</p>');
  assert.equal(reopened.annotations()[0].document, anchor.document);
  assert.equal(
    reopened.graph.one(named(id), 'urn:keep', 'string').value,
    'other application'
  );
  const before = reopened.write();
  assert.throws(
    () => reopened.add({ ...anchor, document: 'https://other.example/a.pdf' }),
    /own group resource/
  );
  assert.equal(reopened.write(), before);
});

test('stale remote writes are conditional and preserve the local annotation', async () => {
  const group = new AnnotationGroup();
  group.add(anchor);
  group.owner = 'https://me.example/#me';
  group.remote = {
    url: 'https://me.example/annotations/paper-review.ttl',
    etag: '"old"',
    missing: false
  };
  const before = group.write();
  const requests = [];
  const session = {
    webId: group.owner,
    perform: (fn) => fn(),
    client: {
      put: async (url, options) => {
        requests.push({ url, options });
        return new Response('', { status: 412 });
      }
    }
  };
  await assert.rejects(saveGroup(session, group), /changed elsewhere/);
  assert.equal(requests[0].url, group.remote.url);
  assert.equal(requests[0].options.headers['If-Match'], '"old"');
  assert.equal(group.write(), before);
  assert.equal(group.remote.etag, '"old"');
});

test('no validator or wrong account cannot cause an unconditional save', async () => {
  const group = new AnnotationGroup();
  group.add(anchor);
  group.owner = 'https://me.example/#me';
  group.remote = {
    url: 'https://me.example/annotations/a.ttl',
    missing: false
  };
  const session = {
    webId: group.owner,
    perform: (fn) => fn(),
    client: {
      put() {
        assert.fail('unsafe write');
      }
    }
  };
  await assert.rejects(saveGroup(session, group), /no ETag/);
  await assert.rejects(
    saveGroup({ ...session, webId: 'https://elsewhere/#me' }, group),
    /this account/
  );
});

test('annotation destinations are independent, stable per pair, and create conditionally', async () => {
  const group = new AnnotationGroup();
  group.add(anchor);
  const requests = [];
  const session = {
    webId: 'https://mine.example/#me',
    perform: (fn) => fn(),
    client: {
      put: async (url, options) => {
        requests.push({ url, options });
        return new Response('', { status: 201, headers: { ETag: '"first"' } });
      }
    }
  };
  const folder = 'https://mine.example/annotations/';
  const url = await createGroupDestination(session, group, folder);
  assert(url.startsWith(folder));
  assert(url.endsWith('.ttl'));
  const restored = new AnnotationGroup(group.write());
  assert.equal(await createGroupDestination(session, restored, folder), url);
  const other = new AnnotationGroup();
  other.add(anchor);
  assert.notEqual(await createGroupDestination(session, other, folder), url);
  await saveGroup(session, group);
  assert.equal(requests[0].options.headers['If-None-Match'], '*');
  assert.equal(group.remote.etag, '"first"');
  assert.throws(
    () => annotationFolder('https://another-pod.example/', anchor.document),
    /separate folder/
  );
  assert.throws(
    () => annotationFolder('https://mine.example/annotations', anchor.document),
    /ending in/
  );
});

test('import refuses a mixed-PDF resource and invalid bodies leave no partial note', () => {
  const group = new AnnotationGroup();
  const id = group.add(anchor);
  const before = group.write();
  assert.throws(() => group.add({ ...anchor, html: {} }), /HTML body/);
  assert.equal(group.write(), before);
  const target = group.graph.one(named(id), oa + 'hasTarget', 'node', true);
  group.graph.set(
    target,
    oa + 'hasSource',
    named('https://elsewhere.example/b.pdf')
  );
  assert.throws(() => new AnnotationGroup(group.write()), /another PDF/);
});

test('saving captures the requested version while later edits remain local', async () => {
  const group = new AnnotationGroup();
  const id = group.add(anchor);
  group.owner = 'https://me.example/#me';
  group.remote = { url: 'https://me.example/annotations/a.ttl', missing: true };
  let sent;
  const session = {
    webId: group.owner,
    perform(fn) {
      group.setBody(id, '<p>Changed while authenticating</p>');
      return fn();
    },
    client: {
      async put(_url, options) {
        sent = options.body;
        return new Response('', { status: 201, headers: { ETag: '"first"' } });
      }
    }
  };
  await saveGroup(session, group);
  assert.equal(new AnnotationGroup(sent).annotations()[0].html, anchor.html);
  assert.equal(
    group.annotations()[0].html,
    '<p>Changed while authenticating</p>'
  );
  assert.equal(group.isSaved, false);
});

test('unsupported identities and fields refuse edits without corrupting RDF', () => {
  const group = new AnnotationGroup();
  group.add(anchor);
  const before = group.write();
  assert.throws(
    () => group.setBody('urn:unknown:note', 'text'),
    /not in the group/
  );
  assert.throws(() => group.add({ ...anchor, quote: {} }), /must be text/);
  assert.equal(group.write(), before);
  assert.throws(
    () =>
      new AnnotationGroup(
        '_:group a <http://www.w3.org/ns/oa#AnnotationCollection>.'
      ),
    /stable named identity/
  );
});

test('restored metadata cannot direct an annotation write beside the PDF', async () => {
  const group = new AnnotationGroup();
  group.add(anchor);
  group.owner = 'https://me.example/#me';
  group.remote = {
    url: 'https://another-pod.example/notes.ttl',
    missing: false,
    etag: '"v1"'
  };
  const session = {
    webId: group.owner,
    perform: (fn) => fn(),
    client: {
      put() {
        assert.fail('must not write to the PDF folder');
      }
    }
  };
  await assert.rejects(saveGroup(session, group), /separate folder/);
});

test('native Cobalt fragments survive annotation reload and HTML-only replacement detaches stale native values', () => {
  const group = new AnnotationGroup();
  const id = group.add(anchor);
  const fragment = {
    text: 'Important',
    annotations: [
      { range: [0, 9], tag: '<strong>', order: 1 },
      { range: [2, 4], tag: '</strong>', order: 2 }
    ]
  };
  group.setBody(id, '<strong>Im</strong>po<strong>rtant</strong>', fragment);
  const reopened = new AnnotationGroup(group.write());
  assert.deepEqual(reopened.fragment(id), fragment);
  assert.equal(
    reopened.annotations()[0].html,
    '<strong>Im</strong>po<strong>rtant</strong>'
  );
  reopened.setBody(id, '<p>Replacement editor</p>');
  assert.equal(reopened.fragment(id), undefined);
  assert.match(reopened.write(), /Important/);
  assert.equal(reopened.annotations()[0].html, '<p>Replacement editor</p>');
});

test('invalid native annotation bodies cannot partially overwrite HTML', () => {
  const group = new AnnotationGroup();
  const id = group.add(anchor);
  const before = group.write();
  assert.throws(
    () =>
      group.setBody(id, 'changed', {
        text: 'one',
        annotations: [{ range: [0, 99], tag: '<strong>', order: 0 }]
      }),
    /Invalid formatting/
  );
  assert.equal(group.write(), before);
});

test('authors and unknown note RDF survive selection of a new destination', () => {
  const source = new AnnotationGroup();
  const author = 'https://author.example/#me';
  const id = source.add({ ...anchor, html: '', creator: author });
  source.graph.add(
    named(id),
    'http://purl.org/dc/terms/creator',
    named('urn:second-author')
  );
  source.graph.add(named(id), 'urn:keep', literal('unknown note metadata'));
  const destination = new AnnotationGroup();
  source.copyEmptyNoteTo(id, destination);
  destination.setBody(id, '<p>Saved in another group</p>');
  source.detachEmptyNote(id);
  assert.equal(source.annotations().length, 0);
  assert.equal(
    source.graph.one(named(id), 'urn:keep', 'string').value,
    'unknown note metadata'
  );
  const reopened = new AnnotationGroup(destination.write());
  assert.deepEqual(
    reopened.annotations()[0].authors.map((value) => value.id),
    [author, 'urn:second-author']
  );
  assert.equal(
    reopened.graph.one(named(id), 'urn:keep', 'string').value,
    'unknown note metadata'
  );
  assert.throws(
    () => reopened.copyEmptyNoteTo(id, new AnnotationGroup()),
    /new empty marker/
  );
  const legacy = new AnnotationGroup();
  legacy.add(anchor);
  assert.deepEqual(legacy.annotations()[0].authors, []);
});

test('removal deletes the annotation and owned body while preserving other graph data', () => {
  const group = new AnnotationGroup();
  const first = group.add({ ...anchor, creator: 'https://author.example/#me' });
  const second = group.add({ ...anchor, page: 3 });
  group.setBody(first, '<strong>Important</strong>', {
    text: 'Important',
    annotations: [{ range: [0, 9], tag: '<strong>', order: 0 }]
  });
  group.graph.add(named('urn:unrelated'), 'urn:keep', literal('unchanged'));
  group.remove(first);
  const reopened = new AnnotationGroup(group.write());
  assert.deepEqual(
    reopened.annotations().map((note) => note.id),
    [second]
  );
  assert.equal(
    reopened.graph.quads.some((quad) => quad.subject.id === first),
    false
  );
  assert.equal(
    reopened.graph.one(named('urn:unrelated'), 'urn:keep', 'string').value,
    'unchanged'
  );
  assert.equal(reopened.remove(first), false);
});

test('removing one annotation retains a body shared by another annotation', () => {
  const group = new AnnotationGroup();
  const first = group.add(anchor);
  const second = group.add({ ...anchor, page: 3 });
  const body = group.graph.one(named(first), oa + 'hasBody', 'node', true);
  group.graph.set(named(second), oa + 'hasBody', body);
  group.remove(first);
  const reopened = new AnnotationGroup(group.write());
  assert.equal(reopened.annotations()[0].id, second);
  assert.equal(reopened.annotations()[0].html, anchor.html);
  assert.equal(
    reopened.graph.one(named(second), oa + 'hasBody', 'node').id,
    body.id
  );
});
