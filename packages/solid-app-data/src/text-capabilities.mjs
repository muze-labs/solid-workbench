// Explicit host-owned text contracts. No resource read/write authority is implied.
export const viewTextCapability =
  'https://vocab.muze.nl/capabilities/view-text';
export const createTextCapability =
  'https://vocab.muze.nl/capabilities/create-text';
export const editTextCapability =
  'https://vocab.muze.nl/capabilities/edit-text';
export function textDraft(value) {
  if (
    !value ||
    value.version !== 1 ||
    value.access !== 'host-draft' ||
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.text !== 'string'
  ) {
    throw new Error(
      'text-capabilities: Expected an identified host-owned text draft.'
    );
  }
  return { version: 1, access: 'host-draft', id: value.id, text: value.text };
}
