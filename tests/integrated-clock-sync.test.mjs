import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
function ready(content=null){
 let s=order(initialCampaign(42,content),{type:'recruitCivic',id:110,term:'week'});
 while(!s.recruited.includes(110))s=order(s,{type:'wait',hours:1});
 const pair=prepareCampaignBattle(order(s,{type:'visitSector'}));assert.equal(pair.error,null,pair.error);return pair;
}
function sync(pair,elapsedSeconds){
 const battle={...pair.battle,elapsedSeconds},before=structuredClone(pair.campaign);
 const expected=dispatchCampaign(pair.campaign,{type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds,sectorState:battle});
 const actual=syncBattleTime(pair.campaign,battle);assert.equal(actual.error,null,actual.error);
 assert.deepEqual(actual.campaign,expected);assert.deepEqual(pair.campaign,before);return actual;
}
for(const authored of [false,true])test(`${authored?'authored':'ordinary'} walking clocks match full dispatch and share settled map data`,()=>{
 let p=ready(authored?defaultContentPackage():null);
 for(const seconds of [3,6,14,59]){const old=p.campaign;p=sync(p,seconds);assert.equal(p.campaign.resources,old.resources);assert.equal(p.campaign.sectorStates,old.sectorStates);}
 const before=p.campaign;p=sync(p,60);assert.notEqual(p.campaign.resources,before.resources,'minute-boundary work takes full dispatch');
 const loaded=decodeSave(encodeSave(p.campaign,p.battle));p=sync(loaded,63);assert.notEqual(p.campaign.resources,loaded.campaign.resources,'serialized state cannot establish trust');
 const warm=p.campaign;p=sync(p,66);assert.equal(p.campaign.resources,warm.resources);
});
test('fresh civilian wounds are recorded before the clock can share settled state',()=>{
 let p=ready(),n=p.battle.npcs.find(n=>n.id==='local-retiro');assert.ok(n);
 const original=p.campaign;applyCivilianHarm(p.battle,n,{source:p.battle.units[0],damage:20,intentional:true});
 p=sync(p,3);assert.notEqual(p.campaign.resources,original.resources);assert.equal(p.campaign.civilianState.people['npc-local-retiro'].health.hp,n.hp);
 const settled=p.campaign;p=sync(p,6);assert.equal(p.campaign.resources,settled.resources);
 const forged=structuredClone(p.battle);delete forged.npcs.find(n=>n.id==='local-retiro').civilianHarm;
 assert.ok(syncBattleTime(p.campaign,forged).error,'an acknowledged wound cannot disappear on the fast path');
});
test('authored story conditions continue through full checkpoint evaluation',()=>{
 const content=defaultContentPackage();content.campaignStory=defaultCampaignStory();
 let p=ready(content);const before=p.campaign;p=sync(p,3);assert.notEqual(p.campaign.resources,before.resources);
});
test('hour-boundary work and invalid elapsed time retain full dispatch semantics',()=>{
 let p=ready();p=sync(p,3599);const before=p.campaign;p=sync(p,3603);assert.equal(p.campaign.hour,before.hour+1);assert.notEqual(p.campaign.resources,before.resources);
 for(const elapsedSeconds of [-1,0.5,NaN,Infinity,3602,900000]){const battle={...p.battle,elapsedSeconds},failed=syncBattleTime(p.campaign,battle);assert.ok(failed.error);assert.equal(failed.campaign,p.campaign);assert.equal(failed.battle,battle);}
});
