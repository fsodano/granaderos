import {secureArea} from './secured-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign as staffed} from './legacy-campaign-fixture.mjs';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {publicLogisticsNotice} from '../game/logistics-attention.js';
import {enterSector} from '../game/world.js';
import {endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const saved=s=>decodeSave(encodeSave(s)).campaign;
const produce=(s=secureArea(initialCampaign()),recipe='cartridges')=>order(s,{type:'produce',recipe,sector:'retiro'});

test('a real paid workshop order stops the clock on completion and credits its goods once',()=>{
 const start=secureArea(initialCampaign()),queued=produce(start),n=wait(queued,24);
 assert.equal(queued.resources.treasury,start.resources.treasury-30);assert.equal(queued.resources.powder,start.resources.powder-5);
 assert.equal(n.hour,12);assert.equal(n.resources.cartridges,start.resources.cartridges+60);assert.equal(n.production.length,0);
 assert.deepEqual(n.logisticsNotice,{hour:12,requestedHours:24,advancedHours:12,events:[{kind:'production',sector:'retiro',name:'Cartuchos de mosquete',goods:{cartridges:60}}]});
 const again=wait(saved(n),6);assert.equal(again.hour,18);assert.equal(again.logisticsNotice,null);assert.equal(again.resources.cartridges,n.resources.cartridges);assert.deepEqual(n,wait(saved(queued),24));
});
test('all deliveries in the completion hour are grouped after their actual credit',()=>{
 let s=produce(produce(secureArea(initialCampaign()),'powder'));
 s.shipments=[{due:12,goods:{textiles:7}}];s.equipmentShipments=[{due:12,item:1802,quantity:2}];s.routes.carts=true;s.convoys=[{id:'same-hour',source:'reserve',destination:'retiro',mode:'carts',due:12,goods:{copper:3}}];
 const before=structuredClone(s),n=wait(s,24);assert.equal(n.hour,12);assert.equal(n.logisticsNotice.events.length,5);
 assert.deepEqual(n.logisticsNotice.events.map(e=>e.kind),['convoy','equipment','production','production','shipment']);
 assert.equal(n.resources.cartridges,before.resources.cartridges+60);assert.equal(n.resources.powder,before.resources.powder+20);assert.equal(n.resources.textiles,before.resources.textiles+7);assert.equal(n.depots.retiro.copper,3);assert.equal(n.armory[1802],2);
 assert.equal(n.shipments.length+n.production.length+n.convoys.length+n.equipmentShipments.length,0);assert.deepEqual(saved(n),n);
});
test('a paid convoy reports the destination depot and its return to the general reserve',()=>{
 let s=order(secureArea(initialCampaign()),{type:'transport',mode:'carts'});const initial=s.resources.muskets;
 s=order(s,{type:'supplyTransfer',source:'reserve',destination:'buenos_aires',mode:'carts',goods:{muskets:10}});assert.equal(s.resources.muskets,initial-10);
 s=wait(s,24);assert.equal(s.hour,18);assert.equal(s.depots.buenos_aires.muskets,10);assert.deepEqual(s.logisticsNotice.events,[{kind:'convoy',sector:'buenos_aires',goods:{muskets:10}}]);
 s=order(s,{type:'supplyTransfer',source:'buenos_aires',destination:'reserve',mode:'carts',goods:{muskets:10}});s=wait(s,24);assert.equal(s.hour,36);assert.equal(s.resources.muskets,initial);assert.equal(s.logisticsNotice.events[0].sector,'reserve');assert.deepEqual(saved(s),s);
});
test('a blockade or occupied port stops once for both pending imports and then permits continued waiting',()=>{
 for(const cause of ['blockade','occupation']){
  let s=secureArea(initialCampaign());s.shipments=[{due:1,goods:{powder:7}}];s.equipmentShipments=[{due:1,item:1802,quantity:1}];if(cause==='blockade')s.blockade=true;else s.sectors.ensenada.owner='royalist';
  const powder=s.resources.powder;s=wait(s,6);assert.equal(s.hour,1);assert.equal(s.logisticsNotice.events.length,2);assert.ok(s.logisticsNotice.events.every(event=>event.state==='blocked'&&event.code===(cause==='blockade'?'blockade':'occupied')));assert.equal(s.shipments.length,1);assert.equal(s.equipmentShipments.length,1);assert.equal(s.resources.powder,powder);assert.equal(s.armory[1802]??0,0);
  s=wait(saved(s),6);assert.equal(s.hour,7);assert.equal(s.logisticsNotice,null);
  s.blockade=false;s.sectors.ensenada.owner='patriot';s=wait(s,6);assert.equal(s.hour,8);assert.equal(s.logisticsNotice.events.length,2);assert.ok(s.logisticsNotice.events.every(event=>event.state===undefined));assert.equal(s.shipments.length+s.equipmentShipments.length,0);assert.equal(s.resources.powder,powder+7);assert.equal(s.armory[1802],1);assert.deepEqual(s.logisticsAttention.reported,{});assert.deepEqual(saved(s),s);
 }
});
test('blocked workshop and convoy routes do not report completion until supply access returns',()=>{
 let s=secureArea(initialCampaign(),['buenos_aires','cordoba']);s=order(s,{type:'produce',recipe:'cartridges',sector:'cordoba'});s.routes.carts=true;s.convoys=[{id:'held',source:'reserve',destination:'cordoba',mode:'carts',due:1,goods:{copper:3}}];s.sectors.buenos_aires.owner='royalist';
 const due=s.production[0].due;
 s=wait(s,24);assert.equal(s.hour,1);assert.equal(s.logisticsNotice.events[0].code,'route_cut');assert.equal(s.production.length,1);assert.equal(s.convoys.length,1);
 s=wait(saved(s),24);assert.equal(s.hour,due);assert.equal(s.logisticsNotice.events.length,1);assert.equal(s.logisticsNotice.events[0].code,'unsupplied');
 s=wait(saved(s),6);assert.equal(s.hour,due+6);assert.equal(s.logisticsNotice,null);
 s.sectors.buenos_aires.owner='patriot';s=wait(s,6);assert.equal(s.hour,due+7);assert.equal(s.logisticsNotice.events.length,2);assert.ok(s.logisticsNotice.events.every(event=>event.state===undefined));assert.equal(s.production.length+s.convoys.length,0);
});
test('production, contract and assignment attention retain the same fully processed hour',()=>{
 let s=order(staffed(),{type:'recruitCivic',id:103,term:'day'});s=wait(s,10);s=produce(s);s=wait(s,11);
 Object.assign(s.operativeState[3],{assignment:'rest',energy:90,fatigue:1});s=wait(s,6);
 assert.equal(s.hour,22);assert.equal(s.logisticsNotice.advancedHours,1);assert.equal(s.contractAttention.notice.advancedHours,1);assert.equal(s.assignmentAttention.notice.advancedHours,1);assert.equal(s.operativeState[3].energy,100);assert.equal(s.production.length,0);assert.deepEqual(saved(s),s);
});
test('midnight revenue is applied before a production completion pauses the wait',()=>{
 let s=wait(secureArea(initialCampaign()),12);s=produce(s);const initial=s.resources.treasury;s=wait(s,24);
 assert.equal(s.hour,24);assert.equal(s.logisticsNotice.advancedHours,12);assert.ok(s.resources.treasury>initial);assert.ok(s.log.some(line=>line.text.includes('aportaron')));assert.equal(s.horseState.hour,24);
});
test('blocking travel and tactical synchronization finish their complete durations despite deliveries',()=>{
 let s=staffed();s.shipments=[{due:1,goods:{powder:7}}];const n=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(n.hour,12);assert.equal(n.location,'buenos_aires');assert.equal(n.shipments.length,0);assert.equal(n.logisticsNotice,null);
 s=staffed();s.hour=11;s.secondOfHour=3590;s=produce(s);s.production[0].due=12;s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);const pair=syncBattleTime(s,endTurn(b));assert.equal(pair.error,null);assert.equal(pair.campaign.hour,12);assert.equal(pair.campaign.secondOfHour,590);assert.equal(pair.campaign.production.length,0);assert.equal(pair.campaign.logisticsNotice,null);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).campaign,pair.campaign);
});
test('queued travel retains partial progress when a delivery stops explicit waiting',()=>{
 let s=staffed();s.shipments=[{due:3,goods:{powder:7}}];s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=wait(s,24);
 assert.equal(s.hour,3);assert.equal(s.location,'retiro');assert.equal(s.squads[0].journey.elapsed,3);assert.equal(s.logisticsNotice.advancedHours,3);
 s=wait(saved(s),24);assert.equal(s.hour,12);assert.equal(s.location,'buenos_aires');assert.equal(s.logisticsNotice,null);assert.equal(s.shipments.length,0);
});
test('an encounter remains actionable when a delivery finishes in its arrival hour',()=>{
 let s=staffed();const group=launchEnemyGroup(s,'coast','retiro');group.nextArrivalAt=1;group.arrivalAt=1;group.route=['retiro'];group.target='retiro';s.shipments=[{due:1,goods:{powder:7}}];
 s=wait(s,6);assert.equal(s.hour,1);assert.ok(s.pendingEncounter);assert.equal(s.logisticsNotice.events.length,1);
 const rejected=dispatchCampaign(s,{type:'wait',hours:1});assert.ok(rejected.lastError);assert.equal(rejected.hour,1);assert.deepEqual(rejected.logisticsNotice,s.logisticsNotice);
});
test('public receipts expose delivered goods without queue internals or mutable references',()=>{
 const s=wait(produce(),24),before=serializeCampaign(s);s.logisticsNotice.events[0].privateSeed=123;
 const view=playerKnownCampaign(s);assert.ok(!Object.hasOwn(view.logisticsNotice.events[0],'privateSeed'));view.logisticsNotice.events[0].goods.cartridges=999;
 delete s.logisticsNotice.events[0].privateSeed;assert.equal(serializeCampaign(s),before);assert.equal(publicLogisticsNotice(secureArea(initialCampaign())),null);
});
test('invalid saved receipts are rejected and an absent old field defaults to no notice',()=>{
 const s=wait(produce(),24);
 for(const corrupt of [n=>n.logisticsNotice.hour=n.hour+1,n=>n.logisticsNotice.advancedHours=0,n=>n.logisticsNotice.advancedHours=25,n=>n.logisticsNotice.events=[],n=>n.logisticsNotice.events[0].kind='secret',n=>n.logisticsNotice.events[0].sector='none',n=>n.logisticsNotice.events[0].goods={secret:1},n=>n.logisticsNotice.events[0].goods.cartridges=-1,n=>n.logisticsNotice.events[0].extra=true,n=>n.logisticsNotice.extra=true]){
  const n=structuredClone(s);corrupt(n);assert.throws(()=>restoreCampaign(serializeCampaign(n)),/avisos de producción/);
 }
 const old=secureArea(initialCampaign());delete old.logisticsNotice;assert.equal(saved(old).logisticsNotice,null);
});

test('a paid imported weapon and a paid cargo offer each stop at their actual arrival time',()=>{
 for(const action of [{type:'purchaseEquipment',item:1802,quantity:1},{type:'contraband',offer:'arms'}]){
  const initial=secureArea(initialCampaign()),s=order(initial,action);assert.ok(s.resources.treasury<initial.resources.treasury);
  const equipment=action.type==='purchaseEquipment',due=(equipment?s.equipmentShipments:s.shipments)[0].due,n=wait(s,120);
  assert.equal(n.hour,due);assert.equal(n.logisticsNotice.advancedHours,due);assert.equal(n.logisticsNotice.events[0].kind,equipment?'equipment':'shipment');
  if(equipment){assert.equal(n.armory[1802],1);assert.equal(n.equipmentShipments.length,0);}else{assert.equal(n.resources.muskets,initial.resources.muskets+50);assert.equal(n.resources.cartridges,initial.resources.cartridges+100);assert.equal(n.shipments.length,0);}
  assert.deepEqual(saved(n),n);
 }
});
