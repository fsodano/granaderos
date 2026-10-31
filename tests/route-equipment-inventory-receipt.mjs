import assert from 'node:assert/strict';

export function assertRouteEquipmentDebit(before, after, source) {
  const selected = before.entries.find((row) => row.key === source.key);
  assert.equal(selected?.expected, source.expected);
  assert.equal(selected.count, source.count);
  // Exhausting a container stack reuses its array key. Compare the complete
  // current stock, with only the selected stack's real one-item debit.
  const stock = (model, debitKey = null) =>
    model.entries
      .flatMap((row) => {
        const stack = JSON.parse(row.expected);
        if (row.key === debitKey) {
          stack.count--;
        }
        return stack.count > 0
          ? [
              JSON.stringify({
                kind: row.kind,
                x: row.x,
                y: row.y,
                tacticalLevel: row.tacticalLevel,
                stack,
              }),
            ]
          : [];
      })
      .sort();
  assert.deepEqual(
    stock(after),
    stock(before, source.key),
    'the selected finite item must debit once while all other stock retains its metadata, quantity and location',
  );
  return source.count - 1;
}
