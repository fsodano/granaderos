import {secureArea} from './secured-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,CAMPAIGN_SECTORS,isSupplied} from '../game/campaign.js';
import {sectorIncome,sectorIncomeDetails,totalSectorIncome} from '../game/sector-income.js';
import {recordCityLoyalty} from '../game/cities.js';
import {encodeSave,decodeSave} from '../game/save.js';
const place=id=>CAMPAIGN_SECTORS.find(d=>d.id===id);

test('local loyalty scales income from zero to the base without mutating the campaign',()=>{
 const s=secureArea(initialCampaign()),def=place('buenos_aires');
 for(const loyalty of [0,1,50,65,100]){
  s.sectors.buenos_aires.loyalty=loyalty;const before=structuredClone(s);
  assert.equal(sectorIncome(s,def,isSupplied),loyalty*2);assert.deepEqual(s,before);
 }
 s.sectors.buenos_aires.loyalty=0;assert.equal(sectorIncome(s,place('retiro'),isSupplied),52);
});
test('loyalty and independent disruption factors combine before integer rounding',()=>{
 const s=secureArea(initialCampaign()),def=place('ensenada');s.sectors.ensenada.loyalty=65;
 s.blockade=true;s.sectors.ensenada.damageUntil=24;
 const p=sectorIncomeDetails(s,def,()=>false);assert.equal(p.daily,3);assert.equal(p.base,160);assert.equal(p.loyalty,65);assert.equal(p.limits.length,4);
 s.sectors.ensenada.owner='royalist';assert.equal(sectorIncome(s,def,isSupplied),0);
 s.sectors.cordoba.owner='patriot';s.sectors.cordoba.loyalty=100;assert.equal(sectorIncome(s,place('cordoba'),isSupplied),130,'a naval blockade does not penalize an inland sector');
});
test('daily treasury payment uses pre-recovery loyalty, and the following day uses its growth',()=>{
 const s=secureArea(initialCampaign());s.hour=23;const before=s.resources.treasury;
 assert.equal(totalSectorIncome(s,isSupplied),286);
 const paid=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(paid.lastError,null);assert.equal(paid.resources.treasury-before,286);
 assert.equal(paid.sectors.retiro.loyalty,66);assert.equal(totalSectorIncome(paid,isSupplied),289);
 const tomorrow=dispatchCampaign(paid,{type:'wait',hours:24});assert.equal(tomorrow.lastError,null);assert.equal(tomorrow.resources.treasury-paid.resources.treasury,289);
 assert.match(paid.log.find(e=>e.text.includes('aduanas')).text,/286 pesos/);
});
test('a zero-loyalty payment cannot spend that same midnight cooperation recovery',()=>{
 const s=secureArea(initialCampaign());s.hour=23;for(const r of Object.values(s.sectors))r.loyalty=0;
 const paid=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(paid.resources.treasury,s.resources.treasury);assert.equal(paid.sectors.retiro.loyalty,1);
});
test('damage expiry and supply loss change the real payment at the collection boundary',()=>{
 const s=secureArea(initialCampaign());s.hour=23;s.blockade=true;s.sectors.ensenada.damageUntil=24;
 const now=totalSectorIncome(s,isSupplied),atMidnight=totalSectorIncome({...s,hour:24},isSupplied);
 assert.ok(atMidnight>now);const paid=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(paid.resources.treasury-s.resources.treasury,atMidnight);
 const cut=secureArea(initialCampaign());cut.sectors.salta.owner='patriot';cut.sectors.salta.loyalty=100;assert.equal(isSupplied(cut,'salta'),false);assert.equal(sectorIncome(cut,place('salta'),isSupplied),45);
 cut.hour=23;const expected=totalSectorIncome(cut,isSupplied),next=dispatchCampaign(cut,{type:'wait',hours:1});assert.equal(next.resources.treasury-cut.resources.treasury,expected);assert.equal(next.sectors.salta.loyalty,100);
});
test('quest cooperation raises real recurring income only once for the same result',()=>{
 const s=secureArea(initialCampaign());s.hour=23;const before=totalSectorIncome(s,isSupplied);
 recordCityLoyalty(s,{sectorId:'retiro',kind:'quest',eventId:'income-check'});const improved=totalSectorIncome(s,isSupplied);assert.ok(improved>before);
 recordCityLoyalty(s,{sectorId:'retiro',kind:'quest',eventId:'income-check'});assert.equal(totalSectorIncome(s,isSupplied),improved);
 const paid=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(paid.resources.treasury-s.resources.treasury,improved);
});
test('frontier requisition trades immediate horses for reduced later local contributions',()=>{
 const s=secureArea(initialCampaign());s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';s.sectors.mendoza.loyalty=80;s.location='mendoza';s.squads[0].location='mendoza';
 const next=dispatchCampaign(s,{type:'policy',kind:'frontierRequisition'});assert.equal(next.lastError,null);assert.equal(next.resources.horses,s.resources.horses+8);
 assert.equal(sectorIncome(s,place('mendoza'),isSupplied),80);assert.equal(sectorIncome(next,place('mendoza'),isSupplied),65);
});
test('save continuation on both sides of midnight cannot duplicate or change the payout',()=>{
 const s=secureArea(initialCampaign());s.hour=23;s.sectors.retiro.loyalty=37;
 const paid=dispatchCampaign(s,{type:'wait',hours:1}),restored=decodeSave(encodeSave(s)).campaign;
 assert.deepEqual(dispatchCampaign(restored,{type:'wait',hours:1}),paid);
 const resumed=decodeSave(encodeSave(paid)).campaign;assert.equal(resumed.resources.treasury,paid.resources.treasury);
 const hour=dispatchCampaign(resumed,{type:'wait',hours:1});assert.equal(hour.resources.treasury,paid.resources.treasury);
 const rejected=dispatchCampaign(resumed,{type:'wait',hours:0});assert.ok(rejected.lastError);assert.equal(rejected.resources.treasury,paid.resources.treasury);
});
