### ES6 classes

Most of the _element-js_ API ist standard ES6 class Syntax with a few ES next proposals.

An _element-js_ element is nothing more than a regular JS class that extends from `HTMLElement`.

> For more information on JavaScript classes see: [Classes on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)

### Constructor & Options

For the most part you won't probably need a constructor when extending your elements from _element-js_.

Optionally you can overwrite the constructor and pass an object to the super call with various element-level options.

```json
{
    "autoUpdate": true,
    "deferUpdate": false,
    "mutationObserverOptions": {
        "attributes": true,
        "childList": true,
        "subtree": false
    },
    "propertyOptions": {},
    "shadowRender": false,
    "styles": []
}
```

#### autoUpdate

Type: `boolean` Default: `true`

When set to `true` the element will call the `requestUpdate()` method on the instance every time a property or attribute was changed. This will re-evaluate everything on the element and trigger a re-render (if a template is provided) and trigger the watchers for the affected properties/attributes.

#### deferUpdate

Type: `boolean` Default: `false`

When set to `true` the element will not call the `requestUpdate()` method upon connecting and therefore will not render (if template was provided) initially. This might be necessary in some cases where you have to prepare and setup your element before actually rendering for the first time. You will have to call the `requestUpdate` method manually at the right lifecycle hook.

#### deferUpdate via attribute

deferUpdate can also be set to true by adding a "defer-update" attribute to the host element.

```html
<deferred-element defer-update></deferred-element>
```

#### deferConnected (⚠️)

Type: `boolean` Default: `false`

When set to `true` the element will early return from the native `connectedCallback()`. Setting this to true will defer the entire initialization of `element-js` feature set. To make the element useful at a later point again `connectedCallback()` must be called at a later point.

This is an advanced Setting and should be used with great caution.

#### deferConnected via attribute (⚠️)

deferConnected can also be set to true by adding a "defer-connected" attribute to the host element.

```html
<deferred-element defer-connected></deferred-element>
```

#### mutationObserverOptions

Type: `object` Default: `{ "attributes": true, "childList": true, "subtree": false }`

By default, the element will register a _Mutation Observer_, listen for attribute changes and call the `requestUpdate` method if `autoUpdate` is enabled. When `childList` is set to `true` the element will also call the `requestUpdate` method for childList modifications (eg. Adding or removing child elements). The `mutationObserverOptions` takes a dictionary in the exact same form as the [MutationObserverInit options](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserverInit). By setting the `subtree` option to `true` the element will also call the `requestUpdate` method for attribute changes and childList modifications on nested child elements.

> Please note that observing `subtree` mutations might have performance implications and use it only if necessary.

#### propertyOptions:

```js
{
	parseDisabled: {
		parse: false,
	},
	parseString: {
		parse: (value) => value.toString(),
	},
},
```

Type: `object` Default `{}`

With the `propertyOptions` object you can fine tune the update behaviour for certain properties/attributes.

```json
{
    "propertyA": {
        "reflect": true
    }
}
```

By default all options are `false` for all properties/attributes. Currently the following options are available:

```json
{
    "reflect": false,
    "parse": false,
    "notify": false
}
```

_reflect_ When set to `true` the element will reflect property changes back to attributes if the attribute was not present when connecting the element. By default all attributes that are present when connecting the element will be reflected anyway.

_parse_ When set to `false` the element will not automatically try to parse the attributes string value to a complex type (number, array, object).

_notify_ When set to `true` the element will dispatch `CustomEvent`s for every property/attribute change. The event name will be the property name all lowercase and camel to dashes with a postfix of `-changed`. For example `propertyA` will dispatch an event with the name `property-a-changed` . The event `detail` property will be the changed property value. The event will `bubble` by default.

_parse_ and _reflect_ can also be provided with a callback function for total control of the parsing and/or reflection of the attributes value

```js
propertyOptions = {
    parseString: {
        parse: (value) => value.toString()
    },
    reflectCustom: {
        reflect: () => 'custom'
    }
};
```

#### shadowRender

Type: `boolean` Default: `false`

When set to `true` the element will render the template (if provided) in the _Shadow DOM_ and therefore encapsulate the element and styles from the rest of the document. For more information on shadow DOM see [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM).

#### styles

Type `array` Default: `[]`

Via the `styles` option you can add multiple styles/stylesheets to your element. For more information on styling your elements see the [Styles](../features/styles.md) section.
