import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareNorthernHospitalReserveReadiness} from './northern-hospital-reserve-readiness.mjs';

const sector='watch-post',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const saved=c=>{const n=decodeSave(encodeSave(c)).campaign;assert.deepEqual(n,c);return n;};
// All bodies, stable wounds, finite chest contents, roofs, prices and raid
// timing exist before the Native factory. Every subsequent change is an order.
function setup({kits=30,nearExpiry=false,acute=false,raid=false,roof=true,wounded=true}={}){
 const d=scaffoldDocuments('declared-hospital-reserve-ready'),base=d.content.characters[0];
 d.content.rules.startingTreasury=10000;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory[sector].owner='patriot';d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});d.world.expansion.buildingTargets[sector]=0;
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:[sector]}}};
 d.maps[sector].props=[{id:'finite-clinic-chest',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];d.world.physical.caches[sector]={chest:'finite-clinic-chest',contents:kits?[{item:'medkits',count:kits,weight:.2}]:[]};
 if(roof){d.maps[sector].upperSurfaces=Array.from({length:16},(_,i)=>({id:'clinic-roof-'+i,x:8+i%4,y:5+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));d.maps[sector].climbLinks=[{id:'clinic-roof-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];}
 d.content.weapons.push({id:'clinic-rifle',template:1800,name:'Fusil de la reserva',damage:40,fireAP:25,aimAP:5,reloadAP:40,range:20,readyAP:5,weight:4,price:100,art:base.portrait});
 const bodies=[{medical:90,maxHp:70,hp:70},{medical:0,maxHp:86,hp:wounded?(acute?3:28):86},{medical:0,maxHp:72,hp:wounded?40:72},{medical:0,maxHp:70,hp:70},{medical:0,maxHp:70,hp:70},{medical:30,maxHp:70,hp:70}];
 d.content.characters=bodies.map((body,i)=>({...structuredClone(base),id:'reserve-'+i,name:'Reserva '+i,nickname:'Reserva '+i,monthlyPay:300,serviceGuarantee:17,arrivalHours:0,weapon:i===1?'clinic-rifle':null,
  attributes:{...base.attributes,maxHp:body.maxHp,medical:body.medical},startingSupplies:{rations:0,torches:0,medkits:0,boleadoras:0},startingCondition:{hp:body.hp,bleeding:acute&&i===1?4:0,bandaged:acute&&i===1?0:body.maxHp-body.hp,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(definition),[]);let c=initialCampaign(42,definition);const ids=rosterFor(c).map(op=>op.id);
 for(const id of ids)c=order(c,{type:'recruitCivic',id,term:'day',destination:id===ids[5]?'camp':sector});
 c=order(c,{type:'createSquad',ids:ids.slice(0,5),sector,name:'Reserva local'});c=discoverRouteCache(c,ids[0]);
 if(roof){c=order(c,{type:'createSquad',ids:ids.slice(3,5),sector,name:'Puestos altos'});c=stageRouteRoofDefenders(c,ids.slice(3,5));}
 c=order(c,{type:'createSquad',ids:ids.slice(0,3),sector,name:'Guardias de suelo'});
 if(!acute){c=order(c,{type:'visitSector'});let battle=enterSector(c.pendingBattle,c.sectorStates[sector]);battle=actBattle(battle,{type:'drop',unitId:String(ids[1]),item:'primary',count:1});assert.equal(battle.lastError,null);let synced=syncBattleTime(c,battle);assert.equal(synced.error,null);c=synced.campaign;battle=synced.battle;c=order(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});assert.equal(c.operativeState[ids[1]].weaponDropped,true);}
 c=order(c,{type:'createSquad',ids:[ids[5]],sector:'camp',name:'Columna recuperada'});const field=c.activeSquadId;
 if(nearExpiry){const until=clock(c)+23*3600;for(let n=0;clock(c)<until&&n<30;n++)c=order(c,{type:'wait',hours:(until-clock(c))/3600});assert.equal(clock(c),until);}
 assert.deepEqual(d,declaration);return {campaign:saved(c),ids,field};
}
const run=(c,ids,options={})=>prepareNorthernHospitalReserveReadiness(c,{sector,ids:ids.slice(0,5),deadlineSeconds:clock(c)+48*3600,...options});
function replay(start,result){
 let c=structuredClone(start),battle=null,shown=null,validated=null;
 for(const [index,row]of result.receipt.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector'){assert.ok(battle);assert.deepEqual(row.action.sectorState,battle);}
   c=order(c,row.action);if(row.action.type==='visitSector'){battle=enterSector(c.pendingBattle,c.sectorStates[sector]);shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}if(row.action.type==='leaveSector')battle=null;
  }else{
   assert.ok(battle);battle=actBattle(battle,row.action);assert.equal(battle.lastError,null);shown=presentedActBattle(shown,JSON.parse(JSON.stringify(row.action))).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,JSON.parse(JSON.stringify(row.action))))));assert.deepEqual(shown,battle);assert.deepEqual(validated,battle);
   const synced=syncBattleTime(c,battle),shownSync=syncBattleTime(c,shown),validatedSync=syncBattleTime(c,validated);assert.equal(synced.error,null);assert.deepEqual(shownSync,synced);assert.deepEqual(validatedSync,synced);c=synced.campaign;battle=synced.battle;shown=shownSync.battle;validated=validatedSync.battle;
  }
  if(index===Math.floor(result.receipt.orders.length/2)){const pair=decodeSave(encodeSave(c,battle));assert.deepEqual(pair.campaign,c);assert.deepEqual(pair.battle,battle);c=pair.campaign;battle=pair.battle;if(battle){shown=decodeSave(encodeSave(c,shown)).battle;validated=decodeSave(encodeSave(c,validated)).battle;assert.deepEqual(shown,battle);assert.deepEqual(validated,battle);}}
 }
 assert.deepEqual(saved(c),result.campaign);
}
const kitStock=c=>c.recruited.reduce((n,id)=>n+c.operativeState[id].medkits,0)+c.sectorStates[sector].props.find(p=>p.id==='finite-clinic-chest').contents.filter(s=>s.item==='medkits').reduce((n,s)=>n+s.count,0);

test('actual local finite care heals two stable guards, recovers their dropped primary and pays the ground-to-roof visit while keeping the field party and old posts',()=>{
 const {campaign:start,ids,field}=setup(),before=structuredClone(start),result=run(start,ids),c=result.campaign;
 assert.ok(result.receipt.usedDressings>0);assert.equal(kitStock(start)-kitStock(c),result.receipt.usedDressings);assert.equal(result.receipt.usedDressings,result.receipt.ticks.reduce((n,row)=>n+row.usedDressings,0));assert.ok(clock(c)>clock(start));assert.ok(clock(c)<=result.receipt.deadlineSeconds);
 for(const id of ids.slice(0,5)){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].assignment,'rest');assert.ok(c.operativeState[id].residentPosition.tacticalLevel>0);assert.ok(c.recruited.includes(id));}
 assert.equal(c.operativeState[ids[0]].medkits,1);assert.equal(c.operativeState[ids[1]].weaponDropped,false);assert.ok(result.receipt.firearms.find(row=>row.id===ids[1]).recovered);
 for(const id of ids.slice(3,5))assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);
 assert.ok(result.receipt.visits[0].steps.some(a=>a.type==='move'));assert.equal(result.receipt.orders.some(row=>row.action.type==='createSquad'),false);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,field);assert.deepEqual(c.squad,start.squad);assert.equal(c.location,start.location);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run(saved(start),ids),result);
});

test('actual near-expiry local and recovered field duties receive paid renewals before clinical and roof time',()=>{
 const {campaign:start,ids}=setup({nearExpiry:true}),before=structuredClone(start),result=run(start,ids),c=result.campaign;
 assert.ok(result.receipt.renewals.length>0);assert.equal(c.resources.treasury,start.resources.treasury-result.receipt.renewals.reduce((n,row)=>n+row.quote.price,0));for(const id of ids){assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));assert.equal(c.contracts[id].guaranteeId,start.contracts[id].guaranteeId);}assert.deepEqual(start,before);replay(start,result);
});

test('exhausted known local stock refuses without hiring, discovery, courier movement or an assumed dressing',()=>{
 const {campaign:start,ids}=setup({kits:0}),before=structuredClone(start);let failure;try{run(start,ids);}catch(error){failure=error;}
 assert.match(failure?.message??'',/No admitted reachable finite local dressing/);assert.deepEqual(failure.campaign,start);assert.deepEqual(failure.hospitalReserveReadiness.orders,[]);assert.deepEqual(start,before);
});

test('actual acute wounds refuse before stable clinical preparation rather than bypassing the emergency guard',()=>{
 const {campaign:start,ids}=setup({acute:true}),before=structuredClone(start);let failure;try{run(start,ids);}catch(error){failure=error;}
 assert.match(failure?.message??'',/Stop actual acute wounds/);assert.deepEqual(failure.campaign,start);assert.deepEqual(failure.hospitalReserveReadiness.orders,[]);assert.deepEqual(start,before);
});

test('the fixed hospital deadline stops partial real care before another hour and preserves actual paid stock and health',()=>{
 const {campaign:start,ids}=setup(),before=structuredClone(start),deadlineSeconds=clock(start)+3600;let failure;try{run(start,ids,{deadlineSeconds});}catch(error){failure=error;}
 assert.match(failure?.message??'',/next actual care hour exceeds/);assert.equal(clock(failure.campaign),deadlineSeconds);assert.ok(failure.campaign.operativeState[ids[1]].hp>start.operativeState[ids[1]].hp);assert.ok(failure.campaign.operativeState[ids[1]].hp<failure.campaign.operativeState[ids[1]].maxHp);assert.ok(kitStock(failure.campaign)<kitStock(start));assert.deepEqual(start,before);
});

test('an ordinarily released raid stops local care with its actual current encounter and complete partial order receipt',()=>{
 const {campaign:start,ids}=setup({raid:true}),before=structuredClone(start);let failure;try{run(start,ids);}catch(error){failure=error;}
 assert.match(failure?.message??'',/Resolve the actual hospital return interruption/);assert.ok(failure.campaign.pendingEncounter);assert.equal(failure.campaign.pendingEncounter.sector,sector);assert.ok(clock(failure.campaign)>clock(start));assert.ok(failure.hospitalReserveReadiness.orders.some(row=>row.action.type==='wait'));assert.deepEqual(start,before);
});
