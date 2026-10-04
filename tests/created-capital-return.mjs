import {prepareRouteBattery,prepareRouteMixedBattery} from './route-battery.mjs';
import {finiteBatteryDriver} from './finite-battery-driver.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {repairRouteFirearms} from './finite-route-equipment.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {restoreFinalMorale} from './final-campaign-route.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {decodeSave,encodeSave} from '../game/save.js';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {actBattle,artilleryContact,teamCanSee,stanceCost,getReachable,hasLineOfSight} from '../game/tactical.js';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
// The naval occupation separates the Retiro rear guard from the river column.
// Recover and equip each group on its own side, then use a coordinated assault.
export function prepareCreatedCapitalReturn(start,{report=()=>{},fieldSize=6,preparedFieldIds=null,useStoredBattery=false}={}){
 assert.ok([4,6].includes(fieldSize),'a real relief battery has two or three complete pairs');
 const batterySize=fieldSize/2;
 const returning=start.recruited.filter(id=>{const r=start.operativeState[id];return r.alive&&!r.captured&&r.location==='santa_fe';});
 let c=recoverFreshPort(start,{hospital:'cordoba',fieldIds:preparedFieldIds?[57,...preparedFieldIds]:returning});
 const rear=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='retiro';}),field=c.recruited.filter(id=>{const r=c.operativeState[id];return id!==57&&r.alive&&!r.captured&&r.location==='cordoba'&&(preparedFieldIds?preparedFieldIds.includes(id):(c.contracts[id].expiresAt===null||contractQuote(c,rosterFor(c).find(o=>o.id===id),'day').price<=routeHiringCeiling(c,100)));});
 if(preparedFieldIds){assert.equal(preparedFieldIds.length+rear.length,fieldSize);assert.equal(new Set([...preparedFieldIds,...rear]).size,fieldSize);assert.deepEqual([...field].sort((a,b)=>a-b),[...preparedFieldIds].sort((a,b)=>a-b));for(const id of [...field,...rear])assert.ok(c.contracts[id].expiresAt===null||c.contracts[id].expiresAt>c.hour,'every explicitly prepared paid actor must be in actual active service');}
 const order=a=>{
  if(a.type==='wait')for(const id of [...field,...rear]){let contract=c.contracts[id];while(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;contract=c.contracts[id];}}
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 report({stage:'capitalCare',hour:c.hour,field});
 for(const id of rear){const r=c.operativeState[id];assert.ok(r.alive);assert.equal(r.location,'retiro');assert.equal(r.hp,r.maxHp);order({type:'assignCare',operativeId:id,assignment:'rest'});}
 const missing=fieldSize-rear.length-field.length;assert.ok(missing>=0,'the actual field and rear guard must fit the selected relief');
 const candidates=rosterFor(c).filter(o=>{const r=c.operativeState[o.id],q=contractQuote(c,o,'day');return o.id>=100&&o.id<1000&&r.alive&&!r.captured&&!c.recruited.includes(o.id)&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=65&&q.available;}).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,missing);
 assert.equal(candidates.length,missing,'every missing battery role requires an actual available living replacement');
 // Restore retained veterans and bank the current first-day quotes plus two
 // renewals before the short-term relief signs. Its paid time then covers
 // actual arrival, finite equipment, rest and the coordinated assault.
 if(candidates.length){
  for(const id of [...field,...rear])order({type:'assignCare',operativeId:id,assignment:'rest'});
  const required=4000+3*candidates.reduce((sum,op)=>sum+contractQuote(c,op,'day').price,0),fundingStart=c.hour;
  for(let n=0;n<3000&&c.hour-fundingStart<24000&&c.resources.treasury<required;n++){
   assert.equal(c.pendingEncounter,null);
   const untilExpiry=Math.min(...[...field,...rear].map(id=>c.contracts[id]?.expiresAt==null?Infinity:c.contracts[id].expiresAt-c.hour-1));
   order({type:'wait',hours:Math.max(1,Math.min(24-c.hour%24,untilExpiry))});
  }
  assert.ok(c.resources.treasury>=required,'ordinary income must fund the actual relief quotes and equipment');
  assert.ok([...field,...rear].every(id=>c.operativeState[id].morale>=65),'retained veterans must recover morale through their actual funded rest');
  report({event:'capitalQuotedReliefFunded',hour:c.hour,treasury:c.resources.treasury,required,relief:candidates.map(op=>({id:op.id,price:contractQuote(c,op,'day').price}))});
 }
 for(const op of candidates){const quote=contractQuote(c,op,'day'),money=c.resources.treasury;assert.equal(quote.available,true,quote.reason);order({type:'recruitCivic',id:op.id,term:'day',destination:'cordoba'});assert.equal(c.resources.treasury,money-quote.price);field.push(op.id);}
 for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
 assert.equal(field.length,fieldSize-rear.length);assert.ok(field.every(id=>c.recruited.includes(id)));
 order({type:'createSquad',name:'Auxilio del puerto',ids:field,sector:'cordoba'});const main=c.activeSquadId;
 c=restoreFinalMorale(c);report({stage:'capitalRest',hour:c.hour,treasury:c.resources.treasury,field});
 let support=null;
 if(rear.length){order({type:'createSquad',name:'Retiro',ids:rear,sector:'retiro'});support=c.activeSquadId;}
 const rearm=()=>{
  for(const operativeId of c.squad){
   const op=rosterFor(c).find(o=>o.id===operativeId);
   if(c.operativeState[operativeId].weaponDropped||![1800,1801,1802].includes(op.weapon)){
    c=recoverRoutePrimary(c,operativeId,{preferredWeapon:1801,replace:true,report});
   }
  }
  c=supplyRouteAmmunition(c,c.squad,{target:16}).campaign;
  const reserves=Object.fromEntries([...field,...rear].map(id=>[id,5]));
  for(const operativeId of c.squad){if(c.operativeState[operativeId].medkits<5)c=supplyRouteDressings(c,operativeId,5,{reserves,report});order({type:'assignCare',operativeId,assignment:'active'});}
  assert.ok(c.squad.every(id=>c.operativeState[id].medkits>=5));
  c=finishReloadsBeforeMarch(c);
 };
 order({type:'configureArtillery',types:[]});if(rear.length)rearm();
 order({type:'selectSquad',id:main});rearm();
 for(const operativeId of [...field,...rear])order({type:'assignCare',operativeId,assignment:'rest'});
 if(useStoredBattery)assert.ok((c.artilleryDepots.cordoba??[]).filter(gun=>gun.type==='bronze4').length>=batterySize,'the pre-funded relief must already own its exact local guns');
 const battery=prepareRouteBattery(c,Array(batterySize).fill('bronze4'),{destination:'san_nicolas',report});c=battery.campaign;
 for(const operativeId of [...field,...rear])order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&(c.hour%24!==6||[...field,...rear].some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100));h++)order({type:'wait',hours:1});
 for(const operativeId of [...field,...rear])order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:battery.selections});
 if(c.location!=='san_nicolas')order({type:'travel',sector:'san_nicolas',queue:true,mode:'posta'});
 for(let h=0;h<48&&c.squads.find(q=>q.id===main).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 const assaults=[main,...(support?[support]:[])];
 for(const id of assaults){order({type:'selectSquad',id});order({type:'attack',sector:'buenos_aires',queue:true,mode:'posta'});}
 for(let h=0;h<24&&!assaults.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'buenos_aires'});
 assert.equal(c.pendingBattle.squad.length,fieldSize);assert.equal(c.operativeState[57].location,'cordoba');
 assert.deepEqual(c.pendingBattle.artillery.filter(g=>!g.stationed).map(g=>g.type),Array(batterySize).fill('bronze4'));
 report({event:'capitalReliefReady',hour:c.hour,fieldSize,batterySize,field,rear});
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

// The high-pass survivors return through the friendly road for finite town
// treatment. Keep command with the last gun crew: his actual local leadership
// matters when the field survivors have low morale after their losses.
export function prepareCreatedFinalCapitalReturn(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=c.squad.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured;});
 assert.ok(field.includes(57)&&field.length>=3&&field.length<=6,'the final relief must use command and at least two actual high-pass survivors');
 const roster=rosterFor(c),support=field.filter(id=>id!==57).sort((a,b)=>roster.find(op=>op.id===b).medical-roster.find(op=>op.id===a).medical||a-b),doctorId=support[0],reliefId=support[1];
 assert.ok(roster.find(op=>op.id===doctorId).medical>=20,'a living qualified field doctor must remain for the final return');
 const events=[],before=structuredClone(c);
 const order=action=>{
  if(action.type==='wait')for(const id of field){
   while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+action.hours){
    order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
   }
  }
  const money=c.resources.treasury,next=dispatchCampaign(c,action);
  assert.equal(next.lastError,null,JSON.stringify(action)+' '+next.lastError);
  c=decodeSave(encodeSave(next)).campaign;
  events.push({action,hour:c.hour,second:c.secondOfHour,cost:money-c.resources.treasury});
 };
 const rest=limit=>{
  for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
  for(let h=0;h<limit&&field.some(id=>{const r=c.operativeState[id];return r.energy<100||r.fatigue>0||r.asleep;});h++){
   assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
  }
  assert.ok(field.every(id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;}));
 };
 const treat=(patient,doctor,target)=>{
  for(const operativeId of field)order({type:'assignCare',operativeId,assignment:operativeId===patient?'patient':'rest'});
  for(let h=0;h<30&&c.operativeState[patient].hp<target;h++){
   assert.equal(c.pendingEncounter,null);
   if(!c.operativeState[doctor].medkits)c=supplyRouteDressings(c,doctor,(c.operativeState[doctor].medkits??0)+(1),{report});
   order({type:'assignCare',operativeId:doctor,assignment:'doctor'});order({type:'wait',hours:1});
  }
  assert.ok(c.operativeState[patient].hp>=target,'finite local care must reach the stated partial health');
 };
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:[]});
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 const squad=c.activeSquadId;
 for(let h=0;h<60&&c.squads.find(q=>q.id===squad).journey;h++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.location,'cordoba');
 const firstBattery=prepareRouteBattery(c,['bronze4','swivel'],{destination:'cordoba',report});c=firstBattery.campaign;
 for(const id of field.filter(id=>id!==doctorId))treat(id,doctorId,Math.min(65,c.operativeState[id].maxHp));
 const reliefDoctor=field.filter(id=>id!==doctorId).sort((a,b)=>roster.find(op=>op.id===b).medical-roster.find(op=>op.id===a).medical||a-b)[0];
 assert.ok(roster.find(op=>op.id===reliefDoctor).medical>=20,"another actual survivor must provide the field doctor's care");
 treat(doctorId,reliefDoctor,Math.min(65,c.operativeState[doctorId].maxHp));rest(24);
 for(const operativeId of field){
  if(c.operativeState[operativeId].condition<100)c=repairRouteFirearms(c,[operativeId]);
  if(operativeId!==57&&c.operativeState[operativeId].medkits<2)c=supplyRouteDressings(c,operativeId,(c.operativeState[operativeId].medkits??0)+(2-c.operativeState[operativeId].medkits),{report});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:firstBattery.selections});

 // The surviving doctor spends his carried kits first, then recovers each required dressing
 // from actual finite local stocks. The others rest while the command wound heals.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:operativeId===57?'patient':operativeId===doctorId?'doctor':'rest'});
 for(let h=0;h<12&&c.operativeState[57].hp<60;h++){
  assert.equal(c.pendingEncounter,null);
  if(!c.operativeState[doctorId].medkits)c=supplyRouteDressings(c,doctorId,(c.operativeState[doctorId].medkits??0)+(1),{report});
  order({type:'wait',hours:1});
 }
 assert.ok(c.operativeState[57].hp>=60);rest(8);
 for(const operativeId of field){
  if(c.operativeState[operativeId].medkits<2)c=supplyRouteDressings(c,operativeId,(c.operativeState[operativeId].medkits??0)+(2-c.operativeState[operativeId].medkits),{report});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 const finalBattery=prepareRouteMixedBattery(c,3,{destination:'san_nicolas',report});c=finalBattery.campaign;order({type:'configureArtillery',types:finalBattery.selections});
 const medicalTargets=Object.fromEntries(field.map(id=>[id,(c.operativeState[id].medkits??0)+7]));
 for(const operativeId of field)c=supplyRouteDressings(c,operativeId,medicalTargets[operativeId],{reserves:medicalTargets,report});
 assert.ok(field.every(id=>c.operativeState[id].medkits>=medicalTargets[id]));
 c=prepareFinalAssault(c,{staging:'san_nicolas',target:'buenos_aires'});
 assert.ok(c.pendingBattle&&c.pendingBattle.squad.every(u=>u.hp>=60));
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'finalCapitalReady',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field,doctorId,reliefId,events});
 return c;
}

// Each real light piece has its own arriving operator. Keep command close
// while the crew fires, treat actual wounds, and search legal map quadrants
// when no current visible target remains.
export function createdFinalCapitalBattery(initial){
 const guns=initial.artillery.filter(g=>g.side==='player'&&!g.stationed);
 assert.equal(guns.length,3);
 if(guns.some(g=>g.type!=='swivel'))return finiteBatteryDriver(initial,{gunIds:guns.map(g=>g.id)});
 const arrivingIds=new Set(sectorDeploymentModel(initial)?.units.map(unit=>unit.id));
 const players=initial.units.filter(unit=>arrivingIds.has(unit.id)&&unit.side==='player'&&unit.hp>=15&&!unit.routed&&!unit.unconscious&&!unit.departure);
 const doctors=players.filter(unit=>unit.id!=='57').sort((a,b)=>b.medical-a.medical||Number(a.id)-Number(b.id)),doctorId=doctors[0]?.id;
 const crewIds=['57',...doctors.slice(0,2).map(unit=>unit.id)];assert.equal(crewIds.length,3,'three actual capable survivors must operate the finite final battery');
 const assigned=new Map(crewIds.map((id,i)=>[id,guns[i].id]));
function deploy(start){
 let battle=start;const model=sectorDeploymentModel(start),occupied=new Set();assert.ok(model);
 for(const [i,id] of crewIds.entries()){
  const unit=model.units.find(u=>u.id===id),gun=battle.artillery.find(g=>g.id===assigned.get(id));assert.ok(unit&&gun);
  const desired={x:gun.x+(i===1?-1:i===2?1:0),y:gun.y-Number(id==='57')};
  const point=model.entryCells[unit.edge].filter(p=>!occupied.has(`${p.x},${p.y}`)).sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y)||a.y-b.y||a.x-b.x)[0];assert.ok(point);
  battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[id],x:point.x,y:point.y});assert.equal(battle.lastError,null);occupied.add(`${point.x},${point.y}`);
 }
 battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null);return battle;
}
const controller=(battle,unit)=>{
 const gun=battle.artillery.find(g=>g.id===assigned.get(unit.id));if(!gun)return tucumanCombatOrder(battle,unit);
 const targets=battle.units.filter(v=>v.side!==unit.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(battle,unit.side,v));
 let action;
 {
  const normal=tucumanCombatOrder(battle,unit),command=battle.units.find(u=>u.id==='57');
  if(normal?.type==='useItem'||normal?.slot==='medical')return normal;
  if(unit.id===doctorId&&command.hp>0&&command.hp<15&&!command.departure&&unit.medkits>0&&battle.phase==='player'){
   const view={...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v))};
   const point=getReachable(view,unit).filter(p=>p.cost>0&&Math.hypot(p.x-command.x,p.y-command.y)<=1.5&&hasLineOfSight(view,p,command)).sort((a,b)=>a.cost-b.cost)[0];
   if(point)return {type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0};
  }
  if(unit.id==='57'&&unit.hp<=50&&battle.phase==='player'&&targets.length){
   const field=battle.units.filter(u=>crewIds.slice(1).includes(u.id)&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure),view={...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v))};
   const tile=p=>battle.tiles.find(t=>t.x===p.x&&t.y===p.y),score=p=>(tile(p)?.cover??0)*.5-targets.filter(t=>hasLineOfSight(view,t,p)).length*25;
   const point=getReachable(view,unit).filter(p=>p.cost>0&&p.cost<=Math.min(30,unit.ap)&&(p.tacticalLevel??0)===(unit.tacticalLevel??0)&&field.every(u=>Math.hypot(p.x-u.x,p.y-u.y)<=6)&&score(p)>score(unit)+5).sort((a,b)=>score(b)-score(a)||a.cost-b.cost)[0];
   if(point)return {type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0};
   if(unit.stance!=='prone'&&unit.ap>=stanceCost(unit,'prone'))return {type:'stance',unitId:unit.id,stance:'prone'};
   return normal?.type==='stance'&&normal.stance!=='prone'?null:normal;
  }
 }
 if(battle.turn>=8&&!targets.length&&battle.phase==='player'){
  const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((battle.turn-8)/2)%corners.length],goal={x:Math.floor(battle.width*corner[0]),y:Math.floor(battle.height*corner[1])},distance=p=>Math.hypot(p.x-goal.x,p.y-goal.y);
  if(distance(unit)>3){
   if(unit.stance!=='standing'&&unit.ap>=stanceCost(unit,'standing'))action={type:'stance',unitId:unit.id,stance:'standing'};
   else {const view={...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v))},point=getReachable(view,unit).filter(p=>p.cost>0&&p.cost<=Math.min(30,unit.ap-20)&&distance(p)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];if(point)action={type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0};}
  }
  return action;
 }
 if(battle.mode==='exploration')action=mountainBatteryOrder(battle,unit,{leaderId:unit.id,helperId:'none',artilleryId:gun.id,routeAroundObstacles:true,keepCrewTogether:true,sharedArtillerySight:true});
 else if((gun.loaded||gun.ammo>0)&&artilleryContact(battle,unit,gun)&&unit.stance!=='crouched')action=unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 else action=teamArtilleryOrder({...battle,artillery:[gun]},unit,targets)??tucumanCombatOrder(battle,unit);
 if(battle.mode==='combat'&&(gun.loaded||gun.ammo>0)&&artilleryContact(battle,unit,gun)&&(['move','climb','charge','artilleryMove','exit'].includes(action?.type)||action?.type==='stance'&&action.stance==='prone'))action=null;
 if(action&&['move','artilleryMove'].includes(action.type)){
  const preview=actBattle(battle,action);if(preview.lastError)action=null;
  else{
   const command=preview.units.find(u=>u.id==='57');if(preview.units.some(u=>crewIds.slice(1).includes(u.id)&&u.hp>=15&&!u.routed&&!u.departure&&Math.hypot(u.x-command.x,u.y-command.y)>5))action=null;
  }
 }
 return action;
};
 return {deploy,controller};
}
