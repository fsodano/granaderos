import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {baseMorale} from '../game/morale.js';
import {studyForecast,workAssignmentReason} from '../game/assignments.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount,ammoTypeFor} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {expandedCapitalWaitNotice} from './created-expanded-capital-return.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);
const carried=(c,id)=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);
function knownRounds(c,sector,id,family){
 return (c.ammunitionStores[sector]?.[family]??0)+sectorInventoryModel(c,sector,rosterFor(c),id).entries.filter(row=>{
  const stack=JSON.parse(row.expected);return row.reachable&&stack.kind==='ammunition'&&stack.ammoType===AMMUNITION_FAMILIES[family].type;
 }).reduce((sum,row)=>sum+row.count,0);
}

// Recovery retains the actual living party. It does not certify a new assault
// or replace the unchanged six/seven-person force and readiness controls.
export function livingNorthernCommandRecoveryPlan(c,{commanderId=57,hospital='cordoba',qualifiedMedical=60,maxRestHours=600,maxLogisticsHours=24}={}){
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 assert.ok(Number.isSafeInteger(maxRestHours)&&maxRestHours>0&&maxRestHours<=600);assert.ok(Number.isSafeInteger(maxLogisticsHours)&&maxLogisticsHours>=4&&maxLogisticsHours<=24);
 assert.ok(Number.isSafeInteger(qualifiedMedical)&&qualifiedMedical>=60&&qualifiedMedical<=100);
 const keepers=living(c),field=keepers.filter(id=>id!==commanderId),source=c.operativeState[field[0]]?.location,roster=rosterFor(c),commander=roster.find(op=>op.id===commanderId);
 assert.ok(keepers.includes(commanderId)&&field.length>=1&&field.length<=42);assert.equal(c.location,source);assert.equal(c.operativeState[commanderId].location,hospital);
 assert.equal(c.sectors[source].owner,'patriot');assert.equal(c.sectors[hospital].owner,'patriot');assert.ok(!c.enemyGroups.some(g=>[source,hospital].includes(g.target)&&['waiting','engaged','stationed'].includes(g.status)));
 const forecast=studyForecast(c.operativeState[commanderId],commander,'medical');assert.ok(commander.medical+forecast.remainingGains>=qualifiedMedical,'Only the real lifetime practice capacity can qualify this commander.');
 if(commander.medical<qualifiedMedical)assert.equal(workAssignmentReason(c,commander,'practice',{skill:'medical'},roster),'');
 const ammunition=[];
 for(const id of keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&r.energy>10);assert.ok(expiry===null||expiry>clock(c));if(id!==commanderId){assert.equal(r.location,source);const u=carried(c,id),family=ammoTypeFor({...u,activeSlot:'primary'});assert.ok([1800,1801,1802].includes(u.weapon)&&u.loaded>0&&!u.jammed);assert.equal(r.activeSlot,'primary');assert.ok(r.medkits>=10);for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot]?.condition>0);const missing=Math.max(0,16-u.loaded-ammoCount(u,family));ammunition.push({id,family,missing,known:knownRounds(c,source,id,family)});}}
 for(const family of new Set(ammunition.map(row=>row.family)))assert.ok(ammunition.find(row=>row.family===family).known>=ammunition.filter(row=>row.family===family).reduce((sum,row)=>sum+row.missing,0),'Every missing round needs known reachable physical stock.');
 const serviceDays=Math.ceil((maxRestHours+maxLogisticsHours)/24),quotes=keepers.map(id=>({id,quote:contractRenewalQuote(c,roster.find(op=>op.id===id),'day')}));for(const row of quotes)assert.equal(row.quote.available,true,row.quote.reason);
 const requiredTreasury=10000+quotes.reduce((sum,row)=>sum+row.quote.price*serviceDays,0);assert.ok(c.resources.treasury>=requiredTreasury,'Fund the full bounded service horizon without projected income.');
 return {commanderId,hospital,source,keepers,field,qualifiedMedical,maxRestHours,maxLogisticsHours,ammunition,missingRounds:ammunition.reduce((sum,row)=>sum+row.missing,0),forecast,serviceDays,requiredTreasury};
}

export function recoverLivingNorthernCommand(start,{report=()=>{},...options}={}){
 const before=structuredClone(start),plan=livingNorthernCommandRecoveryPlan(start,options),oldGuns=guns(start),oldGroups=structuredClone(start.enemyGroups),events=[];
 let c=decodeSave(encodeSave(start)).campaign,phase='finite-ammunition';const emit=e=>events.push(e);
 let expectedRounds=plan.field.reduce((sum,id)=>{const u=carried(c,id);return sum+u.loaded+ammoCount(u);},0);
 const safe=()=>{
  assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual(living(c),plan.keepers);assert.deepEqual(guns(c),oldGuns);
  for(const g of oldGroups)assert.deepEqual(c.enemyGroups.find(row=>row.id===g.id),g);
  for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
  for(const id of plan.keepers){const r=c.operativeState[id],old=start.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(r.alive&&!r.captured&&!r.bleeding);assert.equal(r.hp,old.hp);assert.equal(r.maxHp,old.maxHp);assert.equal(r.medkits,old.medkits);assert.ok(expiry===null||expiry>clock(c));for(const slot of ['headwear','outfit','legwear'])assert.deepEqual(r[slot],old[slot]);}
  assert.equal(c.operativeState[plan.commanderId].location,plan.hospital);assert.equal(plan.field.reduce((sum,id)=>{const u=carried(c,id);return sum+u.loaded+ammoCount(u);},0),expectedRounds);
 };
 const issue=action=>{const time=clock(c),cash=c.resources.treasury,next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;safe();emit({event:'livingNorthernCommandRecoveryOrder',phase,action,startSeconds:time,endSeconds:clock(c),treasuryBefore:cash,treasuryAfter:c.resources.treasury});};
 const retain=seconds=>{for(const id of plan.keepers){let expiry=contractExpiresSeconds(c.contracts[id]);while(expiry!==null&&expiry<=clock(c)+seconds){const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};assert.equal(quote.available,true,quote.reason);issue(action);assert.equal(c.resources.treasury,cash-quote.price);assert.equal(c.contracts[id].expiresAt,quote.expiresAt);assert.equal(c.contracts[id].expiresSecond??0,quote.expiresSecond??0);assert.ok(contractExpiresSeconds(c.contracts[id])>expiry);expiry=contractExpiresSeconds(c.contracts[id]);emit({event:'livingNorthernCommandRecoveryRenewal',id,quote,action});}}};
 let pauses=0;
 const wait=()=>{retain(3601);const time=clock(c);issue({type:'wait',hours:1});const elapsed=clock(c)-time;assert.ok(elapsed>=0&&elapsed<=3600);if(!elapsed){const notice=expandedCapitalWaitNotice(c,{startedSeconds:time,requestedHours:1});assert.ok(++pauses<=3,'Bound real zero-time assignment acknowledgements.');emit({event:'livingNorthernCommandRecoveryPaused',phase,notice});}else pauses=0;};
 try{
  for(const row of plan.ammunition){const time=clock(c),cash=c.resources.treasury,pool=knownRounds(c,plan.source,row.id,row.family),receipts=[],next=supplyRouteAmmunition(c,[row.id],{target:16,report:e=>receipts.push(e)});c=next.campaign;expectedRounds+=row.missing;safe();assert.equal(clock(c),time);assert.equal(c.resources.treasury,cash);assert.equal(next.transactions.reduce((sum,r)=>sum+r.quantity,0),row.missing);assert.equal(knownRounds(c,plan.source,row.id,row.family),pool-row.missing);for(const e of receipts)emit(e);emit({event:'livingNorthernCommandRoundsRecovered',id:row.id,rounds:row.missing,poolBefore:pool,poolAfter:pool-row.missing});}
  phase='return';issue({type:'configureArtillery',types:[]});const groups=[];
  for(let offset=0;offset<plan.field.length;offset+=6){const ids=plan.field.slice(offset,offset+6),existing=c.squads.find(q=>q.location===plan.source&&!q.journey&&q.members.length===ids.length&&ids.every(id=>q.members.includes(id)));if(existing)issue({type:'selectSquad',id:existing.id});else issue({type:'createSquad',ids,sector:plan.source,name:'Supervivientes del Norte'});groups.push({id:c.activeSquadId,ids});for(const operativeId of ids)issue({type:'assignCare',operativeId,assignment:'active'});}
  retain(5*3600);const departure=clock(c);
  for(const group of groups){issue({type:'selectSquad',id:group.id});const quote=previewStrategicRoute(c,group.id,plan.hospital,'posta');assert.equal(quote.valid,true,quote.reason);assert.deepEqual(quote.path,[plan.source,plan.hospital]);assert.equal(quote.hours,4);assert.equal(quote.action.type,'travel');emit({event:'livingNorthernCommandReturnQuoted',group,quote});issue(quote.action);}
  while(groups.some(group=>c.squads.find(q=>q.id===group.id).journey)){assert.ok(clock(c)-departure<plan.maxLogisticsHours*3600);wait();}assert.equal(clock(c)-departure,4*3600);for(const id of plan.keepers)assert.equal(c.operativeState[id].location,plan.hospital);
  phase='rest-and-practice';for(const operativeId of plan.field)issue({type:'assignCare',operativeId,assignment:'rest'});
  if(rosterFor(c).find(op=>op.id===plan.commanderId).medical<plan.qualifiedMedical)issue({type:'assignWork',operativeId:plan.commanderId,assignment:'practice',skill:'medical'});
  const began=clock(c),ready=id=>{const r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id);return r.hp===r.maxHp&&!r.bleeding&&r.energy===100&&!r.fatigue&&!r.asleep&&r.morale>=baseMorale(op);};
  while(clock(c)-began<plan.maxRestHours*3600){
   const qualified=rosterFor(c).find(op=>op.id===plan.commanderId).medical>=plan.qualifiedMedical;
   if(qualified&&c.operativeState[plan.commanderId].assignment!=='rest')issue({type:'assignCare',operativeId:plan.commanderId,assignment:'rest'});
   for(const id of plan.keepers)if(c.operativeState[id].asleep&&c.operativeState[id].energy===100)issue({type:'setSleep',operativeId:id,asleep:false});
   if(qualified&&plan.keepers.every(ready))break;assert.ok(clock(c)-began+3600<=plan.maxRestHours*3600,'Do not request an extra hour beyond the real rest/practice cap.');wait();
  }
  assert.ok(rosterFor(c).find(op=>op.id===plan.commanderId).medical>=plan.qualifiedMedical,'A real physician must finish actual practice inside the unchanged600h bound.');assert.ok(plan.keepers.every(ready),'Every actual living person must meet unchanged full native health/energy/fatigue/base morale inside600h.');
  for(const operativeId of plan.field)issue({type:'assignCare',operativeId,assignment:'active'});
  for(const id of plan.field){const r=c.operativeState[id],u=carried(c,id);assert.equal(r.activeSlot,'primary');assert.ok(u.loaded>0&&!u.jammed&&u.loaded+ammoCount(u)>=16&&r.medkits>=10);}
  safe();assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
  emit({event:'livingNorthernCommandRecoveryReady',plan,returnSeconds:4*3600,restPracticeSeconds:clock(c)-began,groups,campaign:structuredClone(c),scope:'Actual finite surviving-party return, full rest and native commander medical practice only. No new recruits, six/seven-person force, militia participation, native request or ending proof.'});for(const e of events)report(e);return c;
 }catch(error){assert.deepEqual(start,before);report({event:'livingNorthernCommandRecoveryStopped',phase,reason:error.message,attemptReports:events,input:structuredClone(start),lastObservedCampaign:structuredClone(c),scope:'Unadopted actual failure evidence; no returned recovered campaign.'});throw error;}
}
