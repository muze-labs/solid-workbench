# Documents, annotations and a versioned knowledge base

**Status:** Design proposal for later implementation  
**Date:** 2026-11-08  
**Project:** Solid Workbench  
**Suggested location:** `design/solid-documents-knowledge-base-versioning.md`  
**Source review:** `muze-labs/solid-workbench` at `af68b00e2fe1af9220b6be19acfaedbed86f1570`

This document describes how Solid Workbench can support document management,
document viewing and editing, annotations, and a knowledge base backed by
versioned Solid storage. It records the intended user experience, application
boundaries, storage extension and implementation sequence. It does not claim
that these features or the proposed protocol already exist.

The repository assessment is based on source inspection, not a new browser
evaluation. Recheck the relevant implementation before starting a cycle.

## 1. Purpose and agreed direction

Support two related workflows through the same storage model:

- **Document management:** saving a document creates a version with an actor
  and timestamp. A message and a multi-resource changeset need not be required.
- **Knowledge base:** users prepare changes locally, then publish related
  resources together in an atomic commit, normally with a required message.

Version history, message requirements and grouping are distinct concerns.
A commit can contain one resource or several. Whenever several operations are
submitted together, atomicity is guaranteed; grouping is never merely a sequence
of independently published writes.

The intended foundations are:

1. Local edits survive reloads, disconnection, authentication failure and
   rejected publication within the supported browser-storage conditions.
2. Users can distinguish locally preserved drafts from published versions.
3. A versioned root can cover an entire pod or a container subtree.
4. History is available for a resource and for a versioned root, with subtree
   filtering where useful.
5. Turtle is the default format for descriptions, commit requests and history.
6. Large documents and resumable uploads are part of the initial design.
7. Subversion is the preferred first backend to investigate, given Muze's
   experience and the fit of its centralised revision model. Clients remain
   independent of SVN, and branches are outside the initial scope.
8. Existing Workbench composition, capability routing and Muze libraries remain
   the foundation. No replacement UI framework is proposed.

### Performance clarification

The maintainer permits a larger JavaScript budget for genuinely complex
applications, including a full word processor. The existing 200,000-byte gzip
ceiling remains the default for lightweight applications, not a universal
limit for every advanced workflow.

Viewing documents must remain practical on a phone and a slow connection.
Full word processing can target a suitable screen, input method and connection.
Users are not prohibited from attempting advanced editing on a phone.

Before implementing a heavier app, reconcile the repository's currently strict
build check and standing guidance with this accepted direction. Define and
measure its viewing and editing budgets separately. A small initial shell or
a deferred download does not establish that the actual core task is affordable.

## 2. Existing foundation and gaps

| Area | Present at the reviewed revision | Required addition |
| --- | --- | --- |
| Design components | Dialogs, dropdowns, list/detail panes, toasts | Document surface, annotation panel, changes/history presentation |
| Capability transport | Managed apps, private message ports, cancellation, guarded closing, embedded tasks and tab fallback | Document contracts carrying revision and working-copy context |
| Implemented providers | Resource browsing/selection and profile editing | Document viewing/editing and annotation workflows |
| Files | Folder browsing, creation, sequential binary uploads, downloads, link-metadata soft deletion | Open with, previews, history, resumable staging and version-aware operations |
| Data access | Metro sessions, native RDF preservation, conditional document saves | Version-service discovery, working copies, snapshots and commits |
| Local state | Local collections and native-RDF workspace checkpoints | Durable document drafts and large-content storage |
| Knowledge base | Roadmap direction | Pages, links, search, references and grouped changes |
| Annotations | No implementation found | Selection, anchoring, discovery, permissions and revision handling |

Files currently opens a regular file by downloading it. Its upload helper
performs one `PUT` per file with `If-None-Match: *`; partial success is reported.
Its restored app state contains the current folder, not a document working copy.
The shared RDF save helper performs a conditional single-resource `PUT`.
These are useful foundations but do not implement the proposed storage model.

Semantic **Open with** is already a design proposal. Reuse that direction,
including immediate manual selection and download, rather than making semantic
recognition a prerequisite for opening a document.

The roadmap also identifies Zett and cobalt-notebook for assessment and
integration. Evaluate their relevant editing and navigation APIs before creating
equivalent infrastructure. Neither integration was present in the reviewed app
set, and no editor package is selected by this document.

## 3. Application and component boundaries

| Owner | Responsibility |
| --- | --- |
| Files | Locate, organise, select, upload and download resources; offer appropriate opening actions and history |
| Documents | View a document, edit supported formats, select passages or regions, and read/write annotations |
| Knowledge base | Organise linked pages and evidence, search a collection, navigate references, and prepare related changes |
| Shared versioning integration | Discover capabilities, maintain working-copy state, stage uploads, submit commits and retrieve history |
| Launcher and broker | Launch, route, present and restore apps; do not become a document database or implicitly publish content |

These are responsibility boundaries, not a requirement for a new package for
each row. Keep app-specific policy in the owning app until reuse justifies
sharing. Documents can be a standalone app and a capability provider embedded
by another app. Annotation interaction should be a reusable feature within a
document workflow; reading and commenting should not require unnecessary app
switching.

Follow the existing moldable component structure: named templates, styles,
commands, actions and explicit data APIs. Keep app-owned behaviour inspectable
and editable, preserve unknown RDF, and use SimplyFlow for suite UI rendering.
Specialist editor/renderer ownership needs an explicit integration boundary;
SimplyFlow and an editor must not compete over the same content subtree.

## 4. User workflows

### 4.1 Document management

1. Browse a folder and open a document in reading mode.
2. Inspect its metadata, annotations and available history.
3. Choose Edit, Replace document, or Add annotation as appropriate.
4. Preserve the draft locally and show its status.
5. Save the document. On a root allowing empty messages, this can create a
   single-resource version without a commit dialog.
6. On a root requiring a message, collect it and use the commit service.
7. Confirm publication only after a confirmed server result.

The absence of a message requirement permits ordinary writes; it does not
itself mandate background saving. The application chooses its saving workflow
and makes that behaviour visible.

### 4.2 Knowledge base

1. Open a knowledge base and establish a working copy at a known commit.
2. Edit pages, add links, attach documents and prepare annotations locally.
3. Review a Changes panel containing the resources in this working copy.
4. Choose Commit, inspect the complete set and enter the required message.
5. Upload large content into private staging, showing progress and recovery.
6. Publish the completed changes as one commit.
7. On conflict, preserve local work and uploaded content while reviewing the
   newer published state.

A working copy groups a deliberate task. Do not silently include unrelated
edits from every app or tab using the same folder. For the first slice, commit
the complete named working copy; selective inclusion requires dependency rules
and can follow later.

### 4.3 History and restoration

History shows actor, time, message where present, and the affected resources
the viewer is authorised to see. Resource history includes creation, updates
and deletion. Users can inspect a historical document or snapshot and compare
supported formats.

Restoring earlier content creates a new draft and then a new commit. It never
rewinds the shared history. A binary format without a meaningful diff can offer
side-by-side previews and metadata comparison instead of a misleading text diff.

## 5. Shared UI additions

| Surface | Required behaviour |
| --- | --- |
| Persistent save status | Distinguish local preservation, pending publication, upload progress, confirmed publication, conflicts and uncertainty |
| Changes panel | Identify the working copy, root, base revision and complete proposed resource changes |
| Commit dialog | Review changes, validate the message policy and confirm publication |
| History view | Browse resource/root history, inspect snapshots, compare and prepare restoration |
| Conflict review | Preserve both sides, explain the conflict and require a reviewed resolution |
| Upload queue | Progress, resumability, expiry, cancellation and actionable errors |
| Annotation panel | Navigate comments and their targets; show audience and revision context |

Use existing dialogs and panes. On a phone, document, annotations, changes and
history can be separate navigable views. On larger screens, a document and its
annotation panel can be adjacent. Keep the current square controls and visual
language; a new design system is unnecessary.

Errors, required sign-in, unresolved conflicts and unconfirmed saves remain
visible inline. Toasts are suitable only for nonessential confirmations.
Provide keyboard access, clear labels, focus return and alternatives to
pointer-only selection. Annotations must also be accessible as a navigable list,
not only coloured marks over a document.

Use precise status text such as **Saved on this device**, **Not yet committed**,
**Uploading attachment**, **Committed**, **Needs review**, and **Save outcome
unknown**. Local autosave, editor undo and restoring a published version are
different operations and should remain distinguishable.

## 6. Working copies and capability contracts

A working copy contains:

- An account identity, versioned-root URI and distinct working-copy identifier.
- Its base commit and cached resources from that snapshot.
- Pending creations, replacements and deletions, including annotation changes.
- Local content references, required metadata and recoverable upload handles.
- The commit message draft and publication/recovery state.

Store native RDF metadata separately from document bytes. Large blobs must not
be embedded in workspace checkpoints or capability messages. Existing workspace
message validation has a 64 KB serialisation limit; it is not a large-document
transport.

A document request must distinguish:

| Mode | Meaning |
| --- | --- |
| Current | Read the latest published document |
| Historical | Read an explicitly identified immutable revision |
| Working copy | Read and edit the overlay associated with a particular task |

Request context includes the resource, requested operation, revision or
working-copy context, and any annotation/focus target. Final capability URIs
and wire shapes remain to be specified. Do not put bearer credentials in URLs
or treat a context identifier as permission.

Results must distinguish a locally preserved draft, a confirmed commit,
cancellation, denial, conflict and an uncertain save. The existing Profile
contract returns after saving to the pod; do not silently change that contract
or copy it unchanged for draft editing.

Initially the Knowledge base app should own its working copy and give a
document provider scoped access to that copy. Standalone Documents owns its own
working copy. Cross-origin apps cannot assume shared IndexedDB. Use explicit
operations on the draft owner and define content transfer separately from
small control messages. Persist drafts before closing transient task frames;
they must not survive only in a live iframe.

Do not rely on Launcher to preserve document bytes. An app should retain a
useful standalone workflow when no managed workspace is open.

## 7. Storage model

| Concept | Meaning |
| --- | --- |
| Versioned root | A pod root or container subtree with one commit sequence and policy |
| Commit | A record of parent, actor, server timestamp, optional message and changes, identifying a logical snapshot |
| Head | The latest published commit for that root |
| Working copy | A base snapshot with local pending changes |
| Staged upload | Private temporary content that is not yet a published resource version |

Start with non-overlapping versioned roots and a linear history. An atomic
commit cannot span roots or pods. Whole-pod history across multiple independent
roots is an aggregate, not one atomic revision sequence.

Unchanged content can be shared between snapshots. A logical snapshot does not
require copying every resource. Resource boundaries remain authoritative:
separate RDF documents describing the same subject must not be collapsed into
one versioned object. Historical Turtle retains its original document base URI.

Ordinary resource URLs expose the current published state. Reads pinned to a
commit provide a consistent historical snapshot. Atomic publication alone does
not guarantee consistency across multiple ordinary GET requests that straddle
a commit; working-copy lazy reads must use the pinned base snapshot.

History is retained by default. Immutability of normal history must not be
confused with an unconditional promise that administrators can never purge
content. Retention, privileged erasure and unavailable historical content need
an explicit policy before production deployment.

## 8. Proposed minimal Solid extension

This is a proposed extension, not an existing Solid standard or a completed
interoperability specification. Use existing HTTP mechanisms and a small RDF
vocabulary. The namespace below is provisional and is not claimed to be
published at that URL.

### 8.1 Discovery and policy

Responses for resources under a versioned root advertise its service on GET,
HEAD and OPTIONS:

```http
Link: <https://pod.example/services/versioning/contracts>;
      rel="https://vocab.muze.nl/solid-versioning#service"
```

Discover policy through an existing parent before creating a resource. The
storage description may also list services, subject to access policy. The
server determines the applicable root; clients do not derive it from a guessed
path convention.

A service GET returns Turtle:

```http
Content-Type: text/turtle
Allow: GET, HEAD, OPTIONS, POST
Accept-Post: text/turtle
ETag: "state-42"
Cache-Control: no-cache
```

```turtle
@prefix v: <https://vocab.muze.nl/solid-versioning#> .

<https://pod.example/services/versioning/contracts>
    a v:CommitService ;
    v:root <https://pod.example/contracts/> ;
    v:head <https://pod.example/history/contracts/42> ;
    v:requireMessage true ;
    v:uploadService <https://pod.example/uploads/> .
```

The strong service ETag changes when its represented head or policy changes.
It is not the ETag of an ordinary container listing. Expose the necessary
response headers to browser clients and support the corresponding CORS
preflight requests.

### 8.2 Message policy

| Policy | Ordinary resource write | Commit-service POST |
| --- | --- | --- |
| Message optional | Creates an automatic commit | Message optional |
| Message required | Rejected with guidance to the service | Non-whitespace message required |

Apply the rule to creation, modification and deletion, including PATCH and
POST where applicable. Do not generate placeholder messages to bypass it.
Validate message lengths and publish limits in the final contract.

For the minimal profile, omit a separate explicit-commit-only switch and a
custom message header. One-resource commits use the same service as grouped
commits. Legacy clients remain useful on permissive roots; they cannot write
to strict roots without understanding the extension.

Rejected direct writes can use 409 with a machine-readable explanation and an
`ldp:constrainedBy` link to the policy description. The final extension must
state these constraints explicitly alongside Solid's ordinary write behaviour.

### 8.3 Atomic commit request

```http
POST /services/versioning/contracts HTTP/1.1
Content-Type: text/turtle
If-Match: "state-42"
```

```turtle
@prefix v: <https://vocab.muze.nl/solid-versioning#> .

[] a v:Commit ;
   v:message "Add the signed agreement and its description" ;
   v:changes (
       [ a v:Put ;
         v:target <https://pod.example/contracts/agreement.pdf> ;
         v:contentType "application/pdf" ;
         v:source <https://pod.example/uploads/abc123> ]
       [ a v:Put ;
         v:target <https://pod.example/contracts/agreement.ttl> ;
         v:contentType "text/turtle" ;
         v:body """
             @prefix dct: <http://purl.org/dc/terms/> .
             <> dct:title "Signed agreement" .
         """ ]
   ) .
```

Support PUT/create-or-replace and DELETE first. The ordered RDF list defines
the application order; the complete result is published atomically. A Put has
exactly one inline body or authorised staged source. Inline bodies are for
small content; large and binary content uses uploads. Parse embedded RDF with
the target URL as its base, never with the commit-service URL.

Reject malformed lists, ambiguous interpreted fields, unsupported operations,
targets outside the root and path/URI normalisation escapes. Define container
operations and side effects before exposing them. Do not silently ignore an
unknown operation or requirement and publish only the recognised subset.

All operations require their normal individual permissions. Access to a
service does not authorise every resource under its root. Validate against the
applicable pre-commit authority; a changeset cannot grant itself permission.
Policy/ACL changes require explicit semantics before being supported.

Require a concrete service validator for this initial concurrency model. A
stale If-Match returns 412; a missing required precondition returns 428. Missing
required commit content, including a message, can return 422. These mappings
are proposed contract choices. Every rejection leaves the published state
unchanged.

On success return 201 and a Location identifying the new commit. Resource
changes, containment changes and the history record become durable together.
Record authenticated actor identity separately from any unverified attribution
supplied by the client. Emit change notifications only after publication.

### 8.4 History and snapshot access

Reuse the `version-history` link relation for discovery where appropriate.
Provide paginated history of a root, a resource and a subtree, plus immutable
resource reads and container listings at a commit. The final RDF vocabulary,
pagination links and filter/snapshot URL contracts remain to be specified;
clients must follow advertised links rather than manufacture backend URLs.

History access is separate from current-content access. Current permission does
not automatically reveal removed content, commit messages or previously hidden
filenames. Define filtered commit descriptions and access to deleted resources
without exposing hidden changes through aggregate counts or metadata.

## 9. Large-file staging and resumable transfer

Use a separately advertised upload service and investigate tus as the baseline
resumable transport. Its creation, offset discovery, continuation and expiry
mechanisms avoid inventing another chunking protocol. Apply the suite's Solid
authentication through Metro; do not introduce an independent auth client or
an unconfigured fetch path through an upload library.

| Stage | Behaviour |
| --- | --- |
| Allocated/uploading | Private, incomplete content; resumable and quota-accounted |
| Complete | Validated, immutable content eligible for use in a commit |
| Commit rejected | Retain for a corrected attempt until its advertised expiry |
| Commit accepted | Published history retains the bytes independently of staging cleanup |
| Abandoned/expired | Reclaim temporary storage; explain expiry and permit re-upload |

Upload alone does not change the live document, container listing or version
history. Source references must name authorised server-managed uploads; they
are not arbitrary remote URLs for the server to fetch. Bind uploads to their
owner/account and allowed use, define completion and integrity checks, and
prevent mutation after completion.

Publish maximum sizes, expiry and supported resumability features. Define
cancellation separately for a transfer and a commit: stopping an upload cannot
undo a commit already accepted by the server.

Store recoverable upload state locally. A refreshed browser must be able to
check the confirmed offset and continue when the required local bytes remain
available. If bytes or access are unavailable, preserve the draft and explain
the required recovery. Never require the whole file as an in-memory byte array
or base64 string in order to transfer it.

Uploading begins when the user initiates the publication workflow. Background
upload of private drafts requires a separate explicit product choice. Network
reconnection alone is not permission to transmit an uncommitted local draft.

Do not hold an SVN transaction open throughout the network upload. Once content
is complete, validate and publish it with the other operations. This does not
promise a constant-time backend commit; copying, validation and durable storage
can still take time and must remain visible as pending work.

## 10. Concurrency, retries and local recovery

Initially require the base head to remain current. Even an unrelated intervening
commit can require reconciliation. This is conservative and simple; more
selective conflict detection is a later optimisation.

On a changed head, inspect the intervening changes. Independent resources may
be combined, while overlapping content requires a format-aware merge or user
review. Never merely replace the validator and overwrite the newer state.
Reuse completed uploads where still valid.

A lost response is not proof of a failed commit. Before implementation, define
a client-generated request identifier, its replay scope/retention, a lookup
operation and the behaviour for reused identifiers with different content.
Bind the identifier to the authenticated caller and root. Retry resolution
must return the original outcome without creating another commit, including
when the current head has since advanced. Do not mark work committed merely
because the bytes were sent or an upload finished.

Maintain per-account and per-working-copy local isolation, with explicit
handling for the same resource edited in multiple tabs. Persist drafts before
claiming local preservation. Browser storage can be evicted or exhausted; show
failed local writes, retain recoverable in-memory work where possible and offer
an export/recovery route. Cached published content is expendable; pending local
edits must not be deliberately evicted as cache cleanup.

Opening cached content offline and launching the app offline are separate
requirements. Define the offline shell, available documents and attachments,
and re-authentication behaviour. Do not imply that uncached linked resources
are available offline.

## 11. Documents, previews and format support

| Workflow | Intended implementation direction |
| --- | --- |
| Plain text / chosen knowledge-page format | Lightweight viewing and editing, with an explicit persistence format |
| PDF | Viewing, text/region selection and annotations; assess a specialist engine such as PDF.js |
| Images | Viewing and region annotations where useful |
| Office documents | Lightweight derived preview where available; advanced editing through a suitable provider |
| Unsupported formats | Honest download/open-externally fallback; no claim of editable round-trip support |

Select the initial page format and editor after assessing existing Muze work.
Do not equate a PDF renderer with a Word editor or promise lossless conversion
between arbitrary office formats.

Documents should open in reading mode without automatically loading the full
editing engine. The same app can load an editor when Edit is chosen. The
viewer still has a measured budget; PDF annotation being optional elsewhere
does not make its cost optional when that is the requested core task.

For complex source formats, support derived HTML/PDF previews. Each preview
identifies the exact source revision and conversion provenance. It is not the
authoritative editable document. Apply access restrictions consistent with the
source and make missing, failed or stale previews visible.

Preview generation can complete after the source commit; the UI must never
present an older preview as if it represented the new revision. Retain source
revision linkage rather than changing the source commit to claim preview
availability. Decide preview storage/versioning separately from user content.

For large documents, assess range-based reading, progressive loading and
authenticated access through the existing transport. Current Files downloads
materialise a Blob before download activation; that is not evidence of a
progressive large-document viewer. Bound text extraction and indexing, and
avoid downloading entire documents just to identify a handler.

Treat embedded active content as document content, not trusted Workbench code.
Use an appropriate rendering/isolation boundary while preserving keyboard and
assistive-technology access.

## 12. Annotations and revision identity

Reuse the W3C Web Annotation vocabulary and selectors, with Turtle persistence.
The W3C examples prefer JSON-LD, but the RDF vocabulary can be represented in
Turtle. This choice does not imply implementing the complete separate Web
Annotation Protocol.

An annotation should identify its author, body, creation time, target and
intended document revision. Store annotations as separate resources so a user
can comment on a document they may read but cannot modify. Choose an explicit
annotation collection and discovery/index mechanism, including a personal
collection when appropriate; do not search the whole pod whenever a document
opens.

For text, retain quoted text with surrounding context and useful position
information. For PDFs/images, define page/region coordinates, coordinate space
and the representation they refer to. An annotation on a preview must retain
that preview's identity and source-revision relationship; do not pretend its
coordinates are automatically valid in the original file.

On newer content, keep the original anchor. Re-anchoring is a derived mapping
that may be confident, ambiguous or absent. Show uncertain anchors for review
instead of silently attaching a comment to a different passage. Preserve access
to the original revision where authorised.

Separate annotation visibility from document visibility. The UI states whether
a note is private or shared. A private annotation in another root cannot be
atomically committed with the document; show independent outcomes explicitly.

There is an important protocol detail to resolve before joint document and
annotation creation: an annotation may target a resource version created by
the same commit, whose final URI is not yet known. Choose an explicit mechanism
such as preallocated resource-version identifiers or a defined commit-local
reference resolved at publication. Do not guess a revision URI or introduce
a second write that defeats atomicity.

## 13. Knowledge-base content and indexing

The first knowledge base needs stable page identities, titles, navigation,
links between pages, attachments and references to annotated source material.
Keep metadata and relationships as native RDF. Editing supported fields must
preserve unrelated statements, subjects and values.

Provide search over the available collection and explain its coverage. A local
index over cached pages is not complete pod-wide search. Treat search indexes,
backlinks and extracted document text as rebuildable projections, with their
source revision and update state tracked. Do not assume a standard Solid query
endpoint or scan/download all attachments on startup.

Commit related authoritative resources together. Decide which derived indexes
can update afterward without breaking user-visible integrity. Preserve working
drafts when remote-change notifications arrive; offer refresh or reconciliation
instead of replacing the edited content.

Collaborative keystrokes, live cursors and CRDTs are outside the first scope.
Shared published updates and explicit conflict recovery are sufficient.

## 14. Reconcile existing Workbench behaviour

### Automatic synchronisation

The current roadmap calls for automatic sync after reconnection. Distinguish
ordinary automatically synchronised data from explicitly committed working
copies. Automatic sync must not publish those drafts. If supporting commits
authorised while offline, show them as queued user-approved publications and
define what happens when their base or policy changes.

### Workspace checkpoints and close actions

Existing workspace checkpoints can include edit drafts and be saved to a pod.
For document workflows, checkpoint restoration references rather than copying
private document content into that remotely saved graph. Workspace Save & close
does not implicitly commit documents. Preserve local working copies separately
and keep close/discard language precise.

### Deletion

Current Files deletion writes `lm:deleted` in advertised link metadata and
retains resource bytes. The proposed commit DELETE removes a resource from
the current published snapshot while retaining historical versions. These are
different operations. Define their UI names and interactions explicitly. If a
workflow retains tombstones, commit the metadata change as such. Never silently
substitute physical deletion or history purge.

### Routing, credentials and draft privacy

Keep URL launch context separate from authentication. Reuse the existing
provider's own session and routing grants. Do not forward credentials between
apps merely because they share a working-copy identifier. Same-origin apps are
not isolated security principals just because they use the capability broker.

## 15. Backend integration direction

Investigate SVN repository/filesystem APIs as the first implementation. Map a
versioned root to a clear transaction/history boundary. Decide repository-per-
root versus shared repositories after evaluating metadata visibility, revision
numbering, operational overhead and scope enforcement.

Preserve content type, resource identity and necessary metadata along with
bytes. Use SVN's atomic publication for a complete commit rather than committing
each Solid operation independently. Direct ordinary writes must pass through
the same adapter and produce history. Read the current state and historical
snapshots from a consistent source of truth; avoid an independently updated
live-file copy that can disagree with the accepted repository revision.

Normal history should be immutable through the Solid interface even if backend
administrative facilities can alter revision properties. Verify author mapping,
durability, streaming of large objects and recovery through observable tests.
SVN's existence alone does not establish those properties for the adapter.

No SVN command, branch name, credential or working-copy format is part of the
client protocol. A browser working copy remains application-owned local data.

## 16. Implementation sequence and acceptance evidence

Each implementation phase should follow the repository's Spiral workflow and
record scope, evidence, evaluation and human acceptance. This design does not
start or accept an implementation cycle.

| Phase | Deliverable | Evidence required |
| --- | --- | --- |
| 1. Finalise contracts | RDF shapes, discovery, snapshot/history reads, draft ownership, upload lifecycle and retry semantics | Parseable examples; explicit error cases; review of the authority and publication boundaries |
| 2. Storage slice | SVN-backed root, single and grouped writes, message policy, snapshots and resumable staging | Failure leaves no partial publication; history matches live state; interrupted uploads resume; duplicate requests do not duplicate commits |
| 3. Document workflow | Open with, lightweight reading, one supported editor, durable local drafts, per-document history | Phone reading, keyboard operation, reload/offline recovery and accurate local/published status |
| 4. Annotations | One text-selection workflow and one PDF/region workflow as feasible | Revision binding, private/shared storage, uncertain anchors and original-version navigation |
| 5. Knowledge-base slice | Linked pages, attachments, scoped working copy, changes review and atomic commit | End-to-end scenario below, including conflict and recovery |
| 6. Advanced editing | Richer editors and complex formats where justified | Measured viewing/editing costs, supported-format fidelity and clear fallbacks |

### First integrated acceptance scenario

Open a knowledge-base page, edit it locally, attach a large PDF, annotate the
PDF, review the related changes and publish one described commit. Choose one
versioned root for the resources that must be atomic. Inspect the previous
snapshot and restore content through a new commit.

Repeat with:

- A reload before publication and an offline restart with cached content.
- An interrupted upload and a completed upload followed by a rejected commit.
- Another participant publishing while the upload is running.
- Authentication expiry or revoked write permission before publication.
- A lost commit response, followed by outcome lookup and safe retry.
- A required message omitted and a permissive root receiving an ordinary write.
- A cross-origin document provider and closure of its task presentation.
- A personal annotation outside the shared root, with separate publication.
- A newer document/preview revision that invalidates an annotation anchor.
- Phone reading on a constrained connection and keyboard/assistive-technology
  operation of the core workflow.

Choose representative file sizes and formats during the cycle and publish
measured results. Include large enough files to reveal buffering and recovery
problems. Automated fixtures complement live provider/browser and usability
checks; passing tests alone are not human acceptance.

## 17. Decisions still needed before implementation

1. Final namespace, RDF request/response shapes, errors, limits and unknown-term
   handling for the versioning profile.
2. History pagination/filtering, snapshot retrieval and permissions for deleted
   resources and partially visible commits.
3. Durable retry identity and lookup semantics, including stale preconditions
   after a previously successful request.
4. The working-copy capability and cross-origin content-access contract.
5. Revision identifiers for annotations created alongside new content.
6. Initial knowledge-page format/editor and the useful portions of Zett and
   cobalt-notebook to reuse.
7. Preview generation/storage, annotation indexing and search coverage.
8. SVN repository layout, operational limits, retention and privileged erasure.
9. Tus integration through Metro, upload expiry and supported integrity checks.
10. Per-workflow download budgets and the specialist rendering boundary.

Resolve these in the relevant early cycles. They do not require a general
branching model, a new UI framework or a universal document-editing engine.

## 18. Related designs and sources

Relative links below assume this file is placed in Workbench's `design/` folder.

### Workbench

- [Repository baseline](https://github.com/muze-labs/solid-workbench/tree/af68b00e2fe1af9220b6be19acfaedbed86f1570)
- [Engineering rules](../AGENTS.md)
- [Moldable Solid Apps](Moldable-Solid-Apps.md)
- [Apps roadmap](solid-apps-roadmap.md)
- [Semantic Open with](solid-semantic-open-with-design.md)
- [Capability broker roadmap](solid-capability-broker-roadmap.md)
- [Profile editing capability](solid-profile-editing-capability.md)
- [Managed workspace](solid-managed-workspace.md)
- [Native workspace state](solid-native-workspace-state.md)
- [Shared design components](../packages/solid-design/README.md)
- [Workspace and broker guide](../broker/README.md)
- [Current Files data operations](../apps/files/src/data.mjs)
- [Current conditional document saves](../packages/solid-app-data/src/index.mjs)

### Protocols and implementation references

- [Solid Protocol](https://solidproject.org/TR/protocol): storage descriptions,
  resource operations, constraint links, accepted media types and CORS.
- [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html):
  conditional requests and HTTP result semantics.
- [Version navigation links, RFC 5829](https://www.rfc-editor.org/rfc/rfc5829.html):
  existing version-history and version-navigation relations.
- [Tus resumable upload protocol](https://tus.io/protocols/resumable-upload):
  resumable transfer and upload lifecycle extensions.
- [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/):
  annotation bodies, targets, selectors and states.
- [Web Annotation Vocabulary](https://www.w3.org/TR/annotation-vocab/): RDF terms.
- [Apache Subversion features](https://subversion.apache.org/features.html)
- [Subversion filesystem transactions](https://subversion.apache.org/docs/api/latest/group__svn__fs__txns.html)
- [PDF.js layers and integration](https://mozilla.github.io/pdf.js/getting_started/)

External standards supply building blocks. The proposed Solid versioning
profile, working-copy contract and application policies in this document are
design work still to be implemented and verified.
