// SimplyFlow owns composition, bindings and runtime feature definitions.
// Sources contain optional same-build authoring URLs, never startup payloads.
export function exposeDefinition(view, options, sources) {
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
  const destroy = view.destroy.bind(view);
  view.destroy = () => {
    if (!view.destroyed) {
      try {
        if (Object.hasOwn(view.actions || {}, 'cleanup')) {
          view.actions.cleanup();
        }
      }
      finally {
        destroy();
      }
    }
  };
  return view;
}
