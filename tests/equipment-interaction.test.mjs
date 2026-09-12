import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {equipmentEndpoint,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const field=(extra={},options={})=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,condition:71,ammo:8,blade:0,medkits:3,...extra}],{width:10,height:8,exploration:true,enemies:[],...options});
const pocket=(u,item)=>inventoryUsage(u).slots.find(s=>s.entry?.item===item).id;
function control(initial=field()){
 let battle=initial;const store=createEquipmentInteraction('inventory'),orders=[];
 const unit=()=>battle.units[0];
 const onOrder=action=>{orders.push(action);battle=actBattle(battle,{unitId:unit().id,...action});return battle;};
 const observe=()=>store.revalidate(unit(),false,onOrder,battle);observe();
 const dispatch=action=>{assert.ok(action);const accepted=store.dispatch({...action,unitId:unit().id},onOrder);observe();return accepted;};
 return {store,orders,get battle(){return battle;},get unit(){return unit();},observe,dispatch,click(slot,owner=Symbol('panel'),all=false){const action=store.click(battle,unit(),slot,owner,all);if(action)dispatch(action);return action;}};
}

test('cross-panel clicks physically pick up one item and place only after reducer acknowledgement',()=>{
 const ui=control(),original=structuredClone(ui.battle),from=pocket(ui.unit,'medkits'),owner=Symbol('pockets');
 const pickup=ui.store.click(ui.battle,ui.unit,from,owner);assert.equal(pickup.type,'pickupEquipment');assert.equal(ui.store.getSnapshot().selection,null);assert.deepEqual(ui.battle,original);
 ui.dispatch(pickup);assert.equal(ui.unit.medkits,2);assert.equal(ui.unit.equipmentCursor.stack.count,1);assert.equal(ui.store.getSnapshot().selection.sourceId,'cursor');
 assert.equal(ui.store.press(ui.unit,'hand:left',Symbol('hands'),20,20),false);
 ui.store.hover(ui.battle,ui.unit,'hand:left');assert.equal(ui.store.getSnapshot().target,'hand:left');
 const placement=ui.store.click(ui.battle,ui.unit,'hand:left',Symbol('hands'));assert.equal(placement.type,'placeEquipment');assert.equal(placement.expectedSource,equipmentFingerprint(ui.unit,'cursor'));assert.ok(ui.store.getSnapshot().selection,'preview cannot clear durable ownership');
 ui.dispatch(placement);assert.equal(handLayout(ui.unit).left,'medkits');assert.equal(ui.unit.medkits,3);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(ui.store.getSnapshot().selection,null);assert.equal(ui.unit.ap,original.units[0].ap);
 assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment','placeEquipment']);
});

test('explicit return restores the item and component cleanup keeps durable custody',()=>{
 const ui=control(),owner=Symbol('hands'),original=structuredClone(ui.unit);
 ui.click('hand:right',owner);assert.equal(ui.unit.weaponDropped,true);assert.equal(ui.unit.equipmentCursor.stack.loaded,1);
 ui.store.clearOwned(owner);assert.ok(ui.store.getSnapshot().selection);assert.ok(ui.unit.equipmentCursor);
 assert.equal(ui.store.cancel(),true);ui.observe();assert.equal(ui.store.cancel(),false);
 assert.equal(ui.orders.at(-1).type,'returnEquipmentCursor');assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(ui.unit.weapon,original.weapon);assert.equal(ui.unit.loaded,original.loaded);assert.equal(ui.unit.condition,original.condition);assert.equal(ui.unit.ap,original.ap);
});

test('an invalid destination keeps the exact cursor stack and its actual rejection reason',()=>{
 const ui=control(field({weapon:1800}));ui.click(pocket(ui.unit,'medkits'));const held=structuredClone(ui.unit.equipmentCursor),orders=ui.orders.length;
 assert.equal(ui.click('hand:left'),null);assert.match(ui.store.getSnapshot().hint,/dos manos/);assert.deepEqual(ui.unit.equipmentCursor,held);assert.equal(ui.orders.length,orders);
 ui.store.cancel();ui.observe();ui.click('hand:right');assert.equal(ui.click('small-8'),null);assert.ok(ui.store.getSnapshot().selection);assert.equal(ui.store.getSnapshot().target,'');
});

test('disabled panels and another actor do not discard an acknowledged cursor',()=>{
 const ui=control();ui.click(pocket(ui.unit,'medkits'));const picked=ui.store.getSnapshot().selection;
 ui.store.revalidate(ui.unit,true);assert.equal(ui.store.getSnapshot().selection,picked);
 ui.store.revalidate({...ui.unit,id:'other',equipmentCursor:undefined},false);assert.equal(ui.store.getSnapshot().selection,picked);
 assert.equal(ui.store.click(ui.battle,{...ui.unit,id:'other'},'hand:left',Symbol('other')),null);assert.match(ui.store.getSnapshot().hint,/otro combatiente/);assert.equal(ui.unit.medkits,2);
});

test('save reobservation reconstructs the actual cursor and rejects a stale placement',()=>{
 const ui=control();ui.click('hand:right');const saved=JSON.parse(JSON.stringify(ui.battle)),store=createEquipmentInteraction('restored'),unit=saved.units[0];
 store.revalidate(unit,false);assert.equal(store.getSnapshot().selection.sourceId,'cursor');assert.equal(store.getSnapshot().selection.expectedSource,equipmentFingerprint(unit,'cursor'));
 const action=store.click(saved,unit,'large-4',Symbol('restored'));
 const current=structuredClone(saved);current.units[0].equipmentCursor.stack.condition--;
 const refused=actBattle(current,{unitId:unit.id,...action});assert.ok(refused.lastError);assert.deepEqual(refused.units[0].equipmentCursor,current.units[0].equipmentCursor);
 store.revalidate(refused.units[0],false);assert.equal(store.getSnapshot().selection.expectedSource,equipmentFingerprint(refused.units[0],'cursor'));
});

test('a reducer rejection and an unacknowledged dispatch cannot create a UI-only cursor',()=>{
 const b=field(),unit=b.units[0],store=createEquipmentInteraction('ack'),owner=Symbol('source'),action=store.click(b,unit,'hand:right',owner);let sent=0;
 const pending=()=>{sent++;return undefined;};store.revalidate(unit,false,pending,b);
 assert.equal(store.dispatch({...action,unitId:unit.id},pending,owner),true);assert.equal(store.getSnapshot().selection,null);assert.equal(store.click(b,unit,'hand:right',owner),null);assert.equal(sent,1);
 const actual=actBattle(b,{...action,unitId:unit.id});assert.equal(actual.lastError,null);store.revalidate(actual.units[0],false,pending,actual);assert.equal(store.getSnapshot().selection.sourceId,'cursor');
 const selected=store.getSnapshot().selection;store.dispatch({...store.click(actual,actual.units[0],'large-4',owner),unitId:unit.id},()=>({lastError:'Orden rechazada.'}));assert.equal(store.getSnapshot().selection,selected);assert.equal(store.getSnapshot().hint,'Orden rechazada.');
});

test('drag threshold, outside release, and repeated release preserve one finite transaction',()=>{
 const ui=control(),owner=Symbol('pockets'),other=Symbol('hands'),from=pocket(ui.unit,'medkits'),before=structuredClone(ui.battle);
 assert.ok(ui.store.press(ui.unit,from,owner,0,0));ui.store.drag(ui.battle,ui.unit,owner,3,3,'hand:left');assert.equal(ui.store.getSnapshot().gesture.dragging,false);
 ui.store.drag(ui.battle,ui.unit,owner,20,20,'hand:left');assert.equal(ui.store.release(other),null);const released=ui.store.release(owner);
 assert.equal(released.action.type,'dragEquipment');assert.equal(released.action.expectedSource,equipmentFingerprint(ui.unit,from));assert.equal(ui.store.release(owner),null);assert.deepEqual(ui.battle,before);ui.dispatch(released.action);assert.equal(handLayout(ui.unit).left,'medkits');
 const second=pocket(ui.unit,'torches');ui.store.press(ui.unit,second,owner,0,0);ui.store.drag(ui.battle,ui.unit,owner,20,20,null);const outside=ui.store.release(owner);assert.equal(outside.action.type,'pickupEquipment');assert.equal(outside.suppressClick,true);ui.dispatch(outside.action);assert.equal(ui.unit.equipmentCursor.stack.item,'torches');
});

test('gesture cancellation and stale revalidation consume the trailing click without moving equipment',()=>{
 for(const reason of ['cancel','source','disabled','actor']){
  const ui=control(),owner=Symbol('hands'),before=structuredClone(ui.battle);ui.store.press(ui.unit,'hand:right',owner,0,0);ui.store.drag(ui.battle,ui.unit,owner,20,20,'large-4');
  if(reason==='cancel')ui.store.cancel();else ui.store.revalidate(reason==='source'?{...ui.unit,loaded:0}:reason==='actor'?{...ui.unit,id:'other'}:ui.unit,reason==='disabled');
  assert.equal(ui.store.getSnapshot().gesture,null);assert.deepEqual(ui.store.release(owner),{dragging:false,action:null,suppressClick:true});assert.equal(ui.store.release(owner),null);assert.deepEqual(ui.orders,[]);assert.deepEqual(ui.battle,before);
 }
});

test('equipment cursor pickup and placement use zero AP even when no combat AP remains',()=>{
 const b=field({}, {exploration:false,enemies:[{id:'e',x:8,y:6,patrol:false,overwatch:false}]});b.units[0].ap=0;const ui=control(b),from=pocket(ui.unit,'medkits');
 ui.click(from);assert.equal(ui.battle.lastError,null);ui.store.hover(ui.battle,ui.unit,'hand:left');assert.match(ui.store.getSnapshot().hint,/sin PA/);
 ui.click('hand:left');assert.equal(ui.battle.lastError,null);assert.equal(ui.unit.ap,0);assert.equal(handLayout(ui.unit).left,'medkits');
});

test('full-pack exchange chains keep each displaced exact object on the cursor until an explicit return',()=>{
 const ids=[...Array.from({length:4},(_,i)=>`large-${i+1}`),...Array.from({length:8},(_,i)=>`small-${i+1}`)],pack=Object.fromEntries(ids.filter(id=>id!=='small-1').map(id=>[id,{name:id,count:1,weight:id.startsWith('large')?3:0,instanceId:id}]));
 const ui=control(field({weapon:1800,loaded:0,reloadProgress:.5,condition:47,jammed:true,weaponInstanceId:'rifle',ammo:0,priming:0,flints:0,rations:0,medkits:1,boleadoras:0,torches:0,inventory:pack,pocketOrder:ids.map(slotId=>({slotId,item:slotId==='small-1'?'medkits':`inventory:${slotId}`,index:0,count:1}))}));
 const original=structuredClone(ui.battle);assert.equal(inventoryUsage(ui.unit).free,0);ui.click('small-1');ui.click('hand:right');
 assert.equal(equipmentEndpoint(ui.unit,'small-1').count,0);assert.equal(handLayout(ui.unit).right,'medkits');assert.equal(ui.unit.equipmentCursor.stack.instanceId,'rifle');assert.equal(ui.unit.equipmentCursor.stack.condition,47);assert.equal(ui.unit.equipmentCursor.stack.reloadProgress,.5);assert.equal(ui.unit.equipmentCursor.stack.jammed,true);
 ui.click('large-1');assert.equal(ui.unit.equipmentCursor.stack.instanceId,'large-1');ui.click('large-2');assert.equal(ui.unit.equipmentCursor.stack.instanceId,'large-2');const held=structuredClone(ui.unit.equipmentCursor),count=ui.orders.length;
 assert.equal(ui.click('small-1'),null);assert.equal(ui.orders.length,count);assert.deepEqual(ui.unit.equipmentCursor,held);assert.equal(ui.store.cancel(),true);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(ui.battle.groundItems.at(-1).instanceId,'large-2');
 const owned=[...Object.values(ui.unit.inventory),...ui.battle.groundItems].filter(item=>item.count>0).map(item=>item.instanceId).filter(Boolean).sort();assert.deepEqual(owned,['rifle',...Object.keys(pack)].sort());assert.equal(new Set(owned).size,owned.length);assert.equal(ui.unit.medkits,1);assert.equal(ui.unit.ap,original.units[0].ap);assert.equal(ui.battle.elapsedSeconds,original.elapsedSeconds);
});

test('revalidation against the latest battle clears the old cursor when its owner has settled or departed',()=>{
 for(const transition of ['returned','departed']){
  let battle=createBattle([{id:'p',x:0,y:2,weapon:1805,loaded:1,blade:0,medkits:1},{id:'q',x:1,y:5,weapon:1805,blade:0}],{id:'cursor-rebind',width:10,height:8,exploration:true,enemies:[],exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'S',entryAnchor:{x:14,y:15}}]});
  const store=createEquipmentInteraction('rebind'),owner=Symbol('source'),orders=[];
  const reduce=action=>{orders.push(action);battle=actBattle(battle,action);return battle;};
  store.revalidate(battle.units[0],false,reduce,battle);store.dispatch({...store.click(battle,battle.units[0],'hand:right',owner),unitId:'p'},reduce,owner);assert.ok(store.getSnapshot().selection);
  // This update follows another UI path. Its result is not returned to the store.
  battle=actBattle(battle,transition==='returned'?{type:'returnEquipmentCursor',unitId:'p',expectedSource:equipmentFingerprint(battle.units[0],'cursor')}:{type:'exit',unitIds:['p'],exitId:'west'});
  assert.equal(battle.lastError,null,battle.lastError);assert.equal(battle.units[0].equipmentCursor,undefined);if(transition==='departed')assert.ok(battle.units[0].departure);
  store.revalidate(battle.units[1],false,reduce,battle);assert.equal(store.getSnapshot().selection,null);assert.equal(store.cancel(),false);assert.equal(orders.length,1,'reobserving state must not issue an old-owner return');
  const next=store.click(battle,battle.units[1],'hand:right',Symbol('next'));assert.equal(next.type,'pickupEquipment');store.dispatch({...next,unitId:'q'},reduce);assert.equal(battle.lastError,null);assert.equal(store.getSnapshot().selection.unitId,'q');
 }
});

test('an unavailable owner retains physical custody while its UI projection clears and later restores',()=>{
 let battle=createBattle([{id:'p',x:1,y:1,weapon:1805,loaded:1,blade:0},{id:'q',x:1,y:5,weapon:1805,blade:0}],{width:10,height:8,enemies:[{id:'e',x:8,y:6,weapon:1809,patrol:false,overwatch:false}]});
 const store=createEquipmentInteraction('interrupted-owner'),owner=Symbol('source');let orders=0;
 const reduce=action=>{orders++;battle=actBattle(battle,action);return battle;};
 store.revalidate(battle.units[0],false,reduce,battle);store.dispatch({...store.click(battle,battle.units[0],'hand:right',owner),unitId:'p'},reduce,owner);const exact=structuredClone(battle.units[0].equipmentCursor);
 // The controller must also admit retained snapshots where a safe cursor return
 // could not finish. Unavailable physical custody is not a selected UI item.
 const interrupted=structuredClone(battle);interrupted.mode='combat';interrupted.phase='interrupt';interrupted.interrupt={side:'player',unitIds:['q'],enemyId:'e'};
 store.revalidate(interrupted.units[1],false,reduce,interrupted);assert.equal(store.getSnapshot().selection,null);assert.deepEqual(interrupted.units[0].equipmentCursor,exact);assert.equal(store.cancel(),false);assert.equal(orders,1);
 const resumed=structuredClone(interrupted);resumed.phase='player';delete resumed.interrupt;
 store.revalidate(resumed.units[0],false,reduce,resumed);assert.equal(store.getSnapshot().selection.unitId,'p');assert.equal(store.getSnapshot().selection.sourceId,'cursor');assert.equal(store.getSnapshot().selection.expectedSource,equipmentFingerprint(resumed.units[0],'cursor'));assert.deepEqual(resumed.units[0].equipmentCursor,exact);assert.equal(orders,1);
});

test('hover previews invalidate for changed actor equipment, cursor quantity, and battle order window',()=>{
 for(const change of ['destination','source','battle']){
  const ui=control(),owner=Symbol(change);ui.click(pocket(ui.unit,'medkits'),owner,true);
  const battle=ui.battle,unit=ui.unit,payload=structuredClone(unit.equipmentCursor),sent=ui.orders.length;
  ui.store.hover(battle,unit,'hand:left');assert.equal(ui.store.getSnapshot().target,'hand:left');assert.match(ui.store.getSnapshot().hint,/sin PA/);
  // Repeating the same hover can use the cached result. The next update must
  // use the new authoritative props even before revalidation runs.
  ui.store.hover(battle,unit,'hand:left');
  const changedUnit=change==='battle'?unit:structuredClone(unit);
  const changedBattle=change==='battle'?{...battle,mode:'combat',phase:'enemy'}:battle;
  if(change==='destination')changedUnit.weapon=1800;
  if(change==='source')changedUnit.equipmentCursor.stack.count=1;
  ui.store.hover(changedBattle,changedUnit,'hand:left');assert.equal(ui.store.getSnapshot().target,'',change);
  assert.match(ui.store.getSnapshot().hint,change==='destination'?/dos manos/:change==='source'?/Cambió el equipo/:/no puede manejar equipo/,change);
  assert.equal(ui.store.click(changedBattle,changedUnit,'hand:left',owner),null);assert.equal(ui.orders.length,sent);assert.deepEqual(unit.equipmentCursor,payload);
  if(change==='source'){
   ui.store.revalidate(changedUnit,false);assert.equal(ui.store.getSnapshot().selection.count,1);assert.equal(ui.store.getSnapshot().selection.expectedSource,equipmentFingerprint(changedUnit,'cursor'));
   ui.store.hover(changedBattle,changedUnit,'hand:left');assert.equal(ui.store.getSnapshot().target,'hand:left');
  }
 }
});

test('changing only the selected quantity invalidates a cached full-pack exchange preview',()=>{
 const slots=[...Array.from({length:4},(_,i)=>`large-${i+1}`),...Array.from({length:8},(_,i)=>`small-${i+1}`)];
 const inventory=Object.fromEntries(slots.filter(id=>id!=='small-1').map(id=>[id,id==='large-1'?{weapon:1800,count:1,weight:4,condition:56,instanceId:'packed-rifle'}:{name:id,count:1,weight:id.startsWith('large')?3:0,instanceId:id}]));
 const ui=control(field({ammo:0,priming:0,flints:0,rations:0,medkits:3,boleadoras:0,torches:0,inventory,pocketOrder:slots.map(slotId=>({slotId,item:slotId==='small-1'?'medkits':`inventory:${slotId}`,index:0,count:slotId==='small-1'?3:1}))}));
 const owner=Symbol('quantity');assert.equal(inventoryUsage(ui.unit).free,0);ui.click('small-1',owner,true);
 const battle=ui.battle,unit=ui.unit,sourceFingerprint=equipmentFingerprint(unit,'cursor'),held=structuredClone(unit.equipmentCursor);
 assert.equal(ui.store.getSnapshot().selection.count,3);
 ui.store.hover(battle,unit,'large-1');assert.equal(ui.store.getSnapshot().target,'large-1');
 // All three bandages can replace the rifle and lift it onto the cursor. With
 // one bandage selected, two remain there and the rifle needs a free large slot.
 assert.equal(ui.store.setCount(1),true);assert.equal(ui.battle,battle);assert.equal(ui.unit,unit);assert.equal(equipmentFingerprint(unit,'cursor'),sourceFingerprint);
 ui.store.hover(battle,unit,'large-1');assert.equal(ui.store.getSnapshot().target,'');assert.match(ui.store.getSnapshot().hint,/objeto desplazado/);assert.equal(ui.store.click(battle,unit,'large-1',owner),null);assert.deepEqual(unit.equipmentCursor,held);
 assert.equal(ui.store.setCount(3),true);ui.store.hover(battle,unit,'large-1');assert.equal(ui.store.getSnapshot().target,'large-1');
 const action=ui.store.click(battle,unit,'large-1',owner);assert.equal(action.count,3);ui.dispatch(action);
 assert.equal(ui.battle.lastError,null);assert.equal(equipmentEndpoint(ui.unit,'large-1').count,3);assert.equal(ui.unit.medkits,3);assert.equal(ui.unit.equipmentCursor.stack.instanceId,'packed-rifle');assert.equal(ui.unit.equipmentCursor.stack.condition,56);
});
