import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,firearmRepairCost} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {primaryAmmoTypeFor} from '../game/ammo-types.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {fightNorthernSector,northernCombatOrder} from './northern-route.mjs';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {heavyContactCrewController,stableCrewController} from './stable-crew-driver.mjs';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {deployHighPassBattery} from './command-reserve-driver.mjs';
import {equipRecoveryCapitalProtection} from './recovery-capital-protection.mjs';
import {collectReturnedServiceKit} from './returned-service-kit.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';

const saved=c=>decodeSave(encodeSave(c)).campaign;
const seconds=c=>c.hour*3600+(c.secondOfHour??0);

// This continuation selects the current survivors and real contract quotes.
// The older fixed northern fixture still checks its own declared roster.
export function continueQuotedNorthernRoute(start,{report=()=>{},fieldSize=5,fundingHours=48000,prepaidColumn=null}={}){
 assert.ok(Number.isInteger(fieldSize)&&fieldSize>=4&&fieldSize<=5,'the paid field force has four or five actual actors');
 assert.ok(Number.isInteger(fundingHours)&&fundingHours>0&&fundingHours<=72000,'ordinary preparation has a bounded relative clock');
 const columnSize=fieldSize+1;
 const original=structuredClone(start),dead=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 let c=prepaidColumn?saved(start):recoverFreshPort(start,{hospital:'cordoba',fieldIds:start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),report});
 const verify=()=>{assert.equal(c.defeated,false);assert.ok(c.operativeState[57].alive);for(const id of dead)assert.equal(c.operativeState[id].alive,false);};
 let protectedIds=[];
 const order=action=>{
  if(action.type==='wait')for(const id of protectedIds){
   while(c.recruited.includes(id)&&c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+action.hours){
    const quote=contractQuote(c,rosterFor(c).find(o=>o.id===id),'week'),cash=c.resources.treasury;
    c=dispatchCampaign(c,{type:'renewContract',id,term:'week',expectedExpiresAt:c.contracts[id].expiresAt});assert.equal(c.lastError,null,c.lastError);assert.equal(c.resources.treasury,cash-quote.price);
   }
  }
  c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);verify();
  if(action.type==='wait'&&!c.pendingBattle&&!c.pendingEncounter&&c.location==='cordoba'){
   const carriers=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
   c=collectReturnedServiceKit(c,'cordoba',carriers,{report});
  }
 };
 const waitUntil=(limit,ready,batch=false)=>{
  const began=c.hour,end=c.hour+limit;let stalled=0,lastReport=began;
  while(!ready()&&c.hour<end){
   assert.equal(c.pendingEncounter,null,'resolve the actual northern encounter before waiting');
   const before=c.hour;order({type:'wait',hours:batch?Math.min(24-c.hour%24,end-c.hour):1});
   stalled=c.hour===before?stalled+1:0;assert.ok(stalled<8,'an acknowledged notice must allow a new clock request');
   if(c.hour-lastReport>=1200){lastReport=c.hour;report({event:'quotedPreparationClock',campaign:c,elapsedHours:c.hour-began});}
  }
  assert.ok(ready(),JSON.stringify({reason:'ordinary paid preparation must reach its stated condition',hour:c.hour,treasury:c.resources.treasury,blockade:c.blockade}));
 };
 const local=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
 if(!prepaidColumn)for(const operativeId of local())order({type:'assignCare',operativeId,assignment:'rest'});
 // Keep inexpensive local veterans resting. Expensive completed relief
 // terms may expire normally before the ordinary income savings period.
 if(!prepaidColumn)protectedIds=local().filter(id=>contractQuote(c,rosterFor(c).find(o=>o.id===id),'day').price<=600);
 const choose=()=>{
  const roster=rosterFor(c),present=local().filter(id=>{const r=c.operativeState[id];return r.hp===r.maxHp&&!r.bleeding;});
  const field=present.filter(id=>c.contracts[id]?.expiresAt===null).sort((a,b)=>Number(b===57)-Number(a===57)||a-b).slice(0,columnSize);
  const candidates=roster.filter(o=>{
   const r=c.operativeState[o.id],q=contractQuote(c,o,'month');
   return !field.includes(o.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&q.available&&(present.includes(o.id)||o.id>=100&&o.id<1000&&!c.recruited.includes(o.id));
  }).sort((a,b)=>contractQuote(c,a,'month').price-contractQuote(c,b,'month').price||b.medical-a.medical||b.marksmanship-a.marksmanship||a.id-b.id);
  field.push(...candidates.slice(0,columnSize-field.length).map(o=>o.id));
  assert.ok(field.includes(57));assert.equal(field.length,columnSize,'the quoted field actors and their rear commander form the actual northern column');
  return field;
 };
 const required=()=>12000+choose().reduce((sum,id)=>sum+contractQuote(c,rosterFor(c).find(o=>o.id===id),'month').price,0);
 let column,field,hiring,fundedAt;
 if(prepaidColumn){
  field=[...prepaidColumn.field];column=[57,...field];hiring=structuredClone(prepaidColumn.hiring);
  assert.equal(field.length,fieldSize);assert.deepEqual([...c.squad].sort((a,b)=>a-b),[...column].sort((a,b)=>a-b));
  for(const id of column)assert.ok(local().includes(id),'the exact prepaid column must actually be at Córdoba');
  for(const receipt of hiring){assert.ok(field.includes(receipt.id));assert.equal(c.contracts[receipt.id].term,'month');assert.equal(c.contracts[receipt.id].paid,receipt.price);assert.equal(c.contracts[receipt.id].expiresAt,receipt.expiresAt);}
  fundedAt=Math.min(...hiring.map(r=>c.contracts[r.id].started*3600+(c.contracts[r.id].startedSecond??0)));
 }else{
  report({event:'quotedNorthernBudget',campaign:c,field:choose().filter(id=>id!==57),requiredFunds:required(),fundingHours});
  waitUntil(fundingHours,()=>c.resources.treasury>=required(),true);
  column=choose();field=column.filter(id=>id!==57);hiring=[];fundedAt=seconds(c);
  for(const id of column){
  const op=rosterFor(c).find(o=>o.id===id),quote=contractQuote(c,op,'month'),cash=c.resources.treasury;
  if(quote.permanent)continue;
  const serving=c.recruited.includes(id);
  order(serving?{type:'renewContract',id,term:'month',expectedExpiresAt:c.contracts[id].expiresAt}:{type:'recruitCivic',id,term:'month',destination:'cordoba'});
  assert.equal(c.resources.treasury,cash-quote.price);
  hiring.push({id,serving,price:quote.price,hour:c.hour});
  }
  protectedIds=[];
  waitUntil(24,()=>column.every(id=>c.recruited.includes(id)));
  for(const receipt of hiring)receipt.expiresAt=c.contracts[receipt.id].expiresAt;
  order({type:'createSquad',name:'Supervivientes del Norte',ids:column,sector:'cordoba'});
 }
 const deadlineSeconds=Math.min(...field.map(id=>contractExpiresSeconds(c.contracts[id])??Infinity)),deadline=deadlineSeconds/3600;assert.ok(deadlineSeconds>=fundedAt+720*3600);
 report({event:'quotedNorthernColumn',campaign:c,field,hiring,deadline});

 const care=()=>{
  const ids=[...c.squad];
  for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'visitSector'});const aid=autoBandageBattle(enterSector(c.pendingBattle,c.sectorStates[c.location]));
  const pair=syncBattleTime(c,aid.battle);assert.equal(pair.error,null);c=pair.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
  for(const id of ids){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
  for(let hour=0;hour<120&&ids.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);hour++){
   const patients=ids.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),roster=rosterFor(c);
   const doctors=ids.filter(id=>roster.find(o=>o.id===id).medical>=20&&c.operativeState[id].energy>10&&!c.operativeState[id].asleep).sort((a,b)=>Number(patients.includes(a))-Number(patients.includes(b))||roster.find(o=>o.id===b).medical-roster.find(o=>o.id===a).medical);
   const doctor=doctors.find(id=>patients.some(p=>p!==id));
   if(doctor===undefined){for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});order({type:'wait',hours:1});continue;}
   if(!c.operativeState[doctor].medkits){
    if(c.location==='cordoba')order({type:'purchaseMedicalSupplies',operativeId:doctor,quantity:1});
    else{
     const donor=ids.find(id=>id!==doctor&&c.operativeState[id].medkits>2);
     if(donor!==undefined)order({type:'sectorInventory',sector:c.location,operativeId:donor,direction:'drop',item:'medkits',count:Math.min(5,c.operativeState[donor].medkits-2)});
     const model=sectorInventoryModel(c,c.location,rosterFor(c),doctor),row=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
     assert.ok(row,'forward treatment must use real carried or battlefield dressing reserves');
     const count=Math.min(5,row.count),before=c.operativeState[doctor].medkits;
     order({type:'sectorInventory',sector:c.location,operativeId:doctor,direction:'take',sourceKey:row.key,expected:row.expected,count});
     assert.equal(c.operativeState[doctor].medkits,before+count);assert.equal(sectorInventoryModel(c,c.location,rosterFor(c),doctor).entries.find(next=>next.key===row.key)?.count??0,row.count-count);
    }
   }
   for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:operativeId===doctor?'doctor':patients.includes(operativeId)?'patient':'rest'});
   order({type:'wait',hours:1});
  }
  for(const id of ids){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);order({type:'assignCare',operativeId:id,assignment:'rest'});}
  waitUntil(480,()=>ids.every(id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep&&r.morale>=50;}));
  for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
  report({event:'quotedNorthernCare',campaign:c,field:ids,aidDressings:aid.steps.filter(a=>a.type==='useItem').length});
 };
 const prepare=(target,types)=>{
  // The prepaid physician stays with the forward column. Treat and
  // resupply at the captured friendly province instead of leaving it empty.
  care();
  if(c.location==='cordoba')c=equipRecoveryCapitalProtection(c,c.squad,{report});
  for(const operativeId of c.squad){
   const op=rosterFor(c).find(o=>o.id===operativeId);
   if(c.operativeState[operativeId].weaponDropped||!primaryAmmoTypeFor(op)){
    waitUntil(48,()=>c.merchants[c.location].stock[1801]>0);
    order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});
   }
   if(c.location==='cordoba'&&firearmRepairCost(c.operativeState[operativeId]))order({type:'repairWeapon',operativeId});
   const needed=Math.max(0,2-c.operativeState[operativeId].medkits);if(c.location==='cordoba'&&needed)order({type:'purchaseMedicalSupplies',operativeId,quantity:needed});
  }
  if(c.location==='cordoba')c=supplyRouteAmmunition(c,c.squad,{target:40,report}).campaign;
  order({type:'configureArtillery',types:[]});c=finishReloadsBeforeMarch(c);
  for(const type of new Set(types))assert.ok(c.armory[type]>=types.filter(t=>t===type).length,'each assault issues only its actual reserved finite gun stock');
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
  waitUntil(48,()=>c.hour%24>=6&&c.hour%24<=10&&c.squad.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep));
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'configureArtillery',types});
  const staging={tucuman:'cordoba',salta:'tucuman',jujuy:'salta',humahuaca:'jujuy'}[target];
  c=prepareFinalAssault(c,{staging,target,fieldIds:field.filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured),daylight:true});
  assert.ok(seconds(c)<=deadlineSeconds);verify();report({event:'quotedNorthernAssaultReady',target,campaign:c});
  return c;
 };
 // The issued entry formation is legal and preserves its actual spacing.
 // Moving every actor to the nearest gun can join both crews in one lane.
 const deployment=startBattle=>{
  const model=sectorDeploymentModel(startBattle);if(!model)return startBattle;
  if(startBattle.artillery.some(g=>g.side==='player'&&g.type==='field8'))return deployHighPassBattery(startBattle,{lightId:'147'});
  let battle=startBattle;
  for(const arrival of model.units){
   const unit=startBattle.units.find(u=>u.id===arrival.id);assert.ok(unit);
   battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[unit.id],x:unit.x,y:unit.y});assert.equal(battle.lastError,null);
  }
  battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null);return battle;
 };
 const fight=target=>{
  const initial=deployment(enterSector(c.pendingBattle,c.sectorStates[target],{placement:true}));
  const base=initial.artillery.some(g=>g.side==='player'&&g.type==='field8')?heavyContactCrewController():stableCrewController();
  const controller=(battle,unit)=>{
   if(unit.id!=='57'){const search=sectorSearchOrder(battle,unit);if(search)return search;}
   const action=base(battle,unit);
   if(action?.type==='fire'){const shot=northernCombatOrder(battle,unit);if(shot?.type==='fire')return shot;}
   return action;
  };
  const result=fightNorthernSector(c,target,{deploy:deployment,controller,report});c=result.campaign;verify();assert.ok(seconds(c)<=deadlineSeconds);report({event:'quotedNorthernVictory',target,campaign:c,summary:result.summary});return result;
 };
 // Carry finite medical and cartridge reserves before leaving the real
 // workshop. The northern captured towns do not provide workshop services.
 for(const operativeId of field){
  const target=10;
  while(c.operativeState[operativeId].medkits<target){waitUntil(48,()=>c.merchants.cordoba.supplies.medkits>0);order({type:'purchaseMedicalSupplies',operativeId,quantity:Math.min(20,c.merchants.cordoba.supplies.medkits,target-c.operativeState[operativeId].medkits)});}
 }
 // Buy the actual unused pieces at Córdoba before any captured province
 // is left waiting for later stock. Configuration consumes this finite stock.
 const reserveTypes=['bronze4','bronze4','bronze4','bronze4','bronze4','bronze4','field8','swivel'];
 for(const type of reserveTypes){waitUntil(48,()=>c.merchants.cordoba.stock[type]>0);order({type:'purchaseEquipment',item:type});}
 report({event:'quotedNorthernFiniteReserves',campaign:c,field,types:reserveTypes});
 prepare('tucuman',['bronze4','bronze4']);const recaptured=fight('tucuman');
 prepare('salta',['bronze4','bronze4']);const returnedSalta=fight('salta');
 prepare('jujuy',['bronze4','bronze4']);const jujuy=fight('jujuy');
 const humahuacaReady=prepare('humahuaca',['field8','swivel']),humahuaca=fight('humahuaca');
 assert.deepEqual(start,original,'continuation preserves its input checkpoint');
 assert.deepEqual(saved(c),c);return {recaptured,returnedSalta,jujuy,humahuacaReady,humahuaca,deadline,deadlineSeconds,hiring};
}
