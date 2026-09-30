import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {applyCivilianHarm,advanceCivilianBleeding,civilianIncidents} from '../game/civilian-harm.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const actor={id:'player',name:'Soldado',side:'player',x:1,y:1};
const scene=npc=>createBattle([actor],{width:8,height:8,exploration:true,enemies:[],npcs:[npc]});

test('scene creation retains an existing civilian wound, its bandages and its actual attacker through saved bleeding',()=>{
 const resident={id:'resident',name:'Vecina',x:2,y:1,hp:90,energy:100,civilianWoundVersion:1,bleeding:0,bandaged:10};
 applyCivilianHarm({units:[actor]},resident,{source:actor,damage:30,intentional:true});
 const before=structuredClone(resident),battle=scene(resident),npc=battle.npcs[0];
 assert.deepEqual(resident,before,'loading the scene does not change the supplied resident');
 assert.equal(npc.hp,60);assert.equal(npc.bleeding,2);assert.equal(npc.bandaged,10);
 assert.deepEqual(npc.bleedSource,before.bleedSource);assert.equal(npc.bleedSource.side,'player');
 assert.deepEqual(civilianIncidents(npc),civilianIncidents(before));assert.ok(validateBattleSnapshot(battle));
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
 advanceCivilianBleeding(restored,restored.npcs[0],1);
 assert.equal(restored.npcs[0].hp,58);assert.equal(restored.npcs[0].bleeding,2);
 assert.deepEqual(restored.npcs[0].bleedSource,before.bleedSource);assert.ok(validateBattleSnapshot(restored));
});

test('scene residents with a smaller health scale start at that scale and existing health remains unchanged on reentry',()=>{
 const battle=scene({id:'resident',name:'Vecina',x:2,y:1,maxHp:80});
 assert.equal(battle.npcs[0].hp,80);assert.equal(battle.npcs[0].maxHp,80);assert.ok(validateBattleSnapshot(battle));
 const existing=structuredClone(battle.npcs[0]);existing.hp=40;existing.energy=0;existing.unconscious=true;
 const reentry=scene(existing);assert.deepEqual(reentry.npcs[0],existing);assert.ok(validateBattleSnapshot(reentry));
});
