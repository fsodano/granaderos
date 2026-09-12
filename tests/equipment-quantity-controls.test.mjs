import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {equipmentEndpoint,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit} from '../game/outfits.js';
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const {EquipmentInteractionProvider,useEquipmentDrag}=await import('../web/lib/equipment-drag.ts');
const {EquipmentQuantityControls}=await import('../web/app/JA2Pockets.tsx');
const field=()=>createBattle([{id:'p',name:'Operador',x:1,y:1,weapon:1805,blade:0,ammo:0,medkits:7}],{width:8,height:8,exploration:true,enemies:[]});
const slots=u=>({from:inventoryUsage(u).slots.find(slot=>slot.entry?.item==='medkits').id,to:inventoryUsage(u).slots.find(slot=>!slot.entry).id});
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
function hookControls(battle){
 const unit=battle.units[0],orders=[];let api;
 function Capture(){api=useEquipmentDrag(battle,unit,false,action=>orders.push(action));return null;}
 render(h(EquipmentInteractionProvider,null,h(Capture)));
 const captured=new Set(),node={setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const event=(shiftKey=false,extra={})=>({button:0,pointerId:1,isPrimary:true,clientX:5,clientY:5,currentTarget:node,shiftKey,preventDefault(){},stopPropagation(){},...extra});
 let hit=null;const over=slotId=>{hit=slotId?{dataset:{equipmentScope:api.scope,equipmentUnit:String(unit.id),equipmentSlot:slotId},closest(){return this;}}:null;};
 const run=fn=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{elementFromPoint:()=>hit}});try{return fn();}finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}};
 return {api,orders,event,run,over};
}

test('plain pickup selects one and Shift selects only the source pocket stack, with finite splitting on placement',()=>{
 for(const all of [false,true]){
  const b=field(),u=b.units[0],before=structuredClone(b),{from,to}=slots(u),store=createEquipmentInteraction('pockets'),owner=Symbol('source');
  const maximum=equipmentEndpoint(u,from).count;assert.ok(maximum>1&&maximum<u.medkits);
  store.click(b,u,from,owner,all);const selected=store.getSnapshot().selection;
  assert.equal(selected.count,all?maximum:1);assert.equal(selected.maxCount,maximum);assert.deepEqual(b,before);
  const action=store.click(b,u,to,owner);assert.equal(action.count,selected.count);
  const n=actBattle(b,{unitId:u.id,...action});assert.equal(n.lastError,null,n.lastError);assert.equal(n.units[0].medkits,u.medkits);
  assert.equal(equipmentEndpoint(n.units[0],to).count,selected.count);assert.equal(n.units[0].ap,u.ap);assert.deepEqual(b,before);
 }
});

test('the quantity field and Todo keep the scoped reservation and send the chosen count',()=>{
 const b=field(),u=b.units[0],before=structuredClone(b),{from,to}=slots(u),store=createEquipmentInteraction('quantity-scope'),owner=Symbol('source');store.click(b,u,from,owner);
 const view=()=>EquipmentQuantityControls({scope:store.scope,quantity:store.getSnapshot().selection,setCount:store.setCount});
 let tree=view(),input=nodes(tree).find(node=>node.type==='input'),button=nodes(tree).find(node=>node.type==='button');
 assert.equal(tree.props['data-equipment-scope'],store.scope,'the actual outside-pointer guard recognizes this scope');
 assert.equal(input.props.type,'number');assert.equal(input.props.min,1);assert.equal(input.props.max,equipmentEndpoint(u,from).count);assert.equal(input.props['aria-label'],'Cantidad a mover');
 let stopped=false;tree.props.onClick({stopPropagation(){stopped=true;}});assert.ok(stopped);
 input.props.onChange({currentTarget:{valueAsNumber:2}});assert.equal(store.getSnapshot().selection.count,2);assert.equal(store.getSnapshot().selection.sourceId,from);
 const control={valueAsNumber:NaN,value:''};nodes(view()).find(node=>node.type==='input').props.onChange({currentTarget:control});assert.equal(control.value,'2');assert.equal(store.getSnapshot().selection.count,2);
 button.props.onClick();assert.equal(store.getSnapshot().selection.count,equipmentEndpoint(u,from).count);
 input=nodes(view()).find(node=>node.type==='input');input.props.onChange({currentTarget:{valueAsNumber:3}});assert.deepEqual(b,before);
 assert.match(render(h(EquipmentQuantityControls,{scope:store.scope,quantity:store.getSnapshot().selection,setCount:store.setCount})),/value="3"/);
 const action=store.click(b,u,to,owner);assert.equal(action.count,3);const n=actBattle(b,{unitId:u.id,...action});assert.equal(n.lastError,null,n.lastError);assert.equal(equipmentEndpoint(n.units[0],to).count,3);
});

test('invalid, cancelled and stale quantity selections do not change ownership or issue orders',()=>{
 const b=field(),u=b.units[0],before=structuredClone(b),{from,to}=slots(u),store=createEquipmentInteraction('quantities'),owner=Symbol('source');store.click(b,u,from,owner);store.setCount(2);
 for(const invalid of [0,-1,1.5,Infinity,NaN,6,'2']){assert.equal(store.setCount(invalid),false);assert.equal(store.getSnapshot().selection.count,2);}
 store.cancel();assert.equal(store.setCount(2),false);assert.equal(store.click(b,u,to,owner),null);assert.equal(store.getSnapshot().selection,null);assert.deepEqual(b,before);
 store.click(b,u,from,owner,true);const changed={...u,medkits:1};assert.equal(store.click(b,changed,to,owner),null);assert.ok(store.getSnapshot().selection,'a refused placement retains the reservation until revalidation');store.revalidate(changed,false);assert.equal(store.getSnapshot().selection,null);assert.deepEqual(b,before);
});

test('Shift cannot increase a hand or worn source endpoint beyond one',()=>{
 const b=field(),u=b.units[0],{from}=slots(u),store=createEquipmentInteraction('hands'),owner=Symbol('source');
 for(const [unit,slot]of [[u,'hand:right'],[{...u,outfit:makeOutfit()},'outfit']]){store.click(b,unit,slot,owner,true);assert.equal(store.getSnapshot().selection.maxCount,1);assert.equal(store.getSnapshot().selection.count,1);assert.equal(store.setCount(2),false);store.cancel();}

});

test('real hook callbacks capture Shift at pointer pickup and keyboard-like clicks can select all',()=>{
 for(const mode of ['pointer','keyboard']){
  const b=field(),u=b.units[0],{from,to}=slots(u),ui=hookControls(b),source=ui.api.handlers(from),destination=ui.api.handlers(to);
  if(mode==='pointer')ui.run(()=>{source.onPointerDown(ui.event(true));source.onPointerUp(ui.event(false));source.onClick(ui.event(false));});
  else source.onClick(ui.event(true,{detail:0}));
  assert.deepEqual(ui.orders,[]);destination.onClick(ui.event(false,{detail:0}));assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].count,equipmentEndpoint(u,from).count);
 }
});

test('drag pickup captures one or all and preserves an already chosen quantity',()=>{
 for(const selected of [null,2])for(const all of [false,true]){
  const b=field(),u=b.units[0],{from,to}=slots(u),store=createEquipmentInteraction('drag'),owner=Symbol('source');
  if(selected){store.click(b,u,from,owner);store.setCount(selected);}
  assert.ok(store.press(u,from,owner,0,0,all));assert.equal(store.setCount(3),false,'quantity does not change mid-gesture');
  store.drag(b,u,owner,40,40,to);const release=store.release(owner);assert.equal(release.action.count,selected??(all?equipmentEndpoint(u,from).count:1));assert.equal(release.suppressClick,true);assert.equal(store.release(owner),null);
 }
});

test('cancelling a quantity gesture still suppresses its trailing click',()=>{
 const b=field(),u=b.units[0],{from,to}=slots(u),ui=hookControls(b),source=ui.api.handlers(from),destination=ui.api.handlers(to);
 ui.run(()=>{source.onPointerDown(ui.event(true));ui.api.cancel();source.onPointerUp(ui.event(false));});
 let stopped=false;source.onClickCapture(ui.event(false,{stopPropagation(){stopped=true;}}));assert.ok(stopped);destination.onClick(ui.event());assert.deepEqual(ui.orders,[]);
});


test('a keyboard click uses its own Shift state after a pointer release produced no native click',()=>{
 const b=field(),u=b.units[0],{from,to}=slots(u),ui=hookControls(b),source=ui.api.handlers(from),destination=ui.api.handlers(to);
 ui.run(()=>{source.onPointerDown(ui.event(true));source.onPointerUp(ui.event(false));});ui.api.cancel();
 source.onClick(ui.event(false,{detail:0}));destination.onClick(ui.event(false,{detail:0}));assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].count,1);
});


test('partial stack filling retains only the unmoved selection with the planned source fingerprint',()=>{
 for(const method of ['click','drag']){
  const b=field(),u=b.units[0],before=structuredClone(b),{from,to:empty}=slots(u),target=inventoryUsage(u).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id;
  const store=createEquipmentInteraction('partial'),owner=Symbol('source');let action;
  if(method==='click'){store.click(b,u,from,owner,true);action=store.click(b,u,target,owner);}
  else {store.press(u,from,owner,0,0,true);store.drag(b,u,owner,40,40,target);const result=store.release(owner);action=result.action;assert.equal(result.suppressClick,true);assert.equal(store.release(owner),null);}
  assert.equal(action.count,5);const selection=store.getSnapshot().selection;assert.equal(selection.count,2);assert.equal(selection.maxCount,2);assert.equal(selection.owner,owner);assert.equal(selection.sourceId,from);assert.deepEqual(b,before);
  const n=actBattle(b,{unitId:u.id,...action});assert.equal(n.lastError,null,n.lastError);assert.equal(equipmentEndpoint(n.units[0],target).count,5);assert.equal(equipmentEndpoint(n.units[0],from).count,2);assert.equal(n.units[0].medkits,7);
  assert.equal(selection.expectedSource,equipmentFingerprint(n.units[0],from));store.revalidate(n.units[0],false);assert.equal(store.getSnapshot().selection.count,2);
  assert.equal(store.click(b,u,empty,owner),null,'an old actor snapshot cannot spend the retained remainder');assert.equal(store.getSnapshot().selection.count,2);
  const rest=store.click(n,n.units[0],empty,owner);assert.equal(rest.count,2);assert.equal(store.getSnapshot().selection,null);
  const last=actBattle(n,{unitId:u.id,...rest});assert.equal(last.lastError,null,last.lastError);assert.equal(equipmentEndpoint(last.units[0],empty).count,2);assert.equal(last.units[0].medkits,7);assert.deepEqual(b,before);
 }
});

test('cancelling a retained remainder leaves the completed merge and all remaining supplies intact',()=>{
 const b=field(),u=b.units[0],{from,to}=slots(u),target=inventoryUsage(u).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id,store=createEquipmentInteraction('cancel-remainder'),owner=Symbol('source');
 store.click(b,u,from,owner,true);const action=store.click(b,u,target,owner),n=actBattle(b,{unitId:u.id,...action}),snapshot=structuredClone(n);
 assert.equal(store.getSnapshot().selection.count,2);store.cancel();assert.equal(store.click(n,n.units[0],to,owner),null);assert.equal(store.getSnapshot().selection,null);assert.deepEqual(n,snapshot);assert.equal(n.units[0].medkits,7);
});

test('a real pointer partial drop retains a selection and its trailing click cannot cancel it or send a second order',()=>{
 const b=field(),u=b.units[0],{from}=slots(u),target=inventoryUsage(u).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id,ui=hookControls(b),source=ui.api.handlers(from);
 ui.run(()=>{source.onPointerDown(ui.event(true));ui.over(target);source.onPointerMove(ui.event(false,{clientX:40}));source.onPointerUp(ui.event(false,{clientX:40}));});
 assert.equal(ui.orders.length,1);const n=actBattle(b,{unitId:u.id,...ui.orders[0]});assert.equal(n.lastError,null,n.lastError);assert.equal(equipmentEndpoint(n.units[0],from).count,2);
 let stopped=false;source.onClickCapture(ui.event(false,{stopPropagation(){stopped=true;}}));assert.ok(stopped);assert.equal(ui.api.cancel(),true,'the retained reservation survived its suppressed trailing click');assert.equal(ui.orders.length,1);assert.equal(ui.api.cancel(),false);
});


test('repeated partial-fill previews keep bounded source metadata and the final target controls the drop',()=>{
 const b=field(),u=b.units[0],{from}=slots(u),target=inventoryUsage(u).slots.find(slot=>slot.entry?.item==='medkits'&&slot.id!==from).id,store=createEquipmentInteraction('bounded-preview'),owner=Symbol('source');
 store.press(u,from,owner,0,0,true);store.drag(b,u,owner,40,40,target);const size=JSON.stringify(store.getSnapshot()).length;
 for(let i=0;i<50;i++)store.drag(b,u,owner,40,40,target);
 assert.equal(JSON.stringify(store.getSnapshot()).length,size);assert.deepEqual(Object.keys(store.getSnapshot().gesture.remainingSelection).sort(),['count','expectedSource','label','maxCount','owner','sourceId','unitId']);
 store.drag(b,u,owner,40,40,null);const release=store.release(owner);assert.equal(release.action,null);assert.equal(store.getSnapshot().selection,null,'an outside release cannot retain a remainder from an earlier destination');
});


test('a selected pocket stack places one item in a hand and retains the exact remainder for click and drag',()=>{
 for(const method of ['click','drag']){
  const b=field(),u=b.units[0],{from}=slots(u),store=createEquipmentInteraction('hand-remainder'),owner=Symbol('source');let action;
  if(method==='click'){store.click(b,u,from,owner,true);action=store.click(b,u,'hand:left',owner);}
  else {store.press(u,from,owner,0,0,true);store.drag(b,u,owner,40,40,'hand:left');const release=store.release(owner);action=release.action;assert.equal(release.suppressClick,true);assert.equal(store.release(owner),null);}
  assert.equal(action.count,5);const n=actBattle(b,{unitId:u.id,...action});assert.equal(n.lastError,null,n.lastError);
  assert.equal(equipmentEndpoint(n.units[0],'hand:left').count,1);assert.equal(equipmentEndpoint(n.units[0],'hand:left').item,'medkits');assert.equal(n.units[0].medkits,7);
  assert.equal(store.getSnapshot().selection.count,4);assert.equal(store.getSnapshot().selection.maxCount,equipmentEndpoint(n.units[0],from).count);assert.equal(store.getSnapshot().selection.expectedSource,equipmentFingerprint(n.units[0],from));
  store.revalidate(n.units[0],false);assert.equal(store.getSnapshot().selection.count,4);assert.equal(store.cancel(),true);assert.equal(equipmentEndpoint(n.units[0],'hand:left').count,1);
 }
});
