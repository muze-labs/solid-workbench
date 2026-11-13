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
        capabilities: [
          this.api.viewResourceCapability,
          this.api.viewTextCapability,
          this.api.createTextCapability,
          this.api.editTextCapability
        ],
        canClose: () => ({
          allowed:
            !this.runtime.textDirty &&
            (!this.runtime.cobaltActive ||
              (!this.runtime.cobaltEditor?.isComposing() &&
                this.runtime.cobaltRevision ===
                  this.runtime.cobaltAcknowledged))
        }),
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
    async muzeSolidViewerRequest({ id, input, capability, requester }) {
      try {
        if (
          input?.surface === 'slide-text' &&
          [this.api.editTextCapability, this.api.viewTextCapability].includes(
            capability
          )
        ) {
          this.api.viewPresentation(input.presentation);
          const result = await this.actions.muzeSolidCobaltOpen(
            input,
            requester
          );
          await this.runtime.host.managed.respond(id, { result });
          return;
        }
        if (
          [this.api.createTextCapability, this.api.editTextCapability].includes(
            capability
          )
        ) {
          await this.actions.muzeSolidTextOpen({ id, input, requester });
          return;
        }
        if (
          input.version !== 1 ||
          !['direct', 'host-draft'].includes(input.access) ||
          typeof input.generation !== 'string'
        ) {
          throw new Error('viewer: Unsupported embedded view contract.');
        }
        this.runtime.viewGeneration = input.generation;
        this.runtime.appearanceRevision = -1;
        this.actions.muzeSolidViewerContext({ ...input, revision: 0 });
        if (capability === this.api.viewTextCapability) {
          const draft = this.api.textDraft(input);
          this.data.muzeSolidViewerText = draft.text;
          this.data.muzeSolidViewerStatus = '';
          this.data.muzeSolidViewerImage = { hidden: '' };
          await this.actions.muzeSolidViewerContentReady(draft.text, '');
        } else {
          if (input.access !== 'direct') {
            throw new Error('viewer: Resource viewing requires direct access.');
          }
          this.runtime.expectedKind = input.contentKind;
          await this.actions.muzeSolidViewerLoad(input.resource);
        }
        await this.runtime.host.managed.respond(id, {
          result: {
            version: 1,
            generation: input.generation,
            ready: true,
            presentation:
              this.runtime.presentation.interaction +
              '-' +
              this.runtime.presentation.geometry,
            appearance: [
              'font',
              'fontSize',
              'lineHeight',
              'foreground',
              'background'
            ],
            limitations: [
              'Forced colours follow accessibility preferences.',
              'Image pixels retain their original appearance.'
            ],
            constraints: {
              minWidth: 0,
              minHeight: 0,
              overflow:
                this.runtime.presentation.geometry === 'bounded'
                  ? 'reject'
                  : 'scroll'
            }
          }
        });
      } catch (error) {
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
      // and accessible minimums; forced colours remain controlled by the user.
      this.data.muzeSolidViewerAppearance = {
        'data-muze-solid-viewer-fit': presentation.fit || null,
        'data-muze-solid-viewer-bounded':
          presentation.geometry === 'bounded' ? '' : null,
        style:
          '--muze-viewer-font:' +
          (appearance.font || 'monospace') +
          ';' +
          '--muze-viewer-font-size:' +
          Math.max(16, appearance.fontSize || 16) / 16 +
          'rem;' +
          '--muze-viewer-line-height:' +
          Math.max(1.5, appearance.lineHeight || 1.5) +
          ';' +
          '--muze-viewer-hint-foreground:' +
          (appearance.foreground || 'inherit') +
          ';' +
          '--muze-viewer-hint-background:' +
          (appearance.background || 'transparent') +
          ';'
      };
    },
    async muzeSolidViewerOperation(input) {
      if (this.runtime.cobaltActive) {
        return this.actions.muzeSolidCobaltOperation(input);
      }
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
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await this.actions.muzeSolidViewerContentReady(
          this.data.muzeSolidViewerText,
          this.runtime.imageUrl || ''
        );
        return { revision: this.runtime.appearanceRevision };
      }
      if (input.operation === 'refresh') {
        if (!this.data.muzeSolidViewerResource) {
          return { ready: true };
        }
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
                // A text wildcard also permits a server's HTML view of RDF.
                Accept: new URL(url).pathname.toLowerCase().endsWith('.ttl')
                  ? 'text/turtle'
                  : 'text/*,image/png,image/jpeg,image/gif,image/webp'
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
        if (
          this.runtime.expectedKind === 'image' &&
          !type?.startsWith('image/')
        ) {
          throw new Error('viewer: Select an image resource for this region.');
        }
        let text = '';
        let image = '';
        if (type?.startsWith('text/')) {
          text = await response.text();
        } else if (
          ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type)
        ) {
          const blob = await response.blob();
          const decoded = await createImageBitmap(blob);
          decoded.close();
          image = URL.createObjectURL(blob);
        } else {
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
      } catch (error) {
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
          } else {
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
            if (this.runtime.presentation?.geometry === 'bounded' && !image) {
              const surface = this.container.querySelector(
                '.muze-solid-viewer-surface'
              );
              if (
                content.scrollHeight > surface.clientHeight + 1 ||
                content.scrollWidth > surface.clientWidth + 1
              ) {
                throw new Error(
                  'viewer: This text does not fit the region. Shorten it or use a larger region.'
                );
              }
            }
            finish();
          } catch (error) {
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
