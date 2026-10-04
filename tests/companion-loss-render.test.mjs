import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {initialCampaign,dispatchCampaign,rosterFor,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const {default:ReceivedCorrespondence}=await import('../web/app/ReceivedCorrespondence.tsx');

const SUBJECT='Una pérdida en el destacamento';
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=(campaign,battle=null)=>decodeSave(encodeSave(campaign,battle));
const lossLetters=state=>(state.correspondence??[]).filter(message=>message.subject===SUBJECT);

function actualPaidLoss(content=defaultContentPackage()){
 // This is an actual paid Retiro visit, not a manufactured received message or
 // casualty. Both shots use Aguirre's once-issued pistol and finite cartridges.
 let campaign=initialCampaign(42,content);
 for(const id of [107,116])campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});
 assert.deepEqual(campaign.recruited,[107,116]);
 campaign=order(campaign,{type:'renewContract',id:107,term:'day'});
 campaign=order(campaign,{type:'visitSector'});
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 const fire=()=>{
  const companion=battle.units.find(unit=>unit.id==='116');
  battle=actBattle(battle,{type:'firePoint',unitId:'107',x:companion.x,y:companion.y,aim:4});
  assert.equal(battle.lastError,null,battle.lastError);
 };
 fire();assert.ok(battle.units.find(unit=>unit.id==='116').hp>0);
 battle=actBattle(battle,{type:'reload',unitId:'107'});assert.equal(battle.lastError,null,battle.lastError);
 fire();assert.equal(battle.units.find(unit=>unit.id==='116').hp,0);
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null,synced.error);
 const pending=saved(synced.campaign,synced.battle);
 assert.equal(lossLetters(pending.campaign).length,0,'a tactical snapshot alone is not a confirmed return letter');
 const completed=order(pending.campaign,{type:'leaveSector',battleId:pending.campaign.pendingBattle.id,
  sectorState:pending.battle,survivors:pending.battle.units.filter(unit=>unit.side==='player')});
 assert.equal(completed.operativeState[116].alive,false);assert.equal(completed.operativeState[116].hp,0);
 return {pending,completed:saved(completed).campaign};
}

async function mountInbox(t,state){
 const dom=new JSDOM('<!doctype html><div id="root"></div>');
 const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const host=dom.window.document.getElementById('root'),root=createRoot(host);
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const show=async campaign=>{await act(async()=>root.render(h(ReceivedCorrespondence,{state:campaign})));};
 await show(state);
 return {host,show,async click(button){assert.ok(button);assert.equal(button.disabled,false);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}};
}

test('the received letter opens through its real navigation control and never changes saved campaign state',async t=>{
 const {completed:state}=actualPaidLoss(),before=structuredClone(state),encoded=serializeCampaign(state);
 const sender=rosterFor(state).find(operative=>operative.id===107),companion=rosterFor(state).find(operative=>operative.id===116);
 const messages=lossLetters(state);assert.equal(messages.length,1);const letter=messages[0];
 assert.equal(letter.id,'companion-loss:107:116');assert.equal(letter.received,true);assert.equal(letter.sender,sender.name);assert.equal(letter.subject,SUBJECT);
 assert.equal(letter.text,`Lamento la muerte de ${companion.name}. Confiaba en su ayuda.`);
 const inbox=await mountInbox(t,state),buttons=[...inbox.host.querySelectorAll('nav[aria-label="Mensajes recibidos"] button')];
 const lossButton=buttons.find(button=>button.textContent.includes(SUBJECT)),arrivalButton=buttons.find(button=>button.textContent.includes('Llegada de'));
 assert.ok(lossButton);assert.ok(arrivalButton,'the other message is a real paid arrival receipt');
 await inbox.click(arrivalButton);assert.equal(arrivalButton.getAttribute('aria-pressed'),'true');assert.equal(lossButton.getAttribute('aria-pressed'),'false');
 assert.match(inbox.host.querySelector('article').textContent,/Llegada de/);
 await inbox.click(lossButton);assert.equal(lossButton.getAttribute('aria-pressed'),'true');assert.equal(arrivalButton.getAttribute('aria-pressed'),'false');
 const article=inbox.host.querySelector('article');assert.equal(article.querySelector('h3').textContent,SUBJECT);
 assert.equal(article.querySelectorAll('p')[0].textContent,`De ${sender.name}`);
 assert.equal(article.querySelectorAll('p')[1].textContent,letter.text);
 assert.match(article.textContent,/Inés Aguirre/);assert.match(article.textContent,/Petrona Lagos/);
 assert.deepEqual(state,before);assert.equal(serializeCampaign(state),encoded);
 assert.deepEqual(saved(state).campaign,before,'opening correspondence cannot change time, RNG, morale, contracts, wounds or finite gear');
});

test('unconfirmed and older pinned losses offer no companion letter, while a fresh empty inbox stays empty',async t=>{
 const current=actualPaidLoss(),old=defaultContentPackage();for(const character of old.characters)delete character.preferredCompanions;
 const legacy=actualPaidLoss(old),empty=initialCampaign(42),inbox=await mountInbox(t,empty);
 assert.match(inbox.host.textContent,/Todavía no recibiste correspondencia\./);assert.equal(inbox.host.querySelector('nav'),null);
 for(const state of [current.pending.campaign,legacy.completed]){
  const before=structuredClone(state),encoded=serializeCampaign(state);assert.equal(lossLetters(state).length,0);
  await inbox.show(state);assert.doesNotMatch(inbox.host.textContent,/Una pérdida en el destacamento/);
  const buttons=[...inbox.host.querySelectorAll('nav button')];assert.ok(buttons.length>0,'ordinary arrival letters remain available');
  for(const button of buttons)await inbox.click(button);
  assert.deepEqual(state,before);assert.equal(serializeCampaign(state),encoded);
 }
});
