import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { requireOk, createSolidMetroClient } from '@muze-labs/solid-app-data';

const assets = new URL('../assets/pdf/', location.href);
GlobalWorkerOptions.workerSrc = new URL('pdf.worker.js', assets).href;

class MetroBinaryData {
  constructor(options) {
    this.options = options;
  }
  async fetch({ kind, filename }) {
    const url = new URL(filename, this.options[kind]);
    if (
      url.origin !== assets.origin ||
      !url.pathname.startsWith(assets.pathname)
    ) {
      throw new Error('documents/pdf: Invalid engine asset location.');
    }
    const client = createSolidMetroClient(url.href, {
      oidc: false,
      oldm: false
    });
    const response = requireOk(await client.get(url.href));
    return new Uint8Array(await response.arrayBuffer());
  }
}

export async function openPdf(bytes, { signal } = {}) {
  signal?.throwIfAborted();
  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: new URL('cmaps/', assets).href,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    wasmUrl: new URL('wasm/', assets).href,
    useWorkerFetch: false,
    BinaryDataFactory: MetroBinaryData,
    isEvalSupported: false,
    enableXfa: false
  });
  const cancel = () => {
    task.destroy().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const document = await task.promise;
    signal?.throwIfAborted();
    const session = new PdfSession(document, task);
    await session.prepare();
    return session;
  }
  catch (error) {
    await task.destroy();
    throw error;
  }
  finally {
    signal?.removeEventListener('abort', cancel);
  }
}

// The explicitly approved specialist surface contains PDF.js-owned nodes only.
// Application controls and annotation lists are always SimplyFlow templates.
class PdfPageView {
  constructor(document) {
    this.document = document;
    this.generation = 0;
  }
  async show(surface, number, scale, rotation) {
    this.surface = surface;
    const generation = ++this.generation;
    this.render?.cancel();
    this.textLayer?.cancel();
    const page = await this.document.getPage(number);
    if (generation !== this.generation) {
      return;
    }
    const pageRotation = (page.rotate + rotation) % 360;
    const viewport = page.getViewport({ scale, rotation: pageRotation });
    this.viewport = viewport;
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    canvas.setAttribute('aria-hidden', 'true');
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    layer.setAttribute('role', 'document');
    layer.setAttribute('aria-label', 'Page ' + number);
    layer.tabIndex = 0;
    surface.style.width = viewport.width + 'px';
    surface.style.height = viewport.height + 'px';
    surface.style.setProperty('--scale-factor', scale);
    surface.style.setProperty(
      '--total-scale-factor',
      viewport.scale * viewport.userUnit
    );
    surface.replaceChildren(canvas, layer);
    this.render = page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
    });
    // Navigation may cancel rendering while text extraction is still pending.
    // Observe immediately; the joint await below still reports active failures.
    const rendering = this.render.promise;
    rendering.catch(() => {});
    const content = await page.getTextContent({ includeMarkedContent: true });
    if (generation !== this.generation) {
      return;
    }
    this.textLayer = new TextLayer({
      textContentSource: content,
      container: layer,
      viewport
    });
    try {
      await Promise.all([rendering, this.textLayer.render()]);
    }
    catch (error) {
      if (generation !== this.generation) {
        return;
      }
      throw error;
    }
    if (generation !== this.generation) {
      return;
    }
    this.structure = await page.getStructTree();
    if (generation !== this.generation) {
      return;
    }
    this.layer = layer;
    this.page = number;
    this.paragraphs = [];
    const walk = (node) => {
      if (node.role === 'P') {
        const ids = [];
        const collect = (entry) => {
          if (entry.type === 'content') {
            ids.push(entry.id);
          }
          for (const child of entry.children || []) {
            collect(child);
          }
        };
        collect(node);
        if (ids.length) {
          this.paragraphs.push({ id: ids.join(' '), ids });
        }
      }
      for (const child of node.children || []) {
        walk(child);
      }
    };
    if (this.structure) {
      walk(this.structure);
    }
    return { page: number, paragraphs: this.paragraphs };
  }
  selection() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      return null;
    }
    const range = selection.getRangeAt(0);
    if (
      !this.layer?.contains(range.startContainer) ||
      !this.layer.contains(range.endContainer)
    ) {
      return null;
    }
    const before = range.cloneRange();
    before.selectNodeContents(this.layer);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    return {
      page: this.page,
      quote: range.toString(),
      start,
      end: start + range.toString().length
    };
  }
  dispose() {
    this.generation += 1;
    this.render?.cancel();
    this.textLayer?.cancel();
    const canvas = this.surface?.querySelector('canvas');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.surface?.replaceChildren();
  }
}

class PdfSession {
  constructor(document, task) {
    this.document = document;
    this.task = task;
    this.views = new Map();
    this.thumbnails = new Map();
    this.dimensions = new Map();
    this.page = 1;
  }
  async thumbnail(canvas, number) {
    if (this.thumbnails.get(number)?.canvas === canvas) {
      return;
    }
    const entry = { canvas, task: null };
    this.thumbnails.set(number, entry);
    const page = await this.document.getPage(number);
    if (this.thumbnails.get(number) !== entry) {
      return;
    }
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(120 / natural.width, 160 / natural.height);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    entry.task = page.render({
      canvasContext: canvas.getContext('2d'),
      viewport
    });
    try {
      await entry.task.promise;
    }
    catch (error) {
      if (this.thumbnails.get(number) === entry) {
        this.thumbnails.delete(number);
        throw error;
      }
    }
  }
  retainThumbnails(numbers = new Set()) {
    for (const [number, entry] of this.thumbnails) {
      if (!numbers.has(number)) {
        this.thumbnails.delete(number);
        entry.task?.cancel();
        entry.canvas.width = 0;
        entry.canvas.height = 0;
      }
    }
  }
  async prepare() {
    await this.measure(1);
  }
  async measure(number) {
    if (!this.dimensions.has(number)) {
      const page = await this.document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      this.dimensions.set(number, {
        width: viewport.width,
        height: viewport.height
      });
    }
    return this.dimensions.get(number);
  }
  pageDimensions(number, rotation) {
    // Unvisited pages reserve space using page one's dimensions. Learn each
    // page's own size when it approaches the viewport, without rendering all.
    const natural = this.dimensions.get(number) || this.dimensions.get(1);
    const sideways = rotation % 180 !== 0;
    return sideways
      ? { width: natural.height, height: natural.width }
      : natural;
  }
  size(number, width, zoom, rotation) {
    const page = this.pageDimensions(number, rotation);
    // Paged layout supplies the final zoomed width of a visible page.
    const scale =
      this.readingMode === 'continuous'
        ? Math.min(2, Math.max(0.25, (width - 24) / page.width)) * zoom
        : width / page.width;
    return { width: page.width * scale, height: page.height * scale, scale };
  }
  async render(surface, number, width, zoom, rotation) {
    const key = [width, zoom, rotation].join('/');
    let view = this.views.get(number);
    if (view?.key === key && view.surface === surface) {
      await view.pending;
      return view;
    }
    view?.dispose();
    view = new PdfPageView(this.document);
    view.key = key;
    view.surface = surface;
    this.views.set(number, view);
    view.pending = (async () => {
      await this.measure(number);
      if (this.views.get(number) !== view) {
        return;
      }
      const { scale } = this.size(number, width, zoom, rotation);
      await view.show(surface, number, scale, rotation);
    })();
    try {
      await view.pending;
      return view;
    }
    catch (error) {
      if (this.views.get(number) === view) {
        this.views.delete(number);
        view.dispose();
        throw error;
      }
    }
  }
  retain(numbers) {
    const selection = window.getSelection();
    for (const [number, view] of this.views) {
      // Preserve keyboard focus and an in-progress text selection even when
      // their page has scrolled outside the normal rendering window.
      const pinned =
        view.surface.contains(document.activeElement) ||
        (selection?.rangeCount &&
          !selection.isCollapsed &&
          (view.surface.contains(selection.anchorNode) ||
            view.surface.contains(selection.focusNode)));
      if (!numbers.has(number) && !pinned) {
        this.views.delete(number);
        view.dispose();
      }
    }
  }
  clearViews() {
    for (const view of this.views.values()) {
      view.dispose();
    }
    this.views.clear();
  }
  get layer() {
    return this.views.get(this.page)?.layer;
  }
  get paragraphs() {
    return this.views.get(this.page)?.paragraphs || [];
  }
  selection() {
    for (const view of this.views.values()) {
      const selected = view.selection();
      if (selected) {
        return selected;
      }
    }
    return null;
  }
  async outline() {
    const result = [];
    const visit = async (items, depth = 0) => {
      for (const item of items || []) {
        const destination =
          typeof item.dest === 'string'
            ? await this.document.getDestination(item.dest)
            : item.dest;
        if (destination) {
          const reference = destination[0];
          const index = Number.isInteger(reference)
            ? reference
            : await this.document.getPageIndex(reference);
          result.push({
            page: index + 1,
            title: '› '.repeat(depth) + item.title
          });
        }
        await visit(item.items, depth + 1);
      }
    };
    await visit(await this.document.getOutline());
    return result;
  }
  async search(text, accept = () => true, receive = () => {}) {
    const query = text.toLowerCase();
    if (!query) {
      return;
    }
    for (
      let number = 1;
      number <= this.document.numPages && accept();
      number += 1
    ) {
      const page = await this.document.getPage(number);
      const content = await page.getTextContent();
      if (!accept()) {
        return;
      }
      // Search readable text with spaces between PDF runs; keep an offset map
      // into TextLayer's concatenated text for precise highlight ranges.
      let source = '';
      let readable = '';
      const offsets = [];
      for (const item of content.items) {
        const text = item.str || '';
        if (!text) {
          continue;
        }
        if (readable) {
          readable += ' ';
          offsets.push(source.length);
        }
        for (let index = 0; index < text.length; index += 1) {
          offsets.push(source.length + index);
        }
        readable += text;
        source += text;
      }
      const lower = readable.toLowerCase();
      for (
        let found = lower.indexOf(query);
        found >= 0;
        found = lower.indexOf(query, found + query.length)
      ) {
        const start = offsets[found];
        const end = offsets[found + query.length - 1] + 1;
        receive({
          page: number,
          start,
          end,
          quote: source.slice(start, end),
          context: readable.slice(
            Math.max(0, found - 45),
            found + query.length + 65
          )
        });
      }
    }
  }
  async find(text, after = 0) {
    const query = text.toLocaleLowerCase();
    for (let offset = 0; offset < this.document.numPages; offset += 1) {
      const pageNumber = ((after + offset) % this.document.numPages) + 1;
      const page = await this.document.getPage(pageNumber);
      const content = await page.getTextContent();
      if (
        content.items
          .map((item) => item.str || '')
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)
      ) {
        return pageNumber;
      }
    }
    return null;
  }
  async dispose() {
    this.retainThumbnails();
    this.clearViews();
    await this.task.destroy();
  }
}

export async function readPdfBytes(
  client,
  url,
  { signal, limit = 32 * 1024 * 1024, progress = () => {} } = {}
) {
  const response = requireOk(
    await client.get(url, {
      signal,
      headers: { Accept: 'application/pdf' }
    })
  );
  const length = Number(response.headers.get('content-length'));
  if (length > limit) {
    await response.body?.cancel();
    throw new Error(
      'documents/pdf: PDF exceeds the 32 MiB reading limit. Download it to use another reader.'
    );
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > limit) {
        throw new Error('documents/pdf: PDF exceeds the 32 MiB reading limit.');
      }
      chunks.push(value);
      progress(size, length);
    }
  }
  finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.byteLength;
  }
  return bytes;
}
