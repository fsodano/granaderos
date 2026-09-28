import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {contentQuestStatus,contentQuestJournal} from '../game/content-quests.js';
import {getReachable} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {questPackage} from './content-quest-fixture.mjs';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {order,saved,localNPC,readyLocal,talk,leave,visit,tactical} from './local-contract-fixture.mjs';
const choose=(p,node,id,npcId=localNPC(p.battle).id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),npcId,dialogueNode:node,dialogueChoice:id})});
const approach=(p,npc=localNPC(p.battle))=>{const unit=p.battle.units.find(u=>u.side==='player'),tile=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(tile);return tile.cost?tactical(p,{type:'move',x:tile.x,y:tile.y}):p;};
const progress=p=>contentQuestStatus(p.campaign,'river-post');

test('an authored quest starts, waits for its actual day condition and completes with one saved reward',()=>{
 let p=readyLocal(undefined,questPackage({day:true}));assert.equal(progress(p),'not-started');assert.deepEqual(contentQuestJournal(p.campaign),[]);p=saved(choose(p,'start','accept'));assert.equal(progress(p),'active');assert.equal(p.campaign.lastConversation.dialogueEffect.amount,0);assert.equal(contentQuestJournal(p.campaign)[0].status,'active');assert.ok(!dialogueForNPC(p.campaign,localNPC(p.battle)).choices.some(c=>c.id==='complete'));
 let s=order(leave(p),{type:'wait',hours:24});p=approach(visit(saved({campaign:s}).campaign));const cash=p.campaign.resources.treasury;p=saved(choose(p,'active','complete'));assert.equal(progress(p),'completed');assert.equal(p.campaign.resources.treasury,cash+175);assert.equal(p.campaign.contentQuestEvents.length,2);assert.equal(contentQuestJournal(p.campaign)[0].resolvedAt,p.campaign.hour);
 p=saved(choose(p,'done','back'));assert.deepEqual(dialogueForNPC(p.campaign,localNPC(p.battle)).choices,[]);const rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'active',dialogueChoice:'complete'});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},p.campaign);
});

test('the alternate failure branch is terminal and cannot later complete or grant its reward',()=>{
 const d=questPackage();delete d.characters.at(-1).encounter.dialogue.nodes[1].choices[0].conditions;let p=choose(readyLocal(undefined,d),'start','accept'),cash=p.campaign.resources.treasury;p=saved(choose(p,'active','fail'));assert.equal(progress(p),'failed');assert.equal(p.campaign.resources.treasury,cash);
 p=choose(p,'failed','back');const quote=dialogueForNPC(p.campaign,localNPC(p.battle)).choices[0];assert.equal(quote.id,'complete');assert.equal(quote.available,false);const rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'active',dialogueChoice:'complete'});assert.match(rejected.lastError,/no puede pasar/);assert.deepEqual({...rejected,lastError:null},p.campaign);
});

test('different residents can start and resolve the same quest without duplicating its state or reward',()=>{
 const d=questPackage(),second={...structuredClone(d.characters.at(-1)),id:'river-recipient',name:'Receptor del parte'};second.encounter.dialogue.entry='active';d.characters.push(second);d.placements.push({...structuredClone(d.placements.at(-1)),id:'recipient-place',character:second.id});let p=choose(readyLocal(undefined,d),'start','accept');const npc=p.battle.npcs.find(n=>n.contentId===second.id);p=approach(p,npc);const cash=p.campaign.resources.treasury;p=saved(choose(p,'active','complete',npc.id));assert.equal(progress(p),'completed');assert.equal(p.campaign.resources.treasury,cash+175);assert.notEqual(p.campaign.contentQuestEvents[0].npc,p.campaign.contentQuestEvents[1].npc);assert.equal(contentQuestJournal(p.campaign).length,1);
});

test('an unaffordable quest start and a premature completion reject all effects atomically',()=>{
 for(const premature of [false,true]){const d=questPackage(),choice=d.characters.at(-1).encounter.dialogue.nodes[0].choices[0];choice.effects=[{type:'quest',quest:'river-post',status:premature?'completed':'active'},{type:'treasury',operation:premature?'receive':'pay',amount:1000000}];const p=readyLocal(undefined,d),rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'accept'});assert.match(rejected.lastError,premature?/no puede pasar/:/Faltan/);assert.deepEqual({...rejected,lastError:null},p.campaign);assert.equal(progress(p),'not-started');}
});

test('quest save admission rejects missing, duplicated, reordered and inconsistent transition evidence',()=>{
 const p=choose(choose(readyLocal(undefined,questPackage()),'start','accept'),'active','complete'),wire=encodeSave(p.campaign,p.battle),npc=localNPC(p.battle).id;
 for(const mutate of [s=>delete s.contentQuestEvents,s=>s.contentQuestEvents.pop(),s=>s.contentQuestEvents.push(structuredClone(s.contentQuestEvents[1])),s=>s.contentQuestEvents.reverse(),s=>s.contentQuestEvents[0].from='active',s=>s.contentQuestEvents[0].quest='missing',s=>s.contentQuestEvents[0].hour=s.hour+1,s=>s.contentQuestEvents[0].extra=true,s=>s.conversations[npc].dialogueReceipts.shift(),s=>s.lastConversation.dialogueEffect.quest.title='Otro encargo',s=>delete s.lastConversation.dialogueEffect.quest]){const v=JSON.parse(wire);mutate(v.campaign);assert.throws(()=>decodeSave(JSON.stringify(v)),/encargo|registro|secuencia|operaci/);}
});

test('quest definitions and references reject malformed, duplicate and unsupported states',()=>{
 for(const mutate of [d=>d.quests=null,d=>d.quests[0].id='constructor',d=>d.quests.push(structuredClone(d.quests[0])),d=>d.quests[0].title='',d=>d.quests[0].description='x'.repeat(1001),d=>d.quests[0].reward=100,d=>d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects[0].quest='missing',d=>d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects[0].status='not-started',d=>d.characters.at(-1).encounter.dialogue.nodes[1].choices[0].conditions[0].status='unknown']){const d=questPackage();mutate(d);assert.throws(()=>initialCampaign(42,d));}
});

test('older packages without quests retain their dialogue and accept empty quest history',()=>{
 const d=dialoguePackage();delete d.quests;const p=readyLocal(undefined,d);assert.ok(saved(p));p.campaign.contentQuestEvents=[];assert.ok(saved(p));assert.deepEqual(contentQuestJournal(p.campaign),[]);
});

test('revisiting a consumed start cannot reopen a completed quest',()=>{
 const d=questPackage();d.characters.at(-1).encounter.dialogue.nodes[2].choices[0].next='start';let p=choose(choose(readyLocal(undefined,d),'start','accept'),'active','complete'),cash=p.campaign.resources.treasury;p=choose(p,'done','back');p=saved(choose(p,'start','accept'));assert.equal(progress(p),'completed');assert.equal(p.campaign.contentQuestEvents.length,2);assert.equal(p.campaign.resources.treasury,cash);assert.equal(p.campaign.lastConversation.dialogueEffect.applied,false);assert.deepEqual(dialogueForNPC(p.campaign,localNPC(p.battle)).choices,[]);
});
