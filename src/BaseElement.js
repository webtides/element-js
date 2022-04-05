import { camelToDash, dashToCamel, isNaN, isObjectLike, parseAttribute } from './util/AttributeParser.js';
import { getClosestParentCustomElementNode, isOfSameNodeType } from './util/DOMHelper.js';

export { defineElement } from './util/defineElement';
export { toString } from './util/toString';

class BaseElement extends HTMLElement {
	constructor(options = {}) {
		super();
		this.$refs = {};
		this._state = this._state || {};
		this._elementQueries = this._elementQueries || [];
		this._reactiveModels = this._reactiveModels || [];
		this._mutationObserver = null;
		this._registeredEvents = [];
		this._batchUpdate = null;
		this._requestedUpdates = [];
		this._options = {
			autoUpdate: true,
			deferUpdate: true,
			mutationObserverOptions: {
				attributes: true,
				childList: true,
				subtree: false,
				...options.mutationObserverOptions,
			},
			propertyOptions: this._propertyOptions || {},
			...options,
		};

		if (options.childListUpdate !== undefined && options.childListUpdate !== null) {
			this._options.mutationObserverOptions.childList = options.childListUpdate;
			console.warn(
				`[${this.localName}] Using the "childListUpdate" option is deprecated and will be removed before 1.0! Please use the "mutationObserverOptions" dictionary instead. See the docs for more info`,
			);
		}
	}

	connectedCallback() {
		// define all attributes to "this" as properties
		this.defineAttributesAsProperties();

		// define all properties to "this"
		this.defineProperties();

		// define all computed properties to "this"
		this.defineComputedProperties();

		// define everything that should be observed
		this.defineObserver();

		if (this.hasAttribute('defer-update') || this._options.deferUpdate) {
			// don't update/render, but perform queries and register refs and events
			this.performElementQueries();
			this.registerEventsAndRefs();

			this.triggerHook('connected');
		} else {
			this.requestUpdate({ notify: false }).then(() => {
				this.triggerHook('connected');
			});
		}
	}

	defineObserver() {
		// see: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver#Example_usage
		this._mutationObserver = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (
					mutation.type === 'attributes' &&
					mutation.target === this &&
					this._state.hasOwnProperty(dashToCamel(mutation.attributeName))
				) {
					// update property by invoking the setter
					this[dashToCamel(mutation.attributeName)] = parseAttribute(
						this.getAttribute(mutation.attributeName),
						this._options.propertyOptions[dashToCamel(mutation.attributeName)],
					);
				}
				if (mutation.type === 'attributes' && mutation.target !== this) {
					this.requestUpdate();
				}
				if (mutation.type === 'childList') {
					this.requestUpdate();
				}
			});
		});

		this._mutationObserver.observe(this, {
			attributes: true,
			childList: true,
			subtree: false,
			...this._options.mutationObserverOptions,
		});
	}

	disconnectedCallback() {
		// remove events for elements in the component
		this.removeEvents();

		// remove observers
		if (this._mutationObserver) this._mutationObserver.disconnect();

		this.triggerHook('disconnected');
	}

	requestUpdate(options = { notify: true }) {
		if (options.notify === true) {
			this.triggerHook('beforeUpdate');
		}

		if (this._batchUpdate) {
			cancelAnimationFrame(this._batchUpdate);
			this._batchUpdate = false;
		}

		return new Promise((resolve, reject) => {
			this._requestedUpdates.push({ resolve, reject });
			this._batchUpdate = requestAnimationFrame(() => {
				try {
					this.update(options);
					this._requestedUpdates.forEach(({ resolve, reject }) => resolve());
				} catch (e) {
					// console.error('Update error', e)
					this._requestedUpdates.forEach(({ resolve, reject }) => reject(e));
				}
				this._requestedUpdates = [];
			});
		});
	}

	/**
	 * This should be called by the template component AFTER adding the template to
	 * the DOM.
	 * Here we will register the events and the refs for the element.
	 */
	update(options = { notify: true }) {
		this.performElementQueries();
		this.registerEventsAndRefs();
		if (options.notify === true) {
			this.triggerHook('afterUpdate');
		}
	}

	/**
	 * Perform all element queries for previously registered selectors
	 */
	performElementQueries() {
		const queries = this._elementQueries;

		for (const query of queries) {
			// TODO: consider the query.once boolean value
			this[query.name] = query.all
				? query.root.querySelectorAll(`${query.selector}`)
				: query.root.querySelector(`${query.selector}`);
		}
	}

	/**
	 * Register events and refs for the component
	 */
	registerEventsAndRefs() {
		// register events for elements in the component
		this.registerEvents();

		// register $refs
		this.registerRefs();
	}

	/**
	 * Defines all attributes assigned in the HTML for the element as properties on the element
	 * If the value for an attribute can be parsed to an object or array, it will do so
	 */
	defineAttributesAsProperties() {
		const ignoreAttributes = ['class', 'style'];
		Array.from(this.attributes)
			.filter((attribute) => {
				return !ignoreAttributes.includes(attribute.name);
			})
			.forEach((attribute) => {
				const name = dashToCamel(attribute.name);
				const parseOptions = this._options.propertyOptions[name];
				this.defineProperty(name, parseAttribute(attribute.value, parseOptions), true);
			});
	}

	/**
	 * Properties to be defined and assigned on the element. Should be overwritten in child components
	 * Properties defined here will also trigger a update() when changed.
	 * eg. { stringProperty: 'value', numberProperty: 13, booleanProperty: true } }
	 * @return {{}}
	 */
	properties() {
		return {};
	}

	/**
	 * Defines properties on the element based on keys from this.properties()
	 * Will trigger update() when a property was changed
	 */
	defineProperties() {
		Object.keys(this.properties()).forEach((prop) => {
			// when mixing shadow dom elements with light dom elements and nesting custom elements
			// it might occur that properties where set on an element before it was
			// registered or connected. To avoid such timing issues we check
			// if a value was set for that specific property on the
			// prototype before assigning a default value
			const value = this[prop] || this.properties()[prop];
			this.defineProperty(prop, value);
		});
	}

	/**
	 * Define a property on the element
	 * Will trigger watch() function when a property was changed
	 * Will trigger update() when a property was changed
	 */
	defineProperty(property, value, reflectAttribute = false) {
		if (this._state.hasOwnProperty(property)) {
			// property has already been defined as an attribute nothing to do here
			return;
		}

		// if property did not come from an attribute but has the option to reflect // enabled or custom fn
		if (!reflectAttribute && this._options.propertyOptions[property]?.reflect) {
			this.reflectProperty({ property: property, newValue: value });
		}

		// remove attribute if reflect is set to false explicitly in options
		if (this._options.propertyOptions[property]?.reflect === false) {
			this.removeAttribute(camelToDash(property));
		}

		this._state[property] = value;

		Object.defineProperty(this, property, {
			get: () => {
				return this._state[property];
			},
			set: (newValue) => {
				const oldValue = this._state[property];
				const newValueString = JSON.stringify(newValue);

				if (JSON.stringify(oldValue) !== newValueString) {
					this._state[property] = newValue;

					if (reflectAttribute || this._options.propertyOptions[property]?.reflect) {
						this.reflectProperty({ property, newValue, newValueString });
					}

					const informWatchedPropertiesAndDispatchChangeEvent = () => {
						// notify watched properties (after update())
						if (property in this.watch()) {
							this.watch()[property](newValue, oldValue);
						}

						// dispatch change event
						if (
							property in this._options['propertyOptions'] &&
							this._options['propertyOptions'][property]['notify'] === true
						) {
							this.dispatch(`${camelToDash(property)}-changed`, newValue, true);
						}
					};

					if (this._options.autoUpdate) {
						this.requestUpdate({
							notify: true,
							property: property,
							newValue: newValue,
							newValueString: newValueString,
							oldValue: oldValue,
						}).finally(() => {
							informWatchedPropertiesAndDispatchChangeEvent();
						});
					} else {
						informWatchedPropertiesAndDispatchChangeEvent();
					}
				}

				return this;
			},
		});
	}

	/**
	 * Reflects a property as attribute on the element
	 * @param options
	 */
	reflectProperty(options) {
		const { property, newValue } = options;
		const newValueString = options.newValueString || JSON.stringify(newValue);

		if (newValue === undefined || newValue === null || isNaN(newValue)) {
			// these would be reflected as strings: "undefined" || "null" || "NaN"
			// which is not the desired behaviour. Therefore we reflect them as empty strings
			this.setAttribute(camelToDash(property), '');
		} else {
			let attributeValue = isObjectLike(newValue) ? newValueString : newValue;
			if (typeof this._options.propertyOptions[property]?.reflect === 'function') {
				attributeValue = this._options.propertyOptions[property].reflect(newValue);
			}
			this.setAttribute(camelToDash(property), attributeValue);
		}
	}

	/**
	 * Adds a Query to the list of element queries to be selected
	 * @param query
	 */
	addElementQuery(query) {
		this._elementQueries = this._elementQueries || [];
		this._elementQueries.push(query);
	}

	/**
	 * Adds a Model to the list of Models to be notified for lifecycle hooks
	 * @param model
	 */
	addReactiveModel(model) {
		this._reactiveModels = this._reactiveModels || [];
		this._reactiveModels.push(model);
	}

	// Deprecated
	hooks() {
		return {};
	}

	// Connected lifecycle hook
	connected() {}

	// BeforeUpdate lifecycle hook
	beforeUpdate() {}

	// AfterUpdate lifecycle hook
	afterUpdate() {}

	// Disconnected lifecycle hook
	disconnected() {}

	// Triggers a lifecycle hook based on the name
	triggerHook(name) {
		if (this.hooks && name in this.hooks()) {
			console.warn(
				`[${this.localName}] Using the hooks() map for lifecycle hooks is deprecated! Please overwrite the existing lifecycle hook functions. See the docs for more info`,
			);
			this.hooks()[name]();
			return;
		}

		if (name === 'connected') {
			for (const model of this._reactiveModels) {
				model.controllerConnected();
			}
		}

		if (name === 'disconnected') {
			for (const model of this._reactiveModels) {
				model.controllerDisconnected();
			}
		}

		if (name in this) {
			this[name]();
		}
	}

	/**
	 * Watched attributes & properties to be notified to the element when changed. Should be overwritten in child components
	 * When an attribute or property as the key was changed on the element, the callback function defined as value
	 * will be called with `newValue` and `oldValue`
	 * eg. { property: (oldValue, newValue) => { console.log('property changed!, oldValue, newValue); } }
	 * @return {{}}
	 */
	watch() {
		return {};
	}

	// Deprecated
	computed() {
		return {};
	}

	// Deprecated
	defineComputedProperties() {
		Object.keys(this.computed()).forEach((prop) => {
			if (!this.hasOwnProperty(prop)) {
				console.warn(
					`[${this.localName}] Using the computed() map for computed properties is deprecated! Please use regular JS getters and return the computed value. See the docs for more info`,
				);
				Object.defineProperty(this, prop, {
					get: () => this.computed()[prop](),
				});
			}
		});
	}

	/**
	 * Return a map of events that should be registered on the element.
	 * eg. { '.link': {
	 *               'click': (e) => {console.log('MyElement.link - clicked', e)},
	 *               'mouseover': (e) => {console.log('MyElement.link - mouseover()', e)},
	 *           }
	 *     }
	 */
	events() {
		return {};
	}

	/**
	 * Registers events on the element based on events().
	 * Removes all previously registered events before adding them.
	 */
	registerEvents() {
		// remove all previously registered events to prevent duplicate triggers
		this.removeEvents();

		// register events
		const eventDefinitions = this.events();
		Object.keys(eventDefinitions).forEach((elementSelector) => {
			const events = eventDefinitions[elementSelector];
			const selectorWhiteList = { window, document, this: this.getRoot() };
			const whiteListElement = selectorWhiteList[elementSelector];
			const eventTargets = whiteListElement
				? [whiteListElement]
				: this.getRoot().querySelectorAll(elementSelector);

			eventTargets.forEach((eventTarget) => {
				Object.keys(events).forEach((eventName) => {
					const notation = events[eventName];
					if (typeof notation === 'function') {
						const callback = notation.bind(this);
						eventTarget.addEventListener(eventName, callback);
						this._registeredEvents.push({ eventTarget, eventName, callback });
					} else if (typeof notation === 'object' && typeof notation.listener === 'function') {
						const callback = notation.listener.bind(this);
						eventTarget.addEventListener(eventName, callback, notation.options ?? {});
						this._registeredEvents.push({ eventTarget, eventName, callback });
					}
				});
			});
		});
	}

	/**
	 * Removes all events from the element that where previously registered from the events() map.
	 */
	removeEvents() {
		this._registeredEvents.forEach(({ eventTarget, eventName, callback }) => {
			if (eventTarget === window || eventTarget === document || this.getRoot().contains(eventTarget)) {
				eventTarget.removeEventListener(eventName, callback);
			}
		});
		this._registeredEvents = [];
	}

	/**
	 * Stores an object that references child elements & DOM nodes that have a ref attribute defined.
	 * References will be accessible on the element under this.$refs
	 */
	registerRefs() {
		const refsNodeList = this.getRoot().querySelectorAll('[ref]');
		const refsArray = Array.from(refsNodeList);
		const refsMap = {};

		refsArray.forEach((refNode) => {
			const refKey = refNode.getAttribute('ref');
			const isListKey = refKey.endsWith('[]');
			const cleanKey = isListKey ? refKey.slice(0, -2) : refKey;
			const hasListRef = Array.isArray(refsMap[cleanKey]);

			if (isListKey) {
				if (!refsMap[cleanKey] || !hasListRef) {
					// create or overwrite previously registered single ref
					refsMap[cleanKey] = [];
				}
				refsMap[cleanKey].push(refNode);
			} else if (!hasListRef) {
				refsMap[refKey] = refNode;
			} else {
				console.warn(
					`Did not register singular ref ${refKey}, ${refNode} as a ref list is already registered under the same name.`,
				);
			}
		});

		this.$refs = refsMap;
	}

	// Helper function for dispatching custom events
	dispatch(name, data, bubble = false, cancelable = false, composed = false) {
		const event = new CustomEvent(name, {
			bubbles: bubble,
			cancelable: cancelable,
			composed: composed,
			detail: data,
		});
		this.dispatchEvent(event);
	}

	// Get the root element
	getRoot() {
		return this;
	}
}

export { BaseElement, getClosestParentCustomElementNode, isOfSameNodeType };
