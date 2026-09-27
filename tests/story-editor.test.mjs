import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {defaultContentPackage,parseContentPackage} from '../game/content-package.js';
import {CONTENT_LAUNCH_KEY,CONTENT_SAVE_KEY} from '../game/content-launch.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
register('./tactical-render-loader.mjs',import.meta.url);
const {default:StoryEditor}=await import('../web/app/story/page.tsx');
const draftKey='granaderos.content-draft.v1';

async function mount(t,stored,launch=null){
 const console=new VirtualConsole();
 console.on('jsdomError',error=>{if(!error.message.includes('navigation'))throw error;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:launch?'https://granaderos.test/?content=1&launch=1':'https://granaderos.test/story',pretendToBeVisual:true,virtualConsole:console});
 if(stored!==undefined)dom.window.localStorage.setItem(draftKey,stored);
 if(launch)dom.window.sessionStorage.setItem(CONTENT_LAUNCH_KEY,encodeSave(launch));
 dom.window.scrollTo=()=>{};
 dom.window.localStorage.setItem('granaderos.campaign.v1','ordinary save');
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const Component=launch?(await import('../web/app/page.tsx')).default:StoryEditor;
 await act(async()=>root.render(h(Component)));
 const document=dom.window.document;
 return {dom,document,
  button(text){const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(button,text);return button;},
  label(text){const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(label,text);return label.querySelector('input,select');},
  async click(element){await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async input(element,value){assert.ok(element);const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,String(value));await act(async()=>element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})));},
 };
}

test('the mounted story editor authors a character, recovers the draft and launches a separately saved playable campaign',async t=>{
 const stored=defaultContentPackage();stored.name='Historia de prueba';
 const m=await mount(t,JSON.stringify(stored));
 assert.ok(m.document.querySelector('a[href="/editor"]'),'sector editing remains accessible');
 await m.input(m.document.querySelector('input[type="search"]'),'person-100');
 const entry=m.document.querySelector('.entry-list button');assert.ok(entry);await m.click(entry);
 assert.equal(m.document.querySelector('section[aria-label="Aparición del personaje"]'),null);
 assert.match(m.document.body.textContent,/No aparece en el mapa antes de contratarlo/);
 await m.input(m.label('Nombre'),'Lucía del Río');
 await m.input(m.label('Apodo'),'Luz');
 await m.input(m.label('Salud'),59);
 const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 assert.equal(draft().characters.find(c=>c.id==='person-100').attributes.maxHp,59);
 await m.click(m.button('Deshacer'));assert.notEqual(draft().characters.find(c=>c.id==='person-100').attributes.maxHp,59);
 await m.click(m.button('Rehacer'));assert.equal(draft().characters.find(c=>c.id==='person-100').attributes.maxHp,59);
 const launch=m.button('Iniciar campaña con estas fichas');assert.equal(launch.disabled,false);await m.click(launch);
 let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 assert.equal(campaign.contentCampaign.package.name,'Historia de prueba');
 const officer=rosterFor(campaign).find(o=>o.id===100);assert.equal(officer.name,'Lucía del Río');assert.equal(officer.nickname,'Luz');assert.equal(officer.maxHp,59);
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);
 const restored=decodeSave(encodeSave(campaign,battle));
 assert.equal(restored.battle.units.find(u=>u.id==='100').name,'Lucía del Río');
 assert.equal(restored.battle.units.find(u=>u.id==='100').maxHp,59);
 assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('invalid stored data is retained for recovery instead of crashing or being overwritten',async t=>{
 const raw=JSON.stringify({format:'granaderos-content',characters:[null],weapons:[],placements:[]});
 const m=await mount(t,raw);
 assert.equal(m.dom.window.localStorage.getItem(draftKey),raw);
 assert.match(m.document.body.textContent,/El archivo original se conserva/);
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);
 await m.input(m.label('Nombre'),'Nuevo borrador');
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
 assert.equal(parseContentPackage(m.dom.window.localStorage.getItem(draftKey)).characters[0].name,'Nuevo borrador');
});

test('weapons and placement drafts cannot launch until those settings are applied by the campaign',async t=>{
 const draft=defaultContentPackage();draft.weapons[0].damage++;
 const m=await mount(t,JSON.stringify(draft));
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);
 assert.match(m.document.querySelector('.campaign-launch').textContent,/armas editadas/);
 assert.equal(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY),null);
});


test('the weapon catalogue shows its existing images and search filters the list',async t=>{
 const m=await mount(t);await m.click(m.button('Armas de fuego'));
 const definitions=defaultContentPackage().weapons;
 assert.equal(m.document.querySelectorAll('.entry-list img').length,definitions.length);
 for(const img of m.document.querySelectorAll('.entry-list img'))assert.match(img.getAttribute('src'),/^\/art\/weapon-180[0-8]\.png$/);
 await m.input(m.document.querySelector('input[type="search"]'),'Baker');
 const entry=m.document.querySelector('.entry-list button');assert.ok(entry);assert.equal(m.document.querySelectorAll('.entry-list button').length,1);
 await m.click(entry);assert.equal(m.document.querySelector('.weapon-preview').getAttribute('src'),'/art/weapon-1802.png');
});


test('the real game entry consumes the editor launch and saves the authored campaign separately',async t=>{
 const definition=defaultContentPackage();definition.characters[0].name='Nombre de campaña';
 const m=await mount(t,undefined,initialCampaign(123,definition));
 assert.equal(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY),null);
 assert.equal(m.dom.window.location.search,'?content=1');
 assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
 const saved=decodeSave(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY));
 assert.equal(rosterFor(saved.campaign).find(o=>o.id===0).name,'Nombre de campaña');
 assert.ok(m.document.querySelector('.game-shell'));
 await m.click(m.button('Correspondencia'));
 const contacts=m.document.querySelector('.contact-list');assert.ok(contacts);assert.match(contacts.textContent,/Nombre de campaña/);
 assert.ok(!contacts.textContent.includes(definition.characters.find(c=>c.id==='person-100').name),'contract candidates have no advertised world location');
});
