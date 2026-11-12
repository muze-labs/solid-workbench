# Document viewer with private and shared annotations

**Status:** Design proposal; no implementation or acceptance claimed  
**Date:** 2026-11-08  
**Project:** Solid Workbench  
**Suggested location:** `design/solid-document-viewer-design.md`  
**Repository inspected:** `muze-labs/solid-workbench` at
`576a3780035e1f7226303bca529508c00045e834`

## 1. Purpose and decisions

Read a document, mark passages or regions, and discuss them without changing
the source file. Start with PDF. Make additional formats possible through a
small plugin interface that reuses the same annotation experience and storage.

The maintainer selected these directions on 2026-11-08:

- Personal and shared annotation layers: private notes on the reader's pod,
  shared discussions in explicitly selected collections.
- First annotation tools: text highlights, region selection, comments and
  replies. Rich PDF markup and review-status workflows are deferred.
- Default note implementation: `@muze-labs/cobalt-rich-text-note`, following
  `muze-labs/margin-notes`. Users should be able to choose another compatible
  note-body editor through Workbench capabilities. This replaces the initial
  plain-text-only body direction; rich note text is distinct from PDF markup.
- Every note body must provide a `text/html` representation that other viewers
  can display without its native editor. Native editing formats are optional
  additions to this minimum interoperability contract.

The following are proposed defaults for review:

- One Documents application provides the viewer, standalone or embedded.
- Annotations are separate Turtle resources using W3C Web Annotation terms.
- Private is the initial writing destination. Selecting a shared layer is an
  explicit action; every composer identifies its destination.
- Save preserves an annotation locally and publishes it to the selected layer
  through a visible action. Typing alone preserves a local draft.
- Format plugins handle presentation and anchors. The application owns
  identity, permissions, drafts, persistence and publication.
- A note targets the representation actually read, at a known revision when
  available. Updates never silently move the original anchor.

This refines [Documents, annotations and a versioned knowledge base](solid-documents-knowledge-base-versioning.md),
particularly its viewer, working-copy and annotation sections. It does not
replace that design's storage protocol or turn viewing into document editing.

## 2. Scope and application boundary

The coherent task is reading and annotating. Users should not switch apps to
add a comment beside a passage. Files owns browsing and organisation; Documents
owns the reading surface and annotation tools; a knowledge-base app owns its
collection navigation and working copy. Launcher owns application navigation.

| First version | Later or separate work |
| --- | --- |
| PDF rendering, page navigation, zoom, rotation, outline when available | Editing PDF content, forms and signatures |
| Text selection and highlights, rectangular page regions | Ink, stamps, redaction and arbitrary shapes |
| Cobalt rich-text notes, independent replies, edit own notes | Resolved threads, assignments and formal reviews |
| Personal layer and explicitly selected shared layers | Public annotation search and social feeds |
| Local preservation, explicit save, failure recovery | Live cursors and collaborative keystrokes |
| Original download and Turtle annotation export | Flattened annotated PDF export and PDF markup interchange |
| Format plugin contract and an image proof of extension | Office conversion, EPUB and audiovisual plugins |

PDFs with existing embedded annotations may display those through the engine,
clearly distinguished from Workbench layers. Round-trip import/export of those
annotations is a separate fidelity problem. Adding a Workbench comment does
not modify, invalidate or re-sign the source PDF.

No AI service, OCR service, central annotation server or full-pod query endpoint
is required. Scanned PDFs support region comments without OCR.

## 3. Reading and annotation experience

### Open and read

Open from Files, a knowledge page, a document URL, or a local file picker.
Reading a public or local document does not require signing in. Sign-in is
needed when the chosen document or annotation destination requires it.

Show the title, current page and total, zoom controls, find, annotation toggle
and original download. Keep the document usable while layers load or fail.
Unsupported formats offer manual Open with and download. File extensions and
claimed media types are hints; a plugin must reject invalid content safely.

On a phone, the document occupies the reading view. Annotations open as a
separate panel/view with a clear return to the selected passage. On larger
screens the panel sits beside the document. Preserve page, zoom and selection
when changing panels. Use the suite's blue accent, square controls and existing
account/Preferences components; do not introduce another navigation system.

### Write a note

1. Select text, choose a page region, or choose Comment on document.
2. Choose Highlight or Add comment. A highlight can have no body.
3. Show the quoted passage/page and the destination: **Private · My notes** or
   **Shared · Project review**. A shared destination identifies its audience.
4. Preserve the draft locally while typing. Show a local-write failure if it
   cannot actually be preserved.
5. Choose Save. Show the remote result separately from local preservation.

Use precise states: **Saved on this device**, **Saving to My notes**,
**Saved to Project review**, **Permission required**, **Conflict**, and
**Save outcome unknown**. A successful private save means saved on the personal
pod, not merely cached in the browser.

Switching the visible layer does not silently retarget an open composer.
The first session starts private. Choosing a shared writing destination may
persist within this document session, but opening another document starts
private again. Shared replies use the thread's shared layer; the composer
states that explicitly. A private response to a shared passage is a separate
private note, not a hidden child inserted into the shared thread.

### Read and reply

The panel lists notes by document order, with author, date, layer and anchor
status. Users can filter visible layers and select one writing destination.
Colour is an optional aid; text labels and symbols identify audience and state.
Selecting a note focuses its passage. Selecting a mark focuses its thread.
Overlapping marks offer a list of matching threads.

Replies are individual annotations linked to their parent with the Web
Annotation replying motivation. They inherit the discussion's destination by
application policy. A participant edits their own resource; replying never
requires rewriting another person's note. Do not infer authorship from an
unverified creator statement alone. Show verified actor provenance separately
when supplied by the shared provenance design.

### Copy to another layer

Offer **Copy to shared layer…**, with a preview of the exact body, quotation,
target and destination. Create a new annotation and leave the private original
alone. Do not grant broader access to the existing private resource, copy its
private history, or publish other private replies. Retain any private-to-shared
relationship only in private metadata unless deliberately disclosed.

Deletion follows Workbench's conditional link-metadata tombstone convention;
it does not silently become HTTP DELETE or history erasure. A deleted root
with surviving replies appears as a removed-note placeholder. Future moderation
needs an explicit policy. History and recipients may retain previously shared
content; copying it back to private cannot retract those copies.

## 4. Architecture and ownership

| Part | Owns | Must not own |
| --- | --- | --- |
| Viewer shell | Navigation, panels, current document, plugin choice | PDF internals or document organisation |
| Format plugin | Render surface, selection, anchor creation/resolution, navigation | Pod credentials, layer policy or annotation saves |
| Annotation feature | Threads, layer filters, copy workflow, invoking note editor | Format-specific coordinate calculations |
| Note-body editor | Editing note content and preserving its in-progress draft | Changing document anchors, layer audience or publishing annotations |
| Annotation data API | Native RDF, discovery, conditional writes and recovery | UI rendering or document conversion |
| Document source bridge | Authorised byte access, revision checks, cancellation | A second authentication stack |
| Working-copy owner | Local changes and publication grouping | Implicitly publishing other apps' drafts |

Implement the viewer-owned parts as app-owned modules and named SimplyFlow
component datasets, not a new package for every row. Extract shared packages only after actual independent
reuse. Suggested slices are `documentReading`, `documentAnnotations`,
`annotationLayers`, `pdfFormat` and `documentRecovery`, with prefixed public
entries such as `swbDocumentAnnotations`.

Keep templates/styles/commands/actions and app-specific data policy inspectable
through the running app definition. Use SimplyFlow models for note filtering
and ordering. Commands collect UI input; actions operate on selections and
drafts; the data API performs storage through the existing libraries. Callbacks
from a long-lived renderer resolve the current effective action on invocation,
so personal overrides work. PDF.js internals remain an external dependency.

### Specialist rendering boundary

SimplyFlow owns the toolbar, panels, threads, dialogs and status. A plugin
owns one explicitly mounted document subtree, including the PDF engine's canvas,
text/accessibility and link layers. Neither renderer rewrites the other's nodes.
Workbench annotation controls remain SimplyFlow views; the plugin may provide
document-overlay geometry through its dedicated surface. Cobalt owns only its
mounted rich-text editor/read surface, with explicit cleanup and no competing
SimplyFlow rendering inside that surface. The specialist integration rule must
cover both PDF and rich-text surfaces before implementation. A remote note
provider owns its own document UI, within the existing capability presentation.

The repository currently requires SimplyFlow for runtime content rendering.
This specialist subtree is a proposed, narrow exception, consistent with the
earlier document design, and must be reconciled with the engineering rules
before implementation. Do not use it as permission to render ordinary app UI
with another framework. A PDF.js worker is a computation boundary, not a
separate security origin.

## 5. Small format plugin contract

A format plugin is an application-loaded ES module. A Workbench capability is
an operation supplied by an app, potentially on another origin. These are
different extension mechanisms. The first plugin registry is a small authored
list of pinned, trusted modules, not automatic execution of a document-supplied
script URL or a general plugin marketplace.

The following interface is illustrative JavaScript, not a frozen public API:

```javascript
const pdfFormat = {
  id: 'pdf',
  mediaTypes: ['application/pdf'],
  load: () => import('./formats/pdf.mjs')
};

// The loaded module exports:
async function open({ source, surface, events, signal }) {
  // Return one document session; no global current-document singleton.
  return {
    features: { text: true, region: true, search: true, outline: true },
    getSelection,
    resolveTarget,
    showTarget,
    setMarks,
    getReadingState,
    restoreReadingState,
    dispose
  };
}
```

| Contract | Required meaning |
| --- | --- |
| `source` | Read-only metadata and bounded byte/stream access to one representation, without exposing credentials |
| `surface` | One host-owned mount boundary; no authority over sibling app UI |
| `events` | Selection/location changes and actionable errors through explicit callbacks |
| `getSelection()` | A portable target description, selected text where present, and revision/representation identity; never a live DOM Range |
| `resolveTarget(target)` | `exact`, `candidate`, `ambiguous`, `missing` or `unsupported`, with position information and reason |
| `showTarget(target)` | Navigate/focus a resolved target without changing its persisted anchor |
| `setMarks(marks)` | Display the current authorised projection; clearing a layer removes its marks |
| Reading state | Small plugin/version-tagged location and zoom data, validated on restoration |
| `dispose()` | Cancel reads/render tasks; release workers, listeners, surfaces and object URLs |

Selection returns native structured values which the app maps to RDF, not
JSON stored in Turtle. Feature flags describe current document support: a PDF
may lack extractable text. Whole-document comments remain possible with any
plugin. Paged documents supply page/region targets; reflowable formats supply
their own selectors. The shell must not require every document to have pages.

Implement PDF plus a small image plugin during contract validation. The image
plugin supports region comments without text or outline. If adding it requires
changes to annotation persistence or hardcoded image cases in the composer,
revise the boundary before stabilising the interface.

In-process plugins are trusted application code. Passing a narrow source object
is good separation of concerns, not a sandbox against malicious JavaScript.
Untrusted plugins would require a separate origin and explicit communication
contract, outside this first design.

## 6. PDF implementation direction

Use PDF.js as the first engine to assess and pin. Prefer its supported display
API and reusable viewer components over maintaining a PDF parser or forking the
complete Firefox viewer. Its documented layers separate parsing, display APIs
and viewer UI. Confirm component APIs, licence and accessibility with the exact
selected release before adopting them.

The PDF integration provides page virtualisation, render cancellation, text
selection, rotation/zoom conversion, outline and incremental find. Bound canvas
resolution and retained pages on phones. Cancel stale renders when a document
is closed or replaced. A changed request generation cannot insert an old page
or annotation into the new document.

All HTTP, including anonymous reads, goes through the configured Metro/session
APIs. Do not pass a protected URL to an engine path that uses independent
fetch/XHR. Assess PDF.js's custom range transport and the installed Metro
stream/range APIs; build only the missing bridge. Resolve redirects and
authentication under the existing transport's policies.

Pin byte ranges to the same representation using server revision identity or
appropriate HTTP validators. Check status, Content-Range and length; handle a
server returning a full response to a range request. If a representation changes
mid-read, stop and reopen a coherent revision. Never combine pages from different
versions. A strong ETag is an opaque server validator, not a portable content hash.

When streaming/ranges are unavailable, offer an honest bounded full-download
fallback with progress, cancellation and a size decision before a costly read.
Do not use Files' current Blob download helper as evidence of progressive
viewing. Local files can supply Blob-based reads without uploading their bytes.

Disable PDF scripting and automatic active actions. Render note bodies through
the validated body-format renderer described below, escaping plain text and
sanitising HTML. Validate external links and attachments;
opening or downloading them is a deliberate user action. Bundle engine code,
workers and required assets with the app rather than trusting document-provided
URLs or transmitting private text to a CDN/service.

## 7. Annotation data and anchoring

Use the W3C Web Annotation RDF vocabulary, expressed in Turtle through oldm
and oldm-turtle. This adopts the model and vocabulary; it does not claim full
Web Annotation Protocol or JSON-LD API conformance.

Each note/reply has a stable resource URI, creator WebID, creation/modification
times, motivation, optional typed body, and target. Cobalt rich-text is the
default; plain text remains a readable/editable supported body format. Store native statements
and preserve unknown RDF, unrelated subjects and multiple values on updates.
Layer membership/access policy belongs to storage, not an `isPrivate` boolean.

Every body-bearing note/reply includes a current HTML `oa:TextualBody` with
`dct:format "text/html"` and its HTML in `rdf:value`. Native editor content may
be linked using `dct:hasFormat`, following the margin-notes Cobalt mapping.
Plain-text notes also provide escaped HTML, retaining paragraph/line breaks.
A bodyless highlight needs no empty HTML body. The plain-text example below
illustrates only the annotation/anchor structure; a complete saved note also
includes the mandatory HTML representation.

For example, the plain-text subset on an illustrative immutable revision:

```turtle
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a oa:Annotation ;
   dct:creator <https://alice.example/profile/card#me> ;
   dct:created "2026-11-08T12:00:00Z"^^xsd:dateTime ;
   oa:motivatedBy oa:commenting ;
   oa:hasBody [ a oa:TextualBody ;
       rdf:value "Does this also apply to our pilot?" ;
       dct:format "text/plain" ] ;
   oa:hasTarget [ a oa:SpecificResource ;
       oa:hasSource <https://team.example/history/report/rev-42.pdf> ;
       oa:hasSelector [ a oa:TextQuoteSelector ;
           oa:exact "Users retain control over their data." ;
           oa:prefix "Our principle: " ;
           oa:suffix " Applications must" ] ] .
```

The example's revision URL is not a proposed version-service URL scheme.
The annotation profile additionally records the logical document, representation,
revision evidence and useful PDF page/geometry hints. Finalise that small RDF
mapping and its namespace with parseable fixtures before implementation.

### Text and page regions

Text anchors keep exact quote, prefix/suffix and page-scoped text positions
where available. Define one versioned extraction profile: page scope, Unicode
normalisation, whitespace, hyphenation, reading order and offset units. Never
persist PDF.js DOM IDs or engine-private object references as durable anchors.

For PDF geometry define: zero-based page index; top-left origin on the visible
CropBox before viewer rotation; x/y/width/height normalised to 0–1; and the
exact representation identity. Keep multiple rectangles for text spanning lines
or pages. Do not encode a multi-line selection as one misleading bounding box.
Use PDF.js viewport transforms to map to/from actual PDF coordinates. Persist
geometry as native RDF nodes and typed numbers. A Workbench PDF selector profile
may be needed only for semantics existing selectors cannot represent. Assess
RFC 3778 PDF fragments first, including `page`, `viewrect` and `highlight`, as
described below. Do not invent a supposedly standard `#page=…&xywh=…`
combination. Reuse standard selectors only where their defined media semantics
really fit; convert their coordinate conventions explicitly at the plugin boundary.

### Solid Bench interoperability fixture

Use the existing [Solid Bench annotation sample](https://pod.solidbench.dev/samples/annotations/annotations-1.ttl)
as an external interoperability fixture. The raw Turtle was retrieved on
2026-11-08. Its [Pod Browser view](https://solidbench.dev/podbrowser/$EXT/https://pod.solidbench.dev/samples/annotations/annotations-1.ttl)
is a convenience UI; the raw RDF is the data source. At implementation kickoff,
retain the retrieved bytes, retrieval date and digest so acceptance tests do
not depend on a mutable online example. The repository also retains a
[historical sample](https://github.com/pduchesne/solidbench/blob/42ed5fcd8ce5a1004f59dc587923b8fe2e238b9b/pod/samples/annotations/annotations-1.ttl);
do not assume historical and live samples are identical.

| Observed structure | Import/viewing direction |
| --- | --- |
| `oa:Annotation`, title and creation/modification times | Retain original annotation identity and metadata |
| `oa:TextualBody` with `rdf:value`, without an explicit body format | Safely display untyped literal bodies as plain text; never infer executable HTML |
| PDF `oa:SpecificResource` with `oa:hasSource` and `oa:FragmentSelector` | Resolve supported PDF fragments through the PDF plugin |
| `dct:conformsTo` RFC 3778 and values such as `page=1&viewrect=43,47,74,42` | Assess existing PDF-open semantics before introducing a custom profile |
| HTML XPath selectors refined by text positions, and ranges between selectors | Preserve selectors; resolve when a compatible HTML plugin exists, otherwise show the note with an unsupported-anchor state |

[RFC 3778 section 3](https://www.rfc-editor.org/rfc/rfc3778.html#section-3)
defines `page` and `viewrect` PDF-open parameters. `viewrect` sets a viewing
rectangle; `highlight` separately describes a highlighted rectangle. Do not
assume the sample's viewing rectangle is the exact selected passage or
automatically convert it into highlight geometry. Verify units, page numbering,
origin, rotation and rectangle interpretation with real fixtures and the
target engine. Preserve the original selector when deriving internal geometry.

The retrieved sample does not bind targets to immutable revisions, supply
quoted-text fallback anchors, or declare HTML body representations. These
omissions limit the evidence available; they do not justify rejecting readable
annotations. Present revision identity as unknown and do not claim a match to
a historical version. Permissions may be defined on the containing resources
or server; absence of access metadata in the annotation does not imply public
or private access.

The compatibility rule is **read existing Web Annotation data; write the
richer Workbench profile**. Mandatory HTML remains the requirement for new
body-bearing notes and editor results. For legacy untyped text, derive escaped
HTML for display without modifying the source. On an explicit authorised edit,
save current HTML alongside preserved original/unknown RDF as appropriate.
Do not migrate or rewrite someone else's annotations merely by opening them.

Acceptance must demonstrate loading the fixture without Solid Bench packages,
displaying its note bodies, navigating supported PDF fragments, retaining
unsupported selectors and round-tripping unknown RDF. For missing/changed
sources, keep notes readable and anchor failures visible. Test that legacy text
containing HTML-like characters is escaped, not executed.

### Revision identity and document changes

Prefer the versioning design's immutable resource-revision reference. For an
ordinary mutable resource, retain logical URL, available strong validator,
observation time and an optional SHA-256 digest of the complete representation.
Do not download a huge file solely to compute a hash before reading or noting.
Show when identity evidence is incomplete. A local file uses a generated local
identity initially; a verified digest can later associate the same bytes.
Sharing annotations on a local file never implicitly uploads that file.

On an exact revision, geometry can resolve precisely. On a different revision,
text matching produces candidates. Unique text alone does not justify silently
changing the target. Ambiguous or missing anchors stay in the note list; users
can open the original revision where authorised or explicitly confirm a mapping.
Store confirmed mappings separately with source/target revision and actor;
retain the original target. Unsupported selectors also retain a readable note.

Derived previews keep their own representation identity and source-revision
relationship. Their coordinates are not automatically coordinates in the source.
New documents and annotations created in one working-copy commit use the
versioning design's eventual commit-local/preallocated revision mechanism;
this viewer must not guess final revision URLs.

## 8. Layers, discovery and access control

A layer is a named, document-scoped annotation collection with a stable URI,
label, logical document relation, storage container, access description and
effective capabilities. One document can have My notes, Team review and other
explicitly selected layers. Visibility filters are independent of write access.

| Layer | Storage and discovery | Intended access |
| --- | --- | --- |
| Personal | Reader's configured personal annotation area, found through private preferences | Reader, plus trusted storage/application operators under normal pod policy |
| Shared | Explicit collection URI selected by the user or offered in document context | Named participants under the actual server access policy |

Private means server-enforced access restricted to the reader; it is not
end-to-end encryption. Never publish personal collection links, note IDs,
quotes or counts into a shared document description or remotely saved workspace.

Reuse `pim:preferencesFile` for a private pointer to the personal annotation
registry. That registry maps exact logical document URIs to layer containers.
Start with bounded loading for small registries; define partitioning/paging
before the index grows beyond that supported limit. Shared layers can be
offered by an explicit launch context, user-added URL, or authorised document
metadata. Recommendations do not grant access or establish trust.

Use one note/reply resource per write within a document layer container.
Discover membership through its authorised container listing; do not require
another mutable global index entry for each comment. Fetch bodies with bounded
concurrency and visible incomplete/loading state. For oversized listings,
require supported paging or an explicit collection-size limit; do not pretend
plain Solid guarantees query/pagination. A later optional index is rebuildable,
and failures must not make a saved note appear lost.

Adding an arbitrary layer URL must not forward the current account's credentials
to an untrusted origin. Use normal transport authentication/audience policies.
Validate layer-document association; aliases, moved files and identical hashes
do not silently merge collections with different access contexts. No scan of
the complete pod or public web occurs when opening a document.

### Permissions and safe provisioning

Document and annotation permissions are independent. Document read access
does not grant layer access. A layer can be readable but unwritable, or support
new replies without permission to edit the root. A shared annotation does not
grant access to its source PDF; warn when the intended audience may lack it.
Quoted text itself can disclose protected content, so include it in copy review.

The shared-layer policy should let participants create notes, edit their own
notes, and read the discussion, with an explicit owner/moderator policy.
Solid WAC/ACP do not universally provide a portable creator-only editing rule.
Do not grant broad collection Write and claim that hiding Edit enforces it.

For the first implementation, use preconfigured layers whose server-enforced
policy is verified, or add an authorised provisioning mechanism that installs
and verifies per-resource policies. Private creation must be private from the
first write: if the parent permits public read, refuse the location rather than
briefly publishing then tightening permissions. Creation capability and final
resource permissions must both be checked on the target server. Layer creation
and member management can initially stay outside the viewer, behind existing
permission tooling; selecting an existing verified layer is sufficient.

Revocation stops subsequent remote access. Hide revoked layers and clear their
active projections on discovery of revocation. Do not promise to erase copies
already obtained by another participant or offline device.

## 9. Local preservation, concurrency and publication

Persist annotation drafts in IndexedDB through the supported workspace/data
integration. Keep native RDF metadata separate from binary document caching.
Partition by account, layer, document and working copy. Browser storage may be
evicted or exhausted; report failed persistence, preserve recoverable in-memory
content, and offer an export. Never evict pending edits as expendable cache.

Standalone Documents owns its drafts. In an embedded knowledge-base workflow,
the caller owns the working copy and supplies explicit scoped operations.
Cross-origin apps cannot assume shared IndexedDB. Do not make a transient iframe
the only owner of pending notes. Workspace checkpoints contain minimal restore
references, not private bodies, quotes or PDF bytes.

Use client-generated resource names and conditional creation
(`If-None-Match: *`). Use the last observed validator for changes to existing
resources. Separate replies avoid a shared thread rewrite. Conflict handling
preserves both versions and unknown RDF; it does not simply replace the ETag.
Two local tabs editing the same note also need ownership/conflict handling.

If a response is lost, read the intended resource and reconcile its known
identity/content before retrying. Until resolved, report unknown outcome.
Resource-name collision is not proof the write succeeded. When using the
version service, use its specified retry/outcome lookup mechanism.

Plain Solid supports independently saving each note; basic annotation use must
not depend on the new version service. On a strict versioned root, use the
commit service and honour its message requirement. In a knowledge working copy,
Save can preserve a pending change for later explicit commit. Explain this
state in the composer. A personal layer in another root is saved independently;
there is no cross-pod atomic publication promise.

Offline reading requires the app shell, plugin assets and selected document
bytes to be cached. Offer an explicit Make available offline action with size
and completion state; a cached first page does not mean the PDF is complete.
Offline drafts survive reload within the supported storage conditions. Going
online does not publish them automatically. A Save action while offline leaves
the note locally preserved and asks the user to retry publication when online.
Recheck authentication, policy and revision before publishing.

Account switching and sign-out remove the old account's live projections and
stop network work. Retain or remove that account's local drafts through an
explicit choice without copying them into another account. Revoked material
may still exist in an offline cache; do not describe offline access as fresh
authorisation.

## 10. Workbench integration and capabilities

Reuse Files' semantic Open with direction and existing resource/WebID fragment
launch context. A PDF media-type registration is sufficient; RDF shape matching
is not required to recommend a PDF viewer. Current Files still downloads normal
files; changing that action is implementation work, not an existing feature.

The viewer advertises the suite's proposed semantic open capability with
supported formats and contract versions. Reconcile the final operation URI
with `solid-semantic-open-with-design.md`; avoid a competing PDF-only routing
vocabulary. Managed capability calls can additionally supply:

| Input | Meaning |
| --- | --- |
| Resource and content type hint | Document to open; type remains subject to validation |
| Revision/representation context | Current, immutable historical, or named working copy |
| Layer suggestions | Collections offered to the user, without implied authority |
| Focus target | Specific annotation or selection to reveal |
| Presentation | Standalone or embedded, using existing broker negotiation |

The existing launch parser accepts resource/WebID; additional direct-link
revision/focus parameters need a versioned extension and validation. Do not
assume those fields already exist. Sensitive private layer IDs should travel
through scoped control messages rather than public/shareable URLs.

The viewer reads using its own authorised session; no bearer tokens appear in
URLs or broker messages. Local file bytes and cross-origin working-copy content
need an explicit content-access path; broker control messages are small and
subject to the existing 64 KB serialisation limit. Do not base64 a PDF into one.
The byte bridge and access lifetime are contracts to finalise, not implemented
broker facilities.

Completion reports cancellation, read failure or an opened/closed reading task,
with only deliberately returned information. Opening a document never means
annotations were published. Explicit save results distinguish locally preserved,
confirmed remote, denied, conflict and unknown outcome. Close uses existing
guarded lifecycle checks and does not implicitly commit. Caller cancellation
stops activity and preserves pending drafts; it cannot undo a confirmed write.

### User-selected note-body editing capability

The capability boundary is **edit a note body**. Document rendering/selection
remains a format plugin; note editing becomes a separate replaceable operation.
Selecting a different editor does not move annotations to that provider's
storage or replace the viewer's layer, threading, anchoring or permission model.
A complete alternative annotation application would need a separate, broader
contract and is outside this first replacement boundary.

Use the proposed URI `https://vocab.muze.nl/capabilities/edit-note-body`, subject
to the capability roadmap's contract/namespace review. Name the operation for
its meaning, not for Cobalt. A Cobalt-backed provider is the default application.
The same Cobalt editing implementation can serve the standalone viewer locally
without requiring Launcher; wrap it as a capability provider for managed use.
An explicitly selected external provider must not silently fall back to Cobalt
if it fails. Standalone external-provider invocation needs a defined launch
handshake or an explicit return to the local editor; it is not supplied by the
current managed broker when Launcher is absent.

#### Observed foundation and missing work

At the inspected Workbench revision:

- `ManagedApp` supports capability requests/responses, cancellation and guarded
  close, including `beginEmbedded`, `requestEmbedded` and `endEmbedded`.
- The shared capability dialog hosts a provider iframe with a tab fallback;
  it is a bounded task presentation, not a general persistent widget host.
- `WorkspaceBroker` permits one embedded task per requester and one invocation
  per embedded task. An edit-and-return operation fits that model.
- Launcher currently configures embedded Profile and Files providers in code.
  `embeddedProvider` requires exactly one configured provider per capability.
  The current dialog resolves that configuration; passing another provider URL
  does not override its selected implementation.
- General top-level routing is also constrained by the current Launcher route
  policy. Advertising a new operation alone does not enable every caller.

Therefore the transport/presentation can be reused, but note-body editing and
end-user replacement are not completed features. Implement the body contract,
Cobalt provider, explicit route policy, and user selection through the existing
private preferences/provider-registry direction. Resolve that selection into
the broker's permitted provider configuration. Do not add a second registry
or remove origin/provider validation merely to accept an arbitrary editor URL.

#### Request and result semantics

| Field/result | Contract |
| --- | --- |
| Input body | Native RDF subgraph or equivalent unambiguous linked-data wire view; declared body format/profile and existing body identity |
| Recovery context | Opaque per-account edit-session identifier and base-body revision/fingerprint, without credentials or pod-wide authority |
| Optional context | Only the title/quote needed for editing; omit other notes, layers, audience details and document bytes by default |
| Accepted formats | HTML is the mandatory readable representation; native editing profiles, including Cobalt fragments, are additional negotiated support |
| Successful result | Current HTML representation, optional native body/profile, and edit-session/base identity; means accepted edit, not saved to the pod |
| Other results | Cancellation, unsupported body/profile, validation failure or recoverable provider failure; original annotation remains intact |

The provider edits a working body copy. **Use note** accepts that edit back into
the viewer's draft. The viewer then performs the existing explicit Save or
working-copy commit workflow; it alone changes annotation metadata and publishes.
No pod credentials or automatic write grants are necessary for the editor.
Treat sending a private note to another origin as disclosure to that provider;
select it deliberately and show its identity before first use. Broker routing
does not provide end-to-end secrecy from the broker.

Keep ordinary notes within the broker's complete 64 KB serialised payload
limit, including request/result overhead. Validate size before invocation.
Larger bodies require a separately specified scoped content-access mechanism;
do not silently upload private drafts or raise the global message limit.

#### Cobalt reuse and format compatibility

Source inspection of margin-notes at
`48172a979702721d77a47cb1801357b8e8964136` found the dependency
`@muze-labs/cobalt-rich-text-note` (`^0.1.0`), `edit(container, fragment)`,
and editor `getValue()`, `focus()` and `destroy()` calls. Its fragment carries
text and ordered range/tag annotations. Its app-owned RDF bridge stores native
Cobalt fragment text/ranges/tags/order and derives an HTML `oa:TextualBody`
through `dcterms:hasFormat`. Reuse this model and bridge where their public
contracts fit, rather than serialising the fragment as JSON in Turtle.
Do not copy margin-notes' HTML passage anchors or single notes-resource storage
policy into this PDF viewer's revision/collection model.

Confirm the exact fragment schema, range units, supported tags, validation and
sanitisation rules with the pinned Cobalt package before implementation. Preserve
unknown RDF outside the managed body mapping. HTML is the mandatory
interoperable presentation, derived from native content where present. Save
the body and its current HTML together in the same annotation resource/write;
do not leave an older HTML rendering attached to a newly edited native body.
Sanitise HTML on display even if generated by another provider. Never treat
arbitrary returned HTML as trusted application markup.

All conforming note viewers can display that HTML without loading Cobalt or
invoking the creating provider. All conforming note-body editing providers
return HTML, even when they have no separate native format. Specify a small
shared HTML profile for paragraphs, emphasis, lists and links before freezing
the contract. Exclude scripts, active embeds, event handlers and automatic
external resource loads; an HTML representation must not require private
provider assets or executable code to read the note. An optional plain-text
projection supports search and accessibility but does not replace HTML.

Editor replaceability requires data compatibility as well as the operation URI.
A provider can edit an existing rich note only if it preserves its format or
offers an explicit conversion the user accepts. A plain-text editor must not
silently discard Cobalt formatting. Keep unsupported bodies readable through a
safe representation and offer the configured compatible editor; retain original
content if conversion is declined. HTML guarantees display interoperability;
it does not guarantee lossless editing in every provider. Changing provider
does not migrate old data. A provider using HTML as its native format is valid,
provided it meets the shared HTML profile and editing/recovery contract.

#### Draft durability and lifecycle

The caller preserves its original body before invocation. While the provider
is open, the provider must preserve the in-progress draft in its account-scoped
local storage and support recovery under the edit-session identifier before it
may claim local preservation. On a successful return, the viewer persists the
returned draft before reporting acceptance. Closing/cancelling must distinguish
retaining a recoverable draft from deliberately discarding it.

Margin-notes' inspected modal obtains the current value when Save is chosen;
that alone does not establish continuous local durability. Verify Cobalt's
change-observation APIs and add the narrow draft integration needed. The
existing capability API returns a final result; do not assume it streams
keystrokes/checkpoints to the caller. Define provider resume/retention and
close/failure behaviour explicitly, or defer remote replacement until recovery
meets the same conditions as local editing. Test iframe reload, tab fallback,
broker loss and provider switching without losing or mixing drafts.

## 11. Accessibility and performance conditions

The core task must work with keyboard and assistive technology. Provide page
navigation, find-based selection or a passage picker, whole-document/page
comments, and a keyboard-operable region selector where region selection is
offered. Dragging cannot be its only input. Test text-layer reading order, focus
return from notes, zoom/rotation, and screen-reader access to highlights and
threads. Do not announce every canvas repaint. An untagged/scanned source may
limit document semantics; state that limitation without making note controls
inaccessible. Defer a selection tool if its core interaction cannot meet this.

The suite currently enforces a complete-app JavaScript ceiling below 200,000
gzip bytes. The earlier document design records permission to establish larger
budgets for complex apps, but the standing check/rules still need reconciliation.
PDF viewing is this app's core task: lazy loading PDF.js does not exclude its
cost from the measurement. Before implementation, agree and record separate
measured budgets for shell, PDF engine/worker/assets and complete read-and-note
workflow. No unmeasured size or latency target is claimed here.

Measure cold first-page display, first useful text selection/comment, total
transferred bytes, worker/assets, peak memory and cancellation on a phone and
slow connection. Include long, image-heavy, scanned, rotated, multilingual and
unusual-font PDFs. Bound page rendering, annotation fetches, text extraction,
search and re-anchoring; never extract the entire document just to open it.

## 12. Implementation sequence and acceptance evidence

This document does not authorise code publication or close a Spiral cycle.
Use the repository's Spiral workflow when implementation starts.

| Slice | Concrete result | Required evidence |
| --- | --- | --- |
| Contract validation | RDF/selector fixtures, PDF/image interface, note-body capability, transport/access policy decisions | Turtle round-trip including Cobalt fragments, geometry/extraction profile, confirmed renderer/budget reconciliation |
| Reading | Standalone PDF and Files open integration | Real phone/keyboard reading, authenticated ranges, cancellation, no mixed revisions |
| Private notes | Highlight, region/body, draft recovery and personal layer save | Separate-account read denied; reload/offline/quota failure; unknown-outcome recovery |
| Shared discussion | Existing shared layer, independent notes/replies and copy review | Two identities; server denies another author's edit; private bodies/links never enter shared metadata |
| Revisions and embedding | Historical focus, uncertain anchors, knowledge working copy | Original anchor survives update; iframe closure preserves drafts; independent-root save states |
| Extension check | Image plugin using unchanged note UI/storage | Region note survives reopening; unsupported text tools absent; plugin disposal works |
| Note-provider replacement | Cobalt default plus a second compatible editor selected by the user | Same viewer/anchors/layers; HTML-only viewing without Cobalt; every provider returns current HTML; preserved rich content and durable draft recovery; unchanged caller code |
| External annotation compatibility | Solid Bench fixture read through the viewer's own data/plugin APIs | Legacy bodies readable; supported PDF fragments navigate; unknown revisions/selectors remain explicit; no implicit source rewrite |

The end-to-end acceptance scenario is: open a shared PDF with read-only source
access; make a private note; reload and recover it; save it to the personal pod;
copy only that note to Team review; have a second participant reply; then replace
the PDF and inspect the original-version and uncertain-anchor presentation.

Repeat with expired login, revoked collection permission, conflicting edits,
lost responses, multiple tabs, no range support, a scanned PDF, failed local
storage and an incomplete offline download. Verify remote permissions using a
second identity and direct server requests, not just hidden buttons. Inspect
workspace checkpoints and shared RDF for unintended private references.
Automated fixtures complement observed browser/accessibility results and human
acceptance; passing tests alone does not establish completion.

## 13. Decisions to close before implementation

1. Exact PDF.js release, supported component APIs and specialist subtree rule.
2. Complete PDF workflow download budget and actual phone measurements.
3. Versioned PDF selector/extraction profile and ordinary-server revision evidence.
4. Personal-registry RDF mapping, bounded discovery and collection-size limits.
5. Target-server WAC/ACP provisioning that genuinely enforces intended authorship
   and private-from-creation policy. Decide supported server profiles explicitly.
6. Final capability/launch fields and scoped content access for working copies.
7. Note-body profile contract, Cobalt change/draft APIs, provider preferences
   integration and explicit rich-text conversion behaviour.

These are implementation decisions; the selected layer model and initial
highlight/comment scope are already settled. Revisit the explicit-save and
copy-to-layer defaults with the maintainer if a different interaction is wanted.

## 14. Sources and research refresh

Research snapshot: 2026-11-08. Refresh specifications, engine APIs, licences and
existing Solid annotation work when implementation starts. Record versions and
reuse decisions. Inspect Dokieli's relevant annotation patterns before creating
equivalent discovery or editing infrastructure; no compatibility claim is made
from that suggestion alone.

- [Workbench source baseline](https://github.com/muze-labs/solid-workbench/tree/576a3780035e1f7226303bca529508c00045e834):
  `AGENTS.md`, `ARCHITECTURE-PHILOSOPHY.md`, moldability rules, Files composition
  and data APIs, launch parser, capability transport and existing design files.
- [Moldable Solid Apps](Moldable-Solid-Apps.md).
- [Semantic Open with](solid-semantic-open-with-design.md).
- [Capability broker roadmap](solid-capability-broker-roadmap.md).
- [Versioned documents and knowledge base](solid-documents-knowledge-base-versioning.md).
- [Provenance, signatures and attestation](solid-provenance-signatures-and-attestation.md)
  and [signing capability](solid-signing-capability.md): optional proof/signing
  integration belongs there, not in another viewer-specific signature format.
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/):
  annotation bodies/targets, selectors, replies, collections and separation
  from transport. RDF/Turtle persistence is the Workbench design choice.
- [PDF.js Getting Started](https://mozilla.github.io/pdf.js/getting_started/):
  engine layers and distribution. The transport/selection bridge and precise
  component suitability remain to be verified in a pinned implementation spike.
- [Dokieli](https://dokie.li/docs): candidate Solid/document annotation reuse
  research, to inspect at implementation kickoff.
- [Solid Bench raw annotation sample](https://pod.solidbench.dev/samples/annotations/annotations-1.ttl)
  and [public platform source](https://github.com/pduchesne/solidbench): external
  RDF compatibility fixture and reuse research. Historical integration imports
  `@hilats/annotations-core` and `@hilats/annotations-react-ui` from a separate
  local `web-annotations` project; public source for those packages was not
  located on 2026-11-08. Data interoperability does not depend on obtaining them.
- [RFC 3778, PDF fragment identifiers](https://www.rfc-editor.org/rfc/rfc3778.html#section-3):
  assess the defined PDF-open parameters before designing extra selectors.
- [Margin-notes source baseline](https://github.com/muze-labs/margin-notes/tree/48172a979702721d77a47cb1801357b8e8964136):
  `package.json`, `src/cobalt-editor-modal.js`,
  `src/features/paragraph-note-stacks/cobalt-fragment-rdf.js` and
  `annotation-model.js` inspected for Cobalt integration and native RDF mapping.
  Rendering, draft durability and interoperability still require viewer-specific
  verification; importing this dependency alone proves none of those conditions.

Relative design links assume placement alongside the existing repository
designs. This standalone proposal does not bundle those companion files.
