import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {equipmentCatalog,equipmentKey} from '../game/equipment-catalog.js';
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
 const rear=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='retiro';}),field=c.recruited.filter(id=>{const r=c.operativeState[id];return id!==57&&r.alive&&!r.captured&&r.location==='cordoba'&&(preparedFieldIds?preparedFieldIds.includes(id):(c.contracts[id].expiresAt===null||contractQuote(c,rosterFor(c).find(o=>o.id===id),'day').price<=100));});
 if(preparedFieldIds){assert.equal(preparedFieldIds.length,fieldSize);assert.equal(new Set(preparedFieldIds).size,fieldSize);assert.deepEqual([...field].sort((a,b)=>a-b),[...preparedFieldIds].sort((a,b)=>a-b));for(const id of field)assert.ok(c.contracts[id].expiresAt===null||c.contracts[id].expiresAt>c.hour,'every explicitly prepared paid actor must be in actual active service');}
 const order=a=>{
  if(a.type==='wait')for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;}}
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 report({stage:'capitalCare',hour:c.hour,field});
 for(const id of rear){const r=c.operativeState[id];assert.ok(r.alive);assert.equal(r.location,'retiro');assert.equal(r.hp,r.maxHp);order({type:'assignCare',operativeId:id,assignment:'rest'});}
 const candidates=rosterFor(c).filter(o=>{const r=c.operativeState[o.id],q=contractQuote(c,o,'day');return o.id>=100&&o.id<1000&&r.alive&&!r.captured&&!c.recruited.includes(o.id)&&r.hp===r.maxHp&&q.available&&q.price<=100;}).sort((a,b)=>b.marksmanship-a.marksmanship);
 for(const op of candidates.slice(0,fieldSize-rear.length-field.length)){order({type:'recruitCivic',id:op.id,term:'week',destination:'cordoba'});field.push(op.id);}
 for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
 assert.equal(field.length,fieldSize-rear.length);assert.ok(field.every(id=>c.recruited.includes(id)));
 order({type:'createSquad',name:'Auxilio del puerto',ids:field,sector:'cordoba'});const main=c.activeSquadId;
 c=restoreFinalMorale(c);report({stage:'capitalRest',hour:c.hour,treasury:c.resources.treasury,field});
 const rifle=equipmentKey(equipmentCatalog(c).find(i=>i.id===1801));
 let support=null;
 if(rear.length){order({type:'createSquad',name:'Retiro',ids:rear,sector:'retiro'});support=c.activeSquadId;}
 const rearm=()=>{
  for(const operativeId of c.squad){
   const op=rosterFor(c).find(o=>o.id===operativeId);
   if(c.operativeState[operativeId].weaponDropped||![1800,1801,1802].includes(op.weapon)){
    for(let h=0;h<48&&!c.merchants[c.location].stock[rifle];h++)order({type:'wait',hours:1});
    order({type:'purchaseEquipment',item:rifle});order({type:'equip',operativeId,slot:'weapon',itemId:rifle});
   }
  }
  c=supplyRouteAmmunition(c,c.squad,{target:16}).campaign;
  for(const operativeId of c.squad){if(c.operativeState[operativeId].medkits<5)order({type:'purchaseMedicalSupplies',operativeId,quantity:5-c.operativeState[operativeId].medkits});order({type:'assignCare',operativeId,assignment:'active'});}
  c=finishReloadsBeforeMarch(c);
 };
 order({type:'configureArtillery',types:[]});if(rear.length)rearm();
 order({type:'selectSquad',id:main});rearm();
 for(const operativeId of [...field,...rear])order({type:'assignCare',operativeId,assignment:'rest'});
 if(useStoredBattery)assert.ok(c.armory.bronze4>=batterySize,'the pre-funded relief must already own its real battery');
 else for(let n=0;n<batterySize;n++){
  for(let h=0;h<48&&!c.merchants.cordoba.stock.bronze4;h++)order({type:'wait',hours:1});
  order({type:'purchaseEquipment',item:'bronze4'});
 }
 for(let h=0;h<48&&(c.hour%24!==6||[...field,...rear].some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100));h++)order({type:'wait',hours:1});
 for(const operativeId of [...field,...rear])order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:Array(batterySize).fill('bronze4')});
 order({type:'travel',sector:'san_nicolas',queue:true,mode:'posta'});
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
 assert.deepEqual(field,[57,146,147],'the final relief uses the actual high-pass survivors');
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
   if(!c.operativeState[doctor].medkits)order({type:'purchaseMedicalSupplies',operativeId:doctor,quantity:1});
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
 for(const item of ['bronze4','swivel']){
  assert.ok(c.merchants.cordoba.stock[item]>0,'the final battery must be present in finite town stock');
  order({type:'purchaseEquipment',item});
 }
 treat(147,146,65);treat(146,57,65);rest(24);
 for(const operativeId of field){
  if(c.operativeState[operativeId].condition<100)order({type:'repairWeapon',operativeId});
  if(operativeId!==57&&c.operativeState[operativeId].medkits<2)order({type:'purchaseMedicalSupplies',operativeId,quantity:2-c.operativeState[operativeId].medkits});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:['bronze4','swivel']});
 // A second finite swivel restocks during the field treatment.
 order({type:'purchaseEquipment',item:'swivel'});
 // Doctor 146 spends his carried kits first, then buys each required dressing
 // from actual local stock. The others rest while the command wound heals.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:operativeId===57?'patient':operativeId===146?'doctor':'rest'});
 for(let h=0;h<12&&c.operativeState[57].hp<60;h++){
  assert.equal(c.pendingEncounter,null);
  if(!c.operativeState[146].medkits)order({type:'purchaseMedicalSupplies',operativeId:146,quantity:1});
  order({type:'wait',hours:1});
 }
 assert.ok(c.operativeState[57].hp>=60);rest(8);
 for(const operativeId of field){
  if(c.operativeState[operativeId].medkits<2)order({type:'purchaseMedicalSupplies',operativeId,quantity:2-c.operativeState[operativeId].medkits});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 for(let h=0;h<2&&!c.merchants.cordoba.stock.swivel;h++)order({type:'wait',hours:1});
 assert.ok(c.merchants.cordoba.stock.swivel>0,'the third light gun must restock through actual elapsed care and waiting');
 order({type:'purchaseEquipment',item:'swivel'});
 order({type:'configureArtillery',types:['swivel','swivel','swivel']});
 for(const operativeId of field)order({type:'purchaseMedicalSupplies',operativeId,quantity:7});
 c=prepareFinalAssault(c,{staging:'san_nicolas',target:'buenos_aires'});
 assert.ok(c.pendingBattle&&c.pendingBattle.squad.every(u=>u.hp>=60));
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'finalCapitalReady',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field,events});
 return c;
}

// Each real light piece has its own arriving operator. Keep command close
// while the crew fires, treat actual wounds, and search legal map quadrants
// when no current visible target remains.
export function createdFinalCapitalBattery(initial){
 const guns=initial.artillery.filter(g=>g.side==='player'&&!g.stationed);
 assert.equal(guns.length,3);assert.ok(guns.every(g=>g.type==='swivel'));
 const assigned=new Map(['57','146','147'].map((id,i)=>[id,guns[i].id]));
function deploy(start){
 let battle=start;const model=sectorDeploymentModel(start),occupied=new Set();assert.ok(model);
 for(const id of ['57','146','147']){
  const unit=model.units.find(u=>u.id===id),gun=battle.artillery.find(g=>g.id===assigned.get(id));assert.ok(unit&&gun);
  const desired={x:gun.x+(id==='146'?-1:id==='147'?1:0),y:gun.y-Number(id==='57')};
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
  if(unit.id==='146'&&command.hp>0&&command.hp<15&&!command.departure&&unit.medkits>0&&battle.phase==='player'){
   const view={...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v))};
   const point=getReachable(view,unit).filter(p=>p.cost>0&&Math.hypot(p.x-command.x,p.y-command.y)<=1.5&&hasLineOfSight(view,p,command)).sort((a,b)=>a.cost-b.cost)[0];
   if(point)return {type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0};
  }
  if(unit.id==='57'&&unit.hp<=50&&battle.phase==='player'&&targets.length){
   const field=battle.units.filter(u=>['146','147'].includes(u.id)&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure),view={...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v))};
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
   const command=preview.units.find(u=>u.id==='57');if(preview.units.some(u=>['146','147'].includes(u.id)&&u.hp>=15&&!u.routed&&!u.departure&&Math.hypot(u.x-command.x,u.y-command.y)>5))action=null;
  }
 }
 return action;
};
 return {deploy,controller};
}
