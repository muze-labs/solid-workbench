# AI-Composable Solid Workbench

**Status:** Initial design proposal — for review; not approved for implementation  
**Date:** 2026-11-12  
**Scope:** Solid Workbench, SimplyFlow components, capability broker, optional AI providers, future Weblets-style cooperation  
**Basis:** `solid-workbench-main.zip` (2026-11-12 snapshot) and prior design discussion

## 1. Purpose

Allow a person or an optional AI assistant to assemble useful interfaces and workflows from existing Solid Workbench **applications, semantic capabilities, and SimplyFlow components**, including components supplied by independently hosted applications.

An AI should be able to discover what is available, propose how to connect it, and present a task-specific interface. The user retains control of the apps, components, data, authorization and resulting composition. The result should remain usable and editable without the AI that created it.

**Design direction:** AI is a replaceable *composer* and *interpreter*, not the owner of application functionality, the privileged workspace controller, or the required route to using software.

## 2. Governing principles and invariants

1. **AI is optional.** Ordinary application and cross-app workflows must work without an AI provider. AI providers are ordinary, replaceable capability providers, possibly local.
2. **One component model.** SimplyFlow's existing component datasets are the editable implementation units. Do not introduce distinct “AI components” or “Weblet components”. A2UI, if adopted, is an adapter/protocol, not another application runtime.
3. **No hidden editable state.** Moldable application code must not depend on private module closures, inaccessible mutable state, or other assumptions the IDE cannot reconstruct. Its editable dependencies and effects must be explicit and inspectable. Existing violations are defects against the moldability design, not an accepted class of components.
4. **Explicit composition.** Components are reusable through named SimplyFlow entries and public dependencies; applications connect them deliberately. An AI must not gain access to the entire running app definition just because an individual component is composable.
5. **Separate semantics from implementation.** Stable URI-identified capabilities express *what* an operation does, independently of the app, its URL, its UI, or the transport. Provider and component identity are separate.
6. **Keep the broker narrow.** The broker discovers/connects/routes and enforces connection policy; it does not interpret application data, retrieve Solid resources on the agent's behalf, or become a general privileged agent runtime.
7. **Provider-owned UI remains first-class.** For complex interactions, reuse an application's existing interface through the managed embedded-provider mechanism (and eventually independently hosted Weblets). A2UI-style host rendering is an *additional* choice.
8. **No ambient authority.** Discovering a capability, rendering a control, or selecting an AI provider grants no permission to read or write Solid data. Every invocation remains subject to the ordinary application and Solid authorization boundaries.
9. **Human agency.** AI proposes; users can inspect, reject, amend, and apply consequential changes. AI should never have the final say. Trusted consent/approval UI must present the actual operation and scope, not solely agent-authored claims.
10. **Portable, persistent results.** Saved compositions reference stable interfaces and user-controlled resources, not an AI conversation or transient implementation objects. A saved workspace must reopen without the original AI.
11. **Small and accessible.** Preserve existing readability, mobile-first, local-first, accessibility and download-size guardrails. No unnecessary global runtime, duplicate HTTP/auth stack, or new dependency on a central service.
12. **Standards where useful, adapters at boundaries.** Prefer existing open standards (Solid, RDF, A2UI, MCP/A2A where appropriate) without making any evolving agent protocol the core of Workbench.

## 3. Three complementary composition mechanisms

| Mechanism | Composed unit | Example | Primary Workbench mechanism |
| --- | --- | --- | --- |
| **Capability composition** | Semantic operation | Find or select a contact | URI-based capability + broker connection |
| **Application composition** | Provider-owned app/interface | Embed a file picker or profile editor | Existing embedded provider + private `MessagePort` |
| **Interface composition** | Declarative view assembled from reusable controls | Contact card alongside related documents | SimplyFlow renderer; optional A2UI adapter |

These mechanisms can coexist in a single result. The first two do not require A2UI. A2UI must not replace provider-owned interaction or the broker's request/response transport.

## 4. Baseline: what exists, and what is not yet delivered

### Present in the supplied snapshot

- `packages/solid-app-data/src/capabilities.mjs`: managed-app capability communication and private port-based request/response lifecycle.
- `packages/solid-app-data/src/workspace-broker.mjs`: routing between registered live instances, with restricted policy; supports embedded provider workflows. Its current `request()` path expects exactly one eligible live provider, **not** arbitrary provider selection.
- `packages/solid-app-ui/src/components/capability-dialog.mjs`: provider-owned embedded interactions.
- `packages/solid-app-data/src/definition.mjs`: exposes editable SimplyFlow component/override definitions, named sources and public API dependency names.
- RDF application manifests, existing launcher/workspace persistence and Solid integrations.
- Governing design rules in `design/Moldable-Solid-Apps.md`, explicitly disallowing hidden closure dependencies for replaceable editable behavior.

### Designed or planned, not assumed implemented

- User-selected providers via a persistent semantic capability registry, including inactive/unlaunched applications.
- General discovery and machine-readable input/output contracts, and semantic matching/open-with.
- A2UI rendering or catalog generation.
- A normal Workbench Assistant app that composes capabilities and interfaces.
- Durable, multi-provider UI compositions and general cross-origin Weblets-style embedding/layout.
- Completed moldable IDE, preview/persistence and user overrides.

**Status discipline:** References to a planned interface in this document are proposals. A source-level review is not proof that a complete end-to-end workflow passes tests.

## 5. Requirements

Identifiers are provisional. **Must** describes the intended end-state contract, not a claim of present implementation. Implementation priorities are set separately in §8.

### R1 — Discover capabilities without invoking them (Must)

A client can inspect a set of available semantic capabilities, their providers, and whether they are installed, active, user-preferred and presently invocable. Discovery must not confer access. Provider resolution must handle zero, one and multiple candidates explicitly; it cannot rely indefinitely on the current exactly-one-live-provider rule.

### R2 — Expose machine-readable capability contracts (Must)

Describe a capability's URI, purpose, accepted inputs, produced outputs, interactive/noninteractive nature and applicable constraints. Use RDF/linked-data meaning where useful; choose a minimal validation shape for invocations. Keep transport-specific protocol descriptions derived from or mapped to this authoritative contract, not as competing registries.

### R3 — Describe reusable components without duplicating SimplyFlow (Must)

A component's machine-readable presentation contract identifies its public name/URI (if needed), purpose, inputs, outputs/events, dependencies and relevant interaction requirements. The contract must be a thin description of the existing moldable component dataset, ideally derivable from it plus optional semantic annotations. Do not require developers to maintain two independent behavior definitions.

**Invariant:** Any editable behavior required to compose a component must be available through the exposed definition or explicit public dependencies. An inaccessible closure is a moldability defect. Noneditable library internals remain valid *when called through explicit public APIs*.

### R4 — Support both native components and provider-owned UIs (Must)

The composer may use a locally registered SimplyFlow component or invoke/embed an app-supplied interactive capability. Do not force document editors, file browsers or other substantial applications to reproduce their UI as A2UI controls. The provider retains ownership of its state, data access and interaction logic.

### R5 — Keep AI as a normal, replaceable application (Must)

An Assistant may discover published descriptions, propose a composition, request capabilities, and produce a declarative surface. It gets no privileged broker route, automatically shared application data, inherited Solid credentials or unrestricted runtime-definition access. Swapping or removing it preserves saved compositions and deterministic workflows.

### R6 — Render declarative surfaces within an explicit catalog (Must for AI-generated native UI)

The renderer accepts only known components, properties, data bindings and registered interactions. It must reject or safely handle unknown entries and malformed inputs. No agent-provided JavaScript, HTML template execution or dynamically trusted code. A2UI 1.0 is the first external protocol to evaluate, not a required core representation.

### R7 — Bind operations to independent authorization (Must)

Renderer events can request a semantic capability; the broker and provider still enforce their respective policies. For sensitive reads, disclosures and writes, approval uses trusted UI displaying authoritative operation details. A2UI component selection or user-visible text is not itself authority. Future integration with stronger disclosure-contract/output checking must remain possible without changing component APIs.

### R8 — Maintain separate state ownership (Must)

Distinguish source data (owned by the underlying apps/Pods), transient view state, persistent composition state and Assistant conversation state. Saving a composition must not silently copy underlying protected data into the Assistant's storage. Clearly define the offline/open behavior when a provider or resource is unavailable.

### R9 — Save, inspect and edit compositions (Should)

A user can keep a useful layout and its capability connections as ordinary, understandable user-owned configuration. It must survive restart and AI removal; the composition should support manual editing, provider replacement and graceful handling of missing capabilities. Sharing/import is a later extension requiring explicit security review.

### R10 — Independent and cross-origin cooperation (Should; later)

An app can provide capabilities and provider-owned UI without requiring the Workbench shell. Cross-origin composition preserves origin isolation, private connections, scoped authority, cancellation and lifecycle management. Evaluate the existing transport and possible glottis/MCP Apps interoperation before selecting an additional protocol.

### R11 — Observability, portability and tests (Must)

Provide inspectable reasons for capability selection, binding and rejection. Preserve authored definitions/overrides. Add contract, isolation, lifecycle, replacement, accessibility and AI-removal tests; measure cold-load impact and use an acceptance scenario that crosses application boundaries.

## 6. Proposed architecture (conceptual)

```text
User ──> Optional Assistant (ordinary Workbench app)
                    │
              discovers contracts
                    │
            ┌───────┴─────────┐
            ▼                 ▼
     Capability catalog    Component descriptors
            │                 │
            ▼                 ▼
     Broker/provider       Optional A2UI adapter
     selection & policy          │
            │              SimplyFlow renderer
            ▼                 │
     Existing app <─────────────┘  (UI events request capabilities)
     or provider UI
            │
       Solid data/API

       User-owned composition state is separate from source data.
```

The catalogs are descriptions over existing operations/components, **not** alternative execution systems. It is an open design question whether the UI adapter is hosted inside Assistant, Workbench, or a reusable independent application; avoid making the shell privileged merely for convenience.

## 7. Research questions and experiments

| ID | Question | What would settle it |
| --- | --- | --- |
| Q1 | Which component interfaces/dependencies can be derived from `simply.app()` and `exposeDefinition()` today? | Inventory three existing components; distinguish derivable metadata from missing semantic annotations. |
| Q2 | What is the minimum capability description sufficient for AI discovery and reliable validation? | Specify two capabilities using RDF plus a small shape/schema; round-trip to a broker invocation. |
| Q3 | How much A2UI 1.0 can a small SimplyFlow adapter support without a second reactive runtime? | Implement a read-only card/list and one bound interaction; measure source and gzip impact. |
| Q4 | How do A2UI user actions map to semantic capability calls without leaking authority? | End-to-end trace showing target, requested operation, policy decision, cancellation and failure. |
| Q5 | Should AI output refer to components by URI, catalog-local name, or both? | Test portability across two catalogs and replacement of one component implementation. |
| Q6 | How should inactive, remote and competing providers be discovered, selected and launched? | Demo zero/one/multiple providers with explicit user choice and registered preferences. |
| Q7 | What is the persistence model for a saved mixed composition? | Save/reload without AI, including missing provider and offline source resource. |
| Q8 | How do embedded provider UIs coexist with host-rendered declarative components? | Prototype provider-owned picker inside a composed view; verify focus, origin and cleanup. |
| Q9 | Is glottis or MCP Apps useful beyond today's private `MessagePort` transport? | Compare actual functionality, origin/authority guarantees, complexity and browser support. |
| Q10 | How is an AI-suggested layout made understandable and controllable by a nonprogrammer? | Keyboard/screen-reader task tests and manual editing without model involvement. |
| Q11 | How can the AI Data Steward supply data/approvals without exposing unnecessary source data? | Prototype with least-privilege inputs, trusted approval UI and separate output authorization. |

## 8. Proposed roadmap and decision gates

This roadmap **does not select or supersede a Spiral implementation cycle** or reorder the existing governing broker roadmap. Each stage requires a brief design, explicit acceptance evidence and human approval before advancing.

| Stage | Work | Dependencies / exit criteria |
| --- | --- | --- |
| **0. Contract inventory** | Select two real capabilities and two SimplyFlow components; document public dependencies and missing metadata. Audit for hidden editable-state assumptions. | Written contracts; no duplicate component model; identified defects tracked as moldability issues. |
| **1. Capability discovery** | Extend the existing broker/registry path to expose known providers and machine-readable capability contracts. | Demonstrate zero/one/multiple provider scenarios; no implicit authorization; preserves standalone apps. |
| **2. UI composition spike** | Implement a separate minimal A2UI-to-SimplyFlow adapter with a restricted catalog. | Render two components; bind one event to a capability; reject unapproved actions/code; performance/accessibility evidence. |
| **3. Optional Assistant** | Build an ordinary app that asks an AI provider to choose capabilities and propose a small composition. | Same workflow manually possible; AI has no extra authority; provider can be replaced/removed. |
| **4. Mixed application/UI composition** | Combine host-rendered components with embedded provider-owned interaction using existing lifecycle mechanism. | End-to-end task, cancellation/focus/security checks, no duplicated data ownership. |
| **5. Durable user-owned compositions** | Store, reload and manually edit composition state, linked to resource and capability URIs. | Opens without AI; provider replacement and offline/missing-resource behavior tested. |
| **6. Weblets-style federation** | Investigate independently hosted component/provider discovery, cross-origin composition and optional MCP/A2A/MCP Apps/glottis adapters. | Standards/security comparison; at least two independently hosted implementations; no Workbench dependency for standalone use. |

**Suggested first vertical experiment:** A person asks the Assistant to select a Solid resource and open it in an appropriate application. The generated view offers a simple resource control; the existing Files provider performs selection; Workbench routes the selected URI to an available handler. Keep a manual path for the same task and initially use explicit rather than inferred handler selection.

## 9. Risks and countermeasures

- **Protocol creep:** A2UI, MCP and A2A could each create separate registries and runtimes. **Countermeasure:** one semantic capability model, adapters only at external boundaries.
- **False “reusability”:** A component contract may describe public inputs while behavior hides implicit dependencies. **Countermeasure:** enforce existing moldability invariant and test component replacement outside the source app.
- **Agent-authored misleading UI:** A valid catalog component may misstate the consequence of an action. **Countermeasure:** render operation scope and approval from trusted authorization data, not just AI-authored copy.
- **Data overexposure:** AI composition may tempt apps to pass whole RDF graphs for convenience. **Countermeasure:** share the minimum typed arguments/results; allow provider-owned interfaces and data binding without exposing raw resources to AI.
- **Permanent AI dependence:** Saved interfaces may rely on model-side state or ephemeral generated code. **Countermeasure:** persist declarative connections and explicit state; test with AI removed.
- **Complexity and download growth:** A generic renderer could dominate small apps. **Countermeasure:** isolate optional code, reuse SimplyFlow, measure full cold loads and gzip size.
- **Trust across origins:** Discovery is not authority and iframe isolation does not itself authorize operations. **Countermeasure:** explicit origin and invocation checks, task-scoped connections, independently enforced Solid permissions.

## 10. Acceptance criteria for the first proof of concept

1. A user can complete the selected resource/open workflow manually with the Assistant absent.
2. The Assistant sees capability/component **descriptions**, not ambient Solid credentials or hidden application state.
3. The same semantic capability can be fulfilled by a replaceable provider without changing the Assistant's task description.
4. The generated interface uses only an approved catalog and fails closed on unknown executable behavior.
5. A provider-owned UI can be invoked through the existing broker without rewriting its interface in A2UI.
6. A visible, meaningful user action precedes any consequential operation; invoking the capability still passes ordinary authorization checks.
7. Replacing a SimplyFlow component implementation does not require changing its public contract or AI composition.
8. The prototype has source-level and browser acceptance evidence for lifecycle, cancellation, keyboard access and failure cases; download impact is recorded.

## 11. References in the snapshot

- `design/Moldable-Solid-Apps.md` — authoritative moldability and public-dependency rules.
- `design/solid-capability-broker-roadmap.md` — governing broker and provider lifecycle roadmap.
- `design/solid-optional-ai-capabilities.md` — optional, replaceable AI and user-control requirements (currently deferred).
- `design/solid-apps-roadmap.md` — suite-wide performance, accessibility, offline and mobile guardrails.
- `design/solid-semantic-open-with-design.md` — future resource-to-handler matching.
- `packages/solid-app-data/src/{capabilities,workspace-broker,definition}.mjs` — current code boundaries.
- `packages/solid-app-ui/src/components/capability-dialog.mjs` — embedded-provider UI.
- External candidates for investigation: [A2UI](https://github.com/a2ui-project/a2ui), [MCP Apps](https://modelcontextprotocol.io/), [glottis](https://github.com/bluepnume/glottis).

---

**Decision requested before implementation:** Approve the scope of Stage 0 as an architecture/contract inventory, without prematurely standardizing a manifest vocabulary, adopting A2UI as the internal data model, or making Assistant a privileged Workbench subsystem.
