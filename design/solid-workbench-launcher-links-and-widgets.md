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

## Automatic shortcut metadata

Adding a public web URL triggers one Workbench capability, **Discover shortcut metadata**. The Launcher calls the configured server-side provider through its Metro client. The provider can read public sites whose CORS policy prevents browser JavaScript from inspecting their HTML. Save the shortcut immediately with its hostname and a default icon. Apply the result to the same shortcut only if its URL still matches, and fill each field only while it has no user override. A deleted shortcut stays deleted. Opening a saved shortcut needs no discovery request.

Add **Shortcut metadata** to Preferences’ existing provider choices. A user can enter a compatible service URL, including a self-hosted instance. Persist the choice per WebID across workspaces. Each Workbench deployment supplies a default service endpoint. When the preference is unset or explicitly reset, use that endpoint automatically. Show the effective endpoint and whether it came from the user or the deployment. If the preference cannot be read, use a cached choice for that identity or defer discovery until preferences load. If a selected service is unavailable, keep the shortcut and retry through the selected service. This keeps the submitted URL within the user's chosen provider. Verify selection, reload, account switching and reset with two independent endpoints. [Existing provider preference controls](../apps/preferences/src/components/providers.mjs)

The proposed service accepts `POST /shortcut-metadata` with one JSON field, `url`. The Launcher retains the original navigation URL and strips the fragment from the discovery request. The service sees the path and query, which can identify private links. Allow local-only addition and omit submitted URLs from request logs. The response contains a bounded plain-text `title` and an optional service-owned `iconUrl` identifying a cached, normalized launcher image. That image endpoint accepts only an existing asset identifier. Callers cannot supply upstream headers, credentials, methods, selectors or a response format. The service returns neither upstream response bodies nor arbitrary assets.

1. Read a bounded prefix of the HTML using an anonymous request. Parse the head without executing scripts. Read the page title and declared icon links. Follow the advertised `rel="manifest"` URL, which can have any filename. Resolve HTML links against the effective document base and manifest icon paths against the final manifest URL. Treat malformed or missing metadata as a partial result. [Web Application Manifest](https://www.w3.org/TR/appmanifest/)
2. Prefer the page title for the shortcut so two deep links into one app can have distinct names. Fall back to the manifest's `short_name`, then `name`, then the hostname. Prefer a suitable manifest icon, then an HTML icon, then the origin's `/favicon.ico`. Ignore the manifest's `start_url` for navigation. A web app manifest discovered this way supplies display metadata only. Workbench capability registration continues to use its own manifest workflow.
3. Restrict outbound traffic to public HTTP(S) destinations. Reject embedded credentials and disallowed ports. Enforce the address restriction at connection time for the page, manifest, icons and every redirect, including IPv6. Use fixed request, redirect, decoded-byte, pixel and time limits and per-caller quotas. Decode supported icons within those limits and re-encode a small raster image. Discard unsupported images. This keeps the response useful for populating a tile even when the page or image source is untrusted.

Exercise the service with a cross-origin site without CORS headers, a relative manifest and relative icon, a favicon-only page, malformed metadata, and a blocked destination after a redirect. Verify that slow discovery preserves a manual rename, an offline addition still launches the original deep link once online, and the only remotely retrievable outputs are shortcut metadata and normalized icons.

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
