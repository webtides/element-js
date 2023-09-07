### Component Styles / CSS

Every _element-js_ element has the ability to load one or more style sheets. Either by adding them to the `styles`option in the `propertyOptions` via the constructor or by implementing a `styles()` method and returning a list of `string` values.

The value of these "style sheets" must always be a `string`.

```javascript
import { TemplateElement, defineElement, html } from '@webtides/element-js';

const style = 'my-element .element { background: blue; }';

export class StyledElement extends TemplateElement {
    constructor() {
        super({ styles: [style] });
    }

    styles() {
        return ['my-element .element { color: red; }'];
    }

    template() {
        return html` <span class="element">I'm styled!</span> `;
    }
}

defineElement('styled-element', StyledElement);
```

For a better developer experience it is also possible to import real `CSS` files and load them from a separate file instead of cluttering the element with style text.

```javascript
import { StyleElement, defineElement } from '@webtides/element-js';
import style from './styled-element.css';

export class StyledElement extends StyleElement {
    constructor() {
        super({ styles: [style] });
    }
}

defineElement('styled-element', StyledElement);
```

> Importing `CSS` files or rather `modules` is not currently supported by browsers. It is being worked on - but for now we have to rely on build tools to handle this kind of imports. For a detailed guide on how to build/bundle your elements nicely see [Bundling/Publishing](../README.md#bundlingpublishing).

#### Shadow DOM vs. Light DOM

By default, _element-js_ will render in light DOM. In this case the styling will not be encapsulated, and your element styles could potentially leak out and style any global selectors.

To avoid these problems we highly encourage you to always start your selectors with the element tag name.

```css
my-element {
    border: 1px solid blue;
}

my-element .element {
    color: red;
}
```

When you render an element in Shadow DOM instead you don't have to prefix your selectors with the tag name since Shadow DOM automatically scopes the shadow tree and does not leak any styles to the outside document.

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
        super({ shadowRender: true });
    }

    styles() {
        return ['.element { color: var(—highlight-color, red); }'];
    }

    template() {
        return html` <span class="“element”">I'm highlighted!</span> `;
    }
}

defineElement('styled-element', StyledElement);
```

Users of this element can set the value of `—highlight-color`, using the `styled-element` tag as a CSS selector

```css
styled-element {
    -—highlight-color: blue;
}
```

#### PostCSS & Plugins

_element-js_ expects the provided CSS to be valid CSS. In recent years developers have been using preprocessing tools like `SCSS` or `LESS` to write more reusable CSS. Pre-processers can however be quite slow during development. Wouldn't it be nice if we could write “normal” CSS again. But with superpowers?

Since we would recommend to always use `PostCSS` and `autoprefixer` anyway - we suggest that you add a few more plugins.

-   postcss-import: [GitHub - postcss/postcss-import: PostCSS plugin to inline @import rules content](https://github.com/postcss/postcss-import)
-   postcss-nested: [GitHub - postcss/postcss-nested: PostCSS plugin to unwrap nested rules like how Sass does it.](https://github.com/postcss/postcss-nested)

With these plugins, and also CSS custom properties, you will be able to write composable and reusable CSS.

```css
:root {
    -—highlight-color: red;
}
```

```postcss
.btn {
    background: white;
    border: 1px solid grey;
    text: var(—highlight-color);

    &.is-active {
        border: 2px solid black;
    }
}
```

```postcss
@import './root.css';
@import './buttons.css';

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

To see how you can integrate PostCSS into your build tools see: [Guides and Tooling](../README.md#bundlingpublishing)
