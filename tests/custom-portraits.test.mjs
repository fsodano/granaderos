import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {CHARACTER_PORTRAITS,PROFILE_ATTRIBUTES,OFFICER_QUESTIONS,PROFILE_QUESTIONS,defaultProfile,createOfficerRecord} from '../game/recruitment.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {portraitFor} from '../web/lib/portraits.ts';

register('./tactical-render-loader.mjs',import.meta.url);
const {default:CharacterCreator}=await import('../web/app/CharacterCreator.tsx');
const {default:JA2Roster}=await import('../web/app/JA2Roster.tsx');
const answers={origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue',specialty:'night',temperament:'optimistic'};
const expectedIds=['avatar-woman-scout','avatar-woman-civilian','avatar-man-gaucho','avatar-man-soldier',...Array.from({length:48},(_,i)=>String(100+i))];
const profileFor=portraitId=>({...defaultProfile(),portraitId,attributes:{...defaultProfile().attributes,marksmanship:75,mechanical:35}});
const attributes=record=>Object.fromEntries(PROFILE_ATTRIBUTES.map(({id})=>[id,record[id]]));
const starting=initialCampaign(8);
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const images=html=>[...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);

test('the own-character catalog contains the four legacy avatars and all 48 hired portraits with real image files',()=>{
 assert.deepEqual(CHARACTER_PORTRAITS.map(p=>p.id),expectedIds);
 assert.equal(new Set(CHARACTER_PORTRAITS.map(p=>p.src)).size,52);
 assert.equal(defaultProfile().portraitId,'avatar-man-gaucho');assert.equal(defaultProfile().version,2);
 for(const p of CHARACTER_PORTRAITS){
  assert.equal(p.src,portraitFor(p.id),p.id);assert.match(p.src,/^\/art\/[a-z0-9-]+\.(webp|png)$/);
  const file=new URL(`../web/public${p.src}`,import.meta.url);assert.ok(existsSync(file),p.id);
  const bytes=readFileSync(file);assert.ok(bytes.length>1000,p.id);
  if(p.src.endsWith('.png'))assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  else{assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');}
 }
});

for(const portraitId of expectedIds)test(`custom portrait ${portraitId} survives creation, campaign/battle saves, deployment, return, and the tactical portrait strip`,()=>{
 const p=CHARACTER_PORTRAITS.find(p=>p.id===portraitId);assert.ok(p,portraitId);
 const profile=profileFor(portraitId),originalProfile=structuredClone(profile);
 const baseline=createOfficerRecord('Elena Testigo',answers,profileFor('avatar-man-gaucho'));
 const selected=createOfficerRecord('Elena Testigo',answers,profile);
 const withoutPortrait=({portrait,portraitId,...rest})=>rest;
 assert.deepEqual(withoutPortrait(selected),withoutPortrait(baseline),'choosing a face changes no attributes, traits, class, equipment, pay or identity');
 let campaign=order(starting,{type:'createOfficer',name:'Elena Testigo',answers,profile});
 assert.deepEqual(profile,originalProfile);assert.equal(campaign.resources.treasury,starting.resources.treasury);assert.deepEqual(campaign.recruited,[1000]);assert.equal(campaign.contracts[1000].paid,0);
 campaign=decodeSave(encodeSave(campaign)).campaign;
 const officer=rosterFor(campaign).find(o=>o.id===1000);assert.equal(officer.portraitId,p.id);assert.equal(officer.portrait,p.src);assert.deepEqual(attributes(officer),profile.attributes);
 campaign=order(campaign,{type:'visitSector'});
 assert.equal(campaign.pendingBattle.squad.find(o=>o.id===1000).portraitId,p.id);
 const battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);
 const restored=decodeSave(encodeSave(campaign,battle)),unit=restored.battle.units.find(u=>u.id==='1000');
 assert.equal(unit.portraitId,p.id);assert.equal(unit.portrait,p.src);assert.deepEqual(attributes(unit),profile.attributes);
 const tactical=renderToStaticMarkup(h(JA2Roster,{battle:restored.battle,players:[unit],selected:unit.id,onSelect(){},onOpenInventory(){}}));
 assert.ok(images(tactical).includes(p.src),'the actual tactical portrait strip shows the selected face');
 const returned=order(restored.campaign,{type:'leaveSector',battleId:restored.campaign.pendingBattle.id,sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 const loaded=decodeSave(encodeSave(returned)).campaign,returnedOfficer=rosterFor(loaded).find(o=>o.id===1000);
 assert.deepEqual(loaded.officer.profile,profile);assert.equal(returnedOfficer.portrait,p.src);assert.deepEqual(attributes(returnedOfficer),profile.attributes);
});

test('unknown or external portrait IDs cannot enter a character or saved campaign',()=>{
 const valid=order(starting,{type:'createOfficer',name:'Elena Testigo',answers,profile:defaultProfile()});
 for(const portraitId of [100,'99','148','1000','0100','100.0','avatar-unknown','../../portrait-100.webp','https://example.com/portrait.webp','data:image/svg+xml,<svg/>','javascript:alert(1)',null]){
  const profile={...defaultProfile(),portraitId};assert.throws(()=>createOfficerRecord('Elena Testigo',answers,profile),/retrato/);
  const rejected=dispatchCampaign(starting,{type:'createOfficer',name:'Elena Testigo',answers,profile});assert.ok(rejected.lastError);assert.equal(rejected.officer,null);assert.deepEqual(rejected.recruited,[]);assert.equal(rejected.resources.treasury,starting.resources.treasury);
  const value=JSON.parse(encodeSave(valid));value.campaign.officer.profile.portraitId=portraitId;assert.throws(()=>decodeSave(JSON.stringify(value)),/retrato/);
 }
 const attempted={...profileFor('147'),src:'https://example.com/portrait.webp',portrait:'javascript:alert(1)'};
 assert.equal(createOfficerRecord('Elena Testigo',answers,attempted).portrait,portraitFor('147'),'display sources come from the local catalog, not arbitrary profile URLs');
});

async function mountCreator(t){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const style=dom.window.document.createElement('style');style.textContent=readFileSync(new URL('../web/app/CharacterCreator.css',import.meta.url),'utf8');dom.window.document.head.append(style);
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 // Initialize React's input event support with a real document available.
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root')),created=[];
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(CharacterCreator,{onCreate:(name,answers,profile)=>created.push({name,answers,profile})})));
 return {dom,created,
  async click(button){assert.ok(button);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async input(element,value){const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,String(value));await act(async()=>element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})));},
 };
}

test('the mounted creator exposes every portrait and changing faces preserves the name, class, answers and attributes',async t=>{
 const m=await mountCreator(t),document=m.dom.window.document;
 const field=[...document.querySelectorAll('fieldset')].find(field=>field.querySelector('legend')?.textContent==='Retrato');assert.ok(field);
 const buttons=[...field.querySelectorAll('button')];assert.equal(buttons.length,52);assert.equal(field.querySelectorAll('select').length,0,'portrait access does not depend on a category filter');
 assert.equal(buttons.filter(button=>button.getAttribute('aria-pressed')==='true').length,1);
 assert.equal(buttons.find(button=>button.getAttribute('aria-pressed')==='true').querySelector('img').getAttribute('src'),portraitFor('avatar-man-gaucho'));
 const grid=field.querySelector('.creator-portraits');assert.ok(['auto','scroll'].includes(m.dom.window.getComputedStyle(grid).overflowY),'the full catalog has a scrollable grid');
 await m.input(document.querySelector('input[placeholder="Nombre y apellido"]'),'Elena Testigo');
 await m.input(document.querySelector('input[placeholder="Cómo te llama la escuadra"]'),'Luz');
 const selects=[...document.querySelectorAll('select')];await m.input(selects[0],'artesano');
 const questions=[...OFFICER_QUESTIONS,...PROFILE_QUESTIONS];for(let i=0;i<questions.length;i++)await m.input(selects[i+1],answers[questions[i].id]);
 const attributeInput=name=>[...document.querySelectorAll('.creator-attributes label')].find(label=>label.textContent.startsWith(name))?.querySelector('input');
 await m.input(attributeInput('Puntería'),75);await m.input(attributeInput('Mecánica'),35);
 const values=()=>[...document.querySelectorAll('.creator-attributes input')].map(input=>input.value),chosenAttributes=values();
 for(let i=0;i<buttons.length;i++){
  assert.equal(buttons[i].getAttribute('aria-label'),`Elegir retrato ${i+1}`);assert.equal(buttons[i].disabled,false);buttons[i].focus();assert.equal(document.activeElement,buttons[i]);
  await m.click(buttons[i]);assert.equal(buttons[i].getAttribute('aria-pressed'),'true');assert.equal(field.querySelectorAll('button[aria-pressed="true"]').length,1);
  assert.deepEqual(values(),chosenAttributes);assert.equal(selects[0].value,'artesano');
  assert.equal(field.querySelector('.creator-portrait-preview img').getAttribute('src'),CHARACTER_PORTRAITS[i].src);assert.ok(field.querySelector('[aria-live="polite"]').textContent.includes(`Retrato ${i+1}`));
 }
 await m.click([...document.querySelectorAll('button')].find(button=>button.textContent.includes('Comenzar mi campaña')));
 assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(m.created.length,1);
 const created=m.created[0];assert.equal(created.name,'Elena Testigo');assert.deepEqual(created.answers,answers);assert.equal(created.profile.nickname,'Luz');assert.equal(created.profile.classId,'artesano');assert.equal(created.profile.version,2);assert.equal(created.profile.portraitId,'147');assert.deepEqual(created.profile.attributes,profileFor('147').attributes);
});
