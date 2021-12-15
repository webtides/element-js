import { camelToDash } from '../../../util/AttributeParser';

class Part {
	constructor(value) {
		this.value = value;
	}

	/**
	 * TODO: do we really need this here ??
	 *
	 * @param attribute
	 * @param preserveCR
	 * @returns {string}
	 */
	encodeAttribute(attribute, preserveCR = false) {
		preserveCR = preserveCR ? '&#13;' : '\n';
		return `${attribute}`
			.replace(/'/g, '&apos;') /* The 4 other predefined entities, required. */
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\r\n/g, preserveCR) /* Must be before the next replacement. */
			.replace(/[\r\n]/g, preserveCR);
	}

	toString() {
		if (typeof this.value !== 'string') {
			return this.encodeAttribute(JSON.stringify(this.value));
		}
		return this.encodeAttribute(this.value);
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

const unsafeHTML = (string) => {
	return () => `<!--$$plainly-set-inner-html-->${decodeURIComponent(string)}`;
};

const attr = (attributes) => {
	return () => {
		return Object.keys(attributes)
			.map((key) => {
				return `${camelToDash(key)}='${new Part(attributes[key])}'`;
			})
			.join(' ');
	};
};

export { html, unsafeHTML, attr };
