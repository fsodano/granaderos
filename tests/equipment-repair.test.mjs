import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {advanceAssignments,repairRate,workAssignmentProgress} from '../game/assignments.js';
import {repairEquipmentQueue,repairEquipment} from '../game/equipment-repair.js';
import {inventoryUsage} from '../game/tactical-inventory.js';

const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};
const opFor=(s,id)=>rosterFor(s).find(op=>op.id===id);
const bayonet=(id,condition)=>({weapon:1811,fittingPattern:'india_socket',instanceId:id,condition});
const tool=(condition,count=1)=>({itemType:'tool',toolKey:'pliers',count,weight:.4,condition});
function equipmentTeam(){
  let s=initialCampaign();s.loadouts[4]={...s.loadouts[4],weapon:1800,blade:1811};
  Object.assign(s.operativeState[4],{condition:98,bladeCondition:99,weaponFittings:{bayonet:bayonet('repair-fixed',98)},inventory:{pliers:tool(97)}});
  s=order(s,{type:'purchaseToolkits',operativeId:10});
  return order(s,{type:'assignWork',operativeId:10,assignment:'repair',targetId:4,repairScope:'equipment'});
}
const totals=record=>Object.values(record.inventory).reduce((sum,item)=>sum+item.count,0);

test('equipment queue previews are detached, deterministic and follow secondary, primary, fitting and pack order',()=>{
  const s=equipmentTeam(),r=s.operativeState[4],before=structuredClone(s);
  const queue=repairEquipmentQueue(r,opFor(s,4));
  assert.deepEqual(queue.map(item=>item.key),['blade','primary','primary:bayonet','inventory:pliers']);
  assert.deepEqual(repairEquipmentQueue(r,opFor(s,4)),queue);queue[0].condition=0;
  assert.deepEqual(s,before);
});

test('one hourly allowance crosses items, spends finite tools and charges the mechanic once',()=>{
  let s=equipmentTeam();const rate=repairRate(opFor(s,10)),before=structuredClone(s.operativeState);
  s=order(s,{type:'wait',hours:1});const r=s.operativeState[4],mechanic=s.operativeState[10];
  const restored=(r.bladeCondition-99)+(r.condition-98)+(r.weaponFittings.bayonet.condition-98)+(r.inventory.pliers.condition-97);
  assert.equal(restored,rate);assert.equal(r.bladeCondition,100);assert.equal(r.condition,100);
  assert.equal(mechanic.toolkitPoints,100-rate);assert.equal(mechanic.energy,before[10].energy-3);assert.equal(mechanic.fatigue,before[10].fatigue+2);assert.equal(mechanic.skillPractice.mechanical,1);
  for(const key of ['loaded','ammo','priming','flints','medkits'])assert.equal(r[key],before[4][key]);
});

test('completion stops the requested wait only when the full carried queue is finished',()=>{
  let s=equipmentTeam();s.operativeState[10].toolkitPoints=8;
  s=order(s,{type:'wait',hours:24});
  assert.equal(s.hour,Math.ceil(8/repairRate(opFor(s,10))));assert.equal(s.operativeState[10].toolkitPoints,0);
  assert.deepEqual(repairEquipmentQueue(s.operativeState[4],opFor(s,4)),[]);
  assert.equal(s.assignmentAttention.notice.events[0].code,'repair_complete');
  assert.equal(JSON.parse(s.assignmentAttention.notice.events[0].binding)[6],'equipment');
  const records=structuredClone(s.operativeState);s=order(s,{type:'wait',hours:1});assert.deepEqual(s.operativeState,records);
});

test('tool exhaustion pauses the unfinished queue without touching later items',()=>{
  let s=equipmentTeam();s.operativeState[10].toolkitPoints=1;
  s=order(s,{type:'wait',hours:24});assert.equal(s.hour,1);assert.equal(s.operativeState[4].bladeCondition,100);assert.equal(s.operativeState[4].condition,98);
  assert.equal(s.assignmentAttention.notice.events[0].code,'no_tools');assert.equal(s.operativeState[10].toolkitPoints,0);
});

test('packed firearms and fitted bayonets retain separate wear, identity and load during repair',()=>{
  const r={inventory:{gun:{weapon:1800,count:1,weight:4,condition:99,jammed:true,loaded:1,instanceId:'gun-repair',fittings:{bayonet:bayonet('packed-socket',98)}}}};
  const before=structuredClone(r);
  assert.equal(repairEquipment(r,{},2),2);assert.equal(r.inventory.gun.jammed,false);assert.equal(r.inventory.gun.condition,100);assert.equal(r.inventory.gun.fittings.bayonet.condition,98);
  assert.equal(repairEquipment(r,{},4),2);assert.equal(r.inventory.gun.fittings.bayonet.condition,100);
  assert.equal(r.inventory.gun.instanceId,before.inventory.gun.instanceId);assert.equal(r.inventory.gun.fittings.bayonet.instanceId,'packed-socket');assert.equal(r.inventory.gun.loaded,1);
});

test('a jam at full condition is real work and consumes a point without ammunition or condition gain',()=>{
  let s=equipmentTeam();Object.assign(s.operativeState[4],{condition:100,bladeCondition:100,weaponFittings:{},inventory:{},jammed:true,loaded:1});
  s.operativeState[10].toolkitPoints=1;const before=structuredClone(s.operativeState[4]);
  s=order(s,{type:'wait',hours:24});assert.equal(s.hour,1);assert.equal(s.operativeState[4].jammed,false);assert.equal(s.operativeState[10].toolkitPoints,0);
  assert.equal(s.assignmentAttention.notice.events[0].code,'repair_complete');
  assert.deepEqual(s.operativeState[4],{...before,jammed:false});
});

test('legacy bulk stacks repair one unit at a time with conserved quantities, pocket use and total condition gain',()=>{
  for(const kind of ['tool','weapon']){
    const item=kind==='tool'?tool(90,3):{weapon:1800,count:3,weight:4,condition:90,jammed:false,loaded:1};
    const r={inventory:{bulk:item}},used=inventoryUsage(r).used;
    assert.equal(repairEquipment(r,{},4),4);assert.equal(totals(r),3);assert.equal(inventoryUsage(r).used,used);
    assert.equal(Object.values(r.inventory).reduce((sum,item)=>sum+item.condition*item.count,0),274);
    assert.equal(r.inventory.bulk.count,2);assert.equal(r.inventory.bulk.condition,90);
    assert.equal(repairEquipment(r,{},100),26);assert.equal(totals(r),3);assert.equal(inventoryUsage(r).used,used);
    assert.ok(Object.values(r.inventory).every(item=>item.condition===100));
    if(kind==='weapon')assert.equal(Object.values(r.inventory).reduce((sum,item)=>sum+item.loaded*item.count,0),3);
  }
});

test('fractional damage rounds finite tools up, and bulk jams are cleared on individual guns',()=>{
  const r={inventory:{bulk:{weapon:1800,count:2,weight:4,condition:99.5,jammed:true,loaded:1}}};
  assert.equal(repairEquipment(r,{},1),1);assert.equal(r.inventory.bulk.count,1);assert.equal(r.inventory.bulk.jammed,true);
  assert.equal(Object.values(r.inventory).filter(item=>!item.jammed).length,1);
  assert.equal(repairEquipment(r,{},10),3);assert.ok(Object.values(r.inventory).every(item=>!item.jammed&&item.condition===100));
});

test('a legacy pack at the saved-entry limit pauses before a stack split can make the save invalid',()=>{
  let s=equipmentTeam(),r=s.operativeState[4];
  Object.assign(r,{condition:100,bladeCondition:100,weaponFittings:{},inventory:Object.fromEntries(Array.from({length:999},(_,i)=>[`old-${i}`,{count:0,weight:0}]))});
  r.inventory.bulk=tool(90,2);const before=structuredClone(s.operativeState);
  s=order(s,{type:'wait',hours:24});assert.equal(s.hour,0);assert.deepEqual(s.operativeState,before);
  assert.equal(s.assignmentAttention.notice.events[0].code,'repair_pack_full');assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('the job follows current carried equipment, and cannot repair a swapped weapon in the armory',()=>{
  let s=equipmentTeam();s=order(s,{type:'purchaseEquipment',item:1803});s=order(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1803});
  const stored=structuredClone(s.armoryItems);s=order(s,{type:'wait',hours:24});assert.deepEqual(s.armoryItems,stored);
  assert.equal(s.operativeState[4].inventory.pliers.condition,100);assert.equal(s.operativeState[4].bladeCondition,100);
  assert.equal(s.operativeState[10].toolkitPoints,96);assert.equal(s.assignmentAttention.notice.events[0].code,'repair_complete');
});

test('travel, unsafe staff and unavailable target owners cannot receive queued repairs',()=>{
  for(const change of [(s)=>{s.operativeState[4].alive=false;s.operativeState[4].hp=0;},(s)=>{s.squads[0].members=s.squads[0].members.filter(id=>id!==4);s.operativeState[4].location='ensenada';},(s)=>{s.operativeState[4].captured=true;},(s)=>{s.sectors.retiro.owner='royalist';},(s)=>{s.operativeState[10].energy=10;}]){
    const s=equipmentTeam();change(s);const before=structuredClone(s.operativeState);advanceAssignments(s,rosterFor(s));assert.deepEqual(s.operativeState,before);
  }
  const s=equipmentTeam(),before=structuredClone(s.operativeState);advanceAssignments(s,rosterFor(s),{traveling:[4]});assert.deepEqual(s.operativeState,before);
  assert.equal(workAssignmentProgress(s,opFor(s,10),rosterFor(s),{traveling:[4]}).state,'waiting');
});

test('queue saves and completion notices replay exactly without migration grants',()=>{
  let s=equipmentTeam();s=order(s,{type:'wait',hours:1});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
  const expected=order(s,{type:'wait',hours:24}),reloaded=order(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:24});assert.deepEqual(reloaded,expected);
  assert.deepEqual(restoreCampaign(serializeCampaign(expected)),expected);
});

test('malformed repair scope and mixed legacy bindings reject without silently choosing another job',()=>{
  for(const repairScope of ['all',false,{},[]]){
    const s=equipmentTeam(),before=structuredClone(s);const next=dispatchCampaign(s,{type:'assignWork',operativeId:10,assignment:'repair',targetId:4,repairScope});assert.ok(next.lastError);assert.deepEqual(s,before);
    s.operativeState[10].repairScope=repairScope;assert.throws(()=>restoreCampaign(serializeCampaign(s)));
  }
  const s=equipmentTeam();s.operativeState[10].repairWeaponId=1800;assert.throws(()=>restoreCampaign(serializeCampaign(s)));
});
test('equipment repair includes the second gun without changing either gun load',()=>{
 const record={condition:100,inventory:{},offHand:{count:1,weapon:1808,condition:97,jammed:true,loaded:2,instanceId:'repair-second'}},op={weapon:1805};assert.equal(repairEquipmentQueue(record,op)[0].key,'offhand');assert.equal(repairEquipment(record,op,3),3);assert.equal(record.offHand.condition,99);assert.equal(record.offHand.jammed,false);assert.equal(record.offHand.loaded,2);assert.equal(record.offHand.instanceId,'repair-second');assert.equal(record.condition,100);
});
