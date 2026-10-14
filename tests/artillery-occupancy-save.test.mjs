import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {ARTILLERY_OCCUPANCY_VERSION,initializeArtilleryOccupancy} from '../game/artillery-occupancy.js';
import {sameCell,tacticalLevel,spaceKey} from '../game/tactical-space.js';
import {issuedBattery} from './stationed-artillery-fixture.mjs';

// Existing declared finite battery fixture: public paid deployment only, no
// native battle, earned gzip or historical victory is used for this save gate.
let template;
function pair(){
 if(!template){const campaign=issuedBattery(),battle=enterSector(campaign.pendingBattle);template=decodeSave(encodeSave(campaign,battle));}
 return structuredClone(template);
}
const people=b=>[...b.units,...b.npcs].filter(p=>(p.hp??100)>0&&!p.departure&&!p.fled);
const point=p=>({x:p.x,y:p.y,tacticalLevel:tacticalLevel(p)});
function withoutMigrationFields(b){
 const n=structuredClone(b);delete n.artilleryOccupancyVersion;
 for(const p of people(n)){delete p.x;delete p.y;delete p.tacticalLevel;}
 return n;
}
function legacyPair(){
 const p=pair(),gun=p.battle.artillery[0],operator=p.battle.units.find(u=>u.side==='player'&&u.hp>0);
 delete p.battle.artilleryOccupancyVersion;Object.assign(operator,{x:gun.x,y:gun.y});return p;
}

test('a legacy official full pair clears only the overlapping living coordinates and remains deterministic and idempotent',()=>{
 const legacy=legacyPair(),before=structuredClone(legacy),raw=encodeSave(legacy.campaign,legacy.battle),first=decodeSave(raw),second=decodeSave(raw);
 assert.deepEqual(first,second);assert.deepEqual(first.campaign,legacy.campaign);assert.equal(first.battle.artilleryOccupancyVersion,ARTILLERY_OCCUPANCY_VERSION);
 assert.deepEqual(first.battle.artillery,legacy.battle.artillery,'physical gun identity, coordinates, load, reserve and custody stay exact');
 assert.deepEqual(withoutMigrationFields(first.battle),withoutMigrationFields(legacy.battle),'HP, AP, clock, ammunition, RNG, outcome and every non-coordinate field stay exact');
 const moved=legacy.battle.units.find(u=>u.side==='player'&&u.hp>0),actual=first.battle.units.find(u=>u.id===moved.id),gun=first.battle.artillery[0];
 assert.equal(sameCell(actual,gun),false);assert.equal(tacticalLevel(actual),tacticalLevel(moved));assert.ok(Math.hypot(actual.x-moved.x,actual.y-moved.y)>0&&Math.hypot(actual.x-moved.x,actual.y-moved.y)<=1.5);
 for(const old of people(legacy.battle).filter(p=>p.id!==moved.id))assert.deepEqual(people(first.battle).find(p=>p.id===old.id),old);
 assert.equal(new Set([...people(first.battle),...first.battle.artillery].map(spaceKey)).size,people(first.battle).length+first.battle.artillery.length);
 assert.deepEqual(decodeSave(encodeSave(first.campaign,first.battle)),first);assert.deepEqual(legacy,before,'official save admission does not mutate its caller');
});

test('a current-version overlap and a future occupancy version are rejected by official paired save admission',()=>{
 for(const version of [ARTILLERY_OCCUPANCY_VERSION,ARTILLERY_OCCUPANCY_VERSION+1]){
  const bad=legacyPair();bad.battle.artilleryOccupancyVersion=version;const before=structuredClone(bad);
  assert.throws(()=>decodeSave(encodeSave(bad.campaign,bad.battle)),version===ARTILLERY_OCCUPANCY_VERSION?/casilla de un cañón/:/versión de ocupación/);assert.deepEqual(bad,before);
 }
});

test('a legacy pair with no legal adjacent clearance rejects instead of moving the gun or searching farther away',()=>{
 const bad=legacyPair(),gun=bad.battle.artillery[0];
 for(const tile of bad.battle.tiles)if(Math.max(Math.abs(tile.x-gun.x),Math.abs(tile.y-gun.y))===1)Object.assign(tile,{type:'water',blocked:true});
 const before=structuredClone(bad);assert.throws(()=>decodeSave(encodeSave(bad.campaign,bad.battle)),/casilla libre adyacente/);assert.deepEqual(bad,before);
});

test('legacy civilian clearance is same-level, coordinate-only, and does not alter dead bodies',()=>{
 const width=10,height=8,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 const baseline=createBattle([{id:'p',x:1,y:1},{id:'old-body',x:4,y:3,hp:0,unconscious:true}],{width,height,tiles,enemies:[],exploration:true,deferContact:true,npcs:[{id:'civilian',name:'Vecino',x:3,y:3}],artillery:[{id:'gun',type:'swivel',side:'player',x:4,y:3,loaded:true,ammo:2}]});
 const legacy=validateBattleSnapshot(baseline);delete legacy.artilleryOccupancyVersion;Object.assign(legacy.npcs[0],point(legacy.artillery[0]));
 const body=structuredClone(legacy.units.find(u=>u.id==='old-body'));
 const before=structuredClone(legacy),restored=validateBattleSnapshot(legacy),npc=restored.npcs[0];
 assert.equal(sameCell(npc,restored.artillery[0]),false);assert.equal(tacticalLevel(npc),0);assert.ok(Math.hypot(npc.x-4,npc.y-3)<=1.5);
 assert.deepEqual(withoutMigrationFields(restored),withoutMigrationFields(legacy));assert.deepEqual(restored.units.find(u=>u.id==='old-body'),body);assert.deepEqual(restored.artillery,legacy.artillery);assert.deepEqual(legacy,before);
 assert.deepEqual(validateBattleSnapshot(restored),restored);
});

test('failed legacy clearance plans are atomic even when an earlier overlap had a free neighbor',()=>{
 const width=10,height=8,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 const b=createBattle([{id:'a',x:1,y:1},{id:'z',x:7,y:5}],{width,height,tiles,enemies:[],exploration:true,deferContact:true,artillery:[{id:'first',type:'swivel',side:'player',x:2,y:2,loaded:true,ammo:2},{id:'last',type:'swivel',side:'player',x:7,y:5,loaded:false,ammo:1}]});
 delete b.artilleryOccupancyVersion;Object.assign(b.units[0],point(b.artillery[0]));Object.assign(b.units[1],point(b.artillery[1]));
 for(const tile of b.tiles)if(Math.max(Math.abs(tile.x-7),Math.abs(tile.y-5))===1)Object.assign(tile,{type:'water',blocked:true});
 const before=structuredClone(b);assert.throws(()=>initializeArtilleryOccupancy(b),/casilla libre adyacente/);assert.deepEqual(b,before);
});
