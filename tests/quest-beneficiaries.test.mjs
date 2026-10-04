import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDefaultErrands,defaultErrands,validateQuestDefinitions,validateErrandContacts} from '../game/quest-definitions.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {makeOutfit} from '../game/outfits.js';
import {initializeQuestBeneficiaries,validateQuestBeneficiaries,validateQuestBeneficiaryContext,commitQuestBeneficiary} from '../game/quest-beneficiaries.js';
import {questForNPC,questJournal,questGiftDecision,validateQuests,failQuestsForDeadContact,validateQuestFailures} from '../game/quests.js';
import {civilianIncidents} from '../game/civilian-harm.js';

const id='retiro-uniformes';
const definitions=()=>freshDefaultErrands();
const context=()=>({hour:0,errandDefinitions:definitions(),quests:{},conversations:{},sectors:{retiro:{owner:'patriot'},buenos_aires:{owner:'royalist'},ensenada:{owner:'royalist'}}});
// These small records isolate context admission, not an earned route. Actual
// owned gifts and their paid actions are covered by the content/route tests.
const scene=(patch={})=>({sectorId:'retiro',sceneId:null,errandDefinitions:definitions(),questBeneficiaries:{},npcs:[],...patch});
const gift=()=>makeOutfit('poncho');

test('two fixed recipients reserve both contacts and reject combined or malformed delivery modes',()=>{
 const quests=definitions();assert.deepEqual(validateQuestDefinitions(quests),[]);
 assert.deepEqual(validateErrandContacts({...defaultContentPackage(),errands:quests}),[]);
 const q=quests.find(q=>q.id===id);
 for(const change of [q=>q.beneficiaries.pop(),q=>q.beneficiaries.push(structuredClone(q.beneficiaries[0])),q=>q.beneficiaries[1].npcId=q.npcId,q=>q.beneficiaries[1].id=q.beneficiaries[0].id,q=>q.beneficiaries[0].extra=true,q=>q.beneficiaries[0].sector='salta',q=>q.rewardChoice={reimbursement:40},q=>q.reward={treasury:1,loyalty:false},q=>q.escort={edge:'S',destination:'buenos_aires'},q=>q.carried=undefined]){
  const invalid=structuredClone(quests);change(invalid.find(q=>q.id===id));assert.ok(validateQuestDefinitions(invalid).length);
 }
 const collision=structuredClone(quests);collision.push({...structuredClone(q),id:'otro',npcId:'local-ensenada',sector:'ensenada',beneficiaries:undefined});assert.ok(validateQuestDefinitions(collision).length);
 const recruiting=structuredClone(quests);recruiting.find(q=>q.id===id).beneficiaries[1]={...q.beneficiaries[1],npcId:'cabral',sector:'retiro'};
 assert.ok(validateErrandContacts({...defaultContentPackage(),errands:recruiting}).some(e=>e.includes('no se incorpore')));
});

test('new definitions issue an empty choice map while old omitted and cash definitions stay neutral',()=>{
 const campaign=context();assert.deepEqual(initializeQuestBeneficiaries(campaign),{});
 const battle=createBattle([],{errandDefinitions:definitions(),exploration:true});assert.deepEqual(battle.questBeneficiaries,{});
 const old=defaultErrands();old.find(q=>q.id===id).reward={treasury:0,loyalty:false};old.find(q=>q.id===id).rewardChoice={reimbursement:40};
 assert.equal(initializeQuestBeneficiaries({errandDefinitions:old}),undefined);
 assert.equal(Object.hasOwn(createBattle([],{errandDefinitions:old,exploration:true}),'questBeneficiaries'),false);
 assert.equal(Object.hasOwn(createBattle([],{exploration:true}),'questBeneficiaries'),false);
 assert.throws(()=>validateQuestBeneficiaries({},{}));
 assert.throws(()=>validateQuestBeneficiaries(undefined,campaign));
 assert.throws(()=>validateQuestBeneficiaries({}, {errandDefinitions:[{id,beneficiaries:{}}]}),/destinatarios/);
});

test('only same-scene accepted custody can admit a new choice, and an issued request cannot authorize itself',()=>{
 const campaign=context(),battle=scene({questBeneficiaries:{[id]:'cuartel'},npcs:[{id:'local-retiro',questGifts:[gift()]}]});
 assert.equal(validateQuestBeneficiaryContext(campaign,battle,{request:null}),true);
 for(const change of [b=>b.npcs=[],b=>b.sectorId='ensenada',b=>b.sceneId='indoor',b=>b.questBeneficiaries[id]='puerto',b=>b.npcs.push({id:'local-ensenada',questGifts:[gift()]})]){
  const invalid=structuredClone(battle);change(invalid);assert.throws(()=>validateQuestBeneficiaryContext(campaign,invalid,{request:null}));
 }
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,battle,{request:null,issued:true}));
 const saved={...campaign,quests:{[id]:{status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'cuartel'}}};
 assert.equal(validateQuestBeneficiaryContext(saved,battle,{request:null,issued:true}),true);
});

test('acknowledged choices cannot disappear, switch or conflict with resume authority',()=>{
 const campaign=context();campaign.quests[id]={status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'cuartel'};
 const battle=scene({questBeneficiaries:{[id]:'cuartel'}});
 campaign.pendingBattle={questBeneficiaries:{[id]:'cuartel'},resumeSnapshot:structuredClone(battle)};
 assert.equal(validateQuestBeneficiaryContext(campaign,battle),true);
 for(const choices of [{},{[id]:'puerto'}])assert.throws(()=>validateQuestBeneficiaryContext(campaign,{...battle,questBeneficiaries:choices}));
 const invalid=structuredClone(campaign);invalid.pendingBattle.resumeSnapshot.questBeneficiaries[id]='puerto';assert.throws(()=>validateQuestBeneficiaryContext(invalid,battle),/cambió o desapareció/);
 assert.equal(validateQuestBeneficiaryContext(campaign,scene(),{request:null,retained:true}),true);
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,scene({sectorId:'ensenada',npcs:[{id:'local-ensenada',questGifts:[gift()]}]}),{request:null,retained:true}));
});

test('a same-object or cloned resume cannot authorize its own unreceived destination',()=>{
 const campaign=context(),resume=scene({questBeneficiaries:{[id]:'cuartel'}});
 campaign.pendingBattle={questBeneficiaries:{},resumeSnapshot:resume};
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,resume),/objetos recibidos/);
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,structuredClone(resume)),/objetos recibidos/);
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,scene()),/objetos recibidos/);
 resume.npcs=[{id:'local-retiro',questGifts:[gift()]}];
 assert.equal(validateQuestBeneficiaryContext(campaign,resume),true);
 assert.equal(validateQuestBeneficiaryContext(campaign,structuredClone(resume)),true);
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,scene()),/desapareció/);
 const forgedRequest={questBeneficiaries:{[id]:'cuartel'}};
 assert.throws(()=>validateQuestBeneficiaryContext(campaign,resume,{request:forgedRequest}),/no tiene una entrega/);
});

test('a supply delivery can resolve its definition from its actual recipient and opposite offers retain custody',()=>{
 const state=scene();const q=state.errandDefinitions.find(q=>q.id===id);
 q.carried={item:'medkits',count:2,label:'Vendas',instruction:'Entregá dos vendas.'};
 const npc={id:'local-retiro',questGifts:[]};const offered={item:'medkits',count:1};
 const before=structuredClone(state),accepted=questGiftDecision(npc,offered,state);assert.equal(accepted.accepted,true);assert.deepEqual(state,before);
 npc.questGifts=accepted.gifts;commitQuestBeneficiary(state,null,npc.id);assert.equal(state.questBeneficiaries[id],'cuartel');
 const opposite={id:'local-ensenada',questGifts:[]},refused=questGiftDecision(opposite,offered,state);
 assert.equal(refused.accepted,false);assert.deepEqual(opposite.questGifts,[]);assert.deepEqual(offered,{item:'medkits',count:1});assert.throws(()=>commitQuestBeneficiary(state,null,opposite.id));
});

test('selected sector control and full receipts gate confirmation without requiring both towns',()=>{
 const campaign=context();campaign.quests[id]={status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'puerto'};campaign.conversations['local-ensenada']={giftCount:2};
 assert.equal(questForNPC(campaign,'local-ensenada').resolutionReady,false);assert.deepEqual(questJournal(campaign)[0].unsecured,['ensenada']);
 campaign.sectors.ensenada.owner='patriot';assert.equal(questForNPC(campaign,'local-ensenada').resolutionReady,true);
 assert.equal(questForNPC(campaign,'local-retiro').resolutionReady,false);
 for(const record of [{status:'completed',offeredAt:0,completedAt:0},{status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'unknown'},{status:'completed',offeredAt:0,completedAt:0,beneficiaryId:'puerto',questResolution:'cash'}])assert.equal(validateQuests({[id]:record},0,campaign),false);
});

function casualty(campaign,npcId,sector){
 // A separate declared clinical arena isolates death identity. Its finite
 // pistol shot creates the injury/death; no HP is assigned after the order.
 const battle=createBattle([{id:'1000',x:1,y:2,weapon:1805,loaded:1,ammo:2,marksmanship:100}],{id:'clinical',sector,width:8,height:6,hour:12,seed:8,exploration:true,enemies:[],tiles:Array.from({length:48},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),npcs:[{id:npcId,name:'Contacto',x:2,y:2,hp:20,bandaged:80,civilianWoundVersion:1,energy:100}]});
 const next=actBattle(battle,{type:'firePoint',unitId:'1000',x:2,y:2,aim:4});assert.equal(next.lastError,null);const npc=next.npcs[0];assert.equal(npc.hp,0);assert.ok(next.elapsedSeconds>0);assert.equal(next.units[0].loaded,0);
 campaign.civilianHarm??={records:{}};campaign.civilianHarm.records[npcId]={npcId,sectorId:sector,sceneId:null,incidents:structuredClone(civilianIncidents(npc))};
 return failQuestsForDeadContact(campaign,sector,null,npcId);
}

test('unselected contact death remains neutral, selected death fails, and two real unchosen deaths end the impossible errand',()=>{
 for(const first of ['local-retiro','local-ensenada']){
  const campaign=context();campaign.quests[id]={status:'offered',offeredAt:0,completedAt:null};
  const at=first==='local-retiro'?'retiro':'ensenada',other=first==='local-retiro'?'local-ensenada':'local-retiro';
  assert.deepEqual(casualty(campaign,first,at),[]);assert.equal(campaign.quests[id].status,'offered');
  assert.equal(casualty(campaign,other,at==='retiro'?'ensenada':'retiro').length,1);assert.equal(campaign.quests[id].failureReason,'contacts-dead');
  assert.equal(validateQuests(campaign.quests,0,campaign),true);assert.doesNotThrow(()=>validateQuestFailures(campaign));
  const forged=structuredClone(campaign);delete forged.civilianHarm.records[other];assert.throws(()=>validateQuestFailures(forged));
  const wrong=structuredClone(campaign);wrong.quests[id].failureReason='contact-dead';assert.equal(validateQuests(wrong.quests,0,wrong),false);
 }
 const selected=context();selected.quests[id]={status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'cuartel'};
 assert.deepEqual(casualty(selected,'local-ensenada','ensenada'),[]);assert.equal(selected.quests[id].status,'offered');
 assert.equal(casualty(selected,'local-retiro','retiro').length,1);assert.equal(selected.quests[id].failureReason,'contact-dead');assert.doesNotThrow(()=>validateQuestFailures(selected));
});

test('authored contact relocation preserves stable selected-death authority while plain fixed contacts retain locality guards',()=>{
 for(const authored of [false,true]){
  const campaign=context();if(authored)campaign.contentCampaign={package:{errands:definitions()}};
  campaign.quests[id]={status:'offered',offeredAt:0,completedAt:null,beneficiaryId:'puerto'};
  const notices=casualty(campaign,'local-ensenada','retiro');assert.equal(notices.length,authored?1:0);assert.equal(campaign.quests[id].status,authored?'failed':'offered');
  if(authored)assert.doesNotThrow(()=>validateQuestFailures(campaign));
 }
});
