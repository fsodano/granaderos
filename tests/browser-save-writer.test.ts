import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSaveWriter, SaveWriterMessages } from '../apps/web/lib/browser-save-writer.ts';

function lockManager(): Pick<LockManager, 'request'> {
  const owners = new Set<string>();
  return {
    request<T>(
      name: string,
      optionsOrCallback: LockOptions | LockGrantedCallback<T>,
      suppliedCallback?: LockGrantedCallback<T>,
    ): Promise<T> {
      const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
      const callback =
        typeof optionsOrCallback === 'function' ? optionsOrCallback : suppliedCallback;
      assert.ok(callback);
      assert.equal(options.ifAvailable, true);
      assert.equal(options.mode, 'exclusive');
      if (owners.has(name)) {
        return Promise.resolve(callback(null));
      }
      owners.add(name);
      return Promise.resolve(callback({ name, mode: 'exclusive' })).finally(() =>
        owners.delete(name),
      );
    },
  };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

void test('one browser tab owns each save key and a closed owner permits explicit retry', async () => {
  const locks = lockManager();
  const writes: { key: string; text: string }[] = [];
  const refusals: string[] = [];
  const first = new BrowserSaveWriter(locks, (key, text) => writes.push({ key, text }));
  const second = new BrowserSaveWriter(locks, (key, text) => writes.push({ key, text }));
  first.claim(
    'campaign',
    () => first.write('campaign', 'first'),
    (message) => assert.fail(message),
  );
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
  second.claim(
    'campaign',
    () => second.write('campaign', 'resumed'),
    (message) => assert.fail(message),
  );
  assert.deepEqual(writes, [
    { key: 'campaign', text: 'first' },
    { key: 'campaign', text: 'resumed' },
  ]);
  second.close();
});

void test('unsupported coordination preserves progress and refuses automatic storage writes', () => {
  const writer = new BrowserSaveWriter(undefined, () => assert.fail('Unexpected storage write'));
  const messages: string[] = [];
  writer.claim(
    'campaign',
    () => assert.fail('Unexpected ownership'),
    (message) => messages.push(message),
  );
  assert.deepEqual(messages, [SaveWriterMessages.unavailable]);
  assert.throws(() => writer.write('campaign', 'save'));
  writer.close();
});
