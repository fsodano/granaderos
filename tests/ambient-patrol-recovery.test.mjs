import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,endTurn,canSee,movementEnergy} from '../game/tactical.js';
import {maximumEnergy} from '../game/fatigue.js';
import {sameCell,tacticalLevel,surfaceAt} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const tiles=()=>Array.from({length:400},(_,i)=>({x:i%40,y:Math.floor(i/40),type:i%40===18?'wall':'grass',blocked:i%40===18,blocksSight:i%40===18,obstacleHeight:i%40===18?10:0,cover:0}));
const roof=()=>Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:24+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0}));
const field=(enemy={},extra={})=>createBattle([{id:'p',x:1,y:1}],{width:40,height:10,tiles:tiles(),seed:45,exploration:true,enemies:[{id:'a',x:26,y:4,overwatch:false,...enemy}],...extra});
const guard=s=>s.units.find(u=>u.side==='enemy');
const tick=s=>{const n=actBattle(s,{type:'ambient'});assert.equal(n.lastError,null);return n;};
const physical=u=>({x:u.x,y:u.y,tacticalLevel:tacticalLevel(u)});

test('a real 600-second Buenos Aires wait cannot exhaust unseen enemy patrols',()=>{
 let campaign=initialCampaign(8);
 for(const id of [128,142,123,115,131,110]){campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'day'});assert.equal(campaign.lastError,null);}
 campaign=dispatchCampaign(campaign,{type:'attack',sector:'buenos_aires'});assert.equal(campaign.lastError,null);
 const b=enterSector(campaign.pendingBattle),before=structuredClone(b),rested=actBattle(b,{type:'rest'});
 assert.equal(b.units.filter(u=>u.side==='player').length,6);assert.ok(b.upperSurfaces.length>0);
 assert.equal(rested.lastError,null);assert.equal(rested.mode,'exploration');assert.equal(rested.elapsedSeconds,600);
 const enemies=rested.units.filter(u=>u.side==='enemy');assert.equal(enemies.length,4);
 assert.ok(enemies.some(u=>!sameCell(u,b.units.find(v=>v.id===u.id))));
 for(const u of enemies){
  assert.ok(u.energy>=maximumEnergy(u)/2,`${u.id} retains a breath reserve`);
  assert.ok(u.energy<100,'patrolling still consumes energy');
  assert.equal(u.unconscious,false);assert.equal(u.hp,100);
  assert.ok(rested.units.filter(v=>v.side==='player').every(v=>!canSee(rested,v,u)&&!canSee(rested,u,v)));
 }
 for(const u of rested.units){const original=b.units.find(v=>v.id===u.id);for(const key of ['hp','ap','loaded','ammo','medkits','fatigue'])assert.equal(u[key],original[key],`${u.id}: ${key}`);}
 assert.ok(rested.units.filter(u=>u.side==='player').every(u=>u.energy===76));
 // An equal amount of ordinary ambient time gives guards the same movement
 // and recovery. The player's wait does not grant a special enemy refill.
 let stepped=b;for(let i=0;i<100;i++)stepped=tick(stepped);
 assert.deepEqual(stepped.units,rested.units);assert.equal(stepped.elapsedSeconds,600);
 assert.deepEqual(b,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(rested))),rested);
});

for(const [name,patch] of [['ground',{}],['roof',{x:25,y:4,tacticalLevel:1}]])test(`${name} patrol rests in place and then pays for movement without gaining AP`,()=>{
 const b=field({energy:49,...patch},patch.tacticalLevel?{upperSurfaces:roof()}:{});guard(b).ap=7;
 const resting=tick(b);assert.deepEqual(physical(guard(resting)),physical(guard(b)));assert.equal(guard(resting).energy,59);assert.equal(guard(resting).ap,7);assert.equal(resting.elapsedSeconds,6);
 const moving=tick(resting);assert.ok(!sameCell(guard(moving),guard(resting)));assert.equal(guard(moving).energy,59-movementEnergy(guard(resting),surfaceAt(moving,guard(moving))));assert.equal(guard(moving).ap,7);assert.equal(moving.elapsedSeconds,12);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(moving))),moving);
});

test('fatigue caps patrol recovery and its reserve without leaving a tired guard permanently idle',()=>{
 const b=field({fatigue:85,energy:7}),resting=tick(b),moving=tick(resting);
 assert.equal(maximumEnergy(guard(b)),15);assert.equal(guard(resting).energy,15);assert.equal(guard(resting).fatigue,85);
 assert.deepEqual(physical(guard(resting)),physical(guard(b)));assert.ok(!sameCell(guard(moving),guard(resting)));assert.equal(guard(moving).energy,14);assert.equal(guard(moving).fatigue,85);
});

for(const [name,enemy,destination,cost] of [
 ['ascent',{x:23,y:4,energy:61,patrolOrigin:{x:24,y:4,tacticalLevel:1}},{x:24,y:4,tacticalLevel:1},12],
 ['descent',{x:24,y:4,tacticalLevel:1,energy:57,patrolOrigin:{x:23,y:4,tacticalLevel:0}},{x:23,y:4,tacticalLevel:0},8],
 ['fatigue-capped ascent',{x:23,y:4,energy:14,fatigue:85,patrolOrigin:{x:24,y:4,tacticalLevel:1}},{x:24,y:4,tacticalLevel:1},12],
])test(`patrol ${name} waits for its paid climb to leave enough energy in reserve`,()=>{
 const b=field(enemy,{upperSurfaces:roof(),climbLinks:[{id:'access',kind:'climb',from:{x:23,y:4,tacticalLevel:0},to:{x:24,y:4,tacticalLevel:1}}]}),resting=tick(b);
 const recovered=Math.min(maximumEnergy(guard(b)),enemy.energy+10);
 assert.deepEqual(physical(guard(resting)),physical(guard(b)));assert.equal(guard(resting).energy,recovered);
 // The ordinary patrol waypoint keeps rotating while the guard rests. Let
 // that schedule choose its next climb instead of forcing a destination.
 let moving=resting,ticks=1;while(sameCell(guard(moving),guard(b))&&ticks<5){moving=tick(moving);ticks++;}
 assert.deepEqual(physical(guard(moving)),destination);assert.equal(guard(moving).energy,recovered-cost);assert.equal(guard(moving).ap,guard(b).ap);assert.equal(moving.elapsedSeconds,ticks*6);assert.equal(guard(moving).unconscious,false);
 for(const key of ['kind','linkId','from','path'])assert.equal(guard(moving)[key],undefined);
});

test('a patrol declines climbs that meet or exceed its full energy capacity without looping or collapsing',()=>{
 for(const fatigue of [88,90]){
  const b=field({x:23,y:4,fatigue,energy:100,patrolOrigin:{x:24,y:4,tacticalLevel:1}},{upperSurfaces:roof(),climbLinks:[{id:'access',kind:'climb',from:{x:23,y:4,tacticalLevel:0},to:{x:24,y:4,tacticalLevel:1}}]});
  assert.ok(maximumEnergy(guard(b))<=12);
  const rested=actBattle(b,{type:'rest'});assert.equal(rested.lastError,null);assert.equal(rested.mode,'exploration');assert.equal(rested.elapsedSeconds,600);
  assert.deepEqual(physical(guard(rested)),physical(guard(b)));assert.equal(guard(rested).energy,maximumEnergy(guard(b)));assert.equal(guard(rested).ap,guard(b).ap);assert.equal(guard(rested).unconscious,false);
 }
});

test('recovery and resumed patrol ignore an unseen player position and survive a save',()=>{
 const b=field({energy:49}),hidden=structuredClone(b);hidden.units[0].x=2;hidden.units[0].y=8;
 let original=b,changed=hidden,saved=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
 for(let i=0;i<12;i++){
  original=tick(original);changed=tick(changed);saved=tick(saved);
  assert.deepEqual(guard(changed),guard(original));assert.deepEqual(saved,original);assert.equal(original.mode,'exploration');
 }
});

test('new contact interrupts ambient recovery and combat cannot request free recovery ticks',()=>{
 const b=createBattle([{id:'p',x:23,y:4,facing:2,experienceLevel:10,agility:100,dexterity:100,wisdom:100}],{width:40,height:10,tiles:tiles(),seed:45,exploration:true,deferContact:true,enemies:[{id:'a',x:26,y:4,facing:2,energy:49,experienceLevel:1,agility:1,wisdom:1,overwatch:false}]});
 const contact=tick(b);assert.equal(contact.mode,'combat');assert.equal(contact.phase,'player');assert.equal(guard(contact).energy,49);assert.deepEqual(physical(guard(contact)),physical(guard(b)));assert.equal(contact.elapsedSeconds,6);
 assert.deepEqual(tick(contact),contact);
 // Rest in combat remains the ordinary end-turn action, with the same AP,
 // energy and clock result; it never runs the 600-second exploration loop.
 const combat=field({energy:49,patrol:false},{exploration:false});
 const rested=actBattle(combat,{type:'rest'});assert.deepEqual(rested,endTurn(combat));assert.equal(rested.elapsedSeconds,6);assert.equal(guard(rested).energy,59);
});
