import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {woundedGarrison,MILITIA_DOCTOR as D} from './militia-care-fixture.mjs';

test('the campaign screen assigns militia care, displays actual wounds, spends dressings and restores deployment after care',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Campaign}=await import('../web/app/Campaign.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));const prepared=woundedGarrison();let current=prepared.campaign;const id=prepared.patientId,hp=current.garrisons.retiro.find(u=>u.id===id).hp;
 function Screen(){const [s,set]=useState(current);current=s;return h(Campaign,{state:s,dispatch:a=>set(previous=>dispatchCampaign(previous,a)),onBattle(){},onOpenDesk(){}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));
 const doc=dom.window.document,button=text=>{const b=[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,text);return b;};
 const click=async e=>{await act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const input=async(e,value)=>{const proto=e.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));};
 await click(button('Organizar escuadras'));const row=()=>doc.querySelector(`[data-care-id="${D}"]`),ward=()=>doc.querySelector('[aria-label="Salud de la guarnición"]');assert.ok(ward());assert.match(ward().textContent,new RegExp(`${hp}/60 salud`));
 await input(row().querySelector('select'),'militia_doctor');assert.equal(current.lastError,null);assert.equal(current.operativeState[D].assignment,'militia_doctor');assert.match(row().textContent,/1 miliciano herido/);assert.equal([...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Entrar al sector ·')).disabled,true);
 await click(button('Avanzar'));assert.equal(current.garrisons.retiro.find(u=>u.id===id).hp,hp);assert.equal(current.garrisons.retiro.find(u=>u.id===id).bleeding,0);assert.equal(current.operativeState[D].medkits,1);assert.match(ward().textContent,new RegExp(`${hp}/60 salud · 0 hemorragia`));
 await click(button('Avanzar'));assert.equal(current.garrisons.retiro.find(u=>u.id===id).hp,hp+6);assert.equal(current.operativeState[D].medkits,0);assert.match(row().textContent,/no tiene vendas/);
 const money=current.resources.treasury;await input(row().querySelector('input'),'4');await click(row().querySelector('button'));assert.equal(current.resources.treasury,money-40);assert.equal(current.operativeState[D].medkits,4);await click(button('Avanzar'));assert.equal(current.garrisons.retiro.find(u=>u.id===id).hp,hp+12);
 const restored=decodeSave(encodeSave(current)).campaign;assert.equal(restored.garrisons.retiro.find(u=>u.id===id).hp,hp+12);assert.equal(restored.operativeState[D].assignment,'militia_doctor');assert.equal(restored.operativeState[D].medkits,3);
 await input(row().querySelector('select'),'active');assert.equal(current.lastError,null);assert.equal([...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Entrar al sector ·')).disabled,false);
});
