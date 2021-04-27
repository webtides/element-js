class TemplatePart {
	$$templatePart = true;

	constructor(key) {
		this.key = key.$$templatePart ? key.key : key;
	}

	toString() {
		if (Array.isArray(this.key)) {
			return this.key.map((row) => new TemplatePart(row).toString()).join('');
		} else if (this.key?.$$templateLiteral) {
			return this.key.toString();
		} else if (typeof this.key === 'function') {
			// A directive
			return this.key();
		} else if (typeof this.key !== 'string') {
			return this.encodeAttribute(this.key.toString());
		}

		return this.encodeAttribute(this.key);
	}

	encodeAttribute(attribute, preserveCR = false) {
		preserveCR = preserveCR ? '&#13;' : '\n';
		return `${attribute}`
			.replace(/&/g, '&amp;') /* This MUST be the 1st replacement. */
			.replace(/'/g, '&apos;') /* The 4 other predefined entities, required. */
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\r\n/g, preserveCR) /* Must be before the next replacement. */
			.replace(/[\r\n]/g, preserveCR);
	}
}

class TemplateLiteral {
	$$templateLiteral = true;

	constructor(strings, ...keys) {
		let result = [];
		for (let i = 0; i < strings.length; i++) {
			result.push(strings[i].trim());

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
	return () => string;
};

export { html, unsafeHTML };
