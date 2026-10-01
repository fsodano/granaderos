import {fieldCapable} from './actor-condition.js';
// The campaign and tactical controls must accept the same completed field.
export function completedTacticalVictory(battle){
 if(!battle||battle.phase!=='player'||battle.enemyTurn||battle.alliedTurn||battle.interrupt||battle.reactionStack)return false;
 const finished=battle.status==='victory'||battle.status==='active'&&battle.mode==='exploration'&&battle.sectorCleared===true;
 return Boolean(finished&&battle.units.some(u=>u.side==='player'&&fieldCapable(u))
  &&!battle.units.some(u=>u.side==='enemy'&&fieldCapable(u)));
}
