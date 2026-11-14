import assert from 'node:assert/strict';
import { recordVisualStyles } from './visual-styles.mjs';

// A 1280x900 desktop at 400% has a 320x225 CSS-pixel layout viewport.
// This checks equivalent reflow, not the browser's actual zoom UI or a reader.
export async function checkZoomLayout(page, name) {
  const original = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    deviceScaleFactor: devicePixelRatio,
    mobile: false
  }));
  try {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 225,
      deviceScaleFactor: 4,
      mobile: false
    });
    const result = await page.evaluate(() => {
      const main = document.querySelector('.swb-suite-main');
      const title = document.querySelector('.swb-header-title');
      const account = document.querySelector('.swb-account');
      const titleBox = title.getBoundingClientRect();
      const accountBox = account.getBoundingClientRect();
      const originalFocus = document.activeElement;
      const control = [...main.querySelectorAll('button, input, a[href]')].find(
        (element) => !element.disabled && element.checkVisibility()
      );
      let coreReachable = true;
      if (control) {
        control.focus();
        control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const box = control.getBoundingClientRect();
        const viewport = main.getBoundingClientRect();
        coreReachable =
          document.activeElement === control &&
          box.bottom > viewport.top &&
          box.top < viewport.bottom;
        originalFocus?.focus({ preventScroll: true });
      }
      return {
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        mainAvailable: main.clientWidth > 0 && main.clientHeight > 0,
        titleClear:
          !account.getClientRects().length ||
          titleBox.top >= accountBox.bottom ||
          titleBox.bottom <= accountBox.top ||
          titleBox.right <= accountBox.left ||
          titleBox.left >= accountBox.right,
        coreReachable
      };
    });
    assert.equal(result.pageFits, true, 'Zoom-equivalent page has no overflow');
    assert.equal(
      result.mainAvailable,
      true,
      'The app retains a scrolling area'
    );
    assert.equal(result.titleClear, true, 'The title clears account controls');
    assert.equal(
      result.coreReachable,
      true,
      'A core control remains reachable'
    );
    if (process.env.SWB_VISUAL_DIR) {
      // Let the compositor repaint after the device-scale/viewport change.
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          })
      );
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      await recordVisualStyles(page, name + '-zoom-equivalent', shot.data);
    }
  }
  finally {
    await page.send('Emulation.setDeviceMetricsOverride', original);
  }
}

export async function checkStyleContracts(page) {
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9
  });
  const result = await page.evaluate(() => {
    const previousFocus = document.activeElement;
    const control = [
      ...document.querySelectorAll(
        '.swb-app-content button, .swb-app-content input'
      )
    ].find((element) => !element.disabled && element.checkVisibility());
    let focusVisible = true;
    if (control) {
      control.focus({ preventScroll: true });
      const focused = getComputedStyle(control);
      focusVisible =
        control.matches(':focus-visible') &&
        ((focused.outlineStyle !== 'none' &&
          parseFloat(focused.outlineWidth) > 0) ||
          focused.boxShadow !== 'none');
      previousFocus?.focus({ preventScroll: true });
    }
    const header = document.querySelector('.swb-suite-header');
    const bodyStyles = document.body.style;
    const previous = bodyStyles.getPropertyValue('--swb-header-background');
    const previousShadow = bodyStyles.getPropertyValue(
      '--swb-header-text-shadow'
    );
    let inheritedHeader;
    let independentSurfaces;
    try {
      bodyStyles.setProperty('--swb-header-background', 'rgb(7, 77, 177)');
      bodyStyles.setProperty('--swb-header-text-shadow', '1px 1px 2px black');
      inheritedHeader = getComputedStyle(header).backgroundColor;
      const surfaces = header.querySelectorAll('.swb-dropdown-menu, dialog');
      independentSurfaces = [...surfaces].every(
        (element) => getComputedStyle(element).textShadow === 'none'
      );
    }
    finally {
      bodyStyles.removeProperty('--swb-header-background');
      if (previous) {
        bodyStyles.setProperty('--swb-header-background', previous);
      }
      bodyStyles.removeProperty('--swb-header-text-shadow');
      if (previousShadow) {
        bodyStyles.setProperty('--swb-header-text-shadow', previousShadow);
      }
    }

    const layout = document.querySelector('.muze-solid-design-list-details');
    let localTheme = true;
    let independentMapping = true;
    if (layout) {
      const original = layout.getAttribute('style');
      try {
        // The adapter must resolve the value at the component, not at :root.
        layout.style.setProperty('--ds-space', '19px');
        localTheme = getComputedStyle(layout).gap === '19px';
        // A different host can supply the component's public interface directly.
        layout.style.setProperty('--swb-list-details-space', '13px');
        independentMapping = getComputedStyle(layout).gap === '13px';
      }
      finally {
        if (original === null) {
          layout.removeAttribute('style');
        }
        else {
          layout.setAttribute('style', original);
        }
      }
    }
    return {
      focusVisible,
      inheritedHeader,
      independentSurfaces,
      localTheme,
      independentMapping,
      hidden: [...document.querySelectorAll('[hidden]')].every(
        (element) => getComputedStyle(element).display === 'none'
      )
    };
  });
  assert.equal(result.inheritedHeader, 'rgb(7, 77, 177)');
  assert.equal(
    result.independentSurfaces,
    true,
    'Title shadows stay out of menus'
  );
  assert.equal(result.focusVisible, true, 'The core control has visible focus');
  assert.equal(result.localTheme, true, 'Local host tokens reach the adapter');
  assert.equal(result.independentMapping, true, 'Host mapping is replaceable');
  assert.equal(result.hidden, true, 'Visibility wins over component layout');
}

export async function checkPickerReflow(page) {
  const result = await page.evaluate(() => {
    const frame = document.querySelector('.muze-solid-ui-capability-frame');
    const provider = frame.contentWindow;
    const root = provider.document.documentElement;
    const originalWidth = frame.style.width;
    const originalScale = root.style.fontSize;
    try {
      frame.style.width = '320px';
      root.style.fontSize = '200%';
      const actions = provider.document.querySelector('.swb-picker-actions');
      const scroller = provider.document.querySelector('.swb-app-content');
      scroller.scrollTop = scroller.scrollHeight;
      const box = actions.getBoundingClientRect();
      const buttons = [...actions.querySelectorAll('button')]
        .filter((button) => button.checkVisibility());
      const inputs = [...actions.querySelectorAll('input')]
        .filter((input) => input.checkVisibility());
      return {
        visible:
          box.height > 0 &&
          box.top >= 0 &&
          box.bottom <= provider.innerHeight + 1,
        contained: [...buttons, ...inputs].every((element) => {
          const control = element.getBoundingClientRect();
          return (
            control.left >= box.left &&
            control.right <= box.right + 1 &&
            control.top >= box.top &&
            control.bottom <= box.bottom + 1
          );
        }),
        rowsClear:
          provider.document
            .querySelector('.swb-picker-request')
            .getBoundingClientRect().bottom <=
          box.top + 1,
        count: buttons.length
      };
    }
    finally {
      frame.style.width = originalWidth;
      root.style.fontSize = originalScale;
    }
  });
  assert.equal(result.count, 2);
  assert.equal(result.visible, true, 'Picker actions remain visible at 200%');
  assert.equal(result.contained, true, 'Picker action labels wrap at 320px');
  assert.equal(result.rowsClear, true, 'Final file rows clear the action bar');
}
