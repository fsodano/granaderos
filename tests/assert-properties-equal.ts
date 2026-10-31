import assert from 'node:assert/strict';

/** Compare the selected runtime properties, including explicit undefined values. */
export function assertPropertiesEqual(
  actual: object,
  expected: object,
  keys: readonly string[],
  message = '',
): void {
  for (const key of keys) {
    assert.deepEqual(Reflect.get(actual, key), Reflect.get(expected, key), message + key);
  }
}
