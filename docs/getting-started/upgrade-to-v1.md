# Upgrade Guide

Upgrading from `element-js` v0.x to v1.0

---

`element-js` v1.0 is the first major version since it was released in June 2020. The biggest change is a new and custom DOM Parts renderer that allows us to get rid of `lit-html` making it a dependency free library finally.

We only have a couple of breaking changes and a few removed deprecations. The deprecations have been logged to the console for a while now and we hope that most of them should not be there anymore. And the breaking changes should be mostly changed import paths. So it should only be a matter of copy and paste.

---

## Install element-js v1.0

Update `element-js` using npm:

```
npm install element-js@latest
```

## Support for IE 11 has been dropped

Prior to v1.0, we tried our best to make sure features we included in `element-js` worked in IE 11 whenever possible. If you need to support IE 11, we recommend continuing to use `element-js` v0.x until you no longer need to support IE.

## Added `afterUpdate` lifecycle hook upon connecting the elements

`element-js` will now also trigger the `afterUpdate` hook right after the `connected` hook. This is to reduce the cases where you had to do the same things in `connected` and `afterUpdate`. You can now remove those duplicate calls from the `connected` hook.

## Change import paths for main exports

> This only applies if you used the vanilla renderer. For the default `lit-html` renderer you do not need to change the import paths.

Change everything that was imported from:

```javascript
import { TemplateElement, html } from '@webtides/element-js/src/renderer/vanilla';
```

to:

```javascript
import { TemplateElement, html } from '@webtides/element-js';
```

This must be done for the following classes and functions:

-   BaseElement
-   StyledElement
-   TemplateElement
-   Store
-   html
-   toString
-   defineElement
-   i18n

## Change import paths for directives

If you used any directives you must change their import paths as well.

For the vanilla renderer we previously had them here:

```javascript
import { unsafeHTML } from '@webtides/element-js/src/renderer/vanilla/util/directives.js';
```

And for the `lit-html` renderer you had to import the directives from `lit`:

```javascript
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
```

In both cases you must now change the imports to our new directives:

```javascript
import { unsafeHTML } from '@webtides/element-js/src/dom-parts/directives';
```

## Removed childListUpdate option from constructor options

We removed the deprecated `BaseElement` constructor option `childListUpdate`. Please use the "mutationObserverOptions" dictionary instead.

Change:

```javascript
class MyElement extends BaseElement {
    constructor() {
        super({ childListUpdate: true });
    }
}
```

to:

```javascript
class MyElement extends BaseElement {
    constructor() {
        super({ mutationObserverOptions: { childList: true } });
    }
}
```

For more information on how to configure `mutationObserverOptions` see the docs.

## Removed the `hooks` map

We removed the `hooks` map in the `BaseElement`. Using the hooks() map for lifecycle hooks is not possible anymore! Please overwrite the existing lifecycle hook functions. See the docs for more info.

Change:

```javascript
class MyElement extends BaseElement {
    hooks() {
        return {
            connected: () => {},
            beforeUpdate: () => {},
            afterUpdate: () => {}
        };
    }
}
```

to:

```javascript
class MyElement extends BaseElement {
    connected() {}
    beforeUpdate() {}
    afterUpdate() {}
}
```

## Removed the `computed` map

We removed the `computed` map in the `BaseElement`. Using the computed() map for computed properties is is not possible anymore! Please use regular JS getters and return the computed value. See the docs for more info.

Change:

```javascript
class MyElement extends BaseElement {
    firstName = 'John';
    lastName = 'Doe';

    computed() {
        return {
            name: () => `${this.firstName} ${this.lastName}`
        };
    }
}
```

to:

```javascript
class MyElement extends BaseElement {
    firstName = 'John';
    lastName = 'Doe';

    get name() {
        return `${this.firstName} ${this.lastName}`;
    }
}
```

## Removed the `i18n` helper function

We removed the `i18n` helper function. It was a very simple and naive implementation for translating strings in templates. We would recommend to use a more sophisticated i18n solution.

If you still need the same functionality, you can simply add the following function to your code and change the imports accordingly:

```javascript
/**
 * Retrieves a translated key from a dictionary on the window object
 * Example: ${i18n('CustomElement.buttonLabel', 'Label')}
 * @param {string} key - to be translated
 * @param {string} fallback - to be used if key is not defined
 * @return {string} - String of the translated key or fallback or original key
 */
export function i18n(key, fallback) {
    try {
        const translations = window.elementjs.i18n();
        if (translations[key] === undefined) {
            throw 'Translation Missing';
        }

        return translations[key];
    } catch (err) {
        if (fallback) return fallback;
        else return key;
    }
}
```
