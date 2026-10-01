import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {preparedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';

test('the actual campaign screen assigns a doctor and patient, advances treatment, buys finite dressings and rests the doctor',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Campaign}=await import('../web/app/Campaign.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current=preparedCare();
 function Screen(){const [s,set]=useState(current);current=s;return h(Campaign,{state:s,dispatch:a=>set(previous=>dispatchCampaign(previous,a)),onBattle(){},onOpenDesk(){}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));
 const doc=dom.window.document,button=text=>{const b=[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,text);return b;};
 const click=async e=>{await act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const input=async(e,value)=>{const proto=e.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));};
 await click(button('Personal'));assert.ok(doc.querySelector('[aria-label="Atención médica en campaña"]'));
 const row=id=>doc.querySelector(`[data-care-id="${id}"]`);await input(row(DOCTOR).querySelector('select'),'doctor');await input(row(PATIENT).querySelector('select'),'patient');assert.equal(current.lastError,null);assert.equal(current.operativeState[DOCTOR].assignment,'doctor');await click(button('Sector'));assert.equal([...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Entrar al sector ·')).disabled,true);await click(button('Personal'));
 assert.equal(row(PATIENT).querySelector('option[value="doctor"]').disabled,true);assert.match(row(PATIENT).textContent,/En atención con/);
 const hp=current.operativeState[PATIENT].hp;await click(button('Avanzar'));assert.equal(current.operativeState[PATIENT].hp,hp);assert.equal(current.operativeState[PATIENT].bleeding,0);await click(button('Avanzar'));assert.equal(current.operativeState[PATIENT].hp,hp+6);
 const money=current.resources.treasury;await input(row(DOCTOR).querySelector('input'),'4');await click(row(DOCTOR).querySelector('.care-supplies button'));assert.equal(current.lastError,null);assert.equal(current.resources.treasury,money-40);assert.equal(current.operativeState[DOCTOR].medkits,6);
 await input(row(DOCTOR).querySelector('input'),'21');assert.equal(row(DOCTOR).querySelector('.care-supplies button').disabled,true);assert.match(row(DOCTOR).textContent,/entre 1 y 20/);
 await input(row(DOCTOR).querySelector('select'),'rest');assert.equal(current.operativeState[DOCTOR].energy,94);await click(button('Sector'));assert.equal([...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Entrar al sector ·')).disabled,true);await click(button('Personal'));
 const restHour=current.hour;await click(button('Avanzar'));if(current.hour===restHour){assert.ok(doc.querySelector('[aria-label="Avance detenido por asignaciones"]'));await click(button('Avanzar'));}assert.equal(current.hour,restHour+1);assert.equal(current.operativeState[DOCTOR].energy,100);assert.equal(current.operativeState[DOCTOR].fatigue,0);assert.equal(current.operativeState[DOCTOR].medkits,6);assert.equal(current.operativeState[DOCTOR].assignment,'rest');assert.equal(row(DOCTOR).querySelector('meter[aria-label^="Energía"]').value,100);assert.match(row(DOCTOR).textContent,/Fatiga 0/);
 const rested=decodeSave(encodeSave(current)).campaign;assert.equal(rested.operativeState[DOCTOR].assignment,'rest');assert.equal(rested.operativeState[DOCTOR].energy,100);
 await input(row(DOCTOR).querySelector('select'),'doctor');
 const restored=decodeSave(encodeSave(current)).campaign;assert.equal(restored.operativeState[PATIENT].hp,hp+6);assert.equal(restored.operativeState[DOCTOR].medkits,6);assert.equal(restored.operativeState[DOCTOR].assignment,'doctor');
});
