import type { TacticalPoint } from './public/compatibility-types.ts';
export interface RayInterval { entry: number; exit: number }
export interface RayVolume { kind: string; bounds?: { minX: number; maxX: number; minY: number; maxY: number } }
const epsilon = 1e-10;
// Intersect a sloping ray with a vertical interval inside one crossed column.
// A same-column vertical shot follows the same finite arithmetic.
export function rayHeightIntersection(muzzle: number, destination: number, cell: RayInterval, bottom: number, top: number, stopFraction = 1) {
  if (![muzzle, destination, bottom, top, stopFraction].every(Number.isFinite)) {
    return null;
  }
  let entry = Math.max(0, cell.entry),
    exit = Math.min(stopFraction, cell.exit, 1);
  if (exit < entry - epsilon) {
    return null;
  }
  const rise = destination - muzzle;
  if (Math.abs(rise) < epsilon) {
    return muzzle >= bottom - epsilon && muzzle <= top + epsilon ? { entry, exit } : null;
  }
  const first = (bottom - muzzle) / rise,
    last = (top - muzzle) / rise;
  entry = Math.max(entry, Math.min(first, last));
  exit = Math.min(exit, Math.max(first, last));
  return exit >= entry - epsilon ? { entry, exit } : null;
}

// A wall occupies a thin face at a cell boundary. Clip the horizontal ray to
// that face before testing height; its incident cells remain usable floors.
// Other cover keeps its existing cell-wide geometry and corner conventions.
export function volumeRayCell<T extends RayInterval>(source: TacticalPoint, destination: TacticalPoint, cell: T, volume: RayVolume): T | null {
  if (volume.kind !== 'edge' || !volume.bounds) {
    return cell;
  }
  let entry = cell.entry,
    exit = cell.exit;
  for (const [axis, min, max] of [
    ['x', 'minX', 'maxX'],
    ['y', 'minY', 'maxY'],
  ] as const) {
    const start = source[axis],
      delta = destination[axis] - start;
    if (Math.abs(delta) < epsilon) {
      if (start < volume.bounds[min] - epsilon || start > volume.bounds[max] + epsilon) {
        return null;
      }
      continue;
    }
    const first = (volume.bounds[min] - start) / delta,
      last = (volume.bounds[max] - start) / delta;
    entry = Math.max(entry, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
    if (exit < entry - epsilon) {
      return null;
    }
  }
  return { ...cell, entry, exit };
}

