import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,artilleryCosts,weaponFor,actionCosts} from '../game/tactical.js';
const {JA2OrdersPanel:Strip}=await import('../web/app/JA2OrdersMenu.tsx');
const field=()=>{const s=createBattle([{id:20,x:1,y:2},{id:21,x:2,y:2},{id:22,x:1,y:3}],{width:20,height:8,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:18,y:6}],artillery:[{id:'gun',type:'field8',side:'player',x:2,y:3,loaded:false,ammo:3}]});s.units[0].ap=25;return s;};
const noop=()=>{};
function props(battle,onOrder=noop){const unit=battle.units[0],players=battle.units.filter(u=>u.side==='player');return {battle,unit,selected:unit.id,players,missionAllies:[],localMilitia:[],mode:'move',showSight:false,aim:0,hitLocation:'torso',costs:actionCosts(battle,unit),weapon:weaponFor(unit),firearm:true,cannonId:'gun',shotType:'solid',gunCosts:artilleryCosts(battle,unit,battle.artillery[0]),artillery:battle.artillery,busy:false,inventoryId:null,vw:1000,vh:600,cameraRect:{x:0,y:0,width:1000,height:600},project:(x,y)=>({x:x*20,y:y*15}),cameraX:0,cameraY:0,zoom:1,onSelect:noop,onOrder,onMode:noop,onToggleSight:noop,onEndTurn:noop,onRetreat:noop,onOpenInventory:noop,onCloseInventory:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCannonChange:noop,onShotTypeChange:noop,onSetAim:noop,onHitLocationChange:noop};}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
test('the production artillery strip shows partial work, per-person costs and the confirmed real reload',()=>{
 const s=field();let action;const tree=componentTree(Strip,props(s,a=>action=a));const button=nodes(tree).find(n=>n.type==='button'&&render(n).includes('Recargar pieza'));assert.ok(button);assert.equal(button.props.disabled,false);button.props.onClick();
 assert.deepEqual(action,{type:'artilleryReload',artilleryId:'gun'});let html=render(h(Strip,props(s)));assert.match(html,/6,25 PA por artillero ahora; faltan 12,5 PA por artillero/);
 const next=actBattle(s,{unitId:'20',...action});assert.equal(next.lastError,null);html=render(h(Strip,props(next)));assert.match(html,/recarga 33%/);assert.match(html,/0,25 PA cada uno/);assert.equal(next.artillery[0].ammo,3);
});
test('the production reload button is disabled when a required crew member cannot act',()=>{
 const s=field();s.units[1].ap=0;const tree=componentTree(Strip,props(s));const button=nodes(tree).find(n=>n.type==='button'&&render(n).includes('Recargar pieza'));assert.equal(button.props.disabled,true);
 const html=render(h(Strip,props(s)));assert.match(html,/La pieza necesita 3 artilleros/);
});


test('the artillery reload control explains that prone crew must rise',()=>{
 const s=field();s.units[1].stance='prone';
 const tree=componentTree(Strip,props(s));
 const button=nodes(tree).find(n=>n.type==='button'&&render(n).includes('Recargar pieza'));
 assert.equal(button.props.disabled,true);
 assert.match(render(h(Strip,props(s))),/de pie o agachados/);
});
