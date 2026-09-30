import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';import {dispatchCampaign} from '../game/campaign.js';import {battleFromRequest} from '../game/battle-handoff.js';
import {tacticalViewport,pointInViewport,buildingInViewport} from '../game/tactical-viewport.js';
import {inventoryUsage,planPocketMove,pocketMergeCount} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const {default:Roster}=await import('../web/app/JA2Roster.tsx');const {default:Minimap}=await import('../web/app/TacticalMinimap.tsx');
const noop=()=>{};const project=(x,y)=>({x:800+(x-y)*26,y:(x+y)*14});
const descendants=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(descendants)];
test('peaceful Retiro entry and movement with zero AP use energy without changing AP',()=>{
 const campaign=dispatchCampaign(initialCampaign(),{type:'visitSector'});let b=battleFromRequest(campaign.pendingBattle,campaign);assert.equal(b.mode,'exploration');
 const u=b.units[0];u.ap=0;const route=getReachable(b,u).find(p=>p.path.length===7);assert.ok(route);const original=structuredClone(b);
 b=actBattle(b,{type:'move',unitId:u.id,x:route.x,y:route.y});assert.equal(b.lastError,null);const moved=b.units.find(v=>v.id===u.id);assert.equal(moved.ap,0);assert.ok(moved.energy<u.energy);assert.equal(b.mode,'exploration');assert.doesNotMatch(b.log.at(-1),/PA/);assert.equal(original.units[0].energy,u.energy);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('six portraits stay visible and selecting a later merc opens that page',()=>{
 const b=createBattle(Array.from({length:9},(_,i)=>({id:`merc-${i}`,name:`Soldado ${i}`,x:1,y:i+1})),{width:20,height:20,exploration:true,enemies:[]});
 const html=render(h(Roster,{battle:b,players:b.units,selected:'merc-7',onSelect:noop,onOpenInventory:noop}));assert.equal((html.match(/class="ja2-portrait-cell /g)||[]).length,3);assert.equal((html.match(/empty-portrait-slot/g)||[]).length,3);assert.match(html,/Soldado 7/);assert.doesNotMatch(html,/Soldado 0|puntos de acción|\d+ PA/);assert.match(html,/Combatientes anteriores/);
});
test('right-click inspects a merc who cannot act while left-click cannot order them',()=>{
 const b=createBattle([{id:'p',name:'Herido',x:1,y:1}],{width:8,height:8,exploration:true,enemies:[]});b.units[0].unconscious=true;let inspected,selected;
 const tree=componentTree(Roster,{battle:b,players:b.units,selected:'p',onSelect:id=>selected=id,onOpenInventory:id=>inspected=id});const cell=descendants(tree).find(n=>n.props?.role==='listitem');assert.equal(cell.props.disabled,undefined);cell.props.onContextMenu({preventDefault(){}});assert.equal(inspected,'p');cell.props.onClick({shiftKey:false});assert.equal(selected,undefined);
});
test('minimap batches ground without losing any tile or visible unit',()=>{
 const b=createBattle([{id:'p',x:1,y:1}],{width:32,height:32,exploration:true,enemies:[]});const html=render(h(Minimap,{state:b,units:b.units,selected:'p',project,width:1700,height:1000,camera:{x:0,y:0,width:300,height:200},onCenter:noop}));assert.ok((html.match(/<path/g)||[]).length<=12);assert.equal((html.match(/l26,14-26,14-26,-14Z/g)||[]).length,b.tiles.length);assert.match(html,/<circle/);
});
test('camera overscan is bounded and includes objects crossing the edge',()=>{
 const v=tacticalViewport({x:100,y:100,width:600,height:250});assert.ok(v.width<=600+240+256);assert.ok(v.height<=250+240+256);assert.equal(pointInViewport(v,{x:v.x-20,y:v.y+1},26),true);assert.equal(pointInViewport(v,{x:v.x-40,y:v.y+1},26),false);assert.equal(pointInViewport(undefined,{x:9000,y:9000}),true);
 assert.equal(buildingInViewport({x:30,y:-120,width:50,height:50},{x:0,y:0,width:4,height:4},(x,y)=>({x:x*26,y:y*14})),true);assert.equal(buildingInViewport({x:9000,y:9000,width:50,height:50},{x:0,y:0,width:4,height:4},project),false);
});
test('matching loose objects combine up to pocket capacity and retain all quantities',()=>{
 const unit={inventory:{a:{name:'Tela',count:3,weight:.2,condition:80},b:{name:'Tela',count:2,weight:.2,condition:80}},activeSlot:'unarmed'};
 const layout=inventoryUsage(unit),a=layout.slots.find(s=>s.entry?.item==='inventory:a'),b=layout.slots.find(s=>s.entry?.item==='inventory:b');assert.equal(pocketMergeCount(unit,a.id,b.id),2);const next=planPocketMove(unit,a.id,b.id);assert.equal(next.inventory.a.count,1);assert.equal(next.inventory.b.count,4);assert.equal(next.inventory.b.condition,80);assert.equal(unit.inventory.a.count,3);
 const changed=structuredClone(unit);changed.inventory.b.condition=70;assert.equal(pocketMergeCount(changed,a.id,b.id),0);assert.deepEqual(planPocketMove(changed,a.id,b.id).inventory,changed.inventory);
 const identified=structuredClone(unit);identified.inventory.a.instanceId='quest-cloth';identified.inventory.a.count=1;assert.equal(pocketMergeCount(identified,a.id,b.id),0);
});

test('combining consumes the source record and keeps the destination pocket through the reducer',()=>{
 let b=createBattle([{id:'p',x:1,y:1,inventory:{a:{name:'Tela',weight:.2,count:1},b:{name:'Tela',weight:.2,count:2}}}],{width:8,height:8,exploration:true,enemies:[]});
 const u=b.units[0];u.ap=0;const layout=inventoryUsage(u),a=layout.slots.find(s=>s.entry?.item==='inventory:a'),target=layout.slots.find(s=>s.entry?.item==='inventory:b');
 b=actBattle(b,{type:'movePocket',unitId:'p',sourceId:a.id,destinationId:target.id});assert.equal(b.lastError,null);const after=b.units[0];assert.equal(after.ap,0);assert.equal(after.inventory.a,undefined);assert.equal(after.inventory.b.count,3);assert.equal(inventoryUsage(after).slots.find(s=>s.id===target.id).entry.item,'inventory:b');assert.doesNotThrow(()=>validateBattleSnapshot(b));
});

test('exploration equipment labels and bayonet operations do not claim a paid AP cost',async()=>{
 const {default:Inventory}=await import('../web/app/JA2Inventory.tsx');
 let b=createBattle([{id:'p',x:1,y:1,weapon:1800,blade:1811,bladeFittingPattern:'india_socket',bladeInstanceId:'free-fitting',bladeCondition:73}],{width:8,height:8,exploration:true,enemies:[]});b.units[0].ap=0;
 const html=render(h(Inventory,{battle:b,unit:b.units[0],units:b.units,missionAllies:[],localMilitia:[],selected:'p',project,vw:1000,vh:700,cameraRect:{x:0,y:0,width:500,height:300},zoom:1,onCloseInventory:noop}));
 assert.match(html,/Soltar aquí · sin PA/);assert.match(html,/Fijar al Brown Bess · sin PA/);assert.doesNotMatch(html,/Puntos de acción|Movimiento sin coste de PA/);
 b=actBattle(b,{type:'fitBayonet',unitId:'p',item:'blade'});assert.equal(b.lastError,null);assert.equal(b.units[0].ap,0);assert.equal(b.units[0].weaponFittings.bayonet.condition,73);assert.doesNotMatch(b.log.at(-1),/PA/);
});
