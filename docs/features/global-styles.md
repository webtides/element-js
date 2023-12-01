#### Global Styles / CSS

More often than not you will be building elements for a specific design/layout rather than encapsulated and abstract elements. It is therefore common to style things globally - especially since the rise of utility based CSS frameworks. When elements render in shadow DOM - they will be encapsulated and won't get any styles applied to them like the rest of the document.

There is no official and preferred way of sharing styles between documents today. _element-js_ therefore has a custom solution to this problem. The `TemplateElement` from _element-js_ has another constructor option named: `adoptGlobalStyles` which is `true` by default. When set to `true` _element-js_ will look for all styles (<style></style> and <link rel="stylesheet" />) in the document (head and body) and apply them before any custom/element styles inside the shadow DOM.

> Under the hood _element-js_ will copy/clone the global styles and cache them efficiently as `CSSStyleSheets` so that they can be adopted by multiple shadow DOM elements.

Example:

```html
<html>
    <head>
        <style id="globalStylesId">
            .red {
                color: red;
            }
        </style>
        <link class="globalStylesClass" rel="stylesheet" href="blue-styles.css" />
    </head>
    <body>
        <style>
            .green {
                color: green;
            }
        </style>
        <link rel="stylesheet" href="yellow-styles.css" />
    </body>
</html>
```

```javascript
export class ShadowElement extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: true });
    }

    template() {
        return html`
            <p class="red">
                I will be red although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
            <p class="green">
                I will be green although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
            <p class="blue">
                I will be blue although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
            <p class="yellow">
                I will be yellow although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
        `;
    }
}
```

Instead of adopting all global styles it is also possible to only apply a selection of styles from the global document.

```javascript
export class ShadowElement extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: '#globalStylesId' });
    }

    template() {
        return html`
            <p class="red">
                I will be red although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
        `;
    }
}
```

or

```javascript
export class ShadowElement extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: ['#globalStylesId', '.globalStylesClass'] });
    }

    template() {
        return html`
            <p class="red">
                I will be red although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
            <p class="blue">
                I will be blue although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
        `;
    }
}
```

There is one special case for adopted styles in the document. Not only can shadow roots have `.adoptedStyleSheets`, but also the `document`. In case there would be global styles added there you can adopt them by using the special `document` selector.

```javascript
const globalStyle = new CSSStyleSheet();
globalStyle.replaceSync(`.red { color: red;}`);
document.adoptedStyleSheets.push(globalStyle);

export class ShadowElement extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: 'document' });
    }

    template() {
        return html`
            <p class="red">
                I will be red although I am in shadow DOM and my element did not provide any CSS itself :)
            </p>
        `;
    }
}
```

By default, _element-js_ will only apply all style elements from the global document that are present in the initial HTML. It will not observe the document for any changes regarding style elements.

> Observing global styles is done via a MutationObserver on the whole document. This might impose performance issues. 

To enable global style observation you can add the following (inline, sync) script block to yor HTML.

```html
<script>
    /** @type {ElementJsConfig} */
    globalThis.elementJsConfig = {
        observeGlobalStyles: true
    };
</script>
```
