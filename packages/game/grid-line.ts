import type { TacticalPoint } from './public/compatibility-types.ts';
export function gridLine(a: TacticalPoint, b: TacticalPoint): TacticalPoint[] {
  const points = [];
  let x = Math.round(a.x),
    y = Math.round(a.y);
  const endX = Math.round(b.x),
    endY = Math.round(b.y);
  if (![x, y, endX, endY].every(Number.isSafeInteger)) {
    throw new RangeError('Invalid sight coordinates');
  }
  const dx = Math.abs(endX - x),
    dy = Math.abs(endY - y),
    sx = x < endX ? 1 : -1,
    sy = y < endY ? 1 : -1;
  let err = dx - dy;
  while (x !== endX || y !== endY) {
    const e = 2 * err;
    if (e > -dy) {
      err -= dy;
      x += sx;
    }
    if (e < dx) {
      err += dx;
      y += sy;
    }
    points.push({ x, y });
  }
  return points;
}
