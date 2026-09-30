import {actBattle,endTurn,getReachable} from './tactical.js';
import {executeGroupMove,planGroupMove} from './group-movement.js';
import {movementStep} from './movement-step.js';
// Both browser paths execute the same deterministic rules on owned snapshots.
/** @param {{battle:any,action:any,kind?:string,continuation?:any[]|null}} job */
export function runBattleJob({battle,action,kind='action',continuation=null}){
 if(kind==='movement-step')return movementStep(battle,action,continuation);
 if(kind==='reachable-preview')return getReachable(battle,action.unitId,{movementIntent:action.movementIntent});
 if(kind==='turn')return endTurn(battle);
 if(kind==='group')return executeGroupMove(battle,action);
 if(kind==='group-preview')return planGroupMove(battle,action);
 if(kind!=='action')throw Error('Unknown battle job');
 return actBattle(battle,action);
}
