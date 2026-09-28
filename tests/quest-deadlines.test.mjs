import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {contentQuestStatus,contentQuestJournal} from '../game/content-quests.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {questPackage} from './content-quest-fixture.mjs';
import {order,saved,localNPC,readyLocal,talk,leave,tactical} from './local-contract-fixture.mjs';
const seconds=s=>s.hour*3600+(s.secondOfHour??0);
const definition=()=>{const d=questPackage();d.quests[0].deadlineHours=1;return d;};
const choose=(p,node,id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});
const start=()=>choose(tactical(readyLocal(undefined,definition()),{type:'rest'}),'start','accept');

test('a quest deadline uses acceptance seconds and expires once through actual tactical time and saves',()=>{
 let p=start(),began=seconds(p.campaign);assert.ok(began%3600>0);assert.equal(contentQuestJournal(p.campaign)[0].deadline,began+3600);
 for(let i=0;i<5;i++)p=tactical(p,{type:'rest'});p=saved(p);assert.equal(contentQuestStatus(p.campaign,'river-post'),'active');assert.equal(contentQuestJournal(p.campaign)[0].remainingMinutes,10);
 p=saved(tactical(p,{type:'rest'}));assert.equal(seconds(p.campaign),began+3600);assert.equal(contentQuestStatus(p.campaign,'river-post'),'failed');assert.equal(p.campaign.contentQuestEvents.at(-1).deadline,began+3600);assert.equal(contentQuestJournal(p.campaign)[0].expired,true);
 p=saved(tactical(p,{type:'rest'}));assert.equal(p.campaign.contentQuestEvents.length,2);assert.equal(p.campaign.conversations[localNPC(p.battle).id].dialogueReceipts.length,1);
 const rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'active',dialogueChoice:'complete'});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},p.campaign);
});

test('strategic waiting and an actual cell march both expire a running quest at its recorded deadline',()=>{
 for(const action of [{type:'wait',hours:2},{type:'travel',sector:'cell-26-27'}]){
  const p=start(),deadline=contentQuestJournal(p.campaign)[0].deadline;let s=leave(p);assert.equal(contentQuestStatus(s,'river-post'),'active');s=order(s,action);s=saved({campaign:s}).campaign;assert.equal(contentQuestStatus(s,'river-post'),'failed');assert.equal(s.contentQuestEvents.at(-1).deadline,deadline);assert.ok(seconds(s)>=deadline);
 }
});

test('unstarted quests have no ticking deadline and an early completion stays completed after it passes',()=>{
 let p=readyLocal(undefined,definition()),s=order(leave(p),{type:'wait',hours:24});assert.deepEqual(contentQuestJournal(s),[]);assert.equal(contentQuestStatus(s,'river-post'),'not-started');assert.ok(saved({campaign:s}));
 p=choose(start(),'active','complete');const cash=p.campaign.resources.treasury;s=order(leave(p),{type:'wait',hours:2});s=saved({campaign:s}).campaign;assert.equal(contentQuestStatus(s,'river-post'),'completed');assert.equal(s.contentQuestEvents.length,2);assert.equal(contentQuestJournal(s)[0].expired,false);assert.ok(s.resources.treasury>=cash);
});

test('a long wait records multiple expirations in deadline order rather than catalogue order',()=>{
 const d=definition();d.quests[0].deadlineHours=2;d.quests.push({id:'urgent',title:'Parte urgente',description:'Entregar el parte.',deadlineHours:1});d.characters.at(-1).encounter.dialogue.nodes[1].choices.push({id:'urgent',label:'Acepto el parte urgente.',next:'active',effects:[{type:'quest',quest:'urgent',status:'active'}]});let p=choose(readyLocal(undefined,d),'start','accept');p=choose(p,'active','urgent');const s=saved({campaign:order(leave(p),{type:'wait',hours:4})}).campaign;assert.deepEqual(s.contentQuestEvents.slice(-2).map(e=>e.quest),['urgent','river-post']);assert.ok(s.contentQuestEvents.at(-2).deadline<s.contentQuestEvents.at(-1).deadline);
});

test('deadline save validation rejects missing or altered expiry evidence and invalid precise clocks',()=>{
 let p=start();for(let i=0;i<6;i++)p=tactical(p,{type:'rest'});const wire=encodeSave(p.campaign,p.battle);
 for(const mutate of [s=>s.contentQuestEvents.pop(),s=>s.contentQuestEvents[1].deadline++,s=>s.contentQuestEvents[1].to='completed',s=>s.contentQuestEvents[1].npc='invented',s=>s.contentQuestEvents[1].secondOfHour=3600,s=>s.contentQuestEvents[1].secondOfHour=null,s=>s.contentQuestEvents[0].secondOfHour++]){const v=JSON.parse(wire);mutate(v.campaign);assert.throws(()=>decodeSave(JSON.stringify(v)),/encargo|vencimiento|secuencia/);}
});

test('deadline definitions are bounded and older quests without precise timestamps remain readable',()=>{
 for(const hours of [0,-1,721,1.5,'1']){const d=definition();d.quests[0].deadlineHours=hours;assert.throws(()=>initialCampaign(42,d),/plazo/);}
 const p=choose(readyLocal(undefined,questPackage()),'start','accept'),v=JSON.parse(encodeSave(p.campaign,p.battle));delete v.campaign.contentQuestEvents[0].secondOfHour;assert.equal(contentQuestStatus(decodeSave(JSON.stringify(v)).campaign,'river-post'),'active');
});
