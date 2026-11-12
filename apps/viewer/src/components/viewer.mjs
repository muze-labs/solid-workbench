import template from '../viewer.html' with { type: 'text' };
import styles from './viewer.css' with { type: 'text' };

export const muzeSolidViewer = {
  templates: { 'muze-solid-viewer': template },
  styles: { 'muze-solid-viewer': styles },
  events: {
    muzeSolidViewerLeave: {
      target: 'window',
      type: 'pagehide',
      action: 'muzeSolidViewerRelease'
    }
  },
  commands: {
    muzeSolidViewerOpen(form) {
      return this.runtime.host.run(() =>
        this.actions.muzeSolidViewerLoad(form.elements.resource.value)
      );
    }
  },
  actions: {
    async muzeSolidViewerInitialize() {
      this.runtime.loadGeneration = 0;
      this.eventBindings.start();
      const host = this.runtime.host;
      host.manage({
        capabilities: [this.api.viewResourceCapability],
        onRequest: (request) => this.actions.muzeSolidViewerRequest(request),
        onCancel: () => {
          this.runtime.loadGeneration += 1;
        },
        onView: (input) => this.actions.muzeSolidViewerOperation(input)
      });
      host.onConnect = async () => {
        if (!host.task && this.data.muzeSolidViewerResource) {
          await this.actions.muzeSolidViewerLoad(
            this.data.muzeSolidViewerResource
          );
        }
      };
      await host.ready;
      if (!host.task && host.launch?.resource) {
        await host.run(() =>
          this.actions.muzeSolidViewerLoad(host.launch.resource)
        );
      }
    },
    async muzeSolidViewerRequest({ id, input }) {
      try {
        if (
          input.version !== 1 ||
          input.access !== 'direct' ||
          typeof input.generation !== 'string'
        ) {
          throw new Error('viewer: Unsupported embedded view contract.');
        }
        this.runtime.viewGeneration = input.generation;
        this.runtime.appearanceRevision = -1;
        this.actions.muzeSolidViewerContext({ ...input, revision: 0 });
        await this.actions.muzeSolidViewerLoad(input.resource);
        await this.runtime.host.managed.respond(id, {
          result: {
            version: 1,
            generation: input.generation,
            ready: true,
            presentation: 'interactive-scroll',
            appearance: ['font', 'fontSize', 'lineHeight'],
            limitations: [
              'Colours follow accessibility preferences.',
              'Image pixels retain their original appearance.'
            ],
            constraints: { minWidth: 160, minHeight: 120, overflow: 'scroll' }
          }
        });
      }
      catch (error) {
        this.data.muzeSolidViewerStatus = error.message;
        if (this.runtime.host.managed.incoming.has(id)) {
          await this.runtime.host.managed.respond(id, {
            error: {
              code: 'unsupported',
              message: error.message
            }
          });
        }
      }
    },
    muzeSolidViewerContext(input) {
      const appearance = this.api.viewAppearance(input.appearance);
      const presentation = this.api.viewPresentation(input.presentation);
      if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
        throw new Error('viewer: Invalid appearance revision.');
      }
      if (input.revision <= this.runtime.appearanceRevision) {
        return;
      }
      this.runtime.appearanceRevision = input.revision;
      this.runtime.presentation = presentation;
      // Complete hint sets: omission restores local defaults. Keep user scaling
      // and accessible minimums; colours remain provider-owned in this profile.
      this.data.muzeSolidViewerAppearance = {
        style:
          '--muze-viewer-font:' +
          (appearance.font || 'monospace') +
          ';' +
          '--muze-viewer-font-size:' +
          Math.max(16, appearance.fontSize || 16) / 16 +
          'rem;' +
          '--muze-viewer-line-height:' +
          Math.max(1.5, appearance.lineHeight || 1.5) +
          ';'
      };
    },
    async muzeSolidViewerOperation(input) {
      if (input?.generation !== this.runtime.viewGeneration) {
        throw new Error('viewer: Retired view generation.');
      }
      if (input.operation === 'prepare') {
        this.runtime.frozen = true;
        this.runtime.loadGeneration += 1;
        return { allowed: true, frozen: true };
      }
      if (this.runtime.frozen) {
        throw new Error('viewer: This view is prepared for removal.');
      }
      if (input.operation === 'update') {
        this.actions.muzeSolidViewerContext(input);
        return { revision: this.runtime.appearanceRevision };
      }
      if (input.operation === 'refresh') {
        await this.actions.muzeSolidViewerLoad(
          this.data.muzeSolidViewerResource
        );
        return { ready: true };
      }
      throw new Error('viewer: Unsupported lifecycle operation.');
    },
    async muzeSolidViewerLoad(resource) {
      if (this.runtime.frozen) {
        throw new Error('viewer: This view is prepared for removal.');
      }
      const url = this.api.httpUrl(resource);
      const generation = ++this.runtime.loadGeneration;
      const host = this.runtime.host;
      const client =
        host.session?.client ||
        this.api.createSolidMetroClient(url, { oidc: false, oldm: false });
      this.data.muzeSolidViewerStatus = 'Loading resource…';
      try {
        const read = async () =>
          this.api.requireOk(
            await client.get(url, {
              headers: {
                Accept: 'text/*,image/png,image/jpeg,image/gif,image/webp'
              }
            })
          );
        const response = host.session
          ? await host.session.perform(read)
          : await read();
        const type = response.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase();
        let text = '';
        let image = '';
        if (type?.startsWith('text/')) {
          text = await response.text();
        }
        else if (
          ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type)
        ) {
          const blob = await response.blob();
          const decoded = await createImageBitmap(blob);
          decoded.close();
          image = URL.createObjectURL(blob);
        }
        else {
          throw new Error(
            'viewer: This resource format is unsupported. ' +
              'Use another viewer or download it.'
          );
        }
        if (generation !== this.runtime.loadGeneration) {
          if (image) {
            URL.revokeObjectURL(image);
          }
          throw new Error('viewer: Loading was superseded.');
        }
        this.actions.muzeSolidViewerRelease();
        this.runtime.imageUrl = image;
        this.data.muzeSolidViewerResource = url;
        this.data.muzeSolidViewerText = text;
        this.data.muzeSolidViewerImage = {
          src: image || null,
          alt: 'Image from ' + url,
          hidden: image ? null : ''
        };
        this.data.muzeSolidViewerStatus = '';
        await this.actions.muzeSolidViewerContentReady(text, image);
      }
      catch (error) {
        if (generation === this.runtime.loadGeneration) {
          this.data.muzeSolidViewerStatus =
            error.message + ' Previously loaded content is retained.';
        }
        throw error;
      }
    },
    muzeSolidViewerContentReady(text, image) {
      // Ready means the bound content is usable, including decoded images.
      // Observe SimplyFlow's output; do not render content ourselves.
      return new Promise((resolve, reject) => {
        let checking = false;
        const finish = (error) => {
          clearTimeout(timer);
          observer.disconnect();
          if (error) {
            reject(error);
          }
          else {
            resolve();
          }
        };
        const check = async () => {
          const picture = this.container.querySelector(
            '.muze-solid-viewer-image'
          );
          const content = this.container.querySelector(
            '.muze-solid-viewer-text'
          );
          if (
            checking ||
            content.textContent !== text ||
            (image && picture.getAttribute('src') !== image)
          ) {
            return;
          }
          checking = true;
          try {
            if (image) {
              await picture.decode();
            }
            finish();
          }
          catch (error) {
            finish(error);
          }
        };
        const observer = new MutationObserver(check);
        observer.observe(this.container, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['src']
        });
        const timer = setTimeout(
          () =>
            finish(
              new Error('viewer: Content did not become usable. Retry loading.')
            ),
          8000
        );
        check();
      });
    },
    muzeSolidViewerRelease() {
      if (this.runtime.imageUrl) {
        URL.revokeObjectURL(this.runtime.imageUrl);
        this.runtime.imageUrl = '';
      }
    }
  }
};
