import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {NPC_QUESTS,questForNPC} from '../game/quests.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {campaignStorageKey} from '../game/content-launch.js';
import {freshDefaultErrands} from '../game/quest-definitions.js';
import {withCarriedPonchos} from './custody-gear-fixture.mjs';
import {deliverPonchos} from './npc-gift-helpers.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {createElement as h,act} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
const {default:Conversation,JA2Speech}=await import('../web/app/JA2Conversation.tsx');
const {default:QuestJournal}=await import('../web/app/QuestJournal.tsx');
const base={npc:{id:'local-retiro',name:'Sargento del cuartel',greeting:'La instrucción continúa.'},conversation:null,quest:{status:'unoffered'},reason:null,canApproach:false,onApproach(){},onTalk(){},onClose(){}};
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
 const definition=freshDefaultErrands().find(q=>q.id==='retiro-uniformes');
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
