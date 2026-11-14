import template from '../regions.html' with { type: 'text' };

export const muzeSolidPresenterRegions = {
  templates: { 'muze-solid-presenter-regions': template },
  events: {
    muzeSolidPresenterMessages: {
      target: 'window',
      type: 'message',
      action: 'muzeSolidPresenterMessage'
    },
    muzeSolidPresenterResize: {
      subscribe(notify) {
        const observer = new ResizeObserver(notify);
        observer.observe(this.container);
        const frames = new Set();
        const trackFrames = () => {
          for (const frame of frames) {
            if (!this.container.contains(frame)) {
              observer.unobserve(frame);
              frames.delete(frame);
            }
          }
          for (const frame of this.container.querySelectorAll(
            '.muze-solid-presenter-frame'
          )) {
            if (!frames.has(frame)) {
              frames.add(frame);
              observer.observe(frame);
            }
          }
        };
        const changes = new MutationObserver(trackFrames);
        changes.observe(this.container, { childList: true, subtree: true });
        trackFrames();
        return () => {
          observer.disconnect();
          changes.disconnect();
        };
      },
      action: 'muzeSolidPresenterResize'
    }
  },
  commands: {
    muzeSolidPresenterUseProvider(_element, id) {
      return this.actions.muzeSolidPresenterRun(async () => {
        const region = this.actions.muzeSolidPresenterRegion(id);
        const previous = this.runtime.views.get(id);
        if (previous && !(await previous.close())) {
          return;
        }
        this.runtime.views.delete(id);
        const provider = await this.actions
          .muzeSolidPresenterBroker()
          .embeddedProvider(
            region.kind === 'text'
              ? this.api.editTextCapability
              : this.api.viewResourceCapability
          );
        this.runtime.deck.change(id, 'provider', provider, 'iri');
        region.provider = provider;
        await this.actions.muzeSolidPresenterPersist();
        await this.actions.muzeSolidPresenterOpenRegion(id);
      });
    },
    muzeSolidPresenterEditRegion(_element, id) {
      return this.actions.muzeSolidPresenterRun(() =>
        this.actions.muzeSolidPresenterEditRegion(id)
      );
    },
    muzeSolidPresenterRetryRegion(_element, id) {
      return this.actions.muzeSolidPresenterRun(() =>
        this.actions.muzeSolidPresenterOpenRegion(id)
      );
    },
    muzeSolidPresenterDiscardRegion(_element, id) {
      return this.actions.muzeSolidPresenterRun(async () => {
        const view = this.runtime.views.get(id);
        if (view) {
          await view.close({ discard: true });
          this.runtime.views.delete(id);
        }
      });
    }
  },
  actions: {
    muzeSolidPresenterBroker() {
      const host = this.runtime.host;
      return host.managed?.ready ? host.managed : this.runtime.broker;
    },
    muzeSolidPresenterRegion(id) {
      return this.data.muzeSolidPresenterRegions.find(
        (region) => region.id === id
      );
    },
    muzeSolidPresenterMessage(event) {
      for (const [id, view] of this.runtime.views) {
        view.receive(event);
        if (
          event.data?.type === 'solid-apps:text-changed' &&
          event.source === view.frame.contentWindow &&
          event.origin === view.url?.origin &&
          event.data.generation === view.generation
        ) {
          this.actions.muzeSolidPresenterCollectText(id).catch((error) => {
            this.data.muzeSolidPresenterStatus = error.message;
          });
        }
      }
    },
    muzeSolidPresenterPresentation(frame) {
      const size = frame.getBoundingClientRect();
      return {
        interaction:
          !this.runtime.presenting &&
          this.actions.muzeSolidPresenterRegion(frame.dataset.regionId)
            ?.kind === 'text'
            ? 'interactive'
            : 'passive',
        geometry: 'bounded',
        fit:
          this.actions.muzeSolidPresenterRegion(frame.dataset.regionId)
            ?.kind === 'image'
            ? 'cover'
            : 'contain',
        width: size.width,
        height: size.height,
        visible: !document.hidden
      };
    },
    muzeSolidPresenterAppearance(region) {
      return {
        font: 'system-ui',
        fontSize: region.name === 'title' ? 28 : 18,
        lineHeight: 1.5,
        foreground: '#111827',
        background: region.kind === 'text' ? 'transparent' : '#243b53'
      };
    },
    async muzeSolidPresenterResize() {
      const revision = (this.runtime.resizeRevision || 0) + 1;
      this.runtime.resizeRevision = revision;
      for (const [id, view] of this.runtime.views) {
        if (revision !== this.runtime.resizeRevision) {
          return;
        }
        if (!view.support || view.retired) {
          continue;
        }
        const region = this.actions.muzeSolidPresenterRegion(id);
        try {
          await view.update(
            this.actions.muzeSolidPresenterAppearance(region),
            this.actions.muzeSolidPresenterPresentation(view.frame)
          );
          if (
            revision !== this.runtime.resizeRevision ||
            this.runtime.views.get(id) !== view
          ) {
            continue;
          }
          region.status = '';
          region.frame = {
            ...region.frame,
            style: '',
            tabindex:
              !this.runtime.presenting && region.kind === 'text' ? '0' : '-1'
          };
        }
        catch (error) {
          if (
            revision === this.runtime.resizeRevision &&
            this.runtime.views.get(id) === view
          ) {
            region.status = error.message;
            // Keep the measured geometry: display:none would trigger another
            // resize and replace the useful fit error with a zero-size failure.
            region.frame = { ...region.frame, style: 'visibility:hidden' };
          }
        }
      }
    },
    muzeSolidPresenterFrame(id) {
      return new Promise((resolve, reject) => {
        const check = () => {
          const frame = [
            ...this.container.querySelectorAll('.muze-solid-presenter-frame')
          ].find((frame) => frame.dataset.regionId === id);
          if (frame) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(frame);
          }
        };
        const observer = new MutationObserver(check);
        observer.observe(this.container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-region-id']
        });
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(
            new Error(
              'presenter: The region did not appear. Select the slide again.'
            )
          );
        }, 3000);
        check();
      });
    },
    async muzeSolidPresenterOpenRegion(id) {
      const region = this.actions.muzeSolidPresenterRegion(id);
      const previous = this.runtime.views.get(id);
      if (previous) {
        try {
          if (!(await previous.close())) {
            return;
          }
          this.runtime.views.delete(id);
        }
        catch (error) {
          region.status = 'Could not confirm safe closure. ' + error.message;
          region.discard = { hidden: null };
          return;
        }
      }
      if (region.kind === 'image' && !region.resource) {
        region.status = '';
        return;
      }
      try {
        const frame = await this.actions.muzeSolidPresenterFrame(id);
        const broker = this.actions.muzeSolidPresenterBroker();
        const capability =
          region.kind === 'text'
            ? this.api.editTextCapability
            : this.api.viewResourceCapability;
        const provider = await broker.embeddedProvider(capability);
        if (
          region.provider &&
          new URL(region.provider).href !== new URL(provider).href
        ) {
          throw new Error(
            'presenter: The saved viewer differs from your current preference. Choose Use preferred viewer to update its saved binding.'
          );
        }
        const view = new this.api.EmbeddedView({
          broker,
          frame,
          capability,
          change: (state) => {
            if (this.runtime.views.get(id) !== view) {
              return;
            }
            if (state.src) {
              region.frame = {
                ...region.frame,
                src: state.src,
                hidden: state.closed ? '' : null,
                'aria-busy': state.closed ? 'false' : 'true',
                'aria-hidden': 'true',
                inert: '',
                'data-muze-solid-ui-loading': state.closed ? null : ''
              };
            }
            region.status = state.ready || state.closed ? '' : state.status;
            if (state.ready) {
              region.frame = {
                ...region.frame,
                // The replacement provider has confirmed a usable surface.
                // Retire visibility left by the previous failed view update.
                style: '',
                'aria-busy': 'false',
                tabindex: region.kind === 'text' ? '0' : '-1',
                'aria-hidden': null,
                inert: null,
                'data-muze-solid-ui-loading': null
              };
            }
            if (state.failed) {
              region.frame = { ...region.frame, hidden: '' };
              region.discard = { hidden: null };
            }
          }
        });
        this.runtime.views.set(id, view);
        const url = this.api.launchUrl(provider, {
          webId: this.runtime.host.selectedWebId,
          ...(region.kind === 'image' ? { resource: region.resource } : {})
        });
        // Reveal the empty frame before measuring the bounded content area.
        region.frame = { ...region.frame, hidden: null };
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await view.open(url, {
          ...(region.kind === 'text'
            ? {
                access: 'host-draft',
                id,
                text: region.text,
                fragment: region.fragment,
                surface: 'slide-text'
              }
            : { resource: region.resource, contentKind: 'image' }),
          appearance: this.actions.muzeSolidPresenterAppearance(region),
          presentation: this.actions.muzeSolidPresenterPresentation(frame)
        });
        if (region.kind === 'text' && !this.runtime.presenting) {
          await this.actions.muzeSolidPresenterCollectText(id);
        }
      }
      catch (error) {
        region.status = error.message;
      }
    },
    async muzeSolidPresenterCollectAll() {
      for (const [id, view] of this.runtime.views) {
        if (view.support?.editable) {
          await this.actions.muzeSolidPresenterCollectText(id);
        }
      }
    },
    async muzeSolidPresenterCollectText(id) {
      const region = this.actions.muzeSolidPresenterRegion(id);
      const view = this.runtime.views.get(id);
      if (!region || !view || view.retired || region.kind !== 'text') {
        return;
      }
      this.runtime.collections ||= new Map();
      const previous = this.runtime.collections.get(id);
      if (previous) {
        previous.again = true;
        return previous.promise;
      }
      const state = { again: false, promise: null };
      this.runtime.collections.set(id, state);
      const collect = async () => {
        do {
          state.again = false;
          const result = await view.operation('read');
          if (result.id !== id || this.runtime.views.get(id) !== view) {
            throw new Error('presenter: Stale editor reply.');
          }
          if (!Number.isSafeInteger(result.revision) || result.revision < 0) {
            throw new Error('presenter: Invalid editor revision.');
          }
          const fragment = this.api.validateFragment(result.fragment);
          if (JSON.stringify(region.fragment) !== JSON.stringify(fragment)) {
            this.runtime.deck.editText(id, fragment);
            region.fragment = fragment;
            region.text = fragment.text;
          }
          // A prior write may have failed after updating the in-memory graph.
          // Always confirm durable deck storage before acknowledging the draft.
          await this.actions.muzeSolidPresenterPersist();
          await view.operation('acknowledge', { revision: result.revision });
        } while (state.again);
      };
      state.promise = collect();
      try {
        await state.promise;
      }
      finally {
        this.runtime.collections.delete(id);
      }
    },
    async muzeSolidPresenterCloseViews() {
      await this.actions.muzeSolidPresenterCollectAll();
      const closed = [];
      let allowed = true;
      for (const [id, view] of this.runtime.views) {
        const region = this.actions.muzeSolidPresenterRegion(id);
        try {
          if (!(await view.close())) {
            this.data.muzeSolidPresenterStatus =
              'Finish the current view before changing slides.';
            region.discard = { hidden: null };
            allowed = false;
            break;
          }
          this.runtime.views.delete(id);
          closed.push(id);
        }
        catch (error) {
          region.status = 'Could not confirm safe closure. ' + error.message;
          region.discard = { hidden: null };
          allowed = false;
          break;
        }
      }
      if (!allowed) {
        // A later region can veto closure. Reopen already released read-only
        // siblings from the unchanged deck; retain the vetoing frame and draft.
        const results = await Promise.allSettled(
          closed.map((id) => this.actions.muzeSolidPresenterOpenRegion(id))
        );
        for (const result of results) {
          if (result.status === 'rejected') {
            this.data.muzeSolidPresenterStatus = result.reason.message;
          }
        }
      }
      return allowed;
    },
    async muzeSolidPresenterEditRegion(id) {
      const region = this.actions.muzeSolidPresenterRegion(id);
      const host = this.runtime.host;
      const broker = this.actions.muzeSolidPresenterBroker();
      const image = region.kind === 'image';
      const capability = image
        ? this.api.browseCapability
        : region.text
          ? this.api.editTextCapability
          : this.api.createTextCapability;
      const provider = await broker.embeddedProvider(capability);
      const input = image
        ? {}
        : {
            version: 1,
            access: 'host-draft',
            id,
            text: region.text
          };
      let result;
      host.capabilityBroker = broker.target ? broker : undefined;
      try {
        result = await host.muzeSolidUiInvoke(
          capability,
          this.api.launchUrl(provider, { webId: host.selectedWebId }),
          input,
          image ? 'Choose an image' : 'Edit text'
        );
      }
      finally {
        host.capabilityBroker = undefined;
      }
      if (image) {
        const url = this.api.httpUrl(result?.['@id']);
        this.runtime.deck.change(id, 'resource', url, 'iri');
        region.resource = url;
      }
      else {
        const draft = this.api.textDraft({ ...result, access: 'host-draft' });
        if (draft.id !== id) {
          throw new Error('presenter: The editor returned another region.');
        }
        this.runtime.deck.change(id, 'text', draft.text);
        region.text = draft.text;
        region.editLabel = draft.text ? 'Edit text' : 'Create text';
      }
      const viewer = await broker.embeddedProvider(
        image ? this.api.viewResourceCapability : this.api.viewTextCapability
      );
      this.runtime.deck.change(id, 'provider', viewer, 'iri');
      region.provider = viewer;
      await this.actions.muzeSolidPresenterPersist();
      await this.actions.muzeSolidPresenterOpenRegion(id);
    }
  }
};
