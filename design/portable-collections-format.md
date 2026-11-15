# Experimental portable collections, version 1

This is the monorepo's experimental collection format, introduced for Notebook
in CYC-20261114-QG24H-205. It is not a published interoperability standard.
A collection lists independently stored documents; it never contains their
content. Compatible readers can use the native RDF without running Notebook.

The namespace `col:` is `https://vocab.muze.nl/collections#`. Titles and change
instants use `http://purl.org/dc/terms/title` and `modified`. Record removal uses
`https://purl.org/pdsinterop/link-metadata#deleted`; on a collection Entry this
means membership removal, not a claim that the referenced file was deleted.

A file has exactly one named `col:Collection` with `col:version` integer 1,
`dcterms:title` string and `col:destination` named HTTP(S) folder ending in `/`.
Each named `col:Entry` belongs to that root through one `col:collection` reference.
It has one `col:document` HTTP(S) reference, optional cached `dcterms:title` and
`col:kind` strings, optional `col:managed` boolean (absent means false), and zero
or more named `col:group` references. `col:originalDocument` preserves the first
reference after permanent forwarding repair. A named `col:Group` belongs to the
same collection and has a title. Records have typed `dcterms:modified` timestamps;
the current merge policy resolves concurrent scalar edits by that timestamp.
Independent additions retain their distinct identities. This is not a history
or a cross-resource transaction protocol.

```turtle
@prefix col: <https://vocab.muze.nl/collections#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<#collection> a col:Collection;
    col:version 1;
    dcterms:title "Field notes";
    col:destination <../notes/>;
    dcterms:modified "2026-11-14T12:00:00Z"^^xsd:dateTime .
<#work> a col:Group; col:collection <#collection>;
    dcterms:title "Work" .
<#entry-one> a col:Entry; col:collection <#collection>;
    col:document <../notes/one.ttl>;
    dcterms:title "Meeting notes";
    col:kind "cobalt.notebook"; col:managed true; col:group <#work>;
    dcterms:modified "2026-11-14T12:00:00Z"^^xsd:dateTime .
```

Identity is stable; readers must not derive it from a display title or rebuild
records while sorting. Notebook creates deterministic entry identifiers from the
collection root and original document URI, and UUID group identifiers. Readers
must accept other stable named identifiers. Opening a file is distinct from
adding it; adding an existing file does not adopt its lifecycle. New drafts reserve
separate file URLs and remain locally recoverable before an explicit Pod save.

Ignore unknown predicates when projecting. Preserve the complete native graph
when editing, including unrelated subjects, unknown types, multiple values and
blank-node structures. Refuse unsupported versions, ambiguous interpreted scalar
fields or structured values that the editor cannot preserve. Never flatten them.
The current app overlays its editable fields onto StateGraph and delegates replica
merge/save ordering to Solid Workspace. The projection avoids a recursive writer
failure on unrelated cyclic blank nodes; it is not an alternate storage format.

Each app owns its default through `col:defaultCollection` on its named app subject
in the account's `pim:preferencesFile`. Notebook uses
`<urn:muze:solid-app:notebook>`. The generic Preferences app need not enumerate
apps to preserve these statements. A failed read never means "no default".
Account-scoped local caches retain a selected default and loaded collections.
A local col:pendingDefault named reference reserves the initial creation intent
before any remote write; it is never uploaded into the profile preference file.
Automatic publication only fills an absent default and does not replace a
concurrent choice. Without an explicit resource, Notebook displays the default
collection overview and creates a missing default in the first profile-advertised
storage folder. Access failure retains the known reference and cached listing.
`col:local-dirty` and `col:local-creating` are local collection-root recovery flags;
they are excluded from Pod writes and are not portable collection fields.

Notebook launch addresses keep the collection in the URL fragment's `resource`
parameter and an optional member in `document`, encoded with URLSearchParams.
`category` selects a category; `create=notebook` requests a new member within
that context. These are app launch parameters rather than RDF format fields.
Direct notebook resource addresses continue to open the file independently.
Changing collections does not change the account default.

Physical file operations use an account-scoped native RDF intent journal. Source,
target, collection and entry are named references; operation kind, stage, validators
and SHA-256 digests are scalars. Recorded steps distinguish preparation, copy,
verified copy, removal in progress, removed content, and metadata publication.
No JSON, content snapshots or assumed atomic multi-resource operation are used.
The source file is removed conditionally before its parent-description tombstone
or forwarding marker is published. Destination copies are verified first;
Turtle is parsed at its original base and written at the new base, preserving RDF
identity and relative reference meaning. Other file bytes are copied unchanged.
Unsupported validators/metadata, ambiguous forwarding, redirects on destructive
requests and changed files stop the operation visibly. Retry reconciles recorded
steps; cancellation before removal retains both files. Deletion has no recovery
copy. Existing per-device notebook drafts are retained and detached from a deleted
Pod URL so ordinary Save cannot revive it.

This implementation uses Solid Protocol 0.11.0 and the PDS Interop link-metadata
profile referenced in DES207. The latter's server forwarding/deletion semantics
are not universal Solid server behavior. Tests against disposable fixtures do not
certify a deployed Pod. Independent writes to the destination after verification
cannot be excluded by a conditional request to the source; no atomicity claim is
made. A server must expose usable metadata and strong validators for these physical
operations. Membership-only removal remains available without physical deletion.
