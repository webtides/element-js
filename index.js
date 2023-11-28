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
 */

export { BaseElement, StyledElement, TemplateElement, Store, Directive, html, toString, defineElement };
