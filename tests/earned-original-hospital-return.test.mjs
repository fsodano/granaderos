import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeLocation} from '../game/squads.js';
import {cellTravelPlan} from '../game/world-cells.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {northernHospitalOrder,northernHospitalReturnFunding,returnFreshNorthernHospital,stabilizeNorthernHospitalPatients} from './fresh-northern-recovery.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),clock=c=>c.hour*3600+(c.secondOfHour??0),saved=c=>decodeSave(encodeSave(c)).campaign;
function earnedHospital(){
 const meta=JSON.parse(readFileSync(new URL('./fixtures/earned-original-hospital-recovered.provenance.json',import.meta.url))),packed=readFileSync(new URL('./fixtures/'+meta.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const observed=JSON.parse(raw),before=structuredClone(observed),c=saved(observed.campaign);assert.deepEqual(c,observed.campaign);assert.deepEqual(observed,before);
 assert.deepEqual([c.hour,c.secondOfHour],meta.clock);assert.equal(c.resources.treasury,meta.treasury);assert.equal(c.location,meta.selectedLocation);
 return {campaign:c,sector:meta.hospitalSector,patients:meta.patientIds,escort:meta.rearIds,meta};
}
const actualParty=hospital=>hospital.campaign.recruited.filter(id=>{const r=hospital.campaign.operativeState[id];return r.alive&&!r.captured&&operativeLocation(hospital.campaign,id)===hospital.sector&&!hospital.escort.includes(id);});
function assembleLocalWard(hospital){
 let c=hospital.campaign;const ids=actualParty(hospital),home=c.squads.find(q=>q.location===hospital.sector&&!q.journey&&q.members.includes(ids[0]));assert.ok(home);
 c=dispatchCampaign(c,{type:'selectSquad',id:home.id});assert.equal(c.lastError,null);c=dispatchCampaign(c,{type:'squad',ids});assert.equal(c.lastError,null);return c;
}
const retainedDeaths=(before,after)=>{for(const[id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(after.operativeState[id].alive,false);assert.equal(after.operativeState[id].deathMinute,r.deathMinute);assert.equal(after.operativeState[id].captured,r.captured);}};

test('the genuine recovered hospital party must select its physical local ward before assembly, with no time or resource change',()=>{
 const hospital=earnedHospital(),start=hospital.campaign,before=structuredClone(start),ids=actualParty(hospital);assert.deepEqual(ids,[114,137,124,125,146,1000]);
 assert.equal(start.location,'tucuman');assert.ok(ids.every(id=>operativeLocation(start,id)==='cordoba'));
 const refused=dispatchCampaign(start,{type:'squad',ids});assert.equal(refused.lastError,'Los combatientes deben reunirse en el mismo sector antes de cambiar de escuadra.');
 assert.deepEqual(refused.operativeState,start.operativeState);assert.deepEqual(refused.squads,start.squads);assert.equal(clock(refused),clock(start));assert.deepEqual(refused.resources,start.resources);
 const assembled=assembleLocalWard(hospital);assert.equal(assembled.location,'cordoba');assert.deepEqual(assembled.squad,ids);assert.deepEqual(assembled.operativeState,start.operativeState);assert.deepEqual(assembled.contracts,start.contracts);assert.deepEqual(assembled.resources,start.resources);assert.equal(clock(assembled),clock(start));assert.deepEqual(assembled.artilleryDepots,start.artilleryDepots);
 assert.deepEqual(saved(assembled),assembled);assert.deepEqual(start,before);retainedDeaths(start,assembled);
});

test('queued real hospital departure retains every paid actor only across actual second-aware waits and earns normal midnight income',()=>{
 const hospital=earnedHospital(),start=hospital.campaign,before=structuredClone(start),events=[];let c=assembleLocalWard(hospital);
 for(const operativeId of c.squad){c=dispatchCampaign(c,{type:'assignCare',operativeId,assignment:'active'});assert.equal(c.lastError,null);}
 const departure=structuredClone(c),plan=cellTravelPlan(c,'buenos_aires');assert.equal(plan.reason,null);assert.equal(plan.hours,34);
 const funding=northernHospitalReturnFunding(c);assert.equal(funding.queued,true);assert.equal(funding.total,29846);assert.equal(funding.treasury,22572);assert.equal(funding.untilSeconds,clock(c)+48*3600);assert.deepEqual(c,departure);
 for(const row of funding.renewals){assert.equal(row.cost,row.count*row.quote.price);assert.equal(row.quote.available,true);assert.ok(row.count>0);}assert.deepEqual(funding.renewals.filter(row=>[135,147].includes(row.id)).map(row=>[row.id,row.count,row.quote.price]),[[135,2,7020],[147,2,6840]]);
 c=northernHospitalOrder(c,{type:'travel',sector:'buenos_aires',queue:true},{report:e=>events.push(e)});assert.equal(clock(c),clock(departure));assert.deepEqual(c.contracts,departure.contracts);assert.deepEqual(c.resources,departure.resources);assert.deepEqual(c.squads.find(q=>q.id===c.activeSquadId).journey.path,plan.path);assert.ok(!events.some(e=>e.event==='northernHospitalRenewal'));
 c=northernHospitalOrder(c,{type:'wait',hours:1},{report:e=>events.push(e)});assert.deepEqual([c.hour,c.secondOfHour],[647,1725]);assert.equal(c.resources.treasury,22572);const midpoint=saved(c);
 const advance=input=>northernHospitalOrder(input,{type:'wait',hours:1},{report:e=>events.push(e)});c=advance(c);const replay=northernHospitalOrder(midpoint,{type:'wait',hours:1});assert.deepEqual(replay,c);
 assert.deepEqual([c.hour,c.secondOfHour],[648,1725]);assert.equal(c.resources.treasury,30188);assert.equal(c.pendingEncounter.groupId,'enemy-group-4');assert.equal(c.pendingEncounter.sector,'tucuman');assert.deepEqual(c.recruited,start.recruited);
 const renewals=events.filter(e=>e.event==='northernHospitalRenewal');assert.deepEqual(renewals.map(e=>[e.action.id,e.cost]),[[114,172],[137,212]]);
 for(const e of renewals){assert.deepEqual([e.hour,e.secondOfHour],[647,1725]);const expiry=e.action.expectedExpiresAt*3600+(e.action.expectedExpiresSecond??0);assert.ok(expiry>e.hour*3600+e.secondOfHour&&expiry<=e.hour*3600+e.secondOfHour+3600);assert.equal(e.cost,e.quote.price);assert.equal(contractExpiresSeconds(e.contract),e.quote.expiresAt*3600+(e.quote.expiresSecond??0));}
 for(const id of [135,147])assert.deepEqual(c.contracts[id],start.contracts[id],'The expensive rear reserve is retained at its real future due boundary, not prepaid twice before zero-time departure.');
 const renewalCost=renewals.reduce((sum,e)=>sum+e.cost,0),orderCost=events.filter(e=>e.event==='northernHospitalOrder').reduce((sum,e)=>sum+e.cost,0);assert.equal(orderCost,-8000);assert.equal(c.resources.treasury,start.resources.treasury-renewalCost-orderCost);
 for(const id of start.recruited){assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].medkits,start.operativeState[id].medkits);}retainedDeaths(start,c);assert.deepEqual(saved(c),c);assert.deepEqual(start,before);
});

test('the complete earned hospital return wins the real second raid, preserves native deaths and stops bleeding with one discovered dressing before returning all six patients and clinicians',t=>{
 const hospital=earnedHospital(),before=structuredClone(hospital),start=hospital.campaign,events=[];
 const c=returnFreshNorthernHospital(hospital,{report:e=>events.push(e)}),native=events.find(e=>e.event==='northernReturnDefenseReplay'),care=events.find(e=>e.event==='northernReturnFiniteCare');assert.ok(native&&care);
 const funding=events.find(e=>e.event==='northernHospitalReturnFunding');assert.ok(funding);assert.equal(funding.queued,true);assert.equal(funding.total,29846);assert.equal(funding.treasury,22572);
 assert.equal(native.status,'victory');assert.equal(native.exactSavedReplay,true);assert.deepEqual([native.turns,native.actions,native.elapsedSeconds],[48,405,9224]);assert.deepEqual(native.losses,[116,104]);assert.equal(native.campaign.enemyGroups.find(g=>g.id==='enemy-group-4').status,'defeated');
 assert.deepEqual([native.campaign.hour,native.campaign.secondOfHour],[651,149]);assert.equal(native.campaign.operativeState[147].hp,15);assert.equal(native.campaign.operativeState[147].bleeding,5);assert.equal(native.campaign.operativeState[135].assignment,'active');assert.equal(native.campaign.operativeState[135].medkits,0);
 assert.deepEqual(care.receipt.patients,[147]);assert.deepEqual(care.receipt.doctors,[135]);assert.deepEqual(care.receipt.hires,[]);assert.deepEqual(care.receipt.donations,[]);assert.equal(care.receipt.endSeconds-care.receipt.startSeconds,3600);assert.equal(care.receipt.ticks.reduce((sum,e)=>sum+e.dressingsSpent,0),1);assert.equal(care.campaign.operativeState[147].hp,15);assert.equal(care.campaign.operativeState[147].bleeding,0);assert.equal(care.campaign.operativeState[135].assignment,'doctor');
 const take=care.receipt.orders.find(a=>a.type==='sectorInventory');assert.equal(take.direction,'take');assert.equal(take.count,1);assert.equal(take.sourceKey,JSON.stringify(['body','enemy-7','medkits']));assert.equal(JSON.parse(take.expected).count,2);
 const body=campa=>campa.sectorStates.tucuman.units.find(u=>u.id==='enemy-7');assert.equal(body(native.campaign).medkits,2);assert.equal(body(care.campaign).medkits,1);assert.equal(body(c).medkits,1);assert.equal(care.campaign.sectorStates.tucuman.props.find(p=>p.id==='tucuman:building:chest:14:7').contents.find(row=>row.item==='medkits').count,12);assert.equal(care.campaign.operativeState[135].medkits,0);
 // A publicly collected dressing can also precede the helper. A stocked active
 // physician must receive its normal doctor assignment before the first tick.
 let stocked=dispatchCampaign(native.campaign,{type:'assignCare',operativeId:147,assignment:'patient'});assert.equal(stocked.lastError,null);stocked=dispatchCampaign(stocked,take);assert.equal(stocked.lastError,null);assert.equal(stocked.operativeState[135].medkits,1);assert.equal(stocked.operativeState[135].assignment,'active');
 const stockedBefore=structuredClone(stocked),alternate=stabilizeNorthernHospitalPatients(stocked,[147],[135]);assert.deepEqual(stocked,stockedBefore);assert.deepEqual(alternate.campaign,care.campaign);assert.equal(alternate.receipt.orders[0].type,'assignCare');assert.equal(alternate.receipt.ticks[0].dressingsSpent,1);
 assert.equal(c.location,'buenos_aires');assert.deepEqual(c.squad,[114,137,124,125,146,1000]);assert.deepEqual([c.hour,c.secondOfHour],[681,335]);assert.equal(c.resources.treasury,21878);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.completed,false);assert.equal(c.defeated,false);
 for(const id of c.squad){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(operativeLocation(c,id),'buenos_aires');assert.ok(c.contracts[id]);}
 for(const id of native.losses){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,native.campaign.operativeState[id].deathMinute);}for(const id of [141,135,147]){assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].alive,true);assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);assert.equal(operativeLocation(c,id),'tucuman');}
 const renewals=events.filter(e=>e.event==='northernHospitalRenewal');for(const e of renewals){assert.equal(e.cost,e.quote.price);assert.equal(contractExpiresSeconds(e.contract),e.quote.expiresAt*3600+(e.quote.expiresSecond??0));assert.ok(e.action.expectedExpiresAt*3600+(e.action.expectedExpiresSecond??0)<=e.hour*3600+e.secondOfHour+3600);}
 assert.ok(renewals.some(e=>e.action.id===135&&e.hour===658&&e.cost===7722));assert.ok(renewals.some(e=>e.action.id===147&&e.hour===660&&e.cost===7524));
 const renewalCost=renewals.reduce((sum,e)=>sum+e.cost,0),orderCost=events.filter(e=>e.event==='northernHospitalOrder').reduce((sum,e)=>sum+e.cost,0);assert.equal(c.resources.treasury,start.resources.treasury-renewalCost-orderCost);assert.ok(c.recruited.includes(10)&&c.recruited.includes(4));assert.equal(c.contracts[1000].paid,300);retainedDeaths(start,c);assert.deepEqual(hospital,before);assert.deepEqual(saved(c),c);assert.deepEqual(saved(care.campaign),care.campaign);
 t.diagnostic(JSON.stringify({scope:'Complete actual recovered646 hospital return only; original whole recovery and ending remain separate',native:{turns:native.turns,orders:native.actions,seconds:native.elapsedSeconds,losses:native.losses,exactSavedReplay:native.exactSavedReplay},care:{patients:care.receipt.patients,physicians:care.receipt.doctors,dressings:1,source:take.sourceKey,seconds:3600},returnedClock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,renewalCost,ordinaryIncomeAndCosts:orderCost,party:c.squad}));
});
