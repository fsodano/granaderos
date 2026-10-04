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
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const sync=pair=>{const n=syncBattleTime(pair.campaign,pair.battle);assert.equal(n.error,null,n.error);return decodeSave(encodeSave(n.campaign,n.battle));};
function ready(quests,escort=false,configure=()=>{},d=defaultContentPackage()){
 d.errands=quests;const courier=d.characters.find(c=>c.id==='person-112');courier.arrivalHours=0;courier.startingSupplies={rations:2,torches:2,medkits:7,boleadoras:1};configure(d);
 let campaign=initialCampaign(8,parseContentPackage(encodeContentPackage(d)));
 // This controlled-area fixture isolates escort geometry; it is not campaign-route evidence.
 if(escort)campaign=secureArea(campaign,['buenos_aires']);
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);return sync(pair);
}
function approach(pair,npcId){return sync({...pair,battle:approachNPC(pair.battle,'112',npcId)});}
function talk(pair,npcId,approach='quest'){
 const campaign=order(pair.campaign,{type:'talkNPC',npcId,unitId:112,approach,sectorState:pair.battle});
 return sync({campaign,battle:applyQuestEscortOrders(campaign,pair.battle)});
}
function give(pair,count,item='medkits',npcId='local-retiro'){
 const u=pair.battle.units.find(u=>u.id==='112'),npc=pair.battle.npcs.find(n=>n.id===npcId),slot=inventoryUsage(u).slots.find(s=>s.entry?.item===item&&s.entry.count>=count);assert.ok(slot);
 const battle=actBattle(pair.battle,{type:'inventoryMap',unitId:u.id,sourceId:slot.id,expectedSource:equipmentFingerprint(u,slot.id),count,intent:'auto',x:npc.x,y:npc.y,tacticalLevel:npc.tacticalLevel??0,targetId:npc.id});assert.equal(battle.lastError,null,battle.lastError);
 return {pair:sync({...pair,battle}),result:getNpcGiftResult(pair.battle,battle)};
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
