### Not Rendering Elements / BaseElement

More often than not you won't actually need to render anything from your element but rather only trigger some changes on other elements, fire events or fetch data and distribute it to related elements.

A good example for this pattern is to use container elements for fetching data and delegating it to child elements that only take attributes/properties and simply render them.

```html

<places-search>
	<input type=“text" ref=“input”/>
	<places-list ref="list”></places-list>
</places-search>
```

```javascript
import { BaseElement, defineElement } from '@webtides/element-js';

export class PlacesSearch extends BaseElement {
    events() {
        return {
            input: {
                blur: (e) => {
                    // fetch places...
                    const places = ['list of place objects…'];
                    this.$refs.list = places;
                }
            }
        };
    }
}

defineElement('places-search', PlacesSearch);
```

Another good use case for renderless elements is when you need to change some classes or styles on child elements. It is a bit like `jQuery` but much better because everything is declaratively composed of little elements instead of having a big JavaScript file full of little mutations.

```html
<dropdown-element>
    <button>Options</button>
    <ul ref="“list”" class="“”hidden">
        <li>Profile</li>
        <li>Settings</li>
        <li>Sign out</li>
    </ul>
</dropdown-element>
```

```javascript
import { BaseElement, defineElement } from '@webtides/element-js';

class DropdownElement extends BaseElement {
    events() {
        return {
            button: {
                click: () => {
                    this.$refs.list.classList.remove('hidden');
                }
            }
        };
    }
}

defineElement('dropdown-element', DropdownElement);
```
