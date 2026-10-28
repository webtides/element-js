import { Part } from './Part.js';

/**
 * An interpolation at an attribute position, `<div ${spreadAttributes(map)}>`. The value is a wrapped directive,
 * see defineDirective(), the directive instance lives as long as the part.
 */
export class DirectivePart extends Part {
    /** @type {number} the index of the value */
    index;

    /** @type {import('../util/Directive.js').Directive} */
    directive;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').DirectiveDescriptor} descriptor
     * @param {{directiveClass: Function, values: any[]}} firstValue - the directive class comes from the first value
     */
    constructor(element, descriptor, firstValue) {
        if (!firstValue?.directiveClass) {
            throw new Error(
                `DirectivePart: value "${firstValue}" is not a wrapped directive function. You must wrap your custom directive class with the defineDirective function.`,
            );
        }
        super();
        this.index = descriptor.index;
        this.directive = new firstValue.directiveClass(element);
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        this.directive.update(...values[this.index].values);
    }
}
