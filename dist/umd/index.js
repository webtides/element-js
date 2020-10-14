(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ElementJS = {}));
}(this, (function (exports) { 'use strict';

	function isObjectLike(value) {
	  return typeof value == 'object' && value !== null;
	}
	function isJSON(str) {
	  try {
	    return JSON.parse(str) && !!str;
	  } catch (e) {
	    return false;
	  }
	}
	function isBoolean(value) {
	  return value === 'true' || value === 'false';
	}
	function parseBoolean(value) {
	  return value === 'true';
	}
	function isString(value) {
	  return typeof value === 'string' || !!value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object String]';
	}
	function isNumber(value) {
	  return new RegExp('^-?(0|0\\.\\d+|[1-9]\\d*(\\.\\d+)?)$').test(value);
	}
	function isNaN(value) {
	  return Number.isNaN(value);
	}
	function parseAttribute(value) {
	  if (!isString(value)) {
	    return value;
	  }

	  let parsedValue = value;
	  if (isJSON(value)) parsedValue = JSON.parse(value);else if (isBoolean(value)) parsedValue = parseBoolean(value);else if (isNumber(value)) parsedValue = parseFloat(value);
	  return parsedValue;
	}
	/**
	 * Replaces dashed-expression (i.e. some-value) to a camel-cased expression (i.e. someValue)
	 * @returns string
	 */

	function dashToCamel(string) {
	  if (string.indexOf('-') === -1) return string;
	  return string.replace(/-[a-z]/g, matches => matches[1].toUpperCase());
	}
	/**
	 * Replaces camel-cased expression (i.e. someValue) to a dashed-expression (i.e. some-value)
	 * @returns string
	 */

	function camelToDash(string) {
	  return string.replace(/([A-Z])/g, '-$1').toLowerCase();
	}

	function getShadowParentOrBody(element) {
	  if (element instanceof ShadowRoot) {
	    return element;
	  }

	  while (element.parentNode && (element = element.parentNode)) {
	    if (element instanceof ShadowRoot) {
	      return element;
	    }
	  }

	  return document.body;
	} // TODO: add function for getClosestParentOfNodeType('custom-element')
	const supportsAdoptingStyleSheets = () => 'adoptedStyleSheets' in Document.prototype && 'replace' in CSSStyleSheet.prototype; // for IE11 we are using the ShadyDOM Polyfill. With the polyfill we cannot append stylesheets to the shadowRoot

	/**
	 * Wrapper for defining custom elements so that registering an element multiple times won't crash
	 * @param name for the tag
	 * @param constructor for the custom element
	 */
	function defineElement(name, constructor) {
	  try {
	    customElements.define(name, constructor);
	  } catch (e) {// console.log('error defining custom element', e);
	  }
	}

	/**
	 * Little wrapper function for JSON.stringify() to easily convert objects and arrays to strings
	 * to be able to set them as attributes on custom elements
	 * @param value to be stringified
	 * @return String of the stringified value
	 */
	function toString(value) {
	  try {
	    return JSON.stringify(value);
	  } catch (e) {
	    return '';
	  }
	}

	class BaseElement extends HTMLElement {
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
	      mutationObserverOptions: {
	        attributes: true,
	        childList: true,
	        subtree: false,
	        ...options.mutationObserverOptions
	      },
	      propertyOptions: {},
	      ...options
	    };

	    if (options.childListUpdate !== undefined && options.childListUpdate !== null) {
	      this._options.mutationObserverOptions.childList = options.childListUpdate;
	      console.warn(`[${this.localName}] Using the "childListUpdate" option is deprecated and will be removed before 1.0! Please use the "mutationObserverOptions" dictionary instead. See the docs for more info`);
	    }
	  }

	  connectedCallback() {
	    // define all attributes to "this" as properties
	    this.defineAttributesAsProperties(); // define all properties to "this"

	    this.defineProperties(); // define all computed properties to "this"

	    this.defineComputedProperties(); // define everything that should be observed

	    this.defineObserver();

	    if (this.hasAttribute('defer-update') || this._options.deferUpdate) {
	      // don't updates/render, but register refs and events
	      this.registerEventsAndRefs();
	      this.triggerHook('connected');
	    } else {
	      this.requestUpdate({
	        notify: false
	      }).then(() => {
	        this.triggerHook('connected');
	      });
	    }
	  }

	  defineObserver() {
	    // see: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver#Example_usage
	    this._mutationObserver = new MutationObserver(mutations => {
	      mutations.forEach(mutation => {
	        if (mutation.type === 'attributes' && mutation.target === this && this._state.hasOwnProperty(dashToCamel(mutation.attributeName))) {
	          // update property by invoking the setter
	          this[dashToCamel(mutation.attributeName)] = parseAttribute(this.getAttribute(mutation.attributeName));
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
	      ...this._options.mutationObserverOptions
	    });
	  }

	  disconnectedCallback() {
	    // remove events for elements in the component
	    this.removeEvents(); // remove observers

	    if (this._mutationObserver) this._mutationObserver.disconnect();
	    this.triggerHook('disconnected');
	  }

	  requestUpdate(options = {
	    notify: true
	  }) {
	    if (options.notify === true) {
	      this.triggerHook('beforeUpdate');
	    }

	    if (this._batchUpdate) {
	      cancelAnimationFrame(this._batchUpdate);
	      this._batchUpdate = false;
	    }

	    return new Promise((resolve, reject) => {
	      this._requestedUpdates.push({
	        resolve,
	        reject
	      });

	      this._batchUpdate = requestAnimationFrame(() => {
	        try {
	          this.update(options);

	          this._requestedUpdates.forEach(({
	            resolve,
	            reject
	          }) => resolve());
	        } catch (e) {
	          // console.error('Update error', e)
	          this._requestedUpdates.forEach(({
	            resolve,
	            reject
	          }) => reject(e));
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


	  update(options = {
	    notify: true
	  }) {
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
	    this.registerEvents(); // register $refs

	    this.registerRefs();
	  }
	  /**
	   * Defines all attributes assigned in the HTML for the element as properties on the element
	   * If the value for an attribute can be parsed to an object or array, it will do so
	   */


	  defineAttributesAsProperties() {
	    const ignoreAttributes = ['class', 'style'];
	    Array.from(this.attributes).filter(attribute => {
	      return !ignoreAttributes.includes(attribute.name);
	    }).forEach(attribute => {
	      this.defineProperty(dashToCamel(attribute.name), parseAttribute(attribute.value), true);
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
	    Object.keys(this.properties()).forEach(prop => {
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
	    var _this$_options$proper, _this$_options$proper2;

	    if (this._state.hasOwnProperty(property)) {
	      // property has already been defined as an attribute nothing to do here
	      return;
	    } // if property did not come from an attribute but has the option to reflect


	    if (!reflectAttribute && ((_this$_options$proper = this._options.propertyOptions[property]) == null ? void 0 : _this$_options$proper.reflect) === true) {
	      this.reflectProperty({
	        property: property,
	        newValue: value
	      });
	    } // remove attribute if reflect is set to false explicitly in options


	    if (((_this$_options$proper2 = this._options.propertyOptions[property]) == null ? void 0 : _this$_options$proper2.reflect) === false) {
	      this.removeAttribute(camelToDash(property));
	    }

	    this._state[property] = value;
	    Object.defineProperty(this, property, {
	      get: () => {
	        return this._state[property];
	      },
	      set: newValue => {
	        const oldValue = this._state[property];
	        const newValueString = JSON.stringify(newValue);

	        if (JSON.stringify(oldValue) !== newValueString) {
	          var _this$_options$proper3;

	          this._state[property] = newValue;

	          if (reflectAttribute || ((_this$_options$proper3 = this._options.propertyOptions[property]) == null ? void 0 : _this$_options$proper3.reflect) === true) {
	            this.reflectProperty({
	              property,
	              newValue,
	              newValueString
	            });
	          }

	          const informWatchedPropertiesAndDispatchChangeEvent = () => {
	            // notify watched properties (after update())
	            if (property in this.watch()) {
	              this.watch()[property](newValue, oldValue);
	            } // dispatch change event


	            if (property in this._options['propertyOptions'] && this._options['propertyOptions'][property]['notify'] === true) {
	              this.dispatch(`${camelToDash(property)}-changed`, newValue, true);
	            }
	          };

	          if (this._options.autoUpdate) {
	            this.requestUpdate({
	              notify: true,
	              property: property,
	              newValue: newValue,
	              newValueString: newValueString,
	              oldValue: oldValue
	            }).finally(() => {
	              informWatchedPropertiesAndDispatchChangeEvent();
	            });
	          } else {
	            informWatchedPropertiesAndDispatchChangeEvent();
	          }
	        }

	        return this;
	      }
	    });
	  }

	  reflectProperty(options) {
	    const {
	      property,
	      newValue
	    } = options;
	    const newValueString = options.newValueString || JSON.stringify(newValue);

	    if (newValue === undefined || newValue === null || isNaN(newValue)) {
	      // these would be reflected as strings: "undefined" || "null" || "NaN"
	      // which is not the desired behaviour. Therefore we reflect them as empty strings
	      this.setAttribute(camelToDash(property), '');
	    } else {
	      const attributeValue = isObjectLike(newValue) ? newValueString : newValue;
	      this.setAttribute(camelToDash(property), attributeValue);
	    }
	  } // Deprecated


	  hooks() {
	    return {};
	  } // Connected lifecycle hook


	  connected() {} // BeforeUpdate lifecycle hook


	  beforeUpdate() {} // AfterUpdate lifecycle hook


	  afterUpdate() {} // Disconnected lifecycle hook


	  disconnected() {} // Triggers a lifecycle hook based on the name


	  triggerHook(name) {
	    if (this.hooks && name in this.hooks()) {
	      console.warn(`[${this.localName}] Using the hooks() map for lifecycle hooks is deprecated! Please overwrite the existing lifecycle hook functions. See the docs for more info`);
	      this.hooks()[name]();
	      return;
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
	  } // Deprecated


	  computed() {
	    return {};
	  } // Deprecated


	  defineComputedProperties() {
	    Object.keys(this.computed()).forEach(prop => {
	      if (!this.hasOwnProperty(prop)) {
	        console.warn(`[${this.localName}] Using the computed() map for computed properties is deprecated! Please use regular JS getters and return the computed value. See the docs for more info`);
	        Object.defineProperty(this, prop, {
	          get: () => this.computed()[prop]()
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
	    this.removeEvents(); // register events

	    const eventDefinitions = this.events();
	    Object.keys(eventDefinitions).forEach(elementSelector => {
	      const events = eventDefinitions[elementSelector];
	      const selectorWhiteList = {
	        window,
	        document,
	        this: this.getRoot()
	      };
	      const whiteListElement = selectorWhiteList[elementSelector];
	      const eventTargets = whiteListElement ? [whiteListElement] : this.getRoot().querySelectorAll(elementSelector);
	      eventTargets.forEach(eventTarget => {
	        Object.keys(events).forEach(eventName => {
	          const callback = events[eventName].bind(this);
	          eventTarget.addEventListener(eventName, callback);

	          this._registeredEvents.push({
	            eventTarget,
	            eventName,
	            callback
	          });
	        });
	      });
	    });
	  }
	  /**
	   * Removes all events from the element that where previously registered from the events() map.
	   */


	  removeEvents() {
	    this._registeredEvents.forEach(({
	      eventTarget,
	      eventName,
	      callback
	    }) => {
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
	    refsArray.forEach(refNode => {
	      const refKey = refNode.getAttribute('ref');
	      refsMap[refKey] = refNode;
	    });
	    this.$refs = refsMap;
	  } // Helper function for dispatching custom events


	  dispatch(name, data, bubble = false, cancelable = false, composed = false) {
	    const event = new CustomEvent(name, {
	      bubbles: bubble,
	      cancelable: cancelable,
	      composed: composed,
	      detail: data
	    });
	    this.dispatchEvent(event);
	  } // Get the root element


	  getRoot() {
	    return this;
	  }

	}

	/**
	 * Retrieves a translated key from a dictionary on the window object
	 * Example: ${i18n('CustomElement.buttonLabel', 'Label')}
	 * @param key to be translated
	 * @param fallback to be used if key is not defined
	 * @return String of the translated key or fallback or original key
	 */
	function i18n(key, fallback) {
	  try {
	    const translations = window.elementjs.i18n();
	    return translations && translations[key];
	  } catch (err) {
	    if (fallback) return fallback;else return key;
	  }
	}

	class StyledElement extends BaseElement {
	  static updateGlobalStyles() {
	    // this is a runtime dependency so that every shadow dom can make use of global css
	    // we assume these styles to be inlined into the document
	    StyledElement.globalStyles = document.getElementById('globalStyles');

	    if (StyledElement.globalStyles && StyledElement['globalStyleSheet']) {
	      //updates already adopted global styles
	      StyledElement['globalStyleSheet'].replaceSync(StyledElement.globalStyles.textContent);
	    }
	  }

	  constructor(options) {
	    super({
	      deferUpdate: false,
	      shadowRender: false,
	      styles: [],
	      adoptGlobalStyles: true,
	      ...options
	    });
	    this._styles = [...this._options.styles, ...this.styles()];
	  }

	  connectedCallback() {
	    super.connectedCallback();

	    if (supportsAdoptingStyleSheets() && this._options.shadowRender) {
	      // adopting does only make sense in shadow dom. Fall back to append for light elements
	      this.adoptStyleSheets();
	    } else if (this._options.shadowRender && window.ShadyCSS !== undefined) {
	      // if shadowRoot is polyfilled we use ShadyCSS to copy scoped styles to <head>
	      window.ShadyCSS.ScopingShim.prepareAdoptedCssText(this._styles, this.localName);
	    } // if shadowRoot is polyfilled - scope element template


	    if (window.ShadyCSS !== undefined) {
	      window.ShadyCSS.styleElement(this);
	    }
	  }

	  styles() {
	    return [];
	  }

	  update(options) {
	    if (!supportsAdoptingStyleSheets() || this._options.shadowRender === false) {
	      // append stylesheets to template if not already adopted
	      const appendableStyles = [...this._styles];

	      if (this._options.shadowRender && this._options.adoptGlobalStyles && !window.ShadyCSS) {
	        var _StyledElement$global, _StyledElement$global2;

	        appendableStyles.unshift((_StyledElement$global = (_StyledElement$global2 = StyledElement.globalStyles) == null ? void 0 : _StyledElement$global2.textContent) != null ? _StyledElement$global : '');
	      }

	      this.appendStyleSheets(appendableStyles);
	    }

	    super.update(options);
	  }

	  adoptStyleSheets() {
	    if (!this.constructor['cssStyleSheets']) {
	      this.constructor['cssStyleSheets'] = this._styles.map(style => {
	        const sheet = new CSSStyleSheet();

	        if (sheet && sheet.cssRules.length === 0) {
	          sheet.replaceSync(style);
	        }

	        return sheet;
	      });
	    }

	    if (StyledElement.globalStyles && !StyledElement['globalStyleSheet']) {
	      StyledElement['globalStyleSheet'] = new CSSStyleSheet();
	      StyledElement['globalStyleSheet'].replaceSync(StyledElement.globalStyles.textContent);
	    } // adopt styles
	    // uses proposed solution for constructable stylesheets
	    // see: https://wicg.github.io/construct-stylesheets/#proposed-solution


	    this.getRoot().adoptedStyleSheets = [...(this._options.shadowRender && this._options.adoptGlobalStyles && StyledElement['globalStyleSheet'] ? [StyledElement['globalStyleSheet']] : []), ...this.constructor['cssStyleSheets']];
	  } // custom polyfill for constructable stylesheets by appending styles to the end of an element


	  appendStyleSheets(styles) {
	    const parentDocument = getShadowParentOrBody(this.getRoot());
	    styles.forEach((style, index) => {
	      const identifier = this.tagName + index; // only append stylesheet if not already appended to shadowRoot or document

	      if (!parentDocument.querySelector(`#${identifier}`)) {
	        const styleElement = document.createElement('style');
	        styleElement.id = identifier;
	        styleElement.style.display = 'none';
	        styleElement.textContent = style;
	        parentDocument.appendChild(styleElement);
	      }
	    });
	  }

	}

	StyledElement.globalStyles = null;
	StyledElement.updateGlobalStyles();

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	const directives = new WeakMap();
	const isDirective = o => {
	  return typeof o === 'function' && directives.has(o);
	};

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * True if the custom elements polyfill is in use.
	 */
	const isCEPolyfill = typeof window !== 'undefined' && window.customElements != null && window.customElements.polyfillWrapFlushCallback !== undefined;
	/**
	 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
	 * `container`.
	 */

	const removeNodes = (container, start, end = null) => {
	  while (start !== end) {
	    const n = start.nextSibling;
	    container.removeChild(start);
	    start = n;
	  }
	};

	/**
	 * @license
	 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * A sentinel value that signals that a value was handled by a directive and
	 * should not be written to the DOM.
	 */
	const noChange = {};
	/**
	 * A sentinel value that signals a NodePart to fully clear its content.
	 */

	const nothing = {};

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * An expression marker with embedded unique key to avoid collision with
	 * possible text in templates.
	 */
	const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
	/**
	 * An expression marker used text-positions, multi-binding attributes, and
	 * attributes with markup-like text values.
	 */

	const nodeMarker = `<!--${marker}-->`;
	const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
	/**
	 * Suffix appended to all bound attribute names.
	 */

	const boundAttributeSuffix = '$lit$';
	/**
	 * An updatable Template that tracks the location of dynamic parts.
	 */

	class Template {
	  constructor(result, element) {
	    this.parts = [];
	    this.element = element;
	    const nodesToRemove = [];
	    const stack = []; // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null

	    const walker = document.createTreeWalker(element.content, 133
	    /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */
	    , null, false); // Keeps track of the last index associated with a part. We try to delete
	    // unnecessary nodes, but we never want to associate two different parts
	    // to the same index. They must have a constant node between.

	    let lastPartIndex = 0;
	    let index = -1;
	    let partIndex = 0;
	    const {
	      strings,
	      values: {
	        length
	      }
	    } = result;

	    while (partIndex < length) {
	      const node = walker.nextNode();

	      if (node === null) {
	        // We've exhausted the content inside a nested template element.
	        // Because we still have parts (the outer for-loop), we know:
	        // - There is a template in the stack
	        // - The walker will find a nextNode outside the template
	        walker.currentNode = stack.pop();
	        continue;
	      }

	      index++;

	      if (node.nodeType === 1
	      /* Node.ELEMENT_NODE */
	      ) {
	          if (node.hasAttributes()) {
	            const attributes = node.attributes;
	            const {
	              length
	            } = attributes; // Per
	            // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
	            // attributes are not guaranteed to be returned in document order.
	            // In particular, Edge/IE can return them out of order, so we cannot
	            // assume a correspondence between part index and attribute index.

	            let count = 0;

	            for (let i = 0; i < length; i++) {
	              if (endsWith(attributes[i].name, boundAttributeSuffix)) {
	                count++;
	              }
	            }

	            while (count-- > 0) {
	              // Get the template literal section leading up to the first
	              // expression in this attribute
	              const stringForPart = strings[partIndex]; // Find the attribute name

	              const name = lastAttributeNameRegex.exec(stringForPart)[2]; // Find the corresponding attribute
	              // All bound attributes have had a suffix added in
	              // TemplateResult#getHTML to opt out of special attribute
	              // handling. To look up the attribute value we also need to add
	              // the suffix.

	              const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
	              const attributeValue = node.getAttribute(attributeLookupName);
	              node.removeAttribute(attributeLookupName);
	              const statics = attributeValue.split(markerRegex);
	              this.parts.push({
	                type: 'attribute',
	                index,
	                name,
	                strings: statics
	              });
	              partIndex += statics.length - 1;
	            }
	          }

	          if (node.tagName === 'TEMPLATE') {
	            stack.push(node);
	            walker.currentNode = node.content;
	          }
	        } else if (node.nodeType === 3
	      /* Node.TEXT_NODE */
	      ) {
	          const data = node.data;

	          if (data.indexOf(marker) >= 0) {
	            const parent = node.parentNode;
	            const strings = data.split(markerRegex);
	            const lastIndex = strings.length - 1; // Generate a new text node for each literal section
	            // These nodes are also used as the markers for node parts

	            for (let i = 0; i < lastIndex; i++) {
	              let insert;
	              let s = strings[i];

	              if (s === '') {
	                insert = createMarker();
	              } else {
	                const match = lastAttributeNameRegex.exec(s);

	                if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
	                  s = s.slice(0, match.index) + match[1] + match[2].slice(0, -boundAttributeSuffix.length) + match[3];
	                }

	                insert = document.createTextNode(s);
	              }

	              parent.insertBefore(insert, node);
	              this.parts.push({
	                type: 'node',
	                index: ++index
	              });
	            } // If there's no text, we must insert a comment to mark our place.
	            // Else, we can trust it will stick around after cloning.


	            if (strings[lastIndex] === '') {
	              parent.insertBefore(createMarker(), node);
	              nodesToRemove.push(node);
	            } else {
	              node.data = strings[lastIndex];
	            } // We have a part for each match found


	            partIndex += lastIndex;
	          }
	        } else if (node.nodeType === 8
	      /* Node.COMMENT_NODE */
	      ) {
	          if (node.data === marker) {
	            const parent = node.parentNode; // Add a new marker node to be the startNode of the Part if any of
	            // the following are true:
	            //  * We don't have a previousSibling
	            //  * The previousSibling is already the start of a previous part

	            if (node.previousSibling === null || index === lastPartIndex) {
	              index++;
	              parent.insertBefore(createMarker(), node);
	            }

	            lastPartIndex = index;
	            this.parts.push({
	              type: 'node',
	              index
	            }); // If we don't have a nextSibling, keep this node so we have an end.
	            // Else, we can remove it to save future costs.

	            if (node.nextSibling === null) {
	              node.data = '';
	            } else {
	              nodesToRemove.push(node);
	              index--;
	            }

	            partIndex++;
	          } else {
	            let i = -1;

	            while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
	              // Comment node has a binding marker inside, make an inactive part
	              // The binding won't work, but subsequent bindings will
	              // TODO (justinfagnani): consider whether it's even worth it to
	              // make bindings in comments work
	              this.parts.push({
	                type: 'node',
	                index: -1
	              });
	              partIndex++;
	            }
	          }
	        }
	    } // Remove text binding nodes after the walk to not disturb the TreeWalker


	    for (const n of nodesToRemove) {
	      n.parentNode.removeChild(n);
	    }
	  }

	}

	const endsWith = (str, suffix) => {
	  const index = str.length - suffix.length;
	  return index >= 0 && str.slice(index) === suffix;
	};

	const isTemplatePartActive = part => part.index !== -1; // Allows `document.createComment('')` to be renamed for a
	// small manual size-savings.

	const createMarker = () => document.createComment('');
	/**
	 * This regex extracts the attribute name preceding an attribute-position
	 * expression. It does this by matching the syntax allowed for attributes
	 * against the string literal directly preceding the expression, assuming that
	 * the expression is in an attribute-value position.
	 *
	 * See attributes in the HTML spec:
	 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
	 *
	 * " \x09\x0a\x0c\x0d" are HTML space characters:
	 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
	 *
	 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
	 * space character except " ".
	 *
	 * So an attribute is:
	 *  * The name: any character except a control character, space character, ('),
	 *    ("), ">", "=", or "/"
	 *  * Followed by zero or more space characters
	 *  * Followed by "="
	 *  * Followed by zero or more space characters
	 *  * Followed by:
	 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
	 *    * (") then any non-("), or
	 *    * (') then any non-(')
	 */

	const lastAttributeNameRegex = // eslint-disable-next-line no-control-regex
	/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * An instance of a `Template` that can be attached to the DOM and updated
	 * with new values.
	 */

	class TemplateInstance {
	  constructor(template, processor, options) {
	    this.__parts = [];
	    this.template = template;
	    this.processor = processor;
	    this.options = options;
	  }

	  update(values) {
	    let i = 0;

	    for (const part of this.__parts) {
	      if (part !== undefined) {
	        part.setValue(values[i]);
	      }

	      i++;
	    }

	    for (const part of this.__parts) {
	      if (part !== undefined) {
	        part.commit();
	      }
	    }
	  }

	  _clone() {
	    // There are a number of steps in the lifecycle of a template instance's
	    // DOM fragment:
	    //  1. Clone - create the instance fragment
	    //  2. Adopt - adopt into the main document
	    //  3. Process - find part markers and create parts
	    //  4. Upgrade - upgrade custom elements
	    //  5. Update - set node, attribute, property, etc., values
	    //  6. Connect - connect to the document. Optional and outside of this
	    //     method.
	    //
	    // We have a few constraints on the ordering of these steps:
	    //  * We need to upgrade before updating, so that property values will pass
	    //    through any property setters.
	    //  * We would like to process before upgrading so that we're sure that the
	    //    cloned fragment is inert and not disturbed by self-modifying DOM.
	    //  * We want custom elements to upgrade even in disconnected fragments.
	    //
	    // Given these constraints, with full custom elements support we would
	    // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
	    //
	    // But Safari does not implement CustomElementRegistry#upgrade, so we
	    // can not implement that order and still have upgrade-before-update and
	    // upgrade disconnected fragments. So we instead sacrifice the
	    // process-before-upgrade constraint, since in Custom Elements v1 elements
	    // must not modify their light DOM in the constructor. We still have issues
	    // when co-existing with CEv0 elements like Polymer 1, and with polyfills
	    // that don't strictly adhere to the no-modification rule because shadow
	    // DOM, which may be created in the constructor, is emulated by being placed
	    // in the light DOM.
	    //
	    // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
	    // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
	    // in one step.
	    //
	    // The Custom Elements v1 polyfill supports upgrade(), so the order when
	    // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
	    // Connect.
	    const fragment = isCEPolyfill ? this.template.element.content.cloneNode(true) : document.importNode(this.template.element.content, true);
	    const stack = [];
	    const parts = this.template.parts; // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null

	    const walker = document.createTreeWalker(fragment, 133
	    /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */
	    , null, false);
	    let partIndex = 0;
	    let nodeIndex = 0;
	    let part;
	    let node = walker.nextNode(); // Loop through all the nodes and parts of a template

	    while (partIndex < parts.length) {
	      part = parts[partIndex];

	      if (!isTemplatePartActive(part)) {
	        this.__parts.push(undefined);

	        partIndex++;
	        continue;
	      } // Progress the tree walker until we find our next part's node.
	      // Note that multiple parts may share the same node (attribute parts
	      // on a single element), so this loop may not run at all.


	      while (nodeIndex < part.index) {
	        nodeIndex++;

	        if (node.nodeName === 'TEMPLATE') {
	          stack.push(node);
	          walker.currentNode = node.content;
	        }

	        if ((node = walker.nextNode()) === null) {
	          // We've exhausted the content inside a nested template element.
	          // Because we still have parts (the outer for-loop), we know:
	          // - There is a template in the stack
	          // - The walker will find a nextNode outside the template
	          walker.currentNode = stack.pop();
	          node = walker.nextNode();
	        }
	      } // We've arrived at our part's node.


	      if (part.type === 'node') {
	        const part = this.processor.handleTextExpression(this.options);
	        part.insertAfterNode(node.previousSibling);

	        this.__parts.push(part);
	      } else {
	        this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
	      }

	      partIndex++;
	    }

	    if (isCEPolyfill) {
	      document.adoptNode(fragment);
	      customElements.upgrade(fragment);
	    }

	    return fragment;
	  }

	}

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	const commentMarker = ` ${marker} `;
	/**
	 * The return type of `html`, which holds a Template and the values from
	 * interpolated expressions.
	 */

	class TemplateResult {
	  constructor(strings, values, type, processor) {
	    this.strings = strings;
	    this.values = values;
	    this.type = type;
	    this.processor = processor;
	  }
	  /**
	   * Returns a string of HTML used to create a `<template>` element.
	   */


	  getHTML() {
	    const l = this.strings.length - 1;
	    let html = '';
	    let isCommentBinding = false;

	    for (let i = 0; i < l; i++) {
	      const s = this.strings[i]; // For each binding we want to determine the kind of marker to insert
	      // into the template source before it's parsed by the browser's HTML
	      // parser. The marker type is based on whether the expression is in an
	      // attribute, text, or comment position.
	      //   * For node-position bindings we insert a comment with the marker
	      //     sentinel as its text content, like <!--{{lit-guid}}-->.
	      //   * For attribute bindings we insert just the marker sentinel for the
	      //     first binding, so that we support unquoted attribute bindings.
	      //     Subsequent bindings can use a comment marker because multi-binding
	      //     attributes must be quoted.
	      //   * For comment bindings we insert just the marker sentinel so we don't
	      //     close the comment.
	      //
	      // The following code scans the template source, but is *not* an HTML
	      // parser. We don't need to track the tree structure of the HTML, only
	      // whether a binding is inside a comment, and if not, if it appears to be
	      // the first binding in an attribute.

	      const commentOpen = s.lastIndexOf('<!--'); // We're in comment position if we have a comment open with no following
	      // comment close. Because <-- can appear in an attribute value there can
	      // be false positives.

	      isCommentBinding = (commentOpen > -1 || isCommentBinding) && s.indexOf('-->', commentOpen + 1) === -1; // Check to see if we have an attribute-like sequence preceding the
	      // expression. This can match "name=value" like structures in text,
	      // comments, and attribute values, so there can be false-positives.

	      const attributeMatch = lastAttributeNameRegex.exec(s);

	      if (attributeMatch === null) {
	        // We're only in this branch if we don't have a attribute-like
	        // preceding sequence. For comments, this guards against unusual
	        // attribute values like <div foo="<!--${'bar'}">. Cases like
	        // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
	        // below.
	        html += s + (isCommentBinding ? commentMarker : nodeMarker);
	      } else {
	        // For attributes we use just a marker sentinel, and also append a
	        // $lit$ suffix to the name to opt-out of attribute-specific parsing
	        // that IE and Edge do for style and certain SVG attributes.
	        html += s.substr(0, attributeMatch.index) + attributeMatch[1] + attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] + marker;
	      }
	    }

	    html += this.strings[l];
	    return html;
	  }

	  getTemplateElement() {
	    const template = document.createElement('template');
	    template.innerHTML = this.getHTML();
	    return template;
	  }

	}

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	const isPrimitive = value => {
	  return value === null || !(typeof value === 'object' || typeof value === 'function');
	};
	const isIterable = value => {
	  return Array.isArray(value) || // eslint-disable-next-line @typescript-eslint/no-explicit-any
	  !!(value && value[Symbol.iterator]);
	};
	/**
	 * Writes attribute values to the DOM for a group of AttributeParts bound to a
	 * single attribute. The value is only set once even if there are multiple parts
	 * for an attribute.
	 */

	class AttributeCommitter {
	  constructor(element, name, strings) {
	    this.dirty = true;
	    this.element = element;
	    this.name = name;
	    this.strings = strings;
	    this.parts = [];

	    for (let i = 0; i < strings.length - 1; i++) {
	      this.parts[i] = this._createPart();
	    }
	  }
	  /**
	   * Creates a single part. Override this to create a differnt type of part.
	   */


	  _createPart() {
	    return new AttributePart(this);
	  }

	  _getValue() {
	    const strings = this.strings;
	    const l = strings.length - 1;
	    let text = '';

	    for (let i = 0; i < l; i++) {
	      text += strings[i];
	      const part = this.parts[i];

	      if (part !== undefined) {
	        const v = part.value;

	        if (isPrimitive(v) || !isIterable(v)) {
	          text += typeof v === 'string' ? v : String(v);
	        } else {
	          for (const t of v) {
	            text += typeof t === 'string' ? t : String(t);
	          }
	        }
	      }
	    }

	    text += strings[l];
	    return text;
	  }

	  commit() {
	    if (this.dirty) {
	      this.dirty = false;
	      this.element.setAttribute(this.name, this._getValue());
	    }
	  }

	}
	/**
	 * A Part that controls all or part of an attribute value.
	 */

	class AttributePart {
	  constructor(committer) {
	    this.value = undefined;
	    this.committer = committer;
	  }

	  setValue(value) {
	    if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
	      this.value = value; // If the value is a not a directive, dirty the committer so that it'll
	      // call setAttribute. If the value is a directive, it'll dirty the
	      // committer if it calls setValue().

	      if (!isDirective(value)) {
	        this.committer.dirty = true;
	      }
	    }
	  }

	  commit() {
	    while (isDirective(this.value)) {
	      const directive = this.value;
	      this.value = noChange;
	      directive(this);
	    }

	    if (this.value === noChange) {
	      return;
	    }

	    this.committer.commit();
	  }

	}
	/**
	 * A Part that controls a location within a Node tree. Like a Range, NodePart
	 * has start and end locations and can set and update the Nodes between those
	 * locations.
	 *
	 * NodeParts support several value types: primitives, Nodes, TemplateResults,
	 * as well as arrays and iterables of those types.
	 */

	class NodePart {
	  constructor(options) {
	    this.value = undefined;
	    this.__pendingValue = undefined;
	    this.options = options;
	  }
	  /**
	   * Appends this part into a container.
	   *
	   * This part must be empty, as its contents are not automatically moved.
	   */


	  appendInto(container) {
	    this.startNode = container.appendChild(createMarker());
	    this.endNode = container.appendChild(createMarker());
	  }
	  /**
	   * Inserts this part after the `ref` node (between `ref` and `ref`'s next
	   * sibling). Both `ref` and its next sibling must be static, unchanging nodes
	   * such as those that appear in a literal section of a template.
	   *
	   * This part must be empty, as its contents are not automatically moved.
	   */


	  insertAfterNode(ref) {
	    this.startNode = ref;
	    this.endNode = ref.nextSibling;
	  }
	  /**
	   * Appends this part into a parent part.
	   *
	   * This part must be empty, as its contents are not automatically moved.
	   */


	  appendIntoPart(part) {
	    part.__insert(this.startNode = createMarker());

	    part.__insert(this.endNode = createMarker());
	  }
	  /**
	   * Inserts this part after the `ref` part.
	   *
	   * This part must be empty, as its contents are not automatically moved.
	   */


	  insertAfterPart(ref) {
	    ref.__insert(this.startNode = createMarker());

	    this.endNode = ref.endNode;
	    ref.endNode = this.startNode;
	  }

	  setValue(value) {
	    this.__pendingValue = value;
	  }

	  commit() {
	    if (this.startNode.parentNode === null) {
	      return;
	    }

	    while (isDirective(this.__pendingValue)) {
	      const directive = this.__pendingValue;
	      this.__pendingValue = noChange;
	      directive(this);
	    }

	    const value = this.__pendingValue;

	    if (value === noChange) {
	      return;
	    }

	    if (isPrimitive(value)) {
	      if (value !== this.value) {
	        this.__commitText(value);
	      }
	    } else if (value instanceof TemplateResult) {
	      this.__commitTemplateResult(value);
	    } else if (value instanceof Node) {
	      this.__commitNode(value);
	    } else if (isIterable(value)) {
	      this.__commitIterable(value);
	    } else if (value === nothing) {
	      this.value = nothing;
	      this.clear();
	    } else {
	      // Fallback, will render the string representation
	      this.__commitText(value);
	    }
	  }

	  __insert(node) {
	    this.endNode.parentNode.insertBefore(node, this.endNode);
	  }

	  __commitNode(value) {
	    if (this.value === value) {
	      return;
	    }

	    this.clear();

	    this.__insert(value);

	    this.value = value;
	  }

	  __commitText(value) {
	    const node = this.startNode.nextSibling;
	    value = value == null ? '' : value; // If `value` isn't already a string, we explicitly convert it here in case
	    // it can't be implicitly converted - i.e. it's a symbol.

	    const valueAsString = typeof value === 'string' ? value : String(value);

	    if (node === this.endNode.previousSibling && node.nodeType === 3
	    /* Node.TEXT_NODE */
	    ) {
	        // If we only have a single text node between the markers, we can just
	        // set its value, rather than replacing it.
	        // TODO(justinfagnani): Can we just check if this.value is primitive?
	        node.data = valueAsString;
	      } else {
	      this.__commitNode(document.createTextNode(valueAsString));
	    }

	    this.value = value;
	  }

	  __commitTemplateResult(value) {
	    const template = this.options.templateFactory(value);

	    if (this.value instanceof TemplateInstance && this.value.template === template) {
	      this.value.update(value.values);
	    } else {
	      // Make sure we propagate the template processor from the TemplateResult
	      // so that we use its syntax extension, etc. The template factory comes
	      // from the render function options so that it can control template
	      // caching and preprocessing.
	      const instance = new TemplateInstance(template, value.processor, this.options);

	      const fragment = instance._clone();

	      instance.update(value.values);

	      this.__commitNode(fragment);

	      this.value = instance;
	    }
	  }

	  __commitIterable(value) {
	    // For an Iterable, we create a new InstancePart per item, then set its
	    // value to the item. This is a little bit of overhead for every item in
	    // an Iterable, but it lets us recurse easily and efficiently update Arrays
	    // of TemplateResults that will be commonly returned from expressions like:
	    // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
	    // If _value is an array, then the previous render was of an
	    // iterable and _value will contain the NodeParts from the previous
	    // render. If _value is not an array, clear this part and make a new
	    // array for NodeParts.
	    if (!Array.isArray(this.value)) {
	      this.value = [];
	      this.clear();
	    } // Lets us keep track of how many items we stamped so we can clear leftover
	    // items from a previous render


	    const itemParts = this.value;
	    let partIndex = 0;
	    let itemPart;

	    for (const item of value) {
	      // Try to reuse an existing part
	      itemPart = itemParts[partIndex]; // If no existing part, create a new one

	      if (itemPart === undefined) {
	        itemPart = new NodePart(this.options);
	        itemParts.push(itemPart);

	        if (partIndex === 0) {
	          itemPart.appendIntoPart(this);
	        } else {
	          itemPart.insertAfterPart(itemParts[partIndex - 1]);
	        }
	      }

	      itemPart.setValue(item);
	      itemPart.commit();
	      partIndex++;
	    }

	    if (partIndex < itemParts.length) {
	      // Truncate the parts array so _value reflects the current state
	      itemParts.length = partIndex;
	      this.clear(itemPart && itemPart.endNode);
	    }
	  }

	  clear(startNode = this.startNode) {
	    removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
	  }

	}
	/**
	 * Implements a boolean attribute, roughly as defined in the HTML
	 * specification.
	 *
	 * If the value is truthy, then the attribute is present with a value of
	 * ''. If the value is falsey, the attribute is removed.
	 */

	class BooleanAttributePart {
	  constructor(element, name, strings) {
	    this.value = undefined;
	    this.__pendingValue = undefined;

	    if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
	      throw new Error('Boolean attributes can only contain a single expression');
	    }

	    this.element = element;
	    this.name = name;
	    this.strings = strings;
	  }

	  setValue(value) {
	    this.__pendingValue = value;
	  }

	  commit() {
	    while (isDirective(this.__pendingValue)) {
	      const directive = this.__pendingValue;
	      this.__pendingValue = noChange;
	      directive(this);
	    }

	    if (this.__pendingValue === noChange) {
	      return;
	    }

	    const value = !!this.__pendingValue;

	    if (this.value !== value) {
	      if (value) {
	        this.element.setAttribute(this.name, '');
	      } else {
	        this.element.removeAttribute(this.name);
	      }

	      this.value = value;
	    }

	    this.__pendingValue = noChange;
	  }

	}
	/**
	 * Sets attribute values for PropertyParts, so that the value is only set once
	 * even if there are multiple parts for a property.
	 *
	 * If an expression controls the whole property value, then the value is simply
	 * assigned to the property under control. If there are string literals or
	 * multiple expressions, then the strings are expressions are interpolated into
	 * a string first.
	 */

	class PropertyCommitter extends AttributeCommitter {
	  constructor(element, name, strings) {
	    super(element, name, strings);
	    this.single = strings.length === 2 && strings[0] === '' && strings[1] === '';
	  }

	  _createPart() {
	    return new PropertyPart(this);
	  }

	  _getValue() {
	    if (this.single) {
	      return this.parts[0].value;
	    }

	    return super._getValue();
	  }

	  commit() {
	    if (this.dirty) {
	      this.dirty = false; // eslint-disable-next-line @typescript-eslint/no-explicit-any

	      this.element[this.name] = this._getValue();
	    }
	  }

	}
	class PropertyPart extends AttributePart {} // Detect event listener options support. If the `capture` property is read
	// from the options object, then options are supported. If not, then the third
	// argument to add/removeEventListener is interpreted as the boolean capture
	// value so we should only pass the `capture` property.

	let eventOptionsSupported = false; // Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
	// blocks right into the body of a module

	(() => {
	  try {
	    const options = {
	      get capture() {
	        eventOptionsSupported = true;
	        return false;
	      }

	    }; // eslint-disable-next-line @typescript-eslint/no-explicit-any

	    window.addEventListener('test', options, options); // eslint-disable-next-line @typescript-eslint/no-explicit-any

	    window.removeEventListener('test', options, options);
	  } catch (_e) {// event options not supported
	  }
	})();

	class EventPart {
	  constructor(element, eventName, eventContext) {
	    this.value = undefined;
	    this.__pendingValue = undefined;
	    this.element = element;
	    this.eventName = eventName;
	    this.eventContext = eventContext;

	    this.__boundHandleEvent = e => this.handleEvent(e);
	  }

	  setValue(value) {
	    this.__pendingValue = value;
	  }

	  commit() {
	    while (isDirective(this.__pendingValue)) {
	      const directive = this.__pendingValue;
	      this.__pendingValue = noChange;
	      directive(this);
	    }

	    if (this.__pendingValue === noChange) {
	      return;
	    }

	    const newListener = this.__pendingValue;
	    const oldListener = this.value;
	    const shouldRemoveListener = newListener == null || oldListener != null && (newListener.capture !== oldListener.capture || newListener.once !== oldListener.once || newListener.passive !== oldListener.passive);
	    const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);

	    if (shouldRemoveListener) {
	      this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
	    }

	    if (shouldAddListener) {
	      this.__options = getOptions(newListener);
	      this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
	    }

	    this.value = newListener;
	    this.__pendingValue = noChange;
	  }

	  handleEvent(event) {
	    if (typeof this.value === 'function') {
	      this.value.call(this.eventContext || this.element, event);
	    } else {
	      this.value.handleEvent(event);
	    }
	  }

	} // We copy options because of the inconsistent behavior of browsers when reading
	// the third argument of add/removeEventListener. IE11 doesn't support options
	// at all. Chrome 41 only reads `capture` if the argument is an object.

	const getOptions = o => o && (eventOptionsSupported ? {
	  capture: o.capture,
	  passive: o.passive,
	  once: o.once
	} : o.capture);

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * Creates Parts when a template is instantiated.
	 */

	class DefaultTemplateProcessor {
	  /**
	   * Create parts for an attribute-position binding, given the event, attribute
	   * name, and string literals.
	   *
	   * @param element The element containing the binding
	   * @param name  The attribute name
	   * @param strings The string literals. There are always at least two strings,
	   *   event for fully-controlled bindings with a single expression.
	   */
	  handleAttributeExpressions(element, name, strings, options) {
	    const prefix = name[0];

	    if (prefix === '.') {
	      const committer = new PropertyCommitter(element, name.slice(1), strings);
	      return committer.parts;
	    }

	    if (prefix === '@') {
	      return [new EventPart(element, name.slice(1), options.eventContext)];
	    }

	    if (prefix === '?') {
	      return [new BooleanAttributePart(element, name.slice(1), strings)];
	    }

	    const committer = new AttributeCommitter(element, name, strings);
	    return committer.parts;
	  }
	  /**
	   * Create parts for a text-position binding.
	   * @param templateFactory
	   */


	  handleTextExpression(options) {
	    return new NodePart(options);
	  }

	}
	const defaultTemplateProcessor = new DefaultTemplateProcessor();

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * The default TemplateFactory which caches Templates keyed on
	 * result.type and result.strings.
	 */

	function templateFactory(result) {
	  let templateCache = templateCaches.get(result.type);

	  if (templateCache === undefined) {
	    templateCache = {
	      stringsArray: new WeakMap(),
	      keyString: new Map()
	    };
	    templateCaches.set(result.type, templateCache);
	  }

	  let template = templateCache.stringsArray.get(result.strings);

	  if (template !== undefined) {
	    return template;
	  } // If the TemplateStringsArray is new, generate a key from the strings
	  // This key is shared between all templates with identical content


	  const key = result.strings.join(marker); // Check if we already have a Template for this key

	  template = templateCache.keyString.get(key);

	  if (template === undefined) {
	    // If we have not seen this key before, create a new Template
	    template = new Template(result, result.getTemplateElement()); // Cache the Template for this key

	    templateCache.keyString.set(key, template);
	  } // Cache all future queries for this TemplateStringsArray


	  templateCache.stringsArray.set(result.strings, template);
	  return template;
	}
	const templateCaches = new Map();

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	const parts = new WeakMap();
	/**
	 * Renders a template result or other value to a container.
	 *
	 * To update a container with new values, reevaluate the template literal and
	 * call `render` with the new result.
	 *
	 * @param result Any value renderable by NodePart - typically a TemplateResult
	 *     created by evaluating a template tag like `html` or `svg`.
	 * @param container A DOM parent to render to. The entire contents are either
	 *     replaced, or efficiently updated if the same result type was previous
	 *     rendered there.
	 * @param options RenderOptions for the entire render tree rendered to this
	 *     container. Render options must *not* change between renders to the same
	 *     container, as those changes will not effect previously rendered DOM.
	 */

	const render = (result, container, options) => {
	  let part = parts.get(container);

	  if (part === undefined) {
	    removeNodes(container, container.firstChild);
	    parts.set(container, part = new NodePart(Object.assign({
	      templateFactory
	    }, options)));
	    part.appendInto(container);
	  }

	  part.setValue(result);
	  part.commit();
	};

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	// This line will be used in regexes to search for lit-html usage.
	// TODO(justinfagnani): inject version number at build time

	if (typeof window !== 'undefined') {
	  (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.2.1');
	}
	/**
	 * Interprets a template literal as an HTML template that can efficiently
	 * render to and update a container.
	 */


	const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	const walkerNodeFilter = 133
	/* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */
	;
	/**
	 * Removes the list of nodes from a Template safely. In addition to removing
	 * nodes from the Template, the Template part indices are updated to match
	 * the mutated Template DOM.
	 *
	 * As the template is walked the removal state is tracked and
	 * part indices are adjusted as needed.
	 *
	 * div
	 *   div#1 (remove) <-- start removing (removing node is div#1)
	 *     div
	 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
	 *         div
	 * div <-- stop removing since previous sibling is the removing node (div#1,
	 * removed 4 nodes)
	 */

	function removeNodesFromTemplate(template, nodesToRemove) {
	  const {
	    element: {
	      content
	    },
	    parts
	  } = template;
	  const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
	  let partIndex = nextActiveIndexInTemplateParts(parts);
	  let part = parts[partIndex];
	  let nodeIndex = -1;
	  let removeCount = 0;
	  const nodesToRemoveInTemplate = [];
	  let currentRemovingNode = null;

	  while (walker.nextNode()) {
	    nodeIndex++;
	    const node = walker.currentNode; // End removal if stepped past the removing node

	    if (node.previousSibling === currentRemovingNode) {
	      currentRemovingNode = null;
	    } // A node to remove was found in the template


	    if (nodesToRemove.has(node)) {
	      nodesToRemoveInTemplate.push(node); // Track node we're removing

	      if (currentRemovingNode === null) {
	        currentRemovingNode = node;
	      }
	    } // When removing, increment count by which to adjust subsequent part indices


	    if (currentRemovingNode !== null) {
	      removeCount++;
	    }

	    while (part !== undefined && part.index === nodeIndex) {
	      // If part is in a removed node deactivate it by setting index to -1 or
	      // adjust the index as needed.
	      part.index = currentRemovingNode !== null ? -1 : part.index - removeCount; // go to the next active part.

	      partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
	      part = parts[partIndex];
	    }
	  }

	  nodesToRemoveInTemplate.forEach(n => n.parentNode.removeChild(n));
	}

	const countNodes = node => {
	  let count = node.nodeType === 11
	  /* Node.DOCUMENT_FRAGMENT_NODE */
	  ? 0 : 1;
	  const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);

	  while (walker.nextNode()) {
	    count++;
	  }

	  return count;
	};

	const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
	  for (let i = startIndex + 1; i < parts.length; i++) {
	    const part = parts[i];

	    if (isTemplatePartActive(part)) {
	      return i;
	    }
	  }

	  return -1;
	};
	/**
	 * Inserts the given node into the Template, optionally before the given
	 * refNode. In addition to inserting the node into the Template, the Template
	 * part indices are updated to match the mutated Template DOM.
	 */


	function insertNodeIntoTemplate(template, node, refNode = null) {
	  const {
	    element: {
	      content
	    },
	    parts
	  } = template; // If there's no refNode, then put node at end of template.
	  // No part indices need to be shifted in this case.

	  if (refNode === null || refNode === undefined) {
	    content.appendChild(node);
	    return;
	  }

	  const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
	  let partIndex = nextActiveIndexInTemplateParts(parts);
	  let insertCount = 0;
	  let walkerIndex = -1;

	  while (walker.nextNode()) {
	    walkerIndex++;
	    const walkerNode = walker.currentNode;

	    if (walkerNode === refNode) {
	      insertCount = countNodes(node);
	      refNode.parentNode.insertBefore(node, refNode);
	    }

	    while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
	      // If we've inserted the node, simply adjust all subsequent parts
	      if (insertCount > 0) {
	        while (partIndex !== -1) {
	          parts[partIndex].index += insertCount;
	          partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
	        }

	        return;
	      }

	      partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
	    }
	  }
	}

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;

	let compatibleShadyCSSVersion = true;

	if (typeof window.ShadyCSS === 'undefined') {
	  compatibleShadyCSSVersion = false;
	} else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
	  console.warn(`Incompatible ShadyCSS version detected. ` + `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` + `@webcomponents/shadycss@1.3.1.`);
	  compatibleShadyCSSVersion = false;
	}
	/**
	 * Template factory which scopes template DOM using ShadyCSS.
	 * @param scopeName {string}
	 */


	const shadyTemplateFactory = scopeName => result => {
	  const cacheKey = getTemplateCacheKey(result.type, scopeName);
	  let templateCache = templateCaches.get(cacheKey);

	  if (templateCache === undefined) {
	    templateCache = {
	      stringsArray: new WeakMap(),
	      keyString: new Map()
	    };
	    templateCaches.set(cacheKey, templateCache);
	  }

	  let template = templateCache.stringsArray.get(result.strings);

	  if (template !== undefined) {
	    return template;
	  }

	  const key = result.strings.join(marker);
	  template = templateCache.keyString.get(key);

	  if (template === undefined) {
	    const element = result.getTemplateElement();

	    if (compatibleShadyCSSVersion) {
	      window.ShadyCSS.prepareTemplateDom(element, scopeName);
	    }

	    template = new Template(result, element);
	    templateCache.keyString.set(key, template);
	  }

	  templateCache.stringsArray.set(result.strings, template);
	  return template;
	};

	const TEMPLATE_TYPES = ['html', 'svg'];
	/**
	 * Removes all style elements from Templates for the given scopeName.
	 */

	const removeStylesFromLitTemplates = scopeName => {
	  TEMPLATE_TYPES.forEach(type => {
	    const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));

	    if (templates !== undefined) {
	      templates.keyString.forEach(template => {
	        const {
	          element: {
	            content
	          }
	        } = template; // IE 11 doesn't support the iterable param Set constructor

	        const styles = new Set();
	        Array.from(content.querySelectorAll('style')).forEach(s => {
	          styles.add(s);
	        });
	        removeNodesFromTemplate(template, styles);
	      });
	    }
	  });
	};

	const shadyRenderSet = new Set();
	/**
	 * For the given scope name, ensures that ShadyCSS style scoping is performed.
	 * This is done just once per scope name so the fragment and template cannot
	 * be modified.
	 * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
	 * to be scoped and appended to the document
	 * (2) removes style elements from all lit-html Templates for this scope name.
	 *
	 * Note, <style> elements can only be placed into templates for the
	 * initial rendering of the scope. If <style> elements are included in templates
	 * dynamically rendered to the scope (after the first scope render), they will
	 * not be scoped and the <style> will be left in the template and rendered
	 * output.
	 */

	const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
	  shadyRenderSet.add(scopeName); // If `renderedDOM` is stamped from a Template, then we need to edit that
	  // Template's underlying template element. Otherwise, we create one here
	  // to give to ShadyCSS, which still requires one while scoping.

	  const templateElement = !!template ? template.element : document.createElement('template'); // Move styles out of rendered DOM and store.

	  const styles = renderedDOM.querySelectorAll('style');
	  const {
	    length
	  } = styles; // If there are no styles, skip unnecessary work

	  if (length === 0) {
	    // Ensure prepareTemplateStyles is called to support adding
	    // styles via `prepareAdoptedCssText` since that requires that
	    // `prepareTemplateStyles` is called.
	    //
	    // ShadyCSS will only update styles containing @apply in the template
	    // given to `prepareTemplateStyles`. If no lit Template was given,
	    // ShadyCSS will not be able to update uses of @apply in any relevant
	    // template. However, this is not a problem because we only create the
	    // template for the purpose of supporting `prepareAdoptedCssText`,
	    // which doesn't support @apply at all.
	    window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
	    return;
	  }

	  const condensedStyle = document.createElement('style'); // Collect styles into a single style. This helps us make sure ShadyCSS
	  // manipulations will not prevent us from being able to fix up template
	  // part indices.
	  // NOTE: collecting styles is inefficient for browsers but ShadyCSS
	  // currently does this anyway. When it does not, this should be changed.

	  for (let i = 0; i < length; i++) {
	    const style = styles[i];
	    style.parentNode.removeChild(style);
	    condensedStyle.textContent += style.textContent;
	  } // Remove styles from nested templates in this scope.


	  removeStylesFromLitTemplates(scopeName); // And then put the condensed style into the "root" template passed in as
	  // `template`.

	  const content = templateElement.content;

	  if (!!template) {
	    insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
	  } else {
	    content.insertBefore(condensedStyle, content.firstChild);
	  } // Note, it's important that ShadyCSS gets the template that `lit-html`
	  // will actually render so that it can update the style inside when
	  // needed (e.g. @apply native Shadow DOM case).


	  window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
	  const style = content.querySelector('style');

	  if (window.ShadyCSS.nativeShadow && style !== null) {
	    // When in native Shadow DOM, ensure the style created by ShadyCSS is
	    // included in initially rendered output (`renderedDOM`).
	    renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
	  } else if (!!template) {
	    // When no style is left in the template, parts will be broken as a
	    // result. To fix this, we put back the style node ShadyCSS removed
	    // and then tell lit to remove that node from the template.
	    // There can be no style in the template in 2 cases (1) when Shady DOM
	    // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
	    // is in use ShadyCSS removes the style if it contains no content.
	    // NOTE, ShadyCSS creates its own style so we can safely add/remove
	    // `condensedStyle` here.
	    content.insertBefore(condensedStyle, content.firstChild);
	    const removes = new Set();
	    removes.add(condensedStyle);
	    removeNodesFromTemplate(template, removes);
	  }
	};
	/**
	 * Extension to the standard `render` method which supports rendering
	 * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
	 * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
	 * or when the webcomponentsjs
	 * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
	 *
	 * Adds a `scopeName` option which is used to scope element DOM and stylesheets
	 * when native ShadowDOM is unavailable. The `scopeName` will be added to
	 * the class attribute of all rendered DOM. In addition, any style elements will
	 * be automatically re-written with this `scopeName` selector and moved out
	 * of the rendered DOM and into the document `<head>`.
	 *
	 * It is common to use this render method in conjunction with a custom element
	 * which renders a shadowRoot. When this is done, typically the element's
	 * `localName` should be used as the `scopeName`.
	 *
	 * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
	 * custom properties (needed only on older browsers like IE11) and a shim for
	 * a deprecated feature called `@apply` that supports applying a set of css
	 * custom properties to a given location.
	 *
	 * Usage considerations:
	 *
	 * * Part values in `<style>` elements are only applied the first time a given
	 * `scopeName` renders. Subsequent changes to parts in style elements will have
	 * no effect. Because of this, parts in style elements should only be used for
	 * values that will never change, for example parts that set scope-wide theme
	 * values or parts which render shared style elements.
	 *
	 * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
	 * custom element's `constructor` is not supported. Instead rendering should
	 * either done asynchronously, for example at microtask timing (for example
	 * `Promise.resolve()`), or be deferred until the first time the element's
	 * `connectedCallback` runs.
	 *
	 * Usage considerations when using shimmed custom properties or `@apply`:
	 *
	 * * Whenever any dynamic changes are made which affect
	 * css custom properties, `ShadyCSS.styleElement(element)` must be called
	 * to update the element. There are two cases when this is needed:
	 * (1) the element is connected to a new parent, (2) a class is added to the
	 * element that causes it to match different custom properties.
	 * To address the first case when rendering a custom element, `styleElement`
	 * should be called in the element's `connectedCallback`.
	 *
	 * * Shimmed custom properties may only be defined either for an entire
	 * shadowRoot (for example, in a `:host` rule) or via a rule that directly
	 * matches an element with a shadowRoot. In other words, instead of flowing from
	 * parent to child as do native css custom properties, shimmed custom properties
	 * flow only from shadowRoots to nested shadowRoots.
	 *
	 * * When using `@apply` mixing css shorthand property names with
	 * non-shorthand names (for example `border` and `border-width`) is not
	 * supported.
	 */


	const render$1 = (result, container, options) => {
	  if (!options || typeof options !== 'object' || !options.scopeName) {
	    throw new Error('The `scopeName` option is required.');
	  }

	  const scopeName = options.scopeName;
	  const hasRendered = parts.has(container);
	  const needsScoping = compatibleShadyCSSVersion && container.nodeType === 11
	  /* Node.DOCUMENT_FRAGMENT_NODE */
	  && !!container.host; // Handle first render to a scope specially...

	  const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName); // On first scope render, render into a fragment; this cannot be a single
	  // fragment that is reused since nested renders can occur synchronously.

	  const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
	  render(result, renderContainer, Object.assign({
	    templateFactory: shadyTemplateFactory(scopeName)
	  }, options)); // When performing first scope render,
	  // (1) We've rendered into a fragment so that there's a chance to
	  // `prepareTemplateStyles` before sub-elements hit the DOM
	  // (which might cause them to render based on a common pattern of
	  // rendering in a custom element's `connectedCallback`);
	  // (2) Scope the template with ShadyCSS one time only for this scope.
	  // (3) Render the fragment into the container and make sure the
	  // container knows its `part` is the one we just rendered. This ensures
	  // DOM will be re-used on subsequent renders.

	  if (firstScopeRender) {
	    const part = parts.get(renderContainer);
	    parts.delete(renderContainer); // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
	    // that should apply to `renderContainer` even if the rendered value is
	    // not a TemplateInstance. However, it will only insert scoped styles
	    // into the document if `prepareTemplateStyles` has already been called
	    // for the given scope name.

	    const template = part.value instanceof TemplateInstance ? part.value.template : undefined;
	    prepareTemplateStyles(scopeName, renderContainer, template);
	    removeNodes(container, container.firstChild);
	    container.appendChild(renderContainer);
	    parts.set(container, part);
	  } // After elements have hit the DOM, update styling if this is the
	  // initial render to this container.
	  // This is needed whenever dynamic changes are made so it would be
	  // safest to do every render; however, this would regress performance
	  // so we leave it up to the user to call `ShadyCSS.styleElement`
	  // for dynamic changes.


	  if (!hasRendered && needsScoping) {
	    window.ShadyCSS.styleElement(container.host);
	  }
	};

	class TemplateElement extends StyledElement {
	  constructor(options) {
	    super({
	      deferUpdate: false,
	      shadowRender: false,
	      styles: [],
	      adoptGlobalStyles: true,
	      mutationObserverOptions: {
	        childList: false
	      },
	      ...options
	    });
	    this._template = this._options.template;
	    if (this._options.shadowRender) this.attachShadow({
	      mode: 'open'
	    });
	  }

	  template() {
	    return html``;
	  }

	  update(options) {
	    this.renderTemplate();
	    super.update(options);
	  }

	  renderTemplate() {
	    const template = this._template || this.template();

	    if (typeof template === 'string') {
	      // just a plain string literal. no lit-html required
	      this.getRoot().innerHTML = `${template}`;
	    } else {
	      // render via lit-html
	      render$1(html` ${template} `, this.getRoot(), {
	        scopeName: this.localName,
	        eventContext: this
	      });
	    }
	  }

	  getRoot() {
	    return this.shadowRoot !== null ? this.shadowRoot : this;
	  }

	}

	exports.BaseElement = BaseElement;
	exports.StyledElement = StyledElement;
	exports.TemplateElement = TemplateElement;
	exports.defineElement = defineElement;
	exports.html = html;
	exports.i18n = i18n;
	exports.toString = toString;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
