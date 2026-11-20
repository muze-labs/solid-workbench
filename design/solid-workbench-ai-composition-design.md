# AI-Composable Solid Workbench

**Status:** Initial design proposal — for review; not approved for implementation  
**Date:** 2026-11-12, revised 2026-11-20\
**Scope:** Solid Workbench, SimplyFlow components, capability broker, optional AI providers, future Weblets-style cooperation  
**Basis:** `solid-workbench-main.zip` (2026-11-12 snapshot) and prior design discussion

## Generic assistant first · 20 November 2026

Deliver the shared assistant before app-specific AI features. Social Bookmarks is the first consumer. The later UI-composition stages below extend this foundation. An app can offer operations the assistant may call and request an operation the assistant provides. Both directions reuse the existing capability broker. The assistant ships and runs independently, and the Workbench inspector, runtime-definition API and override loader have no entry points into it.

**First interaction.** The user chooses “Suggest topics” for selected bookmarks. Bookmarks requests a classification capability with the selected titles and URLs, or grants a scoped read of that selection. The assistant shows which app and provider are involved and sends the selected data to the configured model. It returns bookmark IDs and proposed tags. Bookmarks validates the result and owns review, undo and saving. App capabilities carry an identifier and data contracts. Their implementations execute in the app that owns them. Each invocation checks the caller's grant, resource scope and input. Treat model output, tool descriptions and fetched page text as data. Page text cannot authorize another tool or widen the selection. Closing a session revokes its ports and grants.

**Origin and credentials.** Use a dedicated HTTPS origin serving only assistant-owned static assets. In development use a dedicated localhost port. Open **Connect AI** in a new browser tab on the assistant origin so the address bar identifies the site receiving the key. Enter, replace or forget the key in this tab. Each app opens its chat in a side panel. Store it in IndexedDB under that origin, bound to its exact provider origin. Only the assistant attaches it to a direct HTTPS request to that provider, with redirects rejected. Pick a provider whose browser API supports the required CORS requests. A new endpoint needs its own configuration and credential choice. Broker messages, Solid pods, model prompts, diagnostics and app preferences must exclude keys. This provides isolation from other web origins. The browser owner can inspect delivered source and browser storage with developer tools.

**Chat panel.** Add an Assistant action to each app's shared shell. Reuse the Inspect panel's dock placement, keyboard-resizable separator, responsive width and focus return. Load the chat on first open. The shell owns the dock and hosts an iframe served by the assistant origin. The assistant renders the transcript, composer, send/stop controls and provider status in that frame. Give each app instance its own conversation and scoped capability connection. Show the active app and the selection supplied to the assistant. Opening the panel alone sends no app data. Bookmarks' “Suggest topics” opens this same conversation with the chosen bookmarks. The assistant has its own messaging contract, independent of the inspector bridge.

When disconnected, show **Connect AI** inside the panel. Opening the tab requires a user click. Preserve the draft message while connecting. Each assistant iframe establishes a private session with the top-level assistant tab. It reads current model settings and grant status through that session, and the tab dispatches provider requests. Browser storage can be partitioned by the embedding site, so the frame uses the tab's first-party state across deployments. If the tab closes, the frame shows **Reconnect**. Reopening uses the existing first-party setup. Credential handoff and storage-access alternatives remain follow-up design options. [Browser storage partitioning](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning)

**Per-app permission.** Any app may offer a connection. After connecting to the trusted assistant tab, show each task approval in the frame of the app that owns the requested capability. The assistant frame identifies the app, verified origin and requested model disclosure. When the assistant calls an app capability, the owning app shows that request and enforces its grant. Example: “Let Social Bookmarks send selected titles and URLs to your AI provider to suggest tags?” Give the user one decision for this first task. **Allow once** grants this connection and invocation only. **Remember for this app** grants the connection and this capability for subsequent use. **Allow all capabilities for this app** grants the connection and the set of capabilities shown, subject to their stated data scopes. **Deny** leaves the request unfulfilled. Return the user to the chat after the decision. For a previously connected app ask only when a requested capability exceeds its grant. Show the direction of each grant, such as Bookmarks asking the assistant for tags or the assistant asking Bookmarks to read page text. Users can review and revoke individual grants or disconnect the app in assistant settings. Key the grant to the verified app identity, capability URI, direction and scope. A new or materially expanded capability requires a new grant, including after bulk approval.

Keep persistent grants in assistant-owned storage and enforce them before releasing context, spending provider credit or dispatching a tool call. Revoke active ports and cancel pending work where possible. Previous disclosures and completed requests cannot be recalled. For credential handoff to an assistant frame, specify how it learns revocations before reusing the credential and what happens across reload, disconnect or tab closure. An app may keep its own review step before saving or publishing AI output.

The browser authenticates origins. Two malleable apps served from the same origin can impersonate each other's self-declared app ID. For enforceable separate grants, use separate origins or a trusted launcher/broker that isolates instances and vouches for their identities over channels inaccessible to sibling apps. If a standalone same-origin installation provides neither, present the grant as covering that origin and make its scope visible.

**Model and effort.** At the top of the open assistant tab, show the active provider, exact model ID and reasoning effort above **Connected apps**. Populate the model selector from the configured provider where available and allow entry of an exact model ID for providers without discovery. Display the identifier alongside any friendly label. Offer a versioned ID when the provider exposes one and identify known rolling aliases. Bind the choice to the configured provider and remember it locally on the assistant origin.

The effort control uses the choices the adapter supports for that exact model. **Provider default** omits the effort parameter. If the model offers no effort control, show **Not configurable**. When changing models, clear any incompatible effort and show the resulting choice before applying. If the provider rejects the model or effort, surface its error and link back to these settings. Changing to another model or effort is the user's decision.

For the first version, use one active selection across connected apps. Side panels show the effective model and effort and link to the open tab to change them. Apps request capabilities within their grants. Only the open tab can change the model settings. Capture the model ID and effort when the user submits a request, including any tool-call continuations for that turn. A later settings change applies to newly submitted requests. Model selection does not change app permissions. Verify with a mock provider that two apps use the selected ID, that provider-default effort is omitted, and that changing the settings during a turn affects only the next turn.

**Connected apps tab.** After provider setup, the assistant tab opens on **Connected apps**. The same view is reachable from each app's chat panel. List apps with live sessions and apps with remembered permissions. Show each app's name, verified origin, connection status and granted capabilities, with a short description of what each allows and whether the grant is once-only or remembered. A stopped app with remembered grants stays visible as offline. A live connection using one-time grants appears even if nothing has been saved. Group active instances of the same verified app under its entry.

Each capability has a **Revoke** action. Revoking it takes effect across the app's live sessions and removes its remembered grant. Sibling capabilities stay available. An app-level **Disconnect and forget** action closes all of that app's connections and clears its grants. The chat panel reflects the change and offers a new permission request when the user next tries the affected feature. Opening this tab never reveals the stored API key.

Use the open assistant tab as the authority for the complete grant view, model settings and model requests. Each assistant frame coordinates with it over a verified, session-bound channel and gets its effective settings and current grant state there. This avoids relying on shared IndexedDB across storage partitions. Task approvals remain in the receiving app frame. The trusted tab enforces the assistant permissions before dispatch. Disconnect stale ports and check the current grant immediately before dispatch, including work already queued. If the tab closes, cross-site panels relying on it enter Reconnect. Treat credential handoff as a possible later option requiring equivalent revocation behavior. Acceptance: connect two apps, grant two capabilities to one, revoke one during a queued request, then disconnect and forget that app. Confirm the revoked request is blocked, the other app keeps working, and reloading the disconnected app requires approval again.

**Connection.** Bootstrap with an exact target origin and verify the sender origin, expected window, pending request and single-use handshake before transferring a private MessagePort. Bind it to the initiating app, permitted operations and session. The user can stop a request. Neither end evaluates code received across the port. Changes to an app's implementation remain in that app's origin.

**Deployment policy.** Send an enforced HTTP response header on every assistant document, including development and error routes. The example applies to the credential setup tab. Substitute the actual configured provider origin for the reserved example name.

```http
Content-Security-Policy: default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; img-src 'self'; connect-src https://model.example; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
X-Content-Type-Options: nosniff
```

Serve the chat route with the same policy except for `frame-ancestors`, which permits external HTTPS app origins to embed a locked chat surface (and explicit localhost origins in development). Any app can request access. Enable the exact requesting app origin in the trusted top-level tab before allowing model use, credential handoff or context delivery. Treat framing permission and user authorization as distinct. Require direct embedding for the initial external-app handshake or verify the ancestor chain before granting access. Keep `frame-ancestors 'none'` on the credential route. Workbench's own `frame-src` must allow the assistant origin. Configure exact localhost origins and ports for development. [Frame ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

Bundle and serve reviewed scripts and styles from the assistant origin. Keep user uploads, app overrides and executable plugin endpoints off that origin. The model endpoint is permitted for data requests only. Adding a provider is an explicit trusted configuration change. Use a static development build or reload the page when files change so development can exercise the same script policy.

**Acceptance.** Verify panel open, keyboard resize/close, focus return, separate conversations in two apps, and Connect opening a new tab. Exercise both same-site and cross-site embedding, including reconnect after the setup tab closes, a refused embedding origin and blocked framing of the setup route. Use two local origins and a mock provider with a sentinel key. Check key persistence and deletion, normal request and cancellation, denial of a wrong-origin handshake and an out-of-scope tool request. Attempt a remote script import, an inline script and a fetch to an unlisted endpoint. Verify browser enforcement, inspect broker traffic for absence of the key, and confirm only the configured endpoint receives the authorization header. Repeat without an assistant connected and complete the manual bookmark workflow.

[Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) · [Script sources](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) · [Connection sources](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) · [Cross-origin messaging](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

## App capabilities that match the UI · 20 November 2026

**Every feature design should answer two questions. What can the user find out here? What can the user do with it?** Give both answers an app-owned semantic operation. The UI and authorized callers use the same underlying query or command. The assistant is one such caller. Apps should also be able to use these capabilities directly, with AI disabled.

A capability represents a user intention. Three buttons for moving a slide can call one reorder operation. Conversely, one screen can need several independently grantable reads. A user might let the assistant read a selected contact's name and organization while keeping their notes and the rest of the address book private. A dialog that opens a PDF or lets someone pick a contact is useful in its own right. Its success result does not convey the data displayed inside it.

### What the current suite exposes

Reviewed the ten app directories, their shipped Turtle manifests, UI command bindings, shared capability definitions, and the suite and feature designs. The table below is a design inventory. The observed column identifies existing entry points or UI evidence. The other columns describe the target, including features called for by the designs. A full browser conformance test remains implementation work.

Four of the ten app-local manifests advertise operations. Contacts declares `select-recipient`, Files declares `browse`, Documents declares `view-pdf`, `view-resource` and `edit-note-body`, and Resource Viewer declares `view-resource`, `view-text`, `create-text` and `edit-text`. These names use the existing `https://vocab.muze.nl/capabilities/` namespace. Runtime wiring can also provide operations. For example, Profile handles `edit-profile` even though its app-local manifest omits it. The handler checks the requested WebID against the connected owner and returns the saved resource identifier. Reconcile discovery, handler and result shape before advertising any operation as available to assistants. [App sources at the reviewed revision](https://github.com/muze-labs/solid-workbench/tree/d623e811d52d2435d6adb28da37ea7c661a83f93/apps) · [Shared capability definitions](https://github.com/muze-labs/solid-workbench/blob/d623e811d52d2435d6adb28da37ea7c661a83f93/packages/solid-app-data/src/capabilities.mjs) · [Profile handler](https://github.com/muze-labs/solid-workbench/blob/d623e811d52d2435d6adb28da37ea7c661a83f93/apps/profile/src/components/profile-capability.mjs)

| App and observed entry point | Reads to expose | Actions to expose |
| --- | --- | --- |
| **Workbench / Launcher** · shortcut, catalog, screen and workspace controls | List screens, their shortcuts and widget placements in order. Read current workspace, running instances, launch targets, settings and save/recovery status. Read catalog results and app details with the active filter. | Add/edit/remove a link, move/reorder it across screens, open/focus/close an app, create/switch/rename/save/restore a workspace and resolve a checkpoint conflict. Add/remove catalog sources and shortcuts. Widget placement/size belongs here. Widget content belongs to its provider. |
| **Contacts** · recipient picker and contact editor | Search the chosen address book, return matching IDs and display fields, read a selected contact's permitted fields, and distinguish a private contact record from its public WebID profile. Request notes or contact channels explicitly. | Select a recipient, add/edit a private contact, remove with the existing tombstone semantics, sync and recover. Route editing one's public profile to Profile. Return ambiguity for two matching people. |
| **Profile** · managed profile editor and standalone reader | Read the selected WebID and the fields the viewer can display, preserving multivalued and structured fields. Identify which fields the connected owner can edit. | Open a WebID or one's own profile, prepare/edit supported fields, save or cancel. Keep read-only structured fields intact. Return the affected identity and save outcome. |
| **Files** · resource picker and folder/detail UI | List the chosen container, read selected metadata, media type, deletion/move status and available open-with providers. Obtain resource content through a separately scoped read or the selected viewer. | Navigate/open/select, create a folder, upload or download a selected file, choose a save destination, move or delete using the resource lifecycle. Include upload-and-select in the picker when delivered. Delegate recipient selection, sharing and content editing to their providers. |
| **Resource Viewer** · embedded viewer and text editor | Read the selected text/range with its location, or the explicitly opened text in bounded chunks. For an image, distinguish metadata and dimensions from disclosure of image content. Return the editor's draft only in a granted editing context. | Open/navigate the resource, create/edit text or rich text supported by the chosen provider, format a range, apply or cancel. Return the edited result to the caller that owns persistence when embedded. |
| **Documents / PDF reader** · reader, search, bookmarks and annotation UI | Read outline, page and position, display mode, selected passage, page text, and bounded search hits with navigable anchors. Read this PDF's or all authorized PDF bookmarks. Read visible notes, replies and search hits in a named layer and distinguish private drafts. Report a page with no extractable text. | Open or download, navigate to page/hit/bookmark, set reading mode/zoom/rotation, create/remove/reopen bookmarks, annotate a passage/page/region, reply, edit, save to a verified layer, copy to shared, and export the selected material. Use the normal editor and preserve the fingerprint and anchor. |
| **Notebook** · rich-text blocks and document/collection commands | Read note list and collection filter, active note title, ordered blocks, selected range with formatting/links, and whether the text is a local draft or saved revision. | Create/open/rename, insert/edit/format/move/remove blocks, apply links, use editor undo/redo where supported, save/save as, recover, and use the shared collection operations below. Return block and document IDs. |
| **Presenter** · deck/collection, region editor and slide navigation | Read slide order and titles, current slide, layout, named regions, resource references, chosen providers and presentation position. Reading the content behind a region requires that provider's read grant. | Create/open/import/save a deck, add/reorder/remove slides, change template/background, assign or edit region content through its provider, present/step/exit and manage deck collections. Keep the local presentation usable on its own. |
| **Preferences** · provider chooser, shared and app-provided settings | List sections, setting descriptions, allowed choices, effective non-secret values, source/scope, provider availability and unsaved changes. Limit reads to the chosen app, workspace or shared section. | Set/reset a value or preferred provider, edit app-contributed sections, save/discard and resolve sync conflicts. A contribution is applied by its owner. AI provider credentials, grants and model settings belong to the dedicated assistant tab. |
| **Account** · connection dialog | Read the user-visible WebID, connection state and redacted recovery status for the current app/session. | Request the existing connect/switch/disconnect/logout and recovery UI, then return completion, cancellation or failure. The user performs the identity ceremony in its own surface. Tokens and session internals are outside the result. |

### Roadmap and designed extensions

The roadmap names some business apps before defining their screens. Rows marked **candidate** give a starting contract for review when the first UI is designed. They do not establish a feature or a delivery date. The more detailed designs already identify concrete reads, changes and ownership boundaries.

| App or feature and design maturity | Reads to expose | Actions to expose |
| --- | --- | --- |
| **Social Bookmarks and feeds** · detailed design | Query the personal log, a followed collection, an author's feed, feed entries or saved places in a PDF. Return visible notes, summaries, authors, tags, dates and anchors. Support the UI's combined filters, date ordering, unknown dates and audience-correct counts. Read import previews, proposed group members, crawl results and refresh status. | Save/edit/remove a link or PDF position, follow/unfollow collections or feeds, refresh, save a feed item, preview/import browser exports, review/undo batch tagging, rename/merge/split categories, check selected links, pause/resume/cancel, accept a dated summary and choose an audience. Import, retrieval, model disclosure and publication are separate operations. |
| **Time Tracker and timer widget** · detailed design | Read local timer/draft, selected company/project, recent projects and authorized catalog entries. Search a user's month by date, text, client or project, inspect entries and day/week totals, and report missing months. Company reporting reads only explicitly shared records. | Start/stop locally, review description/company/project on stop, open the same draft in the full app, add multiple blocks, adjust durations, save completed entries, correct/delete an entry and export a filtered report when supported. Record completed time in the user's monthly file. Use the same operations from widget, full app and assistant. |
| **Tasks** · agreed app, candidate first workflow | Read task lists, selected task, completion state and links. Apply the actual UI filters and order, including personal tasks without a project. | Create/edit/complete/reopen/remove a task and link it to a project or contact when supported. Reuse the same task IDs and operations in Projects and CRM. |
| **Calendar** · agreed app, candidate first workflow | Query a date interval in a specified calendar and timezone. Return event details and linked resources. If the UI offers availability-only access, return busy intervals without event titles or attendees. | Create/edit/move/cancel appointments and events. When recurrence or invitations enter the UI, distinguish one occurrence from the series and editing an event from sending invitations. |
| **Zett** · existing editor to assess | Read the worksheet, ordered resources, focused RDF entity and visible properties and values. Preserve IRIs, blank-node context, literal datatype, language and multiplicity. | Select/add/remove resources from a worksheet and edit the visible entity properties. Distinguish removing a worksheet reference from deleting statements. Confirm the exact editable surface against the Zett source chosen for integration. |
| **Reactive calculations and optional tables** · experiment | Read inputs, expressions, dependencies, selected rows/cells, computed results, units, errors and stale status in the same projection the user sees. | Edit an input or expression, change a table view, recalculate and display/export selected results as supported. Side effects involving external data or writes have their own operations and grants. |
| **Graph / chart view** · companion candidate | Read the selected dataset projection, axes, labels, series, filters and the values behind a selected bar or point. Apply the source dataset's access scope. | Select series, choose bar/line and configure or export a view as supported. If implemented as an embedded renderer, the source app continues to own the underlying data edits. |
| **Projects** · second-stage candidate | Read the selected project, its participants, linked tasks/documents, statuses, grouping and relevant totals as the user sees them. | Create/edit a project, organize work, link/unlink tasks and documents, and update assignments through the responsible app. Adding a project relationship never grants Pod access by implication. |
| **CRM** · second-stage candidate | Search authorized customer records, inspect a selected relationship, linked contacts and visible history or follow-ups. Keep private contact notes under their own grant. | Create/edit a customer relationship, link an existing contact, record an interaction and create or complete a follow-up through Tasks where appropriate. |
| **Forms** · second-stage candidate | Read the form schema, labels, options, validation, current draft answers and errors. Give respondents access to their submission status. Response lists, aggregates or exports have a separate owner/reviewer scope if offered. | Design/reorder fields and publish a form with author authority. As a respondent, fill/validate a draft and submit through the ordinary review flow. Authoring, responding and reviewing are independent capabilities. |
| **Chat / meetings** · Chat is on the roadmap, meeting integration is exploratory | Read the chosen conversation's visible messages, authors, reply targets and bounded history. Where a meeting exposes these features, read roster, follow status and the shared view location. | Draft/send/reply using Chat's audience. For meetings, request join/leave, share a view, follow/stop following and navigate. Each participant opens the resource with their own access. Pod saves trigger authorized refreshes. Explicit live-edit features use the app's editing commands and conflict rules. Media capture and transcription require their own choices. |
| **Versioned documents and knowledge base** · detailed design, backend support conditional | Read pages, links/backlinks, search results and index coverage, working-copy differences, resource/folder/Pod history where available, commit metadata, immutable snapshots and provenance. Say which revision a passage came from. | Create/edit/link pages in a working copy, stage or unstage changes, discard/recover a draft, preview and publish a named commit, or restore a previous version as a new change. Ordinary document Save and explicit grouped publication retain their distinct semantics. |
| **App Store / Launcher catalog and widgets** · detailed designs | Query sources, categories, favourites, app details, declared capabilities and compatible widget views. Read placements separately from widget-provider data. | Add/select/refresh/remove a source, add an app to a screen, favourite it when supported, add/configure/move/resize/remove a widget or open its full app. The app provider owns the widget's domain operations. |

Email integration remains deferred. Expenses and invoicing are delegated or deferred. An external app listed in the catalog, including Penny or UMAI, can be launched through its existing entry. Its internal reads and actions become available when that provider implements a contract and the user grants it. A planned integration with Nextcloud or a Fediverse app follows the same rule.

### Shared features and trusted interactions

| Owner | Read contract | Action or handoff |
| --- | --- | --- |
| **Collections and resource lifecycle** | List collections and independently readable members, groups, order, filters, default location and state of missing/moved entries. A collection grant conveys its readable index. Each target retains its own access rules. | Create/switch/rename/default a collection, add/link/open/group/move/reorder entries, sync/recover, detach a reference or delete the managed file with its normal confirmation. Physical moves/deletes maintain PDS Interop link metadata. |
| **Tag vocabulary and assignments** | Find accepted terms, stable IDs, aliases and visible assignments for the granted targets. Scope counts and suggestions to the same audience as the data. | Create/rename a term, approve a synonym/merge, assign/unassign tags. A suggestion becomes an assignment through the same operation as manual tagging. |
| **Embedded views, Open with, resource picker and semantic clipboard** | Discover compatible providers and result types. Read the host selection or an explicitly offered clipboard item in its advertised representation. Provider content is a separate scoped read. | Pick/open/focus/edit a target, copy/cut/paste using ordinary app operations and the appropriate browser gesture, return the selected ID or result, cancel and release the view. A provider can require interaction to choose a local file. |
| **Sharing and invitations** | Read the selected resource's visible sharing state, recipient choices, access preview, invitation status and verified outcome. Contact lookup and reading the document body are separate grants. | Prepare the exact recipient/resource/access change. The trusted sharing surface owns approval, grant, invitation, cancellation or revocation. Recipient verification remains with the recipient/provider. |
| **Signing, attestation and provenance** | Read the exact manifest to approve, signer identity where disclosed, public evidence and verification results for a specific revision. | Request a signature or timestamp and verify it. The signing provider owns confirmation and key use. Return the proof or refusal. |
| **Inspector and personal IDE** | A user-granted inspection capability can describe the chosen malleable app's effective public definitions and personal overrides. This is distinct from reading user documents. | When delivered, propose/edit, preview, apply, undo or reset a personal override through the IDE. The protected assistant is outside Workbench inspection and override discovery. |
| **Assistant control tab** | Each side panel can read its own connection status, effective model and effort, and outstanding request status. The tab shows the user all connected apps and grants. | Open trusted settings to choose provider, exact model/effort, grant/revoke capabilities or disconnect an app. Apps can request access and a model can request a tool. Neither can approve its own request. The key is entered and managed only in the trusted surface. |

### A small contract for reads and actions

Keep the domain implementation in the app. Publish a stable capability URI, a short statement the user can understand, input and result shapes, and what the call can read, change or disclose. Reuse one handler from the UI and the capability adapter. The assistant translates that description into its model's tool format after checking the grant. An app can register lazily when the feature is available. There is no need to publish every SimplyFlow action or serialize the entire app state.

- **Read the current view.** Bind “this” to an app instance, account, selection and revision. Return structured, usable values such as ordered blocks, typed literals, totals or passages with page anchors. Indicate whether results describe a saved resource or a local draft. A read must never mark a message read, refresh a remote feed, apply an edit or save a draft merely because the UI combines those effects on navigation. Expose those effects explicitly where relevant.
- **Query a wider scope.** Support the same authorized filters, sorting and grouping as the UI. Use bounded pages or ranges and say whether more results exist. Distinguish a complete empty result from unavailable content, an incomplete report, or an unsupported representation. Filter private records before generating counts, snippets and suggestions. Query grants can be limited to a single collection, layer or period.
- **Apply the same operation.** Return what actually happened, including affected IDs, draft/saved/published state and conflicts. Use the UI's validation, local recovery, conditional Pod writes, retry and undo behavior. If the current selection or revision has changed since a proposal was prepared, resolve the mismatch before applying. Keep a batch's scope and review visible. A compound request cannot use a delegated app to gain wider authority.
- **Keep a read grant and a model disclosure intelligible.** The assistant can use a granted date range to compute a total locally. If the model needs data, the approved scope must cover the fields, source, and outbound use. One clearly worded grant can cover both. For example, “Let the assistant send totals from this timebook to my selected model” leaves descriptions private. Reuse a remembered grant within its scope. Only the trusted tab can expand or revoke it. Bulk approval covers the displayed operations and scopes.
- **Preserve human decisions.** For an operation the user can complete directly, make the equivalent call available under that user's grant and current Solid authority. If the manual path requires an exact preview, approval, browser gesture or identity ceremony, expose preparation, handoff and the resulting status. An assistant cannot confirm its own proposal. Revocation and account changes take effect on queued calls, paging cursors and follow-up reads. Data already disclosed cannot be recalled.

For example, **“How much time did I spend on Acme last week?”** can call a proposed `query-time-totals` with a timebook, customer ID, date range and grouping. A complete result might contain **6 h 30 min**, the date range and two contributing days. An inaccessible adjacent month yields a partial result with the missing period. The model needs no descriptions, colleagues' records, running timer or write capability. **“Open the entries behind Tuesday”** uses a separately grantable entry-list read. Both results come from the same report query that renders the time-tracking UI. The operation name is illustrative.

### How to keep coverage current

1. For every new screen or feature, list its meaningful outputs as well as its user actions. Map each to an existing or proposed URI, owning app, scope and result. Multiple gestures can map to one operation. Mark presentation-only gestures such as resizing a separator, delegated operations, and human-only decisions explicitly so omissions can be reviewed.
2. Exercise the manual UI and a direct caller on the same fixture. Compare visible records, order, anchors, computed values and draft status for a read. For a change, compare the saved native data, effects on related resources, validation and recovery. Confirm that the operation advertised by discovery actually resolves to the handler. Test the direct caller with no AI connected.
3. Repeat with a narrower grant, a second WebID, revoked access and a changed revision. Include local-only drafts, denied/private rows in a count, cancellation, an incomplete page or report, and a retry of a consequential operation. Verify the exact fields sent to a mock model. The per-app coverage map should travel with the feature that changes it.
4. Prove three existing boundaries first. In **Documents**, return a selected passage and navigate to the cited page without exposing other pages or private annotations. In **Contacts**, search a permitted address book, resolve an ambiguous name and use the existing picker without disclosing private notes. In **Notebook**, read a granted block selection, propose an editable change, apply it once and verify undo and Pod save through the ordinary editor. Then exercise a computed read with **Time Tracker** and a cross-app read with **PDF bookmarks** in both Documents and Social Bookmarks.

Design sources reviewed alongside the current code: [suite roadmap](https://github.com/muze-labs/solid-workbench/blob/d623e811d52d2435d6adb28da37ea7c661a83f93/design/solid-apps-roadmap.md) · [assistant use cases](https://github.com/muze-labs/solid-workbench/blob/d623e811d52d2435d6adb28da37ea7c661a83f93/design/solid-workbench-ai-assistant.md) · [document viewer](https://chatgpt.com/library?file_id=libfile_fde3_f-f387148eaaec8191ab64ab90153a9e9e_08719e4e7c288191b095929ecae37414&account_id=personal) · [Time Tracker](https://chatgpt.com/library?file_id=libfile_fde3_f-856c2275d6748191b8b131a0f18741c1_08719e4e7c288191b095929ecae37414&account_id=personal) · [embedded views](https://chatgpt.com/library?file_id=libfile_fde3_f-0245c203993081919d68d34e845f9eb6_08719e4e7c288191b095929ecae37414&account_id=personal) · [catalog](https://chatgpt.com/library?file_id=libfile_fde3_f-69f2d930b41c819181db25e726090283_08719e4e7c288191b095929ecae37414&account_id=personal) · [Social Bookmarks](https://chatgpt.com/library?file_id=libfile_fde3_f-27553d712c6c81919beeba90b58fcaaa_08719e4e7c288191b095929ecae37414&account_id=personal) · [app priorities](https://chatgpt.com/library?file_id=libfile_fde3_f-11cf895f9e7481919ec01fafd1b7d7d0_08719e4e7c288191b095929ecae37414&account_id=personal) · [knowledge base](https://chatgpt.com/library?file_id=libfile_fde3_f-c106457c604c8191be4f6d602848e883_08719e4e7c288191b095929ecae37414&account_id=personal) · [collections](https://chatgpt.com/library?file_id=libfile_fde3_f-525724d2d56c8191bd62f6311957568f_08719e4e7c288191b095929ecae37414&account_id=personal) · [widget](https://chatgpt.com/library?file_id=libfile_fde3_f-72900ab270148191a37564749997eb6f_08719e4e7c288191b095929ecae37414&account_id=personal) · [sharing](https://chatgpt.com/library?file_id=libfile_fde3_f-6c5d51b7a6e48191a1a8648b6fe692b3_08719e4e7c288191b095929ecae37414&account_id=personal) · [signing](https://chatgpt.com/library?file_id=libfile_fde3_f-7122dcb549d88191a671ab26bb766f9e_08719e4e7c288191b095929ecae37414&account_id=personal).

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
- An isolated, replaceable assistant that composes capabilities and interfaces.
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

### R5 — Isolate the replaceable assistant on its own origin (Must)

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
User ──> Optional Assistant (dedicated browser origin)
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
| **3. Optional Assistant** | Extend the isolated assistant to ask an AI provider to choose capabilities and propose a small composition. | Same workflow manually possible; AI has no extra authority; provider can be replaced/removed. |
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
