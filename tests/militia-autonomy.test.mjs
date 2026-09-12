import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,actionCosts} from '../game/tactical.js';
import {unitCanAct} from '../game/ja2-hud.js';
import {planGroupMove} from '../game/group-movement.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {autoBandageStatus} from '../game/auto-bandage.js';
import {autoResolve} from '../game/auto-resolve.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {prepareGarrison} from '../game/garrison.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const tiles=()=>Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
const field=(players,enemies,extra={})=>createBattle(players,{width:16,height:10,tiles:tiles(),enemies,seed:45,...extra});
const physical=s=>({...s,lastError:null,log:[]});
const militia=(extra={})=>({id:'m',name:'Miliciano',militia:true,x:1,y:1,agility:100,marksmanship:100,medical:0,...extra});
const hired=(extra={})=>({id:'p',name:'Contratado',x:1,y:6,agility:10,...extra});
const enemy=(extra={})=>({id:'e',x:7,y:1,weapon:1813,overwatch:false,...extra});

test('militia cannot receive manual orders or enter a movement group; their status remains visible',()=>{
 const b=field([hired(),militia()],[],{exploration:true});
 for(const a of [{type:'fire',targetId:'e'},{type:'move',x:2,y:1},{type:'weapon',slot:'medical'},{type:'drop',item:'ammo',count:1},{type:'reload'},{type:'stance',stance:'prone'},{type:'approachLoot',x:1,y:1},{type:'useItem',targetId:'p'},{type:'exit',unitIds:['p','m'],exitId:'west'}]){
  const n=actBattle(b,{unitId:'m',...a});assert.match(n.lastError,/milicia actúa/);assert.deepEqual(physical(n),physical(b));
 }
 assert.equal(unitCanAct(b,b.units[1]),false);assert.equal(unitCanAct(b,b.units[0]),true);
 assert.equal(planGroupMove(b,{unitIds:['p','m'],anchorId:'p',x:3,y:5}).ok,false);
 const view=playerKnownBattle(b);assert.ok(view.units.some(u=>u.id==='m'&&u.militia));assert.ok(!view.orders.some(u=>u.unitId==='m'));
});

test('the autonomous garrison spends real AP and a loaded round after the enemy, without moving hired soldiers',()=>{
 const b=field([hired(),militia({agility:10})],[enemy()]);b.units[2].ap=0;
 const n=endTurn(b),m=n.units[1];assert.equal(n.lastError,null);assert.equal(n.status,'victory');assert.equal(n.turn,1);
 assert.equal(m.loaded,0);assert.equal(m.ammo,b.units[1].ammo);assert.ok(m.ap<b.units[1].ap);assert.ok(n.units[2].hp<b.units[2].hp);
 assert.deepEqual(n.units[0],b.units[0]);assert.equal(n.elapsedSeconds,6);assert.equal(n.alliedTurn,undefined);
 assert.deepEqual(n,endTurn(b));assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('automatic loading consumes finite reserve and incapacitated militia cannot act',()=>{
 const b=field([hired(),militia({loaded:0,ammo:1}),militia({id:'fallen',x:2,y:1,hp:0,loaded:0,ammo:3})],[enemy({x:15,y:9})]);
 b.units[3].ap=0;b.units[1].ap=actionCosts(b,b.units[1]).reload;
 const n=endTurn(b);assert.equal(n.units[1].loaded,1);assert.equal(n.units[1].ammo,0);assert.equal(n.units[1].carriedAP,0);
 assert.equal(n.units[2].hp,0);assert.equal(n.units[2].ammo,3);assert.equal(n.units[2].loaded,0);assert.equal(n.elapsedSeconds,6);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('a militia-only interrupt acts automatically with the remaining budget, without a new turn',()=>{
 const b=field([hired(),militia()],[enemy()]);b.units[0].ap=0;b.units[1].ap=20;b.units[2].ap=24;
 const n=endTurn(b);assert.equal(n.status,'victory');assert.equal(n.phase,'player');assert.equal(n.turn,1);assert.equal(n.elapsedSeconds,6);
 assert.equal(n.units[1].reactionTurn,1);assert.equal(n.units[1].ap,8);assert.equal(n.units[1].loaded,0);assert.equal(n.units[1].ammo,12);
 assert.equal(n.interrupt,undefined);assert.equal(n.alliedTurn,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('a mixed interrupt retains hired control after automatic militia action and saves its spent budget',()=>{
 const b=field([hired({x:1,y:2,agility:100,experienceLevel:10}),militia()],[enemy({hp:300,maxHp:300})]);
 b.units[0].ap=40;b.units[1].ap=20;b.units[2].ap=24;
 const n=endTurn(b);assert.equal(n.phase,'interrupt');assert.equal(n.units[0].ap,40);assert.equal(n.units[0].loaded,1);
 assert.equal(n.units[1].loaded,0);assert.ok(n.units[1].ap<=8);assert.ok(n.interrupt.militiaActions.m>0);
 assert.deepEqual(playerKnownBattle(n).interrupt.unitIds,['p']);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.deepEqual(endTurn(saved),endTurn(n));
 const failed=actBattle(n,{type:'reload',unitId:'m'});assert.ok(failed.lastError);assert.deepEqual(physical(failed),physical(n));
});

function interruptedGarrison(startEnemyAfter=false){
 const b=field([militia({agility:30,weapon:1813}),{id:'c',x:1,y:5,agility:90,experienceLevel:9},{id:'57',x:12,y:7,facing:2,agility:100,experienceLevel:10}],
  [{id:'b',x:7,y:1,agility:70,weapon:1813},{id:'d',x:9,y:7,facing:6,agility:100,experienceLevel:10}]);
 // A saved boundary immediately after the enemy phase, before militia move.
 if(startEnemyAfter)b.roundFirstSide='enemy';
 b.alliedTurn={unitIds:['m'],unitIndex:0,actionsTaken:0,startEnemyAfter};b.roundTimeCharged=true;b.elapsedSeconds=6;b.enemyTurns=1;
 validateBattleSnapshot(b);return endTurn(b);
}
test('a militia move can trigger an enemy reaction and a hired interrupt, then resume the same militia queue',()=>{
 const b=interruptedGarrison();assert.equal(b.phase,'interrupt');assert.deepEqual(b.interrupt.unitIds,['c']);assert.equal(b.alliedTurn.actionsTaken,1);
 assert.equal(b.reactionStack[0].resumePhase,'player');assert.equal(b.units[0].x,2);assert.equal(b.elapsedSeconds,6);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(b))),n=endTurn(saved);assert.deepEqual(n,endTurn(b));
 assert.equal(n.phase,'player');assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,6);assert.equal(n.alliedTurn,undefined);assert.equal(n.reactionStack,undefined);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('corrupt militia queues and reaction work cannot be resumed',()=>{
 const b=interruptedGarrison();
 for(const corrupt of [s=>s.alliedTurn.unitIds=['c'],s=>s.alliedTurn.unitIds=['m','m'],s=>s.alliedTurn.unitIndex=1,s=>s.alliedTurn.actionsTaken=13,s=>s.alliedTurn.startEnemyAfter='yes',s=>s.alliedTurn.startEnemyAfter=true,s=>s.roundTimeCharged=false,s=>s.interrupt.militiaActions={c:1}]){
  const n=structuredClone(b);corrupt(n);assert.throws(()=>validateBattleSnapshot(n));
 }
});

test('hired medics and supply transfers still support militia; automatic bandaging cannot command militia doctors',()=>{
 let b=field([hired({x:1,y:2,medical:80,activeSlot:'medical'}),militia({hp:80,bleeding:2,medical:80})],[],{exploration:true});
 b=actBattle(b,{type:'useItem',unitId:'p',targetId:'m'});assert.equal(b.lastError,null);assert.equal(b.units[1].hp,80);assert.equal(b.units[1].bleeding,0);
 b=actBattle(b,{type:'transfer',unitId:'p',targetId:'m',item:'ammo',count:2});assert.equal(b.lastError,null);assert.equal(b.units[0].ammo,10);assert.equal(b.units[1].ammo,14);
 b.units[0].medical=0;b.units[0].bleeding=1;assert.equal(autoBandageStatus(b).available,false);
});

test('automatic battles use the autonomous militia phase and conserve ammunition',()=>{
 const result=autoResolve({id:'garrison-only',sector:'retiro',squad:[],garrison:[militia({entryReason:'resident'})],enemies:[enemy({hp:30,maxHp:30})],seed:45,hour:12},field([militia()],[enemy({hp:30,maxHp:30})]),{maxRounds:3});
 assert.equal(result.battle.status,'victory');assert.equal(result.actions,0,'no manual militia orders are issued by the auto-resolve driver');
 const m=result.battle.units.find(u=>u.militia);assert.ok(m.loaded+m.ammo<13);assert.doesNotThrow(()=>validateBattleSnapshot(result.battle));
});

test('an interrupted militia turn survives a complete campaign save and synchronizes time once',()=>{
 let c=initialCampaign();c.hour=12;c.sectors.retiro.militia=[1,0,0];prepareGarrison(c,'retiro');c=dispatchCampaign(c,{type:'visitSector'});assert.equal(c.lastError,null);
 const r=c.pendingBattle;
 const soldiers=[{...r.garrison[0],x:1,y:1,agility:30,weapon:1813,loaded:0,medical:0},
  {...r.squad[0],x:1,y:5,agility:90,experienceLevel:9},{...r.squad[1],x:12,y:7,facing:2,agility:100,experienceLevel:10},{...r.squad[2],x:1,y:9,agility:10}];
 let b=createBattle(soldiers,{...r,enemies:[{id:'b',x:7,y:1,agility:70,weapon:1813},{id:'d',x:9,y:7,facing:6,agility:100,experienceLevel:10}],exploration:false,width:16,height:10,tiles:tiles(),seed:45});
 b.alliedTurn={unitIds:[String(r.garrison[0].id)],unitIndex:0,actionsTaken:0,startEnemyAfter:false};b.roundTimeCharged=true;b.elapsedSeconds=6;b.enemyTurns=1;b=endTurn(b);
 assert.equal(b.phase,'interrupt');assert.equal(b.alliedTurn.actionsTaken,1);
 const pair=syncBattleTime(c,b);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle,pair.battle);
 const continued=endTurn(saved.battle);assert.deepEqual(continued,endTurn(pair.battle));
 const next=syncBattleTime(saved.campaign,continued);assert.equal(next.error,null);assert.equal(next.campaign.hour,12);assert.equal(next.campaign.secondOfHour,6);
 assert.deepEqual(decodeSave(encodeSave(next.campaign,next.battle)).battle,next.battle);
});

test('enemy-first combat gives militia one turn before advancing the next round',()=>{
 const b=field([hired(),militia()],[enemy({hp:1000,maxHp:1000})]);b.units[0].ap=0;b.units[1].ap=20;b.units[2].ap=0;
 b.roundFirstSide='enemy';b.enemyFirstAwaitingPlayer=true;b.enemyTurns=1;b.roundTimeCharged=true;b.elapsedSeconds=6;
 const n=endTurn(b);assert.equal(n.lastError,null);assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,12);
 assert.equal(n.log.filter(line=>line.includes('actúa la guarnición')).length,1);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('an enemy-first militia turn interrupted by hired control starts the next enemy round once',()=>{
 const b=interruptedGarrison(true);assert.equal(b.phase,'interrupt');assert.equal(b.alliedTurn.startEnemyAfter,true);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(b))),n=endTurn(restored);
 assert.equal(n.alliedTurn,undefined);assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,12);
 assert.ok(n.enemyTurn||n.enemyFirstAwaitingPlayer||n.status!=='active');
 assert.deepEqual(n,endTurn(b));assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
