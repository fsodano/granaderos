import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {defaultContentPackage,parseContentPackage} from '../game/content-package.js';
import {CONTENT_LAUNCH_KEY,CONTENT_SAVE_KEY} from '../game/content-launch.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {initialCampaign,dispatchCampaign,rosterFor,CAMPAIGN_SECTORS} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
register('./tactical-render-loader.mjs',import.meta.url);
const {default:StoryEditor}=await import('../web/app/story/page.tsx');
const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
const {default:Armory}=await import('../web/app/Armory.tsx');
const draftKey='granaderos.content-draft.v1';

async function mount(t,stored,launch=null,recruitCampaign=null,view='recruitment'){
 const console=new VirtualConsole();
 console.on('jsdomError',error=>{if(!error.message.includes('navigation'))throw error;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:launch?'https://granaderos.test/?content=1&launch=1':'https://granaderos.test/story',pretendToBeVisual:true,virtualConsole:console});
 if(stored!==undefined)dom.window.localStorage.setItem(draftKey,stored);
 if(launch)dom.window.sessionStorage.setItem(CONTENT_LAUNCH_KEY,encodeSave(launch));
 dom.window.scrollTo=()=>{};
 dom.window.localStorage.setItem('granaderos.campaign.v1','ordinary save');
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),FileReader:dom.window.FileReader,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 let current=recruitCampaign;
 function HiringScreen(){const [campaign,setCampaign]=useState(recruitCampaign);current=campaign;return h(view==='armory'?Armory:Recruitment,{state:campaign,dispatch:action=>setCampaign(s=>dispatchCampaign(s,action))});}
 const Component=recruitCampaign?HiringScreen:launch?(await import('../web/app/page.tsx')).default:StoryEditor;
 await act(async()=>root.render(h(Component)));
 const document=dom.window.document;
 return {dom,document,get campaign(){return current;},
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
 campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);
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

test('placement drafts cannot launch until those settings are applied by the campaign',async t=>{
 const draft=defaultContentPackage();draft.placements[0].sectors=['cell-0-0'];
 const m=await mount(t,JSON.stringify(draft));
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);
 assert.match(m.document.querySelector('.campaign-launch').textContent,/apariciones editadas/);
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


test('mounted authoring configures travel and plausible reception sites through undo and launch',async t=>{
 const m=await mount(t);
 await m.input(m.document.querySelector('input[type="search"]'),'person-110');
 await m.click(m.document.querySelector('.entry-list button'));
 await m.input(m.label('Tiempo de viaje (horas)'),3);
 await m.click(m.button('Llegadas'));
 const label=`Cuartel en ${CAMPAIGN_SECTORS.find(s=>s.id==='retiro').name}`;
 const checkbox=[...m.document.querySelectorAll('input[type="checkbox"]')].find(c=>c.getAttribute('aria-label')===label);
 assert.ok(checkbox);assert.equal(checkbox.checked,true);
 await m.click(checkbox);assert.equal(checkbox.checked,false);
 await m.click(m.button('Deshacer'));assert.equal(checkbox.checked,true);
 await m.click(m.button('Rehacer'));assert.equal(checkbox.checked,false);
 assert.equal([...m.document.querySelectorAll('input[type="checkbox"]')].some(c=>c.getAttribute('aria-label')===`Puerto en ${CAMPAIGN_SECTORS.find(s=>s.id==='mendoza').name}`),false);
 const serialized=m.dom.window.localStorage.getItem(draftKey),content=parseContentPackage(serialized);
 assert.equal(content.characters.find(c=>c.id==='person-110').arrivalHours,3);
 assert.equal(content.arrivalSites.some(s=>s.sector==='retiro'),false);
 await m.click(m.button('Iniciar campaña con estas fichas'));
 let campaign=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week',destination:'ensenada'});assert.equal(campaign.lastError,null);
 assert.equal(campaign.recruited.includes(110),false);assert.equal(campaign.hiringArrivals[0].dueAt,3);
 campaign=dispatchCampaign(decodeSave(encodeSave(campaign)).campaign,{type:'wait',hours:3});assert.equal(campaign.lastError,null);
 assert.equal(campaign.operativeState[110].location,'ensenada');assert.equal(campaign.contracts[110].expiresAt,171);
});

test('the mounted bulletin hires to a chosen port, redirects and cancels with one refund',async t=>{
 const initial=initialCampaign(42,defaultContentPackage());
 const m=await mount(t,undefined,null,initial);
 await m.input(m.label('Buscar mercenario'),rosterFor(initial).find(o=>o.id===110).name);
 await m.input(m.label('Destino de nuevos contratados'),'ensenada');
 let card=m.document.querySelector('[data-operative-id="110"]');assert.ok(card);
 const hire=[...card.querySelectorAll('button')].find(b=>b.textContent.startsWith('Contratar'));assert.ok(hire);assert.equal(hire.disabled,false);
 await m.click(hire);assert.equal(m.campaign.lastError,null);
 const paid=initial.resources.treasury-m.campaign.resources.treasury;assert.ok(paid>0);
 assert.equal(m.campaign.hiringArrivals[0].destination,'ensenada');assert.match(card.textContent,/En viaje · faltan 6 horas/);
 assert.equal([...card.querySelectorAll('button')].some(b=>b.textContent.startsWith('Contratar')),false);
 await m.input(card.querySelector('select'),'retiro');assert.equal(m.campaign.lastError,null);assert.equal(m.campaign.hiringArrivals[0].destination,'retiro');
 assert.equal(decodeSave(encodeSave(m.campaign)).campaign.resources.treasury,initial.resources.treasury-paid);
 await m.input(m.label('Estado'),'available');assert.equal(m.document.querySelector('[data-operative-id="110"]'),null);
 await m.input(m.label('Estado'),'pending');card=m.document.querySelector('[data-operative-id="110"]');assert.ok(card);
 await m.click([...card.querySelectorAll('button')].find(b=>b.textContent.startsWith('Cancelar llegada')));
 assert.equal(m.campaign.resources.treasury,initial.resources.treasury);assert.equal(m.campaign.hiringArrivals.length,0);
});


test('the editor creates a firearm with a custom image and launches its actual campaign assignment',async t=>{
 const m=await mount(t);await m.click(m.button('Armas de fuego'));await m.click(m.button('+ Crear arma'));
 await m.input(m.label('Nombre'),'Pistola de prueba');
 await m.input(m.label('Familia de funcionamiento'),'1805');
 await m.input(m.label('Daño'),37);await m.input(m.label('Capacidad de carga'),3);await m.input(m.label('Peso (kg)'),2);await m.input(m.label('Precio (pesos)'),180);
 const file=new m.dom.window.File([Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL5kAAAAASUVORK5CYII=','base64'))],'weapon.png',{type:'image/png'});
 const input=m.document.querySelector('input[aria-label="Imagen del arma"]');Object.defineProperty(input,'files',{configurable:true,value:[file]});
 await act(async()=>{input.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,30));});
 let draft=parseContentPackage(m.dom.window.localStorage.getItem(draftKey));const weapon=draft.weapons.find(w=>w.name==='Pistola de prueba');assert.ok(weapon);assert.match(weapon.art,/^data:image\/png;base64,/);
 assert.equal(m.document.querySelector('.weapon-preview').getAttribute('src'),weapon.art);
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click(m.document.querySelector('.entry-list button'));
 await m.input(m.label('Arma de fuego'),weapon.id);await m.click(m.button('Iniciar campaña con estas fichas'));
 let campaign=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const restored=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle))),unit=restored.battle.units.find(u=>u.id==='100');
 assert.equal(unit.loaded,3);assert.equal(unit.weaponMetadata.contentWeapon.damage,37);assert.equal(unit.weaponMetadata.contentWeapon.art,weapon.art);
});

test('the mounted armory purchases and equips the selected authored firearm instance',async t=>{
 const d=defaultContentPackage();d.weapons.push({...d.weapons.find(w=>w.template===1805),id:'pistola-editor',name:'Pistola del editor',damage:70,price:200,art:'/art/weapon-1808.png'});
 let s=initialCampaign(5,d);s=dispatchCampaign(s,{type:'recruitCivic',id:100,term:'week'});s=dispatchCampaign(s,{type:'wait',hours:6});assert.equal(s.lastError,null);
 const m=await mount(t,undefined,null,s,'armory');
 const article=[...m.document.querySelectorAll('.armory-catalog article')].find(a=>a.textContent.includes('Pistola del editor'));assert.ok(article);assert.equal(article.querySelector('img').getAttribute('src'),'/art/weapon-1808.png');
 const treasury=m.campaign.resources.treasury;await m.click(article.querySelector('button'));assert.equal(m.campaign.lastError,null);assert.equal(m.campaign.resources.treasury,treasury-200);
 const item=m.campaign.armoryItems.find(i=>i.contentWeapon?.id==='pistola-editor');assert.ok(item);
 await m.input(m.document.querySelector('#armory-weapon'),item.id);assert.equal(m.campaign.lastError,null);
 const saved=decodeSave(encodeSave(m.campaign)).campaign;assert.equal(saved.operativeState[100].weaponMetadata.contentWeapon.id,'pistola-editor');assert.equal(saved.armory['pistola-editor'],0);
 assert.match(m.document.querySelector('#armory-weapon').selectedOptions[0].textContent,/Pistola del editor/);
});

test('the editor assigns troop firearms with undo, dependency protection and a real attack launch',async t=>{
 const d=defaultContentPackage();d.weapons.push({...d.weapons.find(w=>w.template===1805),id:'tropa-editor',name:'Arma de las tropas',capacity:4,damage:67,art:'/art/weapon-1808.png'});
 const m=await mount(t,JSON.stringify(d));await m.click(m.button('Armas de fuego'));
 const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.label('Oficiales enemigos'),'tropa-editor');await m.input(m.label('Cívicos'),'tropa-editor');await m.input(m.label('Veteranos enemigos'),'');
 assert.equal(draft().oppositionEquipment.veteran,null);await m.click(m.button('Deshacer'));assert.equal(draft().oppositionEquipment.veteran,'firearm-1801');await m.click(m.button('Rehacer'));assert.equal(draft().oppositionEquipment.veteran,null);
 await m.input(m.document.querySelector('input[type="search"]'),'tropa-editor');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));
 assert.match(m.document.querySelector('.notice').textContent,/tropas que la usan/);assert.ok(draft().weapons.some(w=>w.id==='tropa-editor'));
 await m.click(m.button('Iniciar campaña con estas fichas'));let s=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'travel',sector:'buenos_aires'},{type:'attack',sector:'san_nicolas'}]){s=dispatchCampaign(s,action);assert.equal(s.lastError,null);}
 const saved=decodeSave(encodeSave(s,enterSector(s.pendingBattle)));assert.equal(saved.battle.units.find(u=>u.id==='enemy-0').weaponMetadata.contentWeapon.id,'tropa-editor');assert.equal(saved.battle.units.find(u=>u.id==='enemy-0').loaded,4);
});
test('an older draft can enable troop authoring without missing references',async t=>{
 const d=defaultContentPackage();delete d.oppositionEquipment;delete d.militiaEquipment;
 const m=await mount(t,JSON.stringify(d));await m.click(m.button('Armas de fuego'));assert.match(m.document.querySelector('section[aria-label="Armamento de las tropas"]').textContent,/armas originales/);
 await m.click(m.button('Configurar armas de enemigos'));await m.click(m.button('Configurar armas de milicias'));
 await m.input(m.label('Soldados de línea'),'');const stored=parseContentPackage(m.dom.window.localStorage.getItem(draftKey));assert.equal(stored.militiaEquipment.veteran,null);assert.equal(stored.oppositionEquipment.officer,'firearm-1805');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
});
