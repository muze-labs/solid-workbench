export function attachSidebarResize(sidebar, handle, { bounds, onResize }) {
  let requestedWidth;
  let drag;

  function update(width = requestedWidth ?? sidebar.getBoundingClientRect().width, remember = false) {
    const { minimum, maximum } = bounds();
    const value = Math.min(maximum, Math.max(minimum, Math.round(width)));
    if (remember) {
      requestedWidth = value;
    }
    onResize(value, minimum, maximum);
  }

  function direction() {
    return getComputedStyle(sidebar).direction === 'rtl' ? -1 : 1;
  }

  handle.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    drag = { x: event.clientX, width: sidebar.getBoundingClientRect().width };
    handle.focus();
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (drag && handle.hasPointerCapture(event.pointerId)) {
      update(drag.width + (drag.x - event.clientX) * direction(), true);
    }
  });
  handle.addEventListener('lostpointercapture', () => {
    drag = undefined;
  });

  handle.addEventListener('keydown', (event) => {
    const { minimum, maximum } = bounds();
    const width = sidebar.getBoundingClientRect().width;
    const step = 24 * direction();
    const widths = {
      ArrowLeft: width + step,
      ArrowRight: width - step,
      Home: minimum,
      End: maximum
    };
    if (Object.hasOwn(widths, event.key)) {
      event.preventDefault();
      update(widths[event.key], true);
    }
  });

  return update;
}
