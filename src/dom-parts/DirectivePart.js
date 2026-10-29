import { ElementPart } from './ElementPart.js';

/**
 * An interpolation at an attribute position, `<div ${spreadAttributes(map)}>`. The value is a wrapped directive,
 * see defineDirective(), the directive instance lives as long as the part.
 */
export class DirectivePart extends ElementPart {
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
        super(element, descriptor);
        this.directive = new firstValue.directiveClass(element);
    }

    /**
     * Every update reaches the directive, it compares its values itself.
     * @param {any[]} values
     */
    update(values) {
        this.directive.update(...values[this.descriptor.index].values);
    }
}
