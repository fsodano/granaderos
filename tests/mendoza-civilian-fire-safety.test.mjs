import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,firearmFlightPreview,firearmShotOptions} from '../game/tactical.js';
import {knownCivilianFireRisk,knownRouteShotSafety} from './route-fire-safety.mjs';
import {northernCombatOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {coastalCommandOrder} from './coastal-command-driver.mjs';

function lane(npcs=[]){
 return createBattle([{id:'shooter',x:2,y:3,weapon:1802,loaded:1,ammo:2,stance:'prone',marksmanship:100,dexterity:100,agility:100}],{
  width:22,height:12,seed:45,tiles:Array.from({length:264},(_,i)=>({x:i%22,y:Math.floor(i/22),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',x:8,y:3,hp:100,stance:'standing',patrol:false,overwatch:false}],npcs,
 });
}
test('a hidden civilian cannot change clear public northern fire selection',()=>{
 const clear=lane(),hidden=lane([{id:'private',x:5,y:3,hp:100,stance:'standing',roomId:'unrevealed'}]),before=structuredClone(hidden);
 const unit=b=>b.units.find(u=>u.id==='shooter');
 const expected=northernCombatOrder(clear,unit(clear));assert.equal(expected?.type,'fire');
 assert.deepEqual(northernCombatOrder(hidden,unit(hidden)),expected);assert.deepEqual(hidden,before);
});
