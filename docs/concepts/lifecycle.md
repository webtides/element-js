### Lifecycle

Elements have several lifecycle methods which can be used to hook into different moments. By implementing one of the following methods within the class the element will call them in the right order:

#### connected

Called when the element is connected to the DOM and _element-js_ is done initialising. Usually this hook will only be called once for the lifetime of your element.

> Please note that the `connected` hook however /can/ be called more than once after the first time. It will also be invoked when the element is _attached_ or _moved_ in the DOM or to another DOM.

Use it to initialise the element and set public or "private" properties, query for other DOM elements, etc.

#### beforeUpdate

Called when the element is about to be updated. Whenever a /reactive/ property changed, the element will undergo an update/render cycle. In this hook you can prepare any internal state that might be needed before the update or render actually happens.

> Although the element will update/render after connecting to the DOM, the `beforeUpdate` hook won't be called for the first time. Only on subsequent update cycles.

Property changes in this callback will not be applied in the current frame. They will be queued and processed in the next frame.

#### afterUpdate

Called after the element was updated/rendered. Implement this hook to perform any tasks that need to be done afterwards like setting/toggling classes on child elements or invoking API methods on other elements.

#### disconnected

Called just before the element is about to be disconnected/removed from the DOM. Use this hook to clear or remove everything that might be heavy on the browser like expensive event listeners etc.

_DISCALIMER_

The lifecycle hooks described here are custom methods provided by _element-js_. By default custom elements also have two baked in hooks. `connectedCallback()` and `disconnectedCallback()`. We would encourage you to avoid these if possible. Internally we use them of course to connect the element and trigger the `connected()` callback afterwards. We use them to initialise the elements with all the boilerplate and prepare the API that _element-js_ provides. If you absolutely must use one of them please keep in mind to call the original callback on the `super` element.
