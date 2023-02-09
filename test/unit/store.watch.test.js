/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { Store } from '../../src/util/Store';

class WatchStore extends Store {
	echoCount = -1;
	echoOldCount = -1;
	triggerCount = 0;
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
				this.triggerCount++;
			},
		};
	}
}

describe('store-watch', () => {
	it('watches changes on store properties and calls callbacks', async () => {
		const watchStore = new WatchStore({ count: 0 });
		assert.equal(watchStore.count, 0);
		assert.equal(watchStore.echoCount, -1);
		watchStore.count++;
		assert.equal(watchStore.count, 1);
		assert.equal(watchStore.echoCount, 1);
		assert.equal(watchStore.echoOldCount, 0);
	});

	it('watches changes on store properties and calls callbacks only if the value did actually change', async () => {
		const watchStore = new WatchStore({ count: 0 });
		assert.equal(watchStore.triggerCount, 0);
		watchStore.count = 1;
		assert.equal(watchStore.triggerCount, 1);
		// this should not trigger the watcher as the value is not changed
		watchStore.count = 1;
		assert.equal(watchStore.triggerCount, 1);
		// this should trigger the watcher as the value is changed
		watchStore.count = 2;
		assert.equal(watchStore.triggerCount, 2);
	});
});
