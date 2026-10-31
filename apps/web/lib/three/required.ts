/** An authored rig or sampled geometry must supply every named part used by its solver. */
export function required<Value>(
  value: Value | null | undefined,
  part = 'rig geometry',
): Value {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${part}`);
  }
  return value;
}
