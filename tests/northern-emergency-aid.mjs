import assert from 'node:assert/strict';
import {actBattle,getReachable,medicalUsePreview} from '../packages/game/tactical.js';
import {autoBandageBattle,autoBandageStatus} from '../packages/game/auto-bandage.js';
import {criticalFirstAidNeeded} from '../packages/game/first-aid.js';
import {medicalPatientAvailable} from '../packages/game/medical-patient.js';
import {publicRouteView} from './route-infantry-progress.mjs';

// A critical patient's bleeding clock runs during every exploration step.
// Prepare a real supplied standing medic's ordinary run gait before a distant
// rescue. Adjacent care and noncritical/default auto-bandage work stay first.
export function northernEmergencyAid(start,{physicianId,urgentIds=[]}={}){
 let battle=start;const preparation=[];
 const physician=start.units.find(unit=>unit.id===String(physicianId)),urgent=new Set(urgentIds.map(String));
 const critical=start.units.filter(unit=>urgent.has(unit.id)&&unit.side==='player'&&medicalPatientAvailable(unit)&&criticalFirstAidNeeded(unit));
 const status=autoBandageStatus(start);
 if(status.available&&start.status==='active'&&start.mode==='exploration'&&start.phase==='player'&&!start.reactionStack?.length&&critical.length&&
  physician?.side==='player'&&physician.hp>=15&&!physician.unconscious&&!physician.routed&&!physician.departure&&!physician.fled&&!physician.surrendered&&!physician.captured&&
  !physician.asleep&&!physician.knockedDown&&!physician.entangled&&!physician.mounted&&physician.energy>0&&physician.medical>0&&physician.medkits>0&&physician.stance==='standing'&&physician.movementMode!=='run'){
  // A medical-hand projection quotes only existing local work. It neither
  // prepares that hand nor supplies a dressing, health or action points.
  const medical={...physician,activeSlot:'medical'},adjacent=status.patients.some(({id})=>{
   const npc=String(id).startsWith('npc:'),patient=(npc?start.npcs??[]:start.units).find(unit=>unit.id===(npc?String(id).slice(4):id));
   return patient&&medicalUsePreview(start,medical,patient,{targetKind:npc?'npc':'unit'}).allowed;
  });
  const running={...medical,movementMode:'run'},view=publicRouteView(start,running);
  const route=!adjacent&&getReachable(view,running).some(point=>point.cost>0&&critical.some(patient=>medicalUsePreview(view,{...running,...point},patient).allowed));
  if(route){
   const action={type:'movement',unitId:physician.id,movement:'run'};
   battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);preparation.push(action);
  }
 }
 const aid=autoBandageBattle(battle);
 return {...aid,steps:[...preparation,...aid.steps],elapsedSeconds:aid.battle.elapsedSeconds-start.elapsedSeconds};
}
