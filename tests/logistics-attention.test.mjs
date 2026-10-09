import {withLegacyPaidCargo} from './legacy-paid-cargo-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {initialCampaign as staffed} from './legacy-campaign-fixture.mjs';
import {secureArea} from './secured-area-fixture.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
import {publicLogisticsNotice} from '../game/logistics-attention.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {cellTravelPlan} from '../game/world-cells.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const saved=s=>decodeSave(encodeSave(s)).campaign;
const buy=(s=secureArea(initialCampaign()),item=1802)=>withLegacyPaidCargo(s,item);
// Existing paid cargo and prepared due times isolate old-save attention boundaries.
const dueAt=(s,hour)=>{s.equipmentShipments.at(-1).due=hour;return s;};

test("an old save's already-paid import stops waiting at delivery and credits the gun once",()=>{
 const start=secureArea(initialCampaign()),queued=buy(start),due=queued.equipmentShipments[0].due,n=wait(queued,120);
 assert.equal(queued.resources.treasury,start.resources.treasury);assert.deepEqual(Object.keys(queued.resources),['treasury']);
 assert.equal(n.hour,due);assert.equal(n.armory[1802],1);assert.equal(n.equipmentShipments.length,0);
 assert.deepEqual(n.logisticsNotice,{hour:due,requestedHours:120,advancedHours:due,events:[{kind:'equipment',sector:'ensenada',item:1802,quantity:1}]});
 const again=wait(saved(n),6);assert.equal(again.hour,due+6);assert.equal(again.logisticsNotice,null);assert.equal(again.armory[1802],1);assert.deepEqual(n,wait(saved(queued),120));
});
test('all paid deliveries in one hour are grouped after their actual credit',()=>{
 let s=dueAt(buy(),12);s=dueAt(buy(s,1800),12);const n=wait(s,24);
 assert.equal(n.hour,12);assert.equal(n.logisticsNotice.events.length,2);assert.ok(n.logisticsNotice.events.every(e=>e.kind==='equipment'));
 assert.equal(n.armory[1802],1);assert.equal(n.armory[1800],1);assert.equal(n.equipmentShipments.length,0);assert.deepEqual(saved(n),n);
});
test('a blocked or occupied port pauses once and delivers each paid gun after reopening',()=>{
 for(const cause of ['blockade','occupation']){
  let s=dueAt(buy(),1);if(cause==='blockade')s.blockade=true;else s.sectors.ensenada.owner='royalist';
  s=wait(s,6);assert.equal(s.hour,1);assert.equal(s.logisticsNotice.events.length,1);assert.equal(s.logisticsNotice.events[0].code,cause==='blockade'?'blockade':'occupied');assert.equal(s.equipmentShipments.length,1);assert.equal(s.armory[1802]??0,0);
  s=wait(saved(s),6);assert.equal(s.hour,7);assert.equal(s.logisticsNotice,null);
  s.blockade=false;s.sectors.ensenada.owner='patriot';s=wait(s,6);assert.equal(s.hour,8);assert.equal(s.logisticsNotice.events[0].state,undefined);assert.equal(s.equipmentShipments.length,0);assert.equal(s.armory[1802],1);assert.deepEqual(s.logisticsAttention.reported,{});assert.deepEqual(saved(s),s);
 }
});
test('midnight without a port agreement preserves cash while horse time completes before delivery pauses',()=>{
 const s=dueAt(buy(),24),cash=s.resources.treasury,n=wait(s,48);
 assert.equal(n.hour,24);assert.equal(n.logisticsNotice.advancedHours,24);assert.equal(n.resources.treasury,cash);assert.equal(n.townIncome.lastPaidDay,1);assert.equal(n.horseState.hour,24);assert.deepEqual(saved(n),n);
});
test('blocking travel finishes its duration despite a paid delivery',()=>{
 const s=dueAt(buy(staffed()),1),hours=cellTravelPlan(s,'buenos_aires').hours,n=order(s,{type:'travel',sector:'buenos_aires'});
 assert.equal(n.hour,hours);assert.equal(n.location,'buenos_aires');assert.equal(n.equipmentShipments.length,0);assert.equal(n.armory[1802],1);assert.equal(n.logisticsNotice,null);assert.deepEqual(saved(n),n);
});
test('tactical synchronization completes its full minute boundary despite delivery',()=>{
 let s=dueAt(buy(staffed()),1);s.secondOfHour=3599;s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);const u=b.units.find(u=>u.side==='player');
 b=actBattle(b,{type:'look',unitId:u.id,x:u.x-1,y:u.y});assert.equal(b.lastError,null);const pair=syncBattleTime(s,b);assert.equal(pair.error,null);assert.ok(pair.campaign.hour>=1);assert.equal(pair.campaign.equipmentShipments.length,0);assert.equal(pair.campaign.logisticsNotice,null);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).campaign,pair.campaign);
});
test('queued travel retains partial progress when delivery stops explicit waiting',()=>{
 let s=dueAt(buy(staffed()),3);const destination='cell-27-27',hours=cellTravelPlan(s,destination).hours;assert.ok(hours>3);s=order(s,{type:'travel',sector:destination,queue:true});s=wait(s,24);
 assert.equal(s.hour,3);assert.equal(s.location,'retiro');assert.equal(s.squads[0].journey.elapsed,3);assert.equal(s.logisticsNotice.advancedHours,3);
 s=wait(saved(s),24);assert.equal(s.hour,hours);assert.equal(s.location,destination);assert.equal(s.logisticsNotice,null);assert.equal(s.equipmentShipments.length,0);
});
test('public notices are detached and do not expose queue acknowledgement bindings',()=>{
 const s=wait(dueAt(buy(),1),6),view=publicLogisticsNotice(s);assert.deepEqual(view,s.logisticsNotice);view.events[0].quantity=99;assert.equal(s.logisticsNotice.events[0].quantity,1);assert.equal(view.events[0].binding,undefined);
});
test('retired material jobs cannot enter a treasury-only campaign or its saved state',()=>{
 const s=secureArea(initialCampaign());for(const action of [{type:'produce',recipe:'cartridges',sector:'retiro'},{type:'supplyTransfer',source:'reserve',destination:'retiro',mode:'carts',goods:{powder:1}},{type:'contraband',offer:'arms'}]){
  const n=dispatchCampaign(s,action);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},s);
 }
 for(const key of ['production','shipments','depots','convoys']){const old=structuredClone(s);old[key]=key==='depots'?{}:[];assert.throws(()=>saved(old),/sistemas retirados/);}
});
