# Next cycle: predictable, feature-owned browser styling

Status: **Active as CYC-20261108-QG24H-112**, started 2026-11-08 after the
maintainer's “Please start this cycle” instruction. The original plan and
pre-execution handoff below are retained as planning history; implementation
and evaluation are recorded in IMP115/EVD116. No acceptance is inferred.

## Intent and current position

The maintainer requested a CSS review against the Browser Styling Guide for AI,
then instructed: “I'd like you to make a plan to tackle the css refactor and use
that for the next cycle.” This plan retains that instruction and the preceding
source review. It selects the next maintenance outcome, without treating the
proposed details below as human acceptance or permission to commit/integrate.

Goal: make suite-owned styling follow the
[Browser Styling Guide for AI](../design/Browser-Styling-Guide-for-AI.md), with
predictable layers, explicit component styling interfaces, flat selectors and
clear ownership, preserving the accepted workflows and visual language.

Baseline: main at `0ecae17` contains accepted CYC106 Preferences, following
CYC100 workspace foundation and CYC87 named style ownership. This **continues**
the suite roadmap's CSS review/refactor and moldability direction. It deliberately
defers broker progression for this maintenance cycle; provider registry,
recipient selection and Contacts multi-book work retain their existing order.
The older `.spiral/next-cycle-assessment.md` describes earlier cycle selections;
this document is the current CSS next-cycle plan.

My understanding is structural simplification with the existing interface
preserved. Effective source composition currently has these evidenced gaps:

- All 21 authored CSS files are unlayered, while installed The DS is layered.
  They total 24600 UTF-8 bytes and contain 107 `var(--ds-...)` reads. Those reads
  include legitimate integration responsibilities as well as component coupling;
  the number is an inventory, not a count of independent defects.
- Component implementations use DS tokens without separate adapters. Shared
  list/details styling reaches into `.app-content`, `.app-toolbar` and DS navbar
  internals; shared dialog styling modifies every `.ds-dialog`.
- Launcher styling reaches through the shared account/header structure. Shortcut
  focus ownership is split between shortcuts and background styles.
- Repeated `.account-name` rules override an earlier mobile width adjustment.
  Selectors also rely on generic class names, element names, command attributes
  and ancestor chains rather than explicit component parts.
- Files reserves a fixed 8rem for embedded picker actions, and profile editing
  fixes a textarea height. These need layout/zoom evidence before deciding the
  smallest correction; source inspection alone does not prove clipping.
- The build copies the complete DS stylesheet and embeds authored CSS as text
  in JavaScript for named SimplyFlow styles. DS source includes a Google Fonts
  import. Actual font requests, parse behavior and cold-task cost were not
  measured by this review.

These are source findings, not observed browser regressions or a performance
benchmark. No new test run or screen-reader review is claimed for this plan.

## Boundary and preservation contract

- App boundary: maintenance across Workbench, Contacts, Files, Profile,
  Preferences and their existing shared UI. Add no new app or user task.
- Local/offline recovery: preserve existing collections, workspace state,
  drafts, cached background choices and preference propagation through reload,
  reconnection and authentication failure. Do not add network dependencies for
  core styling. Uncached app assets/data remain subject to existing limits;
  this cycle does not promise a complete offline shell or automatic sync.
- Phone first: preserve list/details and Back navigation, reachable toolbars,
  menus and nested capability dialogs. Start baseline and pilot checks on phone
  widths before desktop expansion.
- Accessibility: preserve native semantics, labels, current-selection feedback,
  initial focus, arrow/Enter/Tab behavior, focus containment and restoration.
  Verify reflow, text scaling, long content and equivalent controls for gestures.
- Appearance: retain blue accent, square controls, compact account menu,
  app-owned toolbars and inline Contacts profiles. Workbench retains transparent
  title/labels, padded blue icons, filled menu marker, light-mode dark text
  without shadow and dark-mode text shadows. Do not redesign forms or navigation.
- Moldability: preserve named style entries, authored source origins, component
  originals and live edit/restoration through their existing linked style
  elements. Keep SimplyFlow as the sole renderer and existing template composition.
- Download: keep every complete app graph, including callback and dependencies,
  below 200000 gzip bytes, except the existing temporary 220000 readable
  Workbench allowance. Do not expand it. Measure both variants, CSS, fonts,
  HTML/images/requests and cold time to a real task; promise no savings in advance.

## Target ownership and cascade

Declare `reset, setup, theme, base, component, page, utility` before any named
app styles are installed, using the existing build/composition path. Check the
installed DS layer declarations and effective CSS parsing first. Do not assume
that moving a currently unlayered override into a layer preserves its precedence.

| Responsibility | Owner and intended layer |
| --- | --- |
| Third-party reset, primitives, native controls | Installed DS; consume supported APIs, keep dependency source untouched |
| Suite palette and DS-specific adjustments | Explicit suite/DS integration; appropriate setup/theme/base rules after checking DS precedence |
| Component token mappings | Clearly marked `theme` adapter sections on component roots or documented theme boundaries |
| Dialog, dropdown, list/details, toast, account, profile parts | Their named feature styles in `component` |
| Suite shell and app-specific composition | Their owning suite/app entries in `page` |
| Visibility and other deliberate utilities | Small named shared utility responsibility in `utility` |

Keep related adapter and implementation sections in the existing authored CSS
file when that is clearest. Separate adapter files are optional, not a requirement
for a new component framework. Resolve mappings at their documented local scope;
avoid root aliases that freeze values before local theme overrides are applied.
Expose meaningful properties, not every literal. DS-specific classes and token
writes belong in explicit integration sections with their dependency documented.

Use `swb-`/`--swb-` names for newly introduced suite-owned parts and variables.
Keep existing named style identities unless a demonstrated ownership correction
requires a coordinated change. Update templates, references and observable checks
together. This is not the separately deferred wholesale JS/public-handle rename.

Concrete transformations to prove:

- `gap: var(--ds-space)` in list/details becomes an implementation read of
  `--swb-list-details-gap`, mapped from DS in its adapter at the component root.
- `.profile-card form .actions` becomes a directly applied profile-editor action
  class. A genuine short parent/child contract may remain when documented.
- Launcher descendant overrides of header colors become supported header
  properties or an explicit composition variant. Map on the actual component;
  do not assume inherited ancestor values override local initializers.
- Shared list/details stops styling arbitrary `.app-content`; the suite/app
  composition explicitly owns available height and outer layout.
- Consolidate account-name base/phone/state rules and shared dropdown duties;
  preserve the observed accepted layout. Do not silently turn an ineffective
  historical width declaration into a different design.

## Ordered work inside one cycle

1. **Capture the effective baseline and ownership map.** Inventory the 21 files,
   DS primitives/tokens/layers, HTML classes and named style installation order.
   Trace candidate legacy selectors through authored templates, compiled views,
   dynamic bindings and embedded presentation before removing them. Retain
   baseline screenshots/computed styles for representative tasks, both build
   variants, download costs and known test failures. Record tested browsers;
   broader supported-browser policy is currently unestablished.
2. **Prove the approach with Launcher and its shared header seam.** Inspect
   Launcher first as the roadmap requests. Establish layer order and migrate
   the smallest real header/shortcut/background slice with component adapters,
   explicit parts/variants and one owner for focus styling. Check phone, themes,
   all background modes and style edit/restoration before spreading the pattern.
   This is an internal checkpoint, not an extra implementation cycle.
3. **Refactor shared responsibilities.** Apply the proven approach to foundation,
   account/dropdown, dialogs/capability/recovery, list/details and toasts. Move
   app layout rules to their owners; eliminate repeated declarations and flatten
   selectors. Preserve required DS structural contracts explicitly. Verify all
   five apps after each consequential shared change, especially Preferences
   initial focus, section navigation and embedded providers.
4. **Finish app-owned styles and layout corrections.** Complete Launcher,
   Contacts, Files and Profile, including reused profile editing and Preferences
   section composition. Namespace touched generic parts, replace command/field
   selectors used only for appearance, and consolidate spacing through adapters.
   Replace fixed action-space reservations or text heights where browser evidence
   requires it, preserving the workflow and exposing actions at zoom/narrow sizes.
5. **Review delivery without replacing style ownership.** Measure actual font
   requests and CSS use. Remove proven duplicate/dead authored rules. Keep fonts
   optional; any necessary DS import correction must be a small documented suite
   integration using the installed package's supported composition, not an edit
   to node_modules. Do not add a second copy of authored CSS, another stylesheet
   renderer or a bundler redesign. Retain broader DS/font packaging work as a
   follow-up if it requires a new upstream release or visual-design decision.
6. **Evaluate the integrated refactor.** Run required checks once the final
   implementation is coherent; correct regressions in this cycle. Report the
   source-rule audit, UI evidence, transfer deltas, remaining exceptions and
   readability assessment. Present to the maintainer for human acceptance.

## Evidence and completion criteria

| Claim | Required evidence |
| --- | --- |
| Predictable cascade | Authored rules assigned to their intended layers; effective DS/app precedence inspected; light/dark/system with both OS preferences checked |
| Replaceable component styling | DS reads confined to documented integration/adapters; a representative component works with a non-DS property mapping and documented structural dependencies |
| Flat, owned selectors | Direct namespaced part/state classes by default; justified structural exceptions; no unowned app-specific rules in shared components |
| Editable styles preserved | Existing named-entry/source-origin checks plus edit and restoration in place, retaining originals and state, in readable and minified builds |
| Accepted UI preserved | Before/after phone and desktop comparisons; no/preset/URL/upload backgrounds; long titles, shortcuts, WebIDs and profile text; empty/error/disabled/loading/recovery states |
| Accessible tasks | Keyboard and accessibility-tree evidence for menus, list/details, Preferences sections, dialogs and picker actions; 200% text and 400% zoom/reflow checks; reduced motion and visible focus. Separately identify manual screen-reader checks actually performed and any remaining limitation |
| Data/recovery preserved | Existing regression contracts plus targeted reload/offline/draft/background retention checks where touched; no changes to native RDF, HTTP, auth or synchronization ownership |
| Affordable delivery | Fresh complete JS graphs and CSS/HTML/font/image/request sizes; cold core-task observations under a recorded slow-connection configuration and cache state, before/after under the same conditions |

Run `npm run check` and `npm run test:browser`. Existing browser suites are the
starting point; add focused assertions for real risks such as wrapped picker
actions, theme-boundary mappings and style restoration, not tests mirroring every
selector. Use current installed browser tooling; retain earlier CYC106 timing
failures and report any new failure/retry without claiming their cause resolved.
Automated passes do not establish human acceptance or complete AT compatibility.

Avoid arbitrary line-count/specificity-score targets. Keep the justified hidden
utility's `!important` if needed; do not remove a visibility invariant merely to
get a zero count. Do not claim every structural selector is forbidden or that
lower specificity guarantees rendering speed.

## Scope limits and replan conditions

Exclude new features, broad UI redesign, IDE implementation, runtime template
composition, a new renderer/CSS framework, dependency publication, changes in
other repositories, storage/auth/RDF semantics and broker protocol work. Restore
the original Workbench budget as a separate follow-up; still take readable local
savings available within this refactor.

Replan before proceeding if preserving the accepted interface needs an upstream
API/dependency change, if layer ordering cannot coexist with named style editing,
if a proposed correction changes product behavior beyond layout/accessibility,
or if the budgets cannot be met without a new exception. State the concrete
gap rather than compensating with a parallel mechanism. Retain incidental
discoveries outside this outcome for a later cycle.

## Execution handoff and provenance

This is documentation-only planning on verified `main`; no CYC ID or Active
status is invented. When implementation is requested, allocate a cycle and
source/design IDs with the Spiral CLI, create
`spiral/<CYC-id>-css-refactor` from then-current accepted main, mechanically verify
the actual branch, and record the confirmed scope before product edits. Recheck
this plan against any intervening integration. Keep unrelated user files and the
earlier uncommitted AGENTS.md/guide work intact.

Use the plan and guide as the cycle's source/design inputs. Record implementation,
actual evaluation and eventual human acceptance under `.spiral/`; add canonical
Turtle artifact relations to exact upstream versions when those Git versions
exist, without inventing commits or historical approvals. No commit, merge, push
or publication is authorized by this planning request.

Applicable culture: CUL-MUZE-001 across the suite, CUL-MUZE-LIB-001 for shared
packages/tooling, and the repository architecture philosophy. These favor native
layers, small explicit adapters, readable feature ownership and an early real
UI probe. WPF-HUMAN-001 applies through the existing adoption: distinguish source
findings, observed browser behavior, automated evidence and human judgment.
Project-specific moldability and appearance requirements govern the choices.
