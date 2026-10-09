import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {postContent,readyPostCampaign,finishPostCampaign} from './post-campaign-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';

test('the downloadable authored post campaign finishes its complete paid combat and dialogue route with saved wounds and soldier states',()=>{
 const d=postContent();assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);
 const pinned=initialCampaign(8,d);d.characters[0].name='Later draft edit';assert.notEqual(rosterFor(saved({campaign:pinned}).campaign).find(o=>o.contentId===d.characters[0].id).name,'Later draft edit');
 const {campaign:s,notes}=finishPostCampaign();assert.equal(s.completed,true);assert.equal(s.campaignProgress.outcome.type,'victory');assert.equal(notes.filter(n=>n.actions).length,2);assert.ok(notes.some(n=>n.wounds.length>0),'actual combat wounds must be retained at a campaign checkpoint');const care=notes.find(n=>n.stage==='relief').care;assert.ok(care.dressingsUsed>0&&care.hours>0,'actual wounds must consume finite dressings and paid care');assert.ok(care.repairPointsSpent>0&&care.repairHours>0,'actual weapon damage must consume finite tools and paid repair');assert.equal(contentQuestStatus(s,'postas'),'completed');assert.ok(s.resources.treasury>0);
 const after=order(saved({campaign:s}).campaign,{type:'wait',hours:24});assert.equal(after.completed,true);assert.equal(contentQuestStatus(after,'postas'),'completed');const p=visit(after);assert.ok(p.battle.npcs.some(n=>n.contentId==='ines'));assert.ok(p.battle.npcs.every(n=>n.contentId==='ines'));const returned=saved({campaign:leave(p)}).campaign;
 assert.equal(returned.completed,true);assert.equal(returned.log.filter(e=>e.text===postContent().campaignStory.victory).length,1);assert.deepEqual(returned.recruited,s.recruited);for(const id of s.recruited){assert.equal(returned.operativeState[id].alive,s.operativeState[id].alive,`saved soldier ${id} must retain its actual life state`);assert.equal(returned.operativeState[id].hp,after.operativeState[id].hp,`saved soldier ${id} must retain its wounds through the peaceful revisit`);}for(const id of notes.at(-1).deaths){assert.equal(returned.operativeState[id].alive,false);assert.ok(dispatchCampaign(returned,{type:'recruitCivic',id:Number(id),term:'week'}).lastError);}
});

test('missing the authored seven-day deadline produces a saved loss instead of a false ending',()=>{
 let s=readyPostCampaign();const deadline=s.hour+168;while(s.hour<deadline&&!s.defeated){const before=s.hour;s=order(s,{type:'wait',hours:Math.min(24,deadline-s.hour)});assert.ok(s.hour>before);}const restored=saved({campaign:s}).campaign;
 assert.equal(contentQuestStatus(restored,'postas'),'failed');assert.equal(restored.defeated,true);assert.equal(restored.completed,false);assert.equal(restored.campaignProgress.outcome.type,'defeat');assert.ok(restored.contentQuestEvents.some(e=>e.quest==='postas'&&e.deadline!==undefined));assert.ok(restored.log.some(e=>e.text===postContent().campaignStory.defeat));
});
