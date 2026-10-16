import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,interruptAvailable,maxActionPoints} from '../game/tactical.js';
import {canSee,stanceCost,movementStepCost,movementEnergy,climbPreview,presentedEndTurn} from '../game/tactical.js';
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

// Fresh declared subsystem geometry; no captured campaign or tactical state.
// The existing legacy campaign helper supplies only a real paired-save context.
test('an autonomous refused climb cannot poison a later routed-enemy interrupt',()=>{
 let campaign=dispatchCampaign(initialCampaign(45),{type:'travel',sector:'buenos_aires'});
 assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'attack',sector:'san_nicolas'});
 assert.equal(campaign.lastError,null);assert.equal(campaign.pendingBattle.squad.length,3);
 const common={maxHp:100,hp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,shock:0,morale:80,
  weapon:1800,loaded:1,ammo:4,condition:100,jammed:false,activeSlot:'primary',medkits:0,medical:0,
  inventory:{},rations:0,torches:0,boleadoras:0,strength:75,dexterity:50,traits:[],
  routed:false,stance:'standing',movementMode:'walk',mounted:false,horse:false};
 const posts=[
  {name:'Observador',x:2,y:5,tacticalLevel:0,facing:2,agility:100,wisdom:100,experienceLevel:10},
  {name:'Guardia del acceso',x:5,y:4,tacticalLevel:1,facing:0,agility:1,wisdom:1,experienceLevel:1},
  {name:'Retén',x:1,y:7,tacticalLevel:0,facing:2,agility:1,wisdom:1,experienceLevel:1},
 ];
 const players=campaign.pendingBattle.squad.map(({id,abilities},index)=>({...common,id,...(abilities===undefined?{}:{abilities:structuredClone(abilities)}),...posts[index]}));
 const enemies=[
  {...common,id:'climber',name:'Perseguidor',x:5,y:5,tacticalLevel:0,facing:2,agility:50,wisdom:50,experienceLevel:4,
   weapon:1809,loaded:0,ammo:0,patrol:false},
  {...common,id:'runner',name:'Realista en retirada',x:8,y:5,tacticalLevel:0,facing:4,agility:50,wisdom:50,experienceLevel:4,
   weapon:1809,loaded:0,ammo:0,patrol:false,overwatch:false,routed:true,morale:0,fleePath:[]},
 ];
 const upperSurfaces=[{id:'landing',x:5,y:4,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0}];
 const climbLinks=[{id:'access',kind:'climb',from:{x:5,y:5,tacticalLevel:0},to:{x:5,y:4,tacticalLevel:1}}];
 const initial=createBattle(players,{...campaign.pendingBattle,width:12,height:8,tiles:tiles(),enemies,
  upperSurfaces,climbLinks,artillery:[],props:[],groundItems:[],buildings:[],seed:45,firstSide:'player',hour:campaign.hour});
 const original=structuredClone(initial),body=(state,id)=>state.units.find(unit=>unit.id===String(id));
 const observerId=String(players[0].id),guardId=String(players[1].id),climber=body(initial,'climber');
 assert.equal(initial.phase,'player');assert.equal(initial.status,'active');assert.equal(initial.mode,'combat');
 assert.equal(canSee(initial,climber,body(initial,guardId)),true,'standing on the edge earns the enemy actual roof contact');
 assert.equal(canSee(initial,body(initial,observerId),climber),true,'the refused enemy action is legitimately observable');
 const posture={type:'stance',unitId:guardId,stance:'prone'},posturePA=stanceCost(body(initial,guardId),'prone');
 const ready=actBattle(initial,posture);assert.equal(ready.lastError,null);assert.equal(ready.phase,'player');
 assert.equal(body(ready,guardId).ap,body(initial,guardId).ap-posturePA);assert.ok(posturePA>0);
 assert.equal(body(ready,guardId).stance,'prone');assert.equal(ready.elapsedSeconds,6);assert.equal(ready.seed,initial.seed);
 assert.deepEqual(body(ready,'climber').lastKnownEnemy,{x:5,y:4,tacticalLevel:1,turn:1});
 assert.ok(ready.units.filter(unit=>unit.side==='player').every(unit=>!canSee(ready,body(ready,'climber'),unit)),
  'the actual prone landing occupant is hidden; no current contact replaces the earned roof memory');
 const before=structuredClone(ready),step={x:8,y:6,tacticalLevel:0},runner=body(ready,'runner');
 const retreatPA=movementStepCost(ready,runner,runner,step),retreatEnergy=movementEnergy(runner,ready.tiles.find(tile=>tile.x===step.x&&tile.y===step.y));
 assert.ok(retreatPA>0&&retreatPA<=runner.ap);assert.ok(retreatEnergy>0&&retreatEnergy<runner.energy);
 const physical=state=>state.units.map(unit=>Object.fromEntries(['id','maxHp','hp','bleeding','bandaged','weapon','activeSlot','loaded','ammo','condition','medkits','inventory','rations','torches','boleadoras'].map(key=>[key,structuredClone(unit[key])])));
 const paused=endTurn(ready);
 // Raw reads only until lastError is proved null. A baseline failure must not
 // feed a failed snapshot into visibility, validation, codec or continuation.
 assert.deepEqual(initial,original);assert.deepEqual(ready,before);assert.deepEqual(physical(paused),physical(ready));
 assert.equal(paused.phase,'interrupt');assert.equal(paused.status,'active');assert.equal(paused.turn,1);
 assert.deepEqual(paused.interrupt,{side:'player',unitIds:[observerId],enemyId:'runner'});
 assert.equal(paused.enemyTurn.unitIndex,1);assert.equal(paused.enemyTurn.started,true);assert.equal(paused.enemyTurn.actionsTaken,0);
 assert.equal(paused.log.filter(line=>line==='El acceso está bloqueado.').length,1,'the first enemy really attempted and was denied the occupied climb');
 for(const key of ['x','y','tacticalLevel','ap','energy','stance'])assert.equal(body(paused,'climber')[key],body(ready,'climber')[key],key);
 for(const key of ['x','y','tacticalLevel','ap','energy','stance'])assert.equal(body(paused,guardId)[key],body(ready,guardId)[key],key);
 assert.deepEqual({x:body(paused,'runner').x,y:body(paused,'runner').y,tacticalLevel:body(paused,'runner').tacticalLevel},step);
 assert.equal(body(paused,'runner').ap,runner.ap-retreatPA);assert.equal(body(paused,'runner').energy,runner.energy-retreatEnergy);
 assert.equal(body(paused,'runner').routed,true);assert.equal(body(paused,'runner').departure,undefined);
 assert.equal(body(paused,observerId).ap,body(ready,observerId).ap);assert.equal(body(paused,observerId).reactionTurn,1);
 assert.equal(paused.elapsedSeconds,ready.elapsedSeconds);assert.equal(paused.seed,ready.seed);
 assert.equal(paused.lastError,null,JSON.stringify({phase:paused.phase,interrupt:paused.interrupt,enemyTurn:paused.enemyTurn,
  units:paused.units.map(({id,x,y,tacticalLevel,ap,energy,routed})=>({id,x,y,tacticalLevel,ap,energy,routed})),log:paused.log}));
 assert.deepEqual(endTurn(actBattle(initial,posture)),paused,'the complete fresh paid prefix is deterministic');
 assert.deepEqual(presentedEndTurn(ready).state,paused,'browser presentation must return the same admitted Native interrupt');assert.deepEqual(ready,before);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),paused);
 const paired=syncBattleTime(campaign,paused);assert.equal(paired.error,null);
 const restored=decodeSave(encodeSave(paired.campaign,paired.battle));assert.deepEqual(restored.battle,paired.battle);
 const pairedBefore=structuredClone(paired),restoredBefore=structuredClone(restored),continued=endTurn(paired.battle),savedContinued=endTurn(restored.battle);
 assert.equal(continued.lastError,null);assert.equal(savedContinued.lastError,null);assert.deepEqual(savedContinued,continued);
 assert.deepEqual(paired,pairedBefore);assert.deepEqual(restored,restoredBefore);assert.deepEqual(physical(continued),physical(paused));
 assert.equal(continued.phase,'player');assert.equal(continued.turn,2);assert.equal(continued.elapsedSeconds,paused.elapsedSeconds);
 assert.equal(continued.seed,paused.seed);assert.equal(continued.enemyTurn,undefined);assert.equal(continued.interrupt,undefined);
 assert.equal(body(continued,'runner').departure.edge,'S');assert.equal(body(continued,'runner').fled,true);
 assert.deepEqual({x:body(continued,'climber').x,y:body(continued,'climber').y,tacticalLevel:body(continued,'climber').tacticalLevel},{x:5,y:5,tacticalLevel:0});
 assert.deepEqual({x:body(continued,guardId).x,y:body(continued,guardId).y,tacticalLevel:body(continued,guardId).tacticalLevel},{x:5,y:4,tacticalLevel:1});
});


test('an actual player climb into an occupied landing remains an atomic public refusal',()=>{
 const common={maxHp:100,hp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,shock:0,morale:80,
  weapon:1800,loaded:1,ammo:4,condition:100,jammed:false,activeSlot:'primary',medkits:0,medical:0,
  inventory:{},rations:0,torches:0,boleadoras:0,strength:75,dexterity:50,agility:75,wisdom:50,experienceLevel:4,
  traits:[],abilities:[],routed:false,mounted:false,horse:false};
 const initial=createBattle([
  {...common,id:'climber',name:'Trepador',x:5,y:5,tacticalLevel:0,facing:0,stance:'standing',movementMode:'walk'},
  {...common,id:'occupant',name:'Guardia del acceso',x:5,y:4,tacticalLevel:1,facing:0,stance:'prone',movementMode:'prone'},
 ],{width:12,height:8,tiles:tiles(),seed:45,exploration:true,enemies:[],
  upperSurfaces:[{id:'landing',x:5,y:4,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0}],
  climbLinks:[{id:'access',kind:'climb',from:{x:5,y:5,tacticalLevel:0},to:{x:5,y:4,tacticalLevel:1}}]});
 const before=structuredClone(initial),action={type:'climb',unitId:'climber',linkId:'access'},quote=climbPreview(initial,initial.units[0],action);
 assert.equal(quote.valid,false);assert.equal(quote.reason,'El acceso está bloqueado.');
 const refused=actBattle(initial,action);
 // This is intentionally an error result. Only raw assertions follow it.
 assert.equal(refused.lastError,'El acceso está bloqueado.');assert.equal(refused.log.at(-1),refused.lastError);
 assert.deepEqual(refused.units,initial.units);assert.deepEqual(refused.upperSurfaces,initial.upperSurfaces);assert.deepEqual(refused.climbLinks,initial.climbLinks);
 for(const key of ['phase','mode','status','turn','elapsedSeconds','seed'])assert.equal(refused[key],initial[key],key);
 assert.deepEqual(initial,before);
});
