import type { BattleSnapshot, BattleUnit, TacticalAction } from '../packages/game/public/compatibility-types.ts';
// Keep the crew at its battery after contact; use only shared visible targets.
import { chooseArtilleryAction } from '../packages/game/tactical-ai-artillery.ts';
import { teamCanSee, getReachable, stanceCost } from '../packages/game/tactical.js';
import { tucumanCombatOrder } from './tucuman-driver.ts';
import { batteryOrder } from './advancing-battery-driver.ts';
export function holdBatteryOrder(b: BattleSnapshot, u: BattleUnit): TacticalAction | null {
  const care = tucumanCombatOrder(b, u);
  if (care?.type === 'useItem' || (care && 'slot' in care ? care.slot : undefined) === 'medical') {
    return care;
  }
  const targets = b.units.filter(
    (v) =>
      v.side !== u.side &&
      v.hp >= 15 &&
      !v.departure &&
      !v.unconscious &&
      !v.surrendered &&
      !v.routed &&
      teamCanSee(b, u.side, v),
  );
  if (b.mode === 'combat' && u.stance === 'standing' && u.ap >= stanceCost(u, 'crouched')) {
    return { type: 'stance', unitId: u.id, stance: 'crouched' };
  }
  const view = {
    ...b,
    units: b.units.filter((v) => v.side === u.side || teamCanSee(b, u.side, v)),
  };
  const a = chooseArtilleryAction(b, u, targets, () => getReachable(view, u));
  if (a) {
    return a;
  }
  if (b.mode === 'exploration') {
    return batteryOrder(b, u);
  }
  if (care && ['fire', 'weapon', 'reload', 'reprime', 'useItem'].includes(care.type)) {
    return care;
  }
  return null;
}
