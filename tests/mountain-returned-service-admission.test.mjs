import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD,DEFAULT_MAPS} from '../campaigns/default.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {initialCampaign,dispatchCampaign,rosterFor,WEAPONS} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {serviceReturnSources,MAX_SERVICE_RETURN_STACKS} from '../game/service-equipment-return.js';
import {transportPath} from '../game/logistics.js';
import {travelLegHours} from '../game/squad-travel.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,exitPreview} from '../game/tactical.js';
import {spacePoint} from '../game/tactical-space.js';
import {boundaryPassable} from '../game/tactical-exits.js';
import {syncBattleTime} from '../game/time.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {mountainFieldPool,prepareMountainDoctorReadiness,collectReturnedMountainKit,NATIVE_MOUNTAIN_RESERVE_BOUNDS} from './fresh-mountain-route.mjs';
import {prepareReturnedMountainService,quoteReturnedMountainAdmission} from './mountain-returned-service-admission.mjs';
import {mountainCommandRolePlan} from './mountain-command-role-plan.mjs';
import {meetLocalIncomeRepresentative} from './route-town-income.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {firearmServiceable} from '../game/firearm-serviceability.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0),former=[105,106,128,145,147],serving=[100,101,102,103,104,108,109,110,116,130,139],engineer=118,field=[...serving,...former];
const canonical=c=>{const next=structuredClone(c);for(const key of ['sectorStates','sceneStates'])for(const id of Object.keys(next[key]??{}))next[key][id]=expandCellScene(next[key][id]);return next;};
const saved=(campaign,battle=null)=>{const pair=decodeSave(encodeSave(campaign,battle));assert.deepEqual(canonical(pair.campaign),canonical(campaign));assert.deepEqual(pair.battle,battle);return pair;};
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const fit=(c,id)=>{const r=c.operativeState[id];return r.hp===r.maxHp&&r.energy===100&&!r.fatigue&&!r.asleep&&!r.bleeding;};
function retainedOrder(c,action){
 for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){let expires=contractExpiresSeconds(c.contracts[id]);while(expires!==null&&expires<=clock(c)+3601){const contract=c.contracts[id];c=order(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});expires=contractExpiresSeconds(c.contracts[id]);}}
 return order(c,action);
}
function step(pair,action,actions){
 const battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null);assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);actions.push(structuredClone(action));return saved(next.campaign,next.battle);
}
function visit(c){c=order(c,{type:'visitSector'});const battle=enterSector(c.pendingBattle,c.sectorStates[c.location]),pair=syncBattleTime(c,battle);assert.equal(pair.error,null);return saved(pair.campaign,pair.battle);}
const leave=pair=>order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});

// Finite hired equipment fills the real cache through ordinary paid end-duty.
// Mendoza remains unvisited until its actual fallback owners are recorded.
// No saved cache, owner marker, morale, HP or actor position is set.
function setup({returned=true,treasury=20000,arrivalHours=0,specialist=true,income=true,externalDoctor=false}={}){
 const content=defaultContentPackage(),keep=new Set(content.characters.filter(p=>Number(p.id.slice(7))<100||[...field,engineer,...(externalDoctor?[143]:[])].includes(Number(p.id.slice(7)))).map(p=>p.id));
 content.characters=content.characters.filter(p=>keep.has(p.id));content.placements=content.placements.filter(p=>keep.has(p.character));content.includeOriginalResidents=income;content.errands=[];
 content.headquarters='mendoza';content.startingTerritory=defaultStartingTerritory('mendoza');for(const site of ['cordoba','buenos_aires','retiro'])content.startingTerritory[site]={owner:'patriot',loyalty:65};content.rules.startingTreasury=treasury;content.rules.deploymentCartridges=0;content.rules.enemyCartridges=0;
 content.campaignStory={introduction:'Propiedad de servicio declarada.',victory:'Objetivo posterior.',defeat:'La campaña termina.',chapters:[{id:'later',name:'Objetivo posterior',objective:'Continuar después de la prueba.',conditions:[{type:'day',min:100,max:null}]}],failureConditions:[]};
 content.world=structuredClone(DEFAULT_WORLD);content.world.enemyStrategy={version:1,theaters:{}};content.maps=structuredClone(DEFAULT_MAPS);
 const template=structuredClone(content.characters.find(p=>p.id==='person-100'));
 for(const id of [...field,engineer]){const p=content.characters.find(p=>p.id===`person-${id}`);p.monthlyPay=30;p.arrivalHours=id===former[0]?arrivalHours:0;p.attributes={...p.attributes,leadership:id===101?86:40,medical:[116,130,139].includes(id)?70:20};if(id===former[0])p.serviceGuarantee=17;}
 if(specialist)content.characters.find(p=>p.id==='person-100').monthlyPay=50000;
 if(externalDoctor){content.characters.find(p=>p.id==='person-139').attributes.medical=20;const p=content.characters.find(p=>p.id==='person-143');p.monthlyPay=4500;p.arrivalHours=0;p.attributes.medical=80;}
 content.characters.push(...Array.from({length:160},(_,i)=>({...structuredClone(template),id:'pressure-return-'+i,name:'Servicio finito '+i,nickname:'Depósito '+i,monthlyPay:5,arrivalHours:0,weapon:null,blade:'blade-1813',startingSupplies:{rations:1,torches:1,medkits:1,boleadoras:1}})));
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content);const pressureIds=rosterFor(c).filter(op=>op.contentId?.startsWith('pressure-return-')).map(op=>op.id),retreats=[];
 c=order(c,{type:'transport',mode:'posta'});
 const hire=(id,term='day',destination='mendoza')=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),term),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term,destination});assert.equal(cash-c.resources.treasury,quote.total);for(let n=0;!c.recruited.includes(id)&&n<24;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.ok(c.recruited.includes(id));};
 if(returned){
  hire(former[0],'month');c=order(c,{type:'squad',ids:[former[0]]});assert.equal(c.sectorStates.mendoza,undefined);assert.equal(c.operativeState[former[0]].morale,80);
  for(let pass=0;pass<7;pass++){
   c=order(c,{type:'assignCare',operativeId:former[0],assignment:'active'});const morale=c.operativeState[former[0]].morale;
   for(let n=0;!fit(c,former[0])&&n<72;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.ok(fit(c,former[0]));assert.equal(c.operativeState[former[0]].morale,morale);
   c=retainedOrder(c,{type:'attack',sector:'uspallata',mode:'posta'});
   for(let n=0;!c.pendingBattle&&n<48;n++){const home=c.squads.find(q=>q.id===c.activeSquadId);c=retainedOrder(c,home.journey.status==='ready'?{type:'beginAssault',sector:'uspallata'}:{type:'wait',hours:1});}
   const issued=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.uspallata));assert.equal(issued.error,null);let pair=saved(issued.campaign,issued.battle),initial=structuredClone(pair.battle),actions=[],actor=pair.battle.units.find(u=>u.id===String(former[0])),exit=pair.battle.exits.find(e=>e.destination==='mendoza');assert.ok(exit);
   if(!boundaryPassable(pair.battle,actor,exit.edge)){const goal=getReachable(pair.battle,actor).filter(p=>boundaryPassable(pair.battle,p,exit.edge)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(goal);pair=step(pair,{type:'move',unitId:actor.id,...spacePoint(goal)},actions);}
   const action={type:'exit',unitIds:[String(former[0])],exitId:exit.id};assert.equal(exitPreview(pair.battle,action).available,true);pair=step(pair,action,actions);assert.equal(pair.battle.status,'retreat');
   const report={type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:'retreat',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')};c=order(pair.campaign,report);assert.equal(c.operativeState[former[0]].morale,morale-5);retreats.push({initial,actions,report});
  }
  for(let n=0;!fit(c,former[0])&&n<72;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.ok(fit(c,former[0])&&c.operativeState[former[0]].morale<50);
  for(const id of former.slice(1))hire(id);
  let pressure=false,filled=0;
  for(const id of pressureIds){hire(id,'day','cordoba');c=order(c,{type:'dismiss',id});filled++;if(c.operativeState[id].serviceEquipmentReturn){pressure=true;break;}}
  assert.ok(pressure&&filled<=160,'Actual paid finite returns must reach the Native bounded fallback.');assert.ok(c.serviceEquipmentReturns.entries.reduce((n,row)=>n+row.items.length+(row.repairPoints>0?1:0),0)<=MAX_SERVICE_RETURN_STACKS);
  assert.equal(c.sectorStates.mendoza,undefined,'Real returns have not invented a cleared destination scene.');
  for(const id of former){c=order(c,{type:'dismiss',id});assert.ok(c.operativeState[id].serviceEquipmentReturn);assert.equal(contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').available,false);}
 }
 for(const id of [...serving,engineer,...(returned?[]:former)])hire(id);
 const locals=[...serving,engineer,...(returned?[]:former)];for(let i=0;i<locals.length;i+=6)c=order(c,{type:'createSquad',sector:'mendoza',ids:locals.slice(i,i+6),name:'Dotación real '+i});
 const engineerHome=c.squads.find(q=>q.members.includes(engineer)).id;c=order(c,{type:'createSquad',sector:'mendoza',ids:[engineer],name:'Vacante real'});const spare=c.activeSquadId;c=order(c,{type:'assignToSquad',squadId:engineerHome,operativeId:engineer});assert.equal(c.squads.find(q=>q.id===spare).members.length,0);
 c=order(c,{type:'selectSquad',id:c.squads.find(q=>q.location==='mendoza'&&q.members.length).id});
 if(!c.sectorStates.mendoza)c=leave(visit(c));if(returned)assert.ok(former.every(id=>c.operativeState[id].serviceEquipmentReturn),'The actual first visit retains every real fallback marker.');c=order(c,{type:'assignWork',operativeId:engineer,assignment:'practice',skill:'marksmanship'});
 if(income){
  const travelers=[101,...(specialist?[100]:[])],home=c.squads.find(q=>q.members.includes(101)).id;c=order(c,{type:'selectSquad',id:spare});c=order(c,{type:'squad',ids:travelers});
  const travel=sector=>{c=retainedOrder(c,{type:'travel',sector,mode:'posta',queue:true});for(let n=0;c.squads.find(q=>q.id===c.activeSquadId).journey&&n<24;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.equal(c.location,sector);};
  travel('buenos_aires');c=meetLocalIncomeRepresentative(c,{sourceId:'buenos_aires',operativeId:101});assert.ok(c.townIncome.activations.buenos_aires);travel('mendoza');for(const id of travelers)c=order(c,{type:'assignToSquad',squadId:home,operativeId:id});assert.equal(c.squads.find(q=>q.id===spare).members.length,0);
  for(const id of travelers)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});for(let n=0;travelers.some(id=>!fit(c,id))&&n<72;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.ok(travelers.every(id=>fit(c,id)&&!c.operativeState[id].residentPosition&&!c.operativeState[id].residentSector));
 }
 assert.equal(pressureIds.length,160);assert.ok(pressureIds.every(id=>!field.includes(id)&&id!==engineer));
 assert.deepEqual(content,declaration);return {campaign:saved(c).campaign,pressureIds,retreats,spare};
}
function options(start,pressureIds,deadlineSeconds=clock(start)+600*3600,destination='cordoba'){
 const exclude=[engineer,...pressureIds],fieldPool=c=>mountainFieldPool(c,'mendoza',exclude);
 const departurePlan=(c,ids,notBeforeSeconds)=>{const path=transportPath(c,'mendoza',destination);assert.ok(path);const hours=path.slice(1).reduce((n,to,i)=>n+travelLegHours(path[i],to,'posta',c),0);return {path,hours,horizonSeconds:notBeforeSeconds+(hours+1)*3600,fixedCost:10*(path.length-1)*Math.ceil(ids.length/6),prospectiveGeometryOnly:true};};
 return {sector:'mendoza',fieldCount:16,doctorCount:3,exclude,deadlineSeconds,fieldPool,departurePlan};
}

test('actual blocked returns are collected once and a paid low-morale former owner makes sixteen with distinct real roles',()=>{
 const {campaign:start,pressureIds,retreats}=setup({arrivalHours:2,treasury:14000}),before=structuredClone(start),o=options(start,pressureIds),cache=structuredClone(start.serviceEquipmentReturns),source=former.flatMap(id=>serviceReturnSources(start,'mendoza').filter(row=>row.operativeId===id&&row.stack).map(row=>row.stack)),initialPool=o.fieldPool(start);assert.equal(retreats.length,7);assert.equal(initialPool.length,11);
 const result=prepareReturnedMountainService(start,o),c=result.campaign;assert.deepEqual(result.receipt.hires.map(row=>row.id),[former[0]]);assert.ok(clock(c)>clock(start)+2*3600);assert.ok(c.operativeState[former[0]].morale>=50);assert.equal(o.fieldPool(c).length,16);assert.equal(former.slice(1).some(id=>c.recruited.includes(id)),false);assert.ok(former.every(id=>!c.operativeState[id].serviceEquipmentReturn));
 assert.deepEqual(c.serviceEquipmentReturns.entries,cache.entries);assert.equal(c.serviceEquipmentReturns.nextId,cache.nextId+result.receipt.completedDuties.length);const physical=({item,...row})=>row,sort=rows=>rows.map(row=>JSON.stringify(physical(row),(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value)).sort();assert.deepEqual(sort(result.receipt.collected.filter(row=>row.record).map(row=>row.record)),sort([...source,...result.receipt.completedDuties.flatMap(row=>row.property)]));assert.equal(c.resources.treasury,start.resources.treasury-result.receipt.orders.reduce((n,row)=>n+row.cost,0));assert.ok(result.receipt.events.some(row=>row.event==='freshRouteRenewal'));assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.operativeState[engineer].assignment,'practice');assert.ok(!result.receipt.finalPlan.fieldIds.includes(engineer));
 assert.deepEqual(result.receipt.completedDuties.map(row=>row.id),[100]);assert.ok(!c.recruited.includes(100));assert.equal(c.operativeState[100].morale,result.receipt.completedDuties[0].morale);assert.ok(result.receipt.banking.length&&result.receipt.banking.some(row=>row.treasuryAfter>row.treasury));assert.ok(result.receipt.banking.every(row=>row.income>row.payroll));assert.ok(result.receipt.orders.findIndex(row=>row.action.type==='wait'&&row.cost<0)<result.receipt.orders.findIndex(row=>row.action.type==='recruitCivic'));assert.ok(result.receipt.lastBudget.budget.available);assert.ok(clock(c)-clock(start)<600*3600);
 let replay=saved(start).campaign;for(const row of result.receipt.orders){assert.equal(clock(replay),row.from);replay=order(replay,row.action);assert.equal(clock(replay),row.to);}assert.deepEqual(canonical(saved(replay).campaign),canonical(c));assert.deepEqual(start,before);
 const ready=prepareMountainDoctorReadiness(c,{sector:'mendoza',count:3,fieldCount:16,exclude:o.exclude,reservedIds:o.exclude,requireCommander:true,deadlineSeconds:o.deadlineSeconds,budgetBeforeWait:(state,nextSeconds)=>quoteReturnedMountainAdmission(state,{...o,nextSeconds})});assert.equal(clock(ready),clock(c));
 const late=[100,...former.slice(1)];let actual=ready;for(const id of late){const q=contractQuote(actual,rosterFor(actual).find(op=>op.id===id),'day'),cash=actual.resources.treasury;actual=order(actual,{type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(cash-actual.resources.treasury,q.total);}
 for(const id of [100,...former])actual=recoverRoutePrimary(actual,id,{preferredWeapon:1801,replace:true});actual=collectReturnedMountainKit(actual,[100,...former]);assert.ok(clock(actual)<=o.deadlineSeconds);for(const op of rosterFor(actual).filter(op=>[100,...former].includes(op.id))){const record=actual.operativeState[op.id];assert.ok(WEAPONS[op.weapon]?.capacity>0&&!record.weaponDropped&&firearmServiceable(record)&&record.headwear&&record.outfit&&record.legwear&&op.blade,JSON.stringify({id:op.id,weapon:op.weapon,condition:record.condition,weaponDropped:record.weaponDropped,headwear:record.headwear,outfit:record.outfit,legwear:record.legwear,blade:op.blade}));}
 const real=o.fieldPool(actual).filter(op=>actual.recruited.includes(op.id));assert.equal(real.length,16);const roles=mountainCommandRolePlan({commanders:real.filter(op=>op.leadership>=80),physicians:real.filter(op=>op.medical>=60),count:3});assert.ok(roles);assert.equal(new Set([roles.commander.id,...roles.doctors.map(op=>op.id)]).size,4);assert.ok(field.every(id=>actual.operativeState[id].hp===actual.operativeState[id].maxHp));saved(actual);
 assert.deepEqual(NATIVE_MOUNTAIN_RESERVE_BOUNDS,{count:6,preMarchRestHours:72,travelHours:168,readinessRestHours:600});
});

test('a short actual treasury stops joint admission before a new hire or paid rest, preserving its collected finite prefix',()=>{
 const {campaign:start,pressureIds}=setup({treasury:2400,specialist:false,income:false}),before=structuredClone(start),o=options(start,pressureIds);let error;
 try{prepareReturnedMountainService(start,o);}catch(e){error=e;}
 assert.match(error?.message??'',/Actual activated port income/);assert.equal(error.mountainReturnedService.hires.length,0);assert.ok(error.mountainReturnedService.lastBudget.budget.shortfall>0);assert.ok(!error.mountainReturnedService.orders.some(row=>['recruitCivic','wait'].includes(row.action.type)));assert.deepEqual(start,before);
});

test('the new arrival and rest consume the original absolute deadline without another allowance',()=>{
 const {campaign:start,pressureIds}=setup({arrivalHours:2,specialist:false,income:false}),before=structuredClone(start),deadlineSeconds=clock(start)+3*3600;let error;
 try{prepareReturnedMountainService(start,options(start,pressureIds,deadlineSeconds));}catch(e){error=e;}
 assert.match(error?.message??'',/original mountain readiness deadline/);assert.ok(error.campaign);assert.ok(clock(error.campaign)<=deadlineSeconds);assert.equal(error.mountainReturnedService.hires.length,1);assert.ok(error.mountainReturnedService.orders.filter(row=>row.action.type==='recruitCivic').length===1);assert.deepEqual(start,before);
});

test('an already serving ready sixteen and its protected engineer keep their ordinary service and property unchanged',()=>{
 const {campaign:start,pressureIds}=setup({returned:false,specialist:false,income:false}),before=structuredClone(start),o=options(start,pressureIds),result=prepareReturnedMountainService(start,o);
 assert.equal(o.fieldPool(start).length,16);assert.strictEqual(result.campaign,start);assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.receipt.hires,[]);assert.equal(result.receipt.completed,true);assert.deepEqual(start,before);saved(start);
});

test('sixteen actual serving bodies still reserve the real unserving physician needed for three distinct doctors',()=>{
 const {campaign:start,pressureIds}=setup({returned:false,treasury:3100,specialist:false,income:false,externalDoctor:true}),before=structuredClone(start),q=quoteReturnedMountainAdmission(start,options(start,pressureIds)),doctor=contractQuote(start,rosterFor(start).find(op=>op.id===143),'day');
 assert.equal(q.plan.servingIds.length,16);assert.ok(q.plan.doctorIds.includes(143));assert.deepEqual(q.late.map(row=>row.id),[143]);assert.ok(doctor.total<=start.resources.treasury);assert.ok(q.budget.fixedCost>=doctor.total+2000);assert.equal(q.budget.available,false);assert.ok(q.budget.shortfall>0);assert.deepEqual(start,before);
});

test('the fixed deadline refuses banking before its first paid hour and keeps actual completed-duty property as a partial receipt',()=>{
 const {campaign:start,pressureIds}=setup({returned:false}),before=structuredClone(start),deadlineSeconds=clock(start),o=options(start,pressureIds,deadlineSeconds,'buenos_aires');assert.equal(quoteReturnedMountainAdmission(start,o).budget.available,false);let error;
 try{prepareReturnedMountainService(start,o);}catch(e){error=e;}
 assert.match(error?.message??'',/original mountain readiness deadline/);assert.equal(clock(error.campaign),clock(start));assert.deepEqual(error.mountainReturnedService.completedDuties.map(row=>row.id),[100]);assert.equal(error.mountainReturnedService.banking.length,0);assert.ok(error.mountainReturnedService.lastBudget.budget.shortfall>0);assert.ok(error.mountainReturnedService.collected.some(row=>row.ownerId===100));assert.ok(!error.mountainReturnedService.orders.some(row=>['wait','recruitCivic'].includes(row.action.type)));assert.deepEqual(start,before);
});

import {doctorRate} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {supplyRouteDressings} from './route-dressings.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {attemptCollectRouteItems,knownRouteMedicalSources,authoredRouteMedicalDiscoveries} from './finite-route-equipment.mjs';
import {finiteCachesFor} from '../game/campaign-physical.js';

const careFormer=[105,128,135],careLate=[118,138,143],careKeep=[100,101,102,103,104,108,109,110,130,146],careEngineer=139,careField=[...careKeep,...careLate,...careFormer];

// This separate declaration earns low morale by actual retreats. The stable
// wounds and every finite starting kit exist before the first factory call.
function paidCareSetup({income=true,treasury=1000000,emptyPhysical=false}={}){
 const content=defaultContentPackage(),ids=[...careField,careEngineer],keep=new Set(content.characters.filter(p=>Number(p.id.slice(7))<100||ids.includes(Number(p.id.slice(7)))).map(p=>p.id));
 content.characters=content.characters.filter(p=>keep.has(p.id));content.placements=content.placements.filter(p=>keep.has(p.character));content.includeOriginalResidents=income;content.errands=[];
 content.headquarters='mendoza';content.startingTerritory=defaultStartingTerritory('mendoza');for(const site of ['cordoba','buenos_aires','retiro'])content.startingTerritory[site]={owner:'patriot',loyalty:65};
 content.rules.startingTreasury=treasury;content.rules.deploymentCartridges=0;content.rules.enemyCartridges=0;
 content.campaignStory={introduction:'Atención finita y servicio pagado.',victory:'Objetivo posterior.',defeat:'La campaña termina.',chapters:[{id:'later',name:'Objetivo posterior',objective:'Continuar después de la prueba.',conditions:[{type:'day',min:1000,max:null}]}],failureConditions:[]};
 content.world=structuredClone(DEFAULT_WORLD);content.world.enemyStrategy={version:1,theaters:{}};content.maps=structuredClone(DEFAULT_MAPS);
 const daily={100:40,104:73,108:60,109:188,110:99,130:47,146:166,105:9600,128:8940,135:7020,118:8580,138:6600,143:8280};
 for(const id of ids){
  const p=content.characters.find(p=>p.id===`person-${id}`),maxHp=id===105?70:id===128?79:80,hp=id===105?28:id===128?15:maxHp;
  p.monthlyPay=(daily[id]??0)*5;p.service='contract';p.recruitmentSource='contract';p.progression='fixed';p.arrivalHours=0;p.traits=[];p.abilities=[];p.personality='Servicio ordinario.';delete p.serviceGuarantee;delete p.serviceRefusals;delete p.preferredCompanions;
  p.attributes={...p.attributes,maxHp,leadership:id===101?86:40,medical:id===146?91:id===130?65:id===135?93:20};
  p.startingCondition={hp,bleeding:0,bandaged:0,energy:100,fatigue:0};p.startingSupplies={rations:2,torches:2,boleadoras:1,medkits:id===146?1:id===130?10:[100,...careLate].includes(id)?2:0};
 }
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(321,content);const retreats=[],setupOrders=[];
 const issue=action=>{c=retainedOrder(c,action);setupOrders.push(structuredClone(action));return c;};
 const hire=(id,term='day')=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),term),cash=c.resources.treasury;issue({type:'recruitCivic',id,term,destination:'mendoza'});assert.equal(cash-c.resources.treasury,quote.total);assert.ok(c.recruited.includes(id));};
 issue({type:'transport',mode:'posta'});for(const id of careFormer)hire(id,'month');issue({type:'squad',ids:careFormer});
 const wounds=Object.fromEntries(careFormer.map(id=>[id,{hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp}]));
 const recovered=id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;};
 for(let pass=0;pass<16;pass++){
  for(const id of careFormer)issue({type:'assignCare',operativeId:id,assignment:'active'});
  for(let n=0;careFormer.some(id=>!recovered(id))&&n<72;n++)issue({type:'wait',hours:1});assert.ok(careFormer.every(recovered));
  for(const id of careFormer){assert.equal(c.operativeState[id].hp,wounds[id].hp);assert.equal(c.operativeState[id].bleeding,0);}
  if(pass===15)for(const id of careFormer){const before=c.operativeState[id].morale,contract=c.contracts[id];issue({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.operativeState[id].morale,before+2);}
  const morale=Object.fromEntries(careFormer.map(id=>[id,c.operativeState[id].morale]));issue({type:'attack',sector:'uspallata',mode:'posta'});
  for(let n=0;!c.pendingBattle&&n<48;n++){const home=c.squads.find(q=>q.id===c.activeSquadId);issue(home.journey.status==='ready'?{type:'beginAssault',sector:'uspallata'}:{type:'wait',hours:1});}
  assert.ok(c.pendingBattle);const issued=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.uspallata));assert.equal(issued.error,null);let pair=saved(issued.campaign,issued.battle);const initial=structuredClone(pair.battle),actions=[],exit=pair.battle.exits.find(e=>e.destination==='mendoza');assert.ok(exit);
  for(const id of careFormer){const actor=pair.battle.units.find(u=>u.id===String(id));if(boundaryPassable(pair.battle,actor,exit.edge))continue;const goal=getReachable(pair.battle,actor).filter(p=>boundaryPassable(pair.battle,p,exit.edge)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(goal);pair=step(pair,{type:'move',unitId:actor.id,...spacePoint(goal)},actions);}
  const action={type:'exit',unitIds:careFormer.map(String),exitId:exit.id};assert.equal(exitPreview(pair.battle,action).available,true);pair=step(pair,action,actions);assert.equal(pair.battle.status,'retreat');
  const report={type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:'retreat',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')};c=order(pair.campaign,report);retreats.push({initial,actions,report});
  for(const id of careFormer){assert.equal(c.operativeState[id].morale,morale[id]-5);assert.equal(c.operativeState[id].hp,wounds[id].hp);}
 }
 assert.ok(clock(c)<720*3600,'The authored month remains real paid service throughout the retreat prelude.');
 for(const id of careFormer){assert.equal(c.operativeState[id].morale,2);issue({type:'dismiss',id});}
 for(const id of [...careKeep,careEngineer])hire(id);
 for(let offset=0;offset<careKeep.length+1;offset+=6)issue({type:'createSquad',sector:'mendoza',ids:[...careKeep,careEngineer].slice(offset,offset+6),name:'Servicio local '+offset});
 const home=c.squads.find(q=>q.members.includes(101)).id;issue({type:'createSquad',sector:'mendoza',ids:[101],name:'Reserva temporal'});const spare=c.activeSquadId;
 if(income){
  const travel=sector=>{issue({type:'travel',sector,mode:'posta',queue:true});for(let n=0;c.squads.find(q=>q.id===c.activeSquadId).journey&&n<48;n++)issue({type:'wait',hours:1});assert.equal(c.location,sector);};
  travel('buenos_aires');c=meetLocalIncomeRepresentative(c,{sourceId:'buenos_aires',operativeId:101});assert.ok(c.townIncome.activations.buenos_aires);travel('mendoza');
  issue({type:'assignCare',operativeId:101,assignment:'rest'});for(let n=0;!recovered(101)&&n<72;n++)issue({type:'wait',hours:1});assert.ok(recovered(101));
 }
 issue({type:'assignToSquad',squadId:home,operativeId:101});assert.equal(c.squads.find(q=>q.id===spare).members.length,0);issue({type:'selectSquad',id:home});
 if(!c.sectorStates.mendoza){for(const id of c.squad)issue({type:'assignCare',operativeId:id,assignment:'active'});c=leave(visit(c));}for(const id of [...careKeep,careEngineer])issue({type:'assignCare',operativeId:id,assignment:'rest'});
 issue({type:'assignWork',operativeId:careEngineer,assignment:'practice',skill:'marksmanship'});for(const id of careLate)hire(id);
 for(const id of careLate)issue({type:'assignCare',operativeId:id,assignment:'rest'});
 const exhausted=[];
 if(emptyPhysical){
  // Keep every shipped cache declaration exact. This independent negative
  // earns its exhausted sources by real travel, opening and finite takes.
  const engineerHome=c.squads.find(q=>q.members.includes(careEngineer)),members=[...engineerHome.members];issue({type:'assignCare',operativeId:careEngineer,assignment:'active'});issue({type:'assignToSquad',operativeId:careEngineer,squadId:spare});
  const rest=()=>{for(let n=0;!recovered(careEngineer)&&n<48;n++){if(c.operativeState[careEngineer].assignment!=='rest')issue({type:'assignCare',operativeId:careEngineer,assignment:'rest'});issue({type:'wait',hours:1});}assert.ok(recovered(careEngineer));issue({type:'assignCare',operativeId:careEngineer,assignment:'active'});};
  const travel=sector=>{rest();issue({type:'travel',sector,mode:'posta',queue:true});for(let n=0;c.squads.find(q=>q.id===spare).journey&&n<48;n++)issue({type:'wait',hours:1});assert.equal(c.location,sector);rest();};
  for(const sector of ['cordoba','buenos_aires','retiro']){
   travel(sector);c=leave(takeFiniteCache(visit(c),careEngineer,[],{cacheId:finiteCachesFor(c)[sector].chest}));
   const before=c.operativeState[careEngineer].medkits,found=attemptCollectRouteItems(c,careEngineer,{item:'medkits'},12,{discover:false});assert.equal(found.collected,12);c=found.campaign;assert.equal(c.operativeState[careEngineer].medkits,before+12);exhausted.push({sector,count:12});travel('mendoza');
  }
  assert.equal(c.operativeState[careEngineer].medkits,36);issue({type:'assignToSquad',operativeId:careEngineer,squadId:engineerHome.id});issue({type:'squad',ids:members});issue({type:'assignWork',operativeId:careEngineer,assignment:'practice',skill:'marksmanship'});issue({type:'selectSquad',id:home});
 }
 assert.deepEqual(content,declaration);assert.equal(c.recruited.length,14);assert.ok(careFormer.every(id=>!c.recruited.includes(id)&&c.operativeState[id].morale===2));
 const o=options(c,[]);o.exclude=[careEngineer];o.fieldPool=state=>mountainFieldPool(state,'mendoza',[careEngineer]);
 return {campaign:saved(c).campaign,o,retreats,setupOrders,wounds,spare,exhausted};
}

const currentCareKits=c=>c.recruited.filter(id=>careField.includes(id)).reduce((sum,id)=>sum+c.operativeState[id].medkits,0)+sectorInventoryModel(c,'mendoza',rosterFor(c),146).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);

test('actual paid finite care and earned renewals admit three stable former hires and fund sixteen distinct field roles',()=>{
 const {campaign:start,o,retreats,wounds}=paidCareSetup(),before=structuredClone(start),initial=quoteReturnedMountainAdmission(start,o),kitPool=currentCareKits(start);
 assert.equal(retreats.length,16);assert.deepEqual(initial.plan.earlyIds.slice().sort((a,b)=>a-b),careFormer);assert.equal(initial.care.doctorId,146);assert.equal(initial.care.rate,doctorRate(rosterFor(start).find(op=>op.id===146),start));assert.equal(initial.care.strokes,18);assert.equal(initial.care.physical,19);assert.equal(initial.care.shortfall,19);assert.equal(kitPool,19);assert.equal(initial.budget.available,false);assert.ok(initial.collection.seconds>0&&initial.collection.cost>0);assert.deepEqual(initial.collection.sources.map(row=>row.at),['cordoba','buenos_aires','retiro']);
 const result=prepareReturnedMountainService(start,o),c=result.campaign;assert.equal(result.receipt.completed,true);assert.deepEqual(result.receipt.completedDuties.map(row=>row.id).sort((a,b)=>a-b),careLate);assert.deepEqual(result.receipt.hires.map(row=>row.id).sort((a,b)=>a-b),careFormer);
 assert.ok(result.receipt.banking.every(row=>row.income>row.payroll));const earned=result.receipt.orders.findIndex(row=>row.action.type==='wait'&&row.cost<0),hired=result.receipt.orders.findIndex(row=>row.action.type==='recruitCivic');assert.ok(earned>=0&&earned<hired,'Only actual earned cash may finance the early readmission.');
 assert.deepEqual(result.receipt.supply.map(row=>[row.source,row.collected]),[['cordoba',12],['buenos_aires',7]]);assert.equal(result.receipt.supply.reduce((sum,row)=>sum+row.collected,0),19);assert.ok(result.receipt.supply.every(row=>row.discovery.actions.length>0&&row.discovery.end-row.discovery.start<=3600&&row.end<=o.deadlineSeconds&&row.deposits.reduce((n,item)=>n+item.count,0)===row.collected));assert.ok(!result.receipt.orders.some(row=>row.action.type==='purchaseMedicalSupplies'));assert.equal(result.receipt.care.filter(row=>row.kind==='wait').reduce((sum,row)=>sum+row.used,0),18);assert.equal(currentCareKits(c),kitPool+19-18);
 assert.ok(result.receipt.care.some(row=>row.kind==='wait'&&row.used>0&&row.after.some(p=>p.hp>row.patients.find(old=>old.id===p.id).hp)));assert.ok(result.receipt.events.some(row=>row.event==='freshRouteRenewal'&&careFormer.includes(row.id)));
 for(const id of careFormer){assert.equal(c.operativeState[id].hp,wounds[id].maxHp);assert.ok(fit(c,id)&&c.operativeState[id].morale>=50);assert.equal(c.operativeState[id].assignment,'rest');}
 assert.equal(c.operativeState[146].assignment,start.operativeState[146].assignment);assert.equal(c.operativeState[careEngineer].assignment,'practice');assert.equal(c.activeSquadId,start.activeSquadId);assert.ok(clock(c)<=o.deadlineSeconds);assert.equal(result.receipt.lastBudget.budget.available,true);
 // Discovery includes real tactical orders. A second complete successful
 // execution from the same fresh input verifies those orders without inventing
 // a campaign-only tape or ever starting from a failed result.
 const repeated=prepareReturnedMountainService(saved(start).campaign,o);assert.deepEqual(canonical(saved(repeated.campaign).campaign),canonical(c));assert.deepEqual(repeated.receipt,result.receipt);
 let actual=c;for(const id of careLate){const quote=contractQuote(actual,rosterFor(actual).find(op=>op.id===id),'day'),cash=actual.resources.treasury;actual=order(actual,{type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(cash-actual.resources.treasury,quote.total);}
 for(const id of [...careFormer,...careLate])actual=recoverRoutePrimary(actual,id,{preferredWeapon:1801,replace:true});actual=collectReturnedMountainKit(actual,[...careFormer,...careLate]);
 const roles=mountainCommandRolePlan({commanders:o.fieldPool(actual).filter(op=>actual.recruited.includes(op.id)&&op.leadership>=80),physicians:o.fieldPool(actual).filter(op=>actual.recruited.includes(op.id)&&op.medical>=60),count:3});assert.ok(roles);const reserves=Object.fromEntries(roles.doctors.map(op=>[op.id,5]));
 for(const doctor of roles.doctors)actual=supplyRouteDressings(actual,doctor.id,5,{reserves,discover:false});
 assert.equal(o.fieldPool(actual).filter(op=>actual.recruited.includes(op.id)).length,16);assert.equal(new Set([roles.commander.id,...roles.doctors.map(op=>op.id)]).size,4);assert.ok(roles.doctors.every(op=>actual.operativeState[op.id].medkits>=5));assert.equal(currentCareKits(actual),20);
 assert.equal(actual.operativeState[careEngineer].assignment,'practice');assert.ok(clock(actual)<=o.deadlineSeconds);assert.equal(actual.resources.treasury,start.resources.treasury-result.receipt.orders.reduce((sum,row)=>sum+row.cost,0)-careLate.reduce((sum,id)=>sum+contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').total,0));saved(actual);assert.deepEqual(start,before);
});

test('actual finite physical exhaustion refuses wounded readmission before new hires or care',()=>{
 const {campaign:start,o,exhausted}=paidCareSetup({emptyPhysical:true}),before=structuredClone(start);assert.deepEqual(exhausted.map(row=>row.count),[12,12,12]);assert.deepEqual(knownRouteMedicalSources(start,'mendoza'),[]);assert.deepEqual(authoredRouteMedicalDiscoveries(start,'mendoza'),[]);assert.equal(start.operativeState[careEngineer].medkits,36);let error;
 try{prepareReturnedMountainService(start,o);}catch(e){error=e;}
 assert.match(error?.message??'',/controlled public finite medical source|finite medical stock is exhausted/);assert.deepEqual(error.mountainReturnedService.hires,[]);assert.deepEqual(error.mountainReturnedService.care,[]);assert.ok(!error.mountainReturnedService.orders.some(row=>['recruitCivic','wait','purchaseMedicalSupplies'].includes(row.action.type)));assert.deepEqual(error.campaign.operativeState[careEngineer],start.operativeState[careEngineer]);assert.deepEqual(start,before);
});

test('unactivated income and a short actual treasury cannot finance the wounded-care phase',()=>{
 const {campaign:start,o}=paidCareSetup({income:false,treasury:900000}),before=structuredClone(start);assert.equal(start.townIncome.activations.buenos_aires,undefined);let error;
 try{prepareReturnedMountainService(start,o);}catch(e){error=e;}
 assert.match(error?.message??'',/Actual activated port income/);assert.equal(error.mountainReturnedService.lastBudget.readinessBudget.available,false);assert.ok(error.mountainReturnedService.lastBudget.readinessBudget.shortfall>0);assert.deepEqual(error.mountainReturnedService.hires,[]);assert.ok(!error.mountainReturnedService.orders.some(row=>['recruitCivic','wait','purchaseMedicalSupplies'].includes(row.action.type)));assert.deepEqual(start,before);
});

test('the finite-care phase keeps the original shared deadline before its first banking hour',()=>{
 const {campaign:start,o}=paidCareSetup(),before=structuredClone(start);o.deadlineSeconds=clock(start);let error;
 try{prepareReturnedMountainService(start,o);}catch(e){error=e;}
 assert.match(error?.message??'',/original mountain readiness deadline/);assert.deepEqual(error.mountainReturnedService.completedDuties.map(row=>row.id).sort((a,b)=>a-b),careLate);assert.deepEqual(error.mountainReturnedService.banking,[]);assert.deepEqual(error.mountainReturnedService.hires,[]);assert.ok(!error.mountainReturnedService.orders.some(row=>['wait','recruitCivic','purchaseMedicalSupplies'].includes(row.action.type)));assert.deepEqual(start,before);
});
