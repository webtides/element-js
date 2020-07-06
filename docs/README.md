# element-js

## Introduction

_element-js_ is a collection of base classes for Custom Elements with a beautiful API for building fast and lightweight Web Components that work with any framework or without a framework at all - because they are just html.

_element-js_ aims to combine the best concepts of current and popular frontend frameworks and web-standard into a single toolset that will never be outdated because it is just html and javascript.

### Why Custom elements

By using web-standards, developers only need to learn the standard web API once rather than custom framework APIs over and over again.

While popular frontend frameworks come and go, web components and custom elements will always be part of the web standard API. And since they conform to the standard web API, they work in any major frontend framework.

Custom elements provide a component model for the web and enable developers to define their own elements. With custom elements you get a mechanism to associate an ES class with a custom element name which then can be used in HTML alongside any other element. Inside the class you can define the public API for the custom element.

### Why element-js

Using custom elements directly can be quite cumbersome because the underlying API is very low level. To prevent writing a lot of boilerplate _element-js_ provides extra APIs that enable writing components fast with very little code.

On top of that it also brings some nice features like

-   async update/render cycle
-   automatic mapping of attributes to properties
-   objects, arrays, numbers and booleans as attributes (instead of just strings)
-   reflecting properties to attributes
-   abstraction for writing templates
-   mechanism for loading styles per element

And the best thing? There is no magic! No Framework. No compiler. You only need to extend from an _element-js_ element instead of the standard `HTMLElement`.

### Browser Support

_element-js_ Elements are natively supported in all modern Browsers including Chrome, Edge, Firefox, and Safari.

| Chrome | Edge   | Firefox | Safari   |
| ------ | ------ | ------- | -------- |
| ✓      | ✓      | ✓       | ✓        |
| v. 60+ | v. 79+ | v. 63+  | v. 10.1+ |

If you need to support older Browsers like IE 11 or Edge 16-18 you will have to load one or two polyfills for Custom Elements to work seamlessly. _element-js_ does not bring or load any polyfills on its own. You will have to bundle or load them yourself. For more information see [Bundling/Publishing](#bundlingpublishing).

> _element-js_ comes unbundled, unminified and uses a few `Babel` plugins. Browser support can also be limited for any of the `Babel` plugin features, you will probably have to use a build step and run your code through something like `Babel`. For a list of `Babel` plugins that are used, see [ES6 Classes](#es6-classes). For more information on bundling and publishing your elements see [Bundling/Publishing](#bundlingpublishing).

### Getting started

`npm install @webtides/element-js`

You can install _element-js_ into an existing project or create a new app from scratch.

### First Element

To define a custom element, create a class that extends _element-js_ and pass the class with a name to the `defineElement` helper function.

> By specification, a custom element’s name can only have lower case letters and must contain a dash.

Here is an example of what a _element-js_ element looks like:

```js
import { BaseElement, defineElement } from '@webtides/element-js';

class ExampleElement extends BaseElement {
    // normal public property
    greeting = 'Hello';

    // private property
    #name = 'John';

    // lifecycle hook
    connected() {
        this.greet();
    }

    // reactive attributes/properties
    properties() {
        return {
            familyName: 'Doe'
        };
    }

    // watchers for property changes
    watch() {
        return {
            familyName: (newValue, oldValue) => {
                console.log('familyName changed', newValue, oldValue);
            }
        };
    }

    // computed property
    get computedMsg() {
        return `${this.greeting} ${this.#name} ${this.familyName}`;
    }

    // method
    greet() {
        alert('greeting: ' + this.computedMsg);
    }
}
defineElement('example-element', ExampleElement);
```

> You don’t need to fully understand everything just now. We’ll explain each part in detail later on.

When the JS class is built, this element can be imported and used in HTML just like any other element tag.

```html
<script type="module" src="./example-element.js">

<example-element family-name="Smith"></example-element>
```

When rendered in the browser, it will log to the console: `Hello John Smith`

## Element

### Overview

Most of the element API ist standard ES6 class Syntax with a few ES next proposals.

### ES6 classes

An _element-js_ element is nothing more than a regular JS class that extends from `HTMLElement`.

> For more information on JavaScript classes see: [Classes on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)

On top of the seasoned feature set, _element-js_ also uses a number of experimental and proposed features from the JavaScript standard committee.

-   [Proposal: Public and private instance fields](https://github.com/tc39/proposal-class-fields)
-   [Proposal: Static class features](https://github.com/tc39/proposal-static-class-features)
-   [Proposal: Optional Chaining](https://github.com/tc39/proposal-optional-chaining)
-   [Proposal: Nullish Coalescing](https://github.com/tc39-transfer/proposal-nullish-coalescing)

> Since browser support can be limited for any of these features, you will probably have to use a build step and run your code through something like `Babel`. For more information on bundling and publishing your elements see [Bundling/Publishing](#bundlingpublishing).

### Constructor & Options

For the most part you won’t probably need a constructor when extending your elements from _element-js_.

Optionally you can overwrite the constructor and pass an object to the super call with various element-level options.

```javascript
{
	autoUpdate: true,
	deferUpdate: false,
	childListUpdate: false,
	propertyOptions: {},
	shadowRender: false,
	styles: [],
}
```

#### autoUpdate

Type: `boolean` Default: `true`

When set to `true` the element will call the `requestUpdate()` method on the instance every time a property or attribute was changed. This will re-evaluate everything on the element and trigger a re-render (if a template is provided) and trigger the watchers for the affected properties/attributes.

#### deferUpdate

Type: `boolean` Default: `false`

When set to `true` the element will not call the `requestUpdate()` method upon connecting and therefore will not render (if template was provided) initially. This might be necessary in some cases where you have to prepare and setup your element before actually rendering for the first time. You will have to call the `requestUpdate` method manually at the right lifecycle hook.

#### childListUpdate

Type: `boolean` Default: `false`

By default the element will register a _Mutation Observer_, listen for attribute changes and call the `requestUpdate` method if `autoUpdate` is enabled. When set to `true` the element will also call the `requestUpdate` method for childList modifications (eg. Adding or removing child elements).

#### propertyOptions

Type: `object` Default `{}`

With the `propertyOptions` object you can fine tune the update behaviour for certain properties/attributes.

```javascript
{
	propertyA: { reflect: true },
}
```

By default all options are `false` for all properties/attributes. Currently the following options are available:

```javascript
{
	reflect: false,
	notify: false,
}
```

_reflect_ When set to `true` the element will reflect property changes back to attributes if the attribute was not present when connecting the element. By default all attributes that are present when connecting the element will be reflected anyway.

_notify_ When set to `true` the element will dispatch `CustomEvent`s for every property/attribute change. The event name will be the property name all lowercase and camel to dashes with a postfix of `-changed`. For example `propertyA` will dispatch an event with the name `property-a-changed` . The event `detail` property will be the changed property value. The event will `bubble` by default.

#### shadowRender

Type: `boolean` Default: `false`

When set to `true` the element will render the template (if provided) in the _Shadow DOM_ and therefore encapsulate the element and styles from the rest of the document. For more information on shadow DOM see [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM).

#### styles

Type `array` Default: `[]`

Via the `styles` option you can add multiple styles/stylesheets to your element. For more information on styling your elements see the [Styles](#styles) section.

### Lifecycle

Elements have several lifecycle methods which can be used to hook into different moments. By implementing one of the following methods within the class the element will call them in the right order:

#### connected

Called when the element is connected to the DOM and _element-js_ is done initialising. Usually this hook will only be called once for the lifetime of your element.

> Please note that the `connected` hook however /can/ be called more than once after the first time. It will also be invoked when the element is _attached_ or _moved_ in the DOM or to another DOM.

Use it to initialise the element and set public or private properties, query for other DOM elements, etc.

#### beforeUpdate

Called when the element is about to be updated. Whenever a /reactive/ property changed, the element will undergo an update/render cycle. In this hook you can prepare any internal state that might be needed before the update or render actually happens.

> Although the element will update/render after connecting to the DOM, the `beforeUpdate` hook won’t be called for the first time. Only on subsequent update cycles.

Property changes in this callback will not be applied in the current frame. They will be queued and processed in the next frame.

#### afterUpdate

Called after the element was updated/rendered. Implement this hook to perform any tasks that need to be done afterwards like setting/toggling classes on child elements or invoking API methods on other elements.

#### disconnected

Called just before the element is about to be disconnected/removed from the DOM. Use this hook to clear or remove everything that might be heavy on the browser like expensive event listeners etc.

_DISCALIMER_ The lifecycle hooks described here are custom methods provided by _element-js_. By default custom elements also have two baked in hooks. `connectedCallback()` and `disconnectedCallback()`. We would encourage you to avoid these if possible. Internally we use them of course to connect the element and trigger the `connected()` callback afterwards. We use them to initialise the elements with all the boilerplate and prepare the API that _element-js_ provides. If you absolutely must use one of them please keep in mind to call the original callback on the `super` element.

### Element Hierarchy

Pleas keep in mind that lifecycles _do not_ wait for child elements to be connected or updated/rendered.

In the example below we have a simple hierarchy of elements.

```javascript
<a-element>
    <b-element>
        <c-element></c-element>
    </b-element>
</a-element>
```

The full lifecycle would be as follows:

1. a-element -> connected()
2. b-element -> connected()
3. c-element -> connected()

This loading/connecting behaviour is compliant with how other (normal) DOM elements are loaded and connected.

#### Example

In the example we render a clock and update the time every second.

```javascript
import { TemplateElement, defineElement, html } from '@webtides/element-js';

export class ClockElement extends TemplateElement {
    timer = null;

    properties() {
        return {
            time: Date.now()
        };
    }

    connected() {
        this.timer = window.setInterval(() => {
            this.time = Date.now();
        }, 1000);
    }

    disconnected() {
        window.clearInterval(this.timer);
    }

    get formattedTime() {
        return new Date(this.time).toLocaleTimeString();
    }

    template() {
        return html` <span>${this.formattedTime}</span> `;
    }
}
defineElement('clock-element', ClockElement);
```

### Attributes/Properties

With attributes and properties you can build out and define the public API of an element. _element-js_ elements can have three different types of properties.

```javascript
export class MyElement extends BaseElement {
	#privatePropery = 'I am private';
	publicProperty = 'I am public';

	properties() {
		return {
			reactivePublicProperty: 'I am public & reactive',
		}
	}

	log() {
		console.log(this.#privatePropery);
		console.log(this.publicProperty);
		console.log(this.reactivePublicProperty);
	}
}
defineElement('my-element' MyElement);
```

#### Defining properties in JavaScript

Private and public properties for JavaScript classes where recently proposed from the JavaScript standard committee and are being currently implemented by browser vendors. For more information see the [Class fields documentation on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Class_fields).

On top of these fields _element-js_ adds another form of properties - reactive properties. By overwriting the `properties()` method on your element and returning an object of key/value pairs you can define a list of reactive public properties. Behind the scenes _element-js_ will automatically generate getters and setters for each property and trigger an update/render for the element when these properties change.

All types of properties can be accessed via the `this` operator within the element class or the template function.

#### Using attributes/properties in HTML

_element-js_ will merge all attributes with the reactive properties map. Values set via attribute will always take precedence over values defined in the properties map. Attributes will still be defined as properties even when they are not set in the properties map.

HTML only has the concept of attributes and `string` values. _element-js_ will automatically convert attributes to their correct types of `string`, `number`, `boolean`, `array` and `object`.

> In JavaScript you will typically use camelCase for declaring properties. HTML attributes however only can be lowercase. _element-js_ will therefore convert dash-case names to camelCase variables and vice versa.

#### Property options

Reactive properties can be fine-tuned further by providing options via the constructor. See `propertyOptions` in [Constructor options](#propertyoptions).

### Computed properties

Sometimes it is necessary to compute properties out of multiple other properties. You can simply define a getter on the element and return a value.

```javascript
export class MyElement extends BaseElement {
    properties() {
        return {
            reactivePublicProperty: 'I am public & reactive'
        };
    }

    get computedProperty() {
        return this.reactivePublicProperty + ' & computed';
    }

    log() {
        console.log(this.computedProperty);
    }
}
```

For every subsequent update/render cycle a computed property will be evaluated again.

> Keep in mind that properties (public or private) that are not declared via the `properties()` map will not trigger an update/render cycle when changed. If you use only non reactive properties to compute a property, it will not be re-evaluated automatically.

### Watchers

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

> `array` or `object` data will not trigger changes if nested elements/keys are changed. Also methods like `push()` and `shift()` won’t work.

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

### Reactivity

_element-js_ elements update asynchronously when attributes or reactive properties are changed. Changes will also be batched if multiple updates occur. The update itself will always happen in the following frame.

An update lifecycle roughly looks like this:

1. A property is changed
2. Check whether the value actually changed and if so, request an update
3. Requested updates are batched in a queue
4. Perform the update in the next frame
5. Trigger Watchers for properties if defined
6. Render the template if defined

### Templates

The TemplateElement from *element-js* can render templates using `lit-html`.

For detailed information see the documentation on [lit-html.polymer-project-org](https://lit-html.polymer-project.org)

> lit-html lets you write HTML templates in JavaScript, then efficiently render and re-render those templates together with data to create and update DOM

To render a template from your element just define a `template()` method and return a `tagged template literal`.

```javascript
export class MyElement extends TemplateElement {
    properties() {
        return {
            name: 'John'
        };
    }

    template() {
        return html` <span>Hello ${this.name}</span> `;
    }
}
```

#### Shadow DOM vs. Light DOM

By default _element-js_ will render templates in light DOM. When rendering in light DOM all global styles will be applied to your element as well.

As mentioned before in the constructor options you can set `shadowRender` to `true` . The element will render templates then in the shadow DOM and encapsulate the element from the rest of the document.

#### Data binding

When writing templates vor elements you will often need to access dynamic data as in properties from the element. `tagged template literals` are just enhanced `string literals`. To access variables just use `${}` anywhere inside the string.

#### Template Directives

Since we use `lit-html` under the hood for rendering you can use all directives and structures provided by lit.

For more information see the [Template syntax reference](https://lit-html.polymer-project.org/guide/template-reference) from the lit-html documentation.

#### Slots

Slots are a very powerful feature when using shadow DOM. By providing slots your elements can accept child elements from the light DOM and have them placed in a specified location inside your elements tree. The slotted content will still belong to the document and therefore also be styled by the document level styles.

With this pattern you can build things like Modals, Dialogs, etc. where can encapsulate all the behaviour in the Shadow DOM and let the user pass any content inside the element.

```javascript
export class ModalElement extends TemplateElement {
    template() {
        return html`
            <div class="backdrop">
                <div class="header">
                    <slot name="header"></slot>
                </div>
                <div class="content">
                    <slot></slot>
                </div>
                <div class="footer">
                    <slot name="footer"></slot>
                </div>
            </div>
        `;
    }
}
```

When the user (the using developer of the element) passes any content to the element it will be placed instead of the default slot inside the `div.content`.

```html
<modal-element>
    <p>I am modal content!</p>
</modal-element>
```

Slots can also be named so that you can have multiple different slots.

```html
<modal-element>
    <p>I am modal content!</p>
    <button slot="footer">OK</button>
</modal-element>
```

Any elements that don’t have a slot name will be slotted into the default slot.

#### Complex Template structures

In the examples above we have only seen very simple templates. In real elements you will likely have much more complicated views and your `template()` will start to get messy and hard to read/parse.

Lets look at a slightly more advanced element

```javascript
export class FormControl extends TemplateElement {
    properties() {
        return {
            label: '',
            name: '',
            helpMessage: ''
        };
    }

    template() {
        return html`
            ${this.label
                ? html`
                      <label for="input-${this.name}">
                          ${this.label}
                      </label>
                  `
                : ''}
            <div class="control">
                <input id="input-${this.name}" name="${this.name}" aria-describedby="${this.name}-help" />
            </div>
            ${this.helpMessage
                ? html`
                      <span id="${this.name}-help">
                          ${this.helpMessage}
                      </span>
                  `
                : ''}
        `;
    }
}
```

Although we still left out some very important things the template starts to get complicated. To clean this up we can improve the readability by implementing parts of the template in dedicated template functions

```javascript
export class FormControl extends TemplateElement {
    properties() {
        return {
            label: '',
            name: '',
            helpMessage: ''
        };
    }

    template() {
        return html`
            ${this.labelTemplate()}
            <div class="control">
                ${this.fieldTemplate()}
            </div>
            ${this.helpTemplate()}}
        `;
    }

    labelTemplate() {
        if (!this.label) return null;
        return html`
            <label for="input-${this.name}">
                ${this.label}
            </label>
        `;
    }

    fieldTemplate() {
        return html` <input id="input-${this.name}" name="${this.name}" aria-describedby="${this.name}-help" /> `;
    }

    helpTemplate() {
        if (!this.helpMessage) return null;
        return html`
            <span id="${this.name}-help">
                ${this.helpMessage}
            </span>
        `;
    }
}
```

### Styles

Every _element-js_ element has the ability to load one or more style sheets. Either by adding them to the `styles` option in the `propertyOptions` via the constructor or by implementing a `styles()` method and returning a list of `string` values.

The value of these "style sheets” must always be a `string` .

```javascript
import { TemplateElement, defineElement, html } from '@webtides/element-js';
const style = ‘my-element .element { background: blue; }’,

export class StyledElement extends TemplateElement {
	constructor() {
		super({ styles: [style] })
	}

	styles() {
		return [
			‘my-element .element { color: red; }’,
		];
	}

  template() {
    return html`
		<span class=“element”>I’m styled!</span>
	  `;
  }
}

defineElement(‘styled-element', StyledElement);
```

For a better developer experience it is also possible to import real `CSS` files and load them from a separate file instead of cluttering the element with style text.

```javascript
import { StyleElement, defineElement } from '@webtides/element-js';
import style from './styled-element.css’;

export class StyledElement extends StyleElement {
	constructor() {
		super({ styles: [style] })
	}
}

defineElement(‘styled-element', StyledElement);
```

> Importing `CSS` files or rather `modules` is not currently supported by browsers. It is being worked on - but for now we have to rely on build tools to handle these kind of imports. For a detailed guide on how to build/bundle your elements nicely see [Bundling/Publishing](#bundlingpublishing).

#### Shadow DOM vs. Light DOM

By default _element-js_ will render in light DOM. In this case the styling will not be encapsulated and your element styles could potentially leak out and style any global selectors.

To avoid these problems we highly encourage you to always start your selectors with the element tag name.

```css
my-element {
    border: 1px solid blue;
}
my-element .element {
    color: red;
}
```

When you render an element in Shadow DOM instead you don’t have to prefix your selectors with the tag name since Shadow DOM automatically scopes the shadow tree and does not leak any styles to the outside document.

```css
.element {
    color: red;
}
```

To style the element itself in the parent document you can use the special `:host` selector.

```css
:host {
    border: 1px solid blue;
}
```

It is also possible to combine the `:host` selector with other matching selectors.

```css
:host {
    display: none;
}
:host([selected]) {
    display: block;
}
```

#### CSS custom properties

Custom properties allow for reusing CSS values throughout a document. To read all about it, see [Using CSS custom properties (variables) - CSS: Cascading Style Sheets | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

The nice thing about custom properties is that they will also take effect inside Shadow DOM elements. They enable therefore a nice and easy way to style certain parts of your element from outside.

```javascript
import { TemplateElement, defineElement, html } from '@webties/element-js';

export class StyledElement extends TemplateElement {
	constructor() {
		super({ shadowRender: true })
	}

	styles() {
		return [
			‘.element { color: var(—highlight-color, red); }’,
		];
	}

  template() {
    return html`
		<span class=“element”>I’m highlighted!</span>
	  `;
  }
}

defineElement(‘styled-element', StyledElement);
```

Users of this element can set the value of `—highlight-color`, using the `styled-element` tag as a CSS selector

```css
styled-element {
    -—highlight-color: blue;
}
```

#### PostCSS & Plugins

_element-js_ expects the provided CSS to be valid CSS. In recent years developers have been using preprocessing tools like `SCSS` or `LESS` to write more reusable CSS. Pre-processers can however be quite slow during development. Wouldn’t it be nice if we could write “normal” CSS again. But with superpowers?

Since we would recommend to always use `PostCSS` and `autoprefixer` anyways - we suggest that you add a few more plugins.

-   postcss-import: [GitHub - postcss/postcss-import: PostCSS plugin to inline @import rules content](https://github.com/postcss/postcss-import)
-   postcss-nested: [GitHub - postcss/postcss-nested: PostCSS plugin to unwrap nested rules like how Sass does it.](https://github.com/postcss/postcss-nested)

With these plugins, and also CSS custom properties, you will be able to write composable and reusable CSS.

```css
:root {
    -—highlight-color: red;
}
```

```css
.btn {
    background: white;
    border: 1px solid grey;
    text: var(—highlight-color);

    &.is-active {
        border: 2px solid black;
    }
}
```

```css
@import ‘./root.css’;
@import ‘./buttons.css’;

my-element {
    -—highlight-color: blue;

    .btn {
        &:hover {
            background: var(—highlight-color);
            text: white;
        }
    }
}
```

To see how you can integrate PostCSS into your build tools see: [Guides and Tooling](#bundlingpublishing)

### Events

In HTML you have two ways of communicating between elements. To send “information” down the tree we typically use attributes or properties on child elements. It is not advised to hold references to parent elements and communicate back up via public methods or properties. The preferred way of sending “information” up the tree is via DOM events. Do read all about them see [Introduction to events - Learn web development | MDN](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events).

_element-js_ is nothing special or exceptional here. You can and should use DOM events and Custom DOM events like usual. We do however provide some nice APIs to make working with events a lot more streamlined.

#### Events map

By implementing an `events()` method in your elements class you can return an object with a list of events that should be registered on the element or its children, along with event handlers to be triggered once the event gets fired. You can use any of the native events or even custom events.

The outer key value pairs let you specify regular DOM selectors as the key for the element the event listeners should be registered on. In the inner object you can define key value pairs where the key is the event to be listened for on the element and the value is the callback to be triggered once the event fires. For every event you can get the event as variable passed to the callback.

```javascript
events() {
	return {
		this: {
			click: (e) => console.log(‘click’, e),
			customEvent: (e) => {
				console.log(‘customEvent’, e);
			},
		},
		‘[data-increment]’: {
			click: () => this.count++
		}
    }
}

```

The nice thing about this pattern is that you will only have one place for all the event logic. You don’t have to declare event handlers in the template and then call dedicated methods defined in the element. Everything is nice and compact in one place.

_this_ When using arrow functions as callbacks in the `events()` map you can use `this` as usual and it will belong to the element itself.

_context_ When binding element methods directly as callbacks you would typically have to bind the context to the element itself.

```javascript
events() {
	return {
		this: {
			click: (e) => this.doStuff.bind(this),
		},
    }
}
```

_element-js_ will do that for you automatically behind the scenes. So can omit the `bind` in most cases.

```javascript
events() {
	return {
		this: {
			click: (e) => this.doStuff,
		},
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
events() {
	return {
		this: {
			click: (e) => console.log(‘click’, e),
		},
		window: {
			scroll: (e) => console.log(‘scroll’, e),
		},
		document: {
			visibilitychange: (e) => {
				if (document.visibilityState === ‘visible’) {
    				backgroundMusic.play();
  				} else {
    				backgroundMusic.pause();
  				}
			},
		},
    }
}
```

> _element-js_ will smartly add and remove all the defined event listeners on every update/render cycle to ensure that events will always fire even though you might have changed the child DOM tree during render cycles.

#### Dispatching events

To make it easy to dispatch events from your elements itself _element-js_ implements a special method `dispatch()` .

```javascript
dispatch(name, data, options = { bubble: true, cancelable: false, composed: false}) {
    const event = new CustomEvent(name, { bubbles: options.bubble, cancelable: options.cancelable, composed: options.composed, detail: data });
    this.dispatchEvent(event);
}
```

You can of course still always build them yourself like above but it is much easier and faster to use like this:

```javascript
this.dispatch(‘customEvent’, { key: ‘value’ });
```

### Refs

To avoid constant lookups of (child) elements from your elements _element-js_ will collect all elements with a `[ref=“id”]` attribute and make them available as an object on the element itself via the special `this.$refs` reference.

```html
<places-search>
	<input type=“text" ref=“input”/>
	<places-list ref="list”></places-list>
</places-search>
```

```javascript
import { BaseElement, defineElement, html } from '@webtides/element-js';

export class PlacesSearch extends BaseElement {
	events() {
		return {
			input: {
				blur: (e) => {
					// fetch places...
					const places = [];
					this.$refs.list = places;
				},
			},
    	}
	}
}

defineElement(‘places-search’, PlacesSearch);
```

> _element-js_ will smartly add and remove all refs on every update/render cycle to ensure that they will always be correct even though you might have changed the child DOM tree during render cycles.

### Methods

Besides public properties you can also shape the API for your element with public methods.

```javascript
import { BaseElement, defineElement } from '@webtides/element-js';

export class ModalElement extends BaseElement {
	open() {
		// do the things to actually open the modal…
	}
}

defineElement(‘modal-element’, ModalElement);
```

```javascript
import { BaseElement, defineElement } from '@webtides/element-js';

export class OtherElement extends BaseElement {
	events() {
		return {
			this: {
				click: () => {
					this.$refs.modal.open();
				},
			},
    	}
	}
}

defineElement(‘other-element’, OtherElement);
```

### Renderless elements

More often than not you won’t actually need to render anything from your element but rather only trigger some changes on other elements, fire events or fetch data and distribute it to related elements.

A good example for this pattern is to use container elements for fetching data and delegating it to child elements that only take attributes/properties and simply render them.

```html
<places-search>
	<input type=“text" ref=“input”/>
	<places-list ref="list”></places-list>
</places-search>
```

```javascript
import { BaseElement, defineElement } from '@webtides/element-js';

export class PlacesSearch extends BaseElement {
	events() {
		return {
			input: {
				blur: (e) => {
					// fetch places...
					const places = ['list of place objects…’];
					this.$refs.list = places;
				},
			},
    	}
	}
}

defineElement(‘places-search’, PlacesSearch);
```

Another good use case for renderless elements is when you need to change some classes or styles on child elements. It is a bit like `jQuery` but much better because everything is declaratively composed of little elements instead of having a big JavaScript file full of little mutations.

```html
<dropdown-element>
    <button>Options</button>
    <ul ref="“list”" class="“”hidden">
        <li>Profile</li>
        <li>Settings</li>
        <li>Sign out</li>
    </ul>
</dropdown-element>
```

```javascript
import { BaseElement, defineElement } from '@webtides/element-js';

class DropdownElement extends BaseElement {
	events() {
		return {
			button: {
				click: () => {
					this.$refs.list.classList.remove(‘hidden’);
				},
			},
    	}
	}
}

defineElement(‘dropdown-element’, DropdownElement);
```

## Guides/Tooling

### Frontend Stack

### Bundling/Publishing

### Design System

### Style Guide

This is an element style guide created and enforced for the purpose of standardizing elements and file structures.

#### File structure

-   One element per file.
-   One element per directory. Though it may make sense to group similar elements into the same directory, we've found it's easier to consume and document elements when each one has its own directory.
-   Implementation (.js) and styles (.css) of an element should live in the same directory.

Example:

```
├── card-element
│   ├── card-element.css
│   ├── card-element.js
│   └── test
│       ├── card-element.e2e.js
│       └── card-element.spec.js
├── card-content
│   ├── card-content.css
│   └── card-content.js
├── card-title
│   ├── card-title.css
│   └── card-title.js
```

#### Naming

##### Name

Elements are not actions, they are conceptually "things". It is better to use nouns, instead of verbs, such us: "animation" instead of "animating". "input", "tab", "nav", "menu" are some examples.

##### -element postfix

The naming has a major role when you are creating a collection of elements intended to be used across different projects. Web Components are not scoped because they are globally declared within the page, which means a "unique" name is needed to prevent collisions.  
Additionally, web components are required to contain a "-" dash within the tag name. When using the first section to namespace your components - everything will look the same, and it will be hard to distinguish elements.

DO NOT do this:

```
company-card
    company-card-header
        company-card-title
    company-card-content
    company-card-footer
```

Instead, use -element for elements with a single noun.

```
card-element
    card-header
        card-title
    card-content
    card-footer
```

##### Modifiers

When several elements are related and/or coupled, it is a good idea to share the name, and then add different modifiers, for example:

```
menu-element
menu-controller
```

```
card-element
card-header
card-content
```

##### Element (JS class)

The name of the ES6 class of the element should reflect the file name, and the html tag name.

```js
export class ButtonElement extends BaseElement {}
customElements.define('button-element', ButtonElement);

export class MenuElement extends BaseElement {}
customElements.define('menu-element', MenuElement);
```

#### Code organization

##### Newspaper Metaphor from The Robert C. Martin's _Clean Code_

> The source file should be organized like a newspaper article, with the highest level summary at the top, and more and more details further down. Functions called from the top function come directly below it, and so on down to the lowest level, and most detailed functions at the bottom. This is a good way to organize the source code, even though IDE:s make the location of functions less important, since it is so easy to navigate in and out of them.

## Testing

### Overview

### Feature tests

### Unit tests

## Recommended Packages

### @webtides/element-library

### @webtides/layouts
