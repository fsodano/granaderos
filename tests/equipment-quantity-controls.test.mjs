import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {equipmentEndpoint,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit} from '../game/outfits.js';
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const {EquipmentInteractionProvider,useEquipmentDrag,useEquipmentInteraction}=await import('../web/lib/equipment-drag.ts');
const {EquipmentQuantityControls}=await import('../web/app/JA2Pockets.tsx');
const field=extra=>createBattle([{id:'p',name:'Operador',x:1,y:1,weapon:1805,blade:0,ammo:0,medkits:7,...extra}],{width:8,height:8,exploration:true,enemies:[]});
const slots=u=>({from:inventoryUsage(u).slots.find(slot=>slot.entry?.item==='medkits').id,to:inventoryUsage(u).slots.find(slot=>!slot.entry).id});
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
function control(initial=field()){
 let battle=initial;const store=createEquipmentInteraction('quantities'),owner=Symbol('source'),orders=[];
 const reduce=action=>{orders.push(action);battle=actBattle(battle,{unitId:'p',...action});return battle;};
 const observe=()=>store.revalidate(battle.units[0],false,reduce,battle);observe();
 const dispatch=action=>{assert.ok(action);store.dispatch({...action,unitId:'p'},reduce,owner);observe();assert.equal(battle.lastError,null,battle.lastError);};
 return {store,owner,orders,dispatch,get battle(){return battle;},get unit(){return battle.units[0];},click(slot,all=false){const action=store.click(battle,battle.units[0],slot,owner,all);if(action)dispatch(action);return action;}};
}
function hookControls(initial){
 let battle=initial,api,store,dirty=false;const orders=[];
 const reduce=action=>{orders.push(action);battle=actBattle(battle,{unitId:'p',...action});dirty=true;store.revalidate(battle.units[0],false,reduce,battle);return battle;};
 function Capture(){store=useEquipmentInteraction().store;api=useEquipmentDrag(battle,battle.units[0],false,reduce);return null;}
 const refresh=()=>{if(!api||dirty){render(h(EquipmentInteractionProvider,null,h(Capture)));store.revalidate(battle.units[0],false,reduce,battle);dirty=false;}};refresh();
 const captured=new Set(),node={setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const event=(shiftKey=false,extra={})=>({button:0,pointerId:1,isPrimary:true,detail:1,clientX:5,clientY:5,currentTarget:node,shiftKey,preventDefault(){},stopPropagation(){},...extra});
 let hit=null;const over=slotId=>{hit=slotId?{dataset:{equipmentScope:api.scope,equipmentUnit:'p',equipmentSlot:slotId},closest(){return this;}}:null;};
 const run=fn=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{elementFromPoint:()=>hit}});try{return fn();}finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}};
 return {get api(){refresh();return api;},get battle(){return battle;},get unit(){return battle.units[0];},orders,event,run,over};
}

test('plain pickup takes one and Shift takes only the finite source pocket stack',()=>{
 for(const all of [false,true]){
  const ui=control(),before=structuredClone(ui.battle),{from,to}=slots(ui.unit),maximum=equipmentEndpoint(ui.unit,from).count,count=all?maximum:1;
  assert.ok(maximum>1&&maximum<ui.unit.medkits);ui.click(from,all);
  assert.equal(ui.unit.medkits,7-count);assert.equal(ui.unit.equipmentCursor.stack.count,count);assert.equal(equipmentEndpoint(ui.unit,from).count,maximum-count);assert.equal(ui.store.getSnapshot().selection.count,count);assert.equal(ui.store.getSnapshot().selection.maxCount,count);
  const action=ui.click(to);assert.equal(action.type,'placeEquipment');assert.equal(action.count,count);assert.equal(ui.unit.medkits,7);assert.equal(equipmentEndpoint(ui.unit,to).count,count);assert.equal(ui.unit.ap,before.units[0].ap);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(before.units[0].medkits,7);
 }
});

test('quantity controls choose a subset of the owned cursor and Todo cannot take more from the source',()=>{
 const ui=control(),{from,to}=slots(ui.unit);ui.click(from,true);const count=ui.unit.equipmentCursor.stack.count,afterPickup=structuredClone(ui.battle);
 const view=()=>EquipmentQuantityControls({scope:ui.store.scope,quantity:ui.store.getSnapshot().selection,setCount:ui.store.setCount});
 let tree=view(),input=nodes(tree).find(node=>node.type==='input'),button=nodes(tree).find(node=>node.type==='button');
 assert.equal(tree.props['data-equipment-scope'],ui.store.scope);assert.equal(input.props.type,'number');assert.equal(input.props.min,1);assert.equal(input.props.max,count);assert.equal(input.props['aria-label'],'Cantidad a mover');
 let stopped=false;tree.props.onClick({stopPropagation(){stopped=true;}});assert.ok(stopped);
 input.props.onChange({currentTarget:{valueAsNumber:2}});assert.equal(ui.store.getSnapshot().selection.count,2);assert.equal(ui.store.getSnapshot().selection.sourceId,'cursor');
 const invalid={valueAsNumber:NaN,value:''};nodes(view()).find(node=>node.type==='input').props.onChange({currentTarget:invalid});assert.equal(invalid.value,'2');
 button.props.onClick();assert.equal(ui.store.getSnapshot().selection.count,count);input.props.onChange({currentTarget:{valueAsNumber:3}});assert.deepEqual(ui.battle,afterPickup);
 assert.match(render(h(EquipmentQuantityControls,{scope:ui.store.scope,quantity:ui.store.getSnapshot().selection,setCount:ui.store.setCount})),/value="3"/);
 ui.click(to);assert.equal(equipmentEndpoint(ui.unit,to).count,3);assert.equal(ui.unit.equipmentCursor.stack.count,count-3);assert.equal(ui.unit.medkits,7-(count-3));assert.equal(ui.store.getSnapshot().selection.count,count-3);
});

test('invalid counts and stale cursor fingerprints cannot move an item; return restores exact custody',()=>{
 const ui=control(),{from,to}=slots(ui.unit);ui.click(from,true);ui.store.setCount(2);const held=structuredClone(ui.unit.equipmentCursor);
 for(const invalid of [0,-1,1.5,Infinity,NaN,6,'2']){assert.equal(ui.store.setCount(invalid),false);assert.equal(ui.store.getSnapshot().selection.count,2);assert.deepEqual(ui.unit.equipmentCursor,held);}
 const stale=ui.store.click(ui.battle,ui.unit,to,ui.owner);ui.click(to);assert.equal(ui.unit.equipmentCursor.stack.count,3);
 const refused=actBattle(ui.battle,{unitId:'p',...stale});assert.ok(refused.lastError);assert.deepEqual(refused.units[0].equipmentCursor,ui.unit.equipmentCursor);
 assert.equal(ui.store.cancel(),true);assert.equal(ui.unit.medkits,7);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(ui.orders.at(-1).type,'returnEquipmentCursor');assert.equal(ui.store.setCount(2),false);
});

test('Shift never increases a hand or worn endpoint beyond its one owned item',()=>{
 for(const [extra,slot]of [[{},'hand:right'],[{outfit:makeOutfit()},'outfit']]){
  const ui=control(field(extra));ui.click(slot,true);assert.equal(ui.store.getSnapshot().selection.maxCount,1);assert.equal(ui.store.setCount(2),false);assert.equal(ui.unit.equipmentCursor.stack.count,1);assert.equal(equipmentEndpoint(ui.unit,slot).count,0);assert.equal(ui.store.cancel(),true);
 }
});

test('actual hook callbacks capture pointer Shift and keyboard Shift on authoritative pickup',()=>{
 for(const mode of ['pointer','keyboard']){
  const ui=hookControls(field()),{from,to}=slots(ui.unit),maximum=equipmentEndpoint(ui.unit,from).count,source=ui.api.handlers(from);
  if(mode==='pointer')ui.run(()=>{source.onPointerDown(ui.event(true));source.onPointerUp(ui.event(false));source.onClick(ui.event(false));});else source.onClick(ui.event(true,{detail:0}));
  assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment']);assert.equal(ui.unit.equipmentCursor.stack.count,maximum);
  ui.api.handlers(to).onClick(ui.event(false,{detail:0}));assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment','placeEquipment']);assert.equal(ui.orders[1].count,maximum);assert.equal(ui.unit.equipmentCursor,undefined);
 }
});

test('drag quantity is fixed at press and cannot restart while an owned cursor is present',()=>{
 for(const all of [false,true]){
  const ui=control(),{from,to}=slots(ui.unit),maximum=equipmentEndpoint(ui.unit,from).count;
  assert.ok(ui.store.press(ui.unit,from,ui.owner,0,0,all));assert.equal(ui.store.setCount(3),false);ui.store.drag(ui.battle,ui.unit,ui.owner,40,40,to);const release=ui.store.release(ui.owner);
  assert.equal(release.action.type,'dragEquipment');assert.equal(release.action.count,all?maximum:1);assert.equal(release.suppressClick,true);assert.equal(ui.store.release(ui.owner),null);ui.dispatch(release.action);
  ui.click(to,true);assert.equal(ui.store.press(ui.unit,from,ui.owner,0,0,true),false);assert.ok(ui.unit.equipmentCursor);
 }
});

test('partial merges retain the exact remainder in the cursor only after actual state acknowledgement',()=>{
 for(const method of ['click','drag']){
  const ui=control(),{from,to}=slots(ui.unit),target=inventoryUsage(ui.unit).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id;let action;
  if(method==='click'){ui.click(from,true);action=ui.store.click(ui.battle,ui.unit,target,ui.owner);}else{ui.store.press(ui.unit,from,ui.owner,0,0,true);ui.store.drag(ui.battle,ui.unit,ui.owner,40,40,target);action=ui.store.release(ui.owner).action;assert.equal(ui.store.getSnapshot().selection,null,'a gesture cannot predict the remainder');}
  assert.equal(action.count,5);ui.dispatch(action);assert.equal(equipmentEndpoint(ui.unit,target).count,5);assert.equal(equipmentEndpoint(ui.unit,from).count,0);assert.equal(ui.unit.equipmentCursor.stack.count,2);assert.equal(ui.unit.medkits,5);
  const selected=ui.store.getSnapshot().selection;assert.equal(selected.count,2);assert.equal(selected.maxCount,2);assert.equal(selected.sourceId,'cursor');assert.equal(selected.expectedSource,equipmentFingerprint(ui.unit,'cursor'));
  const restored=createEquipmentInteraction('saved-remainder');restored.revalidate(JSON.parse(JSON.stringify(ui.unit)),false);assert.equal(restored.getSnapshot().selection.count,2);
  ui.click(to);assert.equal(equipmentEndpoint(ui.unit,to).count,2);assert.equal(ui.unit.medkits,7);assert.equal(ui.unit.equipmentCursor,undefined);
 }
});

test('explicitly returning a merge remainder keeps the completed merge and restores all supplies',()=>{
 const ui=control(),{from}=slots(ui.unit),target=inventoryUsage(ui.unit).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id;
 ui.click(from,true);ui.click(target);assert.equal(ui.unit.equipmentCursor.stack.count,2);assert.equal(ui.store.cancel(),true);assert.equal(equipmentEndpoint(ui.unit,target).count,5);assert.equal(ui.unit.medkits,7);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(ui.orders.at(-1).type,'returnEquipmentCursor');
});

test('a pointer partial merge keeps its acknowledged cursor through the suppressed trailing click',()=>{
 const ui=hookControls(field()),{from}=slots(ui.unit),target=inventoryUsage(ui.unit).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id,source=ui.api.handlers(from);
 ui.run(()=>{source.onPointerDown(ui.event(true));ui.over(target);source.onPointerMove(ui.event(false,{clientX:40}));source.onPointerUp(ui.event(false,{clientX:40}));});
 assert.equal(ui.orders.length,1);assert.equal(ui.unit.equipmentCursor.stack.count,2);let stopped=false;source.onClickCapture(ui.event(false,{stopPropagation(){stopped=true;}}));assert.ok(stopped);
 assert.equal(ui.api.cancel(),true);assert.deepEqual(ui.orders.map(a=>a.type),['dragEquipment','returnEquipmentCursor']);assert.equal(ui.unit.medkits,7);assert.equal(ui.api.cancel(),false);
});

test('canceled quantity gestures suppress their click and a later keyboard pickup uses its own Shift state',()=>{
 const ui=hookControls(field()),{from,to}=slots(ui.unit),source=ui.api.handlers(from);
 ui.run(()=>{source.onPointerDown(ui.event(true));ui.api.cancel();source.onPointerUp(ui.event(false));});let stopped=false;source.onClickCapture(ui.event(false,{stopPropagation(){stopped=true;}}));assert.ok(stopped);assert.deepEqual(ui.orders,[]);
 source.onClick(ui.event(false,{detail:0}));assert.equal(ui.unit.equipmentCursor.stack.count,1);ui.api.handlers(to).onClick(ui.event(false,{detail:0}));assert.equal(ui.orders[1].count,1);
});

test('repeated previews keep bounded metadata and the final outside release picks up the original stack',()=>{
 const ui=control(),{from}=slots(ui.unit),target=inventoryUsage(ui.unit).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id;
 ui.store.press(ui.unit,from,ui.owner,0,0,true);ui.store.drag(ui.battle,ui.unit,ui.owner,40,40,target);const size=JSON.stringify(ui.store.getSnapshot()).length;
 for(let i=0;i<50;i++)ui.store.drag(ui.battle,ui.unit,ui.owner,40,40,target);assert.equal(JSON.stringify(ui.store.getSnapshot()).length,size);assert.equal(ui.store.getSnapshot().selection,null);
 ui.store.drag(ui.battle,ui.unit,ui.owner,40,40,null);const release=ui.store.release(ui.owner);assert.equal(release.action.type,'pickupEquipment');ui.dispatch(release.action);assert.equal(ui.unit.equipmentCursor.stack.count,5);assert.equal(equipmentEndpoint(ui.unit,target).count,2);
});

test('placing a selected stack in a hand leaves every other item in the cursor',()=>{
 for(const method of ['click','drag']){
  const ui=control(),{from}=slots(ui.unit);
  if(method==='click'){ui.click(from,true);ui.click('hand:left');}else{ui.store.press(ui.unit,from,ui.owner,0,0,true);ui.store.drag(ui.battle,ui.unit,ui.owner,40,40,'hand:left');ui.dispatch(ui.store.release(ui.owner).action);}
  assert.equal(equipmentEndpoint(ui.unit,'hand:left').count,1);assert.equal(equipmentEndpoint(ui.unit,'hand:left').item,'medkits');assert.equal(ui.unit.equipmentCursor.stack.count,4);assert.equal(ui.unit.medkits,3);assert.equal(ui.store.getSnapshot().selection.count,4);assert.equal(ui.store.cancel(),true);assert.equal(ui.unit.medkits,7);assert.equal(equipmentEndpoint(ui.unit,'hand:left').count,1);
 }
});
