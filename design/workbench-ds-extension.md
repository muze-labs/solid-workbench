# A Workbench extension for The DS

The next component cycle begins with the UI shipped by the suite. Its outcome
is an installable-in-the-workspace extension for The DS with working consumers
and reusable SimplyFlow behavior where it helps. The component catalog should
describe exports that an author can actually import. A Tasks sample can exercise
the finished contracts in a later cycle.

## What the source shows

The Workbench theme already describes itself as a CSS-only extension for The
DS. The suite currently loads it through a SimplyFlow dataset, alongside
datasets for dialogs, dropdowns, list/details, toolbars and toasts. The DS
already ships forms, buttons, dropdowns, dialogs, panels, tabs, alerts and
toasts. Its installed build API accepts a collection of named CSS sheets.
Start with `@muze-labs/solid-design` as the extension. Give it a CSS entry
usable with ordinary HTML, and keep the existing SimplyFlow exports as the
behavior entry point. Publishability outside the workspace can be evaluated
after the contracts are proven. [Current exports](../packages/solid-design/src/features.mjs)
· [Workbench theme](../packages/solid-design/src/theme.css)
· [Current stylesheet composition](../scripts/build.mjs)

| Candidate | Behavior seen in the suite | Proposed home |
| --- | --- | --- |
| Compact search field | Contacts, the Launcher catalog and Documents annotation search repeat the icon, label and input. Contacts binds a model filter. The catalog changes model options through a command. Documents also has a submitted PDF text search. | Promote the shared native search markup and CSS as one recipe. The application supplies its accessible name and chooses live filtering or submit. A generic search dataset can wait until there is common behavior beyond binding a field. [Contacts](../apps/contacts/src/list.html) · [Catalog](../apps/launcher/src/catalog.html) · [Documents](../apps/documents/src/documents.html) |
| Anchored menu and compact toggle button | Documents' reading mode and Presenter both use the anchored popover classes. Documents has pressed sidebar switches. Notebook and Viewer bind pressed formatting buttons. | Extend the existing toolbar and dropdown styles with a named trigger, chevron and pressed-state contract. Use ordinary popovers and buttons. Reuse dropdown keyboard behavior for menus that need it. The feature owns which view or formatting command the control activates. [Documents](../apps/documents/src/documents.html) · [Presenter](../apps/presenter/src/presenter.html) · [Notebook controls](../apps/notebook/src/block-tools.html) |
| Section list with detail pane | Preferences, the Launcher catalog, and the collection browser use the existing list/details layout and focus handoff. | Expose the pane layout through the CSS entry and document its existing SimplyFlow focus and Back behavior. Keep selection and history app-owned. A section navigator and a tabbed panel have different interaction contracts. [Existing list/details dataset](../packages/solid-design/src/components/list-details.mjs) · [Preferences sections](../apps/preferences/src/sections.html) |
| Collection browser and compact rows/cards | Notebook and Presenter already reuse the same dataset and template. Each app imports the dataset and also refers to a repository-relative template path. The dataset offers card or row presentation, filtering and host commands. | Make the styles and native list structure usable via the extension. Expose an explicit SimplyFlow template and dataset entry through a documented build path. Keep app data projection, route selection and mutation in Notebook and Presenter. Consider the move out of solid-app-ui only after a small consumer can import it without a suite shell. [Shared dataset](../packages/solid-app-ui/src/components/collection-browser.mjs) · [Notebook composition](../apps/notebook/src/collections.html) · [Presenter composition](../apps/presenter/src/collections.html) |
| Inline status and recovery | Files editing, Documents note editing and Notebook forms each put feedback near the task. The shared toast already covers transient success. | Provide a visual treatment and example for persistent error or busy feedback using existing The DS alert/form primitives where they fit. The host supplies the status, validation and retry action. Use native semantics and add a live region where a change needs an announcement. [Files](../apps/files/src/editing.html) · [Notebook](../apps/notebook/src/notebook.html) · [Documents](../apps/documents/src/documents.html) |
| Floating formatting controls | Notebook reads Cobalt command state, Viewer owns a Cobalt editor provider, and Documents invokes an annotation editor and retains its own note workflow. A shared toolbar already positions a surface within the visual viewport. | Reuse toolbar placement, button states and link-dialog presentation where they match. If two editors can use the same command and selection contract, share that behavior at the Cobalt boundary. Keep provider invocation, note submission and document selection in their owning features. [Toolbar dataset](../packages/solid-design/src/components/toolbar.mjs) · [Notebook selection tools](../apps/notebook/src/rich-text-tools.mjs) · [Viewer editor](../apps/viewer/src/components/cobalt-editor.mjs) · [Documents editor](../apps/documents/src/note-editor.mjs) |

The account menu, session recovery, capability dialog and top-level app toolbar
integrate with Workbench's host. They continue to compose the extension and
belong in solid-app-ui. Files resource selection and Contacts recipient
selection already have reusable capability interfaces. PDF annotation anchors,
Presenter editing regions, and Launcher screen ordering are app workflows.
The Launcher insertion marker is already a shared visual class. A second
reorderable consumer would establish whether its keyboard destination behavior
is worth moving. [App toolbar](../packages/solid-app-ui/src/components/app-toolbar.mjs)
· [Capability dialog](../packages/solid-app-ui/src/components/capability-dialog.mjs)
· [Launcher movement](../apps/launcher/src/components/shortcut-menu.mjs)

## What to borrow from Alloy CSS

Alloy demonstrates its components in a complete HTML page and documents the
required markup, customization points and browser requirements together. Its
author reference gives humans and AI the same searchable class and markup
contracts. Take that approach for the extension. Put a plain HTML example
beside a SimplyFlow example with real list state, and show the source for each.
Keep The DS cascade, namespaced component classes, and the adapter from
The DS tokens to component-owned custom properties. Alloy's global reset
and utility vocabulary would duplicate the existing foundation.
[Alloy demo](https://alloyhtml.com/)
· [Alloy author reference](https://alloyhtml.com/llms.txt)
· [Alloy source and license](https://github.com/alloyhtml/css)

| Alloy pattern | Workbench decision |
| --- | --- |
| Icon with a native search input, and action menus using popover | Use these as references in the first extraction. The browser owns disclosure and ordinary button activation. SimplyFlow binds state and adds the existing arrow and focus behavior where a menu requires it. |
| Docked sidebar that becomes a narrow-screen popover drawer | Strong next candidate for Documents. Prototype using the outline as the first consumer. Keep the desktop open preference when crossing the breakpoint, avoid resizing the document merely because an overlay opens, and verify Escape, focus return, touch and pointer dismissal. The app owns which panel is selected. |
| Native disclosure and accordion with `details` and `summary` | Add a small CSS recipe. Group disclosures with `name` when opening one should close the others. Ordinary disclosure can stay entirely native. |
| Compact icon actions and tooltips | Prove a row action with Documents bookmarks or annotations. Give it an accessible name and make it available on touch and keyboard. Use the tooltip as a supplementary short label, with focus and dismissal checked. Essential text remains visible or otherwise accessible without hovering. |
| Responsive table rows that stack or fold | Compare these with a horizontally scrolling native table in the large-table cycle. Start with semantic headers and cells. Test screen-reader associations and focus after changing display modes. Use SimplyFlow for sorting, paging and virtual scrolling as needed. |

Alloy's native `commandfor` dialog examples offer a useful static demo where
supported. Keep the existing SimplyFlow dialog lifecycle for guarded editors
and the supported browser range. For single-choice controls, use native
radios. Alloy's radio-driven panels announce a radio choice. Use Workbench's
section-list behavior for app navigation and define a separate keyboard
contract if a feature needs semantic tabs. A manual toast popover is useful for
showing presentation in a plain HTML demo. The existing SimplyFlow toast
already owns app announcements, timing and focus. [Alloy interactive patterns](https://alloyhtml.com/llms.txt)
· [Alloy browser requirements](https://github.com/alloyhtml/css#browsers)

## Open UI and the platform contracts

Open UI’s research offers vocabulary and prior art for the catalog. Its
popover explainer distinguishes a top-layer surface from the behavior of the
controls it contains. Follow HTML for invokers, focus and light dismissal,
and CSS Anchor Positioning for explicit and implicit anchors. Reuse native
focus and dismissal, then add SimplyFlow arrow navigation for action lists.
Keep form popovers such as Presenter settings as plain labeled controls with
native Tab. Use a named anchor per pair while the supported browser range
requires it. [Component name matrix](https://open-ui.org/research/component-matrix/)
· [Open UI popover explainer](https://open-ui.org/components/popover.research.explainer/)
· [HTML popover](https://html.spec.whatwg.org/multipage/popover.html)
· [CSS Anchor Positioning](https://drafts.csswg.org/css-anchor-position-1/#position-anchor)

Track focusgroup, menu elements and toolbar proposals as the browser platform
evolves. Open UI's exclusive accordion explains how grouped native disclosures
can support a later recipe. [Focusgroup V2](https://open-ui.org/components/focusgroup-v2.explainer/)
· [Exclusive accordion](https://open-ui.org/components/accordion.explainer/)
· [Open UI proposal index](https://open-ui.org/)

## First extraction cycle

1. Define one CSS entry that composes with The DS in its existing cascade order
   and retains the current theme boundary. Use the installed named-sheet
   composition. Use the `solid` JavaScript and `solid-` CSS/markup prefixes.
   Migrate component consumers, style identities and examples together. Load each shared sheet once in the suite while keeping
   its named styles inspectable in the running SimplyFlow feature definition.
2. Prove the boundary with **compact search and anchored menus**, drawing from
   Contacts, Launcher, Documents and Presenter. Include a minimal HTML example
   using the CSS entry and native controls, plus a SimplyFlow example with
   a bound list and existing dropdown commands. Use existing components for
   the toolbars and popovers. Remove duplicate app presentation only after
   the equivalent interaction is exercised in both consumers.
3. Keep a Markdown index adjacent to the package. Point each entry to its
   actual CSS or SimplyFlow export, runnable example, inputs and host-owned
   behavior. Add the collection browser template contract as the next extraction
   once it has a supported build-time import. Exercise it in Notebook and
   Presenter before introducing a new domain sample.

Success means a plain HTML page uses the extension without a SimplyFlow runtime
and the migrated Workbench views can still be edited through their named
feature datasets. The search field and menu need native labels, keyboard and
touch access, predictable focus return, light/dark styling and two independent
instances where applicable. Check phone reflow and enlarged text. App models,
cached data and drafts retain their current ownership and offline behavior.
Measure cold phone loads and the complete JS graph. Use build-time templates,
the existing event lifecycle and named CSS so neither examples nor authoring
sources add startup requests. [Moldable Solid Apps](Moldable-Solid-Apps.md)
· [Browser styling rules](Browser-Styling-Guide-for-AI.md)

Once the first extraction exists, use Tasks as an independent test of the
authoring contract. Keep the virtual table on its own evidence track. The
SimplyFlow and EduLinq examples show model windowing and column projection.
They still need a paginated or ordinary-table comparison and keyboard,
enlarged-text and screen-reader evidence before becoming a reusable table.
[Component roadmap and table investigation](workbench-component-roadmap.md)
