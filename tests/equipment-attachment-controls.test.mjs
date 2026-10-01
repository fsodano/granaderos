import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
const {EquipmentInteractionProvider,useEquipmentInteraction}=await import('../web/lib/equipment-drag.ts');
const {default:Attachment}=await import('../web/app/JA2AttachmentSlot.tsx');
const {default:Pockets}=await import('../web/app/JA2Pockets.tsx');
const {default:Hands}=await import('../web/app/JA2Hands.tsx');
const event=()=>({button:0,detail:0,preventDefault(){},stopPropagation(){}});
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const field=extra=>createBattle([{id:'p',x:1,y:1,weapon:1800,loaded:1,ammo:8,inventory:{socket:{weapon:1811,count:1,weight:.5,loaded:0,condition:79,instanceId:'ui-socket',fittingPattern:'india_socket'}},...extra}],{width:8,height:8,exploration:true,enemies:[]});
function controls(initial,hostId='hand:right'){
 let battle=initial,store,dirty=false;const trees={},orders=[],inspections=[];
 const reduce=a=>{orders.push(a);battle=actBattle(battle,{unitId:'p',...a});dirty=true;store.revalidate(battle.units[0],false,reduce,battle);return battle;};
 function Capture({name,Component,props}){store=useEquipmentInteraction().store;trees[name]=Component(props);return null;}
 const refresh=()=>{const unit=battle.units[0],common={battle,unit,onOrder:reduce,onPick:(item,slotId)=>inspections.push({item,slotId})};render(h(EquipmentInteractionProvider,null,[h(Capture,{key:'attachment',name:'attachment',Component:Attachment,props:{...common,hostId,disabled:false}}),h(Capture,{key:'hands',name:'hands',Component:Hands,props:{...common,busy:false}}),h(Capture,{key:'pockets',name:'pockets',Component:Pockets,props:{...common,disabled:false,layout:inventoryUsage(unit)}})]));store.revalidate(unit,false,reduce,battle);dirty=false;};refresh();
 const find=predicate=>{if(dirty)refresh();return Object.values(trees).flatMap(nodes).find(predicate);};
 return {orders,inspections,get battle(){return battle;},slot:id=>find(node=>node.props?.['data-equipment-slot']===id),attachment:()=>find(node=>node.props?.['data-attachment-host']===hostId),refresh};
}
test('right-click gives details the actual physical host slot and keeps a picked bayonet in cursor custody',()=>{
 const s=field(),ui=controls(s),source=inventoryUsage(s.units[0]).slots.find(slot=>slot.entry?.item==='inventory:socket').id;
 ui.slot(source).props.onClick(event());ui.slot('hand:right').props.onContextMenu(event());assert.deepEqual(ui.inspections,[{item:'primary',slotId:'hand:right'}]);assert.equal(ui.battle.units[0].equipmentCursor.stack.instanceId,'ui-socket');assert.equal(ui.orders.length,1);
 const slot=ui.attachment();assert.equal(slot.props.disabled,false);assert.match(slot.props['aria-label'],/Colocar bayoneta · sin PA/);slot.props.onClick(event());assert.equal(ui.orders.at(-1).type,'attachment');assert.equal(ui.orders.at(-1).expectedHost,equipmentFingerprint(s.units[0],'hand:right'));assert.equal(ui.battle.units[0].equipmentCursor,undefined);assert.equal(ui.battle.units[0].weaponFittings.bayonet.instanceId,'ui-socket');
 ui.attachment().props.onClick(event());assert.equal(ui.battle.units[0].equipmentCursor.stack.instanceId,'ui-socket');ui.slot(source).props.onClick(event());assert.equal(ui.battle.units[0].equipmentCursor,undefined);assert.equal(ui.battle.units[0].loaded,1);assert.equal(ui.battle.units[0].ammo,8);assert.equal(ui.battle.lastError,null);
});
test('a pocket weapon inspector sends its pocket identity and never equips the host',()=>{
 let s=field({weapon:1808,loaded:2,inventory:{socket:{weapon:1811,count:1,weight:.5,condition:61,instanceId:'ui-pocket-socket',fittingPattern:'india_socket'},gun:{weapon:1800,count:1,weight:4,loaded:0,reloadProgress:.25,condition:63,instanceId:'ui-pocket-gun'}}});
 const slots=inventoryUsage(s.units[0]).slots,hostId=slots.find(slot=>slot.entry?.item==='inventory:gun').id,source=slots.find(slot=>slot.entry?.item==='inventory:socket').id,ui=controls(s,hostId);
 ui.slot(source).props.onClick(event());ui.slot(hostId).props.onContextMenu(event());assert.equal(ui.inspections[0].slotId,hostId);ui.attachment().props.onClick(event());assert.equal(ui.orders.at(-1).hostId,hostId);assert.equal(ui.battle.units[0].weapon,1808);assert.equal(ui.battle.units[0].loaded,2);assert.equal(ui.battle.lastError,null);
});
test('the attachment control exposes a disabled AP-short action with the same reason as execution',()=>{
 let s=field();s=actBattle(s,{type:'pickupEquipment',unitId:'p',sourceId:inventoryUsage(s.units[0]).slots.find(slot=>slot.entry?.item==='inventory:socket').id,expectedSource:equipmentFingerprint(s.units[0],inventoryUsage(s.units[0]).slots.find(slot=>slot.entry?.item==='inventory:socket').id)});s.mode='combat';s.units[0].ap=11;
 const ui=controls(s),button=ui.attachment();assert.equal(button.props.disabled,true);assert.match(button.props['aria-label'],/12 PA/);assert.match(button.props.title,/12 PA/);assert.equal(ui.orders.length,0);
});
test('an incompatible firearm has no usable attachment slot',()=>{
 const ui=controls(field({weapon:1805}));assert.equal(ui.attachment(),undefined);assert.equal(ui.orders.length,0);
});
