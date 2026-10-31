/** Check array shape without discarding the caller's element type. */
export function isArrayValue(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
