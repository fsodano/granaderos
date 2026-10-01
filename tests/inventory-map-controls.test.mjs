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
function pick(initial=field(),all=false){
 let battle=initial;const store=createEquipmentInteraction('map'),owner=Symbol('source'),slot=inventoryUsage(battle.units[0]).slots.find(s=>s.entry?.item==='medkits').id,orders=[];
 const reduce=action=>{orders.push(action);battle=actBattle(battle,{unitId:'p',...action});return battle;};
 const observe=()=>store.revalidate(battle.units[0],false,reduce,battle);observe();
 store.dispatch({...store.click(battle,battle.units[0],slot,owner,all),unitId:'p'},reduce,owner);observe();assert.equal(battle.lastError,null,battle.lastError);
 const place=(point,intent='auto',busy=false,onOrder=reduce)=>{const result=placeSelectedItemOnMap(store,battle,battle.units[0],point,intent,busy,onOrder);if(onOrder===reduce)observe();return result;};
 return {store,slot,orders,place,reduce,observe,get b(){return battle;},get u(){return battle.units[0];},get q(){return battle.units[1];}};
}

test('nested providers share the acknowledged field cursor and separate roots remain isolated',()=>{
 let b=field();const captured={};const reduce=action=>{b=actBattle(b,{unitId:'p',...action});captured.map.revalidate(b.units[0],false,reduce,b);return b;};
 function Map({name}){captured[name]=useEquipmentInteraction().store;return null;}
 function Slots(){captured.slots=useEquipmentDrag(b,b.units[0],false,reduce);return null;}
 render(h(EquipmentInteractionProvider,null,[h(Map,{key:'map',name:'map'}),h(EquipmentInteractionProvider,{key:'nested'},[h(Map,{key:'nested',name:'nested'}),h(Slots,{key:'slots'})])]));
 render(h(EquipmentInteractionProvider,null,h(Map,{name:'other'})));assert.equal(captured.map,captured.nested);assert.notEqual(captured.map,captured.other);
 captured.map.revalidate(b.units[0],false,reduce,b);const slot=inventoryUsage(b.units[0]).slots.find(s=>s.entry?.item==='medkits').id;
 captured.slots.handlers(slot).onClick({detail:0,shiftKey:false,stopPropagation(){}});
 assert.equal(b.units[0].medkits,6);assert.equal(b.units[0].equipmentCursor.stack.count,1);assert.equal(captured.map.getSnapshot().selection.sourceId,'cursor');assert.equal(captured.other.getSnapshot().selection,null);
});

test('map giving spends the chosen owned quantity once and keeps its exact remainder',()=>{
 const ui=pick(field(),true);ui.store.setCount(2);const prior=structuredClone(ui.b),preview=selectedItemMapPreview(ui.b,ui.u,ui.store.getSnapshot().selection,ui.q);
 assert.equal(preview.valid,true,preview.reason);assert.equal(preview.action.count,2);assert.equal(preview.action.sourceId,'cursor');assert.equal(preview.action.type,'inventoryMap');
 assert.equal(ui.place(ui.q),true);assert.equal(ui.b.lastError,null);assert.equal(ui.u.medkits,2);assert.equal(ui.q.medkits,2);assert.equal(ui.u.equipmentCursor.stack.count,3);assert.equal(ui.q.hp,prior.units[1].hp);assert.equal(equipmentEndpoint(ui.u,ui.slot).count,0);assert.equal(ui.u.ap,prior.units[0].ap);assert.equal(ui.store.getSnapshot().selection.count,3);
 ui.place(ui.q);assert.equal(ui.q.medkits,5);assert.equal(ui.u.equipmentCursor,undefined);assert.equal(ui.store.getSnapshot().selection,null);assert.equal(ui.place(ui.q),false);assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment','inventoryMap','inventoryMap']);
});

test('invalid targets and busy input consume the cursor click and preserve actual item ownership',()=>{
 const ui=pick(field(),true),picked=ui.store.getSnapshot().selection,before=structuredClone(ui.b);let sent=0;
 for(const [point,busy]of [[{x:99,y:99},false],[ui.q,true],[null,false]]){assert.equal(ui.place(point,'auto',busy,()=>sent++),true);assert.equal(ui.store.getSnapshot().selection,picked);assert.ok(ui.store.getSnapshot().hint);}
 assert.equal(sent,0);assert.deepEqual(ui.b,before);
});

test('parent refusal or an absent acknowledgement keeps the cursor until actual state arrives',()=>{
 for(const response of [null,undefined,{lastError:'La campaña rechazó la orden.'}]){
  const ui=pick(),picked=ui.store.getSnapshot().selection,before=structuredClone(ui.b);
  assert.equal(ui.place(ui.q,'auto',false,()=>response),true);assert.equal(ui.store.getSnapshot().selection,picked);assert.deepEqual(ui.b,before);
  if(response!==undefined)assert.match(ui.store.getSnapshot().hint,/rechazó|sigue en su lugar/);
 }
 const ui=pick(),action=selectedItemMapPreview(ui.b,ui.u,ui.store.getSnapshot().selection,ui.q).action;
 ui.place(ui.q,'auto',false,()=>undefined);const acknowledged=actBattle(ui.b,{unitId:'p',...action});ui.store.revalidate(acknowledged.units[0],false);assert.equal(ui.store.getSnapshot().selection,null);assert.equal(acknowledged.units[1].medkits,1);
});

test('the ground alternative drops the cursor at an ally location without using or giving supplies',()=>{
 const ui=pick(),preview=selectedItemMapPreview(ui.b,ui.u,ui.store.getSnapshot().selection,ui.q,'ground');assert.equal(preview.valid,true,preview.reason);assert.equal(preview.kind,'drop');
 ui.place(ui.q,'ground');assert.equal(ui.b.lastError,null);assert.equal(ui.q.medkits,0);assert.equal(ui.b.groundItems.at(-1).x,ui.q.x);assert.equal(ui.b.groundItems.at(-1).y,ui.q.y);assert.equal(ui.b.groundItems.at(-1).count,1);assert.equal(ui.u.medkits,6);assert.equal(ui.u.equipmentCursor,undefined);
});

test('a stale cursor or a different actor cannot spend the map item',()=>{
 const ui=pick(),changed={...ui.u,equipmentCursor:{...ui.u.equipmentCursor,stack:{...ui.u.equipmentCursor.stack,count:2}}};let orders=0;
 for(const actor of [changed,ui.q]){assert.equal(placeSelectedItemOnMap(ui.store,ui.b,actor,ui.q,'auto',false,()=>orders++),true);assert.ok(ui.store.getSnapshot().selection);}
 assert.equal(orders,0);assert.equal(ui.u.equipmentCursor.stack.count,1);
});

test('a surface ID remains a ground target and keeps the upper landing floor',()=>{
 const b=field(),roof={id:'roof-destination',type:'floor',kind:'roof',x:6,y:2,tacticalLevel:1,elevation:3,blocked:false,cover:0};b.upperSurfaces=[roof];const ui=pick(b);
 const withId=selectedItemMapPreview(ui.b,ui.u,ui.store.getSnapshot().selection,roof),withoutId=selectedItemMapPreview(ui.b,ui.u,ui.store.getSnapshot().selection,{x:roof.x,y:roof.y,tacticalLevel:1});
 assert.equal(withId.valid,true,withId.reason);assert.deepEqual(withId,withoutId);assert.equal(withId.action.targetId,undefined);assert.equal(withId.action.tacticalLevel,1);ui.place(roof);assert.equal(ui.b.lastError,null);assert.equal(ui.b.groundItems.at(-1).tacticalLevel,1);
});

test('the alternate ground destination belongs only to its current cell and floor',()=>{
 const a={x:2,y:2},b={x:3,y:2},roof={...a,tacticalLevel:1};let override=toggleInventoryDestination(null,a);
 assert.equal(inventoryIntentAt(override,a),'ground');assert.equal(inventoryIntentAt(override,b),'auto');assert.equal(inventoryIntentAt(override,roof),'auto');assert.equal(retainInventoryDestination(override,a),override);assert.equal(retainInventoryDestination(override,b),null);assert.equal(retainInventoryDestination(override,null),null);
 override=toggleInventoryDestination(override,b);assert.equal(inventoryIntentAt(override,b),'ground');assert.equal(inventoryIntentAt(toggleInventoryDestination(override,b),b),'auto');
});

test('map overlay draws the reviewed flight and blocked mark without reading hidden people',()=>{
 const ui=pick(),target={x:6,y:2},preview=selectedItemMapPreview(ui.b,ui.u,ui.store.getSnapshot().selection,target);assert.equal(preview.valid,true,preview.reason);assert.ok(preview.path.length>1);
 const props={state:ui.b,preview,target,project:(x,y)=>({x:x*26,y:y*14})},html=render(h('svg',null,h(InventoryMapCursor,props)));assert.match(html,/data-inventory-map-cursor/);assert.match(html,/data-item-trajectory/);assert.doesNotMatch(html,/NaN|Infinity/);
 assert.equal(render(h('svg',null,h(InventoryMapCursor,{...props,state:{...ui.b,units:[...ui.b.units,{id:'secret',x:4,y:2,hp:100}]}}))),html);assert.notEqual(render(h('svg',null,h(InventoryMapCursor,{...props,preview:{...preview,valid:false}}))),html);
});

test('production map and NPC callbacks give durable cursor placement priority over movement and dialogue',()=>{
 const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
 for(const route of ['ground','ally','npc']){
  const initial=field();initial.npcs=[{id:'civil',name:'Vecino',x:2,y:3,hp:100}];const ui=pick(initial),b=ui.b;let store,tree;const changes=[],talks=[];
  const props={battle:b,onChange:next=>{changes.push(next);store.revalidate(next.units[0],false);return next;},onFinish(){},onTalk:(...args)=>talks.push(args)};
  const contents=Battlefield(props).props.children;function Capture(){store=useEquipmentInteraction().store;tree=contents.type(props);return null;}
  render(h(EquipmentInteractionProvider,null,h(Capture)));store.revalidate(b.units[0],false);
  const scene=nodes(tree).find(node=>node.type===TacticalScene);assert.ok(scene);if(route==='npc')scene.props.onTalk(b.npcs[0]);else scene.props.onTile(route==='ally'?b.units[1]:{x:1,y:2});
  assert.deepEqual(talks,[]);assert.equal(changes.length,1);const actual=changes[0];assert.equal(actual.lastError,null);assert.equal(actual.units[0].x,b.units[0].x);assert.equal(actual.units[0].y,b.units[0].y);
  if(route==='npc'){assert.equal(actual.units[0].medkits,6);assert.equal(actual.units[0].equipmentCursor.stack.count,1);assert.ok(store.getSnapshot().selection,'a refused gift stays owned');assert.equal(actual.npcs[0].hp,100);assert.ok(actual.log.some(line=>line.includes('Vecino:')));}else{assert.equal(actual.units[0].medkits,6);assert.equal(actual.units[0].equipmentCursor,undefined);assert.equal(store.getSnapshot().selection,null);}
 }
});
