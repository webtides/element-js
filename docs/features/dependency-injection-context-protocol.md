### Dependency Injection

_element-js_ provides a simple way of Dependency Injection following the idea of the Context [Protocol Proposal](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md).  

#### Methods

##### provideProperties

An Element can control whatever is to be "provided" to requesting Elements by implementing the provideProperties function.     

```js
provideProperties() {
	return { counterStore: this.counterStore };
}

```

##### injectProperties

An Element can control whatever is to be "provided" to requesting Elements by implementing the provideProperties function.     

```js
injectProperties() {
	return {
		counterStore: {},
		vanillaContext: '',
	};
}

```

                                       

