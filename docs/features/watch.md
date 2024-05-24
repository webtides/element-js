### Watch Changes

Alongside defining reactive properties in the `properties()` map, you can define a watcher for every property by implementing a `watch()` map in the same manner.

```javascript
export class MyElement extends BaseElement {
    properties() {
        return {
            property: 'I am public & reactive'
        };
    }

    watch() {
        return {
            property: (newValue, oldValue) => {
                console.log('property changed', { newValue, oldValue });
            }
        };
    }
}
```

Whenever a property is changed (either from within the element or from outside) it will trigger the callback defined in the `watch()` map if present. The callback will be invoked with the old value and the new value as parameters.

_element-js_ compares values by stringifying them rather than by reference and will only trigger update/render cycles if the value actually changed.

> `array` or `object` data will not trigger changes if nested elements/keys are changed. Also methods like `push()` and `shift()` won't work.

Non-mutable operations like `map()` and `shift()` and the spread operator will however change the value and trigger an update cycle.

```javascript
export class MyElement extends BaseElement {
    properties() {
        return {
            items: ['one', 'two']
        };
    }

    count() {
        this.items = [...this.items, 'three'];
    }
}
```

The spread operator works for objects and arrays.

If you want to make sure that an update will be triggered you can always request it manually by calling the `requestUpdate()` method.
