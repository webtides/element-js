import { defineElement } from '../src/BaseElement.js';
import { TemplateElement, html } from '../src/TemplateElement.js';
import { choose, classMap, styleMap, when, unsafeHTML, spreadAttributes } from '../src/dom-parts/directives.js';

class ExampleDirectives extends TemplateElement {
	properties() {
		return {
			enabled: true,
			hidden: true,
			choose: 'home',
			array: [1, 2, 3, 4],
		};
	}

	template() {
		const classes = { 'text-blue-500': this.enabled, hidden: false };
		const styles = { 'background-color': this.enabled ? 'blue' : 'gray', color: 'white' };
		return html`
			<div class="p-4">
				<h2 class="text-3xl mb-2">Directives</h2>
				<div>classMap:</div>
				<div class="${classMap(classes)}">I'm supposed to be blue on white</div>
				<div>styleMap:</div>
				<div style="${styleMap(styles)}">I'm supposed to be white on blue</div>
				<div>when:</div>
				<div>${when(this.enabled, html`<span>is enabled</span>`)}</div>
				<div>${when(this.enabled, 'is enabled', 'in not enabled')}</div>
				<div ${when(this.hidden, 'hidden')}></div>
				<div>choose:</div>
				<div>
					${choose(this.choose, {
						home: html`<div>
							<header>Home</header>
							<main>Home</main>
							<footer>Home</footer>
						</div>`,
						about: html`<div>
							<header>About</header>
							<main>About</main>
							<footer>About</footer>
						</div>`,
					})}
				</div>
				<div>safeHTML:</div>
				<div>${`<p>I'm supposed to be escaped</p>`}</div>
				<div>unsafeHTML:</div>
				<div>${unsafeHTML`<p>I'm supposed to be parsed as HTML</p>`}</div>
				<div>spreadAttributes:</div>
				<div
					${spreadAttributes({
						string: 'string',
						number: 13,
						boolean: true,
						list: [1, '2', 3],
						map: { foo: 'bar' },
						camelToDash: 'automagically',
					})}
				></div>
				<div>map:</div>
				<ul>
					${this.array.map((item) => html`<li>mapped item: ${item}</li>`)}
				</ul>
			</div>
		`;
	}
}
defineElement('example-directives', ExampleDirectives);
