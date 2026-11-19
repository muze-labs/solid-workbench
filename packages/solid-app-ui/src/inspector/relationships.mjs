function lineage(owner, element) {
  const elements = [];
  for (let node = element; node && owner.container.contains(node); node = node.parentElement) {
    elements.push(node);
  }
  return elements;
}

function definitionFor(owner, section, name) {
  return Object.entries(owner.components).reverse().find(
    ([, definition]) => Object.hasOwn(definition[section] || {}, name)
  );
}

function templateAt(owner, element) {
  const marker = owner.binding.options.attribute + '-template';
  const root = lineage(owner, element).find((node) => node.hasAttribute(marker));
  if (!root) {
    return;
  }
  const name = root.getAttribute(marker);
  const definition = definitionFor(owner, 'templates', name);
  const markup = owner.templates[name] ??
    owner.container.querySelector('template#' + CSS.escape(name))?.innerHTML;
  return {
    name,
    component: definition?.[0],
    section: 'templates',
    code: markup
  };
}

function relationsAt(owner, element) {
  const elements = lineage(owner, element);
  const binding = elements.find((node) => owner.binding.getBindingPath(node));
  const path = binding && owner.binding.getBindingPath(binding);
  const template = templateAt(owner, element);
  const dataTemplate = binding && templateAt(owner, binding);
  const trigger = elements.find((node) => node.hasAttribute('data-simply-command'));
  const commandName = trigger?.dataset.simplyCommand;
  const commandDefinition = commandName && definitionFor(owner, 'commands', commandName);
  const command = commandName && Object.hasOwn(owner.commands, commandName)
    ? owner.commands[commandName]
    : null;
  const dataDefinition = path && definitionFor(owner, 'data', path.split('.')[0]);
  const component = template?.component || commandDefinition?.[0] ||
    dataDefinition?.[0];
  const links = new Map();

  if (path) {
    const declaration = dataDefinition && {
      component: dataDefinition[0],
      section: 'component'
    };
    links.set('data', {
      ...(dataTemplate || declaration),
      label: 'Data',
      value: path
    });
  }
  if (template) {
    links.set('template', { ...template, label: 'Template', value: template.name });
  }
  if (component) {
    links.set('component', {
      label: 'Component',
      value: component,
      component,
      section: 'component'
    });
  }
  if (commandName) {
    links.set('command', {
      label: 'Command',
      value: commandName,
      name: commandName,
      component: commandDefinition && commandDefinition[1].commands[commandName] === command
        ? commandDefinition[0] : undefined,
      section: 'commands',
      code: typeof command === 'function' ? command.toString() : undefined
    });
  }
  return links;
}

export function inspectRelationships(owner, element) {
  const attribute = owner.binding.options.attribute;
  const parents = lineage(owner, element.parentElement).flatMap((node) => {
    const template = node.getAttribute(attribute + '-template');
    const path = owner.binding.getBindingPath(node);
    const command = node.dataset.simplyCommand;
    const label = template || path || command;
    if (!label) {
      return [];
    }
    const entries = relationsAt(owner, node);
    const source = template
      ? entries.get('template')
      : entries.get('data') || entries.get('command');
    return [{ node, label, source }];
  });
  return { links: relationsAt(owner, element), parents };
}

function sourceUrl(owner, link) {
  return link?.component && owner.definition.sources?.[link.component]?.url;
}

export function hasRelationshipSource(owner, link) {
  return typeof link?.code === 'string' || Boolean(sourceUrl(owner, link));
}

export async function relationshipSource(owner, link) {
  let code = link.code;
  let origin = '';
  let missingSource = 'The source file does not contain this entry.';
  const url = sourceUrl(owner, link);
  if (url) {
    try {
      const asset = await import(url);
      if (link.section === 'component') {
        code = asset.definition?.source;
        origin = asset.definition?.origin;
      }
      else if (link.section) {
        const entry = asset.default[link.section]?.[link.name];
        origin = entry?.origin;
        if (link.section === 'commands') {
          code = entry?.source ?? code;
        }
      }
    }
    catch {
      missingSource = 'Could not load the source file.';
    }
  }
  return {
    origin: origin || '',
    code: code ?? missingSource
  };
}
