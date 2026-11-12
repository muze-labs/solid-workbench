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
plugin registry. Register descriptors in Preferences’ sections component, export the named
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


## Preferred resource picker

Preferences' shared **Default apps** section selects one `browse` provider per
WebID across all workspaces. Choose a declared capable app saved in the current
Launcher's shortcuts, enter a compatible app URL, or reset to built-in Files.
Manifest reads happen on opening/refreshing this section; unavailable metadata
leaves the list incomplete without deleting the effective choice. Apps declare
`https://vocab.muze.nl/capability#provides` in their explicit linked manifest.
A declaration is metadata; the private task must advertise the capability at
runtime too. Anonymous invocation continues to use built-in Files.

`browseProvider` is either null (built-in) or an application identity plus a
launch URL. Identity may be a named URN; launch URLs must be HTTP(S) without
credentials. The two terms are one native conflict unit. Incomplete URL input
is a separate local draft. Saving clears a matching draft atomically, preserving
newer text. Conditional sync can acknowledge a lost write response by comparing
the actual remote binding rather than replaying the write.

The experimental registry is a named fragment of the linked preferences
resource. Its `cap:registry` link belongs to `#solid-apps`; `rdfs:member` links
registry bindings. A browse binding records `cap:provides`, `cap:application`
and binding-local `schema:url`. Keeping configuration on the binding preserves
shared application descriptions. Reset removes the owned membership and terms,
retaining unknown triples and other capability bindings. Multiple/structured
interpreted values and external registries are refused, not flattened.

Workbench resolves this choice through its existing broker callback. The
existing presenter owns iframe/tab fallback and transient lifecycle. Calls use
private tickets, exact origin/route/query checks, readiness and cancellation.
A custom choice does not grant general app-to-app or Pod access. Provider URLs
receive the supported launch context without overwriting their route. Ordinary
permission-checked top-level routing and the legacy picker API remain intact.


## Preferred recipient picker

The Default apps section also selects the recipient picker. `recipientProvider`
uses the same application/URL native binding and whole-choice conflict rules
as `browseProvider`, with `cap:provides` set to
`https://vocab.muze.nl/capabilities/select-recipient`. Its default is Contacts.
The editor's Selection task control switches between resource and recipient
choices and keeps their drafts independent. Registered live declarations and
explicit manifests are checked for the selected capability; custom URLs still
need runtime capability support. Resetting one picker preserves the other.

The native local cache keeps each provider's named choice separate in confirmed,
pending and baseline scopes. The existing browse cache node identity is retained
for compatibility. Neither binding grants Pod permission or broadens ordinary
app-to-app routing; invocation still uses an exact scoped embedded ticket.
