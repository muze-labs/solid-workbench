function markDefinitionMaps(definition) {
  if (definition.api) {
    simply.mergeable(definition.api);
  }
  const events = definition.events;
  if (events) {
    simply.mergeable(events);
    for (const descriptor of Object.values(events)) {
      if (descriptor) {
        simply.mergeable(descriptor);
      }
    }
  }
  for (const component of Object.values(definition.components || {})) {
    if (component) {
      markDefinitionMaps(component);
    }
  }
}

function destroyWorkbenchApp() {
  const errors = [];
  try {
    this.eventBindings?.destroy();
  }
  catch (error) {
    errors.push(error);
  }
  try {
    if (Object.hasOwn(this.actions || {}, 'cleanup')) {
      this.actions.cleanup();
    }
  }
  catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'solid-app-data: App cleanup failed');
  }
}

export function prepareDefinition(definition) {
  markDefinitionMaps(definition);
  return { destroy: destroyWorkbenchApp, ...definition };
}

// SimplyFlow owns composition, bindings and runtime feature definitions.
// Sources contain optional same-build authoring URLs, never startup payloads.
export function exposeDefinition(view, sources) {
  const options = view.components.app;
  const sections = [
    'templates',
    'styles',
    'commands',
    'actions',
    'shortcuts',
    'behaviors',
    'routes',
    'transformers',
    'events'
  ];
  view.definition = {
    components: options.components,
    overrides: Object.fromEntries(
      sections.map((name) => [name, options[name] || {}])
    ),
    sources,
    get dependencies() {
      return Object.keys(view.api || {});
    },
    context: 'this.data, this.actions, this.api, this.runtime, this.container'
  };
  return view;
}
