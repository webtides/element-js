## Computed properties

Sometimes it is necessary to compute properties out of multiple other properties. You can simply define a getter on the
element and return a value.

```javascript
export class MyElement extends BaseElement {
	properties() {
		return {
			reactivePublicProperty: 'I am public & reactive'
		};
	}

	get computedProperty() {
		return this.reactivePublicProperty + ' & computed';
	}

	log() {
		console.log(this.computedProperty);
	}
}
```

For every subsequent update/render cycle a computed property will be evaluated again.

> Keep in mind that properties (public or private) that are not declared via the `properties()` map will not trigger an
> update/render cycle when changed. If you use only non reactive properties to compute a property, it will not be
> re-evaluated automatically.
