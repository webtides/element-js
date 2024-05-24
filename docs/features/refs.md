### Refs

To avoid constant lookups of (child) elements from your elements _element-js_ will collect all elements with a `[ref=“id”]` attribute and make them available as an object on the element itself via the special `this.$refs` reference. _element-js_ also provides referencing a list of Nodes by adding a dangling `[]` to the refs id `[ref=“entries[]”]`. Be aware that list references will override singular references with the same name as they are considered to be more explicit.

```html
<places-search>
    <input type="text" ref="input" />
    <places-list ref="list">
        <list-entry ref="entries[]">A</list-entry>
        <list-entry ref="entries[]">B</list-entry>
        <list-entry ref="entries[]">C</list-entry>
    </places-list>
</places-search>
```

```javascript
import { BaseElement, defineElement, html } from '@webtides/element-js';

export class PlacesSearch extends BaseElement {
    events() {
        return {
            input: {
                blur: (e) => {
                    // fetch places...
                    const places = [];
                    // update singular ref
                    this.$refs.list = places;
                    // do something with a list reference
                    this.$refs.entries.forEach((entry) => console.log(entry.innerText)); // A , B , C
                }
            }
        };
    }
}

defineElement('places-search', PlacesSearch);
```

> _element-js_ will smartly add and remove all refs on every update/render cycle to ensure that they will always be correct even though you might have changed the child DOM tree during render cycles.
