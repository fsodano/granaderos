import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {collectRouteItems,repairRouteFirearms} from './finite-route-equipment.mjs';
import {repairMaterialPoints} from '../game/repair-materials.js';

test('finite route discovery uses an actual carrier and restores local care roles without healing or replenishment',()=>{
 let s=initialCampaign();s.operativeState[3].hp-=30;s.operativeState[3].bandaged=30;
 s=order(s,{type:'assignCare',id:10,assignment:'doctor'});s=order(s,{type:'assignCare',id:3,assignment:'patient'});
 const input=s,before=structuredClone(s),cash=s.resources.treasury;
 const result=collectRouteItems(s,10,{kind:'repair-kit'},1);s=result.campaign;
 assert.deepEqual(before.operativeState[3].hp,s.operativeState[3].hp);assert.equal(s.operativeState[10].assignment,'doctor');assert.equal(s.operativeState[3].assignment,'patient');assert.equal(s.operativeState[10].medkits,2);assert.equal(s.resources.treasury,cash);assert.equal(repairMaterialPoints(s.operativeState[10]),100);
 assert.ok(s.hour*3600+(s.secondOfHour??0)>before.hour*3600+(before.secondOfHour??0),'the actual discovery walk spends time');assert.deepEqual(input,before,'finite collection does not mutate the input checkpoint');
 assert.equal(s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache').contents.some(stack=>stack.kind==='repair-kit'),false);assert.deepEqual(saved({campaign:s}).campaign,s);
 const checkpoint=structuredClone(s);assert.throws(()=>collectRouteItems(s,10,{kind:'repair-kit'},1),/finite local equipment/);assert.deepEqual(s,checkpoint);
});

test('finite route repair spends the found toolkit through actual work and preserves its saved remainder',()=>{
 let s=initialCampaign();s.operativeState[4].condition=80;const cash=s.resources.treasury;
 s=repairRouteFirearms(s,[4]);assert.equal(s.operativeState[4].condition,100);assert.equal(s.resources.treasury,cash);
 const remaining=Object.values(s.operativeState).reduce((sum,r)=>sum+repairMaterialPoints(r),0);assert.equal(remaining,80);assert.ok(s.hour>0);assert.deepEqual(saved({campaign:s}).campaign,s);
 const chest=s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache');assert.equal(chest.contents.some(stack=>stack.kind==='repair-kit'),false);
});

test('a serving reserve doctor makes a real finite medical courier trip and leaves patients at their clinic',async()=>{
 const {collectRouteMedicalSupplies}=await import('./finite-route-equipment.mjs');
 const {sectorInventoryModel}=await import('../game/sector-inventory.js');const {rosterFor}=await import('../game/campaign.js');
 const clinic=initialCampaign();clinic.sectors.ensenada.owner='royalist';
 let s=collectRouteItems(clinic,10,{item:'medkits'},12).campaign;
 // Keep all earlier dressings in a living owner's finite pack. The courier
 // does not confiscate them or refill the already emptied Retiro chest.
 for(const donor of [10,3]){
  const count=s.operativeState[donor].medkits;s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:donor,direction:'drop',item:'medkits',count});
  let left=count;while(left){const row=sectorInventoryModel(s,'retiro',rosterFor(s),4).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);const take=Math.min(left,row.count);s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:row.key,expected:row.expected,count:take});left-=take;}
 }
 s=order(s,{type:'squad',ids:[3,4]});s.operativeState[3].hp-=12;s.operativeState[3].bandaged=12;s=order(s,{type:'assignCare',id:3,assignment:'patient'});
 const before=structuredClone(s),events=[],result=collectRouteMedicalSupplies(s,10,3,{report:e=>events.push(e)});s=result.campaign;
 assert.deepEqual(before.operativeState[3].hp,s.operativeState[3].hp);assert.equal(s.operativeState[3].location,'retiro');assert.equal(s.operativeState[3].assignment,'patient');assert.equal(result.collected,3);assert.equal(s.operativeState[10].medkits,3);assert.equal(s.operativeState[10].location,'retiro');assert.equal(s.operativeState[4].medkits,before.operativeState[4].medkits);
 assert.equal(s.activeSquadId,before.activeSquadId);assert.deepEqual(s.squad,before.squad);assert.ok(s.squads.some(q=>q.members.includes(10)&&q.location==='retiro'),'the reserve courier now belongs to its actual returned one-person squad');
 const receipt=events.find(e=>e.event==='finiteMedicalCourier');assert.equal(receipt.source,'buenos_aires');assert.ok(receipt.elapsedSeconds>=24*3600);assert.equal(s.resources.treasury,before.resources.treasury);
 const chest=s.sectorStates.buenos_aires.props.find(p=>p.id==='buenos_aires:building:chest:10:4');assert.equal(chest.contents.find(item=>item.item==='medkits').count,9);assert.deepEqual(saved({campaign:s}).campaign,s);
 const again=collectRouteMedicalSupplies(s,10,2);s=again.campaign;assert.equal(again.collected,2);assert.equal(s.operativeState[10].medkits,5);assert.equal(s.sectorStates.buenos_aires.props.find(p=>p.id===chest.id).contents.find(item=>item.item==='medkits').count,7,'an already discovered chest remains a finite courier source when no soldier is stationed there');assert.deepEqual(saved({campaign:s}).campaign,s);
});
