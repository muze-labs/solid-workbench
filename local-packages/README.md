# Temporary Cobalt build

The maintainer explicitly requested “I'll publish later, use a local build for
now” during Presenter cycle CYC-20261112-QG24H-175. This is a temporary exception
to the repository's published-dependency rule, not a general dependency policy.

`muze-labs-cobalt-rich-text-note-0.1.1.tgz` is the tested npm package from the
local `cobalt-note` branch `feature/rich-text-change-notification`. It contains
the authorized `cobalt:change` event, native composition correction and
`Editor.isComposing()` API. It has not been published. Both Presenter and Viewer
use this same immutable tarball through their package manifests and lockfile;
normal `npm install`/`npm ci` therefore retains the reviewed local build without
a sibling checkout or symlink.

SHA256: `e1055a7890c2c4d0a4fe1762024f26972f904f6ba4ed3b3f20c32e26958727d5`.
EVD-20261112-QG24H-179 records library, browser and integration verification.

After the maintainer publishes the corresponding package, install that npm
version in both app workspaces, update the lockfile, remove this tarball and
note, and rerun the relevant checks. Retain the composition guards and tests.
Do not silently fall back to published 0.1.0, which loses composition input.
