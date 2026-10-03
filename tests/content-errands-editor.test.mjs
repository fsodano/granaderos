import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {defaultContentPackage,parseContentPackage} from '../game/content-package.js';
import {defaultErrands} from '../game/quest-definitions.js';
import {decodeSave} from '../game/save.js';
import {CONTENT_LAUNCH_KEY} from '../game/content-launch.js';
const draftKey='granaderos.content-draft.v1';
async function mount(t,stored=defaultContentPackage()){
 const console=new VirtualConsole();console.on('jsdomError',e=>{if(!e.message.includes('navigation'))throw e;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test/story',pretendToBeVisual:true,virtualConsole:console});
 dom.window.localStorage.setItem(draftKey,JSON.stringify(stored));
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),FileReader:dom.window.FileReader,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [k,value]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value});
 const {default:Editor}=await import('../web/app/story/page.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of previous)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];});await act(async()=>root.render(h(Editor)));
 const document=dom.window.document;return {dom,document,draft:()=>parseContentPackage(dom.window.localStorage.getItem(draftKey)),
 button:text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,text);return b;},
 label:text=>{const l=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(l,text);return l.querySelector('input,select,textarea');},
 click:async e=>act(async()=>e.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}))),
 input:async(e,value)=>{const proto=e.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));},
 };
}
test('the editor retains defaults, offers named escort exits, and saves authored errands through undo and launch',async t=>{
 const m=await mount(t);await m.click(m.button('Encargos locales'));assert.equal(m.draft().errands,undefined);
 const exits=[...m.label('Salida de la escolta').options];assert.ok(exits.length);assert.ok(exits.every(o=>!o.textContent.trim().endsWith('hacia')));assert.ok(exits.every(o=>['humahuaca','salta'].includes(o.value)));
 await m.input(m.label('Título'),'Una escolta propia');assert.equal(m.draft().errands[0].title,'Una escolta propia');
 await m.click(m.button('Deshacer'));assert.equal(m.draft().errands,undefined);await m.click(m.button('Rehacer'));assert.equal(m.draft().errands[0].title,'Una escolta propia');
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.contentCampaign.package.errands[0].title,'Una escolta propia');assert.deepEqual(campaign.contentCampaign.package.quests,[]);
});
test('the editor authors finite delivery quantities and rewards without removing dialogue quests',async t=>{
 const d=defaultContentPackage();d.errands=defaultErrands();d.quests=[{id:'informe',title:'Informe',description:'Un informe por diálogo.'}];const m=await mount(t,d);await m.click(m.button('Encargos locales'));
 await m.click(m.button('Vendas para la Ciudadela'));await m.input(m.label('Cantidad'),4);await m.input(m.label('Pesos de plata'),83);
 assert.equal(m.draft().errands[1].carried.count,4);assert.equal(m.draft().errands[1].reward.treasury,83);assert.deepEqual(m.draft().quests,d.quests);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.contentCampaign.package.errands[1].carried.count,4);assert.equal(campaign.contentCampaign.package.errands[1].reward.treasury,83);
});

test('changing a conversation contact selects its locality before adding a physical delivery',async t=>{
 const m=await mount(t);await m.click(m.button('Encargos locales'));await m.click(m.button('Crear encargo'));await m.input(m.label('Contacto'),'local-santa_fe');assert.equal(m.label('Localidad del encargo').value,'santa_fe');await m.input(m.label('Objetivo'),'carried');await m.input(m.label('Cantidad'),2);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);assert.equal(m.draft().errands.at(-1).sector,'santa_fe');
});
