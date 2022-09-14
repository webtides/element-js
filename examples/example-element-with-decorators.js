import { TemplateElement, html } from '../src/renderer/vanilla';
import { element, event, model, ReactiveModel, property, query, queryAll } from '../src/decorators';
//import style from './example-element-with-decorators.css' assert { type: 'css' };

class MouseModel extends ReactiveModel {
	pos = { x: 0, y: 0 };

	_onMouseMove = ({clientX, clientY}) => {
		this.pos = {x: clientX, y: clientY};
		this.requestUpdate();
	};

	constructor(controller) {
		super();
		if (controller) {
			this.addController(controller);
		}
	}

	controllerConnected() {
		window.addEventListener('mousemove', this._onMouseMove);
	}

	controllerDisconnected() {
		window.removeEventListener('mousemove', this._onMouseMove);
	}
}

class MatchMediaModel extends ReactiveModel {
	_mediaQueryList;
	_changeCallback;
	matches;

	constructor(mediaQueryString, changeCallback, controller) {
		super(controller);
		this._changeCallback = changeCallback;
		this._mediaQueryList = window.matchMedia(mediaQueryString);
	}

	_onMatchMedia = (e) => {
		if (this._changeCallback) {
			this._changeCallback(e);
		}
		this.matches = e.matches;
		this.requestUpdate();
	};

	controllerConnected() {
		this.matches = this._mediaQueryList.matches;
		this.requestUpdate();
		this._mediaQueryList.addEventListener('change', this._onMatchMedia);
	}

	controllerDisconnected() {
		this._mediaQueryList.removeEventListener('change', this._onMatchMedia);
	}
}

const style = `
	example-element-with-decorators {
		display: block;
		background: gray;
		color: white;
		padding: 16px;
	}

	example-element-with-decorators .is-selected {
		color: black;
	}
`;

@element({
	name: 'example-element-with-decorators',
	styles: [style],
})
class ExampleElement extends TemplateElement {
	@property({ reflect: true }) accessor name = 'World';

	@model() mouse = new MouseModel();
	@model() isMobile = new MatchMediaModel('(max-width: 600px)', (e) => {
		console.log('isMobile changed', e);
	});

	@query('p') element;
	@queryAll('li') listItems;

	// TODO: add @event ?! https://stenciljs.com/docs/events#event-decorator
	// @event() nameChanged = new NameChangedEvent();

	connected() {
		console.log('connected', this.element, this.listItems);
	}

	watch() {
		return {
			name: (name) => {
				//this.nameChanged.dispatch({ name });
			}
		}
	}

	template() {
		return html`
			<p>Hello, ${this.name}!</p>
			<ul><li>Item 1</li><li>Item 2</li></ul>
			<div>The mouse is at:</div>
			<pre>
				x: ${this.mouse.pos.x}
				y: ${this.mouse.pos.y}
		  	</pre>
			<div>${this.isMobile.matches ? 'is mobile' : 'is not mobile'}</div>
		`;
	}
}

export { ExampleElement };
