## Guides/Tooling

### Frontend Stack

### Bundling/Publishing

### Design System

### Style Guide / Best Practices

This is an element style guide created and enforced for the purpose of standardizing elements and file structures.

#### File structure

-   One element per file.
-   One element per directory. Though it may make sense to group similar elements into the same directory, we've found it' s easier to consume and document elements when each one has its own directory.
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

Elements are not actions, they are conceptually "things". It is better to use nouns, instead of verbs, such us: " animation" instead of "animating". "input", "tab", "nav", "menu" are some examples.

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
