import { encodeAttribute } from '../../../util/AttributeParser';
import { unsafeHTML, spreadAttributes } from './directives.js';

class Part {
	constructor(value) {
		this.value = value;
	}

	toString() {
		if (typeof this.value !== 'string') {
			return encodeAttribute(JSON.stringify(this.value));
		}
		return encodeAttribute(this.value);
	}
}

class TemplatePart extends Part {
	$$templatePart = true;

	constructor(value) {
		super(value?.$$templatePart ? value.value : value);
	}

	toString() {
		if (this.value === null || this.value === undefined) {
			return '';
		} else if (this.value === '') {
			return '';
		} else if (Array.isArray(this.value)) {
			return this.value.map((row) => new TemplatePart(row).toString()).join('');
		} else if (this.value?.$$templateLiteral) {
			return this.value.toString();
		} else if (typeof this.value === 'function') {
			// A directive
			return this.value(this);
		}
		return super.toString();
	}
}

class TemplateLiteral {
	$$templateLiteral = true;

	constructor(strings, ...values) {
		let result = [];
		for (let i = 0; i < strings.length; i++) {
			result.push(strings[i]);

			if (i < values.length) {
				result.push(new TemplatePart(values[i]));
			}
		}
		this.result = result;
	}

	toString() {
		return `${this.result.join('')}`;
	}
}

const html = function (strings, ...values) {
	return new TemplateLiteral(strings, ...values);
};

export { Part, TemplatePart, TemplateLiteral, html, unsafeHTML, spreadAttributes };
