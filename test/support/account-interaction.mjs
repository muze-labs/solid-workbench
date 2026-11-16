import assert from 'node:assert/strict';

// Leave the embedded task to use its containing app's account controls.
export async function checkContainingAccount(page) {
  async function waitFor(condition) {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      if (await page.evaluate(condition)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    assert.fail('Containing Account condition timed out: ' + condition);
  }
  await page.send('Page.bringToFront');
  await waitFor(() => Boolean(document.querySelector('.muze-solid-ui-capability-frame')
    .contentWindow.swbPreferencesApp?.runtime.settings));
  assert.equal(await page.evaluate(async () => {
    const frame = document.querySelector('.muze-solid-ui-capability-frame');
    const editor = frame.contentWindow.swbPreferencesApp;
    const previousDraft = editor.runtime.settings.drafts().browseProvider || '';
    globalThis.swbAccountPreviousDraft = previousDraft;
    await editor.runtime.settings.draft('browseProvider', 'https://incomplete.');
    editor.actions.swb_renderProvider();
    return !frame.contentDocument.querySelector('.muze-solid-ui-task-connect') &&
      frame.contentDocument.querySelector('.swb-account').hidden;
  }), true, 'Embedded Preferences has no separate account control.');
  await page.evaluate(() => solidContacts.host.view.commands.call(
    'muzeSolidUiCloseCapability'
  ));
  await waitFor(() => !document.querySelector('.muze-solid-ui-capability-dialog').open);
  await page.evaluate(() => {
    const button = document.querySelector('.muze-solid-ui-account-status');
    button.focus();
    button.click();
  });
  await waitFor(() => Boolean(document.querySelector('.muze-solid-ui-account-frame')
    .contentWindow.swbAccountApp?.runtime.peer));
  await page.evaluate(() => document.querySelector('.muze-solid-ui-account-frame')
    .contentDocument.querySelector('[name=webId]').focus());
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', {
      type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    });
  }
  await waitFor(() => !document.querySelector('.connect-dialog').open);
  await page.evaluate(() => {
    document.querySelector('[data-simply-command=preferences]').click();
  });
  await waitFor(() => Boolean(document.querySelector('.muze-solid-ui-capability-frame')
    .contentWindow.swbPreferencesApp?.runtime.settings));
  assert.equal(await page.evaluate(async () => {
    const editor = document.querySelector('.muze-solid-ui-capability-frame')
      .contentWindow.swbPreferencesApp;
    const retained = editor.runtime.settings.drafts().browseProvider;
    await editor.runtime.settings.draft('browseProvider', swbAccountPreviousDraft);
    editor.actions.swb_renderProvider();
    delete globalThis.swbAccountPreviousDraft;
    return retained;
  }), 'https://incomplete.', 'Preferences draft survives leaving for Account.');
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
