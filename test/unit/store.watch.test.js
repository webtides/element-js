/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { Store } from '../../src/util/Store';

class WatchStore extends Store {
	echoCount = -1;
	echoOldCount = -1;
	properties() {
		return {
			count: 0,
		};
	}
	watch() {
		return {
			count: (newCount, oldCount) => {
				this.echoCount = newCount;
				this.echoOldCount = oldCount;
			},
		};
	}
}

const watchStore = new WatchStore({ count: 0 });

describe('store-watch', () => {
	it('wtaches changes on store properties and calls callbacks', async () => {
		assert.equal(watchStore.count, 0);
		assert.equal(watchStore.echoCount, -1);
		watchStore.count++;
		assert.equal(watchStore.count, 1);
		assert.equal(watchStore.echoCount, 1);
		assert.equal(watchStore.echoOldCount, 0);
	});
});
