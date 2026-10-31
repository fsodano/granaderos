import type { BattleSnapshot, BattleUnit, TacticalAction } from '../packages/game/public/compatibility-types.ts';
import { tucumanCombatOrder } from './tucuman-driver.ts';
import { actBattle, getReachable, teamCanSee, stanceCost } from '../packages/game/tactical.js';
import { sameSurface, spacePoint, spaceKey } from '../packages/game/tactical-space.js';
import { usefulRouteFiringPosture } from './route-infantry-progress.ts';

// A flanking column must follow the road around a cliff rather than require
// every short bound to reduce straight-line distance to the sector center.
// Keep normal fire, finite aid and reload orders before an ordinary paid bound.
export function losPatosFlankOrder(battle: BattleSnapshot, unit: BattleUnit): TacticalAction | null {
  const normal = tucumanCombatOrder(battle, unit);
  if (normal && usefulRouteFiringPosture(battle, unit, normal)) {
    return normal;
  }
  if (
    unit.hp < 15 ||
    unit.routed ||
    unit.unconscious ||
    unit.knockedDown ||
    unit.entangled ||
    unit.departure ||
    unit.fled ||
    battle.phase === 'interrupt'
  ) {
    return null;
  }
  const waypoint = {
    x: Math.floor(battle.width * 0.65),
    y: Math.floor(battle.height * 0.5),
    tacticalLevel: 0,
  };
  const contacts = battle.units.filter(
    (other) =>
      other.side !== unit.side &&
      other.hp >= 15 &&
      !other.departure &&
      !other.routed &&
      !other.unconscious &&
      !other.surrendered &&
      teamCanSee(battle, unit.side, other),
  );
  // An actual shared contact takes precedence over the scouting waypoint.
  // Keep that same public goal after leaving the center, avoiding a return
  // bound toward the old waypoint while the contact remains in sight.
  const goal =
    contacts.sort(
      (a, b) => Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y),
    )[0] ?? waypoint;
  if (sameSurface(unit, goal) && Math.hypot(unit.x - goal.x, unit.y - goal.y) <= 2) {
    return null;
  }
  if (unit.stance !== 'standing') {
    return unit.ap >= stanceCost(unit, 'standing')
      ? { type: 'stance', unitId: unit.id, stance: 'standing' }
      : null;
  }
  const view = {
    ...battle,
    units: battle.units.filter(
      (other) => other.side === unit.side || teamCanSee(battle, unit.side, other),
    ),
    npcs: battle.npcs.filter((other) => teamCanSee(battle, unit.side, other)),
  };
  const route = getReachable({ ...view, mode: 'exploration' }, unit, {
    stopAt: (point) =>
      sameSurface(point, goal) && Math.hypot(point.x - goal.x, point.y - goal.y) <= 2,
  })[0];
  const reachable = new Map(getReachable(view, unit).map((point) => [spaceKey(point), point]));
  const step = [...(route?.path ?? [])]
    .reverse()
    .map((point) => reachable.get(spaceKey(point)))
    .find((point) => point && point.cost > 0 && point.cost <= Math.min(40, unit.ap - 20));
  if (!step) {
    return null;
  }
  const action: TacticalAction = { type: 'move', unitId: unit.id, ...spacePoint(step) };
  return actBattle(battle, action).lastError ? null : action;
}
