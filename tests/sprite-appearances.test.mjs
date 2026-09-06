import test from 'node:test';
import assert from 'node:assert/strict';
import {OPERATIVES} from '../game/data.js';
import {CIVIC_RECRUITS} from '../game/recruitment.js';
import {CHARACTER_PORTRAITS} from '../game/character-profile.js';
import {SPRITE_APPEARANCES,ROSTER_SPRITE_APPEARANCES,spriteAppearance} from '../game/sprite-appearances.js';

test('the complete live roster maps to shared art combinations',()=>{
 const roster=[...OPERATIVES,...CIVIC_RECRUITS];
 assert.equal(roster.length,61);
 assert.deepEqual(Object.keys(ROSTER_SPRITE_APPEARANCES).sort(),roster.map(op=>String(op.id)).sort());
 for(const op of roster)assert.ok(SPRITE_APPEARANCES[spriteAppearance(op)],op.name);
 assert.ok(new Set(roster.map(op=>spriteAppearance(op))).size<roster.length/2,'Art must be shared, not bespoke');
});

test('women and dark-skinned military and medical characters retain plausible bodies',()=>{
 for(const id of [1,8,101,107,116,120,122,126,130,135,139])assert.equal(SPRITE_APPEARANCES[spriteAppearance({id})].gender,'woman');
 for(const id of [3,7,110,119,127,133,136])assert.equal(SPRITE_APPEARANCES[spriteAppearance({id})].skin,'dark');
 assert.equal(SPRITE_APPEARANCES[spriteAppearance({id:107})].headwear,'linen-wrap');
 assert.equal(SPRITE_APPEARANCES[spriteAppearance({id:109})].clothing,'scarlet-officer');
 assert.equal(SPRITE_APPEARANCES[spriteAppearance({id:113})].clothing,'green-uniform');
 assert.equal(SPRITE_APPEARANCES[spriteAppearance({id:10})].hairColor,'auburn');
 for(const id of [118,143])assert.equal(SPRITE_APPEARANCES[spriteAppearance({id})].hairColor,'gray');
 assert.equal(SPRITE_APPEARANCES[spriteAppearance({id:120})].clothing,'burgundy-shawl');
 assert.equal(SPRITE_APPEARANCES[spriteAppearance({id:141})].hairColor,'black');
});

test('all custom portraits resolve; old saves, NPC IDs, and enemy IDs are safe',()=>{
 for(const portrait of CHARACTER_PORTRAITS){
  const style=SPRITE_APPEARANCES[spriteAppearance({id:1000,portraitId:portrait.id})];
  assert.ok(style);
  if(portrait.id.startsWith('avatar-woman'))assert.equal(style.gender,'woman');
 }
 assert.equal(spriteAppearance({id:1000}),'granadero');
 assert.equal(spriteAppearance({id:3,side:'enemy'}),'royalist');
 assert.equal(spriteAppearance({id:1},'civilian'),'civilian');
 assert.equal(spriteAppearance({id:'npc',spriteAppearance:'woman-headscarf'},'civilian'),'woman-headscarf');
 assert.equal(spriteAppearance({id:109,spriteAppearance:'missing'}),'scarlet-officer');
});

test('appearance is independent of health, stance, movement, weapon, and mount',()=>{
 for(const change of [{hp:0},{unconscious:true},{stance:'prone'},{movementMode:'run'},{mounted:true},{weaponDropped:true},{activeSlot:'blade'}]){
  assert.equal(spriteAppearance({id:107,...change}),'woman-headscarf');
 }
});
