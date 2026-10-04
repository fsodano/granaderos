import {applyCivilianHarm} from '../game/civilian-harm.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {deliverPonchos} from './npc-gift-helpers.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign,questForNPC,hasPendingNpcGiftProgress} from '../game/campaign.js';
import {enterSector} from '../game/world.js';import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {approachNPC} from './approach-npc.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const sync=(s,b)=>{const pair=syncBattleTime(s,b);assert.equal(pair.error,null,pair.error);return {s:pair.campaign,b:pair.battle};};
const saved=({s,b})=>{const pair=decodeSave(encodeSave(s,b));return {s:pair.campaign,b:pair.battle};};
const questId='retiro-uniformes',npcId='local-retiro',ids=['1000','113'];
let prepared;
function meeting(legacy=false){
 if(!prepared){
  let s=order(initialCampaign(),{type:'createOfficer',name:'Juana del Sur',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
  s=order(s,{type:'recruitCivic',id:113,term:'week'});assert.deepEqual(s.recruited,[1000,113]);
  const issued=ids.map(id=>structuredClone(s.operativeState[id].outfit));assert.ok(issued.every(g=>g.outfit==='poncho'&&g.count===1));
  prepared={s,issued};
 }
 let {s,issued}=structuredClone(prepared);if(legacy)delete s.errandDefinitions;
 s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);b=approachNPC(b,'1000',npcId);return {...sync(s,b),issued};
}
function deliver(b,count=2){
 for(const id of ids.slice(0,count)){
  b=actBattle(b,{type:'equipLoot',unitId:id,slot:'outfit',inventoryKey:null});assert.equal(b.lastError,null,b.lastError);
  b=deliverPonchos(b,1,id);
 }
 return approachNPC(b,'1000',npcId);
}
const action=(b,choice)=>({type:'talkNPC',npcId,approach:'quest',unitId:1000,sectorState:b,...(choice===undefined?{}:{questResolution:choice})});
const talk=(s,b,choice)=>order(s,action(b,choice));
function reject(s,a){const n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:s.lastError},s);return n;}
function reenter({s,b}){s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});s=decodeSave(encodeSave(s)).campaign;s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);return sync(s,approachNPC(b,'1000',npcId));}

for(const choice of ['cash','civic'])test(`two actual soldiers deliver their once-issued ponchos, then choose ${choice} exactly once through saved local conversation`,()=>{
 let {s,b,issued}=meeting();const cash=s.resources.treasury,loyalty=s.sectors.buenos_aires.loyalty,retiroLoyalty=s.sectors.retiro.loyalty,income=structuredClone(s.townIncome),events=s.cityLoyaltyEvents.length;
 s=talk(s,b);assert.equal(s.quests[questId].status,'offered');assert.ok(!s.lastConversation.options.includes('quest'));
 const first=deliver(b,1);assert.deepEqual(deliver(structuredClone(b),1),first);({s,b}=saved(sync(s,first)));
 assert.equal(s.conversations[npcId].giftCount,1);assert.equal(s.resources.treasury,cash);assert.equal(questForNPC(s,npcId).resolutionReady,false);reject(s,action(b,choice));
 b=actBattle(b,{type:'equipLoot',unitId:'113',slot:'outfit',inventoryKey:null});assert.equal(b.lastError,null);b=deliverPonchos(b,1,'113');b=approachNPC(b,'1000',npcId);({s,b}=saved(sync(s,b)));
 assert.equal(s.quests[questId].status,'offered');assert.equal(s.quests[questId].completedAt,null);assert.equal(questForNPC(s,npcId).resolutionReady,true);
 assert.equal(s.resources.treasury,cash);assert.equal(s.cityLoyaltyEvents.length,events);assert.deepEqual(s.townIncome,income);assert.equal(hasPendingNpcGiftProgress(s,b),false);
 assert.deepEqual(b.npcs.find(n=>n.id===npcId).questGifts,issued);assert.ok(ids.every(id=>b.units.find(u=>u.id===id).outfit===null));
 assert.ok(ids.every(id=>!Object.values(b.units.find(u=>u.id===id).inventory).some(g=>g.kind==='outfit')));
 const repeat=sync(s,b);assert.deepEqual(repeat.s,s);assert.equal(repeat.s.lastConversation.outcome,'questProgress');
 ({s,b}=reenter({s,b}));assert.equal(s.quests[questId].status,'offered');assert.deepEqual(b.npcs.find(n=>n.id===npcId).questGifts,issued);assert.ok(ids.every(id=>b.units.find(u=>u.id===id).outfit===null));
 reject(s,action(b));const intended=action(b,choice),next=talk(s,b,choice),restored=saved({s,b});assert.deepEqual(dispatchCampaign(restored.s,{...intended,sectorState:restored.b}),next);s=next;
 assert.equal(s.resources.treasury,cash+(choice==='cash'?40:0));assert.equal(s.sectors.buenos_aires.loyalty,loyalty+(choice==='civic'?8:0));assert.equal(s.sectors.retiro.loyalty,retiroLoyalty+(choice==='civic'?8:0));
 assert.equal(s.cityLoyaltyEvents.length,events+(choice==='civic'?1:0));assert.deepEqual(s.townIncome,income);assert.deepEqual(s.quests[questId],{status:'completed',offeredAt:0,completedAt:s.hour,questResolution:choice});assert.ok(!s.lastConversation.options.includes('quest'));
 assert.match(s.lastConversation.text,choice==='cash'?/40 pesos/:/8 puntos/);assert.doesNotMatch(s.lastConversation.text,choice==='cash'?/aumenta 8/:/Recibís un reintegro/);
 reject(s,action(b,choice));reject(s,action(b,choice==='cash'?'civic':'cash'));({s,b}=saved({s,b}));({s,b}=reenter({s,b}));
 assert.equal(s.quests[questId].questResolution,choice);assert.deepEqual(b.npcs.find(n=>n.id===npcId).questGifts,issued);assert.equal(restoreCampaign(serializeCampaign(s)).quests[questId].questResolution,choice);
 for(const change of [c=>delete c.quests[questId].questResolution,c=>c.quests[questId].questResolution='both',c=>c.quests[questId].questResolution=choice==='cash'?'civic':'cash',c=>c.conversations[npcId].giftCount=1]){const bad=structuredClone(s);change(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 if(choice==='civic')for(const change of [c=>c.cityLoyaltyEvents=[],c=>c.cityLoyaltyEvents.find(e=>e.eventId===`npc-${questId}`).hour=c.quests[questId].completedAt+1]){const bad=structuredClone(s);change(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
});
test('the actual delivered civic alternative reaches the controlled-town training threshold while cash leaves the paid course blocked',()=>{
 let{s,b,issued}=meeting();
 // Declared secured-town boundary for the 50% militia gate, not a campaign
 // victory. The soldiers, funds and delivered clothing retain actual custody.
 for(const at of ['buenos_aires','retiro'])Object.assign(s.sectors[at],{owner:'patriot',loyalty:42});
 const cash=s.resources.treasury,income=structuredClone(s.townIncome),delivered=saved(sync(s,deliver(b)));
 assert.deepEqual(delivered.b.npcs.find(n=>n.id===npcId).questGifts,issued);assert.equal(delivered.s.resources.treasury,cash);assert.equal(questForNPC(delivered.s,npcId).resolutionReady,true);
 for(const choice of ['cash','civic']){
  const pair=structuredClone(delivered);s=talk(pair.s,pair.b,choice);
  s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.b,survivors:pair.b.units.filter(u=>u.side==='player')});s=decodeSave(encodeSave(s)).campaign;
  assert.equal(s.pendingBattle,null);assert.deepEqual(s.sectorStates.retiro.npcs.find(n=>n.id===npcId).questGifts,issued);assert.ok(ids.every(id=>s.operativeState[id].outfit===null));assert.deepEqual(s.townIncome,income);
  const expected=choice==='cash'?42:50;assert.equal(s.sectors.retiro.loyalty,expected);assert.equal(s.sectors.buenos_aires.loyalty,expected);
  const course={type:'militia',sector:'retiro',rank:0,trainerId:1000};
  if(choice==='cash'){
   assert.equal(s.resources.treasury,cash+40);assert.match(reject(s,course).lastError,/50%.*lealtad/);assert.deepEqual(s.militiaTraining,[]);
  }else{
   const next=order(s,course);assert.equal(next.resources.treasury,cash-60);assert.equal(next.militiaTraining.length,1);
   const training=next.militiaTraining[0];assert.equal(training.count,3);assert.equal(training.rank,0);assert.equal(training.trainerId,1000);assert.equal(training.sector,'retiro');assert.equal(training.remaining,training.duration);assert.deepEqual(next.sectors.retiro.militia,[0,0,0]);
   const restored=decodeSave(encodeSave(next)).campaign;assert.deepEqual(restored.militiaTraining,next.militiaTraining);assert.equal(restored.militiaTraining[0].count,3);assert.equal(restored.resources.treasury,cash-60);assert.equal(restored.quests[questId].questResolution,'civic');assert.deepEqual(restored.townIncome,income);
  }
 }
});

test('quest requests require adjacency and unsecured locations preserve the offered stage',()=>{
 let{s,b}=meeting();const far=structuredClone(b);far.units[0].x=0;far.units[0].y=0;reject(s,action(far));reject(s,action(b,'cash'));reject(s,action(b,'both'));reject(s,{...action(b,'cash'),approach:'friendly'});
 s=talk(s,b);reject(s,action(b,'cash'));s.sectors.retiro.owner='royalist';reject(s,action(b,'civic'));assert.equal(s.quests[questId].status,'offered');s.quests[questId].completedAt=999;assert.throws(()=>restoreCampaign(serializeCampaign(s)));const old=initialCampaign();delete old.quests;assert.deepEqual(restoreCampaign(serializeCampaign(old)).quests,{});
});
test('automatic cash-reward errands retain their amounts and territorial conditions',()=>{const s=initialCampaign();assert.equal(questForNPC(s,'local-san_nicolas').reward.treasury,200);assert.deepEqual(questForNPC(s,'local-san_nicolas').requiredSectors,['san_nicolas']);assert.equal(questForNPC(s,'macacha').reward.treasury,400);assert.equal(questForNPC(s,'macacha').conditionMet,false);s.sectors.salta.owner='patriot';s.sectors.jujuy.owner='patriot';assert.equal(questForNPC(s,'macacha').conditionMet,true);});

for(const count of [1,2])test(`${count} physical ponchos stay with a dead contact without refund or reward`,()=>{
 let {s,b}=meeting();const cash=s.resources.treasury;b=deliver(b,count);
 let pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=pair.campaign;b=pair.battle;
 assert.equal(s.quests['retiro-uniformes'].status,'offered');
 const receipt=structuredClone(b.npcs.find(n=>n.id==='local-retiro').questGifts),stock=s.merchants.retiro.supplies.ponchos;
 applyCivilianHarm(b,b.npcs.find(n=>n.id==='local-retiro'),{source:b.units.find(u=>u.id==='1000'),damage:100,breathLoss:0,intentional:true});
 pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=pair.campaign;b=pair.battle;
 assert.equal(s.quests['retiro-uniformes'].status,'failed');
 const saved=decodeSave(encodeSave(s,b));s=saved.campaign;b=saved.battle;
 assert.deepEqual(b.npcs.find(n=>n.id==='local-retiro').questGifts,receipt);
 assert.equal(s.merchants.retiro.supplies.ponchos,stock);assert.equal(s.conversations['local-retiro'].giftCount,count);assert.equal(s.resources.treasury,cash);assert.equal(s.quests[questId].questResolution,undefined);
 assert.equal(s.cityLoyaltyEvents.filter(e=>e.kind==='quest'&&e.eventId==='npc-retiro-uniformes').length,0);
 const rejected=dispatchCampaign(s,{type:'talkNPC',npcId:'local-retiro',approach:'quest',unitId:1000,sectorState:b});
 assert.ok(rejected.lastError);assert.deepEqual(rejected.quests,s.quests);
});

test('a full physical delivery and contact death in the first checkpoint fail the new choice without refund or reward',()=>{
 let{s,b,issued}=meeting();assert.equal(s.quests[questId],undefined);const cash=s.resources.treasury;b=deliver(b);
 applyCivilianHarm(b,b.npcs.find(n=>n.id===npcId),{source:b.units.find(u=>u.id==='1000'),damage:100,breathLoss:0,intentional:true});({s,b}=saved(sync(s,b)));
 assert.equal(s.quests[questId].status,'failed');assert.equal(s.quests[questId].failureReason,'contact-dead');assert.equal(s.quests[questId].questResolution,undefined);assert.equal(s.resources.treasury,cash);
 assert.deepEqual(b.npcs.find(n=>n.id===npcId).questGifts,issued);assert.equal(s.conversations[npcId].giftCount,2);assert.ok(!s.cityLoyaltyEvents.some(e=>e.kind==='quest'&&e.eventId===`npc-${questId}`));reject(s,action(b,'cash'));
});

test('a physical gift after an actual hour boundary records the current second rather than the previous conversation minute',()=>{
 let{s,b}=meeting();
 while(s.hour===0&&(s.secondOfHour??0)<3000){b=actBattle(b,{type:'rest'});assert.equal(b.lastError,null);({s,b}=sync(s,b));}
 b=approachNPC(b,'1000',npcId);({s,b}=sync(s,b));s=talk(s,b);const previous=structuredClone(s.conversations[npcId]);assert.equal(previous.hour,0);assert.ok(previous.secondOfHour>=3000);
 b=actBattle(b,{type:'rest'});assert.equal(b.lastError,null);b=deliver(b,1);({s,b}=sync(s,b));
 assert.equal(s.conversations[npcId].hour,s.hour);assert.equal(s.conversations[npcId].secondOfHour,s.secondOfHour);assert.ok(s.hour>previous.hour);assert.ok(s.secondOfHour<previous.secondOfHour);
 assert.equal(saved({s,b}).s.conversations[npcId].secondOfHour,s.secondOfHour);assert.equal(s.conversations[npcId].giftCount,1);assert.equal(s.quests[questId].status,'offered');
});

test('older campaigns without pinned definitions retain automatic physical completion and reject a reward choice',()=>{
 let{s,b}=meeting(true);assert.equal(s.errandDefinitions,undefined);assert.equal(b.errandDefinitions,undefined);assert.equal(questForNPC(s,npcId).rewardChoice,undefined);
 reject(s,action(b,'cash'));({s,b}=sync(s,deliver(b)));assert.equal(s.quests[questId].status,'completed');assert.equal(s.quests[questId].questResolution,undefined);assert.ok(s.cityLoyaltyEvents.some(e=>e.eventId===`npc-${questId}`));
 ({s,b}=saved({s,b}));assert.equal(s.errandDefinitions,undefined);assert.equal(s.quests[questId].questResolution,undefined);
});
