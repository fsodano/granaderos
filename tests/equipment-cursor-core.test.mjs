import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {planEquipmentPickup,planEquipmentCursorPlacement,planEquipmentCursorReturn,validateEquipmentCursor} from '../game/equipment-cursor.js';
import {SUPPLY_ITEMS,inventoryUsage,equipmentEndpoint,equipmentFingerprint,extractEquipmentSelection,extractItemQuantity,handRecord,validateHands} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';
import {POCKETS} from '../game/inventory-pockets.js';
import {makeOutfit} from '../game/outfits.js';
const hint=(slotId,item,index,count)=>({slotId,item,index,count});
const field=extra=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,condition:71,blade:0,ammo:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0,...extra}],{width:8,height:8,seed:8,exploration:true,enemies:[]}).units[0];
const endpoint=(unit,id)=>{const value=equipmentEndpoint(unit,id);return value.item?extractItemQuantity(unit,value.item,value.count,{keepOtherHand:false}).stack:null;};
const canonical=stack=>{const {item,count,...data}=structuredClone(stack);return {key:JSON.stringify(Object.fromEntries(Object.entries({item:Object.hasOwn(SUPPLY_ITEMS,item)?item:'object',...data}).sort(([a],[b])=>a.localeCompare(b)))),count};};
function custody(unit,extra=[]){
 const values=[...Object.keys(SUPPLY_ITEMS).filter(item=>unit[item]>0).map(item=>({item,count:unit[item],weight:SUPPLY_ITEMS[item].weight})),...Object.entries(unit.inventory).filter(([,value])=>(typeof value==='number'?value:value.count)>0).map(([key])=>extractItemQuantity(unit,`inventory:${key}`,typeof unit.inventory[key]==='number'?unit.inventory[key]:unit.inventory[key].count,{keepOtherHand:false}).stack),...(!unit.weaponDropped&&unit.weapon?[{item:'weapon',...handRecord(unit,'primary')}]:[]),...(unit.blade?[{item:'weapon',...handRecord(unit,'blade')}]:[]),...(unit.offHand?[{item:'weapon',...handRecord(unit,'offhand')}]:[]),...(unit.outfit?[{item:'outfit',...unit.outfit}]:[]),...(unit.equipmentCursor?[unit.equipmentCursor.stack]:[]),...extra];
 const result={};for(const stack of values){const value=canonical(stack);result[value.key]=(result[value.key]??0)+value.count;}return result;
}
function pick(unit,sourceId,count=1){const before=structuredClone(unit),result=planEquipmentPickup(unit,{sourceId,expectedSource:equipmentFingerprint(unit,sourceId),count});assert.equal(result.pa,0);assert.deepEqual(unit,before);assert.deepEqual(custody(result.unit),custody(unit));validateHands(result.unit);return result.unit;}
function place(unit,destinationId,count){const before=structuredClone(unit),result=planEquipmentCursorPlacement(unit,{destinationId,expectedSource:equipmentFingerprint(unit,'cursor'),expectedDestination:equipmentFingerprint(unit,destinationId),...(count===undefined?{}:{count})});assert.equal(result.pa,0);assert.deepEqual(unit,before);assert.deepEqual(custody(result.unit),custody(unit));validateHands(result.unit);return result.unit;}
function reject(unit,fn,pattern){const before=structuredClone(unit);assert.throws(()=>fn(),pattern);assert.deepEqual(unit,before);}
const fullPack=(extra={})=>field({medkits:1,inventory:Object.fromEntries(POCKETS.filter(p=>p.id!=='small-1').map(p=>[p.id,{name:p.id,count:1,weight:p.size==='large'?3:0,instanceId:p.id}])),pocketOrder:POCKETS.map(p=>hint(p.id,p.id==='small-1'?'medkits':'inventory:'+p.id,0,1)),...extra});

test('pickup owns only the exact selected partial pocket and rejects stale or impossible quantities',()=>{
 const unit=field({medkits:5,pocketOrder:[hint('small-1','medkits',0,3),hint('small-3','medkits',1,2)]}),next=pick(unit,'small-1',2);
 assert.equal(endpoint(next,'small-1').count,1);assert.equal(endpoint(next,'small-3').count,2);assert.equal(next.medkits,3);assert.deepEqual(next.equipmentCursor,{sourceId:'small-1',stack:{item:'medkits',count:2,weight:.2}});assert.equal(next.ap,unit.ap);
 for(const count of [0,-1,.5,4,NaN,'1',null])reject(unit,()=>planEquipmentPickup(unit,{sourceId:'small-1',expectedSource:equipmentFingerprint(unit,'small-1'),count}));
 reject(next,()=>planEquipmentPickup(next,{sourceId:'small-3',expectedSource:equipmentFingerprint(next,'small-3'),count:1}),/cursor/);
 reject(unit,()=>planEquipmentPickup(unit,{sourceId:'small-1',expectedSource:'stale',count:1}),/Cambió/);
 validateEquipmentCursor(JSON.parse(JSON.stringify(next)));assert.equal(equipmentFingerprint(next,'cursor'),equipmentFingerprint(JSON.parse(JSON.stringify(next)),'cursor'));
});

test('unlike pocket exchange leaves the displaced full stack on the cursor and original source vacant',()=>{
 const start=field({medkits:1,rations:2,pocketOrder:[hint('small-1','medkits',0,1),hint('small-2','rations',0,2)]}),lifted=pick(start,'small-1'),next=place(lifted,'small-2');
 assert.equal(endpoint(next,'small-1'),null);assert.equal(endpoint(next,'small-2').item,'medkits');assert.equal(next.rations,0);assert.deepEqual(next.equipmentCursor,{sourceId:'small-1',stack:{item:'rations',count:2,weight:.5}});
 const final=place(next,'large-4');assert.equal(final.equipmentCursor,undefined);assert.equal(endpoint(final,'large-4').count,2);assert.equal(endpoint(final,'small-1'),null);
});

test('a partial source can exchange without moving its unselected remainder',()=>{
 let unit=field({medkits:3,rations:1,pocketOrder:[hint('small-1','medkits',0,3),hint('small-2','rations',0,1)]});unit=place(pick(unit,'small-1',2),'small-2');
 assert.equal(endpoint(unit,'small-1').count,1);assert.equal(endpoint(unit,'small-2').count,2);assert.equal(unit.equipmentCursor.stack.item,'rations');assert.equal(unit.equipmentCursor.stack.count,1);
});

test('a full pack can replace a held rifle without finding a pocket for the displaced exact gun',()=>{
 const original=fullPack({weapon:1800,loaded:0,reloadProgress:.5,condition:47,jammed:true,weaponInstanceId:'rifle'});assert.equal(inventoryUsage(original).free,0);
 const gun=endpoint(original,'hand:right'),next=place(pick(original,'small-1'),'hand:right');
 assert.equal(handLayout(next).right,'medkits');assert.equal(endpoint(next,'small-1'),null);assert.deepEqual(next.equipmentCursor.stack,gun);assert.equal(inventoryUsage(next).overloaded,false);
 const back=planEquipmentCursorReturn(next);assert.ok(back.dropped);assert.deepEqual(back.dropped,gun);assert.equal(back.unit.equipmentCursor,undefined);assert.deepEqual(custody(back.unit,[back.dropped]),custody(original));
});

test('large outgoing objects stay on the cursor when their small original source cannot hold them',()=>{
 const outfit={...makeOutfit('poncho',43),instanceId:'coat'},base=fullPack();base.inventory['large-1']=outfit;
 const next=place(pick(base,'small-1'),'large-1');assert.equal(endpoint(next,'small-1'),null);assert.equal(endpoint(next,'large-1').item,'medkits');assert.equal(next.equipmentCursor.stack.instanceId,'coat');
 const returned=planEquipmentCursorReturn(next);assert.equal(returned.dropped.instanceId,'coat');assert.deepEqual(custody(returned.unit,[returned.dropped]),custody(base));
});

test('worn clothing exchanges with an occupied hand or large pocket without equipping the displaced object',()=>{
 for(const destination of ['hand:right','large-1']){
  const base=field({outfit:{...makeOutfit('poncho',61),instanceId:'worn'},medkits:2,pocketOrder:[hint('large-1','medkits',0,2)]}),old=endpoint(base,destination),next=place(pick(base,'outfit'),destination);
  assert.equal(next.outfit,null);assert.equal(endpoint(next,destination).instanceId,'worn');assert.deepEqual(next.equipmentCursor.stack,old);assert.equal(next.equipmentCursor.sourceId,'outfit');
 }
 const lifted=pick(field({medkits:1}),'small-1');reject(lifted,()=>place(lifted,'outfit'),/vestimenta/);
});

test('compatible partial merges retain the actual remaining cursor quantity',()=>{
 const unit=field({medkits:7,pocketOrder:[hint('small-1','medkits',0,5),hint('small-2','medkits',1,2)]}),next=place(pick(unit,'small-1',5),'small-2');
 assert.equal(endpoint(next,'small-2').count,5);assert.equal(next.medkits,5);assert.equal(next.equipmentCursor.stack.count,2);assert.equal(endpoint(next,'small-1'),null);
 reject(next,()=>place(next,'small-2'),/completa/);const final=place(next,'hand:left');assert.equal(final.equipmentCursor.stack.count,1);assert.equal(endpoint(final,'hand:left').count,1);
});

test('oversized unlike hand placement auto-places outgoing gear before keeping incoming remainder, or rejects atomically',()=>{
 const base=field({medkits:3,pocketOrder:[hint('small-1','medkits',0,3)]}),next=place(pick(base,'small-1',3),'hand:right');
 assert.equal(endpoint(next,'hand:right').item,'medkits');assert.equal(next.equipmentCursor.stack.count,2);assert.ok(inventoryUsage(next).slots.some(slot=>slot.entry?.weapon===1805));
 const full=fullPack({weapon:1800,medkits:3,pocketOrder:POCKETS.map(p=>hint(p.id,p.id==='small-1'?'medkits':'inventory:'+p.id,0,p.id==='small-1'?3:1))}),lifted=pick(full,'small-1',3);
 reject(lifted,()=>place(lifted,'hand:right'),/espacio/);
});

test('two handed placement uses an empty pocket for the offhand or lifts the sole offhand onto the cursor',()=>{
 const gun={weapon:1800,count:1,loaded:1,condition:52,weight:4,instanceId:'new-rifle'};
 let base=field({leftHandItem:'medkits',medkits:1,inventory:{rifle:gun},pocketOrder:[hint('large-1','inventory:rifle',0,1)]});let next=place(pick(base,'large-1'),'hand:right');
 assert.equal(next.weaponInstanceId,'new-rifle');assert.equal(handLayout(next).left,null);assert.equal(endpoint(next,'large-1').item,'medkits');assert.equal(next.equipmentCursor.stack.weapon,1805);
 base=field({weapon:0,loaded:0,activeSlot:'unarmed',leftHandItem:'medkits',medkits:1,inventory:{rifle:gun},pocketOrder:[hint('large-1','inventory:rifle',0,1)]});next=place(pick(base,'large-1'),'hand:right');assert.equal(next.equipmentCursor.stack.item,'medkits');assert.equal(endpoint(next,'large-1'),null);
 const two=field({weapon:1800,medkits:1});const lifted=pick(two,inventoryUsage(two).slots.find(slot=>slot.entry?.item==='medkits').id);reject(lifted,()=>place(lifted,'hand:left'),/dos manos/);
});

test('pickup preserves the other physical hand and identical supplies can occupy one slot in each hand',()=>{
 const base=field({offHand:{weapon:1806,count:1,weight:2,loaded:1,condition:33,instanceId:'left-pistol'},leftHandItem:'offhand'}),left=endpoint(base,'hand:left'),lifted=pick(base,'hand:right');assert.equal(endpoint(lifted,'hand:right'),null);assert.deepEqual(endpoint(lifted,'hand:left'),left);
 let unit=field({weapon:0,loaded:0,activeSlot:'medical',medkits:2,pocketOrder:[hint('small-1','medkits',0,1)]});unit=place(pick(unit,'small-1'),'hand:left');assert.deepEqual(handLayout(unit).held,['medkits','medkits']);assert.equal(unit.medkits,2);assert.equal(inventoryUsage(unit).items.some(item=>item.item==='medkits'),false);assert.equal(unit.equipmentCursor,undefined);
 unit=pick(unit,'hand:right');assert.equal(endpoint(unit,'hand:right'),null);assert.equal(endpoint(unit,'hand:left').item,'medkits');assert.equal(unit.equipmentCursor.stack.count,1);
 const consumed=extractItemQuantity(place(unit,'hand:right'),'medkits',1).unit;validateHands(consumed);assert.equal(handLayout(consumed).held.length,1);assert.equal(consumed.medkits,1);
});

test('generic shared records and unrelated partial pockets retain exact physical counts through cursor use',()=>{
 const cloth={name:'Tela',count:5,weight:.1,condition:47},base=field({weapon:0,loaded:0,activeSlot:'item',activeItem:'inventory:cloth',inventory:{cloth},ammo:5,pocketOrder:[hint('small-2','inventory:cloth',0,2),hint('small-3','inventory:cloth',1,2),hint('large-3','ammo',0,2),hint('large-4','ammo',1,3)]});
 let next=place(pick(base,'small-2'),'hand:left');assert.deepEqual(handLayout(next).held,['inventory:cloth','inventory:cloth']);assert.equal(next.inventory.cloth.count,5);assert.equal(endpoint(next,'small-2').count,1);assert.equal(endpoint(next,'small-3').count,2);assert.equal(endpoint(next,'large-3').count,2);assert.equal(endpoint(next,'large-4').count,3);
 next=pick(next,'hand:left');assert.equal(next.inventory.cloth.count,4);assert.equal(endpoint(next,'hand:right').count,1);assert.equal(endpoint(next,'small-2').count,1);assert.equal(endpoint(next,'small-3').count,2);
});

test('cursor map extraction takes finite payload metadata and quantity and rejects malformed or duplicate cursor admission',()=>{
 const base=field({weaponInstanceId:'gun'}),unit=pick(base,'hand:right'),taken=extractEquipmentSelection(unit,{sourceId:'cursor',expectedSource:equipmentFingerprint(unit,'cursor'),count:1});assert.deepEqual(taken.stack,unit.equipmentCursor.stack);assert.equal(taken.unit.equipmentCursor,undefined);assert.deepEqual(custody(taken.unit,[taken.stack]),custody(base));
 for(const mutate of [c=>c.sourceId='cursor',c=>c.sourceId='large-5',c=>c.stack.item='cursor',c=>c.stack.count=0,c=>c.stack.count=2,c=>c.stack.loaded=9,c=>c.stack.condition=-1,c=>c.extra=true]){const bad=structuredClone(unit);mutate(bad.equipmentCursor);assert.throws(()=>validateEquipmentCursor(bad));}
 const duplicated=structuredClone(unit);duplicated.inventory.copy={...unit.equipmentCursor.stack};delete duplicated.inventory.copy.item;assert.throws(()=>validateEquipmentCursor(duplicated),/duplicada/);
 const stale={destinationId:'large-1',expectedSource:equipmentFingerprint(unit,'cursor'),expectedDestination:equipmentFingerprint(unit,'large-1')};const changed=structuredClone(unit);changed.equipmentCursor.stack.condition--;reject(changed,()=>planEquipmentCursorPlacement(changed,stale),/Cambió/);
});

test('loaded, partly reloaded and fitted weapons keep admitted names, weights and extensions through every cursor hand exchange',()=>{
 const records=[
  {weapon:1805,count:1,weight:2.1,loaded:1,condition:43,jammed:true,instanceId:'named',name:'Pistola del testador',provenance:{year:1807,notes:['legacy','engraved']}},
  {weapon:1800,count:1,weight:4,loaded:0,reloadProgress:.5,condition:51,jammed:false,instanceId:'fitted',name:'Fusil conservado',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'socket',condition:38}}},
  {weapon:1813,count:1,weight:1.8,loaded:0,condition:67,jammed:false,instanceId:'knife',name:'Cuchillo grabado',marks:{owner:'civilian'}},
 ];
 for(const record of records){
  let unit=field({inventory:{special:record},pocketOrder:[hint('large-1','inventory:special',0,1)]}),expected=endpoint(unit,'large-1');
  unit=place(pick(unit,'large-1'),'hand:right');assert.deepEqual(canonical(endpoint(unit,'hand:right')),canonical(expected));
  unit=place(unit,'large-4');unit=pick(unit,'hand:right');assert.deepEqual(canonical(unit.equipmentCursor.stack),canonical(expected));
  if(record.weapon!==1800){unit=place(unit,'hand:left');assert.deepEqual(canonical(endpoint(unit,'hand:left')),canonical(expected));unit=pick(unit,'hand:left');}
  unit=place(unit,'large-1');assert.deepEqual(canonical(endpoint(unit,'large-1')),canonical(expected));validateHands(JSON.parse(JSON.stringify(unit)));
 }
});

test('an unrelated cursor pickup keeps a blade active and leaves a named offhand blade record intact',()=>{
 const offHand={weapon:1813,count:1,weight:1.9,loaded:0,condition:33,jammed:false,instanceId:'secondary',name:'Hoja labrada',notes:{from:'legacy'}};
 const unit=field({weapon:0,loaded:0,blade:1809,bladeInstanceId:'main-blade',activeSlot:'blade',offHand,leftHandItem:'offhand',medkits:1});
 const right=endpoint(unit,'hand:right'),left=endpoint(unit,'hand:left'),source=inventoryUsage(unit).slots.find(slot=>slot.entry?.item==='medkits').id,next=pick(unit,source);
 assert.equal(next.activeSlot,'blade');assert.deepEqual(endpoint(next,'hand:right'),right);assert.deepEqual(endpoint(next,'hand:left'),left);
});

test('returning the cursor can exchange with its original slot and auto-place that displaced payload without loss',()=>{
 const base=field({medkits:3,pocketOrder:[hint('large-1','medkits',0,3)]}),unit=place(pick(base,'large-1',3),'hand:right');
 // The oversized legal hand placement stores its outgoing gun in the now
 // empty original pocket and leaves two dressings on the cursor.
 assert.equal(endpoint(unit,'large-1').weapon,1805);assert.equal(unit.equipmentCursor.stack.count,2);
 const returned=planEquipmentCursorReturn(unit);assert.equal(returned.dropped,null);assert.equal(returned.unit.equipmentCursor,undefined);assert.deepEqual(custody(returned.unit),custody(base));assert.equal(endpoint(returned.unit,'large-1').item,'medkits');assert.equal(endpoint(returned.unit,'large-1').count,2);assert.ok(inventoryUsage(returned.unit).slots.some(slot=>slot.entry?.weapon===1805));
});
