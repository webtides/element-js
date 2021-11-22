import { camelToDash } from './AttributeParser';

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

	constructor(key) {
		super(key);
		this.key = key?.$$templatePart ? key.key : key;
	}

	toString() {
		if (this.key === null || this.key === undefined) {
			return '';
		} else if (this.key === '') {
			return '';
		} else if (Array.isArray(this.key)) {
			return this.key.map((row) => new TemplatePart(row).toString()).join('');
		} else if (this.key?.$$templateLiteral) {
			return this.key.toString();
		} else if (typeof this.key === 'function') {
			// A directive
			return this.key(this);
		}
		return super.toString();
	}
}

class TemplateLiteral {
	$$templateLiteral = true;

	constructor(strings, ...keys) {
		let result = [];
		for (let i = 0; i < strings.length; i++) {
			result.push(strings[i]);

			if (i < keys.length) {
				result.push(new TemplatePart(keys[i]));
			}
		}
		this.result = result;
	}

	toString() {
		return `${this.result.join('')}`;
	}
}

const html = function (strings, ...keys) {
	return new TemplateLiteral(strings, ...keys);
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
