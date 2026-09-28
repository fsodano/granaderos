import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {separatedWorkshop,returnToWorkshop,REMOTE,LOCAL} from './workshop-service-fixture.mjs';
import {saved} from './local-contract-fixture.mjs';

test('the armory shows the actual person location, blocks remote work and charges local service through its controls',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Armory}=await import('../web/app/Armory.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current=separatedWorkshop(),setCampaign;
 function Screen(){const [s,set]=useState(current);current=s;setCampaign=set;return h(Armory,{state:s,dispatch:a=>set(previous=>dispatchCampaign(previous,a))});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));const doc=dom.window.document;
 const button=text=>{const b=[...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith(text));assert.ok(b,text);return b;};
 const choose=async id=>{const e=doc.querySelector('#armory-officer');Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(e,String(id));await act(async()=>e.dispatchEvent(new dom.window.Event('change',{bubbles:true})));};
 const click=async e=>{await act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 await choose(REMOTE);assert.equal(button('Reponer provisiones').disabled,true);assert.equal(button('Reparar arma').disabled,true);assert.match(doc.querySelector('.armory-loadout').textContent,/Ubicación: Buenos Aires/);assert.match(doc.body.textContent,/mismo taller/);
 const before=current.resources.treasury;await click(button('Reponer provisiones'));assert.equal(current.resources.treasury,before);assert.equal(current.operativeState[REMOTE].priming,0);
 await choose(LOCAL);assert.equal(button('Reponer provisiones').disabled,false);assert.match(doc.querySelector('.armory-loadout').textContent,/Ubicación: Buenos Aires · Fuerte y Retiro/);await click(button('Reponer provisiones'));await click(button('Reparar arma'));assert.equal(current.lastError,null);assert.equal(current.operativeState[LOCAL].condition,100);assert.equal(current.operativeState[REMOTE].condition,40);assert.equal(button('Reponer provisiones').disabled,true);assert.equal(button('Reparar arma').disabled,true);
 await act(async()=>setCampaign(returnToWorkshop(current)));await choose(REMOTE);assert.equal(button('Reponer provisiones').disabled,false);await click(button('Reponer provisiones'));await click(button('Reparar arma'));assert.equal(current.lastError,null);const s=saved({campaign:current}).campaign;assert.equal(s.operativeState[REMOTE].condition,100);assert.equal(s.operativeState[REMOTE].priming,50);assert.ok(s.resources.treasury<before);
});
