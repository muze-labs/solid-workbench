# Solid design components

Experimental, private `@muze-labs/solid-design` components for the suite, based on
`@muze-nl/theds`. These are ordinary SimplyFlow datasets with authored styles and
small commands. They add no renderer or component-merging system. Publication
and use beyond the suite require their own review.

Register the components you use in your SimplyFlow app:

```js
import {
  solidDialog,
  solidDropdown,
  solidListDetails
} from '@muze-labs/solid-design';

const components = {
  solidDialog,
  solidDropdown,
  solidListDetails
};
```

The suite loads the-ds base stylesheet. This package supplies the shared layout
and interaction styles through SimplyFlow's `styles` entries. Component
entries and commands use the `solid` prefix. Style identities and root
classes use `solid-`. New part classes use `swb-`.
Existing the-ds classes and variables retain their `ds-` namespace.
Keep app-specific bindings and commands in the owning app.

## CSS entry and runnable examples

Load the built The DS stylesheet, then `@muze-labs/solid-design/styles.css`
through a package-aware build. The Workbench build emits the same extension as
`/assets/workbench-design.css` for direct HTML linking. Add
`solid-theme` to the themed root. The extension preserves the
cascade order `reset, setup, theme, base, component, page, utility`.

Run `npm run dev` from the workspace and open `/design-examples/` or
`/design-examples/simplyflow.html`. Both examples use local data and assets.
Their source is in [examples](examples/).
The SimplyFlow example puts its model in app data and binds the list to
`resourceModel.view.current`. The search command changes the query option,
and the model supplies the filtered rows directly to the template.
Both examples use a native `search` landmark and labeled input. The plain
example submits through `form` and the SimplyFlow example reports its filter
result through `output`. Native buttons and link lists make up the popovers.
The decorative search SVG is hidden from accessibility APIs. [HTML search](https://html.spec.whatwg.org/multipage/grouping-content.html#the-search-element)
· [HTML output](https://html.spec.whatwg.org/multipage/form-elements.html#the-output-element)


| Pattern | CSS and markup | SimplyFlow |
| --- | --- | --- |
| Compact search | Wrap a search input in a native label. Put the text in the label. Use the search icon partial if needed. | Include `solidListDetails` for the shared style in an app dataset. Bind an immediate command for model filtering or a form command for submitted search. |
| Anchored popover | Use a button and `popovertarget` with a matching unique ID. The shared surface supports links, commands or a form. | Include `solidTheme` for the surface. For an action list, add `solidDropdown` and its keyboard scope. |
| Dialog, panes, toast and toolbar | The same named sheets are included in the CSS entry. See the contracts below. | Use the matching exported datasets for behavior. |

A plain page links the extension stylesheet. In a SimplyFlow app the named
styles are installed from the datasets and remain editable. The two
approaches use the same source sheets.

## Styling boundaries

The generated shell declares `reset, setup, theme, base, component, page,
utility` before loading DS styles. Named feature styles expose their SimplyFlow
identities and source origins. Their `theme` sections adapt DS tokens
on component roots; implementations use component-owned `--swb-*` properties
with standalone fallbacks. Replace the adapter to connect another host design.
Override a mapped property on its component root: an ancestor value cannot
override a property initialized directly on that root.

New part classes use the suite's `swb-` namespace. These components still compose DS primitives; the variable boundary does not promise
that all DS markup can be removed without replacing that integration.

| Component | Explicit styling/structure contract |
| --- | --- |
| Dialog | Keep `ds-dialog` for native surface defaults. Apply `swb-dialog-form` to a form containing the dialog header/content/footer, `swb-dialog-title` to its title, and `swb-dialog-message` to footer paragraphs. Nested task forms keep their own layout. Set `--swb-dialog-content-padding` on the dialog for a content inset variant. A footer used outside a dialog adds `swb-dialog-footer-standalone` as its adapter root. |
| Dropdown | Keep DS popover/nav primitives. Apply `swb-dropdown-menu`, `swb-dropdown-list`, `swb-dropdown-item` and `swb-dropdown-link` directly. A menu owns hover/focus/current arbitration across its links; that short descendant relationship is intentional. `--swb-dropdown-link-padding` is an optional inherited variant; its adapter initializes separate spacing defaults. |
| List/details | Apply `swb-list-pane` directly to each pane, including panes in separately authored templates. `swb-list-toolbar` identifies an optional sticky toolbar; `swb-section-choice` identifies a wrapping section button. The host supplies the available height. The four root mappings are `--swb-list-details-space`, `--swb-list-details-space-small`, `--swb-list-details-surface` and `--swb-list-details-list-width`. |
| Toast | Keep the DS toast surface. The template applies `swb-toast-text` and `swb-toast-dismiss` directly; it has no dependency on arbitrary paragraph/button descendants. |

Suite shell layout, presentation state, palette and explicit DS icon/control
integration remain in `solid-app-ui`; page layouts and backgrounds stay with
their apps. The shared account header exposes optional inherited
`--swb-header-background`, `--swb-header-text`, `--swb-header-text-shadow` and
focus properties. Its adapter initializes separate defaults, so Launcher can
configure those properties without reaching into header descendants.

The build uses the installed DS `dsBuildSheet` API with its named local sheets,
omitting the optional remote font import. It does not ship design catalogue JS
or a second copy of authored component CSS. Fonts already installed on a device
can still satisfy the DS font-family list. Named styles remain editable and
restorable in place; ordinary apps gain no stylesheet updater or IDE machinery.

## Dialogs

Use a native `<dialog class="ds-dialog solid-dialog">`. Its form or
content contains `.solid-dialog-header`,
`.solid-dialog-content` and `.solid-dialog-footer`.
Content scrolls within the viewport limit; the header and footer stay visible.
The title is optional; give untitled dialogs an accessible label. A close button
uses `.solid-dialog-close` and an accessible name.

Use `actions.solidOpenDialog(dialog)` and
`actions.solidCloseDialog(dialog)` for shared native lifecycle motion.
The latter returns a promise that resolves after native close and focus return.
The `solidCloseDialog` command closes the nearest dialog through that
action. Use it only when closing is safe. Forms that have unsaved work or an in-flight save supply their own
close command; the capability host checks its provider before closing. Opening,
closing and focus remain native browser operations. SimplyFlow renders the
content and binds its state.

## Dropdowns

Add `.solid-dropdown` to a the-ds dropdown. Its link/button rows get
consistent full-width targets and clear blue hover, keyboard-focus and current
item styling. Use the-ds markup with a native popover and a prefixed, unique ID.
Use `data-simply-shortcuts="solidDropdown"` on the dropdown wrapper
to enable Arrow Down/Up on its trigger and rows. Arrows open the native popover,
focus the first/last row and wrap through enabled visible rows. Native Tab,
Enter/Space, Escape and outside-click behavior remains available. Pointer opening
does not force focus onto a row. Hover takes visual precedence over keyboard
focus so only the row under the pointer is highlighted. No second activation
system is needed.

## Lists and details

Add `.solid-list-details` to a container with two `.ds-panels-pane`
children, using `.ds-panels-list` and `.ds-panels-details`. On wider screens these
are adjacent panes; on smaller screens they are horizontally scrollable panes
with snap positions. Each pane scrolls independently. List toolbars stay visible
at its lower edge.

A details-pane Back button can use `.solid-list-back` and the command
`solidShowList`. The app's selection command scrolls/focuses its details
pane when appropriate. Lists, details and selection data remain owned by the app;
this component provides presentation and navigation, not a parallel list model.


## Toasts

Register `solidToast` and mount its `solid-toast` template in
the owning app. Initialize `data.solidNotice` to
`{ text: '', visibility: { hidden: '' } }` and provide `runtime: {}`. Call
`actions.solidNotify(text)` for nonessential completion confirmations.
It replaces the current notice, announces through a polite atomic status region,
and expires after eight seconds unless hovered/focused. Dismissal is labelled;
keyboard dismissal returns focus to the previous control. Destroying the instance
clears its timer and listener. Plain text is escaped by SimplyFlow.

Keep essential information, errors and recovery actions available inline rather
than timing them out. Mount an instance within a modal for feedback from that
modal; content outside a native modal is inert. The suite supplies `host.notify`
for ordinary app confirmations and a separate Preferences instance. No toast
animation or automatic focus change is used. This is a latest-notice surface,
not a persistent notification inbox.


Shared dialogs use 300ms fade/scale and native backdrop animations; reduced
motion skips them. Native modality remains until closing finishes. Simple dialogs
can opt into animated Escape with
`data-simply-behavior="solidDialog"`. Guarded capability dialogs keep
their own cancel listener and invoke the shared close action only after permission
to close is established. Fullscreen phone layout applies below 720px. Native Web
Animations fills Firefox's missing CSS deferred-overlay transition support;
no dialog method is patched and no backdrop DOM is constructed.

## Shared Workbench theme

`solidTheme` adapts the supplied
`design/solid-workbench-theme.zip` into editable named styles. The suite opts in
with `solid-theme` on its root. Appearance classes on the containing
body select light, dark or system mode through the existing Preferences API.
The component maps the installed the-ds tokens; do not load the archive's vendor
stylesheet or example script. All component classes and custom properties use
the `solid-` prefix.

Forms use `-control`, `-label`, `-choice-input`, `-button`, `-button-primary` and
`-button-quiet`. Native selects have a `-select-wrap` and decorative `-chevron`;
forced-colors mode restores the browser arrow. Native labels, validation, draft
state and saving remain app-owned. `-list-row` provides row layout and
`-list-state` supplies normal, hover, selected and keyboard-focus appearance.
Thumbnail lists may use only the state class to preserve their content geometry.

The viewport's main application bar holds buttons, text and status, never form
inputs. Contextual forms belong in content panels or dialogs. Floating toolbar
surfaces use `--solid-elevation`: shadow in light mode, glow in dark.
Existing dialog lifecycle, focus restoration and draft-close guards are retained.

List-details search uses `solid-list-search` on the native label
and `solid-list-search-input` with `solid-control`
on the input. For a compact field, place the label text in a span with
`solid-list-search-label`. Keep the label text meaningful.
Include [search-icon.html](src/search-icon.html) immediately before the input
to get a decorative icon and the corresponding input inset. The example
sprite path is relative to the final page.

Use `solid-popup` for the themed popover surface and
`solid-popup-anchored` for bounded positioning. Add
`solid-popup-scope` to the common wrapper and
`solid-popup-trigger` to the button for the named anchor recipe.
Set `--solid-popup-anchor` on each wrapper to a distinct
dash-prefixed name. This also places the menus independently in browsers
that support CSS anchors before supporting implicit popover anchoring.
The trigger uses native `popovertarget` and the panel uses `popover="auto"`.
In browsers without CSS anchor positioning the panel opens centered.
The shared shell closes outside auto popovers when focus enters an owned iframe;
it does not inspect frame contents or close a popover containing that iframe.
Fixed toolbars are transparent by default; floating toolbars keep a surface.
`solid-toolbar-title` follows the shared 20px default title scale.

Insertion markers use `--solid-insert-height` (default `4rem`)
independently of row text height. Apply `solid-insert-inside` at
a container's first slot to place the marker inside its boundary; other slots
retain the between-item offset.

`--solid-toast-available-width` optionally reserves horizontal room
for a floating action while keeping the normal bottom-right toast position.
Its default is `calc(100vw - 2rem)`; Launcher reserves its bottom-left Add action.

Choose either `solid-label-one-line` or
`solid-label-two-lines` for overflow ellipsis; the one-line utility
uses block display and nowrap, and the two-line utility uses line clamping.
