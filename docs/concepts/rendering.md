### The renderer

`template()` returns a template literal tagged with `html`, the element hands it to `render()`, and the DOM shows the values. This page follows a template through every step in between: on the first render in the browser, on every update after it, on the server through `toString()`, and on hydration of server rendered markup. All four use the same parse result of the literal, a binding means the same in each of them.

```
template()  →  html`…`  →  TemplateResult { strings, values }
                                   │
                   parseTemplate(strings), once per literal
                                   │
          ┌────────────────┬───────┴─────────┬─────────────────┐
     descriptors       clientHtml       ssrSegments           hash
     one per binding   for the clone    for toString()        for hydration
          │                │
          └── bind ────────┘  →  parts  →  update(values) writes what changed
```

When an element renders is described in [Reactivity](./reactivity.md).

#### 1. `html` collects, nothing more

`html` is a tag function. JavaScript calls it with the static strings of the literal and the values of the interpolations, `html` keeps both in a `TemplateResult` and returns:

```javascript
const card = (type, title, onClick) => html`<div class="card ${type}" @click=${onClick}><h2>${title}</h2></div>`;

const result = card('info', 'Hello', () => {});
result.strings; // ['<div class="card ', '" @click=', '><h2>', '</h2></div>']
result.values; // ['info', () => {}, 'Hello']
```

No parsing, no DOM. `template()` can run on every update because it only builds this small object. The strings are what makes the rest fast: JavaScript passes the same frozen `strings` array for every call of the same literal, the renderer uses it as the key for everything it learns about the literal.

#### 2. The literal is parsed once

The first time a literal is rendered, `parseTemplate()` follows its markup far enough to tell where each interpolation sits, and caches the result for the literal. An interpolation can sit:

-   between elements, a child node binding: `<h2>${title}</h2>`
-   in an attribute value, an attribute binding. Several interpolations in one attribute are one binding with the static pieces between them: `class="card ${type}"`
-   in the content of `<style>`, `<script>`, `<textarea>` or `<title>`, a text binding
-   inside the opening tag between the attributes, a directive: `<div ${spreadAttributes(attrs)}>`

An interpolation anywhere else cannot be bound, in a comment, a tag name or an attribute name. So can a `?`, `.` or `@` binding that is not the whole attribute value. `parseTemplate()` throws a `ParseTemplateError` for those.

For the card above the result is:

```javascript
descriptors: [
    { kind: 'attribute', name: 'class', strings: ['card ', ''], span: 1, index: 0, marker: 0 },
    { kind: 'attribute', name: '@click', strings: ['', ''], span: 1, index: 1, marker: 0 },
    { kind: 'node', index: 2, marker: 2 },
],
clientHtml: '<!--t:7k6gti--><!--0--><div><h2><!--2--><!--/2--></h2></div><!--/t-->',
ssrSegments: ['<!--t:7k6gti--><!--0--><div', '', '><h2><!--2-->', '<!--/2--></h2></div><!--/t-->'],
hash: '7k6gti',
```

-   **descriptors**, one per binding in document order. `index` is the position of its first value in `values`, `span` how many values it takes, `marker` the comment it hangs on.
-   **clientHtml**, the literal as written, with comment markers in place of the bindings and the bound attributes left out. `<!--t:7k6gti-->` and `<!--/t-->` wrap the template, `7k6gti` is a hash of the literal. `<!--2-->` and `<!--/2-->` wrap the value of a child node binding. `<!--0-->` in front of the `<div>` says that the element has bindings, all of them hang on this one marker.
-   **ssrSegments**, the static markup between the bindings, one more than there are descriptors. `toString()` alternates them with the written values.

The markers carry only positions. What a binding means, its attribute name, its static pieces, its kind, stays in the descriptors, the client has the literal and does not need to read it from the markup.

#### 3. The first render clones and binds

`render(result, root)` finds no rendered instance of the literal in `root` and creates a `TemplatePart`, one rendered instance of a literal:

1. **Clone.** The client markup is turned into a `<template>` fragment once per literal, every instance imports a clone of it.
2. **Bind.** One walk over the comments of the clone creates the parts. The markers and the descriptors are both in document order, so the walk takes the next descriptor whenever it meets a marker. A child node marker gets a `ChildNodePart`, an element marker creates the parts of all its bindings on the element behind it. The markers of nested templates are skipped, the walk counts how deep it is in `t:` markers.
3. **Write.** The values go through `update()`, every part reads its own value by `index` and writes it.
4. **Insert.** The clone goes into `root`.

Which part a binding gets:

| binding                       | example                        | part                   |
| ----------------------------- | ------------------------------ | ---------------------- |
| between elements              | `<p>${text}</p>`               | `ChildNodePart`        |
| attribute                     | `class="card ${type}"`         | `AttributePart`        |
| boolean attribute             | `?hidden=${hidden}`            | `BooleanAttributePart` |
| property                      | `.items=${items}`              | `PropertyPart`         |
| event listener                | `@click=${onClick}`            | `EventPart`            |
| attribute starting with on    | `onclick=${onClick}`           | `OnEventPart`          |
| content of a raw text element | `<style>${css}</style>`        | `TextContentPart`      |
| directive                     | `<div ${spreadAttributes(a)}>` | `DirectivePart`        |

All parts on an element extend `ElementPart`. Before its first write a part reads what the DOM holds, after that it compares every value with the one it wrote last and writes only a change.

#### 4. An update writes what changed

On the next render `template()` returns a new `TemplateResult` with the same `strings` and new `values`. `render()` finds the instance of this literal in `root` and hands it the values, every part compares its value and writes only what changed. Unchanged values cost a comparison, nothing in the DOM is touched. A different literal at the root, a `template()` that returns another template, is rendered fresh.

##### Child node values

A `ChildNodePart` owns the nodes between its start and end marker. What it writes there depends on the value:

-   **a string or a number** writes one text node and changes its text on later updates
-   **a template** updates its instance when the literal is the same as before, another literal gets a new instance in place of the old one
-   **a node** is inserted as it is
-   **`unsafeHTML(string)`** parses the string once per value and inserts the nodes
-   **an array** renders its items one after the other, see below
-   **`null` or `undefined`** renders nothing
-   **a function** is called, and its return value is rendered

When the value switches to another kind, from a template to a text for example, the part removes what was there first. A template that comes back after another value is rendered fresh, the DOM of the earlier instance is gone.

##### Lists

An array is written in two passes. The first pass decides the item for every position: a template item keeps the instance at the same position if it renders the same literal, a text item keeps the text node at its position, a node item is the node. The second pass walks the DOM with a cursor and brings it in line with the items. An item whose nodes are in place already is skipped, nodes no item needs any more are removed, everything else is inserted or moved in front of the cursor. Nodes that stay in place are never touched, a focused input keeps its focus.

Items are matched by position. When the third of five rows is removed, rows three and four update their values to show what were rows four and five, and the last row goes away. When an array shrinks, the instances of the items that are gone are dropped, items that come back later render fresh. State that only lives in the DOM of a row, a typed value or the internal state of a custom element, stays with the position, not with the item. Keep such state in the data.

#### 5. `toString()` writes the same markup on the server

On the server there is no DOM. `toString()` of a `TemplateResult` writes markup instead: the `ssrSegments` with the written values in between. For the card:

```html
<!--t:7k6gti--><!--0--><div class="card info"><h2><!--2-->Hello<!--/2--></h2></div><!--/t-->
```

The values are written by the same rules the parts apply in the browser: text is encoded, objects and arrays in attributes are JSON, `null` and `undefined` leave an attribute out, `?open=${true}` writes `open=""`, `.sliderOptions=${options}` writes `slider-options="…"`, which the element maps back to the property when it upgrades. Event listeners are left out. A nested template writes its own `t:` markers, an array writes its items one after the other:

```html
<!--t:yleg9r--><ul><!--0--><!--t:iftgiv--><li><!--0-->a<!--/0--></li><!--/t--><!--t:iftgiv--><li><!--0-->b<!--/0--></li><!--/t--><!--/0--></ul><!--/t-->
```

The markup carries the same markers as a client render, that is what makes it hydratable.

#### 6. Hydration binds to the server markup

When `render()` meets a `root` whose first template marker comes from the server, it does not clone. It checks the hash in `<!--t:…-->` against the hash of its literal and runs the same bind walk over the server rendered DOM. The parts end up on the existing nodes, and the first update takes over what fits:

-   attributes that already hold the value are left alone, a part reads the DOM before its first write
-   a server rendered text node becomes the text node of its child node part
-   a nested template binds to its own server rendered markers, an array item to the next server rendered instance
-   listeners and properties, which markup cannot carry, are set

The page shows the server markup the whole time, nodes that fit stay and only values that differ from the server are written. When the hash does not match, or the markers do not fit the literal, the element warns in the console and renders client side. The hash covers the whole literal, server and client have to render the same literal from the same version of _element-js_.

The state of an element, its property values, is not in the markup. See [SSR](../features/templates.md#ssr-server-side-rendering) for the state serialization that restores it.

#### Where to find it

| file                              | what it does                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `src/dom-parts/html.js`           | the `html` tag                                                                   |
| `src/dom-parts/TemplateResult.js` | `renderInto()` and `toString()` of a literal with its values                     |
| `src/dom-parts/parseTemplate.js`  | the parser, descriptors, client markup, server segments and hash                 |
| `src/dom-parts/markers.js`        | the comment markers                                                              |
| `src/dom-parts/TemplatePart.js`   | one rendered instance: clone, bind, update                                       |
| `src/dom-parts/ChildNodePart.js`  | text, templates, nodes, HTML and lists between two markers                       |
| `src/dom-parts/ElementPart.js`    | the base of all parts on an element, `AttributePart.js` and the others extend it |
| `src/dom-parts/values.js`         | the rules for values, shared by the parts and `toString()`                       |
| `src/dom-parts/stringify.js`      | `toString()`                                                                     |
