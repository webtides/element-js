export class Directive {
    /** @type {Element} */
    node = undefined;

    /**
     * @param {Node} node
     */
    constructor(node) {
        this.node = node;
    }

    /**
     * @abstract
     */
    update() {}

    // TODO: this is somewhat custom... maybe we could set the initial values in the constructor and then simply override the default toString() method?!
    /**
     * Implement the stringify method and return a string for rendering the directive in SSR mode
     * @param {...any} values
     * @returns {string}
     */
    stringify(...values) {
        return '';
    }
}

/**
 * @param {Class<Directive>} directiveClass
 */
export const defineDirective = (directiveClass) => {
    return (...values) => {
        return {
            directiveClass,
            values,
            toString: () => {
                const directive = new directiveClass();
                return directive.stringify(...values);
            },
        };
    };
};
