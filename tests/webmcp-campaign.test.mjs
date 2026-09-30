import {mountCampaign as mountUI} from './mounted-campaign-fixture.mjs';
import {survivalPackage} from './quest-survival-fixture.mjs';
import {questPackage} from './content-quest-fixture.mjs';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {readyLocal,localPackage,localId,localNPC,tactical as localTactical,order as localOrder,leave as leaveLocal,visit as visitLocal} from './local-contract-fixture.mjs';
import {playerKnownState,playerKnownBattle} from '../game/player-known-state.js';
import {battleFromRequest} from '../game/battle-handoff.js';
import {OPERATIVES} from '../game/campaign.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {CONTENT_SAVE_KEY} from '../game/content-launch.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,canSee,lookPreview} from '../game/tactical.js';
import {withCharacterSpeech} from '../game/character-events.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
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
const observed=(m,p)=>assert.deepEqual(pair(m.read()),pair(playerKnownState({...p,screen:m.read().screen})));
async function mount(t,p){
 const m=await mountUI(t,p),saved=m.saved;
 // The public tool exposes perception, not a restorable simulation snapshot.
 // Read the actual autosave for custody and compare the public projection too.
 m.saved=()=>{const state=saved();observed(m,state);return state;};return m;
}

async function approachMounted(m,unitId,npcId){
 for(let step=0;step<240;step++){
  const {battle}=m.saved(),unit=battle.units.find(u=>u.id===unitId),npc=battle.npcs.find(n=>n.id===npcId);
  if(Math.abs(unit.x-npc.x)+Math.abs(unit.y-npc.y)<=1){
   if(canSee(battle,unit,npc))return;
   const look=lookPreview(battle,unit,npc);assert.equal(look.valid,true,look.reason);
   await act(async()=>m.issue({type:'look',unitId,x:npc.x,y:npc.y}));continue;
  }
  const goal=getReachable(battle,unit).filter(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(goal?.path.length,'A legal path must reach the resident.');
  await act(async()=>m.issue({type:'move',unitId,...goal.path[0]}));
 }
 assert.fail('The resident was not reached.');
}

test('registered orders keep consecutive tactical actions, midnight, UI orders and autosave on the same campaign clock',async t=>{
 const m=await mount(t,fixture({late:true}));let want=structuredClone(pair(m.saved()));const unitId=want.battle.units.find(u=>u.side==='player').id;
 const actions=Array.from({length:7},()=>({type:'rest',unitId}));
 // No React render between executions: each call must see the last accepted pair.
 await act(async()=>{for(const action of actions){want=expected(want,action);const result=m.issue(action);assert.equal(result.turn,want.battle.turn);observed(m,want);}});
 assert.ok(want.campaign.hour>=24);assert.equal(want.battle.syncedSeconds,want.battle.elapsedSeconds);assert.deepEqual(m.saved(),want);
 want=expected(want,{type:'endTurn'});await act(async()=>{m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,500));});
 assert.deepEqual(pair(m.saved()),want);assert.deepEqual(m.saved(),want);
 await m.click('Volver a la campaña');
 await act(async()=>assert.throws(()=>m.issue({type:'rest',unitId}),/No hay batalla activa/));
});

test('registered civilian attack and aid persist finite supplies, death and a delayed successor',async t=>{
 const m=await mount(t,fixture({residents:true}));let state=m.saved(),want=structuredClone(pair(state));const unit=state.battle.units.find(u=>u.side==='player'),npc=state.battle.npcs.find(n=>n.contentId==='pablo');
 const tile=getReachable(state.battle,unit.id).find(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1);assert.ok(tile);
 async function issue(a){want=expected(want,{unitId:unit.id,...a});await act(async()=>m.issue({unitId:unit.id,...a}));assert.deepEqual(pair(m.saved()),want);assert.deepEqual(m.saved(),want);}
 if(tile.cost)await issue({type:'move',x:tile.x,y:tile.y});
 await issue({type:'melee',targetId:npc.id});const charges=want.battle.units.find(u=>u.id===unit.id).medkits;
 await issue({type:'weapon',slot:'medical'});await issue({type:'heal',targetId:npc.id});await issue({type:'weapon',slot:'primary'});assert.ok(want.battle.units.find(u=>u.id===unit.id).medkits<charges);
 for(let i=0;i<6&&want.battle.npcs.find(n=>n.id===npc.id).hp>0;i++)await issue({type:'melee',targetId:npc.id});
 assert.equal(want.battle.npcs.find(n=>n.id===npc.id).hp,0);assert.equal(want.campaign.contentPresence.receipts.length,1);assert.equal(want.campaign.contentPresence.people.sal.appeared,false);
 await issue({type:'rest'});assert.equal(want.campaign.contentPresence.people.sal.appeared,true);assert.equal(want.campaign.contentPresence.receipts.length,1);
});

test('rejected tool and UI orders leave both simulation states and the saved campaign intact',async t=>{
 const m=await mount(t,fixture()),before=structuredClone(pair(m.saved())),wire=m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),unitId=before.battle.units.find(u=>u.side==='player').id;
 await act(async()=>{assert.throws(()=>m.issue({type:'bogus',unitId}),/Orden no válida/);assert.throws(()=>m.issue({type:'move',unitId,x:-100,y:-100}));assert.throws(()=>m.issue({type:'fire',unitId:'missing',targetId:'missing'}));});
 assert.deepEqual(pair(m.saved()),before);assert.equal(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),wire);
 // A full, primed weapon cannot be reloaded from the normal keyboard controls.
 await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'r',altKey:true,bubbles:true})));
 assert.ok(m.document.querySelector('[role="status"]'));assert.deepEqual(pair(m.saved()),before);assert.equal(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),wire);
});

test('registered orders retain standalone combat and unregister when the game unmounts',async t=>{
 const m=await mount(t);await m.click('Combate de San Lorenzo');const before=battleFromRequest({squad:OPERATIVES.filter(x=>[3,4,7,10].includes(x.id)).map(x=>({...x,horse:true})),id:'san_lorenzo',name:'San Lorenzo · 3 de febrero de 1813',biome:'river',seed:18130203,enemyCount:4}),want=withCharacterSpeech(before,endTurn(before));
 await act(async()=>m.issue({type:'endTurn'}));assert.equal(m.read().campaign,null);assert.deepEqual(m.read().battle,playerKnownBattle(want));assert.equal(m.dom.window.localStorage.getItem(CONTENT_SAVE_KEY),null);
 await m.unmount();assert.ok(m.registrations.every(r=>r.signal.aborted));
});

test('a pending visible UI turn rejects competing tool orders and commits one synchronized save',async t=>{
 const m=await mount(t,fixture()),source=m.saved().battle,before=structuredClone(pair(m.saved()));const unitId=before.battle.units.find(u=>u.side==='player').id;
 const action={type:'movement',unitId,movement:'crouch'},turn=expected(before,{type:'endTurn'});
 await act(async()=>{m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true}));assert.throws(()=>m.issue(action),/termine el movimiento/);assert.deepEqual(pair(m.saved()),before);assert.deepEqual(m.saved(),before);});
 const deadline=Date.now()+10000;while(m.saved().battle.turn===source.turn&&Date.now()<deadline)await act(async()=>new Promise(resolve=>setTimeout(resolve,20)));
 assert.deepEqual(pair(m.saved()),turn);assert.deepEqual(m.saved(),turn);
 const want=expected(turn,action);await act(async()=>m.issue(action));assert.deepEqual(pair(m.saved()),want);assert.deepEqual(m.saved(),want);
});

test('the actual conversation displays a local contract price and hires the wounded resident for the selected term',async t=>{
 const d=localPackage();d.characters.at(-1).startingCondition={hp:10,energy:100,fatigue:0,bleeding:0,bandaged:85};let p=readyLocal(undefined,d);p=localTactical(p,{type:'weapon',slot:'medical'});p=localTactical(p,{type:'heal',targetId:localNPC(p.battle).id});p=localTactical(p,{type:'weapon',slot:'primary'});const hp=localNPC(p.battle).hp,id=localId(p.campaign),cash=p.campaign.resources.treasury;
 const m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');assert.ok(npc);
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const select=m.document.querySelector('[role="dialog"][aria-label^="Conversación con"] select');assert.ok(select);assert.deepEqual([...select.options].map(o=>o.textContent),['Un día · 10 pesos','Una semana · 70 pesos','Un mes · 300 pesos']);
 await act(async()=>{select.value='week';select.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});
 await m.click('Contratar · 70 pesos');const state=m.saved();assert.equal(state.campaign.resources.treasury,cash-70);assert.equal(state.campaign.contracts[id].term,'week');assert.equal(state.campaign.contracts[id].expiresAt,p.campaign.hour+168);assert.equal(state.campaign.hiringArrivals.length,0);
 assert.equal(state.battle.units.find(u=>u.id===String(id)).hp,hp);assert.equal(localNPC(state.battle),undefined);assert.deepEqual(m.saved(),pair(state));
});

test('the actual conversation shows missing funds and disables the local hiring action',async t=>{
 const p=readyLocal({pay:1000000}),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');assert.ok(npc);
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const button=[...m.document.querySelectorAll('button')].find(b=>b.textContent==='Contratar · 33334 pesos');assert.ok(button);assert.equal(button.disabled,true);assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Necesitás 33334 pesos/);assert.deepEqual(pair(m.saved()),p);
});

test('the actual conversation follows authored choices, rejects a second stale click and saves the selected branch',async t=>{
 const p=readyLocal(undefined,dialoguePackage()),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');assert.ok(npc);
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');
 let conversation=m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]');assert.match(conversation.textContent,/El camino tiene dos salidas/);
 const north=[...conversation.querySelectorAll('button')].find(b=>b.textContent==='Contame sobre el norte.'),river=[...conversation.querySelectorAll('button')].find(b=>b.textContent==='Prefiero conocer el río.');assert.ok(north&&river);
 await act(async()=>{north.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));river.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));});
 assert.equal(m.saved().campaign.lastConversation.dialogueNode,'north');assert.match(m.document.querySelector('[role="status"]').textContent,/conversación cambió/);assert.deepEqual(m.saved(),pair(m.saved()));
 await m.click('Volvamos a las opciones.');await m.click('Prefiero conocer el río.');assert.equal(m.saved().campaign.lastConversation.dialogueNode,'river');assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Seguí la ribera al amanecer/);assert.deepEqual(m.saved(),pair(m.saved()));
});

test('the mounted conversation reveals a day-gated choice when the actual tactical clock crosses midnight',async t=>{
 const d=dialoguePackage();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions=[{type:'day',min:2,max:null}];let p=readyLocal(undefined,d);
 let s=localOrder(leaveLocal(p),{type:'wait',hours:23-p.campaign.hour});p=visitLocal(s);const n=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);if(spot.cost)p=localTactical(p,{type:'move',x:spot.x,y:spot.y});
 const m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');assert.ok(npc);await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');assert.ok(!m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent.includes('Contame sobre el norte.'));
 await act(async()=>{for(let i=0;i<6;i++)m.issue({type:'rest'});});assert.ok(m.saved().campaign.hour>=24);assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Contame sobre el norte/);assert.deepEqual(m.saved(),pair(m.saved()));
});


test('the mounted conversation shows reward terms, applies them once and saves the receipt after a double click',async t=>{
 const d=dialoguePackage();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects=[{type:'treasury',operation:'receive',amount:175}];const p=readyLocal(undefined,d),cash=p.campaign.resources.treasury,m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');
 const button=[...m.document.querySelectorAll('[role="dialog"][aria-label^="Conversación con"] button')].find(b=>b.textContent.startsWith('Contame sobre el norte.'));assert.match(button.textContent,/Recibir 175 pesos · una sola vez/);
 await act(async()=>{button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));});assert.equal(m.saved().campaign.resources.treasury,cash+175);assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Recibiste 175 pesos/);assert.deepEqual(m.saved(),pair(m.saved()));
 await m.click('Volvamos a las opciones.');assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Operación ya realizada/);await m.click('Contame sobre el norte.');assert.equal(m.saved().campaign.resources.treasury,cash+175);assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/no se repite/);assert.deepEqual(m.saved(),pair(m.saved()));
});

test('the mounted conversation displays an unaffordable payment and cannot select it',async t=>{
 const d=dialoguePackage();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects=[{type:'treasury',operation:'pay',amount:1000000}];const p=readyLocal(undefined,d),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');const before=structuredClone(pair(m.saved()));
 const button=[...m.document.querySelectorAll('[role="dialog"][aria-label^="Conversación con"] button')].find(b=>b.textContent.startsWith('Contame sobre el norte.'));assert.equal(button.disabled,true);assert.match(button.textContent,/Pagar 1000000 pesos/);assert.match(button.textContent,/Faltan/);await m.click('Contame sobre el norte.');assert.deepEqual(pair(m.saved()),before);assert.deepEqual(m.saved(),before);
});

test('the mounted conversation starts and completes a quest and the campaign journal shows its real saved status',async t=>{
 const p=readyLocal(undefined,questPackage()),m=await mount(t,p),cash=p.campaign.resources.treasury;
 async function open(){const npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');assert.ok(npc);await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');}
 async function map(){await m.click('Listo');await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'m',bubbles:true})));}
 await open();await m.click('Acepto el encargo.');assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/El parte de la ribera: en curso/);await map();let journal=m.document.querySelector('[aria-label="Encargos de la historia"]');assert.ok(journal);assert.match(journal.textContent,/En curso/);assert.match(journal.textContent,/Volvé con el parte/);
 await m.click('Volver al sector táctico');if([...m.document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Pausar')))await m.click('Pausar');await open();await m.click('Aquí está el parte.');assert.equal(m.saved().campaign.resources.treasury,cash+175);assert.deepEqual(m.saved(),pair(m.saved()));await map();journal=m.document.querySelector('[aria-label="Encargos de la historia"]');assert.match(journal.textContent,/Completado/);assert.match(journal.textContent,/Resuelto el día/);assert.equal(m.saved().campaign.contentQuestEvents.length,2);
});

test('the mounted game displays a quest deadline and saves its automatic failure after actual tactical time',async t=>{
 const d=questPackage();d.quests[0].deadlineHours=1;const p=readyLocal(undefined,d),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/plazo de 1 h/);await m.click('Acepto el encargo.');
 await m.click('Listo');await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'m',bubbles:true})));assert.match(m.document.querySelector('[aria-label="Encargos de la historia"]').textContent,/Plazo restante: 60 minutos/);await m.click('Volver al sector táctico');if([...m.document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Pausar')))await m.click('Pausar');
 await act(async()=>{for(let i=0;i<6;i++)m.issue({type:'rest',unitId:m.read().battle.units.find(u=>u.side==='player').id});});assert.equal(m.saved().campaign.contentQuestEvents.at(-1).to,'failed');assert.deepEqual(m.saved(),pair(m.saved()));await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'m',bubbles:true})));const journal=m.document.querySelector('[aria-label="Encargos de la historia"]');assert.match(journal.textContent,/Fallido/);assert.match(journal.textContent,/vencimiento del plazo/);
});

test('the mounted game confirms a required resident death and reports the automatic quest failure in its saved journal',async t=>{
 const p=readyLocal(undefined,survivalPackage()),m=await mount(t,p),npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');await m.click('Acepto el encargo.');await m.click('Listo');
 const state=m.saved(),unit=state.battle.units.find(u=>u.side==='player'),victim=state.battle.npcs.find(n=>n.contentId==='pablo');await approachMounted(m,unit.id,victim.id);
 for(let i=0;i<6&&m.saved().battle.npcs.find(n=>n.id===victim.id).hp>0;i++){await approachMounted(m,unit.id,victim.id);await act(async()=>m.issue({type:'melee',unitId:unit.id,targetId:victim.id}));}assert.equal(m.saved().battle.npcs.find(n=>n.id===victim.id).hp,0);assert.equal(m.saved().campaign.contentQuestEvents.at(-1).death,'pablo');assert.deepEqual(m.saved(),pair(m.saved()));
 await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'m',bubbles:true})));const journal=m.document.querySelector('[aria-label="Encargos de la historia"]');assert.match(journal.textContent,/Fallido/);assert.match(journal.textContent,/muerte de Pablo/);
});

test('the mounted conversation starts movement in the active sector and autosaves its progress',async t=>{
 const {movementPackage}=await import('./dialogue-movement-fixture.mjs');const m=await mount(t,readyLocal(undefined,movementPackage()));const npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');
 await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Llamar a Pablo/);const before=m.saved().battle.npcs.find(n=>n.contentId==='pablo');
 await m.click('Contame sobre el norte.');let p=m.saved(),guest=p.battle.npcs.find(n=>n.contentId==='pablo');assert.deepEqual([guest.x,guest.y],[before.x,before.y]);assert.equal(p.campaign.dialogueMovements.length,1);assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con"]').textContent,/Pablo recibió la llamada/);assert.equal(guest.scriptedMove.order,0);assert.deepEqual(m.saved(),pair(p));await m.click('Listo');
 await act(async()=>m.issue({type:'rest'}));p=m.saved();guest=p.battle.npcs.find(n=>n.contentId==='pablo');assert.deepEqual({x:guest.x,y:guest.y},guest.scriptedMove.target);assert.deepEqual(m.saved(),pair(p));
});
