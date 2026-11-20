import { app } from '@muze-labs/simplyflow/app';
import { capabilityError } from '../../packages/solid-app-data/src/capabilities.mjs';
import {
  acceptPort,
  readBookmarkSelection,
  selectionFrom,
  suggestTopics
} from './protocol.mjs';

const caller = document.querySelector(
  '[name="solid-assistant-caller"]'
).content;
const key = location.hash.slice(1);
const hidden = { hidden: '' };
const visible = { hidden: null };
let connection;
let request;

const view = app({
  container: document.querySelector('main'),
  components: {
    solidAssistantControl: {
      data: {
        caller,
        status: 'Select bookmarks and choose Suggest topics.',
        bookmarks: [],
        approve: hidden,
        revoke: hidden,
        selection: hidden,
        bookmarkCapability: hidden,
        returnSuggestions: hidden,
        readStatus: '',
        readBookmarks: []
      },
      commands: {
        solidAssistantApprove() {
          if (request && !request.approved && !request.signal.aborted) {
            request.approved = true;
            this.data.approve = hidden;
            this.data.selection = hidden;
            this.data.status = 'Generating suggestions…';
            // Correlation IDs stay in the assistant. The mock sees only
            // the fields listed in the approval screen.
            const input = request.bookmarks.map(({ title, url }) => ({
              title,
              url
            }));
            const current = request;
            mockTopics(input, current.signal)
              .then((tags) => {
                current.signal.throwIfAborted();
                current.suggestions = current.bookmarks.map(
                  ({ id }, index) => ({
                    id,
                    tag: tags[index]
                  })
                );
                this.data.status = 'Topic suggestions are ready.';
                this.data.bookmarkCapability = visible;
                this.data.returnSuggestions = visible;
              })
              .catch(current.reject);
          }
        },
        solidAssistantReturnSuggestions() {
          if (request?.suggestions && !request.signal.aborted) {
            request.resolve(request.suggestions);
          }
        },
        async solidAssistantReadSelection() {
          const current = request;
          if (
            !current?.suggestions ||
            current.reading ||
            current.signal.aborted
          ) {
            return;
          }
          current.reading = true;
          this.data.readStatus = 'Waiting for permission in Social Bookmarks…';
          this.data.readBookmarks = [];
          try {
            await this.binding.whenIdle();
            current.signal.throwIfAborted();
            const records = await connection.call(readBookmarkSelection, null, {
              signal: current.signal
            });
            current.signal.throwIfAborted();
            this.data.readBookmarks = records;
            this.data.readStatus =
              'Selection received. The one-time grant was used.';
          } catch (error) {
            if (!current.signal.aborted) {
              this.data.readStatus =
                error.code === 'denied'
                  ? 'Social Bookmarks denied the selection read.'
                  : 'The selection could not be read.';
            }
          } finally {
            current.reading = false;
          }
        },
        solidAssistantRevoke() {
          request?.revocation.abort();
        }
      }
    }
  }
});

function handle(method, input, { signal }) {
  if (method !== suggestTopics || request) {
    throw capabilityError('Request is unavailable.', 'denied');
  }
  const bookmarks = selectionFrom(input);
  const revocation = new AbortController();
  const stop = AbortSignal.any([signal, revocation.signal]);
  view.data.bookmarks = bookmarks;
  view.data.status = 'Allow the preview model to suggest topics once.';
  view.data.selection = visible;
  view.data.approve = visible;
  view.data.revoke = visible;
  return new Promise((resolve, reject) => {
    request = { bookmarks, revocation, signal: stop, resolve, reject };
    stop.addEventListener(
      'abort',
      () =>
        reject(capabilityError('Request cancelled or revoked.', 'cancelled')),
      { once: true }
    );
  }).finally(() => {
    view.data.approve = hidden;
    view.data.revoke = hidden;
    view.data.selection = hidden;
    view.data.bookmarkCapability = hidden;
    view.data.returnSuggestions = hidden;
    view.data.bookmarks = [];
    view.data.readBookmarks = [];
  });
}

async function mockTopics(input, signal) {
  // Model the time between dispatch and a response without any service call.
  await new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 900);
    signal.addEventListener('abort', abort, { once: true });
  });
  return input.map(
    ({ title }) =>
      title.toLowerCase().split(' ').slice(0, 2).join(' ') || 'bookmark'
  );
}

window.addEventListener('message', (event) => {
  if (!connection && parent !== window) {
    connection = acceptPort(event, parent, caller, key, handle);
  }
});
window.addEventListener('pagehide', () => connection?.close());
if (parent !== window && key) {
  parent.postMessage({ type: 'solid-assistant:ready', key }, caller);
}
