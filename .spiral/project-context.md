# Solid Workbench project context

## Greenfield API policy, confirmed 2026-11-12

The maintainer confirms that no APIs have consumers outside this project.
Backward compatibility with legacy APIs is not required. Remove obsolete paths
and update in-project callers and tests together; do not retain compatibility
shims, deprecation periods or duplicate machinery for hypothetical consumers.
Choose contract changes for current needs. Standing native RDF/data-preservation
requirements still apply; this policy does not authorize discarding user data.


## Current build-budget policy, 2026-11-09

The maintainer explicitly requests that budget checks never fail builds or
prevent npm run dev startup; warnings are allowed. CYC129/SRC130 record this
prospective change, superseding mandatory build enforcement in earlier entries
and cycle-specific allowances. Complete app graphs including auth callback
remain measured and reported; numerical thresholds are advisory. The dedicated
branch is spiral/CYC-20261109-QG24H-129-budget-warnings. Existing uncommitted
CYC124 account-status work is preserved outside this change. No human acceptance,
commit, merge or publication is inferred.

Intake status: **Complete**

Started: 2026-11-01, at the maintainer's request to read `.spiral-core`
and begin its intake. Every required topic has an explicit disposition.
Human-confirmed complete on: **2026-11-01**, in the intake conversation.
The maintainer answered "yes" to confirmation of the complete frame after
culture, risk-discovery and warning-profile choices were included.

Process source: `.spiral-core/docs/brownfield-intake.md` and
`.spiral-core/prompts/brownfield-intake.md`, inspected at submodule commit
`3c93481336d0e771110a9437c6039df6d7ce078b`.

Repository baseline: `292f753` on local branch `main`. The existing staged
`.gitmodules` change belongs to the maintainer and is outside this intake.

## Required topic dispositions

| Topic | Disposition | Evidence / outstanding question |
| --- | --- | --- |
| Purpose, users/stakeholders, goals | Confirmed by maintainer, 2026-11-01 | Basic suite and ecosystem for productive Solid use; showcase for developers building their own Solid apps. |
| Current posture | Confirmed by maintainer, 2026-11-01 | Exploratory prototype. This does not establish whether any real data is in use. |
| Important outcomes / metrics | Qualitative outcomes confirmed by maintainer; later JavaScript target explicit | Productive Solid use and developers learning/building interoperable apps. Subsequent roadmap adds mobile-first workflows and less than 200 KB gzipped JavaScript per app. |
| Consequential prior decisions / reversibility | Undocumented decisions exist; individual details unknown | Maintainer subsequently identified Muze culture, Weblets work, and thoughts on AI and linked data as influences. Seek relevant rationale during consequential work; do not invent exit costs. |
| Invariants / commitments | Established from current instructions | AGENTS.md supplied by maintainer; constraints below. Additional commitments may emerge in intake. |
| Known / tolerated problems | Unknown; explicitly dispositioned by maintainer | No explicitly tolerated problems identified. Documented limitations below remain unprioritized, not accepted trade-offs. |
| Reliable feedback / reality sources | Confirmed by maintainer | Feedback expands from the maintainer's own use to Muze colleagues, then the Solid community; repository checks provide bounded technical evidence. |
| Knowledge gaps / affinity needs | Dispositioned by maintainer; source collection complete for now | Five Weblets documents retained. Maintainer confirmed these are the last sources to add before continuing intake. Undocumented reasons still require targeted guidance when relevant. |
| Relevant future direction | Governing direction confirmed; no deadlines yet | Broker roadmap governs. Initial post-confirmation assessment places work before Phase 0 exit; candidate findings await maintainer prioritization. |
| Risk-discovery / metric-profile disposition | Dispositioned by maintainer | Three risk lenses adopted. Measure UI/UX and developer experience; uptime is explicitly irrelevant. WPF-HUMAN-001 separately adopted during final frame review. |
| Integration target / pre-merge validation | Dispositioned by maintainer | main is authoritative; maintainer reviews each completed cycle through a PR. Manual validation of the candidate plus latest main is sufficient for now; repeat if main changes. |

Unknown, not relevant, and deliberately deferred are valid answers when
explicitly dispositioned. Pending entries are not treated as answers.

## Purpose, posture and governing direction

The maintainer confirmed on 2026-11-01 that Solid Apps aims to provide a basic
suite of apps and an app ecosystem for people to use Solid productively. It
also serves as a showcase for developers who want to build their own Solid
apps. Both everyday usefulness and developer learning therefore matter.
The maintainer defined user success as productive use of their Solid data
within the limited set of applications defined so far. This is a qualitative
outcome; no numeric threshold or single demonstration task was specified.
Developer success means being able to read the source, understand how the
different stack libraries and ecosystem capabilities are used, and write an
app of their own. Developers may choose different underlying libraries;
ecosystem capabilities must remain available for integration with this suite.

The maintainer confirmed the posture as **exploratory prototype** and selected
the capability-broker roadmap as the governing direction for upcoming work.
This establishes direction, not approval of every proposed protocol detail or
an implementation cycle.

Asked about deadlines, planned migrations or other commitments affecting the
roadmap, the maintainer answered that there are **no deadlines yet**. No other
future commitments have been identified; this does not assert that every
possible migration has been ruled out. Assess the roadmap's current position
from repository evidence after the complete intake frame is confirmed.

The README describes four small browser applications: Launcher, Contacts,
Profile and Files, with shared preferences, local persistence and explicit
Solid synchronization. These capability descriptions are documentation claims;
current user population, deployments and real-data reliance remain unconfirmed.

The designs propose independently useful applications operating on
user-controlled Solid data, with URI-identified capabilities and replaceable,
user-selected providers. The broker roadmap now governs direction; the other
designs retain their stated status. No design is proof that its assumptions
are implemented.

| Design | Document status / intent | Intake disposition |
| --- | --- | --- |
| [Solid Apps suite roadmap](../design/solid-apps-roadmap.md) | Maintainer additions after the launch-context merge: Zett, Notebook, profile/account consistency, mobile/size budget, local-first automatic sync, PWA, deferred collaboration and decentralized catalogs. | Future direction requested 2026-11-01; no new implementation cycle or delivery order selected. Supplements the broker roadmap. |
| [Capability broker](../design/solid-capability-broker-roadmap.md) | Proposal v0.1; cross-origin resource browser and recipient picker, self-hostable broker, persistent provider choice and cold launch. | Governing direction confirmed by maintainer, 2026-11-01. Initial reality assessment finds Phase 0 exit not yet established; characterize launch context and pilot contracts before relying on them. |
| [Semantic clipboard](../design/solid-semantic-clipboard-design.md) | Proposal v0.1; history of references, explicit selection, destination-owned relationships, initially ephemeral. | Future proposal; priority pending. Calendar/task examples are not evidence those apps exist here. |
| [Semantic Open With](../design/solid-semantic-open-with-design.md) | Proposal v0.1; immediate manual actions and bounded RDF inspection, shape recognition separate from validation. | Future proposal; priority pending. |
| [Optional AI](../design/solid-optional-ai-capabilities.md) | Optional providers return reviewable proposals; ordinary functionality survives their removal. Explicit implementation priority: none for now. | Preserve its stated deferral; do not infer authorization to implement. |

Re-read any human-confirmed governing roadmap before choosing later cycles.
Do not silently promote the latest discovery into a new governing direction.

## Established constraints and culture

Source: current maintainer-supplied [AGENTS.md](../AGENTS.md), corroborated by
the README. These are already instructions, not new approval questions.

- SimplyFlow alone renders runtime content; HTML is composed at build time.
  Escape plain text and use item properties for list command values. Native
  lifecycle, focus, file/download and document-setting operations stay direct.
- Native RDF remains authoritative. Preserve unknown terms, multiple values,
  identities and other subjects; refuse unsupported structured edits.
- Contacts and Profile share profile editing; storage policy stays outside
  that view. Preferences follow the profile's `pim:preferencesFile` link.
- File deletion uses a conditional tombstone in the advertised parent-container
  description and retains bytes. Do not substitute HTTP DELETE. Moves are not
  implemented.
- Keep app-specific assumptions here until independent reuse justifies a lower
  library. External dependencies use npm versions. Shared packages remain
  experimental under `@muze-labs`; publication needs a separate review.
- This composition selects oldm-turtle without changing the shared OLDM default;
  the build checks for absence of N3.
- Preserve the original Contacts visual language, app-owned toolbars, Launcher
  navigation and compact shared account/preferences menu.
- Run `npm run check`, plus browser tests for UI changes. Do not commit or
  publish without a request. Other repositories' user work stays outside scope.

AGENTS.md explicitly adopts the repository's Muze architecture philosophy, Muze
engineering culture and maturity policy; library stewardship applies to shared
packages and tooling. The bundled culture profiles were consulted at the
Spiral submodule commit above. This records the inspected copies, not a claim
that their remote main branches were checked.

The maintainer explicitly adopted **WPF-HUMAN-001: Human Impact and Epistemic**
after its separate purpose was explained during frame review. The unchanged
text is retained locally at
[warning-profiles/human-impact-and-epistemic.md](warning-profiles/human-impact-and-epistemic.md),
pinned to the same source repository and submodule commit above. Its
[adoption record](warning-profiles/README.md) states scope, significance gate
and the remaining mechanical Git-provenance step when commits are authorized.
Its seven signals prompt proportionate inspection, not automatic vetoes.

The existing adoption is now explicitly recorded in [culture.md](culture.md),
with the exact inspected source version, named profile identities and their
distinct scopes. This records authority already present in AGENTS.md rather
than requesting adoption again.

Initially asked about past decisions or commitments beyond AGENTS.md and the
broker roadmap, the maintainer answered **Unknown**. Later, while discussing
knowledge gaps, the maintainer clarified that many design decisions exist but
are undocumented. Some follow from Muze culture, some from the maintainer's
Weblets work, and some from thoughts on AI and linked data. This clarification
supersedes any reading of the earlier answer as absence of prior decisions.
Individual reasons and costs of reversing boundaries remain unknown;
investigate them when material to active work rather than reconstructing a
complete history.

## Outcomes and candidate discovery profiles

The three adopted risk-discovery lenses are now collected in the ordinary
Markdown [risk-profile.md](risk-profile.md), with source/version information.
This is distinct from Spiral's optional warning-profile layer. The maintainer
raised culture and risk profiles during final frame review; the separate
bundled warning profile was separately presented and explicitly adopted.

Confirmed user outcome: people can productively use their Solid data within
the scope of the limited set of applications defined so far. Do not expand the
application set merely to make this outcome easier to demonstrate.

Confirmed developer outcome: readable source demonstrates stack library usage
and ecosystem capabilities well enough to build an independent app. Integration
with the suite's capabilities must be possible with different underlying
libraries. Do not make adoption of this suite's implementation stack a
prerequisite for ecosystem interoperability.

The maintainer selected **UI/UX and developer experience** as the measurement
focus. **Uptime is explicitly irrelevant for these browser apps**, not a target
deferred until later. Apply measurement suggestions only where they help assess
the two selected outcomes; do not import a service operations scorecard.

Possible evidence within that focus includes:

- Users complete core tasks, including recoverable failure paths.
- Shared RDF survives edits without loss of unrelated information.
- Independent apps and providers remain usable and replaceable.
- Early interaction demonstrates whether cross-app capabilities are useful.
- Developers can understand the showcase and build an independent Solid app.

No numerical thresholds were specified. Use qualitative UI/UX and developer
experience evidence, initially from the maintainer's own use, with the feedback
progression recorded below. Supported environments remain unestablished; do not
invent a browser/Pod compatibility promise.

| Profile / lens | Disposition | Reason |
| --- | --- | --- |
| `.spiral-core/profiles/risk-discovery/brownfield-general.md` | Adopted, narrowed to existing behavior and dependency assumptions | Maintainer approved initial investigation of regression risks in these areas. |
| `.spiral-core/profiles/risk-discovery/user-facing-interaction.md` | Adopted, focused on usability and failure recovery | Maintainer approved these as initial assessment concerns. |
| Custom RDF preservation, privacy and cross-app authority lens | Adopted | Maintainer approved this lens for initial assessment; examine relevant data and capability boundaries. |
| `.spiral-core/profiles/metrics/exploratory-product.md` | Narrow to explicitly selected UI/UX and developer experience | Assess productive interaction, source readability, learning stack usage and building interoperable apps with independent library choices. |
| `.spiral-core/profiles/metrics/established-service.md` | Exclude as a general scorecard | Uptime is explicitly irrelevant. Relevant UI/UX observations are covered by the selected custom focus. |

## Documented limitations and feedback sources

Asked about problems or limitations deliberately tolerated during the prototype
stage, the maintainer answered **Unknown**. This dispositions the intake topic
without treating any particular limitation as accepted.

The README reports the following limitations. Documentation is not a human
decision to tolerate them; their priority remains unestablished.

- Live-provider sign-in still needs a manual test; browser integration uses a
  mock Pod.
- Local contacts/shortcuts share an origin across WebIDs; changing storage
  location does not migrate existing data.
- Structured vCard values are preserved but not editable; language preferences
  do not translate the English interface.
- File deletion retains bytes; other clients must honor link metadata for
  compatible visibility. Moves, physical cleanup, sharing editors and recursive
  operations are follow-up work.

Available repository feedback includes unit tests and a documented browser
harness. On 2026-11-01, `npm run check` passed: Node reported two passing test
files and the build produced all four apps. Browser tests were not run for this
documentation-only intake. This check is bounded baseline evidence, not the
post-intake reality assessment or proof of live-provider interoperability.

The maintainer established this sequence for usefulness feedback:

1. Initially, the maintainer's own use.
2. Then, colleagues at Muze.
3. Then, the Solid community.

This is a planned progression, not a claim that colleagues or community members
have already tested the suite. Deployed instances, supported Pod/browser
combinations, incidents, manual test results and operational observations have
not yet been established.

After intake confirmation, the maintainer reported successful manual
**connection and authentication with solidcommunity.net**. This is first-hand
human-reported evidence. Browser/version and a detailed test procedure were
not supplied; do not infer broader provider or operation coverage.

## Knowledge and integration gaps

The maintainer reports many undocumented design decisions influenced by Muze
culture, their work on Weblets, and thoughts on AI and linked data. Existing
code and design documents therefore do not contain all relevant intent. Use
the explicitly adopted culture as guidance; do not assume it explains every
project-specific choice. Seek targeted maintainer guidance before relying on
an interpretation that could materially change a consequential decision, and
retain clarified rationale when it will help later work. No complete account
of these decisions is required to finish intake. Supporting sources are being
received one at a time. After supplying five Weblets documents, the maintainer
confirmed that this collection is complete for now and asked to continue intake.
This dispositions the knowledge topic without claiming that all undocumented
design reasoning has been recovered.

### Weblets source: first overview

The maintainer supplied a document titled **Weblets** during intake, identifying
it as the first of several documents they have written on this subject. Its
original creation date and version were not supplied. The text is retained
unchanged at [legacy/weblets-overview.md](legacy/weblets-overview.md), copied
from the conversation attachment `Pasted text.txt` in attachment directory
`a56205a9-ae7e-4c92-97d3-0e2f9aac1d36`. This is background source evidence,
not a newly approved implementation specification.

The source explicitly describes:

- Non-programmers composing custom applications from cooperating web apps.
- Each Weblet remaining a standalone application with its own URL.
- Cross-origin cooperation through a common bus with URI-identified APIs;
  each API defines its own message contract.
- Layout Weblets embedding others, including URL-based drag and drop.
- A component requesting shared services such as file selection from a parent,
  with fallback when no parent or preference exists.
- Components either owning data access or receiving data from a parent and
  sending edits back; these are different persistence responsibilities.
- Discovery and selection by required APIs, with a personalizable catalogue.
- Open questions about iframe costs and linked data versus JSON for core bus
  formats; security considerations are acknowledged but not resolved here.

Intake interpretation: standalone usefulness, URI-identified contracts and
replaceable shared services help explain the direction of the capability
broker. This does not establish that every historical Weblets mechanism belongs
in the current suite. The governing broker roadmap keeps provider windows for
v1 and defers embedding, layout negotiation and an app store. Preserve the
distinction when discussing future designs. The source's historical open
questions and technical claims have not been independently verified or adopted
as present-day architecture decisions.

### Weblets source: Why Weblets?

The maintainer supplied **Why Weblets?** as the second document, directly in
the intake conversation. Its text is retained at
[legacy/why-weblets.md](legacy/why-weblets.md). The introduction refers to
software in 2025; an exact creation date and version were not supplied.

The source motivates Weblets through these concerns and proposed responses:

- Expert-only software development and composition limit who can adapt tools
  to their own needs.
- Applications and centralized data silos act as gatekeepers; Solid Pod
  storage is the proposed default for separating data from applications.
- Reusing libraries still demands costly glue between incompatible designs.
  Weblets propose reusing complete applications, including data access,
  rendering and interaction, through a common communication mechanism.
- APIs have unique URL identities and can be discovered through a fixed API.
  Application contracts still need implementation; shareable bridges could
  translate between otherwise incompatible APIs.
- End users should be able to inspect and alter running Weblet compositions,
  with Smalltalk reflection/introspection cited as an analogy.

Intake interpretation: ecosystem interoperability must address meaningful
contracts and integration effort, in addition to transporting messages.
Framework choice need not be shared by applications. The bridge idea allows
different contracts to coexist without assuming that transport alone makes
their semantics compatible. End-user composition and inspectability provide
longer-term context for the developer showcase and capability ecosystem.

These are the author's motivations and hypotheses, not verified claims that
Weblets eliminate silos or solve reuse. The current broker roadmap remains
the governing direction; this background does not independently authorize
general bridge infrastructure, live code alteration or a composition editor.

### Weblets source: for Solid technical people

The maintainer supplied **weblets for solid technical people** as a third
document directly in the conversation. The text is retained at
[legacy/weblets-for-solid-technical-people.md](legacy/weblets-for-solid-technical-people.md).
Its original creation date and version were not supplied.

This account explicitly adds or clarifies:

- Operational interoperability: independent apps ask one another to perform
  bounded work, above Solid's data, semantics and authorization substrate.
- Private parent-child channels rather than an ambient bus observable by all
  embedded components.
- Connection handshakes advertising provided and requested APIs and available
  services; the parent/root mediates capability discovery and connection.
- Grants scoped to a relationship and specific API, potentially constrained
  by resources, shapes, purpose, duration or user action. Origin alone is not
  sufficient authority; high-risk capabilities require mediation.
- Linked Data-compatible request/result contracts identified by API URIs,
  with inspectable assumptions and support for multiple shape representations.
- Reusable bridges declaring their supported translations, constraints and
  known lossiness.
- A distinction between components performing their own authorized Pod access
  and components receiving scoped data from an authority elsewhere.
- An inspectable runtime graph of components, origins, APIs, grants, data
  sources, vocabulary mappings, transformations and message flows.

Intake interpretation: the earlier term "common bus" must not be taken as
requiring broadcast visibility or ambient authority. This document explicitly
describes private, mediated cooperation. It supplies context for capability
boundaries and inspectability; it does not itself specify a production wire
protocol, prove a security property, or establish that the suite implements
these mechanisms. The governing broker roadmap still sets immediate scope,
including separate provider windows rather than required embedded composition.

### Weblets source: security considerations

The maintainer supplied **Weblet Security Considerations** directly in the
conversation as a fourth source, retained at
[legacy/weblet-security-considerations.md](legacy/weblet-security-considerations.md).
Its original creation date and version were not supplied.

The source identifies message eavesdropping and exfiltration, and inducing a
high-value component to perform unwanted actions. It explores root-mediated
network access, possibly restricted to approved domains; connection consent;
and the tension between containing embedded code and keeping each Weblet
independently usable at its own URL. It also explicitly recognizes the burden
of asking users to approve every connection.

The proposed enforcement mechanisms are exploratory. Claims about browser
support for iframe CSP, meta CSP and generated wrapper documents have not been
verified during intake. If an implementation depends on those claims, check
current authoritative documentation and test the intended confinement boundary.
Do not treat this document as proof that arbitrary embedded content can be
confined by a parent, or that a component declaring itself noncritical makes
its requests safe.

Intake interpretation: privacy and scoped authority concern both which messages
a component can receive and what it can transmit or cause another component to
do. The private-channel account in the preceding source addresses visibility;
this security note adds motivation for controlling network effects and actions.
These documents supply design context, not authorization to exclude Firefox,
change content rendering, add an installation system or impose a confirmation
on every connection. Current AGENTS.md rules and the governing broker roadmap
remain authoritative for the suite.

### Weblets source: security and trust model compared to Solid

The maintainer supplied **weblet security and trust model compared to solid**
as a fifth source through conversation attachment `Pasted text.txt`, attachment
directory `6eeed119-8b1e-476f-b659-7ed864f5f5c4`. Its text is retained unchanged
at [legacy/weblet-security-and-trust-model-compared-to-solid.md](legacy/weblet-security-and-trust-model-compared-to-solid.md).
Its original creation date and version were not supplied.

The central statement is: **Weblets make the relationship the security
object.** The source distinguishes stored-data authorization from operational
authority between live tools. It identifies authority transferred through
composition, semantic confusion and bridge misuse as concerns alongside
eavesdropping and data exfiltration.

The proposed layered model includes browser isolation and origin/source
validation, private channels, grants scoped by requester/provider/operation
and data constraints with duration and revocability, semantic validation and
declared bridge lossiness, user mediation expressed in human consequences,
and inspection of grants and data flows. The aim is narrower, visible,
revocable trust; arbitrary composition is not claimed to be risk-free.

The source also explicitly places AI inside the same authority boundaries:
AI may propose compositions and bridges, request grants and produce inspectable
artifacts, but must not become an ambient superuser. Generated code needs
constrained evaluation before trust. This provides context for the deferred
optional-AI design; it does not bring AI implementation into current scope.

Intake interpretation: a provider's existing Solid access must not silently
become a caller's right to induce any operation it can perform. Data-access
permission and permission to invoke a live capability need distinct reasoning.
These are design intentions, not verified enforcement properties of this suite
or a finalized grant protocol. Revisit concrete enforcement and revocation
semantics when a governed cycle depends on them.

The maintainer's guidance is needed on existing deployments, historical
trade-offs and concrete success criteria. The designs themselves leave
broker identity, launch handshakes, registry/launch metadata, shape contracts
and clipboard lifetime unresolved. Treat these as design questions rather than
established defects or selected implementation tasks.

The maintainer confirmed **`main` as the authoritative integration branch**.
The maintainer confirmed that **each completed cycle is reviewed by them
through a pull request before merging into `main`**. Manual pre-merge
validation is sufficient for now. Handle integration one PR at a time:

- Validate the actual proposed combined result of the candidate and latest
  authoritative `main` immediately before integration.
- Run `npm run check`, plus `npm run test:browser` for UI changes, and Spiral
  integration validation against the current target and candidate.
- Record the results in the PR. If `main` changes before integration, repeat
  validation against the new target rather than relying on stale evidence.
- Preserve causal commits through normal merge history. Human cycle acceptance
  and PR review remain required; validation alone does not authorize merge.

Automated checks and a merge queue were explained as alternatives; a manual
serialized boundary is the selected initial approach. No automated queue is
required by this intake decision.

No `.github` directory was present during initial inspection;
this does not establish remote branch protection or CI settings.

No branch, commit, hook, workflow or remote configuration was changed by intake.

## Open conversation

First answers received on 2026-11-01:

1. Purpose: a basic suite and ecosystem for productive Solid use, also a
   developer showcase for building independent Solid apps.
2. Posture: exploratory prototype.
3. Direction: use the broker roadmap as the governing direction.
4. User success: productive use of their Solid data within the limited set of
   applications defined so far; no more specific task or threshold supplied.
5. Developer success: learn stack usage and ecosystem capabilities by reading
   the source, then build an app; other library choices must still permit
   integration with the suite through its capabilities.
6. Past decisions or commitments beyond AGENTS.md and the broker roadmap:
   explicitly **Unknown**.
7. Problems or limitations deliberately tolerated during the prototype stage:
   explicitly **Unknown**.
8. Usefulness feedback: initially the maintainer's own use, then Muze
   colleagues, then the Solid community.
9. Knowledge gaps: many undocumented decisions draw on Muze culture, the
   maintainer's Weblets work, and thoughts on AI and linked data. Individual
   decisions require targeted guidance when relevant.
10. First Weblets overview supplied and retained as background evidence;
    maintainer offered additional documents to retrieve.
11. Second document, Why Weblets?, supplied and retained: motivations around
    user composition, data independence, complete-application reuse, shareable
    API bridges and inspection/alteration of running compositions.
12. Third document, weblets for solid technical people, supplied and retained:
    operational interoperability, private channels, relationship-scoped grants,
    explicit bridge constraints/lossiness and an inspectable runtime graph.
13. Fourth document, Weblet Security Considerations, supplied and retained:
    threats from snooping, exfiltration and unwanted actions; exploratory
    network confinement and consent approaches with unverified CSP assumptions.
14. Fifth document, weblet security and trust model compared to solid, supplied
    and retained: relationships as security objects, scoped/revocable live
    authority distinct from Pod access, layered enforcement and bounded AI.
15. Maintainer confirmed no more documents to add before continuing intake.
16. Future commitments: no deadlines yet. The broker roadmap remains governing.
17. Initial risk-discovery focus approved: existing behavior/dependency
    assumptions that could cause regressions; usability and failure recovery;
    RDF preservation, privacy and authority between apps. These are lenses for
    investigation, not assertions that defects exist or priorities for fixes.
18. Measurement focus: UI/UX and developer experience. Maintainer explicitly
    rejected uptime as irrelevant for browser apps. No numerical targets were
    supplied; do not treat an operations metric profile as the default.
19. Integration target: maintainer confirmed `main` as authoritative.
20. Review boundary: maintainer reviews each completed cycle through a pull
    request before it merges into `main`.
21. Pre-merge validation: manual validation is sufficient for now, following
    explanation of manual versus automated alternatives. Record checks on the
    proposed combined result with latest main; rerun if main changes. Project
    checks, UI browser tests when applicable, and Spiral integration validation
    form the manual boundary; serialize integration without a required queue.
22. During final frame review the maintainer raised culture and risk profiles.
    Existing culture adoption and approved risk-discovery lenses have been
    made explicit in culture.md and risk-profile.md.
23. Maintainer explicitly approved adding WPF-HUMAN-001, Human Impact and
    Epistemic. The unchanged profile is retained with its exact external source
    version and an adoption record; its existing Turtle descriptor remains in
    the pinned submodule. Exact local
    Git-linked adoption relations await authorized causal commits; no foreign
    Git ancestry or placeholder hashes were invented.
24. Maintainer confirmed the complete project frame, including culture,
    risk-discovery and warning-profile choices. Intake marked Complete.
25. Maintainer reported successful connection and authentication with
    solidcommunity.net and prioritized assessment candidate 1: establish the
    actual launch context. Concrete contract and implementation choices remain
    to be settled from evidence and targeted clarification.
26. Launch-resource clarification: a resource is a file inside a storage Pod;
    prefer its full URL, preserving the option of a fragment on that URL.
    Application-specific resource handling remains to be settled.
27. Launch-WebID clarification: the launcher should always supply its current
    WebID. The maintainer agreed to the Launcher-to-Profile first slice in
    launch-context-proposal.md; execution is tracked by cycle
    CYC-20261101-QG24H-1.
28. During implementation the maintainer clarified that launch opens a new app
    window, preserving Launcher and existing app windows. The broker remains
    the planned live communication mechanism; opener access is not required
    for this launch slice.
29. Cycle CYC-20261101-QG24H-1 implements the Launcher-to-Profile launch proof,
    with project checks, browser checks and Spiral snapshot validation passing.
    Integrated human evaluation was pending at that point; later acceptance
    is recorded below and in the cycle.
30. The maintainer requested optional fragment-query support: with a literal
    `?` inside the app fragment, parse only its suffix and consume it so the
    remaining address is `url#foo`. Preserve encoded question marks and full
    resource URLs. This extends the same active launch-context cycle.
31. The maintainer requested explicit HTTP-query launch mode for server-side
    apps, with user-selectable overrides. Clarified precedence: user override,
    application declaration, then fragment when unset. App declarations and
    user overrides are separate settings; returning to Follow application
    removes only the override. Implemented and verified within the same cycle;
    remote description discovery remains future registry work.
32. The maintainer requested anonymous launching: omit WebID and include
    resource only if specified. Clarified that this choice is saved per launch
    link, allowing different choices for multiple links to the same app. This
    explicitly extends the current-WebID rule. It controls the URL, not the
    receiving app's existing authentication/session state.
33. Local testing refined launch presentation: new tabs are the default, with
    a shared Pod-backed preference to select new windows instead.
34. The maintainer accepted both the Launcher changes and the deferred roadmap
    addition for Pod-synced, user-created workspaces on 2026-11-01. Cycle
    CYC-20261101-QG24H-1 is Accepted; workspace implementation remains deferred.
35. Repository operations: the maintainer explicitly authorized the agent to
    commit changes itself, but prohibited merging. This supersedes the earlier
    no-commit instruction for authorized work; publishing is not authorized.
36. The maintainer merged the accepted launch-context cycle; repository state
    confirmed `main` at `c906322`. They then requested roadmap additions before
    a new cycle: Zett, a cobalt-note-based Notebook, a Profile link on the
    top-right name, immediate name updates across apps, mobile-first design
    with JavaScript below 200 KB gzip, offline operation and automatic sync
    when connectivity returns, explicit PWA support in every app, collaboration
    later, and a simple decentralized app store with multiple catalog URLs.
    Git is a possibility for catalog publication, not a selected requirement.
    This direction is recorded in `design/solid-apps-roadmap.md`; implementation
    remains future work. The update uses a documentation branch without
    opening a new implementation cycle.
37. The maintainer requested that the Muze architecture philosophy be read and
    included in this repository as another engineering culture document. The
    complete parent-directory guide was read and copied unchanged to
    `ARCHITECTURE-PHILOSOPHY.md`; AGENTS.md and `.spiral/culture.md` now reference
    that copy, with source dates and a checksum recorded in the culture index.
    This makes the existing adoption self-contained.
38. The maintainer agreed to a new cross-origin resource-picker cycle: Launcher
    asks an already-open Files app to select a resource, and receives its URL.
    The roadmap/culture documentation was confirmed merged on remote main at
    `4c8b285`. Cycle CYC-20261101-QG24H-2 starts there on its own branch and
    continues the broker roadmap with explicit, manually provisioned scoped
    routing. The result is implemented and automated verification is recorded
    in the cycle; human acceptance is pending. No agent merge is authorized.

39. During evaluation the maintainer questioned the server bottleneck and
    proposed a service worker, then selected Launcher itself as browser-local
    broker and workspace owner. Ordinary opener access is explicitly accepted.
    SRC-20261101-QG24H-8 retains the revised commitment; REQ4 and DES9 replace
    the server architecture for this still-Active cycle. Managed apps close and
    restore with Launcher. State updates remain local; explicit Save & close
    acknowledges a conditional Pod checkpoint before closing. Browser-X saving
    is a bounded best-effort keepalive attempt, not confirmed success. Named
    workspaces and full offline/PWA/app-data sync remain future work.

Conversation/documentation language: **English**, explicitly requested by the
maintainer. Conversation preference: ask **one question at a time** until intake is
finished. Persist answers and continue through the remaining topics without
presenting a bundled questionnaire.

Required intake topics and the additional warning-profile decision have
explicit dispositions and the maintainer confirmed the complete frame.
Next determine the roadmap's actual implementation position and compare the
confirmed UI/UX, developer experience and risk frame with evidence. Present
candidate findings for human prioritization before selecting a development
cycle. Intake completion does not imply acceptance of those findings or
authorization of a product implementation cycle.

## Initial reality assessment

The [initial assessment](reality-assessment.md) compares the confirmed frame
with code, documentation, the passing browser suite and a disposable launch
probe. It places the governing roadmap before Phase 0 exit and presents three
unprioritized candidates: establish the actual launch context, obtain
live-provider connection evidence, and collect UI/UX and developer-experience
observations. The maintainer subsequently reported successful connection and
authentication with solidcommunity.net and selected the launch-context
candidate. UI/UX/developer observations remain unprioritized; the concrete
launch-contract cycle is being formed. Intake remains Complete.

## Intake boundary

This is intake setup, not a normal development cycle. Repository documentation
is evidence for a proposed frame, not proof of current runtime behavior or
human acceptance of future designs. After all topics are dispositioned and
the maintainer confirms the frame, assess reality and present candidate risks
for human prioritization before choosing a development cycle.

## Managed workspace evaluation correction

The maintainer recovered a Pod-conflict error after Save & close appeared inert.
FBK11 traces the missing recovery path; DES9 and IMP6 now provide retained status,
review of local/Pod versions and explicit conditional resolution. EVD12 verifies
reload recovery and newer-remote-version refusal. The original differing Pod
version's cause is unknown, and choosing the maintainer's version remains their
UI decision. The active cycle has not been accepted or merged.

The next maintainer evaluation reported an app checkpoint timeout (FBK13).
IMP6 now separates ready/restoring state, allows ten seconds, identifies failed
apps and reconnects current-client ports without replaying saved state over live
drafts. EVD14 verifies slow capture, stale-port recovery and failure preservation.
Existing open tabs may require reload to use the correction. Actual user-case
attribution and human acceptance remain pending in the same Active cycle.

FBK15 adds decisive provider response evidence: CSS PUT 205 omits ETag while
its corrected authorized GET 200 returns and exposes a strong ETag. IMP6 now
separates acknowledged saves from next-write validator acquisition and persists
a target-scoped baseline. EVD16 verifies the exact pattern throughout the browser
fixture, without accessing the user's Pod. Human acceptance remains pending.

## Mandatory native Turtle rule, 2026-11-01

The maintainer initially forbade writing JSON inside any Turtle string, then
explicitly authorized only the narrow experimental app-owned exception below.
Turtle remains the native persistence format for Solid Apps.
Use native RDF statements, terms and typed scalar values, including for workspace
state, local caches, baselines, fixtures and migrations. If an appropriate native
representation cannot be found, explain the concrete issue and resolve it with
the maintainer before writing. No general rdf:JSON exception is allowed. The source
is SRC-20261101-QG24H-17; AGENTS.md and culture.md now retain this hard rule.

At that instruction, workspace persistence violated the rule in both Pod
snapshots and the local cache/baseline. DEF18 retained that known noncompliance
as a condition of the earlier cycle acceptance. SRC24 subsequently authorizes
its correction without migration because nothing has been released. DES25 and
the current IMP6 now use native workspace/app state and baseline graphs. A new
native cache leaves development records untouched; old-format Pod targets are
refused rather than copied or silently overwritten. Fixtures now use native RDF
and the full application/browser checks are available again. Historical
acceptance does not pre-accept this new correction or authorize merging it.

The maintainer also explicitly permits a separate app-owned opaque state string
for app-specific state that is not linked data. The workspace/broker must preserve
that value without interpreting it; the main state remains native linked data.
SRC17 retains the instructions and explicit exception: this optional app-owned
field may experimentally contain JSON, solely to test interoperability. The
maintainer considers that ugly and expects others to object. This is not a
preferred persistence pattern and does not exempt main state, whole-workspace
snapshots or baselines. No runtime encoding change or migration is implemented
by the documentation update.


## Cycle acceptance with an open native RDF issue

On 2026-11-01 the maintainer explicitly accepted CYC-20261101-QG24H-2 provided
the native RDF correction is kept. DEF-20261101-QG24H-18 is retained as Open;
ACC-20261101-QG24H-19 records the acceptance and known gap. That snapshot was accepted,
with no claim that the format has been corrected or the native Turtle rule waived.
The starter page remains deferred. A subsequent request for file-selector test
instructions does not establish a manual picker result; automated coverage is
retained in EVD16. No merge, publication or next cycle is authorized here.


The maintainer's subsequent manual picker check found that routing works but
Files is not focused. They explicitly keep focus and built-in on-demand Files
startup in CYC2. FBK20 records the reproduction and scoped revision; current
cycle status is Active again, while ACC19 preserves the earlier acceptance.
Provider registry work remains later and DEF18 remains Open. Verification of
this routing/UI correction must avoid the known JSON-in-Turtle serializer.

IMP6 now provides the scoped one-click Files flow (implementation 2167765).
EVD21 verifies cold/warm provider activation and selection/cancel routing through
isolated fixtures that do not invoke the forbidden persistence encoder. Return
focus to Launcher is requested but browser-dependent; Chrome headless refused it,
so the UI includes manual-return guidance. Full persistence suites remain pending
native RDF fixture correction under DEF18. CYC2 stays Active for renewed human
evaluation; prior ACC19, the open RDF issue and deferred starter page are retained.


## Native RDF correction in the continued cycle

The maintainer subsequently verified the picker-return/auth-popup correction,
then requested implementing DEF18. SRC24 explicitly removes migration because
the prototype is unreleased. DES25/current IMP6 use native workspace/app state,
local cache and acknowledged-baseline graphs. Old development cache records are
left alone; old-format Pod targets are refused and require a fresh URL. Native
unknown statements, identities, state isolation and the optional opaque string
are preserved, including during conflict and save-timing failures. Full check
and browser suites now run on native fixtures. DEF18 is fixed on the branch;
CYC2 remains Active for renewed evaluation, without merge or publication.


## Unknown-predicate default and existing workspace recovery

SRC27 supersedes the fresh-URL workaround. The maintainer confirms ignoring
unknown predicates on read and preserving them on write as the linked-data
default. They explicitly authorize discarding the retired apps:snapshot at the
current workspace root on an explicit conditional native save. Readers ignore
its value without importing it, other unknown RDF stays intact, and background
close cannot perform this one-time discard. Reload Launcher and use Save to Pod
at the existing URL; no Preferences change is needed. The no-JSON-in-Turtle rule
remains in force, with only the existing opaque app-owned string experiment.


## Unordered product roadmap additions after PR #3

SRC31 records the maintainer's next-cycle input without selecting or starting a
cycle. The suite roadmap now includes fewer avoidable 401 challenges (Metro force
authorization/protected-origin learning to evaluate), account-name opening/reusing
the Profile editor, common versus current-app preferences, multiple workspace
creation/selection, a sparse shortcut dashboard, a suggested add-shortcut dialog,
and a static Turtle catalog index plus per-app manifests including stable external
Solid apps without requiring ecosystem APIs. Existing Theme/Text size controls
are retained as common preferences; storage belongs to the app-specific section.

The maintainer explicitly confirms that closing Launcher still closes managed
apps. Only Launcher logout additionally closes the whole workspace; child-app
logout does not. The dashboard is interpreted as Launcher home, seeded only with
Files links for every profile-advertised storage root. The list is unordered;
these refinements do not reorder broker phases or implement an app store now.
Third-party curation/availability and exact auth policy remain future-cycle work.

The maintainer also confirms that the account-name Profile action reuses an open
editor, or follows the existing tabs/windows preference when opening one. The
roadmap's presentation question is resolved; no special forced-window override
is planned for this action.


The maintainer's confirmed PR #3 merge is recorded in ACC32. CYC2 is now Accepted
in current metadata; this post-merge documentation reconciliation does not claim
that acceptance/integration validation was recorded before the merge. EVD30's
intermittent combined-browser readiness failures remain unresolved evidence.
The documentation branch does not itself start another cycle or perform a merge.


## Current refactor cycle, 2026-11-07

Preferences CYC33 and shared/minified bundles CYC34 are Accepted and merged;
main was 45cf58e at the start of this interaction. After roadmap/risk review,
the maintainer selects consistent stack usage and the moldable design as the
next suite-wide refactor. They explicitly direct applying poef/solid-apps' already
visible pattern across all apps/packages, without a separate proof/pilot gate.
CYC-20261107-QG24H-37 is Active on its matching branch. SRC38/DES39/IMP40/EVD41
retain scope, implementation and verification. The IDE and unrelated broker/
workspace/auth feature changes remain deferred. New policy clarifies using jaqt
with SimplyFlow models where it simplifies the code. Existing library contracts,
RDF preservation, tests and human acceptance requirements remain in force.
No acceptance, commit, merge or publication is inferred from implementation.


## Moldable suite cycle accepted, 2026-11-07

The maintainer explicitly accepts CYC-20261107-QG24H-37 and authorizes marking,
committing, merging to main and pushing it. ACC-20261107-QG24H-48 records this
closure, superseding the Active/pending state above. For this cycle, that direct
instruction replaces the usual PR route; pre-merge validation still applies.
The accepted implementation/evidence is 24e48e4d0adc33d3bc3a87b5a57fa5eee0b193fc.
Runtime template composition remains a recorded future investigation, with
build-time expansion sufficient for now. No next cycle or IDE implementation
is selected. No product changes follow the final passing EVD47 checks.


## MVP UI roadmap addition, 2026-11-07

After accepting and merging CYC37, the maintainer requests an MVP UI closer to
poef/solid-apps, removal of testing-oriented interface elements, and more shared
design components such as dialogs and dropdown menus. The suite roadmap records
this future work and requires reading https://lawsofux.com/llms.txt during its
design/implementation. That resource was retrieved and read for this update.
No cycle, control-removal list or delivery priority is selected. This change is
documentation only and does not extend the accepted refactor cycle.


## Readability for people altering their apps, 2026-11-07

The maintainer clarifies the ultimate goal: apps should be easy to alter using
the moldable IDE, including by people without a professional programming
background. They explicitly ask for self-explanatory code and avoidance of clever
programming tricks. AGENTS.md, the moldable design and suite roadmap now record
this as an app-authoring requirement today. Prefer descriptive names and clear
steps/effects; use existing library APIs without adding unnecessary indirection.
This documentation update does not start a refactor or new implementation cycle.


## Second-stage direction: virtual company, 2026-11-07

The maintainer requests a second roadmap stage after the current work, centered
on a "virtual company": Solid apps that help people come together and form a
temporary collaboration to get work done. The explicitly non-exhaustive
capability list includes project management, CRM, documentation / knowledge base,
forms, chat and collaboration. The maintainer clarifies collaboration as live
propagation of shared-data changes between participants, with the corresponding
views updating, rather than collaborative text editing. The suite roadmap
records this outcome and stage order without selecting a delivery mechanism,
app boundaries, architecture or dates. Multi-user collaboration belongs to the
second stage; current same-user sync/account consistency work remains in scope.
No implementation cycle is selected by this documentation-only update.


## Active UI/capability cycle, 2026-11-07

The maintainer confirms the MVP UI work, specifying common dropdown, dialog and
list/details design components, clear menu highlighting, visible dialog footer
actions and prefixed globally visible names. They then propose using capabilities
with a dialog/iframe host, making profile editing another capability, and confirm:
"Agreed, lets see if we can make it work." This supersedes the earlier own-profile
new-tab preference and scoped embedding deferral. CYC49/SRC50/DES51 retain that
commitment on spiral/CYC-20261107-QG24H-49-capability-dialog-ui, from main 7fabcc1.
The existing uncommitted assessment update is retained on this branch.

The cycle uses a shared private solid-design package based on the-ds, keeps
SimplyFlow rendering and provider-owned Metro/native RDF writes, and adds scoped
transient provider connections through Launcher. Profile editing and Files
selection use the dialog, with a tab continuation when framing fails. No general
registry, recipient capability, stage-two collaboration, auth-policy rewrite or
live IDE is included. Runtime composition remains separately deferred. IMP52/EVD53
will retain final implementation/evaluation; human acceptance remains pending.
No commit, merge or push is authorized by this implementation instruction.


## UI/capability cycle acceptance, 2026-11-07

The maintainer accepts the integrated CYC49 result: "Very happy with that. Mark
it accepted, commit and merge it to main! :)" ACC66 records this acceptance and
exact implementation/evidence references. CYC49 is now Accepted, superseding the
Active/pending state above. The request authorizes a direct local main merge for
this cycle instead of the normal PR route. No push or package publication is
requested. EVD65 retains the final checks and earlier failures/limits.

The accepted result includes provider-owned Profile/Files dialog tasks and tab
continuation, shared design components, accessible menus/toasts, stable loading,
provider readiness and 300ms content/dialog transitions with reduced motion.
Native RDF, conditional writes and guarded draft/save close behavior remain.
Session-renewal authorization and its recovery UI are retained future roadmap
work, as are named workspaces, registry/recipient work, automatic sync/PWA,
runtime composition/live IDE and stage-two collaboration.


## Session renewal/recovery cycle, 2026-11-07

After CYC49 acceptance, the maintainer explicitly selects session renewal and
recovery, then confirms "Yes, use refresh-first recovery" following the current
behavior/gap checkpoint. CYC-20261107-QG24H-67 is Active on its matching isolated
branch. SRC68/DES69/IMP70/EVD71 record the selection, confirmed boundary,
implementation and evidence. No commit, merge, push or publication is requested.

Keep Metro responsible for tokens, silent refresh, discovery, OIDC/DPoP and HTTP.
The suite requests supported offline authorization with consent, supplies shared
sign-in recovery, and retains drafts/conditional saves. Narrow bridges cover
structured refresh rejection, lazy authorization parameters and request-scoped
cancellation. Same-origin renewal updates waiting apps without replacing drafts.
Hidden-iframe authentication and broader account/logout ownership remain later.
Synthetic provider checks do not establish live refresh-token issuance, and
human acceptance remains pending. Previous cycle acceptance does not accept this
implementation. Original app/Preferences UI roadmap additions are preserved.


## Session recovery cycle accepted, 2026-11-07

The maintainer explicitly says: "You can mark this cycle as accepted, commit and
merge to main and push." ACC72 records acceptance of CYC67 implementation and
evidence at be9c1261a7e49177512e84bc9e6d5e019ee1fbb3. CYC67 is Accepted,
superseding the Active/pending statements above. This authorizes direct local
main integration instead of a PR, and pushing main; it does not request package
publication. Product code remains at the final passing check/browser snapshot.

The accepted work includes refresh-first recovery, preserved drafts/conditional
saves and cancellation, shared authorization updates and animated shared toasts.
Live recovery was confirmed by the maintainer; refresh-token issuance itself is
not proven. The reported Preferences ETag/repeated-save failure and unexplained
prefs.ttl URL, and a shared form visual language, are retained future roadmap
work. They are not fixed or waived by accepting this cycle. Hidden-iframe sign-in,
broader account ownership/logout and the remaining app UI work stay deferred.


## Solid Workbench naming and onboarding direction, 2026-11-07

After accepting/merging/pushing CYC67, the maintainer reports renaming the GitHub
repository to solid-workbench. They request "Solid Workbench" as the Launcher's
name and solid-workbench as the local directory name. CYC73 is Active on
spiral/CYC-20261107-QG24H-73-solid-workbench-name for this small display/checkout
rename, with direct maintainer intent as its confirmed goal. IMP74/EVD75 retain
execution and verification. Existing URLs, persisted/package IDs and historical
Spiral artifacts remain stable. No commit, merge or push is requested here.

The maintainer also reaffirms multiple workspace support and user switching,
already present in the suite roadmap. On app/Workbench startup, unsigned-in users
should receive a sign-in/sign-up style dialog. Sign-up must be designed first
around a decentralized system, including provider/account/data choices. These
are roadmap additions only; the rename does not implement them or silently
replace local-only/anonymous flows. Their concrete interaction design remains
future work.


The maintainer's CYC73 feedback revises the app URL to /workbench/ as well as
its display name. They explicitly decline backwards compatibility and can
remove their old workspace.ttl themselves. Generate no /launcher/ alias and
remove only the retired build output; do not touch Pod data. The roadmap also
records shorter swb-/swb_ suite-owned UI prefixes, with actual collision-based
qualifiers and a later coordinated refactor rather than a mass rename now.


## Solid Workbench naming accepted, 2026-11-07

The maintainer confirms "Works fine, commit, merge and push". ACC76 records
acceptance of CYC73 implementation/evidence at
7a3e660b58c64d51e9bc9d4c01467f397e6ad1b8. CYC73 is Accepted, superseding its
Active/pending state above. The request authorizes direct normal main integration
instead of a PR and pushing main; no package publication is requested.

The accepted name and canonical route are Solid Workbench and /workbench/.
The old generated /launcher/ entry is removed without compatibility or Pod-data
migration, as explicitly requested. Origin and local checkout use solid-workbench.
Workspace switching, startup sign-in/sign-up with decentralized signup design
first, and swb-/swb_ UI prefix refactoring are recorded future roadmap work.
No new implementation cycle or delivery order is selected by this acceptance.


## Standing feature guardrails confirmed, 2026-11-07

The maintainer proposes avoiding feature-heavy apps in favor of focused apps,
considering local-first/mobile-first for every feature, declining features whose
core task cannot be made accessible, and keeping the download for meaningful
interaction small enough for slow connections. After discussing concrete checks,
they explicitly answer "agreed".

AGENTS.md, the suite roadmap and moldable design now record those constraints,
including the existing readability requirement. Each cycle briefly states and
evaluates app boundaries, offline/recovery behavior, phone interaction, accessible
interaction and download impact. The existing complete-graph limit below 200000
bytes of gzipped JavaScript per app remains a ceiling, not a target; first-use
assessment also covers other assets, required requests and usable core tasks on
a cold cache. No new numeric total-transfer/time limit is invented.

This documentation-only agreement selects no implementation cycle and does not
claim existing apps already satisfy full offline, accessibility or first-use
performance requirements. No product code, tests, build configuration or budget
enforcement is changed. No commit, merge or push is requested.


## Preferences save recovery selected, 2026-11-07

The maintainer confirms the proposed reliable Preferences cycle: "Ok, lets do
that." CYC-20261107-QG24H-77 is Active on its matching dedicated branch from
accepted main 71d2737d5e7203188f503b50d184d606556f2c8f. DES78 records the confirmed
save/recovery intent and actual-API probes; IMP79/EVD80 retain implementation
and evaluation. This continues the Preferences reliability roadmap item.

The implementation distinguishes acknowledged writes from acquiring the next
ETag, reacquires a missing strong validator only after whole-RDF comparison,
keeps conditional writes, and preserves unknown native RDF in Preferences.
The dialog retains choices through failed requests and offers explicit Pod
review/restore of user edits. It removes the bare source URL. Existing session
renewal/recovery remains reused. No dependency, automatic sync, full offline
startup or reload-persistent Preferences draft cache is added. Those local-first
limitations remain explicit; wider forms styling is a separate roadmap item.
Human acceptance, commit, merge and push have not been requested for CYC77.


## Preferences saving and recovery accepted, 2026-11-07

The maintainer confirms saving twice in succession and working toasts, explicitly
accepts CYC77, and requests commit, merge and push. ACC81 records acceptance of
IMP79 at 6dcbb5ab117d29731aaedafa3aa4056b20ffd1e7 and EVD80 at
0fbe7861d62f76b636e9a883436945090e5aab7e. This supersedes earlier pending and
no-commit entries; normal direct main integration and push are authorized. No
package publication or new cycle is requested. The guardrail documentation is
included; the unrelated untracked Moldable-Solid-Apps(3).md is preserved outside
the commits. Reload-persistent Preferences drafts, full offline startup, automatic
sync and wider forms design remain future work; accepted fixtures do not establish
live-provider internals or a screen-reader user study.


## Dependable action replacement selected, 2026-11-07

After the roadmap/review analysis and a reproduced installed-action-proxy gap,
the maintainer answers "agreed" to the recommended current-action cycle. CYC82
is Active on spiral/CYC-20261107-QG24H-82-current-action-dispatch, mechanically
verified from accepted main 473dda5ee37811ec232db575009f55c3f5799819. DES83/IMP84/
EVD85 retain the confirmed goal, design, implementation and verification.

Reconcile relevant design expectations, make existing widget/host/callback/event
connections invoke current effective actions, and test restoration with data and
cleanup intact. Use the mutable public SimplyFlow action table and limited
invocation-time forwarders; source metadata remains separate from applying a
runtime definition. No library/dependency change or second runtime is needed.
The IDE personal-layer manager, persistent overrides, live templates, automatic
model recomputation, CSS ownership and lower-level lifecycle binding remain
future work. This continues stage-one moldability and defers broker progression
for this cycle. Pending roadmap/review documentation is preserved; the unrelated
untracked Moldable-Solid-Apps(3).md stays untouched. No acceptance, commit, merge,
push or publication is authorized by the cycle selection.


## Dependable action replacement accepted, 2026-11-07

The maintainer answers "accepted" after the CYC82 result, tests and manual review
steps are presented. ACC86 records acceptance of the current evaluated working
tree described by DES83/IMP84/EVD85; CYC82 is Accepted. Earlier Active/pending
statements are superseded. No claim is made that particular manual review steps
were performed, and no commit, merge, push, publication or next cycle is requested.
The recorded IDE/CSS/lifecycle ownership/model/template/persistence follow-ups and
shared Preferences propagation remain future work.


## Current-action cycle delivery authorized

After accepting CYC82, the maintainer explicitly requests commit, merge and push,
then a next-cycle suggestion. ACC86 links implementation
280632b2019b255acab46f0f0f06d605a479e7d8 and evidence
fdff81b5dd6aa19d11b8812c69dd89c9219327b9. Normal direct main integration and push
are now authorized, superseding acceptance-only restrictions. No publication,
history rewrite or new implementation cycle is selected. The proposed next step
is component-owned styles following the review, subject to style-update API and
bundle-cost investigation; shared Preferences propagation remains the immediate
user-facing alternative. See the next-cycle assessment for scope and limits.


## Style ownership cycle selected and API gap investigated, 2026-11-07

The maintainer answers "agreed" to moldable style ownership. CYC87 is Active on
spiral/CYC-20261107-QG24H-87-moldable-style-ownership from accepted main
a4422ec5de08c823cf6b2831aee9d383ae191733; the branch was mechanically checked.
The unrelated untracked design/Moldable-Solid-Apps(3).md is preserved.

DES88/EVD90 record current installed/published APIs, the real built-app style
mutation probe, a source ownership map and cascade/budget constraints. The full
CSS is already exposed as suiteAppearance and embedded in JS, as well as copied
to apps.css; source ownership needs splitting, not inventing metadata availability.
SimplyFlow app 0.10.3 (current npm version; facade 0.10.4) installs styles only at
construction. Mutating named source changes neither the installed style nor
computed appearance. Lower-library live support versus source-only migration
with explicit deferral is a pending scope choice. No app-owned renderer, external
repository edit, dependency change or release is inferred. Product code remains
unchanged while required clarification is pending; no acceptance/commit/merge/
push/publication is authorized by the cycle selection.


## Style element linking resolves the ownership cycle's API question

The maintainer clarifies: "SimplyFlow also add style elements with an id linked
to each named style. So the IDE can easily find the linked style element and
update that as well." This supersedes the earlier library-support-first framing:
CYC87 proceeds with existing SimplyFlow style installation and its named element
IDs. The future IDE coordinates source overrides and those elements; this cycle
adds no app-owned updater, new library API, dependency or publication.

Feature-owned CSS is split into named styles with authored source origins; shared
foundation/control/layout rules remain in shared components. The coarse CSS file
and duplicate apps.css link/copy are removed while the external the-ds sheet
remains. Browser checks simulate IDE source/element editing and in-place removal,
keep component originals and unsaved drafts, and compare loaded cascade/layout
against the pre-refactor workflows. Broader forms redesign, mass prefix renaming,
actual IDE UI/persistence and lifecycle ownership remain future work. Human
acceptance, commits and integration remain pending.


## Feature-owned styles accepted, 2026-11-07

The maintainer explicitly requests "accepted, commit, merge and push please".
ACC91 records acceptance of CYC87, implementation e26e6570b77df9dda2cba47d314bf124ffb1dd1d
and evidence c773d7e29ce9c2c8591c76474ef39cb4d87f701d. CYC87 is Accepted, superseding
earlier Active/pending statements. Normal direct main integration and push are
authorized; no package publication, rewritten history or next cycle is requested.
The existing style-ID mechanism, named feature ownership and checked layouts/data
are accepted. The documented workspace timing concern remains unresolved; the
final pass does not erase its evidence. The unrelated untracked design copy is
left untouched.


## Lifecycle ownership cycle: design first, 2026-11-08

The maintainer agrees to the lifecycle-ownership recommendation and explicitly
requests design and discussion before implementation, as part of the same cycle.
CYC-20261108-QG24H-92 is Active on its mechanically verified matching branch from
main fd7a6e6b943c1d862110107bb0353ba91bd3d3c6. SRC93 retains the instruction;
DES94 proposes the library-owned binding contract and first migration boundary.
Its API, activation semantics and lower-library scope remain for discussion.
No product/dependency change, external library edit/release, commit, merge or
push is authorized by this design phase. Preserve the pending assessment and
unrelated untracked design copy. This continues stage-one moldability; further
broker progression and stage-two documents/signing work remain later.


## CYC92 design clarification: separate event package, 2026-11-08

The maintainer selects an events section supported by a separate experimental
package injected into Workbench's SimplyFlow composition. Integrating it into
SimplyFlow core is deferred until it proves useful. SRC95 retains the decision;
DES94 now proposes a private workspace package with explicit installation and
package-owned activation/disposal. This supersedes the upstream-first design
option. API details remain in discussion; no implementation, publication or
external repository changes have started.


## CYC92 implemented and ready for evaluation, 2026-11-08

After choosing the package boundary and custom EventTarget/subscription support,
the maintainer confirms “Ok, lets try this design” (SRC96). This supersedes the
earlier design-only restriction. IMP97 implements the private experimental
simplyflow-events package and four Workbench/account event migrations; EVD98
records final passing checks, all five Chrome suites, custom-source/lifecycle
contracts and measured costs. No core SimplyFlow or external version change.
The actual branch matches CYC92. Human acceptance remains pending; no commit,
merge, push or publication is authorized. Previously retained workspace timing,
full offline/reload-draft, account ownership and IDE follow-ups remain future work.


## Lifecycle event extension accepted, 2026-11-08

The maintainer requests “accepted, commit, merge and push please”. ACC99 records
acceptance of CYC92, IMP97 at 08c7eaf78c109dadccb31a1f9d1364ae7a070003 and EVD98
at 8988e5f753461c23fb9bfdc8062d2dd672057a04. CYC92 is Accepted, superseding earlier
Active/pending/no-commit statements. Normal direct main integration instead of a
PR and pushing main are authorized; package publication, core integration and a
new implementation cycle are not requested. Existing limits/failures remain in
evidence, including narrow download headroom and the unresolved workspace timing
concern. No product change follows the final passing evaluation snapshot.


## Launcher target UI before readability refactor, 2026-11-08

After CYC92 integration, the maintainer corrects the proposed next-cycle example:
workspace status is diagnostic/debug information, and the actual eventual
Launcher UI needs a clear design before refactoring it. The readability-first
recommendation is superseded. The assessment/roadmap retain the sparse everyday
home direction and distinguish technical diagnostics from necessary user-facing
save/permissions/recovery flows. No new cycle or implementation is selected;
a debug panel is a design possibility, not an approved implementation.


## Workspace home-screen discussion; cycle choice open, 2026-11-08

The maintainer explicitly asks to leave the cycle decision open. Their direction
is a desktop/phone-like Launcher, manifest-provided recognizable icons that users
can change, named workspaces with their own launcher/icons and editable title,
and a default Solid Workbench workspace for new users with Files shortcuts to
defined storage endpoints. They suggest a workspace list in the Launcher's
dropdown, revisiting the earlier Preferences-only placement; placement is still
a proposal. An app-store entry comes later. Startup widgets inspired by Windows
8 Metro are a stretch goal outside the MVP.

Work, Private and interest-based workspaces may have their own contacts, storage,
preferences and apps. Whether these contexts share identity/default settings,
how app data contexts are selected and what happens to open apps on a switch
remain open. Do not silently choose separate WebIDs, copied datasets, simultaneous
workspace operation or a widget execution/authority model. The suite roadmap
retains this direction and distinguishes proposals from settled constraints.
No cycle, implementation, commit, merge or publication is requested here.


## One selected WebID and workspace switch lifecycle confirmed, 2026-11-08

The maintainer clarifies: “A user should have just one WebID, we need to design
around that assumption. If you have multiple WebID's the system should still
work, but you select just one at a time.” They also confirm that switching
workspace closes the current apps and restores the new workspace's apps.

This settles the two open questions in the preceding home-screen discussion.
Design for one selected identity across its workspace contexts; account selection
is separate from workspace switching. Do not default Work/Private contexts to
different WebIDs or simultaneous active app sets. Preserve owner identity and
recoverable state; checkpoint/close/restore failure ordering remains to design.
Shared settings versus workspace overrides, per-app data contexts, manifest/icon
handling and final menu layout remain open. Cycle selection is still explicitly
open; no implementation, commit, merge or publication is requested.


## Address books, workspace storage and preferences clarified, 2026-11-08

The maintainer confirms multiple selected address books per workspace, with a
default book and reuse across workspaces. Share should open a Contacts-owned
picker like Files selection, initially showing this workspace's default book
and allowing another book. Accessing a book from another workspace inside that
picker is tentative and needs careful design; do not infer an actual active
Workbench switch that closes the requesting app. Recipient selection/sharing
remain future work and no broker phases are reordered.

Profile-discovered endpoints supply the base storage set; workspaces may add
private endpoints without publishing them in the public profile. Shared
preferences stay shared, while app-specific preferences can be workspace-linked.
This rejects the earlier proposed per-workspace common-appearance overrides.
Native linked preferences remain authoritative; representation and standalone-app
fallback are still to design. The suite roadmap records settled direction and
open choices. Cycle selection remains open; no implementation/commit is requested.


## Contacts browsing and explicit search scope confirmed, 2026-11-08

The maintainer answers “yes” to picker-local browsing of another workspace's
address books while leaving the active Workbench workspace unchanged. This
supersedes the tentative status above. For ordinary Contacts they specify:
“show default only, allow switching, have an explicit search across all address
book option, and search across all workspaces as well”.

The normal initial view is the workspace's default book. Switching books and
broader searches are explicit choices. The roadmap distinguishes current-book,
all-books-in-workspace and all-workspaces scopes under the selected WebID;
source labelling, deduplication and incomplete/offline results remain to design.
These choices do not select a cycle or authorize implementation/commit.


## Workspace defaults and management placement clarified, 2026-11-08

The maintainer chooses reusing an existing default address book for a new
workspace, creating one only when none exists. They ask whether this is already
how it works. Read-only code inspection finds Contacts opens one local collection;
explicit Sync attaches it to configured contactsResource or the conventional
apps/solid-apps/contacts.ttl under the first profile storage root. Multiple-book
discovery and workspace initialization are not implemented; do not claim that
finding/creating a default across books already exists.

The maintainer specifies workspace creation and deletion in Workbench-specific
Preferences, with only available-workspace switching entries added to the
Launcher dropdown. This settles the prior menu-placement question. The shared
account menu keeps its existing role. Deletion data retention, active/last
workspace behavior and default-book discovery/creation details remain to design.
Cycle selection remains open; no product implementation or commit is requested.


## Workspace deletion retains linked data, 2026-11-08

The maintainer answers “Yes” to deleting only the workspace's launcher,
shortcuts and workspace-specific settings while retaining address books, files
and other linked data. Shared/referenced datasets must not be deleted as a
consequence of workspace deletion. Active/last-workspace handling and protection
of recoverable drafts remain to design. This is product-direction clarification,
not implementation or a selected cycle.


## Protected default workspace and missing-resource recovery, 2026-11-08

The maintainer specifies that the default workspace cannot be deleted through
our UI. If someone deletes it directly in storage, revert to initial-load
behavior and create a new default workspace. This settles last-workspace
availability through a protected default, without claiming storage-level
protection. Use established initial launcher/default-address-book behavior;
retain linked data. Stable default identity, positive missing-resource evidence,
offline/auth-failure recovery and deletion of an active non-default workspace
remain design details. Do not infer deletion from an unsuccessful read. No
cycle or implementation is selected by this clarification.


## Active workspace protected from UI deletion, 2026-11-08

The maintainer says: “Lets make it impossible to delete the current active
workspace as well, that avoids the whole problem.” Only inactive, non-default
workspaces may be deleted through our UI. Users first switch away using the
normal preservation/close/restore flow; deletion itself does not switch the
workspace. This settles the active-workspace deletion question above. Linked
data remains intact, the default remains protected, and confirmed external
default deletion still invokes initial setup. No cycle or implementation is
selected; details of recoverable inactive drafts remain for design.


## Workspace foundation selected and temporary budget allowance, 2026-11-08

The maintainer authorizes starting the cycle and selects workspace/Launcher
foundation first, deferring multi-book Contacts, cross-workspace search and
recipient capability work. CYC100 is Active on its matching verified branch;
SRC101/DES102 retain product decisions and implementation boundary. After the
readable Workbench graph measures 205233 gzip bytes, the maintainer explicitly
allows budget expansion for now, to revisit later. Use a temporary 215000-byte
ceiling for that variant; other graphs remain at 200000. Keep actual metrics and
retain the budget follow-up. No separate diagnostic app, commit, integration or
publication is selected. Prior cycle-selection-open notes are superseded.


## CYC100 foundation evaluation, 2026-11-08

IMP103 implements the named workspace directory, private workspace app context,
Preferences management, home icons/manifests and protected switching/deletion.
Default book references are reused; multiple-book discovery/provisioning/search
and contact selection remain the next scoped design discussion. EVD104 records
native RDF preservation/recovery, phone/keyboard checks and download evidence.
The matching cycle branch remains isolated and Active awaiting human acceptance;
no commit or integration is authorized. Keep readable Workbench budget reduction
visible despite the temporary allowance. Earlier discussion-only/open-cycle
statements in this document are historical and superseded by the cycle selection.

## CYC100 Launcher UI review correction, 2026-11-08

The maintainer rejects the duplicate title, home switch/save toolbar and expanding
home sections. Retain the original header as the sole active-workspace title;
workspace choices go in its existing dropdown only when there are multiple
workspaces. Add shortcut is an icon tile. Preferences now gives access to a
Launcher-owned Diagnostics dialog; shortcut options use dialogs. Tabs remain an
optional future preference-layout choice. This is a correction inside Active
CYC100, not human acceptance. SRC101/DES102/IMP103/EVD104 retain the design and
verification; no persistence contract, commit or integration is selected.

## Workspace-switch tab activation, 2026-11-08

The maintainer reports restored tabs taking focus. Chrome testing reproduces it;
self-focus and named-context attempts do not regain tab focus after native opens
consume transient activation. After the browser limitation is explained, the
maintainer selects “Keep tabs and accept browser-controlled focus”. Normal tab
restoration remains; ineffective workarounds are removed. This disposes of the
focus requirement without changing app presentation preferences or accepting the
whole cycle. EVD104 retains the failed probes and revised two-app scenario.

## Confirmed Launcher background review, 2026-11-08

The maintainer requests the shared Feather sprite from poef/solid-apps, matching
the-ds SVG/use classes, common menu items first, and distinguishing workspace
icons. They explicitly confirm the proposed workspace-specific backgrounds:
None, six reused preset photos, URL or upload; local image retention through
reload/offline use and upload with Save to Pod. Main state stays native RDF.
A narrow binary CacheStorage bridge fills the installed Turtle-only local-source
gap; Metro owns HTTP. Images use the configured workspace folder's existing Pod
permissions; no new ACL editor or claim of verified provider privacy is added.

The new readable Workbench graph measures 216803 bytes. The existing temporary
budget-expansion authorization is applied with a 220000 local ceiling for that
variant, superseding the prior 215000 cap for this revision. Other graphs retain
200000; budget reduction remains open. CYC100 remains Active, with no overall
acceptance, commit or integration requested. Other repositories are read-only
references; their existing user work is preserved.

## Background failure was a stale server process, 2026-11-08

The maintainer's Photo 6 failure is traced to the old port-4174 dev server still
returning application/octet-stream after JPEG MIME support had been added in
source. Restarting the verified checkout-owned process yields image/jpeg and
passes an isolated actual-server Photo 6 apply/reload check. Keep the image
validation and retained workspace choice. Rebuilding assets does not reload the
Node server's startup configuration; restart it after server changes. The cycle
remains Active and uncommitted.

## Launcher surface refinement, 2026-11-08

The maintainer confirms background loading works and requests transparent title/
icon surfaces with contrasting text shadows. Launcher-only styles now let the
photo extend behind the original header and home shortcuts. White home text and
icons have dark shadows, with a visible two-color keyboard focus outline. Menus,
dialogs and other apps keep their theme surfaces. This supersedes the earlier
opaque-home-panel design while retaining all state/recovery behavior. CYC100
remains Active and uncommitted pending overall acceptance.

## Icon-only backing refinement, 2026-11-08

The maintainer refines the transparent-home look: restore the dropdown marker's
background and make icons readable with fill or a padded background, not a text
panel. Keep shared Feather glyphs with small padded DS accent squares, including
Add shortcut/custom icon images; restore the shared angled marker. Title and
labels remain transparent with shadows. This supersedes the floating-icon/
transparent-marker part of the previous entry. The cycle is still Active and
uncommitted pending overall acceptance.

## Light-mode Launcher foreground, 2026-11-08

The maintainer requests dark home text without text shadow in light mode. The
Launcher now uses the public DS foreground token; only explicit dark mode or
automatic mode with dark OS preference adds the existing shadow. Explicit light
remains shadow-free even with dark OS preference. Padded blue icon boxes and the
filled marker retain their white glyph contrast. This is a CSS refinement within
Active CYC100; no new setting, theme engine or data format is introduced.

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

## CYC100 integrated; CSS review requested, 2026-11-08

Accepted CYC100 is merged into main at
2ab6dbe287bd3a9e3df260a4c04567de54eae215 and pushed, preserving its causal
commits. Exact-candidate integration validation passed with the documented
pinned-Gitlink/manifest-base input adapters and 14 historical references checked.
The maintainer then requests a CSS review/refactor roadmap item. The suite
roadmap records a design-first review of style ownership, cascade, duplication,
theme/focus/background rules and shared/app boundaries, preserving the accepted
UI and existing named editable SimplyFlow styles. This documentation addition
starts no implementation cycle; Contacts enhancements and the temporary budget
follow-up remain open. Unrelated user files are preserved.

## Preferences cycle starts with design, 2026-11-08

The maintainer confirms separate Preferences app/dialog, Ubuntu-like sections
contributed by the calling app, reuse/extension of existing list-details rather
than another CSS component, immediate changes and editing any workspace without
activating it. CYC106 starts on its matching verified branch from main 0912f86;
SRC107 retains decisions and DES108 is the proposed design for discussion.
Current embedded editor/static composition and split save steps leave concrete
gaps. No product implementation begins before design review. This continues
stage-one Preferences UI/propagation while broader CSS review and Contacts
remain separate. No commit, merge, push, publication or external-repo edit is
requested; preserve unrelated user files. Earlier next-cycle-open notes are
superseded by this selection. Causal links to uncommitted new artifacts will be
added only after upstream Git versions exist, without inventing past commits.

## Preferences implementation authorized, 2026-11-08

Following DES108 review, the maintainer says “lets start”. This authorizes CYC106
implementation on its verified dedicated branch. IMP109/EVD110 retain independent
Preferences presentation, existing list-details reuse, app-owned section datasets,
immediate native local edits and conflict-safe synchronization, open-app updates
and inactive-workspace editing through Workbench's sole live writer. Existing
private-port/capability and Metro/document APIs remain in use; no external
library changes or new renderer. General app, managed, picker and session browser
checks have passed during iteration. Final integrated evaluation is pending;
no human acceptance, commit, merge, push or publication is requested. Broader CSS
refactoring, Contacts enhancements and the temporary Workbench budget review stay
future work. Preserve unrelated user files.

## CYC106 ready for evaluation, 2026-11-08

IMP109 implements the separate Preferences app with app-owned section datasets,
existing list-details navigation, immediate native local edits and conditional
synchronization, shared updates and inactive-workspace editing. Workbench keeps
its live writer and diagnostics; the existing capability machinery presents the
editor and hands diagnostics back after closing. No new Preferences CSS component.
Final check passes 157 tests/builds; all six Chrome suites pass, exit 0. EVD110
records screenshots, native keyboard/AX checks, 215215-byte readable Workbench and
187311-byte readable Preferences graphs including callback, network task costs,
uncached-asset limits and the retained intermittent managed-connection failure
with unchanged passing retry. This does not certify every provider/browser or a
manual screen-reader study. CYC106 remains Active awaiting human UI acceptance;
no commit/integration/publication or next cycle is requested. Broader CSS and
Contacts roadmap work and the temporary Workbench budget follow-up remain open.

## CYC106 section keyboard review, 2026-11-08

The maintainer requests the dropdown's Up/Down behavior in Preferences, Enter
activation and Tab into section controls. This is a correction in Active CYC106.
Extend existing list-details with an opt-in shortcut scope; roving focus/ARIA
remain SimplyFlow-bound and row identity is retained. Arrow focus does not
select, Enter keeps keyboard focus in the menu, Tab enters the displayed panel,
and Shift-Tab returns to its selected section. Pointer/phone Back and native
input/select keys remain intact. No CSS component or persistence change.
Source/build and targeted desktop/phone Chrome checks pass; full regression
evidence follows in EVD110. No acceptance, commit or integration is inferred.

The final keyboard correction passes npm run check (157 tests/builds) and all
six suites of npm run test:browser, exit 0. EVD110 records the native desktop/
phone cases and the editable-source shorthand defect caught by full regression;
explicit function notation matches the existing dropdown. Current readable
Workbench/Preferences costs are 216224/189084 bytes, under unchanged caps.
CYC106 remains Active awaiting renewed human review; no commit or integration.


## CYC106 initial-focus and icon correction, 2026-11-08

The maintainer reports non-working Preferences arrows and low workspace icons.
Live server assets match disk with no-store; the observed gap is initial focus
on outer Close while the provider is interactive. A guarded presentation focus
request now focuses the selected section after iframe bindings remove inert,
without moving focus after a user has already interacted. The shared suite
foundation overrides installed DS bottom alignment with svg.ds-icon middle.
Live initial Down and visual menu alignment pass, as do targeted Preferences
and workspace suites and npm run check. EVD110 retains two complete-run timing
failures and independent suite passes; no reliable complete regression pass is
claimed for this final snapshot. Active pending renewed human review; no
acceptance, commit, merge or publication. Refresh the loaded parent Workbench
once to load this presenter and style, then reopen Preferences.


## CYC106 accepted for integration, 2026-11-08

The maintainer retests the latest correction and reports “It works, accepted.
Commit, merge and push.” ACC111 accepts implementation 10f1535 and evaluation
67748e3; the cycle is Accepted, superseding earlier pending notes. Direct normal
merge into main and push of main/cycle branches are authorized. EVD110 retains
full-run timing failures and independent passes without claiming a reliable
complete run. Broader CSS, Contacts and Workbench budget follow-up remain open;
no next cycle or package publication is selected. Unrelated user files excluded.

## CSS refactor selected for next cycle, 2026-11-08

CYC106 is integrated on main at 0ecae17. Following the Browser Styling Guide for
AI source review, the maintainer requests a plan for use in the next cycle.
[css-refactor-plan.md](css-refactor-plan.md) records the selected maintenance
outcome: predictable layers, component-owned variables and DS adapters, flat
namespaced selectors and clear feature ownership, preserving the accepted UI
and named editable SimplyFlow styles. This continues the suite CSS roadmap item;
it does not advance broker phases. Planning is documentation-only; cycle/branch
allocation and implementation remain for the execution handoff. No product
changes, human acceptance of a result, commit, merge or publication are inferred.
Contacts enhancements and the existing Workbench budget follow-up remain separate.


## CSS refactor cycle started, 2026-11-08

The maintainer instructs “Please start this cycle”, confirming the retained CSS
plan. CYC112 is Active on verified spiral/CYC-20261108-QG24H-112-css-refactor
from accepted main 0ecae17. SRC113/DES114 record scope; IMP115 implements explicit
layers, component-root DS adapters, direct namespaced parts, header variants,
flow-sized picker actions and local-only DS stylesheet composition. EVD116
retains baseline, intermediate failures, UI/source/download evidence and final
verification as it completes. Preserve named editable styles, native RDF and
recovery contracts. No acceptance, commit, merge, push or publication is inferred;
unrelated user files and the earlier guide/AGENTS changes remain intact.


## CYC112 ready for review, 2026-11-08

IMP115 implements the selected CSS plan. EVD116 records passing source/build
checks, all six Chrome suites and five-app readable/minified source/style/zoom
contracts. It retains intermediate migration, fixture and Failed-to-fetch failures
without claiming earlier network/timing concerns resolved. All CSS is layered;
DS reads stay in adapters. Editable styles, native data and recovery owners stay
intact. Narrow header/pane and wrapping picker corrections have explicit evidence.
Readable Workbench is 218255 gzip bytes under the unchanged temporary 220000 cap;
all other graphs retain 200000. Source CSS grows with explicit interfaces, and
no speed improvement is claimed. The verified cycle branch remains Active,
uncommitted, awaiting human review/acceptance. No merge, push, publication or next
cycle is selected; manual AT/provider/real zoom limits remain documented.


## CYC112 accepted for integration, 2026-11-08

The maintainer says “accepted, commit, merge and push please”. ACC117 accepts
implementation a0bafd9f4340728f30553c47d6f7af1e53359eb4 and evaluation
bb299d739ccedcce1a0088a68f201f0f0e1fc7a3. CYC112 is Accepted, superseding
pending review/no-integration notes. Delivery commits record exact prior versions
without changing product files or inventing past approvals. Normal direct merge
into current main and push of both branches are authorized after exact-candidate
validation. Evidence/review limits and the temporary Workbench budget follow-up
remain; no next cycle or package publication is selected. Unrelated files excluded.

## Provider-preferences planning, 2026-11-09

CYC112 is integrated on main at 7e731a9. The maintainer agrees with continuing
broker Phase 2, but explicitly requests planning before implementation. They
confirm one picker-provider choice shared across workspaces under the selected
WebID, with both capable installed-app selection and custom app URL entry.
[provider-preferences-plan.md](provider-preferences-plan.md) records the source
inspection, proposed native registry, current presenter/broker reuse, recovery,
authority boundaries and evaluation. The exact meaning of installed apps and
registry representation remain proposals for review. No implementation cycle
or branch is allocated, and no product change, commit, integration or publication
is authorized. Contacts Phase 3 and original Workbench budget restoration remain
separate. Preserve unrelated user files.

## Provider-preferences cycle authorized, 2026-11-09

The maintainer says “Agreed, lets start” after the plan review. CYC118 is Active
on verified spiral/CYC-20261109-QG24H-118-provider-preferences from main 7e731a9.
SRC119/DES120 retain authorization and design; IMP121/EVD122 retain implementation
and evidence. Use the current-workspace known-app list and co-located registry
as agreed. The early download checkpoint may require replanning; no cap expansion
is inferred. No commit, merge, push or publication requested. Preserve user files.

## CYC118 early budget checkpoint, 2026-11-09

Native provider binding/cache/conflict support, current-broker resolution and
saved-app handoff are prototyped. Final 23 test files pass, but npm run check
fails at readable Workbench 220033 bytes against the unchanged 220000 cap.
The provider Preferences UI and manifest capability support are not implemented.
Per the agreed plan, return to a budget replan before feature expansion; do not
infer an increased allowance. EVD122 retains failed attempts and isolated picker
Chrome passes. CYC118 stays Active and uncommitted, without acceptance or
integration authorization. Preserve user files and existing public picker API.

## Explicit checkpoint allowance, 2026-11-09

The maintainer says “I'll allow the extra 33 bytes :)”. Readable Workbench may
now measure at most 220033 gzip bytes; the existing strict less-than-200000
limits for other graphs stay unchanged. This resolves the early checkpoint and
authorizes continuation of CYC118, not a general budget waiver or acceptance.

## CYC118 implementation ready for review, 2026-11-09

IMP121 implements shared Default apps preferences, capable current-Launcher app
selection/custom URL/reset, native provider bindings with whole-choice conflicts,
current-broker resolution and existing iframe/tab fallback. Fields/drafts survive
local recovery; unknown RDF and other capabilities remain intact. Files declares
browse support. A feature-local wrapping rule addresses 200% text cropping.

npm run check passes 23 test files/both builds. Final readable Workbench is
219996 bytes, Preferences 197545, within the explicit 220033/200000 limits.
EVD122 retains an earlier full seven-suite pass, final passing observations for
six suites, final full-run session/managed timing failures and a session attempt
terminated after more than three minutes. Reliable final full-run completion
remains unresolved; no authentication fix is claimed. The provider scenario has
readable/minified parity checks with native caller activation for browser-controlled
tab focus. CYC118 is Active awaiting human evaluation, not Accepted. No commit,
merge, push or publication requested. User files preserved; Contacts/Phase 3 and
broad budget restoration remain future work.

## Cross-app recovery and shared account status requested, 2026-11-09

The maintainer requests roadmap additions after observing sign-in recovery in
Preferences clear its own message/button while Launcher's sign-in message stays
until reload. Investigate successful-sign-in notification delivery and handling
across open apps; do not assume a missing message is the established cause.
They also request an icon or bare status button beside the shared header's
user name, opening a connection/account dialog for connect, disconnect, logout
and account switching. The suite roadmap retains both outcomes, state/ownership
and draft-preservation constraints, and verification scenarios. These are future
work, not CYC118 scope expansion, human acceptance, implementation or authority
to commit/integrate. Existing work and unrelated files remain intact.

## CYC118 accepted for integration, 2026-11-09

The maintainer says “accepted the cycle, commit, merge and push please”. ACC123
accepts implementation 11157eb577c6a6c93a88bc4e041ac4cc16b3d47f and evaluation
e642d3a25bf05b12febdddef6f408553bb268db8. CYC118 is Accepted, superseding pending
review/Active notes. Exact prior versions are recorded during delivery without
product changes or invented approvals. Direct normal merge into current main
and push of main/cycle branches are authorized after exact-candidate validation.
The recorded session/managed regression limits remain; no authentication fix or
new cycle is selected. The requested status/recovery roadmap additions remain
future work. Unrelated user files stay excluded; no publication is requested.

## Application icon family requested for adoption, 2026-11-09

The maintainer requests inspection of design/solid-workbench-icons.zip and a
roadmap item for its use as favicons, Launcher icons and eventual app-store
artwork. The archive's README, SVG sources, PNG/ICO sizes and rendered preview
were inspected: twelve cobalt/coral app icons, standalone SVGs and symbol sprite,
16/24/32/48-pixel PNGs and four-size ICOs. The suite roadmap records adoption
through existing manifest/icon paths, preservation of user/external icons and
phone/theme/background/accessibility/download checks. The maintainer clarifies
that Preferences is only used in the dialog iframe and needs no application
icon, favicon, standalone Launcher entry or app-store listing. Earlier
standalone-use descriptions are superseded as presentation direction. This is documentation-only
future direction; no new cycle, app implementation, asset installation, commit
or publication is selected. The archive and unrelated user files remain intact.

## Account-status cycle selected, 2026-11-09

The maintainer agrees to shared account status and sign-in recovery next. CYC124
is Active on verified spiral/CYC-20261109-QG24H-124-account-status from integrated
main 0b42eb7. This deliberately pauses broker Phase 3 for reported recovery and
shared account UI. SRC125/DES126/EVD127 retain intent, proposed design and source
inspection. Existing shared token/storage notifications already exist; a missing
broadcast is not established. Disconnect and managed switching semantics remain
under clarification, with investigation/design before product changes. Only
37 readable Workbench bytes remain under the current allowance; no expansion is
inferred. No product change, acceptance, commit or integration requested. Preserve
pending icon roadmap edits and unrelated user files.

## CYC124 scope answers and recovery reproduction, 2026-11-09

The maintainer chooses Disconnect for all apps of the selected account and
Workbench coordination for managed switching. DES126 retains these choices and
proposes the remaining distinction: Disconnect pauses connections while retaining
WebID/drafts/credentials; Logout also clears this browser's credentials and
remembered selection. That last distinction awaits confirmation.

EVD127 reproduces the stale Launcher message in unchanged built code with a
local issuer/Preferences iframe. One successful login yields a usable parent
token and 21 storage events; the dedicated recovery notice clears while general
and workspace messages remain stale. Existing notifications reach Launcher;
typed message ownership/reconciliation is the evidenced gap. Initial fixture
ordering failures are retained, not claimed as resolved production auth bugs.
CYC124 stays Active in investigation/design; no product code or new commits.

## CYC124 completion and CYC129 evaluation handoff, 2026-11-09

The maintainer requests finishing both open cycles in order. CYC124 product
implementation is completed on its verified branch: typed auth feedback,
shared account status/dialog, persistent account-scoped Disconnect/Connect,
credential Logout preserving open sibling/local owner data, and Workbench-
coordinated managed switching with checkpoints before and after candidate
sign-in. Late startup results are invalidated after logout. The connection form
scrolls as a whole so 200% phone text retains reachable identity fields/actions.
Existing SimplyFlow/Metro/native RDF contracts remain; no new dependency.

EVD127 retains the fixed actual Launcher/Preferences reproduction, focused
preservation/security tests, native keyboard/AX/phone screenshots, passing
source/build and a complete seven-suite run, plus intermediate layout failures
and one later session cancellation failure. The fixture now uses one shared
token-release barrier and waits for sign-in cleanup before retry. This is not a
claim that all prior provider/network timing failures share that cause. Final
combined regression follows during CYC129 evaluation. CYC124 remains Active
pending human acceptance; no commit, merge, push or publication is inferred.

CYC129's existing warning-only build policy remains in the working tree as an
explicit dependency for CYC124 checks, as authorized before this continuation.
The next work is its separate branch/evaluation: full check, synthetic excesses,
both reports and npm run dev startup. No Active cycle is merged. Preserve all
unrelated supplied design/icon files and pending roadmap documentation.


## Both selected cycles ready for acceptance, 2026-11-09

CYC124 implementation/evaluation is complete, followed by CYC129's final
verification on its matching branch. EVD127's final section and both cycle
records supersede earlier investigation/pending-verification notes. Final
npm run check passes all 24 test files/both builds; the sequential full seven-
suite Chrome command passes, exit 0. CYC124's 28 product/test file hashes remain
unchanged through CYC129 evaluation. The warning-only build returns both graph
reports even for excesses; dev startup and readable Workbench HTTP 200 are
verified and its disposable probe server is stopped. Current readable Workbench
is 224208 gzip bytes, Preferences 201159; warnings remain advisory.

CYC124 includes scoped account mode/credential controls, typed cross-app recovery
feedback, native status/dialog, Workbench-coordinated managed switching, native
Contacts cache identity on disconnected reload, request-owned sign-in completion
and provider-ready focus. EVD127 retains intermediate failures and corrections,
including development-server no-store cache equivalence, native control readiness
and bounded headless Preferences focus emulation. Native picker/tab activation
checks stay separate; real-provider/manual-AT review is not invented.

Both canonical cycle statuses remain Active pending explicit human acceptance.
No commit, merge, push, publication or next cycle is requested. CYC129's existing
build-policy edits and CYC124's uncommitted feature changes remain preserved in
the working tree without merging Active cycles. User design/icon files and
pending roadmap additions remain untouched. The governing broker/Contacts/icon
follow-ups remain future work until the maintainer selects the next direction.

## Account app scope revision, 2026-11-11

The maintainer requests the recommended separate Account dialog app and explicitly
keeps it in Active CYC124, correcting the proposed new-cycle handoff. The actual
branch is reverified as spiral/CYC-20261109-QG24H-124-account-status. This revises
the earlier no-new-app boundary; earlier verification remains historical.
Account owns its form/feedback while the host keeps live sessions/recovery and
Workbench keeps managed switching/checkpoints. A dedicated modal preserves an
active Preferences task; the shipped same-origin frame receives a scoped port,
not a general provider account grant. CYC124/DES126/IMP128/EVD127 record scope,
implementation and evaluation. CYC129 and unrelated user files stay preserved.
No new cycle, human acceptance, commit, integration or publication is inferred.

Account app revision is implemented and evaluated within CYC124. Final source/
build checks pass; Account issuer, offline, nested-editor preservation and native
phone/keyboard/AX checks pass. One earlier complete seven-suite pass precedes the
last reopen guard; the final full command passes six suites then hits retained
provider Tab-focus flakiness, and the provider follow-up passes independently.
EVD127 preserves this qualification and complete download costs rather than
claiming reliable final all-suite completion. CYC124 stays Active for renewed
human review. No commit, merge, push, publication or new cycle is inferred.

## Account review corrections, 2026-11-11

The maintainer reports the first Connect popup closing before authorization,
and then confirms a separate stale Launcher disconnected icon after actual
Contacts sign-in, with the same WebID selected in both. CYC124 remains the active
cycle on its verified branch. The shared account dataset now explicitly awaits
fresh sign-in, then sends a non-credential completed-Connect notice on the
existing storage mechanism. Sessionless peers restore only the selected owner,
noninteractively and with attempt/intent/coalescing guards. Raw token hints must
not start a parallel session during authorization. No other production module
changes in this correction; local workspace/draft ownership stays intact.

Both exact issuer regressions, focused failure/preservation contracts and full
source/build checks pass. The complete Chrome command passes six suites, then
hits a provider fixture focus/ARIA-readiness setup failure; the corrected setup
passes independently without removing keyboard assertions. EVD127 retains the
failure and bounded passing evidence. Readable files are rebuilt for the running
4174 development server; refresh callers once. CYC124 stays Active pending human
acceptance. No commit, integration, publication or new cycle is inferred.

## OAuth launch URL classification, 2026-11-11

The maintainer confirms cross-app Connect/Disconnect works, then requests the
minimal OAuth URL detection correction: #webid links without iss must not be
handled as authorization redirects. Metro 0.9.3 consumes any hash and produces
the reported missing-iss error. The local Metro source fix lives on
fix/oauth2-redirect-iss with focused tests; no app workaround or validation
suppression is added. App CYC124 remains Active. Its installed OAuth dependency
is locally patched for evaluation; npm latest is still 0.9.3, so a library release
and subsequent lockfile update remain required for reproducible fresh installs.
No commit or publication is authorized/inferred; other user work is preserved.

The minimal iss classification change passes Metro's OAuth2 210/210 and OIDC
89/89 checks, app source/build checks and a complete seven-suite Chrome run.
The issuer browser scenario uses #webid and verifies the prior account fixes.
Readable assets are restored on port 4174. This is a locally patched dependency
for evaluation, not a registry release; new installs still require a published
version/lockfile update. CYC124 remains Active; no commit/publication inferred.


## Compact connection feedback, 2026-11-11

The maintainer requests toolbar-only passive connection status, removing notices
that push dialog content down, with an optional toast for unexpected loss. This
local review correction stays in Active CYC124 on its verified branch. Shared
recovery banners, persistent signed-out text and passive Preferences connection
guidance are removed; newly required authorization uses the existing toast once.
Toolbar labels/native request sign-in dialogs remain accessible, and non-auth
errors/conflicts stay visible. Disconnected Preferences stay local and empty
status text collapses using the existing utility. No storage/schema/dependency
change, acceptance, commit, merge or publication is inferred. EVD127 retains
source/build and bounded Chrome regression results, including provider focus
flakiness. Existing user work/CYC129 changes and the local Metro release
limitation remain preserved.


## CYC124 accepted for integration, 2026-11-11

The maintainer says “accepted, commit, merge and push”, then confirms “Accept
both cycles”. ACC131 accepts account implementation 3dec2cd112cf83a86b338e8c60f2518f29384328
and evaluation 56fe3931852df674512a79b65ffebd1b5f1c4398. CYC124 is Accepted, superseding
pending review notes. Normal merge and push of main/cycle branches are
authorized after exact validation. EVD127 retains browser focus qualifications
and the local Metro patch/release limitation. CYC129 is accepted separately;
unrelated design/icon files remain excluded. No package publication is requested.


## CYC129 accepted for integration, 2026-11-11

The maintainer explicitly confirms “Accept both cycles” after requesting commit,
merge and push. ACC132 accepts budget snapshot 8fe2123bb30b013bf1e0cda4bb0def4a56649114.
CYC129 is Accepted, superseding earlier pending review notes. Normal merge and
push of main/cycle branches are authorized after exact validation. This adds no
app bytes/dependencies and preserves non-budget errors. CYC124 remains a separate
accepted cycle; no package publication or unrelated design-file commit is
requested.


## Metro release handoff selected, 2026-11-11

The maintainer agrees to close the published-dependency gap before returning
to broker Phase 3. CYC133 is Active on verified
spiral/CYC-20261111-QG24H-133-metro-release from accepted main a186795.
SRC134/DES135/IMP136/EVD137 retain scope and evidence. Metro's existing fix is
committed as b5d3b96 with OAuth2 0.9.4, OIDC 0.9.5 requiring OAuth2 ^0.9.4 and
required browser bundles. Full Metro tests pass 536 checks, both builds and the
existing release dry-run pass; exact archives are inspected. Actual publication
requires npm login (whoami returns 401); the maintainer has been asked to sign
in. Workbench dependency/lockfile changes and fresh npm ci verification remain
pending registry publication. No completed handoff, new cycle acceptance or
Workbench commit/integration is claimed. Preserve unrelated pending icon/context
and supplied design files; legacy Metro checkouts stay untouched.


## Metro preparation held for compatibility correction, 2026-11-11

The maintainer explicitly selects Prepare the release only, then requests an
iss compatibility audit. The prepared guard regresses supported page redirects
from servers without RFC 9207 iss support and skips strict missing-issuer
validation. A disposable two-page mock redirect probe confirms both cases, with
a matching-issuer HTTP-200 control. EVD137/DES135 supersede earlier readiness:
b5d3b96 and its archives are not publishable as prepared. No publication or
further product change/commit is performed. Proposed minimal correction keeps
code/error callback detection separate from existing conditional issuer checks;
confirmation is needed before changing that previously agreed policy. CYC133
remains Active, with Workbench dependency changes deferred.


## Metro correction prepared and verified, 2026-11-11

The maintainer confirms correcting the demonstrated compatibility regression.
Metro 47a33e8 supersedes the invalid strict-iss preparation: callback code/error
detection is independent of conditional issuer validation, and present empty
issuers reject. Corrective commits preserve history on fix/oauth2-redirect-iss.
Full release dry-run passes 721 checks, final app source/build passes, the full
Chrome suite passes the classifier change and final issuer Chrome verification
passes after the empty-issuer correction. EVD137 records exact qualifications,
archives and graph costs. Publication remains explicitly excluded by Prepare the
release only; CYC133 is Active for review, with registry dependency updates and
fresh npm ci still deferred. Unrelated design/icon/AGENTS work remains intact.


## Published Metro handoff evaluated, 2026-11-12

The maintainer reports publication and requests updating/testing. On verified
CYC133, Workbench now declares OAuth2 ^0.9.4/OIDC ^0.9.5 and locks their registry
releases. Fresh npm ci succeeds; all installed files equal the corrected release
archives. npm run check passes 24 test files/both builds, and the complete
seven-suite Chrome command passes, exit 0. Readable assets are restored. EVD137
retains detailed evidence and unchanged advisory size warnings. The reproducible
dependency gap is resolved; CYC133 remains Active awaiting human acceptance.
No commit, merge, push, new feature cycle or publication is inferred.


## CYC133 accepted, 2026-11-12

The maintainer reports “everything still works, so accepted” after running the
updated apps. ACC138 records human acceptance; CYC133 is Accepted, superseding
its pending review status. There are no remaining Active cycle records. The
accepted implementation/evaluation remain uncommitted; no commit, merge, push,
publication or next cycle is authorized by acceptance alone.


## Accepted CYC133 delivery authorized, 2026-11-12

The maintainer requests commit, merge and push. Immutable causal delivery commits
record the accepted Metro handoff and ACC138's exact implementation/evaluation
versions. Normal merge into current main and push of main/cycle branches are
authorized after exact candidate integration validation. Unrelated pending icon
roadmap/context and supplied design files remain outside delivery.


## New design intake and roadmap reconciliation, 2026-11-12

The maintainer asks to read new design-folder files and add missing roadmap
work. Read solid-document-viewer-design.md, solid-sharing-design.md and the
changed Moldable-Solid-Apps.md, compared with existing suite/broker roadmaps.
The supplied icon archive already has a detailed roadmap item; preserve it.
The existing documents/versioning, provenance and signing proposals already
have roadmap coverage; the viewer refines that document direction.

Suite additions retain PDF/image reading and annotation layers, Cobalt/default
and replaceable note-body editing, explicit private/shared save and recovery,
legacy Web Annotation compatibility and revision-aware anchors. Invitation
sharing is a separate second-stage option with user-selected providers,
owner-browser-closed completion and verified authorization/retry/disconnection.
The revised IDE direction is reflected in personal-layer precedence, separate
undo histories, SimplyFlow template notifications, marketplace separation and
open upstream-version handling. Standing AGENTS readability/feature constraints
and the accepted build-time composition boundary remain applicable.

The viewer's 2026-11-08 enforced-budget and not-yet-existing registry statements
are historical source observations. Current planning uses accepted CYC129's
advisory policy and CYC118's browse preferences/registry foundation; future
editor/sharing/signing contracts and routing still need implementation. Specialist
PDF/rich-text rendering requires reconciliation with SimplyFlow rules before
code changes. Refresh cited protocol/library research when selecting that work;
this documentation review does not newly verify external conformance claims.

The broker roadmap cross-references these later contracts while retaining
Phase 3/4 and current direction. This is documentation-only intake, with no
new cycle, product change, implementation priority, commit or publication.
Supplied documents and unrelated user changes remain intact.


## Iframe-dialog Escape repair retained, 2026-11-12

The maintainer requests a fix for Escape not closing dialogs when focus is in
an iframe, then explicitly chooses “Add it to the roadmap for later”. The suite
MVP UI roadmap retains the repair and native keyboard/focus/draft-preservation
acceptance scenarios. Initial inspection finds Account's existing child Escape
handler and nested regression check, while the generic capability host listens
for its own native dialog cancel and Preferences lacks the analogous forwarding.
Reproduce actual affected workflows before implementation; preserve existing
close guards, nested controls and scoped cross-origin authority. No new cycle,
product changes, reprioritization ahead of Contacts, commit or push is requested.


## Contacts Phase 3 cycle opened, 2026-11-12

The maintainer selects Contacts recipient selection and provider replaceability.
CYC139 is Active in Analyze/Plan on verified
spiral/CYC-20261112-QG24H-139-contacts-picker from main f1a36e0. SRC140/DES141/
EVD142 retain instruction, source/composition gap and proposed scope. Contacts
registers no selection capabilities/handler; Launcher/native preference choice
is browse-specific. The current-book first boundary is presented for confirmation
against broader multiple-book/cross-workspace roadmap requirements before product
changes. Existing cross-origin fixtures reuse ManagedApp; independent protocol
peers remain part of Phase 3 evidence. Preserve pending docs/user files; no
implementation, acceptance, commit, integration or publication is claimed.


## CYC139 implementation evaluated, 2026-11-12

The maintainer confirms “Current book first (recommended)”. On verified
spiral/CYC-20261112-QG24H-139-contacts-picker, IMP143 adds the Contacts picker,
explicit native contact identity selection, per-operation Default apps preference
and existing scoped broker integration. IMP121 retains lineage for its shared
preference extension. EVD142 records preserved state/RDF, native phone/keyboard/
200%/offline behavior and independently implemented caller/provider evidence.
Final npm run check passes 25 files/both builds; the complete eight-suite Chrome
command passes, exit 0. Readable assets are restored for the running dev server.
Contacts is 200101/134794 readable/minified gzip bytes with advisory warnings;
the cold uncompressed fixture costs 657460 bytes/9 requests/about 13 seconds at
50 KiB/s/150 ms. No manual AT or production-provider certification is claimed.
CYC139 stays Active for human review, with no commit, merge, push or publication.
Broader book browsing/search, sharing and iframe Escape remain later work.
All pending supplied design/icon/moldability edits remain preserved.


## CYC139 corrected after real integration review, 2026-11-12

The maintainer reports a UUID-only picker result is not usable externally, asks
for Files Share to initiate recipient selection within the same Workbench/user
context, explicitly chooses selected-data fallback for local/unsynced contacts,
and requires distinct picker UIs. The correction remains on verified CYC139.
Files now has the real Share → choose person → selection-summary path. Results
keep native identity, include a configured document locator and a bounded native
RDF description; document-only results are read through the caller's own Metro
session. Only selected data is exported, with payload preview and explicit
unsupported-structure/size refusal. Files has a focused resource-selection list
rather than its normal management table. No permissions/invitations are changed.

Cancel/reload, actor changes, existing browsing, native RDF and earlier provider
choices retain their contracts. Native workspace state holds references/label,
not contact-body snapshots. Source checks pass 27 files/both builds; two complete
eight-suite Chrome commands pass, including actual Files consuming data and
source references. A final reply-envelope size check passes focused contracts
and final source/build verification afterwards. EVD142 preserves qualifications,
phone screenshots, cold costs and all intermediate fixture failures. Readable
dev assets are restored. CYC139 remains Active for renewed human review; no
commit, integration, publication, full share flow or Escape repair is inferred.


## CYC139 accepted for integration, 2026-11-12

The maintainer says “accepted, commit merge and push please.” ACC144 accepts
implementation f1f56e61ae1700ff8670292420e22348dd510cd6 and evaluation
2402bd8bef8ad16a46da54483976797da4e97c98. CYC139 is now Accepted, superseding
the earlier Active/review notes. Useful recipient data/source references, the
real Files Share selection summary, separate picker UIs and independent provider
choices are included. Permissions/invitations, broader books and iframe Escape
remain later work. Broker Phase 4 evaluation remains the roadmap's next step;
no next implementation cycle is selected. Normal merge into latest main and
push of main/cycle branches are explicitly authorized after exact integration
validation. Existing advisory size and manual AT/production evidence limits
remain. Requested design intake and its source documents are preserved in Git;
the separate AI composition proposal stays uncommitted.

## User-friendly sign-up reaffirmed, 2026-11-12

The maintainer asks to add a user-friendly way to sign up alongside sign-in.
The existing startup/decentralized-sign-up roadmap item now explicitly includes
a Create account entry, plain-language provider guidance, provider registration
and return to the original task. Retain existing-account sign-in and local work;
evaluate phone, keyboard/AT, cancellation and interrupted registration recovery.
No provider or registration mechanism is selected. This is documentation-only
roadmap work, with no new implementation cycle or delivery authorization.

## AI-composition design intake and documentation delivery, 2026-11-12

The maintainer asks to add the new design documents to the roadmap and commit
and push the update. The new untracked source is the AI-composable Workbench
proposal; viewer/sharing, revised moldability and icons already have roadmap
coverage and committed sources. Read the full composition proposal and compare
the optional-AI note and governing suite/broker roadmaps. Retain contract
inventory, inspectable discovery, a bounded SimplyFlow UI adapter, an ordinary
optional Assistant, mixed provider interfaces, native saved compositions and
later independent federation as deferred stages. Existing provider preferences
and recipient selection supersede the source's supplied-snapshot baseline.

The source remains an initial proposal, not implementation approval. Broker
Phase 4, optional-AI deferral, native RDF, authorization, manual workflows and
standing guardrails remain governing. External protocol/version/API claims are
research candidates to refresh when a cycle is selected, not newly verified by
this local documentation intake. Include the pending user-friendly sign-up
roadmap update in the authorized documentation commit/push. No product changes,
new implementation cycle or deployment are requested.

Documentation verification: all 64 relative Markdown document targets resolve;
the seven proposed composition stages and sign-up entry are present. Tracked
edits pass git diff --check. Preserve the supplied proposal's Markdown hard
breaks. No runtime, dependencies or tests change, so application/browser suites
are not repeated for this documentation-only delivery.

## Broker Phase 4 evaluated for review, 2026-11-12

The maintainer agrees to the proposed Phase 4 keep/change/defer cycle. CYC145 is
Active on verified spiral/CYC-20261112-QG24H-145-capability-evaluation from clean
main eac0b1e72e84330f8c8238f05b660a04bec9d439. This continues the governing
roadmap after accepted CYC139. SRC146 records the instruction; EVD147 retains
the effective-source, complexity, setup, failure and download evidence; DES148
proposes decisions. No product, dependency, build or test files change.

Fresh npm run check passes 27 test files/both builds. The provider and recipient
Chrome suites pass unchanged, including the real Files caller, independent
peers, native selected RDF, source-document access, cancellation and phone/
keyboard/loaded-offline behavior. Existing complete eight-suite CYC139 evidence
is historical, not rerun here. Readable dev assets are restored. Manual AT,
production providers and cold-offline use remain unclaimed.

Node and Chrome raw-port probes reproduce 70000-character request/reply frames
crossing the helper's intended limit and a timeout:null call remaining pending
after remote port closure, until explicit local close. RSK149 records this
near-term concern and limits: parent/popup monitoring handles some full-app loss
paths, so reproduce actual surviving-caller/broker/provider combinations before
choosing a repair mechanism. Raw bounds and lifecycle hardening are the proposed
first follow-up. Keep current native preferences, scoped routing, provider-owned
UI and data ownership; defer general SHACL/manifests/ranking/URI wire renames and
AI/federation without demonstrated need. Documentation overclaims are corrected.

CYC145 remains Active in Evaluate awaiting human review, not accepted. The
recommended follow-up is not yet an authorized implementation cycle. No commit,
merge, push, publication or runtime correction is requested or performed.

## CYC145 second review, 2026-11-12

The maintainer requests a double-check of Phase 4. DES148/EVD147/RSK149 now
distinguish the exposed legacy helper from today's preferred-picker button and
the serializable helper's 64 KiB budget from a yet-to-be-agreed global frame
contract. Before enforcing any complete-frame cap, audit payload/envelope
compatibility. The architecture/defer conclusions remain scoped to demonstrated
selection workflows; no independent broker implementation was tested.

A new disposable Chrome probe uses the shipped Workbench presenter and Contacts:
reload during selection leaves one pending broker call after 1800 ms while the
new Contacts app has no request. The real Close action offers Discard after its
guard timeout; Discard releases the task. This strengthens a specific interrupted
picker recovery follow-up without selecting a heartbeat, arbitrary inactivity
timeout or broad lifecycle redesign. Runtime code remains unchanged. CYC145 is
still Active awaiting human review; no commit or next implementation cycle.

## CYC145 greenfield correction, 2026-11-12

The maintainer rejects the assessment's legacy-API preservation rationale:
there are no external consumers. DES148 now recommends retiring obsolete
chooseFiles/live-browse machinery after checking actual in-project dependencies.
Inspection finds API exposure, instance grant UI/policy, native workspace state
fields and fixtures, while the current picker button uses the transient path.
These must be changed coherently rather than preserved for compatibility.
This updates the evaluation and standing project context; no implementation,
acceptance, commit or integration is inferred.


## Size-limit rationale required, 2026-11-12

The maintainer agrees to add a decision gate before choosing capability size
limits: establish whether a limit is needed, what it protects, and which data
and boundary it applies to. No documented justification for the exact 64 KiB
serializable constant was found; it is not a universal transport requirement.
DES148 now requires evidence for need/scope and, if justified, a measured value
and recovery behavior. Shape/type validation is a separate question. No runtime
limit changes, acceptance or delivery action are implied.


## CYC145 assessment accepted, 2026-11-12

The maintainer says “this assesment is accepted”. ACC150 records acceptance of
the revised DES148 assessment and bounded EVD147 evidence. CYC145 is Accepted,
superseding its earlier Active/review notes; broker Phase 4 evaluation is complete.
The accepted direction includes removal of obsolete APIs without compatibility
shims, investigation of interrupted-picker reload recovery, and evidence for the
need, protective purpose and scope of any size limit before selecting a value.
The inherited 64 KiB constant is not a requirement. RSK149 remains open, and
broader schemas/discovery/ranking/AI/federation remain deferred. No runtime fixes,
new implementation cycle, commit, merge or push are authorized by acceptance.


## Accepted CYC145 delivery authorized, 2026-11-12

The maintainer requests “commit, merge and push. Then discuss the next cycle.”
ACC150 now references exact committed assessment/evidence versions. The accepted
cycle is delivered through immutable causal commits and a normal merge into
latest main after validation; main and the cycle branch are authorized for push.
No product changes accompany delivery, and no next implementation cycle is
selected. Reconcile both governing roadmaps before proposing the follow-up.


## Shared capability reliability cycle selected, 2026-11-12

After CYC145 delivery the maintainer asks whether the proposed work touches the
shared capabilities system or only a picker. The clarified shared invocation/
presentation, obsolete live-browse removal and size-policy scope is confirmed:
“Than lets do this”. CYC151 continues the accepted Phase 4 direction on verified
spiral/CYC-20261112-QG24H-151-capability-reliability from main 4b66720.
SRC152/DES153/IMP154/EVD155 retain intent, design, changes and evaluation.

Recovery uses private-port disconnect signaling and observed iframe navigation/
provider generation changes without automatic replay or an inactivity deadline.
Preserve still-visible disconnected editor drafts and discard guards. Obsolete
live routing/grants are removed; stored RDF remains unowned and preserved.
The unjustified state/contact byte caps are removed while shape/native-RDF and
count/depth validation remain. The separate HTTP keepalive background-save
safeguard is retained; large states remain locally recoverable and explicitly
saveable. No broader discovery, iframe Escape or new product capability is added.
The cycle is Active, awaiting final evaluation and human review. No commit,
merge or push is authorized. Preserve the unrelated changed icon archive.


## CYC151 evaluated for review, 2026-11-12

IMP154/EVD155 record the completed shared capability reliability/simplification
work. Final npm run check passes 26 files/both builds; the full eight-suite
Chrome command passes, including real Files/Contacts reload recovery, independent
provider navigation, explicit retry and retained still-visible Profile drafts.
Native state above the retired cap remains locally recoverable and explicitly
saveable; retired grant RDF remains preserved. Workbench graph shrinks by about
1.1 KB gzip; other graphs add about 0.4 KB. Warnings remain advisory and cold
Contacts selection remains approximately 13 seconds in the bounded fixture.
Readable assets are restored. CYC151 is Active in Evaluate awaiting human review;
no manual AT or arbitrary process-loss certification, commit or integration.


## CYC151 accepted for integration, 2026-11-12

The maintainer says “accepted, commit, merge and push please.” ACC156 accepts
implementation 935a765b474092c234c1e25f7cd115250df83b7d and evaluation
ee98778f4c2c89bb8d731dcef02ea0350766c468. CYC151 is Accepted, superseding earlier
Active/review notes. Shared recovery, draft/RDF preservation, obsolete route
removal and evidence-based payload policy are included. The maintainer authorizes
normal merge into latest main and push of main/cycle branches after exact
validation. Unrelated icon archive changes remain excluded and preserved.
No next cycle is selected; iframe Escape and other roadmap work remain deferred.


## Iframe Escape cycle selected, 2026-11-12

Following CYC151 delivery, the maintainer confirms the proposed iframe Escape
repair: “lets do that”. CYC157 is Active on verified
spiral/CYC-20261112-QG24H-157-iframe-escape from main 5a32643. SRC158/DES159/
IMP160/EVD161 retain intent, design, implementation and evidence. Before edits,
a disposable native Chrome probe reproduces Preferences remaining open on
iframe Escape while the close action succeeds. Extend the existing scoped
presentation protocol and SimplyFlow event component; preserve save/discard,
local modal/popover precedence, data and separate-tab behavior. No new broker
route or renderer. A related disabled-invoker focus gap is repaired using
aria-disabled and the existing selection guard. Evaluation is in progress;
no acceptance, commit, merge or push is inferred. Preserve the icon archive.


## CYC157 evaluated for review, 2026-11-12

The shared iframe Escape repair is complete on its dedicated branch. Final
npm run check passes 210 tests/both builds; all eight Chrome suites pass. EVD161
records nested Account/modals/popovers, consumed keys, actual Profile save/draft/
disconnection guards, Files/Contacts preservation, independent cross-origin
cooperation, stale-frame rejection, phone focus return and loaded-offline closure.
No dependencies added; complete app graphs add less than 1 KB gzip. Advisory
warnings remain, including Files' readable graph now at 200122 bytes. The bounded
cold Contacts fixture remains about 13 seconds. Readable dev assets restored;
no manual AT/cross-browser certification. CYC157 is Active in Evaluate awaiting
human acceptance, with no commit, merge or push. The icon archive is preserved.


## CYC157 accepted for integration, 2026-11-12

The maintainer says “accepted, commit, merge and push please”. ACC162 accepts
implementation dd75b038344b664ca9e5e9fef5fe03631dc33f6c and verification
0956b42be6cce154ac9c8775c3174b891f799651. CYC157 is Accepted, superseding its
earlier Active/review notes. Direct human review authorizes normal merge into
latest main and push after exact integration validation. Existing evidence
limits and advisory download warnings remain. Preserve the unrelated icon
archive. The later request to add the supplied embedded-view proposal to the
roadmap is documentation-only and does not authorize its implementation.
