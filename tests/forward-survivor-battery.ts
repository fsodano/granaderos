import type { BattleSnapshot, BattleUnit, TacticalAction } from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';
import { heavyContactCrewController } from './stable-crew-driver.ts';
import { stagedBatteryController } from './staged-battery-driver.ts';
import { artilleryContact, stanceCost } from '../packages/game/tactical.js';

// Adjacent arriving pieces can otherwise take each other's nearest crew.
// Keep the real three-person heavy crew together through the paid approach;
// the light piece follows close enough to support the same contact.
export function survivorBatteryController({ reserveId, lightId, heavyIds }: {reserveId:string|number;lightId:string|number;heavyIds:readonly (string|number)[]}) {
  const crew = new Set(heavyIds.map(String));
  assert.equal(crew.size, 3);
  assert.ok(!crew.has(String(lightId)) && !crew.has(String(reserveId)));
  const contact = heavyContactCrewController({ reserveId:String(reserveId) }),
    approach = stagedBatteryController();
  return (battle:BattleSnapshot, unit:BattleUnit):TacticalAction|null => {
    const heavy = battle.artillery.find((gun) => gun.side === 'player' && gun.type === 'field8');
    const light = battle.artillery.find((gun) => gun.side === 'player' && gun.type === 'swivel');
    const isHeavy = crew.has(unit.id),
      isLight = unit.id === String(lightId);
    if (!isHeavy && !isLight) {
      return contact(battle, unit);
    }
    const gun = isHeavy ? heavy : light;
    if (!gun) {
      return contact(battle, unit);
    }
    // Retain every real actor and map cell in the preview. Only the assigned
    // piece is considered; actBattle still validates the actual whole crew.
    const assigned = { ...battle, artillery: [gun] };
    if (battle.mode === 'exploration') {
      if (isLight && Math.hypot(present(gun.x) - present(present(heavy).x), present(gun.y) - present(present(heavy).y)) < 3) {
        return null;
      }
      const action = approach(assigned, unit);
      return action?.type === 'artilleryMove' ? action : null;
    }
    const action = contact(assigned, unit);
    if (
      artilleryContact(battle, unit, gun) &&
      (['move', 'climb', 'charge', 'artilleryMove', 'exit'].includes(action?.type ?? '') ||
        (action?.type === 'stance' && action.stance === 'prone'))
    ) {
      return unit.stance === 'standing' && unit.ap >= stanceCost(unit, 'crouched')
        ? { type: 'stance', unitId: unit.id, stance: 'crouched' }
        : null;
    }
    return action;
  };
}
