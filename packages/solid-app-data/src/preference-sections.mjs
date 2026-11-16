import { capabilityError } from './capabilities.mjs';

export const editPreferenceSectionCapability =
  'https://vocab.muze.nl/capabilities/edit-preference-section';

// Metadata only. No component source or credentials cross this boundary.
export function preferenceSections(value = [], origin) {
  if (!Array.isArray(value) || value.length > 16) {
    throw capabilityError('Invalid preference sections.', 'denied');
  }
  const ids = new Set();
  return value.map((section) => {
    if (
      !section ||
      typeof section.id !== 'string' ||
      !/^[a-z][a-z0-9-]{0,79}$/.test(section.id) ||
      ['appearance', 'language', 'opening', 'providers'].includes(section.id) ||
      ids.has(section.id) ||
      typeof section.label !== 'string' ||
      !section.label.trim() ||
      section.label.length > 120
    ) {
      throw capabilityError('Invalid preference section identity.', 'denied');
    }
    let url;
    try {
      url = new URL(section.url);
    }
    catch {
      throw capabilityError('Invalid preference section URL.', 'denied');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== origin
    ) {
      throw capabilityError(
        'Preference section must belong to its caller.',
        'denied'
      );
    }
    const workspaceKeys = section.workspaceKeys || [];
    if (
      !Array.isArray(workspaceKeys) ||
      workspaceKeys.some(
        (key) =>
          !['filesRoot', 'contactsResource', 'launcherResource'].includes(key)
      )
    ) {
      throw capabilityError('Unsupported workspace setting grant.', 'denied');
    }
    ids.add(section.id);
    return {
      id: section.id,
      label: section.label,
      url: url.href,
      workspaceKeys: [...new Set(workspaceKeys)]
    };
  });
}
