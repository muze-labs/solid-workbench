import '@muze-labs/solid-app-data/oldm.mjs';
import { prefixes, valueAt } from '@muze-labs/solid-app-data';
import { shortcutOrder } from './shortcuts.mjs';

export const groupType = prefixes.apps + 'LauncherGroup';
export const groupPredicate = prefixes.apps + 'shortcutGroup';

export function shortcutGroup(subject) {
  const groups = this ?? launcherGroups;
  const value = groups.valueAt(subject, groups.groupPredicate);
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
  const groups = this ?? launcherGroups;
  groups.shortcutGroup(subject);
  if (id) {
    subject.graph.set(
      subject.id,
      groups.groupPredicate,
      subject.graph.addNamedNode(id)
    );
  }
  else {
    subject.graph.delete(subject.id, groups.groupPredicate);
  }
}

export const launcherGroups = {
  groupType,
  groupPredicate,
  groupDescription,
  newGroupData,
  setShortcutGroup,
  shortcutGroup,
  valueAt
};

export function newGroupData(order) {
  return {
    a: groupType,
    [prefixes.apps + 'shortcutOrder']: oldm.literal(String(order), {
      type: 'http://www.w3.org/2001/XMLSchema#integer'
    })
  };
}
