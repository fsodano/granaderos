import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {inventoryUsage,equipmentEndpoint} from '../game/tactical-inventory.js';
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const {EquipmentInteractionProvider,useEquipmentInteraction,useEquipmentDrag}=await import('../web/lib/equipment-drag.ts');
const {selectedItemMapPreview,placeSelectedItemOnMap,inventoryIntentAt,toggleInventoryDestination,retainInventoryDestination}=await import('../web/lib/inventory-map-controls.ts');
const {default:InventoryMapCursor}=await import('../web/app/InventoryMapCursor.tsx');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const field=()=>createBattle([{id:'p',name:'Emisor',x:2,y:2,weapon:1805,ammo:0,medkits:7},{id:'q',name:'Receptor',x:3,y:2,weapon:1805,ammo:0,medkits:0}],{width:10,height:8,exploration:true,enemies:[],tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}))});
const pick=(b,all=false)=>{const store=createEquipmentInteraction('map'),owner=Symbol('source'),u=b.units[0],slot=inventoryUsage(u).slots.find(s=>s.entry?.item==='medkits').id;store.click(b,u,slot,owner,all);return {store,slot,u};};

test('nested inventory provider shares the tactical map reservation and separate roots remain isolated',()=>{
 const b=field(),captured={};
 function Map({name}){captured[name]=useEquipmentInteraction().store;return null;}
 function Slots(){captured.slots=useEquipmentDrag(b,b.units[0],false,()=>{});return null;}
 render(h(EquipmentInteractionProvider,null,[h(Map,{key:'map',name:'map'}),h(EquipmentInteractionProvider,{key:'nested'},[h(Map,{key:'nested',name:'nested'}),h(Slots,{key:'slots'})])]));
 render(h(EquipmentInteractionProvider,null,h(Map,{name:'other'})));
 assert.equal(captured.map,captured.nested);assert.notEqual(captured.map,captured.other);
 const slot=inventoryUsage(b.units[0]).slots.find(s=>s.entry?.item==='medkits').id;
 captured.slots.handlers(slot).onClick({detail:0,shiftKey:false,stopPropagation(){}});
 assert.equal(captured.map.getSnapshot().selection.sourceId,slot);assert.equal(captured.other.getSnapshot().selection,null);
});

test('map placement gives the selected quantity once without treating the ally or selecting a different actor',()=>{
 const b=field(),before=structuredClone(b),{store,slot,u}=pick(b);store.setCount(2);let next,orders=0;
 const preview=selectedItemMapPreview(b,u,store.getSnapshot().selection,b.units[1]);assert.equal(preview.valid,true,preview.reason);assert.equal(preview.action.count,2);assert.equal(preview.action.sourceId,slot);assert.equal(preview.action.type,'inventoryMap');
 assert.equal(placeSelectedItemOnMap(store,b,u,b.units[1],'auto',false,action=>{orders++;return next=actBattle(b,{unitId:u.id,...action});}),true);
 assert.equal(next.lastError,null);assert.equal(next.units[0].medkits,5);assert.equal(next.units[1].medkits,2);assert.equal(next.units[1].hp,b.units[1].hp);assert.equal(equipmentEndpoint(next.units[0],slot).count,equipmentEndpoint(u,slot).count-2);assert.equal(next.units[0].ap,u.ap);
 assert.equal(store.getSnapshot().selection,null);assert.equal(placeSelectedItemOnMap(store,next,next.units[0],next.units[1],'auto',false,()=>orders++),false);assert.equal(orders,1);assert.deepEqual(b,before);
});

test('invalid targets and busy input consume the cursor click and retain source ownership',()=>{
 const b=field(),{store,u}=pick(b,true),picked=store.getSnapshot().selection,before=structuredClone(b);let orders=0;
 for(const [point,busy]of [[{x:99,y:99},false],[b.units[1],true],[null,false]]){
  assert.equal(placeSelectedItemOnMap(store,b,u,point,'auto',busy,()=>orders++),true);assert.equal(store.getSnapshot().selection,picked);assert.ok(store.getSnapshot().hint);
 }
 assert.equal(orders,0);assert.deepEqual(b,before);
});

test('parent rejection and reducer refusal keep the reservation; accepted placement clears it',()=>{
 for(const response of [null,undefined,{lastError:'La campaña rechazó la orden.'}]){
  const b=field(),{store,u}=pick(b),picked=store.getSnapshot().selection;
  assert.equal(placeSelectedItemOnMap(store,b,u,b.units[1],'auto',false,()=>response),true);assert.equal(store.getSnapshot().selection,picked);assert.match(store.getSnapshot().hint,/rechazó|sigue en su lugar/);
 }
});

test('the ground alternative drops at an ally location without transferring or using supplies',()=>{
 const b=field(),{store,u}=pick(b),preview=selectedItemMapPreview(b,u,store.getSnapshot().selection,b.units[1],'ground');
 assert.equal(preview.valid,true,preview.reason);assert.equal(preview.kind,'drop');let next;
 placeSelectedItemOnMap(store,b,u,b.units[1],'ground',false,action=>next=actBattle(b,{unitId:u.id,...action}));
 assert.equal(next.lastError,null);assert.equal(next.units[1].medkits,0);assert.equal(next.groundItems.at(-1).x,b.units[1].x);assert.equal(next.groundItems.at(-1).y,b.units[1].y);assert.equal(next.groundItems.at(-1).count,1);
});

test('stale source and changed actors cannot spend a picked map item',()=>{
 const b=field(),{store,u}=pick(b);let orders=0;
 for(const actor of [{...u,medkits:1},b.units[1]]){
  assert.equal(placeSelectedItemOnMap(store,b,actor,b.units[1],'auto',false,()=>orders++),true);assert.ok(store.getSnapshot().selection);
 }
 assert.equal(orders,0);
});

test('a surface ID stays a ground target and preserves its upper landing floor',()=>{
 const b=field(),roof={id:'roof-destination',type:'floor',kind:'roof',x:6,y:2,tacticalLevel:1,elevation:3,blocked:false,cover:0};b.upperSurfaces=[roof];
 const {store,u}=pick(b),withId=selectedItemMapPreview(b,u,store.getSnapshot().selection,roof),withoutId=selectedItemMapPreview(b,u,store.getSnapshot().selection,{x:roof.x,y:roof.y,tacticalLevel:1});
 assert.equal(withId.valid,true,withId.reason);assert.deepEqual(withId,withoutId);assert.equal(withId.action.targetId,undefined);assert.equal(withId.action.tacticalLevel,1);
 const next=actBattle(b,{unitId:u.id,...withId.action});assert.equal(next.lastError,null);assert.equal(next.groundItems.at(-1).tacticalLevel,1);
});

test('the alternate ground destination belongs only to the current cell and cancels on leaving it',()=>{
 const a={x:2,y:2},b={x:3,y:2},roof={...a,tacticalLevel:1};let override=toggleInventoryDestination(null,a);
 assert.equal(inventoryIntentAt(override,a),'ground');assert.equal(inventoryIntentAt(override,b),'auto');assert.equal(inventoryIntentAt(override,roof),'auto');
 assert.equal(retainInventoryDestination(override,a),override);assert.equal(retainInventoryDestination(override,b),null);assert.equal(retainInventoryDestination(override,null),null);
 override=toggleInventoryDestination(override,b);assert.equal(inventoryIntentAt(override,b),'ground');assert.equal(inventoryIntentAt(toggleInventoryDestination(override,b),b),'auto');
});

test('map overlay draws the reviewed flight and a blocked mark without reading hidden people',()=>{
 const b=field(),{store,u}=pick(b),target={x:6,y:2},preview=selectedItemMapPreview(b,u,store.getSnapshot().selection,target);
 assert.equal(preview.valid,true,preview.reason);assert.ok(preview.path.length>1);
 const props={state:b,preview,target,project:(x,y)=>({x:x*26,y:y*14})},html=render(h('svg',null,h(InventoryMapCursor,props)));
 assert.match(html,/data-inventory-map-cursor/);assert.match(html,/data-item-trajectory/);assert.doesNotMatch(html,/NaN|Infinity/);
 assert.equal(render(h('svg',null,h(InventoryMapCursor,{...props,state:{...b,units:[...b.units,{id:'secret',x:4,y:2,hp:100}]}}))),html);
 assert.notEqual(render(h('svg',null,h(InventoryMapCursor,{...props,preview:{...preview,valid:false}}))),html);
});

test('production map and NPC callbacks give the picked cursor priority over movement and dialogue',()=>{
 const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
 for(const route of ['ground','ally','npc']){
  const b=field();b.npcs=[{id:'civil',name:'Vecino',x:2,y:3,hp:100}];let store,tree;const changes=[],talks=[];
  const props={battle:b,onChange:next=>{changes.push(next);return next;},onFinish(){},onTalk:(...args)=>talks.push(args)};
  const contents=Battlefield(props).props.children;
  function Capture(){store=useEquipmentInteraction().store;tree=contents.type(props);return null;}
  render(h(EquipmentInteractionProvider,null,h(Capture)));
  const slot=inventoryUsage(b.units[0]).slots.find(s=>s.entry?.item==='medkits').id;store.click(b,b.units[0],slot,Symbol('source'));
  const scene=nodes(tree).find(node=>node.type===TacticalScene);assert.ok(scene);
  if(route==='npc')scene.props.onTalk(b.npcs[0]);else scene.props.onTile(route==='ally'?b.units[1]:{x:1,y:2});
  assert.deepEqual(talks,[]);
  if(route==='npc'){assert.equal(changes.length,1);assert.equal(changes[0].lastError,null);assert.equal(changes[0].units[0].medkits,7);assert.equal(changes[0].npcs[0].hp,100);assert.equal(store.getSnapshot().selection,null);assert.ok(changes[0].log.some(line=>line.includes('Vecino:')));}
  else {assert.equal(changes.length,1);assert.equal(changes[0].lastError,null);assert.equal(changes[0].units[0].medkits,6);assert.equal(changes[0].units[0].x,b.units[0].x);assert.equal(changes[0].units[0].y,b.units[0].y);assert.equal(store.getSnapshot().selection,null);}
 }
});
