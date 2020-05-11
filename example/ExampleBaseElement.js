import { BaseElement } from '../src/BaseElement.js';

class ExampleBaseElement extends BaseElement {
    constructor() {
        super({ deferUpdate: false });
    }

    hooks() {
        return {
            connected: () => {
                console.log('connected', { refs: this.$refs });
                this.firstName = 'Jane';
                this.lastName = 'Smith';
            },
            beforeUpdate: () => {
                console.log('beforeUpdate');
            },
            afterUpdate: () => {
                console.log('afterUpdate');
            },
        };
    }

    properties() {
        return {
            firstName: 'John',
            lastName: 'Doe',
        };
    }

    watch() {
        return {
            firstName: firstName => {
                console.log('watch:firstName', firstName);
            },
            lastName: lastName => {
                console.log('watch:lastName', lastName);
            },
        };
    }

    requestUpdate(options = { notify: true }) {
        console.log('requestUpdate', options);
        super.requestUpdate(options);
    }

    update(options = { notify: true }) {
        console.log('update', options);
        super.update(options);
    }
}
customElements.define('example-base-element', ExampleBaseElement);
