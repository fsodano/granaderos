import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareNorthernRoadMedicalReserve} from './northern-road-reserve-preparation.mjs';

const sector='watch-post',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+': '+n.lastError);return n;};
const saved=c=>{const n=decodeSave(encodeSave(c)).campaign;assert.deepEqual(n,c);return n;};

// Every person, finite pack, arrival delay, price, roof and raid rule is
// declared before the Native factory. No returned campaign field is patched.
function setup({delay=0,kits=2,price=300,localKits=0,threat=true,legHours=24,nearExpiry=false,roof=true}={}){
 const d=scaffoldDocuments('declared-road-medical-reserve'),base=d.content.characters[0];
 d.content.rules.startingTreasury=5000;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 d.content.startingTerritory[sector].owner='patriot';d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours,reserve:3,raidEveryHours:threat?(nearExpiry?23:1):240,axis:[sector]}}};
 d.world.expansion.buildingTargets[sector]=0;
 if(roof){
  d.maps[sector].upperSurfaces=Array.from({length:9},(_,i)=>({id:'clinic-roof-'+i,x:8+i%3,y:6+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
  d.maps[sector].climbLinks=[{id:'clinic-roof-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 }
 d.content.characters=Array.from({length:4},(_,i)=>({...structuredClone(base),id:'reserve-'+i,name:'Reserva '+i,nickname:'Reserva '+i,
  monthlyPay:i===3?price:30,serviceGuarantee:i===3?17:0,arrivalHours:i===3?delay:0,
  attributes:{...base.attributes,medical:i===1?70:i===3?90:0},
  startingSupplies:{rations:0,torches:0,medkits:i===1?localKits:i===3?kits:0,boleadoras:0}}));
 const declaration=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(definition),[]);
 let c=initialCampaign(42,definition);const ids=rosterFor(c).map(op=>op.id);
 for(const id of ids.slice(0,3))c=order(c,{type:'recruitCivic',id,term:'day',destination:id===ids[0]?'camp':sector});
 c=order(c,{type:'createSquad',ids:ids.slice(1,3),sector,name:'Guardia local'});
 c=order(c,{type:'visitSector'});let battle=enterSector(c.pendingBattle,c.sectorStates[sector]);
 c=order(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 c=order(c,{type:'createSquad',ids:[ids[2]],sector,name:'Puesto alto'});
 if(roof)c=stageRouteRoofDefenders(c,[ids[2]]);
 const envoy=c.squads.find(q=>q.members.includes(ids[0]));assert.ok(envoy);c=order(c,{type:'selectSquad',id:envoy.id});
 if(nearExpiry){
  for(const id of ids.slice(0,3))c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
  for(let attempt=0;c.hour<23&&attempt<30;attempt++)c=order(c,{type:'wait',hours:23-c.hour});assert.equal(c.hour,23);
 }
 if(threat){
  if(!nearExpiry)c=order(c,{type:'wait',hours:1});
  const group=c.enemyGroups.find(g=>g.target===sector&&g.status==='marching');assert.ok(group);assert.equal(c.pendingEncounter,null);
 }
 assert.deepEqual(d,declaration);return {campaign:saved(c),ids,envoy:envoy.id};
}
const run=(c,options={})=>prepareNorthernRoadMedicalReserve(c,{sector,keepServing:[...c.recruited],...options});
function replay(start,result){
 let campaign=structuredClone(start),battle=null;
 for(const [index,row]of result.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector'){assert.ok(battle);assert.deepEqual(row.action.sectorState,battle);}
   campaign=order(campaign,row.action);
   if(row.action.type==='visitSector')battle=enterSector(campaign.pendingBattle,campaign.sectorStates[sector]);
   if(row.action.type==='leaveSector')battle=null;
  }else{
   assert.ok(battle);battle=actBattle(battle,row.action);assert.equal(battle.lastError,null);
   const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;
  }
  if(index===Math.floor(result.orders.length/2)){
   const pair=decodeSave(encodeSave(campaign,battle));assert.deepEqual(pair.campaign,campaign);assert.deepEqual(pair.battle,battle);campaign=pair.campaign;battle=pair.battle;
  }
 }
 assert.deepEqual(saved(campaign),result.campaign);
}

test('a threatened empty medical reserve pays one actual hire, conserves two kits and stages only its new physician before the envoy leaves',()=>{
 const {campaign:start,ids,envoy}=setup(),before=structuredClone(start),result=run(start),c=result.campaign,plan=result.progress;
 assert.equal(result.ready,true);assert.equal(result.reason,null);assert.equal(result.reliefId,ids[3]);
 assert.equal(result.orders.filter(r=>r.action.type==='recruitCivic').length,1);assert.equal(result.orders.filter(r=>r.action.type==='visitSector').length,1);
 assert.equal(c.resources.treasury,start.resources.treasury-plan.hire.quote.total);assert.equal(plan.hire.quote.guarantee,17);
 assert.equal(c.contracts[ids[3]].paid,plan.hire.quote.price);assert.equal(c.serviceGuarantees.entries[c.contracts[ids[3]].guaranteeId].state,'held');
 assert.equal(c.operativeState[ids[3]].medkits,1);assert.equal(c.operativeState[ids[1]].medkits,1);assert.equal(plan.donation.count,1);assert.equal(plan.donation.stock,2);
 assert.equal(c.operativeState[ids[3]].assignment,'rest');assert.ok(c.operativeState[ids[3]].residentPosition.tacticalLevel>0);
 assert.deepEqual(c.operativeState[ids[1]].residentPosition,start.operativeState[ids[1]].residentPosition);assert.deepEqual(c.operativeState[ids[2]].residentPosition,start.operativeState[ids[2]].residentPosition);
 assert.equal(plan.staging.initial.units.filter(u=>u.side==='player').length,1);assert.equal(plan.staging.initial.units.find(u=>u.side==='player').id,String(ids[3]));
 assert.ok(plan.staging.steps.some(a=>a.type==='move'));assert.ok(clock(c)>clock(start));assert.equal(c.activeSquadId,envoy);assert.deepEqual(c.squad,start.squad);
 for(const id of ids)for(const key of ['hp','maxHp','alive','bleeding'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key],`${id}: ${key}`);
 for(const id of ids.slice(0,3))assert.deepEqual(c.operativeState[id].inventory,start.operativeState[id].inventory);
 // The first Native visit may materialize an empty inventory object. Its
 // physical contents remain empty; no item is issued by this preparation.
 assert.deepEqual(c.operativeState[ids[3]].inventory??{},start.operativeState[ids[3]].inventory??{});
 assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run(saved(start)),result,'The fresh official input save repeats every real order and debit.');
 const again=run(c);assert.equal(again.ready,true);assert.deepEqual(again.orders,[]);assert.deepEqual(again.campaign,c);
});

test('no marching threat or an already supplied local physician needs no hire, payment, staging or state change',()=>{
 for(const options of [{threat:false},{localKits:1}]){
  const {campaign:start}=setup(options),before=structuredClone(start),result=run(start);
  assert.equal(result.ready,true);assert.equal(result.reliefId,null);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
 }
});

test('unaffordable service or exhausted finite candidate packs refuses before any paid order',()=>{
 for(const options of [{price:30000},{kits:1}]){
  const {campaign:start}=setup(options),before=structuredClone(start),result=run(start);
  assert.equal(result.ready,false);assert.match(result.reason,/treasury|supplied/);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
 }
});

test('an actual delayed arrival starts its own paid term and renews the intended old duty before real waiting',()=>{
 for(const delay of [0,2]){
 const {campaign:start,ids}=setup({delay,nearExpiry:true}),before=structuredClone(start),result=run(start,{keepServing:[ids[0]]}),c=result.campaign,hire=result.progress.hire;
 assert.equal(result.ready,true);assert.ok(result.renewals.length>0);assert.equal(c.hiringArrivals.length,0);
 const due=hireArrivalDueSeconds(hire.arrival),contract=c.contracts[ids[3]];
 assert.equal(contract.started*3600+(contract.startedSecond??0),due);assert.equal(contractExpiresSeconds(contract),due+hire.quote.hours*3600);
 assert.ok(clock(c)>=clock(start)+delay*3600);assert.equal(c.resources.treasury,start.resources.treasury-hire.quote.total-result.renewals.reduce((n,row)=>n+row.quote.price,0));
 if(!delay)assert.ok(clock(c)<=clock(start)+3600,'The immediate roof visit stays inside its actually retained hour.');
 for(const id of ids.slice(0,3)){assert.ok(c.recruited.includes(id));assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}assert.deepEqual(start,before);replay(start,result);
 }
});

test('a real raid interrupts delayed relief and re-entry preserves the exact paid booking without another order',()=>{
 const {campaign:start,ids}=setup({delay:8,legHours:1}),before=structuredClone(start),result=run(start),c=result.campaign;
 assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.equal(c.pendingEncounter.sector,sector);
 assert.equal(result.orders.filter(r=>r.action.type==='recruitCivic').length,1);assert.equal(result.orders.at(-1).action.type,'wait');
 assert.ok(c.hiringArrivals.some(a=>a.operativeId===ids[3]));assert.equal(c.operativeState[ids[3]].medkits,2);
 assert.equal(c.resources.treasury,start.resources.treasury-result.progress.hire.quote.total);assert.equal(result.progress.donation,null);assert.deepEqual(start,before);replay(start,result);
 const current=structuredClone(c),again=run(c,{progress:result.progress});assert.equal(again.reason,'pending-encounter');assert.deepEqual(again.orders,[]);assert.deepEqual(again.campaign,current);assert.deepEqual(again.progress,result.progress);
});

test('a real staging refusal exposes the paid partial campaign, current visit and complete accepted receipt',()=>{
 const {campaign:start,ids}=setup({roof:false}),before=structuredClone(start);let failure;
 try{run(start);}catch(error){failure=error;}
 assert.match(failure?.message??'',/vacant reachable roof/);assert.ok(failure.campaign?.pendingBattle?.exploration);assert.equal(failure.campaign.lastError,null);
 const receipt=failure.reservePreparation;assert.equal(receipt.progress.id,ids[3]);assert.equal(receipt.progress.donation.completed,true);assert.equal(receipt.progress.staging,null);
 assert.equal(failure.campaign.resources.treasury,start.resources.treasury-receipt.progress.hire.quote.total);assert.equal(failure.campaign.operativeState[ids[3]].medkits,1);assert.equal(failure.campaign.operativeState[ids[1]].medkits,1);
 assert.equal(receipt.orders.at(-1).action.type,'visitSector');assert.ok(receipt.battle);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(failure.campaign,receipt.battle)),{campaign:failure.campaign,battle:receipt.battle});
});
