import assert from 'node:assert/strict';

/** Fail at the missing fixture value before reading its fields. */
export function present<T>(
  value: T,
  message = 'Expected the test fixture value to exist.',
): NonNullable<T> {
  if (value === null || value === undefined) {
    assert.fail(message);
  }
  return value;
}
