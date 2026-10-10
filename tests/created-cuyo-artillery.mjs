import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {artilleryTransportQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {supplyFreshMountainAmmunition} from './fresh-mountain-route.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {enterSector} from '../game/world.js';
import {fightNorthernSector} from './northern-route.mjs';
import {visit,saved,leave,sync} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';

const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const stable=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.unconscious&&!r.routed;};

// A native victory spent the three original bronze guns. This side operation
// earns the remaining finite arsenal; it never refills those existing pieces.
export function prepareCreatedCuyoArsenalAssault(start,{report=()=>{}}={}){
 let c=saved({campaign:start}).campaign;
 assert.equal(c.flags.armyFunded,true);assert.equal(c.location,'mendoza');
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.equal(c.sectors.ensenada.owner,'royalist');assert.equal(c.artilleryArsenalRecoveries.ensenada,undefined);
 const originalSquad=c.activeSquadId,originalMembers=[...c.squad];
 const retain=()=>createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman','salta']});
 let retained=retain();
 const resolve=()=>{
  if(!c.pendingEncounter)return;
  const selected=c.activeSquadId,encounter=c.pendingEncounter;
  assert.ok(['tucuman','salta'].includes(encounter.sector),'Resolve an unexpected real encounter before this side operation.');
  const alive=living(c);
  const destination=encounter.sector==='salta'?'tucuman':'cordoba';
  c=dispatchCampaign(c,{type:'respondToEncounter',groupId:encounter.groupId,choice:'retreat',destination});
  assert.equal(c.lastError,null,c.lastError);assert.equal(c.defeated,false);assert.equal(c.pendingBattle,null);
  report({event:'createdCuyoArsenalRearEncounter',sector:encounter.sector,choice:'retreat',destination,deaths:alive.filter(id=>!c.operativeState[id].alive),hour:c.hour,second:c.secondOfHour,campaign:c});
  retained=retain();
  retained.order({type:'selectSquad',id:selected});
 };
 const order=action=>{resolve();return retained.order(action);};
 const local=rosterFor(c).filter(op=>op.id!==2&&living(c).includes(op.id)&&c.operativeState[op.id].location==='mendoza'&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp)
  .sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id).slice(0,5).map(op=>op.id);
 assert.equal(local.length,5,'Five existing healthy local veterans provide the shortest paid arsenal column.');
 assert.ok(local.some(id=>rosterFor(c).find(op=>op.id===id).medical>=60),'The actual local column needs its existing physician.');
 for(const operativeId of local)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<240&&local.some(id=>{const r=c.operativeState[id];return r.morale<50||r.fatigue||r.energy<100||r.asleep;});hour++)order({type:'wait',hours:1});
 assert.ok(local.every(id=>{const r=c.operativeState[id];return r.morale>=50&&!r.fatigue&&r.energy===100&&!r.asleep;}),'Existing paid rest must finish before the actual coastal march.');
 const candidates=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].morale>=50&&contractQuote(c,op,'day').available)
  .sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price);
 const physician=candidates.filter(op=>op.medical>=60).sort((a,b)=>b.medical-a.medical)[0];assert.ok(physician,'A second actual physician accompanies the second column.');
 const recruits=[...candidates.filter(op=>op.id!==physician.id).slice(0,6),physician];assert.equal(recruits.length,7);
 assert.ok(recruits.reduce((sum,op)=>sum+contractQuote(c,op,'day').price,0)<=c.resources.treasury-30000,'The actual first paid terms must fit the treasury and return reserve.');
 for(const recruit of recruits){const quote=contractQuote(c,recruit,'day'),cash=c.resources.treasury;order({type:'recruitCivic',id:recruit.id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.price);}
 for(let hour=0;hour<24&&recruits.some(op=>!c.recruited.includes(op.id));hour++)order({type:'wait',hours:1});
 assert.ok(recruits.every(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'));
 const field=[...local,...recruits.map(op=>op.id)],columns=[];
 for(let offset=0;offset<field.length;offset+=6){order({type:'createSquad',name:'Arsenal de Barragán',ids:field.slice(offset,offset+6),sector:'mendoza'});columns.push(c.activeSquadId);}
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of field)if(![1800,1801,1802,1803].includes(rosterFor(c).find(op=>op.id===id).weapon))c=recoverRoutePrimary(c,id,{preferredWeapon:1801,replace:true,report});
 c=supplyFreshMountainAmmunition(c,field,{target:12,report});
 const doctor=rosterFor(c).filter(op=>local.includes(op.id)&&op.medical>=60).sort((a,b)=>b.medical-a.medical)[0];
 for(const op of [doctor,physician])c=supplyRouteDressings(c,op.id,8,{report});
 order({type:'configureArtillery',types:[]});
 for(const id of columns){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c,{report});order({type:'travel',sector:'buenos_aires',mode:'posta',queue:true});}
 for(let hour=0;hour<168&&columns.some(id=>c.squads.find(q=>q.id===id).journey);hour++){
  resolve();for(const id of columns)if(c.squads.find(q=>q.id===id).journey?.status==='paused'){order({type:'selectSquad',id});order({type:'resumeTravel'});}
  order({type:'wait',hours:1});
 }
 resolve();assert.equal(c.location,'buenos_aires');assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='buenos_aires'&&!c.squads.find(q=>q.id===id).journey));
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<72&&(c.hour%24<6||c.hour%24>10||field.some(id=>{const r=c.operativeState[id];return r.fatigue||r.energy<100||r.asleep;}));hour++)order({type:'wait',hours:1});
 for(const operativeId of field){assert.ok(!c.operativeState[operativeId].fatigue&&c.operativeState[operativeId].energy===100&&!c.operativeState[operativeId].asleep);order({type:'assignCare',operativeId,assignment:'active'});}
 for(const id of columns){order({type:'selectSquad',id});order({type:'attack',sector:'ensenada',queue:true,mode:'posta'});}
 for(let hour=0;hour<24&&columns.some(id=>c.squads.find(q=>q.id===id).journey?.status!=='ready');hour++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));retained.retain(8*3600);
 order({type:'beginAssault',sector:'ensenada'});assert.deepEqual(c.pendingBattle.squad.map(op=>op.id),field);assert.deepEqual(c.pendingBattle.artillery,[]);
 report({event:'createdCuyoArsenalAssaultReady',field,doctors:[doctor.id,physician.id],reinforcements:recruits.map(op=>op.id),hour:c.hour,second:c.secondOfHour,campaign:c});
 return {campaign:c,originalSquad,originalMembers,field,recruits:recruits.map(op=>op.id)};
}

export function recoverCreatedCuyoMountainArtillery(start,{report=()=>{},onCheckpoint=()=>{}}={}){
 const before=structuredClone(start),oldDeaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const spent=Object.entries(start.artilleryDepots??{}).flatMap(([sector,guns])=>guns.filter(g=>!g.loaded&&!g.ammo).map(g=>({sector,gun:storedArtilleryRecord(g)})));
 const prepared=prepareCreatedCuyoArsenalAssault(start,{report});let c=prepared.campaign;
 onCheckpoint('arsenal-assault',c);
 c=fightNorthernSector(c,'ensenada',{controller:recoveryPortSearchController(enterSector(c.pendingBattle,c.sectorStates.ensenada)),report}).campaign;
 onCheckpoint('arsenal-victory',c);
 const survivors=prepared.field.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.ok(survivors.length>=3,'The actual field gun needs three surviving available crew.');
 assert.ok(prepared.originalMembers.every(id=>c.operativeState[id].alive),'The original foundry squad must survive this side operation.');
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});const order=retained.order;
 const doctors=rosterFor(c).filter(op=>survivors.includes(op.id)&&op.medical>0&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 const remaining=[...survivors],groups=[];
 while(remaining.length){const doctor=doctors.find(id=>remaining.includes(id));assert.notEqual(doctor,undefined,'Each actual surviving six-person care party needs a conscious member with medical skill.');const reserved=doctors.filter(id=>id!==doctor&&remaining.includes(id)).slice(0,Math.ceil(remaining.length/6)-1);const ids=[doctor,...remaining.filter(id=>id!==doctor&&!reserved.includes(id))].slice(0,6);for(const id of ids)remaining.splice(remaining.indexOf(id),1);order({type:'createSquad',name:'Arsenal y socorro de Barragán',ids,sector:'ensenada'});groups.push({id:c.activeSquadId,members:ids});}
 for(const operativeId of survivors)order({type:'assignCare',operativeId,assignment:'active'});retained.retain(8*3600);
 for(const group of [...groups].sort((a,b)=>Number(b.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding))-Number(a.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding)))){
  order({type:'selectSquad',id:group.id});let care=visit(c);const dressings=care.battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0),aid=autoBandageBattle(care.battle);
  assert.equal(aid.battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0),dressings-aid.steps.filter(action=>action.type==='useItem').length,'First aid consumes one actual finite dressing per treatment.');
  care=sync({campaign:care.campaign,battle:aid.battle});assert.deepEqual(aid.untreated,[],'Finite actual first aid must stabilize the surviving coastal crew.');c=leave(care);
  report({event:'createdCuyoArsenalCare',ids:group.members,treated:aid.treatedIds,seconds:aid.elapsedSeconds,dressingsSpent:aid.steps.filter(action=>action.type==='useItem').length});
 }
 assert.ok(survivors.every(id=>stable(c,id)));order({type:'selectSquad',id:groups.find(q=>q.members.length>=3).id});let pair=visit(c);
 const carrier=pair.battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.bleeding&&!u.unconscious&&!u.routed).sort((a,b)=>b.energy-a.energy)[0];assert.ok(carrier);
 pair=takeFiniteCache(pair,carrier.id,[]);c=leave(pair);
 const source=FINITE_ARTILLERY_ARSENALS.ensenada;
 assert.deepEqual(c.sectorStates.ensenada.artillery.map(storedArtilleryRecord),source.pieces,'The one-time chest exposes only its two canonical finite guns.');
 onCheckpoint('arsenal-open',c);
 for(const gun of source.pieces){
  const quote=artilleryTransportQuote(c,'ensenada',gun.id,'mendoza','carts','field');assert.equal(quote.available,true,quote.reason);
  const cash=c.resources.treasury;order({type:'transportArtillery',sector:'ensenada',artilleryId:gun.id,to:'mendoza',mode:'carts',source:'field'});assert.equal(c.resources.treasury,cash-quote.cost);
  assert.deepEqual(c.artilleryTransfers.find(t=>t.id===gun.id).gun,gun);
  report({event:'createdCuyoArsenalShipment',id:gun.id,cost:quote.cost,hours:quote.hours,hour:c.hour});
 }
 for(const group of groups){order({type:'selectSquad',id:group.id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
 for(let hour=0;hour<168&&(groups.some(group=>c.squads.find(q=>q.id===group.id).journey)||source.pieces.some(gun=>!c.artilleryDepots.mendoza?.some(g=>g.id===gun.id)));hour++)order({type:'wait',hours:1});
 assert.equal(c.location,'mendoza');assert.ok(groups.every(group=>!c.squads.find(q=>q.id===group.id).journey));
 for(const id of prepared.recruits)if(c.recruited.includes(id)&&c.operativeState[id].alive)order({type:'dismiss',id});
 for(const id of prepared.originalMembers)if(!c.squads.find(q=>q.id===prepared.originalSquad).members.includes(id))order({type:'assignToSquad',operativeId:id,squadId:prepared.originalSquad});
 order({type:'selectSquad',id:prepared.originalSquad});assert.deepEqual(c.squad,prepared.originalMembers);
 for(const {sector,gun}of spent)assert.deepEqual(c.artilleryDepots[sector].find(g=>g.id===gun.id),gun,'Existing spent pieces retain their original depot and exact ammunition.');
 for(const gun of source.pieces)assert.deepEqual(c.artilleryDepots.mendoza.find(g=>g.id===gun.id),gun,'The exact two finite arsenal guns arrive without changing ammunition.');
 for(const id of oldDeaths)assert.equal(c.operativeState[id].alive,false);assert.deepEqual(start,before);
 const selections=source.pieces.map(gun=>'depot:'+gun.id);onCheckpoint('arsenal-delivered',c);
 report({event:'createdCuyoMountainArsenalReady',selections,hour:c.hour,second:c.secondOfHour,campaign:c});
 return {campaign:saved({campaign:c}).campaign,selections};
}
