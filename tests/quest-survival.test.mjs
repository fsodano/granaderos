import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {contentQuestStatus,contentQuestJournal} from '../game/content-quests.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {actBattle,createBattle,endTurn} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {survivalPackage} from './quest-survival-fixture.mjs';
import {questPackage} from './content-quest-fixture.mjs';
import {approachNPC} from './approach-npc.mjs';
import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {order,saved,sync,localNPC,localId,readyLocal,talk,leave,visit,hireLocal,tactical} from './local-contract-fixture.mjs';
const choose=(p,node,id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});
const start=d=>choose(readyLocal(undefined,d??survivalPackage()),'start','accept');
const victim=p=>p.battle.npcs.find(n=>n.contentId==='pablo');
const approach=(p,n)=>sync({campaign:p.campaign,battle:approachNPC(p.battle,p.battle.units.find(u=>u.side==='player').id,n.id)});
function kill(p){p=approach(p,victim(p));for(let i=0;i<6&&victim(p).hp>0;i++)p=tactical(p,{type:'melee',targetId:victim(p).id});assert.equal(victim(p).hp,0);return p;}

test('an actual required civilian death fails an active quest once and preserves its cause',()=>{
 let p=saved(kill(start()));assert.equal(contentQuestStatus(p.campaign,'river-post'),'failed');assert.equal(p.campaign.contentQuestEvents.at(-1).death,'pablo');assert.equal(contentQuestJournal(p.campaign)[0].deathName,'Pablo');p=saved(tactical(p,{type:'rest'}));assert.equal(p.campaign.contentQuestEvents.length,2);assert.equal(p.campaign.conversations[localNPC(p.battle).id].dialogueReceipts.length,1);
});

test('an already dead required character blocks accepting a quest without creating progress',()=>{
 let p=kill(readyLocal(undefined,survivalPackage()));p=approach(p,localNPC(p.battle));const q=dialogueForNPC(p.campaign,localNPC(p.battle)).choices[0];assert.equal(q.available,false);assert.match(q.reason,/Pablo ha muerto/);const rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'accept'});assert.match(rejected.lastError,/Pablo ha muerto/);assert.deepEqual({...rejected,lastError:null},p.campaign);assert.equal(contentQuestStatus(p.campaign,'river-post'),'not-started');assert.deepEqual(contentQuestJournal(p.campaign),[]);
});

test('death after completion does not revoke a quest result or grant another reward',()=>{
 let p=choose(start(),'active','complete');p=saved(kill(p));assert.equal(contentQuestStatus(p.campaign,'river-post'),'completed');assert.equal(p.campaign.contentQuestEvents.length,2);assert.equal(contentQuestJournal(p.campaign)[0].deathName,null);assert.equal(p.campaign.conversations[localNPC(p.battle).id].dialogueReceipts.filter(r=>r.amount===175).length,1);
});

test('wounds, local recruitment and dismissal do not count as a required character death',()=>{
 const d=questPackage();d.quests[0].requiredAlive=['alma-contract'];d.characters.at(-1).startingCondition={hp:10,energy:100,fatigue:0,bleeding:0,bandaged:85};let p=readyLocal(undefined,d);assert.equal(localNPC(p.battle).hp,10);p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:localNPC(p.battle).id});assert.equal(localNPC(p.battle).hp,15);p=tactical(p,{type:'weapon',slot:'primary'});p=choose(p,'start','accept');p=hireLocal(p);assert.equal(contentQuestStatus(p.campaign,'river-post'),'active');let s=order(leave(p),{type:'dismiss',id:localId(p.campaign)});p=visit(saved({campaign:s}).campaign);assert.equal(contentQuestStatus(p.campaign,'river-post'),'active');assert.equal(p.campaign.contentQuestEvents.length,1);
});

test('an actual enemy kill in a prepared compact battle confirms a required serving character death before settlement',()=>{
 const d=questPackage();d.quests[0].requiredAlive=['person-110'];d.characters.find(c=>c.id==='person-110').attributes.maxHp=30;let p=hireLocal(start(d)),s=leave(p);secureArea(s,'buenos_aires');s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});const r=s.pendingBattle;
 // Declare a compact encounter before construction. Its actual enemy attack,
 // rather than a fabricated casualty, must establish the quest death receipt.
 Object.assign(r,{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[initializeUnitAmmunition({id:'guard',x:2,y:1,weapon:1812,loaded:0,ammo:0,patrol:false})]});
 let battle=createBattle(r.squad.map(u=>({...u,x:1,y:u.id===110?1:6})),r);battle=endTurn(battle);assert.equal(battle.units.find(u=>u.id==='110').hp,0);p=saved(sync({campaign:s,battle}));assert.equal(contentQuestStatus(p.campaign,'river-post'),'failed');assert.equal(p.campaign.operativeState[110].alive,false);assert.equal(p.campaign.contentQuestEvents.at(-1).death,'person-110');
 const forged=JSON.parse(encodeSave(p.campaign,p.battle));forged.battle.units.find(u=>u.id==='110').hp=1;assert.throws(()=>decodeSave(JSON.stringify(forged)));
});

test('survival references and saved death evidence reject missing, duplicate or inconsistent data',()=>{
 for(const required of [['missing'],['pablo','pablo'],null,['pablo','person-100','person-101','person-102','person-103','person-104','person-105']]){const d=survivalPackage();d.quests[0].requiredAlive=required;assert.throws(()=>initialCampaign(42,d),/personajes/);}
 const p=kill(start()),wire=encodeSave(p.campaign,p.battle);for(const mutate of [s=>s.contentQuestEvents.pop(),s=>s.contentQuestEvents[1].death='alma-contract',s=>s.contentQuestEvents[1].hour--,s=>s.contentQuestEvents[1].deadline=1,s=>s.contentQuestEvents[1].to='completed']){const v=JSON.parse(wire);mutate(v.campaign);assert.throws(()=>decodeSave(JSON.stringify(v)),/encargo|muerte|registro|secuencia/);}
});

test('a deadline already due at a batched death checkpoint resolves once with the earlier timed cause',()=>{
 const d=survivalPackage();d.quests[0].deadlineHours=1;let p=start(d);p=approach(p,victim(p));let battle=p.battle;
 for(let i=0;i<6&&battle.npcs.find(n=>n.contentId==='pablo').hp>0;i++){battle=actBattle(battle,{type:'melee',unitId:'110',targetId:victim(p).id});assert.equal(battle.lastError,null);}assert.equal(battle.npcs.find(n=>n.contentId==='pablo').hp,0);
 for(let i=0;i<6;i++){battle=actBattle(battle,{type:'rest',unitId:'110'});assert.equal(battle.lastError,null);}p=saved(sync({campaign:p.campaign,battle}));assert.equal(contentQuestStatus(p.campaign,'river-post'),'failed');assert.equal(p.campaign.contentQuestEvents.length,2);assert.equal(p.campaign.contentQuestEvents[1].death,undefined);assert.ok(p.campaign.contentQuestEvents[1].deadline);
});
