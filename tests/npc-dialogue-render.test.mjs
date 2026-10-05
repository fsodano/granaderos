import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {NPC_QUESTS,questForNPC} from '../game/quests.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';
import {contractQuote} from '../game/contracts.js';
import {rosterFor} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {campaignStorageKey} from '../game/content-launch.js';
import {defaultContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {applyQuestWithdrawalOrders} from '../game/quest-withdrawal.js';
import {defaultErrands} from '../game/quest-definitions.js';
import {withCarriedPonchos} from './custody-gear-fixture.mjs';
import {deliverPonchos} from './npc-gift-helpers.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {createElement as h,act} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
const {default:Conversation,JA2Speech}=await import('../web/app/JA2Conversation.tsx');
const {default:QuestJournal}=await import('../web/app/QuestJournal.tsx');
const base={npc:{id:'local-retiro',name:'Sargento del cuartel',greeting:'La instrucción continúa.'},conversation:null,quest:{status:'unoffered'},reason:null,canApproach:false,onApproach(){},onTalk(){},onClose(){}};
// Explicit older pinned definition: new campaigns now offer two recipients.
const cashCivicErrands=()=>defaultErrands().map(q=>q.id==='retiro-uniformes'?{...q,reward:{treasury:0,loyalty:false},rewardChoice:{reimbursement:40}}:q);
test('a special non-recruitable character gets a portrait, text and relevant choices',()=>{const html=render(h(Conversation,base));assert.match(html,/role="dialog"/);assert.match(html,/avatar-man-soldier.webp/);assert.match(html,/La instrucción continúa/);assert.match(html,/Consultar encargo/);assert.match(html,/>Repetir respuesta</);assert.doesNotMatch(html,/Proponer incorporación/);assert.match(html,/>Listo</);});
test('current replies and completed quest options replace the initial panel content',()=>{const html=render(h(Conversation,{...base,conversation:{npcId:'local-retiro',text:'Recibimos los textiles.',options:['friendly','direct']},quest:{status:'completed'},reason:'Acercate.',canApproach:true}));assert.match(html,/Recibimos los textiles/);assert.doesNotMatch(html,/Consultar encargo|Entregar pertrechos/);assert.match(html,/disabled=""/);assert.match(html,/Acercarse para conversar/);});
test('ordinary replies are small speech boxes with no portrait or conversation choices',()=>{const html=render(h(JA2Speech,{name:'Vecino',text:'Disculpá, estoy trabajando.',position:{left:50,top:50},onClose(){}}));assert.match(html,/role="status"/);assert.match(html,/Disculpá, estoy trabajando/);assert.doesNotMatch(html,/role="dialog"|<img|Saludar|Preguntar|Proponer/);assert.equal((html.match(/<button/g)??[]).length,1);assert.match(html,/Cerrar respuesta/);});


test('replay remains in the special panel after delivery and remains subject to conversation availability',()=>{
 const conversation={npcId:'local-retiro',text:'Recibimos los textiles.',options:['repeat','friendly','direct']};
 const html=render(h(Conversation,{...base,conversation,quest:{status:'completed'}}));assert.match(html,/>Repetir respuesta</);assert.doesNotMatch(html,/Entregar pertrechos|Consultar encargo/);
 const blocked=render(h(Conversation,{...base,conversation,quest:{status:'completed'},reason:'Acercate.'}));assert.match(blocked,/<button disabled="">Repetir respuesta<\/button>/);
});

test('carried errands show physical receipts without a redundant confirmation',()=>{
 const original=NPC_QUESTS.find(q=>q.id==='retiro-uniformes');
 for(const [quest,expected]of [[original,/Ponchos recibidos: 1\/2/],[{...original,carried:{...original.carried,label:'Abrigos de la posta',count:4}},/Abrigos de la posta recibidos: 1\/4/]]){
  const html=render(h(Conversation,{...base,npc:{...base.npc,questGifts:[{outfit:'poncho'}]},quest:{...quest,status:'offered'}}));assert.match(html,expected);assert.doesNotMatch(html,/Confirmar entrega|Entregar pertrechos/);
 }
});

test('a special character refusing an offered item gives a portrait response with only a close control',()=>{
 const html=render(h(Conversation,{...base,responseOnly:true,conversation:{npcId:'local-retiro',text:'No necesito ese objeto.'},reason:'La conversación necesita una campaña activa.',canApproach:true}));
 assert.match(html,/role="dialog"/);assert.match(html,/avatar-man-soldier.webp/);assert.match(html,/No necesito ese objeto/);assert.equal((html.match(/<button/g)??[]).length,1);assert.match(html,/>Listo</);assert.doesNotMatch(html,/Repetir respuesta|Consultar encargo|Acercarse|campaña activa/);
});

test('reward choices stay disabled until acknowledged delivery and conditions are complete, and still require conversation access',()=>{
 const definition=cashCivicErrands().find(q=>q.id==='retiro-uniformes');
 for(const [count,controlled,reason]of [[1,true,null],[2,false,null],[2,true,'Acercate.']]){
  const quest=questForNPC({errandDefinitions:[definition],quests:{[definition.id]:{status:'offered'}},conversations:{[definition.npcId]:{giftCount:count}},sectors:{retiro:{owner:controlled?'patriot':'royalist'}}},definition.npcId);
  const html=render(h(Conversation,{...base,npc:{...base.npc,questGifts:[{},{}]},quest,reason}));
  assert.match(html,/<button disabled="">Cobrar reintegro · 40 pesos<\/button>/);assert.match(html,/<button disabled="">Renunciar al reintegro · apoyo local \+8<\/button>/);
  assert.doesNotMatch(html,/Consultar encargo|Entregar pertrechos|Confirmar entrega/);
  assert.match(html,reason?/Acercate\./:/Completá la entrega y las condiciones/);
 }
 const completed=render(h(Conversation,{...base,quest:{...definition,status:'completed',questResolution:'cash'}}));assert.doesNotMatch(completed,/Cobrar reintegro|Renunciar al reintegro/);
});

let pendingDelivery;
function readyRewardChoice(){
 if(!pendingDelivery){
  let campaign=dispatchCampaign(initialCampaign(8),{type:'createOfficer',name:'Testigo',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});assert.equal(campaign.lastError,null);
  campaign.errandDefinitions=cashCivicErrands();
  // Two finite preexisting garments isolate the conversation UI. Delivery
  // uses the ordinary carried-object orders and acknowledged physical custody.
  campaign=withCarriedPonchos(campaign,1000,2);campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
  let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
  const delivered=deliverPonchos(pair.battle);pair.battle=actBattle(delivered,{type:'weapon',unitId:'1000',slot:'primary'});assert.equal(pair.battle.lastError,null);
  pair=syncBattleTime(pair.campaign,pair.battle);assert.equal(pair.error,null);pendingDelivery=decodeSave(encodeSave(pair.campaign,pair.battle));
  assert.equal(questForNPC(pendingDelivery.campaign,'local-retiro').resolutionReady,true);
 }
 return structuredClone(pendingDelivery);
}
for(const branch of ['cash','civic'])test(`the mounted game leaves the physical reward pending on close and saves the chosen ${branch} branch once`,async t=>{
 const pair=readyRewardChoice(),m=await mountCampaign(t,pair),saved=()=>decodeSave(m.dom.window.localStorage.getItem(campaignStorageKey(pair.campaign))),before=saved(),cash=before.campaign.resources.treasury,loyalty=before.campaign.sectors.retiro.loyalty;
 async function open(){const person=m.document.querySelector('[data-unit-id="local-retiro"] [data-person-hit-target]');assert.ok(person);await act(async()=>person.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));}
 await open();const buttons=[...m.document.querySelectorAll('.ja2-conversation button')];
 for(const text of ['Cobrar reintegro · 40 pesos','Renunciar al reintegro · apoyo local +8'])assert.equal(buttons.find(b=>b.textContent===text)?.disabled,false,text);
 assert.ok(!buttons.some(b=>/Consultar encargo|Entregar pertrechos/.test(b.textContent)));
 await m.click('Listo');assert.deepEqual(saved(),before);assert.equal(m.document.querySelector('.ja2-conversation'),null);
 const journal=render(h(QuestJournal,{state:before.campaign}));assert.match(journal,/Entrega completa\. Conversá/);assert.match(journal,/Reintegro de 40 pesos o apoyo local \(\+8\)/);
 await open();const action={type:'talkNPC',npcId:'local-retiro',unitId:'1000',approach:'quest',questResolution:branch,sectorState:before.battle},expected=dispatchCampaign(before.campaign,action);assert.equal(expected.lastError,null);
 await m.click(branch==='cash'?'Cobrar reintegro':'Renunciar al reintegro');const after=saved();
 assert.deepEqual(after.campaign,expected);assert.deepEqual(after.battle,before.battle);
 assert.equal(after.campaign.quests['retiro-uniformes'].status,'completed');assert.equal(after.campaign.quests['retiro-uniformes'].questResolution,branch);
 assert.equal(after.campaign.resources.treasury,cash+(branch==='cash'?40:0));assert.equal(after.campaign.sectors.retiro.loyalty,loyalty+(branch==='civic'?8:0));
 assert.deepEqual(after.battle.npcs.find(n=>n.id==='local-retiro').questGifts,before.battle.npcs.find(n=>n.id==='local-retiro').questGifts);
 assert.ok(![...m.document.querySelectorAll('.ja2-conversation button')].some(b=>/Cobrar reintegro|Renunciar al reintegro/.test(b.textContent)));
 const completed=render(h(QuestJournal,{state:after.campaign}));assert.match(completed,branch==='cash'?/Recibís un reintegro de 40 pesos/:/Renunciás al reintegro\. El apoyo de la localidad aumenta 8 puntos/);assert.doesNotMatch(completed,/elegir la recompensa|Reintegro de 40 pesos o/);
 await m.click('Listo');await open();assert.deepEqual(saved(),after);assert.ok(![...m.document.querySelectorAll('.ja2-conversation button')].some(b=>/Cobrar reintegro|Renunciar al reintegro/.test(b.textContent)));
});


test('the mounted native couriers disclose both recipients, save the first accepted delivery, and confirm the chosen town only after both real ponchos arrive',async t=>{
 let campaign=dispatchCampaign(initialCampaign(8),{type:'createOfficer',name:'Testigo',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});assert.equal(campaign.lastError,null);
 const quoted=contractQuote(campaign,rosterFor(campaign).find(actor=>actor.id===110),'week'),cash=campaign.resources.treasury;assert.equal(quoted.available,true);
 campaign=dispatchCampaign(campaign,{type:'recruitCivic',id:110,term:'week'});assert.equal(campaign.lastError,null);assert.equal(campaign.resources.treasury,cash-quoted.price);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 // Both garments are the actual once-issued native outfits. Pack and hold
 // them through ordinary orders before mounting the live game controls.
 const garments=pair.battle.units.filter(u=>u.side==='player').map(u=>structuredClone(u.outfit));assert.equal(garments.length,2);
 for(const id of ['1000','110']){
  pair.battle=actBattle(pair.battle,{type:'equipLoot',unitId:id,slot:'outfit',inventoryKey:null});assert.equal(pair.battle.lastError,null);
  const actor=pair.battle.units.find(u=>u.id===id),key=Object.keys(actor.inventory).find(k=>actor.inventory[k].outfit==='poncho');assert.ok(key);
  pair.battle=actBattle(pair.battle,{type:'weapon',unitId:id,slot:'item',item:`inventory:${key}`});assert.equal(pair.battle.lastError,null);
  pair.battle=approachNPC(pair.battle,id,'local-retiro');
 }
 pair=syncBattleTime(pair.campaign,pair.battle);assert.equal(pair.error,null);pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 const m=await mountCampaign(t,pair),saved=()=>decodeSave(m.dom.window.localStorage.getItem(campaignStorageKey(pair.campaign))),person=()=>m.document.querySelector('[data-unit-id="local-retiro"] [data-person-hit-target]');
 async function clickPerson(){assert.ok(person());await act(async()=>person().dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.settle();}
 async function hoverPerson(){await act(async()=>person().dispatchEvent(new m.dom.window.MouseEvent('mouseover',{bubbles:true})));}
 const before=saved(),loyalty=Object.fromEntries(['retiro','buenos_aires','ensenada'].map(at=>[at,before.campaign.sectors[at].loyalty]));
 await m.click('Hablar');await clickPerson();let dialog=m.document.querySelector('.ja2-conversation');assert.ok(dialog);assert.match(dialog.textContent,/Retiro: apoyo local \+8/);assert.match(dialog.textContent,/Ensenada de Barragán: apoyo local \+8/);assert.match(dialog.textContent,/primera entrega aceptada fija el destino.*No podrás cambiarlo/);
 await m.click('Listo');assert.deepEqual(saved(),before,'closing the prospective choice does not commit or give an item');
 // Select the actual packed garment through the inventory, then review its
 // map destination. The second courier below uses the held-item route.
 await m.click('Equipo');const pocket=[...m.document.querySelectorAll('.ja2-pocket,.ja2-inventory .ja2-hands button')].find(b=>b.textContent.includes('Poncho'));assert.ok(pocket,JSON.stringify({pockets:[...m.document.querySelectorAll('.ja2-pocket')].map(b=>b.textContent),dialogs:[...m.document.querySelectorAll('[role=dialog]')].map(e=>e.textContent.slice(0,2000))}));
 await act(async()=>pocket.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));assert.equal(saved().battle.units.find(u=>u.id==='1000').equipmentCursor.stack.outfit,'poncho');
 await hoverPerson();assert.match(m.document.querySelector('[aria-label="Vista previa de la orden"]').textContent,/primera entrega aceptada fija el destino/);
 await clickPerson();let partial=saved();assert.ok(partial.campaign.quests['retiro-uniformes'],JSON.stringify({error:partial.campaign.lastError,battleError:partial.battle.lastError,choices:partial.battle.questBeneficiaries,dialog:m.document.querySelector('.ja2-conversation')?.textContent,notice:m.document.querySelector('[role=status]')?.textContent}));assert.equal(partial.campaign.quests['retiro-uniformes'].beneficiaryId,'cuartel');assert.equal(partial.battle.questBeneficiaries['retiro-uniformes'],'cuartel');assert.equal(partial.campaign.quests['retiro-uniformes'].status,'offered');assert.deepEqual(partial.battle.npcs.find(n=>n.id==='local-retiro').questGifts,[garments[0]]);
 assert.equal(partial.battle.units.find(u=>u.id==='1000').outfit,null);assert.ok(!Object.values(partial.battle.units.find(u=>u.id==='1000').inventory).some(item=>item.outfit==='poncho'));
 let journal=render(h(QuestJournal,{state:partial.campaign}));assert.match(journal,/Sargento del cuartel.*Retiro/);assert.match(journal,/Ponchos entregados: 1\/2/);assert.match(journal,/Destino fijado: Buenos Aires · Fuerte y Retiro/);assert.doesNotMatch(journal,/Entrega completa/);
 await m.click('Listo');await m.click('Listo');assert.equal(m.document.querySelector('.ja2-inventory'),null);await clickPerson();dialog=m.document.querySelector('.ja2-conversation');assert.ok(![...dialog.querySelectorAll('button')].some(b=>b.textContent==='Confirmar entrega'));await m.click('Listo');assert.deepEqual(saved(),partial);
 const courier=partial.battle.units.find(u=>u.id==='110'),roster=[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(courier.name));assert.ok(roster,JSON.stringify({name:courier.name,roster:[...m.document.querySelectorAll('[role=listitem]')].map(b=>b.getAttribute('aria-label')),inventory:!!m.document.querySelector('.ja2-inventory'),dialogs:[...m.document.querySelectorAll('.ja2-conversation')].map(e=>e.textContent)}));await act(async()=>roster.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 await hoverPerson();assert.match(m.document.querySelector('[aria-label="Vista previa de la orden"]').textContent,/Destino fijado: Buenos Aires · Fuerte y Retiro/);await clickPerson();const complete=saved();assert.equal(complete.campaign.quests['retiro-uniformes'].status,'offered');assert.deepEqual(complete.battle.npcs.find(n=>n.id==='local-retiro').questGifts,garments);assert.equal(questForNPC(complete.campaign,'local-retiro').resolutionReady,true);
 for(const at of Object.keys(loyalty))assert.equal(complete.campaign.sectors[at].loyalty,loyalty[at],'physical receipt alone gives no civic reward');
 await m.click('Listo');await clickPerson();const confirm=[...m.document.querySelectorAll('.ja2-conversation button')].find(b=>b.textContent==='Confirmar entrega');assert.ok(confirm);assert.equal(confirm.disabled,false);await m.click('Listo');assert.deepEqual(saved(),complete,'closing after full delivery keeps the confirmation pending');
 await clickPerson();const expected=dispatchCampaign(complete.campaign,{type:'talkNPC',npcId:'local-retiro',unitId:'110',approach:'quest',sectorState:complete.battle});assert.equal(expected.lastError,null);await m.click('Confirmar entrega');const after=saved();assert.deepEqual(after.campaign,expected);assert.deepEqual(after.battle,complete.battle);
 assert.equal(after.campaign.quests['retiro-uniformes'].status,'completed');assert.equal(after.campaign.resources.treasury,complete.campaign.resources.treasury);for(const at of ['retiro','buenos_aires'])assert.equal(after.campaign.sectors[at].loyalty,loyalty[at]+8);assert.equal(after.campaign.sectors.ensenada.loyalty,loyalty.ensenada);
 journal=render(h(QuestJournal,{state:after.campaign}));assert.match(journal,/El apoyo de Buenos Aires y su puerto aumenta 8 puntos/);assert.doesNotMatch(journal,/primera entrega aceptada|Completá la entrega|Conversá con el destinatario/);
 await m.click('Listo');await clickPerson();assert.ok(![...m.document.querySelectorAll('.ja2-conversation button')].some(b=>b.textContent==='Confirmar entrega'));assert.deepEqual(saved(),after);
});


test('the mounted paid partial delivery discloses withdrawal cost, seals custody through the real talk callback, and imports without charging again',async t=>{
 let campaign=initialCampaign(42,defaultContentPackage());
 for(const [id,price]of [[100,36],[110,60]]){const quote=contractQuote(campaign,rosterFor(campaign).find(o=>o.id===id),'day');assert.equal(quote.price,price);campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'day'});assert.equal(campaign.lastError,null);}
 campaign=dispatchCampaign(campaign,{type:'wait',hours:6});assert.equal(campaign.lastError,null);assert.equal(campaign.resources.treasury,3104);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 battle=actBattle(battle,{type:'equipLoot',unitId:'100',slot:'outfit',inventoryKey:null});assert.equal(battle.lastError,null);
 const key=Object.keys(battle.units.find(u=>u.id==='100').inventory).find(k=>battle.units.find(u=>u.id==='100').inventory[k].outfit==='poncho');
 battle=actBattle(battle,{type:'weapon',unitId:'100',slot:'item',item:`inventory:${key}`});assert.equal(battle.lastError,null);battle=approachNPC(battle,'100','local-retiro');
 battle=actBattle(battle,{type:'useItem',unitId:'100',targetId:'local-retiro'});assert.equal(battle.lastError,null);
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);const pair=decodeSave(encodeSave(synced.campaign,synced.battle));
 const m=await mountCampaign(t,pair),saved=()=>decodeSave(m.dom.window.localStorage.getItem(campaignStorageKey(pair.campaign)));
 async function open(){await m.click('Hablar');const person=m.document.querySelector('[data-unit-id="local-retiro"] [data-person-hit-target]');assert.ok(person);await act(async()=>person.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.settle();}
 await open();const before=saved(),dialog=m.document.querySelector('.ja2-conversation');assert.ok(dialog);assert.match(dialog.textContent,/Retirar el compromiso · apoyo local −4/);assert.match(dialog.textContent,/hasta 4 puntos, sin bajar de cero/);assert.match(dialog.textContent,/objetos entregados quedan.*conservás los restantes.*sin recompensa ni reintegro/);
 assert.equal([...dialog.querySelectorAll('button')].filter(b=>b.textContent.startsWith('Retirar el compromiso')).length,1);
 await m.click('Listo');assert.deepEqual(saved(),before);await open();
 const choice=questForNPC(before.campaign,'local-retiro').withdrawalChoice,expected=dispatchCampaign(before.campaign,{type:'talkNPC',npcId:'local-retiro',unitId:'100',approach:'questWithdraw',questWithdrawal:choice,sectorState:before.battle});assert.equal(expected.lastError,null);
 await m.click('Retirar el compromiso');const after=saved();assert.deepEqual(after.campaign,expected);assert.deepEqual(after.battle,applyQuestWithdrawalOrders(expected,before.battle));
 assert.equal(after.campaign.quests['retiro-uniformes'].status,'withdrawn');assert.deepEqual(after.battle.npcs.find(n=>n.id==='local-retiro').questGifts,before.battle.npcs.find(n=>n.id==='local-retiro').questGifts);
 assert.deepEqual(after.battle.units,before.battle.units);assert.equal(after.campaign.resources.treasury,3104);
 assert.ok(![...m.document.querySelectorAll('.ja2-conversation button')].some(b=>/Retirar el compromiso|Confirmar entrega/.test(b.textContent)));
 const journal=render(h(QuestJournal,{state:after.campaign}));assert.match(journal,/Retirado/);assert.match(journal,/disminuyó 4 puntos/);assert.doesNotMatch(journal,/contacto murió|Fallido|Completá la entrega/);
 await m.click('Listo');await open();assert.deepEqual(saved(),after);await m.click('Listo');
 const text=encodeSave(after.campaign,after.battle),file=new m.dom.window.File([text],'retiro-retirado.json',{type:'application/json'});file.text=async()=>text;
 const input=m.document.querySelector('input[type="file"][accept="application/json,.json"]');Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(async()=>input.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));await m.settle();
 assert.deepEqual(saved(),after,'actual import/remount retains one civic event and exact terminal physical custody');
});
