import test from 'node:test';import assert from 'node:assert/strict';
import {hasAuthoredDialogue,dialogueOptions,dialogueReason,ambientReply} from '../game/npc-dialogue.js';
import {ENCOUNTERS} from '../game/encounters.js';import {YATASTO_NPCS} from '../game/missions.js';
import {createBattle} from '../game/tactical.js';import {targetingHelp} from '../game/ja2-hud.js';import {tacticalShortcut} from '../game/hotkeys.js';
const actor={id:'p',side:'player',hp:100,energy:100,x:2,y:2};const civilian={id:'c',name:'Vecino',x:3,y:2};const state={phase:'player',mode:'exploration',status:'active'};
test('authored dialogue includes non-recruitable quest and mission characters but excludes ordinary named civilians',()=>{
 const quest=ENCOUNTERS.find(n=>n.id==='local-retiro'),ordinary=ENCOUNTERS.find(n=>n.id==='local-uspallata');assert.ok(hasAuthoredDialogue(quest));assert.ok(hasAuthoredDialogue(YATASTO_NPCS[0]));assert.equal(hasAuthoredDialogue(ordinary),false);assert.equal(quest.operativeId,undefined);assert.deepEqual(dialogueOptions(ordinary),[]);assert.deepEqual(dialogueOptions(YATASTO_NPCS[0]).map(([id])=>id),['repeat','mission']);assert.ok(!dialogueOptions(quest).some(([id])=>id==='recruit'));
});
test('quest choices disappear after completion and a recruit retains the appropriate approaches',()=>{
 const npc=ENCOUNTERS.find(n=>n.id==='local-retiro');assert.ok(dialogueOptions(npc,{status:'offered'}).some(([id,label])=>id==='quest'&&label==='Entregar pertrechos'));assert.ok(!dialogueOptions(npc,{status:'completed'}).some(([id])=>id==='quest'));assert.ok(dialogueOptions(ENCOUNTERS.find(n=>n.id==='cabral')).some(([id])=>id==='recruit'));
});
test('speech requires a conscious local actor, a visible living target and the player control window',()=>{
 assert.equal(dialogueReason(state,actor,civilian),null);
 for(const change of [{unconscious:true},{hp:0},{departure:{}},{routed:true},{energy:0},{knockedDown:true}])assert.ok(dialogueReason(state,{...actor,...change},civilian));
 for(const change of [{x:9},{hp:0},{unconscious:true},{departure:{}},{routed:true}])assert.ok(dialogueReason(state,actor,{...civilian,...change}));
 assert.ok(dialogueReason(state,actor,civilian,{visible:false}));assert.ok(dialogueReason(state,actor,civilian,{busy:true}));assert.ok(dialogueReason({...state,phase:'enemy'},actor,civilian));assert.ok(dialogueReason({...state,phase:'interrupt'},actor,civilian));
});
test('an enemy can give one reply during combat while authored conversation waits for exploration',()=>{
 const combat={...state,mode:'combat'};assert.equal(dialogueReason(combat,actor,{...civilian,side:'enemy'}),null);assert.ok(dialogueReason(combat,actor,{...civilian,dialogue:'special'}));assert.equal(dialogueReason({...combat,status:'victory'},actor,{...civilian,dialogue:'special'}),null);
});
test('ambient replies vary without changing battle RNG, inventory or conversation state',()=>{
 const b=createBattle([],{enemies:[],exploration:true}),before=structuredClone(b);const npc={...civilian,greeting:'El paso está abierto.'};assert.equal(new Set(Array.from({length:4},(_,i)=>ambientReply(npc,i))).size,4);assert.match(ambientReply({...civilian,side:'enemy',surrendered:true}),/arma|resistirme|vida/);assert.match(ambientReply({...civilian,ai:{activity:'hiding'}}),/refugio|fuego|salvo/);assert.deepEqual(b,before);
});
test('J selects talk without changing reload, mount or native input shortcuts',()=>{assert.equal(tacticalShortcut({key:'j'}),'talk');assert.equal(tacticalShortcut({key:'r'}),'reload');assert.equal(tacticalShortcut({key:'t'}),'mount');assert.equal(tacticalShortcut({key:'j'},{editing:true}),null);assert.match(targetingHelp('talk',actor),/Hablar/);});
