import assert from 'node:assert/strict';

export async function waitForAccount(page) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const ready = await page.evaluate(() => {
      const frame = document.querySelector('.muze-solid-ui-account-frame');
      return document.querySelector('.connect-dialog')?.open &&
        frame && !frame.hidden &&
        frame.contentWindow.swbAccountApp?.runtime.peer &&
        !frame.contentDocument.querySelector('fieldset')?.disabled;
    });
    if (ready) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.fail('Account did not become interactive: ' +
    await page.evaluate(() => document.body.innerText));
}

export async function clickAccount(page, selector) {
  await waitForAccount(page);
  await page.evaluate(async () => {
    const dialog = document.querySelector('.connect-dialog');
    await Promise.all(dialog.getAnimations().map((animation) =>
      animation.finished.catch(() => {})));
  });
  const point = await page.evaluate(`() => {
    const selector = ${JSON.stringify(selector)};
    const frame = document.querySelector('.muze-solid-ui-account-frame');
    const element = frame.contentDocument.querySelector(selector);
    element.scrollIntoView({ block: 'center' });
    const bounds = element.getBoundingClientRect();
    const offset = frame.getBoundingClientRect();
    return { x: offset.x + bounds.x + bounds.width / 2,
      y: offset.y + bounds.y + bounds.height / 2 };
  }`);
  await page.send('Page.bringToFront');
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type, ...point, button: 'left', clickCount: 1
    });
  }
}

export async function submitAccount(page, values) {
  await waitForAccount(page);
  await page.evaluate(`() => {
    const values = ${JSON.stringify(values)};
    const frame = document.querySelector('.muze-solid-ui-account-frame');
    const form = frame.contentDocument.querySelector('form');
    for (const [key, value] of Object.entries(values)) {
      const input = form.elements.namedItem(key);
      input.value = value;
      input.dispatchEvent(new frame.contentWindow.Event('input', {
        bubbles: true
      }));
    }
  }`);
  await clickAccount(page, 'button:not([type])');
}
