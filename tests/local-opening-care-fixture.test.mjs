import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {order,saved} from './local-contract-fixture.mjs';
import {prepareLocalOpening} from './local-opening-care-fixture.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {completeTestTravel} from './campaign-test-helpers.mjs';

test('opening recovery clears a full-condition jam through finite carried-equipment repair',()=>{
 let campaign=order(initialCampaign(),{type:'recruitCivic',id:110,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});
 // Declared ignition failure isolates this recovery admission boundary. The
 // charge, paid hire and unopened finite toolkit retain their actual state.
 Object.assign(campaign.operativeState[110],{condition:100,jammed:true});
 campaign=saved({campaign}).campaign;
 const before=structuredClone(campaign),record=campaign.operativeState[110];
 const {campaign:recovered,care}=prepareLocalOpening(campaign,{buyWeapons:false});
 assert.deepEqual(campaign,before);
 assert.equal(recovered.operativeState[110].condition,100);
 assert.equal(recovered.operativeState[110].jammed,false);
 assert.equal(recovered.operativeState[110].carriedLoaded,record.carriedLoaded);
 assert.equal(recovered.operativeState[110].carriedAmmo,record.carriedAmmo);
 assert.equal(care.repairHours,1);
 assert.equal(care.repairPointsSpent,1);
 assert.equal(repairMaterialPoints(recovered.operativeState[110]),99);
 assert.equal(recovered.resources.treasury,before.resources.treasury);
 assert.ok(recovered.hour>before.hour);
 assert.equal(recovered.squads.find(q=>q.id===recovered.activeSquadId).journey,undefined);
 assert.deepEqual(saved({campaign:recovered}).campaign,recovered);
});

test('opening equipment recovery finds finite tools after both medical caches are depleted',()=>{
 let campaign=initialCampaign();
 for(const id of [110,136])campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});
 // Declare only the controlled route. Both finite caches start untouched;
 // actual journeys collect their dressings into a surviving owner's pack.
 campaign.sectors.buenos_aires.owner='patriot';campaign.sectors.san_nicolas.owner='patriot';campaign=saved({campaign}).campaign;
 campaign=collectRouteItems(campaign,110,{item:'medkits'},12).campaign;
 campaign=completeTestTravel(campaign,{sector:'buenos_aires'});
 campaign=collectRouteItems(campaign,110,{item:'medkits'},12).campaign;
 campaign=completeTestTravel(campaign,{sector:'san_nicolas'});
 campaign.operativeState[110].condition=99;campaign=saved({campaign}).campaign;
 const before=structuredClone(campaign),stock=campaign.squad.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 const {campaign:recovered,care}=prepareLocalOpening(campaign,{buyWeapons:false});
 assert.deepEqual(campaign,before);
 assert.equal(care.hours,0);assert.equal(care.dressingsFound,0);assert.equal(care.donatedDressings,0);
 assert.equal(recovered.squad.reduce((sum,id)=>sum+recovered.operativeState[id].medkits,0),stock,'the finite dressings stay in their actual owner pack');
 assert.equal(recovered.location,'san_nicolas');assert.equal(recovered.squads.find(q=>q.id===recovered.activeSquadId).journey,undefined);
 for(const id of before.squad){assert.equal(recovered.operativeState[id].alive,true);assert.equal(recovered.operativeState[id].location,'san_nicolas');assert.ok(recovered.contracts[id].paid>0);}
 assert.equal(care.repairPointsSpent,1);assert.equal(care.repairHours,1);assert.equal(recovered.operativeState[110].condition,100);
 assert.equal(recovered.squad.reduce((sum,id)=>sum+repairMaterialPoints(recovered.operativeState[id]),0),99);
 const sourceKits=['retiro','buenos_aires'].flatMap(sector=>recovered.sectorStates[sector].props.find(p=>p.id===FINITE_SECTOR_CACHES[sector].chest).contents.filter(item=>item.kind==='repair-kit'));
 assert.equal(sourceKits.length,1,'one actual toolkit leaves a finite source exactly once');assert.equal(sourceKits[0].repairPoints,100);
 assert.equal(recovered.resources.treasury,before.resources.treasury);assert.ok(recovered.hour>before.hour+care.repairHours+6);
 assert.deepEqual(saved({campaign:recovered}).campaign,recovered);
});

test('opening recovery stabilizes a critical survivor before a real finite depot round trip',()=>{
 let campaign=initialCampaign();
 for(const id of [110,136])campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});
 // Declared controlled-capital checkpoint. Paid actors and both finite caches
 // retain their original inventory. Collection and all later work use orders.
 campaign.sectors.buenos_aires.owner='patriot';campaign.location='buenos_aires';
 campaign.squads.find(q=>q.id===campaign.activeSquadId).location='buenos_aires';
 for(const id of campaign.squad)campaign.operativeState[id].location='buenos_aires';
 campaign=saved({campaign}).campaign;
 campaign=collectRouteItems(campaign,110,{item:'medkits'},12).campaign;
 // The wound is part of this admitted starting checkpoint, before recovery.
 Object.assign(campaign.operativeState[110],{hp:8,bleeding:4,bandaged:0,condition:99});
 campaign=saved({campaign}).campaign;
 const before=structuredClone(campaign),stock=campaign.squad.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 const {campaign:recovered,care}=prepareLocalOpening(campaign,{buyWeapons:false});
 assert.deepEqual(campaign,before);
 for(const id of before.squad){assert.equal(recovered.operativeState[id].alive,true);assert.equal(recovered.operativeState[id].hp,recovered.operativeState[id].maxHp);assert.equal(recovered.operativeState[id].bleeding,0);assert.equal(recovered.operativeState[id].location,'buenos_aires');assert.ok(recovered.contracts[id].paid>0);}
 assert.equal(recovered.location,'buenos_aires');
 assert.equal(recovered.squads.find(q=>q.id===recovered.activeSquadId).journey,undefined);
 const remaining=recovered.squad.reduce((sum,id)=>sum+recovered.operativeState[id].medkits,0);
 assert.equal(care.hours,stock+care.dressingsFound-remaining,'every medical work hour spends exactly one finite dressing');
 assert.equal(care.dressingsFound,12);assert.ok(care.donatedDressings>0);
 for(const sector of ['buenos_aires','retiro'])assert.equal(recovered.sectorStates[sector].props.find(p=>p.id===FINITE_SECTOR_CACHES[sector].chest).contents.some(item=>item.item==='medkits'),false,'both discovered finite sources retain their exact debit');
 assert.equal(recovered.operativeState[110].condition,100);
 assert.equal(care.repairPointsSpent,1);assert.equal(care.repairHours,1);
 assert.equal(recovered.squad.reduce((sum,id)=>sum+repairMaterialPoints(recovered.operativeState[id]),0),99);
 assert.equal(recovered.resources.treasury,before.resources.treasury);
 assert.ok(recovered.hour>before.hour+care.hours+care.repairHours+6,'the actual source visits and marches spend time as well as care and rest');
 assert.deepEqual(saved({campaign:recovered}).campaign,recovered);
});
