# Solid Workbench library boundaries and simplification review

Review date: 15 November 2026  
Status: investigation and recommendations; high-priority roadmap follow-up  
Repository: `muze-labs/solid-workbench`

## Scope and evidence

The maintainer requested a rereading of *Programming for Wizards* and an
assessment of opportunities for new boundaries or simplification through
libraries. They subsequently requested this review and high roadmap priority.
That prioritizes the work; it does not approve every proposed extraction or
select an implementation cycle.

The review examined the working tree on
`spiral/CYC-20261114-QG24H-205-notebook-collections`, based on
`c200cb7bdd1209bbb0027e3ca6bfc7e0c60b437c`, including its uncommitted collection
implementation. Findings about those files describe the reviewed working tree,
not that baseline commit. CYC205 remains awaiting human acceptance.

The local book manuscript was read at revision
`0a517b3265caaf413fd8a38655d51514b9cffb14`. Particularly relevant chapters are
[growing queries](https://github.com/poef/programming-for-wizards/blob/0a517b3265caaf413fd8a38655d51514b9cffb14/content/chapters/10-code-exhibit-growing-queries-inside-javascript.md),
[the knitted castle](https://github.com/poef/programming-for-wizards/blob/0a517b3265caaf413fd8a38655d51514b9cffb14/content/chapters/11-the-knitted-castle.md),
[data, behavior and time](https://github.com/poef/programming-for-wizards/blob/0a517b3265caaf413fd8a38655d51514b9cffb14/content/chapters/12-boundaries-data-behavior-and-time.md),
and chapters 13–16 on change, public boundaries, shared meaning and user-owned
data. The repository's [architecture philosophy](../../ARCHITECTURE-PHILOSOPHY.md)
and [moldable-app rules](../Moldable-Solid-Apps.md) govern their application here.

Evidence consists of source and installed-library API inspection, existing test
inspection, and two small in-memory RDF probes described below. No product code
changed, no extraction was implemented, and no full test suite or browser review
was run for this architectural assessment. Proposed savings and reuse remain
to be demonstrated.

## Assessment

There are useful library opportunities, especially around document recovery,
resumable resource operations and capability participation. Other complexity
belongs behind stronger contracts in existing libraries. Adding packages alone
would not simplify the system.

Apply four tests to each proposal:

- Does it give a coherent responsibility a useful name and owner?
- Which assumptions can callers stop carrying across the boundary?
- Can a second consumer use it without adopting the first app's policy?
- Can an implementation be replaced while preserving data, failure behavior
  and the user's ability to alter app-owned features?

Keep uncertain policy high in the stack. Ordinary JavaScript objects, functions
and explicit dependencies are sufficient unless a richer language earns its
cost. Keep SimplyFlow as the renderer and retain editable feature datasets.

## Findings

### 1. Document sessions: a shared owner of recovery and saving

[NotebookDocuments](../../apps/notebook/src/document.mjs) and
[DeckDocument](../../apps/presenter/src/deck-data.mjs) both coordinate local
persistence, remote addresses, validators, baselines, account ownership,
revision tracking and edits made while asynchronous operations are pending.
Their recovery policies and capabilities have already diverged: Notebook has
multiple recovery copies and pending-creation reconciliation, while Presenter
has a single current deck and different switching guards.

A document session could own one recovery copy and its relationship to a remote
resource. Its contract would make local durability, remote confirmation,
conflict, and an unconfirmed write distinct. Apps would supply their document
model and editing rules. Notebook would retain blocks and its document index;
Presenter would retain slides and its navigation policy.

Installed Solid Workspace 0.2.1 already supplies local sources, working graphs,
replica merging and write ordering. Its README explicitly excludes conditional
remote writes and cross-tab ordering. Workbench currently supplies conditional
document operations in [solid-app-data](../../packages/solid-app-data/src/index.mjs).
First investigate extending the existing source/write contract. A separate
document-session package is justified only for the cohesive responsibility
remaining above it; do not add a competing synchronization engine.

Prove the boundary with Notebook and Presenter. Preserve edits through reload,
authentication failure, conflicts, lost responses, missing validators, and edits
arriving during a save. Account and recovery-copy identity must remain explicit.
Moving code must not silently change either app's switching behavior.

### 2. Resumable resource operations: a distinct library candidate

[ResourceLifecycle](../../packages/solid-app-data/src/resource-lifecycle.mjs)
already owns durable operation intent, copy verification, conditional removal,
metadata completion, retry and cancellation. These are meaningful operations
whose ordering must survive reload and ambiguous network outcomes.

A reusable boundary would accept an authenticated client, journal storage and
resource addresses. It would return operation state and outcomes without knowing
about Notebook dialogs, current editors or collection membership. The current
journal includes collection and entry identifiers; decide whether those belong
in an app-owned association or a narrowly defined correlation field.

A separate bridge would apply a completed physical operation to collections and
local document references. The current integration is visible in
[Notebook's operation completion action](../../apps/notebook/src/collections.mjs).
Keep acknowledgement after the required app reconciliation succeeds.

Retain distinct meanings for removing membership, recording a tombstone and
permanently deleting bytes. Files currently uses tombstone-only deletion that
retains bytes; sharing a library must not silently change that promise. Reuse
Metro and the existing storage APIs rather than introducing transport or auth.
Verify interrupted copies, changed targets, lost delete replies, metadata
conflicts, RDF relocation and cancellation that retains existing copies.

### 3. Capability participation: a small SDK for independent apps

[PortConnection and ManagedApp](../../packages/solid-app-data/src/capabilities.mjs)
and [EmbeddedView](../../packages/solid-app-data/src/embedded-view.mjs) implement
requests, cancellation, readiness, restoration and guarded closure. Much of
this mechanism does not depend on Solid storage or RDF, despite living inside
`solid-app-data`.

A small capability SDK could let an independent app offer an editor or picker
without adopting Workbench's shell. Separate the public wire/lifecycle contract
from provider selection, account policy, launch conventions and UI. Do not move
the whole workspace broker into a supposedly generic transport package.

An independent host/provider fixture should prove the boundary. Preserve source
and origin checks, scoped authority, cancellation, exactly-once replies,
reconnection and the distinction between failed startup and a provider holding
unsaved edits. Follow the existing
[capability-broker roadmap](../solid-capability-broker-roadmap.md); a package
extraction does not itself establish a new public protocol version.

### 4. RDF preservation: strengthen OLDM and oldm-shape

[StateGraph](../../packages/solid-app-data/src/state-rdf.mjs) contains a Turtle
writer, typed-field access and graph comparison alongside Workbench-specific
rules. Collections additionally retain a full native graph while projecting
editable fields through Solid Workspace, then apply those fields back through
[a preservation bridge](../../packages/solid-app-data/src/document-collection-rdf.mjs).

Two probes establish remaining gaps:

| Probe | Observed result | Implication |
| --- | --- | --- |
| Parse and write `<#root> <urn:title> "Title". _:orphan <urn:note> "Keep me".` through OLDM | The named statement survives; the unattached blank-node statement disappears. Repeated with the separate writer fix and the same loss remains. | Cycle-safe writing alone does not establish complete native graph preservation. |
| Update a named subject through `oldm-shape.toOldm()` where it has both the shape's RDF type and an additional type | The additional type disappears; the unrelated predicate tested remains. | Mapping declared fields is not yet a sufficient contract for preservation-safe structured editing. |

The first probe used the installed Workbench RDF composition and the separate
uncommitted OLDM writer branch. The second used installed oldm-shape 0.4.0.
These are bounded reproductions, not a comprehensive parser or mapper audit.

Prefer improving native graph preservation, mapped updates and graph comparison
at their existing owners. Investigate whether a public raw-statement surface is
needed alongside the object projection. Do not simply publish StateGraph as a
second RDF stack. Keep Workbench's JSON-in-Turtle policy and workspace ordering
limits in the app composition.

Before removing workarounds, verify unknown predicates and types, multiple
values, unattached subjects, shared/cyclic blank nodes, literal identity and
relative IRI meaning. Refuse unsupported edits without changing the source.
At initial review the OLDM and Metro fixes were unpublished. The subsequent
2026-11-15 handoff installs oldm-turtle 0.4.4 and Metro/core 0.9.3 in Workbench.
The reachable-cycle writer fix and native binary-body support are verified;
standalone anonymous components still disappear on an OLDM write. The
preservation bridge therefore remains necessary. Metro binary-body conversions
are removed. The empty-folder dummy Turtle body remains: Node HTTP probes pass
without it, but the Chrome workflow still fails with a locked request stream.

### Follow-up verification, 2026-11-15

The maintainer considers unattached anonymous data a pattern to avoid. New
app-owned records should have stable named identities or be reachable from a
named owner; preservation of incoming foreign data remains a separate concern.

A fresh installed-package probe confirms that oldm-shape 0.4.0 `toOldm()` removes
an additional RDF type while updating a declared field; an unrelated predicate
survives. Solid Workspace 0.2.1 classifies errors with direct `error.status`
401, 403, 412 or 503 as offline, while equivalent `error.cause.status` values
produce auth-needed/error. These are bounded correctness/integration findings,
not claims that every Workbench path suffers data loss or misreports failures.
The SimplyFlow lifecycle/composition proposals remain API simplification work,
not a newly established rendering defect.

Metro's empty-body replay fix is prepared separately on `fix/empty-body-replay`.
The source issue affects requests and responses; `response.with()` also loses
retained body data. Regression coverage includes explicit overrides, bodyless
statuses and continued refusal to replay consumed streams. Workbench must keep
its empty-folder workaround until the fix is published and verified here.

### 5. Collection browsing and preference contributions: feature boundaries

[Notebook's collection component](../../apps/notebook/src/collections.mjs)
combines overview navigation, default creation, grouping, dialogs, file
selection, lifecycle handling and Notebook integration. A reusable SimplyFlow
collection-browser component could own the agreed overview experience and
accept document creation/opening actions from its host. Keep document-kind
policy and physical resource operations outside it.

Use a second app to establish the shared meaning before publishing a general
library. Preserve the [collection design](../solid-workbench-collections-design.md):
document links plus one New link, management in dialogs/toolbars, empty defaults
only when genuinely undefined, categories in list–details, and independent
native document resources. The portable format is also a reuse boundary:
another implementation should not need this UI package to understand the data.

[Preferences sections](../../apps/preferences/src/components/sections.mjs)
currently import specific apps and enumerate their contributions. Reverse that
dependency through the existing capabilities and SimplyFlow composition:
Preferences owns common settings and navigation; apps supply their own sections.
This is already [explicit roadmap direction](../solid-apps-roadmap.md#any-app-context-and-app-provided-sections).
Verify an independent app, an app with no contributions, unavailable/offline
contributions, and retained owner checks. Contribution loading/execution needs
an explicit contract; arbitrary app support does not imply arbitrary authority.

### 6. Selection toolbars: a small reusable interaction component

[Notebook block tools](../../apps/notebook/src/block-tools.mjs) and
[Viewer's Cobalt editor](../../apps/viewer/src/components/cobalt-editor.mjs)
separately coordinate selection, toolbar visibility, docking, focus restoration
and link editing. Geometry is already shared in
[solid-design](../../packages/solid-design/src/components/toolbar.mjs).

A selection-toolbar component could accept an editor adapter and command
definitions. Keep Notebook's cross-block selection and split/join behavior in
its controller integration. Keep templates, actions and supported overrides
available as SimplyFlow feature entries rather than hiding app behavior in an
opaque library. Verify mobile selection, keyboard activation, composition,
selection retention, viewport changes and formatting without editor recreation.

## Recommended sequence and completion evidence

1. Establish preservation-safe RDF contracts in the existing libraries, using
   the two probes and Workbench's preservation fixtures as starting evidence.
2. Prove a document-session boundary with Notebook and Presenter, extending
   Solid Workspace where the responsibility already belongs there.
3. Evaluate resource-operation and capability SDK extractions as distinct
   follow-ups with independent consumers and explicit failure contracts.
4. Reuse collection browsing and toolbar interactions as editable components;
   implement app-provided Preferences sections through the established roadmap.

This is the review's proposed sequence. High priority is maintainer-confirmed;
individual APIs, package names, releases and implementation cycles are not.
Preserve the active collection work while selecting the next coherent cycle.

For each selected boundary, record the assumptions and coordination removed
from callers, show two meaningful consumers or an independent integration,
and identify which responsibilities remain app-owned. Verify failure and data
preservation before removing the old bridge. Measure complete-app download
graphs and cold core-task cost; moving code into packages is not evidence of a
smaller download. UI changes also need phone, keyboard and assistive-technology
evaluation, with automated evidence distinguished from human review.

New shared packages remain experimental under `@muze-labs` until an explicit
publication-readiness review. No library addition should introduce a second
renderer, HTTP/auth stack, generic workflow engine or replacement RDF store.
