import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {TOWN_INCOME_SOURCES,dailyTownIncome} from '../game/town-income.js';
import {contractQuote} from '../game/contracts.js';
import {rosterFor} from '../game/campaign.js';
import {order,saved} from './local-contract-fixture.mjs';
import {meetLocalIncomeRepresentative,ensureRouteTownIncome} from './route-town-income.mjs';

// Territorial ownership is declared for this meeting subsystem. No battle,
// prior spoken agreement, or fresh campaign conquest is claimed by this setup.
function ready({headquarters='buenos_aires',complete=true,instantHire=false}={}){
 const content=defaultContentPackage();content.headquarters=headquarters;content.startingTerritory=defaultStartingTerritory(headquarters);
 if(instantHire)content.characters.find(character=>character.id==='person-110').arrivalHours=0;
 if(complete)for(const source of TOWN_INCOME_SOURCES)for(const id of source.requiredSectors)content.startingTerritory[id]={owner:'patriot',loyalty:65};
 return order(initialCampaign(8,content),{type:'createOfficer',name:'Testigo del puerto',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
}

test('route meetings activate every fully controlled port through a saved physical conversation',()=>{
 for(const source of TOWN_INCOME_SOURCES){
  const start=ready({headquarters:source.sectorId}),before=structuredClone(start),events=[];
  const campaign=meetLocalIncomeRepresentative(start,{operativeId:1000,report:event=>events.push(event)});
  assert.deepEqual(start,before);assert.equal(campaign.location,source.sectorId);assert.equal(campaign.pendingBattle,null);
  assert.equal(dailyTownIncome(campaign),source.dailyAmount);assert.equal(events.length,1);assert.equal(events[0].event,'townIncomeActivated');
  assert.ok(campaign.hour*3600+(campaign.secondOfHour??0)>before.hour*3600+(before.secondOfHour??0),'the real approach consumes tactical time');
  assert.equal(campaign.resources.treasury,before.resources.treasury);assert.deepEqual(campaign.ammunitionShops,before.ammunitionShops);
  assert.deepEqual(saved({campaign}).campaign,campaign);
  const again=meetLocalIncomeRepresentative(campaign,{operativeId:1000});assert.deepEqual(again,campaign);
 }
});

test('income travel pays an expiring traveler through a real quoted contract instead of leaving them behind',()=>{
 let start=ready({headquarters:'retiro',instantHire:true});start=order(start,{type:'recruitCivic',id:110,term:'day'});start=order(start,{type:'wait',hours:23});
 const before=structuredClone(start),events=[],quote=contractQuote(start,rosterFor(start).find(unit=>unit.id===110),'day');
 const campaign=ensureRouteTownIncome(start,{sourceId:'buenos_aires',operativeId:1000,report:event=>events.push(event)}),renewals=events.filter(event=>event.event==='townIncomeTravelRenewal');
 assert.deepEqual(start,before);assert.equal(renewals.length,1);assert.equal(renewals[0].operativeId,110);assert.equal(renewals[0].price,quote.price);
 assert.ok(campaign.recruited.includes(110));assert.equal(campaign.operativeState[110].location,'retiro');assert.deepEqual(campaign.squad,before.squad);
 assert.equal(campaign.contracts[110].expiresAt,before.contracts[110].expiresAt+24);assert.equal(campaign.resources.treasury,before.resources.treasury-quote.price);
 assert.equal(campaign.townIncome.lastPaidDay,1);assert.equal(dailyTownIncome(campaign),8000);assert.deepEqual(saved({campaign}).campaign,campaign);
});

test('the route helper travels to the real Buenos Aires representative and returns the same squad to Retiro',()=>{
 const start=ready({headquarters:'retiro'}),before=structuredClone(start),events=[];
 const campaign=ensureRouteTownIncome(start,{sourceId:'buenos_aires',operativeId:1000,report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(campaign.location,'retiro');assert.deepEqual(campaign.squad,before.squad);
 assert.equal(campaign.operativeState[1000].location,'retiro');assert.ok(!campaign.squads.find(row=>row.id===campaign.activeSquadId).journey);
 assert.equal(dailyTownIncome(campaign),8000);assert.ok(campaign.hour>before.hour);assert.ok(events.some(event=>event.event==='townIncomeActivated'));
 assert.deepEqual(saved({campaign}).campaign,campaign);assert.deepEqual(ensureRouteTownIncome(campaign,{sourceId:'buenos_aires'}),campaign);
});

test('partial ownership and an invalid speaker cannot forge a port agreement or alter the input',()=>{
 let start=ready({complete:false}),before=structuredClone(start),events=[];
 assert.throws(()=>ensureRouteTownIncome(start,{sourceId:'buenos_aires',report:event=>events.push(event)}),/No complete controlled town/);
 assert.deepEqual(start,before);assert.equal(events.at(-1).event,'townIncomeUnavailable');assert.equal(dailyTownIncome(start),0);
 start=ready();before=structuredClone(start);
 assert.throws(()=>meetLocalIncomeRepresentative(start,{operativeId:110}),/No valid awake deployed speaker/);
 assert.deepEqual(start,before);assert.deepEqual(start.townIncome.activations,{});
 const remote=ready({headquarters:'retiro'});
 assert.throws(()=>meetLocalIncomeRepresentative(remote,{sourceId:'buenos_aires'}),/physically reach/);
});
