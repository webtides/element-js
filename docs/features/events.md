### Events

In HTML you have two ways of communicating between elements. To send “information” down the tree we typically use attributes or properties on child elements. It is not advised to hold references to parent elements and communicate back up via public methods or properties. The preferred way of sending “information” up the tree is via DOM events. Do read all about them see [Introduction to events - Learn web development | MDN](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events) .

_element-js_ is nothing special or exceptional here. You can and should use DOM events and Custom DOM events like usual. We do however provide some nice APIs to make working with events a lot more streamlined.

#### Events map

By implementing an `events()` method in your elements class you can return an object with a list of events that should be registered on the element or its children, along with event handlers to be triggered once the event gets fired. You can use any of the native events or even custom events.

The outer key value pairs let you specify regular DOM selectors as the key for the element the event listeners should be registered on. In the inner object you can define key value pairs where the key is the event to be listened for on the element and the value is the callback to be triggered once the event fires. For every event you can get the event as variable passed to the callback.

```javascript
export class MyElement extends BaseElement {
    events() {
        return {
            this: {
                click: (e) => console.log('click', e),
                customEvent: (e) => {
                    console.log('customEvent', e);
                }
            },
            '[data-increment]': {
                click: () => this.count++
            }
        };
    }
}
```

The nice thing about this pattern is that you will only have one place for all the event logic. You don't have to declare event handlers in the template and then call dedicated methods defined in the element. Everything is nice and compact in one place.

_this_ When using arrow functions as callbacks in the `events()` map you can use `this` as usual and it will belong to the element itself.

_context_ When binding element methods directly as callbacks you would typically have to bind the context to the element itself.

```javascript
export class MyElement extends BaseElement {
    events() {
        return {
            this: {
                click: (e) => this.doStuff.bind(this)
            }
        };
    }
}
```

_element-js_ will do that for you automatically behind the scenes. So can omit the `bind` in most cases.

```javascript
export class MyElement extends BaseElement {
    events() {
        return {
            this: {
                click: (e) => this.doStuff
            }
        };
    }
}
```

If you need to bind a different context however you can do that of course.

_Special selectors_ Sometimes you will need to listen to more global events rather than on the element itself or its children. We therefore enable you to define the following selectors as event targets:

-   window
-   document
-   this

Since most events will automatically bubble up the tree it is also possible to listen for events that are not directly related to your element.

```javascript
export class MyElement extends BaseElement {
    events() {
        return {
            this: {
                click: (e) => console.log('click', e)
            },
            window: {
                scroll: (e) => console.log('scroll', e)
            },
            document: {
                visibilitychange: (e) => {
                    if (document.visibilityState === 'visible') {
                        backgroundMusic.play();
                    } else {
                        backgroundMusic.pause();
                    }
                }
            }
        };
    }
}
```

For better control Events can be bound with listener options by using the "complex notation" The callback need to wrapped into an Object to pass the Options alongside.

```js
{
	listener: (e) => console.log('scroll', e),
		options
:
	{
		passive : true
	}
}
```

Naming is heavily inspired by the addEventListener signature https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener

```javascript
export class MyElement extends BaseElement {
    events() {
        return {
            window: {
                scroll: {
                    listener: (e) => console.log('scroll', e),
                    options: { passive: true }
                }
            }
        };
    }
}
```

> _element-js_ will smartly add and remove all the defined event listeners on every update/render cycle to ensure that events will always fire even though you might have changed the child DOM tree during render cycles.

#### Dispatching events

To make it easy to dispatch events from your elements itself _element-js_ implements a special method `dispatch()` .

```javascript
export class BaseElement {
    dispatch(name, data, options = { bubbles: true, cancelable: true, composed: true }) {
        const event = new CustomEvent(name, {
            bubbles: options.bubbles,
            cancelable: options.cancelable,
            composed: options.composed,
            detail: data
        });
        this.dispatchEvent(event);
    }
}
```

You can of course still always build them yourself like above, but it is much easier and faster to use like this:

```javascript
export class MyElement extends BaseElement {
    someMethod() {
        this.dispatch('customEvent', { key: 'value' });
    }
}
```
