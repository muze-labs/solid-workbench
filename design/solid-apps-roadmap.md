# Solid Workbench and apps roadmap

Naming update, 2026-11-07: the repository is now
[muze-labs/solid-workbench](https://github.com/muze-labs/solid-workbench), and
the Launcher is named **Solid Workbench**. Earlier references to Launcher
describe that app's role. Its canonical app route is /workbench/; the maintainer
explicitly declines a /launcher/ compatibility entry or old-workspace migration.
Other app routes, package names, RDF identifiers and historical document/artifact
names are retained.

Status: maintainer-requested direction, recorded 2026-11-01, with subsequent
refinements below. Work is selected through future implementation cycles; this
update selects no next cycle. The maintainer places a second, virtual-company
stage after the current suite work. Items within each stage remain grouped by
subject, not priority. All conversation and project documentation should use
English. Earlier refinements come from
[SRC31](../.spiral/sources/SRC-20261101-QG24H-31.md). The moldable-app additions
follow the maintainer's 2026-11-07 request and the linked design; no new
implementation cycle or delivery order within either stage is selected.

Design additions, 2026-11-08: the second stage now includes the linked
documents/versioning, provenance/attestation and user-selected signing
proposals. Their implementation slices and dependencies are recorded below;
the designs' internal phases do not replace the suite's two stages or the
governing broker phases.

Design intake, 2026-11-12: add the
[document viewer and annotation proposal](solid-document-viewer-design.md) and
[invitation-provider sharing proposal](solid-sharing-design.md) to the second-stage
options below. Incorporate the revised personal-override/IDE direction from
[Moldable Solid Apps](Moldable-Solid-Apps.md). The icon-family item already covers
the supplied archive. These additions select no implementation cycle or new
priority; the broker roadmap remains governing.

Further design intake, 2026-11-12: retain the
[AI-composable Workbench proposal](solid-workbench-ai-composition-design.md) in
the deferred optional-AI and interface-composition work below. Its stages are
proposed decision gates, not approval to implement or a change in priority.

Embedded-view design intake, 2026-11-12: retain the
[shared embedded app views proposal](solid-workbench-embedded-app-views-design.md)
for Files details, a future Solid Presenter app and later Launcher widgets.
The staged proof below selects no next cycle or priority and does not establish
final capability names or a complete Weblets protocol.

This records suite-wide direction alongside the
[capability-broker roadmap](solid-capability-broker-roadmap.md), which continues
to govern broker implementation. The broker phases do not schedule every app
or product improvement below. The launch-context cycle was merged as `c906322`
and the managed-workspace/resource-picker cycle as `798d59b` (PR #3). The merged
baseline includes one native-RDF workspace, conditional checkpoints and the
Files picker. Items below describe future work or refinements, not implemented
claims unless explicitly identified as existing behavior.

## Standing feature guardrails

Temporary CYC100 exception, 2026-11-08: after readable Workbench reached 205233
gzip bytes, the maintainer authorizes expanding the budget for now and revisiting
it later. This cycle uses a temporary 220000-byte ceiling for readable Workbench;
the final readable graph is 217367 bytes. Production and other app graphs retain the original 200000-byte ceiling. Retain
actual full-graph/cold-task costs and revisit the allowance; the standing target
below remains the long-term direction.

Confirmed by the maintainer on 2026-11-07 after discussing focused apps,
local-first/mobile-first design, accessibility and slow-connection usability.
These are standing planning and delivery constraints for both roadmap stages,
not optional polish or proof that current apps already meet them.

- **Focused apps:** keep each app centered on a clear user purpose. Consider a
  separate capability-connected app when a feature introduces a separate task.
  Split around coherent workflows, not an arbitrary feature count; users should
  not have to assemble fragments of one ordinary task across many tiny apps.
- **Local-first and mobile-first:** define what works offline, what data must
  already be available, and how edits survive reload, reconnection, expired
  authorization and conflicts. Start with the phone workflow and verify it
  there before expanding to desktop. Network-dependent parts must be explicit;
  uncached resources cannot be assumed to work offline.
- **Accessible core tasks:** ship only an interaction that can be completed with
  keyboard and assistive technology. Prefer native controls; design labels,
  focus, feedback and alternatives to gestures alongside the feature. Redesign
  or defer an inaccessible core interaction rather than postponing accessibility.
  Use appropriate automated checks and manual review; passing tests or a good
  screenshot alone does not establish accessible task completion.
- **Small meaningful first use:** keep the existing complete-app JavaScript
  advisory target below 200000 gzip bytes, including shared dependencies and
  the auth callback. Size excesses may warn but must never fail builds or dev
  startup (maintainer instruction, 2026-11-09). Also measure the cold-cache
  transfer and required requests across HTML, CSS, JavaScript, fonts, images
  and data needed for the core task, plus time until that task is usable on a
  representative slow connection. Define the task for each app/feature; a
  loading shell is not success. Optional functionality may load later, while
  the complete graph remains measured. Do not rely on a warm
  cache to disguise first-use cost. No additional numeric transfer/time limit
  or specific network profile is selected by this agreement.

Retain the existing readability requirement: small apps should be easy for
people to understand and alter, without compressed or clever source code.
Before implementing each cycle, briefly state the feature's app boundary,
offline/recovery behavior, phone interaction, accessible interaction and download
impact. Evaluate the same claims with relevant evidence. If the proposed feature
cannot meet these constraints, redesign, split or defer it rather than silently
waive them. This agreement does not start a cycle, implement offline/sync/PWA
support or certify the accessibility/performance of existing apps.

## Applications

### Zett

Bring the maintainer's unfinished Zett application into the suite's roadmap.
The source references supplied by the maintainer are
[muze-labs/zett](https://github.com/muze-labs/zett) and
[poef/zett](https://github.com/poef/zett).

The locally available `poef/zett` source presents Zett as a Solid editor, with
worksheets containing resources and views of RDF entities and properties.
Treat it as an existing application to assess and continue, rather than
inferring requirements from the name. Before an implementation cycle, compare
the two repositories with the maintainer, settle which is the source to carry
forward, and select a useful first workflow. Integration must follow this
suite's native-RDF preservation and rendering rules.

### Notebook

Add a notebook application based on the notebook package in
[muze-labs/cobalt-note](https://github.com/muze-labs/cobalt-note/tree/main/packages/notebook),
currently named `@muze-labs/cobalt-notebook`.

That package coordinates note selection and navigation through note adapters;
the application owns its note list, toolbar and persistence. Plan the Solid app
around that boundary. Choose the initial note types, persistence representation
and editor integration during a future cycle. Follow the published-npm
dependency policy; this roadmap does not add sibling repository links.

### Solid Presenter

Retain a separate presentation app owning decks, slide order, templates and
named regions. Content viewing, creation and editing belong to compatible
providers through the [shared embedded-view work](#shared-embedded-app-views-files-and-presenter).
The proposed first MVP includes text authoring and existing-image selection,
local presentation, and no SimplyEdit dependency or remote presenting.

Maintainer follow-up, 2026-11-12: opening Presenter without a resource URI
should start a new presentation with blank slides. Define this entry flow
alongside explicit resource opening and local draft recovery, preserving
recoverable edits rather than overwriting them when starting a new deck.
A subsequent version should offer a template picker with a default set of
templates. Keep the initial blank-slide flow usable without that picker;
choose the initial template set and its offline availability during design.

## Application icon family and favicons

Requested by the maintainer on 2026-11-09 and reaffirmed on 2026-11-12
after inspecting the revised archive. Adopt the supplied
[Solid Workbench icon family](solid-workbench-icons.zip) for application identity
across browser favicons, Launcher shortcuts and the eventual app store. Use a
consistent icon for the same app across these surfaces, with application
manifests/catalog entries supplying the default artwork and existing user icon
overrides remaining authoritative.

The archive inspected on 2026-11-12 contains twelve editable, transparent SVG
icons in cyan `#0AA6C2` and warm orange `#F39A3E`: Workbench, Contacts, Files,
Profile, Zett, Notebook,
Projects, CRM, Documents, Knowledge, Forms and Chat. It includes standalone SVGs,
a shared symbol sprite, PNG favicons at 16/24/32/48 pixels, four-size ICO files
and light/dark preview sheets. The standalone sources have a 32-by-32 viewBox;
their standalone source files are 290–858 bytes. This revision includes the
Forms checklist and regenerated PNG/ICO exports, superseding the earlier
cobalt/coral description. Icon availability records artwork for
future apps; it does not select those apps for implementation. Preferences is
used only in a dialog iframe and needs no application icon or favicon.

Presenter artwork remains missing: the maintainer reports its absent favicon
during the 2026-11-12 review, and Presenter is not among the archive's twelve
icons. Design a Presenter icon consistent with this family, review it at small
sizes, and use it for its favicon, app manifest and Launcher entry. Retain
Feather icons for interaction controls. This is future artwork/integration work,
not completion of the accepted icon cycle.

For favicons, use the app's standalone SVG with appropriate ICO/PNG fallbacks;
a sprite symbol reference is not the favicon asset. For Launcher and app-store
entries, reuse the same family through the existing manifest/icon paths, using
standalone SVGs or the same-origin sprite where supported. Preserve arbitrary
external app icons and user replacements. Keep application identity artwork
distinct from the existing shared Feather interaction glyphs and status controls.
Plan the asset/build composition in the implementation cycle; no runtime icon
framework or application feature is selected by this addition.

Retain these concrete implementation steps for a future cycle:

1. Publish the supplied artwork through the existing static-asset/build pipeline,
   retaining editable SVGs and the matching raster fallbacks. Use the revised
   archive as the source of truth; no runtime icon dependency is needed.
2. Add application-specific favicon links for Workbench, Files, Contacts and
   Profile, using their standalone SVG and matching ICO/PNG assets. The archive's
   sprite alone is not a browser favicon. Reserve other supplied icons for their
   corresponding future apps; resolve missing artwork separately when needed.
3. Update suite application manifests and Launcher default-icon selection to use
   the same artwork. Verify both newly added shortcuts and existing shortcuts
   using default icons, while retaining explicit user replacements and external
   application icons. Render the full-colour artwork without the white-glyph
   treatment used for Feather controls; keep those interaction glyphs separate.

The archive README documents inline `--sw-cyan` and `--sw-orange` hints with
explicit colour fallbacks. Do not rely on parent-page CSS recolouring standalone
images or favicon assets. Review the actual rendered result during implementation.

Future verification: check real browser tabs at favicon sizes, phone/desktop
Launcher tiles, manifest/catalog rendering, light/dark themes and photo
backgrounds. Review suitable icon backing and contrast for this full-colour
artwork rather than assuming the current white-glyph treatment fits it. Retain
visible app names, accessible labels and native keyboard/focus behavior. Verify
user overrides and cached icons through reload/offline recovery, account for
uncached images, and measure asset bytes/requests alongside existing app budgets.
Larger platform/PWA exports, if needed, require their own size/visual checks.
This is roadmap work; no assets or application code are installed by this update.

### Window and tab titles

Make a suite-wide decision about resource-oriented window/tab identity. The
maintainer's preferred direction is the correct app favicon followed by the
loaded resource's title, instead of the application title or an application-name
suffix. The favicon supplies application identity; do not duplicate it as a
text glyph in the title.

Resolve the title source (resource metadata versus filename), an understandable
fallback for untitled resources and new unsaved documents, and titles for apps
with no loaded resource. Update the title when the resource changes or is
renamed. Apply the agreed policy consistently to standalone tabs and
Workbench-opened windows; verify browser tabs/window switching and accessible
identification. Record these choices before implementation rather than treating
the proposed title convention as an already implemented suite policy.

## Moldable apps and the future in-app IDE

Added at the maintainer's request on 2026-11-07, following
[Moldable Solid Apps](Moldable-Solid-Apps.md), now required reading in
`AGENTS.md`. Apply the design's rules for apps today to Launcher, Contacts,
Files and Profile, and from the first integration of Zett and Notebook. Make
each app ready for the IDE as its features are developed; building the IDE is
separate future work. This addition selects no implementation cycle.

The maintainer further clarifies that the ultimate goal is easy alteration
through the moldable IDE by people without a professional programming background.
Readable, self-explanatory feature code is therefore a requirement for apps today:
prefer clear names and straightforward steps, and avoid clever tricks and
unnecessary indirection. Apply the current `AGENTS.md` readability requirements
and the [standing feature guardrails](#standing-feature-guardrails) to new and
changed features, including shared MVP UI components. The revised moldability
document no longer contains the earlier readability subsection; those standing
requirements remain in force.

### Moldability and readability review follow-up

The maintainer supplies the [moldability and readability review](reviews/Solid-Workbench-Moldability-Review.md)
for this roadmap. Retain it as review evidence, dated 2026-11-07 against commit
`71d2737d5e7203188f503b50d184d606556f2c8f`. It predates accepted Preferences
recovery (CYC77); its reported 107 tests and unavailable Chrome describe that
review environment, not the current suite's verification results. Before CYC82, spot checks
at then-current main `473dda5ee37811ec232db575009f55c3f5799819` still find captured
profile/host actions, direct lifecycle listener registration, separately copied
shared CSS and nested workspace status decisions. The review's action-proxy
probe was reported evidence; CYC82 subsequently adds the running-instance browser
verification for action dispatch described below.

CYC-20261107-QG24H-82 is **Accepted** (ACC86): relevant design clarification
and dependable action dispatch across existing callers are implemented and
verified (EVD85). The maintainer has requested commit, merge and push. CSS migration,
lifecycle listener ownership and the wider IDE remain future work; current-action
dispatch alone does not complete those separate recommendations.

CYC-20261107-QG24H-87 is **Accepted** (ACC91) for feature-owned CSS. The maintainer clarifies
that the future IDE can update SimplyFlow's installed named style elements by ID;
a new library style-update API is not a prerequisite. The suite migration exposes
feature CSS and preserves originals/ID linking, without implementing an IDE or
persistent override layer. EVD90 retains final preservation/visual checks and
known timing limits; the maintainer requests commit, merge and push.

CYC-20261108-QG24H-92 is **Accepted** (ACC99), with commit, normal direct main
merge and push requested. Its design
phase is part of the cycle. After discussion the maintainer selects a separate
experimental events package injected into Workbench's SimplyFlow composition,
with custom EventTarget/subscription sources; core integration remains deferred.
IMP97/EVD98 record the four Workbench/account event migrations and lifecycle,
source, preservation and download evidence. Element behaviors, protocol listeners
and live descriptor rebinding are not completed by this experiment. No package
publication or core promotion is requested.

Track these follow-ups in the review's recommended order:

1. **Reconcile the design documents.** The 2026-11-12 intake finds the supplied
   moldability revision now describes the personal layer, separate histories,
   template notifications and marketplace boundary. The detailed IDE follow-up
   below reflects that direction; persistence/runtime APIs and upstream-version
   handling still need design. Resolve the review's described personal
   override layer applied last, independent IDE/app undo histories, effective
   template-change notifications, marketplace separation and upstream-version
   concerns against the repository design. Preserve current readability/library
   rules, feature guardrails and the explicitly accepted build-time composition
   boundary. Distinguish settled requirements from open design questions before
   changing the governing document; this review does not silently replace it.
2. **Keep existing callers connected to current actions.** Inventory captured
   widget methods, host methods, broker callbacks and listeners. Define how an
   already-running caller reaches a replaced action and how removing the
   override restores the original. Inspect SimplyFlow's public API before
   choosing stable references or narrow invocation-time forwarding bridges.
3. **Expose app-owned CSS through named styles.** Move feature-specific rules
   into the corresponding component datasets and genuinely shared rules into
   a named shared component. Preserve stylesheet order, cascade and external
   design-library boundaries. Verify applying and removing a visual override.
4. **Resolve lifecycle event binding ownership.** Inventory app-owned event
   registration and justified bridges, identify concrete missing public APIs,
   and put reusable registration/cleanup support in SimplyFlow or the
   appropriate lower-level library. Components should declare the handling
   action; existing bindings must reach its current definition. Verify single
   delivery and cleanup without duplicate listeners. Scope upstream library
   work separately and consume published npm versions.
5. **Evaluate readability through meaningful user edits.** Begin with workspace
   status labels/conditions and feature configuration. Expose clear app-owned
   decisions through named entries and straightforward control flow while
   retaining infrastructure behind existing APIs. Check whether people without
   professional programming experience can find and make those changes;
   source inspection alone does not establish that usability.

For each implemented follow-up, exercise a small live edit in an existing
instance, remove it to restore the original, and preserve working data, drafts
and native RDF. Also verify model reevaluation when an editable list predicate
changes. Definition/source metadata and reconstruction in a new test host do
not alone establish replacement in a running instance. Keep the ordinary app
usable without the IDE and retain the complete-app download budget.

These are future roadmap items, not a selected cycle or instructions to perform
the review's proposed refactors now. The runtime IDE, override persistence,
marketplace and live template updates remain separately scoped future work.

### Deferred: runtime template composition

On 2026-11-07 the maintainer accepts build-time composition as sufficient for
now and explicitly asks to revisit it later. Shared account and Preferences
includes, app titles and app-specific Preferences insertion are expanded during
the build. The running app retains the resulting templates, but cannot change
those composition relationships or re-expand their source placeholders without
a rebuild. This is a current moldability limitation.

Investigate composing these views at runtime through named SimplyFlow templates
and/or fields, so users can change their composition in the running app. These
are candidate mechanisms, not a selected implementation. Keep SimplyFlow as the
runtime renderer and assess how to retain useful View Source. Reconcile the
current build-time composition rule when that future design is selected. This
follow-up is deferred; it does not extend the current refactor or select a cycle.
FBK-20261107-QG24H-46 retains the maintainer's decision.

### Baseline before the accepted moldable refactor

The observations below describe the pre-CYC37 baseline. CYC37 was accepted and
merged as b9650ba: named feature datasets, explicit contexts/APIs, model-based
lists, per-component files and retained HTML/CSS/behavior sources are implemented.
Maintain those foundations during UI work. Live template reapplication, complete
override restoration and the in-app IDE remain future work; the accepted source
foundation does not establish every IDE-readiness criterion below.

The four current apps use SimplyFlow, but their entry points create separate
view instances with commands that close over module-local state and helpers.
The shared shell, Preferences and profile view use similar factories. Existing
`window.solidLauncher`, `solidContacts`, `solidFiles` and `solidProfile` handles
expose runtime objects, but do not provide complete editable feature datasets.
`scripts/build.mjs` composes HTML and copies shared CSS separately; those sources
are not exposed as named entries in the running app definition. Existing module
and browser tests are not associated with editable entries. The roadmap has not
previously covered these prerequisites or the IDE workflow.

### Foundations to maintain in every app

- Define app-owned features as named SimplyFlow component datasets containing
  their templates, styles, commands, actions and relevant bindings, routes or
  initialization behavior. Behavior-only components are valid. Register them in
  `app.components` and explicitly include their views in the owning templates.
  Choose boundaries around useful features, rather than splitting by file type.
- Expose the running app and its editable definitions through a documented
  public handle. Retain useful source for each named entry, component originals
  and app-level overrides, with enough origin information to find the active
  definition. A running dataset must be sufficient without a source checkout.
  Keep build-time HTML composition and useful View Source; generate runtime
  entries from the same HTML/CSS sources so there is no second maintained copy.
- Keep DOM reads, feedback and native UI operations in commands. Put reusable
  behavior and state changes in actions, and storage operations behind an
  explicit data API. Editable replacements must work with SimplyFlow's context
  and documented public dependencies, without recreating private module
  closures. Keep implementation helpers private only when their behavior does
  not need to be edited. Metro, oldm and workspace libraries remain callable
  dependencies outside the app's editing boundary; suite-owned feature wiring
  belongs inside it.
- Use SimplyFlow models for list filtering, sorting, paging and other supported
  transformations in every app. Replace equivalent manual array pipelines in
  UI update helpers with model effects and options. Expose app-specific model
  setup, predicates and comparators as editable entries; commands/actions change
  options and SimplyFlow binds the resulting view. Keep native RDF authoritative.
- Preserve SimplyFlow's component/app override precedence. Personal edits live
  in a separate layer applied last, under the same entry names in corresponding
  sections, leaving component originals inspectable. A dedicated component or
  the app definition can hold that layer; its concrete form remains open.
  Removing the override must reveal the
  underlying definition. Verify this for every supported entry kind, including
  templates, styles, commands, actions and key bindings; do not add another
  renderer or a competing composition system.
- Associate optional sample data and tests with the named parts they describe.
  Provide fixtures and data API doubles for meaningful previews and action
  tests, while retaining existing end-to-end and RDF preservation coverage.

Check the published SimplyFlow API before migrating features. The installed
`@muze-labs/simplyflow-app` 0.10.3 uses `templates`, `styles` and `shortcuts` for
the design's HTML, CSS and key-binding concepts. It installs templates/styles
without retaining those app-level source sections on the runtime instance,
and its component merge skips component `start` hooks. Resolve source retention,
override restoration and component initialization against the supported API;
do not assume the design's examples are already executable here. If library
work is needed, keep it separately scoped and consume a published npm version.

### Coverage by application

- **Launcher:** expose shortcut listing/editing/launching, resource selection,
  and workspace controls as editable slices. Keep app behavior accessible while
  broker routing, session authority and conditional checkpoint mechanisms remain
  behind explicit APIs. Future catalog and named-workspace features must follow
  the same model. App navigation continues to belong to Launcher.
- **Contacts:** expose list/filter/selection, contact creation and deletion, and
  inline profile viewing/editing. Replace the list update helper's manual
  filtering/sorting pipeline with a SimplyFlow model. Expose its app-specific
  rules, selection and save behavior through named entries. Keep contact drafts
  and the authoritative RDF distinct; reuse the shared profile component.
- **Files:** expose folder navigation/listing, upload/download, folder creation,
  deletion and resource-picker interaction. Actions take values rather than DOM
  elements. Retain root checks, conditional writes and PDS Interop tombstones
  behind the data API; importing or editing a slice grants no new authority.
- **Profile:** expose resource loading, own-profile selection and the shared
  profile editor. Keep storage policy in the app's data API so Contacts and
  Profile can use the same editable view with different persistence policies.
  Preserve unsupported RDF and refuse edits that would flatten structure.
- **Zett:** assess the chosen source against these requirements during intake.
  Plan worksheet, resource, entity/property view and editing boundaries from its
  actual workflows; make the first integrated workflow moldable rather than
  wrapping the whole application in one opaque component.
- **Notebook:** expose note selection/list/navigation, toolbar and note-adapter
  integration as app-owned slices. Keep the published notebook package behind
  its API; expose the suite's adapter and persistence choices without requiring
  users to edit the dependency's internals. Select concrete slices with the
  initial note types and editor integration.

The shared account shell, Preferences and profile editor must also expose their
app-owned parts through registered datasets. Include app-specific preference
templates. Shared defaults remain inspectable and overridable per app without
forking the shared component. Preserve the existing visual language, inline
Contacts profiles and native-operation exceptions.

### Acceptance before calling an app ready for the IDE

For each app, verify that a user can locate a rendered control's named template
and command, inspect their originals, and replace a template, style and behavior
through app-level entries. Run a replacement reconstructed from the exposed
source with only documented context/dependencies to catch hidden closure or
bundler dependencies. Removing overrides must restore the original behavior.
For list features, verify that changing model options or source items updates
the bound filtered/sorted view without mutating the authoritative source.
Exercise an action without DOM access using a data API double. Register a slice
in a second app/test host and explicitly wire its view, demonstrating reuse
without the source app's private state. Check initialization and cleanup without
duplicate listeners or effects, and preserve drafts and RDF through the change.
These checks establish app readiness; they do not claim an IDE already exists.

### Later IDE work

- Open the IDE beside the app in the same page. Navigate components and named
  entries, show origins and active overrides, and offer an inspect mode that
  jumps from a rendered control to its template and active command.
- Create or import component datasets, register them, and let the user wire
  them into views. Export either the original component or a copy with that
  component's app overrides applied, in the same editable import format.
- Preview drafts with sample data and run associated tests in isolated state
  without live write credentials or write-capable APIs. A test double alone in
  the live app's credential context does not establish this isolation.
- Apply valid edits on explicit save, live wherever possible; optionally update
  valid HTML/CSS while typing. Persist the user's personal override layer
  locally, with Pod storage as another possible destination. Choose the storage
  format and dependency loading during IDE design. SimplyFlow must notify its
  renderer when the effective named template changes, including override removal,
  and update affected live instances using their current bound state. Inspect
  and, where needed, extend its public API rather than adding an app renderer.
  This requirement does not itself reopen deferred build-time include composition.
  Native Turtle and RDF preservation
  rules still apply to Pod resources and Turtle caches. This does not expand
  the workspace's opaque-state exception or authorize JSON-in-Turtle snapshots.
- Keep definition undo/redo independent of app-data undo/redo: reverting a
  template or action must leave contact edits intact, and reverting app data
  must leave personal customizations intact. Verify both directions.
- Keep personal save/apply separate from optional marketplace publication and
  discovery. Retain component source origins for source-maintenance updates.
  Detect and explain when an upstream definition changes beneath an override;
  base-version identity and recovery/merge policy remain open design questions.
- Provide correction after runtime errors, reload/reset controls, and a safe
  reload that skips local changes even if both app and IDE fail. Retain skipped
  edits for separate recovery. Verify import/export round trips, isolation from
  live writes, failed-edit recovery and safe reload with broken overrides.

Keep the ordinary app usable without the IDE and retain the per-app JavaScript
budget. Plan IDE loading and measure its cost explicitly when implementing it.

## Profile and account experience

- Make the account name at the top right of every app open profile viewing and
  editing for the current WebID. On 2026-11-07 the maintainer revises the earlier
  separate-editor preference: request the Profile provider through a capability,
  normally hosted in an iframe dialog in the current app, with a tab fallback
  continuing the request when embedding is unavailable. Reuse the provider's
  editor and preserve unsaved work. CYC49 is accepted on 2026-11-07; the
  [capability contract](solid-profile-editing-capability.md) records the boundary.
  General app navigation remains in Launcher.
- After the user changes their name, update the displayed name immediately in
  all already-open suite apps, without requiring reload or reconnect. Native
  profile RDF remains authoritative. Propagating the same user's profile change
  between apps is part of account consistency, independent of the deferred
  collaborative-editing feature.

Immediate propagation of name changes to other already-open apps remains
future work; the capability caller refreshes its own account display.
A future verification should open several apps, change the name in Profile,
and observe each header update without rewriting unrelated profile data.

### Shared account-status control and connection dialog

CYC124 scope revised by the maintainer on 2026-11-11: present account controls
in a separate dialog-only Account app. The shell retains its live session,
status and recovery; Workbench retains managed switching and checkpoints.
Account has a dedicated presentation slot so opening it from Preferences does
not discard that editor. Only the shipped same-origin Account frame receives
its control port; this is not replaceable-provider account authority. No
Launcher tile, application icon or token service is introduced. Implementation
and evaluation are accepted in CYC124 under ACC131 on 2026-11-11.

Requested by the maintainer on 2026-11-09. Add a compact status icon or bare
button beside the user name in the shared top bar. It shows the current account/
connection status and opens a shared dialog for connecting, disconnecting,
logging out or switching accounts. Keep the existing name/profile interaction
and Launcher-only app navigation. Use an accessible button with a meaningful
status label; status must not depend on colour or an icon alone.

Design the displayed states and the distinctions between disconnect, logout and
account switching before implementation. Distinguish an expired authorization
from offline connectivity or denied access, and derive state from the existing
Metro/session APIs. Reuse the shared dialog and account machinery. Preserve
drafts, account ownership and the established workspace save/close rules when
leaving an account; switching must not adopt another identity's cached work.
Verify phone/desktop layout, keyboard operation, focus restoration and updates
after sign-in succeeds or fails, including recovery initiated in another app.

## Authentication and avoidable 401 challenges

Reduce avoidable challenge-first requests while the user is signed in. Current
sessions force authorization for writes; reads can still encounter a 401 before
authorization is attempted. The maintainer reports many visible 401 responses.

Evaluate Metro force authorization for requests to the current storage Pod. A
preferred candidate to investigate is remembering which origins return a 401
and proactively authorizing subsequent requests there. Keep that knowledge scoped
to the current account and the middleware's valid Pod/origin/token scope. Verify
redirect handling as part of that scope.
The exact learning, lifetime and Pod/path/origin boundaries need verification
in the implementation cycle. These are proposals, not a settled auth policy.
Genuine expired-session or denied-access failures must remain visible.

Future verification: compare network traces before/after for public and protected
resources, multiple storage locations and a different account. Avoid repeatedly
challenging a known protected origin without breaking anonymous/public access.

### Startup sign-in and decentralized sign-up

Requested by the maintainer on 2026-11-07. On loading Solid Workbench or any
suite app, present a shared sign-in/sign-up style dialog when the user is not
signed in. Attempt existing session restoration first so a signed-in user does
not receive an unnecessary prompt. Reuse the current Metro authentication and
shared dialog components; distinguish first-use onboarding from stale-session
recovery rather than creating another authentication mechanism.

Reaffirmed by the maintainer on 2026-11-12: provide a user-friendly **Create
account / Sign up** entry alongside **Sign in**. Guide a first-time user through
getting an identity and, where needed, storage without requiring them to know
a WebID, issuer URL or Solid terminology beforehand. Explain provider choices
and where their account and data will live in plain language. Hand off account
creation to the chosen provider, then guide the user back to Workbench and
their original task. Keep existing-account sign-in easy to find.

Acceptance should include a first-time user completing sign-up and returning
to a usable app on a phone, with keyboard and assistive technology. Cover
cancelled/failed registration, interrupted return and retry without losing
local work; explain when registration needs a connection. Provider selection
and the exact registration/return mechanism remain future design work.

**Design sign-up before implementation.** The experience must support Solid's
decentralized model rather than imply one central Workbench account service.
Explore choosing an identity and Pod provider, using an existing account or
self-hosting, and explaining where the account and data live. Provider choice,
discovery, account/storage relationships and any handoff back to the app need
explicit design; no default provider, signup service or flow is selected here.

Resolve dismissal/local-only use, deliberate anonymous launches and embedded
capability behavior in that design. Keep existing public content and drafts
safe, and do not assume that a missing signed-in session means the user must
create a new account. Evaluate first visits, restored sessions, cancellation,
provider choice and return from signup across apps and phone/desktop layouts.
This is roadmap work, not implementation of a startup dialog in the rename
cycle.

### Expired authorization and sign-in recovery

Accepted [CYC67](../.spiral/cycles/CYC-20261107-QG24H-67.md) implements
refresh-first renewal and explicit recovery. ACC72 records the maintainer's
acceptance and commit/merge/push instruction. Hidden-iframe sign-in is deferred.
[DES69](../.spiral/designs/DES-20261107-QG24H-69.md) records the Metro boundary;
[EVD71](../.spiral/evidence/EVD-20261107-QG24H-71.md) records verification and
live-provider limits. The later reported Preferences repeated-save ETag problem
below remains future work; cycle acceptance does not establish that it is fixed.

Added at the maintainer's request on 2026-11-07 after live Profile capability
feedback. Same-origin tabs and dialogs already share Metro's token/key stores.
The reported case had an expired access token, no refresh token and a cached
identity token in both contexts. Reconnecting resolved it. Public profile
content remained available while protected preferences left a sign-in warning.
[Investigation evidence](../.spiral/evidence/EVD-20261107-QG24H-57.md) records
this distinction and the Firefox reproduction.

Prioritize refresh-token authorization and understandable recovery UI. Request
refresh authorization through Metro with the required provider consent; verify
issuance rather than assuming a scope guarantees a refresh token. Existing
sessions without a refresh token need a fresh authorized sign-in. Reuse valid
credentials and silently refresh when possible across same-origin suite apps,
including embedded capability providers. Keep account/issuer/DPoP validation and
provider-owned data access; capability messages must not carry OAuth credentials.

If interaction is needed, show a nonblocking notice specific to the operation,
with a clear **Sign in again** action. Examples: "Sign in again to load your
preferences" or "Sign in again to save to your Pod. Your edits are still here."
Keep available content and editing usable, preserve drafts, and avoid a raw
library error or an automatic login modal. A requested save may offer **Sign in
and save**, then resume that conditional save after successful authentication.
Retain conflict handling and pending work if authentication fails or is cancelled.
Distinguish connectivity, server and denied-access failures from expired
credentials; a preferences failure must not imply that the public profile failed
to open. After recovery, update affected same-origin app/dialog status without
requiring a reload or overwriting drafts.

#### Cross-app recovery status after successful sign-in

Reported by the maintainer on 2026-11-09: when the session is no longer valid,
Launcher shows a sign-in-again message, and Preferences shows the same message
with a button. Signing in through Preferences correctly removes its own message
and button, but Launcher's message remains until Launcher is reloaded.

Investigate whether successful sign-in is announced to all open apps and whether
each recipient refreshes its session state and the notices it owns. A missing
message is a hypothesis, not an established cause: delivery, receipt and handling
may each need checking. Inspect existing Metro notifications, same-origin app
coordination and managed cross-origin channels before adding infrastructure.
Announcements must be scoped to the correct identity/session and must not carry
OAuth credentials or imply that every protected resource is now accessible.

After confirmed recovery, all affected apps and embedded dialogs should
re-evaluate their status and remove obsolete sign-in messages/actions without
reload. Retain unrelated errors, genuine access denials and pending drafts;
do not replay writes merely because a sign-in notification arrived. Preserve
the existing explicit resume and conditional-save/conflict contracts. This
should also update the proposed shared account-status control above.

Future verification: expire a session with Launcher, Preferences and another
app open; sign in through Preferences and check that every affected surface
updates. Repeat with another app initiating recovery, background tabs,
embedded dialogs, cancelled/failed sign-in and a different selected account.
This is future roadmap work, not an authentication fix or acceptance of CYC118.

As a later optional fallback, evaluate one bounded hidden-iframe authorization
attempt with OIDC `prompt=none`, after credential reuse/refresh and before asking
for interaction. Fall back on login/consent/interaction-required responses,
framing refusal or timeout; do not loop or display login UI in a hidden frame.
The identity-provider frame is cross-site even when suite apps share an origin.
Browser cookie partitioning and provider framing rules can prevent reuse of the
issuer's browser session. Verify supported browsers/providers and keep explicit
sign-in available. Implement missing lifecycle/parameter support in the Metro
stack rather than adding a parallel app-owned authentication mechanism.

References: [OIDC offline access and consent](https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess),
[OIDC silent authorization](https://openid.net/specs/openid-connect-core-1_0-errata2.html#AuthRequest)
and [Firefox cookie partitioning](https://support.mozilla.org/en-US/kb/total-cookie-protection-and-website-breakage-faq).

Future verification: valid shared access token; expired token with successful
silent refresh; expired token without refresh authorization; cancelled/failed
sign-in with a retained draft; sign-in followed by the original conditional save;
network failure, access denial and write conflict. Cover tabs and embedded
providers in Firefox and Chrome. For the optional iframe path, cover silent
success, interaction required, blocked cookies/framing and timeout. This is
future roadmap work, not implementation or acceptance of an auth change in CYC49.

## Common and app-specific preferences

Present a common section shared across all apps and a separate section containing
only options relevant to the current app. Storage settings belong in that app's
section. In Launcher, workspace creation and switching are app-specific options.
Use the existing profile-linked preferences file and preserve unknown RDF;
separating the UI does not itself require moving settings to new files.

Implemented in Preferences cycle `CYC-20261107-QG24H-33`: the common/app-specific
split and per-app storage filtering, with partial writes preserving omitted RDF
settings.
Named workspace creation and switching remain future work.

The common section includes Theme (System/Light/Dark), Text size, Density,
Preferred language and Open apps in (tabs/windows). Common values remain shared
instead of introducing separate copies for each application.

Verification covers common appearance across apps, per-app storage fields and
preservation of omitted settings and unrelated native RDF. Launcher workspace
creation/switching still needs its own implementation and verification.

### Separate Preferences application: CYC106

Selected by the maintainer after CYC100, with design discussion before
implementation. Preferences is a separate app, normally embedded through the
existing capability dialog, with Ubuntu-like section navigation. Reuse the
existing list-details component and extend it for evidenced gaps; do not create
another Preferences layout/CSS component. Common sections stay first and the
calling app contributes named SimplyFlow sections with its own templates and
behavior. Standalone use offers selecting the app context.

The maintainer explicitly chooses immediate application and editing any
workspace inside Preferences without activating it or closing its apps. Valid
edits persist locally before application and synchronize conditionally to the
Pod; retain incomplete drafts, offline changes and conflicts. Workbench keeps
workspace authority. Shared preference consumers remain in hosts, and changes
propagate without losing app data/drafts. Measure the actual host/editor graphs
and first useful interaction; savings are an evaluated outcome, not an assumed
consequence of moving files.

CYC106 is Accepted by explicit maintainer review, recorded in ACC111;
SRC107/DES108/IMP109/EVD110 retain scope, implementation and evaluation limits.
Broader CSS review, Contacts enhancements and Workbench budget follow-up remain
separate; no next cycle is selected.

Presentation clarification, 2026-11-09: the maintainer specifies that Preferences
is only used in the dialog iframe. It needs no standalone Launcher entry,
app-store listing or application icon. Earlier standalone-use descriptions above
record the CYC106 design history; this clarification sets the intended
presentation.

### Apply shared preference changes across open apps

Requested by the maintainer after CYC77 acceptance: when shared preferences
change, all open apps should update automatically, including apps in separate
tabs/windows and embedded capability dialogs. Users should not have to reload
or reopen an app to receive the updated theme, text size, density or other
applicable shared settings.

Keep the profile-linked native RDF preferences authoritative. Design change
notification and refresh using the existing stack, with reconnection recovery
and protection for unsaved settings edits. Verify propagation between open apps
and embedded providers, including an app that was temporarily offline. This is
future roadmap work; no synchronization mechanism is selected here.

### Preferences source display and recovery after saving

Reported by the maintainer on 2026-11-07 during CYC67 evaluation. Selected as
CYC-20261107-QG24H-77 after the guardrail discussion; now **Accepted** (ACC81).
The maintainer confirms repeated saves and toast behavior work. EVD80 records
bounded regression/browser evidence. The accepted repair reacquires validators
safely, preserves native RDF and open-form choices, adds explicit review/restore,
and removes the bare URL. Reload-persistent drafts/full offline startup and the
wider forms visual language remain future work. The following preserves the original gap;
it is not a claim that the live provider's response has been captured.

- Remove the unexplained `prefs.ttl` URL from the ordinary Preferences dialog.
  If source information serves a useful diagnostic task, give it a clear label
  in secondary details rather than presenting a bare URL above the settings.
- Investigate the reported sequence: save Theme as Light, then change it to
  Browser default and save again. The second save reports:
  "solid-app-data: This server supplied no ETag. Safe editing requires a
  conditional write." This leaves the user without an actionable recovery path.
  The cause and whether the preceding write was acknowledged remain unverified.
- Provide understandable save status and a safe recovery action, retaining the
  selected settings and any other unsaved form values. Distinguish a failed
  write from a successful write whose next-write validator is unavailable.
  Reuse the existing Metro/document and conditional-save contracts; investigate
  safe validator reacquisition without adopting conflicting remote changes or
  silently falling back to an unconditional write. An error rewording alone
  does not resolve the recovery problem.

Evaluate repeated saves in the same open dialog, missing ETags on write/read
responses, connection failures and concurrent Pod changes. Verify retained
edits, accurate acknowledgement and a usable retry/recovery path, while
preserving unknown RDF. This report does not establish a root cause or a fix.

## Workspaces, Launcher dashboard and logout

Support multiple named workspaces and offer workspace choice when more than one
is available. The 2026-11-08 discussion settles placement: create/delete
workspaces in Workbench-specific Preferences; switch among available workspaces
from the Launcher dropdown. Workspace identity,
discovery through linked preferences,
Pod/local persistence and switching recovery extend the existing
[Pod-synced workspace direction](solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).
Keep each workspace's shortcuts, resource contexts, pending edits and restoration
state distinct. The current implementation checkpoints only one default workspace.

Reaffirmed by the maintainer on 2026-11-07: support multiple workspaces and let
the user switch between them in Solid Workbench. Make the active workspace and
switching action clear, and protect unsaved changes during a switch. This
extends the existing named-workspace item rather than creating a duplicate
feature; creation, selection and switching remain future implementation work.

The maintainer explicitly clarifies the lifecycle:

- Closing Launcher still closes its managed apps.
- Logging out of Launcher also closes the active workspace and its managed apps.
- Logging out of another managed app does not close Launcher, sibling apps or
  the whole workspace.

Design checkpoint/save and logout ordering before implementing it, including
failure/offline behavior and retention of recoverable local changes. This does
not add collaborative editing or an independent broker service.

Treat the dashboard as Launcher's home screen. Make it sparse, like a phone home
screen: show the shortcuts the user added. Seed only Files links for **every
storage location advertised by the user's profile**, not just the first location.
Each default Files shortcut must open its corresponding root. Contacts, Profile
and other suite apps should not be permanent default tiles. The common account
controls and own-profile link remain available independently of shortcut tiles.
Preserve existing user shortcuts and their per-link launch settings.

A suggested (+) icon opens a dialog to add a shortcut, keeping the add form off
the main screen. Retain adding an arbitrary app URL; catalog selection can feed
that flow. Exact placement is a future UI decision, not a fixed icon/layout spec.

Future verification: create two workspaces with different shortcuts, switch and
reopen without mixing state, and check the specified Launcher/child logout
behavior. With multiple profile storage roots, the default home contains only
the corresponding Files links; adding a shortcut through the dialog adds that
item without introducing permanent built-in app tiles.

### Workspace home-screen direction under discussion, 2026-11-08

The maintainer explicitly leaves cycle selection open to discuss the eventual
product. Use a desktop/phone start screen as the familiar Launcher model, with
recognizable application icons supplied by application manifests and editable
or replaceable by the user. Do not infer a finalized manifest vocabulary, icon
format, editing mechanism or layout from that direction. Keep arbitrary external
app links usable; how those without a manifest obtain an icon is still to design.

Each workspace has its own Launcher/shortcut collection and an editable title;
the default title may be Solid Workbench. Users can create and switch between
workspaces, for example Work, Private or a particular interest. The maintainer
initially suggests listing workspaces in a Launcher dropdown. They subsequently
clarify: limit workspace creation and deletion to the Workbench Preferences
dialog, and add only workspace-switching entries to the Launcher dropdown.
This refines the earlier Preferences-only direction; it does not put app
navigation into the shared account menu. The maintainer confirms that deleting
a workspace removes only its launcher, shortcuts and workspace-specific settings;
address books, files and other linked data remain intact, including data reused
by other workspaces. This does not authorize cascading deletion of linked data.
The maintainer additionally specifies a protected default workspace: our UI
must not allow deleting it. If someone deletes that workspace directly in
storage, use the initial-load behavior to create a new default workspace,
including the established default launcher/address-book setup. A title change
does not itself decide which workspace is protected; stable identification and
recovery details remain to design. Confirm actual absence rather than treating
an offline, permission, authentication or transient read failure as deletion.
The maintainer also prohibits deleting the currently active workspace through
our UI. Only inactive, non-default workspaces can be deleted; users must switch
away first, using the normal state-preserving switch flow. There is no automatic
switch as part of deletion. Verify eligibility when deletion is performed, not
only when the Preferences dialog opens. These are UI rules and recovery
behavior, not storage ACLs that prevent other clients from deleting resources.
Recovery of unsaved state belonging to an inactive workspace still needs design;
retaining linked datasets does not by itself preserve every draft.

For someone with no workspace, provide a default workspace and Launcher seeded
with File-manager shortcuts to the defined storage endpoints. Retain the earlier
per-advertised-storage-root direction and preserve existing user choices. This
does not assume that storage endpoints can be discovered while offline or that
workspace creation should copy data. The app-store app or menu entry comes later;
a catalog is not required merely to provide the initial launcher.

A workspace may have its own contacts, storage, preferences and apps. Treat it
as a context for useful tasks while keeping native RDF and existing linked
preferences authoritative. The following discussion settles shared versus
app-specific settings; detailed per-app context selection remains to design.
Do not infer duplicated contacts or an enforced access-security boundary from
a workspace name.

The maintainer settles identity and switching in the following clarification:
design for a user with **one WebID**. Multiple WebIDs must remain usable, but
only one is selected at a time. Work/Private/interest workspaces are contexts
under the selected identity; changing workspace does not itself change WebID or
require another account. Account selection is a separate operation. Local caches,
drafts and workspace records must retain their owner so later account selection
cannot silently reuse or write another identity's state. The precise existing
account/logout integration remains to design, rather than being claimed solved.

Switching workspace **closes the current workspace's apps and restores the new
workspace's apps**. Do not design simultaneous active app sets as the default.
Preserve each workspace's pending edits and restoration state; design checkpoint,
close, activation and restore ordering with cancellation, offline/authentication
failure and partial restoration recovery before implementing it. A failed remote
checkpoint must not silently discard recoverable local work. The exact recovery
interaction and local-versus-Pod acknowledgement policy are still to design.

#### Address books, private endpoints and settings scope

The maintainer confirms the following in the ongoing 2026-11-08 discussion:

- A workspace may select multiple address books, and books can be reused across
  workspaces. It has a default address book. For a new workspace, initially reuse
  an existing default address book; create one if none exists. Do not create a
  separate empty book for every workspace. The definition/discovery of an
  existing default, initial creation location, offline setup and recovery still
  need design. Current Contacts opens one local collection and attaches it on
  explicit sync to contactsResource or apps/solid-apps/contacts.ttl under the first
  profile storage root. It does not currently discover multiple books or create
  a workspace, so that broader setup behavior is a requirement, not a claim of
  existing support. A Share action should invoke a
  Contacts-provided contact-selection dialog, following the Files picker pattern.
  The dialog initially shows the current workspace's default book and lets the
  user choose another book. Recipient selection remains future capability work;
  this discussion does not implement a sharing/permission editor or change the
  broker phase order. Keep provider-owned selection distinct from the calling
  app's responsibility for the requested sharing operation.
- The maintainer subsequently confirms picker-local browsing of another
  workspace's address books. The active Workbench workspace stays unchanged;
  do not close the caller or abandon the pending sharing task. Clearly identify
  the workspace/address book being browsed. Returning a selected contact does
  not itself perform the calling app's sharing operation.
- The ordinary Contacts app initially shows only the workspace's default
  address book and allows switching books. The maintainer explicitly requests
  search across all address books and across all workspaces as additional
  options. Design three clear scopes: the current book, all books in the current
  workspace, and books across all workspaces under the selected WebID. Do not
  silently widen a normal book search. Result source labels, shared-book
  deduplication and incomplete/offline search behavior remain to design; an
  all-workspaces search does not switch the active workspace or identity.
- Profile-advertised storage endpoints provide the base set. A workspace can add
  further endpoints privately, without publishing them into the public profile.
  Workspace additions are not a new identity, an implicit access grant or a
  requirement to create/copy data. Discovery, endpoint management, automatic
  shortcut creation and behavior when an endpoint is unavailable remain to design.
- Keep shared preferences shared across workspaces. App-specific preferences can
  be linked to a workspace, including app data-source choices. This supersedes
  the proposed workspace-specific overrides of common theme/language/text-size
  settings: those remain common. Use the existing linked-preferences authority;
  the exact RDF links, fallback for apps with no workspace context and editing
  interaction have not yet been selected.

Active widgets are a stretch goal, outside the MVP: optional pieces run when the
Launcher starts and supply UI in a small area, inspired by Windows 8 Metro.
Their lifecycle, rendering/capability integration, data access, failure isolation,
permissions, offline behavior, accessibility and download costs need later design.
The later [shared embedded-view proposal](#shared-embedded-app-views-files-and-presenter)
identifies the intended common hosting foundation. Reuse it for both
resource-backed and resource-free operations, with explicit startup, visibility,
background and write policies. Widget implementation remains outside the MVP;
this does not authorize arbitrary third-party startup execution.

This discussion establishes direction and open choices, not a selected cycle,
implementation design, immediate workspace/onboarding/widget delivery or approval
to commit, merge or publish. Continue with ordinary user flows and target layouts
before choosing the implementation boundary.

### Everyday Launcher UI before diagnostic readability work

Clarified by the maintainer on 2026-11-08 after CYC92 integration. Establish a
clear design of the eventual everyday Launcher/Workbench UI before selecting
readability refactors around current workspace status and broker-facing controls.
These technical details should not dominate the ordinary home screen; a future
diagnostic panel may provide them. This reorders the proposed next work rather
than accepting the current interface as the target.

Design the ordinary shortcut/workspace/account tasks first, with phone and
keyboard interaction, and distinguish primary tasks, secondary operations and
technical diagnostics. Preserve reachable save/sync, permissions, unsaved-work
feedback and failure/conflict recovery; those are user needs even when their
underlying protocol details are diagnostic. Review the target and first delivery
slice before implementation. No debug-panel design, control-removal list or
implementation cycle is selected by this clarification.

## CSS review and refactor

Requested by the maintainer on 2026-11-08 after accepting CYC100: the CSS is
becoming awkward and overlong. Review the accumulated suite styles and propose
a simpler structure before implementing the refactor. This is a roadmap item;
it does not start another cycle or change the accepted interface.

Start with the Launcher changes, then inspect shared design/account/Preferences
styles and the other apps for the same causes. Build on CYC87's existing named,
feature-owned SimplyFlow styles and source origins. Keep those sources editable
for the future IDE; avoid replacing them with one opaque stylesheet.

- Map ownership and cascade order across the-ds defaults, shared components and
  app features. Identify unused legacy selectors, repeated declarations and
  overrides that exist only to undo another feature's rules. Establish which
  rules belong in each layer before moving or deleting them.
- Simplify selectors and specificity so a reader can find the rule responsible
  for an element without following a long override chain. For example, shortcut
  focus appears in both shortcuts.css and background.css; review one deliberate
  owner for the accepted focus treatment. Review background.css's header/account
  reach and legacy saved-apps rules alongside the current home grid. These are
  review targets, not a preapproved deletion list.
- Consolidate theme, spacing, icon and surface choices around existing the-ds
  tokens and public APIs. Keep exceptions explicit and component-scoped. Preserve
  light/dark/automatic behavior, transparent home title/labels, padded blue icon
  backgrounds, the filled menu marker and visible keyboard focus.
- Keep the result straightforward for people altering their apps: clear feature
  boundaries and readable names, with reusable rules extracted only where the
  same responsibility is actually shared. Reduced duplication and a predictable
  cascade matter more than an arbitrary line-count target.

Present the ownership map, concrete before/after examples, preservation criteria
and proposed implementation slice for discussion before starting product changes.
Verify phone and desktop layouts, all theme modes, preset/custom/no backgrounds,
long workspace/shortcut labels, menus, dialogs and keyboard focus. Include checks
across Contacts, Files and Profile when shared styles change; distinguish browser
assertions from manual keyboard and assistive-technology review. Preserve local/
offline behavior and existing SimplyFlow style editing. Measure CSS and complete
app downloads, including readable CSS embedded in JavaScript, without expanding
the temporary Workbench budget allowance. Keep restoring the original JavaScript
budget visible as its own follow-up.

Contacts multi-book/search/selection remains planned separately. The original
review request did not select a cycle or reorder the governing broker phases.

Next-cycle selection, 2026-11-08: after the source review against the
[Browser Styling Guide for AI](Browser-Styling-Guide-for-AI.md), the maintainer
requests a refactor plan for use in the next cycle. The
[CSS refactor plan](../.spiral/css-refactor-plan.md) records the selected outcome,
ownership/layer map, ordered implementation slices, preservation contract and
evaluation criteria. It continues this roadmap item after accepted/merged
CYC106; broker progression remains deferred. Product implementation has not
started. Keep named editable styles and the accepted interface; no budget
expansion, dependency publication or unrelated feature work is selected.

Execution starts on the maintainer's subsequent “Please start this cycle”
instruction: CYC112 is Active on its matching CSS-refactor branch. The plan's
pre-start notes are historical. Implementation/evaluation are recorded in
IMP115/EVD116; no human acceptance or integration is inferred.

## MVP UI and reusable design components

Added at the maintainer's request on 2026-11-07. Bring Launcher, Contacts,
Files and Profile closer to the UI in
[poef/solid-apps](https://github.com/poef/solid-apps), turning the current
prototype screens into an MVP UI for ordinary use. Review the reference UI
alongside the current suite when selecting this work. Retain its blue accent,
square controls, panel layouts and compact account dropdown, with app-owned
toolbars, Launcher-only app navigation and inline profiles in Contacts.

Inventory the visible controls and remove those present mainly for testing or
demonstrating implementation details from the ordinary app interface. Choose
what to remove from actual user workflows; keep necessary account, save/sync,
error and recovery interactions understandable and reachable. Developer checks
belong in tests or explicit developer tooling rather than permanent product
controls. This item does not predetermine a list of controls to delete.

Create and reuse common design components across the suite, including dialogs
and dropdown menus, wherever the interaction is shared. Inspect the installed
the-ds and SimplyFlow APIs and existing suite components first; extend that
composition rather than introduce a parallel design system. Shared components
must follow the moldable feature structure, expose app-specific content and
commands, and keep SimplyFlow responsible for runtime rendering. Retain direct
native dialog/popover lifecycle and focus operations where appropriate.

Required reading when designing or implementing this item:
[Jon Yablonski's Laws of UX](https://lawsofux.com/llms.txt), read during this
roadmap update on 2026-11-07. Use the relevant principles to assess concrete
choices: familiar interactions (Jakob's Law), fewer competing choices (Hick's
Law), lower cognitive load, clear visual grouping, and usable targets (Fitts's
Law). Treat these as design guidance and check the resulting workflows with
users; they do not supply a ready-made layout or an arbitrary numerical limit
on controls.

Future evaluation: review the core flows in all four apps on mobile and desktop
against the reference UI; verify that testing-oriented clutter is gone while
necessary feedback and recovery remain available. Check shared dialogs and menus
for consistent behavior, keyboard operation and focus return. Preserve the
JavaScript budget and existing data/RDF contracts. This is a roadmap item, not
a selected cycle, a new delivery order or an implementation change.

### Escape closes dialogs while focus is inside an iframe

Accepted [CYC157](../.spiral/cycles/CYC-20261112-QG24H-157.md)
after CYC151 delivery. Implemented and verified with native Chrome keyboard
checks, existing save/discard guards and scoped cross-origin cooperation; see
[EVD161](../.spiral/evidence/EVD-20261112-QG24H-161.md) and
[ACC162](../.spiral/acceptance/ACC-20261112-QG24H-162.md).

Requested by the maintainer on 2026-11-12 and explicitly retained for later,
without moving it ahead of Contacts. Fix modal dialogs that do not respond to
Escape when focus is inside their embedded app. Escape should request the same
close/cancel operation as the owning dialog's close button, including existing
saving, unsaved-draft and discard checks. It must not bypass those checks or
implicitly save/publish a task. Return focus to the invoking control on close.

Initial source inspection finds an Account-specific child Escape handler and
an existing nested-Account keyboard check. The capability host handles its own
dialog's native cancel event, while Preferences has no equivalent child Escape
forwarding in its component. Treat this as evidence of uneven coverage, not a
claim that every iframe dialog fails. Reproduce the affected real workflows
before choosing a shared implementation; inspect SimplyFlow event bindings,
existing private ports and managed lifecycle APIs first.

Cover Preferences, embedded Profile/Files tasks and Account, including nested
dialogs and genuinely cross-origin providers. An inner popup/dialog or control
that consumes Escape must retain its interaction; one key press must not close
multiple modal layers. A provider's request to close must be scoped to its active
invocation, with stale/unrelated frames unable to dismiss another task. Define
cooperation for cross-origin providers rather than assuming the host can read
their document or intercept child key events. Keep separate-tab fallback behavior
explicit rather than treating a provider tab as a parent-owned modal.

Acceptance: send native keyboard Escape with focus in an iframe input/control;
verify the intended modal closes or presents its existing save/discard guard,
the caller regains focus, and pending edits survive. Repeat for nested modal
precedence, a consumed Escape, cross-origin providers, repeated open/close and
iframe reload. Retain Account's existing regression check and test cancellation
results and active-task cleanup. These scenarios are covered by accepted CYC157
without changing provider authority.

### Short suite prefixes

Requested by the maintainer on 2026-11-07. Use **swb-** or **swb_** as the
default namespace for suite-owned MVP UI names where it avoids conflicts;
there is no need to include Muze or the full package name. Prefer swb- for
HTML IDs/classes/template names and data-swb-* attributes, --swb-* for custom
CSS properties, and swb_ for JavaScript names such as commands/actions that
need a shared namespace. Add a short feature/app qualifier only where an actual
collision requires it, keeping names readable and easy to alter.

Plan a coordinated refactor of existing long suite-owned prefixes across
component definitions, authored templates/styles, bindings, references and
verification. Keep third-party library names/public APIs intact and preserve
editable feature reconstruction and embedding behavior. This is UI naming,
not a rename of persisted RDF, capability identifiers or published packages.
It is recorded future work; CYC73 does not silently rewrite all existing names.

### Remaining UI work per app and in Preferences

Clarified by the maintainer on 2026-11-07 after accepting CYC49. The shared UI
foundation is accepted, but each application still needs its own UI improvements.
Review Launcher, Contacts, Files and Profile individually, including their task
flows, content layout, toolbars, forms and feedback. Apply the same expectation
to future apps as they join the suite.

The Preferences dialogs also need a dedicated UI review, covering both common
settings and each app's settings: grouping, labels, explanations, save/recovery
flows and usability on phones. Reusing the shared dialog component does not
complete the design of the settings inside it.

Carry forward the reference visual language, Laws of UX guidance, accessibility,
mobile/desktop checks and shared components above. Define concrete improvements
from each app's workflows when selecting future cycles; this addition selects no
implementation cycle or delivery order.

### Shared visual language for forms

Requested by the maintainer on 2026-11-07. Establish a coherent form design
across every app and dialog, including Preferences and profile editing. Define
consistent labels, help text, grouping, spacing, control appearance, required
and optional fields, validation/error feedback, and primary/secondary actions.
Include editing, saving, disabled and recovery states so shared appearance also
communicates the interaction consistently.

Build reusable form patterns/components on the existing the-ds/SimplyFlow
composition and blue-accent, square-control visual language. Keep app-specific
fields and behavior editable through named feature datasets. Evaluate keyboard
and screen-reader use, focus visibility, error association and phone layouts;
apply the Laws of UX guidance above. This is future design work, without a
selected implementation cycle, control library replacement or delivery date.

## Mobile first and JavaScript budget

Apply the [standing feature guardrails](#standing-feature-guardrails) to each
new feature. Design and validate core workflows on mobile first, preserving the
suite's existing visual language and supporting larger screens as well.

Target: **less than 200 KB of gzipped JavaScript per app**. Measure the app and
its required shared dependencies together, including the auth callback. The
maintainer's 2026-11-09 instruction supersedes earlier build enforcement:
budgets are advisory, with warnings allowed but no failing builds or blocked
dev startup. The readable Workbench warning threshold remains 220033 bytes;
all other graphs warn at 200000 bytes.
[EVD30](../.spiral/evidence/EVD-20261101-QG24H-30.md) retains historical
measurements and verification limits. Continue measuring the complete graph;
a small entry file alone does not establish affordability. JavaScript size
alone does not establish useful first-load
performance. Also evaluate the complete cold first-use path and the actual core
task, as specified in the standing guardrails.

## Local first and automatic sync

Apps must continue to work without a network connection. Keep locally available
data and pending edits usable, then sync automatically when connectivity
returns. Local edits must survive reloads and failed sync attempts. Show pending,
synced and failed/conflicting states clearly, and preserve changes when access
or authentication needs the user's attention.

This changes the intended direction from today's explicit manual sync.
The existing local replicas are a starting point, not proof of complete offline
operation. Define per-app offline workflows, data availability and conflict
handling in future cycles; resources not yet available locally cannot be
assumed to work offline. Apply the same automatic-sync direction to the planned
[Pod-synced workspaces](solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).

A future verification should make edits offline, reload without losing them,
restore connectivity, and observe automatic Pod synchronization. Cover an
expired session and a conflicting remote change without silently discarding
local work.

## Explicit PWA support in every app

Make PWA support an explicit requirement for Launcher, Contacts, Files, Profile,
and the planned Zett and Notebook apps. Plan install metadata, an appropriate
offline app shell, app-specific launch URLs and a clear update lifecycle.
Verify installed and ordinary browser use, including offline reopening and
updates that preserve pending local changes. Select the exact implementation
and supported-browser checks in the relevant cycle; PWA support is not claimed
to exist merely because the apps are browser applications.

## Shared embedded app views: Files and Presenter

Added at the maintainer's request on 2026-11-12 from the
[shared embedded app views design](solid-workbench-embedded-app-views-design.md).
Treat it as a staged proposal, alongside existing document-viewer, Semantic Open
With and composition work. It neither selects the next cycle nor requires AI.

Keep semantic operations, shared provider lifecycle and host layout distinct.
Files owns resource selection and a list/details interface; Presenter owns decks
and named regions; providers own their content UI. Reuse current registration,
provider preferences and scoped transport, extending only demonstrated gaps in
persistent/multiple-view hosting. Do not create a second broker, renderer,
authentication stack, widget format or AI-specific component system. Normal
iframe/loading/error/chrome rendering stays with SimplyFlow. Providers may use
other frameworks and must remain useful at their own URLs.

Retain the proposed delivery sequence for future cycle selection:

1. **Shared contract and Files proof.** Start with explicit registrations, simple
   format matching and direct-resource access. Implement a details pane with
   usable readiness, provider selection/replacement, resource changes, initial
   appearance hints, live hint updates, failure and disposal. Prove replacement
   with an independently hosted provider. On phones use sequential list/details
   screens when needed; retain metadata, standalone opening and download.
2. **Presenter proof using the same host.** Adapt a small set of SimplyPresent-
   inspired layouts into stable named regions. Demonstrate multiple simultaneous
   text/image views, a complete text-creation/editing path without SimplyEdit,
   and local presentation with passive bounded content. Creation is an explicit
   operation, not an assumed property of editing. Viewing and editing providers
   may differ; templates constrain capabilities rather than app identities.
3. **Resilience and usability.** Exercise rapid selection changes, provider
   replacement/reload, stale generations, failure isolation, draft recovery,
   cancellation, conflicts and account/workspace transitions. Verify phone use,
   keyboard focus/navigation and assistive technology, distinguishing manual
   review from automation. Measure the full usable task including nested apps,
   authentication, images, fonts and requests before expanding layouts.
4. **Later reuse.** Apply the same lifecycle to resource-backed and resource-free
   Launcher widgets and future document embeds. Defer widget startup/background
   policy, broader semantic recognition, nested-layout editing, AI composition,
   immutable snapshots/revision pinning, export and remote presenting.

Preserve drafts before changing resource, provider, mode, region or slide.
Transition approval must remain valid until disposal; cancellation leaves the
current content and label together, while late messages cannot replace a newer
selection. Failure/timeout never implies permission to discard. Distinguish
provider-owned direct-resource writes from an explicit host-owned draft contract;
read, edit, subscribe and delegate remain separate permissions. Resource URIs,
selected views, renderers and synchronization are separate concepts. Capability
advertisements and passive UI modes confer no data access or server permissions.

Initial instance-local appearance hints cover typography with font fallbacks,
legible colour pairs and surface preferences. Use typed semantic values, not
arbitrary CSS or automatic host-font URL fetches. Providers report support and
limitations; accessibility and meaningful content formatting take precedence.
Updates/removal must preserve selection, drafts and undo, restore defaults and
reject obsolete revisions without remounting the editor or restyling siblings.
Keep ownership visible, especially for editing/privileged interfaces.

Persist authored layouts, stable region identities, provider/resource bindings,
connection intent and typed configuration as native RDF. Never persist live
ports, grants, HTML snapshots or JSON-in-Turtle layouts. Revalidate origins,
capabilities and authority on restore; missing providers yield recoverable
placeholders. Offline use needs both available code and content. Removing a
region does not delete its resource; host and provider undo remain separate.

Before claiming full Weblets compatibility, additionally prove useful standalone
apps, an independent host without Launcher/WebID/RDF requirements, a three-level
composition with immediate-parent authority and no sibling/grandparent bypass,
constraint/allocation size negotiation without loops, and restoration with
revocation or origin/API changes. Partial-view transclusion and cross-boundary
overlays need their own evidence; overlays, if introduced, retain opaque
host-owned identity/close chrome and focus control. These are architectural
boundaries, not a requirement for a general composition editor in the first MVP.

The source's CYC151 baseline is already accepted; CYC157 now also supplies guarded
iframe Escape and focus-return evidence. Neither proves long-lived multi-region
hosting. Keep residual process-loss limits explicit and do not revive obsolete
live routes or arbitrary global payload caps. Final API URIs/versions, lifecycle
extensions, appearance tokens, draft acknowledgements and deck RDF terms remain
implementation decisions. Refresh cited library/standards claims when selecting
that work; this intake is a local design comparison, not conformance certification.

## Deferred optional AI and composable interfaces

Added at the maintainer's request on 2026-11-12 from the
[AI-composable Workbench design](solid-workbench-ai-composition-design.md),
alongside the existing [optional AI boundaries](solid-optional-ai-capabilities.md).
Keep AI optional and replaceable: an ordinary Assistant app may propose useful
connections between semantic capabilities, provider-owned interfaces and named
SimplyFlow components. The broker remains a narrow connection/policy mechanism;
the Assistant receives no ambient credentials, protected graphs or privileged
workspace access. Users inspect and approve consequential operations through
ordinary application authorization and trusted operation details.

Retain the proposal's staged work for future selection:

1. **Inventory contracts.** Describe two real capabilities and two components,
   their public dependencies and missing metadata. Track hidden editable-state
   dependencies as moldability defects; reuse existing definitions.
2. **Discover capabilities.** Extend existing registry paths with inspectable
   descriptions and input/output contracts. Demonstrate zero, one and multiple
   providers, explicit user preferences and inactive-provider handling.
3. **Evaluate declarative UI composition.** Investigate a bounded A2UI adapter
   over SimplyFlow with an approved component catalog and one capability-bound
   interaction. SimplyFlow stays the sole renderer; reject executable generated
   code and unknown actions. No external protocol/version is adopted here.
4. **Try an optional Assistant.** Propose a small composition through an ordinary
   replaceable AI provider. Preserve the same usable manual workflow and show
   what information is disclosed.
5. **Combine component and application interfaces.** Reuse provider-owned pickers
   alongside composed controls, with scoped origins, focus, cancellation and
   lifecycle cleanup. Providers retain their own data and interaction ownership.
6. **Save user-owned compositions.** Persist native RDF references and explicit
   configuration, separate from source data and conversation state. Support
   manual editing, AI removal, provider replacement, missing resources and
   offline/reload recovery without copying protected graphs into saved layouts.
7. **Investigate federation.** Compare independently hosted discovery and
   Weblets-style cooperation, including optional MCP/A2A/MCP Apps/glottis
   adapters. Refresh specifications, public APIs and licences before choosing
   anything; demonstrate independent implementations and standalone use.

The proposed first vertical experiment selects a Solid resource through the
existing Files provider and opens it in an explicitly chosen application, with
the same path available without AI. Evaluate component/provider replacement,
least-data disclosure, malformed output, cancellation and failure, phone and
keyboard/assistive-technology task completion, and complete cold-load/download
costs. Saved work must remain usable after all AI providers are removed.

The proposal's supplied-snapshot baseline predates accepted CYC118/CYC139
provider preferences and recipient selection. Reuse those existing paths;
general discovery, composition and the IDE are still future work. Broker
Phase 4 evaluation governs before expansion. Adapter location, vocabulary,
validation shapes and composition persistence need design; the optional-AI
deferral remains, with no new cycle, implementation priority or delivery date.

## Second stage: virtual company

Added at the maintainer's request on 2026-11-07. After the current suite work,
center a second stage on a "virtual company": a set of Solid apps that makes it
easy for people to come together, form a temporary collaboration and get work
done. The shared purpose is supporting people working together; the concrete
workflows and app boundaries will be developed when planning this stage.

The initial capability list includes:

- **Project management.**
- **CRM (customer relationship management).**
- **Document management, versioning and knowledge base.** See the
  [documents, annotations and versioned knowledge-base proposal](solid-documents-knowledge-base-versioning.md)
  as a second-stage option, detailed below. The
  [viewer refinement](solid-document-viewer-design.md) adds PDF reading, private
  and shared annotation layers, and replaceable note-body editing.
- **Sharing through invitation providers.** Share a resource with a known
  email/phone contact through a user-selected service, including identity
  onboarding and completion while the owner browser is closed.
- **Verifiable provenance, signed changes and timestamp attestation.**
  Trace published changes, sources and approvals through independently
  inspectable evidence.
- **User-selected signing capability.** Request signatures from a replaceable
  provider that owns key access and approval, without giving requesting apps
  private keys.
- **Forms.**
- **Chat.**
- **Live collaboration through data updates.** Changes to shared data made by
  one participant propagate to other participants' open apps, and the relevant
  views update without requiring a manual reload.

This list is open and explicitly not exhaustive. Detailed workflows and feature
sets remain to be defined; these capabilities do not prescribe separate apps
or particular products. Record further capabilities as the maintainer develops
the idea. This establishes stage order without selecting an implementation
cycle, delivery date or technical architecture.

Carry forward the suite's Solid interoperability, native RDF preservation and
moldable design requirements, including readable code that people without a
professional programming background can understand and alter.

### Documents, annotations and a versioned knowledge base

Added at the maintainer's request on 2026-11-08 as one of the second-stage
options. The
[design proposal](solid-documents-knowledge-base-versioning.md) covers document
viewing/editing and annotations, resource and root history, durable local drafts,
and linked knowledge-base pages with related changes published atomically.
Ordinary document saves and explicitly committed knowledge-base working copies
have distinct publication workflows; automatic sync must not publish unapproved
working-copy drafts.

Keep Files responsible for resource management, Documents for reading/editing
and annotations, and the knowledge base for linked content and changes review,
connected through capabilities and shared versioning integration. The viewer
proposal below narrows the first Documents workflow to reading and annotation;
source-document editing stays separate. Investigate SVN as the first backend
while keeping clients independent of it. The proposed
Solid extension, contracts, editor choices and implementation sequence remain
design work to evaluate, not implemented capabilities or an adopted standard.

When selecting this option, follow the proposal's contract, storage, document,
annotation and knowledge-base slices and their recovery/acceptance scenarios.
Reconcile its advanced-editor budget and specialist-rendering requirements with
the standing guardrails and current advisory build-budget policy before
implementation. CYC129 makes size excesses warnings, not build/dev failures;
measure the complete core workflow even when engine assets load lazily.
This records an option without selecting a cycle, priority among second-stage
options or delivery date.

### Document viewer, annotation layers and replaceable note editors

Added from the [viewer proposal](solid-document-viewer-design.md) on 2026-11-12.
Keep reading and annotation together in Documents, with Files owning browsing
and a knowledge-base caller owning its working copy. Start with standalone PDF
reading, highlights, rectangular regions, comments and independent replies.
Validate the format-plugin boundary with an image plugin using the same note
UI/storage. PDF content editing, OCR, ink/redaction, embedded-annotation round
trips and collaborative keystrokes remain separate work.

Start each document with a private writing destination. Preserve typing locally;
explicit Save publishes to the selected verified layer, with distinct local,
remote, permission, conflict and unknown-outcome states. Shared replies identify
their audience. Copy to shared creates a new reviewed annotation without exposing
the private original, history or other replies. Opening or reconnecting must not
publish drafts. Account/layer/document isolation, quota failures, multiple tabs,
revocation and interrupted writes need recovery evidence. Basic notes work on
ordinary Solid independently of a future version service; embedded knowledge
working copies retain their own explicit publication boundary.

Use native Web Annotation RDF, preserving unknown terms and original selectors.
Bind anchors to the representation/revision actually read; changed-document
matches remain explicit candidates until confirmed. Keep unsupported or missing
anchors readable. Retain the Solid Bench sample as a dated, digested fixture:
read legacy untyped bodies safely, navigate supported PDF fragments, and preserve
unsupported selectors without rewriting source data merely by opening it.
New body-bearing notes require current sanitised HTML; native editor formats
are optional additions, not substitutes for portable display.

Assess pinned PDF.js and Cobalt public APIs, licences and reuse before coding.
Reconcile the proposed specialist PDF/rich-text mount boundaries with the
SimplyFlow-only rendering rule before adopting them. Metro owns anonymous and
authenticated reads; validate range/stream support, cancellation and coherent
revision identity, with a bounded full-download fallback. A cached first page
is not an offline document: define explicit offline availability for shell,
plugin assets and complete selected bytes, preserving pending notes separately.
Measure the complete read-and-note graph, worker/assets, useful first page and
comment, memory and slow-connection phone behavior under advisory budgets.

Reuse the existing private provider preferences for a proposed
`edit-note-body` operation, with Cobalt as default and a second compatible
provider proving replacement without caller changes. The editor returns an edit
into the viewer's draft; only the viewer publishes. Require current safe HTML,
explicit conversion for unsupported native formats, and durable provider draft
recovery across iframe/tab reload, cancellation and broker loss. Keep credentials,
PDF bytes and unrelated notes out of editor requests; respect the complete
64 KB broker message limit. Define standalone invocation and scoped large-content
access rather than assuming either is already supplied by the broker.

Follow the proposal's contract, reading, private-note, shared-discussion,
revision/embedding, image-extension and replacement slices. Resolve selector/RDF
profiles, bounded layer discovery, launch/focus fields and verified server access
policy before implementation. Verify private-from-first-write and author-edit
permissions with another identity and direct server checks. Acceptance combines
phone/keyboard/assistive-technology reading and non-drag selection, draft recovery,
unknown-RDF round trips, provider replacement and the private-note/copy/reply/
changed-PDF scenario. This is a second-stage option, not a scheduled cycle.

### Sharing through user-selected invitation providers

Add the [sharing proposal](solid-sharing-design.md) as a reusable capability for
sharing an owner's resource with a known email address or phone number when the
recipient's WebID is unknown. Provider setup is separate; each share needs one
owner confirmation, and a trusted server-side provider completes acceptance
while the owner's browser is closed. Recipients can use an existing identity
or register and return to the invitation, without requiring their own storage.
Apps invoke the sharing interface without owning invitation delivery, identity
onboarding or ACL editing. Reuse capability routing and private provider
preferences; define the service identity, discovery/API and management scope.
This is distinct from choosing a contact, signing, or copying an annotation
between layers, and does not expand broker Phase 3 automatically.

Start with a read-only single-resource invitation, email delivery and a defined
verification policy, allowing an optional second channel. Bind explicit acceptance,
contact verification and the authenticated WebID to the immutable approved share.
A recorded invitation is pending, not granted access. Keep delivery status separate;
freeze the accepting identity, make retries idempotent, and reconcile lost write
responses, cancellation races and uncertain outcomes without a second ordinary
owner approval. Link previews must not consume invitations. Keep contact details,
invitation secrets and outcome records private; use native RDF where persisted
under the suite's contracts.

Investigate WAC first, with separate ACP support only after its own compatibility
work. Setup must demonstrate actual management authority on each target; inherited
folder permissions do not prove control of every child. Explain the provider's
broader access-control authority and verify its service authentication after the
owner session ends. Preserve owner control and unrelated permissions through
conditional updates. Accepted recipient access is ordinary Pod authorization and
survives provider outage. Revocation removes only this share's contribution;
disconnection removes effective provider authority as well as preference state.
Invitation expiry is separate from access expiry; guaranteed timed access,
folder sharing, onward delegation and ownership transfer stay outside the first
slice. Local/offline preparation must not be reported as a remotely created
invitation; define draft recovery and explicit submission for the core phone and
keyboard workflow when the cycle is designed.

Refresh SAI invitations/SAI-JS and LWS alignment before freezing the contract;
draft endpoints and existing provider compatibility are not assumed. Close the
private share inventory, default verification policy and replacement/disconnection
semantics. Acceptance must show owner-browser-closed completion, authenticated
onboarding return, expired/cancelled/claimed invitation rejection, interrupted
policy-write recovery without lost unrelated grants, accepted access during
provider outage, and effective cancellation/revocation/disconnection. Apply the
standing accessibility, local recovery and download guardrails. This records a
second-stage option without selecting a provider service or implementation cycle.

### Verifiable provenance and timestamp attestation

Add the [provenance, signatures and attestation proposal](solid-provenance-signatures-and-attestation.md)
to the second-stage document and knowledge-base direction. Keep three distinct
records: the actor's signed change statement, the Pod's signed receipt of the
accepted outcome, and a timestamp attestation binding the signed evidence.
Preserve source revisions, historical key bindings and explicit delegation or
human-approval evidence. A valid signature does not establish content truth or
personal review; a server receipt records the server's acknowledgement.

Start with explicit Turtle commits and payload digests, then add retrievable
receipts, Attest integration and portable historical verification. Direct
signed PUTs, bounded agent delegation and independent witnesses are later
slices. Reuse established provenance and proof standards through a tested
Turtle mapping; settle exact coverage, identity trust, key lifecycle and the
actual Attest contract before implementation.

Keep publication, receipt verification, content matching and timestamp status
separate and persistently visible. Lost responses require durable request
lookup and safe retries; a stale base requires reconciliation and a new
signature. Attestor failure leaves an accepted commit published with timestamp
evidence pending. Private drafts remain local, and evidence access must respect
document privacy. Retain evidence independently of deletable resource metadata.

Evaluate tampering, replay, permission failures, interrupted publication,
missing historical keys and provider outages. Verify an exported package with
an independent verifier or established independent test vectors; a same-code
round trip alone is insufficient. Later delegated work must distinguish agent
authorship, authority and a human's approval of an exact artifact, including
when used by the separately deferred optional AI capabilities.

### User-selected signing provider

Add the [sign-change capability proposal](solid-signing-capability.md) as the
signing boundary for these second-stage workflows. Reuse the general provider
registry and the profile's `pim:preferencesFile` discovery, with explicit
provider selection. The browse registry and preference mechanism exist through
accepted CYC118; signing still needs its own compatible contract, route policy
and isolated approval presentation. A registered browse provider is not a
signing provider. Keep provider selection, key enrolment, approval and Pod write
permission distinct.

The initial web signer uses a separate origin and a top-level approval window
or tab. It renders readable operations from the exact immutable manifest it
will sign, with verified caller context and honest content-review scope.
Existing embedded capability dialogs do not establish the signing security
boundary. Settle trusted-broker versus direct caller verification and supported
proof profiles; evaluate WebAuthn as a first provider option rather than a
mandatory backend. Requesting apps retain their own Solid transport and verify
returned proofs; the Pod independently verifies proof and authority.

Start with explicit approval per commit. Add interrupted-request recovery,
provider/key migration and historical verification before expanding to bounded
signing sessions or additional backends. Keep private keys, live grants and
invocation secrets outside portable workspace state. Preserve drafts through
cancellation, unavailable providers and offline use; signing availability may
still be required for publication. Plan standalone invocation without requiring
a running Workbench.

Evaluate two requesting app origins and a separate signer origin, using the
same selected provider without sharing keys or hardcoding its address. Include
forged caller context, provider navigation, changed manifests, unsupported
proofs, cancellation and key transitions, plus keyboard and phone review.

### Shared preparation and dependency order

Before these options enter implementation, follow the designs' dated
[research and reuse checklist](solid-provenance-signatures-and-attestation.md#161-standards-alignment-and-implementation-time-research-refresh).
Refresh specifications and implementations, record exact versions, licences
and adopt/adapt/defer decisions, and test interoperability before freezing the
proof profile. External coordination can follow a working slice; it is not a
prerequisite.

Versioned-root, working-copy, upload and retry contracts support atomic document
publication. Standalone viewing/annotation can precede that service; historical
and embedded working-copy workflows depend on its explicit revision/commit
contracts. The note editor and invitation service reuse provider selection but
have separate data, recovery and trust contracts; neither is a prerequisite for
basic browse or the retained recipient-picker phase. General provider selection
and the isolated approval contract support signing. The signed-change profile connects both to Pod verification,
receipts and timestamp evidence. Plan coherent slices across those boundaries
rather than treating these designs as unrelated implementations. Their
first integrated evidence should cover a knowledge-base page and staged binary
attachment, recoverable publication and independently verifiable export.

These dependencies guide future cycle planning without pulling the second
stage into the current suite scope or selecting a delivery date. Apply the
standing feature guardrails to each slice, including accessible approval and
verification states, offline draft recovery and measured download costs.

### Collaboration through live data and views

The maintainer explicitly defines collaboration here as live updates of shared
data and the views that display it. For example, when one participant changes
a project item, another participant viewing that shared data sees the change
in their open app. Collaborative text editing, such as simultaneous keystrokes
or shared cursors in an editor, is outside this requirement.

Plan the data-change delivery mechanism, access boundaries and handling of local
unsaved edits, concurrent changes and reconnection when selecting implementation
work. Keep native RDF authoritative and use SimplyFlow to update the views.
Future verification should use two participants with access to shared data,
change it in one app and observe the relevant view update in the other without
a manual reload, while preserving pending local edits.

This multi-user capability belongs to the second stage. Automatic synchronization
of one user's data, workspace portability and consistent account information
across their apps remain part of the current suite direction.

## Simple decentralized app store

Allow users to configure an app-catalog URL and to use **more than one catalog
source**. Sources are decentralized and independently hostable; no single Muze
service or mandatory central store should be needed. Keep adding a source and
choosing an app simple.

Start with a placeholder catalog implemented as a static **folder of `.ttl`
files**: one `index.ttl` and one manifest per available application. The index
must supply each app's **name, icon and link to its manifest**. The manifest
provides the application's actual launch description; reuse the existing launch
contract and capability descriptions where supported. Final vocabulary/shape
choices belong to the implementation cycle. No catalog or manifest files are
created by this roadmap update.

Seed it with the available suite applications and add a selection of existing
stable Solid apps, even when they do not participate in this ecosystem. Verify
the candidates' current availability and documented launching behavior when
curating the first catalog; no third-party shortlist or stability claim is
selected here. Ordinary external apps must be usable as launch links without
pretending that they implement broker, capability or state-restoration APIs.

A catalog folder can be published through Git/static hosting, but Git is not a
mandatory runtime dependency or the selected hosting service. Keep independent
catalog URLs and support for multiple sources. Define updates and duplicate
entries in a future cycle. Catalog discovery and a user's preferred capability-
provider registry have separate responsibilities; a listing does not grant Pod
access or make an external app a compatible capability provider.

Future verification: load the index and per-app manifests, display each name and
icon, and add launch links from both suite and third-party entries. Add two
independent catalog URLs and retain the other source when one is unavailable or
removed. Ordinary external apps launch without requiring ecosystem cooperation.

### Evaluate Solid App Gallery as a foundation

Maintainer follow-up, 2026-11-13: investigate
[Solid App Gallery](https://solid-app-gallery.mpeters.dev/) as a possible base
for the app store, including reuse as a catalog/data source rather than only
reuse of its interface. Inspect its maintained source, license, data model and
hosting requirements before choosing an approach.

Compare its existing support with the Workbench catalog workflows: independent,
multiple sources; portable/static native RDF indexes and linked app manifests;
names/icons, categories and More info text/screenshots; ordinary external launch
links and optional capability declarations; simple manual-link addition; CORS,
updates, duplicate handling and cached-source failure/reload. Assess phone and
keyboard/assistive-technology use, download cost and whether useful operation
would require a central service.

Report what already fits, what additional metadata/APIs or behavior it would
need, and whether direct reuse, an upstream extension or a small format bridge
would be appropriate. Keep gallery discovery separate from provider selection
and Pod permissions. This is a research item, not selection of a foundation or
authorization to replace the current implementation. The site could not be read
by the research tool during intake; no suitability or missing-feature claim is
made yet.

## Source inspection and planning boundary

The maintainer supplied the roadmap requirements directly. During the original
roadmap update, GitHub pages could not be retrieved and these local sources were
inspected read-only:

- `poef/zett` at `014a8887568482d185fadd48442372d0e7e2afaa`: committed
  `package.json`, `src/app.mjs` and `www/index.html`. At that inspection the
  checkout contained unrelated user changes; those were not used as the historical baseline or
  modified. The separate `muze-labs/zett` version remains uninspected.
- `muze-labs/cobalt-note` at `32c86bbfcc015390ad5479abde75e9e9695c57b6`:
  README, notebook package metadata, exports and note-type API documentation.

The original documentation update was on `docs/solid-apps-roadmap`. The latest
refinement is on `docs/launcher-workspace-roadmap`, outside a new implementation
cycle and after the maintainer's PR #3 merge. No dependencies, runtime behavior
or build configuration change. Before selecting the next cycle, reconcile this direction, the broker
phases and retained workspace work with the maintainer's priorities.

## Managed-workspace revision, 2026-11-01

The maintainer explicitly advanced one part of workspace persistence in the
active broker cycle: Launcher owns opened apps and checkpoints one default
workspace locally and to the Pod at explicit save/close. Browser-X uses a
best-effort prepared write. Subsequent roadmap additions above refine named-workspace selection, preferences, logout,
home-screen and catalog behavior. Named workspaces, continuous automatic app-data
sync, PWA rollout and collaboration still require future implementation cycles.
The [managed-workspace design](solid-managed-workspace.md) records the boundary.

## Workspace foundation accepted, 2026-11-08

CYC100 is Accepted (ACC105). The foundation includes named workspace launcher
homes, manifest/Feather icons, Preferences management, protected switching and
deletion, private storage/app settings and locally retained backgrounds. Shared
menu items stay first and workspace entries have distinguishing icons. The
final light theme uses dark home text without shadow; dark theme retains its
shadow. Contacts multi-book/search/selection, widgets and app store remain future
work. Earlier proposed/unimplemented wording records design history; the cycle's
source, design, implementation and evidence define the delivered boundary.


## CSS refactor accepted, 2026-11-08

CYC112 is Accepted (ACC117). The suite now has layered, feature-owned styling,
component-root DS adapters and explicit part/variant interfaces. It preserves
named editable styles and core workflows, with evidenced wrapping picker and
narrow/short-viewport corrections. IMP115/EVD116 retain implementation, passing
checks, source/download costs and review limits. The maintainer authorizes
commit, normal merge and push; exact-candidate validation precedes integration.
Contacts/broker work and the original Workbench budget target remain separate
follow-ups. Earlier CSS proposal/Active wording is historical; no next cycle or
package publication is selected here.


## Preferred resource-picker applications accepted, 2026-11-09

CYC118 is Accepted (ACC123). Preferences' shared Default apps section now offers
capable current-Launcher app selection, custom app URLs and reset to built-in
Files. One native provider choice applies across workspaces under the selected
WebID; conflicts and local drafts retain their existing preservation contracts.
The current broker/presenter resolves the choice and opens its transient task
with iframe/tab fallback. IMP121/EVD122 retain exact implementation and evidence,
including readable/minified provider checks and unresolved final complete-run
session/managed timing limits. Readable Workbench is 219996 gzip bytes; its
explicit allowed maximum is 220033, while other graphs remain below 200000.
Original budget restoration remains open.

This continues broker Phase 2. Contacts/Phase 3, cross-app recovery-status
propagation and the shared header status-control/dialog requested above remain
future work. No authentication fix, next cycle, deployment or publication is
selected by acceptance.


## App icon cycle ready for review, 2026-11-12

CYC-20261112-QG24H-163 implements supplied Workbench, Files, Contacts and Profile
favicons and Launcher artwork. IMP166/EVD167 record custom-icon/RDF preservation,
source checks, all eight Chrome suites, phone/theme review and measured download
costs. The cycle remains Active awaiting human acceptance; no commit/integration
is implied. Remaining future-app artwork stays in the supplied archive.


## Shared embedded views first proof ready for review, 2026-11-12

CYC-20261112-QG24H-168 implements the first Files list/details proof on its own
branch, independently of the Active icon cycle CYC163. Files automatically opens
the configured viewer; the separate Resource Viewer supports `text/*` and
raster images through its own Metro session. Existing native provider preferences
now include resource views. Shared tickets support finite readiness, persistent
updates and guarded teardown while preserving modal picker behavior.

IMP171/EVD172 record 216 source tests/both builds, all nine Chrome suites,
independent cross-origin draft guards, own-user data access, loaded-offline
preservation, phone/desktop and theme review, and a cold usable viewer at about
560 KB / 7 requests / 11.3 seconds on the uncompressed throttled fixture. Existing
advisory JS warnings remain non-blocking. The cycle remains Active awaiting human
acceptance; no integration, commit or publication is implied.

This completes an implementation proof for review, not the full proposal.
Presenter regions/text authoring, richer editors, bounded/passive presentation,
full layout negotiation, recursive independent-host verification, durable editor
crash recovery and widgets remain subsequent work. No third cycle is started.


Embedded-view follow-up from maintainer review: generic text viewing covers all
`text/*` MIME types as escaped source. When adding specific viewers, default
selection must prefer a matching exact MIME type (such as `text/html`) over the
`text/*` fallback while respecting deliberate user choice. Consider tabs for
switching between available views; no tab UI or multi-provider ranking is
implemented by the first proof. The reviewed Files UI opens automatically and
keeps a linked filename, bounded ellipsis/tooltips and shared loading feedback;
embedded content omits duplicate account controls and persistent viewer chrome.


## CYC168 accepted for integration, 2026-11-12

The maintainer confirms “This works, good enough for now. Accepted, commit,
merge and push plesae”. ACC173 accepts implementation 804f514d376218f040fc169422acf9bb74656179
and verification 6efb0ca57ba2f6a0e877f28debf6529f7094c15a. CYC168 is Accepted,
superseding its earlier Active/review notes. The reviewed automatic Files view,
text/* fallback and minimal embedded UI are authorized for normal merge into
latest main and push after exact integration validation. Existing evidence
limits and future MIME-ranking/tab work remain explicit. The separate Active
icon cycle, changed icon archive and priorities design document are preserved.
No next cycle, release or deployment is authorized by this acceptance.


## CYC163 accepted for integration, 2026-11-12

The maintainer confirms that the icon cycle was also accepted and requests
commit, merge and push. ACC174 records acceptance of implementation
047c67e49151063d0c408e9e8e51215d9362d3de and verification
155840f2e2698a174ed00b6a0d4fcdd29e2a18ac. CYC163 is Accepted, superseding earlier
pending-review notes. Current main (including CYC168 views) has been reconciled;
216 source tests, both builds and the complete nine-suite Chrome command pass.
Normal merge and push of main and the icon branch are authorized after exact
integration validation. The supplied archive is retained as artwork source;
the unrelated application-priorities document remains unchanged and uncommitted.
No next cycle, release or deployment is selected.

## Presenter proof in evaluation, 2026-11-12

CYC-20261112-QG24H-175 continues embedded app views phase 2 after accepted CYC168
and CYC163. The maintainer selects the proposed Presenter cycle and explicitly
chooses native RDF text stored with the deck. Presenter now supplies title/text
and title/image layouts, provider-owned text create/edit/view, Files image
selection, multiple bounded/passive regions, native local/conditional Pod saves,
and keyboard/phone local presentation. Workbench's Suite apps opens Presenter.
DES177/IMP178/EVD179 retain scope, implementation and verification. This is
Active work for human review, not an accepted completion or publication.

The next resilience/usability stage should retain the measured cold first-task
cost (about 1.84 MB / 37 s in the no-store uncompressed 50 KiB/s fixture), provider
installation/offline availability, multi-tab deck edit coordination, account and
workspace transitions, manual AT and production-provider checks. The MVP retains
one local deck per account; a local deck library, richer text and layout
negotiation remain future work. Explicit provider-draft recovery, guarded region
transitions and a cross-origin provider are bounded evidence, not full recursive
independent-host compatibility. No subsequent cycle is selected by this record.


Presenter review correction: the maintainer rejects the initial form-based UI.
CYC175 remains Active while its design is refined around one background-image /
centered transparent-text template, thumbnails, direct editing and full-screen
presentation. Use Margin Notes' Cobalt-to-native-RDF approach as precedent.

Retain a shared Solid Workbench toolbar design task alongside this refinement:
consider compact app-level actions and contextual controls, taking inspiration
from SimplyFlow simply.edit's floating toolbar. Resolve selection/caret opening,
keyboard focus and dismissal, phone/virtual-keyboard placement, overflow and
provider/host ownership before standardizing or rolling it out across apps.
The later toolbar-study confirmation supersedes the earlier styling deferral:
include Bold, Italic and Link in Presenter first, with reusable components;
apply the pattern to Files in a later cycle. This does not accept the implementation
or authorize a suite-wide rollout.

### Toolbar study applied first to Presenter

Source: [interactive toolbar study](solid-workbench-toolbar-design.zip), supplied
by the maintainer. Read its HTML, editable source and README alongside the
SimplyFlow floating-toolbar precedent. Retain Feather icons and existing theme
preferences. Reuse compact icon/label controls, neutral pressed states, floating
selection tools and optional docking. The prototype's Files actions and fixed
dark theme are examples, not new Files requirements.

CYC175 now implements the single background/centered-text template, thumbnail
list–details, inline Cobalt formatting and fullscreen navigation. DES177/IMP178/
EVD179 hold the revised design and evidence; the earlier form-based proof was
rejected. Shared controls and viewport placement live in solid-design; the shell
provides an optional app-owned action row. Files adoption remains future work.

Keep follow-ups explicit: richer text styling and undo/redo (absent in Cobalt
0.1.0), physical-phone keyboard/IME and screen-reader review, wider toolbar
composition, provider installation/offline resources, production cold-load cost,
and multi-tab deck coordination. Use the revised cold measurements in EVD179;
the earlier 37-second form workflow is historical evidence, not the current path.

Cobalt composition prerequisite: the revised Presenter probe found that published
Cobalt 0.1.0 displays committed IME text without updating its fragment. This is a
verified preservation gap (EVD179), not just a physical-phone testing item. The
maintainer authorizes the fix, then explicitly permits a local build while they
handle publication later. Workbench now consumes the tested local 0.1.1 tarball
with composition-aware save/closure guards. Native Chrome composition and RDF
reload tests accompany it; physical-device and manual AT review remain distinct.
Replace the temporary local dependency with the published version after release.
No publication or cycle acceptance is inferred.

## Demo experience implementation cycle, 2026-11-13

The maintainer confirms CYC181 for Presenter-style Files/Contacts controls,
a bounded Preferences review and a first static catalog inside Workbench.
The catalog uses independently hostable native Turtle indexes/manifests,
multiple sources, cached listings and the existing shortcut workflow. Suite
apps and ordinary external app links are included without claiming ecosystem
compatibility for external apps. DES183/IMP184/EVD185 retain design and evidence.
This prioritizes the demo over the previously proposed broad resilience cycle;
that stage remains retained. CYC181 is Accepted on 2026-11-13 under ACC186;
the documented managed Presenter native-click test limitation remains. Normal
integration is authorized after validation; no publication is requested.
