export const selectRecipientCapability =
  'https://vocab.muze.nl/capabilities/select-recipient';
export function recipientId(result) {
  const id = result?.['@id'];
  if (typeof id !== 'string') {
    throw capabilityError('Provider did not return a recipient identifier.');
  }
  const uuid = /^urn:uuid:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (uuid.test(id)) {
    return id;
  }
  selectionUrl(result);
  // Validate without normalising a native RDF subject's identity.
  return id;
}
export const editPreferencesCapability =
  'https://vocab.muze.nl/capabilities/edit-preferences';
export const editProfileCapability =
  'https://vocab.muze.nl/capabilities/edit-profile';
export const browseCapability = 'https://vocab.muze.nl/capabilities/browse';
export const browseInput = Object.freeze({
  '@context': { '@vocab': 'https://vocab.muze.nl/capability#' }
});
export function capabilityError(message, code = 'failed') {
  const error = new Error('capabilities: ' + message);
  error.code = code;
  return error;
}
export function selectionUrl(result) {
  try {
    const url = new URL(result?.['@id']);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
    return url.href;
  }
  catch {
    throw capabilityError('Provider did not return a safe resource URL.');
  }
}
export function serializable(value) {
  function visit(item, depth) {
    if (depth > 30) {
      throw capabilityError('State nesting is too deep.');
    }
    if (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'boolean' ||
      (typeof item === 'number' && Number.isFinite(item))
    ) {
      return;
    }
    if (
      typeof item !== 'object' ||
      (!Array.isArray(item) &&
        ![Object.prototype, null].includes(Object.getPrototypeOf(item)))
    ) {
      throw capabilityError('State must contain only JSON values.');
    }
    for (const child of Object.values(item)) {
      visit(child, depth + 1);
    }
  }
  visit(value, 0);
  const text = JSON.stringify(value);
  return JSON.parse(text);
}

// Wire validation stays independent of any RDF library. Persistence parses the
// graph and enforces native terms before changing its authoritative checkpoint.
export function restorationState(value) {
  if (value === null) {
    return null;
  }
  if (
    !value ||
    typeof value.turtle !== 'string' ||
    (value.opaque !== undefined && typeof value.opaque !== 'string') ||
    Object.keys(value).some((key) => !['turtle', 'opaque'].includes(key))
  ) {
    throw capabilityError(
      'App state requires Turtle and an optional opaque string.'
    );
  }
  return serializable(value);
}

// A private MessagePort owns its calls, cancellation and exactly-once replies.
export class PortConnection {
  constructor(port, handle, { timeout = 60000 } = {}) {
    this.port = port;
    this.handle = handle;
    this.timeout = timeout;
    this.pending = new Map();
    this.active = new Map();
    this.closed = false;
    port.onmessage = (event) => this.receive(event.data);
    port.onmessageerror = () => this.close('Message could not be decoded.');
    port.start?.();
  }
  async receive(message) {
    if (this.closed) {
      return;
    }
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      this.close('Invalid capability frame.');
      return;
    }
    if (message.type === 'disconnect') {
      this.close('Application disconnected.', false);
      return;
    }
    const validId = typeof message.id === 'string' && message.id.length > 0;
    const validType = ['call', 'reply', 'cancel'].includes(message.type);
    const validMethod = message.type !== 'call' ||
      (typeof message.method === 'string' && message.method.length > 0);
    const validError = message.type !== 'reply' ||
      message.error === undefined ||
      (message.error && typeof message.error.code === 'string' &&
        typeof message.error.message === 'string');
    if (!validId || !validType || !validMethod || !validError) {
      this.close('Invalid capability frame.');
      return;
    }
    if (message.type === 'reply') {
      const pending = this.pending.get(message.id);
      if (pending) {
        if (message.error) {
          pending.reject(
            capabilityError(message.error.message, message.error.code)
          );
        }
        else {
          pending.resolve(message.result);
        }
      }
      return;
    }
    if (message.type === 'cancel') {
      this.active.get(message.id)?.abort();
      return;
    }
    if (message.type !== 'call' || this.active.has(message.id)) {
      return;
    }
    if (this.active.size >= 32) {
      this.port.postMessage({
        type: 'reply',
        id: message.id,
        error: { code: 'busy', message: 'capabilities: Too many active calls.' }
      });
      return;
    }
    const controller = new AbortController();
    this.active.set(message.id, controller);
    try {
      const result = await this.handle(message.method, message.input, {
        signal: controller.signal
      });
      if (!this.closed && !controller.signal.aborted) {
        this.port.postMessage({ type: 'reply', id: message.id, result });
      }
    }
    catch (error) {
      if (!this.closed && !controller.signal.aborted) {
        this.port.postMessage({
          type: 'reply',
          id: message.id,
          error: { code: error.code || 'failed', message: error.message }
        });
      }
    }
    finally {
      this.active.delete(message.id);
    }
  }
  call(method, input, { signal, timeout = this.timeout } = {}) {
    if (this.closed || signal?.aborted || this.pending.size >= 32) {
      return Promise.reject(
        capabilityError('Connection unavailable or cancelled.')
      );
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const finish = (callback, value) => {
        if (this.pending.delete(id)) {
          clearTimeout(timer);
          signal?.removeEventListener('abort', cancel);
          callback(value);
        }
      };
      const cancel = () => {
        this.port.postMessage({ type: 'cancel', id });
        finish(reject, capabilityError('Selection cancelled.', 'cancelled'));
      };
      const timer =
        timeout === null
          ? null
          : setTimeout(() => {
              this.port.postMessage({ type: 'cancel', id });
              finish(reject, capabilityError('Request timed out.', 'timeout'));
            }, timeout);
      this.pending.set(id, {
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error)
      });
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        this.port.postMessage({ type: 'call', id, method, input });
      }
      catch (error) {
        finish(reject, error);
      }
    });
  }
  close(message = 'Application disconnected.', notify = true) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (notify) {
      try {
        this.port.postMessage({ type: 'disconnect' });
      }
      catch {
        // Local settlement must still complete if the port is already gone.
      }
    }
    for (const call of this.pending.values()) {
      call.reject(capabilityError(message, 'disconnected'));
    }
    for (const controller of this.active.values()) {
      controller.abort();
    }
    this.active.clear();
    this.port.close();
  }
}

export class ManagedApp {
  constructor({
    name,
    capabilities = [],
    getState = () => null,
    restoreState = () => {},
    onRequest,
    onCancel,
    onView,
    onState,
    onContext = () => {},
    onPreferences = () => {},
    onFocus = () => {},
    beforeCheckpoint = () => {},
    waitForPresentation = false,
    canClose = () => ({ allowed: true })
  } = {}) {
    Object.assign(this, {
      name,
      capabilities,
      getState,
      restoreState,
      onRequest,
      onCancel,
      onView,
      onState,
      onContext,
      onPreferences,
      onFocus,
      beforeCheckpoint,
      waitForPresentation,
      canClose
    });
    this.incoming = new Map();
    this.ready = false;
    this.task = new URL(location.href).searchParams.has('solid-apps-task');
    this.embedded = this.task && window.parent !== window;
    this.parent = this.embedded ? window.parent : window.opener;
    this.generation = crypto.randomUUID();
    this.listen = (event) => this.offer(event);
    window.addEventListener('message', this.listen);
    try {
      this.resume = this.task
        ? null
        : JSON.parse(sessionStorage.getItem('solid-apps.managed') || 'null');
    }
    catch {}
    this.tick = setInterval(() => this.announce(), 400);
    window.addEventListener('pageshow', () => this.announce());
    window.addEventListener('pagehide', () => this.peer?.close());
    if (this.task && this.parent) {
      // No credentials or resource data: the host validates source and origin
      // before transferring its scoped port in response to this readiness ping.
      queueMicrotask(() =>
        this.parent.postMessage(
          {
            type: 'solid-apps:embedded-ready',
            generation: this.generation,
            presentation: this.waitForPresentation ? 'explicit' : 'load'
          },
          '*'
        )
      );
    }
  }
  presentationReady() {
    if (!this.task || !this.parent || !this.resume) {
      return;
    }
    const { id, origin } = this.resume;
    // Allow queued bindings to settle without requiring a hidden frame to paint.
    setTimeout(() => {
      if (this.ready && this.resume?.id === id) {
        this.parent.postMessage(
          { type: 'solid-apps:presentation-ready', id },
          origin
        );
      }
    }, 0);
  }

  requestPresentationClose() {
    if (!this.embedded || !this.ready || !this.parent || !this.resume) {
      return false;
    }
    const { id, key, origin } = this.resume;
    // Presentation remains reachable if the broker port disconnects: the host
    // must still offer its ordinary unsaved-edit/discard guard in that case.
    this.parent.postMessage(
      { type: 'solid-apps:presentation-close', id, key },
      origin
    );
    return true;
  }

  announce() {
    if (this.task) {
      return;
    }
    if (this.resume && this.parent?.closed) {
      this.peer?.close('Workspace closed.');
      window.close();
    }
    else if (this.resume && this.parent) {
      this.parent.postMessage(
        {
          type: 'solid-apps:resume',
          ...this.resume,
          generation: this.generation,
          reconnect: !this.peer || this.peer.closed
        },
        this.resume.origin
      );
    }
  }
  async offer(event) {
    const message = event.data;
    if (message?.type === 'solid-apps:presentation-focus') {
      if (
        this.task &&
        this.ready &&
        this.peer &&
        !this.peer.closed &&
        event.source === this.parent &&
        event.origin === this.resume?.origin &&
        message.id === this.resume.id &&
        message.key === this.resume.key
      ) {
        await this.onFocus();
      }
      return;
    }
    if (
      !this.parent ||
      event.source !== this.parent ||
      message?.type !== 'solid-apps:offer' ||
      !event.ports[0] ||
      typeof message.id !== 'string' ||
      typeof message.key !== 'string'
    ) {
      return;
    }
    this.peer?.close();
    this.ready = false;
    this.parentTarget =
      typeof message.focusTarget === 'string' &&
      /^solid-apps-launcher-[0-9a-f-]{36}$/.test(message.focusTarget)
        ? message.focusTarget
        : null;
    this.resume = { id: message.id, key: message.key, origin: event.origin };
    if (!this.task) {
      sessionStorage.setItem('solid-apps.managed', JSON.stringify(this.resume));
    }
    const peer = new PortConnection(event.ports[0], (method, input, options) =>
      this.handle(method, input, options)
    );
    this.peer = peer;
    try {
      const registered = await peer.call('register', {
        name: this.name,
        restoring: true,
        generation: this.generation,
        capabilities: this.capabilities
      });
      await this.onContext(registered?.context || null);
      const identity = JSON.stringify(this.resume);
      if (identity !== this.restorationIdentity) {
        this.restorationIdentity = identity;
        this.restoreError = '';
        this.restoring = Promise.resolve().then(() =>
          this.restoreState(message.state)
        );
      }
      await this.restoring;
      if (this.peer !== peer || peer.closed) {
        return;
      }
      this.ready = true;
      await this.publish(peer);
      await peer.call('ready', null);
    }
    catch (error) {
      if (this.peer !== peer || peer.closed) {
        return;
      }
      this.ready = false;
      this.restoreError = error.message;
      await peer
        .call('restore-error', { message: error.message })
        .catch(() => {});
      this.onState?.(error.message);
    }
  }
  async handle(method, input, { signal }) {
    if (
      method === 'preferences-update' &&
      this.capabilities.includes(editPreferencesCapability)
    ) {
      return this.onPreferences(input);
    }
    if (method === 'view' && this.embedded && this.onView) {
      return this.onView(input);
    }
    if (method === 'can-close') {
      return this.canClose();
    }
    if (method === 'checkpoint') {
      if (!this.ready) {
        throw capabilityError(
          this.restoreError ||
            'App is still restoring. Finish connecting or reload it.',
          'restoring'
        );
      }
      await this.beforeCheckpoint();
      return restorationState(await this.getState());
    }
    if (
      method !== 'capability' ||
      !this.capabilities.includes(input.capability)
    ) {
      throw capabilityError('Unsupported operation.', 'denied');
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const cancel = () => {
        this.incoming.delete(id);
        this.onCancel?.({ id });
        reject(capabilityError('Selection cancelled.', 'cancelled'));
      };
      signal.addEventListener('abort', cancel, { once: true });
      const complete = (result) => {
        signal.removeEventListener('abort', cancel);
        resolve(result);
      };
      this.incoming.set(id, { complete });
      this.onRequest?.({ ...input, id });
    });
  }
  async publish(peer = this.peer) {
    if (this.task) {
      return;
    }
    if (this.ready && peer && !peer.closed) {
      const state = restorationState(await this.getState());
      if (this.ready && this.peer === peer && !peer.closed) {
        return peer.call('state', state);
      }
    }
  }
  async respond(id, response) {
    const request = this.incoming.get(id);
    if (!request) {
      throw capabilityError('Selection request is no longer active.');
    }
    this.incoming.delete(id);
    request.complete(response);
    try {
      // Targeting the existing context during this gesture activates tabs in
      // browsers which ignore cross-origin opener.focus(). Never navigate it.
      if (
        this.parent &&
        !this.parent.closed &&
        this.parentTarget &&
        window.navigator.userActivation?.isActive
      ) {
        const destination = window.open('', this.parentTarget);
        if (destination && destination !== this.parent) {
          destination.close();
        }
      }
      this.parent?.focus();
    }
    catch {}
  }
  embeddedProvider(capability) {
    if (!this.peer || !this.ready) {
      throw capabilityError(
        'Open this app through Launcher to use embedded capabilities.'
      );
    }
    return this.peer.call('embed-provider', { capability });
  }
  beginEmbedded(url, capability, presentation = 'task') {
    if (!this.peer || !this.ready) {
      throw capabilityError(
        'Open this app through Launcher to use embedded capabilities.'
      );
    }
    return this.peer.call('embed', { url, capability, presentation });
  }
  requestEmbedded(id, input, options) {
    return this.peer.call(
      'embed-call',
      { id, input: serializable(input) },
      { ...options, timeout: null }
    );
  }
  updateEmbeddedView(id, input) {
    return this.peer.call('embed-view', { id, input });
  }
  canCloseEmbedded(id) {
    return this.peer.call('embed-can-close', { id });
  }
  endEmbedded(id) {
    return this.peer.call('embed-close', { id });
  }
}
