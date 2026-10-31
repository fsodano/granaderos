import { present } from './assert-present.ts';
import type { BattleSnapshot, BattleUnit, TacticalAction, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import { cautiousCombatOrder } from './cautious-driver.ts';
import { getReachable, teamCanSee } from '../packages/game/tactical.js';
import { spacePoint } from '../packages/game/tactical-space.js';

// This route uses a reserve commander, not the usual test policy that keeps
// mission allies fixed in the firing line. The waypoint is west of the authored
// convent. Only ordinary paid orders reach the real battle reducer.
export function sanLorenzoCombatOrder(battle: BattleSnapshot, unit: BattleUnit): TacticalAction | null {
  if (!unit.missionAlly || battle.turn >= 5) {
    // Remove only the controller's special hold-position preference. The actual
    // actor retains mission allegiance, costs, health and equipment in the reducer.
    return cautiousCombatOrder(battle, unit.missionAlly ? { ...unit, missionAlly: false } : unit);
  }
  const shelter = { x: 26, y: 23 };
  const distance = (point: TacticalPoint) => Math.hypot(point.x - shelter.x, point.y - shelter.y);
  if (distance(unit) < 3) {
    return null;
  }
  if (unit.knockedDown || unit.entangled) {
    return cautiousCombatOrder(battle, unit);
  }
  const known = {
    ...battle,
    units: battle.units.filter(
      (other) => other.side === unit.side || teamCanSee(battle, unit.side, other),
    ),
  };
  const options = getReachable(known, unit)
    .filter(
      (point) =>
        point.cost > 0 && point.cost <= Math.min(40, unit.ap) && distance(point) < distance(unit),
    )
    .sort((a, b) => distance(a) - distance(b) || a.cost - b.cost);
  return options.length ? { type: 'move', unitId: unit.id, ...spacePoint(present(options[0])) } : null;
}
