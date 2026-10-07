import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {BATTLE_PLAYBACK,battleFrameDuration} from '../game/battle-playback.js';
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');

test('observed enemy steps wait for calibrated crawl travel without changing the battle',()=>{
 const before=createBattle([{id:'observer',x:1,y:1}],{width:8,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[{id:'crawler',x:3,y:3,stance:'prone',movementMode:'prone'}]});
 const after=structuredClone(before),actor=after.units.find(unit=>unit.id==='crawler');actor.x=4;actor.lastMovePath=[{x:4,y:3}];
 const frame={type:'step',unitId:'crawler',action:'move',state:after},saved=structuredClone(after),duration=presentedFrameDuration(frame,before);
 assert.equal(duration,movementStepDuration(actor,before.units.find(unit=>unit.id==='crawler'),actor,BATTLE_PLAYBACK.step));
 assert.ok(duration>4000);assert.deepEqual(after,saved);
 assert.equal(presentedFrameDuration({...frame,unitId:null},before),BATTLE_PLAYBACK.step,'An unseen step does not disclose private travel through timing');
 actor.x=7;assert.equal(presentedFrameDuration(frame,before),BATTLE_PLAYBACK.step,'A reappearing actor does not disclose its unseen route length');
});

test('recorded standing movement and attack clocks keep their existing timing',()=>{
 const before=createBattle([{id:'walker',x:1,y:1}],{width:8,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]}),after=actBattle(before,{type:'move',unitId:'walker',x:2,y:1});
 assert.equal(presentedFrameDuration({type:'step',unitId:'walker',state:after},before),BATTLE_PLAYBACK.step);
 for(const type of ['prepare','contact','projectile','impact','result']){
  const frame={type,action:'melee',unitId:'walker',state:after};assert.equal(presentedFrameDuration(frame,before),battleFrameDuration(frame));
 }
});
