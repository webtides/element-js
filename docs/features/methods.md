
### Methods

Besides public properties you can also shape the API for your element with public methods.

```javascript
import {BaseElement, defineElement} from '@webtides/element-js';

export class ModalElement extends BaseElement {
	open() {
		// do the things to actually open the modal…
	}
}

defineElement('modal-element', ModalElement);
```

```javascript
import {BaseElement, defineElement} from '@webtides/element-js';

export class OtherElement extends BaseElement {
	events() {
		return {
			this: {
				click: () => {
					this.$refs.modal.open();
				}
			}
		};
	}
}

defineElement('other-element', OtherElement);
```
