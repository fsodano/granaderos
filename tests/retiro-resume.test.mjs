import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,SAVE_KEY} from '../game/save.js';
register('./tactical-render-loader.mjs',import.meta.url);

for(const path of ['continue','import'])for(const stage of ['empty','pending','hired'])test(`${path} opens the correct real screen for a ${stage} roster without a custom character`,async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});dom.window.scrollTo=()=>{};
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 let s=initialCampaign(8,stage==='pending'?defaultContentPackage():null);
 if(stage!=='empty'){s=dispatchCampaign(s,{type:'recruitCivic',id:110,term:'week'});assert.equal(s.lastError,null);}assert.equal(s.officer,null);
 const wire=encodeSave(s);if(path==='continue')dom.window.localStorage.setItem(SAVE_KEY,wire);
 const {default:Home}=await import('../web/app/page.tsx');const {createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 await act(async()=>root.render(h(Home)));
 if(path==='continue'){
  const button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Continuar campaña'));assert.ok(button);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 }else{
  const input=dom.window.document.querySelector('input[type="file"]');assert.ok(input);Object.defineProperty(input,'files',{value:[{size:wire.length,text:async()=>wire}],configurable:true});await act(async()=>input.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
 }
 assert.equal(Boolean(dom.window.document.querySelector('.desk-screen')),stage!=='hired');
 assert.equal(dom.window.document.querySelectorAll('[data-map-cell]').length,stage==='hired'?1188:0);
 assert.equal(dom.window.document.querySelector('[role="alert"]'),null);
});
