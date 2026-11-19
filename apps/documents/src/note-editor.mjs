import '@muze-labs/solid-app-data/simply-runtime.mjs';
import {
  edit,
  fragmentFromHtml,
  createLinkAnnotationTag
} from '@muze-labs/cobalt-rich-text-note';
import { validateFragment } from '@muze-labs/solid-app-data/cobalt-fragment.mjs';
import { cobaltBody } from '@muze-labs/solid-app-data/cobalt-html.mjs';

export function openNoteEditor(surface, html, fragment) {
  const state = simply.signal(
    fragment === undefined ? fragmentFromHtml(html) : validateFragment(fragment)
  );
  const editor = edit(surface, state);
  return {
    editor,
    createLinkAnnotationTag,
    body: () => cobaltBody(editor.getValue())
  };
}
