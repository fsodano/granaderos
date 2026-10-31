import type { TacticalPoint } from './public/compatibility-types.ts';

type SurfacePoint = Pick<TacticalPoint, 'tacticalLevel'>;
const level = (point: SurfacePoint | null | undefined) =>
  point?.tacticalLevel === undefined ? 0 : point.tacticalLevel;

export const spaceKey = (point: TacticalPoint) => `${level(point)}:${point.x},${point.y}`;
export const sameSurface = (
  a: SurfacePoint | null | undefined,
  b: SurfacePoint | null | undefined,
) => level(a) === level(b);
export const sameCell = (a: TacticalPoint, b: TacticalPoint) =>
  sameSurface(a, b) && a.x === b.x && a.y === b.y;
export const spacePoint = (point: TacticalPoint) => ({
  x: point.x,
  y: point.y,
  tacticalLevel: level(point),
});
