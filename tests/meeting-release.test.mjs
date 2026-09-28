import {getReachable} from '../game/tactical.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {releasePackage,releaseMeeting} from './meeting-release-fixture.mjs';
import {readyLocal,saved,tactical,leave,visit,talk,order,localNPC} from './local-contract-fixture.mjs';
import {callGuest,guest} from './dialogue-movement-fixture.mjs';
import {atDialogueMeeting,projectDialogueMovements} from '../game/dialogue-movement.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {dispatchCampaign} from '../game/campaign.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {encodeSave,decodeSave} from '../game/save.js';
const point=n=>({x:n.x,y:n.y});
const ready=()=>tactical(callGuest(readyLocal(undefined,releasePackage())),{type:'rest'});

test('completing a real meeting releases its destination, completes the quest and pays once in one saved transaction',()=>{
 let p=ready(),cash=p.campaign.resources.treasury,at=point(guest(p));assert.equal(atDialogueMeeting(p.campaign,'pablo',p.battle),true);
 p=saved(releaseMeeting(p));assert.equal(guest(p).scriptedMove,undefined);assert.equal(guest(p).ai.destination,undefined);assert.equal(p.campaign.dialogueMovements.at(-1).target,null);assert.equal(p.campaign.lastConversation.dialogueEffect.movement.destination,'routine');assert.equal(contentQuestStatus(p.campaign,'meeting'),'completed');assert.equal(p.campaign.resources.treasury,cash+100);assert.equal(atDialogueMeeting(p.campaign,'pablo',p.battle),false);
 for(let i=0;i<6&&JSON.stringify(point(guest(p)))===JSON.stringify(at);i++)p=tactical(p,{type:'ambient'});assert.notDeepEqual(point(guest(p)),at);p=visit(leave(p));assert.equal(guest(p).scriptedMove,undefined);assert.equal(atDialogueMeeting(p.campaign,'pablo',p.battle),false);
});

test('a routine release with no pending meeting cannot advance dialogue, pay or change a quest',()=>{
 const d=releasePackage(),choice=d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[0].choices[0];choice.effects[0].destination='routine';choice.effects.push({type:'treasury',operation:'receive',amount:100});const p=readyLocal(undefined,d),cash=p.campaign.resources.treasury;
 assert.equal(dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices[0].available,false);const next=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});assert.match(next.lastError,/encuentro pendiente/);assert.equal(next.resources.treasury,cash);assert.equal(contentQuestStatus(next,'meeting'),'not-started');assert.equal(next.dialogueMovements,undefined);assert.deepEqual(next.conversations,p.campaign.conversations);
});

test('an unaffordable meeting completion keeps the destination, quest and receipts unchanged',()=>{
 const d=releasePackage();d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].effects.find(e=>e.type==='treasury').operation='pay';d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes[1].choices[0].effects.find(e=>e.type==='treasury').amount=1000000;
 const p=tactical(callGuest(readyLocal(undefined,d)),{type:'rest'}),next=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'north',dialogueChoice:'back'});assert.match(next.lastError,/Faltan/);assert.deepEqual(next.dialogueMovements,p.campaign.dialogueMovements);assert.equal(contentQuestStatus(next,'meeting'),'active');assert.deepEqual(next.conversations,p.campaign.conversations);assert.equal(next.resources.treasury,p.campaign.resources.treasury);
});

test('a later call can replace a released routine without resurrecting an old command or payment',()=>{
 const d=releasePackage(),nodes=d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes;delete nodes[1].choices[0].conditions;nodes[0].choices.push({id:'again',label:'Volvé al encuentro.',next:'north',effects:[{type:'movement',character:'pablo',destination:'speaker'}]});
 let p=tactical(callGuest(readyLocal(undefined,d)),{type:'rest'});p=saved(releaseMeeting(p));const cash=p.campaign.resources.treasury;p=tactical(p,{type:'ambient'});
 p.campaign=order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'again'});p.battle=projectDialogueMovements(p.campaign,p.battle);p=saved(p);assert.equal(guest(p).scriptedMove.order,2);p=saved(releaseMeeting(p));assert.equal(p.campaign.lastConversation.dialogueEffect.applied,false);assert.equal(guest(p).scriptedMove.order,2);assert.equal(p.campaign.dialogueMovements.length,3);assert.equal(p.campaign.resources.treasury,cash);
});

test('saved routine releases reject missing records, reinstated destinations and forged result modes',()=>{
 const p=saved(releaseMeeting(ready())),wire=encodeSave(p.campaign,p.battle);
 for(const mutate of [v=>v.campaign.dialogueMovements.pop(),v=>v.campaign.dialogueMovements.at(-1).target={x:1,y:1},v=>v.battle.npcs.find(n=>n.contentId==='pablo').scriptedMove={order:0,target:v.campaign.dialogueMovements[0].target},v=>delete v.campaign.lastConversation.dialogueEffect.movement.destination,v=>v.campaign.lastConversation.dialogueEffect.movement.destination='speaker']){const v=JSON.parse(wire);mutate(v);assert.throws(()=>decodeSave(JSON.stringify(v)),/movimiento/);}
});

test('an arrived resident can end its own meeting through its own conversation',()=>{
 const d=releasePackage();d.characters.find(c=>c.id==='pablo').encounter.dialogue={entry:'start',nodes:[{id:'start',title:'Encuentro',text:'¿Puedo seguir con lo mío?',choices:[{id:'leave',label:'Podés seguir.',next:'done',conditions:[{type:'meeting',character:'pablo'}],effects:[{type:'movement',character:'pablo',destination:'routine'}]}]},{id:'done',title:'Fin',text:'Hasta luego.',choices:[]}]};
 let p=tactical(callGuest(readyLocal(undefined,d)),{type:'rest'});const npc=guest(p),unit=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});
 p.campaign=order(p.campaign,{...talk(p,undefined,'dialogue'),npcId:npc.id,dialogueNode:'start',dialogueChoice:'leave'});p.battle=projectDialogueMovements(p.campaign,p.battle);p=saved(p);assert.equal(guest(p).scriptedMove,undefined);assert.equal(p.campaign.dialogueMovements.at(-1).npc,npc.id);assert.equal(p.campaign.lastConversation.text,'Hasta luego.');
});
