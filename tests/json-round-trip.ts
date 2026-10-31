import assert from 'node:assert/strict';

function assertSameFixture<Value>(actual: unknown, expected: Value): asserts actual is Value {
  assert.deepEqual(actual, expected, 'JSON serialization must preserve the complete fixture.');
}

export function jsonRoundTrip<Value>(fixture: Value): Value {
  const restored: unknown = JSON.parse(JSON.stringify(fixture));
  assertSameFixture(restored, fixture);
  return restored;
}
