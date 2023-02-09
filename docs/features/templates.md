
### Rendering / TemplateElement

The TemplateElement from _element-js_ can render templates using `lit-html`.

For detailed information see the documentation on [lit-html.polymer-project-org](https://lit-html.polymer-project.org)

> lit-html lets you write HTML templates in JavaScript, then efficiently render and re-render those templates together
> with data to create and update DOM

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

By default, _element-js_ will render templates in light DOM. When rendering in light DOM all global styles will be
applied to your element as well.

As mentioned before in the constructor options you can set `shadowRender` to `true` . The element will render templates
then in the shadow DOM and encapsulate the element from the rest of the document.

#### Data binding

When writing templates vor elements you will often need to access dynamic data as in properties from the
element. `tagged template literals` are just enhanced `string literals`. To access variables just use `${}` anywhere
inside the string.

#### Template Directives

Since we use `lit-html` under the hood for rendering you can use all directives and structures provided by lit.

For more information see the [Template syntax reference](https://lit-html.polymer-project.org/guide/template-reference)
from the lit-html documentation.

#### Slots

Slots are a very powerful feature when using shadow DOM. By providing slots your elements can accept child elements from
the light DOM and have them placed in a specified location inside your elements tree. The slotted content will still
belong to the document and therefore also be styled by the document level styles.

With this pattern you can build things like Modals, Dialogs, etc. where can encapsulate all the behaviour in the Shadow
DOM and let the user pass any content inside the element.

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

When the user (the using developer of the element) passes any content to the element it will be placed instead of the
default slot inside the `div.content`.

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

Any elements that don't have a slot name will be slotted into the default slot.

#### Complex Template structures

In the examples above we have only seen very simple templates. In real elements you will likely have much more
complicated views and your `template()` will start to get messy and hard to read/parse.

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

Although we still left out some very important things the template starts to get complicated. To clean this up we can
improve the readability by implementing parts of the template in dedicated template functions

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
