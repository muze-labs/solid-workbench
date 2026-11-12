import test from 'node:test';
import assert from 'node:assert/strict';
import { oldm, prefixes } from '../packages/solid-app-data/src/index.mjs';
import { describeRecipient, readRecipient } from '../packages/solid-app-data/src/recipient.mjs';
import { readProfile } from '../packages/solid-profile/src/index.mjs';

const id = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
const url = 'https://pod.example/contacts.ttl';
const source = `<${id}> a <http://www.w3.org/2006/vcard/ns#Individual>;
  <http://www.w3.org/2006/vcard/ns#fn> "Selected";
  <http://www.w3.org/2006/vcard/ns#hasEmail> <mailto:a@example.org>, <mailto:b@example.org>;
  <urn:unknown> [ <urn:label> "native"@nl ] .
  <urn:other-person> <http://www.w3.org/2006/vcard/ns#fn> "Private other contact" .`;

test('selected RDF is usable without a published document and excludes other contacts', async () => {
  const graph = oldm.context({ prefixes }).parse(source, url, 'text/turtle');
  const before = await graph.write();
  const result = await describeRecipient(graph.get(id), 'contacts');
  assert.equal(result.document, undefined);
  assert(result.description.turtle.includes('native'));
  assert(!result.description.turtle.includes('Private other contact'));
  const contact = await readRecipient(result, null);
  assert.equal(readProfile(contact.node).name, 'Selected');
  assert.equal(readProfile(contact.node).email, 'a@example.org\nb@example.org');
  assert.equal(await graph.write(), before);
});
test('document references are read by the caller session without changing the entity ID', async () => {
  const calls = [];
  const session = { async perform(operation, options) {
    assert.equal(options.interactive, false); return operation();
  }, client: { async get(resource) {
    calls.push(resource); return new Response(source, { headers: { 'Content-Type': 'text/turtle' } });
  } } };
  const result = await readRecipient({ '@id': id, document: url }, session);
  assert.equal(result.id, id);
  assert.equal(readProfile(result.node).name, 'Selected');
  assert.deepEqual(calls, [url]);
});
test('selected local data wins over stale remote data and unsafe replies fail', async () => {
  const graph = oldm.context({ prefixes }).parse(source, url, 'text/turtle');
  const result = await describeRecipient(graph.get(id), url);
  const contact = await readRecipient(result, { client: { get() { throw new Error('unexpected read'); } } });
  assert.equal(contact.source, 'Selected contact data');
  for (const payload of [
    { '@id': id },
    { '@id': id, document: 'javascript:alert(1)' },
    { '@id': id, description: { turtle: source } },
    { '@id': id, description: { turtle: '<urn:other> <urn:field> "not selected" .' } }
  ]) {
    await assert.rejects(readRecipient(payload, null));
  }
});

test('named structured contact values survive without exporting another person', async () => {
  const text = `<${id}> <http://www.w3.org/2006/vcard/ns#fn> "Selected";
    <http://www.w3.org/2006/vcard/ns#hasEmail> <#email>;
    <urn:friend> <urn:other> .
    <#email> <http://www.w3.org/2006/vcard/ns#value> <mailto:structured@example.org>;
      <urn:metadata> "retain"@nl .
    <urn:other> <http://www.w3.org/2006/vcard/ns#fn> "Unrelated person" .`;
  const graph = oldm.context({ prefixes }).parse(text, url, 'text/turtle');
  const result = await describeRecipient(graph.get(id), url);
  const contact = await readRecipient(result, null);
  assert.equal(readProfile(contact.node).email, 'structured@example.org');
  assert(result.description.turtle.includes('retain'));
  assert(!result.description.turtle.includes('Unrelated person'));
});


test('oversized and shared-anonymous exports fail without changing source data', async () => {
  const shared = `<${id}> <urn:a> _:shared; <urn:b> _:shared .
    _:shared <urn:value> "preserve sharing" .`;
  const graph = oldm.context({ prefixes }).parse(shared, url, 'text/turtle');
  await assert.rejects(describeRecipient(graph.get(id), url), /Shared or cyclic/);
  const large = oldm.context({ prefixes }).parse(
    `<${id}> <http://www.w3.org/2006/vcard/ns#note> "${'x'.repeat(61000)}" .`,
    url, 'text/turtle');
  await assert.rejects(describeRecipient(large.get(id), url), /too large|exceeds 64 KB/);
  assert.equal(String(large.get(id).vcard$note).length, 61000);
});
