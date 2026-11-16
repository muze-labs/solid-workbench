import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oldm,
  prefixes,
  valueAt
} from '../packages/solid-app-data/src/index.mjs';
import { applyShortcutOrder } from '../apps/launcher/src/shortcuts.mjs';
import {
  shortcutGroup,
  setShortcutGroup,
  groupDescription,
  newGroupData
} from '../apps/launcher/src/groups.mjs';

const base = 'https://example.org/apps.ttl';
function graph(extra = '') {
  return oldm.context({ prefixes }).parse(
    `
    @prefix apps: <${prefixes.apps}>.
    @prefix schema: <${prefixes.schema}>.
    <#app> a schema:SoftwareApplication;
      <https://example.org/unknown> "one", "two".
    <#group> a apps:LauncherGroup, <https://example.org/Extra>;
      schema:name "Work"; apps:shortcutOrder 2;
      <https://example.org/unknown> "keep".
    ${extra}`,
    base,
    'text/turtle'
  );
}

test('group assignment and removal preserve unrelated native RDF', () => {
  const source = graph();
  const app = source.get(base + '#app');
  assert.equal(shortcutGroup(app), '');
  setShortcutGroup(app, base + '#group');
  assert.equal(shortcutGroup(app), base + '#group');
  setShortcutGroup(app, '');
  assert.equal(shortcutGroup(app), '');
  assert.equal(valueAt(app, 'https://example.org/unknown').length, 2);
  const group = source.get(base + '#group');
  assert.deepEqual(groupDescription(group), {
    id: base + '#group',
    order: 2
  });
  assert.equal(
    valueAt(group, 'https://example.org/unknown').toString(),
    'keep'
  );
  assert.ok([].concat(group.a).includes('https://example.org/Extra'));
  assert.equal(
    newGroupData(3)[prefixes.apps + 'shortcutOrder'].type,
    'http://www.w3.org/2001/XMLSchema#integer'
  );
});

test('unsupported membership is refused before mutation', () => {
  const source = graph('<#app> apps:shortcutGroup <#group>, <#other>.');
  const app = source.get(base + '#app');
  assert.throws(() => setShortcutGroup(app, ''), /one named resource/);
  assert.equal(valueAt(app, prefixes.apps + 'shortcutGroup').length, 2);
});

test('moves advance replica revision time, including repeated edits in one millisecond', () => {
  const source = graph(
    '<#app> <http://purl.org/dc/terms/modified> "2099-01-01T00:00:00.000Z".'
  );
  const app = source.get(base + '#app');
  const previous = Date.parse(
    String(valueAt(app, prefixes.dcterms + 'modified'))
  );
  applyShortcutOrder([app]);
  const next = Date.parse(String(valueAt(app, prefixes.dcterms + 'modified')));
  assert.ok(next > previous);
  applyShortcutOrder([app]);
  assert.ok(
    Date.parse(String(valueAt(app, prefixes.dcterms + 'modified'))) > next
  );
});
