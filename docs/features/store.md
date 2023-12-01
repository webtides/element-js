#### Shared State / Reactive State / Store

When a certain property in the properties map is an instance of the provided class `Store` it is treated as an
external `Store`.
A `Store` can be created outside a components´ scope or in a dedicated Module to keep track of shared Application
State.
When a components´ property is an instance of a `Store` the instance will be added as an observer and
automatically updated when the store ist changed.

Instances of Store provide a way to share global state between as many components in an application as you like.
Shared State can be something very simple as (updated) Viewport Dimensions, Media Changes or complex fetched data from a REST Endpoint.

Stores can also be initialized with a primitive value (Numbers, Booleans). Such stores will switch to a single Property Mode and provide direct access tio the property value via the stores valueOf / toString Function for direct access.

##### store.js

```js
export const simpleStore = new Store({
	value: 'simple'
})

class MoreComplexStore extends Store {
	properties() {
		return {
			storeCount: 1
		};
	}
	get sum() {
		return this.storeCount + this.argumentCount;
	}
}
export const exampleStore = new MoreComplexStore({
	argumentCount: 1
})


class MediaStore extends Store {
	constructor() {
		super();
		const mql = window.matchMedia('(max-width: 600px)');
		mql.onchange = (e) => {
			this.isMobile = e.matches;
		}
	}
	properties() {
		return {
			isMobile: true
		};
	}
}
export const mediaStore = new MediaStore()

export const scrollYStore = new Store(0)
window.addEventListener('scroll', () => {
	scrollYStore.value = window.scrollY;
});


```

##### MyElement.js

```js 

import { exampleStore, simpleStore, mediaStore } from './store.js'; 

export class MyElement extends TemplateElement {
    properties() {
        return {
            store: simpleStore,
            exampleStore,
            mediaStore,
            scrollYStore
        };
    }

    template() {
        return `
        	<div>Simple Store: ${this.store.value} == "simple" </div>
        	<div>Complex Store: ${this.exampleStore.sum} == 2</div>
        	<div>Media: ${this.mediaStore.isMobile ? "MOBILE" : "DESKTOP"}</div>
        	<div>Scoll Position: ${this.scrollYStore}</div>
        	`
    }
}

export class AnotherElement extends TemplateElement {
    properties() {
        return {
            store: simpleStore,
        };
    }

    template() {
        return `
        	<div>Simple Store: ${this.store.value} == the same as in MyElement's template.</div>
        	`
    }
}

```         


##### storeception

Changes too nested stores will trigger updates and watcher in ParentStore and ultimately transfer to all elements referencing the parent

```js 

class NestedStore extends Store {
	properties() {
		return {
			nestedCount: 0,
		};
	}
}

class ParentStore extends Store {
	properties() {
		return {
			count: 0,		
			nestedStore: new NestedStore(),
		};
	}

	requestUpdate() {
		// will be triggered on count OR nestedStore.nestedCount changes
	}

	watch() {
		return {
			count: (newCount, oldCount) => {
				// will be triggered on count changes
			},
			nestedStore: () => {
				// will be triggered on nestedStore changes
			},
		};
	}
}

```         

