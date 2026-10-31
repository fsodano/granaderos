import type {
  BattleSnapshot,
  BattleUnit,
  TacticalPoint,
  TacticalAction,
} from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
import { getReachable, teamCanSee, stanceCost, lookPreview } from '../packages/game/tactical.js';
import { sameSurface, spacePoint, spaceKey } from '../packages/game/tactical-space.js';

const distance = (a: TacticalPoint, b: TacticalPoint) => Math.hypot(a.x - b.x, a.y - b.y);
// Search public map quadrants after the initial reconnaissance. A quiet enemy
// outside the original sector-center route must not be treated as eliminated.
// Neither the goal nor the perceived occupancy reads hidden enemy positions.
export function sectorSearchGoal(battle: BattleSnapshot): TacticalPoint {
  const corners = [
    [0.75, 0.75],
    [0.75, 0.25],
    [0.25, 0.25],
    [0.25, 0.75],
  ];
  const corner = corners[Math.floor(Math.max(0, battle.turn - 20) / 8) % corners.length];
  return {
    x: Math.floor(battle.width * present(present(corner)[0])),
    y: Math.floor(battle.height * present(present(corner)[1])),
    tacticalLevel: 0,
  };
}
export function sectorSearchOrder(battle: BattleSnapshot, unit: BattleUnit): TacticalAction | null {
  if (
    battle.turn < 20 ||
    battle.phase === 'interrupt' ||
    battle.units.some(
      (other) =>
        other.side !== unit.side &&
        other.hp >= 15 &&
        !other.departure &&
        !other.routed &&
        !other.unconscious &&
        !other.surrendered &&
        teamCanSee(battle, unit.side, other),
    )
  ) {
    return null;
  }
  if (unit.stance !== 'standing') {
    return unit.ap >= stanceCost(unit, 'standing')
      ? { type: 'stance', unitId: unit.id, stance: 'standing' }
      : null;
  }
  const goal = sectorSearchGoal(battle),
    view = {
      ...battle,
      units: battle.units.filter(
        (other) => other.side === unit.side || teamCanSee(battle, unit.side, other),
      ),
      npcs: battle.npcs.filter((other) => teamCanSee(battle, unit.side, other)),
    };
  if (sameSurface(unit, goal) && distance(unit, goal) <= 3) {
    const offsets = [
        [0, -4],
        [4, -4],
        [4, 0],
        [4, 4],
        [0, 4],
        [-4, 4],
        [-4, 0],
        [-4, -4],
      ],
      offset = offsets[battle.turn % offsets.length];
    const point = {
      x: Math.max(0, Math.min(battle.width - 1, unit.x + present(present(offset)[0]))),
      y: Math.max(0, Math.min(battle.height - 1, unit.y + present(present(offset)[1]))),
      tacticalLevel: unit.tacticalLevel ?? 0,
    };
    return lookPreview(battle, unit, point).valid
      ? { type: 'look', unitId: unit.id, ...point }
      : null;
  }
  const route = getReachable({ ...view, mode: 'exploration' }, unit, {
    stopAt: (point) => sameSurface(point, goal) && distance(point, goal) <= 2,
  })[0];
  const reachable = new Map(getReachable(view, unit).map((point) => [spaceKey(point), point]));
  const step = [...(route?.path ?? [])]
    .reverse()
    .map((point) => reachable.get(spaceKey(point)))
    .find((point) => point && point.cost > 0 && point.cost <= Math.min(32, unit.ap - 20));
  return step ? { type: 'move', unitId: unit.id, ...spacePoint(step) } : null;
}
