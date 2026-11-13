import test from 'node:test';
import assert from 'node:assert/strict';
import { local } from '@muze-labs/solid-workspace';
import { AppCatalog, catalogEntries } from '../apps/launcher/src/catalog.mjs';
import {
  StateGraph,
  named
} from '../packages/solid-app-data/src/state-rdf.mjs';

const url = 'https://catalog.example/index.ttl';
const index = `@prefix s: <https://schema.org/>.
<> s:hasPart <#app>.
<#app> s:name "Test app"; s:image <icon.svg>;
 s:subjectOf <app.ttl>; s:applicationCategory "Data";
 s:text "More detail"; s:screenshot <preview.png>; <https://example.org/extra> "one", "two".
<#unrelated> <https://example.org/extra> "keep".`;
const manifest = `@prefix s: <https://schema.org/>.
@prefix apps: <https://vocab.muze.nl/solid-apps#>.
<> a s:SoftwareApplication; s:name "Independent app";
 s:url <https://independent.example/app/>; s:image <icon.svg>;
 apps:anonymousLaunch true.`;
function fixture() {
  const sources = new Map();
  const storage = (key) => {
    if (!sources.has(key)) {
      sources.set(key, local.memory(key));
    }
    return sources.get(key);
  };
  let failing = false;
  const requests = [];
  const session = {
    client: {
      async get(target) {
        requests.push(target);
        if (failing) {
          throw new Error('Unavailable');
        }
        return new Response(target.endsWith('app.ttl') ? manifest : index, {
          headers: { 'Content-Type': 'text/turtle' }
        });
      }
    }
  };
  return {
    storage,
    session,
    sources,
    requests,
    catalog: new AppCatalog({ defaultUrl: url, storage, session }),
    fail() {
      failing = true;
    }
  };
}

test('catalog resolves relative references and validates only interpreted fields', () => {
  const [entry] = catalogEntries(index, url);
  assert.equal(entry.manifest, 'https://catalog.example/app.ttl');
  assert.equal(entry.icon, 'https://catalog.example/icon.svg');
  assert.equal(entry.name, 'Test app');
  assert.equal(entry.category, 'Data');
  assert.throws(() =>
    catalogEntries(
      index.replace(
        's:applicationCategory "Data"',
        's:applicationCategory "Data", "People"'
      ),
      url
    )
  );
  assert.equal(entry.details, 'More detail');
  assert.equal(entry.screenshot, 'https://catalog.example/preview.png');
  const [minimal] = catalogEntries(
    index.replace(' s:text "More detail"; s:screenshot <preview.png>;', ''),
    url
  );
  assert.equal(minimal.details, '');
  assert.equal(minimal.screenshot, '');
  assert.throws(() =>
    catalogEntries(index.replace('<preview.png>', '<javascript:bad>'), url)
  );
  assert.throws(() =>
    catalogEntries(index.replace('<icon.svg>', '<javascript:bad>'), url)
  );
  assert.throws(() =>
    catalogEntries(index.replace('"Test app"', '"A", "B"'), url)
  );
});

test('multiple sources survive refresh failure and source removal survives reload', async () => {
  const f = fixture();
  await f.catalog.open();
  const second = await f.catalog.addSource('https://other.example/index.ttl');
  await f.catalog.refresh(url);
  await f.catalog.refresh(second);
  assert.equal(f.catalog.sources.get(url).entries.length, 1);
  const graph = new StateGraph(await f.storage(url).load(), url);
  assert.equal(
    graph.values(named(url + '#app'), 'https://example.org/extra').length,
    2
  );
  assert.equal(
    graph.values(named(url + '#unrelated'), 'https://example.org/extra')[0]
      .value,
    'keep'
  );
  f.fail();
  await f.catalog.refresh(url);
  assert.match(f.catalog.sources.get(url).status, /Showing saved apps/);
  assert.equal(f.catalog.sources.get(second).entries.length, 1);
  await f.catalog.removeSource(url);
  const reopened = new AppCatalog({
    defaultUrl: url,
    storage: f.storage,
    session: f.session
  });
  await reopened.open();
  assert.equal(reopened.sources.has(url), false);
  assert.equal(reopened.sources.get(second).entries[0].name, 'Test app');
  assert.equal(reopened.sources.get(second).entries[0].category, 'Data');
  assert.equal(reopened.sources.get(second).entries[0].details, 'More detail');
  assert.equal(
    reopened.sources.get(second).entries[0].screenshot,
    'https://other.example/preview.png'
  );
  await reopened.removeSource(second);
  const empty = new AppCatalog({ defaultUrl: url, storage: f.storage });
  await empty.open();
  assert.equal(
    empty.sources.size,
    0,
    'removed default source must not reappear'
  );
});

test('an independently launched app is decoded by the existing manifest reader and cached as native RDF', async () => {
  const f = fixture();
  const result = await f.catalog.manifest('https://catalog.example/app.ttl');
  assert.equal(result.anonymous, true);
  assert.equal(result.url, 'https://independent.example/app/');
  f.fail();
  assert.deepEqual(
    await f.catalog.manifest('https://catalog.example/app.ttl'),
    result
  );
  await assert.rejects(
    f.catalog.manifest('https://catalog.example/uncached.ttl'),
    /Unavailable/
  );
});

test('failed source persistence does not change the active source list', async () => {
  const f = fixture();
  await f.catalog.open();
  const before = await f.catalog.config.load();
  f.catalog.config = {
    async save() {
      throw new Error('Disk full');
    }
  };
  await assert.rejects(f.catalog.removeSource(url), /Disk full/);
  assert.equal(f.catalog.sources.size, 1);
  assert.equal(f.catalog.graph.write(), before);
  await assert.rejects(
    f.catalog.addSource('https://other.example/index.ttl'),
    /Disk full/
  );
  assert.equal(f.catalog.sources.size, 1);
});
