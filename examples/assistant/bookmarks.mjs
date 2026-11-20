import { app } from '@muze-labs/simplyflow/app';
import {
  literal,
  named,
  sameTerm,
  StateGraph
} from '../../packages/solid-app-data/src/state-rdf.mjs';
import { attachSidebarResize } from '../../packages/solid-app-ui/src/sidebar-resize.mjs';
import { capabilityError } from '../../packages/solid-app-data/src/capabilities.mjs';
import {
  offerPort,
  readBookmarkSelection,
  selectionFrom,
  suggestTopics
} from './protocol.mjs';

const assistantOrigin = document.querySelector(
  '[name="solid-assistant-origin"]'
).content;
const storageKey = 'solid-assistant-proof-bookmark-tags';
const tagPredicate = 'https://vocab.muze.nl/bookmarks#tag';
const hidden = { hidden: '' };
const visible = { hidden: null };
const container = document.querySelector('main');
const dock = container.querySelector('.solid-assistant-dock');
const readPermission = container.querySelector(
  '.solid-bookmarks-read-permission'
);
const frame = dock.querySelector('iframe');
const closeButton = dock.querySelector('button');
const fixture = [
  {
    id: 'urn:bookmark:identity',
    title: 'Digital identity',
    url: 'https://example.org/identity'
  },
  {
    id: 'urn:bookmark:gardens',
    title: 'City gardens',
    url: 'https://example.org/gardens'
  },
  {
    id: 'urn:bookmark:transit',
    title: 'Public transit maps',
    url: 'https://example.org/transit'
  }
];

let opener;
let panel;
let request;
let previousTags = [];
const mount = {
  data: {
    bookmarks: fixture.map((bookmark) => ({
      ...bookmark,
      selected: false,
      tagLabel: 'None'
    })),
    suggestions: [],
    status: '',
    panelStatus: '',
    assistantOrigin,
    frame: hidden,
    review: hidden,
    undo: hidden,
    width: {}
  },
  commands: {
    solidAssistantOpen(button) {
      openDock(this, button);
    },
    solidAssistantClose() {
      dismissDock();
    },
    solidAssistantAllowRead() {
      panel?.answerRead?.(true);
    },
    solidAssistantDenyRead() {
      panel?.answerRead?.(false);
    },
    async solidAssistantSuggest(button) {
      if (request) {
        return;
      }
      const bookmarks = this.data.bookmarks.filter(({ selected }) => selected);
      if (!bookmarks.length) {
        this.data.status = 'Select bookmarks to suggest topics.';
        return;
      }
      const selected = selectionFrom(bookmarks);
      this.data.review = hidden;
      this.data.suggestions = [];
      this.data.status = '';
      openDock(this, button);
      const controller = new AbortController();
      request = controller;
      panel.selection = selected;
      try {
        const connection = await panel.ready;
        const result = await connection.call(suggestTopics, selected, {
          signal: controller.signal
        });
        controller.signal.throwIfAborted();
        const names = new Map(selected.map(({ id, title }) => [id, title]));
        const proposals = validatedTopics(result, names);
        this.data.suggestions = proposals.map(({ id, tag }) => ({
          id,
          tag,
          label: names.get(id) + ' — ' + tag,
          accepted: true
        }));
        this.data.review = visible;
        this.data.status = 'Suggested tags are ready for review.';
        dismissDock();
      } catch (error) {
        if (controller.signal.aborted || error.code === 'cancelled') {
          this.data.status = 'Request cancelled.';
          if (dock.open) {
            dismissDock();
          }
        } else {
          readPermission.close();
          this.data.status = 'Assistant unavailable.';
          this.data.panelStatus = 'Assistant unavailable. Close and try again.';
        }
      } finally {
        controller.abort();
        request = undefined;
      }
    },
    async solidAssistantManualTag(form) {
      const tag = new FormData(form).get('tag').trim();
      const selected = this.data.bookmarks.filter(({ selected }) => selected);
      if (!tag || !selected.length) {
        this.data.status = 'Select bookmarks and enter a tag.';
        return;
      }
      await applyTags(
        this,
        selected.map(({ id }) => ({ id, tag }))
      );
      form.reset();
    },
    async solidAssistantApply() {
      await applyTags(
        this,
        this.data.suggestions.filter(({ accepted }) => accepted)
      );
      this.data.review = hidden;
      this.data.suggestions = [];
    },
    async solidAssistantUndo() {
      await changeTags(this, (graph) => {
        graph.quads = graph.quads.filter(
          (quad) =>
            !previousTags.some(
              ({ id, tag }) =>
                quad.subject.id === id &&
                quad.predicate.id === tagPredicate &&
                sameTerm(quad.object, literal(tag))
            )
        );
      });
      previousTags = [];
      this.data.undo = hidden;
      this.data.status = 'Tag changes undone.';
    }
  }
};

const view = app({
  container,
  components: { solidAssistantBookmarks: mount },
  onError(error) {
    this.data.status = error.message;
  }
});

function readTags() {
  return new StateGraph(localStorage.getItem(storageKey) || '');
}

function showTags(context, graph) {
  for (const bookmark of context.data.bookmarks) {
    const tags = graph.values(named(bookmark.id), tagPredicate, 'string');
    bookmark.tagLabel = tags.map(({ value }) => value).join(', ') || 'None';
  }
}

async function changeTags(context, change) {
  await navigator.locks.request(storageKey, () => {
    const graph = readTags();
    change(graph);
    localStorage.setItem(storageKey, graph.write());
    showTags(context, graph);
  });
}

async function applyTags(context, proposals) {
  const added = [];
  await changeTags(context, (graph) => {
    for (const { id, tag } of proposals) {
      const subject = named(id);
      if (
        graph
          .values(subject, tagPredicate)
          .some((term) => sameTerm(term, literal(tag)))
      ) {
        continue;
      }
      graph.add(subject, tagPredicate, literal(tag));
      added.push({ id, tag });
    }
  });
  if (added.length) {
    previousTags = added;
    context.data.undo = visible;
    context.data.status = 'Tags saved on this device.';
  }
}

function validatedTopics(result, names) {
  const seen = new Set();
  if (
    !Array.isArray(result) ||
    result.length > names.size ||
    result.some(({ id, tag }) => {
      const invalid =
        !names.has(id) ||
        seen.has(id) ||
        typeof tag !== 'string' ||
        !tag.trim() ||
        tag.length > 60;
      seen.add(id);
      return invalid;
    })
  ) {
    throw new Error('bookmarks: Invalid topic suggestions.');
  }
  return result;
}

async function readSelection(current, method, input, { signal }) {
  if (
    panel !== current ||
    !dock.open ||
    method !== readBookmarkSelection ||
    input !== null ||
    !current.selection ||
    !request ||
    request.signal.aborted
  ) {
    throw capabilityError('Bookmark read is unavailable.', 'denied');
  }
  if (current.answerRead) {
    throw capabilityError('Another selection read awaits a decision.', 'busy');
  }

  const stop = AbortSignal.any([signal, request.signal]);
  const cancelled = capabilityError('Selection read cancelled.', 'cancelled');
  if (stop.aborted) {
    throw cancelled;
  }
  let cancel;
  try {
    const allowed = await new Promise((resolve, reject) => {
      current.answerRead = resolve;
      cancel = () => reject(cancelled);
      stop.addEventListener('abort', cancel, { once: true });
      readPermission.showModal();
    });
    if (stop.aborted) {
      throw cancelled;
    }
    if (!allowed) {
      throw capabilityError('Bookmarks denied the selection read.', 'denied');
    }
    return current.selection.map(({ title, url }) => ({ title, url }));
  } finally {
    stop.removeEventListener('abort', cancel);
    current.answerRead = undefined;
    if (panel === current && dock.open) {
      readPermission.close();
      if (!stop.aborted) {
        frame.focus();
      }
    }
  }
}

function openDock(context, button) {
  if (dock.open) {
    return;
  }
  opener = button;
  dock.showModal();
  closeButton.focus();
  resize();
  context.data.panelStatus = 'Opening assistant…';
  const key = crypto.randomUUID();
  const address = new URL('/panel', assistantOrigin);
  address.hash = key;
  const current = {};
  panel = current;
  current.ready = new Promise((resolve, reject) => {
    const abort = () => reject(new Error('bookmarks: Assistant closed.'));
    current.abort = abort;
    current.timer = setTimeout(() => {
      context.data.panelStatus = 'Could not connect to the assistant.';
      window.removeEventListener('message', current.receive);
      abort();
    }, 8000);
    current.receive = (event) => {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== assistantOrigin ||
        event.data?.type !== 'solid-assistant:ready' ||
        event.data.key !== key ||
        current.connection
      ) {
        return;
      }
      clearTimeout(current.timer);
      context.data.panelStatus = '';
      current.connection = offerPort(
        frame.contentWindow,
        assistantOrigin,
        key,
        (method, input, options) =>
          readSelection(current, method, input, options)
      );
      resolve(current.connection);
    };
    window.addEventListener('message', current.receive);
  });
  current.ready.catch(() => {});
  context.data.frame = { src: address.href, hidden: null };
}

function dismissDock() {
  dock.close();
  closeDock();
}

function closeDock() {
  if (!panel) {
    return;
  }
  request?.abort();
  clearTimeout(panel.timer);
  window.removeEventListener('message', panel.receive);
  panel.abort();
  panel.connection?.close();
  panel = undefined;
  const returnTo = opener;
  function restoreFocus() {
    if (!dock.open && document.activeElement === document.body) {
      returnTo?.focus();
    }
  }
  frame.addEventListener('load', restoreFocus, { once: true });
  view.data.frame = { src: 'about:blank', hidden: '' };
  readPermission.close();
  returnTo?.focus();
  requestAnimationFrame(restoreFocus);
}

const resize = attachSidebarResize(
  dock,
  dock.querySelector('[role=separator]'),
  {
    bounds: () => ({ minimum: 320, maximum: Math.round(innerWidth * 0.7) }),
    onResize(width, min, max) {
      if (innerWidth >= 768) {
        dock.style.setProperty('--solid-assistant-width', width + 'px');
        view.data.width = {
          'aria-valuemin': min,
          'aria-valuemax': max,
          'aria-valuenow': width
        };
      }
    }
  }
);
dock.addEventListener('cancel', (event) => {
  event.preventDefault();
  dismissDock();
});
readPermission.addEventListener('cancel', (event) => {
  event.preventDefault();
  panel?.answerRead?.(false);
});
dock.addEventListener('close', () => {
  if (!dock.open) {
    closeDock();
  }
});
window.addEventListener('pagehide', closeDock);
showTags(view, readTags());
