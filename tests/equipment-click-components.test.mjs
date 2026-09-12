import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit} from '../game/outfits.js';
const {EquipmentInteractionProvider}=await import('../web/lib/equipment-drag.ts');
const {default:Pockets}=await import('../web/app/JA2Pockets.tsx');
const {default:Hands}=await import('../web/app/JA2Hands.tsx');
const {default:Outfit}=await import('../web/app/JA2OutfitSlot.tsx');
const event=()=>({button:0,detail:0,preventDefault(){},stopPropagation(){},currentTarget:{focus(){}}});
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const field=extra=>createBattle([{id:'p',name:'Operador',x:1,y:1,weapon:1800,blade:1813,...extra}],{width:8,height:8,exploration:true,enemies:[]});
function controls(battle,{disabled=false,compact=false}={}){
 const unit=battle.units[0],trees={},orders=[],inspections=[];
 const common={battle,unit,onOrder:action=>orders.push(action),onPick:item=>inspections.push(item)};
 function Capture({name,Component,props}){trees[name]=Component(props);return null;}
 render(h(EquipmentInteractionProvider,{key:unit.id},[
  h(Capture,{key:'hands',name:'hands',Component:Hands,props:{...common,busy:disabled,compact}}),
  h(Capture,{key:'pockets',name:'pockets',Component:Pockets,props:{...common,disabled,layout:inventoryUsage(unit)}}),
  h(Capture,{key:'outfit',name:'outfit',Component:Outfit,props:{...common,disabled}}),
 ]));
 return {orders,inspections,slot:id=>Object.values(trees).flatMap(nodes).find(node=>node.props?.['data-equipment-slot']===id),trees};
}

test('the full inventory shares click selection between a hand and a pocket without opening details',()=>{
 const s=field(),ui=controls(s),destination=inventoryUsage(s.units[0]).slots.find(slot=>slot.size==='large'&&!slot.entry).id;
 ui.slot('hand:right').props.onClick(event());assert.deepEqual(ui.orders,[]);assert.deepEqual(ui.inspections,[]);
 ui.slot(destination).props.onClick(event());assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].type,'moveEquipment');assert.equal(ui.orders[0].sourceId,'hand:right');assert.equal(ui.orders[0].destinationId,destination);assert.deepEqual(ui.inspections,[]);
 const next=actBattle(s,{unitId:'p',...ui.orders[0]});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,s.units[0].ap);assert.equal(inventoryUsage(next.units[0]).slots.find(slot=>slot.id===destination).entry.weapon,1800);
});

test('right-click inspects, while right-click during selection cancels without opening details',()=>{
 const ui=controls(field());ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,['primary']);
 ui.slot('hand:right').props.onClick(event());ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,['primary']);assert.deepEqual(ui.orders,[]);
 ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,['primary','primary']);
});

test('a second click on the source cancels and an empty destination cannot place the cancelled object',()=>{
 const s=field(),ui=controls(s),destination=inventoryUsage(s.units[0]).slots.find(slot=>slot.size==='large'&&!slot.entry).id;
 ui.slot('hand:right').props.onClick(event());ui.slot('hand:right').props.onClick(event());ui.slot(destination).props.onClick(event());assert.deepEqual(ui.orders,[]);assert.deepEqual(ui.inspections,[]);
});

test('an empty worn slot stays enabled and accepts an actual selected pocket outfit',()=>{
 const s=field({outfit:null,inventory:{coat:{...makeOutfit(),condition:61,instanceId:'coat-ui'}}}),ui=controls(s),source=inventoryUsage(s.units[0]).slots.find(slot=>slot.entry?.item==='inventory:coat').id;
 assert.equal(ui.slot('outfit').props.disabled,false);assert.match(ui.slot('outfit').props['aria-label'],/Vacía/);
 ui.slot(source).props.onClick(event());ui.slot('outfit').props.onClick(event());assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].destinationId,'outfit');assert.deepEqual(ui.inspections,[]);
 const next=actBattle(s,{unitId:'p',...ui.orders[0]});assert.equal(next.lastError,null);assert.equal(next.units[0].outfit.instanceId,'coat-ui');assert.equal(next.units[0].outfit.condition,61);assert.equal(next.units[0].inventory.coat,undefined);
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
