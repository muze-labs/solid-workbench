# Social Bookmarks for Solid Workbench

Design proposal · revised 20 November 2026

Save a link or a place in a PDF, add a note about why it matters, and choose who can read it. The same bookmark can appear in a personal log, under a shared tag, in a person's bookmark feed, or in the PDF reader. Each view keeps the author's words, the original target and the date of saving together.

## Saving and sharing

Saving requires only a target. Give each new bookmark a stable identity, its owner and the time it was saved. Keep that time when the owner edits its title, tags, summary, note or audience. A **summary** describes the material. A **note** records the owner's reason for saving it. Both are optional and can appear together.

I can keep bookmarks private, share them with selected people, or publish them. Private is the proposed default for a new personal collection. Show the effective audience when saving, especially when saving to a public or shared collection. Tags, notes and summaries travel with the bookmark under the same access rules. I should be able to see exactly which text will appear before making it public.

Store the collection and its bookmarks on the owner's Solid pod. Group records by audience where they share a storage resource. Public lists, feeds and tag counts must be generated from public data alone. Following someone gives me a convenient way to browse what they publish or have shared with me. For a restricted collection I need the owner's grant. Sharing a bookmark to a restricted PDF or web page leaves access to the target under its own owner's control.

## Following people and browsing by tag

From someone's collection I can browse their readable bookmarks, subscribe to the collection, or follow its chronological bookmark feed. A collection subscription includes its existing history. Following the feed brings that person's saves into my feed overview. The app can offer the two actions together and let me choose whether a collection I browse also contributes updates. Unfollowing changes my subscriptions. Bookmarks I explicitly saved myself remain mine.

Selecting a tag shows my bookmarks and matching bookmarks from the collections I follow. I can narrow the result to one person or collection. Start with case-insensitive matching of trimmed tag labels and preserve the spelling each author used. Suggested synonyms and translations need a person's decision before they combine topics.

For example, if Ben and I both tag bookmarks **Solid**, that tag opens one list. If we save different articles, both appear. If we save the same article, the list may group it once and show each person's note, tags and save date underneath. Each save still has its own identity. Two places within the same PDF remain distinct targets. My personal log and each author's feed retain the individual saves.

## Reading feeds and searching

| View | What it contains | How it is ordered |
| --- | --- | --- |
| My bookmark log | My own saves, including web pages, PDFs, places within PDFs and feed sources | Newest bookmark date first |
| A person's bookmark feed | That person's saves visible to the reader, with their accepted tags, summary and note | By bookmark date. Edits update the same entry |
| My feed overview | Updates from followed people and from sources I have bookmarked as feeds | By source entry date, with first-seen time identified when the source supplies no date |

A feed source is itself a bookmark. Saving an RSS or Atom feed adds the source to my bookmark log and its entries to my feed overview. A newsletter with a feed or accessible issue archive can work the same way. Hacker News and Reddit can supply streams through a supported site feed or source adapter. Keep the source and original link visible on each entry. An email-only newsletter needs a separately configured delivery route. Until one exists, its bookmark can open the newsletter and show that updates are unavailable. Keep personal subscription URLs and access tokens private.

Reading or refreshing a feed adds no items to my bookmark log. If I save an issue, story or another person's bookmark, I create my own bookmark with today's save time and a reference to its source. Refreshing a feed must recognise entries already seen. Show when a source last refreshed successfully so a temporarily unavailable source is distinguishable from a quiet one.

Search supports **tag, target domain, bookmark date or date range, and words in the saved note or summary**. Combine filters and show the active scope, such as my collection, followed collections or bookmarks in this PDF. Domain means the bookmarked target's host, including when a story was discovered on Hacker News. A local PDF has no domain. An all-collections search includes only records the reader may see. Search results, snippets and tag counts follow the same access rules as opening the collection.

## PDF bookmarks belong to the same collection

The current Documents reader already offers bookmarks within the open PDF and across all PDFs. Each saved place has an ID, document reference, optional label, page, position within that page and a fingerprint of the document contents. These records are currently scoped to the account and device. The stored bookmark has no creation timestamp. [Reader state](https://github.com/muze-labs/solid-workbench/blob/6e61f15d07252b7e4e287103972b70e43eba1b7d/apps/documents/src/reader-state.mjs) · [Bookmark navigation](https://github.com/muze-labs/solid-workbench/blob/6e61f15d07252b7e4e287103972b70e43eba1b7d/apps/documents/src/navigation.mjs)

Use one logical bookmark across both apps. Saving a place in the reader makes it available in Social Bookmarks. Editing its note or tags from either app updates that bookmark. The reader keeps its document-order view for **this PDF** and its **all PDFs** view. Social Bookmarks adds chronological, tag, author and search views over those same records. The viewer owns capturing and reopening positions. Only an intentional bookmark enters the collection. Reading progress, the PDF's own outline and ordinary annotations stay in their existing roles.

Opening a saved place returns to the recorded page and position in the matching document. If the fingerprint differs, preserve the original place and let the reader open the changed PDF or explicitly select a replacement position. A local-only PDF may need to be reopened on the original device. Sharing its bookmark must never upload the PDF as a side effect.

Bring existing reader bookmarks into the owner's private collection by preserving their IDs, labels and complete positions. Repeat imports recognise the same IDs. Keep the original save date unknown where it was never recorded. An import date can explain when a bookmark arrived. Existing account-local bookmarks should remain available until their transfer is confirmed. Removing an owned bookmark affects every view of that record and leaves the PDF intact.

## Importing a browser collection

Start with a user-selected bookmarks HTML export. Firefox and Chrome both export this format. Test each additional browser against a real export before listing it as supported. Parse the file locally as inert data, with scripts, icons and external requests disabled. The preview shows the source, destination, number of saves, missing dates and possible duplicates. Default to a private collection. Choosing **Import** only saves bookmark records. [Firefox export](https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer) · [Chrome export](https://support.google.com/chrome/answer/96816)

Keep the exact target including query and fragment, original title, folder path, exported tags and description when present, source profile label, and valid original save date (for example `ADD_DATE`). Record import time separately. Keep source folder paths private as provenance, including when a bookmark is published. A bookmarklet or local-file reference can be retained as inert text and counted separately in the preview.

Open the collection newest saved first. Put undated items under **Date unknown**, retaining source order there. Allow a separate “recently imported” view. An old link imported today belongs at its historical date. Editing, classifying, checking or summarizing it leaves that date intact.

Use stable source identifiers where available. For HTML without identifiers, remember the import file digest and the occurrence within that export so a retried import can resume without duplicating records. Across later exports from the same profile, match unambiguous occurrences using original target, save time and source metadata. Show ambiguous matches for review and preserve deliberate repeated saves. Match PDF positions and URL fragments exactly. Missing items in a later export have no effect on earlier imports.

## Organizing a collection with AI

Offer **Suggest topics** immediately after import or on any selection. It works from the saved title, target and any expressly selected description or retrieved page text. Exclude source folders, imported tags and existing category assignments from the inference inputs. Keep the old organization browsable through a source-folder filter. This allows a link saved under “To read” and one under “Client work” to appear together under “Digital identity”.

Run a first pass in batches to propose specific tags for each bookmark, then consolidate similar suggestions across the collection. Present a small number of broader categories grouping those tags. Categories are optional views over the same records. A bookmark can appear in several, and the user can rename, combine or split them. Match proposed labels to the user's accepted vocabulary during review. Keep user-applied tags and remember dismissed suggestions so another run does not keep proposing the same change for unchanged inputs.

Make the review scale to an entire browser archive. A suggestion such as **Digital identity · 47 bookmarks** opens its proposed members, with enough title, domain and sample content to judge them. Accept the group, remove exceptions, rename it or dismiss it. The proposed organization is immediately browsable as a private preview. Applying a batch is undoable. Keep suggestions and processing status private until the owner chooses which tags or summary to save and share under the existing audience rules.

## Checking links and summarizing current content

Offer **Check links** and **Check and suggest summaries** for a selection or collection. Scope a crawl to the bookmarked targets and their redirects. Leave these actions off at import. Before a run, show the number of eligible targets, the retrieval provider and, when summaries are requested, the AI provider. The reader can pause, resume or cancel. Reuse recent results within the same privacy scope, limit concurrent requests per site and back off when a site asks the checker to retry later.

| Result | What the owner sees |
| --- | --- |
| Reachable | Check time, final URL and content type. A redirect keeps the originally saved target available. |
| Missing | The site returned 404 or 410. Keep the bookmark, original note and previous successful check. |
| Restricted or inconclusive | Login, paywall, bot challenge, unreadable response or insufficient evidence. Offer to open manually. |
| Temporary failure | Timeout, rate limit or server error. Keep the prior result and allow a retry. |

A browser can read some cross-origin pages directly. Where browser policy blocks inspection, offer a user-selected retrieval service, potentially an extension of the Launcher's metadata provider. A browser fetch failure alone cannot establish that a page is missing. A hosted checker should fetch only permitted public HTTP(S) targets, check destinations again on redirect and send no browser cookies or Solid credentials. Exclude private-network targets, secret feed links and private documents from ordinary bulk checks. [Browser cross-origin access](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

For a readable page, extract the main text and draft one or two sentences describing what is there **as of the check date**. Record the retrieved URL, timestamp and a content fingerprint. Give the owner a preview and the option to adopt it as the bookmark summary. Keep their original note and previously accepted summary intact until they choose a replacement. Skip generation for a login screen, empty response, or unsupported format. If later content differs substantially, flag it for review. For a PDF position, checking the document URL establishes reachability only. The reader still checks the fingerprint and position before claiming the saved passage matches.

## Optional AI assistance

When enabled, AI can suggest tags automatically on save and draft a summary or note. The owner can accept, edit or dismiss each suggestion, or save immediately and review later. Only accepted text and tags enter the shared bookmark, feed or merged tag view. A later suggestion cannot overwrite the author's work.

Show what would be sent to the selected AI provider before using private notes, restricted documents or PDF excerpts. The user can choose the input, use a local provider where available, or write everything manually. Saving, sharing, following and searching all work without AI.

## First implementation slice

Prove the shared record with an ordinary web link and two different places in one PDF. Save and reopen them from both apps, change a note, and import the existing reader bookmarks twice. Check that the two positions survive, the edit appears in both apps and the second import creates no duplicates.

Then use two accounts to verify the social flow. Publish one bookmark, share another with one reader, and keep a third private under the same tag. Check the merged tag view, author feed, search results and counts as the owner, invited reader and public visitor. After revocation, refreshed views must drop restricted entries. Readers may already have kept their own copies.

One feed source and manual tagging are enough to exercise the full reading-to-bookmark flow. Additional source adapters and optional AI review can build on the same model. The physical grouping of bookmark records on the pod and the delivery mechanism for email-only newsletters remain open implementation decisions.

For browser import, use Firefox and Chrome fixtures containing a dated item, an undated item, repeated targets, different fragments and nested folders. Import each twice and verify the counts, chronology and private audience. Run topic suggestions on equivalent records with different source folder names and verify the classifier receives the same inputs. Review and undo a batch. Exercise the checker against a readable page, redirect, missing page, login screen and temporary failure. A rerun after page content changes must preserve the owner's note, original target and save date.
