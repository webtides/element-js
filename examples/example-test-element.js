import { defineElement } from '../src/BaseElement';
// import { TemplateElement, html } from '../src/TemplateElement';
import { TemplateElement, html } from '../src/renderer/vanilla/TemplateElement.js';

class ExampleTestElement extends TemplateElement {
	constructor() {
		super();
	}

	properties() {
		return {
			count: 1,
			foo: '',
			bar: '',
			text: '',
		};
	}

	template() {
		const list = [];
		for (let i = 0; i < this.count; i++) {
			list.push(i);
		}
		/*<div class="test">
			${list.map(
				(item) =>
					html`
						<div index="${item}">${this.text}</div>
						<div>${item}</div>
					`,
			)}
		</div>*/
		const p = document.createElement('p');
		p.textContent = 'DOM Element';
		// TODO: the nested TemplateResult ist not parsed or updated correctly
		// it has a fragment, but no strings in ChildNodePart.parseTemplateResult()
		// but the fragment only has the comment markers in it...
		// there is probably a call to update missing?! or the fragment has to be parsed again?!
		// but i think it is rather a missing call to update.
		return html`
			<div class="test2">
				${[1, 'Text', html`<span>Foo</span>`, () => 'Function', p].map((item) => html` <div>${item}</div> `)}
			</div>
		`;
	}
}
defineElement('example-test-element', ExampleTestElement);
