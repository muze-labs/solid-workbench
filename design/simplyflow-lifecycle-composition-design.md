# SimplyFlow lifecycle and composition: review and proposed changes

Date: 15 November 2026  
Status: design candidates; no implementation or release selected  
Scope: SimplyFlow contracts exposed by Solid Workbench's integration

## Purpose and review basis

The maintainer asked what should be added to or removed from SimplyFlow, then
requested this separate design document and roadmap entry. This develops the
SimplyFlow-specific implications of the
[Workbench library boundaries review](reviews/Solid-Workbench-Library-Boundaries-Review.md).

The review inspected Workbench's installed SimplyFlow 0.10.4 convenience package,
which resolves simplyflow-app 0.10.3, and the local SimplyFlow repository at
[`7fefa52a7434360c0a9d99318cd24fd528bb047e`](https://github.com/muze-labs/simplyflow/tree/7fefa52a7434360c0a9d99318cd24fd528bb047e).
That repository's app package declares 0.10.4 and adds binding-prefix and
drag/drop integration absent from Workbench's installed app package. Local
SimplyEdit package/build edits were present and left untouched. Repository
contents and declared versions do not establish npm publication or adoption by
Workbench.

Evidence here is source and API inspection. No new runtime reproduction,
comparative benchmark or browser verification was performed for these proposals.
Existing app behavior and previous cycle evidence must be rechecked when a
specific change is selected. The recommendations are not implemented API names.

Retain SimplyFlow's existing state, binding, model and app separation. The useful
direction is clearer ownership of lifecycle and live composition, with optional
services using those contracts. Follow the
[architecture philosophy](../ARCHITECTURE-PHILOSOPHY.md) and
[moldable-app requirements](Moldable-Solid-Apps.md).

## 1. App-level subscription and cleanup ownership

### Observed boundary

Workbench supplies an experimental
[events extension](../packages/simplyflow-events/src/index.mjs). It validates
declarations, activates subscriptions, resolves current actions, handles partial
setup and disposes bindings. It wraps `app.destroy()`. The separate
[definition adapter](../packages/solid-app-data/src/definition.mjs) also wraps
`destroy()` to invoke app cleanup.

SimplyFlow element behaviors already accept cleanup functions. The missing
contract is app-level ownership that extensions can use without replacing
lifecycle methods. CYC92 explicitly selected the separate events experiment;
promotion into SimplyFlow remains future work.

### Proposal

Provide a small public way to register app-owned subscriptions and disposers.
Define activation, failure and disposal together:

- Partial startup failure releases resources already acquired.
- Repeated disposal does not release the same resource twice.
- A cleanup failure does not skip the remaining cleanup work.
- Retired callbacks cannot deliver events into a disposed activation.
- Replacement stops the old subscription before starting its replacement.

Keep synchronous cleanup distinct from any future asynchronous close contract;
do not silently turn `destroy()` into a promise or claim it persists documents.
Decide how setup and cleanup errors reach callers without hiding failures.

The declarative `events` syntax may remain an optional extension built on this
contract. It need not become a mandatory beginner-facing concept or a general
plugin framework. Reuse element behaviors for element-owned work.

Verify failed setup, reentrant callbacks, repeated destruction, cleanup errors,
and replacement without duplicate delivery. Demonstrate that Workbench can
remove its lifecycle wrappers while retaining the accepted behavior.

## 2. Effective definitions, reversible overrides and action references

### Observed boundary

SimplyFlow composes components and app options, while Workbench's definition
adapter separately exposes components, overrides and authoring-source metadata.
Construction-time composition is useful, but it does not by itself supply a
supported live replacement contract.

The installed action proxy returns a newly bound function when an action is
read. A retained callback therefore captures the implementation from that read.
Workbench's accepted current-action forwarding fixes this at its bridges by
resolving `view.actions[name]` when invoked.

### Proposal

Expose effective named definitions and their contributing origins through a
supported introspection surface. Define applying and removing an override so
the original remains inspectable and can become effective again. Keep the
surface small and aligned with existing component composition.

Each affected runtime subsystem needs an explicit consequence:

- A changed template notifies and updates the live instances rendered from it.
- A changed subscription declaration replaces its activation and cleanup.
- A long-lived action reference can explicitly resolve the current action at
  invocation time.

The late-bound action reference should be an explicit option; silently changing
all existing captured-function semantics would be a compatibility decision.
Define behavior when a referenced entry is removed or is no longer callable.
Specify what happens if a replacement cannot activate successfully, retaining a
usable app and the previous definition rather than leaving an ambiguous state.

The future IDE consumes these mechanisms. Its editing UI, persistent personal
overrides, undo history, source downloads and marketplace remain separate.
Authored sources stay optional, version-matched assets with no normal startup
fetch. Existing named style elements already offer an editing surface; a new
style-update API is not a prerequisite established by this review.

Verify replacement and removal in an already-running instance, including
long-lived callbacks, affected templates, current bound data, focus, and
unaffected instances. Reconstructing a fresh app is insufficient evidence.

### Scoped follow-up for named transformers

The maintainer approved scoping this as a separate SimplyFlow change on
19 November 2026. Workbench's Presenter proof uses a local bridge with
the published packages. [CYC290](../.spiral/cycles/CYC-20261119-QG24H-290.md)

App-owned transformers currently receive the binding as `this`. The
binding copies the app's composed transformer map when it starts. The
transformer therefore lacks the app's API, and changing an entry on the
app's map leaves the mounted binding with its startup definition.

Propose calling app-owned render and extract transformers with
`(context, next, app)`, keeping the binding receiver. Standalone `bind()`
continues to supply the existing two arguments. App bindings should resolve
the current named definition at evaluation time. Keep the original
definition available for restoration and preserve the existing precedence
among component definitions, app definitions and built-ins.

Verify an already-mounted field and editable input use a replacement on
their next ordinary render or extract, then return to the original when
the override is removed. Check function-form and object-form transformers,
`next` chain order, built-in fallback, and two apps with the same
transformer name. Confirm that the app argument belongs to the current
binding and that standalone bindings still work. Automatic re-evaluation
of unchanged values belongs to the broader lifecycle design.

Once a published version provides the contract, rerun Presenter's
authored Cobalt replacement test against it and retire the local bridge.

## 3. Component-instance isolation

### Observed boundary and proposal

The inspected binding implementation resolves a named template reference using
`document.querySelector`. Separately mounted apps therefore rely on global
template-name uniqueness even though their containers are distinct.

Resolve templates within an explicit owning app or binding scope. If shared
templates are supported, make their scope and lookup precedence explicit.
Do not introduce implicit fallback through arbitrary ancestor data or globals.
Component prefixes remain useful public naming discipline, but should not be
the only isolation mechanism.

Verify two simultaneous app instances using the same local template name,
override/removal in one instance, nested hosting, and embedded documents.
Preserve the existing standalone binding use case. This does not require a new
component instance framework merely to solve template lookup.

### Scoped follow-up for rendered template names

The maintainer approved scoping this separately on 19 November 2026.
SimplyFlow 0.10.6 resolves named templates inside the binding's container.
The [Presenter browser proof](../.spiral/evidence/EVD-20261119-QG24H-303.md)
found that a generated element root has a private template reference only.
An inspector needs the actual template name, especially when a list
chooses among several templates.

Expose the resolved template's ID on its rendered element root. Use
`data-simply-template` for app bindings and the configured binding prefix
plus `-template` for other bindings. Treat the attribute as renderer-owned
inspection metadata. Resolve its value in the owning app so two apps can
use the same name. Keep internal template references authoritative for
rendering and rerendering.

Verify that direct and `rel` references mark the root with the resolved ID,
including after rerender and keyed reordering. Check two app containers
with the same template name and a standalone custom-prefix binding.
Include an anonymous template whose generated root has no marker and
an empty named template whose existing encoded comment still identifies
it after an empty-to-element rerender. Inspect a descendant to confirm
that its closest marked ancestor identifies the active template.

## 4. Optional app services instead of mandatory coupling

### Observed boundary and proposal

The inspected app constructor always creates a runtime include observer.
Workbench already composes its markup at build time. Runtime includes remain
useful for no-build applications, but an app should be able to omit their
activation and, where packaging permits, their implementation cost.

Keep includes available as an optional app service. Preserve the convenient
no-build path and decide compatibility before changing defaults. Runtime include
support and live template-definition updates are separate responsibilities;
making includes optional does not settle Workbench's deferred runtime
composition design.

The newer local app implementation imports drag/drop support and activates it
when configured. Retain an independently loadable path for that feature rather
than expanding the required app runtime. Use the lifecycle contract for setup
and cleanup. Establish package/subpath changes only after measuring actual
bundle inclusion; an inactive feature is not necessarily absent from a bundle.

Verify that apps which omit these services retain normal binding and commands,
and that opted-in apps retain include ordering and drag/drop behavior. Compare
complete download graphs and observer/listener counts. No capability is proposed
for wholesale deletion from the SimplyFlow library family.

## 5. Stable array-item identity: investigate only when justified

The inspected array renderer reuses DOM elements by value/object identity.
Keyed-object rendering already exists. Fresh projections of the same logical
records can therefore have different reuse behavior from edits that retain
their object references.

An optional stable item key might make those projections simpler while retaining
focus and editor instances. First compare the existing map API and benchmark
append, insert, removal, reorder and equivalent-record replacement. Do not add
another identity concept without demonstrated caller benefit.

If selected, define missing/duplicate keys, template changes, replacement-object
rebinding and command-target updates. Matching a key alone does not establish
that the reused element now edits the correct record. Verify selection,
composition, focus, behavior lifecycle and data targets, alongside render cost.
This is lower priority than lifecycle and definition contracts.

## 6. Editor interactions belong above SimplyFlow core

Refine the earlier toolbar recommendation by investigating SimplyEdit first.
The inspected local repository already exposes toolbar and selection helpers
and an editor-engine boundary. Determine whether its public contracts can serve
Workbench's Cobalt integration before creating another toolbar package.

Keep rich-text editing, selection toolbars and sortable editor UI in that
optional layer or another narrowly justified component. Notebook's cross-block
selection and split/join remain its controller integration's responsibility.
Preserve editable SimplyFlow templates and actions for app-owned presentation.
Do not assume SimplyEdit's HTML-oriented data contract already fits native
Cobalt fragments; prove the adapter and preservation behavior.

Document recovery, Solid/RDF persistence, authentication, capability protocols,
collection policy and remote conflict resolution remain outside SimplyFlow.
Its model layer continues to own supported reactive list transformations;
these proposals do not justify a parallel query or rendering system.

## Relationship to other reviews and proposed sequence

The separately supplied [Bindary review](simplyflow-bindary-review.md) covers
text/HTML boundaries, optional typed transformers, edit sessions, scheduling and
list identity. Preserve it as separate evidence. Reuse one bounded list-identity
investigation for the overlapping recommendation. Its timing and conversion
proposals are not prerequisites for this lifecycle design, nor are its cost
estimates estimates for the work described here.

Recommended order:

1. Prove the app subscription/cleanup contract with the existing events extension.
2. Define introspection and reversible live replacement, including explicit
   current-action references and scoped template lookup.
3. Make optional services independently activatable/loadable and measure the
   change in real app graphs.
4. Evaluate SimplyEdit reuse for shared editor interactions.
5. Investigate stable array keys only after a concrete reuse problem is measured.

Select coherent implementation cycles with concrete gaps and compatibility
decisions. Keep library work separately scoped and consume published npm
versions in Workbench unless the maintainer explicitly authorizes otherwise.
Acceptance requires contract tests and affected browser workflows, including
phone and keyboard behavior; automated checks do not establish manual
assistive-technology usability. No implementation, dependency upgrade, commit
or publication is authorized by recording these candidates.
