import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit} from '../game/outfits.js';
const {EquipmentInteractionProvider,useEquipmentInteraction}=await import('../web/lib/equipment-drag.ts');
const {default:Pockets}=await import('../web/app/JA2Pockets.tsx');
const {default:Hands}=await import('../web/app/JA2Hands.tsx');
const {default:Outfit}=await import('../web/app/JA2OutfitSlot.tsx');
const event=()=>({button:0,detail:0,preventDefault(){},stopPropagation(){},currentTarget:{focus(){}}});
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const field=extra=>createBattle([{id:'p',name:'Operador',x:1,y:1,weapon:1800,blade:1813,...extra}],{width:8,height:8,exploration:true,enemies:[]});
function controls(initial,{disabled=false,compact=false}={}){
 let battle=initial,store,dirty=false;const trees={},orders=[],inspections=[];
 const reduce=action=>{orders.push(action);battle=actBattle(battle,{unitId:'p',...action});dirty=true;store.revalidate(battle.units[0],disabled,reduce,battle);return battle;};
 function Capture({name,Component,props}){store=useEquipmentInteraction().store;trees[name]=Component(props);return null;}
 const refresh=()=>{
  const unit=battle.units[0],common={battle,unit,onOrder:reduce,onPick:item=>inspections.push(item)};
  render(h(EquipmentInteractionProvider,{key:unit.id},[
   h(Capture,{key:'hands',name:'hands',Component:Hands,props:{...common,busy:disabled,compact}}),
   h(Capture,{key:'pockets',name:'pockets',Component:Pockets,props:{...common,disabled,layout:inventoryUsage(unit)}}),
   h(Capture,{key:'outfit',name:'outfit',Component:Outfit,props:{...common,disabled}}),
  ]));store.revalidate(unit,disabled,reduce,battle);dirty=false;
 };refresh();
 return {orders,inspections,get battle(){return battle;},get unit(){return battle.units[0];},get store(){if(dirty)refresh();return store;},slot:id=>{if(dirty)refresh();return Object.values(trees).flatMap(nodes).find(node=>node.props?.['data-equipment-slot']===id);},trees};
}

test('the full inventory physically picks up a hand weapon and places it from the durable cursor',()=>{
 const s=field(),ui=controls(s),destination=inventoryUsage(s.units[0]).slots.find(slot=>slot.size==='large'&&!slot.entry).id;
 ui.slot('hand:right').props.onClick(event());assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment']);assert.equal(ui.unit.weaponDropped,true);assert.equal(ui.unit.equipmentCursor.stack.weapon,1800);assert.deepEqual(ui.inspections,[]);
 ui.slot(destination).props.onClick(event());assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment','placeEquipment']);assert.equal(ui.orders[1].sourceId,'cursor');assert.equal(ui.orders[1].destinationId,destination);assert.deepEqual(ui.inspections,[]);
 assert.equal(ui.battle.lastError,null);assert.equal(ui.unit.ap,s.units[0].ap);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(inventoryUsage(ui.unit).slots.find(slot=>slot.id===destination).entry.weapon,1800);
});

test('right-click inspects actual endpoint contents and cannot discard an owned cursor',()=>{
 const ui=controls(field());ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,['primary']);
 ui.slot('hand:right').props.onClick(event());const held=structuredClone(ui.unit.equipmentCursor);ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,['primary']);assert.deepEqual(ui.unit.equipmentCursor,held);assert.equal(ui.orders.length,1);
 assert.equal(ui.store.cancel(),true);assert.equal(ui.orders.at(-1).type,'returnEquipmentCursor');ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,['primary','primary']);
});

test('a second click on the emptied source places the owned weapon back exactly once',()=>{
 const ui=controls(field());ui.slot('hand:right').props.onClick(event());ui.slot('hand:right').props.onClick(event());assert.deepEqual(ui.orders.map(a=>a.type),['pickupEquipment','placeEquipment']);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(ui.unit.weaponDropped,false);assert.equal(ui.unit.weapon,1800);assert.deepEqual(ui.inspections,[]);
});

test('an empty worn slot stays enabled and accepts an actual selected pocket outfit',()=>{
 const s=field({outfit:null,inventory:{coat:{...makeOutfit(),condition:61,instanceId:'coat-ui'}}}),ui=controls(s),source=inventoryUsage(s.units[0]).slots.find(slot=>slot.entry?.item==='inventory:coat').id;
 assert.equal(ui.slot('outfit').props.disabled,false);assert.match(ui.slot('outfit').props['aria-label'],/Vacía/);
 ui.slot(source).props.onClick(event());assert.equal(ui.unit.inventory.coat,undefined);assert.equal(ui.unit.equipmentCursor.stack.instanceId,'coat-ui');ui.slot('outfit').props.onClick(event());assert.equal(ui.orders.length,2);assert.equal(ui.orders[1].destinationId,'outfit');assert.deepEqual(ui.inspections,[]);
 const next=ui.battle;assert.equal(next.lastError,null);assert.equal(next.units[0].outfit.instanceId,'coat-ui');assert.equal(next.units[0].outfit.condition,61);assert.equal(next.units[0].inventory.coat,undefined);
});

test('compact hands retain their ordinary action click instead of selecting equipment',()=>{
 const s=field({weapon:1805,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:57}}),ui=controls(s,{compact:true});
 ui.slot('hand:left').props.onClick(event());assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].type,'swapHands');assert.deepEqual(ui.inspections,[]);
});

test('unavailable inventory exposes all fifteen destinations as disabled and only one shared hint',()=>{
 const ui=controls(field({outfit:null}),{disabled:true});const buttons=Object.values(ui.trees).flatMap(nodes).filter(node=>node.props?.['data-equipment-slot']);
 assert.equal(buttons.length,15);assert.ok(buttons.every(button=>button.props.disabled));
 const hints=Object.values(ui.trees).flatMap(nodes).filter(node=>node.props?.role==='status');assert.equal(hints.length,1);
 assert.ok(buttons.every(button=>typeof button.props.onClick==='function'&&typeof button.props.onContextMenu==='function'));
});
