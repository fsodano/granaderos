import {strategicClockControls} from './strategic-clock-render-fixture.mjs';
import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {combatMilitia,militiaCombatReturn} from './militia-combat-fixture.mjs';

test('the campaign displays earned veteran progress and pays only for new civic training',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Campaign}=await import('../web/app/Campaign.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let {s:current,id}=combatMilitia();for(let i=0;i<2;i++)current=militiaCombatReturn(current,id).s;
 function Screen(){const [s,set]=useState(current);current=s;return h(Campaign,{state:s,dispatch:a=>set(previous=>dispatchCampaign(previous,a)),onBattle(){},onOpenDesk(){}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of old)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 const clock=strategicClockControls(t,act,dom.window.document);
 await act(async()=>root.render(h(Screen)));
 const doc=dom.window.document,button=text=>{const b=[...doc.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(text));assert.ok(b,text);return b;};
 const click=async e=>{await act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const select=async(e,value)=>{Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new dom.window.Event('change',{bubbles:true})));};
 await click(button('Sector'));
 const militia=()=>doc.querySelector('.simple-militia');assert.match(militia().textContent,/2 cívicos · 0 montoneros · 1 veterano/);assert.match(militia().textContent,/Los veteranos ascienden por experiencia de combate/);assert.match(button('Entrenar milicias').textContent,/60 pesos/);
 await click(button('Personal'));const ward=doc.querySelector('[aria-label="Salud de la guarnición"]');assert.match(ward.textContent,/Veterano · 6 puntos de combate/);assert.match(ward.textContent,/44\/60 salud/);const veteranBefore=structuredClone(current.garrisons.retiro.find(u=>u.id===id)),money=current.resources.treasury;
 await click(button('Sector'));await click(button('Entrenar milicias'));assert.equal(current.lastError,null);assert.equal(current.militiaTraining[0].rank,0);assert.equal(current.resources.treasury,money-60);for(let i=0;i<200&&current.militiaTraining.length;i++)await clock.advanceHour();assert.equal(current.lastError,null);assert.equal(current.militiaTraining.length,0);assert.deepEqual(current.sectors.retiro.militia,[5,0,1]);assert.deepEqual(current.garrisons.retiro.find(u=>u.id===id),veteranBefore);const restored=decodeSave(encodeSave(current)).campaign;assert.equal(restored.garrisons.retiro.find(u=>u.id===id).militiaExperience,6);assert.equal(restored.garrisons.retiro.find(u=>u.id===id).hp,44);assert.match(militia().textContent,/5 cívicos · 0 montoneros · 1 veterano/);
});
