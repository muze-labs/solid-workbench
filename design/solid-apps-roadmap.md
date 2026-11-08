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
  limit below 200000 gzip bytes, including shared dependencies and the auth
  callback, as a ceiling rather than a target. Also measure the cold-cache
  transfer and required requests across HTML, CSS, JavaScript, fonts, images
  and data needed for the core task, plus time until that task is usable on a
  representative slow connection. Define the task for each app/feature; a
  loading shell is not success. Optional functionality may load later, while
  the existing complete-graph budget remains enforced. Do not rely on a warm
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
unnecessary indirection. Apply the design's
[readability rules](Moldable-Solid-Apps.md#write-for-the-person-changing-the-app)
to new and changed features, including shared MVP UI components.

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

1. **Reconcile the design documents.** Resolve the review's described personal
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
- Preserve SimplyFlow's component/app override precedence. An edit replaces an
  entry by the same name in the app's corresponding section, leaving the
  component original inspectable. Removing the override must reveal the
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
  valid HTML/CSS while typing. Persist app-level edits locally, with Pod storage
  as another possible destination. Choose the format, dependency loading and
  runtime update mechanism during IDE design. Native Turtle and RDF preservation
  rules still apply to Pod resources and Turtle caches. This does not expand
  the workspace's opaque-state exception or authorize JSON-in-Turtle snapshots.
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
No third-party script execution or embedding model is selected by this idea.

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
merged build now enforces a strict 200000-byte limit on the complete graph;
[EVD30](../.spiral/evidence/EVD-20261101-QG24H-30.md) records the current passing
sizes and verification limits. Preserve that enforcement as features are added;
a small entry file alone does not establish compliance. This ceiling is not a
target to fill, and JavaScript size alone does not establish useful first-load
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
  as a second-stage option, detailed below.
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
connected through capabilities and shared versioning integration. Investigate
SVN as the first backend while keeping clients independent of it. The proposed
Solid extension, contracts, editor choices and implementation sequence remain
design work to evaluate, not implemented capabilities or an adopted standard.

When selecting this option, follow the proposal's contract, storage, document,
annotation and knowledge-base slices and their recovery/acceptance scenarios.
Reconcile its advanced-editor budget and specialist-rendering requirements with
the standing guardrails and current build enforcement before implementation;
this roadmap addition changes neither. This records an option without selecting
a cycle, priority among second-stage options or delivery date.

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
provider selection. The registry remains future broker work; existing mapped
Files/Profile providers do not establish that it already exists. Keep provider
selection, key enrolment, approval and Pod write permission distinct.

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
publication. General provider selection and the isolated approval contract
support signing. The signed-change profile connects both to Pod verification,
receipts and timestamp evidence. Plan coherent slices across those boundaries
rather than treating the three designs as unrelated implementations. Their
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
