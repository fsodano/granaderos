import {register} from 'node:module';import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createBattle,endTurn,reloadPlan} from '../game/tactical.js';import {defaultContentPackage} from '../game/content-package.js';import {weaponMetadata} from '../game/weapon-definition.js';import {validateBattleSnapshot} from '../game/validate-battle.js';
register('./tactical-render-loader.mjs',import.meta.url);

test('the battlefield shows actual partial reload cost and remaining work through pointer, saved continuation and keyboard',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1800),id:'slow-loader',name:'Mosquete lento',reloadAP:250};let battle=createBattle([{id:'p',name:'Soldado',x:1,y:1,weapon:1800,weaponMetadata:weaponMetadata(definition),loaded:0,ammo:3}],{width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:i%12===3?'water':'grass',blocked:i%12===3,cover:0,blocksSight:false})),enemies:[{id:'guard',x:5,y:1,weapon:1813,ammo:0,patrol:false,overwatch:false}]});
 const draw=()=>root.render(h(Battlefield,{battle,onChange:next=>{battle=next;draw();},onFinish:()=>{},onRetreat:()=>{}}));
 const key=async key=>act(async()=>document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true})));
 const target=()=>document.querySelector('[data-unit-id="guard"] [data-person-hit-target]');
 const preview=()=>document.querySelector('[aria-label="Vista previa de la orden"]');
 const hover=async()=>act(async()=>target().dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true})));
 await act(async()=>draw());await key('f');await hover();assert.match(preview().textContent,/100 PA/);assert.match(preview().textContent,/Faltan 150 PA/);
 await act(async()=>target().dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));assert.equal(battle.lastError,null);assert.equal(battle.units[0].ap,0);assert.equal(battle.units[0].ammo,3);assert.equal(battle.units[0].reloadProgress,.4);
 battle=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));let turns=0;
 while(!battle.units[0].loaded){
  for(let i=0;i<8;i++){battle=endTurn(battle);assert.equal(battle.lastError,null);if(battle.phase==='player'&&!battle.interrupt)break;assert.ok(i<7,'the enemy turn must complete');}
  await act(async()=>draw());await hover();const plan=reloadPlan(battle.units[0],battle),before=battle.units[0].ap;assert.ok(plan.available>0);assert.ok(preview().textContent.includes(`${plan.pa} PA`));
  for(let i=0;i<100&&document.querySelector('.battle-phase').textContent.includes('Procesando');i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,50)));assert.doesNotMatch(document.querySelector('.battle-phase').textContent,/Procesando/);
  await key('r');assert.equal(battle.lastError,null);assert.equal(battle.units[0].ap,before-plan.pa);assert.ok(++turns<5);battle=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
 }
 assert.equal(battle.units[0].ammo,2);assert.equal(battle.units[0].loaded,1);assert.equal(battle.units[0].reloadProgress,undefined);
});
