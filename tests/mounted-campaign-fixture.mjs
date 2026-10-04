import {register} from 'node:module';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {CONTENT_SAVE_KEY} from '../game/content-launch.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {battleTimers} from './battle-timers-fixture.mjs';
register('./tactical-render-loader.mjs',import.meta.url);
export async function mountCampaign(t,saved){
 const console=new VirtualConsole();console.on('jsdomError',error=>{throw error;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test/?content=1',pretendToBeVisual:true,virtualConsole:console});dom.window.scrollTo=()=>{};
 if(saved)dom.window.localStorage.setItem(CONTENT_SAVE_KEY,encodeSave(saved.campaign,saved.battle));
 const registrations=[];dom.window.document.modelContext={registerTool(tool,{signal}){registrations.push({...tool,signal});}};
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:Home}=await import('../web/app/page.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const timers=battleTimers(act),root=createRoot(dom.window.document.getElementById('root'));let mounted=true;
 const unmount=async()=>{if(mounted){await act(async()=>root.unmount());mounted=false;}};
 t.after(async()=>{try{await unmount();}finally{timers.restore();dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Home)));const document=dom.window.document;
 const click=async text=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent.trim()).startsWith(text));assert.ok(b,text);await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await timers.settle(document);};
 if(saved){await click('Continuar campaña');if(saved.battle.mode==='exploration')await click('Pausar');}
 return {dom,document,registrations,unmount,click,settle:()=>timers.settle(document),settleUntil:done=>timers.until(done),read:()=>registrations.find(t=>t.name==='read_granaderos_state').execute(),issue:action=>registrations.find(t=>t.name==='issue_granaderos_tactical_order').execute(action),saved:()=>decodeSave(dom.window.localStorage.getItem(CONTENT_SAVE_KEY))};
}
