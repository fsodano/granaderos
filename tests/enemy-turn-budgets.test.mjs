import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,actionPointBudget,artilleryCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const tiles=()=>Array.from({length:320},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0}));
const actor=(s,id)=>s.units.find(u=>u.id===id);
function field(request={}){
 const b=createBattle((request.squad??[{id:'p'}]).map(u=>({...u,x:1,y:1,agility:95})),{...request,width:40,height:8,tiles:tiles(),
  enemies:[{id:'leader',x:7,y:1,weapon:1809,medical:0,patrol:false},
   {id:'helper',x:35,y:6,weapon:0,blade:0,activeSlot:'unarmed',weaponDropped:true,medical:0,loaded:0,ammo:0,patrol:false}],seed:45});
 b.units[0].ap=20;actor(b,'leader').ap=24;actor(b,'helper').ap=7;
 return b;
}
const restore=b=>validateBattleSnapshot(JSON.parse(JSON.stringify(b)));

test('first contact preserves paid AP and issues every enemy budget before the first interruption',()=>{
 const before=field(),paused=endTurn(before);
 assert.equal(paused.phase,'interrupt');assert.equal(paused.enemyTurn.budgetsIssued,true);assert.equal(paused.enemyTurn.unitIndex,0);
 assert.equal(actor(paused,'leader').ap,16);assert.equal(actor(paused,'helper').ap,7,'initial contact AP must not be replenished');
 assert.equal(paused.elapsedSeconds,6);assert.deepEqual(before.units.map(u=>u.ap),[20,24,7]);
});

test('a later enemy phase issues the helper budget before its individual slot and does not issue it again',()=>{
 const before=field();before.turn=2;before.enemyTurns=1;
 const expected=actionPointBudget(before,actor(before,'helper')).total,paused=endTurn(before);
 assert.equal(paused.phase,'interrupt');assert.equal(paused.enemyTurn.unitIndex,0);assert.equal(actor(paused,'helper').ap,expected);
 assert.equal(paused.enemyTurn.budgetsIssued,true);const resumed=endTurn(restore(paused));
 assert.equal(resumed.phase,'player');assert.equal(actor(resumed,'helper').ap,expected);assert.equal(resumed.elapsedSeconds,paused.elapsedSeconds);
});

test('a saved legacy queue preserves the active budget and initializes only actors that have not started',()=>{
 const paused=endTurn(field());paused.turn=2;paused.enemyTurns=1;
 for(const id of paused.interrupt.unitIds)actor(paused,id).reactionTurn=2;
 delete paused.enemyTurn.budgetsIssued;
 const current=actor(paused,'leader').ap,expected=actionPointBudget(paused,actor(paused,'helper')).total;
 const resumed=endTurn(restore(paused));assert.equal(resumed.phase,'player');assert.equal(actor(resumed,'leader').ap,current);
 assert.equal(actor(resumed,'helper').ap,expected);assert.equal(resumed.elapsedSeconds,paused.elapsedSeconds);
});

test('an already issued saved queue retains spent helper AP through a full campaign save and interruption resume',()=>{
 let campaign=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'month'});assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'attack',sector:'buenos_aires'});assert.equal(campaign.lastError,null);
 let battle=endTurn(field(campaign.pendingBattle));assert.equal(battle.phase,'interrupt');
 // Valid later-round continuation: all budgets are issued, and the waiting
 // helper has only seven points left. The resumed queue must honor that debt.
 battle.turn=2;battle.enemyTurns=1;for(const id of battle.interrupt.unitIds)actor(battle,id).reactionTurn=2;
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.equal(saved.battle.enemyTurn.budgetsIssued,true);
 const resumed=endTurn(saved.battle);assert.deepEqual(resumed,endTurn(pair.battle));assert.equal(actor(resumed,'helper').ap,7);
 assert.equal(actor(resumed,'leader').ap,actor(battle,'leader').ap);assert.equal(resumed.elapsedSeconds,battle.elapsedSeconds);
});

test('saved budget markers reject malformed values without changing legacy admission',()=>{
 const paused=endTurn(field());assert.doesNotThrow(()=>restore(paused));
 const legacy=structuredClone(paused);delete legacy.enemyTurn.budgetsIssued;assert.doesNotThrow(()=>restore(legacy));
 for(const value of [false,0,1,'true',null,{},[]]){const bad=structuredClone(paused);bad.enemyTurn.budgetsIssued=value;assert.throws(()=>restore(bad));}
});

test('a real wounded cannon crew keeps its second-round shared expenditure through a saved interruption',()=>{
 let battle=createBattle([{id:'p',x:2,y:6,facing:4,agility:100,experienceLevel:10}],{width:20,height:10,
  tiles:Array.from({length:200},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
  // Finite field fixture: a cannon that needs sixty points per crew member,
  // and two wounded operators whose normal budgets cannot complete it once.
  enemies:[{id:'leader',x:1,y:2},{id:'helper',x:2,y:2}].map(u=>({...u,facing:4,hp:20,maxHp:100,bandaged:80,energy:30,fatigue:90,medical:0,loaded:0,ammo:0,blade:0,patrol:false})),
  artillery:[{id:'gun',type:'bronze4',side:'enemy',x:2,y:3,loaded:false,ammo:3}],seed:45});
 const rate=artilleryCosts(battle,actor(battle,'leader'),battle.artillery[0]).reload,spent={leader:0,helper:0};
 for(let round=0;round<3;round++){
  const budgets=Object.fromEntries(['leader','helper'].map(id=>[id,round?actionPointBudget(battle,actor(battle,id)).total:actor(battle,id).ap]));
  const paused=endTurn(battle);assert.equal(paused.phase,'interrupt');assert.equal(paused.enemyTurn.unitIndex,0);assert.equal(paused.enemyTurn.budgetsIssued,true);
  for(const id of ['leader','helper'])spent[id]+=budgets[id]-actor(paused,id).ap;
  assert.equal(spent.leader,spent.helper);assert.equal(paused.artillery[0].ammo+Number(paused.artillery[0].loaded),3);
  if(round<2){assert.equal(paused.artillery[0].loaded,false);assert.ok(paused.artillery[0].reloadProgress>0);assert.equal(actor(paused,'helper').ap,0);}
  const saved=restore(paused);battle=endTurn(saved);assert.deepEqual(battle,endTurn(paused));
  assert.equal(battle.phase,'player');assert.equal(actor(battle,'helper').ap,actor(paused,'helper').ap,'the later helper slot cannot replace spent shared AP');
  assert.equal(battle.elapsedSeconds,paused.elapsedSeconds);assert.equal(battle.turn,round+2);
 }
 assert.deepEqual(spent,{leader:rate,helper:rate});assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,2);assert.equal(battle.artillery[0].reloadProgress,undefined);
});
