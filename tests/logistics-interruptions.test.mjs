import {withLegacyPaidCargo} from './legacy-paid-cargo-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied} from '../game/campaign.js';
import {initialCampaign as staffed} from './legacy-campaign-fixture.mjs';
import {secureArea} from './secured-area-fixture.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
import {addEquipment,takeEquipment} from '../game/equipment.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {reconcileLogisticsAttention,logisticsEventText} from '../game/logistics-attention.js';
import {cellTravelPlan} from '../game/world-cells.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours=24)=>order(s,{type:'wait',hours});
const saved=s=>decodeSave(encodeSave(s)).campaign;
const buy=(s=secureArea(initialCampaign()))=>withLegacyPaidCargo(s);
const overdue=()=>{const s=buy();s.equipmentShipments[0].due=0;s.blockade=true;return s;};

test('already overdue paid cargo stops at the current hour without credit or repeated pauses after saving',()=>{
 const s=overdue(),before=structuredClone(s),n=wait(s);
 assert.equal(n.hour,0);assert.equal(n.logisticsNotice.advancedHours,0);assert.equal(n.logisticsNotice.events[0].code,'blockade');assert.equal(n.armory[1802]??0,0);assert.deepEqual(n.equipmentShipments,before.equipmentShipments);assert.deepEqual(s,before);
 assert.deepEqual(saved(n),n);const continued=wait(saved(n),6);assert.equal(continued.hour,6);assert.equal(continued.logisticsNotice,null);assert.equal(continued.armory[1802]??0,0);
});
test("an old save's already-paid import reports only when due, keeps its cargo and delivers exactly once",()=>{
 let s=buy();const due=s.equipmentShipments[0].due,cargo=structuredClone(s.equipmentShipments);s.blockade=true;s=wait(s,10);assert.equal(s.hour,10);assert.equal(s.logisticsNotice,null);
 s=wait(s,120);assert.equal(s.hour,due);assert.equal(s.logisticsNotice.events[0].code,'blockade');assert.equal(s.armory[1802]??0,0);assert.deepEqual(s.equipmentShipments,cargo);
 s=wait(saved(s),1);assert.equal(s.hour,due+1);assert.equal(s.logisticsNotice,null);
 s.blockade=false;s=wait(saved(s),2);assert.equal(s.hour,due+2);assert.equal(s.equipmentShipments.length,0);assert.equal(s.armory[1802],1);assert.equal(s.logisticsNotice.events[0].state,undefined);
 s=wait(saved(s),1);assert.equal(s.armory[1802],1);assert.deepEqual(s.logisticsAttention.reported,{});
});
test('a changed obstruction is actionable once and a resolved route can report a later interruption',()=>{
 let s=wait(overdue());s.sectors.ensenada.owner='royalist';s=wait(saved(s),6);
 assert.equal(s.hour,0);assert.equal(s.logisticsNotice.events[0].code,'occupied');s=wait(saved(s),2);assert.equal(s.hour,2);assert.equal(s.logisticsNotice,null);
 s.sectors.ensenada.owner='patriot';s.blockade=false;reconcileLogisticsAttention(s,{isSupplied});assert.deepEqual(s.logisticsAttention.reported,{});
 s.blockade=true;s=wait(saved(s),6);assert.equal(s.hour,2);assert.equal(s.logisticsNotice.events[0].code,'blockade');
});
test('identical paid orders are acknowledged together and a later paid order still needs attention',()=>{
 let s=buy(buy(buy()));s.equipmentShipments.forEach((job,i)=>job.due=i===2?2:0);s.blockade=true;s=wait(s);
 assert.equal(s.logisticsNotice.events.length,2);assert.equal(Object.keys(s.logisticsAttention.reported).length,2);
 s=wait(saved(s),1);assert.equal(s.hour,1);assert.equal(s.logisticsNotice,null);
 s=wait(s,6);assert.equal(s.hour,2);assert.equal(s.logisticsNotice.events.length,1);
 s.blockade=false;s=wait(s,1);assert.equal(s.logisticsNotice.events.length,3);assert.equal(s.equipmentShipments.length,0);assert.equal(s.armory[1802],3);assert.deepEqual(s.logisticsAttention.reported,{});
});
test('a full armory keeps a paid gun until an actual storage slot is available',()=>{
 let s=buy();addEquipment(s,1800,10000);s.equipmentShipments[0].due=1;
 s=wait(s,6);assert.equal(s.hour,1);assert.equal(s.logisticsNotice.events[0].code,'armory_full');assert.equal(s.armoryItems.length,10000);assert.equal(s.armory[1802]??0,0);assert.equal(s.equipmentShipments.length,1);
 assert.match(logisticsEventText(s.logisticsNotice.events[0]),/Retirá/);s=wait(saved(s),1);assert.equal(s.hour,2);assert.equal(s.logisticsNotice,null);
 takeEquipment(s,1800);s=wait(saved(s),6);assert.equal(s.hour,3);assert.equal(s.armoryItems.length,10000);assert.equal(s.armory[1800],9999);assert.equal(s.armory[1802],1);assert.equal(s.equipmentShipments.length,0);
});
test('blocking travel finishes and leaves an unseen overdue interruption for the next explicit wait',()=>{
 let s=buy(staffed());s.equipmentShipments[0].due=1;s.blockade=true;
 const hours=cellTravelPlan(s,'buenos_aires').hours;s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,hours);assert.equal(s.location,'buenos_aires');assert.equal(s.logisticsNotice,null);assert.deepEqual(s.logisticsAttention.reported,{});
 s=wait(saved(s),24);assert.equal(s.hour,hours);assert.equal(s.logisticsNotice.advancedHours,0);assert.equal(s.logisticsNotice.events[0].code,'blockade');
});
test('public interruption notices detach cargo and omit private bindings',()=>{
 const s=wait(overdue()),view=playerKnownCampaign(s);assert.equal(view.logisticsAttention,undefined);assert.equal(view.logisticsNotice.events[0].code,'blockade');assert.equal(view.logisticsNotice.events[0].binding,undefined);view.logisticsNotice.events[0].quantity=100;assert.equal(s.logisticsNotice.events[0].quantity,1);
});
test('missing legacy notice state migrates and malformed receipts are rejected',()=>{
 const old=initialCampaign();delete old.logisticsAttention;delete old.logisticsNotice;const migrated=saved(old);assert.deepEqual(migrated.logisticsAttention,{version:1,reported:{}});assert.equal(migrated.logisticsNotice,null);
 const s=wait(overdue());for(const change of [n=>n.logisticsAttention=null,n=>n.logisticsAttention.version=2,n=>n.logisticsAttention.reported=[],n=>n.logisticsAttention.reported.bad='blockade',n=>n.logisticsAttention.reported[Object.keys(n.logisticsAttention.reported)[0]]='made_up',n=>n.logisticsNotice.events[0].code='snow',n=>n.logisticsNotice.events[0].state='completed',n=>n.logisticsNotice.events[0].private=true,n=>n.logisticsNotice.events[0].quantity=-1]){const n=structuredClone(s);change(n);assert.throws(()=>saved(n),/avisos de producción/);}
});
