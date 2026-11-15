# Bindary review: useful ideas for SimplyFlow

Date: 15 November 2026  
Status: review and recommendations; no implementation approved or performed

## Assessment

Bindary shares much of SimplyFlow’s approach: ordinary HTML, declarative attribute bindings, reactive JavaScript objects, and no required build step. It offers useful examples of binding behaviour, but adopting its broader framework model would add concepts that SimplyFlow does not need.

The strongest opportunities are explicit text/HTML handling and small, optional typed-editing helpers. DOM scheduling deserves an experiment. Edit sessions belong initially in an application or optional module, and stable list keys should wait for evidence of a concrete problem.

The recommended small scope would add an estimated **85–220 implementation lines**. Implementing all five proposals would add approximately **275–620 lines**, with substantially more behavioural complexity. These are engineering estimates, not measured patches or delivery commitments.

## Review basis and limitations

This review compares [Bindary’s introduction](https://componyx.com/bindary/introduction#setup) and its linked documentation with [SimplyFlow at commit `7fefa52a7434360c0a9d99318cd24fd528bb047e`](https://github.com/muze-labs/simplyflow/tree/7fefa52a7434360c0a9d99318cd24fd528bb047e).

SimplyFlow’s binding, rendering, DOM tracking, state and app code were inspected, together with its reference documentation. Bindary behaviour is reported from its documentation; its implementation and sanitizer were not audited. No comparative benchmarks or browser behaviour tests were run.

Recommendations below distinguish existing SimplyFlow capabilities from proposed additions. They are constrained by SimplyFlow’s preference for small, replaceable parts, ordinary JavaScript logic, and a minimal beginner-facing API.

## Expected cost

Estimates describe **net additional handwritten implementation LOC**, excluding tests, documentation, generated bundles, migration of applications, and external dependencies. They assume narrow implementations using existing extension points. LOC is a scope indicator, not a prediction of effort or compressed download size.

| Proposal | Added implementation LOC | Complexity and maintenance cost | Recommendation |
| --- | ---: | --- | --- |
| Explicit text/HTML handling and sanitizer hook | 15–40 | Low code complexity; substantial compatibility consideration if the default changes | Pursue a design and migration decision |
| Basic number/date editing transformers | 50–120 | Low if optional and explicit; parsing edge cases require care | Add only for demonstrated application needs |
| Draft edit sessions with conflict detection | 150–300 | Significant new state and lifecycle semantics | Prototype outside the core |
| Optional stable keys for list reuse | 40–100 | Moderate; identity, replacement and duplicate-key rules | Defer until an experiment demonstrates value |
| Shared DOM scheduling replacing fixed throttling | 20–60 | Small mechanism; timing and lifecycle verification matter | Run a bounded experiment |
| **All five** | **275–620** | Meaningful expansion, particularly in editing and identity semantics | Do not adopt as one feature bundle |
| **Small scope: text/HTML, typed helpers, scheduling** | **85–220** | Mostly improvements to existing mechanisms | Preferred scope, subject to evidence |

Tests could be comparable in size to the implementation or larger. Application migration could dominate the cost of changing HTML defaults. Precise minified/gzipped size should be measured after implementation; LOC does not provide a reliable conversion, particularly if a sanitizer is bundled.

## 1. Explicit text and HTML boundaries

**Bindary:** [`b-value`](https://componyx.com/views/bindary/value-attribute) writes plain text. [`b-html`](https://componyx.com/views/bindary/html-attribute) renders HTML, with documented sanitization by default and an injectable sanitizer.

**SimplyFlow today:** ordinary string fields render as HTML. The existing `escape_html` transformer provides explicit text escaping. See the [transformer reference](https://github.com/muze-labs/simplyflow/blob/7fefa52a7434360c0a9d99318cd24fd528bb047e/docs/reference/bind-transformers.md).

**Suggestion:** make text rendering and HTML rendering explicit choices. Consider plain text as the default at a deliberate breaking-release boundary. Keep rich-content support, with a replaceable sanitization integration for applications that accept external HTML.

This is particularly useful when Workbench displays names and descriptions from external resources. A developer should be able to understand whether a field treats its value as text or markup by inspecting the binding.

**Cost and boundaries:** 15–40 lines covers a small rendering distinction and hook. It does not include writing a sanitizer. Use an established external implementation when needed; keep it optional so text-only applications do not inherit that dependency. An explicit HTML binding alone does not make external HTML safe.

**Compatibility:** existing HTML-valued fields may be intentional. Identify those usages and document a migration before changing the default. Avoid a permanent collection of overlapping legacy modes.

**Acceptance evidence:** text containing markup remains literal; intentional HTML still renders through the explicit path; the configured sanitizer is invoked; form controls retain their existing value behaviour; representative existing applications have a documented migration.

## 2. Typed editing through existing transformers

**Bindary:** its [`type` attribute](https://componyx.com/views/bindary/type-attribute) supports boolean, number and date conversion. Its [`bind` attribute](https://componyx.com/views/bindary/bind-attribute) documents configurable live versus change-triggered updates.

**SimplyFlow today:** `data-simply-edit` already supports form controls, including boolean checkboxes and array-valued selections. Transformers already have separate `render` and `extract` hooks. A new conversion framework is unnecessary.

**Suggestion:** provide a few optional transformers using those hooks. Start with a number conversion required by an actual application. Define date conversion only once the desired data representation is clear. Document when conversion happens and how invalid input is handled.

**Cost and boundaries:** 50–120 lines for basic number/date helpers. This excludes arbitrary locale-aware parsing, broad date-format support, and a new general commit-policy subsystem. Full locale support or extensive editing policies could multiply the estimate.

Keep these decisions explicit:

- Empty input must not accidentally become zero.
- Invalid or partially typed input must not silently corrupt the stored value.
- Display precision must not silently round the underlying value.
- A calendar date and a timestamp need different representations and semantics.
- Decimal-comma support needs a defined parser; formatting support alone is insufficient.

SimplyFlow currently listens to `input` and `change` events. If commit timing becomes configurable, retain browser-appropriate input handling rather than copying Bindary’s documented `keyup` approach literally.

**Acceptance evidence:** round trips for valid values; defined empty and invalid cases; usable intermediate typing states; no accidental precision loss or timezone shifts. Any timing changes also need paste and input-composition checks.

## 3. Edit sessions and incoming updates

**Bindary:** [data-change locking](https://componyx.com/views/bindary/data-changes) can postpone incoming server updates to a data path until it is unlocked.

**Suggestion:** adopt the problem definition, then solve it at the application boundary. For a first Workbench pattern, retain an original value, let the user edit a separate draft, and compare the current source with the original when committing. Report a conflict if the source changed.

Postponing an update alone does not resolve competing edits. Applying a queued remote value after editing can still discard the user’s work. Conflict resolution needs an explicit application policy.

**Cost and boundaries:** 150–300 lines for a narrow edit-session helper with draft/original state, commit/cancel and conflict reporting. This excludes automatic merging, collaborative editing, nested transaction coordination, persistence and synchronization transport.

A local comparison also does not guarantee safe remote writes. Remote concurrency protection must use the storage/API’s available version or conditional-write mechanism and remains outside this estimate.

**Placement:** begin as a Workbench application pattern. Extract an optional module only after multiple applications show that they share the same semantics. The reactive core should not decide conflict policy.

**Acceptance evidence:** commit and cancel work; remote changes are detected; concurrent values remain available for resolution; failed saves preserve the draft; unrelated data changes do not create false conflicts.

## 4. List identity and incremental updates

**Bindary:** its [repeat documentation](https://componyx.com/views/bindary/repeat-attribute) and [array-change rules](https://componyx.com/views/bindary/data-changes) describe precise updates that avoid rebuilding an entire collection.

**SimplyFlow today:** the [array renderer](https://github.com/muze-labs/simplyflow/blob/7fefa52a7434360c0a9d99318cd24fd528bb047e/packages/bind/src/render.mjs) already reuses DOM nodes by value/object identity. It scans existing items to find reusable nodes. Certain reorderings can therefore require repeated searches. Freshly fetched objects also have new identities even when they describe the same resource.

**Suggestion:** first benchmark append, insert, remove, reverse, drag-reorder and replacement with freshly fetched equivalent records. Consider a stable resource key only if replacement or reordering creates a demonstrated problem.

**Cost and boundaries:** 40–100 net lines for a focused keyed-reuse path, assuming existing lifecycle mechanisms can be reused. Reusing a node must also rebind it to a replacement object; matching keys alone is insufficient. Missing keys, duplicate keys and template changes need defined behaviour.

Bindary’s [`item-id`](https://componyx.com/views/bindary/item-id-attribute) selects a template variant; it is not a stable record key. SimplyFlow already supports matching templates. Stable resource keys are a recommendation arising from the comparison, not a feature attributed to Bindary.

**Acceptance evidence:** measure DOM changes and elapsed time, and verify focus, selection, command targets, bindings and component state. An optimization that updates the wrong record is a regression regardless of speed.

## 5. DOM update scheduling

**Bindary:** the [introduction](https://componyx.com/views/bindary/introduction) documents coalescing a burst of observed mutations within a tick.

**SimplyFlow today:** state batching and clock-controlled effects already exist. DOM binding effects use a fixed 50 ms throttle in the [binding implementation](https://github.com/muze-labs/simplyflow/blob/7fefa52a7434360c0a9d99318cd24fd528bb047e/packages/bind/src/index.mjs).

**Suggestion:** compare the current behaviour with a shared microtask or animation-frame queue. Choose a single predictable DOM scheduling rule if the experiment demonstrates a useful improvement. Keep ordinary reactive calculations’ semantics unchanged.

**Cost and boundaries:** 20–60 net lines for a narrow scheduler replacement. A public menu of timing modes, flush operations and priorities would exceed that scope and add concepts for users to learn.

**Acceptance evidence:** measure response latency and render counts; verify ordering, updates triggered during a flush, destruction while an update is pending, and absence of lost updates. Timing compatibility matters more than the small size of the mechanism.

## Architectural choices to retain

Bindary’s broader model includes multiple implicitly searched root data containers, fallback to global names, and expressions in markup. These are not recommended additions to SimplyFlow. Preserve explicit `app.data`, named JavaScript behaviour and the existing transformer extension point.

Bindary also documents component instances that provide their own binding contexts. This may be useful reference material for future composition work, but it is outside this review’s proposed scope and cost estimates. SimplyFlow’s existing component option-merging model should not be expanded merely to match another library.

## Suggested sequence

1. Decide and document the intended text/HTML contract and compatibility path.
2. Implement a typed transformer when an application supplies a concrete requirement.
3. Run a bounded scheduling experiment and retain a change only if measurements and behaviour checks justify it.
4. Prototype edit sessions in one Workbench application before proposing a shared abstraction.
5. Measure list behaviour before adding stable keys or a public array-patch API.

Each step should remain independently reviewable and replaceable. The preferred outcome is a clearer boundary or a measured improvement with minimal new API surface.

## Reuse and licensing

Bindary’s [current published license](https://componyx.com/views/license) is Business Source License 1.1 with a later MIT conversion. This review recommends independently implemented behaviour using SimplyFlow’s existing mechanisms, not copying Bindary source into SimplyFlow. Any proposed source reuse would require a separate review of the license for the exact release.

## Decision

Pursue small improvements to text/HTML handling and optional conversion helpers. Investigate DOM scheduling with evidence. Keep edit-session policy outside the core and defer stable list keys until needed. This preserves the useful lessons from Bindary without committing SimplyFlow to a larger framework model.
