import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {campaignRoleActive} from '../game/campaign-roles.js';
import {contractExpiresSeconds,contractStatus} from '../game/contracts.js';
import {missionAssaultSquads} from '../game/mission-assault.js';
import {decodeSave,encodeSave} from '../game/save.js';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
function finalServiceSecond(){
 // Authored friendly roads isolate contract admission. The hire, its arrival,
 // paid service and the journey to San Nicolás all use the public reducer.
 const content=defaultContentPackage();
 content.campaignRoles={foundryEngineer:'person-103',marchCommander:'person-103'};
 content.startingTerritory.buenos_aires.owner='patriot';
 content.startingTerritory.san_nicolas.owner='patriot';
 let state=order(initialCampaign(42,content),{type:'advanceStrategicTime',seconds:121});
 state=order(state,{type:'recruitCivic',id:103,term:'day'});
 for(let n=0;n<12&&!state.recruited.includes(103);n++)state=order(state,{type:'advanceStrategicTime',seconds:3600});
 assert.equal(state.contracts[103].started,6);assert.equal(state.contracts[103].startedSecond,121);
 state=order(state,{type:'transport',mode:'posta'});
 state=order(state,{type:'travel',sector:'san_nicolas',mode:'posta'});
 assert.equal(state.operativeState[103].location,'san_nicolas');
 const target=contractExpiresSeconds(state.contracts[103])-1;
 for(let n=0;n<40&&state.hour*3600+state.secondOfHour<target;n++)state=order(state,{type:'advanceStrategicTime',seconds:Math.min(3600,target-state.hour*3600-state.secondOfHour)});
 assert.equal(state.hour,30);assert.equal(state.secondOfHour,120);
 return decodeSave(encodeSave(state)).campaign;
}

test('a paid role and mission manifest remain available through the last actual service second',()=>{
 const state=finalServiceSecond(),before=structuredClone(state);
 assert.equal(contractStatus(state,103).active,true);assert.equal(contractStatus(state,103).remaining,1/3600);
 assert.equal(campaignRoleActive(state,'foundryEngineer'),true);assert.equal(campaignRoleActive(state,'marchCommander'),true);
 assert.equal(missionAssaultSquads(state).find(q=>q.id===state.activeSquadId).reason,null);
 const deployed=order(state,{type:'attack',sector:'san_lorenzo',squadIds:[state.activeSquadId]});
 assert.deepEqual(deployed.pendingBattle.assaultSquads[0].members,[103]);
 assert.equal(deployed.pendingBattle.squad[0].id,103);assert.equal(deployed.pendingBattle.secondOfHour,120);
 assert.deepEqual(state,before);
});

test('the exact contract expiry removes the role and prevents a later public mission deployment',()=>{
 const before=finalServiceSecond(),state=order(before,{type:'advanceStrategicTime',seconds:1});
 assert.equal(state.hour,30);assert.equal(state.secondOfHour,121);assert.equal(state.recruited.includes(103),false);
 assert.equal(campaignRoleActive(state,'foundryEngineer'),false);assert.equal(campaignRoleActive(state,'marchCommander'),false);
 const denied=dispatchCampaign(state,{type:'attack',sector:'san_lorenzo',squadIds:[state.activeSquadId]});
 assert.ok(denied.lastError);assert.equal(denied.pendingBattle,null);assert.deepEqual(denied.resources,state.resources);
 assert.deepEqual(decodeSave(encodeSave(state)).campaign,state);
});
