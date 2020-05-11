# element

Simple and lightweight base classes for web components with a beautiful API

## Introduction

`element` lets you write simple, declarative and beautiful web components without the boilerplate. It uses `lit-html`
for rendering.

## How to use

#### Installation

```sh
npm install --save @currentjs/element
```

#### Use / Example Element

CurrentJS elements are plain ES6 classes with some nice mappings (eg. properties, watch, etc.).

```javascript
import { BaseElement, defineElement } from '@currentjs/element';

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
            familyName: 'Doe',
        };
    }

    // watchers for property changes
    watch() {
        return {
            familyName: (newValue, oldValue) => {
                console.log('familyName changed', newValue, oldValue);
            },
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

To use this element, just import it and use it like any other HTML element

```html
<script type="module" src="example-element.js" />
<example-element family-name="Smith"></example-element>
```

## Documentation

For detailed documentation see the [Docs](docs/README.md).

## License

`element` is open-sourced software licensed under the MIT [license](LICENSE).
