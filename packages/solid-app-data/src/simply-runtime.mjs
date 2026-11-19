// Use the same public names as SimplyFlow's browser entry.
import { app, mergeable } from '@muze-labs/simplyflow/app';
import { model, sort } from '@muze-labs/simplyflow/model';
import {
  batch, destroy, effect, signal, untracked
} from '@muze-labs/simplyflow/state';
import { installEvents } from '@muze-labs/simplyflow-events';

Object.assign(globalThis.simply ??= {}, {
  app,
  mergeable,
  model: Object.assign(model, { model, sort }),
  batch,
  destroy,
  effect,
  signal,
  untracked,
  installEvents
});
