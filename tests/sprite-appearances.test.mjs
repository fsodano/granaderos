import test from 'node:test';
import assert from 'node:assert/strict';
import {OPERATIVES} from '../game/data.js';
import {CIVIC_RECRUITS} from '../game/recruitment.js';
import {CHARACTER_PORTRAITS} from '../game/character-profile.js';
import {SPRITE_FAMILIES,SPRITE_APPEARANCE_ALIASES,SPRITE_APPEARANCES,ROSTER_SPRITE_APPEARANCES,spriteAppearance} from '../game/sprite-appearances.js';

test('the complete live roster maps to shared art combinations',()=>{
 const roster=[...OPERATIVES,...CIVIC_RECRUITS];
 assert.equal(roster.length,61);
 assert.deepEqual(Object.keys(ROSTER_SPRITE_APPEARANCES).sort(),roster.map(op=>String(op.id)).sort());
 for(const op of roster)assert.ok(SPRITE_APPEARANCES[spriteAppearance(op)],op.name);
 assert.ok(new Set(roster.map(op=>spriteAppearance(op))).size<roster.length/2,'Art must be shared, not bespoke');
});

test('consolidated bodies retain female representation and shared military bodies',()=>{
 for(const id of [1,8,101,107,116,120,122,126,130,135,139])assert.equal(SPRITE_APPEARANCES[spriteAppearance({id})].gender,'woman');
 for(const id of [3,7,110,119,127,133,136])assert.equal(spriteAppearance({id}),'granadero');

});

test('all custom portraits resolve; old saves, NPC IDs, and enemy IDs are safe',()=>{
 for(const portrait of CHARACTER_PORTRAITS){
  const style=SPRITE_APPEARANCES[spriteAppearance({id:1000,portraitId:portrait.id})];
  assert.ok(style);
  if(portrait.id.startsWith('avatar-woman'))assert.equal(style.gender,'woman');
 }
 assert.equal(spriteAppearance({id:1000}),'granadero');
 assert.equal(spriteAppearance({id:3,side:'enemy'}),'royalist');
 assert.equal(spriteAppearance({id:1},'civilian'),'surgeon');
 assert.equal(spriteAppearance({id:'npc',spriteAppearance:'woman-headscarf'},'civilian'),'woman-shawl');
 assert.equal(spriteAppearance({id:109,spriteAppearance:'missing'}),'granadero');
});

test('appearance is independent of health, stance, movement, weapon, and mount',()=>{
 for(const change of [{hp:0},{unconscious:true},{stance:'prone'},{movementMode:'run'},{mounted:true},{weaponDropped:true},{activeSlot:'blade'}]){
  assert.equal(spriteAppearance({id:107,...change}),'woman-shawl');
 }
});

test('seven families cover eight retained variants and all retired appearances resolve',()=>{
 assert.equal(Object.keys(SPRITE_FAMILIES).length,7);
 assert.equal(Object.keys(SPRITE_APPEARANCES).length,8);
 assert.deepEqual(Object.values(SPRITE_FAMILIES).flatMap(f=>f.variants).sort(),Object.keys(SPRITE_APPEARANCES).sort());
 for(const family of Object.values(SPRITE_FAMILIES))assert.ok(family.variants.includes(family.base));
 for(const [old,current] of Object.entries(SPRITE_APPEARANCE_ALIASES)){
  assert.ok(SPRITE_APPEARANCES[current]);
  assert.equal(spriteAppearance({spriteAppearance:old},'civilian'),current);
 }
 assert.equal(spriteAppearance({side:'enemy'}),'royalist');
 assert.equal(spriteAppearance({}),'granadero');
});

test('enemy military retains white uniforms even with an old allied appearance',()=>{
 for(const appearance of ['granadero','militia','blue-officer','scarlet-officer','rifleman']){
  assert.equal(spriteAppearance({side:'player',spriteAppearance:appearance}),'granadero');
  assert.equal(spriteAppearance({side:'enemy',spriteAppearance:appearance}),'royalist');
 }
 assert.equal(SPRITE_APPEARANCES.royalist.clothing,'white-uniform');
 assert.equal(SPRITE_APPEARANCES.granadero.clothing,'navy-uniform');
});
