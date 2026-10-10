import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createBattle,actBattle,actionCosts,firearmShotOptions,stanceCost,getReachable,teamCanSee} from '../game/tactical.js';
import {automaticOrder} from '../game/autonomous-orders.js';
import {sameCell} from '../game/tactical-space.js';
import {cuyoCrouchOrder} from './cuyo-route-driver.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=readFileSync(new URL('./fixtures/cuyo-posture-earned-care-defense-cycle.battle.json.gz',import.meta.url));
const proof=JSON.parse(readFileSync(new URL('./fixtures/cuyo-posture-earned-care-defense-cycle.provenance.json',import.meta.url)));
const raw=gunzipSync(compressed);
assert.equal(hash(compressed),proof.compressedSha256);assert.equal(hash(raw),proof.rawSha256);
const earned=JSON.parse(raw);
const finite=unit=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','loaded','ammo','ammunition','ammunitionChoice','medkits','inventory','weapon','condition'].map(key=>[key,unit[key]]));

// Declared native arena, not an earned campaign. Its one accepted stance tests
// actual AP/time payment and retained field supplies; no shot or fight runs.
test('a useful public crouched shot retains the paid contact posture',()=>{
 const width=18,height=5,state=createBattle([{id:'shooter',x:2,y:2,facing:2,weapon:1800,loaded:1,ammo:2,marksmanship:90,condition:100,stance:'standing',medkits:0}],{
  width,height,seed:45,hour:12,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),
  enemies:[{id:'contact',x:8,y:2,weapon:0,activeSlot:'unarmed',loaded:0,ammo:0,patrol:false,overwatch:false}],
 }),before=structuredClone(state),unit=state.units.find(u=>u.id==='shooter');
 const action=cuyoCrouchOrder(state,unit,{avoidCivilians:true});
 assert.deepEqual(action,{type:'stance',unitId:unit.id,stance:'crouched'});
 assert.deepEqual(state,before,'selection must leave all native fields unchanged');
 const next=actBattle(state,action),position=next.units.find(u=>u.id===unit.id),target=next.units.find(u=>u.id==='contact');
 assert.equal(next.lastError,null);assert.equal(position.stance,'crouched');
 assert.equal(position.ap,unit.ap-stanceCost(unit,'crouched'));assert.ok(next.elapsedSeconds>state.elapsedSeconds);
 assert.deepEqual(finite(position),finite(unit));assert.deepEqual(state,before);
 const costs=actionCosts(next,position,target),aim=Math.min(4,Math.floor((position.ap-costs.fire)/costs.aim));
 assert.ok(firearmShotOptions(next,position,target,aim).some(option=>option.chance>=25&&option.damageFactor>0&&!option.interveningFriendly&&!option.shots?.some(hand=>hand.interveningFriendly)));
});

for(const row of earned.states)test(`earned Córdoba ${row.originalOrder.unitId} keeps native movement after paid standing without a useful crouched shot`,()=>{
 const battle=row.battle,before=structuredClone(battle),unit=battle.units.find(u=>u.id===row.originalOrder.unitId);
 assert.deepEqual([battle.sectorId,battle.turn,battle.status,unit.tacticalLevel,unit.stance,unit.loaded,unit.ammo],['cordoba',1,'active',1,'standing',1,7]);
 assert.equal(cuyoCrouchOrder(battle,unit,{avoidCivilians:true}),null,'a loaded gun is not sufficient reason to undo the admitted standing setup');
 const action=automaticOrder(battle,unit);
 assert.equal(action?.type,'move','the unchanged native policy admits an ordinary movement step');
 const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other)),npcs:battle.npcs.filter(other=>teamCanSee(battle,unit.side,other))};
 const route=getReachable(view,unit).find(point=>sameCell(point,action));
 assert.ok(route?.path.length);assert.ok(route.cost<=unit.ap,'the movement is affordable with actual remaining AP');
 assert.deepEqual(battle,before,'the earned checkpoint and every finite quantity remain unchanged');
});
