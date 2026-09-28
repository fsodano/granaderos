import {dialoguePackage} from './dialogue-fixture.mjs';
import {readyLocal,localId,localNPC,tactical as localTactical,order as localOrder,leave as leaveLocal,visit as visitLocal} from './local-contract-fixture.mjs';
import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {CONTENT_SAVE_KEY} from '../game/content-launch.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {withCharacterSpeech} from '../game/character-events.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
register('./tactical-render-loader.mjs',import.meta.url);
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function fixture({residents=false,late=false}={}){
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 if(residents){const base=structuredClone(d.characters.find(c=>c.id==='person-100'));delete base.arrivalHours;
  for(const id of ['pablo','sal'])d.characters.push({...structuredClone(base),id,name:id,nickname:id,recruitmentSource:'encounter',service:'permanent',monthlyPay:0,attributes:{...base.attributes,maxHp:95},encounter:{recruitable:true,greeting:id,requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
  d.placements.push({id:'pablo-place',character:'pablo',mode:'fixed',sectors:['cell-27-27'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0},{id:'sal-place',character:'sal',mode:'fixed',sectors:['cell-26-27'],moveChance:100,afterDeath:'pablo',delayMin:10,delayMax:10});
 }
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});
 s=order(s,{type:'travel',sector:'cell-27-27'});
 if(late)s=order(s,{type:'wait',hours:23-s.hour});
 s=order(s,{type:'visitSector'});return decodeSave(encodeSave(s,enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0})));
}
const expected=(p,a)=>{const b=withCharacterSpeech(p.battle,a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a));assert.equal(b.lastError,null,b.lastError);const n=syncBattleTime(p.campaign,b);assert.equal(n.error,null,n.error);return {campaign:n.campaign,battle:n.battle};};
const pair=s=>({campaign:s.campaign,battle:s.battle});

test('registered orders keep consecutive tactical actions, midnight, UI orders and autosave on the same campaign clock',async t=>{
 const m=await mount(t,fixture({late:true}));let want=structuredClone(pair(m.read()));const unitId=want.battle.units.find(u=>u.side==='player').id;
 const actions=Array.from({length:7},()=>({type:'rest',unitId}));
 // No React render between executions: each call must see the last accepted pair.
 await act(async()=>{for(const action of actions){want=expected(want,action);const result=m.issue(action);assert.equal(result.turn,want.battle.turn);assert.deepEqual(pair(m.read()),want);}});
 assert.ok(want.campaign.hour>=24);assert.equal(want.battle.syncedSeconds,want.battle.elapsedSeconds);assert.deepEqual(m.saved(),want);
 want=expected(want,{type:'endTurn'});await act(async()=>{m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,500));});
 assert.deepEqual(pair(m.read()),want);assert.deepEqual(m.saved(),want);
 await m.click('Volver a la campaña');
 await act(async()=>assert.throws(()=>m.issue({type:'rest',unitId}),/No hay batalla activa/));
});

test('registered civilian attack and aid persist finite supplies, death and a delayed successor',async t=>{
 const m=await mount(t,fixture({residents:true}));let state=m.read(),want=structuredClone(pair(state));const unit=state.battle.units.find(u=>u.side==='player'),npc=state.battle.npcs.find(n=>n.contentId==='pablo');
 const tile=getReachable(state.battle,unit.id).find(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1);assert.ok(tile);
 async function issue(a){want=expected(want,{unitId:unit.id,...a});await act(async()=>m.issue({unitId:unit.id,...a}));assert.deepEqual(pair(m.read()),want);assert.deepEqual(m.saved(),want);}
 if(tile.cost)await issue({type:'move',x:tile.x,y:tile.y});
 await issue({type:'melee',targetId:npc.id});const charges=want.battle.units.find(u=>u.id===unit.id).medkits;
 await issue({type:'heal',targetId:npc.id});assert.ok(want.battle.units.find(u=>u.id===unit.id).medkits<charges);
 for(let i=0;i<6&&want.battle.npcs.find(n=>n.id===npc.id).hp>0;i++)await issue({type:'melee',targetId:npc.id});
 assert.equal(want.battle.npcs.find(n=>n.id===npc.id).hp,0);assert.equal(want.campaign.contentPresence.receipts.length,1);assert.equal(want.campaign.contentPresence.people.sal.appeared,false);
 await issue({type:'rest'});assert.equal(want.campaign.contentPresence.people.sal.appeared,true);assert.equal(want.campaign.contentPresence.receipts.length,1);
});

test('rejected tool and UI orders leave both simulation states and the saved campaign intact',async t=>{
 const m=await mount(t,fixture()),before=structuredClone(pair(m.read())),wire=m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),unitId=before.battle.units.find(u=>u.side==='player').id;
 await act(async()=>{assert.throws(()=>m.issue({type:'bogus',unitId}),/Orden no válida/);assert.throws(()=>m.issue({type:'move',unitId,x:-100,y:-100}));assert.throws(()=>m.issue({type:'fire',unitId:'missing',targetId:'missing'}));});
 assert.deepEqual(pair(m.read()),before);assert.equal(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),wire);
 // A full, primed weapon cannot be reloaded from the normal keyboard controls.
 await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'r',altKey:true,bubbles:true})));
 assert.ok(m.document.querySelector('[role="status"]'));assert.deepEqual(pair(m.read()),before);assert.equal(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),wire);
});

test('registered orders retain standalone combat and unregister when the game unmounts',async t=>{
 const m=await mount(t);await m.click('Combate de San Lorenzo');const before=m.read().battle,want=withCharacterSpeech(before,endTurn(before));
 await act(async()=>m.issue({type:'endTurn'}));assert.equal(m.read().campaign,null);assert.deepEqual(m.read().battle,want);assert.equal(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),null);
 await m.unmount();assert.ok(m.registrations.every(r=>r.signal.aborted));
});

test('a delayed UI turn cannot overwrite a newer accepted tool order',async t=>{
 const m=await mount(t,fixture()),before=structuredClone(pair(m.read()));const unitId=before.battle.units.find(u=>u.side==='player').id;
 const action={type:'movement',unitId,movement:'crouch'},want=expected(before,action);
 await act(async()=>{m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true}));m.issue(action);await new Promise(resolve=>setTimeout(resolve,500));});
 assert.deepEqual(pair(m.read()),want);assert.deepEqual(m.saved(),want);assert.match(m.document.querySelector('[role="status"]').textContent,/combate cambió/);
});

test('the actual conversation displays a local contract price and hires the wounded resident for the selected term',async t=>{
 let p=readyLocal();p=localTactical(p,{type:'melee',targetId:localNPC(p.battle).id});p=localTactical(p,{type:'heal',targetId:localNPC(p.battle).id});const hp=localNPC(p.battle).hp,id=localId(p.campaign),cash=p.campaign.resources.treasury;
 const m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"]');assert.ok(npc);
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const select=m.document.querySelector('[aria-label="Conversación"] select');assert.ok(select);assert.deepEqual([...select.options].map(o=>o.textContent),['Un día · 10 pesos','Una semana · 70 pesos','Un mes · 300 pesos']);
 await act(async()=>{select.value='week';select.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});
 await m.click('Contratar · 70 pesos');const state=m.read();assert.equal(state.campaign.resources.treasury,cash-70);assert.equal(state.campaign.contracts[id].term,'week');assert.equal(state.campaign.contracts[id].expiresAt,p.campaign.hour+168);assert.equal(state.campaign.hiringArrivals.length,0);
 assert.equal(state.battle.units.find(u=>u.id===String(id)).hp,hp);assert.equal(localNPC(state.battle),undefined);assert.deepEqual(m.saved(),pair(state));
});

test('the actual conversation shows missing funds and disables the local hiring action',async t=>{
 const p=readyLocal({pay:1000000}),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"]');assert.ok(npc);
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const button=[...m.document.querySelectorAll('button')].find(b=>b.textContent==='Contratar · 33334 pesos');assert.ok(button);assert.equal(button.disabled,true);assert.match(m.document.querySelector('[aria-label="Conversación"]').textContent,/Necesitás 33334 pesos/);assert.deepEqual(pair(m.read()),p);
});

test('the actual conversation follows authored choices, rejects a second stale click and saves the selected branch',async t=>{
 const p=readyLocal(undefined,dialoguePackage()),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"]');assert.ok(npc);
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');
 let conversation=m.document.querySelector('[aria-label="Conversación"]');assert.match(conversation.textContent,/El camino tiene dos salidas/);
 const north=[...conversation.querySelectorAll('button')].find(b=>b.textContent==='Contame sobre el norte.'),river=[...conversation.querySelectorAll('button')].find(b=>b.textContent==='Prefiero conocer el río.');assert.ok(north&&river);
 await act(async()=>{north.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));river.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));});
 assert.equal(m.read().campaign.lastConversation.dialogueNode,'north');assert.match(m.document.querySelector('[role="status"]').textContent,/conversación cambió/);assert.deepEqual(m.saved(),pair(m.read()));
 await m.click('Volvamos a las opciones.');await m.click('Prefiero conocer el río.');assert.equal(m.read().campaign.lastConversation.dialogueNode,'river');assert.match(m.document.querySelector('[aria-label="Conversación"]').textContent,/Seguí la ribera al amanecer/);assert.deepEqual(m.saved(),pair(m.read()));
});

test('the mounted conversation reveals a day-gated choice when the actual tactical clock crosses midnight',async t=>{
 const d=dialoguePackage();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions=[{type:'day',min:2,max:null}];let p=readyLocal(undefined,d);
 let s=localOrder(leaveLocal(p),{type:'wait',hours:23-p.campaign.hour});p=visitLocal(s);const n=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);if(spot.cost)p=localTactical(p,{type:'move',x:spot.x,y:spot.y});
 const m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"]');assert.ok(npc);await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');assert.ok(!m.document.querySelector('[aria-label="Conversación"]').textContent.includes('Contame sobre el norte.'));
 await act(async()=>{for(let i=0;i<6;i++)m.issue({type:'rest'});});assert.ok(m.read().campaign.hour>=24);assert.match(m.document.querySelector('[aria-label="Conversación"]').textContent,/Contame sobre el norte/);assert.deepEqual(m.saved(),pair(m.read()));
});

async function mount(t,saved){
 const console=new VirtualConsole();console.on('jsdomError',error=>{throw error;});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test/?content=1',pretendToBeVisual:true,virtualConsole:console});dom.window.scrollTo=()=>{};
 if(saved)dom.window.localStorage.setItem(CONTENT_SAVE_KEY,encodeSave(saved.campaign,saved.battle));
 const registrations=[];dom.window.document.modelContext={registerTool(tool,{signal}){registrations.push({...tool,signal});}};
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:Home}=await import('../web/app/page.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let mounted=true;
 const unmount=async()=>{if(mounted){await act(async()=>root.unmount());mounted=false;}};
 t.after(async()=>{try{await unmount();}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Home)));const document=dom.window.document;
 const click=async text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(text));assert.ok(b,text);await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 if(saved){await click('Continuar campaña');if(saved.battle.mode==='exploration')await click('Pausar exploración');}
 return {dom,document,registrations,unmount,click,read:()=>registrations.find(t=>t.name==='read_granaderos_state').execute(),issue:action=>registrations.find(t=>t.name==='issue_granaderos_tactical_order').execute(action),saved:()=>decodeSave(dom.window.localStorage.getItem(CONTENT_SAVE_KEY))};
}
