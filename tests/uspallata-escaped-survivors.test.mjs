import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,exitPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {artilleryStorageQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {visit,leave} from './local-contract-fixture.mjs';
import {recoverFreshUspallataDepartures} from './fresh-mountain-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+': '+n.lastError);return n;};
const canonical=c=>{const n=structuredClone(c);for(const key of ['sectorStates','sceneStates'])if(n[key])for(const id of Object.keys(n[key]))n[key][id]=expandCellScene(n[key][id]);return n;};
const saved=p=>{const n=decodeSave(encodeSave(p.campaign,p.battle??null));assert.deepEqual(canonical(n.campaign),canonical(p.campaign));assert.deepEqual(n.battle,p.battle??null);return n;};
const body=(b,id)=>b.units.find(u=>u.id===String(id));
function step(p,action){
 const original=structuredClone(p.battle),battle=actBattle(p.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
 assert.deepEqual(presentedActBattle(p.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(p.battle))),action),battle);assert.deepEqual(p.battle,original);
 const synced=syncBattleTime(p.campaign,battle);assert.equal(synced.error,null);return saved(synced);
}

// The factory declares people, tools, finite guns and ordinary injury traps.
// Every wound and departure is then earned through actual paid Native orders.
function setup({kits=2,escape=true,nearExpiry=false}={}){
 const d=scaffoldDocuments('declared-uspallata-escape-recovery');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post','uspallata').replaceAll('"camp"','"mendoza"').replaceAll('camp:', 'mendoza:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=10000;d.content.startingTerritory.uspallata.owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={mendoza:0,uspallata:0};
 d.content.characters=Array.from({length:4},(_,i)=>({...structuredClone(base),id:'survivor-'+i,name:'Superviviente '+i,nickname:'Superviviente '+i,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:100,medical:i===2?60:30},startingSupplies:{rations:0,torches:0,medkits:i===2?kits:0,boleadoras:0}}));
 d.maps.uspallata.spawns=[{id:'entry',x:18,y:8,side:'player'},{id:'opposition',x:2,y:8,side:'enemy'}];
 d.maps.uspallata.props=[{id:'finite-battery',type:'chest',x:16,y:7,footprint:{width:1,height:1},blocksMovement:true},
  ...[0,1].map(i=>({id:'injury-'+i,type:'chest',x:17+i,y:10,footprint:{width:1,height:1},blocksMovement:true}))];
 d.world.physical.caches.uspallata={chest:'finite-battery',contents:[]};
 d.world.physical.arsenals.uspallata={version:1,sector:'uspallata',chest:'finite-battery',pieces:[
  {id:'arsenal:declared:heavy',type:'field8',side:'player',loaded:false,ammo:3},
  {id:'arsenal:declared:swivel',type:'swivel',side:'player',loaded:true,ammo:1}]};
 d.world.physical.environment.uspallata={doors:[],containers:[0,1].map(i=>({selector:{type:'chest',id:'injury-'+i},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:18,breathLoss:0,discoveredBy:[]}}}))};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:24,reserve:1,raidEveryHours:240,axis:['uspallata']}}};
 const declaration=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(definition),[]);
 let c=initialCampaign(42,definition);const ids=rosterFor(c).map(op=>op.id),prices=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.ok(quote.available);const cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day'});assert.equal(c.resources.treasury,cash-quote.price);prices.push(quote.price);}
 c=order(c,{type:'createSquad',ids,sector:'mendoza',name:'Columna real'});
 c=order(c,{type:'transport',mode:'posta'});c=order(c,{type:'travel',sector:'uspallata',mode:'posta'});
 c=leaveFiniteCache(takeFiniteCache(visit(c),ids[0],[],{cacheId:'finite-battery'}));
 assert.equal(c.sectorStates.uspallata.artillery.length,2);
 if(nearExpiry){
  const expiry=contractExpiresSeconds(c.contracts[ids[0]]);
  // Native contract attention can stop an earlier wait at its two-hour warning.
  for(let attempt=0;expiry-clock(c)>3600&&attempt<32;attempt++)c=order(c,{type:'wait',hours:1});
  assert.ok(expiry>clock(c)&&expiry-clock(c)<=3600,'Actual paid waits must reach the stated one-hour renewal boundary.');
 }
 c=order(c,{type:'createSquad',ids:ids.slice(0,2),sector:'uspallata',name:'Guardia del paso'});const home=c.activeSquadId;
 if(escape){
  c=order(c,{type:'createSquad',ids:ids.slice(2),sector:'uspallata',name:'Patrulla del paso'});let p=visit(c);
  for(const [i,id]of ids.slice(2).entries()){
   const hp=body(p.battle,id).hp;p=takeFiniteCache(p,id,[],{cacheId:'injury-'+i});assert.ok(body(p.battle,id).hp<hp&&body(p.battle,id).bleeding>0);assert.equal(p.battle.props.find(prop=>prop.id==='injury-'+i).trap.armed,false);
  }
  const exit=p.battle.exits.find(e=>e.edge==='E'&&e.destination.startsWith('cell-'));assert.ok(exit);
  for(const id of ids.slice(2)){
   const u=body(p.battle,id),cell=getReachable(p.battle,u).filter(point=>boundaryMatches(p.battle,point,exit.edge)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(cell);
   p=step(p,{type:'move',unitId:String(id),x:cell.x,y:cell.y});assert.ok(boundaryMatches(p.battle,body(p.battle,id),exit.edge));
  }
  const preview=exitPreview(p.battle,{unitIds:ids.slice(2).map(String),exitId:exit.id});assert.ok(preview.available,preview.reason);
  p=step(p,{type:'exit',unitIds:ids.slice(2).map(String),exitId:exit.id});c=leave(p);
  for(const id of ids.slice(2)){assert.equal(c.operativeState[id].location,exit.destination);assert.equal(c.operativeState[id].arrival.fromSector,'uspallata');assert.ok(c.operativeState[id].alive&&c.operativeState[id].bleeding>0);}
 }
 c=order(c,{type:'selectSquad',id:home});assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,ids,home,prices};
}

function replay(start,events){
 let p=saved({campaign:start});
 for(const row of events){
  if(['freshRouteOrder','freshRouteRenewal'].includes(row.event)){p={campaign:order(p.campaign,row.action),battle:p.battle};}
  if(row.event==='uspallataEscapeCareInput'){
   p.campaign=order(p.campaign,{type:'visitSector'});p.battle=enterSector(p.campaign.pendingBattle,p.campaign.sectorStates[p.campaign.location]);p=saved(p);assert.deepEqual(p,row.campaign?{campaign:row.campaign,battle:row.battle}:row);
  }
  if(row.event==='freshMountainAidOrders')for(const action of row.steps){
   const n=actBattle(p.battle,action);assert.equal(n.lastError,null);assert.deepEqual(presentedActBattle(p.battle,action).state,n);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(p.battle))),action),n);p.battle=n;
  }
  if(row.event==='freshMountainAidCheckpoint'){const n=syncBattleTime(p.campaign,p.battle);assert.equal(n.error,null);p=saved(n);assert.deepEqual(p,{campaign:row.campaign,battle:row.battle});}
  if(row.event==='uspallataEscapeCareReturned')p=saved({campaign:leave(p)});
 }
 return saved(p).campaign;
}

test('real wounded departures earn finite self-first aid and return enough actual crew to store the selected field8 and swivel',t=>{
 const {campaign:start,ids,home}=setup(),original=structuredClone(start),events=[];
 const guns=start.sectorStates.uspallata.artillery.map(storedArtilleryRecord),heavy=guns.find(g=>g.type==='field8');assert.equal(artilleryProfile(start,heavy).crew,3);
 assert.equal(start.squad.length,2);assert.equal(artilleryStorageQuote(start,'uspallata',heavy.id).available,false);
 const c=recoverFreshUspallataDepartures(start,{report:e=>events.push(structuredClone(e))});
 assert.equal(c.activeSquadId,home);assert.deepEqual(c.squad,ids.slice(0,2));assert.equal(c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='uspallata').length,4);
 for(const id of ids){assert.ok(c.operativeState[id].alive&&c.recruited.includes(id));assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
 const aid=events.find(e=>e.event==='freshMountainAidOrders');assert.ok(aid.steps.some(a=>a.type==='useItem'&&a.unitId===String(ids[2])&&a.targetId===String(ids[2])));assert.equal(start.operativeState[ids[2]].medkits-c.operativeState[ids[2]].medkits,2);
 const returned=events.find(e=>e.event==='uspallataEscapePartyReturned');assert.ok(returned.elapsedSeconds>0);assert.equal(returned.quote.action.mode,'march');assert.ok(events.some(e=>e.event==='freshRouteOrder'&&e.action.type==='wait'));
 assert.deepEqual(c.sectorStates.uspallata.artillery.map(storedArtilleryRecord),guns);assert.deepEqual(canonical(replay(start,events)),canonical(c));assert.deepEqual(recoverFreshUspallataDepartures(saved({campaign:start}).campaign),c);assert.deepEqual(start,original);
 let stored=order(c,{type:'squad',ids});for(const gun of guns){assert.equal(artilleryStorageQuote(stored,'uspallata',gun.id).available,true);stored=order(stored,{type:'storeArtillery',sector:'uspallata',artilleryId:gun.id});}
 assert.deepEqual(stored.artilleryDepots.uspallata,guns);assert.deepEqual(stored.sectorStates.uspallata.artillery,[]);saved({campaign:stored});
 t.diagnostic(JSON.stringify({actualDepartures:ids.slice(2),localCrew:[2,4],requiredCrew:3,aidSteps:aid.steps.length,finiteKitsUsed:2,returnHours:returned.elapsedSeconds/3600,stored:guns.map(g=>g.id),replay:true}));
});

test('without finite carried dressings the actual neutral care pair is retained and no strategic return is claimed',()=>{
 const {campaign:start,ids}=setup({kits:0}),original=structuredClone(start),events=[];let failure;
 assert.throws(()=>recoverFreshUspallataDepartures(start,{report:e=>events.push(structuredClone(e))}),e=>{failure=e;return /vendas/.test(e.message);});
 assert.ok(failure.pair?.battle&&failure.campaign.pendingBattle);assert.equal(failure.campaign, failure.pair.campaign);assert.equal(failure.pair.battle.units.filter(u=>u.side==='player').length,2);
 assert.ok(ids.slice(2).every(id=>failure.campaign.operativeState[id].alive&&failure.campaign.operativeState[id].location!=='uspallata'));
 assert.ok(!events.some(e=>e.event==='freshRouteOrder'&&['travel','wait'].includes(e.action.type)));assert.ok(!events.some(e=>e.event==='uspallataEscapePartyReturned'));assert.deepEqual(start,original);saved(failure.pair);
});

test('ordinary sufficient local crews have no departure recovery orders or changes',()=>{
 const {campaign:start}=setup({escape:false}),before=structuredClone(start),events=[];const c=recoverFreshUspallataDepartures(start,{report:e=>events.push(e)});
 assert.deepEqual(c,start);assert.deepEqual(start,before);assert.deepEqual(events,[]);saved({campaign:c});
});

test('the real near-expiry party and its local guard pay current quoted renewals before finite care and the return clock',()=>{
 const {campaign:start,ids}=setup({nearExpiry:true}),events=[];
 const c=recoverFreshUspallataDepartures(start,{report:e=>events.push(structuredClone(e))}),renewals=events.filter(e=>e.event==='freshRouteRenewal');
 assert.ok(renewals.length>=ids.length);assert.ok(renewals.every(e=>e.price===contractQuote(start,rosterFor(start).find(op=>op.id===e.id),'day').price));
 assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((n,e)=>n+e.price,0));
 for(const id of ids)assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));
 assert.ok(events.findIndex(e=>e.event==='freshRouteRenewal')<events.findIndex(e=>e.event==='uspallataEscapeCareInput'));assert.deepEqual(canonical(replay(start,events)),canonical(c));
});
