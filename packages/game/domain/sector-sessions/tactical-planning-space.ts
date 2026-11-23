import { sameSurface, tacticalLevel } from './tactical-space.ts';

// The plan's inputs and the order it produces are serialized compatibility
// shapes. The domain may not import that projection, so the fields this module
// reads and produces are declared here.
/** A point a plan names: its coordinates, and its ground level when the order states it. */
export type PlanningPoint = Readonly<{
  x: number;
  y: number;
  tacticalLevel?: number;
}>;

/** The battlefield details a plan reads. Only the presence of upper surfaces matters here. */
export type PlanningField = Readonly<{
  upperSurfaces?: readonly unknown[] | undefined;
}>;

/** The combatant an order names. Only its identity matters here. */
export type PlanningCombatant = Readonly<{ id: string | number }>;

/** The serialized move order the runtime stores in its action log. */
export type MoveOrder = Readonly<{
  type: 'move';
  unitId: string | number;
  x: number;
  y: number;
  tacticalLevel?: number;
  movement?: 'walk' | 'run' | 'crouch' | 'prone';
  movementIntent?: 'forward' | 'preserveFacing';
  conversationTargetId?: string;
}>;

export type MoveOrderExtras = Partial<
  Readonly<Pick<MoveOrder, 'movement' | 'movementIntent' | 'conversationTargetId'>>
>;

// Keep flat reports unchanged; elevated orders must name ground level explicitly.
export const planningPoint = (point: PlanningPoint, elevated = false): PlanningPoint => ({
  x: point.x,
  y: point.y,
  ...(elevated || point.tacticalLevel !== undefined ? { tacticalLevel: tacticalLevel(point) } : {}),
});

export const moveOrder = (
  state: PlanningField,
  unit: PlanningCombatant,
  destination: PlanningPoint,
  extra: MoveOrderExtras = {},
): MoveOrder => ({
  type: 'move',
  unitId: unit.id,
  ...planningPoint(destination, Boolean(state.upperSurfaces?.length)),
  ...extra,
});

export const atHand = (a: PlanningPoint, b: PlanningPoint, range = 1.5): boolean =>
  sameSurface(a, b) && Math.hypot(a.x - b.x, a.y - b.y) <= range;
