# Solid Workbench

Solid Workbench is the launcher for a suite of small browser applications using
SimplyFlow, the Muze design system and the Solid stack. The repository is
[muze-labs/solid-workbench](https://github.com/muze-labs/solid-workbench).
This is an experimental, private npm workspace: no packages need to be published
to run it.

See the [Solid Apps roadmap](design/solid-apps-roadmap.md) for planned apps,
mobile/local-first and PWA requirements, account improvements and decentralized
app catalogs. These are future direction, not current feature claims.

## Try it

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4174/> or <http://127.0.0.1:4174/workbench/>.
Solid Workbench links to Contacts, Files, Profile, Presenter and Notebook.
The dev command builds once, then starts the server. Restart it after changing
server code or response types; rebuilding `www/` alone does not reload the
running server's configuration.
Node 20.6 or newer is required for the build; the browser integration harness uses
Node 22 or newer (native WebSocket) and `google-chrome` on PATH. Use localhost or
HTTPS so browser storage, crypto and authentication work. Deploy `www/` as static
files, preserving all nine app paths and `/redirect.html`. External dependencies
come from npm; workspace links only connect packages inside this repository.

Contacts and shortcuts work locally in IndexedDB before connecting. Enter a WebID
through **WebID / connection**, then choose **Sync with Solid** in Contacts or Launcher.
The connected WebID is remembered on this origin. Background restoration does not
open a login popup; a user gesture is required when sign-in is needed.

Launcher manages apps opened through it, checkpoints their restoration state
locally, and can save that default workspace to your Pod. **Save & close** waits
for a confirmed save; the browser close button attempts a best-effort save.
Reopening restores the saved app set, subject to popup permission. See the
[workspace guide](broker/README.md) for setup and limitations. Creating multiple
named workspaces remains [planned](design/solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).
Shortcut collection sync is separate.

When connected, **WebID / connection** also offers **Log out**. It clears the
current account's cached access, refresh and ID tokens and the remembered WebID.
Open suite apps on the same origin discard authorization without reloading
local editors. Launcher also checkpoints and closes its managed apps. Local contacts and shortcuts remain in IndexedDB. This is
logout from these apps; the identity provider may retain its own login session.

## Applications

| App | Working basic slice |
| --- | --- |
| Solid Workbench (launcher) | Shortcuts and explicit Solid sync; browser-local capability routing; app lifecycle and local/Pod workspace checkpoints. |
| Contacts | Add sparse contacts, search, view/edit profiles, delete with tombstones, local persistence and explicit Solid sync. |
| Profile | Read a WebID profile, edit your connected profile, or edit a local contact using the same component as Contacts. |
| Files | Browse folders, create folders, upload/download binary files, and mark resources deleted through link metadata. |
| Presenter | Background and centered rich text, inline provider editing, thumbnails, native RDF autosave and conditional Pod saves, fullscreen presentation. |
| Notebook | Ordered rich-text blocks; separate local recovery documents; New/Open/Save/Save As with conditional Pod writes. |
| Resource Viewer | Standalone and embedded text/image viewing; independent text create/edit capabilities. |
| Preferences | Dialog app for shared appearance, app settings and default providers. |
| Account | Dialog app for WebID, connection status, connect/disconnect and browser logout; Workbench coordinates managed switching. |

Contact fields include name, emails, phone numbers, websites, public-profile link
and notes. Names and WebIDs are optional. Editing a private contact does not edit
that person's public profile. Remote profile editing is offered only for your
connected WebID; server authorization remains authoritative. Structured vCard
values are displayed and preserved but cannot yet be edited.

## Create and present a deck

Open **Suite apps → Open Presenter** in Workbench, or `/presenter/` directly.
Choose **Add slide**, click the centered text and type. Select text for the
Feather **Bold**, **Italic** and **Link** controls. **Dock / Float** changes toolbar
placement; **Text tools** or Ctrl+Space opens it from the keyboard, and Escape
returns to editing. **Background** opens the Files image picker. The numbered
thumbnails select slides; arrow buttons reorder them without dragging.

**Present** requests fullscreen, with a viewport-sized fallback when unavailable.
Use Previous/Next, arrow keys or Page Up/Down, and Escape to exit. Long text remains
editable but reports a fit error in presentation instead of silently clipping it.

The deck, including formatting, autosaves as native Turtle on this device,
separately for each account and signed-out use. Under **Deck**, supply a `.ttl`
document URL and choose **Save to Pod**. Save before opening or starting another
deck. A conflict keeps local edits; save to a new URL to retain a separate copy.
**Copy signed-out deck** copies that local deck into an empty account deck and
retains the original. One current local deck per account is supported; simultaneous
editing in multiple tabs is not coordinated.

The separate Cobalt provider saves a native recovery draft before notifying
Presenter. Presenter clears that draft only after confirming durable local deck
storage. Images remain URL references, read through the provider's own connection.
Loaded text remains editable offline; uncached images and provider code are not
available offline. **View options** offers retry and provider recovery. Presenter
exposes `muzeSolidPresenterApp` for inspection. The published Cobalt 0.1.1 editor fixes composition input: committed IME text
reaches the native fragment, and unfinished composition prevents slide closure
or passive presentation. Its runtime matches the formerly authorized local build;
see [package provenance](local-packages/README.md). Cobalt still does not
supply undo/redo. Additional styling, physical-phone keyboards and manual
assistive-technology review remain follow-up.

## Launch a profile resource

In Launcher, enter a full resource URL under **Open a profile resource**, then
choose **Open in Profile**. Connect to Solid unless selecting anonymous launch.
A fresh Profile tab (or window, if selected in Preferences)
opens the requested subject, including a fragment such as `contacts.ttl#alice`.
Launcher supplies its current WebID for identified launches and remains open.
Allow new tabs if your browser blocks the launch.

Profile reports inaccessible resources or missing subjects. Opening a resource
does not save changes or change preferences. A launch link names account
context; it does not grant access. If a different account is remembered, use
**WebID / connection** to connect explicitly before opening the resource.

The [launch-context contract](design/solid-app-launch-context.md) documents how
independent apps can construct compatible links using their own libraries.
This resource-opening slice supports Profile; launch-resource handling for
Contacts and Files remains later work.

Each shortcut has a **Launch mode** choice. **Follow application** uses the
mode declared in its RDF description, falling back to URL fragments when none
is set. You can override it with **URL query (?)** for a server-side app or
**URL fragment (#)**, then return to Follow application. Query mode sends your
WebID and resource URL to the app's server; fragment mode keeps them in the
browser's launch fragment, outside that HTTP request. These declarations
currently come from the launcher collection;
remote application-description discovery is later work.

**Launch anonymously (omit WebID)** is saved separately for each shortcut,
so you can link the same app more than once with different choices. Anonymous
links contain no WebID and include a resource only when specified. They work
without connecting Launcher. The Profile launch form also offers this option
and accepts an optional resource. Omitting WebID does not sign you out of a
receiving app that already has its own session.

## Shared preferences

**Choose in Files** opens the built-in Files app on demand or focuses an allowed
existing instance, using private browser message channels. Files need not already
be open. It retains its own Solid connection. See the [workspace guide](broker/README.md)
for connection and permission steps. Selection returns a URL into Launcher's
resource field; cancellation preserves its previous value. Both apps keep their
own Solid sessions.

Every app offers common preferences plus its own storage settings: Contacts has
its address-book resource, Launcher has shortcut and workspace resources, and
Files has its root container. Profile currently has only common settings.
Saving leaves other apps' storage settings and unrelated RDF unchanged.
The dialog loads the URL linked by
`pim:preferencesFile` on the connected WebID; it never guesses a preferences path.
An absent resource may be created at that linked URL. If the profile has no link,
the dialog explains the missing prerequisite; profile-link creation is not part
of this first version.

Settings cover system/light/dark appearance, text size, density, preferred
language, app launch presentation, and Contacts/Launcher/Files/workspace storage
locations.
**Open apps in** chooses new tabs (the default) or new windows for Launcher links
and the Profile resource form. The choice is saved in your linked preferences
file and used when Launcher loads it. Browser settings can affect presentation.
Language is stored and
applied as the document language; the interface currently remains English.
Changing a storage location does not migrate existing data.

The app writes its settings on `<preferences-document#solid-apps>`, using
`https://vocab.muze.nl/solid-apps#` as an **application vocabulary**, not a published
interoperability standard. Storage locations are IRIs. Other settings are literals.
Unknown RDF in the preferences file is preserved. Existing resources require an
ETag and conditional writes; a conflict must be resolved by reloading and reviewing.

Default Contacts and Launcher resources are `apps/solid-apps/contacts.ttl` and
`apps/solid-apps/launcher.ttl` under the first advertised storage root. Files uses
that root unless overridden. Set explicit locations when your Pod has a different
layout. Local address books/shortcuts belong to this browser origin; switching
WebIDs does not create separate local stores or automatically migrate their data.

## Boundaries

| Workspace package | Responsibility |
| --- | --- |
| `solid-profile` | Native RDF profile reads/edits, shared SimplyFlow view/editor. No persistence policy. |
| `solid-preferences` | Linked preferences RDF, validation, document appearance, shared SimplyFlow dialog. |
| `solid-app-data` | This suite's Solid/RDF composition, conditional document writes, local collections, authentication and link metadata bridge. |
| `solid-app-ui` | Shared account dropdown, connection, status and preference wiring, design-system styles. |
| `apps/*` | Each application's commands, storage choices and HTML templates. |

These are experimental workspace packages, not commitments to new general-purpose
stack libraries. Models keep native OLDM graphs authoritative; views use small
projections and drafts. Saving preserves facts the app does not understand.
The build selects oldm-turtle for every app and the authentication callback
without changing the shared OLDM default, and rejects the build if its import
graph contains oldm-n3 or N3. They remain installed as transitive dependencies of
the upstream OLDM facade, but that facade is replaced by the suite's Turtle
composition when bundling. Readable bundles and source maps are
included; all dynamic content rendering uses SimplyFlow. Shared HTML is composed
at build time, with no extra runtime template engine.

Native DOM calls handle dialog/popover opening/closing, focus, form reset and file
selection, browser downloads, app-window navigation, and document-wide
appearance/language. Content, list items, visibility and button state are
SimplyFlow bindings.

The adopted engineering and stewardship rules, with their source links, are in
[AGENTS.md](AGENTS.md) and the [culture index](.spiral/culture.md). The
[Muze architecture philosophy](ARCHITECTURE-PHILOSOPHY.md) is included in this
repository. We favor inspectable code, replaceable boundaries, open
RDF, and app-specific choices kept high in the stack. The root lockfile belongs
to the runnable app suite, not a separately released library.

## Deletion and current limits

Contacts and shortcut deletion use Solid Workspace tombstones. File deletion
writes `lm:deleted` using the [PDS Interop link metadata vocabulary](https://pdsinterop.org/solid-link-metadata/)
to the parent container's advertised description resource. If that resource is
not advertised, deletion fails explicitly. File contents remain on the server;
this is soft deletion, not storage reclamation. Visibility outside these apps
depends on other clients/servers honoring the metadata.

Moves/renames, physical cleanup, permissions/sharing editors, recursive operations,
redirect-chain traversal, app provisioning and translated interfaces are follow-up
work. The launcher is a link catalogue; it does not yet provision permissions or
type indexes. Large file uploads are sequential and never overwrite an existing
resource; a partial upload reports how many files succeeded.

Authentication uses the published Metro OIDC popup flow. The integration test uses
an isolated mock Pod. The maintainer reports successful manual connection and
authentication with solidcommunity.net; other provider/browser combinations
and the new launch flow still need their own live verification.

## Verification

```sh
npm run check
npm run test:browser
```

Unit tests cover sparse profiles, multiple values and unknown RDF preservation,
structured-edit rejection, linked preferences, conditional writes and deletion
metadata. The browser test starts its own app and mock-Pod servers, exercises all
four apps, reload persistence, shared profile editing, preferences across apps,
synchronization, binary upload and tombstones. It also checks text escaping and
captures desktop/mobile views in `/tmp/solid-apps-review/`.

The harness waits for app initialization, the rendered Profile resource field,
and managed-child reconnection before dependent assertions. Page load, a profile
heading or a restored conflict alone does not establish those later states.
Earlier combined runs had intermittent readiness failures; the Profile case was
reproduced as an assertion preceding the input binding update. The workspace
wait closes an observed synchronization gap, without establishing the cause of
the earlier workspace failure. Checks use isolated fixtures, not real OIDC.

The build measures each app's JavaScript import graph plus the authentication
callback, counting shared chunks once per app. It writes `www/size-report.json`
and warns about totals of 200,000 gzip bytes or more for either output variant
(readable Workbench warns above 220,033 bytes). Budgets are advisory and never
fail a build or prevent `npm run dev` from starting. Measurements use gzip
level 6; source maps are excluded. The report's `apps` entries describe
minified production graphs; `readableApps` contains readable totals, and
`servedVariant` identifies which entry scripts the generated pages load. This
budget measures compressed JavaScript, not offline/PWA support.

Rollup builds two shared ES modules: `assets/shared/data.js` contains Metro,
OLDM with oldm-turtle, Solid Workspace, and shared data/session helpers;
`assets/shared/ui.js` contains SimplyFlow, SimplySolid, and shared suite views.
The UI bundle imports data; data has no UI dependency. Each app's
`assets/<app>/src/index.js` contains its own remaining code, including modules
used only by that app. The small `assets/redirect.js` authentication callback
imports data alone. The app and callback graphs reuse the same emitted modules
instead of bundling duplicate RDF or reactive runtimes.

Every build also emits matching `.min.js` modules using Rollup's Terser plugin.
Minified modules import only the minified graph. Both variants retain source
maps with original source content; function/class names and object property
names remain available for inspection. `npm run build` makes app pages and the
authentication callback load minified scripts. `npm run dev` selects readable
scripts through `npm run build -- --readable`. Both sets remain available in
`www/assets/` with either selection.

The build checks these shared-layer boundaries and writes
`www/bundle-report.json` with each bundle's modules, imports and gzip size.
Source maps include source text. Rebuilding replaces the generated assets
directory so retired chunks are not deployed alongside the current outputs.

## Shared appearance

All four apps follow the original `poef/solid-apps` Contacts styling: blue accent,
square controls, panel spacing and the compact account dropdown. The shared menu
contains WebID/connection and Preferences. Each application has its own toolbar;
only Launcher links to the other applications. Contacts shows profiles inline.

## Editable app features

Launcher, Contacts, Files and Profile now register named SimplyFlow feature
components. Each feature lives in its own `src/components/<feature>.mjs`
module in the owning app or shared package. `src/features.mjs` is the consistent
re-export index; source metadata points through it to the defining component file.
Shared account/connection, Preferences and profile editing use the
same structure. The profile editor is registered directly in the owning Contacts
or Profile app; its persistence policy stays with that app.

Inspect `muzeSolidLauncherApp`, `muzeSolidContactsApp`, `muzeSolidFilesApp` or `muzeSolidProfileApp` in the browser.
The existing `solidLauncher`, `solidContacts`, `solidFiles` and `solidProfile`
handles remain available. Each main app exposes:

- `components`: original named SimplyFlow datasets, with templates, commands,
  actions and other entries belonging to each feature.
- `definition.sources`: per-component URLs for optional, same-build authoring
  modules. For example, `muzeSolidContactsApp.definition.sources.contactList.url`.
  An explicit developer tool can import that URL and inspect its default export's
  `actions.matchesPerson.source`, origin and line. Normal use never imports it.
- `definition.modules`: app-owned API helper origins, dependencies and optional
  `sourceUrl` references. Importing one explicitly returns the original source
  string as data, without executing that source module.
- `definition.overrides`: app-level entry sections supplied to SimplyFlow.
  Native SimplyFlow composition selects them over component defaults.
- `definition.instances`: the account and Preferences app instances, each with
  its own registered components, source entries, API and definition.
- `api`: explicit callable dependencies and data APIs. Shared profile dependencies
  are under `api.profile`. `runtime` holds app-owned service/model state;
  `data` holds the reactive view projection and drafts.

Editable functions use SimplyFlow's supplied `this`: `this.data`, `this.actions`,
`this.api`, `this.runtime` and `this.container`. Commands read UI input and perform
native UI operations; named actions can be called with values and data API
fixtures. Source reconstruction does not require the original module closure or
bundler-local variable names. The build emits authored sources in hashed
`assets/authoring/` modules, outside the executable runtime graph. Runtime bundles contain source URLs, not duplicate
authored behavior strings. A future IDE may load these files explicitly; there
is no automatic loader or IDE UI. `size-report.json` reports full runtime graphs
including auth callbacks and optional source-file costs separately. Source maps
also remain separate; normal app startup does not fetch them.

HTML remains in authored `.html` files. `{{view:name:./feature.html}}` wires a named
view at build time to an ordinary SimplyFlow field/template binding. The generated
page contains the template markup for useful View Source. Runtime template entries
use `import template from './feature.html' with { type: 'text' }`. These text
imports preserve the authored UTF-8 source, including its root wrapper. Styles
use text imports. Inspection-only API modules use explicit `?source` imports,
which provide URLs instead of loading their source text. Shared account/Preferences
imports explicitly request build-time composition with `?template` and the same
text attribute; includes and app-specific placeholders are expanded there.
Rollup and the Node test loader handle text imports for the supported runtimes.
`?entries` extracts named behavior and origins into optional authoring assets
and supplies component-keyed URL descriptors to the runtime. These build steps
add no runtime renderer or second component merger. Keep authoring assets with
their matching deployment; a missing old asset affects inspection, not normal use.

Contacts search/sort, Files visibility/picker state, Launcher shortcut selection
and profile detail lists use SimplyFlow models. jaqt expresses queries inside
model effects where useful. Commands change model options and actions refresh
source projections without replacing native RDF. Named predicates/comparators
remain editable. Picker/provider and workspace object queries also reuse jaqt.

`test/features.test.mjs` checks model refresh, draft/RDF preservation and Files
failure contracts with data doubles. Browser checks first assert no authoring
requests at startup, then explicitly load optional source data as a developer tool and reconstruct it in a separate
fixture host with a template override. Separate normal-workflow fixtures deny
authoring routes and verify core work proceeds without requesting them. Existing
end-to-end and RDF preservation coverage remains in place. Fixtures do not establish credential-isolated IDE previews or
live Solid OIDC behavior.

The in-app IDE, persisted user edits, live template reapplication/reset controls
and preview isolation remain future roadmap work. Installed-library limitations
and their evidence are retained in `.spiral/moldability-refactor-investigation.md`.


## Shared MVP UI and capability dialogs

The experimental [solid-design package](packages/solid-design/README.md) provides
shared dialogs, dropdown styling and list/details panes on top of the-ds. Public
design entries use `muzeSolidDesign` / `muze-solid-design` prefixes. The running
app handles use `muzeSolidLauncherApp`, `muzeSolidContactsApp`, `muzeSolidFilesApp`
and `muzeSolidProfileApp`; existing `solidLauncher`/`solidContacts`/`solidFiles`/
`solidProfile` diagnostic handles remain prefixed compatibility interfaces.

The account name opens the Profile provider as a capability task in a shared
iframe dialog. The provider owns sign-in, native RDF editing and conditional
saving; the caller refreshes its account name after completion. Launcher also
uses this presentation for resource selection in Files. When framing fails,
the dialog offers a tab that continues the same pending task. Without a Launcher
connection, a normal standalone provider link remains available. See the
[profile capability contract](design/solid-profile-editing-capability.md).

Dialogs have consistent close controls and headers, with a scrolling body and
visible action footer. The provider is asked before an outer close; unsaved edits
require explicit discard, and an active save blocks close. Temporary task frames
and tabs are excluded from saved workspaces. The existing explicit sync/save and
conflict recovery controls remain available. Launcher keeps shortcut creation in
a dialog and less-frequent launch options behind disclosures.

Browser fixtures verify routing, data preservation and failure recovery. They do
not establish live Solid OIDC behavior across different top-level sites; verify
that provider's sign-in/framing policy when deploying across origins. These task
presentations do not implement the future moldable IDE or persisted runtime
composition edits.

## Preferences application

Preferences opens as a separate application inside the shared dialog and is also
available at `/preferences/`. Its section list uses the existing list-details
component. Choices apply immediately after local persistence, then synchronize
with the Pod; incomplete text and failed writes are retained. App-owned sections
are registered in Preferences without including their editor in each host.
Workbench settings can target an inactive workspace without switching apps.
See [the Preferences package](packages/solid-preferences/README.md) for the
contribution and persistence boundaries.

## Add apps from a catalog

Choose **Add apps** in Workbench, choose a category, browse or search, and choose
**Add app**. Launch the saved shortcut from Workbench. The initial static
catalog includes suite applications, Penny and Umai; external apps use their
own sign-in. **Add a link manually** still accepts a URL or application manifest.

Under **Catalog sources**, add independently hosted indexes or remove sources.
Listings and source choices are saved on this device for the selected account;
a failed refresh retains saved listings, and removing a source retains added
shortcuts. Uncached manifests require a connection. Adding a shortcut does not
install the application's code for offline use. See the [catalog guide](catalog/README.md)
for publishing a source and adding app manifests.

## Files navigation

Files keeps New, Upload and Refresh beside its title. On a phone, Refresh is
under More file actions. Use the folder breadcrumb or Edit folder address to
choose an ancestor or enter a folder URL. Selecting a file keeps that location
row visible; the file list and embedded content scroll independently.

On a wide screen, the selected filename completes the path with Share, Download
and Open in app at the right. On phones, these occupy a separate row with
Back to files. Each file's Actions menu retains Share and conditional tombstone
deletion, including folders. Content-specific controls belong to its viewer.

## Notebook documents

Open Notebook through Workbench or `/notebook/`. A notebook contains ordered
rich-text notes with a Cobalt H1 title above them. The title wraps and autosaves
locally, with the same selection, formatting and cursor movement as other notes.
Enter in the title keeps the prefix as the title and puts the remainder in a new
paragraph immediately below it, preserving formatting. Opening or
creating a notebook focuses its first note. The header says Notebook and keeps
the account menu at the top-right; the browser tab shows the document name.
The header toolbar offers New, Open, Save and Save As. Open and Save As launch your preferred
file picker through the capability API. Browse folders and choose a file to open;
for Save As, enter a new filename in the chosen folder. The device-history button
opens locally retained notebooks. Blocks have no numbering or borders;
the current block has a subtle highlight with a keyboard focus indicator.
The toolbar status icon distinguishes device-saved, Pod-synced, busy and attention
states: a check-circle means the device and Pod copies are current, distinct from
the account connection cloud. Click it for the exact message; routine status text
takes no editor space.
Enter splits at the caret into a new note; Shift+Enter inserts a line break.
Ctrl+Enter also splits. Backspace at a note start and Delete at its end join
adjacent notes. All four arrow keys move between notes, and Shift+arrows extend
a selection across notes. Copy/cut/paste and formatting preserve rich text across
that selection. Desktop pointer dragging also selects across notes; mobile
selection uses the browser's native caret handles and selection menu. Escape
clears a notebook selection. Block tools float by default: select text to show
Bold, Italic, Underline and Link, or press Ctrl+Space to enter the toolbar at the
caret. Escape closes it and returns to editing. Dock puts the tools in the header;
Float returns to contextual display. Tools follow the focused block's content
type and formatting state; docking resets to floating after reload. Ctrl+B
toggles Bold on selected text. Ctrl+K
(Cmd+K on macOS), or the Link tool, opens an address dialog; it links selected
text or inserts a linked address at the caret. Finish IME composition before
changing documents.

New creates a separate document and keeps the previous local recovery copy.
Use Notebooks on this device (the clock tool) to return to local documents, including unsaved
ones. Signed-out and each account's drafts are separate. Loaded notebooks remain
editable offline; a cold offline app load or an uncached Pod document requires
network access.

Connect to the matching account for Pod operations. Save updates the current
file conditionally, or opens the picker if it has no Pod copy yet. Save As
requires a new destination and preserves existing remote documents. A conflict
keeps your local changes. Opening another document preserves the current local
copy first. Concurrent editing in multiple tabs is not coordinated; code/image
blocks and folders remain future work. Manual assistive-technology and physical
phone keyboard review remain separate from browser-fixture checks.
