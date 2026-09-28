import {getReachable} from '../game/tactical.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readyLocal,saved,tactical,localNPC,leave,visit,order,talk} from './local-contract-fixture.mjs';
import {movementPackage,guest,callGuest} from './dialogue-movement-fixture.mjs';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,initialCampaign} from '../game/campaign.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {projectDialogueMovements} from '../game/dialogue-movement.js';
const point=n=>({x:n.x,y:n.y});

test('a real dialogue orders a same-sector resident to walk, wait and retain the meeting across saves and visits',()=>{
 let p=readyLocal(undefined,movementPackage()),before=point(guest(p));
 p=saved(callGuest(p));assert.deepEqual(point(guest(p)),before,'issuing a dialogue does not teleport the actor');
 assert.equal(p.campaign.dialogueMovements.length,1);const target=guest(p).scriptedMove.target;
 p=saved(tactical(p,{type:'rest'}));assert.deepEqual(point(guest(p)),target);assert.equal(guest(p).ai.activity,'meeting');
 p=saved(tactical(p,{type:'rest'}));assert.deepEqual(point(guest(p)),target);
 p=visit(leave(p));assert.deepEqual(guest(p).scriptedMove.target,target);p=tactical(p,{type:'rest'});assert.deepEqual(point(guest(p)),target);
});

test('replaying a consumed movement option does not repeat the order or change the pinned destination',()=>{
 let p=saved(callGuest(readyLocal(undefined,movementPackage())));const orders=structuredClone(p.campaign.dialogueMovements);
 p.campaign=order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'north',dialogueChoice:'back'});p=saved(callGuest(p));assert.deepEqual(p.campaign.dialogueMovements,orders);assert.equal(p.campaign.lastConversation.dialogueEffect.applied,false);
});

test('an unavailable guest rejects all combined effects and dialogue advancement atomically',()=>{
 const d=movementPackage();d.placements.find(p=>p.character==='pablo').sectors=['cell-26-27'];d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[0].choices[0].effects.push({type:'treasury',operation:'receive',amount:200});
 const p=readyLocal(undefined,d),view=dialogueForNPC(p.campaign,localNPC(p.battle),p.battle);assert.equal(view.choices[0].available,false);
 const next=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});assert.match(next.lastError,/consciente/);assert.equal(next.resources.treasury,p.campaign.resources.treasury);assert.equal(next.dialogueMovements,undefined);assert.deepEqual(next.conversations,p.campaign.conversations);
});

test('movement saves reject missing, duplicated, redirected, unrelated and forged orders',()=>{
 const p=saved(callGuest(readyLocal(undefined,movementPackage()))),wire=encodeSave(p.campaign,p.battle);
 for(const mutate of [v=>v.campaign.dialogueMovements=[],v=>v.campaign.dialogueMovements.push(v.campaign.dialogueMovements[0]),v=>v.campaign.dialogueMovements[0].character='person-110',v=>v.campaign.dialogueMovements[0].sector='cell-0-0',v=>v.campaign.dialogueMovements[0].revision++,v=>v.campaign.dialogueMovements[0].target.x++,v=>delete v.battle.npcs.find(n=>n.contentId==='pablo').scriptedMove,v=>v.battle.npcs.find(n=>n.contentId==='pablo').scriptedMove.order++,v=>v.campaign.dialogueMovements[0].secondOfHour=3600,v=>v.campaign.lastConversation.dialogueEffect.movement.name='fake']){const v=JSON.parse(wire);mutate(v);assert.throws(()=>decodeSave(JSON.stringify(v)),/movimiento/);}
 const forged=structuredClone(p.battle);guest({battle:forged}).scriptedMove.target.x++;const next=dispatchCampaign(p.campaign,{type:'syncTacticalTime',battleId:p.campaign.pendingBattle.id,elapsedSeconds:forged.elapsedSeconds,sectorState:forged});assert.match(next.lastError,/movimiento/);
});

test('authoring rejects movement to oneself, bulletin hires, missing residents, and unknown destinations',()=>{
 for(const patch of [{character:'alma-contract'},{character:'person-110'},{character:'missing'},{destination:'anywhere'}]){const d=movementPackage();Object.assign(d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[0].choices[0].effects[0],patch);assert.throws(()=>initialCampaign(42,d),/movimiento/);}
});

test('a later dialogue order replaces the previous one and replay cannot reinstate an older order',()=>{
 const d=movementPackage();d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].effects=[{type:'movement',character:'pablo',destination:'speaker'}];
 let p=saved(callGuest(readyLocal(undefined,d)));p.campaign=order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'north',dialogueChoice:'back'});p.battle=projectDialogueMovements(p.campaign,p.battle);p=saved(p);assert.equal(guest(p).scriptedMove.order,1);assert.equal(p.campaign.dialogueMovements.length,2);
 p=saved(callGuest(p));assert.equal(guest(p).scriptedMove.order,1);assert.equal(p.campaign.dialogueMovements.length,2);
});

test('a dead ordered resident stays dead and cannot resume moving after save and re-entry',()=>{
 let p=saved(callGuest(readyLocal(undefined,movementPackage())));p=tactical(p,{type:'rest'});const npc=guest(p);
 // Move by a legal route to a free adjacent tile; then use ordinary melee.
 const {battle}=p,unit=battle.units.find(u=>u.side==='player');
 const spot=getReachable(battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});
 for(let i=0;i<12&&guest(p).hp>0;i++)p=tactical(p,{type:'melee',targetId:npc.id});assert.equal(guest(p).hp,0);const at=point(guest(p));p=saved(tactical(p,{type:'rest'}));assert.deepEqual(point(guest(p)),at);assert.equal(guest(p).hp,0);p=visit(leave(p));assert.equal(guest(p).hp,0);assert.deepEqual(point(guest(p)),at);
});

test('a daily sector relocation ends the old local meeting order without deleting its receipt',()=>{
 const d=movementPackage();Object.assign(d.placements.find(p=>p.character==='pablo'),{mode:'daily',selection:'alternate',sectors:['cell-27-27','cell-26-27']});
 let p=saved(callGuest(readyLocal(undefined,d))),s=leave(p);s=order(s,{type:'wait',hours:4-s.hour});assert.equal(s.contentPresence.people.pablo.sector,'cell-26-27');s=order(s,{type:'travel',sector:'cell-26-27'});p=visit(s);assert.equal(guest(p).scriptedMove,undefined);assert.equal(p.campaign.dialogueMovements.length,1);assert.ok(guest(p).presenceRevision>p.campaign.dialogueMovements[0].revision);
});
