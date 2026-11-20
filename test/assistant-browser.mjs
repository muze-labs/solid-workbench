import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { formatBrowserException, startChrome } from './support/chrome.mjs';
import { startAssistantPreview } from '../scripts/assistant-preview.mjs';

async function waitFor(check, description) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const result = await check();
    if (result) {
      return result;
    }
    await delay(50);
  }
  throw new Error('assistant browser: ' + description);
}

async function key(page, key, windowsVirtualKeyCode) {
  const code = key === ' ' ? 'Space' : key;
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type,
      key,
      code,
      windowsVirtualKeyCode,
      ...(type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {})
    });
  }
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (exceptionDetails) {
    throw new Error(formatBrowserException(exceptionDetails));
  }
  return result.value;
}

const preview = await startAssistantPreview();
let browser;
try {
  browser = await startChrome('about:blank');
  const page = await browser.page();
  await page.ready();
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    mobile: true,
    deviceScaleFactor: 1
  });
  await page.send('Page.navigate', { url: preview.callerOrigin });
  const bookmarks = (fn, arg) =>
    evaluate(
      page,
      `(${fn})(document.querySelector('iframe')?.contentDocument, ${JSON.stringify(arg)})`
    );
  await waitFor(
    () => bookmarks((document) => Boolean(document?.querySelector('li input'))),
    'Bookmark bindings did not start.'
  );

  async function pressInBookmarks(command) {
    await bookmarks((document, name) => {
      document.querySelector('[data-simply-command="' + name + '"]').focus();
    }, command);
    await key(page, 'Enter', 13);
  }

  async function targets() {
    return (await page.send('Target.getTargets')).targetInfos;
  }

  const isAssistant = ({ type, url }) =>
    type === 'iframe' && url.startsWith(preview.assistantOrigin + '/panel');
  assert.equal((await targets()).some(isAssistant), false);
  assert.equal(
    await bookmarks(
      (document) =>
        document.documentElement.scrollWidth <= document.defaultView.innerWidth
    ),
    true
  );

  async function findPanel() {
    const target = await waitFor(
      async () => (await targets()).find(isAssistant),
      'The cross-origin assistant iframe did not load.'
    );
    return browser.page(target.targetId);
  }

  async function startSuggestion() {
    await pressInBookmarks('solidAssistantSuggest');
    const panel = await findPanel();
    await waitFor(
      () =>
        panel.evaluate(
          () =>
            document.querySelector(
              '[data-simply-command="solidAssistantApprove"]'
            )?.hidden === false
        ),
      'The assistant frame did not show model approval.'
    );
    await key(page, 'Tab', 9);
    await waitFor(
      () =>
        panel.evaluate(
          () =>
            document.activeElement?.dataset.simplyCommand ===
            'solidAssistantApprove'
        ),
      'Tab did not reach the model approval in the assistant frame.'
    );
    return panel;
  }

  async function pressInAssistant(panel, command) {
    await evaluate(
      panel,
      `document.querySelector('[data-simply-command="' +
      ${JSON.stringify(command)} + '"]').focus()`
    );
    await key(page, 'Enter', 13);
  }

  await pressInBookmarks('solidAssistantOpen');
  await waitFor(
    () =>
      bookmarks(
        (document) => document.querySelector('.solid-assistant-dock').open
      ),
    'Assistant dock did not open.'
  );
  assert.equal(
    await bookmarks(
      (document) =>
        Math.round(
          document
            .querySelector('.solid-assistant-dock')
            .getBoundingClientRect().width
        ) === document.defaultView.innerWidth
    ),
    true
  );
  let panel = await findPanel();
  await waitFor(
    () =>
      panel.evaluate(() =>
        document.body?.innerText.includes(
          'Select bookmarks and choose Suggest topics.'
        )
      ),
    'The idle assistant did not become ready.'
  );
  assert.equal(
    await panel.evaluate(
      () =>
        document.querySelector('[aria-label="Selected bookmark data"]').hidden
    ),
    true
  );
  panel.close();
  await key(page, 'Escape', 27);
  await waitFor(
    () =>
      bookmarks(
        (document) => !document.querySelector('.solid-assistant-dock').open
      ),
    'Keyboard could not close the assistant.'
  );
  await waitFor(
    () =>
      bookmarks(
        (document) =>
          document.activeElement?.dataset.simplyCommand === 'solidAssistantOpen'
      ),
    'Closing the dock did not restore focus to its opener.'
  );

  await bookmarks((document) => document.querySelector('li input').focus());
  await key(page, ' ', 32);
  assert.equal(
    await bookmarks((document) => document.querySelector('li input').checked),
    true
  );
  panel = await startSuggestion();
  const disclosed = await panel.evaluate(() => document.body.innerText);
  assert.match(disclosed, /Digital identity\s+https:\/\/example.org\/identity/);
  assert.doesNotMatch(disclosed, /gardens|transit/);
  assert.equal(
    await bookmarks(
      (document) =>
        document.querySelector('[aria-label="Topic suggestions"]').hidden
    ),
    true
  );
  await key(page, 'Enter', 13);
  await waitFor(
    () =>
      panel.evaluate(
        () =>
          !document.querySelector('[data-simply-field="bookmarkCapability"]')
            .hidden
      ),
    'Approving in the assistant frame did not produce suggestions.'
  );
  const read = () => pressInAssistant(panel, 'solidAssistantReadSelection');
  const permissionVisible = () =>
    bookmarks(
      (document) =>
        document.querySelector('.solid-bookmarks-read-permission').open
    );
  const readStatus = () =>
    panel.evaluate(
      () =>
        document.querySelector('[data-simply-field="readStatus"]').textContent
    );
  const readResults = () =>
    panel.evaluate(
      () =>
        document.querySelector('[data-simply-list="readBookmarks"]').innerText
    );

  await read();
  await waitFor(
    async () => (await readStatus()).includes('Waiting for permission'),
    'The read did not wait for its own permission decision.'
  );
  assert.equal(await readResults(), '');
  await waitFor(permissionVisible, 'Bookmarks did not show its own prompt.');
  assert.deepEqual(
    await bookmarks((document) => {
      const prompt = document.querySelector('.solid-bookmarks-read-permission');
      const dock = document.querySelector('.solid-assistant-dock');
      const title = document.getElementById(
        prompt.getAttribute('aria-labelledby')
      );
      return {
        title: title.textContent.trim(),
        modal: prompt.matches(':modal'),
        insideDock: dock.contains(prompt),
        dockVisibility: getComputedStyle(dock).visibility
      };
    }),
    {
      title: 'Social Bookmarks permissions',
      modal: true,
      insideDock: false,
      dockVisibility: 'visible'
    }
  );
  assert.equal(
    await panel.evaluate(() =>
      Boolean(
        document.querySelector(
          '[data-simply-command="solidAssistantAllowRead"]'
        )
      )
    ),
    false
  );
  await waitFor(
    () =>
      bookmarks(
        (document) =>
          document.activeElement?.dataset.simplyCommand ===
          'solidAssistantAllowRead'
      ),
    'Focus did not move to the Bookmarks frame.'
  );
  await pressInBookmarks('solidAssistantDenyRead');
  await waitFor(
    async () => !(await permissionVisible()),
    'Denying the read did not dismiss the Bookmarks prompt.'
  );
  await waitFor(
    async () => (await readStatus()).includes('denied the selection read'),
    'Denying the read did not settle the pending request.'
  );
  assert.equal(await readResults(), '');
  await read();
  await waitFor(permissionVisible, 'A retry did not ask for permission.');
  await waitFor(
    () =>
      bookmarks(
        (document) =>
          document.activeElement?.dataset.simplyCommand ===
          'solidAssistantAllowRead'
      ),
    'The retry did not focus the Bookmarks prompt.'
  );
  await key(page, 'Enter', 13);
  await waitFor(
    async () => (await readStatus()).includes('Selection received'),
    'Approving did not complete the original read.'
  );
  assert.equal(await permissionVisible(), false);
  assert.match(
    await readResults(),
    /Digital identity\s+https:\/\/example.org\/identity/
  );
  assert.doesNotMatch(await readResults(), /gardens|transit/);

  await read();
  await waitFor(
    permissionVisible,
    'A new call did not ask for its own approval.'
  );
  assert.equal(await readResults(), '');
  assert.equal(
    (await targets()).filter(({ type }) => type === 'page').length,
    1
  );

  await key(page, 'Escape', 27);
  await waitFor(
    async () => !(await permissionVisible()),
    'Escape did not dismiss the Bookmarks dialog.'
  );
  await waitFor(
    async () => (await readStatus()).includes('denied the selection read'),
    'Escape did not deny the pending request.'
  );
  assert.equal(
    await bookmarks(
      (document) => document.querySelector('.solid-assistant-dock').open
    ),
    true
  );

  await pressInAssistant(panel, 'solidAssistantReturnSuggestions');
  panel.close();
  await waitFor(
    () =>
      bookmarks(
        (document) =>
          !document.querySelector('[aria-label="Topic suggestions"]').hidden
      ),
    'Bookmarks did not receive suggestions for review.'
  );
  assert.match(
    await bookmarks((document) => document.body.innerText),
    /Digital identity — digital identity/
  );
  assert.match(
    await bookmarks((document) => document.body.innerText),
    /Tags: None/
  );
  await pressInBookmarks('solidAssistantApply');
  await waitFor(
    () =>
      bookmarks((document) =>
        document.body.innerText.includes('Tags: digital identity')
      ),
    'Applying suggestions did not save a tag.'
  );
  await pressInBookmarks('solidAssistantUndo');
  await waitFor(
    () =>
      bookmarks(
        (document) =>
          !document.body.innerText.includes('Tags: digital identity')
      ),
    'Undo did not remove the applied tag.'
  );

  panel = await startSuggestion();
  await panel
    .evaluate(() => {
      document
        .querySelector('[data-simply-command="solidAssistantApprove"]')
        .click();
      document
        .querySelector('[data-simply-command="solidAssistantRevoke"]')
        .click();
    })
    .catch(async (error) => {
      if ((await targets()).some(isAssistant)) {
        throw error;
      }
    });
  panel.close();
  await waitFor(
    () =>
      bookmarks((document) =>
        document.body.innerText.includes('Request cancelled.')
      ),
    'Cancelling from the assistant frame did not settle the request.'
  );
  assert.equal(
    await bookmarks(
      (document) =>
        document.querySelector('[aria-label="Topic suggestions"]').hidden
    ),
    true
  );

  panel = await startSuggestion();
  await pressInBookmarks('solidAssistantClose');
  panel.close();
  await waitFor(
    async () => !(await targets()).some(isAssistant),
    'Closing the Bookmarks dock left the assistant frame active.'
  );

  panel = await startSuggestion();
  await key(page, 'Enter', 13);
  await waitFor(
    () =>
      panel.evaluate(
        () =>
          !document.querySelector('[data-simply-field="bookmarkCapability"]')
            .hidden
      ),
    'The assistant did not become ready for the disconnect check.'
  );
  await read();
  await waitFor(permissionVisible, 'The reverse read did not open a prompt.');
  await bookmarks((document) => {
    document.querySelector('.solid-assistant-dock iframe').src = 'about:blank';
  });
  panel.close();
  await waitFor(
    async () => !(await permissionVisible()),
    'Disconnecting the assistant left a pending permission dialog.'
  );
  await pressInBookmarks('solidAssistantClose');

  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });
  await bookmarks((document) => {
    const field = document.querySelector('input[name="tag"]');
    field.value = 'manual';
    field.form.requestSubmit();
  });
  await waitFor(
    () =>
      bookmarks((document) => document.body.innerText.includes('Tags: manual')),
    'Manual tagging should work offline.'
  );
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await page.send('Page.reload');
  await page.ready();
  await waitFor(
    () =>
      bookmarks((document) =>
        document?.body?.innerText.includes('Tags: manual')
      ),
    'Manual tag did not survive reload.'
  );

  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    mobile: false,
    deviceScaleFactor: 1
  });
  await pressInBookmarks('solidAssistantOpen');
  const resizeWidth = () =>
    bookmarks((document) =>
      Number(
        document
          .querySelector('[role="separator"]')
          .getAttribute('aria-valuenow')
      )
    );
  const width = await waitFor(async () => {
    const value = await resizeWidth();
    return value >= 320 && value;
  }, 'The desktop separator did not become available.');
  await bookmarks((document) =>
    document.querySelector('[role="separator"]').focus()
  );
  await key(page, 'ArrowLeft', 37);
  await waitFor(
    async () => (await resizeWidth()) === width + 24,
    'The desktop separator did not resize by keyboard.'
  );
  await key(page, 'Escape', 27);
  page.close();
  console.log('Assistant preview passed. Gzip bytes by asset:', preview.sizes);
} finally {
  await browser?.close();
  preview.close();
}
