# Resource picker and initial broker

Experimental suite contract, 2026-11-01. Continues broker Phases 0 and 1.

## Capability semantics

`https://vocab.muze.nl/capabilities/browse` requests one file or container URL.
Input is an empty JSON-LD node with context
`{"@vocab":"https://vocab.muze.nl/capability#"}`. A result is a JSON-LD node
`{"@id":"https://pod.example/resource"}`. The complete HTTP(S) URI is returned,
including its query/fragment when supplied by a provider. No bytes are moved,
downloaded or written. A URI grants no access. Files selects among resources
actually listed by its authorized Solid session, within its configured root.
The caller validates the result before replacing its field.

The companion recipient pilot is
`https://vocab.muze.nl/capabilities/select-recipient`: one explicit selection
returns an `@id` identifying the selected WebID or contact, not implied access
rights or a mailbox address. CYC139 implements the current configured address
book pilot below; shape filters and multiple-book browsing remain deferred. Both URIs are provisional and not asserted to dereference yet.

## Managed transport and authority

The server relay described in the original version of this document is
superseded by the [browser-local workspace design](solid-managed-workspace.md).
The capability semantics above remain current. Launcher opens an instance,
checks its origin/window, and offers a private MessagePort. Only the configured provider
receives a caller-scoped transient selection request. Files uses its own Solid session;
a WebID in a launch URL establishes neither routing nor Pod authorization.

`PortConnection` carries calls, replies and cancellation with request IDs, plus
an explicit disconnect frame. Frame shape and pending/active call counts are
checked; capability arguments and results retain their domain validation.
Interactive embedded calls have no inactivity deadline. Cooperative disconnect
settles pending work; the shared presenter also detects repeated iframe loads
and changed provider generations, ends the old ticket and shows recovery guidance.
The caller keeps its prior value and can explicitly start a new task after
closing the interrupted dialog. No invocation is automatically replayed.

Separate tabs retain closed-window monitoring. Arbitrary process loss without
an observable signal remains outside this guarantee. Connected providers retain
save/discard guards. Busy providers cannot replace an existing selection.
The obsolete live-instance route, chooseFiles API and per-instance grants are
removed; preferred provider configuration and scoped tickets remain.

Launcher validates a returned HTTP(S) URL before changing its resource draft.
Cancellation preserves the previous field. Files owns picker UI, selection and
its existing data policy. SimplyFlow renders content; no second renderer is
introduced. Test cross-origin routing, cancellation, provider loss, denied reads,
source/origin/owner checks and exact configured-provider tickets. The browser proof uses
fixture data; see [setup and evidence limits](../broker/README.md).


## One-click Launcher activation

The same cycle now focuses an eligible existing Files instance or opens/reuses
the built-in Files app when absent. This is bounded built-in startup, not the
future provider registry. Opening/focus starts in the user's click; readiness
waiting is cancellable and bound to the selected instance. Grants are checked
again before invocation, and ambiguity is visible. Selection/cancellation asks
for focus back to Launcher, with manual-switch guidance when browser policy
refuses. The isolated protocol/browser proof avoids workspace persistence while
DEF18's native RDF correction remains open.


## Preferred provider, CYC118

CYC118 adds identity-wide resource-picker choice in shared Preferences, with a
capable saved-app list and custom app URL entry. See
[the native preference contract](../packages/solid-preferences/README.md#preferred-resource-picker).
This continues broker Phase 2; recipient selection and independently implemented
broker replaceability remain separate Phase 3 work. Selection grants no Pod
permission. The current UI uses the existing transient embedded task with tab
fallback; the older top-level activation helper remains available.

Saved app declarations are optional and explicit. The current Launcher supplies
its saved-app metadata and verified live declarations through the existing
private Preferences operation; the editor reads linked manifests through Metro.
There is no app catalog, guessed manifest discovery or automatic startup merely
to inspect support. Failed provider startup keeps the chosen provider and caller
draft. Provider changes affect subsequent calls; exact ticket-time checks reject
a stale choice, and workspace teardown prevents a late result entering a new
workspace. URL identity and executable location remain distinct native terms.

The schema and vocabulary remain experimental. These are implementation
contracts for review, not a claim of third-party certification or human cycle
acceptance.


## Current-book recipient picker, CYC139

Input is an empty node or the existing `@context` hint; other fields are refused.
A useful result separates identity, document location and data:

```js
{
  "@id": "urn:uuid:12345678-1234-1234-1234-123456789abc",
  "document": "https://pod.example/contacts.ttl", // optional locator
  "description": { "turtle": "...selected native RDF..." } // optional fallback
}
```

The original identifier is retained, including existing urn:uuid contacts.
Never invent a WebID or a fragment URL to make it look dereferenceable. The
containing document and the selected subject are different identifiers. A caller
fetches a document with its own Metro session and looks up `@id` inside it.
There is no token transfer or extra authorization mechanism. A configured
location is not an assertion that every local edit is published there.

The caller needs a document or native description, rather than an opaque UUID
alone. The built-in picker reads a local collection and includes its current
selected description, so unsynchronized contacts work without publishing the
book. A description takes precedence over a potentially stale remote copy.
Document-only providers are supported through an explicit caller read. Missing,
inaccessible or mismatched documents fail without overwriting a previous choice.

The description contains the selected subject, its anonymous values, and named
email/telephone value nodes that carry `vcard:value`/`vcard:hasValue`. Other named
contacts are not exported. Preserve unknown predicates, typed/multiple values
and language metadata in that bounded description, with other named links left
as references. The picker previews exactly what is returned. Shared/cyclic
anonymous values are refused rather than flattened by the installed writer.
The bridge supplies the public OLDM-Turtle writer with a selected-subject view;
it is not another RDF parser or serializer. CYC151 removes the unjustified
60000-byte description and 64 KiB helper limits. Only the selected description
is exported, with no truncation or automatic publication. Future byte limits
require an evidenced protective purpose, applicable boundary and measured value;
the structured-clone transport itself has no project-defined universal byte cap.

Both pickers use focused task views rather than miniature management apps.
Contacts offers current-book search, explicit choice/confirmation, payload
preview and Cancel; normal profile editing stays hidden. Files offers a resource
selection list, useful shared folder navigation and Select/Cancel, hiding the
normal management table, upload, deletion and Share controls. Both reuse their
existing models/data APIs. Uncached data is never assumed available offline.

Files' normal per-resource **Share…** action invokes the configured recipient
provider in the same Workbench context. The selection summary displays the
resource and selected contact's name/contact hints/identity/document. It does
not grant access, deliver an invitation or claim the resource was shared.
Cancellation retains the previous choice, and a late account/workspace result
is ignored. Concurrent legacy browse requests cannot interrupt that choice.
Native workspace state retains resource/entity/document references and a label,
not a Turtle description embedded in Turtle. After reload, current details can
be selected again; original contact RDF remains authoritative in Contacts.

Identity-wide `recipientProvider` preferences reuse the existing native registry,
cache, whole-choice conflict and provider-routing rules, independently of browse.
Builtin Contacts is the default. Provider selection grants no Pod permission.
The independent browser fixture imports neither ManagedApp nor PortConnection;
it exercises actual Files and Contacts UI, local data, document-only resolution,
cancellation/reload, provider replacement and a second browse provider. These
are interoperability fixtures, not third-party certification or cycle acceptance.
