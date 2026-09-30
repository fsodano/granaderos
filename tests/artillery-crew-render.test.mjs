import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {crewField} from './artillery-crew-fixture.mjs';
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
 const menu=doc.querySelector('.ja2-artillery-menu');assert.ok(menu);assert.equal(menu.open,false);assert.equal(doc.querySelector('.ja2-artillery'),null);
 await act(async()=>{menu.querySelector('summary').click();await new Promise(resolve=>setTimeout(resolve,0));});
 const select=doc.querySelector('select[aria-label="Seleccionar pieza de artillería"]');assert.ok(select);Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(select,'gun');await act(async()=>select.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
 return {doc,read:()=>current,click,button:()=>[...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Recargar pieza'))};
}
test('mounted field controls show partial cost and saved work, then finish through the real next-turn reload',async t=>{
 const b=crewField();b.units[0].ap=25;const m=await mount(t,b);assert.equal(m.button().disabled,false);assert.match(m.button().textContent,/25 PA/);assert.match(m.doc.querySelector('.ja2-artillery').textContent,/25 PA por artillero ahora; faltan 50 PA por artillero/);
 await m.click(m.button());assert.equal(m.read().lastError,null);assert.equal(m.read().artillery[0].reloadProgress,1/3);assert.equal(m.read().artillery[0].ammo,3);assert.match(m.doc.querySelector('.ja2-artillery').textContent,/recarga 33%/);assert.equal(m.button().disabled,true);assert.ok(validateBattleSnapshot(m.read()));
 await m.click(m.doc.querySelector('.ja2-essential .gold-button'));await act(async()=>new Promise(resolve=>setTimeout(resolve,500)));assert.equal(m.button().disabled,false);assert.match(m.button().textContent,/50 PA/);await m.click(m.button());assert.equal(m.read().artillery[0].loaded,true);assert.equal(m.read().artillery[0].ammo,2);assert.equal(m.read().artillery[0].reloadProgress,undefined);assert.equal(m.button().disabled,true);
});
test('mounted artillery controls refuse a prone helper and keep the actual crew and cannon unchanged',async t=>{
 const b=crewField();b.units[1].stance='prone';const m=await mount(t,b);assert.equal(m.button().disabled,true);assert.match(m.doc.querySelector('.ja2-artillery').textContent,/de pie o agachados/);await m.click(m.button());assert.deepEqual(m.read(),b);
});
