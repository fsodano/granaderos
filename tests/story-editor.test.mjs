import {approachNPC} from './approach-npc.mjs';
import {withStoredGear,withCarriedAmmo,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {ammoCount} from '../game/ammo-types.js';
import {finishMilitiaTraining} from './campaign-wait-fixture.mjs';
import {questPackage} from './content-quest-fixture.mjs';
import {contentQuestJournal} from '../game/content-quests.js';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {dialogueConditionsMet} from '../game/dialogue-conditions.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {register} from 'node:module';
import {resolveObjectURL} from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useState,StrictMode} from '../web/node_modules/react/index.js';
import {defaultContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {CONTENT_LAUNCH_KEY,CONTENT_SAVE_KEY} from '../game/content-launch.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {initialCampaign,dispatchCampaign,rosterFor,CAMPAIGN_SECTORS,deploymentCost} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable,actionCosts} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
register('./tactical-render-loader.mjs',import.meta.url);
const draftKey='granaderos.content-draft.v1';

test('the editor authors named relationships with bounded choices, protected references, undo and saved campaign launch',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 const choose=async id=>{await m.input(m.document.querySelector('input[type="search"]'),id);await m.click(m.document.querySelector('.entry-list button'));};
 await choose('person-112');const before=draft();await m.click(m.button('Eliminar'));assert.deepEqual(draft(),before);assert.match(m.document.body.textContent,/Quitá o reasigná las relaciones de Inés Aguirre antes de eliminar a Gaspar Villalba/);
 await choose('person-107');
 const field=()=>m.document.querySelector('fieldset[aria-label="Rechazos de servicio"]');assert.ok(field());assert.equal(field().querySelector('select').value,'person-112');
 const preferred=()=>m.document.querySelector('fieldset[aria-label="Compañeros preferidos"]');assert.equal(preferred().querySelector('select').value,'person-116');assert.match(preferred().textContent,/Al iniciar un despliegue.*hasta \+3.*no supera \+5/);
 assert.equal(field().querySelector('option[value="person-116"]').disabled,true);assert.equal(preferred().querySelector('option[value="person-112"]').disabled,true);assert.equal(preferred().querySelector('option[value="person-107"]'),null);
 await m.click(m.button('Añadir compañero preferido'));await m.click(m.button('Añadir compañero preferido'));assert.equal(preferred().querySelectorAll('select').length,3);assert.equal(m.button('Añadir compañero preferido').disabled,true);assert.equal(preferred().querySelectorAll('select')[1].querySelector('option[value="person-116"]').disabled,true);
 await m.click(m.button('Quitar compañero preferido 3'));await m.click(m.button('Quitar compañero preferido 2'));
 await m.input(field().querySelector('select'),'person-3');await m.input(field().querySelector('textarea'),'Una diferencia de oficio dramatizada por el autor.');
 let preference=draft().characters.find(c=>c.id==='person-107').serviceRefusals[0];assert.equal(preference.character,'person-3');assert.match(preference.reason,/dramatizada/);
 await m.click(m.button('Deshacer'));assert.equal(field().querySelector('textarea').value,'Discrepan sobre el trato a los pacientes.');
 await m.click(m.button('Rehacer'));assert.match(field().querySelector('textarea').value,/dramatizada/);
 await m.input(preferred().querySelector('textarea'),'Confía en su ayuda, según la historia del autor.');const companion=draft().characters.find(c=>c.id==='person-107').preferredCompanions[0];
 await m.input(preferred().querySelector('textarea'),'');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);assert.deepEqual(draft().characters.find(c=>c.id==='person-107').preferredCompanions,[companion]);
 await choose('person-116');const protectedDraft=draft();await m.click(m.button('Eliminar'));assert.deepEqual(draft(),protectedDraft);assert.match(m.document.body.textContent,/Quitá o reasigná las relaciones de Inés Aguirre antes de eliminar a Petrona Lagos/);
 await choose('person-107');await m.click(m.button('Quitar compañero preferido 1'));await choose('person-116');await m.click(m.button('Eliminar'));assert.equal(draft().characters.some(c=>c.id==='person-116'),false);
 await m.click(m.button('Deshacer'));await m.click(m.button('Deshacer'));assert.ok(draft().characters.some(c=>c.id==='person-116'));assert.deepEqual(draft().characters.find(c=>c.id==='person-107').preferredCompanions,[companion]);
 await choose('person-107');await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.deepEqual(copy.preferredCompanions,[companion]);assert.deepEqual(copy.serviceRefusals,[preference]);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 assert.deepEqual(campaign.contentCampaign.package.characters.find(c=>c.id==='person-107').serviceRefusals,[preference]);
 assert.deepEqual(campaign.contentCampaign.package.characters.find(c=>c.id==='person-107').preferredCompanions,[companion]);assert.deepEqual(campaign.contentCampaign.package.characters.find(c=>c.id===copy.id).preferredCompanions,[companion]);
});

test('the editor removes a historical ability and assigns abilities to a new identity through undo, copy and campaign launch',async t=>{
 const m=await mount(t);const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 const ability=name=>[...m.document.querySelectorAll('fieldset[aria-label="Habilidades de combate"] label')].find(l=>l.textContent.startsWith(name)).querySelector('input');
 await m.input(m.document.querySelector('input[type="search"]'),'person-130');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(ability('Serenidad al cuidar').checked,true);assert.match(ability('Serenidad al cuidar').parentElement.textContent,/otra persona.*hasta 2.*PA.*vendas.*sí mismo/);
 assert.equal(ability('Temor al aislamiento').checked,true);assert.match(ability('Temor al aislamiento').parentElement.textContent,/moral menor que 50.*compañero militar capaz.*cuatro casillas.*misma superficie.*hasta 2.*turno de combate.*recuperación habitual ocurre primero/);
 const cejasAbilities=[...draft().characters.find(c=>c.id==='person-130').abilities];
 await m.click(ability('Serenidad al cuidar'));assert.deepEqual(draft().characters.find(c=>c.id==='person-130').abilities,cejasAbilities.filter(id=>id!=='care_composure'));await m.click(m.button('Deshacer'));assert.equal(ability('Serenidad al cuidar').checked,true);
 await m.click(ability('Temor al aislamiento'));assert.deepEqual(draft().characters.find(c=>c.id==='person-130').abilities,cejasAbilities.filter(id=>id!=='nervous_isolation'));await m.click(m.button('Deshacer'));assert.equal(ability('Temor al aislamiento').checked,true);
 await m.input(m.document.querySelector('input[type="search"]'),'person-126');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(ability('Temor a lugares cerrados').checked,true);assert.match(ability('Temor a lugares cerrados').parentElement.textContent,/paredes y techo intactos.*hasta 2.*recuperación habitual.*brecha/);
 await m.click(ability('Temor a lugares cerrados'));assert.deepEqual(draft().characters.find(c=>c.id==='person-126').abilities,[]);await m.click(m.button('Deshacer'));assert.equal(ability('Temor a lugares cerrados').checked,true);
 await m.input(m.document.querySelector('input[type="search"]'),'person-3');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(ability('Objeción por daño a civiles').disabled,true);assert.equal(ability('Objeción por daño a civiles').checked,false);assert.match(ability('Objeción por daño a civiles').title,/candidatos por contrato/);
 assert.equal(ability('Protección de compañeros').checked,true);await m.click(ability('Protección de compañeros'));assert.ok(!draft().characters.find(c=>c.id==='person-3').abilities.includes('bodyguard'));
 await m.click([...m.document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear personaje')));
 assert.equal(m.document.querySelectorAll('fieldset[aria-label="Habilidades de combate"] input:checked').length,0);
 await m.input(m.label('Nombre'),'Alma Nueva');await m.click(ability('Protección de compañeros'));await m.click(ability('Atención rápida'));
 await m.click(m.button('Deshacer'));assert.equal(ability('Atención rápida').checked,false);await m.click(m.button('Rehacer'));assert.equal(ability('Atención rápida').checked,true);await m.click(ability('Serenidad al cuidar'));
 await m.click(ability('Temor al aislamiento'));await m.click(ability('Temor a lugares cerrados'));
 assert.equal(ability('Objeción por daño a civiles').disabled,false);await m.click(ability('Objeción por daño a civiles'));await m.click(m.button('Deshacer'));assert.equal(ability('Objeción por daño a civiles').checked,false);await m.click(m.button('Rehacer'));assert.equal(ability('Objeción por daño a civiles').checked,true);
 await m.click(m.button('Duplicar personaje'));const c=draft().characters.at(-1);assert.deepEqual(c.abilities,['bodyguard','rapid_first_aid','care_composure','nervous_isolation','enclosed_room_fear','civilian_conscience']);
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
 await m.click(m.button('Eliminar'));assert.match(m.document.body.textContent,/Elegí capítulos propios en Reglas/);
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

async function mount(t,stored,launch=null,recruitCampaign=null,view='recruitment',{strict=false}={}){
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
 const {default:Treasury}=await import('../web/app/Treasury.tsx');
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));
 let mounted=true;
 const unmount=async()=>{if(!mounted)return;await act(async()=>root.unmount());mounted=false;};
 t.after(async()=>{try{await unmount();}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 let current=recruitCampaign;
 function HiringScreen(){const [campaign,setCampaign]=useState(recruitCampaign);current=campaign;return h(view==='armory'?Armory:view==='treasury'?Treasury:Recruitment,{state:campaign,dispatch:action=>setCampaign(s=>dispatchCampaign(s,action))});}
 const Component=recruitCampaign?HiringScreen:launch?(await import('../web/app/page.tsx')).default:StoryEditor;
 await act(async()=>root.render(strict?h(StrictMode,null,h(Component)):h(Component)));
 const document=dom.window.document;
 return {dom,document,unmount,get campaign(){return current;},
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

test('the mounted export dialog offers the edited canonical package for download and copy without changing the draft or edit history',async t=>{
 const m=await mount(t);await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click(m.document.querySelector('.entry-list button'));
 const originalName=m.label('Nombre').value;await m.input(m.label('Nombre'),'Alma de la exportación');
 const stored=m.dom.window.localStorage.getItem(draftKey),content=parseContentPackage(stored),canonical=encodeContentPackage(content),copied=[];
 Object.defineProperty(m.dom.window.navigator,'clipboard',{configurable:true,value:{writeText:async text=>copied.push(text)}});
 await m.click(m.button('Exportar contenido'));
 const dialog=m.document.querySelector('[role="dialog"]');assert.ok(dialog);assert.match(dialog.textContent,/Guardá el archivo o copiá el JSON/);
 const json=dialog.querySelector('textarea[aria-label="JSON del contenido"]');assert.ok(json);assert.equal(json.readOnly,true);assert.equal(json.value,canonical);assert.deepEqual(parseContentPackage(json.value),content);
 const download=dialog.querySelector('a[download]');assert.ok(download);assert.equal(download.textContent,'Descargar JSON');assert.equal(download.download,`${content.id}.json`);assert.match(download.href,/^blob:/);
 const file=resolveObjectURL(download.href);assert.ok(file);assert.equal(file.type,'application/json');assert.equal(await file.text(),canonical);
 const status=dialog.querySelector('[role="status"]');assert.ok(status,'copy feedback is inside the active dialog');assert.equal(status.getAttribute('aria-live'),'polite');assert.equal(status.textContent,'');
 await m.click(download);await m.click(m.button('Copiar JSON'));assert.deepEqual(copied,[canonical]);assert.equal(status.textContent,'JSON copiado.');
 Object.defineProperty(m.dom.window.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard denied');}}});
 await m.click(m.button('Copiar JSON'));assert.equal(status.textContent,'Seleccioná el texto y copialo con el teclado.');assert.equal(json.value,canonical);assert.equal(await resolveObjectURL(download.href).text(),canonical);
 assert.equal(m.dom.window.localStorage.getItem(draftKey),stored);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
 await m.click(m.button('Cerrar exportación'));assert.equal(m.document.querySelector('[role="dialog"]'),null);assert.equal(m.label('Nombre').value,'Alma de la exportación');assert.equal(m.dom.window.localStorage.getItem(draftKey),stored);
 await m.click(m.button('Exportar contenido'));assert.equal(m.document.querySelector('[role="dialog"] [role="status"]').textContent,'');await m.click(m.button('Cerrar exportación'));assert.equal(m.dom.window.localStorage.getItem(draftKey),stored);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Nombre').value,originalName);await m.click(m.button('Rehacer'));assert.equal(m.label('Nombre').value,'Alma de la exportación');
});

test('Strict Mode exports keep their real files available only while open and release every URL after close or unmount',async t=>{
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL,created=[],revoked=[];
 URL.createObjectURL=blob=>{const url=create.call(URL,blob);created.push(url);return url;};
 URL.revokeObjectURL=url=>{revoked.push(url);revoke.call(URL,url);};
 t.after(()=>{URL.createObjectURL=create;URL.revokeObjectURL=revoke;for(const url of created)revoke.call(URL,url);});
 const m=await mount(t,undefined,null,null,'recruitment',{strict:true});
 const stored=m.dom.window.localStorage.getItem(draftKey),canonical=encodeContentPackage(parseContentPackage(stored));
 for(let i=0;i<3;i++){
  await m.click(m.button('Exportar contenido'));
  const url=m.document.querySelector('[role="dialog"] a[download]').href;
  assert.equal(await resolveObjectURL(url).text(),canonical,'the offered file retains the actual canonical package');
  await m.click(m.button('Cerrar exportación'));
  assert.equal(resolveObjectURL(url),undefined);
  assert.ok(created.every(url=>revoked.includes(url)),'closing releases discarded Strict Mode render URLs too');
  assert.equal(m.dom.window.localStorage.getItem(draftKey),stored);
 }
 await m.click(m.button('Exportar contenido'));
 const url=m.document.querySelector('[role="dialog"] a[download]').href;
 assert.ok(resolveObjectURL(url));await m.unmount();
 assert.ok(created.length>=4);
 assert.ok(created.every(url=>revoked.includes(url)&&resolveObjectURL(url)===undefined),'unmount releases the final open file and every earlier allocation');
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
 const m=await mount(t);await m.click(m.button('Armas'));
 const definitions=defaultContentPackage().weapons;
 assert.equal(m.document.querySelectorAll('.entry-list img').length,definitions.length);
 for(const img of m.document.querySelectorAll('.entry-list img'))assert.match(img.getAttribute('src'),/^\/art\/weapon-18(0[0-9]|1[0-3])\.png$/);
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
 const inbox=m.document.querySelector('[aria-label="Correspondencia recibida"]');assert.ok(inbox);assert.match(inbox.textContent,/Todavía no recibiste correspondencia/);
 assert.equal(m.document.querySelector('.contact-list'),null,'received mail does not advertise a character directory');
 assert.ok(!inbox.textContent.includes(definition.characters.find(c=>c.id==='person-100').name));
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
 const m=await mount(t);await m.click(m.button('Armas'));await m.click(m.button('+ Crear arma'));
 await m.input(m.label('Nombre'),'Pistola de prueba');
 await m.input(m.label('Familia de funcionamiento'),'1805');
 await m.input(m.label('Daño'),37);await m.input(m.label('Capacidad de carga'),3);await m.input(m.label('Peso (kg)'),2);await m.input(m.label('Precio (pesos)'),180);
 const file=new m.dom.window.File([Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL5kAAAAASUVORK5CYII=','base64'))],'weapon.png',{type:'image/png'});
 const input=m.document.querySelector('input[aria-label="Imagen del arma"]');Object.defineProperty(input,'files',{configurable:true,value:[file]});
 await act(async()=>{input.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,30));});
 let draft=parseContentPackage(m.dom.window.localStorage.getItem(draftKey));const weapon=draft.weapons.find(w=>w.name==='Pistola de prueba');assert.ok(weapon);assert.match(weapon.art,/^data:image\/png;base64,/);
 assert.equal(m.document.querySelector('.weapon-preview').getAttribute('src'),weapon.art);
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'person-100');await m.click(m.document.querySelector('.entry-list button'));
 await m.input(m.label('Arma principal'),weapon.id);await m.click(m.button('Iniciar campaña con estas fichas'));
 let campaign=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const restored=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle))),unit=restored.battle.units.find(u=>u.id==='100');
 assert.equal(unit.loaded,3);assert.equal(unit.weaponMetadata.contentWeapon.damage,37);assert.equal(unit.weaponMetadata.contentWeapon.art,weapon.art);
});

test('an isolated retained armory equips declared owned authored gear while public purchase stays closed',async t=>{
 const d=defaultContentPackage();d.weapons.push({...d.weapons.find(w=>w.template===1805),id:'pistola-editor',name:'Pistola del editor',damage:70,price:200,art:'/art/weapon-1808.png'});
 let s=initialCampaign(5,d);s=dispatchCampaign(s,{type:'recruitCivic',id:100,term:'week'});s=dispatchCampaign(s,{type:'wait',hours:6});assert.equal(s.lastError,null);
 s=withStoredGear(s,'pistola-editor');const m=await mount(t,undefined,null,s,'armory');
 const article=[...m.document.querySelectorAll('.armory-catalog article')].find(a=>a.textContent.includes('Pistola del editor'));assert.ok(article);assert.equal(article.querySelector('img').getAttribute('src'),'/art/weapon-1808.png');
 const before=structuredClone(m.campaign);await m.click(article.querySelector('button'));assert.match(m.campaign.lastError,/comercio de equipo/);assert.deepEqual({...m.campaign,lastError:null},before);
 const item=m.campaign.armoryItems.find(i=>i.itemMetadata?.contentWeapon?.id==='pistola-editor');assert.ok(item);
 await m.input(m.document.querySelector('#armory-weapon'),item.id);assert.equal(m.campaign.lastError,null);
 const saved=decodeSave(encodeSave(m.campaign)).campaign;assert.equal(saved.operativeState[100].weaponMetadata.contentWeapon.id,'pistola-editor');assert.equal(saved.armory['pistola-editor'],0);
 assert.match(m.document.querySelector('#armory-weapon').selectedOptions[0].textContent,/Pistola del editor/);
});

test('the editor assigns troop firearms with undo, dependency protection and a real attack launch',async t=>{
 const d=defaultContentPackage();d.weapons.push({...d.weapons.find(w=>w.template===1805),id:'tropa-editor',name:'Arma de las tropas',capacity:4,damage:67,art:'/art/weapon-1808.png'});
 const m=await mount(t,JSON.stringify(d));await m.click(m.button('Armas'));
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
 const m=await mount(t,JSON.stringify(d));await m.click(m.button('Armas'));assert.match(m.document.querySelector('section[aria-label="Armamento de las tropas"]').textContent,/armas originales/);
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

test('the editor declares a fixed unarmed noncombatant through eligibility, undo, copy and an official saved encounter',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Crear habitante'));await m.input(m.label('Nombre'),'Elena de la Posta');
 const civilian=()=>[...m.document.querySelectorAll('label')].find(l=>l.textContent.includes('Civil no combatiente')).querySelector('input');
 assert.equal(civilian().disabled,true,'an unplaced resident is ineligible');await m.click(m.button('Configurar aparición'));await m.input(m.label('Ubicación'),'fixed');assert.equal(civilian().disabled,true,'the new resident still carries its declared blade');await m.input(m.label('Arma blanca'),'');
 assert.equal(civilian().disabled,false);await m.click(civilian());assert.equal(draft().characters.at(-1).encounter.noncombatant,true);
 await m.click(m.button('Deshacer'));assert.equal(civilian().checked,false);await m.click(m.button('Rehacer'));assert.equal(civilian().checked,true);
 const recruitable=[...m.document.querySelectorAll('label')].find(l=>l.textContent.includes('Puede incorporarse a la escuadra')).querySelector('input');await m.click(recruitable);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true,'a recruitable civilian declaration is rejected by the shared schema');
 await m.click(m.button('Deshacer'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.input(m.label('Arma principal'),'firearm-1800');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true,'an armed declaration is rejected');
 await m.click(m.button('Deshacer'));assert.equal(civilian().checked,true);await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.equal(copy.encounter.noncombatant,true);assert.equal(copy.weapon,null);assert.equal(copy.encounter.recruitable,false);assert.equal(draft().placements.at(-1).mode,'fixed');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id);
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week'});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const saved=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle))),npc=saved.battle.npcs.find(n=>n.operativeId===id);assert.ok(npc);assert.equal(npc.noncombatant,true);assert.equal(npc.weapon,undefined);assert.equal(npc.recruitable,false);assert.equal(npc.name,copy.name);
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
 const principle=[...m.document.querySelectorAll('fieldset[aria-label="Habilidades de combate"] label')].find(l=>l.textContent.startsWith('Objeción por daño a civiles')).querySelector('input');assert.equal(principle.disabled,false,'explicit paid world service is admitted by the same model predicate');await m.click(principle);
 await m.input(m.label('Tipo de servicio'),'permanent');assert.equal(m.label('Paga mensual').value,'0');assert.equal(m.label('Paga mensual').disabled,true);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true,'the retained contract-only condition cannot launch with permanent service');
 await m.click(m.button('Deshacer'));assert.equal(m.label('Tipo de servicio').value,'contract');assert.equal(m.label('Paga mensual').value,'90');
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.equal(copy.service,'contract');assert.equal(copy.monthlyPay,90);assert.equal(copy.recruitmentSource,'encounter');assert.equal(copy.arrivalHours,undefined);assert.deepEqual(copy.abilities,['civilian_conscience']);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id),op=rosterFor(campaign).find(o=>o.id===id);assert.equal(op.service,'contract');assert.equal(op.monthlyPay,90);assert.equal(op.recruitmentSource,'encounter');assert.deepEqual(op.abilities,['civilian_conscience']);
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
 let battle=enterSector(campaign.pendingBattle),npc=battle.npcs.find(n=>n.contentId===copy.id),unit=battle.units.find(u=>u.side==='player');battle=approachNPC(battle,unit.id,npc.id);({campaign,battle}=syncBattleTime(campaign,battle));
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
 let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour}),npc=battle.npcs.find(n=>n.contentId===copy.id),unit=battle.units.find(u=>u.side==='player');battle=approachNPC(battle,unit.id,npc.id);({campaign,battle}=syncBattleTime(campaign,battle));
 const cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,{type:'talkNPC',npcId:npc.id,unitId:unit.id,approach:'dialogue',dialogueNode:'start',dialogueChoice:'north',sectorState:battle});assert.equal(campaign.lastError,null);assert.equal(campaign.resources.treasury,cash-125);const saved=decodeSave(encodeSave(campaign,battle));assert.equal(saved.campaign.conversations[npc.id].dialogueReceipts[0].amount,-125);
});

test('the editor creates a quest, protects its references and launches an authored conditional start',async t=>{
 const m=await mount(t,JSON.stringify(dialoguePackage())),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Encargos'));await m.click(m.button('Crear encargo'));await m.input(m.label('Título del encargo'),'La posta nueva');await m.input(m.label('Objetivo del encargo'),'Llevá el parte a la posta.');await m.click(m.button('Deshacer'));assert.notEqual(m.label('Objetivo del encargo').value,'Llevá el parte a la posta.');await m.click(m.button('Rehacer'));assert.equal(m.label('Objetivo del encargo').value,'Llevá el parte a la posta.');await m.input(m.label('Plazo desde la aceptación (horas, opcional)'),1);await m.click(m.button('Deshacer'));assert.equal(m.label('Plazo desde la aceptación (horas, opcional)').value,'');await m.click(m.button('Rehacer'));assert.equal(m.label('Plazo desde la aceptación (horas, opcional)').value,'1');
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Agregar condición'));await m.input(m.label('Tipo de condición'),'quest');await m.input(m.label('Estado del encargo requerido'),'not-started');await m.click(m.document.querySelector('[aria-label="Resultado del encargo"] input'));assert.deepEqual(draft().characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects,[{type:'quest',quest:'quest-1',status:'active'}]);
 await m.click(m.button('Encargos'));assert.equal(m.button('Eliminar encargo').disabled,true);assert.match(m.document.body.textContent,/Usado por: Alma/);await m.click(m.button('Duplicar encargo'));assert.equal(m.button('Eliminar encargo').disabled,false);await m.click(m.button('Eliminar encargo'));assert.equal(draft().quests.length,1);await m.click(m.button('Deshacer'));assert.equal(draft().quests.length,2);await m.click(m.button('Rehacer'));assert.equal(draft().quests.length,1);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(contentQuestJournal(campaign),[]);campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'month'});campaign=dispatchCampaign(campaign,{type:'travel',sector:'cell-27-27'});campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 let battle=enterSector({...campaign.pendingBattle,hour:campaign.hour}),npc=battle.npcs.find(n=>n.contentId==='alma-contract'),unit=battle.units.find(u=>u.side==='player');battle=approachNPC(battle,unit.id,npc.id);({campaign,battle}=syncBattleTime(campaign,battle));
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

test('the editor authors return to routine through undo, copy and campaign launch',async t=>{
 const {releasePackage}=await import('./meeting-release-fixture.mjs');const d=releasePackage(),choice=d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0];choice.effects=choice.effects.filter(e=>e.type!=='movement');
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.input(m.label('Pasaje que estás editando'),'north');await m.click(m.document.querySelector('[aria-label="Movimiento en el sector"] input'));await m.input(m.label('Orden del personaje'),'routine');assert.equal(m.label('Personaje que retoma su rutina').value,'pablo');await m.input(m.label('Personaje que retoma su rutina'),'alma-contract');assert.equal(draft().characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].effects.find(e=>e.type==='movement').character,'alma-contract');await m.click(m.button('Deshacer'));
 await m.click(m.button('Deshacer'));assert.equal(m.label('Orden del personaje').value,'speaker');await m.click(m.button('Rehacer'));assert.equal(m.label('Orden del personaje').value,'routine');await m.click(m.button('Duplicar personaje'));assert.deepEqual(draft().characters.at(-1).encounter.dialogue.nodes[1].choices[0].effects.find(e=>e.type==='movement'),{type:'movement',character:'pablo',destination:'routine'});
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(campaign.contentCampaign.package.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].effects.find(e=>e.type==='movement'),{type:'movement',character:'pablo',destination:'routine'});
});

test('the editor creates and assigns a blade with undo, dependency protection and campaign launch',async t=>{
 const m=await mount(t);const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.click(m.button('Armas'));await m.click(m.button('Crear arma blanca'));await m.input(m.label('Nombre'),'Lanza de prueba');await m.input(m.label('Familia de funcionamiento'),'1812');
 await m.input(m.label('Daño'),37);await m.input(m.label('PA de ataque'),19);await m.input(m.label('Alcance cuerpo a cuerpo'),2.7);await m.input(m.label('Peso (kg)'),2);await m.input(m.label('Precio (pesos)'),95);
 assert.equal(m.document.querySelector('.weapon-preview').getAttribute('src'),'/art/weapon-1812.png');assert.ok(!m.document.body.textContent.includes('Capacidad de carga'));
 await m.click(m.button('Deshacer'));assert.notEqual(m.label('Precio (pesos)').value,'95');await m.click(m.button('Rehacer'));assert.equal(m.label('Precio (pesos)').value,'95');
 const blade=draft().weapons.at(-1);assert.equal(blade.reach,2.7);assert.ok(m.label('Oficiales enemigos').querySelector(`option[value="${blade.id}"]`));
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));await m.input(m.label('Arma blanca'),blade.id);
 await m.click(m.button('Duplicar personaje'));assert.equal(draft().characters.at(-1).blade,blade.id);
 await m.click(m.button('Armas'));await m.input(m.document.querySelector('input[type="search"]'),blade.id);await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.match(m.document.querySelector('.notice').textContent,/personajes que la usan/);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'visitSector'}]){campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);}
 const saved=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle))),unit=saved.battle.units.find(u=>u.id==='110');assert.equal(unit.bladeMetadata.contentWeapon.id,blade.id);assert.equal(unit.bladeMetadata.contentWeapon.ap,19);assert.equal(unit.bladeMetadata.contentWeapon.reach,2.7);
});

test('an isolated retained armory equips a finite authored blade while public purchase stays closed',async t=>{
 const d=defaultContentPackage();d.weapons.push({id:'sable-editor',template:1809,name:'Sable del editor',damage:29,ap:11,reach:1.6,price:73,art:'/art/weapon-1810.png'});
 let s=initialCampaign(5,d);s=dispatchCampaign(s,{type:'recruitCivic',id:110,term:'week'});s=dispatchCampaign(s,{type:'wait',hours:6});s=withStoredGear(s,'sable-editor');const before=structuredClone(s);
 const m=await mount(t,undefined,null,s,'armory');const article=[...m.document.querySelectorAll('.armory-catalog article')].find(a=>a.textContent.includes('Sable del editor'));assert.ok(article);assert.equal(article.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');await m.click(article.querySelector('button'));assert.match(m.campaign.lastError,/comercio de equipo/);assert.deepEqual({...m.campaign,lastError:null},before);
 const instance=m.campaign.armoryItems.find(i=>i.itemMetadata?.contentWeapon?.id==='sable-editor');await m.input(m.document.querySelector('#armory-blade'),instance.id);assert.match(m.document.querySelector('#armory-blade option[value="equipped"]').textContent,/Sable del editor/);assert.equal(decodeSave(encodeSave(m.campaign)).campaign.operativeState[110].bladeMetadata.contentWeapon.id,'sable-editor');
});

test('the editor configures both troop slots, protects references and launches actual blade-equipped enemies',async t=>{
 const d=defaultContentPackage();d.weapons.push({id:'lanza-editor',template:1812,name:'Lanza del ejército',damage:27,ap:19,reach:2.5});
 const m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Armas'));
 await m.input(m.label('Infantería enemiga'),'lanza-editor');await m.click(m.button('Configurar armas blancas de enemigos'));await m.click(m.button('Configurar armas blancas de milicias'));
 await m.input(m.label('Arma blanca · Oficiales enemigos'),'lanza-editor');await m.input(m.label('Arma blanca · Montoneros'),'lanza-editor');await m.input(m.label('Arma blanca · Veteranos enemigos'),'');
 assert.equal(draft().oppositionBlades.veteran,null);await m.click(m.button('Deshacer'));assert.equal(draft().oppositionBlades.veteran,'blade-1811');await m.click(m.button('Rehacer'));assert.equal(draft().oppositionBlades.veteran,null);
 assert.equal(m.label('Arma blanca · Oficiales enemigos').querySelector('option[value="firearm-1800"]'),null);
 await m.input(m.document.querySelector('input[type="search"]'),'lanza-editor');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.match(m.document.querySelector('.notice').textContent,/tropas que la usan/);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'attack',sector:'buenos_aires'}]){campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);}
 const pair=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle)));assert.equal(pair.battle.units.find(u=>u.id==='enemy-0').bladeMetadata.contentWeapon.id,'lanza-editor');const line=pair.battle.units.find(u=>u.id==='enemy-1');assert.equal(line.weaponMetadata.contentWeapon.id,'lanza-editor');assert.deepEqual([line.loaded,line.ammo,line.priming],[0,0,undefined]);
});

test('the editor configures initial money and ammunition, validates limits and preserves rules through undo and launch',async t=>{
 const old=defaultContentPackage();delete old.rules;const m=await mount(t,JSON.stringify(old));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));
 assert.equal(m.label('Fondos iniciales (pesos)').value,'3200');await m.input(m.label('Fondos iniciales (pesos)'),9000);await m.input(m.label('Cartuchos por combatiente de la escuadra'),3);await m.input(m.label('Cartuchos por enemigo nuevo'),7);await m.input(m.label('Cartuchos por miliciano nuevo'),5);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Cartuchos por miliciano nuevo').value,'6');await m.click(m.button('Rehacer'));assert.equal(m.label('Cartuchos por miliciano nuevo').value,'5');
 await m.input(m.label('Cartuchos por enemigo nuevo'),101);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.input(m.label('Cartuchos por enemigo nuevo'),7);
 await m.click(m.button('Restaurar fondos y cartuchos originales'));assert.equal(m.label('Fondos iniciales (pesos)').value,'3200');await m.click(m.button('Deshacer'));assert.equal(m.label('Fondos iniciales (pesos)').value,'9000');assert.deepEqual(draft().rules,{startingTreasury:9000,deploymentCartridges:3,enemyCartridges:7,militiaCartridges:5});
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.resources.treasury,9000);
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'attack',sector:'buenos_aires'}]){campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);}
 const pair=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle)));assert.equal(pair.battle.units.find(u=>u.id==='110').loaded+pair.battle.units.find(u=>u.id==='110').ammo,3);assert.ok(pair.battle.units.filter(u=>u.side==='enemy').every(u=>u.loaded+u.ammo===7));
});

test('the editor authors initial control and loyalty, restores older defaults and launches real arrival options',async t=>{
 const d=defaultContentPackage();delete d.startingTerritory;const m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.click(m.button('Reglas'));const control=id=>m.document.querySelector(`[aria-label="Control inicial de ${CAMPAIGN_SECTORS.find(s=>s.id===id).name}"]`),loyalty=id=>m.document.querySelector(`[aria-label="Lealtad inicial de ${CAMPAIGN_SECTORS.find(s=>s.id===id).name}"]`);
 assert.equal(control('retiro').value,'patriot');assert.equal(control('retiro').disabled,true);assert.equal(control('mendoza').value,'royalist');await m.input(control('mendoza'),'patriot');await m.input(loyalty('mendoza'),91);assert.equal(draft().startingTerritory.mendoza.loyalty,91);
 await m.click(m.button('Deshacer'));assert.equal(loyalty('mendoza').value,'25');await m.click(m.button('Rehacer'));assert.equal(loyalty('mendoza').value,'91');await m.input(loyalty('mendoza'),101);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.input(loyalty('mendoza'),91);
 await m.click(m.button('Restaurar territorio original'));assert.equal(control('mendoza').value,'royalist');await m.click(m.button('Deshacer'));assert.equal(control('mendoza').value,'patriot');assert.equal(loyalty('mendoza').value,'91');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(campaign.sectors.mendoza,{owner:'patriot',loyalty:91,militia:[0,0,0],damageUntil:0,fort:0});assert.equal(campaign.resources.treasury,3200);
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week',destination:'mendoza'});assert.equal(campaign.lastError,null);assert.equal(campaign.hiringArrivals[0].destination,'mendoza');campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);assert.equal(campaign.operativeState[110].location,'mendoza');assert.equal(decodeSave(encodeSave(campaign)).campaign.sectors.mendoza.owner,'patriot');
});

test('the editor chooses a headquarters, keeps it controlled and launches the actual paid arrival there',async t=>{
 const m=await mount(t);const control=id=>m.document.querySelector(`[aria-label="Control inicial de ${CAMPAIGN_SECTORS.find(s=>s.id===id).name}"]`);
 await m.click(m.button('Reglas'));assert.ok(![...m.label('Cuartel general').options].some(o=>['uspallata','los_patos'].includes(o.value)));await m.input(m.label('Cuartel general'),'salta');assert.equal(control('salta').disabled,true);assert.equal(control('salta').value,'patriot');assert.equal(control('retiro').disabled,false);await m.input(control('retiro'),'royalist');
 await m.click(m.button('Restaurar territorio original'));assert.equal(m.label('Cuartel general').value,'retiro');await m.click(m.button('Deshacer'));assert.equal(m.label('Cuartel general').value,'salta');assert.equal(control('retiro').value,'royalist');await m.click(m.button('Deshacer'));assert.equal(control('retiro').value,'patriot');await m.click(m.button('Rehacer'));assert.equal(control('retiro').value,'royalist');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.location,'salta');assert.equal(campaign.squads[0].location,'salta');assert.equal(campaign.sectors.retiro.owner,'royalist');campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week'});assert.equal(campaign.lastError,null);assert.equal(campaign.hiringArrivals[0].destination,'salta');campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);assert.equal(campaign.phase,1);assert.equal(campaign.operativeState[110].location,'salta');assert.ok(decodeSave(encodeSave(campaign)));
});

test('the editor authors import port and delivery times with undo, validation and a saved launch without trade admission',async t=>{
 const d=defaultContentPackage();delete d.imports;const m=await mount(t,JSON.stringify(d));await m.click(m.button('Reglas'));assert.equal(m.label('Puerto de importación').value,'ensenada');assert.equal(m.label('Plazo mínimo de importación (horas)').value,'72');
 await m.input(m.label('Cuartel general'),'buenos_aires');await m.input(m.label('Puerto de importación'),'buenos_aires');await m.input(m.label('Plazo mínimo de importación (horas)'),2);await m.input(m.label('Plazo máximo de importación (horas)'),2);await m.click(m.button('Deshacer'));assert.equal(m.label('Plazo máximo de importación (horas)').value,'120');await m.click(m.button('Rehacer'));await m.input(m.label('Plazo mínimo de importación (horas)'),3);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.input(m.label('Plazo mínimo de importación (horas)'),2);
 await m.click(m.button('Restaurar importaciones originales'));assert.equal(m.label('Puerto de importación').value,'ensenada');await m.click(m.button('Deshacer'));assert.equal(m.label('Puerto de importación').value,'buenos_aires');await m.input(m.label('Puerto de importación'),'');assert.equal(parseContentPackage(m.dom.window.localStorage.getItem(draftKey)).imports.port,null);await m.click(m.button('Deshacer'));
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(campaign.contentCampaign.package.imports,{port:'buenos_aires',minHours:2,maxHours:2});assertTradeRejected(campaign,{type:'purchaseEquipment',item:'firearm-1802'});assert.equal(campaign.equipmentShipments.length,0);assert.ok(decodeSave(encodeSave(campaign)));
});

test('an isolated retained import widget describes its pinned port but public purchase stays closed',async t=>{
 const d=defaultContentPackage();d.headquarters='buenos_aires';d.startingTerritory.buenos_aires.owner='patriot';d.imports={port:'buenos_aires',minHours:2,maxHours:4};const m=await mount(t,undefined,null,initialCampaign(8,d),'armory');assert.match(m.document.body.textContent,/Las armas importadas llegan a Buenos Aires.*en 2 a 4 horas/);
 const button=[...m.document.querySelectorAll('.armory-catalog article')].find(a=>a.textContent.includes('Baker')).querySelector('button');assert.equal(button.disabled,false);const before=structuredClone(m.campaign);await m.click(button);assert.match(m.campaign.lastError,/comercio de equipo/);assert.deepEqual({...m.campaign,lastError:null},before);assert.equal(m.campaign.equipmentShipments.length,0);assert.ok(decodeSave(encodeSave(m.campaign)));
});

for(const mode of ['disabled','occupied','blockade'])test(`an isolated retained armory describes ${mode} imports while public local purchase stays closed`,async t=>{
 const d=defaultContentPackage();d.headquarters='buenos_aires';d.startingTerritory.buenos_aires.owner='patriot';d.startingTerritory.san_nicolas.owner='patriot';d.imports={port:mode==='disabled'?null:'san_nicolas',minHours:2,maxHours:2};let s=initialCampaign(8,d);
 if(mode!=='disabled'){if(mode==='occupied')s.sectors.san_nicolas.owner='royalist';else s.blockade=true;}
 const m=await mount(t,undefined,null,s,'armory'),articles=[...m.document.querySelectorAll('.armory-catalog article')],imported=articles.find(a=>a.textContent.includes('Baker')).querySelector('button');assert.equal(imported.disabled,mode!=='blockade');assert.match(m.document.body.textContent,mode==='disabled'?/no admite pedidos/:mode==='occupied'?/Las importaciones requieren San Nicolás de los Arroyos bajo control patriota/:/los bloqueos y la ocupación del puerto demoran la entrega/);assert.equal(m.campaign.equipmentShipments.length,0);
 const local=articles.find(a=>a.textContent.includes(d.weapons.find(w=>w.id==='firearm-1801').name)).querySelector('button');assert.equal(local.disabled,false);const before=structuredClone(m.campaign);await m.click(local);assert.match(m.campaign.lastError,/comercio de equipo/);assert.deepEqual({...m.campaign,lastError:null},before);assert.ok(decodeSave(encodeSave(m.campaign)));
});

test('the mounted editor creates, orders, undoes and launches authored campaign chapters and restores the original progression',async t=>{
 const m=await mount(t);await m.click(m.button('Reglas'));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.label('Avance de la historia'),'authored');await m.input(m.label('Introducción de campaña'),'El puesto necesita una escuadra.');await m.input(m.label('Texto de victoria'),'La guardia está lista.');await m.input(m.label('Texto de derrota'),'Se perdió la guardia.');await m.input(m.label('Nombre del capítulo'),'Llegada de Sosa');await m.input(m.label('Objetivo visible'),'Contratá a Sosa y esperá su llegada.');
 await m.input(m.label('Tipo de condición'),'character');await m.input(m.label('Personaje de la condición'),'person-100');await m.input(m.label('Estado requerido'),'serving');
 assert.ok(![...m.label('Tipo de condición').options].some(o=>o.value==='meeting'));
 await m.click(m.button('Agregar capítulo'));assert.equal(draft().campaignStory.chapters.length,2);await m.click(m.button('Subir capítulo 2'));assert.equal(draft().campaignStory.chapters[1].name,'Llegada de Sosa');await m.click(m.button('Deshacer'));assert.equal(draft().campaignStory.chapters[0].name,'Llegada de Sosa');await m.click(m.button('Rehacer'));assert.equal(draft().campaignStory.chapters[1].name,'Llegada de Sosa');await m.click(m.button('Eliminar capítulo 1'));
 await m.click(m.button('Quitar condición 1'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
 await m.input(m.label('Avance de la historia'),'original');assert.equal(draft().campaignStory,null);await m.click(m.button('Deshacer'));assert.equal(draft().campaignStory.chapters[0].name,'Llegada de Sosa');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.log[0].text,'El puesto necesita una escuadra.');campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.lastError,null);assert.equal(campaign.completed,false);campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);campaign=decodeSave(encodeSave(campaign)).campaign;assert.equal(campaign.completed,true);assert.equal(campaign.phase,0);assert.equal(campaign.campaignProgress.completed.length,1);assert.ok(campaign.log.some(e=>e.text==='La guardia está lista.'));
});

test('campaign objectives and local errands protect referenced residents through valid edits, undo, import and launch',async t=>{
 const {defaultCampaignStory}=await import('../game/campaign-story.js');const d=questPackage();d.campaignStory=defaultCampaignStory();d.campaignStory.chapters[0].conditions=[{type:'character',character:'alma-contract',state:'alive'},{type:'quest',quest:'river-post',status:'completed'}];const m=await mount(t,JSON.stringify(d));
 await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.match(m.document.body.textContent,/Quitá primero/);assert.ok(parseContentPackage(m.dom.window.localStorage.getItem(draftKey)).characters.some(c=>c.id==='alma-contract'));
 await m.click(m.button('Encargos'));assert.equal(m.button('Eliminar encargo').disabled,true);assert.match(m.document.body.textContent,/Usado por los objetivos/);
 const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey)),toggle=()=>[...m.document.querySelectorAll('label')].find(l=>l.textContent.includes('Incluir habitantes genéricos del mapa original')).querySelector('input');
 await m.click(m.button('Reglas'));await m.input(m.label('Introducción de campaña'),'Este borrador conserva sus encargos.');
 const before=m.dom.window.localStorage.getItem(draftKey);assert.equal(toggle().disabled,true);assert.equal(toggle().checked,true);
 const warning=m.document.getElementById(toggle().getAttribute('aria-describedby'));assert.ok(warning);assert.match(warning.textContent,/quitá o reasigná.*Encargos locales/);
 const dependent=[['Escolta hasta la salida de la Quebrada','Arriero de la posta'],['Vendas para la Ciudadela','Oficial de la Ciudadela'],['Abrigo para el cuartel o el puerto','Sargento del cuartel'],['Asegurar la posta','Maestra de posta']];
 for(const [title,name]of dependent){assert.ok(warning.textContent.includes(title),title);assert.ok(warning.textContent.includes(name),`${name}: ${warning.textContent}`);}
 assert.match(warning.textContent,/Capataz del puerto/,'the secondary generic beneficiary also prevents resident removal');
 assert.doesNotMatch(warning.textContent,/Macacha Güemes/);await m.click(toggle());assert.equal(toggle().checked,true);assert.equal(m.dom.window.localStorage.getItem(draftKey),before);assert.deepEqual(draft().errands,d.errands);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
 await m.click(m.button('Encargos locales'));for(const [title]of dependent){await m.click(m.button(title));await m.click(m.button('Quitar encargo'));}
 assert.deepEqual(draft().errands.map(q=>q.npcId),['macacha']);assert.deepEqual(draft().quests,d.quests);
 await m.click(m.button('Reglas'));assert.equal(toggle().disabled,false);assert.equal(m.document.getElementById('original-resident-dependencies'),null);await m.click(toggle());assert.equal(draft().includeOriginalResidents,false);
 await m.click(m.button('Deshacer'));assert.equal(draft().includeOriginalResidents,d.includeOriginalResidents);assert.equal(toggle().checked,true);await m.click(m.button('Rehacer'));assert.equal(draft().includeOriginalResidents,false);
 const imported=draft();imported.name='Encargos sin habitantes genéricos';const raw=encodeContentPackage(imported),file=new m.dom.window.File([raw],'residentes.json',{type:'application/json'});file.text=async()=>raw;
 const input=m.document.querySelectorAll('input[type="file"][accept="application/json,.json"]')[1];Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(async()=>input.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));
 assert.equal(draft().name,imported.name);assert.equal(draft().includeOriginalResidents,false);assert.deepEqual(draft().errands,imported.errands);assert.equal(m.label('Introducción de campaña').value,'Este borrador conserva sus encargos.');
 await m.click(m.button('Deshacer'));assert.equal(draft().name,d.name);await m.click(m.button('Rehacer'));assert.equal(draft().name,imported.name);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.contentCampaign.package.includeOriginalResidents,false);assert.deepEqual(campaign.contentCampaign.package.errands,imported.errands);assert.deepEqual(campaign.contentCampaign.package.quests,d.quests);assert.equal(campaign.log[0].text,'Este borrador conserva sus encargos.');
});

test('authored progression can copy and replace a historical actor with an independent resident through undo and actual local hiring',async t=>{
 const {defaultCampaignStory}=await import('../game/campaign-story.js');const {isHistoricalCharacter,legacyOperativeId}=await import('../game/content-character-ids.js');const {order,saved,visit,sync,leave}=await import('./local-contract-fixture.mjs');const {createBattle}=await import('../game/tactical.js');
 // This cast/progression scenario declares no local errands.
 const d=defaultContentPackage();d.errands=[];d.campaignStory=defaultCampaignStory();d.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.placements.find(p=>p.character==='person-57').sectors=['cell-27-27'];const m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-57');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Copiar como habitante independiente'));const copy=draft().characters.at(-1);assert.equal(isHistoricalCharacter(copy),false);assert.equal(legacyOperativeId(copy.id),undefined);assert.equal(copy.recruitmentSource,'encounter');assert.equal(copy.service,'permanent');assert.equal(copy.monthlyPay,0);assert.equal(copy.encounter.requiredLeadership,0);assert.equal(copy.encounter.requiredSector,null);assert.deepEqual(copy.attributes,d.characters.find(c=>c.id==='person-57').attributes);assert.equal(copy.portrait,d.characters.find(c=>c.id==='person-57').portrait);assert.deepEqual(draft().placements.at(-1).sectors,['cell-27-27']);await m.input(m.label('Nombre'),'Elena del Paso');
 await m.input(m.document.querySelector('input[type="search"]'),'person-57');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.ok(!draft().characters.some(c=>c.id==='person-57'));await m.click(m.button('Deshacer'));assert.ok(draft().characters.some(c=>c.id==='person-57'));await m.click(m.button('Rehacer'));assert.ok(!draft().characters.some(c=>c.id==='person-57'));
 await m.click(m.button('Reglas'));const original=[...m.document.querySelectorAll('label')].find(l=>l.textContent.includes('Incluir habitantes genéricos del mapa original')).querySelector('input');await m.click(original);assert.equal(draft().includeOriginalResidents,false);await m.input(m.label('Avance de la historia'),'original');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id);campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});campaign=order(campaign,{type:'wait',hours:6});campaign=order(campaign,{type:'travel',sector:'cell-27-27'});let p=visit(campaign);const npcId=p.battle.npcs.find(n=>n.contentId===copy.id).id,unitId=p.battle.units.find(u=>u.side==='player').id;p=sync({campaign:p.campaign,battle:approachNPC(p.battle,unitId,npcId)});const npc=p.battle.npcs.find(n=>n.id===npcId),unit=p.battle.units.find(u=>u.id===unitId);
 campaign=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:Number(unit.id),approach:'recruit',sectorState:p.battle});assert.ok(campaign.recruited.includes(id));assert.ok(!campaign.recruited.includes(57));assert.equal(campaign.operativeState[57],undefined);assert.equal(campaign.phase,0);assert.equal(campaign.flags.foundry,false);assert.equal(rosterFor(campaign).find(o=>o.id===id).name,'Elena del Paso');
 const joined=campaign.pendingBattle.squad.find(o=>o.id===id);p=saved({campaign,battle:{...p.battle,npcs:p.battle.npcs.filter(n=>n.id!==npc.id),units:[...p.battle.units,{...createBattle([joined],{width:8,height:8,enemies:[],exploration:true}).units[0],x:npc.x,y:npc.y}]}});campaign=leave(p);const fatigue=campaign.operativeState[id].fatigue;campaign=order(campaign,{type:'travel',sector:'retiro'});campaign=saved({campaign}).campaign;assert.ok(campaign.operativeState[id].fatigue>fatigue);assert.equal(campaign.operativeState[57],undefined);
});

test('an empty custom cast creates fresh identities without reusing removed historical or contract slots',async t=>{
 // Empty identity authoring also declares no errands tied to the removed cast.
 const {defaultCampaignStory}=await import('../game/campaign-story.js');const {legacyOperativeId}=await import('../game/content-character-ids.js');const d=defaultContentPackage();d.characters=[];d.placements=[];d.errands=[];d.campaignStory=defaultCampaignStory();const m=await mount(t,JSON.stringify(d));await m.click(m.button('Reglas'));assert.equal([...m.label('Tipo de condición').options].find(o=>o.value==='character').disabled,true);await m.click(m.button('Personajes'));await m.click([...m.document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear personaje')));const created=parseContentPackage(m.dom.window.localStorage.getItem(draftKey)).characters[0];assert.equal(legacyOperativeId(created.id),undefined);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,created.id);assert.ok(id>=2000);campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'week'});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign.recruited,[id]);
});

test('the editor assigns strategic functions with undo, protects assigned characters and launches their actual services',async t=>{
 const {rolePackage}=await import('./campaign-roles-fixture.mjs');const {campaignRoleActive}=await import('../game/campaign-roles.js');const {order,saved,A}=await import('./local-contract-fixture.mjs');const d=rolePackage();delete d.campaignRoles;const m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.equal(m.label('Responsable de fundición').value,'');await m.input(m.label('Responsable de fundición'),'engineer');await m.input(m.label('Responsable de marcha'),'engineer');await m.click(m.button('Deshacer'));assert.equal(m.label('Responsable de marcha').value,'');await m.click(m.button('Rehacer'));assert.equal(draft().campaignRoles.marchCommander,'engineer');
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'engineer');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.match(m.document.body.textContent,/reasigná su función de campaña/);assert.ok(draft().characters.some(c=>c.id==='engineer'));
 await m.click(m.button('Reglas'));await m.click(m.button('Restaurar funciones originales'));assert.equal(draft().campaignRoles,undefined);assert.equal(m.label('Responsable de fundición').value,'');await m.click(m.button('Deshacer'));assert.equal(draft().campaignRoles.foundryEngineer,'engineer');await m.input(m.label('Responsable de fundición'),'');await m.input(m.label('Responsable de marcha'),'');await m.click(m.button('Personajes'));await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.ok(!draft().characters.some(c=>c.id==='engineer'));await m.click(m.button('Deshacer'));await m.click(m.button('Deshacer'));await m.click(m.button('Deshacer'));assert.deepEqual(draft().campaignRoles,{foundryEngineer:'engineer',marchCommander:'engineer'});
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,'engineer');campaign=order(campaign,{type:'recruitCivic',id,term:'week'});assert.equal(campaignRoleActive(campaign,'foundryEngineer'),false);campaign=order(campaign,{type:'wait',hours:6});campaign=order(campaign,{type:'foundry'});campaign=order(campaign,{type:'travel',sector:A});campaign=saved({campaign}).campaign;assert.equal(campaign.flags.foundry,true);assert.equal(campaign.operativeState[id].fatigue,0);assert.equal(campaignRoleActive(campaign,'marchCommander'),true);
});

test('the actual treasury names the assigned engineer and blocks its pending arrival',async t=>{
 const {rolePackage}=await import('./campaign-roles-fixture.mjs');const {order}=await import('./local-contract-fixture.mjs');const d=rolePackage(),id=operativeIdForCharacter(d,'engineer');const s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'}),m=await mount(t,undefined,null,s,'treasury');assert.match(m.document.body.textContent,/Organizá El Plumerillo con Elena/);assert.match(m.document.body.textContent,/Incorporá a Elena/);assert.equal(m.button('Organizar El Plumerillo · 500 pesos').disabled,true);
});

test('the actual treasury pays assigned services once after arrival',async t=>{
 const {rolePackage}=await import('./campaign-roles-fixture.mjs');const {order}=await import('./local-contract-fixture.mjs');const d=rolePackage(),id=operativeIdForCharacter(d,'engineer');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});s=order(s,{type:'wait',hours:6});const m=await mount(t,undefined,null,s,'treasury'),funds=s.resources.treasury;await m.click(m.button('Organizar El Plumerillo · 500 pesos'));assert.equal(m.campaign.resources.treasury,funds-500);assert.equal(m.button('El Plumerillo organizado').disabled,true);await m.click(m.button('Financiar el ejército · 3000 pesos'));assert.equal(m.campaign.resources.treasury,funds-3500);assert.equal(m.button('Ejército financiado').disabled,true);assert.equal(decodeSave(encodeSave(m.campaign)).campaign.flags.armyFunded,true);
});

test('the editor configures foundry location, names and prices through validation, undo, reset and actual launch',async t=>{
 const {foundryPackage}=await import('./foundry-project-fixture.mjs');const {order,saved}=await import('./local-contract-fixture.mjs');const d=foundryPackage();delete d.foundry;const m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));await m.input(m.label('Ubicación de la fundición'),'jujuy');await m.input(m.label('Nombre de la fundición'),'Taller del Norte');await m.input(m.label('Nombre del ejército'),'Ejército del Norte Libre');await m.input(m.label('Costo de organización (pesos)'),137);await m.input(m.label('Costo de financiación (pesos)'),809);await m.click(m.button('Deshacer'));assert.equal(m.label('Costo de financiación (pesos)').value,'3000');await m.click(m.button('Rehacer'));assert.equal(draft().foundry.fundingCost,809);await m.input(m.label('Costo de organización (pesos)'),-1);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));await m.click(m.button('Restaurar fundición original'));assert.equal(m.label('Ubicación de la fundición').value,'mendoza');await m.click(m.button('Deshacer'));assert.equal(m.label('Ubicación de la fundición').value,'jujuy');await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,'engineer');campaign=order(campaign,{type:'recruitCivic',id,term:'week'});campaign=order(campaign,{type:'wait',hours:6});const funds=campaign.resources.treasury;campaign=order(campaign,{type:'foundry'});campaign=order(campaign,{type:'fundArmy'});campaign=saved({campaign}).campaign;assert.equal(campaign.resources.treasury,funds-946);assert.equal(campaign.sectors.mendoza.owner,'royalist');assert.equal(campaign.cityLoyaltyEvents.find(e=>e.eventId==='quest-foundry').sectorId,'jujuy');
});

test('the actual treasury displays and charges an authored foundry project and army',async t=>{
 const {foundryPackage}=await import('./foundry-project-fixture.mjs');const {order}=await import('./local-contract-fixture.mjs');const d=foundryPackage(),id=operativeIdForCharacter(d,'engineer');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});s=order(s,{type:'wait',hours:6});const m=await mount(t,undefined,null,s,'treasury'),funds=s.resources.treasury;assert.match(m.document.body.textContent,/Preparar el Ejército del Norte Libre/);assert.match(m.document.body.textContent,/Fundición: San Salvador de Jujuy/);assert.doesNotMatch(m.document.querySelector('.campaign-funding').textContent,/El Plumerillo|Ejército de los Andes|Mendoza/);await m.click(m.button('Organizar Taller del Norte · 137 pesos'));assert.equal(m.campaign.resources.treasury,funds-137);assert.equal(m.button('Taller del Norte organizado').disabled,true);await m.click(m.button('Financiar el ejército · 809 pesos'));assert.equal(m.campaign.resources.treasury,funds-946);assert.equal(m.button('Ejército financiado').disabled,true);assert.equal(decodeSave(encodeSave(m.campaign)).campaign.flags.armyFunded,true);
});

test('the editor authors a project chapter with undo and reaches its ending through actual paid preparation and funding',async t=>{
 const {foundryPackage}=await import('./foundry-project-fixture.mjs');const {order,saved}=await import('./local-contract-fixture.mjs');const m=await mount(t,JSON.stringify(foundryPackage()));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));await m.input(m.label('Tipo de condición'),'project');assert.equal(m.label('Proyecto de la condición').value,'foundry');await m.input(m.label('Proyecto de la condición'),'army');await m.input(m.label('Estado del proyecto requerido'),'pending');await m.click(m.button('Deshacer'));assert.equal(m.label('Estado del proyecto requerido').value,'complete');await m.click(m.button('Rehacer'));assert.equal(draft().campaignStory.chapters[0].conditions[0].completed,false);await m.input(m.label('Estado del proyecto requerido'),'complete');await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,'engineer');campaign=order(campaign,{type:'recruitCivic',id,term:'week'});campaign=order(campaign,{type:'wait',hours:6});assert.equal(campaign.completed,false);campaign=order(campaign,{type:'foundry'});assert.equal(campaign.completed,false);campaign=order(campaign,{type:'fundArmy'});assert.equal(saved({campaign}).campaign.completed,true);
});

test('the dialogue editor saves a project condition through copy and its launched campaign uses actual funding',async t=>{
 const {defaultCampaignStory}=await import('../game/campaign-story.js');const {order,saved}=await import('./local-contract-fixture.mjs');const d=dialoguePackage();d.campaignStory=defaultCampaignStory();d.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.rules.startingTreasury=10000;d.campaignRoles={foundryEngineer:'person-110',marchCommander:null};d.foundry={sector:'retiro',name:'Taller del Cuartel',armyName:'Ejército Libre',setupCost:100,fundingCost:200};const m=await mount(t,JSON.stringify(d));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Agregar condición'));await m.input(m.label('Tipo de condición'),'project');await m.input(m.label('Proyecto de la condición'),'army');await m.click(m.button('Duplicar personaje'));const draft=parseContentPackage(m.dom.window.localStorage.getItem(draftKey)),clauses=draft.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions;assert.deepEqual(clauses,[{type:'project',project:'army',completed:true}]);await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(dialogueConditionsMet(campaign,clauses),false);campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});campaign=order(campaign,{type:'foundry'});assert.equal(dialogueConditionsMet(campaign,clauses),false);campaign=order(campaign,{type:'fundArmy'});assert.equal(dialogueConditionsMet(saved({campaign}).campaign,clauses),true);
});

test('the editor edits starting supplies through undo, copy, reset and a playable saved launch',async t=>{
 const m=await mount(t);const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));
 await m.input(m.label('Antorchas'),0);await m.input(m.label('Vendas'),7);await m.click(m.button('Deshacer'));assert.equal(m.label('Vendas').value,'2');await m.click(m.button('Rehacer'));assert.equal(m.label('Vendas').value,'7');
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.equal(copy.startingSupplies.torches,0);assert.equal(copy.startingSupplies.medkits,7);
 await m.click(m.button('Restablecer suministros originales'));assert.equal(draft().characters.at(-1).startingSupplies,undefined);assert.equal(m.label('Antorchas').value,'2');await m.click(m.button('Deshacer'));
 await m.input(m.label('Vendas'),1001);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.input(m.label('Vendas'),7);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id);
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'day'});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const battle=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]))).battle;const u=battle.units.find(u=>u.id===String(id));assert.equal(u.torches,0);assert.equal(u.medkits,7);
});

test('the mounted editor loads the complete example, restores the previous draft and launches its configured headquarters',async t=>{
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.label('Nombre'),'Borrador conservado');await m.click([...m.document.querySelectorAll('summary')].find(s=>s.textContent.includes('La ruta de las postas')));await m.click(m.button('Cargar La ruta de las postas'));
 assert.equal(draft().id,'ruta-de-las-postas');assert.equal(draft().characters.length,13);assert.equal(draft().campaignStory.chapters.length,3);assert.equal(m.document.querySelector('a[download][href="/campaigns/la-ruta-de-las-postas.json"]').textContent,'Descargar campaña de ejemplo');
 await m.click(m.button('Deshacer'));assert.equal(draft().characters[0].name,'Borrador conservado');await m.click(m.button('Rehacer'));assert.equal(draft().id,'ruta-de-las-postas');await m.input(m.label('Nombre'),'León del Camino');
 await m.click(m.button('Pruebas'));assert.equal(m.label('Semilla de la campaña').value,'8');await m.click(m.button('Personajes'));
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.location,'cordoba');assert.equal(campaign.resources.treasury,6000);assert.ok(Object.keys(campaign.operativeState).every(id=>Number(id)>=2000));assert.equal(rosterFor(campaign).find(o=>o.contentId==='leon').name,'León del Camino');
 const id=operativeIdForCharacter(campaign.contentCampaign.package,'leon');campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'week'});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const restored=decodeSave(encodeSave(campaign,enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location])));assert.ok(restored.battle.npcs.some(n=>n.contentId==='ines'));assert.equal(restored.battle.units.find(u=>u.id===String(id)).ammo+restored.battle.units.find(u=>u.id===String(id)).loaded,14);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor authors initial condition with undo, copy, reset and validation and launches real wounded service',async t=>{
 const {order,saved}=await import('./local-contract-fixture.mjs');
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));assert.ok(m.document.querySelector('[aria-label="Estado inicial"]'));
 for(const [label,value]of [['Salud inicial',30],['Energía inicial',61],['Fatiga inicial',23],['Sangrado inicial',3],['Heridas vendadas iniciales',7]])await m.input(m.label(label),value);
 const expected={hp:30,energy:61,fatigue:23,bleeding:3,bandaged:7};assert.deepEqual(draft().characters.find(c=>c.id==='person-110').startingCondition,expected);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Heridas vendadas iniciales').value,'0');await m.click(m.button('Rehacer'));await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1);assert.deepEqual(copy.startingCondition,expected);
 await m.input(m.label('Heridas vendadas iniciales'),100);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));await m.click(m.button('Restablecer estado sano'));assert.equal(draft().characters.at(-1).startingCondition,undefined);assert.equal(m.label('Salud inicial').value,String(copy.attributes.maxHp));await m.click(m.button('Deshacer'));
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const id=operativeIdForCharacter(campaign.contentCampaign.package,copy.id);assert.deepEqual(Object.fromEntries(Object.keys(expected).map(k=>[k,campaign.operativeState[id][k]])),expected);assert.ok(!campaign.recruited.includes(id));
 campaign=order(campaign,{type:'recruitCivic',id,term:'week'});campaign=order(campaign,{type:'wait',hours:6});campaign=saved({campaign}).campaign;assert.equal(campaign.operativeState[id].hp,30);assert.equal(campaign.operativeState[id].bleeding,3);assert.equal(campaign.operativeState[id].location,'retiro');
 await m.input(m.label('Salud inicial'),31);assert.equal(draft().characters.at(-1).startingCondition.hp,31);assert.equal(campaign.operativeState[id].hp,30);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor authors care and rest rules with undo, validation, reset and a pinned paid campaign launch',async t=>{
 const {DEFAULT_CARE_RULES,careRules}=await import('../game/campaign-care-rules.js');const {order,saved}=await import('./local-contract-fixture.mjs');const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.ok(m.document.querySelector('[aria-label="Reglas de atención y descanso"]'));
 const edits=[['Medicina mínima para atender',0],['Salud recuperada por hora (base)',5],['Puntos de medicina por cada salud adicional',40],['Precio de cada venda (pesos)',17],['Energía gastada por hora de atención',7],['Fatiga por hora de atención',9],['Energía por hora de descanso (base)',4],['Fatiga recuperada por hora de descanso (base)',3],['Horas de descanso por cada punto de salud',9]];
 for(const [label,value]of edits)await m.input(m.label(label),value);const expected={minimumSkill:0,baseHealing:5,skillStep:40,dressingPrice:17,energyCost:7,fatigueCost:9,restEnergy:4,restFatigue:3,restHealingHours:9};assert.deepEqual(draft().careRules,expected);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Horas de descanso por cada punto de salud').value,'6');await m.click(m.button('Rehacer'));assert.equal(draft().careRules.restHealingHours,9);await m.input(m.label('Horas de descanso por cada punto de salud'),0);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar atención y descanso originales'));assert.equal(draft().careRules,undefined);assert.equal(Number(m.label('Precio de cada venda (pesos)').value),DEFAULT_CARE_RULES.dressingPrice);await m.click(m.button('Deshacer'));assert.deepEqual(draft().careRules,expected);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});assertTradeRejected(campaign,{type:'purchaseMedicalSupplies',id:110,quantity:4});assert.equal(campaign.operativeState[110].medkits,2);campaign=saved({campaign}).campaign;assert.deepEqual(careRules(campaign),expected);
 await m.input(m.label('Precio de cada venda (pesos)'),1);assert.equal(draft().careRules.dressingPrice,1);assert.equal(careRules(campaign).dressingPrice,17);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor authors physical character conditions through undo, copy and a pinned campaign launch',async t=>{
 const d=dialoguePackage();d.characters.find(c=>c.id==='person-110').startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Agregar condición'));await m.input(m.label('Tipo de condición'),'character');await m.input(m.label('Personaje de la condición'),'person-110');
 const states=[...m.label('Estado requerido').options].map(o=>o.value);for(const id of ['conscious','unconscious','wounded','bleeding','stable','healthy'])assert.ok(states.includes(id));await m.input(m.label('Estado requerido'),'unconscious');await m.click(m.button('Deshacer'));assert.equal(m.label('Estado requerido').value,'alive');await m.click(m.button('Rehacer'));assert.equal(m.label('Estado requerido').value,'unconscious');
 await m.click(m.button('Duplicar personaje'));const copy=draft().characters.at(-1),conditions=copy.encounter.dialogue.nodes[0].choices[0].conditions;assert.deepEqual(conditions,[{type:'character',character:'person-110',state:'unconscious'}]);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(dialogueConditionsMet(campaign,conditions),true);assert.equal(campaign.operativeState[110].hp,1);await m.input(m.label('Estado requerido'),'healthy');assert.equal(dialogueConditionsMet(campaign,conditions),true);assert.equal(dialogueConditionsMet(campaign,draft().characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions),false);
});

test('the editor authors optional treatment speech through undo, copy, clearing and pinned launch',async t=>{
 const d=defaultContentPackage(),m=await mount(t,JSON.stringify(d));const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));
 await m.input(m.document.querySelector('input[type="search"]'),'person-112');await m.click(m.document.querySelector('.entry-list button'));
 const label='Al recibir primeros auxilios de otra persona';assert.equal(m.label(label).value,'');assert.equal(d.characters.find(c=>c.id==='person-112').speech.treated,undefined);
 await m.input(m.label(label),'Gracias por ayudarme.');await m.click(m.button('Deshacer'));assert.equal(m.label(label).value,'');assert.equal(draft().characters.find(c=>c.id==='person-112').speech.treated,undefined);await m.click(m.button('Rehacer'));assert.equal(m.label(label).value,'Gracias por ayudarme.');
 await m.click(m.button('Duplicar personaje'));assert.equal(draft().characters.at(-1).speech.treated,'Gracias por ayudarme.');await m.input(m.label(label),'');assert.equal(draft().characters.at(-1).speech.treated,undefined);
 await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(rosterFor(campaign).find(o=>o.id===112).storyProfile.speech.treated,'Gracias por ayudarme.');
 await m.input(m.label(label),'Otra respuesta.');assert.equal(rosterFor(campaign).find(o=>o.id===112).storyProfile.speech.treated,'Gracias por ayudarme.');assert.equal(draft().characters.at(-1).speech.treated,'Otra respuesta.');
});

test('the editor authors personal supply ranges with undo, validation, copy, protected references and pinned launch',async t=>{
 const d=dialoguePackage(),m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.input(m.document.querySelector('input[type="search"]'),'alma-contract');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Agregar condición'));await m.input(m.label('Tipo de condición'),'supply');await m.input(m.label('Personaje que lleva los suministros'),'person-110');assert.deepEqual([...m.label('Suministro requerido').options].map(o=>o.value),['rations','torches','medkits','boleadoras']);
 await m.input(m.label('Cantidad mínima'),2);await m.input(m.label('Cantidad máxima (opcional)'),2);await m.click(m.button('Deshacer'));assert.equal(m.label('Cantidad máxima (opcional)').value,'');await m.click(m.button('Rehacer'));assert.equal(m.label('Cantidad máxima (opcional)').value,'2');await m.input(m.label('Cantidad máxima (opcional)'),1);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Duplicar personaje'));const conditions=draft().characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions;assert.deepEqual(conditions,[{type:'supply',character:'person-110',item:'medkits',min:2,max:2}]);await m.click(m.button('Iniciar campaña con estas fichas'));const {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(dialogueConditionsMet(campaign,conditions),true);
 await m.input(m.label('Cantidad máxima (opcional)'),'');await m.input(m.label('Cantidad mínima'),3);assert.equal(dialogueConditionsMet(campaign,draft().characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions),false);assert.equal(dialogueConditionsMet(campaign,campaign.contentCampaign.package.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions),true);
 await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.ok(draft().characters.some(c=>c.id==='person-110'));assert.match(m.document.body.textContent,/Quitá primero las apariciones y condiciones/);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the campaign editor authors a supply objective that recognizes actual declared carried kits on paid arrival',async t=>{
 const {defaultCampaignStory}=await import('../game/campaign-story.js');const {order,saved}=await import('./local-contract-fixture.mjs');const d=dialoguePackage();d.campaignStory=defaultCampaignStory();d.characters.find(c=>c.id==='person-110').startingSupplies={rations:2,torches:2,medkits:5,boleadoras:1};const m=await mount(t,JSON.stringify(d));await m.click(m.button('Reglas'));await m.input(m.label('Tipo de condición'),'supply');await m.input(m.label('Personaje que lleva los suministros'),'person-110');await m.input(m.label('Cantidad mínima'),5);await m.input(m.label('Cantidad máxima (opcional)'),5);await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.equal(campaign.completed,false);campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});assert.equal(campaign.completed,true);assertTradeRejected(campaign,{type:'purchaseMedicalSupplies',id:110,quantity:3});campaign=saved({campaign}).campaign;assert.equal(campaign.completed,true);assert.equal(campaign.operativeState[110].medkits,5);
 await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));await m.click(m.button('Eliminar'));assert.match(m.document.body.textContent,/Quitá primero las apariciones y condiciones/);assert.ok(parseContentPackage(m.dom.window.localStorage.getItem(draftKey)).characters.some(c=>c.id==='person-110'));
});


test('the weapon editor authors included preparation cost through validation, undo and a pinned paid deployment',async t=>{
 const m=await mount(t);await m.click(m.button('Armas'));await m.click(m.button('+ Crear arma'));await m.input(m.label('Nombre'),'Pistola preparada');await m.input(m.label('Familia de funcionamiento'),'1808');await m.input(m.label('PA de disparo'),20);await m.input(m.label('PA para levantar el arma'),7);await m.input(m.label('Capacidad de carga'),3);
 const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));let gun=draft().weapons.find(w=>w.name==='Pistola preparada');assert.equal(gun.readyAP,7);assert.match(m.document.body.textContent,/incluidos en el primer disparo/);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
 await m.click(m.button('Deshacer'));assert.equal(m.label('Capacidad de carga').value,'2');await m.click(m.button('Deshacer'));assert.equal(m.label('PA para levantar el arma').value,'0');await m.click(m.button('Rehacer'));assert.equal(m.label('PA para levantar el arma').value,'7');await m.click(m.button('Rehacer'));
 await m.input(m.label('PA para levantar el arma'),20);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);
 gun=draft().weapons.find(w=>w.name==='Pistola preparada');await m.click(m.button('Personajes'));await m.input(m.document.querySelector('input[type="search"]'),'person-110');await m.click(m.document.querySelector('.entry-list button'));await m.input(m.label('Arma principal'),gun.id);await m.click(m.button('Iniciar campaña con estas fichas'));
 let s=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;for(const a of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'visitSector'}]){s=dispatchCampaign(s,a);assert.equal(s.lastError,null);}
 const restored=decodeSave(encodeSave(s,enterSector(s.pendingBattle))),u=restored.battle.units.find(u=>u.id==='110');assert.equal(u.weaponMetadata.contentWeapon.readyAP,7);assert.equal(u.loaded,3);assert.equal(u.weaponReady,undefined);assert.equal(actionCosts(restored.battle,u).ready,7);assert.equal(actionCosts(restored.battle,u).fire,20);
});


test('the editor preserves future cartridge prices while actual entry keeps the finite initial allowance without charge',async t=>{
 const m=await mount(t);await m.click(m.button('Reglas'));const price=()=>m.label('Precio del cartucho (pesos)');assert.equal(price().value,'1');await m.input(m.label('Cartuchos por combatiente de la escuadra'),7);await m.input(price(),3);
 const draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));assert.equal(draft().rules.cartridgePrice,3);await m.click(m.button('Deshacer'));assert.equal(price().value,'1');assert.equal(Object.hasOwn(draft().rules,'cartridgePrice'),false);await m.click(m.button('Rehacer'));assert.equal(price().value,'3');
 await m.input(price(),'');assert.equal(price().value,'');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));await m.input(price(),.5);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));await m.click(m.button('Restaurar fondos y cartuchos originales'));assert.equal(price().value,'1');assert.equal(Object.hasOwn(draft().rules,'cartridgePrice'),false);await m.click(m.button('Deshacer'));assert.equal(price().value,'3');
 await m.click(m.button('Iniciar campaña con estas fichas'));let s=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;for(const a of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6}]){s=dispatchCampaign(s,a);assert.equal(s.lastError,null);}const money=s.resources.treasury;assert.equal(deploymentCost(s),0);s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);assert.equal(s.resources.treasury,money);assert.equal(s.pendingBattle.issuedCartridges,7);const restored=decodeSave(encodeSave(s,enterSector(s.pendingBattle)));assert.equal(restored.campaign.contentCampaign.package.rules.cartridgePrice,3);assert.equal(restored.battle.units[0].loaded+restored.battle.units[0].ammo,7);
});

test('the editor pins the optional military bleeding rate through undo, validation, reset and actual paid service',async t=>{
 const {order,saved}=await import('./local-contract-fixture.mjs');const d=defaultContentPackage(),candidate=d.characters.find(c=>c.id==='person-110');candidate.arrivalHours=0;candidate.startingCondition={hp:40,energy:100,fatigue:0,bleeding:5,bandaged:0};
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));const label='Daño horario de hemorragia (%)';assert.equal(m.label(label).value,'25');assert.equal(d.careRules,undefined);
 await m.input(m.label(label),50);assert.equal(draft().careRules.bleedingDamagePercent,50);await m.click(m.button('Deshacer'));assert.equal(draft().careRules,undefined);assert.equal(m.label(label).value,'25');await m.click(m.button('Rehacer'));assert.equal(m.label(label).value,'50');await m.input(m.label(label),101);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar atención y descanso originales'));assert.equal(draft().careRules,undefined);await m.click(m.button('Deshacer'));await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));const money=campaign.resources.treasury;campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});assert.ok(campaign.resources.treasury<money);campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.operativeState[110].hp,37);campaign=saved({campaign}).campaign;
 await m.input(m.label(label),0);assert.equal(draft().careRules.bleedingDamagePercent,0);assert.equal(campaign.contentCampaign.package.careRules.bleedingDamagePercent,50);campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.operativeState[110].hp,34);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor authors militia thresholds and gains with validation, undo, reset and actual pinned instruction',async t=>{
 const {militiaProgression,DEFAULT_MILITIA_PROGRESSION}=await import('../game/militia-progression-rules.js');const {order,saved}=await import('./local-contract-fixture.mjs');const d=defaultContentPackage();for(const sector of ['buenos_aires','ensenada'])d.startingTerritory[sector]={owner:'patriot',loyalty:65};
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.ok(m.document.querySelector('[aria-label="Reglas de ascenso de milicias"]'));
 for(const [label,value]of [['Puntos para ascender a veterano',7],['Puntos para ascender a montonero',4],['Puntería ganada por ascenso',3],['Liderazgo ganado por ascenso',0],['Niveles de experiencia ganados por ascenso',2]])await m.input(m.label(label),value);
 const expected={regularThreshold:4,veteranThreshold:7,marksmanshipGain:3,leadershipGain:0,levelGain:2};assert.deepEqual(draft().militiaProgression,expected);await m.click(m.button('Deshacer'));assert.equal(m.label('Niveles de experiencia ganados por ascenso').value,'1');await m.click(m.button('Rehacer'));
 await m.input(m.label('Puntos para ascender a veterano'),4);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);assert.match(m.document.body.textContent,/necesita más puntos/);await m.click(m.button('Deshacer'));await m.input(m.label('Niveles de experiencia ganados por ascenso'),10);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar ascensos de milicias originales'));assert.equal(draft().militiaProgression,undefined);assert.equal(Number(m.label('Puntos para ascender a montonero').value),DEFAULT_MILITIA_PROGRESSION.regularThreshold);await m.click(m.button('Deshacer'));assert.deepEqual(draft().militiaProgression,expected);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=order(campaign,{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});campaign=order(campaign,{type:'militia',trainerId:1000,rank:0});campaign=finishMilitiaTraining(campaign);campaign=order(campaign,{type:'militia',trainerId:1000,rank:1});const before=structuredClone(campaign.militiaTraining[0].trainees[0]);campaign=finishMilitiaTraining(saved({campaign}).campaign);const after=campaign.garrisons.retiro.find(u=>u.id===before.id);assert.equal(after.militiaRank,1);assert.equal(after.marksmanship,before.marksmanship+3);assert.equal(after.leadership,before.leadership);assert.equal(after.experienceLevel,(before.experienceLevel??4)+2);assert.equal(after.hp,before.hp);assert.equal(after.loaded,before.loaded);assert.deepEqual(militiaProgression(saved({campaign}).campaign),expected);
 await m.input(m.label('Puntería ganada por ascenso'),99);assert.equal(draft().militiaProgression.marksmanshipGain,99);assert.equal(militiaProgression(campaign).marksmanshipGain,3);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor pins militia patrol choices through undo, reset, validation and actual paid garrison visits',async t=>{
 const {order,visit,sync,saved}=await import('./local-contract-fixture.mjs'),{DEFAULT_MILITIA_PATROL}=await import('../game/militia-patrol-rules.js');const d=defaultContentPackage();for(const at of ['buenos_aires','ensenada'])d.startingTerritory[at]={owner:'patriot',loyalty:65};
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.ok(m.document.querySelector('[aria-label="Reglas de patrulla de milicias"]'));assert.equal(m.label('Activar patrullas y búsqueda de milicias').checked,true);
 await m.click(m.label('Activar patrullas y búsqueda de milicias'));for(const [label,value]of [['Intervalos por punto de patrulla',11],['Energía que reserva la patrulla',70],['Energía recuperada al descansar la patrulla',4]])await m.input(m.label(label),value);
 const expected={enabled:false,waypointTicks:11,energyReserve:70,restEnergy:4};assert.deepEqual(draft().militiaPatrol,expected);await m.click(m.button('Deshacer'));assert.equal(m.label('Energía recuperada al descansar la patrulla').value,'10');await m.click(m.button('Rehacer'));await m.input(m.label('Energía que reserva la patrulla'),96);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar patrullas de milicias originales'));assert.equal(draft().militiaPatrol,undefined);assert.equal(m.label('Activar patrullas y búsqueda de milicias').checked,DEFAULT_MILITIA_PATROL.enabled);await m.click(m.button('Deshacer'));assert.deepEqual(draft().militiaPatrol,expected);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=order(campaign,{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});campaign=order(campaign,{type:'militia',trainerId:1000,rank:0});campaign=order(campaign,{type:'wait',hours:campaign.militiaTraining[0].remaining});let p=visit(campaign);const before=structuredClone(p.battle.units.filter(u=>u.militia));assert.equal(before.length,3);
 for(let i=0;i<4;i++){p.battle=actBattle(p.battle,{type:'ambient'});p=saved(sync(p));}assert.deepEqual(p.battle.units.filter(u=>u.militia),before);assert.deepEqual(p.battle.militiaPatrol,expected);
 await m.click(m.label('Activar patrullas y búsqueda de milicias'));assert.equal(draft().militiaPatrol.enabled,true);assert.equal(p.campaign.contentCampaign.package.militiaPatrol.enabled,false);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor pins artillery supply prices and reserve limits through undo, validation, launch and a finite declared owned deployment',async t=>{
 const {DEFAULT_ARTILLERY_SUPPLY,artillerySupplyRules}=await import('../game/artillery-supply-rules.js'),{order,saved}=await import('./local-contract-fixture.mjs'),{enterSector}=await import('../game/world.js');
 const m=await mount(t,JSON.stringify(defaultContentPackage())),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.ok(m.document.querySelector('[aria-label="Reglas de munición de artillería"]'));
 assert.equal(m.label('Permitir reposición de munición de artillería').checked,true);await m.click(m.label('Permitir reposición de munición de artillería'));for(const [label,value]of [['Munición de 4 libras (pesos)',17],['Munición de 8 libras (pesos)',29],['Munición de pedrero (pesos)',9],['Máximo de reserva para reposición',4]])await m.input(m.label(label),value);
 const expected={enabled:false,bronze4:17,field8:29,swivel:9,reserveLimit:4};assert.deepEqual(draft().artillerySupply,expected);await m.click(m.button('Deshacer'));assert.equal(m.label('Máximo de reserva para reposición').value,'6');await m.click(m.button('Rehacer'));await m.input(m.label('Máximo de reserva para reposición'),0);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar munición de artillería original'));assert.equal(draft().artillerySupply,undefined);assert.equal(m.label('Munición de pedrero (pesos)').value,String(DEFAULT_ARTILLERY_SUPPLY.swivel));await m.click(m.button('Deshacer'));assert.deepEqual(draft().artillerySupply,expected);await m.click(m.label('Permitir reposición de munición de artillería'));expected.enabled=true;
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(artillerySupplyRules(campaign),expected);campaign=order(campaign,{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});const money=campaign.resources.treasury;assertTradeRejected(campaign,{type:'purchaseEquipment',item:'swivel'});campaign=withStoredGear(campaign,'swivel');assert.equal(campaign.resources.treasury,money);campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const p=saved({campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour})});assert.equal(p.battle.artillery[0].ammo,6);assert.deepEqual(artillerySupplyRules(p.campaign),expected);
 await m.input(m.label('Munición de pedrero (pesos)'),999);assert.equal(draft().artillerySupply.swivel,999);assert.equal(artillerySupplyRules(p.campaign).swivel,9);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor searches and edits artillery images and models with undo, validation, reset and pinned launch',async t=>{
 const {order,saved}=await import('./local-contract-fixture.mjs');const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Armas'));await m.click(m.button('Artillería'));
 await m.input(m.label('Buscar artillería'),'pedrero');assert.equal(m.document.querySelectorAll('.entry-list button').length,1);await m.click(m.document.querySelector('.entry-list button'));await m.input(m.label('Nombre del modelo'),'Pedrero del Río');
 for(const [label,value]of [['Precio de compra (pesos)',123],['Artilleros necesarios',2],['PA de disparo por artillero',18],['PA de recarga por artillero',120],['PA para arrastrar por artillero',11],['PA para girar por artillero',6],['Alcance de bala rasa (celdas)',22],['Daño de bala rasa',44],['Escala de metralla (mitad del alcance)',4],['Penetración de bala rasa',2],['Municiones de reserva al comprar',3]])await m.input(m.label(label),value);
 await m.click(m.label('Se entrega cargada'));assert.equal(draft().artilleryProfiles.swivel.initialLoaded,false);await m.click(m.button('Deshacer'));assert.equal(m.label('Se entrega cargada').checked,true);await m.click(m.button('Rehacer'));
 await m.input(m.label('Artilleros necesarios'),0);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));await m.click(m.button('Restaurar artillería original'));assert.equal(draft().artilleryProfiles,undefined);await m.click(m.button('Deshacer'));
 const file=new m.dom.window.File([Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL5kAAAAASUVORK5CYII=','base64'))],'gun.png',{type:'image/png'}),input=m.document.querySelector('input[aria-label="Imagen de artillería"]');Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(async()=>{input.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,30));});
 const expected=structuredClone(draft().artilleryProfiles);assert.match(expected.swivel.art,/^data:image\/png;base64,/);assert.equal(m.document.querySelector('.weapon-preview').getAttribute('src'),expected.swivel.art);await m.click(m.button('Usar imagen original de artillería'));assert.equal(draft().artilleryProfiles.swivel.art,'/art/cannon.png');await m.click(m.button('Deshacer'));
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=order(campaign,{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});const cash=campaign.resources.treasury;assertTradeRejected(campaign,{type:'purchaseEquipment',item:'swivel'});campaign=withStoredGear(campaign,'swivel');assert.equal(campaign.resources.treasury,cash);campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const p=saved({campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour})});assert.deepEqual(p.battle.artilleryDefinitions,expected);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,3);
 await m.input(m.label('Daño de bala rasa'),1);assert.equal(draft().artilleryProfiles.swivel.damage,1);assert.equal(p.battle.artilleryDefinitions.swivel.damage,44);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('an isolated retained cannon widget uses authored art and prices but public purchase stays closed',async t=>{
 const {ARTILLERY}=await import('../game/artillery-definitions.js'),{order,saved}=await import('./local-contract-fixture.mjs');const d=defaultContentPackage();d.artilleryProfiles=structuredClone(ARTILLERY);Object.assign(d.artilleryProfiles.swivel,{name:'Pedrero del Río',art:'/art/weapon-1801.png',crew:2,price:123});let s=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});const m=await mount(t,undefined,null,s,'armory');
 const card=[...m.document.querySelectorAll('article')].find(a=>a.textContent.includes('Pedrero del Río'));assert.ok(card);assert.equal(card.querySelector('img').getAttribute('src'),'/art/weapon-1801.png');assert.match(card.textContent,/Dotación: 2/);assert.match(card.textContent,/123 pesos/);const before=structuredClone(m.campaign);await m.click(card.querySelector('button'));assert.match(m.campaign.lastError,/comercio de equipo/);assert.deepEqual({...m.campaign,lastError:null},before);assert.equal(m.campaign.armory.swivel,undefined);assert.ok([...m.document.querySelectorAll('select[id^="battery-"] option')].some(o=>o.textContent==='Pedrero del Río'));assert.equal(saved({campaign:m.campaign}).campaign.contentCampaign.package.artilleryProfiles.swivel.price,123);
});

test('the editor authors artillery transport rates and fees through undo, reset, validation and a pinned saved launch',async t=>{
 const {DEFAULT_ARTILLERY_TRANSPORT,artilleryTransportRules}=await import('../game/artillery-transport-rules.js');const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.ok(m.document.querySelector('[aria-label="Reglas de traslado de artillería"]'));
 assert.equal(m.label('Permitir traslado de piezas de artillería').checked,true);await m.click(m.label('Permitir traslado de piezas de artillería'));for(const [label,value]of [['Horas por tramo en carreta',7],['Horas por tramo en flotilla',2],['Precio por pieza enviada en carreta (pesos)',37],['Precio por pieza enviada en flotilla (pesos)',19]])await m.input(m.label(label),value);
 const expected={enabled:false,cartsHours:7,flotillaHours:2,cartsFee:37,flotillaFee:19};assert.deepEqual(draft().artilleryTransport,expected);await m.click(m.button('Deshacer'));assert.equal(m.label('Precio por pieza enviada en flotilla (pesos)').value,'0');await m.click(m.button('Rehacer'));await m.input(m.label('Horas por tramo en carreta'),0);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar traslado de artillería original'));assert.equal(draft().artilleryTransport,undefined);assert.equal(m.label('Horas por tramo en carreta').value,String(DEFAULT_ARTILLERY_TRANSPORT.cartsHours));await m.click(m.button('Deshacer'));assert.deepEqual(draft().artilleryTransport,expected);
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false); await m.click(m.button('Iniciar campaña con estas fichas'));const p=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(artilleryTransportRules(p.campaign),expected);assert.deepEqual(decodeSave(encodeSave(p.campaign,p.battle)).campaign.contentCampaign.package.artilleryTransport,expected);
 await m.click(m.label('Permitir traslado de piezas de artillería'));await m.input(m.label('Horas por tramo en carreta'),33);assert.equal(artilleryTransportRules(p.campaign).enabled,false);assert.equal(artilleryTransportRules(p.campaign).cartsHours,7);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor authors finite workshop cash and local gun prices with undo, reset, validation and saved metadata while public trades stay closed',async t=>{
 const {order}=await import('./local-contract-fixture.mjs'),{artilleryTradingRules}=await import('../game/artillery-trading-rules.js');const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));assert.ok(m.document.querySelector('[aria-label="Reglas de comercio de artillería"]'));
 await m.click(m.label('Permitir venta y recompra de artillería'));for(const [label,value]of [['Fondos iniciales de cada taller (pesos)',777],['Pago general del taller (% del precio)',23],['Precio de recompra (% del precio)',63]])await m.input(m.label(label),value);
 await m.click(m.button('Agregar precio local'));let row=m.document.querySelector('[data-artillery-trade-rate="buenos_aires"]');assert.ok(row);await m.input(row.querySelector('select'),'retiro');row=m.document.querySelector('[data-artillery-trade-rate="retiro"]');await m.input(row.querySelector('input'),29);await m.click(m.document.querySelector('[data-artillery-trade-rate="cordoba"] button'));
 const expected={enabled:false,initialCash:777,buyPercent:23,resalePercent:63,buyingOverrides:{mendoza:50,retiro:29}};assert.deepEqual(draft().artilleryTrading,expected);await m.click(m.button('Deshacer'));assert.equal(draft().artilleryTrading.buyingOverrides.cordoba,30);await m.click(m.button('Rehacer'));await m.input(m.document.querySelector('[data-artillery-trade-rate="retiro"] input'),101);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar comercio de artillería original'));assert.equal(draft().artilleryTrading,undefined);await m.click(m.button('Deshacer'));assert.deepEqual(draft().artilleryTrading,expected);await m.click(m.label('Permitir venta y recompra de artillería'));expected.enabled=true;assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));assert.deepEqual(artilleryTradingRules(campaign),expected);
 campaign=order(campaign,{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});assertTradeRejected(campaign,{type:'purchaseEquipment',item:'swivel'});campaign=withStoredGear(campaign,'swivel');assertTradeRejected(campaign,{type:'sellArtillery',kind:'stock',model:'swivel',stockCount:1});assertTradeRejected(campaign,{type:'repurchaseArtillery',artilleryId:'old-offer'});campaign=decodeSave(encodeSave(campaign)).campaign;assert.equal(campaign.armory.swivel,1);assert.deepEqual(artilleryTradingRules(campaign),expected);
 await m.input(m.label('Fondos iniciales de cada taller (pesos)'),1);assert.equal(artilleryTradingRules(campaign).initialCash,777);assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});


test('the weapon editor changes stock cost, force and contact reach through undo, validation and a paid saved deployment',async t=>{
 const m=await mount(t);await m.click(m.button('Armas'));await m.input(m.document.querySelector('input[type="search"]'),'firearm-1800');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(m.label('PA del golpe con la culata').value,'16');assert.equal(m.label('Daño de la culata').value,'18');assert.equal(m.label('Alcance de la culata').value,'1.5');
 await m.input(m.label('PA del golpe con la culata'),23);await m.input(m.label('Daño de la culata'),9);await m.input(m.label('Alcance de la culata'),1);await m.click(m.button('Deshacer'));assert.equal(m.label('Alcance de la culata').value,'1.5');await m.click(m.button('Rehacer'));assert.equal(m.label('Alcance de la culata').value,'1');
 for(const [label,value]of [['Daño de la culata',0],['PA del golpe con la culata',1.5],['Alcance de la culata',2]]){await m.input(m.label(label),value);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);}
 const d=parseContentPackage(m.dom.window.localStorage.getItem(draftKey)),gun=d.weapons.find(w=>w.id==='firearm-1800');assert.equal(gun.stockDamage,9);await m.click(m.button('Iniciar campaña con estas fichas'));let s=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 for(const a of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'visitSector'}]){s=dispatchCampaign(s,a);assert.equal(s.lastError,null);}const p=decodeSave(encodeSave(s,enterSector(s.pendingBattle))),u=p.battle.units.find(u=>u.id==='110');assert.equal(actionCosts(p.battle,u).melee,23);assert.equal(u.weaponMetadata.contentWeapon.stockDamage,9);assert.equal(u.weaponMetadata.contentWeapon.stockReach,1);
});

test('the weapon editor selects, restores and pins compatible ammunition with undo and paid deployment',async t=>{
 const {ammoTypeFor,ammoCount}=await import('../game/ammo-types.js');
 const m=await mount(t),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Armas'));await m.input(m.document.querySelector('input[type="search"]'),'firearm-1800');await m.click(m.document.querySelector('.entry-list button'));
 assert.equal(m.label('Familia de munición').value,'');await m.input(m.label('Familia de munición'),'ammoRifle');await m.click(m.button('Deshacer'));assert.equal(m.label('Familia de munición').value,'');await m.click(m.button('Rehacer'));assert.equal(m.label('Familia de munición').value,'ammoRifle');
 await m.input(m.label('Familia de munición'),'');assert.equal(draft().weapons.find(w=>w.id==='firearm-1800').ammunitionFamily,undefined);await m.click(m.button('Deshacer'));
 assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Iniciar campaña con estas fichas'));let s=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY)).campaign;
 for(const a of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'visitSector'}]){s=dispatchCampaign(s,a);assert.equal(s.lastError,null);}
 const p=decodeSave(encodeSave(s,enterSector(s.pendingBattle))),u=p.battle.units.find(u=>u.id==='110');assert.equal(ammoTypeFor(u),'ammoRifle');assert.ok(ammoCount(u)>0);assert.equal(ammoCount(u,'ammoMusket'),0);
 await m.input(m.label('Familia de munición'),'ammoPistol');assert.equal(ammoTypeFor(p.battle.units.find(u=>u.id==='110')),'ammoRifle');assert.equal(m.dom.window.localStorage.getItem('granaderos.campaign.v1'),'ordinary save');
});

test('the editor authors local ammunition suppliers through validation, undo, reset and pinned metadata while public purchase stays closed',async t=>{
 const {order,saved}=await import('./local-contract-fixture.mjs');const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Reglas'));
 const field=text=>{const group=m.document.querySelector('fieldset[aria-label="Cartuchos de mosquete"]');return [...group.querySelectorAll('label')].find(l=>l.firstChild.textContent===text).querySelector('input');};
 await m.input(m.label('Proveedor a configurar'),'retiro');assert.equal(field('Existencias iniciales').closest('fieldset').parentElement.disabled,true);
 await m.click(m.label('Usar reglas propias en esta localidad'));await m.input(field('Existencias iniciales'),4);await m.input(field('Máximo de existencias'),7);await m.input(field('Cartuchos por reposición'),2);await m.input(m.label('Horas de reposición'),3);
 await m.click(field('Usar precio general'));await m.input(field('Precio por cartucho (pesos)'),8);
 await m.click(m.button('Deshacer'));assert.equal(field('Precio por cartucho (pesos)').value,'1');await m.click(m.button('Rehacer'));assert.equal(draft().ammunitionMarket.locations.retiro.families.ammoMusket.price,8);
 await m.input(field('Existencias iniciales'),8);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar proveedores de munición originales'));assert.equal(draft().ammunitionMarket,undefined);await m.click(m.button('Deshacer'));assert.equal(field('Precio por cartucho (pesos)').value,'8');
 await m.input(m.label('Proveedor a configurar'),'');assert.equal(field('Existencias iniciales').value,'180');await m.input(field('Existencias iniciales'),100);await m.input(m.label('Proveedor a configurar'),'retiro');assert.equal(field('Existencias iniciales').value,'4');
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=order(campaign,{type:'recruitCivic',id:110,term:'month'});assertTradeRejected(campaign,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:2,direction:'buy'});campaign=saved({campaign}).campaign;assert.equal(campaign.ammunitionShops.retiro.stock.ammoMusket,4);assert.equal(campaign.ammunitionShops.mendoza.stock.ammoMusket,100);assert.deepEqual(campaign.contentCampaign.package.ammunitionMarket,draft().ammunitionMarket);
});

test('the editor authors alternative firearm effects through undo, validation, reset and a playable campaign',async t=>{
 const {order,visit,saved,tactical}=await import('./local-contract-fixture.mjs');const {weaponSpecification}=await import('../game/weapon-definition.js');const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 const m=await mount(t,JSON.stringify(d)),draft=()=>parseContentPackage(m.dom.window.localStorage.getItem(draftKey));await m.click(m.button('Armas'));await m.input(m.document.querySelector('input[type="search"]'),'firearm-1800');await m.click(m.document.querySelector('.entry-list button'));
 assert.match(m.label('Pérdida de penetración por distancia').parentElement.parentElement.textContent,/más allá|Más allá/);assert.match(m.document.body.textContent,/no una velocidad medida/);
 assert.equal(m.label('Masa total de la carga principal (g)').value,'32');assert.equal(m.label('Masa total de la carga alternativa (g)').value,'16');
 assert.match(m.document.body.textContent,/20 J por punto.*ajuste de Granaderos/);
 await m.input(m.label('Masa total de la carga principal (g)'),24);await m.input(m.label('Velocidad inicial de la carga principal (m/s)'),200);
 await m.input(m.label('Masa total de la carga principal (g)'),40.1);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.label('Masa total de la carga principal (g)').value,'24');
 await m.input(m.label('Pérdida de penetración por distancia'),.4);await m.input(m.label('Pérdida de penetración por distancia'),1.01);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));assert.equal(m.label('Pérdida de penetración por distancia').value,'0.4');
 await m.input(m.label('Familia de munición'),'ammoRifle');await m.input(m.label('Familia de munición'),'');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);assert.equal(m.label('Familia de la carga').value,'ammoShot');await m.input(m.label('Daño de la carga'),19);await m.input(m.label('Alcance de la carga'),7);await m.input(m.label('Patrón del disparo'),'single');await m.click(m.button('Deshacer'));assert.equal(m.label('Patrón del disparo').value,'cone');await m.click(m.button('Rehacer'));
 await m.input(m.label('Daño de la carga'),0);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,true);await m.click(m.button('Deshacer'));await m.click(m.button('Quitar carga alternativa 1'));assert.deepEqual(draft().weapons.find(w=>w.id==='firearm-1800').alternativeLoads,[]);await m.click(m.button('Deshacer'));
 await m.click(m.button('Restaurar cargas alternativas originales'));assert.equal(m.label('Daño de la carga').value,'28');assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Deshacer'));assert.equal(m.label('Daño de la carga').value,'19');
 await m.input(m.label('Pérdida de penetración de la carga'),.6);await m.input(m.label('Pérdida de penetración de la carga'),'');assert.equal(draft().weapons.find(w=>w.id==='firearm-1800').alternativeLoads[0].materialRangeSlope,undefined);assert.equal(m.button('Iniciar campaña con estas fichas').disabled,false);await m.click(m.button('Deshacer'));assert.equal(m.label('Pérdida de penetración de la carga').value,'0.6');
 const energyToggle=m.document.querySelector('[aria-label="Cargas alternativas"] input[type="checkbox"]');assert.equal(energyToggle.checked,false);await m.click(energyToggle);
 await m.input(m.label('Masa total de la carga alternativa (g)'),12);await m.input(m.label('Velocidad inicial de la carga alternativa (m/s)'),250);
 await m.click(m.button('Iniciar campaña con estas fichas'));let {campaign}=decodeSave(m.dom.window.sessionStorage.getItem(CONTENT_LAUNCH_KEY));campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});assert.equal(campaign.operativeState[110].weaponMetadata.contentWeapon.materialRangeSlope,.4);campaign=withCarriedAmmo(campaign,110,'ammoShot',3);campaign=order(campaign,{type:'unloadAmmunition',operativeId:110});campaign=order(campaign,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoShot'});let p=visit(campaign);p=saved(tactical(p,{type:'reload',unitId:'110'}));const u=p.battle.units.find(u=>u.id==='110'),w=weaponSpecification(u);assert.equal(p.battle.lastError,null);assert.equal(u.ammunitionChoice,'ammoShot');assert.equal(w.damage,19);assert.equal(w.range,7);assert.equal(w.loadPattern,'single');assert.equal(w.materialRangeSlope,.6);assert.deepEqual(w.projectileEnergy,{model:'kinetic-energy-v1',massGrams:12,muzzleVelocityMps:250});assert.deepEqual(u.weaponMetadata.contentWeapon.projectileEnergy,{model:'kinetic-energy-v1',massGrams:24,muzzleVelocityMps:200});assert.equal(u.loaded,1);assert.equal(ammoCount(u,'ammoShot'),2);assert.equal(ammoCount(u,'ammoMusket'),10);
});
