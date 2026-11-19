import { connectInspector, dockSelector } from './bridge.mjs';
import { previewBoundData } from './data-preview.mjs';
import { attachSidebarResize } from '../sidebar-resize.mjs';
import {
  getInspectorPresentation,
  requestInspectorWindow,
  setInspectorPresentation
} from './presentation.mjs';
import {
  hasRelationshipSource, inspectRelationships, relationshipSource
} from './relationships.mjs';

const pickHint = 'Click an element or focus it and press Enter. ' +
  'Dimmed frames are outside this inspection. Escape cancels.';
const inspectable = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]';
const hidden = { hidden: '' };
const visible = { hidden: null };
const closedPreview = {
  attributes: hidden,
  dataVisibility: hidden,
  codeVisibility: hidden,
  origin: '',
  code: '',
  dataFormat: '',
  dataText: ''
};

export function createInspector(app, shellView) {
  const dock = document.querySelector(dockSelector);
  const dockData = simply.signal({ frame: true, widthAttributes: {} });
  simply.bind({
    container: dock,
    attribute: 'data-swb-inspector',
    root: dockData
  });
  const frame = dock.querySelector('iframe');
  const handle = dock.querySelector('.swb-inspector-resize');
  const refreshDockWidth = attachSidebarResize(dock, handle, {
    bounds() {
      return { minimum: 320, maximum: Math.min(704, Math.floor(innerWidth * 0.6)) };
    },
    onResize(width, min, max) {
      if (!handle.checkVisibility()) {
        return;
      }
      dock.parentElement.style.setProperty(
        '--swb-inspector-resized-width', width + 'px'
      );
      dockData.widthAttributes = {
        'aria-valuemin': min,
        'aria-valuemax': max,
        'aria-valuenow': width
      };
    }
  });
  window.addEventListener('resize', () => {
    if (dock.open) {
      refreshDockWidth();
    }
  });
  const address = new URL('../inspector/', location.href);
  const panels = new Map();
  let popup;
  let openingTimer;
  let presentation = 'dock';
  let running = false;
  let picking = false;
  let previousFocus;
  let generation = 0;
  let selection;
  let openPreview;
  let details = {
    status: pickHint,
    trail: [],
    links: [],
    parents: [],
    trailVisibility: { hidden: '' },
    linksVisibility: { hidden: '' },
    parentsVisibility: { hidden: '' }
  };

  function update() {
    const dockAction = presentation === 'window';
    const label = dockAction ? 'Dock as sidebar' : 'Open in new window';
    for (const render of panels.values()) {
      render({
        ...details,
        presentationAttributes: { 'aria-label': label, title: label },
        presentationIcon: {
          href: '../assets/feather-icons.svg#' + (dockAction ? 'sidebar' : 'external-link')
        }
      });
    }
  }

  function focusPanel(panel) {
    panel?.focus();
    if (panels.has(panel)) {
      panel.document.querySelector('[data-simply-command="swbInspectPick"]')?.focus();
    }
  }

  function showDock() {
    if (!frame.hasAttribute('src')) {
      frame.src = address.href;
    }
    if (!dock.open) {
      dock.show();
      refreshDockWidth();
    }
  }

  function releasePopup() {
    clearTimeout(openingTimer);
    const previous = popup;
    popup = undefined;
    panels.delete(previous);
    previous?.close();
  }

  function openDock() {
    showDock();
    focusPanel(frame.contentWindow);
    update();
  }

  function close() {
    running = false;
    setPicking(false);
    clearPreview();
    releasePopup();
    dock.close();
    document.removeEventListener('click', pickElement, true);
    document.removeEventListener('keydown', pickElement, true);
    previousFocus?.focus();
  }

  function togglePresentation() {
    presentation = presentation === 'window' ? 'dock' : 'window';
    setInspectorPresentation(presentation);
    if (presentation === 'dock') {
      details.status = picking ? pickHint : '';
      releasePopup();
      openDock();
    }
    else {
      openPopup();
    }
  }

  function openPopup(preparedWindow) {
    if (popup && !popup.closed) {
      popup.focus();
      return;
    }
    if (preparedWindow?.closed) {
      close();
      return;
    }
    popup = preparedWindow === undefined
      ? requestInspectorWindow(address.href)
      : preparedWindow;
    if (!popup) {
      details.status = 'The browser blocked the inspector window.';
      openDock();
      return;
    }
    if (preparedWindow) {
      popup.location.replace(address.href);
    }
    openingTimer = setTimeout(() => {
      if (popup.closed) {
        close();
        return;
      }
      details.status = 'The inspector window did not connect.';
      releasePopup();
      openDock();
    }, 15000);
  }

  function setPicking(active) {
    picking = active;
    dock.parentElement.toggleAttribute('data-swb-inspector-picking', active);
  }

  function beginPick() {
    setPicking(true);
    details.status = pickHint;
    update();
    if ((!popup || popup.closed) && !matchMedia('(min-width: 75rem)').matches) {
      dock.close();
    }
    const targets = [
      ...app.container.querySelectorAll(inspectable),
      ...shellView.container.querySelectorAll(inspectable)
    ];
    const target = targets.find((element) => element.checkVisibility());
    window.focus();
    target?.focus();
  }

  function select(owner, element, trail = [{ node: element, label: 'Picked element' }]) {
    clearPreview();
    const relationships = inspectRelationships(owner, element);
    selection = { owner, trail, ...relationships };
    details = {
      status: relationships.links.size
        ? 'Element selected.'
        : 'This element has no named app relationships.',
      trail: trail.map(({ label }, id) => {
        const current = id === trail.length - 1;
        return {
          id, label,
          button: { hidden: current ? '' : null, title: label },
          current: { hidden: current ? null : '', title: label }
        };
      }),
      links: [...relationships.links].map(([id, link]) => {
        const hasPreview = id === 'data' || hasRelationshipSource(owner, link);
        return {
          id, label: link.label, value: link.value, preview: closedPreview,
          sourceAttributes: {
            hidden: hasPreview ? null : '',
            'aria-expanded': 'false'
          },
          summaryAttributes: hasPreview ? hidden : visible
        };
      }),
      parents: relationships.parents.map(({ label, source }, id) => ({
        id, label, preview: closedPreview,
        sourceAttributes: {
          hidden: hasRelationshipSource(owner, source) ? null : '',
          'aria-expanded': 'false',
          'aria-label': 'Show source for ' + label
        }
      })),
      trailVisibility: { hidden: null },
      linksVisibility: { hidden: relationships.links.size ? null : '' },
      parentsVisibility: { hidden: relationships.parents.length ? null : '' }
    };
  }

  function navigate(index) {
    const parent = selection?.parents[index];
    if (parent) {
      navigateTrail([...selection.trail, parent]);
    }
  }

  function navigateTrail(trail) {
    const { node } = trail.at(-1);
    if (selection.owner.container.contains(node)) {
      select(selection.owner, node, trail);
      update();
    }
  }

  async function toggleSource(id, parent = false) {
    const list = parent ? 'parents' : 'links';
    const rowId = parent ? Number(id) : id;
    if (openPreview?.list === list && openPreview.id === rowId) {
      closeSource();
      return;
    }
    const link = parent ? selection?.parents[id]?.source : selection?.links.get(id);
    if (!link) {
      return;
    }
    const { owner } = selection;
    const showData = !parent && id === 'data';
    const showSource = hasRelationshipSource(owner, link);
    if (!showData && !showSource) {
      return;
    }
    clearPreview();
    const request = generation;
    openPreview = { list, id: rowId };
    let preview = {
      ...closedPreview,
      attributes: visible,
      dataVisibility: showData ? visible : hidden,
      codeVisibility: showSource ? visible : hidden,
      dataFormat: showData ? 'Data' : '',
      dataText: showData ? 'Loading value…' : '',
      code: showSource ? 'Loading source…' : ''
    };
    setPreview(preview);
    update();
    if (showData) {
      const data = await previewBoundData(owner, link.value);
      if (!running || request !== generation) {
        return;
      }
      preview = { ...preview, ...data };
      setPreview(preview);
      update();
    }
    if (!showSource) {
      return;
    }
    const source = await relationshipSource(owner, link);
    if (running && request === generation) {
      setPreview({ ...preview, ...source });
      update();
    }
  }

  function setPreview(preview) {
    const { list, id } = openPreview;
    const expanded = preview.attributes.hidden === null;
    details[list] = details[list].map((entry) => (
      entry.id === id ? {
        ...entry,
        preview,
        sourceAttributes: {
          ...entry.sourceAttributes,
          'aria-expanded': String(expanded)
        }
      } : entry
    ));
  }

  function clearPreview() {
    generation += 1;
    if (openPreview) {
      setPreview(closedPreview);
      openPreview = undefined;
    }
  }

  function closeSource() {
    clearPreview();
    update();
  }

  function pickElement(event) {
    if (!picking || !(event.target instanceof Element)) {
      return;
    }
    if (event.type === 'keydown' && !['Enter', ' ', 'Escape'].includes(event.key)) {
      return;
    }
    const owner = app.container.contains(event.target) ? app : shellView;
    if (
      event.key !== 'Escape' &&
      (!owner.container.contains(event.target) || dock.contains(event.target))
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    setPicking(false);
    if (event.key === 'Escape') {
      details.status = 'Element selection cancelled.';
    }
    else {
      select(owner, event.target);
    }
    if (!popup || popup.closed) {
      showDock();
    }
    update();
    focusPanel(popup || frame.contentWindow);
  }

  dock[connectInspector] = (panel, render) => {
    if (!running || (panel !== popup && panel !== frame.contentWindow)) {
      return;
    }
    panels.set(panel, render);
    if (panel === popup) {
      clearTimeout(openingTimer);
      dock.close();
      if (!picking) {
        details.status = '';
      }
    }
    update();
    if (panel === popup || dock.open) {
      focusPanel(panel);
    }
    return {
      pick: beginPick,
      togglePresentation,
      close,
      navigate,
      revisit(index) {
        if (selection?.trail[index]) {
          navigateTrail(selection.trail.slice(0, Number(index) + 1));
        }
      },
      toggleSource,
      closeSource,
      disconnect() {
        panels.delete(panel);
        if (panel === popup) {
          close();
        }
      }
    };
  };

  window.addEventListener('focus', () => {
    if (popup?.closed) {
      close();
    }
  });
  window.addEventListener('pagehide', () => {
    running = false;
    setPicking(false);
    releasePopup();
  });

  return (opener, preparedWindow) => {
    if (popup?.closed) {
      close();
    }
    if (running) {
      if (popup) {
        popup.focus();
      }
      else {
        openDock();
      }
      return;
    }
    previousFocus = opener;
    running = true;
    document.addEventListener('click', pickElement, true);
    document.addEventListener('keydown', pickElement, true);
    presentation = preparedWindow !== undefined ? 'window' : getInspectorPresentation();
    if (presentation === 'window') {
      openPopup(preparedWindow);
    }
    else {
      openDock();
    }
  };
}
