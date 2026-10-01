import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {withdrawCommandToRear,rejoinCommandAfterExit,deployHighPassBattery} from './command-reserve-driver.mjs';
import {coastalSearchController} from './coastal-search-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {recruitFreshNavalCommand,recoverFreshPort,prepareFreshBlockadeAssault,prepareFreshSantaFeAssault} from './fresh-coastal-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {deployInfantryLine} from './battery-deployment-driver.mjs';
import {prepareCreatedCapitalReturn,prepareCreatedFinalCapitalReturn,createdFinalCapitalBattery} from './created-capital-return.mjs';
import {prepareCreatedNorthernRelief,prepareCreatedSaltaReturn,prepareCreatedSaltaDefense,recoverCreatedSaltaDefense,prepareCreatedJujuyReturn,recoverCreatedJujuy,prepareCreatedJujuyDefense,prepareCreatedHumahuacaReturn,stabilizeCreatedHighPass} from './created-northern-return.mjs';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {stableCrewController,heavyContactCrewController} from './stable-crew-driver.mjs';

// Recover the actual mountain survivors before their paid terms end. The
// affordable relief column waits for real arrivals, care, rest and shop stock.
export function prepareCreatedCoastalAssault(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const keep=new Set([57,147,143]),events=[];
 const order=action=>{
  if(action.type==='assignCare'&&c.operativeState[action.operativeId].assignment===action.assignment)return;
  const elapsed=action.type==='wait'?action.hours:action.type==='travel'?24:0;
  if(elapsed)for(const id of keep){
   let contract=c.contracts[id];
   while(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+elapsed){
    const before=c.resources.treasury;
    const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
    assert.equal(next.lastError,null,next.lastError);c=next;
    events.push({action:{type:'renewContract',id},hour:c.hour,cost:before-c.resources.treasury});
    contract=c.contracts[id];
   }
  }
  const before=c.resources.treasury,next=dispatchCampaign(c,action);
  assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
  events.push({action,hour:c.hour,cost:before-c.resources.treasury});
 };
 const waitUntil=(limit,ready,{income=false}={})=>{
  for(let elapsed=0,attempts=0;elapsed<limit&&attempts<limit&&!ready();attempts++){
   assert.equal(c.pendingEncounter,null,'resolve an actual encounter before the coast march');
   const untilExpiry=Math.min(...[...keep].map(id=>c.contracts[id]?.expiresAt==null?Infinity:c.contracts[id].expiresAt-c.hour-1));
   const hours=income?Math.max(1,Math.min(24-c.hour%24,untilExpiry,limit-elapsed)):1,before=c.hour;
   order({type:'wait',hours});elapsed+=c.hour-before;
   if(c.hour===before)assert.ok(c.assignmentAttention.notice||c.contractAttention.notice||c.logisticsNotice,'a paused wait must expose a real notice');
  }
  assert.ok(ready(),'bounded coastal preparation must reach its stated condition');
 };
 assert.equal(c.location,'mendoza');assert.ok(c.operativeState[57].alive);
 order({type:'recruitCivic',id:107,term:'week',destination:'mendoza'});keep.add(107);
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(24,()=>c.recruited.includes(107));
 order({type:'assignCare',operativeId:143,assignment:'patient'});
 const careStart=c.hour,healthBefore=c.operativeState[143].hp;
 for(let h=0;h<36&&c.operativeState[143].hp<c.operativeState[143].maxHp;h++){
  if(!c.operativeState[107].medkits)order({type:'purchaseMedicalSupplies',operativeId:107,quantity:1});
  order({type:'assignCare',operativeId:107,assignment:'doctor'});order({type:'wait',hours:1});
 }
 assert.equal(c.operativeState[143].hp,c.operativeState[143].maxHp);
 order({type:'assignCare',operativeId:143,assignment:'rest'});
 report({event:'mountainSurvivorRecovered',id:143,healthBefore,healthAfter:c.operativeState[143].hp,hours:c.hour-careStart});
 // The former expedition hires leave normally after treatment. Their living
 // records remain intact; they do not become free members of the new column.
 keep.delete(143);keep.delete(147);
 for(const id of [114,139,146]){
  order({type:'recruitCivic',id,term:'week',destination:'mendoza'});keep.add(id);
 }
 waitUntil(24,()=>[114,139,146].every(id=>c.recruited.includes(id)));
 const field=[57,107,114,139,146];order({type:'squad',ids:field});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(600,()=>field.every(id=>{
  const r=c.operativeState[id];return r.morale>=65&&!r.fatigue&&!r.asleep;
 })&&c.resources.treasury>=8500);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,field).battle}));
 order({type:'travel',sector:'buenos_aires',mode:'posta'});
 order({type:'squad',ids:[57,107,114,139]});c=meetRecruits(c,['dorrego','paroissien'],57);
 field.push(4,10);keep.add(4);keep.add(10);
 const groups=[];
 for(let offset=0;offset<field.length;offset+=6){
  order({type:'createSquad',ids:field.slice(offset,offset+6),sector:'buenos_aires',name:'Columna del puerto'});
  groups.push(c.activeSquadId);
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'travel',sector:'retiro',queue:true,mode:'posta'});
 }
 waitUntil(24,()=>groups.every(id=>!c.squads.find(q=>q.id===id).journey));
 for(const id of groups){
  order({type:'selectSquad',id});p=visit(c);
  c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));
  c=supplyRouteAmmunition(c,c.squad,{target:16}).campaign;c=finishReloadsBeforeMarch(c);
 }
 for(let count=0;count<2;count++){
  waitUntil(48,()=>c.merchants.retiro.stock.bronze4>0);
  order({type:'purchaseEquipment',item:'bronze4'});
 }
 for(const operativeId of [10,139])if(c.operativeState[operativeId].medkits<10){
  order({type:'purchaseMedicalSupplies',operativeId,quantity:10-c.operativeState[operativeId].medkits});
 }
 // The surviving local command cannot clear the port alone. Bank ordinary
 // income before hiring four living specialists and paying for their rest.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(2200,()=>c.resources.treasury>=40000,{income:true});
 const reinforcements=[105,128,132,145];
 for(const id of reinforcements){
  order({type:'recruitCivic',id,term:'day',destination:'retiro'});keep.add(id);
 }
 waitUntil(24,()=>reinforcements.every(id=>c.recruited.includes(id)));
 field.push(...reinforcements);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(160,()=>reinforcements.every(id=>c.operativeState[id].morale>=50));
 for(const operativeId of reinforcements)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'createSquad',ids:reinforcements,sector:'retiro',name:'Refuerzo del puerto'});
 p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,reinforcements).battle}));
 c=supplyRouteAmmunition(c,reinforcements,{target:16}).campaign;c=finishReloadsBeforeMarch(c);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(48,()=>c.hour%24===6&&field.every(id=>{
  const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;
 }));
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:['bronze4','bronze4']});
 c=prepareFinalAssault(c,{staging:'buenos_aires',target:'ensenada',fieldIds:field});
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.ok([143,147].every(id=>c.operativeState[id].alive&&!c.recruited.includes(id)));
 const battle=enterSector(c.pendingBattle,c.sectorStates.ensenada);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 report({event:'createdCoastalAssaultReady',hour:c.hour,treasury:c.resources.treasury,field,events});
 return {campaign:c,field,events};
}

// Continue the actual Cuyo survivors through port and river victories. The
// commander returns from his boundary exit before meeting the naval officers.
export function finishCreatedCoast(prefix,{onCheckpoint}={}){
 const prepared=prepareCreatedCoastalAssault(prefix.campaign);
 let campaign=prepared.campaign;const notes=[];
 const note=(stage,details={})=>{
  notes.push({stage,hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...details});
  onCheckpoint?.(stage,campaign,notes);
 };
 note('coastal-preparation',{field:prepared.field});
 const initial=enterSector(campaign.pendingBattle,campaign.sectorStates.ensenada);
 const deploy=withdrawCommandToRear(initial,57,'buenos_aires');
 const port=fightNorthernSector(campaign,'ensenada',{deploy,controller:coastalSearchController(deploy(enterSector(campaign.pendingBattle,campaign.sectorStates.ensenada,{placement:true})))});
 campaign=port.campaign;
 assert.equal(campaign.operativeState[57].location,'buenos_aires');
 note('ensenada',port.summary);
 campaign=recruitFreshNavalCommand(rejoinCommandAfterExit(campaign,57,'ensenada'));
 note('naval-command');
 campaign=recoverFreshPort(campaign);
 note('coastal-care');
 // The invasion clock can leave the capital friendly on this route. Fight
 // only an actual occupation, while keeping the blockade assertion below.
 if(campaign.sectors.buenos_aires.owner!=='patriot'){
  campaign=prepareFreshBlockadeAssault(campaign);
  const capital=fightNorthernSector(campaign,'buenos_aires',{controller:tucumanCombatOrder,deploy:deployInfantryLine});
  campaign=capital.campaign;note('buenos_aires',capital.summary);
 }
 assert.equal(campaign.blockade,false);
 campaign=prepareFreshSantaFeAssault(campaign);
 const river=fightNorthernSector(campaign,'santa_fe',{controller:coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.santa_fe))});
 campaign=river.campaign;note('santa_fe',river.summary);
 // A later naval occupation can leave the city flag friendly while closing
 // the road. Clear the real blockade before moving the Retiro rear guard.
 if(campaign.blockade){
  campaign=prepareCreatedCapitalReturn(campaign);
  const capital=fightNorthernSector(campaign,'buenos_aires',{controller:coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires))});
  campaign=capital.campaign;note('buenos_aires',capital.summary);
 }
 assert.equal(campaign.blockade,false);
 for(const [id,record]of Object.entries(prefix.campaign.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.operativeState[57].alive,true);
 return {campaign,notes,prefix:prefix.notes};
}

// Reclaim the actual northern road before entering the high pass. Relief,
// forward treatment, the invading column and the physical gun transfers all
// retain their own paid time and casualty records.
export function finishCreatedNorthernReturn(prefix,{onCheckpoint}={}){
 let campaign=prepareCreatedNorthernRelief(prefix.campaign);const notes=[...prefix.notes];
 const note=(stage,details={})=>{
  notes.push({stage,hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...details});
  onCheckpoint?.(stage,campaign,notes);
 };
 note('northern-relief');
 const request=campaign.pendingBattle;
 const doctor=request.squad.filter(u=>u.medical>=60).sort((a,b)=>a.marksmanship-b.marksmanship||a.id-b.id)[0];
 assert.ok(doctor,'a real arriving doctor must return to the hospital');
 const deploy=withdrawCommandToRear(enterSector(request,campaign.sectorStates.tucuman),doctor.id,'cordoba');
 const tucuman=fightNorthernSector(campaign,'tucuman',{deploy,controller:stagedBatteryController()});
 campaign=tucuman.campaign;note('tucuman-return',tucuman.summary);
 campaign=prepareCreatedSaltaReturn(campaign);
 const salta=fightNorthernSector(campaign,'salta',{controller:stagedBatteryController()});
 campaign=salta.campaign;note('salta-return',salta.summary);
 campaign=prepareCreatedSaltaDefense(campaign);
 const defense=fightNorthernSector(campaign,'salta',{controller:stableCrewController()});
 campaign=defense.campaign;note('salta-defense',defense.summary);
 campaign=recoverCreatedSaltaDefense(campaign);
 note('salta-defense-care');
 campaign=prepareCreatedJujuyReturn(campaign);
 const search=coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.jujuy));
 const controller=(battle,unit)=>{
  const action=search(battle,unit);
  return unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;
 };
 const jujuy=fightNorthernSector(campaign,'jujuy',{controller});
 campaign=jujuy.campaign;note('jujuy',jujuy.summary);
 campaign=recoverCreatedJujuy(campaign);
 note('jujuy-care');
 campaign=prepareCreatedJujuyDefense(campaign);
 const defenseSearch=coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.jujuy));
 const defenseController=(battle,unit)=>{
  const action=defenseSearch(battle,unit);
  return unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;
 };
 const northernDefense=fightNorthernSector(campaign,'jujuy',{controller:defenseController});
 campaign=northernDefense.campaign;note('jujuy-defense',northernDefense.summary);
 campaign=prepareCreatedHumahuacaReturn(campaign);
 const pass=fightNorthernSector(campaign,'humahuaca',{controller:heavyContactCrewController(),deploy:deployHighPassBattery});
 campaign=pass.campaign;note('humahuaca',pass.summary);
 campaign=stabilizeCreatedHighPass(campaign);note('humahuaca-stabilization');
 for(const [id,record]of Object.entries(prefix.campaign.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.operativeState[57].alive,true);
 return {campaign,notes,prefix:prefix.prefix};
}

// Clear the actual final naval occupation before accepting campaign victory.
// The last high-pass crew returns for finite care and fields three paid guns.
export function finishCreatedFinalCapitalReturn(prefix,{onCheckpoint}={}){
 let campaign=prepareCreatedFinalCapitalReturn(prefix.campaign);
 const notes=[...prefix.notes];
 const initial=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 const result=fightNorthernSector(campaign,'buenos_aires',createdFinalCapitalBattery(initial));
 campaign=result.campaign;
 notes.push({stage:'buenos_aires-final',hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...result.summary});
 onCheckpoint?.('buenos_aires-final',campaign,notes);
 assert.equal(campaign.completed,true);assert.equal(campaign.defeated,false);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
 assert.equal(campaign.blockade,false);assert.equal(campaign.phase,4);
 assert.equal(Object.keys(campaign.sectors).length,13);
 assert.ok(Object.values(campaign.sectors).every(s=>s.owner==='patriot'));
 assert.ok(!campaign.enemyGroups.some(g=>['marching','waiting','engaged','stationed'].includes(g.status)));
 assert.ok(campaign.operativeState[57].alive&&campaign.operativeState[57].hp>=15);
 for(const [id,r]of Object.entries(prefix.campaign.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 return {campaign,notes,prefix:prefix.prefix};
}
