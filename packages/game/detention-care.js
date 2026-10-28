import {detentionManifest} from './detention.js';
import {firstAidPlan} from './first-aid.js';
import {civilianRestoredHp} from './civilian-health.js';
import {isUnconscious,refreshMilitaryCondition} from './actor-condition.js';

// The occupying guards may use confiscated dressings to stabilize prisoners.
// This is one strategic treatment per able guard per hour, never a supply grant
// or full healing. An active tactical sector owns its own treatment clock.
export function advanceDetentionCare(campaign,roster){
 const messages=[];
 const sectors=[...new Set(Object.values(campaign.operativeState).filter(r=>r.captured&&r.alive).map(r=>r.capturedSector))];
 for(const sector of sectors){
  if(campaign.pendingBattle?.sector===sector)continue;
  const field=campaign.sectorStates[sector];
  const alreadyCared=Object.values(campaign.detentionRecords??{}).filter(entry=>entry.npc.detention.sector===sector).flatMap(entry=>(entry.care??[]).filter(care=>care.hour===campaign.hour));
  const guards=(field?.units??[]).filter(u=>u.side==='enemy'&&u.hp>=15&&!u.unconscious&&!u.knockedDown&&!u.entangled&&!u.surrendered&&!u.routed&&!u.departure&&u.medical>0&&u.energy>=3&&!alreadyCared.some(care=>care.guardId===String(u.id))).sort((a,b)=>b.medical-a.medical||String(a.id).localeCompare(String(b.id)));
  const captives=detentionManifest(campaign,roster,sector).filter(n=>n.hp>0);
  const treated=new Set(Object.entries(campaign.detentionRecords??{}).filter(([,entry])=>(entry.care??[]).some(care=>care.hour===campaign.hour)).map(([id])=>id));
  for(const guard of guards){
   const candidates=captives.filter(n=>!treated.has(n.id)&&(n.hp<15||n.bleeding>0)).sort((a,b)=>Number(b.bleeding>0)-Number(a.bleeding>0)||a.hp-b.hp||a.id.localeCompare(b.id));
   const npc=candidates[0];if(!npc)break;
   const source=captives.map(n=>campaign.operativeState[n.detention.operativeId]).find(r=>r.medkits>0);if(!source)break;
   const sourceId=captives.find(n=>campaign.operativeState[n.detention.operativeId]===source).detention.operativeId;
   const plan=firstAidPlan({...guard,medkits:source.medkits},npc,{targetKind:'npc'});if(!plan.valid)continue;
   const record=campaign.operativeState[npc.detention.operativeId],before={hp:npc.hp,bleeding:npc.bleeding??0};
   source.medkits-=plan.dressingsUsed;guard.energy-=3;refreshMilitaryCondition(guard);
   // A stationary enemy group and its sector snapshot describe the same guard.
   for(const group of campaign.enemyGroups??[])for(const unit of group.units??[])if(unit.id===guard.id){unit.energy=guard.energy;refreshMilitaryCondition(unit);}
   Object.assign(npc,{hp:plan.hpAfter,bleeding:plan.bleedingAfter,bandaged:plan.bandagedAfter,civilianWoundVersion:1,unconscious:isUnconscious({hp:plan.hpAfter,energy:npc.energy})});
   if(!npc.bleeding)delete npc.bleedSource;
   if(plan.hpGain>0)npc.civilianFirstAid={version:1,hpRestored:civilianRestoredHp(npc)+plan.hpGain};
   Object.assign(record,{hp:npc.hp,bleeding:npc.bleeding,bandaged:npc.bandaged,unconscious:npc.unconscious,recoveryHours:0});
   campaign.detentionRecords??={};const receipt=campaign.detentionRecords[npc.id]??={npc:structuredClone(npc)};
   receipt.npc=structuredClone(npc);receipt.care??=[];
   receipt.care.push({hour:campaign.hour,guardId:String(guard.id),sourceId,dressings:plan.dressingsUsed,hpBefore:before.hp,hpAfter:npc.hp,bleedingBefore:before.bleeding,bleedingAfter:npc.bleeding});
   const resident=field.npcs?.find(n=>n.id===npc.id);if(resident)Object.assign(resident,structuredClone(npc));
   treated.add(npc.id);
   messages.push(`${npc.name} recibe primeros auxilios en cautiverio: ${npc.hp} de salud. Se consume una venda del equipo incautado.`);
  }
 }
 return messages;
}
