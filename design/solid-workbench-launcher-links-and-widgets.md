# Solid Workbench Launcher: links, shortcuts and widgets

Agreed interaction design · 18 November 2026

A launcher item can open a link as a **shortcut** or show a compact view of the same target as a **widget**. For a Workbench resource, the target includes the chosen app. A project note opened in Notebook can sit on a screen as a shortcut today and become an embedded note tomorrow. Either presentation opens the same note in Notebook.

## Adding a link

Dragging a link from the browser address bar, dragging a resource link from a Workbench app, and pasting a URL through the existing **Add link** action follow the same rules. A Workbench app should expose an ordinary launch URL that reopens the current file or resource in that app. The URL alone must carry enough context for the launcher to recognise that choice.

| Link received | Launcher behaviour |
| --- | --- |
| Workbench app or resource link | Honour the app named by the link. If it supports a widget for this particular target, offer **Shortcut** or **Widget**. Otherwise add an app shortcut with the original launch URL. |
| External link matching the oEmbed provider dataset | Offer **Shortcut** immediately. Check whether the provider can supply a usable embedded view for this URL. Enable **Widget** when that check succeeds. A provider match alone does not establish that an individual resource can be embedded. |
| Link without widget support | Add a shortcut directly. For a bare resource URL, the user can choose an app through the existing **Open with** flow where available. Preserve that choice on later launches. |

A drop establishes the destination workspace, screen and insertion position. Keep that destination while checking the link and while the user chooses its presentation. Choosing **Widget** places it where the link was dropped. Cancelling the choice adds nothing. Workspace switching and **Add link** stay in the existing dropdown.

If a provider returns only link information or the lookup fails, the original URL remains usable as a shortcut. If a previously added widget fails to load, keep its place and offer retry, opening the link, or switching to a shortcut.

## Screen layout and movement

Each screen is four icon columns wide, approximately the width of a phone, including on a wide display. A shortcut occupies one cell. Multiple widgets and shortcuts can share a screen in any order. Widgets may occupy two, three or four columns according to the sizes their provider supports. Every widget fits within a single screen.

Widgets follow the launcher's existing ordering and movement rules. A user can place a widget relative to another item, at the end of an existing screen, or on a new screen within the workspace. The dashed screen outline appears when movement begins and clears when the move finishes or is cancelled. Cancelling restores the original placement.

Resizing changes the space allocated to the widget. Neighbouring items flow around it in their existing order. Moving or resizing a widget preserves its app, resource and ongoing work.

## Widget controls and accessibility

The app decides whether a visible title helps someone use its widget. The launcher gives every widget an accessible name so a person can identify it and distinguish its controls from those of another widget.

- Reveal the move handle and options control on hover, on deliberate touch at the widget edge, or when a launcher control receives keyboard focus. Keep the controls available while the person reaches and operates them. Opening options takes an explicit action.
- Interactions inside the widget belong to the app. Tapping **Start** in the time tracker starts the timer on the first tap. Selecting text or operating a field leaves the widget in place.
- Provide a way to choose a move destination without dragging. Adding, moving, resizing, changing presentation, opening the full app and removing an item must all be possible by keyboard and touch.
- Make the selected destination and the outcome of an action perceivable with assistive technology. Closing options or completing a move returns focus to the item. Removing it leaves focus at a predictable place on the screen.

## Placement and app data

The launcher remembers each item's workspace, screen, order, presentation, size and target. The app owns the resource, its contents and any work in progress. Opening the full app or switching between a shortcut and a supported widget preserves the selected app and resource.

**Remove from screen** removes one placement and offers Undo. The resource and its app-owned state remain available. For example, removing a time-tracker widget leaves a running timer available in the full app. Two widgets for the same timebook show the same local timer when they share the app's storage context.

This design develops the mixed-screen layout for the existing [Launcher widget and time-tracker design](https://chatgpt.com/library?file_id=libfile_fde3_f-72900ab270148191a37564749997eb6f_08719e4e7c288191b095929ecae37414&account_id=personal). Workbench widgets use the ownership and lifecycle rules in the [shared embedded app views design](https://chatgpt.com/library?file_id=libfile_fde3_f-0245c203993081919d68d34e845f9eb6_08719e4e7c288191b095929ecae37414&account_id=personal).
