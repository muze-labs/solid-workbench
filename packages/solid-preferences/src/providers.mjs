import { httpUrl } from '@muze-labs/solid-app-data/url.mjs';
import { named, sameTerm } from '@muze-labs/solid-app-data/state-rdf.mjs';

export const capabilityNamespace = 'https://vocab.muze.nl/capability#';
export const providerCapabilities = Object.freeze({
  textViewProvider: 'https://vocab.muze.nl/capabilities/view-text',
  textCreateProvider: 'https://vocab.muze.nl/capabilities/create-text',
  textEditProvider: 'https://vocab.muze.nl/capabilities/edit-text',
  viewProvider: 'https://vocab.muze.nl/capabilities/view-resource',
  browseProvider: 'https://vocab.muze.nl/capabilities/browse',
  recipientProvider: 'https://vocab.muze.nl/capabilities/select-recipient'
});
const browse = providerCapabilities.browseProvider;
const member = 'http://www.w3.org/2000/01/rdf-schema#member';
const launch = 'https://schema.org/url';

export function validateProvider(choice) {
  if (choice === null) {
    return choice;
  }
  if (
    !choice ||
    typeof choice.application !== 'string' ||
    typeof choice.url !== 'string' ||
    Object.keys(choice).some((key) => !['application', 'url'].includes(key))
  ) {
    throw new Error('preferences-provider: Choose an application and URL.');
  }
  new URL(choice.application);
  httpUrl(choice.url);
  return { application: choice.application, url: choice.url };
}

export function sameProvider(left, right) {
  return (
    left === right ||
    Boolean(
      left &&
        right &&
        left.application === right.application &&
        left.url === right.url
    )
  );
}

// Keep launch configuration on the binding, not on a shared app description.
export function providerChoice(graph, node) {
  return validateProvider({
    application: graph.one(
      node,
      capabilityNamespace + 'application',
      'iri',
      true
    ).id,
    url: graph.one(node, launch, 'iri', true).id
  });
}

export function setProviderChoice(graph, node, choice) {
  graph.set(
    node,
    capabilityNamespace + 'application',
    choice ? named(choice.application) : undefined
  );
  graph.set(node, launch, choice ? named(choice.url) : undefined);
}

function registryBinding(graph, url, capability) {
  const root = named(url + '#solid-apps');
  const registry = graph.one(root, capabilityNamespace + 'registry', 'iri');
  if (!registry) {
    return { root };
  }
  if (!registry.id.startsWith(url + '#')) {
    throw new Error(
      'preferences-provider: External provider registries are not supported.'
    );
  }
  const bindings = graph
    .values(registry, member)
    .filter((node) =>
      graph
        .values(node, capabilityNamespace + 'provides')
        .some((term) => sameTerm(term, named(capability)))
    );
  if (bindings.length > 1) {
    throw new Error('preferences-provider: Multiple picker bindings.');
  }
  const binding = bindings[0];
  if (binding) {
    const capabilities = graph.values(
      binding,
      capabilityNamespace + 'provides'
    );
    if (
      binding.termType !== 'NamedNode' ||
      !binding.id.startsWith(url + '#') ||
      capabilities.length !== 1
    ) {
      throw new Error('preferences-provider: Unsupported picker binding.');
    }
  }
  return {
    root,
    registry,
    binding,
    choice: binding ? providerChoice(graph, binding) : null
  };
}

export function readProvider(graph, url, capability = browse) {
  return registryBinding(graph, url, capability).choice || null;
}

export function writeProvider(graph, url, choice, capability = browse) {
  validateProvider(choice);
  let { root, registry, binding } = registryBinding(graph, url, capability);
  if (!choice) {
    if (binding) {
      graph.quads = graph.quads.filter(
        (quad) =>
          !(
            sameTerm(quad.subject, registry) &&
            quad.predicate.id === member &&
            sameTerm(quad.object, binding)
          )
      );
      graph.set(binding, capabilityNamespace + 'provides', undefined);
      setProviderChoice(graph, binding, null);
    }
    return;
  }
  if (!registry) {
    registry = named(url + '#providers-' + crypto.randomUUID());
    graph.set(root, capabilityNamespace + 'registry', registry);
  }
  if (!binding) {
    binding = named(url + '#picker-' + crypto.randomUUID());
    graph.add(registry, member, binding);
    graph.set(binding, capabilityNamespace + 'provides', named(capability));
  }
  setProviderChoice(graph, binding, choice);
}
