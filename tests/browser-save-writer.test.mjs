import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSaveWriter, SaveWriterMessages } from '../web/lib/browser-save-writer.ts';

function lockManager() {
  const owners = new Set();
  return {
    request(name, options, callback) {
      assert.equal(options.ifAvailable, true);
      assert.equal(options.mode, 'exclusive');
      if (owners.has(name)) return Promise.resolve(callback(null));
      owners.add(name);
      return Promise.resolve(callback({ name })).finally(() => owners.delete(name));
    },
  };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

test('one browser tab owns each save key and a closed owner permits explicit retry', async () => {
  const locks = lockManager();
  const writes = [];
  const refusals = [];
  const first = new BrowserSaveWriter(locks, (key, text) => writes.push({ key, text }));
  const second = new BrowserSaveWriter(locks, (key, text) => writes.push({ key, text }));
  first.claim('campaign', () => first.write('campaign', 'first'), assert.fail);
  second.claim(
    'campaign',
    () => assert.fail('second writer admitted'),
    (message) => refusals.push(message),
  );
  assert.equal(first.owns('campaign'), true);
  assert.equal(second.owns('campaign'), false);
  assert.deepEqual(refusals, [SaveWriterMessages.occupied]);
  assert.throws(() => second.write('campaign', 'overwrite'));
  first.close();
  await settled();
  second.claim('campaign', () => second.write('campaign', 'resumed'), assert.fail);
  assert.deepEqual(writes, [
    { key: 'campaign', text: 'first' },
    { key: 'campaign', text: 'resumed' },
  ]);
  second.close();
});

test('unsupported coordination preserves progress and refuses automatic storage writes', () => {
  const writer = new BrowserSaveWriter(undefined, assert.fail);
  const messages = [];
  writer.claim('campaign', assert.fail, (message) => messages.push(message));
  assert.deepEqual(messages, [SaveWriterMessages.unavailable]);
  assert.throws(() => writer.write('campaign', 'save'));
  writer.close();
});
