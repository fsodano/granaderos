import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {createBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {battleTimers} from './battle-timers-fixture.mjs';

test('mounted field controls apply partial care by mouse and keyboard without granting health beyond stabilization',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const timers=battleTimers(act),root=createRoot(dom.window.document.getElementById('root'));
 // Prepared injury and compact geometry isolate the actual controls. This is
 // not a fresh battle route or a browser rendering/performance measurement.
 let current=createBattle([{id:'doc',name:'Sanitario',x:1,y:1,medical:60,dexterity:75,experienceLevel:4,medkits:2},{id:'patient',name:'Herido',x:2,y:1,maxHp:100,hp:1,bleeding:10,bandaged:0}],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}]});current.units[0].ap=100;
 function Screen(){const [s,set]=useState(current);current=s;return h(Battlefield,{battle:s,onChange:set,onFinish(){},onRetreat(){}});}
 t.after(async()=>{await act(async()=>root.unmount());timers.restore();dom.window.close();for(const [key,descriptor]of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));const doc=dom.window.document;
 assert.equal(current.units[1].unconscious,true);assert.equal(current.units[1].ap,0);assert.ok(doc.querySelectorAll('.ja2-portrait-cell[aria-disabled="true"]').length>0);
 const click=async e=>{assert.ok(e);await act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await timers.settle(doc);};
 await act(async()=>doc.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'q',bubbles:true})));assert.equal(current.units[0].activeSlot,'medical');assert.equal(current.units[0].ap,96,'equipping the dressings spends four AP');await click(doc.querySelector('[data-unit-id="patient"] [data-person-hit-target]'));
 assert.equal(current.lastError,null);assert.equal(current.units[1].hp,9);assert.equal(current.units[1].unconscious,true);assert.equal(current.units[1].ap,0);assert.equal(current.units[0].medkits,1);assert.equal(current.units[0].ap,71);assert.match(current.log.join(' '),/necesita más primeros auxilios/);assert.ok(validateBattleSnapshot(current));
 await act(async()=>doc.querySelector('[data-unit-id="patient"] [data-person-hit-target]').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));await timers.settle(doc);
 assert.equal(current.lastError,null);assert.equal(current.units[1].hp,15);assert.equal(current.units[1].bleeding,0);assert.equal(current.units[1].unconscious,false);assert.equal(current.units[1].ap,0);assert.equal(current.units[0].medkits,0);assert.equal(current.units[0].ap,46);assert.match(current.log.join(' '),/recuperación restante requiere descanso y atención médica/);
 const before=structuredClone(current.units);await click(doc.querySelector('[data-unit-id="patient"] [data-person-hit-target]'));assert.match(current.lastError,/vendas/);assert.deepEqual(current.units,before);assert.ok(validateBattleSnapshot(current));
});
