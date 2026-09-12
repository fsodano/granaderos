import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {enterSector} from '../game/world.js';
import {getReachable,teamCanSee,stanceCost,actionCosts,hasLineOfSight} from '../game/tactical.js';

// Deliberately poor tactics for the captivity scenario: march into the open
// east court of the authored citadel, kneel and hold fire. Soldiers still use
// finite dressings for nearby bleeding allies. Only ordinary enemy turns cause
// wounds; the route never assigns deaths or captures to chosen actors.
export function advanceOnCitadelOrder(battle,unit){
 if(battle.phase==='interrupt')return null;
 const patient=battle.units.filter(other=>other.side===unit.side&&other.hp>0&&!other.departure&&other.bleeding>0&&Math.hypot(other.x-unit.x,other.y-unit.y)<=1.5&&hasLineOfSight(battle,unit,other)).sort((a,b)=>a.hp-b.hp)[0];
 const costs=actionCosts(battle,unit);
 if(patient&&unit.medkits>0&&unit.medical>0){
  if(unit.activeSlot==='medical'&&unit.ap>=costs.heal)return {type:'useItem',unitId:unit.id,targetId:patient.id};
  if(unit.activeSlot!=='medical'&&unit.ap>=costs.weapon+costs.heal)return {type:'weapon',unitId:unit.id,slot:'medical'};
 }
 const citadel=battle.buildings.find(building=>building.id==='tucuman:building');assert.ok(citadel);
 const target={x:citadel.x+citadel.width+1,y:citadel.y+citadel.height-1};
 const distance=point=>Math.hypot(point.x-target.x,point.y-target.y);
 const inCourt=point=>point.x>=target.x&&distance(point)<=3;
 if(inCourt(unit))return unit.stance!=='crouched'&&unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other))};
 const route=getReachable({...view,mode:'exploration'},unit).filter(inCourt).sort((a,b)=>a.cost-b.cost)[0];
 if(!route)return null;
 const reachable=getReachable(view,unit),step=[...route.path].reverse().map(point=>reachable.find(candidate=>candidate.x===point.x&&candidate.y===point.y)).find(point=>point?.path.length&&point.cost<=32);
 return step?{type:'move',unitId:unit.id,x:step.x,y:step.y}:null;
}

// Continue the real opening result through ordinary recovery, contracts,
// finite sector equipment, and a new authored battle. Never synthesize victory.
export function prepareNorthernSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.flags.sanLorenzo,true);assert.equal(campaign.phase,2);assert.equal(campaign.location,'san_nicolas');
 const events=[],dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive),doctors=[112,122];
 const patients=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='san_nicolas'&&r.hp<r.maxHp;});
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const model=(id,sector='san_nicolas')=>sectorInventoryModel(campaign,sector,rosterFor(campaign),id);
 const gathered=[];
 const gather=(id,limit=1000,sector='san_nicolas')=>{
  let count=0;
  for(const row of model(id,sector).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
   const take=Math.min(row.count,limit-count);if(!take)break;
   order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:take});
   assert.equal(model(id,sector).entries.find(r=>r.key===row.key)?.count??0,row.count-take);gathered.push({sector,sourceKey:row.key,count:take,remaining:row.count-take});count+=take;
  }
  return count;
 };
 const recoveryStart=campaign.hour,cash=campaign.resources.treasury;
 for(const id of doctors)order({type:'recruitCivic',id,term:'week'});
 assert.equal(cash-campaign.resources.treasury,294);
 const recoveredDressings=gather(112)+gather(122,1000,'san_lorenzo');assert.ok(recoveredDressings>0);
 let donatedDressings=0;const donors=[];
 for(const id of campaign.recruited){
  const record=campaign.operativeState[id];
  if(doctors.includes(id)||!record.alive||record.captured||!record.medkits)continue;
  const available=model(id);if(available.operativeId!==id||available.reason)continue;
  const count=record.medkits;
  order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'drop',item:'medkits',count});
  assert.equal(campaign.operativeState[id].medkits,0,'the donor parts with the actual carried dressings');
  donors.push({id,count});donatedDressings+=count;
 }
 assert.equal(gather(112),donatedDressings);
 const medicalStart=doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<60;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before continuing care');
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 const usedDressings=medicalStart-doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);assert.ok(usedDressings>0);
 for(const operativeId of [...doctors,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 // Rest and stage for a daylight arrival without editing health or clocks.
 const departure=campaign.hour+6+(24-(campaign.hour+6)%24)%24;
 for(let i=0;campaign.hour<departure&&i<80;i++)order({type:'wait',hours:1});assert.equal(campaign.hour,departure);
 const available=id=>campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&campaign.operativeState[id].location==='san_nicolas';
 const survivors=[...new Set([1000,114,123,...campaign.recruited])].filter(id=>!doctors.includes(id)&&available(id));
 const replacements=[];
 for(const id of [120,134,136,117,119,127]){
  if(survivors.length+replacements.length>=6)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive)continue;
  const before=campaign.resources.treasury;order({type:'recruitCivic',id,term:'week'});
  assert.ok(campaign.resources.treasury<before,'a replacement has a real paid contract');replacements.push(id);
 }
 const ids=[...survivors,...replacements].slice(0,6);assert.equal(ids.length,6,'the living force has six paid or surviving soldiers');order({type:'squad',ids});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
 // Reuse actual fallen soldiers' long guns and clothing, keeping all identities.
 for(const id of replacements){
  const source=model(id).entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
  if(source){const incoming=JSON.parse(source.expected);order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
   const item=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);
   assert.ok(item);order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
  }
  if(!campaign.operativeState[id].outfit){const outfit=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='outfit');if(outfit){order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});const carried=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='outfit'));order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});}}
 }
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of ids){assert.ok(campaign.operativeState[id].hp>=15);assert.equal(campaign.operativeState[id].bleeding,0);}
 assert.ok(campaign.resources.treasury>=0);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const recovery={startHour:recoveryStart,endHour:campaign.hour,doctors,patients,usedDressings,recoveredDressings,donatedDressings,donors,replacements,fieldIds:ids,gathered};report({event:'recovered',...recovery,cash:campaign.resources.treasury});
 return {campaign,events,dead,recovery};
}

export function fightNorthernSector(start,sector,{report=()=>{},expectedOutcome='victory',controller}={}){
 const before=structuredClone(start),prepared=start.pendingBattle?structuredClone(start):finishReloadsBeforeMarch(start,{report});
 const preparationSeconds=(prepared.hour-start.hour)*3600+(prepared.secondOfHour??0)-(start.secondOfHour??0),campaign=start.pendingBattle?prepared:dispatchCampaign(prepared,{type:'attack',sector});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(start,before);assert.ok(campaign.pendingBattle,'the real march produces a tactical deployment');
 const request=campaign.pendingBattle;assert.equal(request.sector,sector);
 report({event:'battleStarted',sector,hour:campaign.hour,units:request.squad.map(u=>u.id)});
 const result=fight(request,campaign.sectorStates[sector],{controller});
 const summary={sector,preparationSeconds,startSeconds:result.battle.startSeconds,elapsedSeconds:result.battle.elapsedSeconds,status:result.battle.status,turns:result.battle.turn,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});
 assert.ok(['victory','defeat','retreat'].includes(expectedOutcome));
 assert.equal(result.battle.status,expectedOutcome,JSON.stringify(summary));
 const replay=fight(request,campaign.sectorStates[sector],{controller});assert.deepEqual(replay.battle,result.battle);
 const pair=syncBattleTime(campaign,result.battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 const returned=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
 assert.equal(returned.lastError,null,returned.lastError);assert.equal(returned.sectors[sector].owner,expectedOutcome==='victory'?'patriot':expectedOutcome==='retreat'?campaign.sectors[sector].owner:'royalist');assert.equal(returned.pendingBattle,null);
 for(const u of result.battle.units.filter(u=>u.side==='player'&&u.hp<=0))assert.equal(returned.operativeState[Number(u.id)].alive,false);
 assert.deepEqual(decodeSave(encodeSave(returned)).campaign,returned);
 return {campaign:returned,summary};
}

export function prepareTucumanSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.location,'cordoba');assert.equal(campaign.sectors.cordoba.owner,'patriot');
 const events=[],doctor=139,dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive),originalSquad=[...campaign.squad];
 const patients=originalSquad.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const startHour=campaign.hour,cash=campaign.resources.treasury;
 order({type:'recruitCivic',id:doctor,term:'week'});assert.equal(cash-campaign.resources.treasury,133);
 // Hiring fills an empty field slot. Leave the paid doctor in local reserve.
 order({type:'squad',ids:originalSquad});assert.deepEqual(campaign.squad,originalSquad);
 const stock=campaign.merchants.cordoba.supplies.medkits,carried=campaign.operativeState[doctor].medkits;
 order({type:'purchaseMedicalSupplies',operativeId:doctor,quantity:12});
 assert.equal(campaign.merchants.cordoba.supplies.medkits,stock-12);assert.equal(campaign.operativeState[doctor].medkits,carried+12);
 for(const operativeId of originalSquad)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':'rest'});
 order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
 const medicalStart=campaign.operativeState[doctor].medkits;
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<40;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before continuing care');order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 const usedDressings=medicalStart-campaign.operativeState[doctor].medkits;assert.ok(usedDressings>0);
 for(const operativeId of [doctor,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;for(let i=0;campaign.hour<restUntil&&i<20;i++)order({type:'wait',hours:1});assert.equal(campaign.hour,restUntil);
 for(const operativeId of originalSquad){order({type:'assignCare',operativeId,assignment:'active'});assert.equal(campaign.operativeState[operativeId].hp,campaign.operativeState[operativeId].maxHp);assert.equal(campaign.operativeState[operativeId].bleeding,0);}
 for(const id of originalSquad){const contract=campaign.contracts[id];if(contract.expiresAt!==null&&contract.expiresAt-campaign.hour<=13)order({type:'renewContract',id,term:'week',expectedExpiresAt:contract.expiresAt});}
 const replacements=[];
 for(const id of [131,121,124,126]){
  if(replacements.length>=4)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive)continue;
  const before=campaign.resources.treasury;order({type:'recruitCivic',id,term:'week'});assert.ok(campaign.resources.treasury<before);replacements.push(id);
 }
 // The exhausted Córdoba survivors stay in reserve. Send the paid relief
 // patrol ahead; this is the explicitly poor advance used to exercise rescue.
 for(const operativeId of originalSquad)order({type:'assignCare',operativeId,assignment:'rest'});
 const fieldIds=replacements;assert.equal(fieldIds.length,4);
 order({type:'squad',ids:fieldIds});for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(campaign.squad,fieldIds);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const recovery={startHour,endHour:campaign.hour,doctor,patients,replacements,fieldIds,usedDressings,boughtDressings:12};report({event:'cordobaRecovery',...recovery,cash:campaign.resources.treasury});return {campaign,events,recovery};
}

export function prepareRescueSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 assert.equal(campaign.sectors.tucuman.owner,'royalist');assert.deepEqual(campaign.squad,[]);
 const captives=Object.entries(campaign.operativeState).filter(([,r])=>r.captured&&r.capturedSector==='tucuman').map(([id,record])=>({id:Number(id),record:structuredClone(record)}));assert.ok(captives.length);
 const reserveIds=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='san_nicolas';});assert.ok(reserveIds.includes(112)&&reserveIds.includes(122));
 order({type:'createSquad',sector:'san_nicolas',name:'Apoyo sanitario',ids:reserveIds});const support=campaign.activeSquadId;
 for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba'});assert.equal(campaign.location,'cordoba');assert.equal(campaign.pendingEncounter,null);
 const cash=campaign.resources.treasury;
 for(const id of [141,127,119,103,104,111])order({type:'recruitCivic',id,term:'week'});
 assert.equal(cash-campaign.resources.treasury,553);
 for(const operativeId of [112,122])order({type:'purchaseMedicalSupplies',operativeId,quantity:12});
 const fieldIds=[141,127,119,103,104,139],supportIds=[111,...reserveIds];
 const model=id=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id);
 for(const id of [...fieldIds,...supportIds]){
  if(![1800,1801,1802].includes(rosterFor(campaign).find(op=>op.id===id).weapon)){
   const source=model(id).entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
   if(source){const incoming=JSON.parse(source.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});const item=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);assert.ok(item);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
  }
  if(!campaign.operativeState[id].outfit){const outfit=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='outfit');if(outfit){order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});const carried=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='outfit'));order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});}}
 }
 order({type:'squad',ids:supportIds});
 for(const operativeId of supportIds)order({type:'assignCare',operativeId,assignment:'active'});
 campaign=finishReloadsBeforeMarch(campaign,{report});
 order({type:'createSquad',name:'Rescate del norte',ids:fieldIds});const field=campaign.activeSquadId;
 for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
 campaign=finishReloadsBeforeMarch(campaign,{report});
 order({type:'selectSquad',id:support});order({type:'attack',sector:'tucuman',queue:true});order({type:'selectSquad',id:field});order({type:'attack',sector:'tucuman',queue:true});
 for(let i=0;i<24&&![field,support].every(id=>campaign.squads.find(q=>q.id===id).journey?.status==='ready');i++){assert.equal(campaign.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'tucuman'});
 for(const {id,record} of captives)assert.deepEqual(campaign.operativeState[id],record);
 const battle=enterSector(campaign.pendingBattle,campaign.sectorStates.tucuman);assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
 report({event:'rescuePrepared',hour:campaign.hour,units:campaign.pendingBattle.squad.map(u=>u.id),cash:campaign.resources.treasury});return {campaign,events,captives};
}

export function stabilizeRescued(start,{patients,report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 assert.ok(patients?.length,'stabilize the actual released prisoners');
 const doctors=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&!patients.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman'&&r.hp>=15&&op.medical>=20&&r.medkits>0;}).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 assert.ok(doctors.length,'actual surviving doctors provide aid');
 assert.equal(campaign.sectors.tucuman.owner,'patriot');assert.equal(campaign.pendingEncounter,null);
 for(const id of patients){assert.equal(campaign.operativeState[id].captured,false);assert.ok(campaign.recruited.includes(id));}
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 const before=structuredClone(campaign),hour=campaign.hour;
 order({type:'wait',hours:1});assert.equal(campaign.hour,hour+1);
 const usedDressings=doctors.reduce((sum,id)=>sum+before.operativeState[id].medkits-campaign.operativeState[id].medkits,0);assert.ok(usedDressings>0);
 for(const id of patients){assert.equal(campaign.operativeState[id].alive,true);assert.equal(campaign.operativeState[id].bleeding,0);if(before.operativeState[id].bleeding)assert.equal(campaign.operativeState[id].hp,before.operativeState[id].hp);else assert.ok(campaign.operativeState[id].hp>before.operativeState[id].hp);}
 for(const [id,r] of Object.entries(before.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'rescuedStable',hour:campaign.hour,usedDressings,patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}))});
 return {campaign,events,patients,doctors,usedDressings};
}
