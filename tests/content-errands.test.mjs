import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,parseContentPackage,encodeContentPackage,validateContentPackage} from '../game/content-package.js';
import {errandContacts} from '../game/quest-definitions.js';
import {questPackage} from './content-quest-fixture.mjs';
import {contentQuestStatus} from '../game/content-quests.js';
import {localPackage} from './local-contract-fixture.mjs';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,getReachable,getNpcGiftResult} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {questsFor,questJournal} from '../game/quests.js';
import {applyQuestEscortOrders} from '../game/quest-escort.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {approachNPC} from './approach-npc.mjs';
import {secureArea} from './secured-area-fixture.mjs';
const quest=(patch={})=>({id:'pedido',npcId:'local-retiro',sector:'retiro',title:'Sostener la posta',offer:'Necesito provisiones para la posta.',delivery:'La posta tiene provisiones.',cost:{treasury:5},requiredSectors:['retiro'],requires:[],reward:{treasury:83,loyalty:false},...patch});
const competing=()=>quest({cost:{},reward:{treasury:0,loyalty:false},carried:{item:'medkits',count:2,label:'Vendas de la posta',instruction:'Entregá dos vendas desde el inventario.'},beneficiaries:[{id:'cuartel',npcId:'local-retiro',sector:'retiro',delivery:'El cuartel recibe las vendas.',reward:{treasury:0,loyalty:true}},{id:'puerto',npcId:'local-ensenada',sector:'ensenada',delivery:'El puerto recibe las vendas.',reward:{treasury:0,loyalty:true}}]});
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const sync=pair=>{const n=syncBattleTime(pair.campaign,pair.battle);assert.equal(n.error,null,n.error);return decodeSave(encodeSave(n.campaign,n.battle));};
function ready(quests,escort=false,configure=()=>{},d=defaultContentPackage(),configureRequest=()=>{}){
 d.errands=quests;const courier=d.characters.find(c=>c.id==='person-112');courier.arrivalHours=0;courier.startingSupplies={rations:2,torches:2,medkits:7,boleadoras:1};configure(d);
 let campaign=initialCampaign(8,parseContentPackage(encodeContentPackage(d)));
 // This controlled-area fixture isolates escort geometry; it is not campaign-route evidence.
 if(escort)campaign=secureArea(campaign,['buenos_aires']);
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 campaign=order(campaign,{type:'visitSector'});configureRequest(campaign.pendingBattle);const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);return sync(pair);
}
function approach(pair,npcId){return sync({...pair,battle:approachNPC(pair.battle,'112',npcId)});}
function talk(pair,npcId,approach='quest',questResolution){
 const campaign=order(pair.campaign,{type:'talkNPC',npcId,unitId:112,approach,sectorState:pair.battle,...(questResolution===undefined?{}:{questResolution})});
 return sync({campaign,battle:applyQuestEscortOrders(campaign,pair.battle)});
}
function give(pair,count,item='medkits',npcId='local-retiro',acknowledge=true){
 const u=pair.battle.units.find(u=>u.id==='112'),npc=pair.battle.npcs.find(n=>n.id===npcId),slot=inventoryUsage(u).slots.find(s=>s.entry?.item===item&&s.entry.count>=count);assert.ok(slot);
 const battle=actBattle(pair.battle,{type:'inventoryMap',unitId:u.id,sourceId:slot.id,expectedSource:equipmentFingerprint(u,slot.id),count,intent:'auto',x:npc.x,y:npc.y,tacticalLevel:npc.tacticalLevel??0,targetId:npc.id});assert.equal(battle.lastError,null,battle.lastError);
 return {pair:acknowledge?sync({...pair,battle}):{...pair,battle},result:getNpcGiftResult(pair.battle,battle)};
}
function reenter(pair){let c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});c=decodeSave(encodeSave(c)).campaign;c=order(c,{type:'visitSector'});const next=prepareCampaignBattle(c);assert.equal(next.error,null);return sync(next);}

test('authored resources and prerequisite errands resolve in real conversations, reward once and persist',()=>{
 let pair=ready([quest(),quest({id:'enlace',npcId:'cabral',title:'El enlace espera',cost:{},requires:['pedido'],reward:{treasury:20,loyalty:true}})]);
 pair=approach(pair,'cabral');pair=talk(pair,'cabral');
 const blocked=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId:'cabral',unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(blocked.lastError);assert.deepEqual(blocked.resources,pair.campaign.resources);assert.equal(blocked.quests.enlace.status,'offered');
 assert.deepEqual(questJournal(pair.campaign).find(q=>q.id==='enlace').missingQuests,['Sostener la posta']);
 pair=approach(pair,'local-retiro');pair=talk(pair,'local-retiro');const poor=structuredClone(pair.campaign);poor.resources.treasury=0;const refused=dispatchCampaign(poor,{type:'talkNPC',npcId:'local-retiro',unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(refused.lastError);assert.deepEqual(refused.resources,poor.resources);assert.equal(refused.quests.pedido.status,'offered');const cash=pair.campaign.resources.treasury,events=pair.campaign.cityLoyaltyEvents.length;
 pair=talk(pair,'local-retiro');assert.equal(pair.campaign.quests.pedido.status,'completed');assert.equal(pair.campaign.resources.treasury,cash+78);assert.equal(pair.campaign.cityLoyaltyEvents.length,events);assert.equal(pair.campaign.lastConversation.text,'La posta tiene provisiones.');
 pair=approach(pair,'cabral');pair=talk(pair,'cabral');assert.equal(pair.campaign.quests.enlace.status,'completed');assert.equal(pair.campaign.resources.treasury,cash+98);assert.equal(pair.campaign.cityLoyaltyEvents.length,events+1);
 const twice=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId:'cabral',unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(twice.lastError);assert.deepEqual(twice.resources,pair.campaign.resources);
 pair=reenter(pair);assert.equal(pair.campaign.quests.pedido.status,'completed');assert.equal(pair.campaign.resources.treasury,cash+98);
});

test('authored physical supply quantity, reply, reward and custody survive partial delivery, saves and reentry',()=>{
 const definition=quest({cost:{},carried:{item:'medkits',count:2,label:'Vendas de la posta',instruction:'Entregá dos vendas desde el inventario.'}});
 let pair=approach(ready([definition]),'local-retiro');const initial=pair.battle.units.find(u=>u.id==='112').medkits,cash=pair.campaign.resources.treasury;
 let offered=give(pair,1);assert.equal(offered.result.status,'accepted');pair=offered.pair;assert.equal(pair.campaign.quests.pedido.status,'offered');assert.equal(pair.campaign.resources.treasury,cash);
 offered=give(pair,1,'rations');assert.equal(offered.result.status,'refused');assert.match(offered.result.text,/vendas de la posta/);pair=offered.pair;
 pair=give(pair,1).pair;assert.equal(pair.campaign.quests.pedido.status,'completed');assert.equal(pair.campaign.resources.treasury,cash+83);assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,initial-2);assert.equal(pair.campaign.lastConversation.text,definition.delivery);
 pair=reenter(pair);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,2);assert.equal(pair.campaign.resources.treasury,cash+83);
 const saved=JSON.parse(encodeSave(pair.campaign,pair.battle));saved.battle.errandDefinitions[0].carried.count=1;assert.throws(()=>decodeSave(JSON.stringify(saved)));
});

test('an authored physical reward choice waits for retained gifts and a real prerequisite conversation, then saves only the chosen reward',()=>{
 const definition=quest({cost:{},requires:['enlace'],reward:{treasury:0,loyalty:false},rewardChoice:{reimbursement:40},carried:{item:'medkits',count:2,label:'Vendas de la posta',instruction:'Entregá dos vendas desde el inventario.'}});
 let pair=approach(ready([definition,quest({id:'enlace',npcId:'cabral',cost:{},reward:{treasury:0,loyalty:false}})]),'local-retiro');
 const cash=pair.campaign.resources.treasury,stock=pair.battle.units.find(u=>u.id==='112').medkits,income=structuredClone(pair.campaign.townIncome),events=pair.campaign.cityLoyaltyEvents.length;
 const choose=(p,choice)=>({type:'talkNPC',npcId:'local-retiro',unitId:112,approach:'quest',sectorState:p.battle,...(choice===undefined?{}:{questResolution:choice})});
 const rejected=(p,a)=>{const before=structuredClone(p),n=dispatchCampaign(p.campaign,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:p.campaign.lastError},p.campaign);assert.deepEqual(p,before);};
 rejected(pair,choose(pair,'cash'));pair=give(pair,1).pair;rejected(pair,choose(pair,'cash'));pair=give(pair,1).pair;
 assert.equal(pair.campaign.quests.pedido.status,'offered');assert.equal(pair.campaign.resources.treasury,cash);assert.equal(pair.campaign.cityLoyaltyEvents.length,events);assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,stock-2);
 rejected(pair,choose(pair,'civic'));pair=reenter(pair);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,2);
 pair=approach(pair,'cabral');pair=talk(pair,'cabral');pair=talk(pair,'cabral');pair=approach(pair,'local-retiro');
 for(const change of [b=>b.units.find(u=>u.id==='112').energy=0,b=>b.units.find(u=>u.id==='112').routed=true,b=>b.units.find(u=>u.id==='112').unconscious=true,b=>b.units.find(u=>u.id==='112').knockedDown=true,b=>b.battleId='foreign',b=>b.npcs.find(n=>n.id==='local-retiro').questGifts.pop()]){const b=structuredClone(pair.battle);change(b);rejected(pair,{...choose(pair,'cash'),sectorState:b});}
 rejected(pair,choose(pair));rejected(pair,choose(pair,'both'));rejected(pair,{...choose(pair,'cash'),approach:'friendly'});
 for(const choice of ['cash','civic']){
  const before=structuredClone(pair),result=talk(before,'local-retiro','quest',choice),loyalty=pair.campaign.sectors.retiro.loyalty;
  assert.equal(result.campaign.resources.treasury,cash+(choice==='cash'?40:0));assert.equal(result.campaign.sectors.retiro.loyalty,loyalty+(choice==='civic'?8:0));assert.equal(result.campaign.cityLoyaltyEvents.length,events+(choice==='civic'?1:0));assert.deepEqual(result.campaign.townIncome,income);
  assert.equal(result.campaign.quests.pedido.questResolution,choice);assert.equal(result.campaign.quests.pedido.completedAt,result.campaign.hour);assert.equal(result.battle.units.find(u=>u.id==='112').medkits,stock-2);
  rejected(result,choose(result,choice));rejected(result,choose(result,choice==='cash'?'civic':'cash'));
  const saved=reenter(result);assert.equal(saved.campaign.quests.pedido.questResolution,choice);assert.equal(saved.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,2);
  const dead=structuredClone(saved);applyCivilianHarm(dead.battle,dead.battle.npcs.find(n=>n.id==='local-retiro'),{source:dead.battle.units.find(u=>u.id==='112'),damage:100,breathLoss:0,intentional:true});const later=sync(dead);
  assert.equal(later.campaign.quests.pedido.status,'completed');assert.equal(later.campaign.quests.pedido.questResolution,choice);assert.equal(later.campaign.resources.treasury,result.campaign.resources.treasury);
  later.campaign.sectors.retiro.owner='royalist';assert.equal(decodeSave(encodeSave(later.campaign,later.battle)).campaign.quests.pedido.questResolution,choice);
 }
});

test('accepted physical supplies lock the actual receiver before acknowledgement and confirmation pays only that town once',()=>{
 let pair=approach(ready([competing()]),'local-retiro');const before=structuredClone(pair),cash=pair.campaign.resources.treasury,stock=pair.battle.units.find(u=>u.id==='112').medkits;
 const refused=give(pair,1,'rations');assert.equal(refused.result.status,'refused');pair=refused.pair;assert.deepEqual(pair.battle.questBeneficiaries,{});assert.equal(pair.campaign.quests.pedido,undefined);
 pair=give(pair,1).pair;assert.equal(pair.battle.questBeneficiaries.pedido,'cuartel');assert.equal(pair.campaign.pendingBattle.questBeneficiaries.pedido,'cuartel');assert.equal(pair.campaign.quests.pedido.beneficiaryId,'cuartel');
 const partial=structuredClone(pair);
 for(const change of [p=>p.campaign.pendingBattle.questBeneficiaries.pedido='puerto',p=>delete p.campaign.pendingBattle.questBeneficiaries.pedido,p=>delete p.campaign.quests.pedido.beneficiaryId]){
  const invalid=structuredClone(partial);change(invalid);assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)));
  const rejected=dispatchCampaign(invalid.campaign,{type:'syncTacticalTime',battleId:invalid.campaign.pendingBattle.id,elapsedSeconds:invalid.campaign.pendingBattle.syncedSeconds});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:invalid.campaign.lastError},invalid.campaign);
 }
 const forged=structuredClone(before);forged.campaign.pendingBattle.questBeneficiaries.pedido='cuartel';
 const rejected=dispatchCampaign(forged.campaign,{type:'syncTacticalTime',battleId:forged.campaign.pendingBattle.id,elapsedSeconds:forged.campaign.pendingBattle.syncedSeconds});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:forged.campaign.lastError},forged.campaign);
 pair=give(pair,1).pair;assert.equal(pair.campaign.quests.pedido.status,'offered');assert.equal(pair.campaign.resources.treasury,cash);
 pair=talk(pair,'local-retiro');assert.equal(pair.campaign.quests.pedido.status,'completed');assert.equal(pair.campaign.resources.treasury,cash);assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,stock-2);
 assert.match(pair.campaign.lastConversation.text,/8 puntos/);assert.equal(pair.campaign.cityLoyaltyEvents.filter(e=>e.eventId==='npc-pedido').length,1);assert.equal(pair.campaign.cityLoyaltyEvents.at(-1).sectorId,'retiro');
 const repeated=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId:'local-retiro',unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:pair.campaign.lastError},pair.campaign);
 pair=reenter(pair);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,2);assert.equal(pair.battle.questBeneficiaries.pedido,'cuartel');
});

test('clock-only resume cannot acknowledge a new physical gift and discard its custody before a full report',()=>{
 let pair=approach(ready([competing()]),'local-retiro');const stock=pair.battle.units.find(u=>u.id==='112').medkits,cash=pair.campaign.resources.treasury;
 pair=give(pair,1,'medkits','local-retiro',false).pair;assert.equal(pair.battle.questBeneficiaries.pedido,'cuartel');assert.equal(pair.campaign.quests.pedido,undefined);
 // The existing public clock call records the actual elapsed second before
 // feedback. It cannot infer or acknowledge the active scene's new custody.
 pair.campaign=order(pair.campaign,{type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:pair.battle.elapsedSeconds});
 pair.battle={...pair.battle,syncedSeconds:pair.battle.elapsedSeconds,savedHour:pair.campaign.hour,savedSecond:pair.campaign.secondOfHour??0};
 // Store the exact accepted scene as a pending scheduler checkpoint. Its
 // receipt is admitted by the official save, without strategic acknowledgement.
 pair.campaign.pendingBattle.resumeSnapshot=structuredClone(pair.battle);pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 const original=structuredClone(pair),elapsed=pair.battle.elapsedSeconds;
 const clock=dispatchCampaign(pair.campaign,{type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:elapsed});
 assert.match(clock.lastError,/parte táctico completo/);assert.deepEqual({...clock,lastError:pair.campaign.lastError},pair.campaign);assert.deepEqual(pair,original);
 pair=sync(pair);assert.equal(pair.campaign.pendingBattle.resumeSnapshot,undefined);assert.equal(pair.campaign.quests.pedido.beneficiaryId,'cuartel');assert.equal(pair.campaign.conversations['local-retiro'].giftCount,1);
 assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,stock-1);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,1);assert.equal(pair.campaign.resources.treasury,cash);
 const acknowledged=structuredClone(pair);acknowledged.campaign.pendingBattle.resumeSnapshot=structuredClone(acknowledged.battle);
 const restored=decodeSave(encodeSave(acknowledged.campaign,acknowledged.battle));
 const discarded=dispatchCampaign(restored.campaign,{type:'syncTacticalTime',battleId:restored.campaign.pendingBattle.id,elapsedSeconds:restored.battle.elapsedSeconds});assert.match(discarded.lastError,/parte táctico completo/);assert.deepEqual({...discarded,lastError:restored.campaign.lastError},restored.campaign);
 pair=sync(restored);assert.equal(pair.campaign.pendingBattle.resumeSnapshot,undefined);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,1);
 const quiet=dispatchCampaign(pair.campaign,{type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:pair.campaign.pendingBattle.syncedSeconds});assert.equal(quiet.lastError,null);
 pair=reenter(pair);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').questGifts.length,1);assert.equal(pair.battle.questBeneficiaries.pedido,'cuartel');
});

for(const count of [1,2])test(`first ${count} accepted supplies and a real selected-contact death in one checkpoint fail without a quest reward`,()=>{
 // A declared clinical scene starts with a living 20-HP contact, before the
 // initial battle admission. The native pistol earns the later death.
 let pair=approach(ready([competing()],false,()=>{},defaultContentPackage(),request=>Object.assign(request.npcs.find(n=>n.id==='local-retiro'),{hp:20,bandaged:80,civilianWoundVersion:1})),'local-retiro');
 const cash=pair.campaign.resources.treasury,stock=pair.battle.units.find(u=>u.id==='112').medkits,npc=pair.battle.npcs.find(n=>n.id==='local-retiro'),u=pair.battle.units.find(u=>u.id==='112'),slot=inventoryUsage(u).slots.find(s=>s.entry?.item==='medkits'&&s.entry.count>=count);
 const action={type:'inventoryMap',unitId:u.id,sourceId:slot.id,expectedSource:equipmentFingerprint(u,slot.id),count,intent:'auto',x:npc.x,y:npc.y,tacticalLevel:0,targetId:npc.id};
 let battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null);assert.equal(battle.questBeneficiaries.pedido,'cuartel');assert.equal(pair.campaign.quests.pedido,undefined);
 const issuedRounds=u.loaded+u.ammo;
 for(let attempt=0;attempt<3&&battle.npcs.find(n=>n.id===npc.id).hp>0;attempt++){
  const shooter=battle.units.find(u=>u.id==='112');if(!shooter.loaded){battle=actBattle(battle,{type:'reload',unitId:'112'});assert.equal(battle.lastError,null);}
  battle=actBattle(battle,{type:'firePoint',unitId:'112',x:npc.x,y:npc.y,tacticalLevel:0,aim:4,hitLocation:'torso'});assert.equal(battle.lastError,null);
 }
 assert.equal(battle.npcs.find(n=>n.id===npc.id).hp,0);assert.ok(battle.units.find(u=>u.id==='112').loaded+battle.units.find(u=>u.id==='112').ammo<issuedRounds);
 pair=sync({...pair,battle});assert.equal(pair.campaign.quests.pedido.beneficiaryId,'cuartel');assert.equal(pair.campaign.quests.pedido.status,'failed');assert.equal(pair.campaign.quests.pedido.failureReason,'contact-dead');
 assert.equal(pair.campaign.conversations[npc.id].giftCount,count);assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,stock-count);assert.equal(pair.battle.npcs.find(n=>n.id===npc.id).questGifts.length,count);assert.equal(pair.campaign.resources.treasury,cash);
 assert.equal(pair.campaign.cityLoyaltyEvents.filter(e=>e.eventId==='npc-pedido').length,0);
 pair=reenter(pair);assert.equal(pair.campaign.quests.pedido.status,'failed');
 assert.equal(pair.battle.npcs.find(n=>n.id===npc.id).hp,0);
});

test('an authored southward escort follows paid movement to its actual exit and saves its arrival',()=>{
 let pair=approach(ready([quest({cost:{},escort:{edge:'S',destination:'buenos_aires'},requiredSectors:['retiro','buenos_aires']})],true),'local-retiro');pair=talk(pair,'local-retiro');
 const unit=pair.battle.units.find(u=>u.id==='112'),destination=getReachable(pair.battle,unit).filter(p=>p.y===pair.battle.height-1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(destination);
 pair=sync({...pair,battle:actBattle(pair.battle,{type:'move',unitId:'112',x:destination.x,y:destination.y})});
 for(let i=0;i<15;i++){const u=pair.battle.units.find(u=>u.id==='112'),n=pair.battle.npcs.find(n=>n.id==='local-retiro');if(Math.abs(u.x-n.x)+Math.abs(u.y-n.y)<=1)break;pair=sync({...pair,battle:actBattle(pair.battle,{type:'rest'})});}
 const cash=pair.campaign.resources.treasury;pair=talk(pair,'local-retiro');assert.equal(pair.campaign.quests.pedido.status,'completed');assert.equal(pair.campaign.resources.treasury,cash+83);assert.equal(pair.battle.npcs.find(n=>n.id==='local-retiro').escort.waiting,true);assert.equal(pair.campaign.quests.pedido.arrival.leaderY,pair.battle.height-1);
 pair=reenter(pair);assert.equal(pair.campaign.quests.pedido.status,'completed');
});

test('authored contact death fails a pending errand without a reward and saves the incident',()=>{
 let pair=approach(ready([quest()]),'local-retiro');pair=talk(pair,'local-retiro');const cash=pair.campaign.resources.treasury;
 applyCivilianHarm(pair.battle,pair.battle.npcs.find(n=>n.id==='local-retiro'),{source:pair.battle.units.find(u=>u.id==='112'),damage:100,breathLoss:0,intentional:true});pair=sync(pair);assert.equal(pair.campaign.quests.pedido.status,'failed');assert.equal(pair.campaign.resources.treasury,cash);
 assert.equal(reenter(pair).campaign.quests.pedido.status,'failed');
});

test('quest definitions cannot be substituted in reports, pending requests, dormant sectors or saves',()=>{
 let pair=approach(ready([quest()]),'local-retiro');pair=talk(pair,'local-retiro');
 for(const change of [b=>delete b.errandDefinitions,b=>b.errandDefinitions[0].reward.treasury++,b=>b.errandDefinitions=[]]){
  const b=structuredClone(pair.battle);change(b);assert.throws(()=>decodeSave(encodeSave(pair.campaign,b)),/encargos/);
  const rejected=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId:'local-retiro',unitId:112,approach:'quest',sectorState:b});assert.ok(rejected.lastError);assert.deepEqual(rejected.resources,pair.campaign.resources);
 }
 const c=structuredClone(pair.campaign);c.pendingBattle.errandDefinitions=[];assert.throws(()=>decodeSave(encodeSave(c,pair.battle)),/encargos/);
 let left=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});left.sectorStates.retiro.errandDefinitions=[];assert.throws(()=>decodeSave(encodeSave(left)),/encargos/);
});

test('quest import rejects cycles, unknown contacts, remote hires and unsupported delivery definitions',()=>{
 for(const q of [quest({npcId:'missing'}),quest({npcId:'contact-person-110'}),quest({cost:{secret:10}}),quest({cost:{powder:5}}),quest({cost:{},escort:{edge:'N',destination:'cell-27-27'}}),quest({cost:{},carried:{item:'ammo',count:2,label:'Munición',instruction:'Entregá munición.'}}),quest({cost:{},escort:{edge:'N',destination:'mendoza'}}),quest({requires:['missing']}),quest({reward:{treasury:-1,loyalty:true}}),quest({sector:'humahuaca',reward:{treasury:0,loyalty:true}})]){const d=defaultContentPackage();d.errands=[q];assert.ok(validateContentPackage(d).length);}
 const d=defaultContentPackage();d.errands=[quest({requires:['other']}),quest({id:'other',npcId:'cabral',requires:['pedido']})];assert.match(validateContentPackage(d).join(' '),/ciclo/);
 const malformed=defaultContentPackage();malformed.characters.push(null);assert.ok(validateContentPackage(malformed).length);
 d.errands=[];assert.deepEqual(questsFor(initialCampaign(8,d)),[]);delete d.errands;assert.equal(questsFor(initialCampaign(8,d)).length,5);
});

test('authored errands coexist with dialogue quest definitions and reject missing contacts',()=>{
 const d=questPackage();d.errands=[quest({cost:{}})];const c=initialCampaign(8,d);
 assert.equal(contentQuestStatus(c,'river-post'),'not-started');assert.equal(questsFor(c)[0].id,'pedido');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign.contentCampaign.package.quests,d.quests);
 const p=localPackage({pay:0,service:'permanent'}),person=p.characters.at(-1);person.encounter.recruitable=false;assert.equal(errandContacts(p).find(n=>n.characterId===person.id).sector,null);assert.equal(errandContacts(p).find(n=>n.characterId===person.id).fixedSector,null);p.placements.at(-1).sectors=['retiro'];
 p.errands=[quest({npcId:`authored-${person.id}`,cost:{},carried:{item:'rations',count:2,label:'Raciones',instruction:'Entregá dos raciones.'}})];
 assert.deepEqual(validateContentPackage(p),[]);assert.ok(errandContacts(p).some(n=>n.id===p.errands[0].npcId));
 p.includeOriginalResidents=false;p.errands[0].npcId='local-retiro';assert.ok(validateContentPackage(p).length);
});

test('a new resident retains dialogue quest history while receiving finite items for a local errand',()=>{
 const d=questPackage(),person=d.characters.at(-1),npcId=`authored-${person.id}`;person.encounter.recruitable=false;d.placements.at(-1).sectors=['retiro'];
 let p=approach(ready([quest({npcId,cost:{},carried:{item:'medkits',count:2,label:'Vendas del puesto',instruction:'Entregá dos vendas.'}})],false,()=>{},d),npcId);
 p=sync({...p,campaign:order(p.campaign,{type:'talkNPC',npcId,unitId:112,approach:'dialogue',dialogueNode:'start',dialogueChoice:'accept',sectorState:p.battle})});
 assert.equal(contentQuestStatus(p.campaign,'river-post'),'active');const cash=p.campaign.resources.treasury,stock=p.battle.units.find(u=>u.id==='112').medkits;
 p=give(p,1,'medkits',npcId).pair;p=give(p,1,'medkits',npcId).pair;
 assert.equal(p.campaign.quests.pedido.status,'completed');assert.equal(p.campaign.resources.treasury,cash+83);assert.equal(p.battle.units.find(u=>u.id==='112').medkits,stock-2);
 assert.equal(p.campaign.conversations[npcId].dialogueReceipts.length,1);assert.equal(contentQuestStatus(p.campaign,'river-post'),'active');
 p=reenter(p);assert.equal(p.battle.npcs.find(n=>n.id===npcId).questGifts.length,2);assert.equal(p.campaign.conversations[npcId].dialogueReceipts.length,1);
});

test('omitted-roster reentry retains an authored nonrecruitable recipient and its acknowledged items',()=>{
 const d=localPackage({pay:0,service:'permanent',recruitable:false}),npcId='authored-alma-contract';d.placements.at(-1).sectors=['retiro'];
 let p=approach(ready([quest({npcId,cost:{},carried:{item:'medkits',count:2,label:'Vendas',instruction:'Entregá dos vendas.'}})],false,()=>{},d),npcId);
 p=give(p,1,'medkits',npcId).pair;p=reenter(p);
 const restored=enterSector({...p.campaign.pendingBattle,npcs:undefined},p.campaign.sectorStates.retiro);
 assert.equal(restored.npcs.find(n=>n.id===npcId).questGifts.length,1);assert.equal(restored.npcs.find(n=>n.id===npcId).recruitable,false);
 p=approach(p,npcId);delete p.campaign.pendingBattle.npcs;p=give(p,1,'medkits',npcId).pair;
 assert.equal(p.campaign.quests.pedido.status,'completed');assert.equal(p.battle.npcs.find(n=>n.id===npcId).questGifts.length,2);assert.equal(p.campaign.conversations[npcId].giftCount,2);
});
test('an authored conversation errand follows contact death independently of its reward locality',()=>{
 let p=approach(ready([quest({sector:'san_nicolas',cost:{}})]),'local-retiro');p=talk(p,'local-retiro');const cash=p.campaign.resources.treasury;
 applyCivilianHarm(p.battle,p.battle.npcs.find(n=>n.id==='local-retiro'),{source:p.battle.units.find(u=>u.id==='112'),damage:100,breathLoss:0,intentional:true});p=sync(p);
 assert.equal(p.campaign.quests.pedido.status,'failed');assert.equal(p.campaign.resources.treasury,cash);assert.equal(reenter(p).campaign.quests.pedido.status,'failed');
});
