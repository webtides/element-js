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
import { BaseElement, defineElement } from '@webtides/element-js';

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

To use this element, just import it and use it like any other HTML element

```html
<script type="module" src="example-element.js" />
<example-element family-name="Smith"></example-element>
```

## Documentation

For detailed documentation see the [Docs](docs/README.md).

## Development

### We use eslint and prettier to ensure good code quality

Prettier will run automatically when staging files via `git`.
To run the linter manually - simply run `npm run lint`.

### Git Branching

We use a trunk-based development workflow.

> In the trunk-based development model, all developers work on a single branch with open access to it. Often it’s simply the main branch. They commit code to it and run it. It’s super simple.
> In some cases, they create short-lived feature branches. Once code on their branch compiles and passes all tests, they merge it straight to main. It ensures that development is truly continuous and prevents developers from creating merge conflicts that are difficult to resolve.

As a Release is complete the main branch will be tagged with the new release version.

### Pull Requests 

Pull requests should take place whenever a: 

- FEATURE is about to be finished
- RELEASE is about to be finished   

When all Reviewers approved a PR the feature/release may be finished locally and pushed to the remote

## License

`element-js` is open-sourced software licensed under the MIT [license](LICENSE).
