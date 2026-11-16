import { oldm, prefixes, valueAt } from '@muze-labs/solid-app-data';
import { shortcutOrder } from './shortcuts.mjs';

export const groupType = prefixes.apps + 'LauncherGroup';
export const groupPredicate = prefixes.apps + 'shortcutGroup';

export function shortcutGroup(subject) {
  const value = valueAt(subject, groupPredicate);
  if (value === undefined) {
    return '';
  }
  if (Array.isArray(value) || !value?.id || value.id.startsWith('_:')) {
    throw new Error(
      'launcher/groups: Shortcut group must be one named resource.'
    );
  }
  return value.id;
}

export function groupDescription(subject) {
  if (![].concat(subject.a || []).includes(groupType)) {
    return null;
  }
  return { id: subject.id, order: shortcutOrder(subject) };
}

export function setShortcutGroup(subject, id) {
  shortcutGroup(subject);
  if (id) {
    subject.graph.set(
      subject.id,
      groupPredicate,
      subject.graph.addNamedNode(id)
    );
  }
  else {
    subject.graph.delete(subject.id, groupPredicate);
  }
}

export function newGroupData(order) {
  return {
    a: groupType,
    [prefixes.apps + 'shortcutOrder']: oldm.literal(String(order), {
      type: 'http://www.w3.org/2001/XMLSchema#integer'
    })
  };
}
