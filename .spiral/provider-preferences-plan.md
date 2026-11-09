# Planned cycle: preferred resource-picker provider

Status: **Authorized for CYC118**, 2026-11-09. The maintainer agrees with returning to
broker Phase 2 and requests planning first. The maintainer subsequently says “Agreed, lets start”, authorizing this plan
on the verified CYC118 branch. Earlier proposal wording is retained as planning
history. No commit, merge, push or publication is authorized.

## Outcome and continuity

Choose a resource-picker app in Preferences, retain that choice under the
selected WebID, and invoke it in a fresh browser session without manually
opening the provider. The caller requests the existing `browse` capability;
the provider owns selection and returns the existing URI result. Only a valid
selection changes the caller's resource draft.

This **continues** Phase 2 of the governing
[broker roadmap](../design/solid-capability-broker-roadmap.md#phase-2--persistent-provider-registration-and-on-demand-start).
Accepted CYC100/CYC106/CYC112 provide workspace, Preferences and styling
foundations. Built-in startup and embedded tasks already exist. Persistent
provider choice and resolution remain missing. This does not claim that every
earlier architectural acceptance criterion has been met.

Persistence, selection and launch belong in one cycle because only the complete
workflow demonstrates that the choice controls the task. End at a persisted,
replaceable `browse` provider. Contacts recipient selection and independent
broker replaceability remain Phase 3 work. A compatible cross-origin fixture
here verifies resolution without claiming all Phase 3 interoperability.

## Confirmed direction and review assumptions

The maintainer confirms:

- One preferred picker across workspaces under the selected WebID; another
  identity has its own choice.
- Both a selection from installed apps with the capability and entry of a
  custom app URL. Neither method alone satisfies the request.
- Plan first, before implementation.

Proposed meaning of “installed”: apps saved in the current workspace's Launcher,
plus built-in Files. Include a saved app as capable only with an explicit
`browse` declaration in its linked manifest or a matching live registration.
Do not open apps to discover support, guess manifest URLs or infer capabilities
from names. Unknown metadata means support is unknown; custom entry remains
available. Show the chosen provider even if it is absent from the current list.
Selecting from this list still changes the identity-wide preference.

Whether the installed-app list should instead include saved apps from every
workspace remains a review choice. That expansion cannot assume uncached Pod
data is available offline. There is no installer registry today; this proposal
does not introduce a catalog or installation system.

## Understanding, effective behavior and evidenced gap

Source inspected on main at
`7e731a9e35956ac7e8d42853933648db0dd426df`:

| Evidence | Effective behavior |
| --- | --- |
| `apps/launcher/src/components/resource-selection.mjs` | Current UI invokes the capability presenter with built-in Files. |
| `apps/launcher/src/components/workspace-controls.mjs` | Fixed Files/Profile/Preferences provider configuration; ordinary browse routing requires Launcher and an allowed instance. |
| `packages/solid-app-ui/src/components/capability-dialog.mjs` | Already resolves `embeddedProvider`, opens a transient task and offers tab fallback after initial embedding failure. Currently copies the supplied URL hash onto the configured URL. |
| `packages/solid-app-data/src/workspace-broker.mjs` | Configured origin/path checks, private tickets, readiness, requester ownership, deadlines and cancellation already exist; no durable preferred-provider registry. |
| `apps/launcher/src/picker.mjs`, `test/launcher-picker.test.mjs` | Earlier top-level helper handles readiness/grants/startup but is not the current UI entry path. Changing only it would miss the real workflow. |
| `packages/solid-preferences/src/{index,state,consumer}.mjs` | Linked preferences, identity-scoped native local caches, pending edits, conditional writes, conflict review and propagation exist for fixed scalar fields. |
| `apps/launcher/src/manifests.mjs`, `apps/files/src/manifest.ttl` | Explicit app identity/name/URL/icon metadata exists, but capability declarations are not exposed. |

Understanding: make the picker provider a durable user choice while retaining
the existing provider-owned UI and result contract. The evidenced gap is native
provider persistence/resolution and capability-aware saved-app selection. Existing
generic broker/preferences code does not already supply it indirectly. These
are source findings; no fresh runtime pass is claimed by this planning work.

## Proposed interaction

Add a shared **Default apps** section in Preferences with a **Resource picker**
setting. Reuse section/list-details navigation and native labelled controls.

1. Show the effective provider and local/pending/synchronized/conflict status.
2. Offer built-in Files and known capable saved apps with name and origin.
   Keep application identity separate from shortcut/resource context; do not
   merge distinct launch configurations merely because their paths match.
3. Offer **Custom app URL**. Retain incomplete input as a draft, separately
   from the effective choice. Apply valid input through the existing immediate
   Preferences change interaction; do not navigate while the person types.
4. Explain that a custom app must implement the suite picker protocol. Saving
   its URL does not make an arbitrary website compatible. No speculative
   network probe is required merely to retain the choice.
5. Offer **Use built-in Files** as explicit reset. A failed custom provider
   produces a recoverable error, never silent replacement of the preference.

Preserve the current Launcher picker entry point, embedding-first presentation,
task cancellation and tab fallback. Use provider-neutral messages where “Files”
would misidentify a custom app. Opening a fallback tab uses a fresh user click
when required. Retain the accepted browser-controlled tab-focus limitation.

## Proposed native data and recovery design

Discover preferences through the profile's existing `pim:preferencesFile` link.
Propose a `cap:registry` link from the suite preferences subject to a named
registry fragment in that same document. The registry links to a named `browse`
binding with exact `cap:provides` and `cap:application` URIs; the application has
an explicit `schema:url` launch URL. Review the membership predicate and exact
owned terms before coding. Roadmap vocabulary remains experimental, not a
published stable standard.

Co-location avoids a second document, extra discovery request and two-resource
save while preserving linked-data identity. An externally located registry is
outside this initial proposal: preserve an existing external link and report
the unsupported location rather than replace it during background saving.
Replan if external registry support is needed for the agreed workflow.

Reuse StateGraph, oldm/oldm-turtle, Metro/document helpers and PreferenceState.
Its scalar cache needs a narrow native-binding extension: app identity and
launch URL change/conflict as one logical provider choice, not independently
merged fields. Keep native confirmed/pending/baseline RDF in local Turtle.
Do not serialize JSON, introduce another preference engine or replace graphs
with UI projections. Remote unrelated RDF remains authoritative.

Preserve unknown predicates, other subjects/capabilities, multiple values and
shared application descriptions. Refuse ambiguous/unsupported structured edits
instead of flattening them. Reset/change removes only owned binding terms and
links, not a shared application description. Reuse conditional validators,
conflict review and uncertain-write recovery. Inspect current installed APIs
again at execution; Solid Workspace 0.2.1 already provides local graph sources,
and the suite already provides conditional document synchronization.

Use identity-and-preferences-URL cache keys and existing change notifications.
Retain incomplete drafts, pending changes and conflicts through reload,
reconnection and auth failure. Positively absent bindings use built-in Files;
failed reads/invalid bindings are visible states, not evidence of deletion.
Cached configuration does not make uncached provider code or data available
offline. Anonymous use retains built-in Files and cannot inherit another
identity's custom provider.

## Resolution, launch and authority

Resolve one `browse` provider from locally available preferences; refresh through
existing synchronization. Put selection policy in editable feature entries and
keep routing in the broker. Profile/Preferences providers retain their existing
configuration. Do not introduce a competing launch or HTTP mechanism.

Capture a provider for each task. Recheck its permission at ticket creation,
including revocation during startup. Changes affect subsequent tasks rather
than redirecting an attached provider. Workspace/identity teardown cancels the
old task and rejects late results before they can alter the new caller context.

Preserve exact origin/window binding, private credentials, runtime capability
advertisement, requester ownership, busy handling, deadlines and cancellation.
Provider preference is not a general app-to-app grant or Pod access grant.
The main acceptance path is Launcher requesting `browse`; preserve already
permitted callers without silently broadening authority.

Reuse transient task lifecycle and cleanup for both iframe and fallback tab;
task providers must not become ordinary apps restored with the workspace.
Audit the legacy top-level helper where touched without gratuitous rewrites.

Reject unsafe URL schemes and credentials. Define exact launch identity and
query/fragment handling before implementation: preserve supported app routes
and launch parameters rather than copying built-in context over custom routes.
Use the existing launch contract; identity context is not authentication.
Never persist task credentials in provider RDF. Redirect discovery and protocol
negotiation stay deferred; incompatible navigation fails visibly within the
current exact-origin contract.

## Guardrails and evaluation

| Claim | Boundary and evidence |
| --- | --- |
| Focused app purpose | Extend Preferences and Launcher selection; no new app, installer, catalog or sharing editor. |
| Local and recovery | Test offline edits/reload/reconnect, incomplete drafts, auth/local-save failure, uncertain remote writes, conflicts and identity isolation. Do not assume uncached remote data. |
| Phone core workflow | Choose a saved app or custom URL, return to Launcher, select/cancel and recover from unavailable provider at phone width before desktop expansion. Include long names/URLs and tab fallback. |
| Accessibility | Native labels/controls, section arrows/Enter/Tab, status/error association, focus containment/restoration and cancellation. Keyboard/AX checks, 200% text and narrow reflow; identify manual AT/usability limits separately. |
| Download | Complete readable/minified graphs include callback and required lazy dependencies. Measure cold HTML/CSS/font/image/requests and time to a real picker task. Avoid manifest scans on every core load. |
| Moldability and CSS | Named editable SimplyFlow entries, existing section contributions/models, layered component-owned styles/adapters; SimplyFlow renders all content. |

CYC112's readable Workbench measures 218255 gzip bytes, leaving 1745 bytes under
its existing temporary 220000 allowance. All other graphs retain the strict
less-than-200000-byte ceiling. Measure a vertical pilot early. Do not expand caps
or hide required core cost in a lazy chunk. Restoring the original Workbench
ceiling remains separate; fitting this cycle within existing caps is required.

## Ordered work within the proposed cycle

1. Review this understanding, source evidence, installed-app boundary and native
   registry proposal. Before product changes, allocate cycle/source/design IDs
   using Spiral, create a matching `spiral/<CYC-id>-provider-preferences` branch
   from then-current main, verify it and preserve unrelated files.
2. Capture native preservation, Preferences/picker and delivery baselines;
   inspect installed Muze public APIs and document only concrete missing parts.
3. Prove a phone-first vertical slice: native choice, resolution, cross-origin
   fixture startup and valid result. Check authority and graph size early.
4. Complete capable saved-app selection, custom URL drafts, explicit reset,
   conflict handling and notifications. Extend the existing explicit manifest
   reader for declarations and add built-in Files' `cap:provides` statement.
5. Finish fresh-session resolution, tab fallback and recovery through existing
   broker/presenter APIs, with focused observable-contract tests.
6. Run `npm run check` and `npm run test:browser` on the final snapshot. Review
   phone/desktop behavior, readable source and delivery evidence; present the
   outcome for human acceptance. Passing tests do not close the cycle.

## Acceptance scenarios

- Choose a capable saved app, choose custom URL, and reset to built-in Files.
  Switch workspaces under one WebID and retain the effective choice.
- Sync, start a fresh browser context with no provider running, resolve linked
  preferences and invoke the chosen provider without caller URL changes.
- Return a valid URI from a second-origin compatible fixture. Cancellation,
  invalid results, denied reads and startup failure preserve the caller draft.
- Refuse embedding, block popups, then continue the same task with an explicit
  tab-opening click or cancel without losing recoverable work.
- Check origin/source, stale tickets, unsupported capability, busy/concurrent
  tasks, disconnect and startup revocation. No replay after reconnect or late
  mutation after identity/workspace teardown.
- Exercise offline/reload/reconnect, competing provider edits, uncertain writes,
  unknown/structured RDF and shared app descriptions. Preserve unrelated terms,
  both conflicting choices and drafts; distinguish missing from failed reads.
- Check phone, keyboard, AX/focus/reflow and editable feature replacement, then
  required regressions and both complete-graph budget variants.

Retain earlier intermittent managed/session timing and Failed-to-fetch evidence;
new passes do not establish those causes resolved. Fixture interoperability is
bounded evidence, not certification of arbitrary apps, browsers, providers or
manual screen-reader usability.

## Non-goals and replan conditions

Exclude Contacts multi-book/search/recipient selection, app catalogs/installers,
automatic provider discovery/ranking, general permission editing, replacing
Profile/Preferences providers, protocol negotiation, new transport, PWA rollout,
general app-data sync, external-repository edits and dependency publication.

Replan if “installed” needs a different boundary, existing preference ownership
cannot preserve/conflict the native binding safely, external registry support
is necessary, a custom provider needs another launch contract, current grant
boundaries cannot be preserved, or delivery cannot fit existing caps. Resolve
the premise rather than adding compensating infrastructure silently.

CUL-MUZE-001 applies across the suite, CUL-MUZE-LIB-001 to shared packages/tooling,
with the adopted architecture philosophy, risk lenses and WPF-HUMAN-001. Prefer
direct library reuse, readable code and explicit evidence/authority boundaries.
These profiles introduce no hidden requirements or extra approval ceremonies.


## CYC118 implementation handoff completed, 2026-11-09

The maintainer authorizes 33 extra bytes at the early checkpoint. The build
now allows at most 220033 bytes for readable Workbench only. The implementation
subsequently measures 219996, with Preferences 197545; no further allowance is
inferred. IMP121 and EVD122 retain implementation, evidence and prior failures.

The settled registry uses rdfs:member and binding-local schema:url alongside
cap:provides/cap:application. Binding-local configuration preserves shared app
descriptions and keeps identity distinct from execution. The known-app list is
current-workspace Launcher candidates plus built-in Files, as authorized when
starting the cycle. Phase 3/Contacts and broad budget restoration remain separate.
Human acceptance and any commit/integration remain pending.
