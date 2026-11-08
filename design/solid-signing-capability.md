# User-selected signing capability

**Status:** Design proposal for later implementation  
**Date:** 2026-11-08  
**Project:** Solid Workbench  
**Suggested location:** `design/solid-signing-capability.md`  
**Proposed capability:** `https://vocab.muze.nl/capabilities/sign-change`

This document defines the direction for requesting signatures from a
user-selected capability provider. It complements [versioned documents and
knowledge bases](solid-documents-knowledge-base-versioning.md) and
[verifiable provenance](solid-provenance-signatures-and-attestation.md).
It specifies responsibilities and security requirements, not a finished wire
protocol, implemented provider registry or production-ready signer.

## 1. Goal and core decision

Solid applications must be able to obtain signatures for changes without
receiving the user's private signing key or unrestricted signing authority.

Introduce a **sign-change capability**. The user selects the app URL providing
that capability through the same provider-selection mechanism used for other
Workbench capabilities. Applications request the capability by its semantic
URI and do not hardcode a Muze signing domain.

The provider owns key access, signing policy and approval presentation. It can
use WebAuthn, a browser extension, native wallet, hardware-backed facility or
remote signing service behind the contract. The client and pod still need to
support the resulting proof profile; interchangeable invocation does not make
all cryptographic formats interchangeable.

The main decisions are:

- Reuse the capability-provider registry and existing preferences discovery.
- Keep provider selection separate from key enrolment and signing permission.
- Use a separate origin for a web-based signer.
- Sign a typed, fully specified change rather than arbitrary opaque input.
- Keep explicit human approval distinct from signing under a standing mandate.
- Verify returned proofs at the caller and independently at the pod.
- Preserve existing signatures and historical key bindings when providers change.

## 2. Three identifiers, three responsibilities

| Identifier | Purpose | Controlled by |
| --- | --- | --- |
| Capability URI | Names the operation and its input/output semantics | The capability contract |
| Provider application and launch URL | Identifies the implementation selected for invocation | Provider description plus explicit user selection |
| Verification-method URI | Identifies the public key and relevant verification relationship | The identity/key controller under the provenance trust model |

The provider app URL is not the author's WebID and not the verification-key
URI. One provider may manage several identities or keys. A signature result
must identify the actual key used and the actor/authority under which it acted.

Receiving a provider URL does not grant pod access. Publishing a public key
does not authorise every application to request its use. A provider advertising
sign-change is making a capability claim, not establishing trustworthiness.

## 3. Preferences and provider discovery

Use the existing WebID `pim:preferencesFile` discovery path. The private
preferences document can refer to the user's capability-provider registry.
Store the sign-change provider selection there rather than introducing a
parallel signing-service preference mechanism.

Reuse the capability roadmap's proposed vocabulary and refine its registry
schema during implementation. These fragments are illustrative, not a claim
that the current registry is implemented or the terms are final.

Within the preferences document:

```turtle
@prefix cap: <https://vocab.muze.nl/capability#> .

<#preferences>
    cap:registry <./capability-providers.ttl> .
```

Within the provider registry:

```turtle
@prefix cap: <https://vocab.muze.nl/capability#> .

<#changeSigner>
    cap:provides <https://vocab.muze.nl/capabilities/sign-change> ;
    cap:application <https://signer.example/app/#app> .
```

An application description identifies the validated executable launch URL,
supported contract versions, proof profiles and presentation requirements.
The application identifier may differ from that launch URL. Do not infer an
executable URL by manipulating an arbitrary RDF identifier.

The first implementation needs one explicit default provider per account for
sign-change. Multiple provider choices can follow without changing the
capability URI. Do not silently select among several candidates or fall back
to a different provider when the chosen one fails.

Cache confirmed preferences for ordinary operation, with account isolation.
Treat a changed provider, launch origin or key association as a visible change
requiring deliberate acceptance. A successful preferences read alone is not
authority to silently enrol a new key. Surface missing configuration or
unsupported capabilities while retaining the caller's drafts.

Users can choose a Muze provider, a self-hosted provider or another compatible
implementation. No central provider catalog, Muze account or specific IdP is
required by this design.

## 4. Provider selection is not signing authorisation

Keep these decisions distinct:

| Decision | Effect |
| --- | --- |
| Select provider | Requests may be routed to this implementation |
| Enrol/bind key | This public key is associated with an identity and purpose under a stated trust policy |
| Approve change | The specific frozen change may be signed |
| Grant bounded signing session | Defined future changes may be signed within a mandate |
| Authorise pod write | The pod permits the actual operation under its own access policy |

The broker routes requests. The signing provider decides whether it can sign
them. The pod decides whether to accept and execute them. None of these steps
implicitly substitutes for the others.

The IdP can assist enrolment or operate a signer, but signing remains a distinct
capability. Do not treat an OIDC login, access token or DPoP proof as approval
of a document change or as the author's durable content signature.

## 5. Security boundary and presentation

### Separate origin

A web signer must operate on a different origin from untrusted requesting
applications. A dedicated subdomain can provide that separation; a separately
registered domain is not required. Hosting `/files/` and `/signer/` on the same
scheme, host and port does not isolate their script or storage authority.

The existing Workbench broker does not create a security boundary between
same-origin apps. App names, URL paths and instance IDs can help routing and
presentation, but cannot reliably identify mutually distrustful applications
hosted on one origin. Signing grants must reflect the actual browser security
principal unless stronger isolation exists.

A distinct origin reduces exposure to requesting applications; it does not
make the signer immune to compromised code, hosting or dependencies. The
provider and any remote custodian remain explicitly trusted components.

### Trusted approval surface

Use a top-level signer tab/window for the initial sensitive approval workflow.
It presents its own identity and renders the requested change from the exact
manifest it will sign. Do not rely on an approval dialog drawn by the requester.

Existing embedded Profile/Files tasks demonstrate useful lifecycle mechanics,
but their iframe presentation must not automatically become the signing
security model. Embedded signing needs a separate framing, origin and user-
interaction assessment before it is supported. A blocked popup or failed
connection must not cause an invisible signing fallback.

The signer must generate a human-friendly approval screen from the exact,
validated, immutable manifest whose digest it signs. The requesting app supplies
structured data, never the approval text or HTML. Rendering and hashing must
use the same parsed statement and interpretation; reject ambiguous or
unsupported input rather than displaying one interpretation and signing another.

The screen must show:

- The signing account/key and verified requesting origin. A friendly app name
  may accompany the origin, but must not replace it or imply verified identity.
  Broker-asserted caller identity must follow the trust model in section 6.
- The destination pod/root and readable resource paths, with full target URIs
  available for inspection. Friendly titles are untrusted labels, not identities.
- Concrete additions, replacements and deletions, with destructive operations
  prominent. Large commits may be grouped and summarised, but every operation
  must remain inspectable and operation counts must be accurate.
- The exact commit message, or an explicit indication that none was supplied,
  and the base revision against which the changes were prepared.
- The scope of review: approval of listed operations, with any inspected
  document contents distinguished from content that has not been inspected.
- Clearly separate Cancel and Approve and sign actions. Signing must not be
  described as successful publication.

An illustrative approval screen, generated by the signer:

> **Knowledge Base requests your signature**  
> Requesting origin: `https://kb.example`  
> Signing account: Auke  
> Destination: Work pod → Research  
> Base revision: 42
>
> - Add **Energy outlook** (`energy-outlook.ttl`)
> - Replace **Sources** (`sources.ttl`)
> - Delete **Old notes** (`old-notes.ttl`)
>
> Commit message: “Update energy research”  
> Review scope: listed operations; document contents have not been inspected.
>
> **[Cancel] [Approve and sign]**

This is illustrative UI, not a caller-provided summary or a fixed text template.
Treat labels and messages as inert text; constrain misleading truncation,
bidirectional text and visual spoofing. Use accessible controls and keyboard
navigation, with operation types expressed in text rather than colour alone.
Reject unsupported manifest versions, operation types and meaning-affecting
extensions that the signer cannot reliably explain. Ignore only extensions
explicitly defined by the profile as non-semantic; never silently omit an
unknown operation from review.

For content-level review, the signer needs access to the exact relevant bytes
or verified versions. A manifest and digest alone let it describe destinations
and operations, but do not let it truthfully claim that the human reviewed the
document contents. Make the review scope explicit.

Optional previews must match the content digests in the manifest. A diff must
also be bound to the identified base content; an app-supplied screenshot or
unverified diff is not trusted review evidence. Document-specific viewers can
remain optional. The initial signer needs a manifest renderer, not a full
document editor. Any change to the approved statement invalidates approval and
requires a fresh review.

## 6. Caller verification through the broker

Reuse exact origin/window checks, private channels, bounded startup waits,
cancellation and result correlation from the managed-app mechanism. Extend
only the missing signing-specific contract.

For a direct connection, establish caller origin from browser-authenticated
message metadata and the expected window. Validate source and origin before
accepting a port; bind the resulting channel to that verified context.
MessagePort payloads do not independently prove the original sender's origin.

For a brokered connection, the signer directly observes the broker. A
caller-origin field inside a routed request is therefore an assertion by the
broker, not a browser proof of the original application's origin. Choose one
of these explicit models before implementation:

- Trust a user-selected broker to attest its verified caller context and bind
  that context to an invocation, channel, provider and request digest.
- Establish an additional direct, origin-verified caller-to-signer exchange
  for caller-specific signing policy.

The initial implementation may use the first model with a deliberately trusted
Workbench broker. Do not extend that trust to arbitrary relays or app-supplied
claims. If the broker shares an origin with untrusted apps, regard that whole
origin as the principal for grants; its in-page app distinctions are not a
strong isolation mechanism.

Provider attachment must be limited to the selected origin and expected window,
with single-use invocation binding. Do not send the manifest to a window that
has navigated to another origin. A redirect to a different provider origin
requires new validation and user acceptance.

## 7. Proposed sign-change contract

The capability URI is provisional:

```text
https://vocab.muze.nl/capabilities/sign-change
```

Its operation is: **validate and, if authorised, produce evidence signing this
specified change under an identified key and authority**. It does not publish
the change, timestamp it or certify that its substantive content is true.

### Request

| Field group | Required meaning |
| --- | --- |
| Invocation | Unique capability call ID, contract version and response correlation |
| Identity | Requested actor/WebID and intended signing purpose; no private keys or caller tokens |
| Change | The complete immutable change statement from the provenance profile |
| Destination | Pod/service, versioned root and intended audience |
| Concurrency | Base commit and applicable precondition bound into the signed statement |
| Payloads | Operation targets, media types and digests of exact content |
| Publication identity | Stable commit request ID for server retry/idempotency handling |
| Evidence policy | Accepted proof profiles and required verification properties |
| Authority | Explicit-approval mode or reference to a signer-recognised bounded grant |

Keep invocation identity and commit request identity distinct. Reopening a
signing UI is not necessarily a new commit, and replaying an accepted commit
must not execute it again.

Use Turtle for the durable statement and provenance records. The existing
message transport may carry an envelope containing Turtle text and small
control fields; that does not require changing the whole broker protocol.
Final RDF shapes and wire envelopes must be specified and validated before
implementation. Preserve meaning and dataset boundaries rather than storing
opaque JSON as the durable provenance model.

Large file contents stay outside the control message. Bind them with digests;
use a separately authorised content-access path when the signer needs to inspect
them. A mutable manifest URI is insufficient: bind its expected digest and
verify it before review. Never fetch arbitrary caller-supplied URLs with broad
signer credentials.

### Small signing core, manifest-aware approval

**Standards alignment (research snapshot 2026-11-08):** evaluate W3C
[Data Integrity](https://www.w3.org/TR/vc-data-integrity/) with
[eddsa-rdfc-2022](https://www.w3.org/TR/vc-di-eddsa/) before defining a bespoke
envelope. That suite specifies canonicalisation, hashing of the document and
proof configuration, and signing. The conceptual diagram below expresses
required coverage; it is not a competing wire format. When using a standard
suite, follow its exact construction and test vectors. Keep WebAuthn proof
processing distinct rather than claiming it implements the EdDSA suite.

Reuse [Controlled Identifiers](https://www.w3.org/TR/cid-1.0/) for verification
methods and permitted key uses. Investigate
[SAI's Authorization Agent](https://solidproject.org/TR/sai#authorization-agent)
for compatible identity/discovery conventions. SAI manages access decisions;
it does not already define our signing capability or make an access grant a
signing grant. Provider routing, pod permissions and signing approval remain
separate. Avoid creating parallel discovery terms where an existing mechanism
fits, while retaining replaceable user-selected providers.

The cryptographic backend can sign a small commitment without receiving document
contents. The public sign-change capability must nevertheless receive the
complete manifest, inline or through an integrity-checked reference, so the
provider can validate scope and generate its own approval screen. A digest-only
request is not an acceptable fallback for potentially untrusted applications.
Any future digest-only interface requires a separate, explicitly trusted caller
policy and must not claim independent review of the change.

The proposed commitment construction is:

```text
exact resource bytes → content digests
complete change manifest containing those digests → canonical RDF → manifest digest
purpose + profile version + hash algorithm + manifest digest → signed envelope
```

Use RDFC-1.0 for canonicalising the manifest dataset, then SHA-256 as the initial
manifest digest algorithm. Before implementation, define the Turtle parsing
profile, base-IRI resolution, allowed dataset boundary, UTF-8 canonical output,
digest encoding and resource limits. Canonicalise the complete approved manifest,
excluding its detached proof. Preserve the manifest and verification material.
Hash exact resource bytes separately, including RDF document bytes when exact
file-version integrity is intended; manifest canonicalisation does not imply
normalising every resource's contents.

Bind author, destination, operation targets and types, content digests and media
types, base revision/preconditions, commit message and stable request identity
into the manifest. A signature over a document hash alone does not bind where
or how that document may be used.

The envelope binds the commitment to its signing purpose and algorithm/profile.
Its precise encoding and signature suite remain protocol work: do not implement
the diagram as ad hoc string concatenation or assume all algorithms accept a
prehashed input. The provider computes the manifest digest itself, compares any
caller-supplied digest and signs only the commitment associated with the approved
snapshot. A remote cryptographic backend may receive only that envelope under
the provider's authenticated authority.

For WebAuthn, bind the commitment into the challenge and retain the complete
assertion as described in section 9; do not present it as a conventional detached
signature over a bare hash. A result must identify the verification key and proof
profile and retain all additional material that profile needs.

To establish that the signature existed by an attested time, timestamp a defined
encoding of the resulting signed envelope including its signature/proof. A
timestamp over only the content or manifest digest establishes existence of
that commitment, not existence of the later signature. Timestamping remains a
separate service and does not establish human review or successful publication.

### Result

Return the exact signed statement or its unambiguous integrity reference, proof,
verification-method identifier, actor, proof profile and approval/grant evidence.
Bind the result to the original request and destination. The caller verifies
that all requested signed fields and policy requirements match before using it.
The pod independently performs its own verification and authorisation checks.

Return defined failures for cancellation, denial, malformed changes, unsupported
proof profiles, unavailable keys, expired grants, unverified caller context and
disconnection. A successful capability result means a signature was produced;
it does not mean that the pod accepted the change.

No general-purpose `sign arbitrary bytes/hash` API is exposed through this
capability. An internal signer backend may offer such a primitive, but the
provider's public policy boundary remains the typed change operation.

## 8. Signing flow and lifecycle

1. The requesting app preserves its working copy and freezes the proposed
   change statement, including content digests and commit request identity.
2. Resolve the user's selected provider and verify compatible contract/proof
   profiles. Missing compatibility is a visible failure, not a downgrade.
3. Open or focus the provider from the user's action. Establish the verified
   connection and deliver the request through the chosen caller-trust model.
4. The provider validates the manifest, caller, key relationship and signing
   policy, computes its commitment, then renders a readable review from that
   same manifest or applies an existing bounded grant.
5. After approval, the provider signs the commitment to the frozen statement
   and returns the evidence. The statement cannot change beneath the review.
6. The caller verifies the result and submits the commit through its own Solid
   session. The signer need not hold pod write credentials.
7. The pod validates the proof and current permissions, publishes atomically,
   and supplies the receipt described in the provenance design.
8. Timestamping and subsequent verification proceed separately.

If the user edits the proposal while approval is open, cancel or invalidate
that approval. Do not sign a different draft beneath the displayed review.
A stale base or changed destination requires a new statement and signature.

Transient signing tasks and invocation secrets are excluded from remotely saved
workspace checkpoints. Closing an approval window cancels pending work where
possible, but cannot erase an already delivered signature. Explain that
cancelling after signing does not guarantee that a submitter cannot use an
otherwise valid proof; submission-time policy and expiry still apply.

A transport timeout is not evidence that no signature was produced. Define
whether the provider supports outcome lookup or a safely repeated signing
request. Regardless of proof retries, the pod's durable request identity must
prevent duplicate execution. Preserve the caller's drafts and any acquired
evidence through errors.

## 9. WebAuthn-based first provider

A separate-origin web signer using WebAuthn is a candidate first implementation,
not a mandatory backend for the capability. It avoids requiring every user to
install a browser extension and keeps the credential private key outside the
requesting application's JavaScript access.

WebAuthn signs its own structured assertion, including authenticator data and
client-data binding, rather than directly returning a conventional detached
signature over Turtle. Define a proof profile that binds a fresh nonce and a
domain-separated commit commitment into the challenge. Preserve the full
assertion and challenge construction needed for independent verification.

Verify the expected origin, RP ID, challenge, public key, user-presence flags
and required user-verification properties. Enrolment must establish how the
credential public key is associated with the WebID. A caller-supplied WebID
is not sufficient evidence of that association.

The passkey prompt establishes the ceremony's presence/verification properties;
it does not display or establish understanding of the document. The provider's
review interface remains necessary. Passkeys can also have different backup
and synchronisation properties; do not claim all credentials are bound to one
physical device or hardware authenticator.

An alternative provider may use WebAuthn to approve access to a separate signing
key. In that case, document both the approval evidence and the actual content
signature, including who can invoke the separate key. WebAuthn login alone must
not imply approval of every later signature.

## 10. Bounded signing sessions

Explicit approval per commit is the initial workflow. Repeated ordinary saves
may later use an explicitly granted bounded session to avoid a confirmation
for every small change.

A grant should constrain:

- Actor/principal and permitted signing purpose.
- Verified requesting origin, and stronger application identity only when
  a mechanism actually establishes it.
- Destination root, allowed resource scope and operation types.
- Lifetime and any usage limits.
- The provider-held session key and grant identity.
- Revocation and submission-time validation rules.

The session private key remains in the signing provider or its protected
backend. It is not passed to the requesting app. The provider checks every
request against the grant, and the pod verifies the relevant authority evidence
and current access rights before execution.

Provenance distinguishes “approved this exact change” from “signed under this
authorised session.” An agent or app acting under delegation is not relabelled
as a human who personally reviewed its output.

Revoking a grant stops future authorised use under the defined policy; it does
not erase previously created signatures. Define what happens to signed but
not yet submitted changes. This requires explicit expiry/status semantics and
must not depend solely on the app voluntarily discarding a proof.

## 11. Provider change and key migration

Changing the preferred provider affects future routing. It does not rewrite
historical proofs, automatically grant a new key authority, or migrate private
material.

For a new provider:

1. Confirm its app/launch identity, origin and supported contract.
2. Enrol or select the intended key through a verified binding workflow.
3. Record the key relationship and any continuity/rotation evidence.
4. Set the provider preference explicitly and invalidate obsolete routing or
   signing grants as appropriate.
5. Retain historical public-key and lifecycle material for old signatures.

WebAuthn credentials are scoped to an RP ID. Moving to an unrelated signing
domain generally requires a new credential and key transition; changing the
app URL alone does not migrate the passkey. Moving an implementation within
the same allowed RP arrangement is a different case and needs its own checks.

Provider replacement may use a new key even for the same WebID. Public identity
continuity comes from preserved binding/rotation evidence, not from pretending
the old signature was made by the replacement service.

Do not make key export a prerequisite for decentralisation. Users must be able
to change provider and retain verifiable historical evidence through explicit
key transition and recovery mechanisms.

## 12. Workbench integration scope

The reviewed Workbench revision already has capability routing, private
MessagePorts, provider presentation, lifecycle guards and task cancellation.
Its current embedded providers are explicitly mapped Files and Profile apps.
A general persistent user-selected provider registry remains design work.

Implementation therefore needs:

- The general provider-registry selection slice, reused by sign-change.
- A compatible app description with a validated launch URL and contract profiles.
- Signing-specific top-level presentation and caller-context validation.
- Typed request/result validation, canonical commitment construction and a
  verifier for supported proof profiles.
- A signer-owned manifest renderer with readable operations, verified caller
  context, honest review scope and optional integrity-checked content previews.
- Key enrolment/selection and bounded signing policy in the provider.
- Provenance-aware commit integration and status feedback in requesting apps.

Do not turn Launcher into a mandatory central signing service. A standalone
app should be able to discover the selected provider and invoke a compatible
direct flow without a running Workbench, once that invocation contract is
defined. The app can still depend on an available signer when publication
requires signatures; private draft preservation remains available offline.

Keep credentials, key handles and live grants outside pod-saved workspace
state. A portable provider preference is configuration, not a portable bearer
authorisation. Users may need to enrol the new device or reconnect explicitly.

## 13. Implementation sequence and evidence

**Refresh the research when implementation starts.** Follow the dated reuse
matrix and kickoff checklist in
[the provenance design](solid-provenance-signatures-and-attestation.md#161-standards-alignment-and-implementation-time-research-refresh).
Recheck standards/errata, Solid/LWS work, SAI, Dokieli and available proof
libraries; record exact versions and adopt/adapt/defer decisions. Test the
Turtle-to-Data-Integrity mapping against an independent implementation before
freezing a proof profile. Build the first working slice without waiting for
external discussions or endorsement; outreach can follow concrete findings.

| Phase | Deliverable | Evidence |
| --- | --- | --- |
| 1. Contracts | Registry selection, sign-change shapes, caller-trust model and proof profiles | Independent review of discovery, identity and authority boundaries |
| 2. Provider invocation | User-selected provider at a separate origin; top-level approval and cancellation | No hardcoded signer; origin/window checks; popup and navigation failures preserve drafts |
| 3. Signed commit slice | One key, one proof profile, explicit approval and pod verification | Exact approved manifest is signed; tampered content/context rejected |
| 4. Recovery and migration | Interrupted requests, key transition and historical verification | No duplicate execution; old evidence survives provider replacement |
| 5. Additional backends | Extension/wallet/remote signer or bounded session support | Same capability semantics with explicit proof and authority differences |

The first acceptance scenario uses two distinct application origins and a
separate signer origin. The user selects the provider, signs a commit from one
app, then requests the same capability from the other without sharing private
keys or hardcoding the provider. The pod verifies the proof, authorisation and
request identity before accepting the change.

Negative and recovery cases must cover:

- An app inventing another caller's origin or claiming a different WebID.
- Same-origin app paths being treated as if they were isolated principals.
- An untrusted broker relaying forged caller context.
- A provider window navigating, redirecting or being replaced before delivery.
- A different manifest being signed than the one reviewed.
- A supplied digest disagreeing with the provider's canonical manifest digest.
- Caller HTML, misleading labels or summaries attempting to replace trusted
  operation details; large commits hiding deletions or omitting operations.
- Unsupported operations/versions or ambiguous manifests being approved anyway.
- A preview differing from the committed content, or a diff using another base.
- Opaque digests presented as if the document itself was reviewed.
- A key or provider change through modified preferences without enrolment.
- Unsupported proof profiles, incorrect RP/origin bindings and stale challenges.
- Grant scope/expiry violations and replay against another root.
- Cancellation, dropped responses and a signed request whose commit outcome is
  initially unknown.
- Provider unavailability, offline drafts and failed workspace restoration.
- Keyboard operation, visible provider identity and accurate approval wording.

Follow the repository's Spiral workflow for implementation. Passing fixtures
are evidence for specific contracts, not proof of complete signer security or
human acceptance. This document does not start an implementation cycle.

## 14. Decisions still to settle

1. Final registry schema, app description and launch URL binding, reusing the
   capability roadmap rather than defining a signing-only registry.
2. Exact request/result RDF shapes, canonicalisation input profile, signed
   envelope encoding and version negotiation.
3. Trusted-broker versus direct caller-verification flow for the first provider.
4. Initial proof suite and WebAuthn enrolment/challenge profile if selected.
5. Optional content-preview formats and authenticated access for detailed review;
   signer-owned human-friendly manifest review is required for explicit approval.
6. Provider-side request recovery and pod-side idempotency interaction.
7. Historical key binding, recovery and provider migration UX.
8. Bounded-grant enforcement, revocation and already-signed submissions.

The stable architectural decision is the capability boundary: applications ask
the user's selected signer to approve and sign a defined change; they do not
receive private keys or assume that routing grants signing authority.

## 15. References

Relative links assume this file and its companions are in Workbench's `design/`
folder.

### Project designs

- [Versioned documents and knowledge bases](solid-documents-knowledge-base-versioning.md)
- [Provenance, signatures and attestation](solid-provenance-signatures-and-attestation.md)
- [Capability broker roadmap](solid-capability-broker-roadmap.md)
- [Profile editing capability](solid-profile-editing-capability.md)
- [Application launch context](solid-app-launch-context.md)
- [Native workspace state](solid-native-workspace-state.md)
- [Engineering rules](../AGENTS.md)

### Existing building blocks and precedents

- [RDF Dataset Canonicalization](https://www.w3.org/TR/rdf-canon/): RDFC-1.0
  canonical dataset representation for the manifest commitment.
- [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161): digest-based timestamping
  as a precedent; timestamping the signed envelope binds evidence of signature
  existence, without exposing the underlying document to the timestamp service.
- [WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/): origin/RP-scoped
  credentials, challenge binding and assertion verification.
- [Web Cryptography](https://www.w3.org/TR/webcrypto/): key handles, extractability
  and browser-origin security considerations.
- [Solid-OIDC](https://solidproject.org/TR/oidc): authentication and DPoP,
  distinct from long-lived content-signing authority.
- [Nostr NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md): an
  existing extension-mediated signing interface for Nostr events; a precedent,
  not a drop-in Solid commit contract.
- [Cloud Signature Consortium API](https://cloudsignatureconsortium.org/resources/csc-api-v2-2/):
  remote-signing interoperability for a possible provider backend.
- [OpenID for Verifiable Presentations](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html):
  wallet interaction and transaction-data binding for potential future integration.

These mechanisms provide reusable pieces. Their availability does not establish
that any existing provider implements this proposed capability or the required
Solid/WebID signing semantics.
