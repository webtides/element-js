### Dependency Injection

_element-js_ provides a simple way of Dependency Injection following the idea of the Context [Protocol Proposal](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md).

#### Problem "Prop Drilling"
         
If Data has to be passed down the DOM Tree to descending Child Elements it is usually done by assigning data to the descendants attributes:

```js
export class PropDrilling extends TemplateElement {
	properties() {
		return {
			data: {some: "data", which: "bloats", the: "attributes", in: "DOM"  }
		};
	}
	
	template() {
	return html`
		<!-- child element uses the same exacte data-set as the parent does --> 
		<child-element redundant-data="${data}">
			<!-- grand child component uses parts of the parents or even the root elements dataset --> 
			<grand-child-element in-data="${data.in}"></grand-child-element>
		</child-element>
		<!-- child component uses parts of the parents dataset -->
		<another-child-element some-data="${data.some}" the-data="${data.the}"></another-child-element>
	`;
	}
}
```

While this is possible and totally fine for primitive values it can get confusing very fast with a deep nesting and complex data structures.
It also bloats up the DOM Tree as redundant data ist being passed to multiple descending Elements being copied along the way. 

#### Dependency Injection for the rescue 
                                 
To address the issues caused by "Prop Drilling" _element-js_ provides a simple Dependency Injection Implementation following the idea of the Context Protocol mentioned above.

##### Provide via provideProperties()

An Element can control whatever is to be "provided" to requesting Elements by implementing the provideProperties function provided by the `BaseElement`.     

```js

export class AncestorElement extends TemplateElement {
    
	properties() {
		return {
			data: {some: "data", which: "bloats", the: "attributes", in: "DOM"  },
		};
	}
	provideProperties() {
		return { 
			data: this.data,
			in: this.data.in,
			static: 'string',
		};
	}
}
```
#### Vanilla JS Provide via Event Listener / Context Protocol

```html
<script>
	document.addEventListener('request-context', (event) => {
		// global value
		const vanillaValue = 'vanillaValue';
		for (const [key, value] of Object.entries(event.detail)) {
			if(key === 'vanillaContext') {
				if (typeof value === 'function') {
					// call function with context value
					value(vanillaValue);
				} else {
					// assign as a property to Requestee 
					event.target[key] = vanillaValue;
				}        
			}
		}
	};
</script>
```



##### Inject Properties via injectProperties()

An Element can define injection requests by implementing the injectProperties function provided by the `BaseElement`.
The initial values will also function as default values and will be replaced after the injection request is fulfilled by an Ancestor that provides a property with the requested name.
Injected properties will automatically become reactive properties within the elements scope. DEVs do not have to care about where the Value is actually coming from. 
It will be just there at some Point after the Injection will trigger changes / updates just like regular [properties](./properties.md)..   

```js
export class DescendingElement extends TemplateElement {

	injectProperties() {
		return {
			in: '',
			data: {},
			static: '',
			vanillaContext: '',
		};
	}
}

```

##### Request Context Values via manual context Request

If you want more control over what happens with an injected value after the Injection you can do a manual context Request by using the builtin requestContext function of the BaseElement.   
```js
export class ManualRequestElement extends TemplateElement {
	properties() {
		return {
			reversedArray: [],
		};
	}
	connected() {
		this.requestContext('regularArray', (injectedArray) => {
		// do whatever you like with the value
		const processedArray = injectedArray.reverse();
		// OPTIONAL assign to a property to trigger an update and render the reversed values´
		this.reversedArray = processedArray;
	});
	}
}
```

Still looking for more Information ?                 
You might take a look at the [Test Implementation](../../test/unit/context-protocol.test.html) which should cover all cases


                                       

