# Solid Workbench: application priorities

Date: 2026-11-12

Status: agreed product direction, with proposed implementation slices identified separately. This is a roadmap addendum for incorporation into Solid Workbench; it does not change repository files or select an implementation cycle.

## Purpose

Solid Workbench should provide a useful basis for personal use and a later suite of business apps. Prioritize ordinary, complete workflows and reuse their data and capabilities across contexts. Integration with existing applications is preferable where building another app contributes little to the Solid environment.

## Recorded decisions

| Area | Direction | Priority or boundary |
| --- | --- | --- |
| Notebook | Continue from the existing prototype in cobalt-note. | Include in the personal-use foundation; this confirms an existing roadmap item. |
| Tasks | Add an app for personal tasks, with a path into project and business workflows. | Agreed addition. Do not require a project for an ordinary task. |
| Calendar | Add an app for appointments and events. | Agreed addition for personal and later shared/business use. |
| Reactive calculations | Explore an app in the style of scientific notebooks, with tables as an optional interface. | Experimental direction; do not assume a conventional spreadsheet is the primary model. |
| Time tracking | Include as a focused application. | Muze expects a near-term need, so this may be pulled forward. No fixed delivery order or date is selected. |
| Email integration | Defer. | No mail client or email-integration work is selected here. |
| Expenses and invoicing | Defer or delegate to existing applications. | Prefer targeted connections to those applications over building a native finance suite. |

The prior suggestions for photos, bookmarks, search, reminders and activity are not newly accepted roadmap commitments through this decision. Existing plans for Presenter, Zett, CRM, Forms, Chat and document/knowledge workflows remain separate.

## Notebook and reactive calculations are different workflows

**Notebook** continues the note-taking prototype in [cobalt-note](https://github.com/muze-labs/cobalt-note/tree/main/packages/notebook). Reuse and assess that implementation rather than treating Notebook as a new application from scratch. Integration work still needs to establish the supported note types, persistence and editor/provider boundaries.

**Reactive calculations** explores computational documents: inputs, calculations and explanatory content whose dependent results update when inputs change. A table is one possible way to enter or inspect data, alongside other suitable views. This is a working description, not a selected app name, execution engine or programming language.

Proposed design questions for the experiment:

- How are inputs, calculations and dependencies represented and made understandable to users?
- Which computations update automatically, and how are cycles, errors and stale asynchronous results handled?
- Which operations are pure calculations, and which involve network access or writes that must not run merely because a dependency changed?
- How can a result appear as a table, chart, text or another compatible embedded view without coupling the computation to that renderer?
- What can be reused from Zett for structured-data editing, and from Notebook for document interactions, without assuming that either already supplies a reactive execution model?

These are questions to resolve in a small prototype, not a requirement to build a general scientific computing platform. The shared embedded-view design offers a route to replaceable input/output views; evaluation and dependency management remain responsibilities of the computational app.

## Personal and business continuity

Tasks should be usable on their own and later linked to contacts, projects, documents and customer records. Calendar events can refer to the same resources. Avoid separate incompatible task models for personal use, Projects and CRM.

Time tracking should support useful work before the full business suite exists. Its first scope should be shaped by Muze's actual workflow. A candidate small slice is recording and correcting time entries, optionally linking them to a task or project, reviewing totals, and exporting or handing off selected entries. Timers, approvals, billing rules and team reporting remain scope decisions rather than assumed requirements.

Expenses and invoicing should stay with existing applications where appropriate. Candidate integration points include transferring approved time totals, supplying a customer reference, or linking to an external quote or invoice. These examples are proposals, not selected integrations. Keep external systems authoritative for the records they own and avoid introducing synchronization without a demonstrated workflow.

## Planning implications

1. Retain Notebook and its cobalt-note starting point in the near-term personal-app direction.
2. Add Tasks and Calendar explicitly to that direction.
3. Assess Muze's time-tracking requirements soon enough to decide whether it should precede some of those apps.
4. Give reactive calculations a bounded exploratory prototype, with tables as one UI option.
5. Keep email, native expenses and native invoicing out of the selected scope; revisit specific external connections when a concrete use arises.

This establishes priorities and boundaries rather than a strict implementation sequence. Each selected slice should retain the suite's focused-app, accessible, mobile, local-first, native-RDF and replaceable-capability principles.

## Related work

- [Solid Workbench roadmap reviewed for this discussion](https://github.com/muze-labs/solid-workbench/blob/63b0976df7faf5b2f729a7d2c4ae0e0523aab499/design/solid-apps-roadmap.md).
- [Shared embedded app views design](https://github.com/muze-labs/solid-workbench/blob/63b0976df7faf5b2f729a7d2c4ae0e0523aab499/design/solid-workbench-embedded-app-views-design.md).
- [Cobalt notebook prototype](https://github.com/muze-labs/cobalt-note/tree/main/packages/notebook).

The decisions above come from the maintainer's instructions in this discussion. Proposed slices and questions require further design; no implementation or compatibility is claimed here.
