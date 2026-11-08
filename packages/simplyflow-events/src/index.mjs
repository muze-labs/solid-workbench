// Experimental SimplyFlow extension. Declarations remain composed by SimplyFlow.
const installations = new WeakMap();

function fail(message) {
  throw new Error('simplyflow-events: ' + message);
}

function throwFailures(errors) {
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'simplyflow-events: Multiple failures');
  }
}

function currentAction(app, name, binding) {
  if (!Object.hasOwn(app.actions || {}, name)) {
    fail(binding + ': Missing action ' + name);
  }
  const definition = Object.getOwnPropertyDescriptor(app.actions, name);
  if (typeof definition.value !== 'function') {
    fail(binding + ': Action must be callable: ' + name);
  }
  const action = app.actions[name];
  if (typeof action !== 'function') {
    fail(binding + ': Action must be callable: ' + name);
  }
  return action;
}

function validate(binding, descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    fail(binding + ': Expected an event descriptor');
  }
  const { action, target, type, subscribe, when } = descriptor;
  if (typeof action !== 'string' || !action) {
    fail(binding + ': Expected an action name');
  }
  if (when !== undefined && typeof when !== 'function') {
    fail(binding + ': when must be a function');
  }
  if (subscribe !== undefined) {
    if (
      typeof subscribe !== 'function' ||
      target !== undefined || type !== undefined
    ) {
      fail(binding + ': Use subscribe or target/type, exclusively');
    }
  }
  else if (
    (target !== 'window' && typeof target !== 'function') ||
    typeof type !== 'string' || !type
  ) {
    fail(binding + ': Expected target resolver or window, and event type');
  }
}

export function installEvents(app) {
  if (app.destroyed) {
    fail('Cannot install on a destroyed app');
  }
  const installed = installations.get(app);
  if (installed) {
    if (installed.destroyed) {
      fail('Cannot reinstall disposed bindings');
    }
    return installed;
  }
  if ('eventBindings' in app || typeof app.destroy !== 'function') {
    fail('Expected an app with destroy and no eventBindings property');
  }
  let session;
  let disposed = false;
  let starting = false;
  let stopping = false;

  function release(binding) {
    const cleanup = binding.cleanup;
    binding.cleanup = undefined;
    cleanup?.();
  }

  function stop() {
    const previous = session;
    session = undefined;
    if (!previous) {
      return;
    }
    // Invalidate every callback before any unsubscribe can emit another event.
    for (const binding of previous) {
      binding.active = false;
    }
    const errors = [];
    stopping = true;
    try {
      for (const binding of previous.slice().reverse()) {
        try {
          release(binding);
        }
        catch (error) {
          errors.push(error);
        }
      }
    }
    finally {
      stopping = false;
    }
    throwFailures(errors);
  }

  function start() {
    if (disposed || app.destroyed || session || starting || stopping) {
      return;
    }
    const bindings = [];
    starting = true;
    session = bindings;
    try {
      const entries = Object.entries(app.events || {}).map(
        ([name, descriptor]) => [name, descriptor && { ...descriptor }]
      );
      // Check all declarations before creating any connection.
      for (const [name, descriptor] of entries) {
        validate(name, descriptor);
      }
      for (const [name, descriptor] of entries) {
        if (session !== bindings || disposed || app.destroyed) {
          break;
        }
        if (descriptor.when) {
          const enabled = descriptor.when.call(app);
          if (typeof enabled !== 'boolean') {
            fail(name + ': when must return a synchronous boolean');
          }
          if (!enabled) {
            continue;
          }
        }
        if (session !== bindings || disposed || app.destroyed) {
          break;
        }
        currentAction(app, descriptor.action, name);
        const binding = { active: true };
        bindings.push(binding);
        const notify = (...args) => {
          if (binding.active && !disposed && !app.destroyed) {
            return currentAction(app, descriptor.action, name).apply(app, args);
          }
        };
        if (descriptor.subscribe) {
          binding.cleanup = descriptor.subscribe.call(app, notify);
          if (typeof binding.cleanup !== 'function') {
            binding.cleanup = undefined;
            fail(name + ': subscribe must return a synchronous cleanup function');
          }
        }
        else {
          const ownerDocument = app.container?.ownerDocument || app.container;
          const target = descriptor.target === 'window'
            ? ownerDocument?.defaultView
            : descriptor.target.call(app);
          if (
            typeof target?.addEventListener !== 'function' ||
            typeof target?.removeEventListener !== 'function'
          ) {
            fail(name + ': target must return an EventTarget synchronously');
          }
          // A resolver can synchronously stop/destroy its owner.
          if (!binding.active || session !== bindings) {
            continue;
          }
          target.addEventListener(descriptor.type, notify);
          binding.cleanup = () =>
            target.removeEventListener(descriptor.type, notify);
        }
        // A source may synchronously notify and stop/destroy during setup.
        if (!binding.active || session !== bindings) {
          release(binding);
        }
      }
    }
    catch (error) {
      const errors = [error];
      // A callback may already have stopped/destroyed this activation.
      if (session === bindings) {
        try {
          stop();
        }
        catch (cleanupError) {
          errors.push(cleanupError);
        }
      }
      throwFailures(errors);
    }
    finally {
      starting = false;
    }
  }

  const controller = {
    start,
    stop,
    destroy() {
      disposed = true;
      stop();
    },
    get destroyed() {
      return disposed;
    }
  };
  const destroy = app.destroy.bind(app);
  let destroying = false;
  app.destroy = () => {
    if (destroying || app.destroyed) {
      return;
    }
    destroying = true;
    const errors = [];
    try {
      controller.destroy();
    }
    catch (error) {
      errors.push(error);
    }
    try {
      destroy();
    }
    catch (error) {
      errors.push(error);
    }
    finally {
      destroying = false;
    }
    throwFailures(errors);
  };
  installations.set(app, controller);
  app.eventBindings = controller;
  return controller;
}
