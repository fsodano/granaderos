import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {totalAmmo} from '../game/ammo-types.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {hiringArrivalReason} from '../game/hiring-arrivals.js';
import {livingNorthernReliefPlan} from './created-living-northern-relief.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0),living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);
const property=(c,id)=>{const op=rosterFor(c).find(v=>v.id===id),r=c.operativeState[id],ammo=carriedAmmunition(op,r);return {hp:r.hp,maxHp:r.maxHp,bleeding:r.bleeding,medkits:r.medkits,rounds:totalAmmo(ammo)+ammo.loaded,startingCartridgesIssued:r.startingCartridgesIssued,headwear:structuredClone(r.headwear),outfit:structuredClone(r.outfit),legwear:structuredClone(r.legwear)};};

// The real current willingness/custody quotes choose the added people. This
// phase does not claim clinical recovery, finite gear or assault readiness.
export function livingNorthernReplacementPlan(c,{fieldSize=7,commanderId=57,term='week',destination=c.location}={}){
 assert.ok(Number.isSafeInteger(fieldSize)&&fieldSize>=6&&fieldSize<=42);
 const current=livingNorthernReliefPlan(c,{commanderId});assert.equal(current.patients.length,0,'First finish actual survivor care.');
 assert.equal(hiringArrivalReason(c,destination),null,'The actual arrival site must be publicly open.');
 const missing=fieldSize-current.field.length;assert.ok(missing>=0,'Retain every living field participant.');
 const candidates=current.candidates.filter(row=>row.hp>=15&&!row.bleeding&&row.arrivalHours===0).sort((a,b)=>Number(b.medical>=60)-Number(a.medical>=60)||b.marksmanship-a.marksmanship||a[term].total-b[term].total||a.id-b.id).slice(0,missing);
 assert.equal(candidates.length,missing,'Each replacement needs a real willing living candidate, recovered property and admitted arrival.');
 const quotes=candidates.map(row=>({id:row.id,quote:contractQuote(c,rosterFor(c).find(op=>op.id===row.id),term)}));for(const row of quotes)assert.equal(row.quote.available,true,row.quote.reason);
 const retainedQuotes=current.keepers.map(id=>({id,expiry:contractExpiresSeconds(c.contracts[id]),day:contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),week:contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'week')}));
 const cost=quotes.reduce((sum,row)=>sum+row.quote.total,0);assert.ok(c.resources.treasury>=cost,'Pay every current quote from the real treasury.');
 return {fieldSize,commanderId,term,destination,keepers:current.keepers,field:current.field,candidates,quotes,cost,retainedQuotes};
}

export function hireLivingNorthernReplacements(start,{report=()=>{},...options}={}){
 const before=structuredClone(start),plan=livingNorthernReplacementPlan(start,options),originalGuns=guns(start),oldGroups=structuredClone(start.enemyGroups),oldReserves=structuredClone(start.enemyReserves),added=[];
 let c=decodeSave(encodeSave(start)).campaign;
 for(const row of plan.quotes){
  const id=row.id,op=rosterFor(c).find(v=>v.id===id),r=c.operativeState[id],old=property(c,id),quote=contractQuote(c,op,plan.term),treasury=c.resources.treasury,time=clock(c);
  assert.ok(r.alive&&!r.captured&&!r.serviceEquipmentReturn&&!c.recruited.includes(id));assert.equal(civicStatus(c,id).available,true);assert.deepEqual(quote,row.quote);
  const action={type:'recruitCivic',id,term:plan.term,destination:plan.destination},next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;
  assert.equal(clock(c),time);assert.equal(c.resources.treasury,treasury-quote.total);assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].location,plan.destination);assert.deepEqual(property(c,id),old,'Recovered returned veterans gain no second stock, clothing or health allowance.');
  assert.equal(c.contracts[id].expiresAt,quote.expiresAt);assert.equal(c.contracts[id].expiresSecond??0,quote.expiresSecond??0);added.push(id);
  report({event:'livingNorthernReplacementHired',id,action,quote,treasuryBefore:treasury,treasuryAfter:c.resources.treasury,startedSeconds:time,arrivedSeconds:clock(c),propertyBefore:old,propertyAfter:property(c,id)});
 }
 const keepers=[...plan.keepers,...added];assert.deepEqual(living(c),keepers);assert.equal(keepers.filter(id=>id!==plan.commanderId).length,plan.fieldSize);
 for(const id of plan.keepers){assert.deepEqual(c.operativeState[id],start.operativeState[id]);assert.deepEqual(c.contracts[id],start.contracts[id]);}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(guns(c),originalGuns);assert.deepEqual(c.enemyGroups,oldGroups);assert.deepEqual(c.enemyReserves,oldReserves);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury-plan.cost);
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'livingNorthernReplacementsArrived',plan,added,keepers,field:keepers.filter(id=>id!==plan.commanderId),campaign:structuredClone(c),scope:'Actual current paid hires and admitted arrival only; wounds, equipment, long-term retention and next northern request remain unproved.'});return c;
}
