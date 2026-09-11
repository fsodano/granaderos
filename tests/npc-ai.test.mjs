import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {advanceNpc,advanceCivilianTime,hearNpcNoise,runCivilianPhase,npcRoutes} from '../game/npc-ai.js';
import {placeBuilding} from '../game/buildings.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {choosePatrolAction} from '../game/npc-patrol.js';
import {enterSector} from '../game/world.js';
import {selectSprite,spriteCondition} from '../game/sprite-state.js';

function field(extra={}) {
  let tiles=Array.from({length:24*12},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
  const home=placeBuilding(tiles,{id:'house',x:5,y:2,width:5,height:5,doors:[{x:7,y:6}]});
  const bar=placeBuilding(home.tiles,{id:'bar',x:14,y:2,width:5,height:5,doors:[{x:16,y:6}]});
  bar.building.purpose='bar';
  return createBattle([{id:'p',x:0,y:11}],{width:24,height:12,tiles:bar.tiles,buildings:[home.building,bar.building],npcs:[{id:'c',name:'Vecina',x:8,y:9}],exploration:true,enemies:[],...extra});
}
const ai=(destination,activity='home')=>({cycle:0,wait:0,homeId:'house',activity,destination});

test('residents enter and leave their home through a closed door without crossing walls',()=>{
  const s=field(),n=s.npcs[0];n.ai=ai({x:7,y:4});
  for(let i=0;i<12&&n.ai.destination;i++){
    const before={x:n.x,y:n.y};advanceNpc(s,n);
    for(const p of n.lastMovePath){assert.equal(Math.abs(p.x-before.x)+Math.abs(p.y-before.y),1);Object.assign(before,p);assert.equal(s.tiles.find(t=>t.x===p.x&&t.y===p.y).blocked,false);}
  }
  assert.deepEqual([n.x,n.y],[7,4]);assert.equal(s.tiles.find(t=>t.x===7&&t.y===6).open,true);
  n.ai=ai({x:8,y:9},'roaming');
  for(let i=0;i<12&&n.ai.destination;i++)advanceNpc(s,n);
  assert.deepEqual([n.x,n.y],[8,9]);assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('routines visit home, work, outdoor spaces and the bar and survive JSON saving',()=>{
  let s=field();const activities=new Set(),visited=new Set();
  for(let i=0;i<100;i++){
    s.elapsedSeconds+=6;runCivilianPhase(s);activities.add(s.npcs[0].ai.activity);
    const t=s.tiles.find(t=>t.x===s.npcs[0].x&&t.y===s.npcs[0].y);if(t.roomId)visited.add(t.buildingId);
    const copy=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
    const a=structuredClone(s),b=structuredClone(copy);runCivilianPhase(a);runCivilianPhase(b);assert.deepEqual(a.npcs,b.npcs);
  }
  for(const activity of ['home','working','roaming','socializing'])assert.ok(activities.has(activity),activity);
  assert.ok(visited.has('house'));assert.ok(visited.has('bar'));
});

test('locked doors, furniture and occupants block routes; civilians never overlap',()=>{
  const s=field();s.tiles.find(t=>t.type==='door'&&t.buildingId==='house').locked=true;
  s.props=[{id:'bed',type:'bed',x:9,y:8,footprint:{width:1,height:2},blocksMovement:true}];
  s.npcs.push({id:'b',name:'Vecino',x:10,y:9});
  const routes=npcRoutes(s,s.npcs[0]);assert.equal(routes.records.has('7,4'),false);assert.equal(routes.records.has('9,9'),false);assert.equal(routes.records.has('10,9'),false);
  for(let i=0;i<40;i++){runCivilianPhase(s);assert.equal(new Set(s.npcs.map(n=>`${n.x},${n.y}`)).size,2);}
});

test('gunshots cause prone or crouched shelter, distant residents remain calm, and fear expires',()=>{
  const s=field();s.npcs.push({id:'far',name:'Lejana',x:23,y:11});
  hearNpcNoise(s,{x:6,y:9},'fire',10);
  const n=s.npcs[0];assert.equal(n.stance,'prone');assert.equal(s.npcs[1].ai,undefined);
  assert.equal(n.ai.threat.kind,'fire');assert.equal(n.ai.threat.sourceId,undefined);
  advanceNpc(s,n);assert.ok(['hiding','fleeing'].includes(n.ai.activity));
  s.elapsedSeconds=60;advanceNpc(s,n);assert.equal(n.stance,'standing');assert.equal(n.ai.threat,undefined);
  n.x=8;n.y=9;hearNpcNoise(s,{x:0,y:9},'fire',18);assert.equal(n.stance,'crouched');
});

test('real weapon fire alerts residents immediately without moving them in the player phase',()=>{
  const s=field({exploration:false,enemies:[{id:'e',x:11,y:9,patrol:false,overwatch:false}],seed:45});
  Object.assign(s.units[0],{x:4,y:9,facing:2});const before=structuredClone(s.npcs[0]);
  const n=actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim:0});
  assert.equal(n.lastError,null);assert.equal(n.npcs[0].stance,'prone');assert.deepEqual([n.npcs[0].x,n.npcs[0].y],[before.x,before.y]);
  assert.equal(s.npcs[0].ai,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('incapacitated NPCs stay put and calm residents wait for adjacent conversations',()=>{
  const s=field(),n=s.npcs[0];n.unconscious=true;advanceNpc(s,n);assert.equal(n.ai,undefined);
  n.unconscious=false;s.units[0].x=n.x-1;s.units[0].y=n.y;advanceNpc(s,n);assert.deepEqual([n.x,n.y],[8,9]);
});

test('civilian cadence is independent of splitting elapsed exploration time',()=>{
  const a=field(),b=structuredClone(a);a.elapsedSeconds=60;advanceCivilianTime(a,60);
  for(let i=0;i<20;i++){b.elapsedSeconds+=3;advanceCivilianTime(b,3);}
  assert.deepEqual(a.npcs,b.npcs);assert.equal(a.civilianTurns,10);assert.equal(b.civilianTurns,10);
});

test('player-first rounds give civilians one phase after the enemy',()=>{
  const s=field({exploration:false,enemies:[{id:'e',x:23,y:0,patrol:false}]});
  const n=endTurn(s);assert.equal(n.civilianTurns,1);assert.equal(n.enemyTurns,1);assert.equal(n.turn,2);assert.equal(n.phase,'player');
  assert.equal(s.civilianTurns,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('enemy-first rounds wait for the player before the civilian phase, including save/load',()=>{
  const s=field({exploration:false,enemies:[{id:'e',x:23,y:0,patrol:false}]});s.roundFirstSide='enemy';
  const afterEnemy=endTurn(s);assert.equal(afterEnemy.enemyTurns,1);assert.equal(afterEnemy.civilianTurns,undefined);assert.equal(afterEnemy.turn,1);assert.equal(afterEnemy.enemyFirstAwaitingPlayer,true);
  const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(afterEnemy)));
  const afterPlayer=endTurn(saved);assert.equal(afterPlayer.civilianTurns,1);assert.equal(afterPlayer.enemyTurns,2);assert.equal(afterPlayer.turn,2);assert.equal(afterPlayer.phase,'player');
  assert.deepEqual(afterPlayer,endTurn(afterEnemy));assert.doesNotThrow(()=>validateBattleSnapshot(afterPlayer));
});

test('patrols preserve combat AP and do not use unseen opponent coordinates',()=>{
  const s=field({exploration:false,enemies:[{id:'e',x:22,y:9}]});const e=s.units[1];
  const order=choosePatrolAction(s,e);assert.ok(order?.patrol);
  const other=structuredClone(s);other.units[0].x=1;other.units[0].y=10;assert.deepEqual(choosePatrolAction(other,other.units[1]),order);
  const n=endTurn(s);assert.ok(n.units[1].ap>=e.ap-24);assert.equal(n.units[1].patrolTurn,1);
});

test('NPC routines and positions persist on sector re-entry; malformed state is rejected',()=>{
  const req={id:'visit',sector:'buenos_aires',exploration:true,hour:12,squad:[{id:'p'}],npcs:[{id:'c',name:'Vecina',x:3,y:7}]};
  const s=enterSector(req);runCivilianPhase(s);const n=enterSector(req,s);
  assert.deepEqual([n.npcs[0].x,n.npcs[0].y],[s.npcs[0].x,s.npcs[0].y]);assert.equal(n.npcs[0].ai.cycle,s.npcs[0].ai.cycle);
  n.npcs[0].ai.destination={x:-1,y:0};assert.throws(()=>validateBattleSnapshot(n));
});

test('sheltering civilian sprites keep their conscious life state',()=>{
  const n={hp:100,stance:'prone'};assert.equal(spriteCondition(n),'prone');assert.equal(selectSprite(n,{moving:false},'idle','civilian').playback,'still');assert.equal(n.unconscious,undefined);
});

test('ambient ticks advance wounds and lights once, preserve combat AP, and stop in combat',()=>{
  const s=field();Object.assign(s.units[0],{hp:60,bleeding:2});
  s.lights=[{id:'torch',type:'torch',x:1,y:1,radius:4,turns:1,remainingSeconds:12}];
  const n=actBattle(s,{type:'ambient'});
  assert.equal(n.elapsedSeconds,6);assert.equal(n.units[0].hp,58);assert.equal(n.units[0].ap,s.units[0].ap);assert.equal(n.lights[0].remainingSeconds,6);assert.equal(n.civilianTurns,1);
  assert.doesNotThrow(()=>validateBattleSnapshot(n));
  const combat=field({exploration:false,enemies:[{id:'e',x:23,y:0}]});
  const stopped=actBattle(combat,{type:'ambient'});assert.equal(stopped.elapsedSeconds,0);assert.deepEqual(stopped.npcs,combat.npcs);
});

test('a patrol that discovers the player interrupts resting at its first contact',()=>{
  const tiles=Array.from({length:32*12},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}));
  const s=createBattle([{id:'p',x:1,y:5,facing:6}],{width:32,height:12,tiles,night:true,exploration:true,enemies:[{id:'enemy',x:10,y:5,traits:['night_vision'],marksmanship:0,loaded:0,ammo:0}],npcs:[]});
  assert.equal(s.mode,'exploration');const n=endTurn(s);
  assert.equal(n.mode,'combat');assert.ok(n.elapsedSeconds<600);assert.equal(n.roundFirstSide,'enemy');assert.equal(n.civilianTurns??0,0);assert.equal(n.turn,1);
  assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('NPCs do not bypass a trapped door or reveal its trap to the player',()=>{
  const s=field(),n=s.npcs[0];n.x=7;n.y=7;n.ai=ai({x:7,y:4});
  const door=s.tiles.find(t=>t.type==='door'&&t.buildingId==='house');door.trap={type:'injury',difficulty:20,armed:true,discoveredBy:[],damage:18};
  advanceNpc(s,n);assert.equal(door.open,false);assert.equal(door.trap.armed,false);assert.deepEqual(door.trap.discoveredBy,[]);assert.equal(n.hp,82);assert.equal(n.y,7);
});
