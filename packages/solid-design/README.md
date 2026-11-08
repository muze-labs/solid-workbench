# Solid design components

Experimental, private `@muze-labs/solid-design` components for the suite, based on
`@muze-nl/theds`. These are ordinary SimplyFlow datasets with authored styles and
small commands. They add no renderer or component-merging system. Publication
and use beyond the suite require their own review.

Register the components you use in your SimplyFlow app:

```js
import {
  muzeSolidDesignDialog,
  muzeSolidDesignDropdown,
  muzeSolidDesignListDetails
} from '@muze-labs/solid-design';

const components = {
  muzeSolidDesignDialog,
  muzeSolidDesignDropdown,
  muzeSolidDesignListDetails
};
```

The suite loads the-ds base stylesheet. This package supplies the shared layout
and interaction styles through SimplyFlow's `styles` entries. Existing component
entries, commands, style identities and root classes retain their
`muzeSolidDesign` / `muze-solid-design` prefixes. New part classes use `swb-`.
Existing the-ds classes and variables retain their `ds-` namespace.
Keep app-specific bindings and commands in the owning app.

## Styling boundaries

The generated shell declares `reset, setup, theme, base, component, page,
utility` before loading DS styles. Named feature styles keep their existing
SimplyFlow identities and source origins. Their `theme` sections adapt DS tokens
on component roots; implementations use component-owned `--swb-*` properties
with standalone fallbacks. Replace the adapter to connect another host design.
Override a mapped property on its component root: an ancestor value cannot
override a property initialized directly on that root.

New part classes use the suite's shorter `swb-` namespace. Existing component
identities, commands and public `muze-solid-design-*` roots are retained. These
components still compose DS primitives; the variable boundary does not promise
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

Use a native `<dialog class="ds-dialog muze-solid-design-dialog">`. Its form or
content contains `.muze-solid-design-dialog-header`,
`.muze-solid-design-dialog-content` and `.muze-solid-design-dialog-footer`.
Content scrolls within the viewport limit; the header and footer stay visible.
The title is optional; give untitled dialogs an accessible label. A close button
uses `.muze-solid-design-dialog-close` and an accessible name.

Use `actions.muzeSolidDesignOpenDialog(dialog)` and
`actions.muzeSolidDesignCloseDialog(dialog)` for shared native lifecycle motion.
The latter returns a promise that resolves after native close and focus return.
The `muzeSolidDesignCloseDialog` command closes the nearest dialog through that
action. Use it only when closing is safe. Forms that have unsaved work or an in-flight save supply their own
close command; the capability host checks its provider before closing. Opening,
closing and focus remain native browser operations. SimplyFlow renders the
content and binds its state.

## Dropdowns

Add `.muze-solid-design-dropdown` to a the-ds dropdown. Its link/button rows get
consistent full-width targets and clear blue hover, keyboard-focus and current
item styling. Use the-ds markup with a native popover and a prefixed, unique ID.
Use `data-simply-shortcuts="muzeSolidDesignDropdown"` on the dropdown wrapper
to enable Arrow Down/Up on its trigger and rows. Arrows open the native popover,
focus the first/last row and wrap through enabled visible rows. Native Tab,
Enter/Space, Escape and outside-click behavior remains available. Pointer opening
does not force focus onto a row. Hover takes visual precedence over keyboard
focus so only the row under the pointer is highlighted. No second activation
system is needed.

## Lists and details

Add `.muze-solid-design-list-details` to a container with two `.ds-panels-pane`
children, using `.ds-panels-list` and `.ds-panels-details`. On wider screens these
are adjacent panes; on smaller screens they are horizontally scrollable panes
with snap positions. Each pane scrolls independently. List toolbars stay visible
at its lower edge.

A details-pane Back button can use `.muze-solid-design-list-back` and the command
`muzeSolidDesignShowList`. The app's selection command scrolls/focuses its details
pane when appropriate. Lists, details and selection data remain owned by the app;
this component provides presentation and navigation, not a parallel list model.


## Toasts

Register `muzeSolidDesignToast` and mount its `muze-solid-design-toast` template in
the owning app. Initialize `data.muzeSolidDesignNotice` to
`{ text: '', visibility: { hidden: '' } }` and provide `runtime: {}`. Call
`actions.muzeSolidDesignNotify(text)` for nonessential completion confirmations.
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
`data-simply-behavior="muzeSolidDesignDialog"`. Guarded capability dialogs keep
their own cancel listener and invoke the shared close action only after permission
to close is established. Fullscreen phone layout applies below 720px. Native Web
Animations fills Firefox's missing CSS deferred-overlay transition support;
no dialog method is patched and no backdrop DOM is constructed.
