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
