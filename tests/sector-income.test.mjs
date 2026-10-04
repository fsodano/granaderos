import {secureArea} from './secured-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,CAMPAIGN_SECTORS,isSupplied} from '../game/campaign.js';
import {sectorIncome,sectorIncomeDetails,totalSectorIncome} from '../game/sector-income.js';
import {recordCityLoyalty} from '../game/cities.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {recordTownAgreement} from './town-income-fixture.mjs';
const place=id=>CAMPAIGN_SECTORS.find(definition=>definition.id===id);
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const activated=()=>recordTownAgreement(secureArea(initialCampaign()),'buenos_aires');

test('ownership and local loyalty grant no sector income before an actual recorded port agreement',()=>{
 const state=secureArea(initialCampaign());for(const loyalty of [0,1,50,65,100]){
  state.sectors.buenos_aires.loyalty=loyalty;const before=structuredClone(state);
  assert.equal(sectorIncome(state,place('buenos_aires'),isSupplied),0);assert.equal(sectorIncome(state,place('retiro'),isSupplied),0);assert.deepEqual(state,before);
 }
 assert.equal(totalSectorIncome(state),0);assert.equal(sectorIncomeDetails(state,'buenos_aires').statusCode,'awaiting-representative');
});
test('the recorded port has a flat payment independent of loyalty, damage, blockade and supply routes',()=>{
 const state=activated();recordTownAgreement(state,'ensenada');state.blockade=true;
 for(const region of Object.values(state.sectors)){region.loyalty=0;region.damageUntil=48;}
 const before=structuredClone(state),noRoute=()=>{throw Error('Income must not query supply routes.');};
 assert.equal(sectorIncome(state,place('buenos_aires'),noRoute),8000);assert.equal(sectorIncome(state,'ensenada',noRoute),5000);assert.equal(totalSectorIncome(state,noRoute),13000);
 assert.equal(sectorIncomeDetails(state,'ensenada').base,5000);assert.deepEqual(sectorIncomeDetails(state,'ensenada').limits,[]);assert.deepEqual(state,before);
});
test('Buenos Aires needs both sectors and Retiro never duplicates its shared port income',()=>{
 const state=activated();assert.equal(sectorIncome(state,'retiro'),0);assert.equal(sectorIncomeDetails(state,'retiro').townDaily,8000);
 assert.equal(CAMPAIGN_SECTORS.reduce((sum,definition)=>sum+sectorIncome(state,definition),0),8000);
 const receipt=structuredClone(state.townIncome.activations.buenos_aires);state.sectors.retiro.owner='royalist';assert.equal(totalSectorIncome(state),0);
 assert.deepEqual(sectorIncomeDetails(state,'buenos_aires').uncontrolled,['retiro']);state.sectors.retiro.owner='patriot';assert.equal(totalSectorIncome(state),8000);assert.deepEqual(state.townIncome.activations.buenos_aires,receipt);
});
test('inland localities and mountain passes have no daily income even when fully controlled',()=>{
 const state=activated();for(const id of ['cordoba','mendoza','tucuman','salta','jujuy','san_nicolas','uspallata','los_patos','humahuaca']){
  state.sectors[id].owner='patriot';state.sectors[id].loyalty=100;const details=sectorIncomeDetails(state,place(id));assert.equal(details.eligible,false,id);assert.equal(details.base,0,id);assert.equal(details.daily,0,id);
 }
 assert.equal(totalSectorIncome(state),8000);
});
test('daily treasury payment uses the flat activated sources at the boundary and records only one port payout',()=>{
 const state=activated();recordTownAgreement(state,'ensenada');state.hour=23;const treasury=state.resources.treasury;
 const paid=order(state,{type:'wait',hours:1});assert.equal(paid.resources.treasury,treasury+13000);assert.equal(paid.townIncome.lastPaidDay,1);
 assert.equal(paid.log.filter(row=>row.text.includes('puertos acordados')).length,1);assert.match(paid.log.find(row=>row.text.includes('puertos acordados')).text,/13000 pesos/);
 const tomorrow=order(paid,{type:'wait',hours:24});assert.equal(tomorrow.resources.treasury,paid.resources.treasury+13000);
});
test('quest cooperation keeps its loyalty effects while recurring money remains fixed by the port agreement',()=>{
 const state=activated(),before=totalSectorIncome(state),loyalty=state.sectors.retiro.loyalty;
 recordCityLoyalty(state,{sectorId:'retiro',kind:'quest',eventId:'income-check'});assert.ok(state.sectors.retiro.loyalty>loyalty);assert.equal(totalSectorIncome(state),before);
 const after=state.sectors.retiro.loyalty;recordCityLoyalty(state,{sectorId:'retiro',kind:'quest',eventId:'income-check'});assert.equal(state.sectors.retiro.loyalty,after);assert.equal(totalSectorIncome(state),8000);
});
test('loss at midnight suspends a retained agreement and a later recapture resumes only the next daily payment',()=>{
 const state=activated();state.hour=23;state.sectors.buenos_aires.owner='royalist';const treasury=state.resources.treasury;
 const missed=order(state,{type:'wait',hours:1});assert.equal(missed.resources.treasury,treasury);assert.equal(missed.townIncome.lastPaidDay,1);
 missed.sectors.buenos_aires.owner='patriot';const resumed=order(missed,{type:'wait',hours:24});assert.equal(resumed.resources.treasury,treasury+8000);assert.deepEqual(resumed.townIncome.activations,missed.townIncome.activations);
});
test('official save continuation on both sides of midnight preserves exactly one activated payout',()=>{
 const state=activated();state.hour=23;state.secondOfHour=3599;const restored=decodeSave(encodeSave(state)).campaign;
 const paid=order(state,{type:'advanceStrategicTime',seconds:1});assert.deepEqual(order(restored,{type:'advanceStrategicTime',seconds:1}),paid);
 const resumed=decodeSave(encodeSave(paid)).campaign;assert.equal(resumed.resources.treasury,state.resources.treasury+8000);
 const next=order(resumed,{type:'wait',hours:1});assert.equal(next.resources.treasury,paid.resources.treasury);
 const rejected=dispatchCampaign(resumed,{type:'wait',hours:0});assert.ok(rejected.lastError);assert.equal(rejected.resources.treasury,paid.resources.treasury);
});
