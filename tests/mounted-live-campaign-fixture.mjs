import {register} from 'node:module';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {SAVE_KEY as CONTENT_SAVE_KEY} from '../game/save.js';
import {encodeSave,decodeSave} from '../game/save.js';
register('./tactical-render-loader.mjs',import.meta.url);
export async function mountCampaign(t,saved,{virtualTimers=false}={}){
 const timers=new Map();let timerId=0,timerClock=0;
 const schedule=(fn,ms=0)=>{const id=++timerId;timers.set(id,{fn,ms,at:timerClock+ms});return id;};
 const console=new VirtualConsole();console.on('jsdomError',error=>{throw error;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test/',pretendToBeVisual:true,virtualConsole:console});dom.window.scrollTo=()=>{};
 if(saved)dom.window.localStorage.setItem(CONTENT_SAVE_KEY,encodeSave(saved.campaign,saved.battle));
 const registrations=[];dom.window.document.modelContext={registerTool(tool,{signal}){registrations.push({...tool,signal});}};
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true,
  ...(virtualTimers?{setTimeout:schedule,clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>schedule(()=>fn(timerClock),1000/60),cancelAnimationFrame:id=>timers.delete(id),performance:new Proxy(performance,{get(target,key){if(key==='now')return()=>timerClock;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}})}:{})};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:Home}=await import('../web/app/page.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let mounted=true;
 const unmount=async()=>{if(mounted){await act(async()=>root.unmount());mounted=false;}};
 t.after(async()=>{try{await unmount();}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Home)));const document=dom.window.document;
 const click=async text=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent.trim()).startsWith(text));assert.ok(b,text);await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 if(saved){await click('Continuar campaña');if(saved.battle.mode==='exploration')await click('Pausar');}
 const nextDelay=async()=>{const entry=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];assert.ok(entry,'A recorded presentation must have a pending delay');timers.delete(entry[0]);timerClock=entry[1].at;await act(async()=>entry[1].fn());return entry[1].ms;};
 return {dom,document,registrations,unmount,click,nextDelay,read:()=>registrations.find(t=>t.name==='read_granaderos_state').execute(),issue:action=>registrations.find(t=>t.name==='issue_granaderos_tactical_order').execute(action),saved:()=>decodeSave(dom.window.localStorage.getItem(CONTENT_SAVE_KEY))};
}
