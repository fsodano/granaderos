import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from '../game/campaign.js';
import {questJournal} from '../game/quests.js';
import {defaultErrands} from '../game/quest-definitions.js';
const {default:QuestJournal}=await import('../web/app/QuestJournal.tsx');
const {default:CampaignOffice}=await import('../web/app/CampaignOffice.tsx');
test('the campaign notebook shows an empty state without revealing unaccepted errands',()=>{
 const s=initialCampaign(),html=render(h(CampaignOffice,{state:s,dispatch(){},section:'journal'}));
 assert.match(html,/Encargos locales/);assert.match(html,/Todavía no aceptaste encargos/);
 assert.doesNotMatch(html,/Monturas y armas para los enlaces|Pólvora para la guardia|Abrigo para los nuevos/);
});
test('notebook receipts are acknowledged quantities and incomplete territorial requirements remain visible',()=>{
 const s=initialCampaign();s.quests={'retiro-uniformes':{status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'puerto'},'salta-correos':{status:'offered',offeredAt:25,completedAt:null}};
 s.conversations['local-ensenada']={giftCount:1};s.conversations['local-retiro']={giftCount:0};s.sectors.salta.owner='patriot';
 s.sectorStates.retiro={npcs:[{id:'local-retiro',questGifts:[{},{}]}]};
 const before=structuredClone(s),entries=questJournal(s),html=render(h(QuestJournal,{state:s}));
 assert.deepEqual(s,before);assert.equal(entries[0].id,'salta-correos');
 assert.equal(entries.find(q=>q.id==='retiro-uniformes').delivered,1);
 assert.deepEqual(entries[0].unsecured,['jujuy']);assert.match(html,/Ponchos entregados: 1\/2/);assert.match(html,/Capataz del puerto · Ensenada de Barragán/);assert.match(html,/Destino fijado: Ensenada de Barragán/);assert.ok(entries.find(q=>q.id==='retiro-uniformes').unsecured.includes('ensenada'));
 assert.match(html,/400 pesos/);assert.match(html,/Asegurá Salta y Jujuy/);assert.doesNotMatch(html,/mosquetes|caballos/);assert.match(html,/Primero asegurá:/);assert.match(html,/Día 2 · 1:00/);
});
test('completed and failed errands retain their terminal outcome without delivery instructions',()=>{
 for(const status of ['completed','failed']){
  const s=initialCampaign();s.errandDefinitions=defaultErrands().map(q=>q.id==='retiro-uniformes'?{...q,reward:{treasury:0,loyalty:false},rewardChoice:{reimbursement:40}}:q);s.quests['retiro-uniformes']={status,offeredAt:0,completedAt:status==='completed'?26:null,...(status==='failed'?{failedAt:26,failureReason:'contact-dead'}:{questResolution:'civic'})};s.conversations['local-retiro']={giftCount:status==='completed'?2:1};
  const html=render(h(QuestJournal,{state:s}));assert.doesNotMatch(html,/Llevá los ponchos restantes|Primero asegurá/);
  assert.match(html,/Día 2 · 2:00/);assert.match(html,status==='completed'?/reintegro|apoyo local/:/El contacto murió/);
 }
 // UI-only terminal receipt: the engine separately verifies the two deaths.
 // No accepted gift exists while the first delivery destination is unchosen.
 const unchosen=initialCampaign();unchosen.quests['retiro-uniformes']={status:'failed',offeredAt:0,completedAt:null,failedAt:26,failureReason:'contacts-dead'};
 const html=render(h(QuestJournal,{state:unchosen}));assert.match(html,/Ambos destinatarios murieron\. El encargo terminó sin recompensa/);assert.match(html,/Ponchos entregados: 0\/2/);assert.match(html,/Fallido: Día 2 · 2:00/);assert.doesNotMatch(html,/El contacto murió|objetos ya entregados|Destino fijado|primera entrega aceptada|Completá la entrega/);
});

test('medical delivery uses supply labels and acknowledged partial quantities',()=>{
 const s=initialCampaign();s.quests['tucuman-vendas']={status:'offered',offeredAt:0,completedAt:null};s.conversations['local-tucuman']={giftCount:1};
 const html=render(h(QuestJournal,{state:s}));assert.match(html,/Vendas entregadas: 1\/3/);assert.match(html,/Seleccioná la cantidad/);assert.doesNotMatch(html,/Ponchos entregados/);
});

test('escort notebook shows its destination and waiting order without a goods delivery prompt',()=>{
 const s=initialCampaign();s.quests['jujuy-arriero']={status:'offered',offeredAt:0,completedAt:null,escortOrder:{leaderId:'112',waiting:true}};
 const html=render(h(QuestJournal,{state:s}));assert.match(html,/salida occidental hacia Humahuaca/);assert.match(html,/El arriero espera/);assert.doesNotMatch(html,/Entregá .*al conversar/);
});

test('failed escort notebook names the loss without implying delivered objects',()=>{
 const s=initialCampaign();s.quests['jujuy-arriero']={status:'failed',offeredAt:0,completedAt:null,failedAt:0,failureReason:'contact-dead',escortOrder:{leaderId:'112',waiting:false}};
 const html=render(h(QuestJournal,{state:s}));assert.match(html,/El arriero murió/);assert.doesNotMatch(html,/objetos ya entregados/);
});
