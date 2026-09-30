import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,hasPendingNpcGiftProgress} from '../game/campaign.js';
import {hasPendingCivilians} from '../game/campaign-civilians.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {applyQuestEscortOrders} from '../game/quest-escort.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {deliverPonchos} from './npc-gift-helpers.mjs';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
function ready({horse=false,gift=false,midnight=false,escort=false}={}){
 let campaign=order(initialCampaign(8),{type:'recruitCivic',id:110,term:midnight?'day':'week'});
 if(midnight){campaign=order(campaign,{type:'recruitCivic',id:113,term:'day'});campaign=order(campaign,{type:'squad',ids:[110]});campaign.hour=23;campaign.secondOfHour=3598;}
 if(horse){campaign=order(campaign,{type:'horseAction',order:{type:'acquire'}});campaign=order(campaign,{type:'horseAction',order:{type:'assign',horseId:'horse-1',operativeId:110}});}
 if(gift)campaign=order(campaign,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'issueOutfit'});
 if(escort){
  // An established escort checkpoint isolates clock/order reconciliation.
  campaign.location='jujuy';campaign.squads[0].location='jujuy';campaign.operativeState[110].location='jujuy';campaign.sectors.jujuy.owner='patriot';
  campaign.quests['jujuy-arriero']={status:'offered',escortOrder:{leaderId:'110',waiting:false}};
 }
 campaign=order(campaign,{type:'visitSector'});
 const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null,pair.error);return pair;
}
function ordinary(campaign,battle){
 const next=dispatchCampaign(campaign,{type:'syncTacticalTime',battleId:campaign.pendingBattle.id,elapsedSeconds:battle.elapsedSeconds??0,sectorState:battle});
 if(next.lastError)return {campaign,battle,error:next.lastError};
 const units=battle.units.map(u=>{const horse=u.mount&&next.horseState?.horses.find(h=>h.id===u.mount.id);return horse?{...u,mount:{...u.mount,condition:Math.min(u.mount.condition,horse.condition)}}:u;});
 return {campaign:next,battle:applyQuestEscortOrders(next,{...battle,units,syncedSeconds:battle.elapsedSeconds??0,savedHour:next.hour,savedSecond:next.secondOfHour??0}),error:null};
}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
function equalSync(campaign,battle){
 const beforeCampaign=structuredClone(campaign),beforeBattle=structuredClone(battle),expected=ordinary(campaign,battle);
 deepFreeze(campaign);deepFreeze(battle);
 const actual=syncBattleTime(campaign,battle);assert.deepEqual(actual,expected);assert.deepEqual(campaign,beforeCampaign);assert.deepEqual(battle,beforeBattle);return actual;
}

test('successive sub-minute steps match ordinary dispatch without cloning settled campaign state',()=>{
 let pair=ready();
 for(const elapsedSeconds of [3,6,6,14,59]){
  const previous=pair.campaign,battle={...pair.battle,elapsedSeconds};pair=equalSync(previous,battle);
  assert.equal(pair.error,null);assert.equal(pair.campaign.resources,previous.resources);assert.equal(pair.campaign.sectorStates,previous.sectorStates);
  assert.notEqual(pair.campaign,previous);assert.notEqual(pair.campaign.pendingBattle,previous.pendingBattle);
  assert.equal(pair.campaign.pendingBattle.syncedSeconds,elapsedSeconds);assert.equal(pair.battle.savedSecond,elapsedSeconds);assert.equal(pair.battle.savedHour,0);
 }
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
});

test('a cloned or restored campaign must pass the full dispatcher before using the fast path',()=>{
 const pair=ready(),raw=structuredClone(pair.campaign);delete raw.assignmentAttention;delete raw.enemyIntelligence;
 raw.phase=0;raw.flags.academy=false;raw.pendingBattle.resumeSnapshot=structuredClone(pair.battle);
 const first=equalSync(raw,{...pair.battle,elapsedSeconds:3});assert.equal(first.error,null);assert.equal(first.campaign.phase,1);assert.equal(first.campaign.flags.academy,true);assert.ok(first.campaign.assignmentAttention);assert.ok(first.campaign.enemyIntelligence);assert.equal(first.campaign.pendingBattle.resumeSnapshot,undefined);
 assert.notEqual(first.campaign.resources,raw.resources);
 const restored=decodeSave(encodeSave(first.campaign,first.battle)),next=equalSync(restored.campaign,{...restored.battle,elapsedSeconds:6});
 assert.notEqual(next.campaign.resources,restored.campaign.resources,'serialized fields cannot establish trust');
 assert.equal(equalSync(next.campaign,{...next.battle,elapsedSeconds:9}).campaign.resources,next.campaign.resources);
});

test('invalid elapsed time and deployment identity fail without mutating either input',()=>{
 const pair=ready();
 for(const elapsedSeconds of [-1,.5,NaN,Infinity,864001]){
  const battle={...pair.battle,elapsedSeconds},result=equalSync(pair.campaign,battle);assert.ok(result.error);assert.equal(result.campaign,pair.campaign);assert.equal(result.battle,battle);
 }
 const advanced=equalSync(pair.campaign,{...pair.battle,elapsedSeconds:3});assert.ok(equalSync(advanced.campaign,pair.battle).error);
 const other={...pair.battle,battleId:'wrong'},before=structuredClone(pair.campaign),result=syncBattleTime(pair.campaign,other);assert.match(result.error,/despliegue/);assert.equal(result.campaign,pair.campaign);assert.equal(result.battle,other);assert.deepEqual(pair.campaign,before);
 assert.ok(equalSync({...pair.campaign,pendingEncounter:{groupId:'enemy-group-1'}},pair.battle).error);
 const defeated={...pair.campaign,defeated:true};assert.equal(equalSync(defeated,pair.battle).error,null,'a defeated campaign must still save its final tactical wounds');
});

test('hour boundaries retain deployed contracts and expire remote contracts through full dispatch',()=>{
 let pair=ready({midnight:true});const before=pair.campaign;
 pair=equalSync(pair.campaign,{...pair.battle,elapsedSeconds:1});assert.equal(pair.campaign.resources,before.resources);assert.equal(pair.campaign.secondOfHour,3599);
 const preMidnight=pair.campaign;pair=equalSync(pair.campaign,{...pair.battle,elapsedSeconds:3});assert.equal(pair.error,null);assert.notEqual(pair.campaign.resources,preMidnight.resources);assert.equal(pair.campaign.hour,24);assert.equal(pair.campaign.secondOfHour,1);
 assert.equal(pair.campaign.contracts[110].departurePending,true);assert.ok(pair.campaign.recruited.includes(110));assert.ok(!pair.campaign.recruited.includes(113));assert.equal(pair.battle.savedHour,24);assert.equal(pair.battle.savedSecond,1);
 assert.doesNotThrow(()=>decodeSave(encodeSave(pair.campaign,pair.battle)));
});

test('the common path keeps tactical mount damage and strategic condition limits',()=>{
 const pair=ready({horse:true}),battle=structuredClone(pair.battle),rider=battle.units.find(u=>u.id==='110');rider.mount.stamina=27;rider.mount.condition=41;battle.elapsedSeconds=3;
 const next=equalSync(pair.campaign,battle);assert.equal(next.campaign.resources,pair.campaign.resources);assert.equal(next.battle.units.find(u=>u.id==='110').mount.stamina,27);assert.equal(next.battle.units.find(u=>u.id==='110').mount.condition,41);assert.equal(next.campaign.horseState.horses[0].condition,100);
});

test('the common path applies authoritative quest escort orders without moving the escort',()=>{
 const pair=ready({escort:true}),battle=structuredClone(pair.battle),npc=battle.npcs.find(n=>n.id==='local-jujuy');npc.escort={leaderId:'999',waiting:true};battle.elapsedSeconds=3;
 const next=equalSync(pair.campaign,battle),escort=next.battle.npcs.find(n=>n.id===npc.id);assert.equal(next.campaign.resources,pair.campaign.resources);assert.deepEqual(escort.escort,{leaderId:'110',waiting:false});assert.deepEqual([escort.x,escort.y],[npc.x,npc.y]);
});

test('new gift and civilian receipts use full dispatch, then unchanged receipts return to the fast path',()=>{
 let pair=ready({gift:true});const gift=deliverPonchos(pair.battle,1,'110'),beforeGift=pair.campaign;assert.equal(hasPendingNpcGiftProgress(beforeGift,gift),true);
 pair=equalSync(pair.campaign,gift);assert.equal(pair.error,null);assert.notEqual(pair.campaign.resources,beforeGift.resources);assert.equal(pair.campaign.conversations['local-retiro'].giftCount,1);
 const harmed=structuredClone(pair.battle);applyCivilianHarm(harmed,harmed.npcs.find(n=>n.id==='local-retiro'),{source:harmed.units.find(u=>u.id==='110'),damage:20,breathLoss:0,intentional:true});assert.equal(hasPendingCivilians(pair.campaign,harmed),true);
 const beforeHarm=pair.campaign;pair=equalSync(pair.campaign,harmed);assert.equal(pair.error,null);assert.notEqual(pair.campaign.resources,beforeHarm.resources);assert.equal(pair.campaign.civilianState.people['npc-local-retiro'].health.hp,harmed.npcs.find(n=>n.id==='local-retiro').hp);
 const settled=pair.campaign;pair=equalSync(pair.campaign,{...pair.battle,elapsedSeconds:pair.battle.elapsedSeconds+3});assert.equal(pair.campaign.resources,settled.resources);
 const missingGift=structuredClone(pair.battle);delete missingGift.npcs.find(n=>n.id==='local-retiro').questGifts;
 const failed=syncBattleTime(pair.campaign,missingGift);assert.ok(failed.error);assert.equal(failed.campaign,pair.campaign);assert.equal(failed.battle,missingGift);
 const missingHarm=structuredClone(pair.battle);delete missingHarm.npcs.find(n=>n.id==='local-retiro').civilianHarm;
 assert.ok(syncBattleTime(pair.campaign,missingHarm).error,'the fast path must still audit acknowledged civilian receipts');
});
