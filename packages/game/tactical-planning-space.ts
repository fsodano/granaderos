import { sameSurface, tacticalLevel } from './tactical-space.js';
import type {
  BattleSnapshot,
  BattleUnit,
  MoveAction,
  TacticalPoint,
} from './public/compatibility-types.ts';

// Keep flat reports unchanged; elevated orders must name ground level explicitly.
export const planningPoint = (point: TacticalPoint, elevated = false): TacticalPoint => ({
  x: point.x,
  y: point.y,
  ...(elevated || point.tacticalLevel !== undefined ? { tacticalLevel: tacticalLevel(point) } : {}),
});
export const moveOrder = (
  state: Pick<BattleSnapshot, 'upperSurfaces'>,
  unit: Pick<BattleUnit, 'id'>,
  destination: TacticalPoint,
  extra: Partial<Pick<MoveAction, 'movement' | 'movementIntent' | 'conversationTargetId'>> = {},
): MoveAction => ({
  type: 'move',
  unitId: unit.id,
  ...planningPoint(destination, Boolean(state.upperSurfaces?.length)),
  ...extra,
});
export const atHand = (a: TacticalPoint, b: TacticalPoint, range = 1.5): boolean =>
  sameSurface(a, b) && Math.hypot(a.x - b.x, a.y - b.y) <= range;
