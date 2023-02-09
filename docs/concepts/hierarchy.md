
### Element Hierarchy

Pleas keep in mind that lifecycles _do not_ wait for child elements to be connected or updated/rendered.

In the example below we have a simple hierarchy of elements.

```html

<a-element>
	<b-element>
		<c-element></c-element>
	</b-element>
</a-element>
```

The full lifecycle would be as follows:

1. a-element -> connected()
2. b-element -> connected()
3. c-element -> connected()

This loading/connecting behaviour is compliant with how other (normal) DOM elements are loaded and connected.

#### Example

In the example we render a clock and update the time every second.

```javascript
import {TemplateElement, defineElement, html} from '@webtides/element-js';

export class ClockElement extends TemplateElement {
	timer = null;

	properties() {
		return {
			time: Date.now()
		};
	}

	connected() {
		this.timer = window.setInterval(() => {
			this.time = Date.now();
		}, 1000);
	}

	disconnected() {
		window.clearInterval(this.timer);
	}

	get formattedTime() {
		return new Date(this.time).toLocaleTimeString();
	}

	template() {
		return html` <span>${this.formattedTime}</span> `;
	}
}

defineElement('clock-element', ClockElement);
```
