import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,interruptAvailable,maxActionPoints} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const tiles=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
// These windows start with a melee-only enemy advance, before any attack.
const battle=(players=[{id:'p',x:1,y:1,marksmanship:100}],extra={})=>createBattle(players,{width:12,height:8,tiles:tiles(),enemies:[{id:'e',x:7,y:1,weapon:1809}],seed:45,...extra});

test('unused AP grants a player decision window without a cover button or forced shot',()=>{
 const s=battle();s.units[0].ap=20;s.units[0].overwatch=false;
 const n=endTurn(s);
 assert.equal(n.phase,'interrupt');assert.equal(n.turn,1);assert.equal(n.elapsedSeconds,6);
 assert.deepEqual(n.interrupt,{side:'player',unitIds:['p'],enemyId:'e'});
 assert.equal(n.units[0].ap,20);assert.equal(n.units[0].loaded,1);
 assert.equal(n.units[1].x,6);assert.equal(n.units[1].ap,92);
 assert.equal(interruptAvailable(n,n.units[0]),true);assert.equal(interruptAvailable(n,n.units[1]),false);
 assert.deepEqual(s.units.map(u=>u.x),[1,7]);
});
test('chosen interrupt actions spend remaining AP; resuming preserves clock and enemy progress',()=>{
 const s=battle();s.units[0].ap=20;
 // Use the tail of the enemy budget to isolate resumption from a full melee turn.
 s.units[1].ap=24;
 const paused=endTurn(s),shot=actBattle(paused,{type:'useItem',unitId:'p',targetId:'e'});
 assert.equal(paused.units[1].ap,16);assert.equal(paused.units[1].x,6);
 assert.equal(shot.lastError,null);assert.equal(shot.units[0].ap,8);assert.equal(shot.phase,'interrupt');assert.equal(shot.elapsedSeconds,6);
 assert.ok(shot.units[1].hp<100);
 const next=endTurn(shot);assert.equal(next.phase,'player');assert.equal(next.turn,2);assert.equal(next.elapsedSeconds,6);
 assert.equal(next.status,'active');assert.ok(next.units[1].ap<=paused.units[1].ap);assert.ok(next.units[1].x<=paused.units[1].x);
 assert.equal(next.units[0].carriedAP,8);assert.equal(next.units[0].ap,maxActionPoints(next,next.units[0])+8);
 assert.equal(next.interrupt,undefined);assert.equal(next.enemyTurn,undefined);
});
test('only eligible soldiers can act during an interrupt and rejection is atomic',()=>{
 const s=battle([{id:'p',x:1,y:1,agility:95},{id:'slow',x:1,y:6,agility:10,experienceLevel:1}]);
 const paused=endTurn(s);assert.deepEqual(paused.interrupt.unitIds,['p']);
 assert.equal(interruptAvailable(paused,paused.units[1]),false);
 const rejected=actBattle(paused,{type:'stance',unitId:'slow',stance:'prone'});
 assert.ok(rejected.lastError);assert.deepEqual(rejected.units,paused.units);assert.deepEqual(rejected.enemyTurn,paused.enemyTurn);assert.equal(rejected.elapsedSeconds,paused.elapsedSeconds);
});
test('a player may pass an interrupt without firing or spending an extra turn',()=>{
 const s=battle();s.units[0].ap=20;s.units[1].ap=24;s.units[1].x=4;const paused=endTurn(s);assert.equal(paused.phase,'interrupt');const next=endTurn(paused);
 assert.equal(next.phase,'player');assert.equal(next.turn,2);assert.equal(next.elapsedSeconds,6);
 assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].reactionTurn,1);
 assert.equal(next.units[1].reactionTurn,0);
});
test('an interrupt allows an equipped dressing kit and does not force gun selection',()=>{
 const s=battle([{id:'p',x:1,y:1,hp:80,bleeding:2,medical:80,agility:95,activeSlot:'medical'}]);
 s.units[0].ap=30;const paused=endTurn(s);assert.equal(paused.phase,'interrupt');
 const treated=actBattle(paused,{type:'useItem',unitId:'p',targetId:'p'});
 assert.equal(treated.lastError,null);assert.equal(treated.units[0].hp,80);assert.equal(treated.units[0].bleeding,0);assert.equal(treated.units[0].medkits,1);assert.equal(treated.units[0].ap,5);assert.equal(treated.elapsedSeconds,6);
});
test('paused enemy decisions survive full campaign save/load and resume deterministically',()=>{
 let c=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});
 c=dispatchCampaign(c,{type:'attack',sector:'san_nicolas'});assert.equal(c.lastError,null);
 const request=c.pendingBattle;
 let b=battle(request.squad.map((u,i)=>({...u,x:1,y:1+i,agility:95})),{...request,width:12,height:8,tiles:tiles(),enemies:[{id:'e',x:7,y:1,weapon:1813}],hour:c.hour});
 b=endTurn(b);assert.equal(b.phase,'interrupt');
 const pair=syncBattleTime(c,b);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(saved.battle.interrupt,b.interrupt);
 assert.deepEqual(endTurn(saved.battle),endTurn(pair.battle));
});
test('malformed interrupt continuations and player-phase enemy queues are rejected',()=>{
 const paused=endTurn(battle());assert.doesNotThrow(()=>validateBattleSnapshot(paused));
 for(const corrupt of [s=>delete s.enemyTurn,s=>s.enemyTurn.unitIndex=2,s=>s.interrupt.enemyId='missing',s=>s.interrupt.unitIds=['e'],s=>s.enemyTurn.actionsTaken=13,s=>s.phase='player',s=>s.roundTimeCharged=false]){
  const s=structuredClone(paused);corrupt(s);assert.throws(()=>validateBattleSnapshot(s));
 }
});
