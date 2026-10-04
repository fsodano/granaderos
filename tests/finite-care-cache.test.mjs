import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {rosterFor} from '../game/campaign.js';
import {doctorRate} from '../game/medical-care.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {handRecord} from '../game/tactical-inventory.js';
import {order,saved,visit,tactical} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {collectPhysicalCacheItems} from './finite-care-cache.mjs';

const cache=s=>s.sectorStates.retiro.props.find(prop=>prop.id==='retiro:armory-cache');
const dressings=s=>cache(s).contents.find(stack=>stack.item==='medkits')?.count??0;

test('normal cache discovery supplies finite dressings and a physical toolkit without changing treasury or refilling the chest',()=>{
 let s=initialCampaign(),cash=s.resources.treasury;
 const found=collectPhysicalCacheItems(s,10,{item:'medkits'},3);s=found.campaign;
 assert.equal(found.collected,3);assert.equal(s.operativeState[10].medkits,5);assert.equal(dressings(s),9);assert.equal(s.resources.treasury,cash);
 const tools=collectPhysicalCacheItems(s,10,{kind:'repair-kit'},1);s=tools.campaign;
 assert.equal(repairMaterialPoints(s.operativeState[10]),100);assert.equal(s.operativeState[10].toolkitPoints,0);assert.equal(cache(s).contents.some(stack=>stack.kind==='repair-kit'),false);
 const before=structuredClone(s);assert.throws(()=>collectPhysicalCacheItems(s,10,{kind:'repair-kit'},1),/finite cache/);assert.deepEqual(s,before);
 assert.deepEqual(saved({campaign:s}).campaign,s);
});

test('an exhausted assigned doctor collects from an already discovered real chest and consumes exactly one dressing in the next hour',()=>{
 let s=initialCampaign();s=leaveFiniteCache(takeFiniteCache(visit(s),10,[]));
 // The wound is this isolated treatment input; its supplies are actual cache custody.
 s.operativeState[3].hp-=30;s.operativeState[3].bandaged=30;
 s=order(s,{type:'assignCare',id:10,assignment:'doctor'});s=order(s,{type:'assignCare',id:3,assignment:'patient'});
 s=order(s,{type:'wait',hours:8});assert.equal(s.operativeState[10].medkits,0);assert.equal(s.assignmentAttention.notice.events.some(event=>event.code==='no_medkits'),true);
 const hp=s.operativeState[3].hp,cash=s.resources.treasury,hour=s.hour,second=s.secondOfHour??0,rate=doctorRate(rosterFor(s).find(op=>op.id===10));
 s=collectPhysicalCacheItems(s,10,{item:'medkits'},1).campaign;assert.equal(dressings(s),11);assert.equal(s.hour,hour);assert.equal(s.secondOfHour??0,second);assert.equal(s.resources.treasury,cash);assert.equal(s.operativeState[10].medkits,1);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(s.operativeState[10].medkits,0);assert.equal(s.operativeState[3].hp,hp+rate);assert.equal(dressings(s),11);assert.equal(s.resources.treasury,cash);
});

test('an actually unarmed carrier opens the finite cache without an invalid repeat look order',()=>{
 let p=visit(initialCampaign());const original=handRecord(p.battle.units.find(unit=>unit.id==='10'),'primary');p=tactical(p,{type:'drop',unitId:'10',item:'primary',count:1});
 assert.equal(p.battle.units.find(unit=>unit.id==='10').weaponDropped,true);
 p=takeFiniteCache(p,10,[{kind:'repair-kit',count:1}]);
 assert.equal(repairMaterialPoints(p.battle.units.find(unit=>unit.id==='10')),100);assert.equal(p.battle.props.find(prop=>prop.id==='retiro:armory-cache').contents.some(stack=>stack.kind==='repair-kit'),false);
 const s=leaveFiniteCache(p);assert.equal(s.operativeState[10].weaponDropped,true);assert.equal(s.sectorStates.retiro.groundItems.filter(item=>item.weapon===original.weapon&&item.instanceId===original.instanceId&&item.loaded===original.loaded).length,1);assert.deepEqual(saved({campaign:s}).campaign,s);
});
