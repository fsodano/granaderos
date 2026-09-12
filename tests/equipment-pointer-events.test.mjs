import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';
const {EquipmentInteractionProvider,useEquipmentDrag}=await import('../web/lib/equipment-drag.ts');
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const field=()=>createBattle([{id:'p',x:1,y:1,weapon:1805,loaded:1,blade:0,medkits:3,torches:2}],{width:8,height:8,exploration:true,enemies:[]});
const pocket=(unit,item)=>inventoryUsage(unit).slots.find(s=>s.entry?.item===item).id;

// Capture the actual hook callbacks with React's renderer. Browser layout is
// represented only by hit-test results and pointer capture; ownership and
// placement still go through the real controller, planner and reducer.
function controls(battle=field()){
 const unit=battle.units[0],orders=[],inspections=[],apis={},captures=new Map();
 function Capture({name}){apis[name]=useEquipmentDrag(battle,unit,false,a=>orders.push(a));return null;}
 render(h(EquipmentInteractionProvider,null,[h(Capture,{key:'pockets',name:'pockets'}),h(Capture,{key:'hands',name:'hands'})]));
 const buttons=new Map();let hit=null;
 const button=slotId=>{
  if(buttons.has(slotId))return buttons.get(slotId);
  const api=apis[slotId.startsWith('hand:')?'hands':'pockets'],handlers=api.handlers(slotId,{onInspect:item=>inspections.push(item)}),captured=new Set();
  const node={dataset:{equipmentScope:handlers['data-equipment-scope'],equipmentUnit:String(unit.id),equipmentSlot:slotId},closest(){return this;},setPointerCapture(id){captured.add(id);},hasPointerCapture:id=>captured.has(id),releasePointerCapture(id){captured.delete(id);}};
  captures.set(slotId,captured);const value={handlers,node};buttons.set(slotId,value);return value;
 };
 const event=(slotId,{pointerId=1,isPrimary=true,pointerType='mouse',x=10,y=10,button:mouseButton=0}={})=>{
  const state={stopped:false,prevented:false};return Object.assign(state,{pointerId,isPrimary,pointerType,button:mouseButton,clientX:x,clientY:y,currentTarget:button(slotId).node,preventDefault(){state.prevented=true;},stopPropagation(){state.stopped=true;}});
 };
 const pointer=(handler,slotId,options={})=>{const e=event(slotId,options);button(slotId).handlers[handler](e);return e;};
 const click=slotId=>{const e=event(slotId);button(slotId).handlers.onClickCapture(e);const suppressed=e.stopped;if(!suppressed)button(slotId).handlers.onClick(e);return suppressed;};
 const over=slotId=>{hit=slotId===null?null:button(slotId).node;};
 // Restore the ambient document immediately after each synchronous event run.
 const run=fn=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{elementFromPoint:()=>hit}});try{return fn();}finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}};
 return {battle,unit,orders,inspections,apis,captures,button,event,pointer,click,over,run};
}
function applied(ui){assert.equal(ui.orders.length,1);const next=actBattle(ui.battle,{unitId:'p',...ui.orders[0]});assert.equal(next.lastError,null,next.lastError);return next;}

test('normal primary-pointer drags emit one legal order and suppress the following native click',()=>{
 const ui=controls(),from=pocket(ui.unit,'medkits'),before=structuredClone(ui.battle);
 ui.run(()=>{
  ui.pointer('onPointerDown',from,{pointerId:11});ui.over('hand:left');ui.pointer('onPointerMove',from,{pointerId:11,x:40});
  assert.deepEqual(ui.orders,[]);assert.deepEqual(ui.battle,before);
  ui.pointer('onPointerUp',from,{pointerId:11,x:40});assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].sourceId,from);
  ui.pointer('onPointerUp',from,{pointerId:11,x:40});assert.equal(ui.orders.length,1,'repeated release must not issue another order');
  assert.equal(ui.click(from),true);assert.equal(ui.click('large-4'),false);assert.equal(ui.orders.length,1,'trailing click must not restart a reservation');
 });
 const next=applied(ui);assert.equal(handLayout(next.units[0]).left,'medkits');assert.equal(next.units[0].medkits,3);assert.equal(next.units[0].ap,ui.unit.ap);assert.deepEqual(ui.battle,before);
});

test('Escape-style cancellation consumes the pending pointer click before and after the drag threshold',()=>{
 for(const dragging of [false,true]){
  const ui=controls(),from=pocket(ui.unit,'medkits'),before=structuredClone(ui.battle);
  ui.run(()=>{
   ui.pointer('onPointerDown',from,{pointerId:12});ui.over('hand:left');if(dragging)ui.pointer('onPointerMove',from,{pointerId:12,x:40});
   assert.equal(ui.apis.pockets.cancel(),true);ui.pointer('onPointerUp',from,{pointerId:12,x:dragging?40:10});
   assert.equal(ui.click(from),true,'a canceled press must consume its trailing click');ui.click('large-4');assert.deepEqual(ui.orders,[]);
   // A later, fresh interaction is still usable after the click was consumed.
   ui.pointer('onPointerDown',from,{pointerId:13});ui.over(from);ui.pointer('onPointerUp',from,{pointerId:13});assert.equal(ui.click(from),false);ui.click('hand:left');
  });
  assert.equal(handLayout(applied(ui).units[0]).left,'medkits');assert.deepEqual(ui.battle,before);
 }
});

test('right-click cancellation during a primary drag does not inspect, move, or silently pick up the item again',()=>{
 const ui=controls(),from=pocket(ui.unit,'medkits'),before=structuredClone(ui.battle);
 ui.run(()=>{
  ui.pointer('onPointerDown',from,{pointerId:14});ui.over('hand:left');ui.pointer('onPointerMove',from,{pointerId:14,x:40});
  ui.pointer('onContextMenu',from,{pointerId:14,button:2});ui.pointer('onPointerUp',from,{pointerId:14,x:40});assert.equal(ui.click(from),true);
  ui.click('large-4');assert.deepEqual(ui.orders,[]);assert.deepEqual(ui.inspections,[]);
 });assert.deepEqual(ui.battle,before);
});

test('a secondary touch cannot replace the primary finger\'s selected pocket',()=>{
 const ui=controls(),from=pocket(ui.unit,'medkits'),second=pocket(ui.unit,'torches');
 ui.run(()=>{
  ui.pointer('onPointerDown',from,{pointerId:21,pointerType:'touch',isPrimary:true});
  ui.pointer('onPointerDown',second,{pointerId:22,pointerType:'touch',isPrimary:false});assert.equal(ui.captures.get(second).size,0,'secondary touch must not capture an inventory button');
  ui.over('hand:left');ui.pointer('onPointerMove',from,{pointerId:21,pointerType:'touch',isPrimary:true,x:60});ui.pointer('onPointerUp',from,{pointerId:21,pointerType:'touch',isPrimary:true,x:60});
  assert.equal(ui.orders[0]?.sourceId,from);assert.equal(ui.click(from),true);
 });
 const next=applied(ui);assert.equal(handLayout(next.units[0]).left,'medkits');assert.equal(next.units[0].torches,ui.unit.torches);
});

test('an additional primary pointer cannot overwrite an active gesture in the same component or another component',()=>{
 for(const second of ['another-pocket','hand:right']){
  const ui=controls(),from=pocket(ui.unit,'medkits'),other=second==='another-pocket'?pocket(ui.unit,'torches'):second;
  ui.run(()=>{
   ui.pointer('onPointerDown',from,{pointerId:31,pointerType:'touch'});ui.pointer('onPointerDown',other,{pointerId:32,pointerType:'pen'});
   assert.equal(ui.captures.get(other).size,0,'an active press keeps sole ownership of the gesture');
   ui.over('hand:left');ui.pointer('onPointerMove',from,{pointerId:31,pointerType:'touch',x:60});ui.pointer('onPointerUp',from,{pointerId:31,pointerType:'touch',x:60});assert.equal(ui.orders[0]?.sourceId,from);
  });assert.equal(handLayout(applied(ui).units[0]).left,'medkits');
 }
});

test('movement, release and cancellation from the wrong pointer leave the real drag active',()=>{
 for(const unrelated of ['onPointerMove','onPointerUp','onPointerCancel','onLostPointerCapture']){
  const ui=controls(),from=pocket(ui.unit,'medkits');
  ui.run(()=>{
   ui.pointer('onPointerDown',from,{pointerId:41});ui.over('hand:left');ui.pointer('onPointerMove',from,{pointerId:41,x:60});
   ui.over(null);ui.pointer(unrelated,from,{pointerId:42,x:100,isPrimary:false,pointerType:'touch'});assert.deepEqual(ui.orders,[]);
   ui.over('hand:left');ui.pointer('onPointerUp',from,{pointerId:41,x:60});assert.equal(ui.orders[0]?.sourceId,from);assert.equal(ui.click(from),true);
  });assert.equal(handLayout(applied(ui).units[0]).left,'medkits');
 }
});

test('the release handler rechecks the source after a gun changes during a drag',()=>{
 const ui=controls();
 ui.run(()=>{
  ui.pointer('onPointerDown','hand:right',{pointerId:51});ui.over('large-4');ui.pointer('onPointerMove','hand:right',{pointerId:51,x:60});
  ui.unit.loaded=0;const before=structuredClone(ui.battle);
  ui.pointer('onPointerUp','hand:right',{pointerId:51,x:60});assert.deepEqual(ui.orders,[]);assert.equal(ui.click('hand:right'),true);ui.click('large-4');assert.deepEqual(ui.orders,[]);assert.deepEqual(ui.battle,before);
 });
});

test('controller revalidation leaves a canceled-release receipt for source changes and actor unavailability',()=>{
 // The renderer above does not run React effects. Exercise the exact store
 // operation used by the hook's revalidation effect for this cancellation path.
 for(const cause of ['source','disabled','unit']){
  const battle=field(),unit=battle.units[0],store=createEquipmentInteraction('revalidation'),owner=Symbol('hands');
  store.press(unit,'hand:right',owner,10,10);store.drag(battle,unit,owner,60,10,'large-4');
  const current=cause==='source'?{...unit,loaded:0}:cause==='unit'?{...unit,id:'other'}:unit;store.revalidate(current,cause==='disabled');
  assert.equal(store.getSnapshot().gesture,null);assert.equal(store.getSnapshot().selection,null);
  const released=store.release(owner);assert.equal(released?.action,null);assert.equal(released?.suppressClick,true,'revalidation must still suppress the old press\'s click');assert.equal(store.release(owner),null);
 }
});
