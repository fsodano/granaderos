import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {artilleryField} from './artillery-autonomy-fixture.mjs';
import {validateBattleSnapshot} from '../game/validate-battle.js';
async function mount(t,battle){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current=battle;
 function Screen(){const [s,set]=useState(current);current=s;return h(Battlefield,{battle:s,onChange:set,onFinish(){},onRetreat(){}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));const doc=dom.window.document;
 const click=async element=>{assert.ok(element);await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const nextTurn=async()=>{const before=current;await click([...doc.querySelectorAll('button')].find(b=>b.textContent==='Fin del turno'));const deadline=Date.now()+10000;while(current===before&&Date.now()<deadline)await act(async()=>new Promise(resolve=>setTimeout(resolve,20)));assert.notEqual(current,before,'the visible turn must finish and commit');};
 return {doc,read:()=>current,click,nextTurn};
}

test('mounted end-turn control advances a heavy enemy reload across saved real budgets',async t=>{
 const b=artilleryField({loaded:false,hidden:true,crew:{fatigue:90}}),budget=b.units.find(u=>u.side==='enemy').ap,m=await mount(t,b);
 await m.nextTurn();
 assert.equal(m.read().lastError,null);assert.equal(m.read().artillery[0].reloadProgress,budget/75);assert.equal(m.read().artillery[0].ammo,2);assert.ok(m.read().units.filter(u=>u.side==='enemy').every(u=>u.ap===0));assert.ok(validateBattleSnapshot(JSON.parse(JSON.stringify(m.read()))));
 await m.nextTurn();
 assert.equal(m.read().artillery[0].loaded,true);assert.equal(m.read().artillery[0].ammo,1);assert.equal(m.read().artillery[0].reloadProgress,undefined);assert.ok(m.read().units.filter(u=>u.side==='enemy').every(u=>u.ap===2*budget-75));assert.ok(!m.read().log.some(line=>line.includes('completa la recarga')),'an unseen enemy reload must not disclose its progress');
});
test('mounted allied turn shows actual autonomous artillery damage without manual militia orders',async t=>{
 const b=artilleryField({side:'player',type:'swivel',ammo:0}),m=await mount(t,b),officer=b.units.find(u=>u.id==='officer');
 await m.nextTurn();
 assert.equal(m.read().lastError,null);assert.equal(m.read().artillery[0].loaded,false);assert.equal(m.read().artillery[0].ammo,0);assert.ok(m.read().units.find(u=>u.id==='target').hp<300);assert.equal(m.read().units.find(u=>u.id==='officer').hp,officer.hp);assert.ok(m.read().log.some(line=>line.includes('dispara una bala rasa')));assert.ok(validateBattleSnapshot(m.read()));
});
