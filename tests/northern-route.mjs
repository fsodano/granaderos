import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight,combatOrder} from './opening-driver.mjs';
import {enterSector} from '../game/world.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {getReachable,teamCanSee,stanceCost,actionCosts,hasLineOfSight,firearmShotOptions,weaponFor} from '../game/tactical.js';
import {shotLocationEffects} from '../game/targeted-combat.js';
import {availableAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {ammoResourceKey} from '../game/campaign-ammunition.js';
import {doctorRate} from '../game/medical-care.js';
import {RECIPES} from '../game/data.js';

export function northernCombatOrder(battle,unit){
 const action=combatOrder(battle,unit);
 // A doctor without ammunition keeps a low profile at the reserve position.
 // Adjacent aid and weapon maintenance remain available through normal orders.
 if(unit.medical>=60&&!unit.loaded&&!availableAmmunition(unit)&&action?.type==='move')return unit.stance!=='prone'&&unit.ap>=stanceCost(unit,'prone')?{type:'stance',unitId:unit.id,stance:'prone'}:null;
 if(action?.type==='stance'&&action.stance==='prone'&&unit.stance==='standing')return {...action,stance:'crouched'};
 if(action?.type!=='fire'&&!(action?.type==='stance'&&action.stance==='prone'))return action;
 const targets=battle.units.filter(target=>target.side==='enemy'&&target.hp>=15&&!target.departure&&!target.surrendered&&!target.unconscious&&!target.routed&&teamCanSee(battle,unit.side,target));
 const shots=[];
 // Select from the actual cursor previews, including body height and known
 // civilian bodies, instead of firing torso shots through a blocked lane.
 for(const target of targets){
  const cost=actionCosts(battle,unit,target);if(unit.ap<cost.fire)continue;
  const maxAim=Math.min(4,Math.floor((unit.ap-cost.fire)/cost.aim));
  for(const option of firearmShotOptions(battle,unit,target,maxAim)){
   if(option.chance<25)continue;
   const damage=weaponFor(unit).damage,effect=shotLocationEffects(option.hitLocation,damage*option.damageFactor,target);
   const value=Math.min(target.hp,effect.damage)+(target.hp-effect.damage<15?0:effect.breathLoss*.15+(effect.knockedDown?10:0));
   const score=option.chance*value/Math.max(1,Math.min(target.hp,damage))-(cost.fire+option.aim*cost.aim)*.2;
   shots.push({score,action:{type:'fire',unitId:unit.id,targetId:target.id,aim:option.aim,hitLocation:option.hitLocation}});
  }
 }
 return shots.sort((a,b)=>b.score-a.score)[0]?.action??action;
}

// Deliberately poor tactics for the captivity scenario: march into the open
// east court of the authored citadel, kneel and hold fire. Soldiers still use
// finite dressings for nearby bleeding allies. Only ordinary enemy turns cause
// wounds; the route never assigns deaths or captures to chosen actors.
export function advanceOnCitadelOrder(battle,unit){
 if(battle.phase==='interrupt')return null;
 const patient=battle.units.filter(other=>other.side===unit.side&&other.hp>0&&!other.departure&&other.bleeding>0&&sameSurface(unit,other)&&Math.hypot(other.x-unit.x,other.y-unit.y)<=1.5&&hasLineOfSight(battle,unit,other)).sort((a,b)=>a.hp-b.hp)[0];
 const costs=actionCosts(battle,unit);
 if(patient&&unit.medkits>0&&unit.medical>0){
  if(unit.activeSlot==='medical'&&unit.ap>=costs.heal)return {type:'useItem',unitId:unit.id,targetId:patient.id};
  if(unit.activeSlot!=='medical'&&unit.ap>=costs.weapon+costs.heal)return {type:'weapon',unitId:unit.id,slot:'medical'};
 }
 const citadel=battle.buildings.find(building=>building.id==='tucuman:building');assert.ok(citadel);
 const target={x:citadel.x+citadel.width+1,y:citadel.y+citadel.height-1,tacticalLevel:0};
 const distance=point=>Math.hypot(point.x-target.x,point.y-target.y);
 const inCourt=point=>sameSurface(point,target)&&point.x>=target.x&&distance(point)<=3;
 if(inCourt(unit))return unit.stance!=='crouched'&&unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other))};
 const route=getReachable({...view,mode:'exploration'},unit).filter(inCourt).sort((a,b)=>a.cost-b.cost)[0];
 if(!route)return null;
 const reachable=getReachable(view,unit),step=[...route.path].reverse().map(point=>reachable.find(candidate=>sameCell(candidate,point))).find(point=>point?.path.length&&point.cost<=32);
 return step?{type:'move',unitId:unit.id,...spacePoint(step)}:null;
}

// A mission ally can win after the hired field squad dies. Rebuild that empty
// command through paid contracts and an ordinary march; the fallen stay dead.
export function stageNorthernCare(start){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[],doctors=[112,122];
 assert.equal(campaign.flags.sanLorenzo,true);assert.equal(campaign.phase,2);
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const cash=campaign.resources.treasury;
 for(const id of doctors)order({type:'recruitCivic',id,term:'week'});
 const hiringCost=cash-campaign.resources.treasury;assert.equal(hiringCost,294);
 if(campaign.location!=='san_nicolas'){
  order({type:'squad',ids:doctors});
  order({type:'travel',sector:'san_nicolas'});
  assert.equal(campaign.pendingEncounter,null,'the relief march must resolve real encounters before field recovery');
 }
 assert.equal(campaign.location,'san_nicolas');
 for(const id of doctors)assert.equal(campaign.operativeState[id].location,'san_nicolas');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 return {campaign,events,doctors,staging:{startHour:start.hour,arrivalHour:campaign.hour,startSector:start.location,hiringCost}};
}

// Continue the real opening result through ordinary recovery, contracts,
// finite sector equipment, and a new authored battle. Never synthesize victory.
export function prepareNorthernSquad(start,{report=()=>{}}={}){
 const staged=stageNorthernCare(start);let campaign=staged.campaign;
 const {events,doctors,staging}=staged,dead=Object.entries(start.operativeState).filter(([,record])=>!record.alive).map(([id])=>Number(id));
 const patients=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='san_nicolas'&&r.hp<r.maxHp;});
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 // Recovery also gives the controlled Retiro workshop time to prepare the
 // actual survivors' loads. Other calibers cannot supply an exhausted Baker.
 const ammunitionProduction=[];
 for(const type of new Set(rosterFor(campaign).filter(op=>campaign.recruited.includes(op.id)&&!doctors.includes(op.id)&&campaign.operativeState[op.id].alive).map(op=>weaponAmmoType(op.weapon)).filter(Boolean))){
  const key=ammoResourceKey(type),required=rosterFor(campaign).filter(op=>campaign.recruited.includes(op.id)&&!doctors.includes(op.id)&&weaponAmmoType(op.weapon)===type).reduce((sum,op)=>sum+Math.max(0,10-(campaign.operativeState[op.id].carriedLoaded??0)-availableAmmunition(campaign.operativeState[op.id],type)),0);
  if(campaign.resources[key]>=required)continue;
  const recipe=RECIPES[key],before=structuredClone(campaign.resources);order({type:'produce',recipe:key,sector:'retiro'});
  for(const [resource,cost] of Object.entries(recipe.cost))assert.equal(campaign.resources[resource],before[resource]-cost);
  const production=campaign.production.at(-1);ammunitionProduction.push({type,key,id:production.id,due:production.due,count:recipe.yield[key],cost:recipe.cost});
 }
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
 const recoveryStart=start.hour;
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
 let boughtDressings=0;const medicalTrips=[];
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<60;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before continuing care');
  if(doctors.every(id=>campaign.operativeState[id].medkits===0)){
   // San Nicolás has no medical shop. A real relief doctor carries paid
   // Retiro supplies back; the patients and their actual wounds stay here.
   const courier=doctors[0],startHour=campaign.hour,rate=doctorRate(rosterFor(campaign).find(op=>op.id===courier));
   const quantity=patients.reduce((sum,id)=>sum+Math.ceil((campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)/rate)+Number(campaign.operativeState[id].bleeding>0),0);
   assert.ok(quantity>0&&quantity<=20);
   order({type:'assignCare',operativeId:courier,assignment:'active'});order({type:'createSquad',name:'Abastecimiento sanitario',ids:[courier]});
   order({type:'travel',sector:'retiro'});assert.equal(campaign.pendingEncounter,null);
   order({type:'assignCare',operativeId:courier,assignment:'rest'});
   for(let rest=0;rest<18&&(campaign.operativeState[courier].energy<100||campaign.operativeState[courier].fatigue>0||campaign.operativeState[courier].asleep);rest++)order({type:'wait',hours:1});
   assert.equal(campaign.operativeState[courier].energy,100);assert.equal(campaign.operativeState[courier].fatigue,0);assert.equal(campaign.operativeState[courier].asleep,false);
   order({type:'assignCare',operativeId:courier,assignment:'active'});
   const cash=campaign.resources.treasury,stock=campaign.merchants.retiro.supplies.medkits;
   order({type:'purchaseMedicalSupplies',operativeId:courier,quantity});assert.equal(cash-campaign.resources.treasury,quantity*30);assert.equal(campaign.merchants.retiro.supplies.medkits,stock-quantity);boughtDressings+=quantity;
   order({type:'travel',sector:'san_nicolas'});assert.equal(campaign.pendingEncounter,null);assert.ok(campaign.hour>startHour);
   order({type:'assignCare',operativeId:courier,assignment:'doctor'});medicalTrips.push({courier,startHour,endHour:campaign.hour,quantity,cost:quantity*30});
  }
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp,`patient ${id} must finish paid care`);
 const usedDressings=medicalStart+boughtDressings-doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 assert.ok(patients.length?usedDressings>0:usedDressings===0,'only actual surviving patients consume recovery supplies');
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
 for(const production of ammunitionProduction){assert.ok(campaign.hour>=production.due);assert.ok(!campaign.production.some(order=>order.id===production.id));assert.ok(campaign.resources[production.key]>=production.count);}
 const recovery={startHour:recoveryStart,endHour:campaign.hour,staging,doctors,patients,usedDressings,boughtDressings,medicalTrips,recoveredDressings,donatedDressings,donors,replacements,fieldIds:ids,gathered,ammunitionProduction};report({event:'recovered',...recovery,cash:campaign.resources.treasury});
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
 assert.equal(returned.lastError,null,returned.lastError);
 const navalLoss=expectedOutcome==='defeat'&&request.defenseGroupId&&campaign.enemyGroups.find(group=>group.id===request.defenseGroupId)?.theater==='coast';
 assert.equal(returned.sectors[sector].owner,expectedOutcome==='victory'?'patriot':expectedOutcome==='retreat'||navalLoss?campaign.sectors[sector].owner:'royalist');assert.equal(returned.pendingBattle,null);
 if(navalLoss){assert.equal(returned.blockade,true);assert.equal(returned.enemyGroups.find(group=>group.id===request.defenseGroupId).status,'stationed');}

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
 const medicalStart=campaign.operativeState[doctor].medkits;let boughtDressings=12;
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<40;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before continuing care');
  if(!campaign.operativeState[doctor].medkits){
   const remaining=patients.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp),stock=campaign.merchants.cordoba.supplies.medkits;
   const quantity=Math.min(stock,remaining.length);assert.ok(quantity>0,'the local medical shop has real replacement supplies');
   const cash=campaign.resources.treasury;order({type:'purchaseMedicalSupplies',operativeId:doctor,quantity});boughtDressings+=quantity;
   assert.equal(campaign.merchants.cordoba.supplies.medkits,stock-quantity);assert.ok(campaign.resources.treasury<cash);
  }
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 const usedDressings=medicalStart+boughtDressings-12-campaign.operativeState[doctor].medkits;assert.ok(patients.length?usedDressings>0:usedDressings===0,'only actual surviving patients consume recovery supplies');
 for(const operativeId of [doctor,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;for(let i=0;campaign.hour<restUntil&&i<20;i++)order({type:'wait',hours:1});assert.equal(campaign.hour,restUntil);
 for(const operativeId of originalSquad){order({type:'assignCare',operativeId,assignment:'active'});assert.equal(campaign.operativeState[operativeId].hp,campaign.operativeState[operativeId].maxHp);assert.equal(campaign.operativeState[operativeId].bleeding,0);}
 for(const id of originalSquad){const contract=campaign.contracts[id];if(contract.expiresAt!==null&&contract.expiresAt-campaign.hour<=13)order({type:'renewContract',id,term:'week',expectedExpiresAt:contract.expiresAt});}
 const replacements=[];
 for(const id of [131,121,124,126,125,129,130]){
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
 const recovery={startHour,endHour:campaign.hour,doctor,patients,replacements,fieldIds,usedDressings,boughtDressings};report({event:'cordobaRecovery',...recovery,cash:campaign.resources.treasury});return {campaign,events,recovery};
}

export function prepareRescueSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 assert.equal(campaign.sectors.tucuman.owner,'royalist');assert.deepEqual(campaign.squad,[]);
 const captives=Object.entries(campaign.operativeState).filter(([,r])=>r.captured&&r.capturedSector==='tucuman').map(([id,record])=>({id:Number(id),record:structuredClone(record)}));assert.ok(captives.length);
 const reserveIds=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='san_nicolas';});assert.ok(reserveIds.includes(112)&&reserveIds.includes(122));
 order({type:'createSquad',sector:'san_nicolas',name:'Apoyo sanitario',ids:reserveIds});const support=campaign.activeSquadId;
 for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba'});assert.equal(campaign.location,'cordoba');
 const corridor={loss:null,recapture:null,released:[]},earlyDefenses=[],earlyRenewals=[];
 if(campaign.pendingEncounter){
  const encounter=structuredClone(campaign.pendingEncounter);assert.equal(encounter.sector,'buenos_aires');
  order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
  // The actual southern reserve is critically wounded. Resolve that defense
  // and retain its casualty/captive result before assembling a relief force.
  assert.ok(campaign.pendingBattle.squad.every(unit=>unit.hp<15));
  const loss=fightNorthernSector(campaign,encounter.sector,{expectedOutcome:'defeat',controller:northernCombatOrder,report});campaign=loss.campaign;corridor.loss={groupId:encounter.groupId,...loss.summary};
 }
 const defendDepot=()=>{
  if(!campaign.pendingEncounter)return;
  const encounter=structuredClone(campaign.pendingEncounter);assert.equal(encounter.sector,'cordoba');
  order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
  const defense=fightNorthernSector(campaign,encounter.sector,{controller:northernCombatOrder,report});campaign=defense.campaign;earlyDefenses.push({groupId:encounter.groupId,...defense.summary});
 };
 const cash=campaign.resources.treasury,hired=[];
 const hire=(id,term='week')=>{
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive||campaign.operativeState[id].captured)return;
  order({type:'recruitCivic',id,term});hired.push(id);
 };
 for(const id of [141,127,119,103,104,111])hire(id);
 // Fill support seats with living, affordable recruits. Earlier battles can
 // permanently remove candidates; those deaths never become fresh hires.
 const present=id=>campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&campaign.operativeState[id].location==='cordoba';
 const supportCandidates=[111,...reserveIds],supportHires=[];
 for(const id of [120,136,134,140,133,129,130,100,101,102,108,121,126,144,146]){
  if([...new Set(supportCandidates)].filter(present).length>=6)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive||campaign.operativeState[id].captured)continue;
  hire(id,'day');supportCandidates.push(id);supportHires.push(id);
 }
 const supportIds=[...new Set(supportCandidates)].filter(present).slice(0,6);
 const fieldCandidates=()=>[...new Set([141,127,119,103,104,139,...campaign.recruited])].filter(id=>present(id)&&!supportIds.includes(id));
 for(const id of [140,133,129,130]){if(fieldCandidates().length>=6)break;hire(id);}
 const fieldIds=fieldCandidates().slice(0,6),hiringCost=cash-campaign.resources.treasury;
 assert.equal(fieldIds.length,6,'six actual living soldiers make the rescue field squad');
 assert.ok(supportIds.includes(112)&&supportIds.includes(122)&&supportIds.length<=6);
 assert.ok(hiringCost>0);assert.equal(hiringCost,hired.reduce((sum,id)=>sum+campaign.contracts[id].paid,0));
 const medicalPurchases=[];
 for(const operativeId of [112,122]){
  const quantity=Math.max(0,12-campaign.operativeState[operativeId].medkits);
  if(quantity){order({type:'purchaseMedicalSupplies',operativeId,quantity});medicalPurchases.push({operativeId,quantity});}
 }
 const model=id=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id);
 for(const id of [...fieldIds,...supportIds]){
  if(![1800,1801,1802].includes(rosterFor(campaign).find(op=>op.id===id).weapon)){
   const source=model(id).entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
   if(source){const incoming=JSON.parse(source.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});const item=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);assert.ok(item);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
  }
  if(!campaign.operativeState[id].outfit){const outfit=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='outfit');if(outfit){order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});const carried=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='outfit'));order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});}}
 }
 let reliefSquad=null;
 if(corridor.loss){
  order({type:'createSquad',name:'Asegurar el camino del sur',ids:fieldIds});reliefSquad=campaign.activeSquadId;
  for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
  campaign=finishReloadsBeforeMarch(campaign,{report});
  order({type:'attack',sector:'buenos_aires'});assert.ok(campaign.pendingBattle);
  const coastalCaptives=Object.entries(campaign.operativeState).filter(([,r])=>r.captured&&r.capturedSector==='buenos_aires').map(([id,r])=>({id:Number(id),hp:r.hp,bleeding:r.bleeding}));
  const recapture=fightNorthernSector(campaign,'buenos_aires',{controller:northernCombatOrder,report});campaign=recapture.campaign;corridor.recapture=recapture.summary;
  for(const id of [...fieldIds,...supportIds]){const contract=campaign.contracts[id];if(contract?.expiresAt!==null&&contract.expiresAt-campaign.hour<=28){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});earlyRenewals.push({id,cost:cash-campaign.resources.treasury,hour:campaign.hour});}}
  // The released southern reserve stays wounded. Spend real local medical
  // time and dressings before the relief doctors leave him behind.
  if(coastalCaptives.length){
   const doctor=fieldIds.filter(id=>campaign.operativeState[id].alive&&campaign.operativeState[id].hp>=15&&campaign.operativeState[id].medkits>0).sort((a,b)=>rosterFor(campaign).find(op=>op.id===b).medical-rosterFor(campaign).find(op=>op.id===a).medical)[0];
   const linen=campaign.operativeState[doctor].medkits,careStart=campaign.hour;order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
   for(const patient of coastalCaptives){assert.equal(campaign.operativeState[patient.id].hp,patient.hp);assert.equal(campaign.operativeState[patient.id].captured,false);order({type:'assignCare',operativeId:patient.id,assignment:'patient'});}
   for(let care=0;care<8&&coastalCaptives.some(({id})=>campaign.operativeState[id].hp<15||campaign.operativeState[id].bleeding);care++)order({type:'wait',hours:1});
   assert.ok(campaign.operativeState[doctor].medkits<linen);
   for(const patient of coastalCaptives){assert.ok(campaign.operativeState[patient.id].hp>=15);assert.equal(campaign.operativeState[patient.id].bleeding,0);order({type:'assignCare',operativeId:patient.id,assignment:'rest'});}
   order({type:'assignCare',operativeId:doctor,assignment:'active'});corridor.released=coastalCaptives;corridor.care={doctor,hours:campaign.hour-careStart,usedDressings:linen-campaign.operativeState[doctor].medkits};
  }
  order({type:'travel',sector:'cordoba'});defendDepot();
 }
 order({type:'selectSquad',id:support});order({type:'squad',ids:supportIds});
 for(const operativeId of supportIds)order({type:'assignCare',operativeId,assignment:'active'});
 campaign=finishReloadsBeforeMarch(campaign,{report});
 if(reliefSquad)order({type:'selectSquad',id:reliefSquad});else order({type:'createSquad',name:'Rescate del norte',ids:fieldIds});const field=campaign.activeSquadId;
 for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
 campaign=finishReloadsBeforeMarch(campaign,{report});
 // The relief doctors have already marched from the south. Rest the force
 // overnight, and defend the depot if a visible raiding column approaches.
 // Once the squads are in transit, they cannot defend the local reserve.
 const staging={startHour:campaign.hour,departureHour:null,defenses:earlyDefenses,renewals:earlyRenewals,corridor};
 const deploying=[...fieldIds,...supportIds],earliestDeparture=campaign.hour+(24-campaign.hour%24)%24;
 for(const operativeId of deploying)order({type:'assignCare',operativeId,assignment:'rest'});
 const renew=()=>{for(const id of deploying){const contract=campaign.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt-campaign.hour<=14){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});staging.renewals.push({id,cost:cash-campaign.resources.treasury,hour:campaign.hour});}}};
 for(let i=0;i<48;i++){
  if(campaign.pendingEncounter){
   const encounter=structuredClone(campaign.pendingEncounter),group=structuredClone(campaign.enemyGroups.find(group=>group.id===encounter.groupId));
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   assert.deepEqual(campaign.pendingBattle.enemies,group.units,'the defense uses the actual arriving group');
   const defense=fightNorthernSector(campaign,encounter.sector,{controller:northernCombatOrder,report});campaign=defense.campaign;
   staging.defenses.push({groupId:group.id,...defense.summary});
   for(const id of deploying){assert.equal(campaign.operativeState[id].alive,true,'the rescue needs its surviving paid force');order({type:'assignCare',operativeId:id,assignment:'rest'});}
   continue;
  }
  const approach=campaign.enemyGroups.some(group=>group.target==='cordoba'&&['marching','waiting'].includes(group.status));
  if(campaign.hour>=earliestDeparture&&!approach&&deploying.every(id=>campaign.operativeState[id].energy===100))break;
  renew();order({type:'wait',hours:1});
 }
 assert.equal(campaign.pendingEncounter,null);assert.ok(deploying.every(id=>campaign.operativeState[id].energy===100),'the rescue departs after actual rest');
 renew();staging.departureHour=campaign.hour;
 for(const operativeId of deploying)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'selectSquad',id:support});campaign=finishReloadsBeforeMarch(campaign,{report});
 order({type:'selectSquad',id:field});campaign=finishReloadsBeforeMarch(campaign,{report});
 order({type:'selectSquad',id:support});order({type:'attack',sector:'tucuman',queue:true});order({type:'selectSquad',id:field});order({type:'attack',sector:'tucuman',queue:true});
 for(let i=0;i<24&&![field,support].every(id=>campaign.squads.find(q=>q.id===id).journey?.status==='ready');i++){assert.equal(campaign.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'tucuman'});
 for(const {id,record} of captives)assert.deepEqual(campaign.operativeState[id],record);
 const battle=enterSector(campaign.pendingBattle,campaign.sectorStates.tucuman);assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
 report({event:'rescuePrepared',hour:campaign.hour,units:campaign.pendingBattle.squad.map(u=>u.id),cash:campaign.resources.treasury,hired,hiringCost,medicalPurchases,fieldIds,supportIds,staging});return {campaign,events,captives,hired,hiringCost,medicalPurchases,fieldIds,supportIds,supportHires,staging};
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
