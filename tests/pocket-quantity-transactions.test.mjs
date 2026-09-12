import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentPlacementPreview,carriedWeight} from '../game/tactical.js';
import {inventoryUsage,equipmentEndpoint,equipmentFingerprint,applyItemQuantity,extractItemQuantity,itemQuantity} from '../game/tactical-inventory.js';
import {POCKETS} from '../game/inventory-pockets.js';
import {handLayout} from '../game/hand-layout.js';
import {makeOutfit} from '../game/outfits.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
const cloth=(count,condition=47)=>({name:'Tela',count,weight:.1,condition});
const hint=(slotId,item,index,count)=>({slotId,item,index,count});
const field=(extra={},options={})=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,blade:0,ammo:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0,...extra}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:3,y:2,patrol:false,overwatch:false}],...options});
const actor=b=>b.units[0];
const slots=unit=>inventoryUsage(unit).slots;
const slot=(unit,id)=>slots(unit).find(s=>s.id===id).entry;
const partitions=(unit,item)=>Object.fromEntries(slots(unit).filter(s=>s.entry?.item===item).map(s=>[s.id,s.entry.count]));
const action=(unit,from,to,count)=>({type:'moveEquipment',unitId:String(unit.id),sourceId:from,destinationId:to,expectedSource:equipmentFingerprint(unit,from),expectedDestination:equipmentFingerprint(unit,to),...(count===undefined?{}:{count})});
function move(b,from,to,count){
 const before=structuredClone(b),a=action(actor(b),from,to,count),preview=equipmentPlacementPreview(b,actor(b),a);assert.equal(preview.valid,true,preview.reason);assert.deepEqual(b,before);
 const n=actBattle(b,a);assert.equal(n.lastError,null,n.lastError);assert.equal(actor(n).ap,actor(b).ap-(b.mode==='exploration'?0:preview.pa));assert.equal(carriedWeight(actor(n)),carriedWeight(actor(b)));assert.doesNotThrow(()=>validateBattleSnapshot(n));assert.deepEqual(b,before);return n;
}
function reject(b,a){const before=structuredClone(b);assert.equal(equipmentPlacementPreview(b,actor(b),a).valid,false);const n=actBattle(b,a);assert.ok(n.lastError);assert.deepEqual(n.units,before.units);assert.equal(n.elapsedSeconds,before.elapsedSeconds);assert.equal(n.seed,before.seed);assert.deepEqual(b,before);}
const packedTotal=(unit,item)=>slots(unit).reduce((sum,s)=>sum+(s.entry?.item===item?s.entry.count:0),0)+inventoryUsage(unit).overflow.reduce((sum,r)=>sum+(r.item===item?r.count:0),0);

test('explicit equipment quantities split supplies and ordinary objects without spending combat AP or changing ownership',()=>{
 let b=field({medkits:5,inventory:{cloth:cloth(3)}}),before=structuredClone(actor(b));
 b=move(b,'small-1','large-4',2);assert.deepEqual(partitions(actor(b),'medkits'),{'large-4':2,'small-1':3});
 const source=slots(actor(b)).find(s=>s.entry?.item==='inventory:cloth').id;b=move(b,source,'small-8',1);assert.deepEqual(partitions(actor(b),'inventory:cloth'),{[source]:2,'small-8':1});
 assert.equal(actor(b).ap,before.ap);assert.equal(actor(b).medkits,5);assert.deepEqual(actor(b).inventory,before.inventory);assert.equal(inventoryUsage(actor(b)).used,4);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));assert.deepEqual(partitions(actor(restored),'medkits'),partitions(actor(b),'medkits'));assert.deepEqual(partitions(actor(restored),'inventory:cloth'),partitions(actor(b),'inventory:cloth'));
});

test('same-record merges move the exact selected count and leave source and target partitions',()=>{
 let b=field({ammo:25,pocketOrder:[hint('small-2','ammo',0,10),hint('large-4','ammo',1,15)]});
 b=move(b,'small-2','large-4',3);assert.deepEqual(partitions(actor(b),'ammo'),{'large-4':18,'small-2':7});assert.equal(actor(b).ammo,25);
 b=move(b,'small-2','large-4',2);assert.deepEqual(partitions(actor(b),'ammo'),{'large-4':20,'small-2':5});assert.equal(actor(b).ammo,25);
 reject(b,action(actor(b),'small-2','large-4',1));
});

test('a compatible stack fills remaining room and leaves the selected excess available at its source',()=>{
 const b=field({ammo:25,pocketOrder:[hint('small-2','ammo',0,7),hint('large-4','ammo',1,18)]});
 const a=action(actor(b),'small-2','large-4',3),preview=equipmentPlacementPreview(b,actor(b),a),n=move(b,'small-2','large-4',3);assert.deepEqual(partitions(actor(n),'ammo'),{'large-4':20,'small-2':5});assert.equal(actor(n).ammo,25);
 assert.deepEqual(preview.remainingSelection,{sourceId:'small-2',expectedSource:equipmentFingerprint(actor(n),'small-2'),count:1,maxCount:5});
 const rest=move(n,'small-2','small-8',preview.remainingSelection.count);assert.deepEqual(partitions(actor(rest),'ammo'),{'large-4':20,'small-2':4,'small-8':1});
 const automatic=move(b,'small-2','large-4');assert.deepEqual(partitions(actor(automatic),'ammo'),{'large-4':20,'small-2':5});
});

test('merging compatible records keeps a same-record held singleton and all metadata',()=>{
 let b=field({weapon:0,loaded:0,activeSlot:'item',activeItem:'inventory:a',inventory:{a:cloth(3),b:cloth(2)},pocketOrder:[hint('small-4','inventory:a',0,2),hint('large-3','inventory:b',0,2)]});
 const held=structuredClone(actor(b).inventory.a);b=move(b,'small-4','large-3',2);
 assert.deepEqual(handLayout(actor(b)).held,['inventory:a']);assert.equal(equipmentEndpoint(actor(b),'hand:right').count,1);assert.deepEqual(actor(b).inventory.a,{...held,count:1});assert.deepEqual(actor(b).inventory.b,cloth(4));assert.equal(slot(actor(b),'small-4'),null);assert.deepEqual(partitions(actor(b),'inventory:b'),{'large-3':4});
 assert.equal(itemQuantity(actor(b),'inventory:a')+itemQuantity(actor(b),'inventory:b'),5);
});

test('partial merges between different records retain every other source and destination partition',()=>{
 let b=field({inventory:{a:cloth(5),b:cloth(3)},pocketOrder:[hint('small-2','inventory:a',0,3),hint('large-4','inventory:a',1,2),hint('small-5','inventory:b',0,2),hint('large-2','inventory:b',1,1)]});
 b=move(b,'small-2','small-5',1);assert.deepEqual(actor(b).inventory,{a:cloth(4),b:cloth(4)});
 assert.deepEqual(partitions(actor(b),'inventory:a'),{'large-4':2,'small-2':2});assert.deepEqual(partitions(actor(b),'inventory:b'),{'large-2':1,'small-5':3});
});

test('zero, fractional, oversized, stale and incompatible partial quantities reject atomically',()=>{
 const b=field({inventory:{a:cloth(3),b:cloth(2,46)},pocketOrder:[hint('small-1','inventory:a',0,3),hint('small-2','inventory:b',0,2)]});
 for(const count of [0,-1,.5,4,NaN,Infinity,'1',null])reject(b,action(actor(b),'small-1','small-8',count));
 reject(b,action(actor(b),'small-1','small-2',1));
 const stale=action(actor(b),'small-1','small-8',1),changed=move(b,'small-1','large-4',1);reject(changed,stale);
 const changedMetadata=structuredClone(b);actor(changedMetadata).inventory.a.condition--;reject(changedMetadata,action(actor(b),'small-1','small-8',1));
});

test('twelve partial pockets are physically full even if their combined contents could fit in one stack',()=>{
 const b=field({ammo:12,pocketOrder:POCKETS.map((p,index)=>hint(p.id,'ammo',index,1))}),unit=actor(b),before=structuredClone(unit);
 assert.equal(inventoryUsage(unit).used,12);assert.equal(inventoryUsage(unit).free,0);assert.equal(inventoryUsage(unit).overloaded,false);
 assert.throws(()=>applyItemQuantity(unit,{item:'inventory:cloth',...cloth(1)}),/espacio/);assert.deepEqual(unit,before);
 const exchanged=move(b,'hand:right','small-1',1);assert.equal(handLayout(actor(exchanged)).right,'ammo');assert.equal(slot(actor(exchanged),'small-1').weapon,1805);assert.equal(inventoryUsage(actor(exchanged)).used,12);assert.equal(actor(exchanged).ammo,12);
 const n=move(b,'large-4','small-1',1);assert.equal(inventoryUsage(actor(n)).used,11);assert.equal(slot(actor(n),'large-4'),null);assert.equal(slot(actor(n),'small-1').count,2);
 const received=applyItemQuantity(actor(n),{item:'inventory:cloth',...cloth(1)});assert.equal(inventoryUsage(received).used,12);assert.equal(packedTotal(received,'ammo'),12);assert.deepEqual(received.inventory.cloth,cloth(1));
});

test('receiving more supplies fills current partial stacks before requiring a new pocket',()=>{
 const b=field({ammo:12,pocketOrder:POCKETS.map((p,index)=>hint(p.id,'ammo',index,1))}),unit=actor(b),before=structuredClone(unit);
 const added=applyItemQuantity(unit,{item:'ammo',count:10});assert.equal(added.ammo,22);assert.equal(slot(added,'large-1').count,11);assert.equal(inventoryUsage(added).used,12);assert.equal(inventoryUsage(added).overloaded,false);assert.ok(slots(added).filter(s=>s.id!=='large-1').every(s=>s.entry.count===1));
 const full=applyItemQuantity(unit,{item:'ammo',count:228});assert.equal(full.ammo,240);assert.ok(slots(full).every(s=>s.entry.count===20));assert.throws(()=>applyItemQuantity(unit,{item:'ammo',count:229}),/espacio/);assert.deepEqual(unit,before);
});

test('receiving a compatible generic object fills existing partial stacks and preserves condition',()=>{
 const unit=actor(field({inventory:{cloth:cloth(3)},pocketOrder:[hint('small-3','inventory:cloth',0,2),hint('large-4','inventory:cloth',1,1)]}));
 const n=applyItemQuantity(unit,{item:'inventory:cloth',...cloth(4)});assert.deepEqual(n.inventory.cloth,cloth(7));assert.deepEqual(partitions(n,'inventory:cloth'),{'large-4':4,'small-3':3});assert.equal(inventoryUsage(n).used,2);
});

test('a vanished record leaves no partition that can bind a different later item with the same key',()=>{
 const original=actor(field({inventory:{parcel:cloth(4)},pocketOrder:[hint('small-1','inventory:parcel',0,4)]})),spent=extractItemQuantity(original,'inventory:parcel',4).unit;
 assert.deepEqual(spent.inventory,{});assert.equal(inventoryUsage(spent).used,0);
 const incoming={name:'Paquete pesado',count:1,weight:3},received=applyItemQuantity(spent,{item:'inventory:parcel',...incoming});assert.deepEqual(received.inventory.parcel,incoming);assert.equal(inventoryUsage(received).used,1);assert.ok(slots(received).find(s=>s.entry?.item==='inventory:parcel').id.startsWith('large-'));assert.deepEqual(original.inventory.parcel,cloth(4));
});

test('extraction and real dressing use reconcile partial supplies without touching unrelated partitions',()=>{
 const unit=actor(field({ammo:12,inventory:{cloth:cloth(3)},pocketOrder:[hint('small-1','ammo',0,3),hint('small-3','ammo',1,4),hint('small-5','ammo',2,5),hint('large-3','inventory:cloth',0,1),hint('large-4','inventory:cloth',1,2)]}));
 const before=structuredClone(unit),taken=extractItemQuantity(unit,'ammo',6);assert.equal(taken.stack.count,6);assert.equal(taken.unit.ammo,6);assert.equal(packedTotal(taken.unit,'ammo'),6);assert.deepEqual(partitions(taken.unit,'inventory:cloth'),partitions(unit,'inventory:cloth'));assert.deepEqual(unit,before);
 const received=applyItemQuantity(taken.unit,{item:'ammo',count:2});assert.equal(packedTotal(received,'ammo'),8);assert.equal(received.ammo,8);
 let b=field({weapon:0,loaded:0,activeSlot:'medical',medkits:4,hp:70,maxHp:100,bleeding:5,medical:60,inventory:{cloth:cloth(3)},pocketOrder:[hint('small-1','medkits',0,1),hint('small-2','medkits',1,2),hint('large-3','inventory:cloth',0,1),hint('large-4','inventory:cloth',1,2)]});
 const clothBefore=partitions(actor(b),'inventory:cloth');b=actBattle(b,{type:'useItem',unitId:'p',targetId:'p'});assert.equal(b.lastError,null,b.lastError);assert.equal(actor(b).medkits,3);assert.equal(actor(b).bleeding,0);assert.equal(packedTotal(actor(b),'medkits'),2);assert.equal(equipmentEndpoint(actor(b),'hand:right').count,1);assert.deepEqual(partitions(actor(b),'inventory:cloth'),clothBefore);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});

test('outfit swaps and a held weapon stow preserve unrelated 2 + 1 pocket partitions',()=>{
 let b=field({outfit:{...makeOutfit('poncho',61),instanceId:'worn'},inventory:{spare:{...makeOutfit('poncho',44),instanceId:'spare'},cloth:cloth(3)},pocketOrder:[hint('large-1','inventory:spare',0,1),hint('small-3','inventory:cloth',0,2),hint('small-8','inventory:cloth',1,1)]});
 const before=partitions(actor(b),'inventory:cloth');b=move(b,'large-1','outfit',1);assert.equal(actor(b).outfit.instanceId,'spare');assert.deepEqual(partitions(actor(b),'inventory:cloth'),before);
 b=move(b,'hand:right','large-4',1);assert.equal(slot(actor(b),'large-4').weapon,1805);assert.deepEqual(partitions(actor(b),'inventory:cloth'),before);
 b=move(b,'large-4','hand:right',1);assert.equal(actor(b).weapon,1805);assert.deepEqual(partitions(actor(b),'inventory:cloth'),before);
});

test('a chosen pocket gives one supply to the hand, keeps the selected remainder, and receives that singleton back',()=>{
 let b=field({medkits:5,inventory:{cloth:cloth(3)},pocketOrder:[hint('small-2','medkits',0,2),hint('large-3','medkits',1,3),hint('small-3','inventory:cloth',0,2),hint('small-8','inventory:cloth',1,1)]});
 const before=partitions(actor(b),'inventory:cloth'),preview=equipmentPlacementPreview(b,actor(b),action(actor(b),'large-3','hand:left',2));b=move(b,'large-3','hand:left',2);assert.equal(handLayout(actor(b)).left,'medkits');assert.equal(equipmentEndpoint(actor(b),'hand:left').count,1);assert.deepEqual(preview.remainingSelection,{sourceId:'large-3',expectedSource:equipmentFingerprint(actor(b),'large-3'),count:1,maxCount:2});assert.deepEqual(partitions(actor(b),'medkits'),{'large-3':2,'small-2':2});assert.deepEqual(partitions(actor(b),'inventory:cloth'),before);
 b=move(b,'hand:left','large-4',1);assert.equal(handLayout(actor(b)).left,null);assert.deepEqual(partitions(actor(b),'medkits'),{'large-3':2,'large-4':1,'small-2':2});assert.deepEqual(partitions(actor(b),'inventory:cloth'),before);assert.equal(actor(b).medkits,5);
});

test('campaign quantity arrangement and save/reentry preserve finite partitions without campaign AP or time expenditure',()=>{
 const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
 let s=step(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});const person=()=>sectorInventoryModel(s,'retiro',rosterFor(s),110).personal;
 const arrange=(from,to,count)=>{const unit=person(),before=structuredClone(s),{type,unitId,...a}=action(unit,from,to,count);s=step(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'equipment',...a});for(const key of ['hour','secondOfHour','resources','seed','sectorStates'])assert.deepEqual(s[key],before[key]);assert.equal(person().ap,unit.ap);};
 assert.equal(person().medkits,2);const from=slots(person()).find(p=>p.entry?.item==='medkits').id;arrange(from,'large-4',1);assert.deepEqual(partitions(person(),'medkits'),{'large-4':1,[from]:1});
 let saved=decodeSave(encodeSave(s));assert.deepEqual(saved.campaign,s);s=saved.campaign;const planned=partitions(person(),'medkits'),order=structuredClone(person().pocketOrder);
 s=step(s,{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro),unit=b.units.find(u=>u.id==='110');assert.deepEqual(partitions(unit,'medkits'),planned);assert.deepEqual(unit.pocketOrder,order);saved=decodeSave(encodeSave(s,b));assert.deepEqual(saved.battle,b);
 const synced=syncBattleTime(s,b);assert.equal(synced.error,null);s=step(synced.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 arrange(from,'large-4',1);assert.deepEqual(partitions(person(),'medkits'),{'large-4':2});s=decodeSave(encodeSave(s)).campaign;s=step(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);unit=b.units.find(u=>u.id==='110');assert.equal(unit.medkits,2);assert.deepEqual(partitions(unit,'medkits'),{'large-4':2});assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
});

test('snapshot and campaign admission reject oversized known-item partitions but retain legitimate overfull inventories',()=>{
 const b=field({ammo:5});actor(b).pocketOrder=[hint('small-1','ammo',0,21)];assert.throws(()=>validateBattleSnapshot(b),/límite/);
 const emptyAmmo=field({ammo:0});actor(emptyAmmo).pocketOrder=[hint('small-1','ammo',0,21)];assert.throws(()=>validateBattleSnapshot(emptyAmmo),/límite/);
 const allHeld=field({activeSlot:'medical',medkits:1});actor(allHeld).pocketOrder=[hint('small-1','medkits',0,6)];assert.throws(()=>validateBattleSnapshot(allHeld),/límite/);
 const s=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});assert.equal(s.lastError,null);
 s.operativeState[110].pocketOrder=[hint('small-1','medkits',0,6)];assert.throws(()=>decodeSave(encodeSave(s)),/límite/);
 s.operativeState[110].medkits=0;assert.throws(()=>decodeSave(encodeSave(s)),/límite/);s.operativeState[110].medkits=1;s.operativeState[110].activeSlot='medical';assert.throws(()=>decodeSave(encodeSave(s)),/límite/);
 const overfull=field({ammo:1000000,pocketOrder:POCKETS.map((p,index)=>hint(p.id,'ammo',index,1))});const restored=validateBattleSnapshot(overfull);assert.equal(actor(restored).ammo,1000000);assert.equal(inventoryUsage(actor(restored)).overloaded,true);assert.equal(packedTotal(actor(restored),'ammo'),1000000);
 const crowded=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});crowded.operativeState[110].medkits=1000;crowded.operativeState[110].pocketOrder=POCKETS.map((p,index)=>hint(p.id,'medkits',index,1));const campaign=decodeSave(encodeSave(crowded)).campaign;assert.equal(campaign.operativeState[110].medkits,1000);assert.equal(inventoryUsage(sectorInventoryModel(campaign,'retiro',rosterFor(campaign),110).personal).overloaded,true);
});
