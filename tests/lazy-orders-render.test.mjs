import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
register('./orders-work-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
const {createElement:h}=await import('../web/node_modules/react/index.js');
const {renderToStaticMarkup:render}=await import('../web/node_modules/react-dom/server.node.js');
const {componentTree}=await import('./component-tree.mjs');
const {createBattle,actBattle}=await import('../game/tactical.js');
const {default:Strip}=await import('../web/app/JA2Strip.tsx');
const {default:Menu,JA2OrdersPanel:Panel}=await import('../web/app/JA2OrdersMenu.tsx');
const noop=()=>{};
function fixture(){
 const battle=createBattle(Array.from({length:6},(_,i)=>({id:`soldier-${i}`,name:`Soldado ${i+1}`,x:1+i,y:2,weapon:1800,loaded:0,medical:80})),{width:12,height:8,enemies:[{id:'enemy',x:10,y:6}],seed:45});
 const unit=battle.units[0];
 return {battle,unit,selected:unit.id,players:battle.units.filter(u=>u.side==='player'),missionAllies:[],localMilitia:[],mode:'move',showSight:false,aim:0,hitLocation:'torso',firearm:true,cannonId:'',shotType:'solid',artillery:[],busy:false,inventoryId:null,vw:1000,vh:700,cameraRect:{x:0,y:0,width:500,height:300},project:(x,y)=>({x:300+(x-y)*26,y:65+(x+y)*14}),zoom:1,onSelect:noop,onOrder:noop,onMode:noop,onToggleSight:noop,onEndTurn:noop,onRetreat:noop,onOpenInventory:noop,onCloseInventory:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCannonChange:noop,onShotTypeChange:noop};
}
const counted=(component,props)=>{
 globalThis.__ordersWork={};
 try{return {html:render(h(component,props)),calls:{...globalThis.__ordersWork}};}
 finally{delete globalThis.__ordersWork;}
};
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('closed orders do no optional preview work while all six portraits and essential controls render',()=>{
 const initial=fixture();
 for(const props of [initial,{...initial,unit:initial.players[1],selected:initial.players[1].id},{...initial,battle:{...initial.battle,turn:2},busy:true},{...initial,unit:null,selected:null}]){
  const {html,calls}=counted(Strip,props);
  assert.deepEqual(calls,{},'no orders, hands, equipment, hearing, medical, item, supply or artillery previews');
  assert.match(html,/<details class="ja2-orders-menu"><summary>Órdenes<\/summary><\/details>/);
  assert.equal((html.match(/role="listitem"/g)||[]).length,6);
  assert.match(html,/class="ja2-essential"/);assert.match(html,/>Equipo<\/button>/);assert.match(html,/>Fin del turno<\/button>/);
  assert.doesNotMatch(html,/ja2-context|ja2-order-grid|ja2-equipped-slots|ja2-hands/);
 }
 const tree=componentTree(Menu,initial);
 assert.equal(tree.type,'details');assert.equal(tree.props.open,undefined,'the browser owns the open state');
 assert.equal(tree.props.onClick,undefined);assert.equal(tree.props.onKeyDown,undefined,'native summary keyboard activation is preserved');
 assert.equal(tree.props.children[0].type,'summary');assert.equal(typeof tree.props.onToggle,'function');
});

test('inventory computes only its own order model and omits the optional roster panel',()=>{
 const props=fixture(),{html,calls}=counted(Strip,{...props,inventoryId:props.unit.id});
 assert.equal(calls.orderDescriptors,1,'the inventory needs its model, but the strip must not build a second one');
 assert.equal(calls.equippedItemHelp,undefined);assert.equal(calls.heardNoiseModel,undefined);
 assert.match(html,/Equipo y órdenes del combatiente/);assert.match(html,/Manos del combatiente/);
 assert.doesNotMatch(html,/ja2-orders-menu/);
});

test('a selected target and artillery do not trigger their previews behind the closed menu',()=>{
 const props=fixture();
 props.battle.artillery=[{id:'gun',type:'field8',side:'player',x:2,y:3,loaded:false,ammo:3}];
 props.artillery=props.battle.artillery;props.cannonId='gun';props.target=props.players[1];
 const opened=counted(Panel,props);
 assert.ok(opened.calls.itemUsePreview>0);assert.ok(opened.calls.artilleryReloadPreview>0);
 assert.match(opened.html,/Seleccionar pieza de artillería/);
 const closed=counted(Strip,props);
 assert.deepEqual(closed.calls,{});assert.doesNotMatch(closed.html,/Seleccionar pieza de artillería/);
});

test('mounted orders use current selection, AP, equipment, targets and callbacks after a reload',()=>{
 const props=fixture(),before=structuredClone(props.battle),{html,calls}=counted(Panel,props);
 assert.equal(calls.orderDescriptors,1);assert.equal(calls.handSlots,1);assert.equal(calls.equippedItemHelp,1);
 assert.ok(calls.medicalUsePreview>0&&calls.supplyUsePreview>0);
 assert.match(html,/Soldado 1 · 100 PA/);assert.match(html,/0 carga\(s\)/);
 let action;const tree=componentTree(Panel,{...props,onOrder:value=>{action=value;}});
 const reload=nodes(tree).find(node=>node.type==='button'&&node.props['aria-label']==='Recargar');
 assert.ok(reload);assert.equal(reload.props.disabled,false);reload.props.onClick();
 assert.deepEqual(action,{type:'reload'});
 const battle=actBattle(props.battle,{...action,unitId:props.unit.id});assert.equal(battle.lastError,null);
 const updated={...props,battle,unit:battle.units[0],players:battle.units.filter(u=>u.side==='player')};
 const after=counted(Panel,updated).html;
 assert.match(after,new RegExp(`Soldado 1 · ${updated.unit.ap} PA`));assert.match(after,/1 carga\(s\)/);
 const selected={...updated,unit:updated.players[1],selected:updated.players[1].id};
 assert.match(counted(Panel,selected).html,/Soldado 2 · 100 PA/);
 const medical={...selected,unit:{...selected.unit,activeSlot:'medical'},target:selected.players[0]};
 assert.match(counted(Panel,medical).html,/Reduce la hemorragia y estabiliza heridas críticas hasta 15 de salud/);
 assert.deepEqual(props.battle,before,'rendering and callbacks do not mutate the input battle');
 assert.deepEqual(counted(Strip,updated).calls,{},'a new closed menu does not retain optional work');
});
