const presentationKey = 'solid-apps.inspector-presentation';
let presentation = 'dock';

export function getInspectorPresentation() {
  try {
    return localStorage.getItem(presentationKey) === 'window' ? 'window' : 'dock';
  }
  catch {
    return presentation;
  }
}

export function setInspectorPresentation(value) {
  presentation = value;
  try {
    localStorage.setItem(presentationKey, value);
  }
  catch {
    // The current page can still remember the choice without storage.
  }
}

export function requestInspectorWindow(url) {
  return window.open(url, '_blank', 'popup,width=500,height=720');
}
