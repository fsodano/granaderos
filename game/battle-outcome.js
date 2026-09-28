import {fieldCapable} from './actor-condition.js';
// Critical casualties cannot contest the field. Exhaustion alone can recover.
export function completedTacticalVictory(battle){
 return Boolean(battle&&(battle.status==='victory'||battle.status==='active'&&battle.mode==='exploration'&&battle.sectorCleared===true)
  &&battle.units.some(u=>u.side==='player'&&fieldCapable(u))
  &&!battle.units.some(u=>u.side==='enemy'&&fieldCapable(u)));
}
