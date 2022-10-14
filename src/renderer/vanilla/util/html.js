import { camelToDash, decodeAttribute, encodeAttribute } from '../../../util/AttributeParser';
import { TemplateInstance } from './render';

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

const templateInstances = new WeakMap();

export class TemplateLiteral {
	$$templateLiteral = true;

	constructor(strings, ...values) {
		this.strings = strings;
		this.values = values;

		let result = [];
		for (let i = 0; i < strings.length; i++) {
			result.push(strings[i]);

			if (i < values.length) {
				result.push(new TemplatePart(values[i]));
			}
		}
		this.result = result;
	}

	renderInto(domNode) {
		let templateInstance = templateInstances.get(domNode);
		if (!templateInstance) {
			templateInstance = new TemplateInstance(this);
			templateInstances.set(domNode, templateInstance);

			domNode.replaceChildren(templateInstance.wire.valueOf());
		}

		templateInstance.update(this);
	}

	toString() {
		return `${this.result.join('')}`;
	}
}

const html = function (strings, ...values) {
	return new TemplateLiteral(strings, ...values);
};

const unsafeHTML = (string) => {
	return () => `${decodeAttribute(string)}`;
};

const spreadAttributes = (attributes) => {
	return () => {
		return Object.keys(attributes)
			.map((key) => {
				return `${camelToDash(key)}='${new Part(attributes[key])}'`;
			})
			.join(' ');
	};
};

export { html, unsafeHTML, spreadAttributes };
