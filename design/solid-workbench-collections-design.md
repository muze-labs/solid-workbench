# Solid Workbench collection based document management

Status: Initial design  
Date: 14 November 2026  
Scope: Solid Workbench and compatible standalone applications

## 1. Purpose

Applications open into a collection of documents. Users create, find and organise their work inside the application without first choosing filesystem paths. Each document remains an independent file on user-controlled storage. The collection is another file that records its members and organisation.

This reduces dependence on pod-wide discovery and search while preserving direct document access, the existing file picker capability and the ability to use another compatible application. It does not provide full-text search or require a universal document database.

The design records the decisions agreed in discussion. Sections explicitly labelled “Proposed” or “Open” identify refinements that still need validation. It describes intended behaviour, not a claim about the current implementation.

## 2. Agreed foundations

1. Each app presents a document collection as its normal starting point.
2. Users can create multiple collections and switch between them.
3. Apps can offer folders, categories or other organisation appropriate to their documents.
4. The collection URI uses the app’s existing `#resource` mechanism.
5. The app stores a default collection reference in the user’s preferences when none is defined. Users can change the default later.
6. Each document is a separate file. Each collection is also a separate file.
7. The existing file picker capability opens existing documents and collections. No separate Open by URL feature is required.
8. Deleting a document from an app-managed collection normally deletes the underlying file as well. The UI must make that consequence clear; permanent deletion should require confirmation.
9. Every Workbench app performing physical file moves or deletions must use PDS Interop link-metadata. Readers must interpret the resulting redirects and tombstones.

The collection belongs to the user. Its identity and usable contents must survive replacement of the application that created it.

## 3. Concepts and responsibility

| Concept | Responsibility |
| --- | --- |
| Application | Presents and edits supported documents; offers suitable collection navigation. |
| Collection | Records membership, organisation, display metadata and a destination for new documents. |
| Document | Stores the actual editable content independently of collection membership. |
| User preferences | Select the app’s default collection and hold personal presentation preferences. |
| File picker | Selects existing resources through the established capability. |
| Shared file-operation layer | Performs physical moves and deletions together with link-metadata handling and recovery. |
| Link resolver | Resolves moved/deleted resources consistently for apps, pickers and collection readers. |

Two compatible applications may open the same collection. Compatibility requires an agreed data shape and preservation of fields an app does not edit; recognising a file type alone is insufficient.

A collection may contain references outside its default storage destination. Membership does not itself grant permission, move a file or create a copy.

## 4. Launch and navigation

### Launch precedence

1. If the app URI supplies `resource`, open that resource.
2. Otherwise, resolve and open the app’s default collection from user preferences.
3. If no default exists, initialise a suitable collection and record its URI.

A default that cannot currently be read is not an undefined default. Show an access, connection or missing-resource state; do not silently create a replacement collection or overwrite the preference.

**Proposed:** before creating the initial collection, discover suitable existing collections and offer selection when needed. This prevents a replacement app from creating an empty collection beside the user’s existing work. Type Indexes provide a relevant discovery convention [2]; discovery is separate from the default preference.

### Switching collections

The collection switcher provides Create collection and Open collection through the existing picker. Selecting a collection updates `#resource`. Browser navigation must restore the corresponding collection context. An explicit Make default action changes the user preference; ordinary switching does not.

Collection names may change without changing their URIs. A physical move of the collection file follows the same link-metadata rules as a document move. Resolving a permanent move may repair the saved default reference.

### Individual documents

Existing document entry points remain supported. A direct document resource opens the document without requiring a new collection or silently importing it.

**Proposed:** a link to a document within a collection retains the collection as `resource` and adds an optional selected-document parameter. Its exact name is open. Encode parameter values correctly, including resource URIs with their own fragments; do not concatenate raw URIs into the app fragment.

Opening a document through the picker and adding it to a collection are distinct operations. The app may offer to remember the opened document, but must not silently copy it or assume responsibility for deleting it.

## 5. Collection representation

Use a versioned, documented RDF representation, preferably Turtle, following the project’s existing linked-data conventions. Exact vocabulary and shapes are open; the fields below describe semantics rather than introducing a new ontology.

| Field | Meaning and authority |
| --- | --- |
| Collection identifier | Stable URI, potentially identifying a subject within the collection document. |
| Collection type and format version | Allow a compatible app to recognise the representation and its limits. |
| Name | Authoritative collection title. |
| Default creation destination | Where new document files are stored; separate from the collection file’s own location. |
| Member references | Authoritative membership of this collection. |
| Groups, categories and ordering | Authoritative organisation within this collection. |
| Display summaries | Cached document title, type and optional modification information. |
| Lifecycle relationship | Proposed distinction between managed and linked documents; see section 8. |

Membership entries need stable identifiers if grouping or other metadata attaches to the relationship. Two apps adding the same document should not create duplicate entries accidentally. Preserve the original reference when recording resolution history; deduplicate resolved aliases without discarding different collection contexts.

Keep document content out of the collection file. Fetching the collection should be sufficient to display a useful list without downloading every document.

### Authoritative data versus cached metadata

Document content and its authoritative metadata live with the document or its defined metadata resource. A cached title in a collection does not authorise overwriting a newer document title. Refresh summaries after known changes and when opening documents. Offer an explicit refresh for externally edited content.

Refreshing stale metadata is distinct from changing membership. Failed reads must not silently remove entries. An unavailable document remains identifiable and can be retried or explicitly removed.

Keep collection-specific labels and categories in the collection. A personal label must not inadvertently be published into a shared document. Keep personal view state, such as the last selected item, out of a shared collection unless it is intentionally shared.

### Size and recovery

Start with one collection file. Avoid rewriting it for content keystrokes or nonessential access timestamps. Large catalogues may later separate their descriptor and member indexes while retaining one stable collection URI; do not require sharding in the first implementation.

Listing known storage containers may help locate unregistered files after a partial save. It cannot reconstruct arbitrary external membership, categories or manual ordering. The collection file is valuable user data and requires the same backup/versioning care as documents.

## 6. Files, folders and categories

The initial model separates logical organisation from storage paths:

- A folder is a hierarchical grouping within the collection.
- A category or tag may group a document in several ways.
- Changing a title or grouping normally leaves the document URI unchanged.
- Removing a category assignment does not delete the document.
- An explicit physical move uses the shared move operation.

Apps can expose whichever of these concepts fits their work; they need not implement all of them. An app must preserve unfamiliar collection data when editing supported fields. It must show unsupported entries as such rather than dropping them during a save.

A document may appear in multiple collections without duplication. This is useful for project views that combine notes, PDFs and other resources. It also means a file deletion can affect collections the deleting app cannot discover.

## 7. Everyday operations

| Action | Expected result |
| --- | --- |
| New document | Create a file at the active collection’s configured destination and register it in that collection. |
| Open document | Use the file picker and open the selected existing resource. |
| Add existing document | Add a reference, preserving its storage location. |
| Rename document | Change its user-facing title; refresh the collection summary. |
| Organise document | Update collection grouping or ordering without a physical file move. |
| Remove from collection | Explicitly remove only membership; leave the document intact. |
| Delete document | Delete the file and remove its active entry, with link-metadata and appropriate confirmation. |
| Move file | Relocate the file and leave resolvable forwarding information. |

Changing a collection’s creation destination affects future documents only. Existing documents require a separate explicit move. Changing the app’s default collection does not move any files.

Create files with stable, collision-resistant names. Human-readable titles need not be unique. Do not equate a document’s display title with its storage identity.

## 8. Deletion and lifecycle

### Default behaviour

Delete in an app-managed collection means deleting the underlying document file, not leaving an unnoticed orphan. Use explicit language: Delete document, rather than an ambiguous Remove button. Offer Remove from collection separately.

Confirmation should identify the document and say whether deletion is permanent or recoverable. Explain that other references may stop working; do not claim to have found every referencing collection.

Permissions remain authoritative. An app must not offer successful file deletion when the user can only edit the collection. Removing a reference can still be available.

### Proposed managed and linked distinction

For implementation, distinguish documents created or explicitly adopted for management by a collection from documents merely linked from elsewhere. Newly created documents are managed by default. A linked document’s ordinary removal leaves its file intact; explicit Delete file can remain available when authorised.

This is a proposed exception to the default, inspired by Zotero’s stored-versus-linked attachments [5]. It needs agreement before implementation. If omitted, deletion confirmation must still make the effect on the external file explicit.

Any recorded management relationship is application data, not a security grant or proof of exclusive ownership. Copying a reference into another collection must not silently transfer lifecycle responsibility. The exact transfer/adoption rules are open.

### Collections and groups

**Proposed:** distinguish Remove from switcher, Delete collection and Delete collection and managed documents. The first forgets a shortcut; the second deletes the collection file; the third is an explicit multi-file operation. Group removal normally affects organisation only.

### Recovery

A deletion tombstone records state; it does not retain deleted bytes. Recently Deleted requires retained content, an archive or version history. Do not label hiding an entry as file deletion or promise Undo when the file cannot be recovered.

Recovery must restore content successfully before clearing the final deletion state. Purging retained content is a separate operation. Existing URLs with tombstones or forwarding records must not be silently reused for unrelated documents.

## 9. Mandatory PDS Interop link metadata

Use [PDS Interop solid-link-metadata][1], namespace `https://purl.org/pdsinterop/link-metadata#`. Its relevant terms include `lm:redirectPermanent`, `lm:redirectTemporary`, `lm:deleted` and `lm:forget`. Permanent redirects permit reference repair; temporary redirects preserve the originating reference. `lm:forget` has stronger semantics than ordinary deletion and must not be substituted casually [1].

The convention describes RDF metadata and optional server translation into HTTP responses. Its URL-based and explicitly delegated trust rules determine which assertions are authoritative. Follow those rules; do not accept arbitrary third-party assertions as instructions to redirect or delete data [1].

### Workbench requirements

These are application requirements built on the convention:

1. Every physical move or deletion, whether initiated in Files or another app, goes through the shared lifecycle implementation.
2. Records must remain discoverable from the old resource location. Metadata only in the initiating collection is insufficient.
3. File deletion must not also erase the metadata needed to describe that deletion.
4. Readers resolve both supported HTTP behaviour and RDF metadata. Server interpretation is an optimisation, not a universal assumption.
5. Resolver results distinguish live, moved, deleted, inaccessible, temporarily unavailable and ambiguous resources.
6. Bound redirect traversal and detect cycles. Multiple destinations require resolution rather than choosing one arbitrarily.
7. Preserve original and resolved identities. Repair writable references after permanent resolution; do not erase useful provenance.
8. A failed request or 404 alone is insufficient evidence of an intentional deletion.

The metadata adapter must define placement, discovery and access requirements for whole files, binary documents, RDF subjects and containers. In particular, follow the specification’s parent/ancestor description-resource rules rather than assuming a file’s own sidecar can redirect that same file. Test this on the target servers before making portability claims.

If the required persistent metadata cannot be written or reliably found, the app must not silently perform an ordinary move/delete and report full success. It should explain the missing capability or permission and leave a recoverable state.

### Physical move

Verify the source version, destination and permissions. Create and verify the destination before removing source content. Preserve intended access and resolve relative links or RDF identities affected by relocation. Record forwarding at the old location, retire the old content as appropriate, and update known collection references.

The precise ordering of forwarding and source cleanup depends on how the server interprets metadata. A shared adapter must handle this explicitly: once forwarding is active, blindly sending DELETE to the old URL could follow it and delete the destination. Never let a redirected destructive request silently change its target.

### Physical deletion

Verify the intended target and version, prepare any promised recovery copy, perform the deletion and retain its tombstone outside the removed content. Remove the active collection entry once the file outcome is confirmed. Keep incomplete work visible and retryable.

Tombstone writing and content deletion can fail independently. If a marker is visible while bytes still exist, deletion is incomplete. If the bytes are gone but metadata failed, reference tracking is incomplete. Neither state is a completed operation.

Keep metadata visibility consistent with the intended audience. A forwarding destination can reveal a private location; a deletion record may reveal prior existence. Reuse the established access policy rather than publishing metadata by default.

## 10. Persistence and concurrency

There is no assumed transaction spanning a document, its collection, preferences and link metadata. Each multi-resource action needs observable steps and durable retry information.

| Failure | Required handling |
| --- | --- |
| Document created; registration fails | Retain its URI and retry registration. Do not report that the document itself was lost. |
| Destination created; move incomplete | Preserve the source where possible and record which steps remain. Do not create another copy on retry. |
| File deleted; collection update fails | Keep enough state to remove the stale entry later. Readers may also resolve its tombstone. |
| Metadata fails | Report incomplete reference tracking and retain retry information. |
| Concurrent collection modification | Reload and reapply the intended membership/group change without overwriting unrelated edits. |
| Network response lost | Reconcile the observed resource/version state before repeating a destructive action. |

Use conditional requests with suitable validators where available, or conditional RDF patches with explicit preconditions. Solid documents these mechanisms [3]. Do not assume every server supplies a strong ETag. If adequate conflict protection is unavailable, expose that limitation rather than claiming conflict-safe writes.

Store operation intent durably before irreversible steps, with source/destination references, observed versions and completed steps. Do not store access tokens in operation records. Persist only the minimal recovery state; a new distributed transaction framework is outside this design.

Retries must preserve the original intent and avoid duplicate files, lost membership or deletion of a newer replacement. Concurrent deletion versus editing needs an explicit conflict outcome, not automatic overwrite.

## 11. Sharing and application boundaries

Reading a collection does not grant access to its members. Editing the collection does not grant permission to edit, move or delete their files. The UI must distinguish these abilities.

Sharing a collection should explicitly identify whether its documents are also being shared and which can be accessed already. Refer to the separate sharing workflow for permission changes. Avoid leaking cached private titles through a more widely readable catalogue.

Keep the implementation boundaries small:

- Collection code handles membership, organisation and cached summaries.
- Document adapters handle content-specific editing and metadata extraction.
- Shared file operations handle physical mutation, link metadata and retries.
- The resolver interprets lifecycle state and forwarding.
- Preferences/discovery select collections without owning document content.

These functions should be usable by standalone apps. Workbench supplies capabilities and composition, but must not be the only environment able to read the collection format. Exact mapping onto existing libraries should follow an implementation review; this design does not assume any particular helper already exists.

## 12. Initial implementation and acceptance

Implement one app first, with a shared collection module that can be reused by a second app. Deliver collection launch, creation, switching, default preferences, picker integration, independent files, a useful cached list, basic grouping, conditional saves and the shared move/delete/resolution path.

Defer pod-wide full-text search, automatic global reference repair, catalogue sharding, general migration tooling and universal trash services. Link-metadata compliance is part of the initial move/delete functionality, not a later enhancement.

Acceptance scenarios:

1. A first launch establishes a default; subsequent launches reuse it. Explicit resource links override it without changing it.
2. A failed read of the default does not create a replacement or erase preferences.
3. A collection opens on another device or compatible app with its membership and organisation intact.
4. Creating a document produces a separate file; listing the collection does not fetch every document body.
5. Picker-opened files are edited in place, with no silent copying or lifecycle transfer.
6. Renaming or categorising a document leaves its URL unchanged.
7. Two clients add different documents concurrently without losing either entry.
8. Each multi-resource operation survives an injected failure at every boundary and can be reconciled without duplicating work.
9. A physical move remains resolvable from the old URI, including when a different app follows it.
10. A physical deletion leaves a discoverable tombstone; inaccessible content is not mistaken for deleted content.
11. Redirect cycles, multiple destinations, untrusted metadata and destructive-request redirects produce controlled outcomes.
12. Collection and document permissions remain distinct, including read-only linked documents.
13. Unknown collection properties survive edits by another compatible app.
14. Any advertised recovery restores the content, not just the list entry.

## 13. Open decisions before implementation

- Select the RDF vocabulary, shapes and versioning rules, reusing established terms where their semantics fit.
- Confirm the managed-versus-linked exception and lifecycle transfer rules.
- Specify catalogue discovery, app preference predicates and the selected-document URI parameter.
- Define link-metadata placement and discovery on supported servers, including binary files and ancestor deletion.
- Define recovery-record storage and cleanup, and how independent apps resume partial operations.
- Decide whether the first release supports recoverable deletion or only explicitly confirmed permanent deletion.
- Benchmark realistic catalogue sizes and concurrent edits before adding index partitioning.

## 14. Research basis

The design borrows patterns, not complete product architectures:

| Source | Relevant precedent |
| --- | --- |
| PDS Interop link-metadata [1] | Shared lifecycle assertions and forwarding conventions. |
| Solid Type Indexes [2] | Discover typed collections independently of app defaults; published as an Editor’s Draft. |
| Solid Protocol [3] | Conditional updates and RDF patching. |
| Solid address-book conventions [4] | Separate collection/contact resources and lightweight display indexes. |
| Zotero [5] | Distinguish managed attachments from externally linked files. |
| Obsidian [6] | Named file-based working contexts and a switcher distinct from file deletion. |
| Apple document integration [7] | App-managed files remain editable in place through other apps. |
| Apple Photos [8] | Recovery period for deletion; requires actual retained data. |

Recheck the relevant specifications and target-server behaviour when implementation begins.

[1]: https://pdsinterop.org/solid-link-metadata/
[2]: https://solid.github.io/type-indexes/
[3]: https://solidproject.org/TR/protocol
[4]: https://pdsinterop.org/conventions/addressbook/
[5]: https://www.zotero.org/support/attaching_files
[6]: https://obsidian.md/help/manage-vaults
[7]: https://developer.apple.com/documentation/FileProvider
[8]: https://support.apple.com/guide/icloud/delete-and-recover-photos-and-videos-mm08b49040b5/icloud
