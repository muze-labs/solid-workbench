Current status after integration, 2026-11-08: CYC100 is Accepted and merged to
main at 2ab6dbe287bd3a9e3df260a4c04567de54eae215, then pushed. The maintainer
requests a CSS review/refactor roadmap item because the styles are becoming
awkward and overlong. The suite roadmap now records ownership/cascade review,
concrete examples, design discussion and preservation checks before a future
implementation cycle. No CSS change or next-cycle selection is made here.
Contacts enhancements and restoring the original download budget remain planned.
Earlier pre-integration/pending statements below are historical.

## Workspace foundation accepted, 2026-11-08

The maintainer explicitly accepts CYC100 and requests commit, merge and push.
ACC105 records implementation 6cf2824397c2a3e7740f1e309d99f377d3b048a3 and
EVD104 at debe7458518286766934539c3060f7d04d70086a. Earlier Active/pending
statements are historical and superseded. The matching cycle branch is ready
for exact latest-main integration validation and normal direct merge. No product
change follows the passing checks and six-suite browser snapshot. Readable
Workbench is 217367 gzip bytes under the temporary 220000 cap; budget reduction
and the retained timing limitation remain open. Contacts enhancements stay
future work. After integration, record the requested CSS review/refactor roadmap
item without starting its implementation or selecting another cycle.

Latest light-mode refinement uses the DS foreground token and no text shadow in
light mode; dark mode retains the shadow, including automatic OS theme changes.
The real Preferences browser scenario and all six suites pass. Readable Workbench
is 217367 bytes under the temporary 220000 cap. EVD104 retains the current evidence
and light-mode preview. CYC100 remains Active and uncommitted.

Latest visual review restores the shared dropdown marker and adds padded icon-only
accent squares, retaining transparent home labels/title. Current readable
Workbench is 217298 bytes under the temporary 220000 cap. Source/native checks
and all six browser suites pass; EVD104 retains an intermittent session-recovery
timeout and successful unchanged reruns. CYC100 remains Active and uncommitted.

Latest CYC100 review includes confirmed workspace backgrounds and Feather/shared
menu conventions; see SRC101/DES102/IMP103/EVD104. All six revised Chrome suites
pass. Readable Workbench is 216865 gzip bytes under the temporarily expanded
220000 cap; returning to 200000 remains a follow-up. The cycle remains Active
pending human acceptance, with no commit/integration requested.

Current status, 2026-11-08: the discussion below led to the confirmed
workspace/Launcher foundation cycle CYC100. Implementation and evaluation are on
its dedicated branch, with `npm run check` and all six browser suites passing; Contacts enhancements are explicitly deferred. The cycle
record, DES102, IMP103 and EVD104 supersede earlier open-cycle recommendations.
Human acceptance and commit/integration remain pending. The maintainer permits a
temporary readable Workbench budget expansion, to revisit after evaluation.

# Roadmap and next-cycle assessment

Current conversation, 2026-11-08: the maintainer explicitly leaves the next-cycle
decision open while discussing the eventual Launcher. See the suite roadmap's
workspace home-screen discussion: manifest icons/user changes, workspace-owned
launchers/titles/contexts, a proposed workspace dropdown and default Files links.
App-store access comes later; active widgets are outside the MVP. The maintainer
subsequently confirms one selected WebID at a time and switching by closing the
current apps then restoring the selected workspace's apps. Those questions are
settled; persistence/recovery details remain for design. Subsequent discussion
adds multiple/default address books, a future Contacts-owned sharing picker,
private workspace storage additions and shared-common/workspace-app preferences.
Picker-local cross-workspace browsing is subsequently confirmed. Contacts starts
with the default book, supports switching, and offers explicit all-books and
all-workspaces searches. New workspaces reuse an existing default book, creating
one only if none exists. Creation/deletion belong in Workbench Preferences;
workspace-switching entries belong in the Launcher dropdown. Deletion removes
workspace configuration while retaining linked address books/files/other data;
the default workspace is protected from UI deletion, and confirmed deletion in
storage triggers initial setup to create a new default. The active workspace is
also protected: users must switch away before deleting an inactive non-default
workspace. Detailed state/recovery semantics remain for design. Current Contacts
uses a single local/configured collection, so broader default-book setup is not
already implemented. No proposed cycle below is selected by this discussion.

## Maintainer correction: establish Workbench UI first, 2026-11-08

The maintainer identifies the proposed workspace-status readability example as
part of a diagnostic/debug view rather than the intended everyday Launcher UI.
They explicitly say that the actual eventual Launcher interface must be clear
before doing that refactor. This supersedes the readability-first recommendation
below; no readability cycle was selected or implementation begun.

Revised next direction: **design the everyday Workbench/Launcher interface and
its boundary with diagnostics before selecting implementation changes**. This
revises the proposed local order, continuing the existing sparse-home/MVP UI
roadmap while deferring the review's readability task and further broker work.
It does not authorize automatically putting every current control into debug UI.

Current templates corroborate the distinction: index.html composes suite-app
navigation, resource-selection tools, the workspace/checkpoint section and saved
shortcuts. The workspace section presents save/restore/close controls and verbose
conflict review; its per-instance status/permissions list is already inside a
details element. Collapsing technical content has not established the intended
ordinary home-screen hierarchy. Existing add-shortcut dialog is useful work to
retain, not redesign by assumption.

Design from ordinary tasks: open a shortcut, add/edit/remove shortcuts, understand
the active workspace, find account/Preferences controls, and handle a failure
without losing work. Retain the confirmed home-screen direction: sparse user
shortcuts, default Files links per advertised storage root, blue/square/panel
visual language and Workbench-only app navigation. Workspace creation/switching
belongs in Workbench Preferences under the existing direction; distinguish the
future multiple-workspace design from the currently implemented single workspace.

Discuss phone-first target layouts and concrete flows, then desktop adaptations.
Identify secondary workspace operations separately from technical diagnostics.
Needed save/sync, unsaved changes, failed launches, permission decisions and
conflict recovery must remain understandable and reachable in ordinary use;
putting raw broker state/technical detail in diagnostics must not hide these.
A diagnostic panel is a candidate design surface, not an already agreed feature.

The design should identify the eventual target UI and a first coherent delivery
slice, with current supported behavior versus dependencies made explicit. No
automatic sync, multi-workspace/onboarding implementation, source refactor,
control deletion or new diagnostic panel is authorized by this clarification.
No new cycle, commit, merge or push is selected. Retain the existing 1317-byte
Workbench headroom, offline/recovery, keyboard/assistive-technology and phone
constraints when evaluating the eventual proposal.

## Earlier readability-first recommendation (superseded)

## Reassessment after CYC92 integration, 2026-11-08

Disposition: **Analyze/Plan; no next cycle selected.** CYC92 is Accepted and
merged/pushed as 576a3780035e1f7226303bca529508c00045e834. main and origin/main
match. The unrelated untracked design copy remains untouched.

**Recommend meaningful customization and readability**, beginning with
Workbench status decisions and built-in feature configuration. This continues
the moldability review's next item after action dispatch, feature-owned styles
and the bounded lifecycle-events experiment. It deliberately defers broker
Phase 2 again, without changing its phase order. Stage-two documents/signing
and collaboration remain later. CYC92 does not require widening the new package
or promoting it into SimplyFlow before it sees ordinary use.

Read-only evidence on current main: workspaceControls.renderWorkspace still
contains nested decisions for Needs attention/Connected/Restoring/Opening/Saved.
createWorkspace mixes the built-in Profile/Files provider defaults with broker
construction and persistence wiring. Those decisions are exposed only inside
larger actions. Source inspection establishes an opportunity to make particular
edits easier to locate, not that non-professional users have tried and failed.

Proposed outcome: a person can locate, understand, change and restore a workspace
status label/condition and an existing built-in feature default without learning
broker or persistence internals. Choose concrete edits during design and expose
only the app-owned choices they require, with descriptive names and ordinary
control flow. Keep native RDF, conditional saves, provider authorization and
original behavior intact. This does not add a preferred-provider registry,
change trust policy or build the IDE. Do not grow the scope into an arbitrary
suite-wide cleanup or demand a new feature-structure pilot.

Evaluate actual edit -> observe -> restore in existing instances with retained
working data. Automated source reconstruction and behavior checks are useful;
human review of finding/understanding the changes is needed to support the
readability outcome. Existing phone/keyboard/offline recovery remains the
baseline. Download is tight: readable Workbench has only 1317 gzip bytes below
the 200000-byte ceiling. Favor clearer arrangement of existing behavior; measure
actual graphs rather than assume a refactor is free. Run required checks and
browser suites after implementation.

The strongest visible-feature alternative is **shared Preferences propagation**:
apply saved common settings in other open tabs/windows and embedded dialogs,
retaining dirty choices and recovering after reconnection. Settle account and
preferences identity plus same-/cross-origin reach before implementation; the
events package is a connection mechanism, not a synchronization design.
Account/local-data ownership and logout remain prerequisites to resolve before
multi-account/named-workspace/background-sync expansion. No new wrong-account
failure is claimed. The known workspace timing concern remains unresolved.

This is a recommendation, not a confirmed cycle, implementation authorization
or request to commit/merge/push this documentation update.

## Previous disposition at CYC92 acceptance

Current disposition: **CYC92 is Accepted** (ACC99). The maintainer requests
commit, normal direct main merge and push. Implementation/evidence are
08c7eaf78c109dadccb31a1f9d1364ae7a070003 and
8988e5f753461c23fb9bfdc8062d2dd672057a04. Earlier selection/pending statements
below remain history. No next cycle or package publication is selected.

## Selection and evaluation before acceptance

Current selection, 2026-11-08: the maintainer agrees to lifecycle ownership and
explicitly requests design and discussion before implementation, within the same
cycle. CYC-20261108-QG24H-92 is Active on its matching branch; SRC93 retains the
instruction and DES94 is a draft for discussion. No product changes, external
library work, release, commit or integration are authorized by the design phase.
Earlier no-cycle-selected statements below describe the preceding assessment.

CYC92 evaluation update: implementation was subsequently authorized by “Ok, lets
try this design” (SRC96), including custom EventTarget/subscription sources.
IMP97/EVD98 are ready for human evaluation with final passing checks and all five
browser suites. The cycle remains Active; no next cycle is selected.

## Reassessment after feature-owned styles, 2026-11-08

Disposition: **Analyze/Plan; no next cycle selected.** CYC87 is Accepted and
merged. Current main also contains the documents/versioning and signing design
additions. Those additions explicitly belong to stage two; they do not change
the current stage or select an implementation priority. The unrelated untracked
design/Moldable-Solid-Apps(3).md remains untouched.

**Recommend continuing stage-one moldability with lifecycle binding ownership.**
This follows the review/roadmap order after accepted current-action dispatch
(CYC82) and feature-owned styles (CYC87). It deliberately defers broker Phase 2
progression again; it does not revise the broker phase order. Shared Preferences
propagation remains the strongest immediate user-facing alternative.

### Current behavior and evidenced gap

Read-only inspection finds Workbench lifecycle still registers/removes
beforeunload and pagehide listeners, and shared account lifecycle registers/
removes storage and conditional hashchange listeners. Their forwarding callbacks
already resolve current actions at invocation. Cleanup is present. Therefore
the remaining gap is library ownership of registration/cleanup, not a reproduced
stale-action or duplicate-delivery defect.

Installed simplyflow-app 0.10.3 supports DOM behaviors whose setup returns a
cleanup function, invoked on removal/destruction. Its inspected constructor and
behavior implementation do not provide declarative window-event-to-action
bindings. Moving addEventListener into an app-defined behavior alone would not
establish the roadmap's lower-library registration boundary. Latest published
support and the appropriate API still need checking when this work is selected;
no new release requirement is asserted from this local inspection alone.

### Proposed goal and boundary

Components declare lifecycle events and handling actions; the appropriate
library owns registration and disposal, existing bindings invoke the current
effective action, and destruction leaves no listeners behind. Start with the
Workbench/account events above and inventory shared dialog/capability bridges
before settling the migration boundary. Preserve origin/source validation,
native dialog lifecycle and transport ownership rather than treating every
listener as equivalent UI binding.

First resolve whether supported published APIs meet that contract. If a library
extension/release is needed, agree its repository/release scope before doing
external work; this assessment does not authorize it. Do not add a generic
app-owned event framework to bypass that choice. This cycle would exclude the
IDE, persistence of overrides, live templates, account/logout policy changes,
Preferences propagation and unrelated workspace timing repairs.

Verify one delivery per event, action replacement/restoration in an existing
instance, conditional registration, isolation between instances and cleanup,
plus retained drafts, native RDF and close/checkpoint behavior. Retain the known
intermittent workspace-readiness concern from EVD90 as unresolved evidence.
Run required checks/browser suites for implementation. Existing phone/keyboard
tasks and offline recovery remain the guardrail baseline; no new app/data task
is introduced. Measure actual complete graphs and cold-task costs: EVD90 leaves
readable Workbench only 2997 gzip bytes below the 200000-byte ceiling.

### Alternatives and dependencies

- **Shared Preferences propagation:** saved common settings reach other open
  apps/dialogs, retaining dirty choices and recovering after reconnection.
  Current save applies preferences and invokes the local onChange callback;
  broader notification/identity scope remains to design. Settle same-/cross-origin
  support and account/preferences identity before promising all-open-app updates.
- **Account/local-data ownership and logout:** remains the correctness priority
  before named workspaces, multiple-account use or automatic sync. No new
  wrong-account write/disclosure is established by this assessment.
- **Forms/readability or provider registry:** remain valid stage-one directions.
  Lifecycle ownership is next in the agreed moldability sequence; the general
  preferred-provider registry remains incomplete broker Phase 2 work.

This planning update changes no product behavior, cycle status or branch and
authorizes no commit, integration, publication or external repository edits.

## Previous disposition at CYC87 acceptance

Current disposition: **CYC-20261107-QG24H-87 is Accepted** (ACC91).
The maintainer requests commit, normal direct main merge and push. IMP89/EVD90
retain exact implementation/verification. The explicit style-ID clarification
supersedes the initial library-scope question; no new API or external library
work is needed. The earlier workspace fixture timeout remains recorded despite
final passing checks. No next cycle is selected. Earlier planning below remains
historical and is not a new implementation authorization.

The initial investigation found that the coarse 744-line sheet already lived
in suiteAppearance as well as apps.css. The gap was per-feature ownership and
coordinating source with installed CSS, not absence of named source. JS budgets
already included the coarse CSS. The migration partitions that source, removes
the duplicate external delivery and tests in-place visual editing/restoration
through existing style IDs. Earlier pending/API-first language below is historical
and superseded by the maintainer's explicit clarification.

## Recommendation after current-action cycle acceptance

**Proposed next goal: make app-owned visual styles discoverable in named feature
datasets, with genuinely shared styling in named shared components, preserving
the current interface.** This continues stage-one moldability and the review's
next item after design clarification/action dispatch, while deliberately deferring
further broker progression. It adds no app task or offline data dependency.

The current shared solid-app-ui stylesheet is still 744 lines, mixes Contacts,
Profile, Workbench and common rules, and is copied directly into apps.css by the
build. Existing design components already expose named styles. Thus behavior is
now reachable through current-action connections while a feature's appearance
still requires finding a separate shared file. Do not repeat the already proven
feature-structure pilot; migrate coherent ownership across the suite once the
remaining API/cascade constraints are settled.

Start by inspecting the supported SimplyFlow style application/removal contract
and representative existing-instance visual override behavior. Its installed app
source installs styles at construction; that alone does not establish live style
replacement/removal. Do not promise a full runtime styling engine or add app-owned
content rendering. If a required runtime operation needs a new lower-library API,
resolve that scope/release dependency with the maintainer rather than silently
build a second runtime. Runtime template/include composition and the IDE remain
separate future work.

Partition shared foundation/feature rules, retain authored CSS source in the
named entries, preserve cascade/order and remove migrated duplicate delivery.
Check phone/desktop layout, keyboard/focus, dialogs and embedded/reused components,
plus unknown RDF/draft regression flows. Do not combine the ownership migration
with a new form design or a mass prefix rename. Short swb names apply to new
entries; broad existing-prefix changes remain separately planned.

Download is a concrete constraint: EVD85 reports readable Workbench 196147 gzip
bytes, about 3.8 KB under the enforced 200000-byte ceiling. The standalone shared
CSS is 15033 bytes / 3442 gzip bytes in a disposable measurement; that is not a
prediction of incremental JS compression. Check actual bundle/first-use costs
before committing to a delivery strategy. Split by real feature usage, avoid
copying the same CSS into both the script graph and apps.css, and retain the
complete-graph ceiling rather than hide cost behind lazy loading.

The strongest alternative is **automatic shared Preferences updates** after the
accepted reliable save path. First settle same-/cross-origin app scope,
account/preferences identity, reconnection and retained dirty form choices.
**Account/local-data ownership and logout** remains the correctness priority
before multiple workspaces, multi-account operation or background sync. Forms/UI
work and preferred-provider registry remain valid roadmap alternatives; stage-two
virtual-company collaboration stays later. No new goal, branch or implementation
is authorized by this recommendation.

## Reassessment after CYC77 acceptance and moldability review

Status at recommendation: **Analyze/Plan**; subsequently selected as CYC82 by
the maintainer's "agreed". Main at selection is
473dda5ee37811ec232db575009f55c3f5799819. CYC77 is Accepted and merged/pushed;
ACC81 records the maintainer's repeated-save and toast confirmation. Preserve the
pending shared-Preferences roadmap addition, supplied review and unrelated
untracked Moldable-Solid-Apps(3).md. No implementation or commit is authorized
by this planning request.

### Roadmap position and candidate comparison

Shared UI/capability presentation, refresh-first session recovery, Workbench
naming and repeated Preferences saving are accepted. Editable source datasets
exist; complete runtime replacement remains future work. Stage one still includes
app/form UI, account/logout boundaries, workspaces, offline/automatic sync, PWA
and broker progression. Built-in embedded providers do not complete the durable
preferred-provider registry or recipient-picker milestones. The virtual-company
stage remains later.

| Candidate | Outcome and rationale | Boundary |
| --- | --- | --- |
| Dependable action replacement (recommended) | Existing widget, host and callback callers use the current named action; removing an override restores the original without recreating the app. Addresses a reproduced gap central to the ultimate moldable-app goal. | Reconcile the relevant design contract first; no full IDE or general live-template engine. |
| Automatic shared Preferences updates | Saved settings reach other open apps without reload, retaining drafts and recovering after reconnection. Strong immediate user-facing alternative. | Settle account/preferences identity, dirty forms and same-/cross-origin scope; storage events alone do not establish all-open-apps support. |
| Account/local-data ownership and logout | Characterize account changes and implement the intended workspace/child logout boundaries without mixing recoverable data. | Strongest correctness alternative before workspace switching, multiple-account use or automatic sync. Shared collection keys and origin-wide logout coupling are visible; no wrong-account write/disclosure is claimed. |
| Forms and app UI | Establish consistent fields/help/validation/actions and improve a concrete task flow. | Resolve style/feature ownership before expanding shared UI; preserve accessible recovery and native RDF. |
| Provider registry or named workspaces | Advance broker replaceability or workspace selection/switching. | Valid governing roadmap work, but adds lifecycle/state paths while account boundaries and runtime wiring remain unresolved. |

### Recommended goal and evidence

**Make existing callers across the suite follow effective action replacements,
and restore original behavior when an override is removed, without losing working
state.** This continues stage-one moldable readiness and deliberately defers broker
progression for one cycle. It does not turn the supplied review into a governing
specification automatically or add a pilot gate for the poef feature structure.

On current main, profileView and preferencesDialog return captured actions; the
shell copies actions onto host methods; workspace/lifecycle wiring captures
callbacks. A fresh disposable Node probe using the installed SimplyFlow action
proxy reports a direct call returning `replacement` while a previously captured
widget still returns `original`. This confirms the review's narrow capture gap,
not full browser behavior or every callback. exposeDefinition explicitly supplies
metadata rather than applying changes; the cycle must distinguish editing
metadata, applying an effective definition, and restoring its underlying original.

Proposed scope:

- Reconcile the relevant repository design with the supplied review/design
  direction: personal overrides applied last, inspectable originals and action
  application/removal. Retain project guardrails and accepted build-time template
  composition. Record IDE/app undo separation, template notifications, marketplace
  separation and upstream-version concerns at their future scope.
- Inspect the supported SimplyFlow APIs and select the smallest correct dispatch
  mechanism for existing widgets, host methods, registered callbacks and event
  dispatch across all apps/shared packages. Avoid a parallel runtime or editing
  dependency internals. Prefer published library support; any narrow bridge needs
  its concrete missing contract documented.
- Evaluate replace -> invoke -> remove -> invoke in already-running browser
  instances, with current context, return values, async failures, retained drafts,
  native RDF, auth/conditional saves and cleanup. Preserve source reconstruction,
  phone/keyboard workflows, offline behavior and complete download budgets.

End at the coherent behavior-dispatch contract across existing callers. CSS
ownership migration, moving event registration into lower libraries, automatic
model reevaluation after rule replacement, live templates, persistent overrides
and IDE UI remain later work unless a concrete dependency makes part necessary.
Dispatch through an existing listener does not complete listener ownership.

If safe application/removal requires an unavailable library API/release, return
to the maintainer to scope that dependency rather than silently build a second
component runtime. Preserve supported behavior already meeting the contract.
For a visible end-user cycle instead, recommend shared Preferences propagation
with its identity/draft/cross-origin boundary settled first. No cycle is opened
until the maintainer confirms or revises the goal.

## Candidates after CYC49 acceptance, 2026-11-07

The comparison below preceded selection. The maintainer subsequently selected
session renewal/recovery and confirmed the refresh-first design (SRC68/DES69).
Accepted main at cycle creation is 38e3b7; ACC72 subsequently accepts CYC67.
The pending roadmap addition explicitly retains individual app and Preferences
UI work after the shared foundation. Preserve that addition; it does not select
an implementation goal. CYC49's acceptance and final evidence are ACC66/EVD65.

### Candidate comparison

| Candidate | Useful cycle outcome | Evidence and boundary |
| --- | --- | --- |
| Session renewal and recovery (recommended) | Reuse valid authorization, obtain refresh authorization with consent, renew silently where possible, and provide contextual reauthorization preserving drafts/pending saves. | Live expired-token/no-refresh case reproduced in Firefox; reconnect worked (EVD57). Installed Metro scope/consent integration gaps remain. May require an upstream published library fix. Hidden-iframe silent authorization is optional and provider/browser dependent. |
| Preferences UI | Improve common/app-specific setting grouping, labels, explanations and save/recovery flows on phones and desktop. | Explicit new roadmap requirement; shared dialog motion does not complete the design of settings inside it. Keep native RDF partial-write preservation. |
| One app's task UI | Select Launcher, Contacts, Files or Profile and improve its actual workflows, layout, toolbar/forms and feedback. | Explicit remaining app-by-app UI work. Choose concrete screens/flows before implementation; no new evidence says every control should be removed. |
| Account ownership and logout | Characterize and correct account/local-data boundaries and the requested distinct Launcher/child logout lifecycle. | Shared remembered WebID/logout listener and local collection concerns remain; no wrong-account write has been reproduced. Strong correctness work before automatic sync. |
| Preferred capability-provider registry | Persist provider choice through linked Solid preferences and resolve/start the selected provider. | Governing broker Phase 2 remains incomplete. CYC49's scoped built-in providers do not implement a Pod-backed registry. Preserve provider authority and native RDF; recipient selection remains separate. |
| Named workspaces | Create/select/switch distinct workspaces and restore each app set and pending state without mixing contents. | Roadmap explicitly requests it; current accepted persistence checkpoints one default workspace. Requires deliberate switching/save/recovery design. |

### Recommendation and ordering rationale

Recommend session renewal/recovery because it addresses a directly observed
ordinary-use failure that affects every app and the newly accepted capability
presentation. Keep the goal focused on renewable authorization and recoverable
interaction; do not assume an ID token proves usable resource access, promise
that requesting a refresh scope guarantees issuance, or transfer credentials
through capability messages. Existing anonymous access and authority checks stay.

For a product-design cycle instead, Preferences or one selected app is a coherent
next scope. Account/lifecycle correctness is the stronger preventative alternative;
resolve relevant ownership/recovery questions before automatic sync/PWA rollout.
The provider registry is the next broker-focused alternative, rather than treating
UI-cycle embedding as completion of the broker roadmap. Stage-two virtual-company
collaboration remains after current suite work. Runtime composition/live IDE and
new app integration remain separately planned; this assessment does not select
or pre-accept any of them.

## Reassessment after CYC37 acceptance, 2026-11-07

Status: **Discussing the next cycle; no cycle selected or opened.** Current
main is 7fabcc1, with a clean working tree before this planning update. Two
requested documentation commits are local and not yet pushed. CYC37 is Accepted
and merged; ACC48 records acceptance. The earlier assessment below describes the
pre-refactor baseline and is historical, not the current implementation state.

### Roadmap reconciliation

The suite now exposes named component datasets, per-feature files, explicit
contexts and retained authored sources. Lists use models/jaqt where useful.
Preferences separation and size-budget builds were already accepted. Runtime
template composition, a live moldable IDE and override reapplication remain
future work; the maintainer explicitly accepts build-time composition for now.
Readable code for people without professional programming experience is now a
current engineering requirement.

Stage one still includes MVP UI, account consistency/lifecycle, named workspaces,
offline/automatic sync, PWA and the remaining broker/capability work. Stage two's
virtual company, including live shared-data/view updates between participants,
is explicitly later. Do not advance that stage merely because it was the latest
roadmap addition.

Broker Phase 2 remains incomplete: the existing built-in Files cold-start path
is not a Pod-backed preferred-provider registry. Recipient selection and provider
replaceability remain Phase 3 work. Choosing MVP UI would **continue the suite
roadmap and deliberately defer further broker progression for one cycle**.
The proposed cycle does not reorder the broker's phases.

### Evidence and candidate comparison

- **MVP UI (recommended):** Launcher navigation still presents permanent built-in
  app cards. shortcuts.html keeps the entire add form, URL launch mode and
  anonymous settings on the home screen and settings beside every shortcut.
  workspace.html exposes restore/save/close controls and detailed conflict
  review. These are concrete candidates for clearer task-based presentation,
  not evidence that all controls are disposable. Contacts already has a compact
  search/action toolbar and new-contact dialog; preserve and reuse that useful
  structure. Shared account.html already uses native popover/dialog markup with
  the-ds classes; reuse the installed design system rather than replace it.
- **Account ownership/lifecycle:** the preceding risk assessment retains shared
  local collection storage and same-origin remembered-account/logout coupling.
  They need targeted two-account and child-logout characterization before any
  automatic synchronization rollout. No disclosure or wrong-account write has
  been reproduced here. This is the strongest correctness-focused alternative,
  particularly before relying on multiple real accounts.
- **Provider registry:** continue broker Phase 2 with persistent provider choice
  and cold start. This advances ecosystem replaceability but does not address
  the currently crowded ordinary-user interface.

### Proposed goal and review boundary

Make the four existing apps a coherent MVP interface, closer to poef/solid-apps,
with ordinary tasks prominent, shared dialogs/dropdowns and fewer permanent
technical controls. Apply the adopted Muze culture and readability requirement;
keep each app-owned component explicit and understandable in the moldable IDE.
The Laws of UX resource was read during roadmap formation and reviewed for this
assessment; use relevant principles against actual interactions, not as a
substitute for user evaluation. The poef reference is already established;
there is no separate pilot or proof gate for its visible pattern.

Scope: review each visible control against current workflows; remove genuine
fixture/demo controls and move less-frequent settings into appropriate dialogs
or menus. Use a dialog for adding/editing shortcuts and suitable workspace
controls for session operations. Reuse common dialog/menu composition across
Launcher, Contacts, Files and Profile through existing SimplyFlow/the-ds APIs.
Preserve app-owned toolbars, Launcher-only app navigation, inline Contacts
profiles and the existing blue/square/panel visual language. Review concrete
layouts before implementing consequential control removals.

Risk boundary: explicit sync/save and recoverable error/conflict actions remain
necessary until automatic sync exists. Simplifying their presentation must not
silently remove them, relax provider permissions or discard drafts. Account
ownership, logout policy and Pod persistence semantics are separate behavior
changes and are not implicitly authorized by UI cleanup. Named workspaces,
provider registry, automatic sync/PWA, a live IDE/runtime composition and stage
two stay outside this proposed cycle. Files-only dashboard seeding across all
storage roots and the account-to-Profile shortcut need explicit inclusion if
they are wanted in addition to the existing-workflow UI scope.

Evaluation: inspect the integrated four-app interface at mobile/desktop sizes,
exercise dialogs/menus with keyboard and verify focus return, and check existing
create/edit/save/sync/picker/cancel/recovery flows. Keep native RDF and drafts,
source inspectability and the 200000 B gzip budget. Run npm run check and all
three Chrome suites. Present the result for human acceptance.

This is a proposal for discussion. The repository's Spiral workflow requires an
agreed cycle goal and a matching dedicated branch before implementation.
No product code or cycle status changes are made by this assessment.

## Historical assessment before CYC37

Current disposition: the maintainer subsequently authorizes applying the
established pattern across the whole suite, without a separate proof/pilot gate.
CYC-20261107-QG24H-37 is Active and SRC-20261107-QG24H-38 retains that commitment.
Earlier proposed gates below are historical planning, superseded by that direction.

Date: 2026-11-07. Inspected baseline: main at
`45cf58e4fedbfdeea3ccfad4ee2e647bbea48d48`. The working tree was clean.
Status: **Refactor direction selected; concrete scope awaiting confirmation**.
The maintainer redirected the Contacts pilot toward consistent stack usage,
then supplied poef/solid-apps as a reference and clarified that jaqt should be
combined with SimplyFlow models when it simplifies the code. They subsequently
requested investigating inclusion of the moldable app-authoring structure.
The [feasibility investigation](moldability-refactor-investigation.md) recommends
including it, with an early real-feature proof and explicit runtime gaps.
This supersedes the earlier Contacts-only recommendation and the subsequent
proposal to defer all moldability structure. This planning note does not
open a cycle, authorize product implementation or record human acceptance.

## Current roadmap position

The [broker roadmap](../design/solid-capability-broker-roadmap.md) governs broker
work; the [suite roadmap](../design/solid-apps-roadmap.md) adds independent product
direction without a delivery order. Reconciled with current main:

- Launch context and the revised Phase 1 browser-local broker/picker are merged.
  Built-in Files starts on demand, but this is only a bounded part of Phase 2.
- Phase 0's full exit is not established: browse has a concrete contract;
  select-recipient and the durable provider description/registry remain open.
- Phase 2 still lacks a Pod-backed preferred-provider registry. The current
  picker selects one allowed instance or falls back to built-in Files. Multiple
  eligible instances fail explicitly rather than establish a preference.
- Phase 3's recipient picker and independent-provider/client replaceability
  demonstration remain future work.
- Preferences CYC33 and shared/minified bundles CYC34 are Accepted and merged.
  The common/app split is implemented. The size budget has substantial headroom.
- Moldable features, named workspaces/dashboard, account consistency, reduced
  authentication challenges, full offline/automatic sync, PWA, catalogs, Zett
  and Notebook remain future work. No order among these is human-confirmed.

## Candidate risks and evidence limits

These are planning findings, not a claim of a comprehensive security audit or
maintainer-approved priorities. Apply the adopted regression, usability/recovery
and RDF/privacy/authority lenses. WPF-HUMAN-001's evidence and composition signals
matter here: green fixture tests do not establish live authentication or the
absence of intermittent failures.

| Concern | Evidence and consequence | Useful disposition |
| --- | --- | --- |
| Moldability depends on an unproven runtime contract | Contacts' `render()` manually filters/sorts and commands close over private state. Installed simplyflow-app 0.10.3 installs templates/styles without retaining those source sections, skips component start hooks, and merges component/app options. Source retention, override removal and repeatable lifecycle cannot be assumed from initial composition. Converting all apps before checking this could spread incompatible wiring. | Prove one real feature with reconstruction, overrides and reuse before broad conversion. These source observations establish a gap, not proof that all supported solutions are impossible. |
| Account changes share local collections | `openCollection()` uses IndexedDB `solid-apps` and a collection-name key, without WebID partitioning. README explicitly documents shared Contacts/shortcut stores. This risks presenting another account's local records or attaching them to a different Pod during explicit sync. No accidental disclosure or wrong-account write was reproduced here. | Characterize two-account connect/sync/reload before broader multi-account use; confirm the intended ownership/recovery policy before changing it. |
| Child logout conflicts with the requested workspace boundary | Shared shell logout removes the origin-wide remembered WebID; its storage listener logs out and reloads other same-origin apps. The browser suite explicitly expects Contacts logout to disconnect Launcher. The roadmap instead requests that child logout leave Launcher/siblings/workspace open. Managed-child lifecycle consequences and cross-origin behavior need a targeted probe. | A separate workspace/account lifecycle cycle is a credible alternative; retain local drafts and define checkpoint/auth ordering. Do not claim the requested boundary is already satisfied. |
| Workspace recovery has intermittent failure evidence | EVD30 and CYC34 retain readiness/conflict-review timeouts. Later passes do not identify their cause. Extra named-workspace or automatic-sync transitions could make diagnosis harder. | Preserve the failure evidence; add targeted timing/diagnostic investigation when changing these paths. A fresh pass alone cannot close this concern. |
| Provider choice and authority are not yet portable | `chooseFiles()` uses live/saved instance permissions and a built-in Files fallback; there is no linked preferred-provider registry. Future manifests/catalog entries must not silently grant invocation or Pod authority. | Continue broker Phase 2 with explicit user choice, native RDF preservation, validated launch mapping and blocked-popup/cancellation handling. Catalog listing stays separate. |
| Live-provider and offline guarantees are bounded | Chrome fixtures replace authentication. Earlier maintainer evidence establishes solidcommunity.net connection/sign-in, not every write/close/refresh/redirect flow. Contacts explicitly syncs; Files browses through its session. There is no demonstrated complete offline app shell or automatic app-data synchronization. | Investigate valid Metro authorization scope before optimizing 401s; define per-app offline/conflict workflows before adding background sync/PWA claims. |

Native RDF correction is implemented on main and covered by preservation tests.
Do not report the old JSON snapshot implementation as current merely because
DEF18's companion status still says Active. Some context/evidence documents also
retain historical pending-status prose; current acceptance records and Git
ancestry establish the merged cycle position. Documentation reconciliation is
separate from claiming a new product defect.

## Reference inspection

GitHub HEAD for `https://github.com/poef/solid-apps.git` was verified read-only
with `git ls-remote` as `0b38216edcb26c80bad38a18e9585f18199204c5`, matching
the local checkout at `/home/auke/git/poef/solid-apps`. GitHub web retrieval failed;
committed source was read with `git show HEAD:<path>`. That checkout has unrelated
uncommitted work, which was inspected separately as current local evidence and
was neither changed nor attributed to the published commit.

At that committed version:

- `src/contacts/index.mjs:27` constructs the model, then uses state effects with
  jaqt `select`, `orderBy`, `where` and `groupBy`; a Metro JSON API supplies data.
- `src/components/solid-contacts.mjs` groups named templates, styles and commands.
  Templates bind `contacts.view.current`; its filter command updates only
  `model.state.options.filterBy`.
- `src/contacts/www/index.html` explicitly wires the component views into panels.
- App actions, state, API and registered components are exposed together through
  `globalThis.contactsApp`.

These establish the intended composition pattern, not a requirement to copy old
API names or behavior. Current packages use `templates`, `styles`, `data` and
`start`, rather than the old `html`, `css`, `state` and `hooks.start`. Current
native-RDF preservation and storage/authorization contracts remain authoritative.
In particular, old derivations that mutate contact objects must become UI
projections rather than changes to authoritative native RDF.

## Proposed next cycle: stack consistency and moldable feature datasets

**Goal / Understanding:** Refactor the existing four apps and suite-owned shared
code to consistently use the adopted stack: SimplyFlow renders content and owns
transformed UI-list models; jaqt expresses object-array queries where it simplifies
the code, including inside model effects; configured Metro/data APIs own HTTP.
Include named feature datasets, explicit actions/data APIs, inspectable source,
originals and app overrides as specified for apps today in the moldable design.
Preserve current user workflows, drafts, native RDF and conditional writes.

**Current effective behavior / evidenced gaps:**

- Contacts uses a manual person/search/filter/sort pipeline in its view update
  helper. Files filters tombstoned entries before binding them. Launcher filters
  shortcut types in its update helper. The shared profile view filters visible
  detail fields. These are candidates for model-owned projections.
- Picker/provider routing and workspace code use additional app-owned object
  queries. Review these for direct jaqt use, independently of UI-list models.
  Prefer supported RDF graph APIs for RDF operations; using jaqt must not flatten
  graphs or change preservation/identity semantics.
- The inspected runtime apps/packages contain no app-owned `fetch` or
  XMLHttpRequest path and no manual HTML/text content writes. Profile anonymous
  reads already use `createSolidMetroClient`; Files passes `session.client` into
  SolidAdapter and downloads through that client. The temporary download anchor
  is the authorized native-operation exception. Do not invent renderer/HTTP
  rewrites where the current composition already satisfies the rule.
- jaqt 0.10.7 is installed transitively. Declare a published direct dependency
  in packages that start importing it rather than relying on hoisting.

**SimplyFlow/jaqt compatibility probe:** A disposable Node probe verified that
jaqt `where().orderBy().toArray()` preserves frozen input order and row identity,
and queries inside model effects react to search-option changes. An initial
probe falsified the assumption that replacing `model.state.data` automatically
updates the constructor's captured first input. A public `addEffect` source
effect reading `this.state.data` before downstream query effects supports source
replacement and insertion as well. The corrected probe passed all those checks.
This is integration evidence, not permission to modify library internals or a
claim of browser rendering coverage.

**Why now:** The maintainer selected refactoring before further feature work.
It removes parallel list/query logic and establishes how the stack is composed
before extending the apps. Their subsequent moldability investigation request
shows why doing component/behavior boundaries together avoids extracting the same
features twice. Source reconstruction and override behavior are app-readiness
criteria; implementation of the future IDE remains excluded.

**Plan continuity:** **Deliberate deviation** from broker progression for one
refactor cycle, continuing the suite's adopted library/model/rendering rules.
Broker phase order is unchanged.

**Likely work:** Audit the four apps and shared packages against the rules;
replace manual transformed-list pipelines with supported SimplyFlow model
effects/options; use jaqt within effects or other object-array queries where
clearer; keep command input/native UI handling separate from reusable actions
and data APIs where the touched behavior requires it. Preserve build-time HTML
composition and existing visual language. Package app-owned features and shared
UI as named datasets; derive runtime template/style entries from the same source
files; retain portable behavior source and explicit dependencies. First prove
the intended structure with real Contacts list/search/selection and its reuse,
then apply the verified pattern across the suite. See the investigation for
per-app coverage and observed library limitations. Do not mechanically replace
primitive array operations, independent test assertions or library internals.

**Evaluation basis:** Existing search/sort/selection, shortcut, profile, picker,
workspace and Preferences behavior remains observable and preserved. Verify model
option changes, source replacement/insertion, empty results, stable identities,
selection and draft retention, initialization/cleanup, and no mutation of native
RDF by projections. Exercise affected data actions without DOM dependencies and
preserve failure/conditional-write/unknown-RDF contracts. Run `npm run check`,
`npm run test:browser`, full bundle budgets/ownership checks, and applicable
Spiral validation on the dedicated branch. Also verify named source reconstruction
in minified/readable builds, originals/overrides and their removal/reapplication,
second-host reuse and complete source retention, as detailed in the investigation.
Do not claim full IDE readiness while any required app-authoring check fails.
Maintainer evaluation remains separate
from test results. A code scan complements behavioral checks; it is not a proof
that the effective system has no indirect HTTP or rendering violations.

**Non-goals:** IDE facilities (editor, persisted edits, preview isolation,
import/export management, inspect-mode UI and safe-reload controls), new rendering/query frameworks,
new app features, provider registry, recipient picker, account-store partitioning,
logout-policy changes, named workspaces, catalogs, automatic sync/PWA, Zett and
Notebook. Build work is limited to dependencies, single-source runtime datasets
and source retention necessary for this refactor; no new bundler redesign.

**Pause/replan:** Return to the maintainer if a required contract cannot be met
through supported APIs and a narrow app bridge, or if a change would alter storage,
authorization, RDF semantics or user-visible product policy. Record concrete
library gaps, especially source retention, component initialization and live
override/mounted-template replacement. If those require upstream work, replan
before repeating an unsupported structure across the suite. Other repositories
and publication remain outside this work.

**Cycle sizing:** Consistent stack composition across the existing suite is the
selected coherent maintenance outcome; moldable feature structure extends that
proposal in response to the maintainer's latest investigation request. Work in
small verified steps internally;
do not add separate feature goals merely because adjacent gaps are found.

After maintainer confirmation, allocate a CYC identity with the Spiral CLI,
create its matching dedicated branch from accepted main, verify the actual
branch, and record commitment/scope before implementation. No ID or human
approval is invented by this note.

## Fresh baseline verification

- `npm run check`: passed all eleven test files and the four-app build.
- Minified complete app graphs including callback: Launcher 95486 B, Contacts
  86278 B, Files 87733 B, Profile 86214 B; each below 200000 B.
- `npm run test:browser`: passed all three Chrome suites (general apps, managed
  workspace and cross-origin picker) against production minified entries.
  The initial sandboxed attempt could not listen on localhost (`EPERM`); the
  authorized rerun outside that restriction completed successfully. This was an
  environment failure, not evidence of a product defect. The fresh pass does not
  establish a cause or fix for the previously retained intermittent failures.
- `git diff --check`: passed again after the reference-inspection update.
  Changes remain documentation-only: this note and the clarified
  jaqt/model policy in root AGENTS.md.

Checks use repository fixtures and do not access the maintainer's Pod. No product
source, dependency or build configuration is changed by this assessment.


## CYC92 design clarification: separate event package, 2026-11-08

The maintainer selects an events section supported by a separate experimental
package injected into Workbench's SimplyFlow composition. Integrating it into
SimplyFlow core is deferred until it proves useful. SRC95 retains the decision;
DES94 now proposes a private workspace package with explicit installation and
package-owned activation/disposal. This supersedes the upstream-first design
option. API details remain in discussion; no implementation, publication or
external repository changes have started.
