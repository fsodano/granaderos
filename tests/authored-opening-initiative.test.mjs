import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,initializeBattlePerception} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const encounter={width:10,height:6,seed:45,
 tiles:Array.from({length:60},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),
 enemies:[{id:'enemy',x:7,y:1,weapon:1803,ammo:0,fatigue:100,marksmanship:100}]};

test('an authored ambush spends the actual enemy opening before player orders',()=>{
 const squad=[{id:'player',x:1,y:1}],ordinary=createBattle(squad,encounter),ambush=createBattle(squad,{...encounter,firstSide:'enemy'});
 assert.equal(ordinary.elapsedSeconds,0);
 assert.equal(ordinary.units[0].hp,100);
 assert.equal(ordinary.units[1].loaded,1);
 assert.equal(ambush.roundFirstSide,'enemy');
 assert.equal(ambush.enemyFirstAwaitingPlayer,true);
 assert.equal(ambush.elapsedSeconds,6);
 assert.ok(ambush.units[0].hp>0&&ambush.units[0].hp<ordinary.units[0].hp);
 assert.equal(ambush.units[1].loaded,0);
 assert.ok(ambush.units[1].ap<ordinary.units[1].ap);
});

test('restoring sight on a saved ambush does not repeat its shot, clock or AP issue',()=>{
 const battle=createBattle([{id:'player',x:1,y:1}],{...encounter,firstSide:'enemy'});
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),before=structuredClone(restored);
 const resumed=initializeBattlePerception(restored);
 assert.deepEqual(resumed,before);
 assert.equal(resumed.units[1].loaded,0);
 assert.equal(resumed.enemyFirstAwaitingPlayer,true);
});
