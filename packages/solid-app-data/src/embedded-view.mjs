import { capabilityError } from './capabilities.mjs';

export const viewResourceCapability =
  'https://vocab.muze.nl/capabilities/view-resource';

// Experimental v1: semantic hints, not CSS or host design-system variables.
export function viewAppearance(value = {}) {
  const result = {};
  for (const key of Object.keys(value)) {
    const hint = value[key];
    if (
      ['foreground', 'background', 'accent'].includes(key) &&
      typeof hint === 'string' &&
      /^#[0-9a-f]{6}$/i.test(hint)
    ) {
      result[key] = hint;
    }
    else if (
      key === 'font' &&
      ['system-ui', 'serif', 'sans-serif', 'monospace'].includes(hint)
    ) {
      result[key] = hint;
    }
    else if (
      key === 'fontSize' &&
      Number.isFinite(hint) &&
      hint >= 12 &&
      hint <= 40
    ) {
      result[key] = hint;
    }
    else if (
      key === 'lineHeight' &&
      Number.isFinite(hint) &&
      hint >= 1 &&
      hint <= 2.5
    ) {
      result[key] = hint;
    }
    else {
      throw capabilityError('Unsupported appearance hint: ' + key, 'denied');
    }
  }
  return result;
}

export function viewPresentation(value) {
  if (
    !value ||
    value.interaction !== 'interactive' ||
    value.geometry !== 'scroll' ||
    typeof value.visible !== 'boolean' ||
    !Number.isFinite(value.width) ||
    value.width < 0 ||
    !Number.isFinite(value.height) ||
    value.height < 0
  ) {
    throw capabilityError('Unsupported view presentation.', 'denied');
  }
  return {
    interaction: 'interactive',
    geometry: 'scroll',
    visible: value.visible,
    width: value.width,
    height: value.height
  };
}

// One region, one scoped connection. The caller renders all chrome with its own
// component system and supplies native window/load events; no renderer lives here.
export class EmbeddedView {
  constructor({ broker, frame, change = () => {} }) {
    Object.assign(this, { broker, frame, change });
    this.revision = 0;
    this.generation = crypto.randomUUID();
    this.controller = new AbortController();
  }
  async open(url, input) {
    this.url = new URL(url);
    // Distinguish consecutive views of the same URL. SimplyFlow may combine
    // the close/open attribute updates before the browser sees about:blank.
    this.url.searchParams.set('solid-apps-task', this.generation);
    this.ticket = this.broker.target
      ? await this.broker.beginEmbedded(
          this.url.href,
          viewResourceCapability,
          'launcher',
          'view'
        )
      : await this.broker.beginEmbedded(
          this.url.href,
          viewResourceCapability,
          'view'
        );
    if (this.retired) {
      await this.broker.endEmbedded(this.ticket.id);
      return;
    }
    this.change({ status: 'Loading view…', src: this.url.href });
    const timer = setTimeout(() => this.controller.abort(), 20000);
    try {
      const result = await this.broker.requestEmbedded(
        this.ticket.id,
        {
          ...input,
          version: 1,
          generation: this.generation,
          access: 'direct',
          appearance: viewAppearance(input.appearance),
          presentation: viewPresentation(input.presentation)
        },
        { signal: this.controller.signal }
      );
      if (this.retired) {
        return;
      }
      if (
        result?.version !== 1 ||
        result.generation !== this.generation ||
        result.ready !== true ||
        result.presentation !== 'interactive-scroll'
      ) {
        throw capabilityError('Provider did not confirm a usable view.');
      }
      this.support = result;
      this.change({ status: 'Ready', ready: true, support: result });
      return result;
    }
    catch (error) {
      if (!this.retired) {
        this.change({ status: error.message, failed: true });
      }
      throw error;
    }
    finally {
      clearTimeout(timer);
    }
  }
  receive(event) {
    if (
      this.retired ||
      !this.ticket ||
      event.source !== this.frame.contentWindow ||
      event.origin !== this.url.origin
    ) {
      return;
    }
    if (event.data?.type !== 'solid-apps:embedded-ready') {
      return;
    }
    if (this.attached) {
      if (event.data.generation !== this.providerGeneration) {
        this.change({
          status: 'The viewer restarted. Retry to reconnect.',
          failed: true
        });
      }
      return;
    }
    this.providerGeneration = event.data.generation;
    this.attached = true;
    const channel = new MessageChannel();
    const parent = this.broker.target || this.broker.parent;
    const origin = this.broker.target
      ? location.origin
      : this.broker.resume.origin;
    parent.postMessage(
      { type: 'solid-apps:embed-port', ...this.ticket },
      origin,
      [channel.port1]
    );
    this.frame.contentWindow.postMessage(
      { type: 'solid-apps:offer', ...this.ticket, state: null },
      this.url.origin,
      [channel.port2]
    );
  }
  async update(appearance, presentation) {
    return this.operation('update', {
      revision: ++this.revision,
      appearance: viewAppearance(appearance),
      presentation: viewPresentation(presentation)
    });
  }
  operation(operation, values = {}) {
    if (this.retired || !this.ticket) {
      throw capabilityError('View is no longer active.', 'disconnected');
    }
    return this.broker.updateEmbeddedView(this.ticket.id, {
      operation,
      generation: this.generation,
      ...values
    });
  }
  async close({ discard = false } = {}) {
    if (this.retired) {
      return true;
    }
    // No provider has received a connection before attachment, hence no draft.
    if (this.attached && !discard) {
      const result = await this.operation('prepare');
      if (result?.allowed !== true || result.frozen !== true) {
        this.change({
          status:
            result?.message ||
            'The viewer kept this view open. Finish or cancel its work first.'
        });
        return false;
      }
    }
    if (this.ticket) {
      try {
        await this.broker.endEmbedded(this.ticket.id);
      }
      catch (error) {
        if (!discard) {
          throw error;
        }
        // Explicit discard also removes an unreachable/revoked instance.
      }
    }
    this.retired = true;
    this.controller.abort();
    this.change({ status: '', src: 'about:blank', closed: true });
    return true;
  }
}
