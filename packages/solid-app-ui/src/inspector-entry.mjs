import {
  getInspectorPresentation, requestInspectorWindow
} from './inspector/presentation.mjs';

const inspectors = new WeakMap();

export async function openInspector(app, shellView = app, opener = document.activeElement) {
  if (window.top !== window || !app) {
    return;
  }
  let inspector = inspectors.get(app);
  if (inspector?.open) {
    return inspector.open(opener);
  }
  let preparedWindow;
  if (!inspector) {
    if (getInspectorPresentation() === 'window') {
      // Reserve the popup while the Inspect click still has user activation.
      preparedWindow = requestInspectorWindow('about:blank');
    }
    inspector = {};
    inspectors.set(app, inspector);
    inspector.ready = import('./inspector/host.mjs')
      .then(({ createInspector }) => {
        inspector.open = createInspector(app, shellView);
        return inspector.open;
      })
      .catch((error) => {
        preparedWindow?.close();
        inspectors.delete(app);
        throw error;
      });
  }
  const open = await inspector.ready;
  open(opener, preparedWindow);
}
