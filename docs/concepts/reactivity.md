### Reactivity

_element-js_ elements update asynchronously when attributes or reactive properties change. However many changes happen in one go, the element renders once, in the next animation frame. This page walks through what triggers an update, how updates are batched, in which order the hooks and watchers run, and what the timing means for your code. What a render does with the template is described in [The renderer](./rendering.md).

#### What triggers an update

-   a reactive property changes, one that is defined in `properties()` or comes from an attribute the element had when it connected
-   an attribute of the element changes, a `MutationObserver` sets the matching property, which then goes the same way
-   a [Store](../features/store.md) that the element holds in a property changes
-   a child element is added or removed, when the `childList` option of `mutationObserverOptions` is on. `BaseElement` turns it on by default, `TemplateElement` turns it off
-   you call `requestUpdate()` yourself

Every reactive property gets a getter and a setter on the element. The setter does all the work, in a simplified form:

```javascript
set(newValue) {
    const oldValue = this._state[property];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;

    this._state[property] = newValue;
    // reflect the attribute, serialize the state, subscribe to a store …

    this.requestUpdate().finally(() => {
        this.callPropertyWatcher(property, newValue, oldValue);
        this.notifyPropertyChange(property, newValue);
    });
}
```

#### When a value counts as changed

The setter compares the old and the new value by their JSON, not by reference. An assignment whose JSON did not change does nothing: no update, no watcher, no event.

```javascript
this.user = { ...this.user }; // same JSON, nothing happens
this.items.push('three'); // no setter involved, nothing happens
this.items = this.items; // same array, same JSON, nothing happens

this.items = [...this.items, 'three']; // new JSON, updates
this.user = { ...this.user, name: 'Jane' }; // new JSON, updates
```

A change deep inside an object or an array needs a new value, or a call to `requestUpdate()`. Comparing by JSON also means that every assignment stringifies the old and the new value, which is work for large objects. See [Watch Changes](../features/watch.md) for more examples.

#### Batching

Setting three properties in a row should not render three times. A render is far more work than a property assignment, and only the last state is ever visible. _element-js_ therefore does not update in the setter. The setter requests an update, and the requests are collected until the browser is about to paint the next frame.

A short refresher on the event loop. The browser runs one task at a time, a click handler, a timer callback, a script. After each task it runs all microtasks, the callbacks of resolved promises and of `MutationObserver`. Once per frame, usually 60 times a second, it runs the `requestAnimationFrame` callbacks and paints.

`requestUpdate()` uses an animation frame. Every call cancels the frame the call before requested and requests a new one. The promises of all calls are collected and settled together after the update:

```javascript
requestUpdate() {
    cancelAnimationFrame(this._batchUpdate);
    return new Promise((resolve, reject) => {
        this._requestedUpdates.push({ resolve, reject });
        this._batchUpdate = requestAnimationFrame(() => {
            this.update(); // renders the template
            // resolve all collected promises, or reject them when the update threw
        });
    });
}
```

Requests from several tasks in the same frame end up in one update as well, two events right after each other render once.

#### The order of one update

Take an element with the properties `a` and `b`, a watcher for both and the `beforeUpdate` and `afterUpdate` hooks. Then set three values in one task:

```javascript
el.a = 1;
el.b = 2;
el.a = 3;
```

This is what runs, in this order:

```
beforeUpdate          el.a = 1 requests an update
beforeUpdate          el.b = 2 requests an update
beforeUpdate          el.a = 3 requests an update
… next animation frame …
template()            renders once, with a = 3 and b = 2
afterUpdate
watch a: 0 → 1
watch b: 0 → 2
watch a: 1 → 3
```

-   `beforeUpdate` runs once per request, so once per changed property, right when the property is set
-   the template renders once, with the latest values
-   events and refs are registered after the render, then `afterUpdate` runs once
-   the watchers run after the update, once per assignment, with the old and the new value of that assignment. A property that changed twice calls its watcher twice, the first call gets the value in between
-   the `-changed` events of properties with the `notify` option are dispatched together with the watchers

The first update after the element connected is a little different. It does not run `beforeUpdate`, it renders in the next frame after connecting and then runs `connected` and `afterUpdate`. A `BaseElement` does not update on connect at all unless `deferUpdate` is turned off, a `TemplateElement` does. See [ES6 Classes & Options](./classes.md) for `autoUpdate`, `deferUpdate` and `mutationObserverOptions`.

#### Waiting for an update

`requestUpdate()` returns a promise that resolves after the update of the element. Calling it while an update is pending adds to the batch, it does not render again. That makes it the way to wait for the DOM:

```javascript
el.count = 5;
await el.requestUpdate();
el.querySelector('span').textContent; // '5'
```

This is what tests need: the DOM is neither updated synchronously after the assignment nor after `await Promise.resolve()`, only after the next animation frame.

#### What the animation frame means

Updating in an animation frame batches everything up to the next paint and never renders a state that would not be painted. A few consequences follow from it:

-   **Nested elements update one frame after their parent.** A parent that passes a value down, `` html`<my-child .value=${this.value}></my-child>` ``, sets the property of the child while it renders in its animation frame. The child requests its own frame, which is the next one. A tree of three levels takes three frames, and `await parent.requestUpdate()` resolves before the children rendered. Wait for the child with `await child.requestUpdate()`.
-   **Hidden tabs do not update.** Browsers pause animation frames in background tabs. The requested update runs once the tab is visible again.
-   **Changes during the update are queued.** A property set in `template()`, in `afterUpdate` or in a watcher requests a new update, which runs in the next frame. `beforeUpdate` is different, it runs when a property is set, before the frame. A property set there joins the pending update and runs `beforeUpdate` once more for its own request.
-   **Disconnecting drops a pending update.** An element that is removed before its frame does not render, the promise of that request does not settle.
