import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,canEndCombat,canSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
const map=(extra={})=>({width:28,height:8,seed:45,tiles:Array.from({length:224},(_,i)=>({x:i%28,y:Math.floor(i/28),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:25,y:5,overwatch:false}],...extra});

test('an unaware squad can be detected by an enemy and lose first initiative',()=>{
 const s=createBattle([{id:'p',x:1,y:1,facing:6,morale:100}],map({exploration:true,enemies:[{id:'e',x:6,y:1,marksmanship:100,morale:100}]}));
 assert.equal(s.mode,'combat');assert.equal(s.phase,'player');assert.equal(s.status,'defeat');assert.equal(s.turn,1);assert.equal(s.elapsedSeconds,6);
 assert.ok(s.units[0].hp<100);assert.ok(s.log.some(l=>l.includes('toma la iniciativa')));assert.equal(s.contactInitiative,undefined);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('movement stops on first observed tile even when only the enemy has sight',()=>{
 let s=createBattle([{id:'p',x:25,y:1,morale:100}],map({exploration:true,enemies:[{id:'e',x:2,y:6,facing:2,weapon:1800,marksmanship:0}]}));
 assert.equal(s.mode,'exploration');
 // Face east while moving north: the target remains west of the mover's cone.
 s.units[0].x=12;s.units[0].y=5;s.units[0].facing=0;
 s=actBattle(s,{type:'move',unitId:'p',x:12,y:1});
 assert.equal(s.lastError,null);assert.equal(s.mode,'combat');assert.equal(s.units[0].y,4);assert.equal(s.units[0].x,12);
 assert.ok(s.log.some(l=>l.includes('toma la iniciativa')));
});
test('leaving contact preserves living opponents, AP, condition, supplies and the clock',()=>{
 const s=createBattle([{id:'p',x:1,y:1}],map());s.units[0].ap=7;s.units[0].loaded=0;s.units[0].ammo=3;s.units[0].condition=42;s.quietCombatTurns=2;
 assert.equal(canEndCombat(s),true);const n=actBattle(s,{type:'explore'});
 assert.equal(n.mode,'exploration');assert.equal(n.status,'active');assert.equal(n.sectorCleared,false);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('two complete quiet turns are required; anonymous sound does not keep combat active',()=>{
 let s=createBattle([{id:'p',x:1,y:1}],map({enemies:[{id:'e',x:25,y:5,patrol:false,overwatch:false}]}));
 assert.equal(canEndCombat(s),false);assert.ok(actBattle(s,{type:'explore'}).lastError);
 s=endTurn(s);assert.equal(s.mode,'combat');assert.equal(s.quietCombatTurns,1);
 s.units[0].lastHeardNoise={x:20,y:3,turn:s.turn,kind:'fire',uncertainty:2};
 s=endTurn(s);assert.equal(s.mode,'exploration');assert.equal(s.quietCombatTurns,2);assert.equal(s.sectorCleared,false);
 assert.ok(s.units.find(u=>u.id==='e').hp>0);assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('enemy observation alone blocks an end-combat request',()=>{
 const s=createBattle([{id:'p',x:1,y:1,facing:6}],map({enemies:[{id:'e',x:6,y:1,facing:6}]}));
 assert.equal(canSee(s,s.units[0],s.units[1]),false);assert.equal(canSee(s,s.units[1],s.units[0]),true);assert.equal(canEndCombat(s),false);
});
test('an ended engagement can return to combat at the next real contact',()=>{
 let s=createBattle([{id:'p',x:1,y:1}],map());s=actBattle(s,{type:'explore'});
 s=actBattle(s,{type:'move',unitId:'p',x:15,y:1});assert.equal(s.mode,'combat');assert.equal(s.status,'active');assert.equal(s.sectorCleared,false);
 assert.ok(s.units[1].hp>0);assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('sector re-entry retains enemy condition while rebasing encounter memory and reactions',()=>{
 const request={id:'reentry',sector:'san_nicolas',squad:[{id:'p',weapon:1800}],hour:12};
 const previous=enterSector(request),enemy=previous.units.find(u=>u.side==='enemy');
 previous.turn=9;enemy.lastKnownEnemy={x:1,y:1,turn:9};enemy.lastHeardNoise={x:2,y:2,turn:9,kind:'fire',uncertainty:3};enemy.lastTargetId='p';enemy.lastShotPosition={x:enemy.x,y:enemy.y};
 Object.assign(enemy,{hp:60,energy:70,loaded:0,ammo:3,condition:42,reactionTurn:9,knockedDown:true,stance:'prone',movementMode:'prone',mounted:false});
 const next=enterSector(request,previous),retained=next.units.find(u=>u.id===enemy.id);
 assert.equal(retained.hp,60);assert.equal(retained.ammo,3);assert.equal(retained.loaded,0);assert.equal(retained.condition,42);assert.equal(retained.knockedDown,true);
 assert.equal(retained.reactionTurn,0);assert.equal(retained.lastHeardNoise,undefined);assert.equal(retained.lastTargetId,undefined);assert.ok(!retained.lastKnownEnemy||retained.lastKnownEnemy.turn===next.turn);
 assert.doesNotThrow(()=>validateBattleSnapshot(next));
});

test('visible critical enemies do not restart combat after the field is cleared',()=>{
 let s=createBattle([{id:'p',x:1,y:1,medical:80,medkits:2,hp:65,bleeding:2}],map({enemies:[{id:'e',x:3,y:1,hp:10}]}));
 assert.equal(s.status,'victory');s=actBattle(s,{type:'explore'});s=actBattle(s,{type:'weapon',unitId:'p',slot:'medical'});
 assert.equal(s.mode,'exploration');assert.equal(s.status,'active');assert.equal(s.lastError,null);
 s=actBattle(s,{type:'useItem',unitId:'p',targetId:'p'});assert.equal(s.units[0].bleeding,0);assert.equal(s.units[1].hp,10);assert.equal(s.mode,'exploration');
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
