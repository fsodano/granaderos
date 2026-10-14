import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

export function beginNPCApproachEvidence(battle,unitId,npcId){
 if(!process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR)return null;
 try{return {inputBattle:structuredClone(battle),unitId:String(unitId),npcId,steps:[]};}
 catch{return null;}
}
export function observeNPCApproachAction(trace,before,after,action){
 if(!trace)return;
 try{
  const view=battle=>{
   const actor=battle.units.find(unit=>unit.id===trace.unitId),npc=battle.npcs.find(person=>person.id===trace.npcId);
   const position=person=>person?{x:person.x,y:person.y,tacticalLevel:person.tacticalLevel??0}:null;
   return {actor:{...position(actor),hp:actor?.hp,energy:actor?.energy,ap:actor?.ap,stance:actor?.stance},npc:{...position(npc),ai:structuredClone(npc?.ai??null)},mode:battle.mode,turn:battle.turn,elapsedSeconds:battle.elapsedSeconds,lastError:battle.lastError};
  };
  trace.steps.push({action:structuredClone(action),before:view(before),after:view(after)});
 }catch{/* A passive trace cannot replace the original action or error. */}
}
export function recordNPCApproachFailure(trace,battle,error){
 if(!trace)return;
 recordRouteStrategicEvidence({helper:'approachNPC',stage:'preparation-failure',campaign:null,context:{...trace,battle,scope:'Actual NPC approach boundary and its existing action tape; no campaign snapshot or complete route acceptance.'},error});
}
