# Static Workbench app catalog

Workbench's **Add apps** opens a category list/details dialog. Choose a
category (or All apps), search, then choose **Add app**. Adding closes the dialog;
launch the app from your saved shortcuts. **More info** opens longer text and an
optional screenshot within the dialog. **Add a link manually** is an inline
category with the existing URL/manifest entry form. Draft fields survive closing
and reopening the dialog and failed saves; a successful add resets them. Adding the same launch URL twice leaves the existing shortcut and
its settings intact.

The build copies this folder to `www/catalog/`. It needs only static HTTP
hosting with `.ttl` served as `text/turtle`. The default index is relative to the
Workbench deployment. Under **Catalog sources**, add any independently hosted
index URL; cross-origin hosts must permit browser reads through CORS. Multiple
sources are supported. Refresh is explicit after the first opening; it never
changes an existing shortcut automatically. Duplicate listings can appear from
multiple sources, while duplicate shortcut creation is prevented by launch URL.

Source choices and last successful indexes/manifests are native Turtle in
Solid Workspace's IndexedDB source, scoped to the selected account on this
device. A failed refresh retains a saved listing. A manifest already read
successfully can be reused after a failed read; adding an app whose manifest has
never been loaded needs a connection. Installing an app's code or caching its
resources for offline use is outside this catalog. Added shortcuts use the
existing local collection and its separate Solid synchronization workflow.
Removing a source removes its listings, never the shortcuts added from it.

## Add an app to a catalog

Add an entry to `index.ttl`:

```turtle
@prefix schema: <https://schema.org/> .
<> schema:hasPart <#example> .
<#example> a schema:SoftwareApplication ;
    schema:name "Example" ;
    schema:applicationCategory "Productivity" ;
    schema:text "Longer plain text shown by More info." ;
    schema:screenshot <screenshots/example.png> ;
    schema:description "A short description of its purpose." ;
    schema:image <example.svg> ;
    schema:subjectOf <example.ttl> .
```

The index document itself owns `schema:hasPart`. Each linked entry needs one
plain string name, an HTTP(S) image and an HTTP(S) manifest link. Description is
optional. Relative IRIs resolve against the index URL. Unrecognized predicates
are ignored by the projection and retained in the cached native graph.

Create `example.ttl`:

```turtle
@prefix schema: <https://schema.org/> .
@prefix apps: <https://vocab.muze.nl/solid-apps#> .
<> a schema:SoftwareApplication ;
    schema:name "Example" ;
    schema:url <https://example.org/app/> ;
    schema:image <example.svg> ;
    apps:anonymousLaunch true .
```

A manifest describes exactly one application. Its launch URL and image resolve
against the manifest URL. Set `apps:anonymousLaunch true` for an ordinary
external app: it opens without Workbench launch context and handles its own
sign-in. A suite-compatible app may declare supported capabilities using the
existing manifest vocabulary. Listing an app never grants permissions or
establishes capability compatibility. Icons and names do not confer authority.

Suite catalog manifests mirror their app-owned manifests with paths adjusted
for this folder. Keep their capability declarations aligned when changing apps.
The native browser regression checks that the catalog can add suite and ordinary
apps without depending on a live provider connection.

## Initial external entries

Reviewed on 2026-11-13:

- [Penny](https://penny.vincenttunru.com/) offers its own Connect Pod control and
  documents manually entering resource URLs. Its root is an ordinary launch URL.
- [Umai](https://umai.noeldemartin.com/) is the deployed app linked from its
  [maintainer's repository](https://github.com/NoelDeMartin/umai), described there
  as a local-first recipe manager. Its root is an ordinary launch URL.

These checks establish current endpoints and documented entry behavior, not
production OIDC certification. Neutral external-link artwork is supplied locally;
no external branding or broker support is claimed.

The catalog shape is an app-owned convention, not a general Solid standard.
Vocabulary semantics checked against Schema.org v30.1: [hasPart](https://schema.org/hasPart)
links constituent CreativeWorks; [subjectOf](https://schema.org/subjectOf) links
the application entry to its manifest description. Native RDF and the existing
Workbench manifest/launch contracts govern implementation.

## Categories and More info

This catalog profile optionally reads one plain-string `schema:applicationCategory`
and `schema:text`, plus one HTTP(S) `schema:screenshot` image URL. Missing category
falls under Other apps; missing long text falls back to the short description.
Screenshots are requested only when More info is opened and are not promised
available offline. The supplied Presenter screenshot uses example slide data.
These are static authoring fields in the catalog RDF, not a new editing service.

The optional fields use Schema.org v30.1 semantics: applicationCategory allows
Text/URL; this profile reads Text. screenshot allows URL/ImageObject; this profile
reads an image URL. text is plain content on CreativeWork, of which SoftwareApplication
is a subtype. Structured alternatives are not interpreted by this first profile;
the whole native graph, including unknown terms, remains in the cache. See
[applicationCategory](https://schema.org/applicationCategory),
[text](https://schema.org/text) and [screenshot](https://schema.org/screenshot).
