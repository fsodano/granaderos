import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {ARTILLERY,artilleryProfile} from '../game/artillery-definitions.js';
import {artilleryTransportPath,artilleryTransportQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {depotSelection} from '../game/artillery-depots.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {tooTiredToMarch} from '../game/march-fatigue.js';
import {order,visit,saved} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';

const clock=s=>s.hour*3600+(s.secondOfHour??0);
const serving=(s,id)=>s.recruited.includes(id)&&s.operativeState[id]?.alive&&!s.operativeState[id].captured&&s.contracts[id]&&(contractExpiresSeconds(s.contracts[id])===null||contractExpiresSeconds(s.contracts[id])>clock(s));
const fail=(report,message,details={})=>{report({event:'finiteBatteryUnavailable',message,...details});throw Error(message);};
const controlled=(s,sector)=>s.sectors[sector]?.owner==='patriot';
const pieces=s=>[...Object.entries(s.artilleryDepots??{}).flatMap(([sector,guns])=>guns.map(gun=>({sector,source:'depot',gun}))),...Object.entries(s.sectorStates??{}).flatMap(([sector,scene])=>(scene.artillery??[]).map(gun=>({sector,source:'field',gun})))].filter(row=>controlled(s,row.sector)&&row.gun.side==='player');
const fit=(s,types,destination,excludeIds)=>{const rows=pieces(s).filter(row=>!excludeIds.has(row.gun.id)&&(row.sector===destination||artilleryTransportPath(s,row.sector,destination,'carts'))),chosen=[];for(const type of types){const row=rows.filter(row=>row.gun.type===type&&!chosen.some(candidate=>candidate.gun.id===row.gun.id)).sort((a,b)=>Number(b.sector===s.location)-Number(a.sector===s.location)||Number(b.source==='depot')-Number(a.source==='depot')||b.gun.ammo+Number(b.gun.loaded)-a.gun.ammo-Number(a.gun.loaded)||a.gun.id.localeCompare(b.gun.id))[0];if(row)chosen.push(row);}return chosen;};
function renewCrew(state,report,keepServing){
 let s=state;
 for(const id of new Set([...s.squad,...keepServing])){
  if(!serving(s,id))fail(report,`The named serving battery participant ${id} is no longer available.`,{id});
  const expiry=contractExpiresSeconds(s.contracts[id]);if(expiry===null||expiry>clock(s)+2*3600)continue;
  const quote=contractQuote(s,rosterFor(s).find(op=>op.id===id),'day');
  if(!quote.available||s.resources.treasury<quote.price)fail(report,`The real battery crew renewal for ${id} is unaffordable.`,{id,price:quote.price,treasury:s.resources.treasury});
  const cash=s.resources.treasury,contract=s.contracts[id];s=order(s,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(s.resources.treasury,cash-quote.price);
  report({event:'routeBatteryRenewal',id,price:quote.price,hour:s.hour,second:s.secondOfHour??0});
 }
 return s;
}
function travel(state,sector,report,keepServing){
 let s=state;
 for(let attempt=0;attempt<720;attempt++){
  if(s.pendingBattle||s.pendingEncounter)fail(report,'Resolve the real encounter before moving the battery crew.',{sector:s.location,destination:sector});
  const journey=s.squads.find(q=>q.id===s.activeSquadId)?.journey;
  if(!journey&&s.location===sector)return s;
  s=renewCrew(s,report,keepServing);
  if(journey?.status==='ready')fail(report,'The battery crew reached an unresolved assault.',{destination:sector});
  if(journey?.status==='paused'){s=order(s,{type:'cancelTravel',choice:'stop'});continue;}
  if(!journey){
   const tired=s.squad.filter(id=>tooTiredToMarch(s.operativeState[id])||s.operativeState[id].asleep);
   if(tired.length){for(const id of tired){const r=s.operativeState[id];if(r.asleep&&(r.energy??0)>=100)s=order(s,{type:'setSleep',operativeId:id,asleep:false});else if(!r.asleep)s=order(s,{type:'setSleep',operativeId:id,asleep:true});}s=order(s,{type:'wait',hours:1});continue;}
   for(const id of s.squad)if(s.operativeState[id].assignment!=='active')s=order(s,{type:'assignCare',id,assignment:'active'});
   s=order(s,{type:'travel',sector,queue:true,mode:s.routes.posta?'posta':'march'});
  }else s=order(s,{type:'wait',hours:1});
 }
 fail(report,`The actual battery crew journey to ${sector} did not finish within 720 hourly orders.`);
}
function readyCrew(state,required,report,keepServing){
 let s=state;
 const ready=()=>s.squad.filter(id=>{const r=s.operativeState[id];return r?.alive&&r.hp>=15&&!r.unconscious&&!r.routed&&!r.captured&&!r.asleep&&(r.energy??0)>10;});
 for(let hour=0;hour<168;hour++){
  for(const id of s.squad){const r=s.operativeState[id];if(r.asleep&&(r.energy??0)>=75)s=order(s,{type:'setSleep',operativeId:id,asleep:false});}
  if(ready().length>=required){for(const id of s.squad)if(s.operativeState[id].assignment!=='active')s=order(s,{type:'assignCare',id,assignment:'active'});return s;}
  if(s.pendingBattle||s.pendingEncounter)fail(report,'Resolve the actual encounter before the artillery crew can rest.');
  for(const id of s.squad)if(s.operativeState[id].assignment!=='rest')s=order(s,{type:'assignCare',id,assignment:'rest'});
  s=renewCrew(s,report,keepServing);s=order(s,{type:'wait',hours:1});
 }
 fail(report,`The actual local battery crew cannot supply ${required} capable soldiers.`,{sector:s.location,units:s.squad.map(id=>({id,...s.operativeState[id]}))});
}

// Recover only the campaign's real conquered arsenals. Move each existing
// physical gun once through ordinary local storage or paid transport. A lost
// route, dead crew, depleted source or interrupted delivery is a real failure.
// Explicit supporting soldiers retain their actual paid terms during each
// journey/rest/delivery wait, even when they are outside the gun's crew squad.
export function prepareRouteBattery(start,types,{destination=start.location,excludeIds=[],keepServing=[],report=()=>{}}={}){
 assert.ok(Array.isArray(types)&&types.length<=3&&types.every(type=>Object.hasOwn(ARTILLERY,type)),'Choose up to three existing artillery types.');
 assert.ok(Array.isArray(keepServing)&&keepServing.every(id=>Number.isSafeInteger(id)&&serving(start,id)),'Only explicitly named actual serving soldiers can retain their paid terms.');
 let s=saved({campaign:structuredClone(start)}).campaign;
 if(s.pendingBattle||s.pendingEncounter)fail(report,'Resolve the actual encounter before preparing finite artillery.');
 if(!controlled(s,destination))fail(report,'The real artillery destination must be controlled.',{destination});
 const selected=[];
 for(const type of types){
  const unavailable=new Set([...excludeIds,...selected.map(gun=>gun.id)]);
  let row=fit(s,[type],destination,unavailable)[0];
  if(!row){
   const arsenal=Object.values(FINITE_ARTILLERY_ARSENALS).filter(source=>source.pieces.some(gun=>gun.type===type&&!unavailable.has(gun.id))&&controlled(s,source.sector)&&!s.artilleryArsenalRecoveries[source.sector]&&(source.sector===destination||artilleryTransportPath(s,source.sector,destination,'carts'))).sort((a,b)=>Number(b.sector===s.location)-Number(a.sector===s.location))[0];
   if(!arsenal)fail(report,`No remaining controlled physical arsenal can supply ${type}.`,{destination,selected:selected.map(gun=>gun.id)});
   s=readyCrew(travel(s,arsenal.sector,report,keepServing),1,report,keepServing);
   for(const id of s.squad)if(s.operativeState[id].assignment!=='active')s=order(s,{type:'assignCare',id,assignment:'active'});
   const pair=visit(s),carrier=pair.battle.units.filter(unit=>unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.asleep&&(unit.energy??0)>10).sort((a,b)=>b.energy-a.energy)[0];
   if(!carrier)fail(report,'A real awake local soldier must open the conquered arsenal.',{sector:arsenal.sector});
   s=leaveFiniteCache(takeFiniteCache(pair,carrier.id,[]));
   report({event:'routeArsenalRecovered',sector:arsenal.sector,ids:arsenal.pieces.map(gun=>gun.id),hour:s.hour,second:s.secondOfHour??0});
   row=fit(s,[type],destination,unavailable)[0];
  }
  if(!row)fail(report,`The recovered ${type} has no available canonical custody.`);
  selected.push(structuredClone(row.gun));
 }
 for(const gun of selected){
  const row=pieces(s).find(row=>row.gun.id===gun.id);assert.ok(row,'The selected actual piece must retain its original custody.');
  if(row.sector===destination&&row.source==='depot')continue;
  s=readyCrew(travel(s,row.sector,report,keepServing),artilleryProfile(s,gun).crew,report,keepServing);
  for(const id of s.squad)if(s.operativeState[id].assignment!=='active')s=order(s,{type:'assignCare',id,assignment:'active'});
  if(row.sector===destination){
   s=order(s,{type:'storeArtillery',sector:row.sector,artilleryId:gun.id});report({event:'routeBatteryStored',sector:row.sector,id:gun.id,record:storedArtilleryRecord(gun),hour:s.hour});
  }else{
   if(!s.routes.carts)s=order(s,{type:'transport',mode:'carts'});
   const quote=artilleryTransportQuote(s,row.sector,gun.id,destination,'carts',row.source);if(!quote.available)fail(report,quote.reason,{id:gun.id,source:row.sector,destination});
   const cash=s.resources.treasury;s=order(s,{type:'transportArtillery',sector:row.sector,artilleryId:gun.id,to:destination,mode:'carts',source:row.source});assert.equal(s.resources.treasury,cash-quote.cost);
   const transfer=s.artilleryTransfers.find(transfer=>transfer.id===gun.id);assert.deepEqual(transfer.gun,storedArtilleryRecord(gun));
   report({event:'routeBatteryShipment',id:gun.id,from:row.sector,to:destination,cost:quote.cost,dueAt:transfer.dueAt,record:structuredClone(transfer.gun),hour:s.hour});
  }
 }
 s=travel(s,destination,report,keepServing);
 for(let hour=0;selected.some(gun=>!(s.artilleryDepots[destination]??[]).some(stored=>stored.id===gun.id))&&hour<720;hour++){
  if(s.pendingEncounter||s.pendingBattle)fail(report,'Resolve the actual encounter before finite artillery delivery.',{destination});
  s=renewCrew(s,report,keepServing);s=order(s,{type:'wait',hours:1});
 }
 const actual=selected.map(gun=>{const delivered=s.artilleryDepots[destination]?.find(stored=>stored.id===gun.id);if(!delivered)fail(report,'The exact finite gun has not arrived at the controlled destination.',{id:gun.id,destination});assert.deepEqual(delivered,storedArtilleryRecord(gun),'Transport/storage must not add shots, restore loading or replace the gun.');return delivered;});
 const selections=actual.map(depotSelection);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(s.operativeState[id].alive,false,'Earlier casualties remain permanent.');
 report({event:'routeBatteryPrepared',destination,selections,records:structuredClone(actual),hour:s.hour,second:s.secondOfHour??0});
 return {campaign:saved({campaign:s}).campaign,selections};
}

// Earlier bots bought three identical light pieces. Select distinct actual
// reachable guns for that tactical plan; missing property remains a failure.
export function prepareRouteMixedBattery(start,count,{destination=start.location,preferredTypes=['swivel','bronze4','field8'],excludeIds=[],report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=3);
 const reachable=sector=>sector===destination||artilleryTransportPath(start,sector,destination,'carts');
 const pool=pieces(start).filter(row=>reachable(row.sector)).map(row=>row.gun);
 for(const source of Object.values(FINITE_ARTILLERY_ARSENALS))if(controlled(start,source.sector)&&!start.artilleryArsenalRecoveries?.[source.sector]&&reachable(source.sector))pool.push(...source.pieces);
 const unavailable=new Set(excludeIds),priority=type=>{const index=preferredTypes.indexOf(type);return index<0?preferredTypes.length:index;};
 const available=[...new Map(pool.map(gun=>[gun.id,gun])).values()].filter(gun=>!unavailable.has(gun.id)&&artilleryProfile(start,gun).crew<=start.squad.length).sort((a,b)=>priority(a.type)-priority(b.type)||b.ammo+Number(b.loaded)-a.ammo-Number(a.loaded)||a.id.localeCompare(b.id)).slice(0,count);
 if(available.length!==count)fail(report,'The controlled reachable finite gun pool or actual crew cannot form the requested mixed battery.',{destination,count,available:available.map(gun=>({id:gun.id,type:gun.type,loaded:gun.loaded,ammo:gun.ammo}))});
 const result=prepareRouteBattery(start,available.map(gun=>gun.type),{destination,excludeIds,report});
 const records=result.selections.map(selection=>result.campaign.artilleryDepots[destination].find(gun=>depotSelection(gun)===selection));
 report({event:'routeMixedBatteryPrepared',destination,records:structuredClone(records)});return {...result,records};
}
