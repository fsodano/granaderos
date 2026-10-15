import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {campaignStorageKey} from '../game/content-launch.js';
import {campaignPlace} from '../game/world-cells.js';
import {campaignFetch} from './campaign-library-fixture.mjs';
import {campaignUIReady} from './mounted-campaign-ready.mjs';
register('./tactical-render-loader.mjs',import.meta.url);

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null);return next;};
const serving=seed=>order(initialCampaign(seed),{type:'recruitCivic',id:110,term:'week'});
function arrival(seed){
 const pair=prepareCampaignBattle(order(serving(seed),{type:'attack',sector:'buenos_aires'}),{placement:true});
 assert.equal(pair.error,null);assert.ok(pair.battle.deployment);
 return {campaign:pair.campaign,battle:pair.battle};
}

async function mount(t){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test/?campaign=granaderos&qa=1',pretendToBeVisual:true});
 dom.window.scrollTo=()=>{};
 // The clock still mounts its real interval. Hold callbacks until requested so
 // a test never advances campaign time while selecting an import file.
 const intervals=new Map();let nextInterval=0;
 const globals={fetch:campaignFetch,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,
  MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true,
  Worker:class{constructor(){throw Error('Use the ordinary synchronous autosave fallback.');}},
  setInterval(callback,delay){const id=++nextInterval;intervals.set(id,{callback,delay});return id;},clearInterval(id){intervals.delete(id);}};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:Home}=await import('../web/app/page.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Home)));await campaignUIReady(dom.window.document);
 const document=dom.window.document;
 const button=(label,scope=document)=>{const found=[...scope.querySelectorAll('button')].find(item=>(item.getAttribute('aria-label')??item.textContent.trim())===label);assert.ok(found,`missing button ${label}`);return found;};
 const click=async element=>{assert.ok(element);await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await campaignUIReady(document);};
 const input=document.querySelector('input[type="file"]');let filePickerRequests=0;input.click=()=>{filePickerRequests++;};
 return {document,button,click,intervals,
  async import(wire,{menu=false}={}){
   if(menu)await click(button('Menú'));
   const requests=filePickerRequests;await click(button('Importar partida'));assert.equal(filePickerRequests,requests+1);
   Object.defineProperty(input,'files',{configurable:true,value:[{size:Buffer.byteLength(wire),text:async()=>wire}]});
   await act(async()=>input.dispatchEvent(new dom.window.Event('change',{bubbles:true})));await campaignUIReady(document);
  },
  saved(state){return decodeSave(dom.window.localStorage.getItem(campaignStorageKey(state,dom.window.location.search)));},
 };
}

test('menu import closes the menu and resets the tactical arrival selection without changing the saved deployment',async t=>{
 const m=await mount(t),first=arrival(8),imported=arrival(1812),wire=encodeSave(imported.campaign,imported.battle);
 await m.import(encodeSave(first.campaign,first.battle));
 const mode=()=>m.document.querySelector('[aria-label="Colocar un combatiente o su escuadra"]');
 await m.click(m.button('Escuadra',mode()));assert.equal(m.button('Escuadra',mode()).getAttribute('aria-pressed'),'true');
 await m.import(wire,{menu:true});
 assert.equal(Boolean(m.document.querySelector('.dispatch-modal')),false,'the import menu closes after success');
 assert.equal(m.button('Uno',mode()).getAttribute('aria-pressed'),'true');
 assert.ok(m.document.body.textContent.includes('Partida recuperada.'));
 assert.deepEqual(m.saved(imported.campaign),decodeSave(wire));
});

test('menu import clears a strategic route and running clock and selects the imported current sector',async t=>{
 const m=await mount(t),first=serving(8),imported=serving(1812),wire=encodeSave(imported);
 await m.import(encodeSave(first));
 await m.click(m.document.querySelector('.strategy-layout button[aria-label^="Destino:"]'));
 await m.click(m.document.querySelector('[data-map-cell="ensenada"]')??m.document.querySelector('[data-map-sector="ensenada"]'));
 assert.ok(m.document.querySelector('[aria-label="Trazar ruta"]'));
 await m.click(m.button('▶ Iniciar'));assert.ok([...m.intervals.values()].some(timer=>timer.delay===250));
 await m.import(wire,{menu:true});
 assert.equal(Boolean(m.document.querySelector('.dispatch-modal')),false,'the import menu closes after success');
 assert.equal(Boolean(m.document.querySelector('[aria-label="Trazar ruta"]')),false);
 assert.equal([...m.intervals.values()].some(timer=>timer.delay===250),false,'the previous clock must stop on import');
 assert.equal(m.button('▶ Iniciar').getAttribute('aria-pressed'),'false');
 await m.click(m.button('Sector',m.document.querySelector('.strategy-tools')));
 assert.equal(m.document.querySelector('.strategic-panel-dialog').getAttribute('aria-label'),`Sector · ${campaignPlace(imported.location,imported).name.split(' · ')[0]}`);
 assert.deepEqual(m.saved(imported),decodeSave(wire));
});

test('menu import opens an empty-roster campaign at the Desk overview instead of the previous hiring tab',async t=>{
 const m=await mount(t),imported=initialCampaign(1812),wire=encodeSave(imported);
 await m.click([...m.document.querySelectorAll('button')].find(item=>item.textContent.startsWith('Nueva campaña')));
 await m.click([...m.document.querySelectorAll('button')].find(item=>item.textContent.startsWith('Omitir introducción')));
 assert.equal(m.document.querySelector('[aria-label="Carpetas del escritorio"] [aria-current="page"]').textContent,'Contrataciones');
 await m.import(wire,{menu:true});
 assert.equal(Boolean(m.document.querySelector('.dispatch-modal')),false,'the import menu closes after success');
 assert.equal(m.document.querySelector('[aria-label="Carpetas del escritorio"] [aria-current="page"]').textContent,'Resumen');
 assert.deepEqual(m.saved(imported),decodeSave(wire));
});

test('a rejected menu import keeps the current campaign and its open menu',async t=>{
 const m=await mount(t),state=serving(8),wire=encodeSave(state);
 await m.import(wire);await m.import('{not a save}',{menu:true});
 assert.ok(m.document.querySelector('.dispatch-modal'));
 assert.ok(m.document.body.textContent.includes('El archivo no contiene una partida válida.'));
 assert.deepEqual(m.saved(state),decodeSave(wire));
});
