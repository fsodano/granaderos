import {formatAP} from '../game/action-points.js';
import {register} from 'node:module';import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createBattle,endTurn,reloadPlan} from '../game/tactical.js';import {defaultContentPackage} from '../game/content-package.js';import {weaponMetadata} from '../game/weapon-definition.js';import {validateBattleSnapshot} from '../game/validate-battle.js';
import {battleTimers} from './battle-timers-fixture.mjs';
register('./tactical-render-loader.mjs',import.meta.url);

test('the battlefield shows actual partial reload cost and remaining work through pointer, saved continuation and keyboard',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 // Motion starts and rAF callbacks must use the same clock. JSDOM's window
 // clock has a different origin from Node's global performance clock.
 let motionTime=1000,frameId=0;const frames=new Map();
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,ResizeObserver:class{observe(){}disconnect(){}},performance:{now:()=>motionTime},requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:id=>frames.delete(id),IS_REACT_ACT_ENVIRONMENT:true};const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js'),timers=battleTimers(act),root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{timers.restore();dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1800),id:'slow-loader',name:'Mosquete lento',reloadAP:250};let battle=createBattle([{id:'p',name:'Soldado',x:1,y:1,weapon:1800,weaponMetadata:weaponMetadata(definition),loaded:0,ammo:3}],{width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:i%12===3?'water':'grass',blocked:i%12===3,cover:0,blocksSight:false})),enemies:[{id:'guard',x:5,y:1,weapon:1813,ammo:0,patrol:false,overwatch:false}]});
 const draw=()=>root.render(h(Battlefield,{battle,onChange:next=>{battle=next;draw();},onFinish:()=>{},onRetreat:()=>{}}));
 const key=async(key,extra={})=>{await act(async()=>document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,...extra})));await timers.settle(document);};
 const target=()=>document.querySelector('[data-unit-id="guard"] [data-person-hit-target]');
 const preview=()=>document.querySelector('[aria-label="Vista previa de la orden"]');
 const hover=async()=>act(async()=>target().dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true})));
 await act(async()=>draw());await key('f');await hover();assert.match(preview().textContent,/25 PA/);assert.match(preview().textContent,/Faltan 37,5 PA/);
 await act(async()=>target().dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await timers.settle(document);assert.equal(battle.lastError,null);assert.equal(battle.units[0].ap,0);assert.equal(battle.units[0].ammo,3);assert.equal(battle.units[0].reloadProgress,.4);
 const storedWork=()=>document.querySelector('.ja2-roster-hand[data-hand-side="right"]');
 assert.match(storedWork().title,/Recarga en curso: 40% del próximo cartucho/);assert.match(storedWork().textContent,/0 ·40%/);
 battle=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));await act(async()=>draw());assert.match(storedWork().title,/Recarga en curso: 40% del próximo cartucho/);let turns=0;
 while(!battle.units[0].loaded){
  for(let i=0;i<8;i++){battle=endTurn(battle);assert.equal(battle.lastError,null);if(battle.phase==='player'&&!battle.interrupt)break;assert.ok(i<7,'the enemy turn must complete');}
  await act(async()=>draw());for(let frame=0;/Procesando/.test(document.querySelector('.battle-phase').textContent);frame++){assert.ok(frame<2000,'real movement animation must settle');assert.ok(frames.size,'busy motion must have a live animation callback');motionTime+=20;const callbacks=[...frames.values()];frames.clear();await act(async()=>{for(const callback of callbacks)callback(motionTime);});}await hover();const plan=reloadPlan(battle.units[0],battle),before=battle.units[0].ap;assert.ok(plan.available>0);assert.ok(preview().textContent.includes(`${formatAP(plan.pa)} PA`));
  assert.doesNotMatch(document.querySelector('.battle-phase').textContent,/Procesando/);
  await key('R',{shiftKey:true});assert.equal(battle.lastError,null);assert.equal(battle.units[0].ap,before-plan.pa);assert.ok(++turns<5);battle=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
 }
 assert.equal(battle.units[0].ammo,2);assert.equal(battle.units[0].loaded,1);assert.equal(battle.units[0].reloadProgress,undefined);
 await act(async()=>draw());assert.doesNotMatch(storedWork().title,/Recarga en curso/);assert.equal(storedWork().querySelector('.roster-hand-load').textContent,'1');
});
