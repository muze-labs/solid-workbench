# Experimental SimplyFlow events

Private Workbench workspace package. It extends the installed SimplyFlow app
without changing SimplyFlow core, rendering content or introducing an event bus.
It is not published or committed to a stable public API.

Components declare named `events`; SimplyFlow composes them with app overrides.
Install the extension after the suite's definition/cleanup adapter and before
explicit initialization. Start when the app is ready to receive notifications:

```js
import { app } from '@muze-labs/simplyflow/app';
import { installEvents } from '@muze-labs/simplyflow-events';

const view = app({
  container,
  events: {
    swbDocumentChanged: {
      target() {
        return this.api.documents.events;
      },
      type: 'document-changed',
      action: 'refreshDocument'
    }
  },
  actions: {
    refreshDocument(event) {
      this.data.title = event.detail.title;
    }
  },
  api: { documents },
  data: { title: '' }
});
installEvents(view);
view.eventBindings.start();
```

`target: 'window'` means the app container's owning window. A target function
runs with the app as `this` and must return an EventTarget synchronously. Events
arrive unchanged, including `CustomEvent.detail`. There are no selector strings,
delegation rules, listener options or payload transformations in this experiment.

A library with a different subscription API can connect directly:

```js
events: {
  swbDocumentChanged: {
    action: 'refreshDocument',
    subscribe(notify) {
      return this.api.documents.subscribe(notify);
    }
  }
}
```

The library must return an unsubscribe function. Use either `subscribe` or
`target`/`type` for each descriptor. Subscriptions may notify synchronously;
`notify(...args)` invokes the current named action with those arguments and
returns its result/promise. It supplies no before/after interception or veto
contract. Native EventTarget does not await action promises or interpret results.
Actions should use SimplyFlow's existing `onError` handling where appropriate.

An optional `when()` predicate runs with app context at activation. It must
return a boolean synchronously; false skips that connection. Targets,
subscription setup/cleanup and predicates are synchronous. An adapter that fails
during setup must undo its own partially created source before throwing; the
extension can clean up only subscriptions that returned their unsubscribe
function. Cleanup must finish synchronously and should not throw.

`view.events` remains the composed declaration map. The controller is
`view.eventBindings`:

- `start()` activates once. Repeated/reentrant activation is a no-op.
- `stop()` disables forwarding before unsubscribing all active sources. It is
  idempotent; a later start reevaluates declarations/conditions.
- `destroy()` permanently disposes the controller. Later activation is a no-op.
  The extension wraps app destruction to dispose bindings before app cleanup.
  Always destroy through `view.destroy()` to also release SimplyFlow resources.

Installation alone attaches no listeners. Installing again returns the same
controller; installation after disposal/destruction is refused. Start-after-app-
destroy is a no-op, so asynchronous initialization cannot attach late listeners.
Do not use SimplyFlow's constructor `start` to invoke this extension before it
has been installed; current suite instances initialize explicitly afterward.

Each notification resolves `view.actions[name]` at invocation. Action replacement
and restoration work in an existing instance; source metadata alone does not
apply an override. Descriptors are copied at activation, so editing declarations
requires stop/start. Component originals remain available through SimplyFlow's
normal composition. Its recursive merge rules also apply to descriptors; an app
override of `action` retains existing target/type fields. There is no special
entry deletion syntax or live descriptor observer.

Failed activation rolls back connections whose cleanup was returned. Stop and
destroy attempt every cleanup even after a failure. Retained callbacks become
inert and stay inert after another start. Multiple cleanup failures are reported
as an AggregateError; an individual source failure retains its identity.

The four initial migrated events are Workbench beforeunload/pagehide and account
storage/hashchange. Protocol listeners and existing element behaviors retain
their separate owners. Promotion into SimplyFlow requires a later review of API
usefulness, lifecycle evidence, readability and download cost.
