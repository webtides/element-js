#### Global Styles / CSS

More often than not you will be building elements for a specific design/layout rather than encapsulated and abstract
elements. It is therefore common to style things globally - especially since the rise of utility based CSS frameworks.
When elements render in shadow DOM - they will be encapsulated and won't get any styles applied to them like the rest of
the document.

There is no official and preferred way of sharing styles between documents today. _element-js_ therefore has a custom
solution to this problem. The `TemplateElement` from _element-js_ has another constructor option
named: `adoptGlobalStyles` which is `true` by default. When set to `true` _element-js_ will look for a style element in
the global document with an `id` of "globalStyles" and apply it before any custom/element styles inside the shadow DOM.

Example:

```html

<style id="globalStyles">
	p {
		color: red;
	}
</style>
```

```javascript
export class ShadowElement extends TemplateElement {
	constructor() {
		super({shadowRender: true, adoptGlobalStyles: true});
	}

	template() {
		return html`<p>I will be red although I am in shadow DOM and my element did not provide any CSS itself :)</p>`;
	}
}
```
