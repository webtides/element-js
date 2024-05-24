import { BaseElement, defineElement } from '../src/BaseElement.js';

class ExampleBaseElement extends BaseElement {
    // normal public properties
    greeting = 'Hello';
    name = 'John';

    // lifecycle hook
    connected() {
        this.greet();
    }

    // reactive attributes/properties
    properties() {
        return {
            familyName: 'Doe',
        };
    }

    // watchers for property changes
    watch() {
        return {
            familyName: (newValue, oldValue) => {
                console.log('familyName changed', newValue, oldValue);
            },
        };
    }

    // computed property
    get computedMsg() {
        return `${this.greeting} ${this.name} ${this.familyName}`;
    }

    // method
    greet() {
        console.log('greeting: ' + this.computedMsg);
    }
}
defineElement('example-base-element', ExampleBaseElement);
