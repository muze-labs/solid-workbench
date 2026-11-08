# Verifiable provenance, signed changes and timestamp attestation

**Status:** Design proposal for later implementation  
**Date:** 2026-11-08  
**Project:** Solid Workbench  
**Suggested location:** `design/solid-provenance-signatures-and-attestation.md`  
**Companion:** [Documents, annotations and a versioned knowledge base](solid-documents-knowledge-base-versioning.md)

This document proposes a provenance layer for Solid Workbench and versioned
Solid storage. It connects signed changes, server acknowledgements and timestamp
attestations to documents, annotations, knowledge-base content and delegated AI
work. It records a design direction, not an implemented protocol or a claim of
production readiness.

## 1. Purpose

Make it possible to inspect and independently verify evidence about a change:
which key signed it, which identity was associated with that key, what was
requested, what the storage service acknowledged, which content resulted, and
what temporal evidence is available.

A WebID profile advertises public signing material, directly or through linked
verification-method documents. Private keys remain with an appropriate signing
facility. Workbench signs changes before submission; the pod records and signs
their accepted outcome; an attestation service can timestamp the resulting
evidence.

The user should be able to follow a knowledge-base interpretation back to its
sources, identify subsequent corrections and distinguish a person's assertions
from another person's endorsement. AI-generated interpretations should remain
traceable and contestable. Provenance must not turn interpretation into a dead
end or silently attribute an agent's work to a human reviewer.

The foundational distinction is between **intent**, **recorded outcome** and
**evidence supporting those records**.

## 2. What verification means

| Evidence | Supported conclusion | Conclusion it does not establish by itself |
| --- | --- | --- |
| Valid change signature | The signed statement was produced using the corresponding private key and has not been altered within its defined coverage | The human personally reviewed it, its content is true, or the signer had permission to execute it |
| Verified key binding | Under a stated trust policy, this key was associated with this WebID and purpose at the relevant time | A real-world identity beyond the evidence used to establish that binding |
| Signed pod receipt | This server acknowledges this request and outcome | Independent proof that the server durably executed every claimed effect |
| Matching snapshot/content | The retrieved result matches the signed digest or snapshot commitment | Continued availability or completeness of all history |
| Valid timestamp attestation | The attestor asserts that the committed evidence existed by the stated time, with its stated clock/trust assumptions | The exact instant an edit occurred, the truth of the content, or the correctness of an associated action |
| Independently retained checkpoint | Later history can be compared against an earlier observed commitment | Automatic detection of every omitted event or a fork no observer has encountered |

Avoid one undifferentiated “verified” flag. Report cryptographic validity,
identity binding, authority, temporal evidence and content matching separately.
An unavailable key document is not the same result as an invalid signature.

## 3. Three linked records

### 3.1 Signed change statement

The user or delegated actor signs a durable statement describing the requested
change. It is meaningful outside the original HTTP exchange.

Its signature coverage includes:

- Protocol/profile version and the intended signing purpose.
- Signing-key identifier, actor identity and any delegated principal.
- Destination storage service and versioned-root URI.
- Base commit identity and, where available, its cryptographic commitment.
- Ordered operations, exact targets and interpreted metadata such as media type.
- A digest of each supplied payload, with the digest algorithm and scope.
- Commit message, including the distinction between absent and empty if allowed.
- A client-generated request identifier, and any expiry or audience restrictions.
- Digests of referenced delegation or approval evidence when relied upon.

A URI alone is not a content commitment. In particular, a staged-upload URL
must be accompanied by the digest of the actual intended content. The pod must
verify the uploaded bytes against that digest before publication.

### 3.2 Signed commit receipt

The storage service signs an acknowledgement binding the signed request to the
accepted result. The receipt includes:

- Service identity and verification method.
- A digest binding the change statement and its signature evidence.
- Request identifier and authenticated submitting actor.
- Accepted commit/revision identity, parent and resulting snapshot commitment,
  or a precisely defined changed-resource manifest sufficient for verification.
- Actual effects, including documented server-generated effects.
- Server-claimed acceptance time.
- The relevant authorisation/policy version or a protected reference and digest.
- Outcome and receipt-profile version.

Distinguish the actor that signed the content from an authenticated transport
submitter where those differ. A legitimate relay or delegated submission needs
defined semantics; an arbitrary mismatch must not be accepted by accident.

Sign a successful receipt only after the durable acceptance boundary. A receipt
is an accountable statement by the server; an independent verifier can also
retrieve the snapshot and compare it against the commitment. The server's
signature alone does not remove the need to trust or observe its storage
behaviour.

### 3.3 Timestamp attestation

The attestor signs a commitment binding the signed change and signed receipt,
or a receipt envelope that already transitively binds the complete signed
change. Define this envelope and digest construction exactly in the profile.

Include signatures in the timestamped evidence. Timestamping only a document's
bytes does not establish that a later-added signature existed at that time.

The attestor need only receive a commitment, not the document contents. Store
its returned token and the material required to verify its identity, signature,
time claim and any external anchor.

These records have separate identities and immutable contents. Attaching a
later attestation must not change the already signed receipt or create a
circular digest dependency.

## 4. WebID keys and historical identity

### Public discovery

Allow several signing keys per WebID from the beginning. Each key has a stable
identifier, public material, controller binding, allowed purpose and lifecycle
information. Separate authentication, signing assertions and delegation roles.
The existing login or DPoP key must not silently become the long-lived content
signing key.

Reuse established verification-method and controller concepts. WebID remains
the identity entry point; requiring a new DID identity system is not a goal.
The exact WebID-to-controller-document binding and vocabulary must be specified
and tested rather than assumed from a key appearing somewhere in an RDF graph.

### Trust bootstrap

A mutable profile currently listing a key cannot, by itself, prove that the
key belonged to that identity years ago. A self-signed key announcement also
cannot establish a human identity without some independently trusted binding.

Define how verifiers initially trust the WebID/key association: for example,
an authenticated profile observation under a documented trust policy, a prior
trusted key, or an identity credential from an accepted issuer. Preserve the
binding evidence and its observed time. Report its assurance honestly.

### Rotation, revocation and recovery

Preserve historical public keys and binding evidence. Key removal from a live
profile must not erase the evidence needed to assess old signatures.

Routine rotation and suspected compromise are different events. Rotation can
link the old key to a replacement; recovery after loss or compromise needs its
own explicit authority. Record lifecycle assertions and their evidence without
silently rewriting earlier signatures.

A trusted timestamp can help establish that a signature predates a known
revocation. It cannot establish that the key was uncompromised then if the
actual compromise time is unknown. Verification must distinguish current key
status, known effective dates and uncertainty about historical control.

Apply equivalent key-lifecycle requirements to the pod and attestation service,
not only to end users.

## 5. Private keys and signing interaction

Do not store private signing keys as ordinary profile data or pass them through
capability messages. Choose an appropriate signing facility with deliberate
enrolment, device access, recovery and revocation behaviour. This document does
not yet select browser storage, a hardware-backed facility or a remote signer.

The signer receives the exact operation and context to authorise. Separate
permission to use a signing key from possession of a pod write credential.
A protected or non-exportable key does not automatically prevent compromised
application code from invoking it; define the application's signing boundary
and scope accordingly.

For human commits, the reviewed changes must be the changes signed. Freeze the
reviewed content and upload digests; modifications after approval require a new
review/signature. Do not display one draft and sign another after asynchronous
updates.

An authorised application may sign routine saves without a new confirmation
for every edit. Such a signature records the application/device action under
the configured authority. It must not be labelled explicit human review.
Human approval is a separate event when it is actually requested and performed.

## 6. Turtle, canonicalisation and payload integrity

Turtle remains the default representation for Workbench provenance records.
Do not invent a cryptographic signature algorithm or a casual “sort triples
and hash” procedure. Select a maintained standard proof suite with explicit
coverage, canonicalisation and verification rules.

For signatures over RDF structure, RDFC-1.0 is an established canonicalisation
building block. Apply it to the precisely defined signed dataset, not to an
unbounded collection of linked documents. Prefix choices, statement order and
blank-node labels should not alter the signed graph meaning within the chosen
profile. This is structural normalisation, not proof that differently modelled
graphs have equivalent real-world meaning.

Define absolute IRI resolution, graph boundaries and the treatment of proof
metadata. Use the chosen suite's construction to avoid a signature signing
itself. Bound resource usage during parsing and canonicalisation and reject
unsupported cryptographic suites or ambiguous interpreted fields.

Keep two integrity questions distinct:

| Object | Initial integrity direction |
| --- | --- |
| Change statement, receipt and provenance metadata | Canonical RDF dataset under a selected standard suite |
| Uploaded file or inline resource payload | Exact application payload bytes, using a named digest algorithm |

A digest of a Turtle literal inside a manifest is not automatically a digest
of the bytes eventually stored as a resource. Specify text encoding and payload
digest verification explicitly.

Solid servers may parse RDF and serve a different serialisation. Preserve the
signed submitted payload or identify it as an input artifact; separately bind
the resulting resource representation or canonical graph in the receipt. Do
not call a harmless serialisation change a broken signature, or claim that
different output bytes are the original signed payload. The initial adapter
must choose and document its input/output integrity contract.

Large files can be hashed incrementally while read/uploaded. Verify the final
digest before commit and retain the association with immutable staged content.
Server-side digest validation does not replace the client's responsibility to
sign the content it intended.

## 7. PUTs, commits and storage policy

A signed ordinary PUT is a one-operation change. A signed multi-resource
commit covers the complete ordered set; the pod must never publish only the
subset whose signatures or permissions happen to pass.

HTTP Message Signatures can protect direct requests by covering the method,
target, preconditions and a content-digest field. That mechanism does not
automatically produce portable provenance. Preserve the covered values and
verification evidence, or define a durable signed change envelope alongside the
request. Avoid depending solely on transient request logs.

For the first prototype, signing explicit Turtle commits is the smaller scope.
Direct signed PUT support can follow with a precise mapping to the same
evidence model. A server-generated automatic commit cannot fabricate a missing
user signature for an ordinary unsigned write.

Extend the advertised versioning policy to describe accepted signing profiles,
whether actor signatures are required, receipt support, and available timestamp
services. Final RDF terms remain to be chosen. Message policy and signature
policy are independent:

| Root policy | Behaviour |
| --- | --- |
| Unsigned writes permitted | Record unsigned changes honestly; server receipts may still be available |
| Actor signatures required | Reject unsupported, invalid or missing actor-signature evidence before publication |
| Attestation available | Allow publication with visible timestamp-pending status until evidence arrives |

Presence of a signature is not sufficient: verify its key binding, intended
purpose, destination, base, scope and any delegation. Continue to enforce the
pod's ordinary access policy. A provenance policy does not replace WAC/ACP or
grant additional authority.

Legacy history remains unsigned unless genuine earlier signing evidence can
be imported. Signing an old archive now proves an assertion made now about
that archive; it does not retroactively prove its original authorship or date.

## 8. Publication lifecycle and recovery

1. Preserve edits in the local working copy. No external timestamp request is
   needed merely to autosave a private draft.
2. On the user's publication action, prepare the change statement and immutable
   content digests. Complete any required large uploads.
3. Review and sign the exact change statement with a unique request identifier.
4. Submit it through the configured Solid transport. The pod validates its
   signatures, authority, uploads and concurrency preconditions.
5. Atomically publish the accepted changes and durably bind the request to the
   resulting revision and receipt data.
6. Return or make retrievable the signed receipt. Verify it and, where required,
   compare the resulting snapshot with its declared commitment.
7. Obtain a timestamp attestation over the signed evidence and retain it.
8. Present publication, receipt verification and attestation as separate states.

A rejected base requires reconciliation and a new signature over the revised
proposal. Do not change signed fields or replace a validator behind an existing
signature. Completed uploads can be reused if their content and access remain
valid.

A lost response leaves the result unknown until the request identifier is
resolved. The server must durably retain the accepted request-to-revision
mapping. An exact retry returns the earlier outcome, even if the head has
advanced; the same identifier with different signed content is rejected.
Signatures do not prevent replay without this server-side execution policy.

Design receipt generation for crashes between durable publication and response
delivery. Persist enough stable receipt data with acceptance to retrieve or
complete the acknowledgement later. If signing is temporarily unavailable,
report receipt pending rather than claiming either rollback or a valid receipt.

The initial design allows timestamping after publication. If Attest is
unavailable, the commit remains published and visibly unattested/pending.
Retries must not create new commits. Do not claim atomic coordination between
SVN and an external attestor. A later timestamp cannot retroactively establish
the claimed earlier acceptance time.

Timestamping a proposal before submission is an optional separate capability:
it provides temporal evidence for intent, not acceptance. A future policy that
requires pre-publication attestation needs an explicit workflow and failure
model; it is not implied by this initial design.

## 9. Attest trust levels and temporal claims

Integrate the existing Attest direction through a narrow adapter and a documented
verification profile. Its current implementation and wire contract must be
inspected before implementation; this document does not claim they have been
verified here.

| Level | Evidence | Trust boundary |
| --- | --- | --- |
| Issuer-signed timestamp | The attestor signs a commitment and a time claim | Trust in the issuer's clock, key handling and honesty |
| Externally anchored attestation | The token or batch commitment is retained by an independent witness/log/anchor with inclusion evidence | Adds evidence against retrospective rewriting under the anchor's own trust assumptions |

The earlier Attest design's first level trusts Muze's clock and key. Publicly
verifiable signatures make that assertion inspectable; they do not make it
independent of Muze. An external anchor provides a separate observation and
time bound, not automatic validation of every finer-grained issuer timestamp.

RFC 3161 is a useful reference for timestamp semantics. Using similar semantics
does not make a custom Attest token RFC 3161 compatible. Define issuer identity,
digest and signature algorithms, clock uncertainty, key lifecycle, validation
and failure reporting for the actual format.

Requesting an attestation discloses at least a commitment and traffic metadata.
Hashes are not encryption; predictable content can sometimes be guessed.
Timestamp an appropriate signed envelope and evaluate blinded commitments where
needed. Private documents need not be made public to obtain temporal evidence.

## 10. Delegated AI and human responsibility

Give an AI service or other delegated actor its own identified signing key.
Do not lend it a person's unrestricted private key. A delegated change records
the actor, accountable principal and the exact authority relied upon.

Delegation evidence should bind permitted operations, resources, audience,
expiry and parent authority. Authority can narrow through a chain; a delegate
cannot invent additional rights. Revocation and scope checks remain part of
execution, and their policy context should be retained in the receipt where
appropriate.

| Event | Provenance treatment |
| --- | --- |
| Agent prepares a draft | Attribute preparation to the agent and record source revisions |
| Agent publishes under a mandate | Sign as the agent and bind the delegation/principal |
| Human explicitly reviews and approves | Record a separate signed approval over the exact reviewed artifact |
| Software saves through an authorised device key | Record the device/application action; do not infer human review |
| AI interprets source material | Preserve source links and attribution; label the interpretation as such |

Approval is not authorship and authorship is not endorsement by an organisation.
“This person said X” must not silently become “this organisation believes X.”
Accountable humans and institutions remain responsible; AI does not acquire
final authority merely by signing its output.

Use provenance links to distinguish causal ancestry from evidentiary support:
an output can derive from an input without that input proving the output's
claims. Corrections and disagreements are additional evidence, not corruption
to erase from history.

## 11. Provenance links and evidence packaging

Use PROV-O where its entity, activity, agent and derivation terms fit. It supplies
a vocabulary for provenance relationships, not cryptographic verification or
permission enforcement. Add narrow application terms only for contracts that
existing terms do not express.

Reference source revisions, not only mutable URLs. For example, an annotated
passage, a knowledge-base interpretation derived from it, and a human approval
should each preserve their own identity and relationship to the relevant
immutable version.

An exportable evidence package should contain, or integrity-reference:

- The exact signed change dataset and proof.
- Referenced payloads or their digests and clearly defined verification scope.
- The signed receipt and resulting snapshot/changed-resource manifest.
- Timestamp tokens and any inclusion or external-anchor evidence.
- Historical public-key and identity-binding material.
- Relevant delegation/approval evidence and its status information.
- The profiles, algorithms and trust-policy identifiers needed to interpret it.

Verification should not require keeping the original application or SVN backend
running. Offline verification can assess included evidence, but cannot claim a
fresh revocation/status check without current information. State that limit and
the time of the most recent successful status observation.

Keep signed bytes/datasets immutable and store later lifecycle evidence beside
them. A new export or verification result must not silently rewrite the records
it evaluates.

## 12. History integrity, privacy and omissions

Parent commitments and retained receipts help detect alterations and conflicting
history. They do not prove that a presented history is complete. A server can
omit a suffix, withhold records or present different signed branches to different
observers unless independent observations expose the discrepancy.

Retain accepted receipts at the client and allow optional independent witnesses
or checkpoints. Comparing checkpoints can reveal rollback or equivocation.
Describe this as tamper evidence and additional accountability, not an absolute
guarantee against a malicious operator.

Apply access control to provenance itself. Messages, filenames, actors, source
links and delegation scope may be sensitive. A public key need not imply public
access to all changes signed by that key. Public attestation should not require
publishing private evidence.

Selective access has a verification consequence: deleting protected statements
from a signed graph normally prevents verification of that original graph.
Initially return the full authorised evidence or report verification as partial
or unavailable. Do not present a redacted record as if its original signature
verified over the redacted text. Selective-disclosure proofs or Merkle inclusion
proofs are later design choices, not implicit features.

Revoking future access cannot recall evidence already obtained by another party.
Retention and privileged erasure policies from the versioning design still
apply. An unavailable historical payload should be reported as missing evidence,
even when its digest and valid signatures remain.

## 13. Workbench integration and UI

Reuse the history, changes and persistent status surfaces described in the
companion design. Add an expandable **Provenance** view to documents,
annotations and knowledge-base pages.

| Display | Meaning |
| --- | --- |
| Signature valid | Cryptographic proof verified over the defined content |
| Identity binding verified / uncertain | Separate evaluation of key-to-WebID association |
| Delegation verified / missing / invalid | Whether the asserted authority chain met the selected policy |
| Pod receipt verified / pending | Server acknowledgement evidence, independently of timestamping |
| Content matches / unavailable / differs | Result of checking the referenced payload or snapshot |
| Timestamp verified / pending / unavailable | Attestation result, including issuer and trust level |
| Human approval recorded | A specific reviewed artifact has explicit approval evidence |
| Unsigned historical change | No actor signature is available; do not imply tampering solely from absence |

Make explanations available without forcing cryptographic vocabulary into every
save operation. A concise normal history row can show actor, message and evidence
indicators; details expose the keys, digests, source revisions and verification
policy.

Verification failures and uncertain publication outcomes remain visible inline.
Do not collapse them into a green badge or a short-lived toast. Cached results
must be bound to immutable evidence digests, verifier version and relevant policy;
key status or policy changes can require reevaluation.

Key enrolment and management should show the affected identity, device or
application purpose, recovery implications and revocation controls. A root that
requires signatures should explain the prerequisite before the user attempts
publication, while continuing to preserve local drafts.

The signing service is a distinct security boundary. Existing broker routing is
a useful integration mechanism, but does not by itself make a signer safe or
isolate same-origin apps. Keep the implementation small and review its actual
authority and credential boundaries.

## 14. Incremental implementation

Start with the research refresh and reuse assessment in section 16.1. Build a
small interoperable prototype first; external discussions are optional and
must not become a prerequisite for implementation.

| Phase | Deliverable | Acceptance evidence |
| --- | --- | --- |
| 1. Freeze the evidence profile | Canonical signed dataset, proof suite, key binding, digest scopes and receipt fields | Independent fixtures and negative cases; exact coverage documented |
| 2. Human-signed commits | One enrolled key, signed Turtle commit, staged-content digest validation | Tampered target, message, body, base or upload is rejected; drafts survive failure |
| 3. Signed pod receipts | Durable request-to-revision mapping, retrievable receipts and result verification | Lost response and crash recovery do not duplicate commits or invent outcomes |
| 4. Attest integration | Timestamp signed evidence and expose pending/verified states | Wrong digest, unknown issuer, invalid token and issuer outage handled explicitly |
| 5. Historical verification | Rotation/revocation evidence and portable export | Old evidence remains assessable after profile updates and server migration |
| 6. Delegated work and witnesses | Scoped agent signatures, explicit human approvals and optional checkpoints | Scope violations rejected; approvals bind exact artifacts; observed forks are reported |

For the first useful slice, sign an explicit commit containing a knowledge-base
page and a staged binary attachment, retrieve the signed receipt, timestamp it,
then verify an exported package with a separate verifier. Do not describe a
same-code round trip as independent verification; use an independently
implemented verifier or established suite test vectors where feasible.

Include tests for:

- Altering any signed target, operation, content digest, message or audience.
- Replaying a request against the same root or a different destination.
- A valid signature without sufficient pod permissions or delegated authority.
- A stale base and reconciliation requiring a new signature.
- Upload substitution, incomplete content and changed RDF serialisation.
- Lost acknowledgements, delayed receipt generation and attestor outages.
- Key rotation, suspected compromise, missing historical bindings and stale status.
- An agent-generated change incorrectly presented as human-approved.
- Partial/redacted evidence, withheld payloads and conflicting checkpoints.
- Local draft privacy, offline preservation, keyboard access and comprehensible
  verification states on a small screen.

Implementation follows Workbench's Spiral workflow. This document creates no
implementation cycle and does not constitute acceptance of an implementation.

## 15. Decisions before implementation

1. Supported signature suite, digest algorithms and canonicalisation profile.
2. WebID key discovery, controller binding, bootstrap trust and historical status.
3. Signing facility, device access, application scope and recovery mechanism.
4. Exact signed-change, receipt and evidence-envelope RDF shapes and identifiers.
5. Representation integrity for RDF inputs versus stored/served RDF outputs.
6. Retry identity, durable receipt generation and crash-recovery contracts.
7. Actual Attest wire format, issuer trust, clock uncertainty and anchor profile.
8. Delegation and human-approval evidence, with clear authorisation semantics.
9. Provenance access control, redaction behaviour and private/public commitments.
10. Evidence export, verifier trust policies and independent verification fixtures.

Keep the initial scope to signed explicit commits, pod receipts and honest
timestamp reporting. Broader direct-write coverage, external witnessing and
selective disclosure can extend that model without changing what earlier
evidence claims to prove.

## 16. References and related work

Relative links assume this file is placed in Workbench's `design/` folder.

### 16.1 Standards alignment and implementation-time research refresh

**Research snapshot: 2026-11-08. Refresh when implementation starts.** Treat
this design as a Solid integration profile built on existing provenance and
signature work. The findings below identify reuse candidates, not audited
implementations or an already standardised signed-commit protocol.

| Layer | Reuse direction | Boundary still to define |
| --- | --- | --- |
| Provenance semantics | [PROV-O](https://www.w3.org/TR/prov-o/): versions as entities, accepted commits as activities, humans/applications as agents, with attribution and derivation | Proposed changes versus accepted outcomes, commit operation semantics and precise revision references; provenance claims alone are not proof |
| Proof format and processing | [Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/) and an established suite, initially evaluate [eddsa-rdfc-2022](https://www.w3.org/TR/vc-di-eddsa/) | Exact signed manifest/receipt shapes, purpose and replay context; using Data Integrity need not turn every commit into a Verifiable Credential |
| Public keys and permitted uses | [Controlled Identifiers v1.0](https://www.w3.org/TR/cid-1.0/), including verification methods and relationships | WebID/controller binding, historical evidence and lifecycle policy; HTTPS identifiers are supported, so a DID migration is not required |
| Trusted application discovery | [Solid Application Interoperability](https://solidproject.org/TR/sai), especially its user-designated Authorization Agent and identity-profile discovery | Signing-provider invocation and review; permission to access data is not permission to sign a change |
| Resource metadata discovery | [Solid auxiliary resources](https://solidproject.org/TR/protocol#auxiliary-resources) and description links | Independently retained history: auxiliary resources are deleted with their subject resource, so they must not be the sole durable evidence store |
| Timestamp evidence | [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html) as a compatibility reference | Actual Attest token profile, trust assumptions and binding to already-signed evidence; do not claim RFC compatibility without testing it |

Data Integrity and the EdDSA suite above are W3C Recommendations from May 2025;
SAI is a Draft Community Group Report in this snapshot. Recheck maturity,
errata and newer versions before choosing dependencies.

The eddsa-rdfc-2022 suite already canonicalises RDF and signs the concatenation
of SHA-256 hashes of the proof configuration and document using Ed25519. Prefer
its specified construction and test vectors over inventing a Muze envelope.
Do not add a new prefix or change the hashing sequence while claiming suite
compatibility. Our manifest must bind the operation context within the selected
suite's coverage. WebAuthn assertions are a different proof construction and
must not be relabelled as this suite.

Keep Turtle as the default application representation. Data Integrity processing
has JSON/JSON-LD requirements: specify and test a lossless mapping for the
supported Turtle profile, including proof metadata, dataset boundaries and
IRI resolution. RDF equivalence alone is not evidence of interoperability.

Relevant implementations and research to revisit:

- [Dokieli](https://dokie.li/docs): current documentation describes signing
  documents/annotations, browser-managed keys and public keys in WebID profiles.
  Inspect its vocabulary, formats and UI for reuse. Its in-app key management
  and documented key-retirement limitations do not meet our isolated signer
  and historical lifecycle requirements by themselves.
- [Braun and Käfer's KIT demonstration, ESWC 2022](https://people.aifb.kit.edu/co1683/2022/eswc/):
  Solid resources with Linked Data Signatures, RDF-star and Signed URIs. Useful
  precedent for independently verifiable resources; not our atomic commit or
  trusted approval contract. Do not inherit a legacy proof format unexamined.
- [solid-pod-rs](https://docs.rs/crate/solid-pod-rs/latest): alpha documentation
  describes optional Git marks, PROV-O sidecars and external anchoring. Inspect
  actual enabled behaviour and recovery guarantees before reuse. Server history
  alone does not prove author approval; this does not change the planned SVN
  backend or require blockchain anchoring.
- [Nanopublications](https://nanopub.net/docs/guidelines/): signed, immutable RDF
  assertions with separate provenance and publication metadata, and content-
  derived identifiers. Their four named graphs normally use TriG. Evaluate for
  publishing knowledge claims; do not require all document commits to use them
  or assume their signing format equals Data Integrity.
- [Jesse Wright's ISWC 2025 provenance research](https://ceur-ws.org/Vol-4085/paper19.pdf):
  verifiable query results and privacy-preserving queries over decentralised
  sources, including Solid-held credentials. Relevant to later knowledge-base
  and AI derivations, outside the first signed-commit slice.

The research did not identify a standard combining author-signed Solid commits,
user-selected isolated signing providers and trusted manifest review. Treat
that as a dated finding, not a permanent absence claim.

**Implementation kickoff checklist:**

1. Refresh the linked specifications, errata, project repositories and Solid/LWS
   work; look for newer signed-change, receipt and provider-discovery profiles.
2. Record the research date, exact specification versions and repository commits.
   Check maintained implementations, licences, browser support and dependency
   size before selecting reusable code. Distinguish documentation claims from
   behaviour actually exercised.
3. Build a small fixture: sign a Turtle manifest for a knowledge page and binary
   attachment, verify with an existing independent implementation, and exercise
   tampering and serialization round trips. Record any interoperability gap.
4. Record adopt/adapt/defer decisions and justified deviations in the first
   implementation cycle; update this design and its companions with the results.
   Keep only missing Solid manifest, invocation, approval and receipt semantics
   in the new profile.

Build first, talk later: no outreach, consensus process or external endorsement
is required to start this work. Sharing concrete interoperability findings with
Dokieli, SAI or other contributors can follow once there is a working slice.
This checklist is an implementation task, not a scheduled research automation.

### Workbench designs

- [User-selected signing capability](solid-signing-capability.md)
- [Documents, annotations and a versioned knowledge base](solid-documents-knowledge-base-versioning.md)
- [Moldable Solid Apps](Moldable-Solid-Apps.md)
- [Capability broker roadmap](solid-capability-broker-roadmap.md)
- [Native workspace state](solid-native-workspace-state.md)
- [Engineering rules](../AGENTS.md)

### Standards and reusable building blocks

- [W3C Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/): proof
  structure, verification methods, purposes and cryptographic-suite integration.
- [W3C Controlled Identifiers v1.0](https://www.w3.org/TR/cid-1.0/): controller
  documents, verification relationships and key lifecycle considerations.
- [RDF Dataset Canonicalization](https://www.w3.org/TR/rdf-canon/): RDFC-1.0,
  a standard foundation for deterministic RDF dataset hashing/signing.
- [HTTP Message Signatures, RFC 9421](https://www.rfc-editor.org/rfc/rfc9421.html):
  signatures over selected HTTP message components and replay considerations.
- [Digest Fields, RFC 9530](https://www.rfc-editor.org/rfc/rfc9530.html): digest
  fields for HTTP content and representations.
- [Time-Stamp Protocol, RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html):
  an established reference for trusted timestamping and proof-of-existence.
- [PROV-O](https://www.w3.org/TR/prov-o/): RDF vocabulary for provenance
  entities, activities, agents and relationships.

These standards supply parts of the design. They do not by themselves specify
the proposed Workbench protocol or establish that a particular WebID, server,
agent, clock or claim should be trusted.
