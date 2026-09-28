import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalPackage,finishMeeting} from './meeting-arrival-fixture.mjs';
import {callGuest,guest} from './dialogue-movement-fixture.mjs';
import {readyLocal,saved,tactical,localNPC,talk,leave,visit} from './local-contract-fixture.mjs';
import {atDialogueMeeting} from '../game/dialogue-movement.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {hearNpcNoise} from '../game/npc-ai.js';
const arrived=p=>atDialogueMeeting(p.campaign,'pablo',p.battle);
const choices=p=>dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices;

test('a real meeting quest cannot complete while walking and pays once after reaching its destination',()=>{
 let p=readyLocal(undefined,arrivalPackage());assert.equal(arrived(p),false);p=saved(callGuest(p));const cash=p.campaign.resources.treasury;assert.equal(arrived(p),false);assert.equal(choices(p).length,0);assert.equal(contentQuestStatus(p.campaign,'meeting'),'active');
 const rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'north',dialogueChoice:'back'});assert.match(rejected.lastError,/disponible/);assert.equal(rejected.resources.treasury,cash);assert.equal(contentQuestStatus(rejected,'meeting'),'active');
 p=saved(tactical(p,{type:'ambient'}));assert.equal(arrived(p),false,'one six-second step must not imply arrival');
 for(let i=0;i<8&&!arrived(p);i++)p=saved(tactical(p,{type:'ambient'}));assert.equal(arrived(p),true);assert.equal(choices(p).length,1);
 p=saved(finishMeeting(p));assert.equal(contentQuestStatus(p.campaign,'meeting'),'completed');assert.equal(p.campaign.resources.treasury,cash+100);p=saved(callGuest(p));p=saved(finishMeeting(p));assert.equal(p.campaign.resources.treasury,cash+100);
});

test('the arrival condition follows the active scene and persists immediately through saved re-entry',()=>{
 let p=saved(callGuest(readyLocal(undefined,arrivalPackage())));p=saved(tactical(p,{type:'rest'}));assert.equal(arrived(p),true);assert.equal(atDialogueMeeting(p.campaign,'pablo',null),false);assert.equal(atDialogueMeeting(p.campaign,'pablo',{...p.battle,battleId:'wrong'}),false);assert.equal(atDialogueMeeting(p.campaign,'pablo',{...p.battle,sectorId:'cell-26-27'}),false);
 p=visit(leave(p));assert.equal(arrived(p),true);assert.equal(choices(p).length,1);
});

test('danger and incapacity block the arrived condition until the actual actor is available again',()=>{
 let p=saved(callGuest(readyLocal(undefined,arrivalPackage())));p=tactical(p,{type:'rest'});assert.equal(arrived(p),true);
 // A prepared immediate alarm isolates the safety guard; the following recovery
 // uses the actual tactical clock and ordinary civilian shelter behavior.
 const n=guest(p);hearNpcNoise(p.battle,{x:n.x+1,y:n.y},'fire',10);assert.equal(arrived(p),false);assert.equal(choices(p).length,0);p=saved(tactical(p,{type:'rest'}));assert.equal(arrived(p),true);
 const unavailable=structuredClone(p);guest(unavailable).unconscious=true;assert.equal(arrived(unavailable),false);guest(unavailable).unconscious=false;guest(unavailable).hp=0;assert.equal(arrived(unavailable),false);
});

test('an obstacle cannot satisfy arrival just because tactical time passes',()=>{
 let p=saved(callGuest(readyLocal(undefined,arrivalPackage())));const goal=guest(p).scriptedMove.target;
 // Prepared temporary occupancy isolates the blocked-route policy.
 const actor=p.battle.units.find(u=>u.side==='player'),original={x:actor.x,y:actor.y};Object.assign(actor,goal);p=tactical(p,{type:'rest'});assert.equal(arrived(p),false);assert.notDeepEqual({x:guest(p).x,y:guest(p).y},goal);
 Object.assign(p.battle.units.find(u=>u.id===actor.id),original);p=saved(tactical(p,{type:'rest'}));assert.equal(arrived(p),true);
});

test('arrival condition authoring rejects unknown, nonresident and extra fields',()=>{
 for(const patch of [{character:'missing'},{character:'person-110'},{state:'arrived'}]){const d=arrivalPackage();Object.assign(d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].conditions[0],patch);assert.throws(()=>initialCampaign(42,d),/condición.*encuentro/);}
});
