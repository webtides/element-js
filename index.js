import { BaseElement } from './src/BaseElement';
import { StyledElement } from './src/StyledElement';
import { TemplateElement, html } from './src/TemplateElement';
import { toString } from './src/util/toString';
import { defineElement } from './src/util/defineElement';
import { i18n } from './src/util/i18n';

export { BaseElement, StyledElement, TemplateElement, html, toString, defineElement, i18n };

// lit-html directives: https://lit-html.polymer-project.org/guide/template-reference#built-in-directives
export { asyncAppend } from 'lit-html/directives/async-append';
export { asyncReplace } from 'lit-html/directives/async-replace';
export { cache } from 'lit-html/directives/cache';
export { classMap } from 'lit-html/directives/class-map';
export { guard } from 'lit-html/directives/guard';
export { ifDefined } from 'lit-html/directives/if-defined';
export { live } from 'lit-html/directives/live';
export { repeat } from 'lit-html/directives/repeat';
export { styleMap } from 'lit-html/directives/style-map';
export { templateContent } from 'lit-html/directives/template-content';
export { unsafeHTML } from 'lit-html/directives/unsafe-html';
export { unsafeSVG } from 'lit-html/directives/unsafe-svg';
export { until } from 'lit-html/directives/until';
