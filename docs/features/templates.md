### Rendering / TemplateElement

The TemplateElement from _element-js_ can render templates using `lit-html`.

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

By default, _element-js_ will render templates in light DOM. When rendering in light DOM all global styles will be applied to your element as well.

As mentioned before in the constructor options you can set `shadowRender` to `true` . The element will render templates then in the shadow DOM and encapsulate the element from the rest of the document.

#### Data binding

When writing templates vor elements you will often need to access dynamic data as in properties from the element. `tagged template literals` are just enhanced `string literals`. To access variables just use `${}` anywhere inside the string.

#### Template Directives

In `element-js`, directives are powerful utility functions that enhance and simplify the process of writing templates. Here's a detailed breakdown of the available directives:

##### Built-in directives

**classMap(map)**

Maps object properties to class names based on their truthy values.

Parameters:

    map: Object.<string, string | boolean | number> - An object where the keys represent the class names, and the truthy values determine whether the class should be applied.

Returns:

    A string of class names separated by spaces.

Example:

```javascript
const myMap = { active: true, hidden: false, themeDark: true };
const classes = classMap(myMap);
// Returns: "active themeDark"
```

**styleMap(map)**

Maps object properties to inline styles.

Parameters:

    map: Object.<string, string | undefined | null> - An object where the keys represent the CSS properties and the values represent the CSS values.

Returns:

    A string representation of inline styles.

Example:

```javascript
const myStyles = { backgroundColor: 'red', display: null };
const styles = styleMap(myStyles);
// Returns: "backgroundColor:red;"
```

**when(condition, trueCase, falseCase)**

Renders one of two template parts based on a condition.

Parameters:

    condition: boolean - The condition to test.
    trueCase: TemplateResult | string - The value to return if the condition is true.
    falseCase: TemplateResult | string (optional) - The value to return if the condition is false.

Returns:

    Either the trueCase or falseCase based on the condition.

Example:

```javascript
const result = when(5 > 3, 'True', 'False');
// Returns: "True"
```

**choose(value, cases, defaultCase)**

Selects a template based on a provided value from a map of cases.

Parameters:

    value: string - The value to match against the cases.
    cases: Object.<string, TemplateResult | string> - A map of values to templates.
    defaultCase: TemplateResult | string (optional) - The default template to return if no cases match.

Returns:

    The matching case's template or the defaultCase if none match.

Example:

```javascript
const myCases = { one: 'First', two: 'Second' };
const chosen = choose('two', myCases, 'Unknown');
// Returns: "Second"
```

**unsafeHTML(string)**

Renders a provided string as raw HTML instead of sanitized text. Note: Use with caution, as this can expose vulnerabilities to cross-site scripting (XSS) attacks.

Parameters:

    string: string - The raw HTML string to render.

Returns:

    A function that, when invoked, returns the HTML content.

**spreadAttributes(attributes)**

Renders multiple attributes as key="value" pairs from a map of attributes.

Parameters:

    attributes: Object.<string, any> - The attributes map.

Returns:

    A function that, when invoked, returns a string of attributes.

Example:

```javascript
const attrs = { id: 'myElement', ariaLabel: 'Description' };
const attributeString = spreadAttributes(attrs);
// When invoked, returns: "id='myElement' aria-label='Description'"
```

##### Writing custom directives

Directives in `element-js` are just functions. They accept parameters and return values that manipulate or produce templates or strings.

To write a custom directive:

    Define a Function: This function will describe what your directive does. The function should return either a template, string, or another function based on its parameters.

```javascript
const visibility = (isVisible) => {
    return isVisible ? '' : 'style="display: none;"';
};
```

Use your custom directive in your templates.

```javascript
function template() {
    return html` <div ${visibility(false)}>This div will be hidden.</div> `;
}
```

Remember, the power of directives is in their simplicity. They allow you to encapsulate logic in a function and reuse that logic across multiple templates.

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

Any elements that don't have a slot name will be slotted into the default slot.

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
            ${this.label ? html` <label for="input-${this.name}"> ${this.label} </label> ` : ''}
            <div class="control">
                <input id="input-${this.name}" name="${this.name}" aria-describedby="${this.name}-help" />
            </div>
            ${this.helpMessage ? html` <span id="${this.name}-help"> ${this.helpMessage} </span> ` : ''}
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
            <div class="control">${this.fieldTemplate()}</div>
            ${this.helpTemplate()}}
        `;
    }

    labelTemplate() {
        if (!this.label) return null;
        return html` <label for="input-${this.name}"> ${this.label} </label> `;
    }

    fieldTemplate() {
        return html` <input id="input-${this.name}" name="${this.name}" aria-describedby="${this.name}-help" /> `;
    }

    helpTemplate() {
        if (!this.helpMessage) return null;
        return html` <span id="${this.name}-help"> ${this.helpMessage} </span> `;
    }
}
```
