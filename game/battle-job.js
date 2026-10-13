import {actBattle,endTurn,getReachable,knownArtillery} from './tactical.js';
import {executeGroupMove,planGroupMove,groupMovementStep} from './group-movement.js';
import {movementStep} from './movement-step.js';
// Both browser paths execute the same deterministic rules on owned snapshots.
/** @param {{battle:any,action:any,kind?:string,continuation?:any[]|null}} job */
export function runBattleJob({battle,action,kind='action',continuation=null}){
 if(kind==='movement-step')return movementStep(battle,action,continuation);
 if(kind==='group-step')return groupMovementStep(battle,action,continuation);
 if(kind==='reachable-preview'){
  const unit=battle.units.find(unit=>unit.id===String(action.unitId));
  // A public route preview cannot disclose an unseen opposing gun. Execution
  // still receives the complete field and checks each reached cell.
  const view={...battle,artillery:unit?knownArtillery(battle,unit):[]};
  return getReachable(view,action.unitId,{movementIntent:action.movementIntent,previewBudget:Boolean(action.previewBudget)});
 }
 if(kind==='turn')return endTurn(battle);
 if(kind==='group')return executeGroupMove(battle,action);
 if(kind==='group-preview')return planGroupMove(battle,action);
 if(kind!=='action')throw Error('Unknown battle job');
 return actBattle(battle,action);
}
