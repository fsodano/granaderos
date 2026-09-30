import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,canSee,getReachable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {equipmentSlots,orderDescriptors,targetPreview} from '../game/ja2-hud.js';
const field=(extra={})=>createBattle([{id:'p',x:2,y:3,facing:2}],{width:40,height:8,seed:45,tiles:Array.from({length:320},(_,i)=>({x:i%40,y:Math.floor(i/40),type:i%40===18?'wall':'grass',blocked:i%40===18,blocksSight:i%40===18,cover:0})),enemies:[{id:'e',x:37,y:3,patrol:false,overwatch:false}],...extra});

test('automatic exploration preserves the last quiet turn through a validated save and does not advance extra time',()=>{
 let s=endTurn(field());assert.equal(s.quietCombatTurns,1);assert.equal(s.mode,'combat');assert.equal(s.elapsedSeconds,6);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));const next=endTurn(saved);
 assert.deepEqual(next,endTurn(s));assert.equal(next.mode,'exploration');assert.equal(next.turn,3);assert.equal(next.elapsedSeconds,12);assert.equal(next.sectorCleared,false);
 assert.equal(next.units[0].ammo,s.units[0].ammo);assert.equal(next.units[1].hp,s.units[1].hp);
 const before=structuredClone(next.units[0]);s=actBattle(next,{type:'move',unitId:'p',x:4,y:3});assert.equal(s.lastError,null);assert.equal(s.units[0].ap,before.ap);assert.ok(s.units[0].energy<before.energy);assert.ok(s.elapsedSeconds>next.elapsedSeconds);
});
test('a sighting during a round resets both quiet turns even when contact is lost before end-turn',()=>{
 let s=endTurn(field());assert.equal(s.quietCombatTurns,1);
 s.units[1].x=7;s=actBattle(s,{type:'look',unitId:'p',x:8,y:3});assert.equal(s.lastError,null);assert.equal(s.contactThisRound,true);assert.equal(s.quietCombatTurns,0);
 s.units[1].x=37;assert.equal(canSee(s,s.units[0],s.units[1]),false);
 s=endTurn(s);assert.equal(s.quietCombatTurns,0);assert.equal(s.mode,'combat');
 s=endTurn(s);assert.equal(s.quietCombatTurns,1);assert.equal(s.mode,'combat');
 s=endTurn(s);assert.equal(s.mode,'exploration');
});
test('enemy-first initiative counts complete rounds and does not rest after its automatic return to exploration',()=>{
 let s=field();s.roundFirstSide='enemy';
 s=endTurn(s);assert.equal(s.enemyFirstAwaitingPlayer,true);assert.equal(s.quietCombatTurns,0);assert.equal(s.turn,1);
 s=endTurn(s);assert.equal(s.quietCombatTurns,1);assert.equal(s.mode,'combat');assert.equal(s.turn,2);
 s=endTurn(s);assert.equal(s.mode,'exploration');assert.equal(s.turn,3);assert.equal(s.elapsedSeconds,12);assert.equal(s.enemyFirstAwaitingPlayer,undefined);assert.equal(s.enemyTurn,undefined);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('invalid saved contact counters are rejected',()=>{
 const s=field();for(const value of [-1,3,NaN,.5,'1'])assert.throws(()=>validateBattleSnapshot({...s,quietCombatTurns:value}));
 for(const value of [1,null,'true'])assert.throws(()=>validateBattleSnapshot({...s,contactThisRound:value}));
});
test('exploration action, equipment and target costs show zero AP',()=>{
 const s=field({exploration:true}),u=s.units[0];u.ap=1;u.loaded=0;
 assert.ok(equipmentSlots(s,u).every(slot=>slot.pa===0));
 assert.ok(orderDescriptors(s,u).filter(d=>d.pa!==undefined).every(d=>d.pa===0));
 assert.equal(targetPreview(s,u,{x:4,y:3},{mode:'move',reachable:getReachable(s,u)}).pa,0);
 const n=actBattle(s,{type:'reload',unitId:'p'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,1);assert.equal(n.units[0].ammo,u.ammo-1);assert.equal(targetPreview(s,u,null,{mode:'fire'}).pa,0);
});
