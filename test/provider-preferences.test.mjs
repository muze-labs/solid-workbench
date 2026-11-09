import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StateGraph, named, literal, sameTerm
} from '../packages/solid-app-data/src/state-rdf.mjs';
import {
  capabilityNamespace as cap, readProvider, writeProvider, validateProvider
} from '../packages/solid-preferences/src/providers.mjs';
import { WorkspaceBroker } from '../packages/solid-app-data/src/workspace-broker.mjs';
import { browseCapability } from '../packages/solid-app-data/src/capabilities.mjs';

const url = 'https://pod.example/preferences.ttl';
const choice = { application: 'https://apps.example/#application',
  url: 'https://apps.example/pick/?mode=one#route' };
const member = 'http://www.w3.org/2000/01/rdf-schema#member';

test('changing and resetting a provider preserve other bindings and app descriptions', () => {
  const graph = new StateGraph(`
    <#solid-apps> <${cap}registry> <#registry> .
    <#registry> <${member}> <#other> .
    <#other> <${cap}provides> <urn:another:capability> ;
      <urn:unknown> [ <urn:nested> "retain" ] .
    <${choice.application}> <https://schema.org/name> "Shared app" ;
      <https://schema.org/url> <https://apps.example/ordinary/> .
  `, url);
  const original = graph.clone();
  writeProvider(graph, url, choice);
  assert.deepEqual(readProvider(graph, url), choice);
  const binding = graph.values(named(url + '#registry'), member)
    .find((node) => node.id !== url + '#other');
  graph.set(binding, 'urn:unknown', literal('binding metadata'));
  writeProvider(graph, url, { ...choice, url: 'https://other.example/pick/' });
  assert.equal(readProvider(graph, url).url, 'https://other.example/pick/');
  writeProvider(graph, url, null);
  assert.equal(readProvider(graph, url), null);
  for (const quad of original.quads) {
    assert(graph.quads.some((candidate) =>
      sameTerm(candidate.subject, quad.subject) &&
      sameTerm(candidate.predicate, quad.predicate) &&
      sameTerm(candidate.object, quad.object)));
  }
  assert.equal(graph.one(binding, 'urn:unknown', 'string').value,
    'binding metadata');
});

test('ambiguous, external and structured bindings fail without graph mutation', () => {
  for (const source of [
    `<#solid-apps> <${cap}registry> <https://elsewhere.example/registry> .`,
    `<#solid-apps> <${cap}registry> <#r> .
     <#r> <${member}> <#a>, <#b> .
     <#a> <${cap}provides> <${browseCapability}> .
     <#b> <${cap}provides> <${browseCapability}> .`,
    `<#solid-apps> <${cap}registry> <#r> .
     <#r> <${member}> <#a> .
     <#a> <${cap}provides> <${browseCapability}> ;
       <${cap}application> [ <urn:unknown> "keep" ] .`
  ]) {
    const graph = new StateGraph(source, url);
    const before = graph.write();
    assert.throws(() => readProvider(graph, url));
    assert.throws(() => writeProvider(graph, url, choice));
    assert.equal(graph.write(), before);
  }
  for (const unsafe of ['javascript:alert(1)', 'https://user:pass@host.example/']) {
    assert.throws(() => validateProvider({ ...choice, url: unsafe }));
  }
});

test('task tickets follow provider changes and reject route or query substitution', (t) => {
  let preferred = choice.url;
  const target = { name: '', location: { origin: 'https://suite.example' },
    addEventListener() {}, removeEventListener() {} };
  const broker = new WorkspaceBroker({ target,
    resolveProvider: () => preferred });
  t.after(() => broker.dispose());
  assert.equal(broker.embeddedProvider(browseCapability), choice.url);
  for (const modified of [
    choice.url.replace('mode=one', 'mode=two'),
    choice.url.replace('#route', '#other'),
    choice.url.replace('apps.example', 'imposter.example')
  ]) {
    assert.throws(() => broker.beginEmbedded(modified, browseCapability),
      /not configured/);
  }
  const launched = new URL(choice.url);
  launched.searchParams.set('solid-apps-task', '');
  launched.hash = 'route?webid=https%3A%2F%2Fperson.example%2F%23me';
  const task = broker.beginEmbedded(launched.href, browseCapability);
  assert.equal(broker.snapshot().apps.length, 0);
  broker.endEmbedded(task.id);
  preferred = 'https://other.example/picker/';
  assert.throws(() => broker.beginEmbedded(choice.url, browseCapability),
    /not configured/);
});


test('application identity may be a named URN without being treated as a launch URL', () => {
  const graph = new StateGraph('', url);
  const provider = { ...choice, application: 'urn:example:picker' };
  writeProvider(graph, url, provider);
  assert.deepEqual(readProvider(graph, url), provider);
});
