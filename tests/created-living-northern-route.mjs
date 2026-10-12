import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {doctorRate} from '../game/medical-care.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=(c,id)=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured;
const physicalGuns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)];

// Plan from current serving people and their real wounds. Earlier expedition
// membership is not permission to restore a fallen physician or rifleman.
export function livingNorthernReturnPlan(c,{commanderId=57,hospital='cordoba'}={}){
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.blockade,false);assert.equal(c.sectors.buenos_aires.owner,'patriot');
 const keepers=[...new Set(c.recruited.filter(id=>living(c,id)))],field=keepers.filter(id=>id!==commanderId),roster=rosterFor(c);
 assert.ok(keepers.includes(commanderId),'The actual living commander must remain under service.');
 assert.ok(field.length>=6&&field.length<=42,'The actual northern return needs its surviving field force and legal columns.');
 assert.equal(c.sectors[hospital].owner,'patriot');
 for(const id of keepers){const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>clock(c),'Each living return participant must be in actual paid service.');}
 const physicians=field.map(id=>roster.find(op=>op.id===id)).filter(op=>op.medical>=60&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical||a.id-b.id);
 assert.ok(physicians.length,'The current return needs an actual qualified serving physician.');
 const rate=doctorRate(physicians[0],c),patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 return {commanderId,hospital,keepers,field,patients,physicians:physicians.map(op=>op.id),rate,healingDressings:patients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/rate),0),dailyService:keepers.reduce((sum,id)=>sum+contractQuote(c,roster.find(op=>op.id===id),'day').price,0)};
}

// First checked phase: finite care and actual return from every province.
// All current field survivors remain serving; this phase hires nobody.
export function recoverLivingCreatedNorthernColumn(start,{report=()=>{},commanderId=57,hospital='cordoba',carryDressings=30}={}){
 const before=structuredClone(start),plan=livingNorthernReturnPlan(start,{commanderId,hospital}),guns=physicalGuns(start).map(storedArtilleryRecord),events=[];
 assert.ok(Number.isSafeInteger(carryDressings)&&carryDressings>=0);
 let c;
 try{c=recoverFreshPort(start,{hospital,fieldIds:plan.keepers,prepareCareSupplies:true,retainField:true,carryDressings,report:e=>events.push(e)});}
 catch(error){assert.deepEqual(start,before);report({event:'livingNorthernReturnStopped',phase:'finite-care',reason:error.message,input:structuredClone(start),lastObservedCampaign:events.findLast(e=>e.campaign)?.campaign??null});throw error;}
 assert.deepEqual(start,before);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 const current=c.recruited.filter(id=>living(c,id));assert.deepEqual(current,plan.keepers,'Care cannot replace or discard an actual living return participant.');
 for(const id of plan.keepers){const r=c.operativeState[id];assert.equal(r.location,hospital);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>clock(c));}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 const remainingGuns=physicalGuns(c).map(storedArtilleryRecord);assert.deepEqual(remainingGuns,guns,'The care visit and return cannot alter, recharge or duplicate physical guns.');
 assert.ok(plan.keepers.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0)>=carryDressings,'Carry only the real finite post-care linen requested for departure.');
 assert.ok(clock(c)>clock(start),'The real return and clinical care must consume campaign time.');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 for(const e of events)report(e);
 report({event:'livingNorthernCareReady',plan,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,field:plan.field,keepers:plan.keepers,campaign:structuredClone(c),scope:'Actual living-cohort finite care and Córdoba return only; northern request, native victories and ending/48h remain open.'});
 return c;
}
