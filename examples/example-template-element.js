import { defineElement } from '../src/BaseElement';
// import { TemplateElement, html } from '../src/TemplateElement';
import { TemplateElement, html } from '../src/renderer/vanilla/TemplateElement.js';
// import { TemplateElement, html } from '../src/renderer/uhtml/TemplateElement.js';

function _random(max) {
	return Math.round(Math.random() * 1000) % max;
}

class Store {
	constructor() {
		this.data = [];
		this.backup = null;
		this.selected = null;
		this.id = 1;
	}
	buildData(count = 1000) {
		var adjectives = [
			'pretty',
			'large',
			'big',
			'small',
			'tall',
			'short',
			'long',
			'handsome',
			'plain',
			'quaint',
			'clean',
			'elegant',
			'easy',
			'angry',
			'crazy',
			'helpful',
			'mushy',
			'odd',
			'unsightly',
			'adorable',
			'important',
			'inexpensive',
			'cheap',
			'expensive',
			'fancy',
		];
		var colours = [
			'red',
			'yellow',
			'blue',
			'green',
			'pink',
			'brown',
			'purple',
			'brown',
			'white',
			'black',
			'orange',
		];
		var nouns = [
			'table',
			'chair',
			'house',
			'bbq',
			'desk',
			'car',
			'pony',
			'cookie',
			'sandwich',
			'burger',
			'pizza',
			'mouse',
			'keyboard',
		];
		var data = [];
		for (var i = 0; i < count; i++)
			data.push({
				id: this.id++,
				label:
					adjectives[_random(adjectives.length)] +
					' ' +
					colours[_random(colours.length)] +
					' ' +
					nouns[_random(nouns.length)],
			});
		return data;
	}
	updateData(mod = 10) {
		for (let i = 0; i < this.data.length; i += 10) {
			this.data[i].label += ' !!!';
			// this.data[i] = Object.assign({}, this.data[i], {label: this.data[i].label +' !!!'});
		}
	}
	delete(id) {
		const idx = this.data.findIndex((d) => d.id == id);
		this.data = this.data.filter((e, i) => i != idx);
		//return this;
	}
	run(count = 1000) {
		this.data = this.buildData(count);
		this.selected = null;
	}
	add() {
		this.data = this.data.concat(this.buildData(1000));
		this.selected = null;
	}
	update() {
		this.updateData();
		this.selected = null;
	}
	select(id) {
		this.selected = id;
	}
	hideAll() {
		this.backup = this.data;
		this.data = [];
		this.selected = null;
	}
	showAll() {
		this.data = this.backup;
		this.backup = null;
		this.selected = null;
	}
	runLots() {
		this.data = this.buildData(10000);
		this.selected = null;
	}
	clear() {
		this.data = [];
		this.selected = null;
	}
	swapRows() {
		if (this.data.length > 998) {
			var a = this.data[1];
			this.data[1] = this.data[998];
			this.data[998] = a;
		}
	}
}

class ExampleTemplateElement extends TemplateElement {
	constructor() {
		super();
		this.store = new Store();
	}

	properties() {
		return {
			data: [],
			selected: null,
		};
	}

	events() {
		return {
			this: {
				click: (e) => {
					if (e.target.matches('#add')) {
						this.store.add();
					} else if (e.target.matches('#run')) {
						const count = e.target.dataset.count ? parseInt(e.target.dataset.count) : 1000;
						this.store.run(count);
					} else if (e.target.matches('#update')) {
						this.store.update();
					} else if (e.target.matches('#runlots')) {
						this.store.runLots();
					} else if (e.target.matches('#clear')) {
						this.store.clear();
					} else if (e.target.matches('#swaprows')) {
						this.store.swapRows();
					} else if (e.target.matches('.remove')) {
						const tr = e.target.closest('tr');
						const id = parseInt(tr.id);
						this.store.delete(id);
					} else if (e.target.matches('.select')) {
						const tr = e.target.closest('tr');
						const id = parseInt(tr.id);
						this.store.select(id);
					}
					e.preventDefault();
					this.data = this.store.data;
					this.selected = this.store.selected;
					this.requestUpdate();
				},
			},
		};
	}

	template() {
		return html`
			<div class="container">
				<div class="flex flex-wrap bg-gray-300 p-4 gap-4">
					<button type="button" class="btn" id="run" data-count="10">Create 10 rows</button>
					<button type="button" class="btn" id="run" data-count="100">Create 100 rows</button>
					<button type="button" class="btn" id="run" data-count="1000">Create 1,000 rows</button>
					<button type="button" class="btn" id="runlots">Create 10,000 rows</button>
					<button type="button" class="btn" id="add">Append 1,000 rows</button>
					<button type="button" class="btn" id="update">Update every 10th row</button>
					<button type="button" class="btn" id="swaprows">Swap Rows</button>
					<button type="button" class="btn" id="clear">Clear</button>
				</div>
				<table class="min-w-full divide-y divide-gray-300">
					<tbody class="divide-y divide-gray-200 bg-white">
						${this.data.map(
							(item) => html` <tr
								id=${item.id}
								class="${this.selected === item.id ? 'bg-purple-200' : 'bg-white even:bg-gray-100'}"
							>
								<td class="whitespace-nowrap px-3 py-2 text-sm text-gray-500">${item.id}</td>
								<td class="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
									<a class="select block w-full hover:cursor-pointer hover:underline"
										>${item.label}</a
									>
								</td>
								<td data-interaction="delete" class="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
									<btn
										class="remove inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-300 hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-300 hover:cursor-pointer"
									>
										<span class="glyphicon glyphicon-remove pointer-events-none" aria-hidden="true"
											>x</span
										>
									</btn>
								</td>
							</tr>`,
						)}
					</tbody>
				</table>
			</div>
		`;
	}
}
defineElement('example-template-element', ExampleTemplateElement);
