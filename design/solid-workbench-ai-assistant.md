# An AI assistant for Solid Workbench

Design proposal for discussion · 18 November 2026

A reader opens a PDF, selects two pages and chooses **Summarize**. The reader can jump from a bullet in the summary back to the page it describes. **Suggest tags** offers two labels already used in Notebook and one new label. The reader accepts two. Later, in Files, “let Robin read this report” opens a sharing preview showing the particular Robin, report and access change. Each action starts where the user is already working.

Use **both app integration and the capability bus**. Each app supplies its own selection, commands, review UI and save operation. A replaceable assistant provider runs the model. Workbench routes requests through its existing broker. This lets Documents offer a reading tool, Notebook offer an editing tool, and Files offer sharing help while the user configures their model once. This develops the existing optional-provider and AI composition proposals. [Optional AI capabilities](solid-optional-ai-capabilities.md) · [AI composition](solid-workbench-ai-composition-design.md) · [Broker roadmap](solid-capability-broker-roadmap.md)

## Connect a model once

In Preferences, **AI assistance → Connect provider** opens the selected provider’s setup. Show the assistant app’s origin, inference destination, model identifier and whose account pays. For the first adapter the user supplies their own OpenAI API token and chooses a model available to that account. Test the connection with an explicit, small request containing no user document. Show invalid credentials, unavailable model, quota and temporary outage as distinct outcomes. Changing the model takes effect on the next request.

The assistant is a static browser app that users can host on an HTTPS origin they trust. Give it a dedicated origin so other Workbench apps cannot read its IndexedDB. A different URL path on the same origin provides no such isolation. Preferences opens the provider’s own setup window, where the user enters their OpenAI Platform API key. Only that window handles the key. Documents and other callers receive task results through the capability channel.

**Use for this session** keeps the key in memory until the provider closes or locks. **Remember on this device** is an explicit choice. Store an encrypted copy in the provider’s IndexedDB, scoped to the active account and upstream API origin. Derive the encryption key from a separate unlock passphrase using Web Crypto with a salted password-based KDF and authenticated encryption. Keep the passphrase and derived unlock key in memory. On reload prompt to unlock. On logout or account switch lock the provider, release the in-memory credentials and discard pending replies. **Forget key** deletes the device copy. Revocation at OpenAI disables the credential itself.

Encryption protects a locked copy. While unlocked, compromised provider code or a sufficiently privileged browser extension can capture or use the key. Explain that trade-off at setup. Keep third-party scripts off the provider origin and credentials out of the Pod, broker messages, URLs, logs and exports. OpenAI advises against browser-held API secrets and its JavaScript SDK requires explicit opt-in for browser use. [SDK browser support](https://github.com/openai/openai-node#requirements) · [OpenAI key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)

The browser adapter calls `POST https://api.openai.com/v1/responses` directly through a dedicated Metro client with the user's API bearer token, selected model, bounded input and output, and response storage disabled. Keep Solid session credentials out of this client, pin its HTTPS destination and refuse redirects. Show the selected excerpts and the external inference destination before sending. Future adapters can use another browser-accessible API or an on-device model. Verify CORS from the actual provider origin for each API. [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)

## What crosses the app boundary

Introduce three proposed capability names under the existing Workbench capability namespace. Publish versioned contracts and examples before a second provider implements them.

| Operation | What the app supplies | What it receives |
| --- | --- | --- |
| `summarize-content` | A scope label, ordered plain-text excerpts with request-local anchor IDs, and desired length or language | Summary points with supporting anchor IDs and coverage limits |
| `suggest-tags` | The selected excerpts and a bounded set of relevant, approved tag labels with opaque IDs | Existing tag IDs or proposed new labels, each with a short reason |
| `propose-share` | The user’s instruction and, when useful, local aliases for the selected items | Proposed recipients to resolve, requested access and questions about ambiguity |

In managed apps, reuse the host’s capability invocation, selected provider and private reply channel. A standalone app can open the same static provider window from a user gesture and use the same origin-checked handshake, scoped task and private reply channel. The provider confirms the requesting app and data scope before spending the user’s API credit. Implement the managed path first. [Files invocation example](../apps/files/src/components/file-sharing.mjs) · [Host-owned text contracts](../packages/solid-app-data/src/text-capabilities.mjs)

Before sending, show the named provider, model and scope, for example **Selected pages 4–5 · text only**. Let the user inspect the actual excerpts or narrow the selection. Comments, private annotation groups, linked resources, contact lists and other open apps enter only through deliberate selection. The host keeps the map from opaque anchors to real URIs, PDF positions or block IDs. Treat source text and model output as untrusted data. Validate result type, size and identifiers, render plain text through SimplyFlow, and discard replies for a cancelled request, changed account or replaced document. A summary cannot call another capability by embedding instructions in its text.

## Integrating the assistant panel and WebMCP

Host the assistant panel as a static app on a sibling HTTPS origin, for example `assist.example.org` beside `workbench.example.org`. An app can embed that panel in its own sidebar. Enter or unlock the key in the assistant’s top-level window. Check browser storage partitioning during the prototype and use the top-level provider window with a private reply channel if an embedded panel cannot access the unlocked session. Different paths on one origin share a security principal. A capability-only coding convention on that origin cannot enforce isolation from a compromised app.

Give the assistant a small set of contextual tools when opening it from Documents. For example, the host can offer the current selection, a selected page range and navigation back to a source anchor. The provider can present those tools to the selected model as function definitions. When the model requests one, local code checks the current task, caller, arguments and disclosure approval, invokes the app action, and returns the permitted result. OpenAI sees only the supplied definitions and released content. Opening a sharing preview returns control to the trusted sharing UI for approval.

**Optional WebMCP adapter.** An app can expose selected operations from those same editable action definitions as browser-discoverable tools. The November 2026 draft allows a web page to query tools on itself and its descendant frames. Cross-origin discovery needs the embedder’s tools Permissions Policy delegation, the provider’s explicit exposure to the caller origin and the caller’s requested origin. Consequently a Workbench parent could discover a tool on an embedded Documents frame. An assistant sidebar cannot enumerate its parent app or arbitrary Workbench tabs through that mechanism. For that layout the host can offer scoped tools over the existing capability channel. Keep broker routing for independent app windows and feature-detect WebMCP before offering its browser integration. [WebMCP draft, discovery and origin checks](https://webmachinelearning.github.io/webmcp/)

For a first experiment, expose the same selection-reading operation through both paths. Verify that it returns the user-approved excerpt, rejects a stale selection and cannot reach private annotations. Test with WebMCP disabled and with an unlisted frame origin. Tool handlers execute with their owning page’s authority, so input validation and confirmation belong in the app action shared by both paths. Keep credential setup and unrestricted Pod operations outside the advertised tools.

## Summarize what I’m reading

Documents offers selection, page range or whole document. Reuse the text layer and page identity already used for search. For a long PDF, estimate size first, explain the number of passes, and allow a smaller range. Process bounded page-labelled excerpts and preserve anchors through the final synthesis. Show the pages actually covered, including skipped image-only pages or failed chunks. A partial summary carries that label. Each source link resolves to an anchor supplied by the host. It lets the reader check a claim even when the model misunderstood it. [Documents reader](../apps/documents/src/component.mjs)

Open the result in the reader’s panel pattern, with a phone overlay, keyboard-operable source links and focus return. Keep the result as a draft until the user chooses a destination, such as a Notebook block or an annotation in a selected group. Record the source revision, covered range, model and generation date with a saved result. If the PDF changes, keep the original reference and offer a fresh summary. Cancellation stops remaining chunks and ignores late replies. Explain that a request already sent may still incur cost.

## One personal tag vocabulary across apps

A tag accepted in Documents should be available for manual or assisted use in Notebook, Files, Presenter and Social Bookmarks. Make this an ordinary data capability usable without a model. Give each user a private Solid tag scheme, discoverable through their preferences, with an account-scoped local cache. Represent each tag as a stable IRI with a preferred label, optional language and user-approved aliases. SKOS concepts and `skos:ConceptScheme` fit this vocabulary. Keep vocabulary membership distinct from the fact that a particular user tagged a particular item.

For example, selecting an existing **Climate policy** tag for a PDF creates an assignment linking its tag IRI, the target and the author. A page-specific assignment also preserves the PDF fingerprint and page anchor. Store personal assignments in private, app-owned Turtle resources even when the PDF is public, read-only or hosted elsewhere. When the owner deliberately publishes a bookmark with tags, include the approved labels in that bookmark’s audience. Keep the private scheme, other assignments and cross-app counts private. [Social Bookmarks design](solid-social-bookmarks-design.md)

Match trimmed, case-insensitive labels locally first, preserving display spelling. Send the model only relevant candidates shown in the disclosure. The user can accept an existing tag, edit a new label, or dismiss it. Resolve IDs again on save. Renaming a concept keeps its assignments. Merging synonyms or translations requires an explicit choice. Use stable assignment IDs for repeat saves, local drafts offline, and PATCH or conditional writes for sync. On conflict retain the draft, reload the current graph and offer reconciliation. Preserve unknown RDF statements. Do not silently overwrite another app’s edit.

## Help me share the right thing

Files already invokes Contacts to select a recipient and then displays **Permissions unchanged**. Applying a grant requires a separate, trusted sharing capability. A model can interpret “let Robin read this report” using the sentence alone. It has no reason to receive the report contents. [Current Files sharing](../apps/files/src/components/file-sharing.mjs) · [Sharing and invitation provider design](solid-sharing-design.md)

1. **Resolve.** Files binds “this report” to the actual selection. Contacts resolves “Robin”. If several people match, the owner picks one. A verified WebID can receive a direct grant. An email address alone follows the invitation workflow.
2. **Preview.** The sharing provider reads the current authorization state with its own authorized Solid client. It computes the smallest supported change and shows the exact resource, recipient, existing access, proposed access and any inherited or container-wide effect. A request for read access may already be satisfied. Unsupported policies or insufficient authority produce an explanation.
3. **Apply.** The user approves the concrete change once in the sharing UI. The provider binds that approval to the resource, recipient, access mode and policy version. It conditionally updates the supported policy, preserving other grants. A concurrent change requires a refreshed preview. For invitations, the initial approval covers the precisely scoped grant after verified acceptance.
4. **Verify.** Re-read the resulting policy. Report access granted, invitation pending, already granted, or an unresolved failure. A successful message delivery alone cannot establish effective access. Retrying must recognise an existing grant or pending invitation. Offline, retain a private proposal and return to review after reconnecting.

Start with one known WebID, one resource and read access on an explicitly supported Pod authorization system. Add support for other policy systems through tested adapters. The AI provider has neither the owner’s Solid credentials nor policy-write authority. A sharing-capable release depends on testing the ordinary manual grant path with owner, recipient and third-party accounts.

## Opportunities across the suite

The first table covers today’s app boundaries. Each entry describes a proposed use of assistance. [Application inventory](../README.md#applications) · [Documents design](solid-document-viewer-design.md)

| Current app | Useful point of assistance |
| --- | --- |
| Documents | Summarize a selected passage or PDF with page links. Suggest personal tags. |
| Notebook | Turn selected blocks into a digest or draft action list. Insert accepted text as new editable blocks. |
| Presenter | Draft an outline or speaker notes from selected material. Review each proposed slide before insertion. |
| Files | Tag the selected resource or prepare a scoped sharing request. Make content extraction a separate choice from sharing. |
| Resource Viewer | Explain selected text in place. For images, offer a separate image-disclosure choice when a provider supports it. |
| Contacts | Suggest follow-up wording from a selected note. Use the normal recipient picker to resolve names. |
| Profile | Draft a short bio from fields the owner selects. Preview the exact public-profile change. |
| Launcher | Suggest installed apps or a workspace arrangement for a goal. Preview placements before saving. |
| Preferences | Configure model, disclosure and cost limits. Explain a selected setting using its public description. |
| Account | Explain a redacted connection error. Keep sign-in, logout and token handling in the native account UI. |

For roadmap work, prioritize actions that produce an editable result and have a clear app responsible for applying it. [App priorities](solid-workbench-app-priorities.md) · [Suite roadmap](solid-apps-roadmap.md) · [Documents knowledge base](solid-documents-knowledge-base-versioning.md)

| Roadmap area | Candidate workflow and review boundary |
| --- | --- |
| Social Bookmarks and collections | Suggest existing tags and draft a source summary. The owner separately edits their personal note and chooses the audience. |
| Tasks, Calendar and time tracking | Extract candidate tasks and dates from selected meeting notes, or group chosen time entries into a weekly narrative. Preview assignees, timezone and dates before creating anything. |
| Zett and the versioned knowledge base | Suggest related records or statements with source anchors. A steward accepts links against a specific revision. |
| Projects, CRM, Forms and Chat | Draft a project handover, a follow-up, a form outline or a digest of a selected thread. Keep recipients and publication under the originating app’s control. |
| Reactive calculations | Explain a formula or propose an expression with sample inputs. Evaluate it in the calculation app’s restricted environment after review. |
| Launcher widgets and the future IDE | Propose a widget for a chosen target or compose installed capabilities into an editable workspace. Exercise the same lifecycle, permission and preview rules as manual composition. [Launcher design](solid-workbench-launcher-links-and-widgets.md) |

## Delivery and acceptance

1. **Summaries in Documents.** Build provider-owned token setup and one managed summary action. On a phone and by keyboard, select two pages, inspect the disclosure, generate a summary and return to each cited page. Check the outbound request contains only those pages. Exercise cancellation, an image-only page, an invalid key, quota exhaustion and document replacement. Retry explicitly where sending again could incur cost.
2. **Tags in two apps.** Accept a suggestion in Documents, reuse it manually in Notebook, rename it and verify both assignments still resolve. Exercise offline edits, account switching, concurrent writes and a public bookmark whose tag counts cannot reveal private saves.
3. **Sharing.** Prove the manual read grant first, then add natural-language preparation. Test ambiguous names, pre-existing access, stale policy revisions, failure after the write and a restricted PDF with a separately shared annotation resource. Verify actual access as the recipient and an uninvolved reader.
4. **Replaceability.** Substitute a second provider with a different API using the same fixtures. Exercise a standalone app, an unavailable provider and provider removal. Accepted summaries and tags should still open and be editable. Record extraction time, bytes and cost for a real document, plus cold startup with AI disabled. Load optional provider code only on invocation.

The first browser proof should test a direct Responses request from the deployed static origin using a user-supplied test key. Verify session-only use, encrypted storage and unlock after reload, account switching, removal, and the absence of the key from caller-visible messages and exported state. Test a blocked cross-origin request and show an actionable connection error. A static Workbench installation needs only the selected model API to be reachable for remote inference.
