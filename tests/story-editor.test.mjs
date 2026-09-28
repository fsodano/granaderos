import {questPackage} from './content-quest-fixture.mjs';
import {contentQuestJournal} from '../game/content-quests.js';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {dialogueConditionsMet} from '../game/dialogue-conditions.js';
import {secureArea} from './controlled-area-fixture.mjs';
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
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
register('./tactical-render-loader.mjs',import.meta.url);
const draftKey='granaderos.content-draft.v1';

test('the editor removes a historical ability and assigns abilities to a new identity through undo, copy and campaign launch',async t=>{
 const m=await mount(t);const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 const ability=name=>[...m.document.querySelectorAll('fieldset[aria-label="Habilidades de combate"] label')].find(l=>l.textContent.startsWith(name)).querySelector('input');
 await m.input(m.document.querySelector('input[type="search"]'),'person-3');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(ability('Protección de compañeros').checked,true);await m.click(ability('Protección de compañeros'));assert.ok(!draft().characters.find(c=>c.id==='person-3').abilities.includes('bodyguard'));
 await m.click([...m.document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear personaje')));
 assert.equal(m.document.querySelectorAll('fieldset[aria-label="Habilidades de combate"] input:checked').length,0);
 await m.input(m.label('Nombre'),'Alma Nueva');await m.click(ability('Protección de compañeros'));await m.click(ability('Atención rápida'));
 await m.click(m.button('Deshacer'));assert.equal(ability('Atención rápida').checked,false);await m.click(m.button('Rehacer'));assert.equal(ability('Atención rápida').checked,true);
 await m.click(m.button('Duplicar personaje'));const c=draft().characters.at(-1);assert.deepEqual(c.abilities,['bodyguard','rapid_first_aid']);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 assert.ok(!rosterFor(campaign).find(o=>o.id===3).abilities.includes('bodyguard'));
 const id=operativeIdForCharacter(campaign.contentCampaign.package,c.id);campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'week'});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'wait',hours:6});campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const pair=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle)));assert.deepEqual(pair.battle.units.find(u=>u.id===String(id)).abilities,c.abilities);
});

test('an older draft shows effective historical abilities and can explicitly disable them',async t=>{
 const d=defaultContentPackage();for(const c of d.characters)delete c.abilities;
 const m=await mount(t,JSON.stringify(d));await m.input(m.document.querySelector('input[type="search"]'),'person-10');await m.click(m.document.querySelector('.entry-list button'));
 const box=[...m.document.querySelectorAll('fieldset[aria-label="Habilidades de combate"] label')].find(l=>l.textContent.startsWith('Atención rápida')).querySelector('input');assert.equal(box.checked,true);await m.click(box);
 const updated=parseContentPackage(m.dom.window.localStorage.getItem(draftKey));assert.deepEqual(updated.characters.find(c=>c.id==='person-10').abilities,[]);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(rosterFor(campaign).find(o=>o.id===10).abilities,[]);
});

test('the editor previews independent portrait and body choices and authors the character voice through undo, copy and launch',async t=>{
 const m=await mount(t);const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click(m.document.querySelector('.entry-list button'));
 const oldBody=m.label('Apariencia en combate').value;
 await m.input(m.label('Retrato disponible'),'/art/avatar-woman-scout.webp');assert.equal(m.label('Apariencia en combate').value,oldBody);
 await m.input(m.label('Apariencia en combate'),'woman-scout');await m.input(m.label('Carácter'),'Serena y observadora.');
 await m.input(m.label('Al incorporarse'),'Lista para partir.');await m.input(m.label('Al recibir una herida'),'');
 assert.match(m.document.querySelector('.appearance-choice image').getAttribute('href'),/woman-scout/);
 await m.click(m.button('Deshacer'));assert.notEqual(m.label('Al recibir una herida').value,'');await m.click(m.button('Rehacer'));assert.equal(m.label('Al recibir una herida').value,'');
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.equal(copy.personality,'Serena y observadora.');assert.equal(copy.speech.hired,'Lista para partir.');assert.equal(copy.speech.wounded,'');assert.equal(copy.spriteAppearance,'woman-scout');assert.equal(copy.portrait,'/art/avatar-woman-scout.webp');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id);campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'week'});campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});const pair=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle)));const unit=pair.battle.units.find(u=>u.id===String(id));
 assert.equal(unit.spriteAppearance,'woman-scout');assert.equal(unit.storyProfile.personality,'Serena y observadora.');assert.equal(unit.storyProfile.speech.hired,'Lista para partir.');assert.equal(unit.storyProfile.speech.wounded,'');
});

test('the real bulletin dossier shows authored personality and hiring phrase',async t=>{
 const d=defaultContentPackage(),c=d.characters.find(c=>c.id==='person-100');Object.assign(c,{name:'Clara Voz',personality:'Una voz propia.',abilities:['counterattack'],traits:['teacher']});c.speech.hired='Partimos al amanecer.';
 const m=await mount(t,undefined,null,initialCampaign(42,d));await m.input(m.document.querySelector('input[type="search"]'),'Clara Voz');await m.click(m.button('Atributos, carácter y equipo →'));
 const dialog=m.document.querySelector('[role="dialog"]');assert.ok(dialog);assert.match(dialog.textContent,/Una voz propia\./);assert.match(dialog.textContent,/Partimos al amanecer\./);assert.match(dialog.textContent,/Contragolpe/);assert.match(dialog.textContent,/Instrucción/);
});

test('the editor creates, duplicates and removes actual contract candidates with undo and safe historical guards',async t=>{
 const m=await mount(t);const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.click(m.button('Eliminar'));assert.match(m.document.body.textContent,/No se pueden eliminar hasta separar esas funciones/);
 const add=[...m.document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear personaje'));assert.ok(add);await m.click(add);
 await m.input(m.label('Nombre'),'Clara Nueva');await m.input(m.label('Apodo'),'Clara');
 await m.input(m.label('Progreso por combate'),'fixed');await m.input(m.label('Equitación'),62);
 const trait=[...m.document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Instrucción').querySelector('input');await m.click(trait);
 const original=draft().characters.at(-1);assert.equal(original.recruitmentSource,'contract');assert.equal(original.service,'contract');assert.deepEqual(original.traits,['teacher']);assert.equal(original.progression,'fixed');
 assert.equal(m.document.querySelector('section[aria-label="Aparición del personaje"]'),null);
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.notEqual(copy.id,original.id);assert.equal(copy.name,'Clara Nueva (copia)');assert.equal(copy.ridingSkill,62);assert.deepEqual(copy.traits,['teacher']);
 await m.click(m.button('Eliminar'));assert.equal(draft().characters.some(c=>c.id===copy.id),false);
 await m.click(m.button('Deshacer'));assert.equal(draft().characters.some(c=>c.id===copy.id),true);
 await m.click(m.button('Rehacer'));assert.equal(draft().characters.some(c=>c.id===copy.id),false);
 await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));
 assert.equal(draft().characters.some(c=>c.id==='person-100'),false);
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Iniciar campaña con estas fichas'));
 const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 const id=operativeIdForCharacter(campaign.contentCampaign.package,original.id);assert.ok(id>=2000);
 assert.equal(rosterFor(campaign).find(o=>o.id===id).name,'Clara Nueva');assert.equal(rosterFor(campaign).some(o=>o.id===100),false);
});

test('the bulletin searches and hires a new identity without showing deleted catalogue members',async t=>{
 const definition=defaultContentPackage(),template=definition.characters.find(c=>c.id==='person-100');
 definition.characters=definition.characters.filter(c=>c.id!=='person-100');
 definition.characters.push({...structuredClone(template),id:'clara-nueva',name:'Clara Nueva',nickname:'Clara',arrivalHours:2});
 const m=await mount(t,undefined,null,initialCampaign(42,definition));
 const search=m.document.querySelector('input[type="search"]');await m.input(search,'Clara Nueva');
 assert.ok(!m.document.body.textContent.includes('Rafael Sosa'));
 const card=[...m.document.querySelectorAll('article')].find(a=>a.textContent.includes('Clara Nueva'));assert.ok(card);
 const hire=[...card.querySelectorAll('button')].find(b=>b.textContent.includes('Contratar'));assert.ok(hire);await m.click(hire);
 const id=operativeIdForCharacter(definition,'clara-nueva');assert.equal(m.campaign.hiringArrivals[0].operativeId,id);assert.equal(m.campaign.hiringArrivals[0].dueAt,2);
 assert.equal(decodeSave(encodeSave(m.campaign)).campaign.recruited.includes(id),false);
});

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
 // Portal components must load after the DOM exists, as they do in the browser.
 const {default:StoryEditor}=await import('../web/app/story/page.tsx');
 const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
 const {default:Armory}=await import('../web/app/Armory.tsx');
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
  label(text){const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(label,text);return label.querySelector('input,select,textarea');},
  async click(element){await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async input(element,value){assert.ok(element);const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,String(value));await act(async()=>element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})));},
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

test('water placements cannot launch as land encounters',async t=>{
 const draft=defaultContentPackage();draft.placements[0].sectors=['cell-0-0'];
 const m=await mount(t,JSON.stringify(draft));
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);
 assert.match(m.document.querySelector('.campaign-launch').textContent,/celdas terrestres/);
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
 assert.ok(dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week',destination:'ensenada'}).lastError);secureArea(campaign,'ensenada');
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week',destination:'ensenada'});assert.equal(campaign.lastError,null);
 assert.equal(campaign.recruited.includes(110),false);assert.equal(campaign.hiringArrivals[0].dueAt,3);
 campaign=dispatchCampaign(decodeSave(encodeSave(campaign)).campaign,{type:'wait',hours:3});assert.equal(campaign.lastError,null);
 assert.equal(campaign.operativeState[110].location,'ensenada');assert.equal(campaign.contracts[110].expiresAt,171);
});

test('the mounted bulletin hires to a chosen port, redirects and cancels with one refund',async t=>{
 const initial=secureArea(initialCampaign(42,defaultContentPackage()),'ensenada');
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
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'attack',sector:'buenos_aires'}]){s=dispatchCampaign(s,action);assert.equal(s.lastError,null);}
 const saved=decodeSave(encodeSave(s,enterSector(s.pendingBattle)));assert.equal(saved.battle.units.find(u=>u.id==='enemy-0').weaponMetadata.contentWeapon.id,'tropa-editor');assert.equal(saved.battle.units.find(u=>u.id==='enemy-0').loaded,4);
});
test('an older draft can enable troop authoring without missing references',async t=>{
 const d=defaultContentPackage();delete d.oppositionEquipment;delete d.militiaEquipment;
 const m=await mount(t,JSON.stringify(d));await m.click(m.button('Armas de fuego'));assert.match(m.document.querySelector('section[aria-label="Armamento de las tropas"]').textContent,/armas originales/);
 await m.click(m.button('Configurar armas de enemigos'));await m.click(m.button('Configurar armas de milicias'));
 await m.input(m.label('Soldados de línea'),'');const stored=parseContentPackage(m.dom.window.localStorage.getItem(draftKey));assert.equal(stored.militiaEquipment.veteran,null);assert.equal(stored.oppositionEquipment.officer,'firearm-1805');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
});


test('the placement map authors a daily range and scene guards, restores edits, then launches the actual encounter',async t=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 const m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-3');await m.click(m.document.querySelector('.entry-list button'));
 await m.click(m.button('Quitar todas'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);
 for(const id of ['cell-27-27','cell-26-27'])await m.click(m.document.querySelector(`[data-cell="${id}"]`));
 await m.input(m.label('Ubicación'),'daily');await m.input(m.label('Elección diaria'),'alternate');await m.input(m.label('Protección mientras hay una escena abierta'),'range');
 await m.click(m.button('Deshacer'));assert.notEqual(draft().placements.find(p=>p.character==='person-3').loadedGuard,'range');await m.click(m.button('Rehacer'));
 const p=draft().placements.find(p=>p.character==='person-3');assert.deepEqual(p.sectors,['cell-27-27','cell-26-27']);assert.equal(p.selection,'alternate');assert.equal(p.loadedGuard,'range');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week'});campaign=dispatchCampaign(campaign,{type:'travel',sector:campaign.contentPresence.people['person-3'].sector});assert.equal(campaign.lastError,null);
 if(campaign.location!==campaign.contentPresence.people['person-3'].sector)campaign=dispatchCampaign(campaign,{type:'travel',sector:campaign.contentPresence.people['person-3'].sector});
 campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);const battle=enterSector(campaign.pendingBattle);assert.ok(battle.npcs.some(n=>n.operativeId===3));assert.ok(decodeSave(encodeSave(campaign,battle)));
});

test('the actual editor creates a world resident, copies its cell range, undoes deletion and launches a real encounter',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.click(m.button('Crear habitante'));await m.input(m.label('Nombre'),'Alma de la Posta');await m.input(m.label('Saludo al conversar'),'Conozco estas tierras.');
 const box=[...m.document.querySelectorAll('label')].find(l=>l.textContent.includes('Puede incorporarse a la escuadra')).querySelector('input');assert.equal(box.checked,false);await m.click(box);
 await m.input(m.label('Liderazgo mínimo del interlocutor'),35);await m.input(m.label('Localidad que debe estar liberada'),'retiro');await m.click(m.button('Configurar aparición'));
 await m.click(m.button('Quitar todas'));await m.click(m.document.querySelector('[data-cell="cell-27-27"]'));await m.click(m.document.querySelector('[data-cell="cell-26-27"]'));
 const original=draft().characters.at(-1);assert.equal(original.recruitmentSource,'encounter');assert.equal(original.service,'permanent');assert.equal(original.arrivalHours,undefined);assert.equal(original.encounter.requiredLeadership,35);
 const originalPlacement=draft().placements.find(p=>p.character===original.id);assert.equal(originalPlacement.mode,'once');assert.deepEqual(originalPlacement.sectors,['cell-27-27','cell-26-27']);
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.notEqual(copy.id,original.id);assert.deepEqual(copy.encounter,original.encounter);assert.deepEqual(draft().placements.at(-1).sectors,originalPlacement.sectors);
 await m.click(m.button('Eliminar'));assert.ok(!draft().placements.some(p=>p.character===copy.id));assert.ok(!draft().characters.some(c=>c.id===copy.id));
 await m.click(m.button('Deshacer'));assert.ok(draft().characters.some(c=>c.id===copy.id));await m.click(m.button('Rehacer'));assert.ok(!draft().characters.some(c=>c.id===copy.id));
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Iniciar campaña con estas fichas'));
 let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,original.id);
 campaign=dispatchCampaign(campaign,{type:'createOfficer',name:'Oficial de la posta',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'travel',sector:campaign.contentPresence.people[original.id].sector});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const pair=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle))),npc=pair.battle.npcs.find(n=>n.operativeId===id);
 assert.ok(npc);assert.equal(npc.name,'Alma de la Posta');assert.equal(npc.greeting,'Conozco estas tierras.');assert.equal(npc.recruitable,true);assert.equal(npc.requiredLeadership,35);assert.equal(npc.requiredSector,'retiro');assert.equal(npc.hp,original.attributes.maxHp);
});

test('the editor authors a death successor that appears once after an actual saved campaign death',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.click(m.button('Crear habitante'));await m.input(m.label('Nombre'),'Pablo');await m.input(m.label('Salud'),30);await m.click(m.button('Configurar aparición'));const source=draft().characters.at(-1).id;
 await m.click(m.button('Crear habitante'));await m.input(m.label('Nombre'),'Sal');await m.input(m.label('Salud'),61);await m.click(m.button('Configurar aparición'));const target=draft().characters.at(-1).id;
 await m.input(m.label('Aparece después de la muerte de'),source);await m.input(m.label('Demora máxima (minutos)'),90);await m.input(m.label('Demora mínima (minutos)'),30);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Demora mínima (minutos)').value,'0');await m.click(m.button('Rehacer'));assert.equal(m.label('Demora mínima (minutos)').value,'30');
 await m.click([...m.document.querySelectorAll('.entry-list button')].find(b=>b.querySelector('small')?.textContent===source));await m.click(m.button('Eliminar'));assert.ok(draft().characters.some(c=>c.id===source));assert.ok(m.document.body.textContent.includes('Quitá primero las apariciones y condiciones'));
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Iniciar campaña con estas fichas'));
 let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.contentPresence.people[target].appeared,false);
 const order=a=>{campaign=dispatchCampaign(campaign,a);assert.equal(campaign.lastError,null);};
 order({type:'recruitCivic',id:110,term:'month'});order({type:'wait',hours:6});order({type:'visitSector'});
 let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour});const npc=battle.npcs.find(n=>n.contentId===source);assert.ok(npc);assert.ok(!battle.npcs.some(n=>n.contentId===target));
 const spot=getReachable(battle,'110').find(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1);assert.ok(spot);
 if(spot.cost)battle=actBattle(battle,{type:'move',unitId:'110',x:spot.x,y:spot.y});assert.equal(battle.lastError,null);
 for(let i=0;i<3&&battle.npcs.find(n=>n.contentId===source).hp>0;i++)battle=actBattle(battle,{type:'melee',unitId:'110',targetId:npc.id});assert.equal(battle.lastError,null);assert.equal(battle.npcs.find(n=>n.contentId===source).hp,0);
 let pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);pair=decodeSave(encodeSave(pair.campaign,pair.battle));({campaign,battle}=pair);assert.equal(campaign.contentPresence.receipts.length,1);
 const receipt=campaign.contentPresence.receipts[0];assert.ok(receipt.at-receipt.minute>=30&&receipt.at-receipt.minute<=90);
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});order({type:'wait',hours:Math.ceil((receipt.at-campaign.contentPresence.minute)/60)});order({type:'visitSector'});
 battle=enterSector({...campaign.pendingBattle,hour:campaign.hour},campaign.sectorStates.retiro);pair=decodeSave(encodeSave(campaign,battle));
 assert.equal(pair.battle.npcs.filter(n=>n.contentId===target).length,1);assert.equal(pair.battle.npcs.find(n=>n.contentId===target).hp,61);assert.equal(pair.battle.npcs.find(n=>n.contentId===source).hp,0);assert.equal(pair.campaign.contentPresence.receipts.length,1);
});


test('the editor authors paid local service through price, copy, undo and campaign launch',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Crear habitante'));
 await m.input(m.label('Nombre'),'Alma del contrato');const field=m.document.querySelector('fieldset[aria-label="Encuentro del habitante"]');await m.click(field.querySelector('input[type="checkbox"]'));
 await m.input(m.label('Tipo de servicio'),'contract');assert.equal(m.label('Paga mensual').disabled,false);await m.input(m.label('Paga mensual'),90);
 await m.input(m.label('Tipo de servicio'),'permanent');assert.equal(m.label('Paga mensual').value,'0');assert.equal(m.label('Paga mensual').disabled,true);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Tipo de servicio').value,'contract');assert.equal(m.label('Paga mensual').value,'90');
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.equal(copy.service,'contract');assert.equal(copy.monthlyPay,90);assert.equal(copy.recruitmentSource,'encounter');assert.equal(copy.arrivalHours,undefined);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id),op=rosterFor(campaign).find(o=>o.id===id);assert.equal(op.service,'contract');assert.equal(op.monthlyPay,90);assert.equal(op.recruitmentSource,'encounter');
});


test('the editor builds connected dialogue passages with dependency protection, undo, copy and a playable saved branch',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Crear habitante'));await m.click(m.button('Configurar aparición'));
 await m.click(m.document.querySelector('fieldset[aria-label="Diálogo con opciones"] input[type="checkbox"]'));
 await m.input(m.label('Respuesta del personaje'),'Elegí tu camino.');await m.click(m.button('Agregar pasaje'));await m.input(m.label('Título del pasaje'),'Norte');await m.input(m.label('Respuesta del personaje'),'La posta está al norte.');assert.equal(draft().characters.at(-1).encounter.dialogue.nodes.length,2);assert.match(m.document.body.textContent,/todavía no tiene ninguna entrada/);
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.input(m.label('Pasaje que estás editando'),'start');await m.click(m.button('Agregar opción'));await m.input(m.label('Texto de la opción'),'Busco el norte.');
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.input(m.label('Pasaje que estás editando'),'node-1');assert.equal(m.button('Eliminar pasaje').disabled,true);await m.input(m.label('Pasaje que estás editando'),'start');await m.click(m.button('Quitar opción 1'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Deshacer'));
 const original=draft().characters.at(-1);await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.notEqual(copy.id,original.id);assert.deepEqual(copy.encounter.dialogue,original.encounter.dialogue);
 await m.input(m.label('Respuesta del personaje'),'Otra conversación.');assert.equal(draft().characters.find(c=>c.id===original.id).encounter.dialogue.nodes[0].text,'Elegí tu camino.');await m.click(m.button('Deshacer'));
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'month'});campaign=dispatchCampaign(campaign,{type:'wait',hours:6});campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour}),npc=battle.npcs.find(n=>n.contentId===copy.id),unit=battle.units.find(u=>u.side==='player'),tile=getReachable(battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(tile);battle=actBattle(battle,{type:'move',unitId:unit.id,x:tile.x,y:tile.y});assert.equal(battle.lastError,null);({campaign,battle}=syncBattleTime(campaign,battle));
 campaign=dispatchCampaign(campaign,{type:'talkNPC',npcId:npc.id,unitId:unit.id,approach:'dialogue',sectorState:battle});assert.equal(campaign.lastError,null);assert.equal(campaign.lastConversation.text,'Elegí tu camino.');
 campaign=dispatchCampaign(campaign,{type:'talkNPC',npcId:npc.id,unitId:unit.id,approach:'dialogue',dialogueNode:'start',dialogueChoice:'choice-1',sectorState:battle});assert.equal(campaign.lastError,null);assert.equal(decodeSave(encodeSave(campaign,battle)).campaign.lastConversation.text,'La posta está al norte.');
});


test('the editor authors choice conditions, protects character references, undoes and launches their real rules',async t=>{
 const m=await mount(t,JSON.stringify(dialoguePackage())),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Agregar condición'));await m.input(m.label('Desde el día'),2);await m.input(m.label('Hasta el día (opcional)'),3);await m.click(m.button('Agregar condición'));
 let field=m.document.querySelector('[aria-label="Condición 2"]');await m.input(field.querySelector('select'),'character');field=m.document.querySelector('[aria-label="Condición 2"]');await m.input(field.querySelectorAll('select')[1],'person-100');await m.input(field.querySelectorAll('select')[2],'serving');
 await m.click(m.button('Deshacer'));assert.equal(m.label('Estado requerido').value,'alive');await m.click(m.button('Rehacer'));assert.equal(m.label('Estado requerido').value,'serving');
 await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click([...m.document.querySelectorAll('.entry-list button')].find(b=>b.querySelector('small')?.textContent==='person-100'));await m.click(m.button('Eliminar'));assert.ok(draft().characters.some(c=>c.id==='person-100'));assert.match(m.document.body.textContent,/Quitá primero las apariciones y condiciones/);
 await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1),conditions=copy.encounter.dialogue.nodes[0].choices[0].conditions;
 assert.deepEqual(conditions,[{type:'day',min:2,max:3},{type:'character',character:'person-100',state:'serving'}]);await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(dialogueConditionsMet(campaign,conditions),false);
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:100,term:'month'});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'wait',hours:24});assert.equal(campaign.lastError,null);assert.equal(dialogueConditionsMet(campaign,conditions),true);campaign=dispatchCampaign(campaign,{type:'wait',hours:48});assert.equal(dialogueConditionsMet(campaign,conditions),false);assert.ok(decodeSave(encodeSave(campaign)));
});

test('the editor authors one-time payments, restores changes, copies them and launches the actual charge',async t=>{
 const m=await mount(t,JSON.stringify(dialoguePackage())),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.document.querySelector('[aria-label="Pago o recompensa"] input[type="checkbox"]'));await m.input(m.label('Operación de pesos'),'pay');await m.input(m.label('Importe en pesos'),125);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Importe en pesos').value,'100');await m.click(m.button('Rehacer'));assert.equal(m.label('Importe en pesos').value,'125');await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.deepEqual(copy.encounter.dialogue.nodes[0].choices[0].effects,[{type:'treasury',operation:'pay',amount:125}]);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'month'});campaign=dispatchCampaign(campaign,{type:'travel',sector:'cell-27-27'});campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour}),npc=battle.npcs.find(n=>n.contentId===copy.id),unit=battle.units.find(u=>u.side==='player'),tile=getReachable(battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(tile);if(tile.cost)battle=actBattle(battle,{type:'move',unitId:unit.id,x:tile.x,y:tile.y});assert.equal(battle.lastError,null);({campaign,battle}=syncBattleTime(campaign,battle));
 const cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,{type:'talkNPC',npcId:npc.id,unitId:unit.id,approach:'dialogue',dialogueNode:'start',dialogueChoice:'north',sectorState:battle});assert.equal(campaign.lastError,null);assert.equal(campaign.resources.treasury,cash-125);const saved=decodeSave(encodeSave(campaign,battle));assert.equal(saved.campaign.conversations[npc.id].dialogueReceipts[0].amount,-125);
});

test('the editor creates a quest, protects its references and launches an authored conditional start',async t=>{
 const m=await mount(t,JSON.stringify(dialoguePackage())),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Encargos'));await m.click(m.button('Crear encargo'));await m.input(m.label('Título del encargo'),'La posta nueva');await m.input(m.label('Objetivo del encargo'),'Llevá el parte a la posta.');await m.click(m.button('Deshacer'));assert.notEqual(m.label('Objetivo del encargo').value,'Llevá el parte a la posta.');await m.click(m.button('Rehacer'));assert.equal(m.label('Objetivo del encargo').value,'Llevá el parte a la posta.');await m.input(m.label('Plazo desde la aceptación (horas, opcional)'),1);await m.click(m.button('Deshacer'));assert.equal(m.label('Plazo desde la aceptación (horas, opcional)').value,'');await m.click(m.button('Rehacer'));assert.equal(m.label('Plazo desde la aceptación (horas, opcional)').value,'1');
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Agregar condición'));await m.input(m.label('Tipo de condición'),'quest');await m.input(m.label('Estado del encargo requerido'),'not-started');await m.click(m.document.querySelector('[aria-label="Resultado del encargo"] input'));assert.deepEqual(draft().characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects,[{type:'quest',quest:'quest-1',status:'active'}]);
 await m.click(m.button('Encargos'));assert.equal(m.button('Eliminar encargo').disabled,true);assert.match(m.document.body.textContent,/Usado por: Alma/);await m.click(m.button('Duplicar encargo'));assert.equal(m.button('Eliminar encargo').disabled,false);await m.click(m.button('Eliminar encargo'));assert.equal(draft().quests.length,1);await m.click(m.button('Deshacer'));assert.equal(draft().quests.length,2);await m.click(m.button('Rehacer'));assert.equal(draft().quests.length,1);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(contentQuestJournal(campaign),[]);campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'month'});campaign=dispatchCampaign(campaign,{type:'travel',sector:'cell-27-27'});campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour}),npc=battle.npcs.find(n=>n.contentId==='alma-contract'),unit=battle.units.find(u=>u.side==='player'),tile=getReachable(battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(tile);if(tile.cost)battle=actBattle(battle,{type:'move',unitId:unit.id,x:tile.x,y:tile.y});assert.equal(battle.lastError,null);({campaign,battle}=syncBattleTime(campaign,battle));
 campaign=dispatchCampaign(campaign,{type:'talkNPC',npcId:npc.id,unitId:unit.id,approach:'dialogue',dialogueNode:'start',dialogueChoice:'north',sectorState:battle});assert.equal(campaign.lastError,null);const saved=decodeSave(encodeSave(campaign,battle));assert.equal(contentQuestJournal(saved.campaign)[0].title,'La posta nueva');assert.equal(contentQuestJournal(saved.campaign)[0].status,'active');assert.equal(contentQuestJournal(saved.campaign)[0].remainingMinutes,60);
});

test('the editor configures required survivors, protects character references and preserves them through copy and launch',async t=>{
 const m=await mount(t,JSON.stringify(questPackage())),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Encargos'));await m.input(m.label('Personaje que debe sobrevivir'),'person-110');await m.click(m.button('Agregar personaje necesario'));assert.deepEqual(draft().quests[0].requiredAlive,['person-110']);await m.click(m.button('Deshacer'));assert.deepEqual(draft().quests[0].requiredAlive??[],[]);await m.click(m.button('Rehacer'));await m.click(m.button('Duplicar encargo'));assert.deepEqual(draft().quests[1].requiredAlive,['person-110']);
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.ok(draft().characters.some(c=>c.id==='person-110'));assert.match(m.document.body.textContent,/Quitá primero las apariciones y condiciones/);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(campaign.contentCampaign.package.quests.map(q=>q.requiredAlive),[['person-110'],['person-110']]);assert.deepEqual(contentQuestJournal(campaign),[]);
});

test('the editor authors dialogue movement with undo, copy, protected character references and campaign launch',async t=>{
 const {movementPackage}=await import('./dialogue-movement-fixture.mjs');const d=movementPackage();delete d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[0].choices[0].effects;
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));
 await m.click(m.document.querySelector('[aria-label="Movimiento en el sector"] input'));assert.equal(m.label('Personaje que viene').value,'pablo');assert.equal(m.label('Personaje que viene').options.length,1);
 await m.click(m.button('Deshacer'));assert.equal(m.document.querySelector('[aria-label="Movimiento en el sector"] input').checked,false);await m.click(m.button('Rehacer'));await m.click(m.button('Duplicar personaje'));assert.deepEqual(draft().characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects,[{type:'movement',character:'pablo',destination:'speaker'}]);
 await m.input(m.document.querySelector('input[type="search"]'),'pablo');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.ok(draft().characters.some(c=>c.id==='pablo'));
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.contentCampaign.package.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[0].choices[0].effects[0].character,'pablo');
});

test('the editor authors arrival conditions with undo, copy, protected references and launch',async t=>{
 const {arrivalPackage}=await import('./meeting-arrival-fixture.mjs');const d=arrivalPackage(),nodes=d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes;delete nodes[1].choices[0].conditions;nodes[0].choices[0].effects=nodes[0].choices[0].effects.filter(e=>e.type!=='movement');
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.input(m.label('Pasaje que estás editando'),'north');await m.click(m.button('Agregar condición'));await m.input(m.label('Tipo de condición'),'meeting');await m.input(m.label('Personaje que debe llegar'),'pablo');
 await m.click(m.button('Deshacer'));assert.equal(m.label('Personaje que debe llegar').value,'alma-contract');await m.click(m.button('Rehacer'));assert.equal(m.label('Personaje que debe llegar').value,'pablo');await m.click(m.button('Duplicar personaje'));assert.deepEqual(draft().characters.at(-1).encounter.dialogue.nodes[1].choices[0].conditions,[{type:'meeting',character:'pablo'}]);
 await m.input(m.document.querySelector('input[type="search"]'),'pablo');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.ok(draft().characters.some(c=>c.id==='pablo'));await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(campaign.contentCampaign.package.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].conditions,[{type:'meeting',character:'pablo'}]);
});
