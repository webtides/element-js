import { parseAttribute, isNaN, dashToCamel, camelToDash, isObjectLike } from './util/AttributeParser.js';
import { getAllElementChildren, getClosestParentCustomElementNode, isOfSameNodeType } from './util/DOMHelper.js';
import { Store } from './util/Store.js';
import { serializeState, deserializeState, hasSerializedState } from './util/SerializeStateHelper.js';
export { defineElement } from './util/defineElement.js';
export { toString } from './util/toString.js';

/**
 * Options object for the BaseElement
 * @typedef {Object} BaseElementOptions
 * @property {boolean} [autoUpdate] - When set to true the element will call the requestUpdate() method on the instance every time a property or attribute was changed. This will re-evaluate everything on the element and trigger a re-render (if a template is provided) and trigger the watchers for the affected properties/attributes. Default is `true`
 * @property {boolean} [deferUpdate] - When set to true the element will not call the requestUpdate() method upon connecting and therefore will not render (if template was provided) initially. Default is `true`
 * @property {boolean} [deferConnected] - When set to true the element will skip the initialization in connectedCallback() before connecting and therefore will not render (if template was provided) or hydrate initially. Default is `false`
 * @property {MutationObserverOptions} [mutationObserverOptions]
 * @property {PropertyOptions} [propertyOptions]
 */

/**
 * Options object for the BaseElement mutationObserverOptions option
 * @typedef {Object} MutationObserverOptions
 * @property {boolean} [childList] - When childList is set to true the element will also call the requestUpdate method for childList modifications (eg. Adding or removing child elements). Default is `true`
 * @property {boolean} [subtree] - Please note that observing subtree mutations might have performance implications and use it only if necessary. Default is `false`
 */

/**
 * Options object for the BaseElement propertyOptions option
 * @typedef {Object} PropertyOptions
 * @property {undefined | boolean | function} [reflect] - When set to true the element will reflect property changes back to attributes if the attribute was not present when connecting the element. By default, all attributes that are present when connecting the element will be reflected anyway. Default is `undefined`
 * @property {undefined | boolean | function} [parse] - When set to false the element will not automatically try to parse the attributes string value to a complex type (number, array, object). Default is `undefined`
 * @property {undefined | boolean | function} [notify] - When set to true the element will dispatch CustomEvents for every property/attribute change. The event name will be the property name all lowercase and camel to dashes with a postfix of -changed. Default is `undefined`
 */

/**
 * Options object for updating properties
 * @typedef {Object} PropertyUpdateOptions
 * @property {boolean} [notify] - Whether the update should trigger the lifecycle methods. The default is `true`
 * @property {string} property - The property name
 * @property {any} newValue - The new value for the property
 * @property {string} newValueString - The new value as `string` for the property (for comparison reasons)
 * @property {any} oldValue - The old value for the property
 */

/**
 * @implements {Serializable}
 */
class BaseElement extends HTMLElement {
	_serializationKey;

	/**
	 * @param {BaseElementOptions} options
	 */
	constructor(options = {}) {
		super();
		this.$refs = {};
		this._state = {};
		this._mutationObserver = null;
		this._registeredEvents = [];
		this._batchUpdate = null;
		this._requestedUpdates = [];
		this._options = {
			autoUpdate: true,
			deferUpdate: true,
			deferConnected: false,
			mutationObserverOptions: {
				attributes: true,
				childList: true,
				subtree: false,
				...options.mutationObserverOptions,
			},
			propertyOptions: {},
			...options,
		};
	}

	/**
	 * Overrides the native `connectedCallback` of the HTMLElement to set up and initialize our element.
	 * This will define the attributes and properties as reactive getters and setter,
	 * register observers, refs and events.
	 */
	connectedCallback() {
		if (this.hasAttribute('defer-update')) {
			this._options.deferUpdate = true;
		}

		if (this.hasAttribute('defer-connected') || this._options.deferConnected) {
			this._options.deferConnected = false;
			this.removeAttribute('defer-connected');
			return;
		}

		if (this.hasAttribute('ejs:key')) {
			this._serializationKey = this.getAttribute('ejs:key');
			deserializeState(this);
		} else {
			this._serializationKey = globalThis.crypto.randomUUID();
			if (globalThis.elementJsConfig?.serializeState) {
				this.setAttribute('ejs:key', this._serializationKey);
			}
		}

		// define all attributes to "this" as properties
		this.defineAttributesAsProperties();

		// define all properties to "this"
		this.defineProperties();

		// define context
		this.definePropertyInjection();

		// define everything that should be observed
		this.defineObserver();

		if (this._options.deferUpdate) {
			// don't update/render, but register refs and events
			this.registerEventsAndRefs();

			this.triggerHook('connected');
		} else {
			this.requestUpdate({ notify: false }).then(() => {
				this.triggerHook('connected');
				this.triggerHook('afterUpdate');
			});
		}
	}

	/**
	 * Define a MutationObserver on the element to get notified on attribute changes and childList updates according to the options specified via the constructor options.
	 */
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

	/**
	 * Native `disconnectedCallback` of the HTMLElement
	 */
	disconnectedCallback() {
		// remove events for elements in the component
		this.removeEvents();

		if (Object.keys(this.provideProperties()).length > 0) {
			this.removeEventListener('request-context', this.onRequestContext);
		}

		// remove observers
		if (this._mutationObserver) this._mutationObserver.disconnect();

		// unsubscribe from stores
		Object.values(this.properties()).forEach((property) => {
			if (property instanceof Store) {
				property.unsubscribe(this);
			}
		});

		this.triggerHook('disconnected');
	}

	/**
	 * Request and batch an asynchronous update cycle
	 * @param {PropertyUpdateOptions} options
	 * @returns {Promise<unknown>}
	 */
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
	 * @param {PropertyUpdateOptions} options
	 */
	update(options = { notify: true }) {
		this.registerEventsAndRefs();
		if (options.notify === true) {
			this.triggerHook('afterUpdate');
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
		Object.keys({ ...this.injectProperties(), ...this.properties() }).forEach((prop) => {
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
	 * @param {string} property
	 * @param {any} value
	 * @param {boolean} reflectAttribute
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

		if (hasSerializedState(this._serializationKey) && Object.keys(this.serializeState())?.includes(property)) {
			value = this[property];
		}

		this._state[property] = value;

		if (this._state[property] instanceof Store) {
			this._state[property].subscribe(this);
		}

		Object.defineProperty(this, property, {
			get: () => {
				return this._state[property];
			},
			set: (newValue) => {
				const oldValue = this._state[property];
				const newValueString = JSON.stringify(newValue);
				if (JSON.stringify(oldValue) !== newValueString) {
					this._state[property] = newValue;

					serializeState(this);

					if (newValue instanceof Store) {
						newValue.subscribe(this);
					}

					if (reflectAttribute || this._options.propertyOptions[property]?.reflect) {
						this.reflectProperty({ property, newValue, newValueString });
					}

					if (this._options.autoUpdate) {
						this.requestUpdate({
							notify: true,
							property: property,
							newValue: newValue,
							newValueString: newValueString,
							oldValue: oldValue,
						}).finally(() => {
							this.callPropertyWatcher(property, newValue, oldValue);
							this.notifyPropertyChange(property, newValue);
						});
					} else {
						this.callPropertyWatcher(property, newValue, oldValue);
						this.notifyPropertyChange(property, newValue);
					}
				}
				return this;
			},
		});
	}

	/**
	 * Call the watch callbacks on property changes
	 * @param {string} property property that changes
	 * @param {any} newValue
	 * @param {any} oldValue
	 */
	callPropertyWatcher(property, newValue, oldValue) {
		// notify watched properties (after update())
		const watch = this.watch();
		if (property in watch) {
			watch[property](newValue, oldValue);
		}
	}

	/**
	 * Notify property observer via change event
	 * @param {string} property property that changes
	 * @param {any} newValue
	 */
	notifyPropertyChange(property, newValue) {
		// dispatch change event
		if (
			property in this._options['propertyOptions'] &&
			this._options['propertyOptions'][property]['notify'] === true
		) {
			this.dispatch(`${camelToDash(property)}-changed`, newValue);
		}
	}

	/**
	 * Reflects a property as attribute on the element
	 * @param {PropertyUpdateOptions} options
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
	 * Context Properties to issue Context Requests and to pull contextual properties into the elements scope
	 * @return {{}}
	 */
	injectProperties() {
		return {};
	}

	/**
	 * Define which properties that can be provided to children
	 * @return {{}}
	 */
	provideProperties() {
		return {};
	}

	/**
	 * Defines context on the element based on keys from this.injectProperties()
	 */
	definePropertyInjection() {
		Object.entries(this.injectProperties()).forEach(([key, value]) => {
			this.requestContext(key, value);
		});
		// define context provider
		const providedKeys = Object.keys(this.provideProperties());
		if (providedKeys.length > 0) {
			this.addEventListener('request-context', this.onRequestContext);
			// check if there are already connected elements in child dom and restart requests
			getAllElementChildren(this.getRoot(), BaseElement).forEach((customChild) => {
				// if injectProperties?.() is defined it means that the child got connected BEFORE the parent (Runtime Issue)
				const requestedProperties = customChild.injectProperties?.() ?? {};
				Object.entries(requestedProperties).forEach(([key, value]) => {
					// iterate over requested properties to find missed context requests
					if (providedKeys.includes(key)) {
						// owns the provided  key -> replay request
						customChild.requestContext(key, value);
					}
				});
			});
		}
	}

	/**
	 * Helper Function to initialize the context requests
	 * @param {string} propertyName
	 * @param {any | function} valueOrCallback
	 */
	requestContext(propertyName, valueOrCallback) {
		this.dispatch('request-context', { [propertyName]: valueOrCallback });
	}

	/**
	 * Internal Context Request Handler
	 * This will check if the current/receiving instance actually provides a value under the requested name.
	 * If there is something to provide it will either assign the value to the requesting element or call the callback.
	 * @param {CustomEvent} event
	 */
	onRequestContext(event) {
		const provideProperties = this.provideProperties();

		Object.entries(event.detail ?? {}).forEach(([key, valueOrCallback]) => {
			if (key in provideProperties) {
				// found it, provide it
				const providedValue = provideProperties[key];
				event.stopPropagation();
				if (typeof valueOrCallback === 'function') {
					// call function with context value
					valueOrCallback(providedValue);
				} else {
					// assign to prop
					const eventPath = event.composedPath();
					const target = eventPath[0] || event.target;
					target[key] = providedValue;
				}
			}
		});
	}

	/**
	 * Connected lifecycle hook
	 */
	connected() {}

	/**
	 * BeforeUpdate lifecycle hook
	 */
	beforeUpdate() {}

	/**
	 * AfterUpdate lifecycle hook
	 */
	afterUpdate() {}

	/**
	 * Disconnected lifecycle hook
	 */
	disconnected() {}

	/**
	 * Triggers a lifecycle hook based on the name
	 * @param {string} name
	 */
	triggerHook(name) {
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

	/**
	 * Helper function for dispatching custom events
	 * @param {string} name
	 * @param {Object} [data]
	 * @param {CustomEventInit} [options]
	 * @param {boolean} [cancelable] - DEPRECATED
	 * @param {boolean} [composed] - DEPRECATED
	 */
	dispatch(name, data, options, cancelable = false, composed = false) {
		let eventInit = {};

		if (options !== undefined && typeof options === 'boolean') {
			eventInit['bubbles'] = options;
			eventInit['cancelable'] = cancelable;
			eventInit['composed'] = composed;
			eventInit['detail'] = data;
			console.warn(
				`[${this.localName}] Using the old parameter options for the event is deprecated and will be removed in v2.0! Please use the new options object that is in line with the "CustomEventInit" options`,
			);
		} else {
			eventInit = {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail: data,
				...options,
			};
		}

		const event = new CustomEvent(name, eventInit);
		this.dispatchEvent(event);
	}

	/**
	 * Get the root element
	 * @returns {HTMLElement}
	 */
	getRoot() {
		return this;
	}

	/**
	 * This method will be used to serialize this elements state.
	 * By default, it will generate an object with all properties from this.properties().
	 * You can override this and return a different object with more/less/different properties.
	 * @return {{[string: any]: *}}
	 */
	serializeState() {
		const keys = Object.keys(this.properties());
		return Object.fromEntries(keys.map((key) => [key, this[key]]));
	}

	/**
	 * This method will be used to restore properties on the element from a previously serialized state.
	 * You can override this and handle the deserialization differently if the default is not enough.
	 * @param {{[string: any]: *}} serializedState
	 */
	restoreState(serializedState) {
		Object.assign(this, serializedState);
	}
}

export { BaseElement, getClosestParentCustomElementNode, isOfSameNodeType };
