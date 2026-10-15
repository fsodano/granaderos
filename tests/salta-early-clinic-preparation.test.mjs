import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {doctorRate} from '../game/medical-care.js';
import {stageOpeningRearCover} from './opening-rear-guard.mjs';
import {recoverSaltaClinic} from './salta-clinic-supply.mjs';
import {currentSaltaCordobaReserves} from './salta-route.mjs';
import {openingRearFormation} from './opening-rear-medical-supply.mjs';
import {saltaHospitalEncounterExecutor} from './salta-hospital-encounter.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const saved=c=>{const n=decodeSave(encodeSave(c)).campaign;assert.deepEqual(n,c);return n;};
function setup({packs=true,cache=0,rearGuard=false}={}){
 const content=defaultContentPackage();content.headquarters='tucuman';content.rules.startingTreasury=100000;content.startingTerritory.tucuman.owner='patriot';content.startingTerritory.cordoba.owner='patriot';
 content.world=structuredClone(DEFAULT_WORLD);
 for(const at of ['cordoba','tucuman'])content.world.physical.caches[at].contents=content.world.physical.caches[at].contents.filter(row=>row.item!=='medkits');
 if(cache)content.world.physical.caches.cordoba.contents.push({item:'medkits',count:cache,weight:.2});
 for(const person of content.characters){if(person.service==='contract')person.arrivalHours=0;person.startingSupplies={rations:0,torches:0,medkits:packs&&['person-100','person-101','person-102','person-103'].includes(person.id)?2:0,boleadoras:0};}
 const patient=content.characters.find(p=>p.id==='person-130');patient.attributes={...patient.attributes,maxHp:66,medical:94};patient.startingCondition={hp:21,bleeding:0,bandaged:45,energy:100,fatigue:0};patient.startingSupplies.medkits=2;
 const courier=content.characters.find(p=>p.id==='person-112');courier.attributes={...courier.attributes,medical:80};
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let campaign=initialCampaign(42,content);
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week',destination:'cordoba'});
 if(rearGuard)campaign=order(campaign,{type:'recruitCivic',id:140,term:'week',destination:'cordoba'});
 for(const id of [122,130])campaign=order(campaign,{type:'recruitCivic',id,term:'week',destination:'tucuman'});
 campaign=stageOpeningRearCover(campaign).campaign;assert.deepEqual(content,declaration);
 assert.equal(campaign.operativeState[130].hp,21);assert.equal(campaign.operativeState[122].medkits,0);assert.equal(campaign.operativeState[130].medkits,2);
 return saved(campaign);
}

test('earlier clinical preparation pays real finite relief arrivals and eight Native care strokes before an independent journey',()=>{
 const start=setup({rearGuard:true}),before=structuredClone(start),events=[],result=recoverSaltaClinic(start,{report:event=>events.push(event)}),c=result.campaign,r=result.receipt;
 assert.deepEqual(start,before);assert.deepEqual(r.patients,[130]);assert.equal(doctorRate(rosterFor(start).find(op=>op.id===122),start),6);
 assert.equal(r.ticks.filter(t=>t.to>t.from).length,8,JSON.stringify(r.ticks));assert.equal(r.usedDressings,8);assert.equal(c.operativeState[130].hp,66);assert.equal(c.operativeState[130].bleeding,0);
 assert.equal(r.supply.collectedDressings,0);assert.ok(r.supply.hires.length>1,'The declared empty cache requires real supplied paid relief.');
 for(const row of r.supply.hires){const quote=contractQuote(start,rosterFor(start).find(op=>op.id===row.id),'day');assert.equal(row.quote.price,quote.price);assert.equal(row.quote.total,quote.total);assert.equal(row.quote.available,true);assert.equal(c.contracts[row.id].paid,quote.price);assert.ok(c.recruited.includes(row.id));assert.equal(c.operativeState[row.id].location,'tucuman');assert.ok(r.supply.actions.some(action=>action.action.type==='recruitCivic'&&action.action.id===row.id));}
 assert.ok(r.supply.hires.every(row=>!start.recruited.includes(row.id)));assert.equal(r.supply.courierAlreadyServing,true);assert.equal(start.operativeState[112].medkits,0);assert.equal(r.supply.doctor,112);
 assert.ok(r.supply.hires.every(row=>(c.operativeState[row.id].residentPosition?.tacticalLevel??0)>0),'Every actual paid relief carrier reaches roof cover, including those outside the small clinical party.');
 assert.equal(openingRearFormation(c).allCovered,true);assert.equal(typeof saltaHospitalEncounterExecutor({campaign:c},'tucuman'),'function','Real relief arrivals must retain the covered hospital executor.');
 const issued=2+r.supply.hires.reduce((n,row)=>n+row.kits,0);assert.equal(c.recruited.reduce((n,id)=>n+c.operativeState[id].medkits,0),issued-8);
 assert.ok(r.ticks.filter(t=>t.to>t.from).every(t=>t.usedDressings===1&&t.to-t.from===3600));assert.ok(r.ticks.filter(t=>t.to===t.from).every(t=>t.usedDressings===0));assert.ok(r.elapsedSeconds<=72*3600);const firstPaid=r.ticks.find(t=>t.to>t.from);assert.ok(firstPaid.from>=r.supply.finish[0]*3600+r.supply.finish[1]);assert.ok(firstPaid.to>r.supply.finish[0]*3600+r.supply.finish[1]);
 assert.equal(c.resources.treasury,start.resources.treasury+r.supply.actions.filter(row=>!row.tactical).reduce((n,row)=>n+row.treasuryChange,0)+r.orders.reduce((n,row)=>n+row.treasuryAfter-row.treasuryBefore,0));
 assert.ok(c.recruited.every(id=>contractExpiresSeconds(c.contracts[id])===null||contractExpiresSeconds(c.contracts[id])>clock(c)));assert.deepEqual(saved(c),c);
 assert.deepEqual(recoverSaltaClinic(saved(start)),result,'Official fresh input-save repetition preserves the whole actual preparation.');
 const savedRear=[112,140],stale=dispatchCampaign(c,{type:'createSquad',sector:'cordoba',name:'Reserva anterior',ids:savedRear});assert.match(stale.lastError??'',/mismo sector/);assert.equal(c.operativeState[112].location,'tucuman');assert.equal(c.operativeState[140].location,'cordoba');
 const actualRear=currentSaltaCordobaReserves(c,savedRear);assert.deepEqual(actualRear,[140]);const regroup={type:'createSquad',sector:'cordoba',name:'Reserva actual',ids:actualRear},grouped=order(c,regroup);assert.deepEqual(grouped.squad,[140]);assert.equal(grouped.location,'cordoba');assert.equal(grouped.operativeState[112].location,'tucuman');assert.deepEqual(order(saved(c),regroup),grouped);assert.deepEqual(saved(grouped),grouped);
 const second=recoverSaltaClinic(c,{deadlineSeconds:clock(c)+72*3600-r.elapsedSeconds});assert.deepEqual(second.campaign,c);assert.equal(second.receipt.supply.needed,false);assert.equal(second.receipt.orders.length,0);assert.equal(second.receipt.usedDressings,0);
});

test('known finite cache discovery supplies the same actual care without an unnecessary supplied guard hire',()=>{
 const start=setup({packs:false,cache:8}),before=structuredClone(start),r=recoverSaltaClinic(start);assert.equal(r.receipt.usedDressings,8);assert.equal(r.campaign.operativeState[130].hp,66);
 assert.ok(r.receipt.supply.collectedDressings>0);assert.equal(r.receipt.supply.hires.length,0);assert.equal(r.receipt.supply.debits.reduce((n,row)=>n+row.count,0),r.receipt.supply.collectedDressings);assert.deepEqual(start,before);assert.deepEqual(saved(r.campaign),r.campaign);
});

test('a genuinely empty finite source and absent supplied relief refuse without claiming recovery or mutating the fresh input',()=>{
 const start=setup({packs:false}),before=structuredClone(start);let failure;try{recoverSaltaClinic(start);}catch(error){failure=error;}assert.match(failure?.message??'',/finite clinic deficit needs a real available paid relief guard/);assert.ok(failure.campaign);assert.ok(clock(failure.campaign)>clock(start));assert.equal(failure.campaign.operativeState[130].hp,21);assert.deepEqual(start,before);
});

test('earlier supply and care cannot manufacture a second 72-hour allowance',()=>{
 const start=setup(),before=structuredClone(start),deadlineSeconds=clock(start)+4*3600;let failure;try{recoverSaltaClinic(start,{deadlineSeconds});}catch(error){failure=error;}assert.match(failure?.message??'',/shared 72-hour allowance/);assert.ok(failure.campaign);assert.ok(clock(failure.campaign)<=deadlineSeconds,'The actual refused preparation must not spend a care hour beyond its deadline.');assert.deepEqual(start,before);
});
