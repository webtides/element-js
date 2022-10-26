# element-js

Simple and lightweight base classes for web components with a beautiful API

## Introduction

`element-js` lets you write simple, declarative and beautiful web components without the boilerplate. It uses `lit-html` for rendering.

## How to use

#### Installation

install `element-js`

```sh
npm install --save @webtides/element-js
```

#### Use / Example Element

`element-js` elements are plain ES6 classes (vanilla JS) with some nice mappings (eg. properties, watch, etc.).

```javascript
// Import from a CDN
// import { BaseElement, defineElement } from 'https://unpkg.com/@webtides/element-js';
// import { BaseElement, defineElement } from 'https://cdn.skypack.dev/@webtides/element-js';
// or when installed via npm
import { BaseElement, defineElement, StoreProperty } from '@webtides/element-js';

const sharedDate = new  StoreProperty({date: Date.now()}) 

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
           familyName: 'Doe',
           sharedDate
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
        return `${this.greeting} ${this.name} ${this.familyName} ${this.sharedDate.date}`;
    }

    // method
    greet() {
        alert('greeting: ' + this.computedMsg);
    }
}
defineElement('example-element', ExampleElement);
```

To use this element, just import it and use it like any other HTML element

```html
<script type="module" src="example-element.js" />
<example-element family-name="Smith"></example-element>
```

## Documentation

For detailed documentation see the [Docs](docs/README.md).

## Contributing & Development

For contributions and development see [contributing docs](.github/CONTRIBUTING.md)

## License

`element-js` is open-sourced software licensed under the MIT [license](LICENSE).
