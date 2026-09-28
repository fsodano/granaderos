import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {woundedGarrison,MILITIA_DOCTOR as D} from './militia-care-fixture.mjs';

test('the campaign blocks an unstable promotion, displays its real trainees and cancels without healing or replacing them',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Campaign}=await import('../web/app/Campaign.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));const prepared=woundedGarrison();let current=prepared.campaign;
 function Screen(){const [s,set]=useState(current);current=s;return h(Campaign,{state:s,dispatch:a=>set(previous=>dispatchCampaign(previous,a)),onBattle(){},onOpenDesk(){}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));
 const doc=dom.window.document,button=text=>{const b=[...doc.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(text));assert.ok(b,text);return b;};
 const click=async e=>{await act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const select=async(e,value)=>{Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new dom.window.Event('change',{bubbles:true})));};
 assert.equal(button('Entrenar milicias').disabled,true);assert.match(doc.querySelector('.simple-militia').textContent,/Disponibles: 2/);
 await click(button('Organizar escuadras'));const doctor=()=>doc.querySelector(`[data-care-id="${D}"] select`);await select(doctor(),'militia_doctor');await click(button('Avanzar'));assert.equal(button('Entrenar milicias').disabled,true,'bleeding stopped but the soldier is still critical');await click(button('Avanzar'));assert.equal(button('Entrenar milicias').disabled,false);
 await select(doctor(),'active');const before=structuredClone(current.garrisons.retiro),money=current.resources.treasury;await click(button('Entrenar milicias'));assert.equal(current.lastError,null);assert.equal(current.resources.treasury,money-120);assert.equal(current.garrisons.retiro.length,0);const list=doc.querySelector('[aria-label="Milicianos en instrucción"]');assert.equal(list.querySelectorAll('li').length,3);assert.match(list.textContent,/19\/60 salud/);assert.deepEqual(decodeSave(encodeSave(current)).campaign.militiaTraining[0].trainees,before);
 await click(button('Suspender instrucción'));assert.equal(current.lastError,null);assert.deepEqual(current.garrisons.retiro,before);assert.equal(current.resources.treasury,money-120);assert.equal(doc.querySelector('[aria-label="Milicianos en instrucción"]'),null);assert.match(doc.querySelector('.simple-militia').textContent,/conservan su salud, armas y suministros/);assert.deepEqual(decodeSave(encodeSave(current)).campaign.garrisons.retiro,before);
});
