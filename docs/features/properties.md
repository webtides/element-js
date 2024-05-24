## Attributes/Properties

With attributes and properties you can build out and define the public API of an element. _element-js_ elements can have three different types of properties.

```javascript
export class MyElement extends BaseElement {
    _privatePropery = 'I am private (by convention)';
    publicProperty = 'I am public';

    properties() {
        return {
            reactivePublicProperty: 'I am public & reactive'
        };
    }

    log() {
        console.log(this._privatePropery);
        console.log(this.publicProperty);
        console.log(this.reactivePublicProperty);
    }
}

defineElement('my-element', MyElement);
```

#### Defining properties in JavaScript

Public properties for JavaScript classes where recently added by the JavaScript standard committee. For more information see the [Class fields documentation on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Class_fields) .

On top of these fields _element-js_ adds another form of properties - reactive properties. By overwriting the `properties()` method on your element and returning an object of key/value pairs you can define a list of reactive public properties. Behind the scenes _element-js_ will automatically generate getters and setters for each property and trigger an update/render for the element when these properties change.

All types of properties can be accessed via the `this` operator within the element class or the template function.

#### Using attributes/properties in HTML

_element-js_ will merge all attributes with the reactive properties map. Values set via attribute will always take precedence over values defined in the properties map. Attributes will still be defined as properties even when they are not set in the properties map.

HTML only has the concept of attributes and `string` values. _element-js_ will automatically convert attributes to their correct types of `string`, `number`, `boolean`, `array` and `object`.

> In JavaScript you will typically use camelCase for declaring properties. HTML attributes however only can be lowercase. _element-js_ will therefore convert dash-case names to camelCase variables and vice versa.

#### Property options

Reactive properties can be fine-tuned further by providing options via the constructor. See `propertyOptions` in [Constructor options](../concepts/classes.md).
