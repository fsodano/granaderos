import type {BattleSnapshot,BattleUnit} from './public/compatibility-types.ts';
import {interruptAvailable} from './tactical.js';
import {formatAP} from './action-points.js';
import {isUnconscious} from './actor-condition.js';
const alive = (unit:BattleUnit) => (unit.hp ?? 100) > 0 && !unit.departure && !unit.fled && !unit.surrendered && !unit.routed && !isUnconscious(unit);
export function inventoryOrderReason(s:BattleSnapshot, u:BattleUnit|null|undefined, pa:number):string|null {
  const window =
    u?.side === 'enemy'
      ? s.phase === 'enemy' && s.status === 'active' && alive(u)
      : interruptAvailable(s, u);
  if (!window || !u || u.knockedDown) {
    return 'El soldado no puede manejar equipo ahora.';
  }
  if (s.mode !== 'exploration' && u.ap < pa) {
    return `Faltan ${formatAP(pa)} PA para manejar el equipo.`;
  }
  return null;
}
