import {contractExpiresSeconds} from '../game/contracts.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {doctorRate,careAssignmentReason} from '../game/medical-care.js';
import {order,saved,visit,tactical} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {collectRouteItems,collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {workAssignmentReason} from '../game/assignments.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {transportPath} from '../game/logistics.js';
import {careRules} from '../game/campaign-care-rules.js';

// Actual finite found equipment and doctor/patient/repair/rest orders only.
// Select roles from current survivors; preserve all real wounds and casualties.
export function prepareLocalOpening(s,{buyWeapons=true,recovery='doctor'}={}){
 assert.ok(['doctor','rest'].includes(recovery),'Choose actual doctor care or stable rest.');
 const earlierDeaths=Object.entries(s.operativeState).filter(([,record])=>!record.alive).map(([id])=>id);
 const returnSector=s.location;
 const localMedical=sectorInventoryModel(s,s.location,rosterFor(s),s.squad.find(id=>s.operativeState[id].hp>=15)).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
 const sources=Object.entries(FINITE_SECTOR_CACHES).filter(([at])=>s.sectors[at]?.owner==='patriot'&&transportPath(s,s.location,at)).map(([at,source])=>{const chest=s.sectorStates[at]?.props.find(prop=>prop.id===source.chest);return {at,available:chest?chest.contents.filter(item=>item.item==='medkits').reduce((sum,item)=>sum+item.count,0):source.medical};}).sort((a,b)=>Number(b.at===s.location)-Number(a.at===s.location)||b.available-a.available);
 const careSector=recovery==='rest'?returnSector:localMedical?s.location:sources.find(source=>source.available>0)?.at??s.location;
 const care={hours:0,restHours:0,stockWaitHours:0,contractCost:0,dressingsBought:0,dressingCost:0,weaponCost:0,workshopCost:0,dressingsFound:0,donatedDressings:0,weaponsFound:0,repairPointsSpent:0,repairHours:0};
 const renewCareContracts=()=>{for(const id of s.squad){const contract=s.contracts[id],expiry=contractExpiresSeconds(contract);if(expiry!==null&&expiry<s.hour*3600+(s.secondOfHour??0)+24*3600){const money=s.resources.treasury;s=order(s,{type:'renewContract',id,term:'week',expectedExpiresAt:contract.expiresAt});care.contractCost+=money-s.resources.treasury;}}};
 renewCareContracts();
 if(s.location!==careSector)s=order(s,{type:'travel',sector:careSector});
 renewCareContracts();
 if(recovery==='rest'){
  const resting=[...s.squad],wounded=resting.filter(id=>s.operativeState[id].hp<s.operativeState[id].maxHp),restHealingHours=careRules(s).restHealingHours;
  const stable=()=>{for(const id of resting){const r=s.operativeState[id];assert.ok(r.alive&&!r.captured&&r.hp>=15,'ordinary rest requires the actual conscious uncaptured survivor');assert.equal(r.bleeding,0,'stabilize every wound with actual first aid before resting');}};
  stable();
  care.restBoundHours=Math.max(0,...wounded.map(id=>(s.operativeState[id].maxHp-s.operativeState[id].hp)*restHealingHours))+72;
  care.restStartedAt={hour:s.hour,second:s.secondOfHour??0};
  for(const id of resting)s=order(s,{type:'assignCare',id,assignment:'rest'});
  while(wounded.some(id=>s.operativeState[id].hp<s.operativeState[id].maxHp)){
   assert.ok(care.restHours<care.restBoundHours,'stable recovery must fit the actual wound deficit and ordinary sleep bound');stable();renewCareContracts();
   const before=resting.map(id=>({id,hp:s.operativeState[id].hp,maxHp:s.operativeState[id].maxHp,recoveryHours:s.operativeState[id].recoveryHours})),time=s.hour*3600+(s.secondOfHour??0);
   s=advanceCampaignHours(s,1);assert.equal(s.hour*3600+(s.secondOfHour??0),time+3600);care.restHours++;stable();
   for(const r of before){const current=s.operativeState[r.id];assert.ok(current.hp>=r.hp&&current.hp<=Math.min(r.maxHp,r.hp+1),'rest must earn health through ordinary hourly recovery');if(r.hp<r.maxHp)assert.ok(current.hp>r.hp||current.recoveryHours>r.recoveryHours,'every actual rest hour must advance wound recovery');}
  }
  care.restFinishedAt={hour:s.hour,second:s.secondOfHour??0};
 }else while(true){
  renewCareContracts();
  const roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),patient=roster.filter(o=>s.operativeState[o.id].hp<o.maxHp||s.operativeState[o.id].bleeding).sort((a,b)=>a.medical-b.medical)[0];if(!patient)break;
  assert.ok(care.hours<48,'recovery must use bounded, paid campaign care');
  const doctor=roster.filter(o=>o.id!==patient.id&&o.medical>=20&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&(s.operativeState[o.id].energy??100)>10).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'a living local doctor is required');
  for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
  // Marching and medical work can put the selected doctor to sleep. Let that
  // actual recovery finish before assigning care; do not wake an exhausted actor.
  for(let hour=0;s.operativeState[doctor.id].asleep&&hour<72;hour++){renewCareContracts();s=advanceCampaignHours(s,1);}
  assert.equal(s.operativeState[doctor.id].asleep,false,'The doctor must finish actual sleep before working.');
  if(!s.operativeState[doctor.id].medkits){
   const donor=roster.find(o=>o.id!==doctor.id&&s.operativeState[o.id].medkits>0&&!sectorInventoryModel(s,s.location,rosterFor(s),o.id).reason);
   if(donor){s=order(s,{type:'sectorInventory',sector:s.location,operativeId:donor.id,direction:'drop',item:'medkits',count:1});const row=sectorInventoryModel(s,s.location,rosterFor(s),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);s=order(s,{type:'sectorInventory',sector:s.location,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});care.donatedDressings++;}
  }
  if(!s.operativeState[doctor.id].medkits){
   const needed=Math.max(1,Math.min(20,Math.ceil((patient.maxHp-s.operativeState[patient.id].hp)/doctorRate(doctor,s))+Number(s.operativeState[patient.id].bleeding>0))),found=collectRouteMedicalSupplies(s,doctor.id,needed);
   s=found.campaign;care.dressingsFound+=found.collected;
  }
  assert.equal(careAssignmentReason(s,doctor,'doctor'),'');s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
  const stock=s.operativeState[doctor.id].medkits;s=saved({campaign:advanceCampaignHours(s,1)}).campaign;assert.equal(s.operativeState[doctor.id].medkits,stock-1);care.hours++;
 }
 // Worn firearms receive real mechanical work and spend carried kit points.
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
 for(let hour=0;s.squad.some(id=>s.operativeState[id].asleep)&&hour<72;hour++){renewCareContracts();s=advanceCampaignHours(s,1);}
 assert.ok(s.squad.every(id=>!s.operativeState[id].asleep),'real sleep must finish before local equipment recovery');
 // Recover only the one real rifle remaining in the local cache. Earlier
 // acquisition may already have removed it; never replace a depleted weapon.
 if(buyWeapons){
  let p=FINITE_SECTOR_CACHES[careSector]?takeFiniteCache(visit(s),s.squad[0],[]):visit(s);
  const cache=p.battle.props.find(prop=>prop.id===FINITE_SECTOR_CACHES[careSector]?.chest),rifle=cache?.contents.find(item=>[1800,1801,1802].includes(item.weapon));
  if(rifle){
   const carrier=p.battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed).sort((a,b)=>b.marksmanship-a.marksmanship)[0];assert.ok(carrier);
   p=takeFiniteCache(p,carrier.id,[{weapon:rifle.weapon,count:1}]);const key=Object.keys(p.battle.units.find(u=>u.id===carrier.id).inventory).find(key=>p.battle.units.find(u=>u.id===carrier.id).inventory[key].instanceId===rifle.instanceId);
   p=tactical(p,{type:'equipLoot',unitId:carrier.id,inventoryKey:key});care.weaponsFound++;
  }
  s=leaveFiniteCache(p);
 }
 // Hourly repair restores wear. A retained ignition failure still needs the
 // ordinary paid reprime in finishReloadsBeforeMarch before the next attack.
 while(s.squad.some(id=>s.operativeState[id].condition<100)){
  assert.ok(care.repairHours<48,'finite weapon repair must finish through bounded hourly work');renewCareContracts();
  let roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),target=roster.find(o=>s.operativeState[o.id].condition<100),mechanic=roster.filter(o=>o.mechanical>=20&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&(s.operativeState[o.id].energy??100)>10&&!s.operativeState[o.id].asleep).sort((a,b)=>b.mechanical-a.mechanical)[0];assert.ok(mechanic,'a living qualified mechanic with actual energy is required');
  if(!repairMaterialPoints(s.operativeState[mechanic.id]))s=collectRouteItems(s,mechanic.id,{kind:'repair-kit'},1).campaign;
  // Collection can advance real time and complete work or put an actor to
  // sleep. Select the current target and validate the current worker again.
  roster=rosterFor(s).filter(o=>s.squad.includes(o.id));
  target=roster.find(o=>s.operativeState[o.id].condition<100);if(!target)continue;
  mechanic=roster.filter(o=>o.mechanical>=20&&!workAssignmentReason(s,o,'repair',{targetId:target.id},roster)).sort((a,b)=>b.mechanical-a.mechanical)[0];
  assert.ok(mechanic,'a living awake mechanic with finite materials and a current repair target is required');
  s=order(s,{type:'assignWork',operativeId:mechanic.id,assignment:'repair',targetId:target.id});const points=repairMaterialPoints(s.operativeState[mechanic.id]);s=advanceCampaignHours(s,1);const spent=points-repairMaterialPoints(s.operativeState[mechanic.id]);assert.ok(spent>0,'actual repair must spend finite materials');care.repairPointsSpent+=spent;care.repairHours++;
  s=order(s,{type:'assignCare',id:mechanic.id,assignment:'active'});
 }
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'rest'});renewCareContracts();s=order(s,{type:'wait',hours:6});
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
 for(let hour=0;s.squad.some(id=>s.operativeState[id].asleep)&&hour<72;hour++){renewCareContracts();s=advanceCampaignHours(s,1);}
 assert.ok(s.squad.every(id=>!s.operativeState[id].asleep),'The squad must finish sleep before its return march.');
 renewCareContracts();if(s.location!==returnSector)s=order(s,{type:'travel',sector:returnSector});
 // Recover at the actual destination; the return march spends fatigue and energy.
 for(const id of s.squad)if(!s.operativeState[id].asleep&&(s.operativeState[id].fatigue>0||s.operativeState[id].energy<100))s=order(s,{type:'setSleep',operativeId:id,asleep:true});
 for(let hour=0;s.squad.some(id=>s.operativeState[id].asleep)&&hour<72;hour++){renewCareContracts();s=advanceCampaignHours(s,1);}
 assert.ok(s.squad.every(id=>!s.operativeState[id].asleep),'The squad must complete actual sleep before the next operation.');
 assert.equal(care.dressingCost,care.dressingsBought*10);assert.equal(care.weaponCost,0);assert.equal(care.workshopCost,0);
 for(const o of rosterFor(s).filter(o=>s.squad.includes(o.id))){assert.equal(s.operativeState[o.id].hp,o.maxHp);assert.equal(s.operativeState[o.id].energy,100);}
 for(const id of earlierDeaths)assert.equal(s.operativeState[id].alive,false,'rest or care cannot restore an actual casualty');
 return {campaign:saved({campaign:s}).campaign,care};
}
