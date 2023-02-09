# element-js

## Introduction

_element-js_ is a collection of base classes for Custom Elements with a beautiful API for building fast and lightweight
Web Components that work with any framework or without a framework at all - because they are just html and vanilla
javascript.

_element-js_ aims to combine the best concepts of current and popular frontend frameworks and web-standard into a single
toolset that will never be outdated because it is just html and javascript.

### Why Custom elements

By using web-standards, developers only need to learn the standard web API once rather than custom framework APIs over
and over again.

While popular frontend frameworks come and go, web components and custom elements will always be part of the web
standard API. And since they conform to the standard web API, they work in any major frontend framework.

Custom elements provide a component model for the web and enable developers to define their own elements. With custom
elements you get a mechanism to associate an ES class with a custom element name which then can be used in HTML
alongside any other element. Inside the class you can define the public API for the custom element.

### Why element-js

Using Custom Clements directly can be quite cumbersome because the underlying API is very low level. To prevent writing
a lot of boilerplate _element-js_ provides extra APIs that enable writing components fast with very little code.

On top of that it also brings some nice features like

- async update/render cycle
- automatic mapping of attributes to properties
- objects, arrays, numbers and booleans as attributes (instead of just strings)
- reflecting properties to attributes
- abstraction for writing templates
- mechanism for loading styles per element
- loading global styles into Shadow Dom

And the best thing? There is no magic! No Framework. No compiler. You only need to extend from an _element-js_ element
instead of the standard `HTMLElement`.

### Browser Support

_element-js_ Elements are natively supported in all modern Browsers including Chrome, Edge, Firefox, and Safari.

| Chrome | Edge   | Firefox | Safari   |
| ------ | ------ | ------- | -------- |
| ✓      | ✓      | ✓       | ✓        |
| v. 60+ | v. 79+ | v. 63+  | v. 10.1+ |

If you need to support older Browsers like IE 11 or Edge 16-18 you will have to load one or two polyfills for Custom
Elements to work seamlessly. _element-js_ does not bring or load any polyfills on its own. You will have to bundle or
load them yourself. For more information see [Bundling/Publishing](#bundlingpublishing).

> _element-js_ comes unbundled, unminified and uses a few `Babel` plugins. Browser support can also be limited for any
> of the `Babel` plugin features, you will probably have to use a build step and run your code through something
> like `Babel`. For a list of `Babel` plugins that are used, see [ES6 Classes](#es6-classes). For more information on
> bundling and publishing your elements see [Bundling/Publishing](#bundlingpublishing).

### Element Core Concepts

+ #### [ES6 Classes & Options](./concepts/classes.md)
+ #### [Lifecycle](./concepts/lifecycle.md)
+ #### [Reactivity](./concepts/reactivity.md)
+ #### [Hierarchy](./concepts/hierarchy.md)

### Features

+ #### [Reactive Attributes/Properties](./features/properties.md)
+ #### [Shared State / Reactive State / Store](./features/store.md)
+ #### [Watch Changes](./features/watch.md)
+ #### [Computed Properties](./features/computed-properties.md)
+ #### [Dependency Injection / Context Protocol](./features/dependency-injection-context-protocol.md)
+ #### [Methods](./features/methods.md)
+ #### [Rendering / TemplateElement](./features/templates.md)
+ #### [Not Rendering Elements / BaseElement](./features/methods.md)
+ #### [Dom References / Refs](./features/refs.md)
+ #### [Component Styles / CSS](./features/styles.md)
+ #### [Global Styles / CSS](./features/global-styles.md)
+ #### [Events](./features/events.md)

### Getting started

`npm install @webtides/element-js`

You can install _element-js_ into an existing project or create a new app from scratch.

### First Element

To define a custom element, create a class that extends _element-js_ and pass the class with a name to
the `defineElement` helper function.

> By specification, a custom element's name can only have lower case letters and must contain a dash.

Here is an example of what a _element-js_ element looks like:

```js
import {BaseElement, defineElement} from '@webtides/element-js';

class ExampleElement extends BaseElement {
	// normal public properties
	greeting = 'Hello';
	name = 'John';

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
		return `${this.greeting} ${this.name} ${this.familyName}`;
	}

	// method
	greet() {
		alert('greeting: ' + this.computedMsg);
	}
}

defineElement('example-element', ExampleElement);
```

> You don't need to fully understand everything just now. We'll explain each part in detail later on.

When the JS class is built, this element can be imported and used in HTML just like any other element tag.

```html

<example-element family-name="Smith"></example-element>
<script type="module" src="./example-element.js">
```

When rendered in the browser, it will log to the console: `Hello John Smith`




## [Guides/Tooling](./guide/guide.md) 


## Testing

### Overview

### Feature tests

### Unit tests

## Recommended Packages

### @webtides/element-library

### @webtides/layouts
