import { defaults, applyPreferences } from './index.mjs';
import { PreferenceState } from './state.mjs';

export function announcePreferences(owner) {
  localStorage.setItem(
    'solid-apps.preferences-change',
    owner + '\n' + crypto.randomUUID()
  );
}

// Hosts consume settings without constructing the editor or loading its UI.
export function preferenceConsumer({ getSession, getOwner, onChange }) {
  let state;
  function apply(values) {
    applyPreferences(values);
    onChange(values);
  }
  async function select(session = getSession()) {
    const owner = session?.webId || getOwner() || '';
    const url =
      session?.preferencesUrl ||
      localStorage.getItem('solid-apps.preferences-url:' + owner) ||
      '';
    if (!state || state.owner !== owner || state.url !== url) {
      state = new PreferenceState({ owner, url });
    }
    if (session?.preferencesUrl) {
      localStorage.setItem('solid-apps.preferences-url:' + owner, url);
    }
    await state.open();
    apply(state.settings());
    return state;
  }
  async function load(session = getSession()) {
    const current = await select(session);
    if (session?.preferencesUrl) {
      await current.synchronize(session);
      apply(current.settings());
    }
    return current.settings();
  }
  return {
    load,
    recover: load,
    refresh: select,
    reset() {
      state = undefined;
      apply({ ...defaults });
    },
    get state() {
      return state;
    }
  };
}
