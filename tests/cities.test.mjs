import test from 'node:test';
import assert from 'node:assert/strict';
import {CITIES,RURAL_SECTORS,cityForSector,getCityStatus,recordCityLoyalty,validCityLoyaltyEvents} from '../game/cities.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {militiaEligibility,militiaCourse} from '../game/militia.js';
const state=()=>({hour:24,sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(s=>[s.id,{owner:'patriot',loyalty:50}]))});
test('operational areas partition campaign sectors without overlaps',()=>{
 const sectors=[...CITIES.flatMap(c=>c.sectors),...RURAL_SECTORS];assert.equal(new Set(sectors).size,sectors.length);assert.deepEqual(sectors.sort(),CAMPAIGN_SECTORS.map(s=>s.id).sort());assert.equal(cityForSector('retiro').id,'buenos_aires');assert.equal(cityForSector('uspallata'),null);
});
test('all grouped sectors must be controlled, even when training elsewhere',()=>{
 const s=state();s.sectors.ensenada.owner='royalist';for(const at of ['buenos_aires','retiro','ensenada'])assert.equal(militiaEligibility(s,at).code,'control');s.sectors.ensenada.owner='patriot';assert.equal(militiaEligibility(s,'retiro').eligible,true);
});
test('mean city loyalty has a strict fifty-percent threshold and rural training fails',()=>{
 const s=state();s.sectors.ensenada.loyalty=49;assert.equal(getCityStatus(s,'retiro').loyalty,49);assert.equal(militiaEligibility(s,'retiro').code,'loyalty');s.sectors.ensenada.loyalty=50;assert.equal(militiaEligibility(s,'retiro').eligible,true);assert.equal(militiaEligibility(s,'los_patos').code,'rural');
});
test('quests and victories grow regional loyalty exactly once per outcome',()=>{
 const s=state();for(const id of CITIES[0].sectors)s.sectors[id].loyalty=35;
 assert.equal(recordCityLoyalty(s,{sectorId:'retiro',kind:'quest',eventId:'academy'}).delta,8);
 assert.equal(recordCityLoyalty(s,{sectorId:'retiro',kind:'quest',eventId:'academy'}).applied,false);
 assert.equal(militiaEligibility(s,'retiro').eligible,false);
 recordCityLoyalty(s,{sectorId:'ensenada',kind:'victory',eventId:'battle-123'});
 assert.equal(militiaEligibility(s,'retiro').eligible,true);assert.equal(getCityStatus(s,'buenos_aires').loyalty,53);assert.equal(s.cityLoyaltyEvents.length,2);assert.equal(validCityLoyaltyEvents(s.cityLoyaltyEvents),true);
 const loaded=structuredClone(s);assert.equal(recordCityLoyalty(loaded,{sectorId:'ensenada',kind:'victory',eventId:'battle-123'}).applied,false);
});
test('loyalty saturates, losses count, malformed ledger and rural events cannot grant rewards',()=>{
 const s=state();s.sectors.mendoza.loyalty=98;recordCityLoyalty(s,{sectorId:'mendoza',kind:'victory',eventId:'battle'});assert.equal(s.sectors.mendoza.loyalty,100);recordCityLoyalty(s,{sectorId:'mendoza',kind:'defeat',eventId:'loss'});assert.equal(s.sectors.mendoza.loyalty,88);
 assert.equal(recordCityLoyalty(s,{sectorId:'uspallata',kind:'quest',eventId:'rural'}).applied,false);
 assert.throws(()=>recordCityLoyalty(s,{sectorId:'mendoza',kind:'fake',eventId:'bad'}));assert.equal(validCityLoyaltyEvents([...s.cityLoyaltyEvents,s.cityLoyaltyEvents[0]]),false);
});
test('teacher trait reduces training time without multiplying troops or reducing resource costs',()=>{
 const normal=militiaCourse({id:999,leadership:50,traits:[]},0),teacher=militiaCourse({id:999,leadership:50,traits:['teacher']},0);assert.ok(teacher.hours<normal.hours);assert.equal(teacher.teacher,true);assert.equal(teacher.count,normal.count);assert.deepEqual(teacher.cost,normal.cost);
});
