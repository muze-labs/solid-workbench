// Use the same public names as SimplyFlow's browser entry.
import { app, mergeable } from '@muze-labs/simplyflow/app';
import { bind, getValueByPath } from '@muze-labs/simplyflow/bind';
import { model, sort } from '@muze-labs/simplyflow/model';
import {
  batch, destroy, effect, raw, signal, untracked
} from '@muze-labs/simplyflow/state';
import { installEvents } from '@muze-labs/simplyflow-events';

Object.assign(globalThis.simply ??= {}, {
  app,
  bind,
  getValueByPath,
  mergeable,
  model: Object.assign(model, { model, sort }),
  batch,
  destroy,
  effect,
  signal,
  raw,
  untracked,
  installEvents
});
