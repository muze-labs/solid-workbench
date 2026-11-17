import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startChrome } from './support/chrome.mjs';
import { independentViewPeer } from './support/independent-view-peer.mjs';

const objects = [
  '<< /Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R /MarkInfo << /Marked true >> /Outlines 9 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /StructParents 0 >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length 69 >>\nstream\n/P << /MCID 0 >> BDC BT /F1 18 Tf 30 450 Td (A document for annotations) Tj 0 -30 Td (Second line) Tj ET EMC\nendstream',
  '<< /Type /StructTreeRoot /K [7 0 R] /ParentTree 8 0 R >>',
  '<< /Type /StructElem /S /P /P 6 0 R /Pg 3 0 R /K 0 >>',
  '<< /Nums [0 [7 0 R]] >>',
  '<< /Type /Outlines /First 10 0 R /Last 10 0 R /Count 1 >>',
  '<< /Title (First section) /Parent 9 0 R /Dest [3 0 R /Fit] >>'
];
objects[4] = objects[4].replace(
  '/Length 69',
  '/Length ' + objects[4].split('stream\n')[1].split('\nendstream')[0].length
);
function buildPdf(entries) {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < entries.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${entries[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${entries.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, '0') + ' 00000 n ')
    .join(
      '\n'
    )}\ntrailer\n<< /Size ${entries.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
const pdf = buildPdf(objects);
let origin;
let sharedAnnotationFile = '';
const requests = [];
const groupWrites = [];
let transferBytes = 0;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  requests.push(url.pathname);
  if (url.pathname === '/nickname') {
    res.writeHead(200, { 'Content-Type': 'text/turtle' });
    res.end(
      `<${origin}/nickname#me> <http://xmlns.com/foaf/0.1/givenName> "Robin".`
    );
    return;
  }
  if (url.pathname === '/shared/notes.ttl') {
    res.writeHead(200, { 'Content-Type': 'text/turtle', ETag: '"shared-v1"' });
    res.end(sharedAnnotationFile);
    return;
  }
  if (url.pathname === '/note-editor/') {
    const source = independentViewPeer(origin)
      .replaceAll('capabilities/view-resource', 'capabilities/edit-note-body')
      .replace(
        /generation=data.input.input.generation;[\s\S]*?constraints:\{minWidth:160\}\}\};/,
        `result={result:{version:1,id:data.input.input.id,
          html:'<p>Independent editor body</p><img src="/leak" onerror="window.injected=true">'}};`
      );
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(source);
    return;
  }
  if (url.pathname.startsWith('/annotations/') && req.method === 'PUT') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    groupWrites.push({ url: url.href, headers: req.headers, body });
    res.writeHead(201, { ETag: '"saved-group"' }).end();
    return;
  }
  if (url.pathname === '/profile') {
    res.writeHead(200, { 'Content-Type': 'text/turtle' });
    res.end(
      `<${origin}/profile#me> <http://www.w3.org/ns/pim/space#storage> <${origin}/storage/>.`
    );
    return;
  }
  if (url.pathname === '/storage/') {
    res.writeHead(200, { 'Content-Type': 'text/turtle' });
    res.end(`<${origin}/storage/> a <http://www.w3.org/ns/ldp#BasicContainer>;
      <http://www.w3.org/ns/ldp#contains> <${origin}/storage/report.pdf>.`);
    return;
  }
  if (url.pathname === '/many-pages.pdf') {
    const pages = [...objects];
    const references = ['3 0 R'];
    for (let number = 2; number <= 24; number += 1) {
      references.push(pages.length + 1 + ' 0 R');
      let entry = objects[2].replace('/StructParents 0', '');
      if (number === 12) {
        entry = entry.replace('[0 0 400 500]', '[0 0 600 300]');
      }
      pages.push(entry);
    }
    pages[1] =
      '<< /Type /Pages /Kids [' + references.join(' ') + '] /Count 24 >>';
    res
      .writeHead(200, { 'Content-Type': 'application/pdf' })
      .end(buildPdf(pages));
    return;
  }
  if (url.pathname === '/outlined.pdf') {
    const outlined = [...objects];
    outlined[1] = '<< /Type /Pages /Kids [3 0 R 11 0 R] /Count 2 >>';
    outlined[8] = '<< /Type /Outlines /First 10 0 R /Last 12 0 R /Count 2 >>';
    outlined[9] =
      '<< /Title (First section) /Parent 9 0 R /Next 12 0 R /Dest [3 0 R /Fit] >>';
    outlined.push(objects[2].replace('/StructParents 0', ''));
    outlined.push(
      '<< /Title (Second section) /Parent 9 0 R /Prev 10 0 R /Dest [11 0 R /Fit] >>'
    );
    res
      .writeHead(200, { 'Content-Type': 'application/pdf' })
      .end(buildPdf(outlined));
    return;
  }
  if (url.pathname === '/rotated.pdf') {
    const rotated = objects.map((entry, index) =>
      index === 2 ? entry.replace('/MediaBox', '/Rotate 90 /MediaBox') : entry
    );
    res
      .writeHead(200, { 'Content-Type': 'application/pdf' })
      .end(buildPdf(rotated));
    return;
  }
  if (url.pathname === '/broken.pdf') {
    res.writeHead(200, { 'Content-Type': 'application/pdf' }).end('Not a PDF');
    return;
  }
  if (url.pathname === '/slow.pdf') {
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.write(pdf.slice(0, 20));
    const timer = setTimeout(() => res.end(pdf.slice(20)), 1000);
    req.on('close', () => clearTimeout(timer));
    return;
  }
  if (url.pathname === '/no-text.pdf') {
    const withoutText = pdf
      .replace(
        /stream\n([\s\S]*?)\nendstream/,
        (_match, content) =>
          'stream\n' +
          'q 0.8 g 20 20 200 300 re f Q'.padEnd(content.length, ' ') +
          '\nendstream'
      )
      .replace(
        '/StructTreeRoot 6 0 R /MarkInfo << /Marked true >> /Outlines 9 0 R',
        (value) => ' '.repeat(value.length)
      );
    res.writeHead(200, { 'Content-Type': 'application/pdf' }).end(withoutText);
    return;
  }
  if (['/report.pdf', '/storage/report.pdf'].includes(url.pathname)) {
    transferBytes += Buffer.byteLength(pdf);
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(pdf);
    return;
  }
  try {
    const filename = path.resolve(
      'www',
      '.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '')
    );
    if (!filename.startsWith(path.resolve('www') + path.sep)) {
      throw new Error('outside');
    }
    const content = await readFile(filename);
    transferBytes += content.byteLength;
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      // Deliberately match an already-running pre-PDF dev server: no .mjs MIME.
      '.wasm': 'application/wasm',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.ttl': 'text/turtle'
    };
    res.writeHead(200, {
      'Content-Type':
        types[path.extname(filename)] || 'application/octet-stream'
    });
    res.end(content);
  }
  catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const browser = await startChrome(origin + '/seed');
try {
  const page = await browser.page();
  await page.ready();
  let exception;
  page.once('Runtime.exceptionThrown').then((value) => {
    exception = value;
  });
  const slow = process.env.DOCUMENTS_SLOW === '1';
  if (slow) {
    await page.send('Network.enable');
    await page.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 125 * 1024,
      uploadThroughput: 50 * 1024
    });
  }
  requests.length = 0;
  transferBytes = 0;
  const started = Date.now();
  await page.send('Page.navigate', { url: origin + '/documents/' });
  if (!slow) {
    await page.ready();
  }
  for (let i = 0; i < 1200; i += 1) {
    if (await page.evaluate(() => Boolean(window.muzeSolidDocumentsApp))) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(
    await page.evaluate(() => Boolean(window.muzeSolidDocumentsApp)),
    await page.evaluate(() => document.body.innerText)
  );
  await page.evaluate(async () => {
    try {
      await muzeSolidDocumentsApp.actions.muzeDocumentsLoad(
        location.origin + '/report.pdf'
      );
    }
    catch (error) {
      throw new Error(error.message + ' ' + error.details);
    }
  });
  assert.match(
    await page.evaluate(() => document.body.innerText),
    /Page 1 of 1/
  );
  assert.equal(
    await page.evaluate(
      () => muzeSolidDocumentsApp.runtime.pdf.paragraphs.length
    ),
    1
  );
  assert.equal(
    await page.evaluate(
      () => muzeSolidDocumentsApp.data.muzeDocumentsOutline[0].title
    ),
    'First section'
  );
  if (!slow) {
    await page.evaluate(() => {
      document.querySelector('[data-simply-value="find"]').focus();
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
      windowsVirtualKeyCode: 13
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13
    });
    assert(
      await page.evaluate(
        () =>
          document.querySelector('[data-document-dialog="find"]').open &&
          document.activeElement.closest('dialog') !== null
      ),
      'Search opens as a focused modal from the toolbar'
    );
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await page.evaluate(async () => {
      for (
        let i = 0;
        i < 100 && document.querySelector('[data-document-dialog="find"]').open;
        i += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    });
    assert(
      await page.evaluate(
        () =>
          !document.querySelector('[data-document-dialog="find"]').open &&
          document.activeElement.dataset.simplyValue === 'find'
      ),
      'Escape closes search and restores toolbar focus'
    );
    for (const width of [390, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width === 390
      });
      await page.evaluate(async () => {
        const app = muzeSolidDocumentsApp;
        await app.commands.muzeDocumentsDialog.call(app, null, 'groups');
        const dialog = app.container.querySelector(
          '[data-document-dialog="groups"]'
        );
        const bounds = dialog.getBoundingClientRect();
        const content = dialog.querySelector(
          '.muze-solid-design-dialog-content'
        );
        if (
          bounds.left < 0 ||
          bounds.right > innerWidth + 1 ||
          bounds.top < 0 ||
          bounds.bottom > innerHeight + 1 ||
          content.scrollWidth > content.clientWidth + 1
        ) {
          throw new Error('Annotation dialog exceeds the available viewport.');
        }
      });
      const dialogShot = await page.send('Page.captureScreenshot', {
        format: 'png'
      });
      await writeFile(
        '/tmp/cyc260-groups-' + width + '.png',
        Buffer.from(dialogShot.data, 'base64')
      );
      await page.evaluate(async () => {
        const app = muzeSolidDocumentsApp;
        await app.actions.muzeSolidDesignCloseDialog(
          app.container.querySelector('[data-document-dialog="groups"]')
        );
      });
    }
    await page.evaluate(async () => {
      await muzeSolidDocumentsApp.actions.muzeDocumentsLoad(
        location.origin + '/outlined.pdf'
      );
      document
        .querySelector('[data-simply-command="muzeDocumentsToggleOutline"]')
        .click();
    });
    for (const width of [390, 1440]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width === 390
      });
      for (const targetPage of [2, 1]) {
        await page.send('Runtime.evaluate', {
          expression:
            'document.documentElement.dataset.outlineTarget = ' + targetPage
        });
        await page.evaluate(async () => {
          const target = Number(document.documentElement.dataset.outlineTarget);
          const app = muzeSolidDocumentsApp;
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (app.data.muzeDocumentsOutlinePanel.hidden !== null) {
            await app.commands.muzeDocumentsToggleOutline.call(app);
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          const entry = app.container.querySelectorAll(
            '.muze-documents-outline-link'
          )[target - 1];
          entry.focus();
          entry.click();
          for (let i = 0; i < 100; i += 1) {
            if (app.data.muzeDocumentsLocation === 'Page ' + target + ' of 2') {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
          const narrow = innerWidth <= 719;
          const outline = app.container.querySelector(
            '.muze-documents-outline'
          );
          const paper = app.container.querySelector(
            '.muze-documents-paper-scroll'
          );
          if (
            app.runtime.pdf.page !== target ||
            (narrow ? outline.checkVisibility() : !outline.checkVisibility()) ||
            (!narrow &&
              outline.getBoundingClientRect().right >
                paper.getBoundingClientRect().left + 1) ||
            paper.clientWidth < 100 ||
            app.container.querySelector('dialog[open]')
          ) {
            throw new Error(
              'Outline must remain beside desktop pages and dismiss its phone overlay.'
            );
          }
        });
      }
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(
        '/tmp/cyc260-outline-' + width + '.png',
        Buffer.from(shot.data, 'base64')
      );
    }
    await page.evaluate(async () => {
      document
        .querySelector('[data-simply-command="muzeDocumentsToggleOutline"]')
        .click();
      await muzeSolidDocumentsApp.actions.muzeDocumentsLoad(
        location.origin + '/report.pdf'
      );
    });
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await page.evaluate(async () => {
      await muzeSolidDocumentsApp.actions.muzeDocumentsLoad(
        location.origin + '/many-pages.pdf'
      );
    });
    const scrollPoint = await page.evaluate(() => {
      const bounds = document
        .querySelector('.muze-documents-paper-scroll')
        .getBoundingClientRect();
      return {
        x: bounds.left + 50,
        y: bounds.top + 100,
        delta: bounds.height * 1.4
      };
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: scrollPoint.x,
      y: scrollPoint.y,
      deltaX: 0,
      deltaY: scrollPoint.delta
    });
    await page.evaluate(async () => {
      for (
        let i = 0;
        i < 100 && muzeSolidDocumentsApp.runtime.page === 1;
        i += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (muzeSolidDocumentsApp.runtime.page === 1) {
        throw new Error('Native scrolling did not advance to another page.');
      }
      document.querySelector('.muze-documents-paper-scroll').focus();
    });
    for (const [key, code, target] of [
      ['End', 35, 24],
      ['Home', 36, 1]
    ]) {
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code: key,
        windowsVirtualKeyCode: code
      });
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code: key,
        windowsVirtualKeyCode: code
      });
      await page.send('Runtime.evaluate', {
        expression: 'document.documentElement.dataset.scrollTarget = ' + target
      });
      await page.evaluate(async () => {
        const target = Number(document.documentElement.dataset.scrollTarget);
        const app = muzeSolidDocumentsApp;
        for (let i = 0; i < 200; i += 1) {
          if (
            app.runtime.pdf.page === target &&
            app.runtime.pdf.layer?.textContent &&
            !app.runtime.pdf.views.has(target === 24 ? 1 : 24)
          ) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        const pdf = app.runtime.pdf;
        if (
          pdf.page !== target ||
          !pdf.layer?.textContent ||
          pdf.views.size > 8 ||
          pdf.views.has(target === 24 ? 1 : 24)
        ) {
          throw new Error(
            'Scrolling must render the destination and release distant canvases: ' +
              pdf.page +
              '/' +
              pdf.views.size
          );
        }
        const text = document
          .createTreeWalker(pdf.layer, NodeFilter.SHOW_TEXT)
          .nextNode();
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, Math.min(10, text.length));
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        if (pdf.selection()?.page !== target) {
          throw new Error(
            'Text selection was anchored to the wrong scrolled page.'
          );
        }
        getSelection().removeAllRanges();
        document.querySelector('.muze-documents-paper-scroll').focus();
      });
    }
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      await app.actions.muzeDocumentsShow(12);
      const surface = app.container.querySelector(
        '[data-pdf-page="12"] [data-pdf-surface]'
      );
      if (surface.clientWidth <= surface.clientHeight) {
        throw new Error(
          'Mixed page dimensions were not learned on navigation.'
        );
      }
      await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
    });
  }
  if (!slow) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      await app.actions.muzeDocumentsLoad(location.origin + '/many-pages.pdf');
      await app.actions.muzeDocumentsShow(12, 0.25);
      const surface = () =>
        app.container.querySelector('[data-pdf-page="12"] [data-pdf-surface]');
      const before = surface().getBoundingClientRect().width;
      await app.commands.muzeDocumentsToggleOutline.call(app);
      await app.commands.muzeDocumentsNotes.call(app);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (Math.abs(surface().getBoundingClientRect().width - before) > 1) {
        throw new Error('Opening sidebars changed the PDF scale.');
      }
      const outline = app.container.querySelector('.muze-documents-outline');
      const firstEntry = outline
        .querySelector('button')
        .getBoundingClientRect();
      if (firstEntry.left - outline.getBoundingClientRect().left > 12) {
        throw new Error('Outline retains a prose-list indentation.');
      }
      await app.commands.muzeDocumentsZoom.call(app, null, 0.25);
      await app.actions.muzeDocumentsShow(12, 0.25);
      await app.actions.muzeDocumentsFlushReader();
      await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
      if (
        app.runtime.zoom !== 1.25 ||
        app.data.muzeDocumentsOutlinePanel.hidden !== null ||
        app.data.muzeDocumentsNotesPanel.hidden !== null
      ) {
        throw new Error('Reader settings did not carry to another document.');
      }
      await app.actions.muzeDocumentsLoad(location.origin + '/many-pages.pdf');
      const position = app.actions.muzeDocumentsCapturePosition();
      if (position.page !== 12 || Math.abs(position.fraction - 0.25) > 0.03) {
        throw new Error(
          'Reopening lost the per-document reading position: ' +
            JSON.stringify(position)
        );
      }
      await app.actions.muzeDocumentsFlushReader();
    });
    await page.send('Page.reload');
    await page.ready();
    await page.evaluate(async () => {
      for (let i = 0; i < 100 && !window.muzeSolidDocumentsApp; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const app = muzeSolidDocumentsApp;
      await app.actions.muzeDocumentsLoad(location.origin + '/many-pages.pdf');
      const position = app.actions.muzeDocumentsCapturePosition();
      if (
        app.runtime.zoom !== 1.25 ||
        position.page !== 12 ||
        Math.abs(position.fraction - 0.25) > 0.03 ||
        app.data.muzeDocumentsOutlinePanel.hidden !== null
      ) {
        throw new Error(
          'Reader preferences or page position did not survive reload.'
        );
      }
      await app.runtime.readerState.save({
        settings: { zoom: 1, outlineOpen: false, annotationsOpen: false }
      });
      await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
    });
  }
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  if (slow) {
    console.log('Cold PDF page at 125 KiB/s, 150 ms (uncompressed fixture):', {
      milliseconds: Date.now() - started,
      bytes: transferBytes,
      requests: requests.length
    });
  }
  assert(
    !requests.some((url) => url.includes('cobalt')),
    'reading does not load Cobalt'
  );
  await page.evaluate(() => {
    document
      .querySelector('[data-simply-command="muzeDocumentsPageNote"]')
      .focus();
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    text: '\r',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await page.evaluate(async () => {
    for (
      let i = 0;
      i < 100 && !muzeSolidDocumentsApp.runtime.noteEditor;
      i += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!muzeSolidDocumentsApp.runtime.noteEditor) {
      throw new Error(
        'Keyboard page annotation did not open. ' +
          document.activeElement?.outerHTML +
          ' ' +
          document.body.innerText
      );
    }
  });
  if (slow) {
    console.log('Cold PDF plus first annotation editor:', {
      milliseconds: Date.now() - started,
      bytes: transferBytes,
      requests: requests.length
    });
    await page.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
  }
  await page.evaluate(() => {
    const editor = muzeSolidDocumentsApp.runtime.noteEditor.editor;
    editor.focus();
  });
  await page.send('Input.insertText', { text: 'My personal note' });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    const dialog = app.container.querySelector(
      '[data-document-dialog="annotation"]'
    );
    if (
      !dialog.open ||
      dialog.textContent.includes('Use note') ||
      dialog.textContent.includes('Export draft')
    ) {
      throw new Error(
        'Annotation editing must use the focused Save/Close dialog.'
      );
    }
    app.runtime.noteEditor.editor.focus(0, 2);
    app.actions.muzeDocumentsNoteSelection();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    app.container
      .querySelector(
        '[data-simply-command="muzeDocumentsFormat"][data-simply-value="strong"]'
      )
      .click();
    await app.commands.muzeDocumentsLink.call(app);
    const link = app.container.querySelector(
      '[data-document-dialog="annotation-link"]'
    );
    if (!link.open || !dialog.open) {
      throw new Error(
        'The hyperlink dialog must open above the annotation dialog.'
      );
    }
    link.querySelector('[name="href"]').value = 'https://example.org/reference';
    await app.commands.muzeDocumentsApplyLink.call(
      app,
      link.querySelector('form')
    );
    if (
      link.open ||
      !app.runtime.noteEditor.editor
        .getValue()
        .annotations.some((item) =>
          item.tag.includes('https://example.org/reference')
        )
    ) {
      throw new Error(
        'The hyperlink was not applied: ' +
          app.data.muzeDocumentsLinkStatus +
          ' ' +
          JSON.stringify(app.runtime.noteRange) +
          ' ' +
          JSON.stringify(app.runtime.noteEditor.editor.getValue())
      );
    }
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    app.actions.muzeDocumentsNotePosition();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const toolbar = app.container.querySelector('[data-note-formatting]');
    const save = app.container.querySelector(
      '[data-simply-command="muzeDocumentsSaveNote"]'
    );
    const a = toolbar.getBoundingClientRect();
    const b = save.getBoundingClientRect();
    if (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    ) {
      throw new Error('The floating formatting toolbar obscures Save.');
    }
  });
  const annotationScreenshot = await page.send('Page.captureScreenshot', {
    format: 'png'
  });
  await writeFile(
    '/tmp/cyc260-annotation-dialog.png',
    Buffer.from(annotationScreenshot.data, 'base64')
  );

  await page.evaluate(async () => {
    await muzeSolidDocumentsApp.runtime.editorPending;
    const editor = muzeSolidDocumentsApp.runtime.noteEditor.editor;
    editor.focus(editor.getText().length);
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    modifiers: 2,
    code: 'Enter',
    text: '\r',
    windowsVirtualKeyCode: 13
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    modifiers: 2,
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    if (app.data.muzeDocumentsNotesPanel.hidden !== null) {
      document
        .querySelector('[data-simply-command="muzeDocumentsNotes"]')
        .click();
    }
    for (
      let i = 0;
      i < 100 &&
      (muzeSolidDocumentsApp.runtime.noteEditor ||
        !document.body.innerText.includes('My personal note'));
      i += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  assert.match(
    await page.evaluate(() => document.body.innerText),
    /My personal note/
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await page.evaluate(() => muzeSolidDocumentsApp.actions.muzeDocumentsShow(1));
  const screenshot = await page.send('Page.captureScreenshot', {
    format: 'png'
  });
  await writeFile(
    '/tmp/cyc260-documents-phone.png',
    Buffer.from(screenshot.data, 'base64')
  );
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    const note = app.runtime.group.annotations()[0];
    const native = app.runtime.group.fragment(note.id);
    if (
      !native?.annotations.some((item) =>
        item.tag.includes('https://example.org/reference')
      )
    ) {
      throw new Error('Saving the annotation lost its native Cobalt fragment.');
    }
    await app.actions.muzeDocumentsEdit(note.id);
    app.runtime.noteEditor.editor.focus();
  });
  await page.send('Input.insertText', { text: 'Unsent draft' });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    await app.runtime.editorPending;
    if (!(await app.runtime.editorSource.load()).includes('Unsent draft')) {
      throw new Error('Native typing was not preserved as a draft.');
    }
    let blocked = false;
    try {
      await app.runtime.host.beforeAccountLeave();
    }
    catch {
      blocked = true;
    }
    if (!blocked) {
      throw new Error('Account change did not protect the editor.');
    }
  });
  await page.send('Page.reload');
  await page.ready();
  await page.evaluate(async () => {
    for (let i = 0; i < 100 && !window.muzeSolidDocumentsApp; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    try {
      await muzeSolidDocumentsApp.actions.muzeDocumentsLoad(
        location.origin + '/report.pdf'
      );
    }
    catch (error) {
      throw new Error(error.message + ' ' + error.details);
    }
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    if (app.data.muzeDocumentsNotesPanel.hidden !== null) {
      document
        .querySelector('[data-simply-command="muzeDocumentsNotes"]')
        .click();
    }
    for (
      let i = 0;
      i < 100 &&
      (muzeSolidDocumentsApp.runtime.noteEditor ||
        !document.body.innerText.includes('My personal note'));
      i += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  assert.match(
    await page.evaluate(() => document.body.innerText),
    /My personal note/
  );
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    const savedHtml = app.runtime.group.annotations()[0].html;
    await app.actions.muzeDocumentsEdit(app.runtime.group.annotations()[0].id);
    if (
      !app.runtime.noteEditor.editor.getValue().text.includes('Unsent draft')
    ) {
      throw new Error('Unsubmitted draft did not survive reload.');
    }
    await app.commands.muzeDocumentsCloseNote.call(app);
    if (app.runtime.group.annotations()[0].html !== savedHtml) {
      throw new Error('Closing recovered edits changed the saved note.');
    }
    if (!(await app.runtime.editorSource.load()).includes('Unsent draft')) {
      throw new Error('Closing the editor lost its local draft.');
    }
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    const group = app.runtime.group;
    app.runtime.host.preferences.noteBodyProvider = {
      url: location.origin + '/documents/'
    };
    window.pendingNoteEdit = app.actions.muzeDocumentsEdit(
      group.annotations()[0].id
    );
  });
  await page.evaluate(async () => {
    let editor;
    for (let i = 0; i < 200; i += 1) {
      editor = document.querySelector('.muze-solid-ui-capability-frame')
        ?.contentWindow.muzeSolidDocumentsApp;
      if (editor?.runtime.noteEditor) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!editor?.runtime.noteEditor) {
      throw new Error('Default editor capability did not open.');
    }
    editor.runtime.noteEditor.editor.setValue({
      text: 'Edited through capability',
      annotations: []
    });
    await editor.actions.muzeDocumentsFinishNote(true);
    await window.pendingNoteEdit;
    if (
      muzeSolidDocumentsApp.runtime.group.annotations()[0].html !==
      'Edited through capability'
    ) {
      throw new Error('Default editor did not return portable HTML.');
    }
    window.pendingNoteEdit = muzeSolidDocumentsApp.actions
      .muzeDocumentsEdit(
        muzeSolidDocumentsApp.runtime.group.annotations()[0].id
      )
      .catch(() => {});
  });
  await page.evaluate(async () => {
    let editor;
    for (let i = 0; i < 200; i += 1) {
      editor = document.querySelector('.muze-solid-ui-capability-frame')
        ?.contentWindow.muzeSolidDocumentsApp;
      if (editor?.runtime.noteEditor) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!editor?.runtime.noteEditor || editor.runtime.editorConflict) {
      throw new Error(
        'An acknowledged provider result must reopen without a conflict.'
      );
    }
    await editor.actions.muzeDocumentsFinishNote(false);
    await window.pendingNoteEdit;
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    const group = app.runtime.group;
    app.runtime.host.preferences.noteBodyProvider = {
      url: location.origin + '/note-editor/'
    };
    await app.actions.muzeDocumentsEdit(group.annotations()[0].id);
    if (!group.annotations()[0].html.includes('Independent editor body')) {
      throw new Error('Replacement capability provider did not update HTML.');
    }
    const session = {
      webId: '',
      perform: (fn) => fn(),
      client: app.api.createSolidMetroClient(location.origin, {
        oidc: false,
        oldm: false
      })
    };
    await app.api.createGroupDestination(
      session,
      group,
      location.origin + '/annotations/'
    );
    await app.api.saveGroup(session, group);
    await app.actions.muzeDocumentsPersist();
    const requireSession = app.runtime.host.requireSession;
    app.runtime.host.requireSession = () => session;
    try {
      const saving = app.commands.call('muzeDocumentsSave');
      app.runtime.group = new app.api.AnnotationGroup();
      let blocked = false;
      try {
        await app.runtime.host.beforeAccountLeave();
      }
      catch {
        blocked = true;
      }
      if (!blocked) {
        throw new Error(
          'An in-flight group save did not protect account ownership.'
        );
      }
      await saving;
    }
    finally {
      app.runtime.group = group;
      app.runtime.host.requireSession = requireSession;
    }
  });
  assert.equal(groupWrites.length, 2);
  assert.equal(groupWrites[0].headers['if-none-match'], '*');
  assert.equal(groupWrites[1].headers['if-match'], '"saved-group"');
  assert.equal(
    groupWrites[1].url,
    groupWrites[0].url,
    'changing the selected group cannot redirect an in-flight save'
  );
  assert(!requests.includes('/leak'), 'HTML display strips remote media');
  assert.equal(await page.evaluate(() => Boolean(window.injected)), false);
  await page.send('Page.reload');
  await page.ready();
  await page.evaluate(async () => {
    for (let i = 0; i < 100 && !window.muzeSolidDocumentsApp; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const app = muzeSolidDocumentsApp;
    await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
    const group = app.runtime.group;
    if (group.remote?.etag !== '"saved-group"' || !group.remote.source) {
      throw new Error(
        'Remote validator and native baseline did not survive reload.'
      );
    }
    const store = app.actions.muzeDocumentsStore(group.root.id);
    const changed = new app.api.AnnotationGroup(await store.load());
    changed.setBody(changed.annotations()[0].id, '<p>Other tab note</p>');
    await store.save(changed.write());
    group.setBody(group.annotations()[0].id, '<p>My conflicting draft</p>');
    await app.actions.muzeDocumentsPersist();
    app.actions.muzeDocumentsRefresh();
  });
  await page.send('Page.reload');
  await page.ready();
  await page.evaluate(async () => {
    for (let i = 0; i < 100 && !window.muzeSolidDocumentsApp; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const groups = [...muzeSolidDocumentsApp.runtime.groups.values()];
    if (
      !groups.some(
        (group) => group.annotations()[0]?.html === '<p>Other tab note</p>'
      ) ||
      !groups.some(
        (group) =>
          group.localConflict &&
          group.annotations()[0]?.html === '<p>My conflicting draft</p>'
      )
    ) {
      throw new Error('Both conflicting versions must survive reload.');
    }
  });
  assert.equal(exception, undefined, JSON.stringify(exception));
  await page.evaluate(async () => {
    await muzeSolidDocumentsApp.actions.muzeDocumentsLoad(
      location.origin + '/report.pdf'
    );
    // Reader preferences now survive reload; close the phone notes overlay
    // before selecting text on the paper underneath it.
    if (muzeSolidDocumentsApp.data.muzeDocumentsNotesPanel.hidden === null) {
      await muzeSolidDocumentsApp.commands.muzeDocumentsNotes.call(
        muzeSolidDocumentsApp
      );
    }
    muzeSolidDocumentsApp.runtime.pdf.layer.scrollIntoView({ block: 'center' });
  });
  const textBounds = await page.evaluate(() => {
    const span = muzeSolidDocumentsApp.runtime.pdf.layer.querySelector(
      'span:not(.markedContent)'
    );
    const box = span.getBoundingClientRect();
    return { x: box.left + 1, y: box.top + box.height / 2, end: box.right - 1 };
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: textBounds.x,
    y: textBounds.y,
    button: 'left',
    clickCount: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: textBounds.end,
    y: textBounds.y,
    button: 'left',
    buttons: 1
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: textBounds.end,
    y: textBounds.y,
    button: 'left',
    clickCount: 1
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    if (!app.runtime.pdf.selection()?.quote) {
      throw new Error('Native PDF text selection is unavailable.');
    }
    await app.commands.call('muzeDocumentsSelectionNote');
    app.runtime.noteEditor.editor.setValue({
      text: 'A highlighted note',
      annotations: []
    });
    await app.actions.muzeDocumentsFinishNote(true);
    if (!CSS.highlights.get('muze-document-notes')?.size) {
      throw new Error('Stored selected text did not become a highlight.');
    }
    const paragraph = app.runtime.pdf.paragraphs[0].id;
    await app.commands.call('muzeDocumentsParagraphNote', null, paragraph);
    app.runtime.noteEditor.editor.setValue({
      text: 'A paragraph note',
      annotations: []
    });
    await app.actions.muzeDocumentsFinishNote(true);
    if (
      CSS.highlights.get('muze-document-notes').size < 2 ||
      !app.runtime.group
        .annotations()
        .some((note) => note.paragraph === paragraph)
    ) {
      throw new Error(
        'Tagged paragraph annotation did not retain and highlight its marker.'
      );
    }
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
    const source = app.runtime.document;
    let failed = false;
    try {
      await app.actions.muzeDocumentsLoad(location.origin + '/broken.pdf');
    }
    catch {
      failed = true;
    }
    if (!failed || app.runtime.document !== source) {
      throw new Error('Malformed PDF replaced the current document.');
    }
    const pending = app.actions.muzeDocumentsLoad(
      location.origin + '/slow.pdf'
    );
    pending.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 50));
    app.runtime.loading.abort();
    try {
      await pending;
    }
    catch {
      /* Expected transport cancellation. */
    }
    if (app.runtime.document !== source) {
      throw new Error('Cancelled load replaced the current document.');
    }
    await app.actions.muzeDocumentsLoad(location.origin + '/rotated.pdf');
    const rotated = app.container
      .querySelector('[data-pdf-surface]')
      .getBoundingClientRect();
    if (rotated.width <= rotated.height) {
      throw new Error('The PDF intrinsic page rotation was lost.');
    }
    await app.actions.muzeDocumentsLoad(location.origin + '/no-text.pdf');
    if (
      app.runtime.pdf.layer.textContent.trim() ||
      app.runtime.pdf.paragraphs.length
    ) {
      throw new Error(
        'A page without text must not invent text or paragraphs.'
      );
    }
    app.runtime.host.preferences.noteBodyProvider = null;
    await app.actions.muzeDocumentsAddNote({ page: 1 });
    await app.actions.muzeDocumentsFinishNote(false);
    if (app.runtime.group.annotations().length) {
      throw new Error('Closing a new note left an empty annotation.');
    }
    await app.actions.muzeDocumentsAddNote({ page: 1 });
    app.runtime.noteEditor.editor.setValue({
      text: 'Page note',
      annotations: []
    });
    await app.actions.muzeDocumentsFinishNote(true);
    if (app.runtime.group.annotations()[0].page !== 1) {
      throw new Error('A page marker is unavailable on a page without text.');
    }
  });
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });
  await page.evaluate(async () => {
    const app = muzeSolidDocumentsApp;
    app.runtime.host.preferences.noteBodyProvider = null;
    await app.actions.muzeDocumentsShow(1);
    await app.actions.muzeDocumentsEdit(app.runtime.group.annotations()[0].id);
    app.runtime.noteEditor.editor.setValue({
      text: 'Offline note',
      annotations: []
    });
    await app.actions.muzeDocumentsFinishNote(true);
    const saved = await app.actions
      .muzeDocumentsStore(
        app.runtime.group.cacheId || app.runtime.group.root.id
      )
      .load();
    if (!saved.includes('Offline note')) {
      throw new Error('Loaded-offline annotation was not preserved.');
    }
    const id = app.runtime.group.annotations()[0].id;
    await app.actions.muzeDocumentsEdit(id);
    app.runtime.noteEditor.editor.setValue({ text: '   ', annotations: [] });
    await app.actions.muzeDocumentsFinishNote(true);
    if (
      app.runtime.group.annotations().length ||
      app.runtime.group.graph.quads.some((quad) => quad.subject.id === id)
    ) {
      throw new Error('Saving an empty note did not remove the annotation.');
    }
  });
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  if (!slow) {
    const measurements = await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      app.runtime.host.preferences.noteBodyProvider = null;
      await app.actions.muzeDocumentsLoad(location.origin + '/many-pages.pdf');
      await app.actions.muzeDocumentsShow(1);
      const started = performance.now();
      await app.commands.muzeDocumentsToggleThumbnails.call(app);
      const count = app.runtime.pdf.thumbnails.size;
      const firstThumbnailMs = performance.now() - started;
      if (!count || count >= 24) {
        throw new Error(
          'Thumbnails must render only near the pane viewport: ' + count
        );
      }
      const pane = app.container.querySelector('.muze-documents-thumbnails');
      pane.scrollTop = pane.scrollHeight;
      await app.actions.muzeDocumentsRenderThumbnails();
      if (app.runtime.pdf.thumbnails.size >= 24) {
        throw new Error('Distant thumbnails were not released.');
      }
      const last = pane.querySelector('[data-thumbnail-page="24"]');
      last.click();
      for (let i = 0; i < 100 && app.runtime.page !== 24; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (app.runtime.page !== 24) {
        throw new Error('Thumbnail did not navigate the reader.');
      }
      if (app.data.muzeDocumentsThumbnailsPanel.hidden === null) {
        await app.commands.muzeDocumentsToggleThumbnails.call(app);
      }
      if (app.runtime.pdf.thumbnails.size) {
        throw new Error('Closing thumbnails retained canvases.');
      }
      await app.actions.muzeDocumentsShow(1);
      const group = new app.api.AnnotationGroup();
      group.rename('My review');
      group.add({
        document: app.runtime.document,
        digest: app.runtime.digest,
        page: 1,
        html: '<p>Visible first page</p>',
        creator: 'https://me.example/#me'
      });
      group.add({
        document: app.runtime.document,
        digest: app.runtime.digest,
        page: 24,
        html: '<p>Last page only</p>',
        creator: 'https://me.example/#me'
      });
      app.runtime.groups.set(group.root.id, group);
      app.runtime.group = group;
      await app.actions.muzeDocumentsPersist(group);
      const external = new app.api.AnnotationGroup();
      external.rename('Colleague review');
      external.add({
        document: app.runtime.document,
        digest: app.runtime.digest,
        page: 1,
        html: '<p>A colleague note</p>',
        creator: 'https://colleague.example/#me'
      });
      await app.actions.muzeDocumentsAttachGroup(external);
      if (group.colorHue === external.colorHue) {
        throw new Error('Annotation resources need distinct colors.');
      }
      const externalHue = external.colorHue;
      if (app.runtime.group !== group || external.allowWriting) {
        throw new Error(
          'Adding another file changed the writing group or enabled writing.'
        );
      }
      app.actions.muzeDocumentsHighlights();
      const visible = app.data.muzeDocumentsNotes;
      if (
        visible.length !== 2 ||
        visible.some((note) => note.page === 24) ||
        !visible.some(
          (note) =>
            note.authorDetails.title.includes('colleague.example') &&
            !note.author.includes('https:') &&
            note.edit.hidden === ''
        )
      ) {
        throw new Error(
          'Visible-anchor/source/author projection is incorrect: ' +
            JSON.stringify(visible)
        );
      }
      let duplicateRefused = false;
      try {
        await app.actions.muzeDocumentsAttachGroup(external);
      }
      catch {
        duplicateRefused = true;
      }
      if (!duplicateRefused) {
        throw new Error('Duplicate source overwrote a loaded group.');
      }
      await app.commands.muzeDocumentsEnableWriting.call(
        app,
        null,
        external.root.id
      );
      app.runtime.group = group;
      app.actions.muzeDocumentsRefresh();
      await app.actions.muzeDocumentsAddNote({ page: 1 });
      const id = app.runtime.noteId;
      const select = app.container.querySelector('[data-note-destination]');
      select.value = external.root.id;
      if (select.value !== external.root.id) {
        throw new Error('Enabled resource missing from destinations.');
      }
      app.runtime.noteEditor.editor.setValue({
        text: 'Selected destination',
        annotations: []
      });
      await app.actions.muzeDocumentsFinishNote(true);
      if (
        group.annotations().some((note) => note.id === id) ||
        !external
          .annotations()
          .some(
            (note) => note.id === id && note.html === 'Selected destination'
          )
      ) {
        throw new Error('The note was not saved in the selected resource.');
      }
      await app.actions.muzeDocumentsAccount();
      const cached = [...app.runtime.groups.values()].find(
        (item) => item.root.id === external.root.id
      );
      if (
        !cached?.external ||
        cached.colorHue !== externalHue ||
        !cached.allowWriting ||
        !cached
          .annotations()
          .some((note) =>
            note.authors.some(
              (author) => author.id === 'https://colleague.example/#me'
            )
          )
      ) {
        throw new Error(
          'External source status or authors did not survive local reload.'
        );
      }
      app.runtime.group = [...app.runtime.groups.values()].find(
        (item) => item.root.id === group.root.id
      );
      app.actions.muzeDocumentsRefresh();
      await app.actions.muzeDocumentsShow(24);
      if (
        !app.data.muzeDocumentsNotes.some((note) =>
          note.html.includes('Last page only')
        ) ||
        app.data.muzeDocumentsNotes.some((note) => note.page === 1)
      ) {
        throw new Error('Sidebar did not follow the visible pages.');
      }
      return {
        firstThumbnailCount: count,
        milliseconds: Math.round(firstThumbnailMs)
      };
    });
    console.log(
      'Thumbnails, visible notes, authors and selected destinations:',
      measurements
    );
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      const other = new app.api.AnnotationGroup();
      other.rename('Search review');
      other.add({
        document: app.runtime.document,
        digest: app.runtime.digest,
        page: 12,
        html: '<p>Unique <strong>review</strong> &amp; approval</p>'
      });
      app.runtime.groups.set(other.root.id, other);
      app.actions.muzeDocumentsRefresh();
      if (app.data.muzeDocumentsNotes.some((note) => note.page === 12)) {
        throw new Error('Visible mode must retain its viewport filter.');
      }
      if (app.data.muzeDocumentsNotesPanel.hidden !== null) {
        await app.commands.muzeDocumentsNotes.call(app);
      }
      app.container.querySelector('[aria-label="All annotations"]').focus();
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
      windowsVirtualKeyCode: 13
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (
        !app.data.muzeDocumentsNotes.some((note) => note.page === 12) ||
        !app.data.muzeDocumentsNotes.some((note) => note.page === 1)
      ) {
        throw new Error(
          'All annotations must include offscreen pages and other loaded groups.'
        );
      }
      app.container
        .querySelector('[data-simply-command="muzeDocumentsSearchAnnotations"]')
        .focus();
    });
    await page.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
    await page.send('Input.insertText', { text: 'REVIEW & APPROVAL' });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      await new Promise((resolve) => setTimeout(resolve, 80));
      const cards = app.container.querySelectorAll('.muze-documents-note-card');
      if (cards.length !== 1 || !cards[0].textContent.includes('Unique')) {
        throw new Error(
          'Search must match decoded formatted text without case sensitivity.'
        );
      }
      const card = cards[0];
      const author = card
        .querySelector('.muze-documents-note-author')
        .getBoundingClientRect();
      const source = card
        .querySelector('.muze-documents-note-source')
        .getBoundingClientRect();
      const location = card.querySelector(
        '[data-simply-command="muzeDocumentsGoNote"]'
      );
      const bounds = card.getBoundingClientRect();
      const number = location.getBoundingClientRect();
      const toggle = app.container.querySelector(
        '[aria-label="All annotations"]'
      );
      const chat = app.container.querySelector('.muze-documents-notes-handle');
      if (
        chat.getAttribute('aria-expanded') !== 'true' ||
        getComputedStyle(chat).backgroundColor === 'rgba(0, 0, 0, 0)'
      ) {
        throw new Error(
          'The open chat toggle must expose its expanded state and selected background.'
        );
      }

      if (
        Math.abs(author.top - source.top) > 5 ||
        bounds.right - number.right > 8 ||
        bounds.bottom - number.bottom > 8 ||
        location.textContent.trim() !== '12' ||
        !location.title.includes('12') ||
        toggle.getAttribute('aria-pressed') !== 'true' ||
        toggle.textContent.trim()
      ) {
        throw new Error(
          'Annotations need a compact metadata row, bottom-right page number and pressed icon toggle.'
        );
      }
      location.focus();
    });
    const searchShot = await page.send('Page.captureScreenshot', {
      format: 'png'
    });
    await writeFile(
      '/tmp/cyc260-annotation-search.png',
      Buffer.from(searchShot.data, 'base64')
    );

    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
      windowsVirtualKeyCode: 13
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      for (let i = 0; i < 100 && app.runtime.page !== 12; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (app.runtime.page !== 12) {
        throw new Error(
          'Keyboard annotation result must navigate to its PDF page: ' +
            JSON.stringify({
              page: app.runtime.page,
              status: app.data.muzeDocumentsStatus,
              focus: document.activeElement?.outerHTML,
              notes: app.data.muzeDocumentsNotes.map((note) => ({
                key: note.key,
                page: note.page,
                digest: note.digest
              })),
              digest: app.runtime.digest
            })
        );
      }
      await app.commands.muzeDocumentsNotes.call(app);
      const search = app.container.querySelector(
        '[data-simply-command="muzeDocumentsSearchAnnotations"]'
      );
      for (const value of ['no such annotation xyz', 'Search review', '']) {
        search.value = value;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (
          value.startsWith('no such') &&
          (app.data.muzeDocumentsNotes.length ||
            app.data.muzeDocumentsNotesEmpty !== 'No matching annotations.')
        ) {
          throw new Error('Search must report no matching annotations.');
        }
        if (
          value === 'Search review' &&
          app.data.muzeDocumentsNotes.length !== 1
        ) {
          throw new Error('Search must include group names.');
        }
        if (!value && app.data.muzeDocumentsNotes.length < 2) {
          throw new Error('Clearing search must restore the full list.');
        }
      }
      const scope = app.container.querySelector(
        '[aria-label="All annotations"]'
      );
      scope.click();
      await app.actions.muzeDocumentsShow(24);
      if (app.data.muzeDocumentsNotes.some((note) => note.page === 12)) {
        throw new Error(
          'Returning to visible mode must restore viewport filtering.'
        );
      }
      await app.actions.muzeDocumentsShow(12);
      if (
        !app.data.muzeDocumentsNotes.some(
          (note) => note.page === 12 && note.html.includes('Unique')
        )
      ) {
        throw new Error(
          'Visible mode must include visible notes from other loaded writing groups.'
        );
      }
      await app.actions.muzeDocumentsShow(24);
    });
    const noteBodyPoint = await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      app.container.querySelector('[aria-label="All annotations"]').click();
      const search = app.container.querySelector(
        '[data-simply-command="muzeDocumentsSearchAnnotations"]'
      );
      search.value = 'Unique review';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const body = app.container
        .querySelector('.muze-documents-note-body')
        .getBoundingClientRect();
      return { x: body.left + body.width / 2, y: body.top + body.height / 2 };
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...noteBodyPoint,
      button: 'left',
      clickCount: 1
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...noteBodyPoint,
      button: 'left',
      clickCount: 1
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      for (let i = 0; i < 100 && app.runtime.page !== 12; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (app.runtime.page !== 12) {
        throw new Error(
          'Clicking annotation text must navigate just like its page button.'
        );
      }
      await app.commands.muzeDocumentsNotes.call(app);
      const search = app.container.querySelector(
        '[data-simply-command="muzeDocumentsSearchAnnotations"]'
      );
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      app.container.querySelector('[aria-label="All annotations"]').click();
      await app.actions.muzeDocumentsShow(24);
    });
    await page.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
    sharedAnnotationFile = await page.evaluate(() => {
      const app = muzeSolidDocumentsApp;
      const group = new app.api.AnnotationGroup();
      group.rename('Remote review');
      group.add({
        document: app.runtime.document,
        digest: app.runtime.digest,
        page: 24,
        html: '<p>Remote annotation</p>',
        creator: 'https://remote.example/#author'
      });
      return group.write();
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      const writing = app.runtime.group;
      const form = app.container.querySelector(
        '[data-simply-command="muzeDocumentsOpenGroup"]'
      );
      form.elements.url.value = location.origin + '/shared/notes.ttl';
      await app.commands.muzeDocumentsOpenGroup.call(app, form);
      const remote = [...app.runtime.groups.values()].find((group) =>
        group.remote?.url.endsWith('/shared/notes.ttl')
      );
      if (
        !remote?.external ||
        remote.allowWriting ||
        app.runtime.group !== writing
      ) {
        throw new Error(
          'Opening the external URL must add a view-only source alongside the writing group.'
        );
      }
      app.actions.muzeDocumentsHighlights();
      if (
        !app.data.muzeDocumentsNotes.some(
          (note) =>
            note.authorDetails.title === 'https://remote.example/#author' &&
            !note.author.includes('https:')
        )
      ) {
        throw new Error('Remote author was not displayed.');
      }
      if (app.data.muzeDocumentsNotesPanel.hidden !== null) {
        await app.commands.muzeDocumentsNotes.call(app);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (
        !app.container.querySelector('.muze-documents-notes').checkVisibility()
      ) {
        throw new Error(
          'The phone notes handle did not open its overlay: ' +
            JSON.stringify({
              state: app.data.muzeDocumentsNotesPanel,
              html: app.container
                .querySelector('.muze-documents-notes')
                .outerHTML.slice(0, 500),
              display: getComputedStyle(
                app.container.querySelector('.muze-documents-notes')
              ).display,
              rect: app.container
                .querySelector('.muze-documents-notes')
                .getBoundingClientRect()
                .toJSON(),
              narrow: app.runtime.narrowReader
            })
        );
      }
    });
    const notesShot = await page.send('Page.captureScreenshot', {
      format: 'png'
    });
    await writeFile(
      '/tmp/cyc260-visible-note-cards.png',
      Buffer.from(notesShot.data, 'base64')
    );
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      const width = app.container.querySelector(
        '[data-pdf-page="24"]'
      ).offsetWidth;
      await app.commands.muzeDocumentsToggleThumbnails.call(app);
      const panel = app.container.querySelector('.muze-documents-thumbnails');
      const buttons = panel.querySelectorAll('.muze-documents-thumbnail');
      const a = buttons[0].getBoundingClientRect();
      const b = buttons[1].getBoundingClientRect();
      if (
        a.top !== b.top ||
        b.left <= a.left ||
        panel.getBoundingClientRect().width <
          app.container.querySelector('.muze-documents-layout').clientWidth -
            1 ||
        app.container.querySelector('[data-pdf-page="24"]').offsetWidth !==
          width ||
        app.data.muzeDocumentsNotesPanel.hidden === null
      ) {
        throw new Error(
          'Phone thumbnails must wrap across the overlay without resizing paper: ' +
            JSON.stringify({
              a: a.toJSON(),
              b: b.toJSON(),
              panel: panel.getBoundingClientRect().toJSON(),
              width,
              current: app.container.querySelector('[data-pdf-page="24"]')
                .offsetWidth,
              notes: app.data.muzeDocumentsNotesPanel
            })
        );
      }
    });
    const thumbsShot = await page.send('Page.captureScreenshot', {
      format: 'png'
    });
    await writeFile(
      '/tmp/cyc260-phone-thumbnails.png',
      Buffer.from(thumbsShot.data, 'base64')
    );

    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
      await app.actions.muzeDocumentsShow(1);
      app.actions.muzeDocumentsHighlights();
      const button = app.container.querySelector(
        '.muze-documents-paragraph-add'
      );
      if (
        !button ||
        app.container.querySelector('[data-document-dialog="paragraphs"]')
      ) {
        throw new Error('Inline paragraph action did not replace the dialog.');
      }
      button.focus();
      if (getComputedStyle(button).opacity !== '1') {
        throw new Error('Keyboard focus did not reveal the paragraph action.');
      }
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
      windowsVirtualKeyCode: 13
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      for (let i = 0; i < 100 && !app.runtime.noteEditor; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (
        !app.runtime.noteEditor ||
        !app.runtime.noteGroup
          .annotations()
          .find((note) => note.id === app.runtime.noteId)?.paragraph
      ) {
        throw new Error(
          'Keyboard paragraph + did not open the targeted note dialog.'
        );
      }
      await app.actions.muzeDocumentsFinishNote(false);
    });
  }
  if (!slow) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false
    });
    await page.send('Page.reload');
    await page.ready();
    await page.evaluate(async () => {
      for (let i = 0; i < 100 && !window.muzeSolidDocumentsApp; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const app = muzeSolidDocumentsApp;
      await app.actions.muzeDocumentsLoad(location.origin + '/report.pdf');
      await new Promise((resolve) => setTimeout(resolve, 150));
      await app.actions.muzeDocumentsShow(1);
      if (app.data.muzeDocumentsOutlinePanel.hidden !== null) {
        await app.commands.muzeDocumentsToggleOutline.call(app);
      }
      if (app.data.muzeDocumentsNotesPanel.hidden !== null) {
        await app.commands.muzeDocumentsNotes.call(app);
      }
      window.originalPaperWidth = app.container.querySelector(
        '[data-pdf-page="1"]'
      ).offsetWidth;
    });
    for (const width of [1800, 1000, 390, 1440, 1800]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width === 390
      });
      await page.evaluate(async () => {
        const app = muzeSolidDocumentsApp;
        await new Promise((resolve) => setTimeout(resolve, 200));
        for (let i = 0; i < 100 && app.runtime.positioning; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        const actual = app.container.querySelector(
          '[data-pdf-page="1"]'
        ).offsetWidth;
        if (innerWidth <= 719) {
          if (
            actual >= window.originalPaperWidth ||
            app.data.muzeDocumentsOutlinePanel.hidden === null ||
            app.data.muzeDocumentsNotesPanel.hidden === null
          ) {
            throw new Error(
              'Narrowing must shrink paper when needed and hide sidebars.'
            );
          }
        }
        else if (
          actual !== window.originalPaperWidth ||
          app.data.muzeDocumentsOutlinePanel.hidden !== null ||
          app.data.muzeDocumentsNotesPanel.hidden !== null
        ) {
          throw new Error(
            'Widening must restore panes and the original page size, without further growth.'
          );
        }
      });
    }
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 2,
      y: 2
    });
    const hitPoint = await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      // Isolate the single-hit scroll fixture from prior overlapping groups.
      await app.actions.muzeDocumentsLoad(
        location.origin + '/report.pdf?interaction=1'
      );
      await app.actions.muzeDocumentsShow(1);
      if (app.data.muzeDocumentsNotesPanel.hidden !== null) {
        await app.commands.muzeDocumentsNotes.call(app);
      }

      const group = new app.api.AnnotationGroup();
      group.rename('Interaction review');
      for (let index = 0; index < 16; index += 1) {
        group.add({
          document: app.runtime.document,
          digest: app.runtime.digest,
          page: 1,
          html: '<p>Other visible note ' + index + '</p>'
        });
      }
      const text = app.runtime.pdf.layer.textContent;
      const quote = 'Second line';
      const start = text.indexOf(quote);
      const id = group.add({
        document: app.runtime.document,
        digest: app.runtime.digest,
        page: 1,
        quote,
        start,
        end: start + quote.length,
        html: '<p>Find me from the highlight</p>',
        creator: location.origin + '/nickname#me'
      });
      app.runtime.groups.set(group.root.id, group);
      app.runtime.group = group;
      await app.actions.muzeDocumentsPersist(group);
      app.actions.muzeDocumentsRefresh();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const panel = app.container.querySelector('.muze-documents-notes');
      panel.scrollTop = 0;
      const target = app.runtime.highlightTargets.find((entry) =>
        entry.key.endsWith(id)
      );
      const rect = [...target.ranges[0].getClientRects()].find(
        (entry) => entry.width > 3 && entry.height > 0
      );
      window.hoverNoteKey = target.key;
      return { x: rect.left + 3, y: rect.top + rect.height / 2 };
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: hitPoint.x,
      y: hitPoint.y
    });
    await page.evaluate(async () => {
      const app = muzeSolidDocumentsApp;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const panel = app.container.querySelector('.muze-documents-notes');
      let card;
      for (let i = 0; i < 10; i += 1) {
        card = [...panel.querySelectorAll('[data-note-key]')].find(
          (item) => item.dataset.noteKey === window.hoverNoteKey
        );
        if (card?.hasAttribute('data-active') && panel.scrollTop > 0) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (
        !card?.hasAttribute('data-active') ||
        panel.scrollTop === 0 ||
        card.getBoundingClientRect().bottom >
          panel.getBoundingClientRect().bottom + 1
      ) {
        throw new Error(
          'Hovering a highlight did not emphasize and reveal its offscreen note: ' +
            JSON.stringify({
              active: app.runtime.activeNoteKeys,
              visible: app.data.muzeDocumentsNotes.length,
              activeAttribute: card?.hasAttribute('data-active'),
              modelAppearance: app.runtime.notes.state.data.find(
                (note) => note.key === window.hoverNoteKey
              )?.appearance,
              viewAppearance: app.data.muzeDocumentsNotes.find(
                (note) => note.key === window.hoverNoteKey
              )?.appearance,
              cards: [...panel.querySelectorAll('li')].map((item) => ({
                key: item.dataset.noteKey,
                html: item.outerHTML.slice(0, 260)
              })),
              key: window.hoverNoteKey,
              scroll: panel.scrollTop,
              card: card?.getBoundingClientRect().toJSON(),
              panel: panel.getBoundingClientRect().toJSON()
            })
        );
      }
      for (
        let i = 0;
        i < 300 &&
        !card
          .querySelector('.muze-documents-note-author')
          .textContent.includes('Robin');
        i += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (
        !card
          .querySelector('.muze-documents-note-author')
          .textContent.includes('Robin') ||
        card.innerText.includes('/nickname#me') ||
        card.querySelector('.muze-documents-note-author').title !==
          location.origin + '/nickname#me'
      ) {
        throw new Error(
          'Available nickname/full-WebID tooltip was not used: ' +
            JSON.stringify({
              text: card.querySelector('.muze-documents-note-author')
                .textContent,
              title: card.querySelector('.muze-documents-note-author').title,
              labels: [...app.runtime.authorLabels],
              queue: app.runtime.authorQueue,
              busy: app.runtime.authorBusy,
              note: app.data.muzeDocumentsNotes.find(
                (note) => note.key === window.hoverNoteKey
              )?.author
            })
        );
      }
      window.activeNoteBackground = getComputedStyle(card).backgroundColor;
      if (
        getComputedStyle(card).outlineStyle !== 'none' ||
        getComputedStyle(card).boxShadow !== 'none'
      ) {
        throw new Error(
          'Active annotations must use background emphasis without an outline.'
        );
      }
      const edit = card.querySelector('[aria-label="Edit note"]');
      edit.focus();
      if (getComputedStyle(edit).opacity !== '1' || edit.innerText.trim()) {
        throw new Error(
          'Compact edit action must be an icon revealed by keyboard focus.'
        );
      }
      if (document.body.innerText.includes('Cannot read properties')) {
        throw new Error('A rendering error was shown in the reader.');
      }
    });
    const blankPoint = await page.evaluate(() => {
      const box = document
        .querySelector('.muze-documents-paper-scroll')
        .getBoundingClientRect();
      return { x: box.right - 20, y: box.bottom - 20 };
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...blankPoint
    });
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const app = muzeSolidDocumentsApp;
      const card = [...app.container.querySelectorAll('[data-note-key]')].find(
        (item) => item.dataset.noteKey === window.hoverNoteKey
      );
      if (
        card.hasAttribute('data-active') ||
        app.runtime.activeNoteKeys.length ||
        getComputedStyle(card).backgroundColor === window.activeNoteBackground
      ) {
        throw new Error(
          'Moving to unannotated paper must clear note background emphasis.'
        );
      }
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...hitPoint
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 2,
      y: 2
    });
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (
        muzeSolidDocumentsApp.runtime.activeNoteKeys.length ||
        document.querySelector('.muze-documents-note-card[data-active]')
      ) {
        throw new Error('Leaving the reader must clear note emphasis.');
      }
    });
  }
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  assert(
    !requests.some((url) => url.includes('/authoring/')),
    'normal reading and editing do not fetch inspection sources'
  );
  await page.evaluate(() => {
    localStorage.setItem('solid-apps.webId', location.origin + '/profile#me');
  });
  await page.send('Page.navigate', { url: origin + '/files/' });
  await page.ready();
  await page.evaluate(async () => {
    for (
      let i = 0;
      i < 200 && !document.querySelector('.swb-file-name');
      i += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    document.querySelector('.swb-file-name').focus();
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    text: '\r',
    windowsVirtualKeyCode: 13
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await page.evaluate(async () => {
    for (let i = 0; i < 200; i += 1) {
      if (solidFiles.ui.runtime.resourceView?.support?.ready) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const app = document.querySelector('.muze-solid-files-frame').contentWindow
      .muzeSolidDocumentsApp;
    if (
      !app?.runtime.pdf ||
      !solidFiles.ui.runtime.resourceView.support?.ready
    ) {
      throw new Error('Files did not open the PDF provider.');
    }
    const visibleInputs = [
      ...app.container.querySelectorAll('input, select')
    ].filter((element) => element.checkVisibility());
    if (
      visibleInputs.length ||
      app.container.querySelector('details, summary') ||
      !app.container.querySelector('[data-pdf-surface] canvas') ||
      app.container
        .querySelector('[data-simply-value="open"]')
        .checkVisibility()
    ) {
      throw new Error(
        'Embedded PDF exposes forms or does not display the page.'
      );
    }
    const paper = app.container
      .querySelector('[data-pdf-surface]')
      .getBoundingClientRect();
    if (paper.width < 200 || paper.top > 100) {
      throw new Error(
        'PDF is not the primary visible content: ' + JSON.stringify(paper)
      );
    }
    const notesToggle = app.container.querySelector(
      '.muze-documents-panel-handles [data-simply-command="muzeDocumentsNotes"]'
    );
    notesToggle.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    notesToggle.focus();
    notesToggle.click();
    for (let i = 0; i < 100; i += 1) {
      if (app.container.ownerDocument.activeElement === notesToggle) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (app.container.ownerDocument.activeElement !== notesToggle) {
      throw new Error(
        'Closing annotations did not return focus: ' +
          app.container.ownerDocument.activeElement?.outerHTML +
          ' ' +
          JSON.stringify(app.data.muzeDocumentsNotesPanel)
      );
    }
    if (app.runtime.groups.size) {
      throw new Error('Anonymous notes leaked into the signed-in account.');
    }
  });
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished)
    );
  });
  const embeddedScreenshot = await page.send('Page.captureScreenshot', {
    format: 'png'
  });
  await writeFile(
    '/tmp/cyc260-files-pdf-phone.png',
    Buffer.from(embeddedScreenshot.data, 'base64')
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await page.evaluate(async () => {
    const app = document.querySelector('.muze-solid-files-frame').contentWindow
      .muzeSolidDocumentsApp;
    await app.actions.muzeDocumentsShow(1);
  });
  const desktopScreenshot = await page.send('Page.captureScreenshot', {
    format: 'png'
  });
  await writeFile(
    '/tmp/cyc260-files-pdf-desktop.png',
    Buffer.from(desktopScreenshot.data, 'base64')
  );
  await page.evaluate(async () => {
    const app = document.querySelector('.muze-solid-files-frame').contentWindow
      .muzeSolidDocumentsApp;
    await app.actions.muzeDocumentsAddNote({ page: 1 });
    if (await solidFiles.ui.actions.muzeSolidFilesReleaseView()) {
      throw new Error('Files removed an active annotation editor.');
    }
    await app.actions.muzeDocumentsFinishNote(false);
    if (!(await solidFiles.ui.actions.muzeSolidFilesReleaseView())) {
      throw new Error('Finished PDF view did not release.');
    }
  });
  assert.equal(exception, undefined, JSON.stringify(exception));
  page.close();
  console.log(
    'Documents PDF rendering, editor, HTML display and reload recovery passed.'
  );
}
finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
