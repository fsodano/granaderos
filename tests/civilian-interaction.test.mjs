import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createBattle} from '../game/tactical.js';
register('./tactical-render-loader.mjs',import.meta.url);

test('the actual battlefield routes NPC clicks and keyboard selection through attack and medical orders',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx');const {createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 let battle=createBattle([{id:'doctor',name:'Médico',x:1,y:1,weapon:1809,medkits:2}],{width:8,height:8,exploration:true,enemies:[],npcs:[{id:'resident',name:'Vecino',x:2,y:1,operativeId:2000,recruitable:false}]});
 let conversations=0;
 const draw=()=>root.render(h(Battlefield,{battle,onChange:next=>{battle=next;draw();},onFinish:()=>{},onRetreat:()=>{},onTalk:()=>conversations++}));
 const click=async selector=>{const node=document.querySelector(selector);assert.ok(node,selector);await act(async()=>node.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 await act(async()=>draw());await click('[aria-label="Atacar"]');await click('[data-unit-id="resident"]');assert.equal(battle.lastError,null);assert.ok(battle.npcs[0].hp<100);assert.ok(battle.npcs[0].bleeding>0);assert.equal(conversations,0);assert.equal(document.querySelector('[aria-label="Conversación"]'),null);
 await click('[aria-label="Vendar"]');const patient=document.querySelector('[data-unit-id="resident"]');assert.match(patient.getAttribute('aria-label'),/Atender a/);await act(async()=>patient.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 assert.equal(battle.lastError,null);assert.equal(battle.npcs[0].bleeding,0);assert.equal(battle.units[0].medkits,1);assert.ok(battle.npcs[0].hp<100);assert.equal(conversations,0);
 await act(async()=>document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'g',bubbles:true})));await click('[data-unit-id="resident"]');assert.ok(document.querySelector('[aria-label="Conversación"]'));
 assert.ok(![...document.querySelectorAll('[aria-label="Conversación"] button')].some(b=>b.textContent==='Proponer incorporación'));
 battle={...battle,npcs:battle.npcs.map(n=>({...n,recruitable:true}))};await act(async()=>draw());
 const recruit=[...document.querySelectorAll('[aria-label="Conversación"] button')].find(b=>b.textContent==='Proponer incorporación');assert.ok(recruit);await act(async()=>recruit.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));assert.equal(conversations,1);
 // A stale open dialogue closes as soon as the actual physical state changes.
 battle={...battle,npcs:battle.npcs.map(n=>({...n,hp:0,unconscious:false,bleeding:0}))};await act(async()=>draw());assert.equal(document.querySelector('[aria-label="Conversación"]'),null);
 assert.match(document.querySelector('[data-unit-id="resident"]').getAttribute('aria-label'),/Muerto/);assert.equal(document.querySelector('[data-unit-id="resident"]').getAttribute('data-posture'),'dead');await click('[data-unit-id="resident"]');assert.equal(document.querySelector('[aria-label="Conversación"]'),null);
});


test('the actual battlefield collects finite resident supplies with pointer and keyboard without opening dialogue',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx');const {createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});

 let battle=createBattle([{id:'doctor',name:'Médico',x:1,y:1,medkits:0}],{width:8,height:8,exploration:true,enemies:[],npcs:[{id:'resident',name:'Vecina',x:2,y:1,hp:1,energy:100,civilianSupplies:{version:1,priming:0,flints:0,rations:0,torches:0,medkits:3,boleadoras:0}}]});
 let conversations=0;const draw=()=>root.render(h(Battlefield,{battle,onChange:next=>{battle=next;draw();},onFinish:()=>{},onRetreat:()=>{},onTalk:()=>conversations++}));
 const click=async selector=>{const node=document.querySelector(selector);assert.ok(node,selector);await act(async()=>node.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 await act(async()=>draw());await click('[aria-label="Recoger equipo"]');assert.match(document.querySelector('[data-unit-id="resident"]').getAttribute('aria-label'),/Recoger equipo de/);await click('[data-unit-id="resident"]');assert.equal(battle.lastError,null);assert.equal(battle.units[0].medkits,3);assert.equal(battle.npcs[0].civilianSupplies.medkits,0);assert.ok(battle.log.some(line=>line.includes('3 vendas')));assert.equal(conversations,0);assert.equal(document.querySelector('[aria-label="Conversación"]'),null);
 await act(async()=>document.querySelector('[data-unit-id="resident"]').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.ok(battle.lastError);assert.equal(battle.units[0].medkits,3);assert.equal(battle.npcs[0].civilianSupplies.medkits,0);assert.equal(conversations,0);
});
