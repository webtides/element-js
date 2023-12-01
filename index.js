import { BaseElement } from './src/BaseElement.js';
import { StyledElement } from './src/StyledElement.js';
import { TemplateElement, html } from './src/TemplateElement.js';
import { toString } from './src/util/toString.js';
import { defineElement } from './src/util/defineElement.js';
import { Store } from './src/util/Store.js';
import { Directive } from './src/util/Directive.js';

/**
 * Options object for element-js
 * @typedef {Object} ElementJsConfig
 * @property {boolean} [serializeState] - When set to true all elements and stores will serialize their state on changes to a global JSON object in the document. This is needed when rendering server side, so that elements and stores can hydrate with the correct state.
 * @property {boolean} [observeGlobalStyles] - By default element-js will look for all style elements in the global document and apply them before any custom/element styles inside the shadow DOM. When set to true element-js will also observe the document for any changes regarding styles. This is needed if styles will get added async or late.
 */

export { BaseElement, StyledElement, TemplateElement, Store, Directive, html, toString, defineElement };
