import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,equipmentCursorPreview} from '../game/tactical.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
const {EquipmentInteractionProvider,useEquipmentInteraction}=await import('../web/lib/equipment-drag.ts');
const {default:Pockets}=await import('../web/app/JA2Pockets.tsx');
const {default:Hands}=await import('../web/app/JA2Hands.tsx');
const rounds=(type,count,name='Carga elegida')=>({kind:'ammunition',ammoType:type,count,weight:.04,name});
const field=(extra={},combat=false)=>createBattle([{id:'p',name:'Tirador',x:1,y:1,weapon:1800,loaded:0,ammo:0,blade:0,inventory:{selected:rounds('musket_75',5),reserve:rounds('musket_75',7,'Reserva intacta')},...extra}],{width:32,height:8,exploration:!combat,enemies:combat?[{id:'e',x:30,y:6,patrol:false,overwatch:false,weapon:1813,loaded:0,ammo:0}]:[],seed:45});
const pocket=(unit,item)=>inventoryUsage(unit).slots.find(slot=>slot.entry?.item===item).id;
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

// Exercise the actual inventory buttons. Only pointer hit testing is supplied
// by the harness; the hook, preview, item custody and reducer remain real.
function controls(initial){
 let battle=initial,store,dirty=false;const trees={},orders=[];
 const reduce=action=>{orders.push(action);battle=actBattle(battle,{unitId:'p',...action});dirty=true;store.revalidate(battle.units[0],false,reduce,battle);return battle;};
 function Capture({name,Component,props}){store=useEquipmentInteraction().store;trees[name]=Component(props);return null;}
 const refresh=()=>{const unit=battle.units[0],common={battle,unit,onOrder:reduce,onPick(){}};render(h(EquipmentInteractionProvider,null,[h(Capture,{key:'hands',name:'hands',Component:Hands,props:{...common,busy:false}}),h(Capture,{key:'pockets',name:'pockets',Component:Pockets,props:{...common,disabled:false,layout:inventoryUsage(unit)}})]));store.revalidate(unit,false,reduce,battle);dirty=false;};refresh();
 const slot=id=>{if(dirty)refresh();const found=Object.values(trees).flatMap(nodes).find(node=>node.props?.['data-equipment-slot']===id);assert.ok(found,`Inventory slot ${id} must exist`);return found;};
 const event=(extra={})=>({button:0,detail:0,shiftKey:false,preventDefault(){},stopPropagation(){},...extra});
 const click=(id,all=false)=>{const button=slot(id);assert.equal(button.props.disabled,false);button.props.onClick(event({shiftKey:all}));};
 const hover=id=>{slot(id).props.onPointerEnter();return store.getSnapshot().hint;};
 const drag=(from,to)=>{
  const source=slot(from),target=slot(to);assert.equal(source.props.disabled,false);assert.equal(target.props.disabled,false);
  const captured=new Set(),currentTarget={setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
  const hit={dataset:{equipmentScope:target.props['data-equipment-scope'],equipmentUnit:target.props['data-equipment-unit'],equipmentSlot:to},closest(){return this;}};
  const pointer=(extra={})=>event({pointerId:1,isPrimary:true,currentTarget,clientX:5,clientY:5,...extra}),descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');let hint;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{elementFromPoint:()=>hit}});
  try{source.props.onPointerDown(pointer({shiftKey:true}));source.props.onPointerMove(pointer({clientX:40}));hint=store.getSnapshot().hint;source.props.onPointerUp(pointer({clientX:40}));}
  finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
  let suppressed=false;source.props.onClickCapture(event({stopPropagation(){suppressed=true;}}));assert.ok(suppressed,'The native trailing click must not take the remaining ammunition again');return hint;
 };
 return {orders,slot,click,hover,drag,get battle(){return battle;},get unit(){return battle.units[0];},get store(){return store;}};
}

test('clicking a chosen cartridge stack onto the main gun loads it and retains only the exact remainder on the cursor',()=>{
 const ui=controls(field()),source=pocket(ui.unit,'inventory:selected'),before=structuredClone(ui.battle),host=equipmentFingerprint(ui.unit,'hand:right');
 ui.click(source,true);assert.equal(ui.unit.equipmentCursor.stack.count,5);assert.equal(ui.unit.equipmentCursor.stack.name,'Carga elegida');
 const hint=ui.hover('hand:right');assert.match(hint,/Recargar Brown Bess/);assert.match(hint,/sin PA · \d+ s · 1 carga lista/);assert.doesNotMatch(hint,/Colocar objeto/);
 ui.click('hand:right');assert.equal(ui.battle.lastError,null);assert.deepEqual(ui.orders.map(action=>action.type),['pickupEquipment','placeEquipment']);assert.equal(ui.orders[1].expectedDestination,host);
 assert.equal(ui.unit.weapon,1800);assert.equal(ui.unit.loaded,1);assert.equal(ui.unit.equipmentCursor.stack.count,4);assert.equal(ui.unit.equipmentCursor.stack.name,'Carga elegida');assert.equal(ui.store.getSnapshot().selection.count,4);
 assert.equal(ui.unit.inventory.reserve.count,7);assert.equal(availableAmmunition(ui.unit,'musket_75'),7);assert.equal(ui.unit.ap,before.units[0].ap);assert.ok(ui.battle.elapsedSeconds>before.elapsedSeconds);assert.equal(before.units[0].loaded,0);
});

test('dragging ammunition onto a second pistol fills its empty barrel without exchanging either held gun',()=>{
 const ui=controls(field({weapon:1805,loaded:1,offHand:{weapon:1808,count:1,weight:1.3,loaded:1,condition:73,instanceId:'second-pistol'},inventory:{selected:rounds('pistol_69',5)}})),source=pocket(ui.unit,'inventory:selected');
 const hint=ui.drag(source,'hand:left');assert.match(hint,/Recargar Pistola Doble Cañón/);assert.match(hint,/sin PA/);assert.equal(ui.battle.lastError,null);assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].type,'dragEquipment');assert.equal(ui.orders[0].sourceId,source);assert.equal(ui.orders[0].destinationId,'hand:left');
 assert.equal(ui.unit.weapon,1805);assert.equal(ui.unit.loaded,1);assert.equal(ui.unit.offHand.weapon,1808);assert.equal(ui.unit.offHand.loaded,2);assert.equal(ui.unit.offHand.instanceId,'second-pistol');assert.equal(ui.unit.offHand.condition,73);assert.equal(ui.unit.equipmentCursor.stack.count,4);assert.equal(ui.unit.equipmentCursor.stack.ammoType,'pistol_69');
});

test('the same pocket buttons load a stored gun without equipping it',()=>{
 const ui=controls(field({weapon:1805,loaded:1,inventory:{selected:rounds('musket_75',5),stored:{weapon:1800,loaded:0,reloadProgress:.5,condition:62,instanceId:'stored-musket',count:1,weight:4}}})),source=pocket(ui.unit,'inventory:selected'),host=pocket(ui.unit,'inventory:stored');
 ui.click(source,true);assert.match(ui.hover(host),/Recargar Brown Bess/);ui.click(host);assert.equal(ui.battle.lastError,null);assert.equal(ui.unit.weapon,1805);assert.equal(ui.unit.loaded,1);const stored=Object.values(ui.unit.inventory).find(item=>item.instanceId==='stored-musket');
 assert.equal(stored.loaded,1);assert.equal(stored.reloadProgress,undefined);assert.equal(stored.condition,62);assert.equal(ui.unit.equipmentCursor.stack.count,4);assert.equal(ui.orders.at(-1).destinationId,host);
});

test('a combat hover shows partial reload work even when this action cannot complete one cartridge',()=>{
 const initial=field({},true);initial.units[0].ap=12;const ui=controls(initial),source=pocket(ui.unit,'inventory:selected');ui.click(source,true);
 const before=structuredClone(ui.battle),hint=ui.hover('hand:right');assert.match(hint,/12 PA/);assert.match(hint,/0 cargas listas/);assert.match(hint,/Recarga parcial/);assert.match(hint,/faltan 33 PA/);assert.doesNotMatch(hint,/sin PA/);assert.deepEqual(ui.battle,before);
 ui.click('hand:right');assert.equal(ui.battle.lastError,null);assert.equal(ui.unit.ap,0);assert.equal(ui.unit.loaded,0);assert.ok(ui.unit.reloadProgress>0);assert.equal(ui.unit.equipmentCursor.stack.count,5);assert.equal(ui.unit.inventory.reserve.count,7);
});

test('full guns and incompatible loads show the rejection and never exchange the gun for ammunition',()=>{
 for(const extra of [{loaded:1},{inventory:{selected:rounds('rifle_62',5)}}]){
  const ui=controls(field(extra)),source=pocket(ui.unit,'inventory:selected');ui.click(source,true);const before=structuredClone(ui.battle),action={type:'placeEquipment',destinationId:'hand:right',count:5,expectedSource:equipmentFingerprint(ui.unit,'cursor'),expectedDestination:equipmentFingerprint(ui.unit,'hand:right')},preview=equipmentCursorPreview(ui.battle,ui.unit,action);
  assert.equal(preview.valid,false);assert.ok(preview.reason);assert.equal(ui.hover('hand:right'),preview.reason);ui.click('hand:right');assert.equal(ui.orders.length,1);assert.deepEqual(ui.battle,before);
 }
});

test('ammunition still moves into an empty pocket at no AP cost without a reload hint',()=>{
 const initial=field({},true);initial.units[0].ap=0;const ui=controls(initial),source=pocket(ui.unit,'inventory:selected'),target=inventoryUsage(ui.unit).slots.find(slot=>!slot.entry).id;ui.click(source,true);
 assert.equal(ui.hover(target),'Colocar objeto · sin PA');ui.click(target);assert.equal(ui.battle.lastError,null);assert.equal(ui.unit.loaded,0);assert.equal(ui.unit.ap,0);assert.equal(ui.unit.equipmentCursor,undefined);assert.equal(availableAmmunition(ui.unit,'musket_75'),12);
});
