import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {defaultContentPackage,parseContentPackage} from '../game/content-package.js';
import {CONTENT_LAUNCH_KEY} from '../game/content-launch.js';
import {decodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
const draftKey='granaderos.content-draft.v1';

async function mounted(t){
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>{if(!error.message.includes('navigation'))throw error;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test/story',pretendToBeVisual:true,virtualConsole});dom.window.scrollTo=()=>{};
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const document=dom.window.document;
 return {dom,document,async render(Component,props={}){await act(async()=>root.render(h(Component,props)));},
  button(text){const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(button,text);return button;},
  label(text){const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(label,text);return label.querySelector('input,select,textarea');},
  async click(element){await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async input(element,value){const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,String(value));await act(async()=>element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})));},
 };
}

test('normal editor inputs, launch and hiring controls fund the quoted guarantee and preserve its ID through renewal',async t=>{
 const m=await mounted(t),{default:StoryEditor}=await import('../web/app/story/page.tsx');await m.render(StoryEditor);
 const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(m.label('Garantía de servicio (pesos)').value,'0');
 await m.input(m.label('Garantía de servicio (pesos)'),100);assert.equal(draft().characters.find(c=>c.id==='person-100').serviceGuarantee,100);assert.match(m.document.body.textContent,/un día: paga 36 \+ garantía 100 = 136 pesos/);
 await m.click(m.button('Deshacer'));assert.equal(draft().characters.find(c=>c.id==='person-100').serviceGuarantee??0,0);await m.click(m.button('Rehacer'));assert.equal(draft().characters.find(c=>c.id==='person-100').serviceGuarantee,100);
 await m.input(m.label('Tiempo de viaje (horas)'),0);await m.click(m.button('Iniciar campaña con estas fichas'));let campaign=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 assert.equal(rosterFor(campaign).find(o=>o.id===100).serviceGuarantee,100);assert.equal(campaign.serviceGuarantees,undefined);
 const {default:Recruitment}=await import('../web/app/Recruitment.tsx');const sent=[];
 function Hiring(){const [state,setState]=useState(campaign);campaign=state;return h(Recruitment,{state,dispatch:action=>{sent.push(action);setState(s=>dispatchCampaign(s,action));}});}
 await m.render(Hiring);await m.input(m.document.querySelector('input[type="search"]'),'Rafael Sosa');assert.match(m.document.body.textContent,/Paga: 36 pesos · Garantía a financiar: 100 pesos · Total: 136 pesos/);
 await m.click(m.button('Contratar · 136 pesos'));assert.equal(campaign.resources.treasury,3064);const id=campaign.contracts[100].guaranteeId;assert.equal(id,'guarantee-1');assert.match(m.document.body.textContent,/Garantía retenida: 100 pesos/);
 await m.click(m.button('Renovar · 36 pesos'));assert.equal(campaign.resources.treasury,3028);assert.equal(campaign.contracts[100].guaranteeId,id);assert.equal(sent.at(-1).expectedGuaranteeId,id);assert.equal(campaign.serviceGuarantees.nextId,2);
 const {default:Personnel}=await import('../web/app/StrategicPersonnelMenu.tsx');let dismissal;await m.render(Personnel,{state:campaign,roster:rosterFor(campaign),id:100,kind:'contract',onClose:()=>{},dispatch:action=>dismissal=action});assert.match(m.document.body.textContent,/Devolución actual al salir: 100 pesos/);await m.click(m.button('Despedir'));assert.deepEqual(dismissal,{type:'dismiss',id:100,expectedGuaranteeId:id});
 campaign=dispatchCampaign(campaign,dismissal);assert.equal(campaign.resources.treasury,3128);assert.equal(campaign.serviceGuarantees.entries[id].state,'departed');
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:100,term:'day'});const afterRehire=structuredClone(campaign);assert.equal(campaign.contracts[100].guaranteeId,'guarantee-2');campaign=dispatchCampaign(campaign,dismissal);assert.ok(campaign.lastError);delete campaign.lastError;delete afterRehire.lastError;assert.deepEqual(campaign,afterRehire);
});

test('unconfigured price previews retain salary wording while funded previews disclose the payable total and limit',async()=>{
 const {default:Preview}=await import('../web/app/story/ContractPricePreview.tsx'),draft=defaultContentPackage();
 const legacy=render(h(Preview,{draft,monthlyPay:600}));assert.match(legacy,/un día: 120 pesos/);assert.doesNotMatch(legacy,/garantía|fallecimiento/);
 const funded=render(h(Preview,{draft,monthlyPay:600,serviceGuarantee:101}));assert.match(funded,/un día: paga 120 \+ garantía 101 = 221 pesos/);assert.match(funded,/No cubre la paga por fallecimiento/);
});
