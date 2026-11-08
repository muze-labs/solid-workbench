# Shared Solid preferences

Experimental `@muze-labs/solid-preferences`. Editing lives in the separate
Preferences app at `/preferences/`, normally embedded through the existing
capability dialog. Hosts consume settings through `preferenceConsumer`; they
load no editor template or form component.

`defaults`, `readPreferences`, `validatePreferences` and `applyPreferences`
remain shared. `loadPreferences` and `savePreferences` retain their partial
native-RDF document API for data clients. The profile's `pim:preferencesFile`
remains authoritative; unknown RDF and omitted fields survive conditional saves.

`PreferenceState` uses Solid Workspace's native-Turtle IndexedDB source. The
cache contains confirmed fields, pending choices, per-field native baselines and
incomplete drafts. Valid edits apply after local persistence. Synchronization
loads the current remote graph, compares edited-field baselines, preserves other
terms and writes conditionally through the existing Metro document helpers.
Conflicting fields require an explicit local/Pod choice. Interrupted or offline
writes retain pending choices; an already-equal remote value can acknowledge a
lost successful response. No whole-state JSON or JSON-in-Turtle cache is used.

`preferenceConsumer` loads cached choices before remote settings, applies shared
appearance, and retains workspace-specific overrides supplied by Workbench.
Same-origin change notices prompt other open hosts to reread their native cache;
startup, visibility, online and existing authentication recovery refresh it too.
The notice contains identity and a nonce, never credentials or settings data.

The Preferences app registers app-owned `settings-sections.mjs` descriptors and
`settings.html` templates. Common sections stay first. Existing suite contributions
are compiled with the established template pipeline, keeping View Source and
editable SimplyFlow datasets useful. This is not a third-party code loader or
provider registry. Register descriptors in Preferences’ sections component, export the named
component through its features module, include it in the app composition and
place its named view in the main details pane. No editor import is needed in the
calling app.

Workbench remains the live workspace writer. Preferences sends scoped operations
with owner, workspace ID and expected revision over the existing private broker
port. Selecting an inactive workspace edits its configuration without activating
it. Incomplete workspace text is retained separately as native Turtle drafts.
Workspace and binary background synchronization use Workbench's existing
conditional workflow. Standalone Preferences offers opening Workbench when no
workspace host is connected. Common/app defaults can be edited independently.

The old embedded dialog factory and per-host form templates have been retired.
