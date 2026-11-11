import assert from 'node:assert/strict';

// Account's own modal can be presented inside an active Preferences provider.
export async function checkNestedAccount(page) {
  await page.send('Page.bringToFront');
  await page.evaluate(async () => {
    const frame = document.querySelector('.muze-solid-ui-capability-frame');
    const editor = frame.contentWindow.swbPreferencesApp;
    const button = frame.contentDocument.querySelector(
      '.muze-solid-ui-task-connect'
    );
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (editor.runtime.settings && !frame.inert) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const previousDraft = editor.runtime.settings.drafts().browseProvider || '';
    await editor.runtime.settings.draft('browseProvider', 'https://incomplete.');
    editor.actions.swb_renderProvider();
    globalThis.swbAccountEditorProbe = {
      editor, request: editor.runtime.request, button, previousDraft
    };
    button.focus();
    button.click();
  });
  async function waitFor(condition) {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      if (await page.evaluate(condition)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    assert.fail('Nested Account condition timed out: ' + condition);
  }
  await waitFor(() => {
    const probe = swbAccountEditorProbe;
    const frame = probe.button.ownerDocument.querySelector(
      '.muze-solid-ui-account-frame'
    );
    return frame && !frame.hidden &&
      frame.contentWindow.swbAccountApp?.runtime.peer;
  });
  assert.equal(await page.evaluate(() => {
    const { editor, request, button } = swbAccountEditorProbe;
    const doc = button.ownerDocument;
    const frame = doc.querySelector('.muze-solid-ui-account-frame');
    const input = frame.contentDocument.querySelector('[name=webId]');
    input.focus();
    input.value = 'https://draft.';
    input.dispatchEvent(new frame.contentWindow.Event('input', {
      bubbles: true
    }));
    return document.querySelector('.muze-solid-ui-capability-dialog').open &&
      doc.querySelector('.connect-dialog').open &&
      editor.runtime.request === request &&
      editor.runtime.settings.drafts().browseProvider === 'https://incomplete.';
  }), true, 'Account preserves the active provider and its incomplete draft.');
  // Native Escape crosses the iframe focus boundary to its owning modal.
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    });
  }
  await waitFor(() => !swbAccountEditorProbe.button.ownerDocument
    .querySelector('.connect-dialog').open);
  assert.equal(await page.evaluate(() => {
    const { editor, request, button } = swbAccountEditorProbe;
    return button.ownerDocument.activeElement === button &&
      editor.runtime.request === request &&
      editor.runtime.settings.drafts().browseProvider === 'https://incomplete.';
  }), true, 'Escape restores focus to Preferences without ending its task.');
  await page.evaluate(() => swbAccountEditorProbe.button.click());
  await waitFor(() => {
    const doc = swbAccountEditorProbe.button.ownerDocument;
    const frame = doc.querySelector('.muze-solid-ui-account-frame');
    return !frame.hidden && frame.contentDocument
      ?.querySelector('[name=webId]')?.value === 'https://draft.';
  });
  await page.evaluate(async () => {
    const { editor, previousDraft } = swbAccountEditorProbe;
    await editor.runtime.host.view.commands.call('closeConnect');
    await editor.runtime.settings.draft('browseProvider', previousDraft);
    editor.actions.swb_renderProvider();
    delete globalThis.swbAccountEditorProbe;
  });
}

export async function checkAccountOffline(page) {
  await page.send('Page.bringToFront');
  // The preceding native Close click starts the shared exit animation.
  // Wait for native modality to end before opening the next presentation.
  await page.evaluate(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (!document.querySelector('.connect-dialog').open) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error('account-test: Previous Account dialog did not close.');
  });
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  try {
    await page.evaluate(() => solidContacts.host.view.commands.call('connectDialog'));
    const failed = await page.evaluate(async () => {
      for (let attempt = 0; attempt < 250; attempt += 1) {
        if (!document.querySelector('[data-simply-command=connectDialog]' +
          '[data-simply-field=muzeSolidUiAccountRetry]').hidden) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return false;
    });
    assert(failed, 'An uncached offline Account load offers Retry and Close.');
    assert.equal(await page.evaluate(() => solidContacts.host.view.runtime
      .accountPeer), null);
  }
  finally {
    await page.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    });
  }
  await page.evaluate(() => document.querySelector(
    '[data-simply-field=muzeSolidUiAccountRetry]'
  ).click());
  const recovered = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const frame = document.querySelector('.muze-solid-ui-account-frame');
      if (!frame.hidden && frame.contentWindow.swbAccountApp?.runtime.peer) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return false;
  });
  assert(recovered, 'Retry loads the Account app after reconnection.');
  await page.evaluate(async () => {
    await solidContacts.host.view.commands.call('closeConnect');
  });
}
