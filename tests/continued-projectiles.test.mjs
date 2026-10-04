import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,firearmFlightPreview,shotChance,weaponFor,teamCanSee} from '../game/tactical.js';
import {projectileFlight,firearmRay} from '../game/projectile-cover.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {civilianIncidents} from '../game/civilian-harm.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const field=(patch={},extra={})=>createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1801,marksmanship:1,ammo:2,condition:100,...patch}],{width:40,height:12,seed:45,tiles:Array.from({length:480},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[{id:'e',name:'Objetivo',x:7,y:3,morale:100,patrol:false,overwatch:false}],...extra});
const body=(s,patch={})=>{const u={...structuredClone(s.units[0]),id:'friend',name:'Compañero',x:9,y:3,...patch};s.units.push(u);return u;};
const fire=(s,extra={})=>actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim:0,...extra});
const missedScene=s=>({...s,units:s.units.filter(u=>u.id!=='e')});
const wall=(s,x,material='stone')=>Object.assign(s.tiles.find(t=>t.x===x&&t.y===3),{type:'wall',blocked:true,blocksSight:false,material,obstacleHeight:2});

test('a fixed seeded miss continues beyond its scatter cell and pays the ordinary finite shot costs',()=>{
 const s=field();body(s);const before=structuredClone(s),n=fire(s),clean=field(),miss=fire(clean);
 assert.equal(n.lastError,null);assert.equal(n.units[1].hp,100);assert.ok(n.units[2].hp<100);
 assert.equal(n.units[0].ap,89);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].ammo,s.units[0].ammo);assert.equal(n.units[0].condition,99);assert.equal(n.elapsedSeconds,6);
 for(const key of ['ap','loaded','ammo','condition','lastShotPosition','lastTargetId'])assert.deepEqual(n.units[0][key],miss.units[0][key],key);
 assert.deepEqual(s,before);assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))),n);
 const ray=projectileFlight(missedScene(s),s.units[0],{x:8,y:3,stance:'standing'},weaponFor(s.units[0]));
 assert.equal(ray.victimId,'friend');close(ray.impact.x,8.5);close(ray.impact.height,1.4+(1.1-1.4)*7.5/7);
});

test('a successful location shot can hit beyond an empty chosen cell and stops at that first body',()=>{
 const s=field({marksmanship:100});s.units[1].x=9;body(s,{id:'behind',x:12});const n=actBattle(s,{type:'firePoint',unitId:'p',x:7,y:3,aim:4});
 assert.equal(n.lastError,null);assert.ok(n.units[1].hp<100);assert.equal(n.units[2].hp,100);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].ap,69);assert.equal(n.elapsedSeconds,6);
 const hit=field({marksmanship:100});body(hit);const direct=fire(hit,{aim:4});assert.ok(direct.units[1].hp<100);assert.equal(direct.units[2].hp,100,'an actual target impact stops the bullet');
});

test('cover beyond the aim cell reduces or stops the same missed ray before its first body',()=>{
 const clear=field();body(clear);const wood=structuredClone(clear),stone=structuredClone(clear),after=structuredClone(clear);wall(wood,8,'wood');wall(stone,8);wall(after,12);
 const a=fire(clear),b=fire(wood),c=fire(stone),d=fire(after);
 assert.ok(b.units[2].hp>a.units[2].hp&&b.units[2].hp<100);assert.equal(c.units[2].hp,100);assert.equal(d.units[2].hp,a.units[2].hp);
 assert.notEqual(b.seed,a.seed,'the clear ball can roll body passage; after wood its remaining force cannot pass the body');
 for(const n of [a,b,c,d]){assert.equal(n.units[0].ap,89);assert.equal(n.units[0].loaded,0);assert.equal(n.elapsedSeconds,6);}
 const path=projectileFlight(missedScene(wood),wood.units[0],{x:8,y:3,stance:'standing'},weaponFor(wood.units[0]));
 assert.equal(path.obstacles[0].material,'wood');close(path.damageFactor,(52-24)/52);assert.equal(path.victimId,'friend');
});

test('the separate flight range preserves farther legal aim points and clips at every world edge',()=>{
 const s=field(),a=s.units[0],weapon={damage:52,range:5};s.units=s.units.slice(0,1);
 const short=projectileFlight(s,a,{x:7,y:3,stance:'standing'},weapon);assert.equal(short.termination,'range');close(short.impact.x,1+5*COMBAT_BALANCE.firearmFlightRangeMultiplier);
 body(s,{x:12});assert.equal(projectileFlight(s,a,{x:7,y:3,stance:'standing'},weapon).victimId,null);
 const far=projectileFlight(s,a,{x:16,y:3,stance:'standing'},weapon);assert.equal(far.victimId,'friend','existing farther aiming is not cut at the effective range');
 s.units=s.units.slice(0,1);Object.assign(a,{x:20,y:6});
 for(const point of [{x:21,y:6},{x:19,y:6},{x:20,y:7},{x:20,y:5},{x:21,y:7}]){
  const ray=firearmRay(s,a,{...point,stance:'standing'},{damage:52,range:100},'torso',{destinationHeight:1.4});
  assert.equal(ray.termination,'edge');assert.ok(ray.destination.x>=-.5&&ray.destination.x<=s.width-.5);assert.ok(ray.destination.y>=-.5&&ray.destination.y<=s.height-.5);
 }
});

test('a descending ray stops at solid ground and cannot hit a person below or beyond it',()=>{
 const s=field();s.units=s.units.slice(0,1);body(s,{x:6});
 const flight=projectileFlight(s,s.units[0],{x:4,y:3,stance:'prone'},weaponFor(s.units[0]),'torso',{destinationHeight:.2});
 assert.equal(flight.blocked,true);assert.equal(flight.termination,'ground');assert.equal(flight.victimId,null);close(flight.impact.x,4.5);close(flight.impact.height,0);assert.equal(flight.obstacles.at(-1).kind,'ground');
 const raised=field();raised.units=raised.units.slice(0,1);Object.assign(raised.tiles.find(t=>t.x===8&&t.y===3),{elevation:2});body(raised,{x:9});
 const uphill=projectileFlight(raised,raised.units[0],{x:7,y:3,stance:'standing'},weaponFor(raised.units[0]));assert.equal(uphill.termination,'ground');assert.equal(uphill.victimId,null);close(uphill.impact.x,7.5);
});

test('a real floor beyond the aim point stops an elevated continuation without inventing a supporting roof',()=>{
 const s=field({tacticalLevel:1});s.units=s.units.slice(0,1);body(s,{x:10,tacticalLevel:0});
 s.upperSurfaces=[{id:'source',x:1,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0},{id:'aim',x:7,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0},{id:'later',x:9,y:3,tacticalLevel:1,elevation:4.1,type:'floor',kind:'roof',blocked:false,cover:0}];
 const flight=projectileFlight(s,s.units[0],{x:8,y:3,tacticalLevel:1,stance:'standing'},weaponFor(s.units[0]),'torso',{destinationHeight:4.1});
 assert.equal(flight.termination,'slab');assert.equal(flight.victimId,null);assert.equal(flight.obstacles.at(-1).tacticalLevel,1);close(flight.impact.x,8.5);close(flight.impact.height,4.4+(4.1-4.4)*7.5/7);
 assert.equal(s.upperSurfaces.some(t=>t.x===8),false);assert.ok(flight.destination.height<4.1,'the original descending slope continues rather than aiming at a later floor');
});

test('continuation retains diagonal corner cover but does not hit a corner-touching body',()=>{
 const s=field({x:1,y:1});s.units=s.units.slice(0,1);body(s,{id:'corner',x:4,y:3});body(s,{id:'ahead',x:5,y:5});
 const target={x:3,y:3,stance:'standing'},weapon=weaponFor(s.units[0]);assert.equal(projectileFlight(s,s.units[0],target,weapon).victimId,'ahead');
 Object.assign(s.tiles.find(t=>t.x===4&&t.y===3),{type:'wall',material:'stone',blocked:true});const stopped=projectileFlight(s,s.units[0],target,weapon);assert.equal(stopped.blocked,true);assert.equal(stopped.victimId,null);
});

test('a missed selected soldier excludes only that soldier and can strike a distinct same-ID civilian',()=>{
 const s=field({}, {npcs:[{id:'e',name:'Vecino',x:9,y:3,hp:100}]});const n=fire(s);
 assert.equal(n.lastError,null);assert.equal(n.units[1].hp,100);assert.ok(n.npcs[0].hp<100);assert.equal(civilianIncidents(n.npcs[0])[0].intentional,false);
 const reverse=field({}, {enemies:[{id:'e',x:9,y:3,morale:100,patrol:false,overwatch:false}],npcs:[{id:'e',name:'Elegido',x:7,y:3,hp:100}]});const other=fire(reverse,{targetKind:'npc'});
 assert.equal(other.lastError,null);assert.equal(other.npcs[0].hp,100);assert.ok(other.units[1].hp<100);
});

test('a known downstream bystander is warned and hidden same-ID bodies cannot affect previews or visible effects',()=>{
 const s=field();body(s);const before=structuredClone(s),risk=firearmBystanderRisk(s,s.units[0],s.units[1]);assert.equal(risk.scatter[0].id,'friend');assert.equal(risk.direct[0].id,'friend');assert.deepEqual(s,before);
 const hidden=field({}, {npcs:[{id:'e',name:'Secreto',x:9,y:3,hp:100}]});Object.assign(hidden.tiles.find(t=>t.x===8&&t.y===3),{type:'wall',material:'wood',blocked:true,blocksSight:true,obstacleHeight:.8});
 const empty=structuredClone(hidden);empty.npcs=[];assert.equal(teamCanSee(hidden,'player',hidden.units[1]),true);assert.equal(teamCanSee(hidden,'player',hidden.npcs[0]),false);
 assert.equal(shotChance(hidden,hidden.units[0],hidden.units[1]),shotChance(empty,empty.units[0],empty.units[1]));assert.deepEqual(firearmFlightPreview(hidden,hidden.units[0],hidden.units[1]),firearmFlightPreview(empty,empty.units[0],empty.units[1]));
 assert.deepEqual(firearmBystanderRisk(hidden,hidden.units[0],hidden.units[1]),firearmBystanderRisk(empty,empty.units[0],empty.units[1]));
 const action={type:'fire',unitId:'p',targetId:'e',aim:0},r=presentedActBattle(hidden,action),clean=presentedActBattle(empty,action);assert.ok(r.state.npcs[0].hp<100);
 const shot=frames=>frames.find(f=>f.type==='projectile').shotVisual;assert.deepEqual(shot(r.frames),shot(clean.frames));
 for(const frame of r.frames){assert.ok(!frame.impacts.some(i=>i.victimKind==='npc'));assert.ok(!JSON.stringify(frame.shotVisual??{}).includes('Secreto'));}
 Object.assign(hidden.units[0],{side:'enemy'});Object.assign(hidden.units[1],{side:'player'});Object.assign(empty.units[0],{side:'enemy'});Object.assign(empty.units[1],{side:'player'});
 assert.deepEqual(chooseEnemyAction(hidden,hidden.units[0]),chooseEnemyAction(empty,empty.units[0]),'enemy decisions remain limited to their observation');
});

const hiddenProneScene=wallX=>{
 const s=field({weapon:1800,marksmanship:100,stance:'prone',movementMode:'prone'},{enemies:[{id:'e',name:'Guardia visible',x:15,y:3,stance:'prone',movementMode:'prone',patrol:false,overwatch:false,morale:100}],npcs:[{id:'hidden',name:'Vecino oculto',x:12,y:3,stance:'prone',hp:100}]});
 Object.assign(s.tiles.find(t=>t.x===12&&t.y===3),{type:'forest',cover:100,concealment:100});wall(s,wallX);
 return s;
};

test('an unseen interception before a known wall retains the exact observed cover cue and ordinary result',()=>{
 const s=hiddenProneScene(13),empty=structuredClone(s);empty.npcs=[];
 assert.equal(teamCanSee(s,'player',s.units[1]),true);assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
 const action={type:'fire',unitId:'p',targetId:'e',aim:4},before=structuredClone(s),actual=actBattle(s,action),r=presentedActBattle(s,action),clean=presentedActBattle(empty,action);
 assert.deepEqual(r.state,actual);assert.deepEqual(clean.state,actBattle(empty,action));assert.deepEqual(s,before);
 assert.equal(actual.npcs[0].hp,60);assert.equal(actual.units[1].hp,100);assert.equal(clean.state.units[1].hp,100);assert.equal(actual.units[0].loaded,0);assert.equal(actual.elapsedSeconds,6);
 for(const type of ['projectile','impact']){
  const shown=r.frames.find(f=>f.type===type),baseline=clean.frames.find(f=>f.type===type);
  assert.deepEqual(shown.shotVisual,baseline.shotVisual);assert.equal(shown.shotVisual.outcome,'cover');assert.equal(shown.shotVisual.material,'stone');
  close(shown.shotVisual.impact.x,12.5);close(shown.shotVisual.impact.height,.25+(.2-.25)*11.5/14);assert.deepEqual(shown.impacts,[]);
  assert.equal(shown.shotVisual.victimId,undefined);assert.equal(shown.shotVisual.victimKind,undefined);
 }
});

test('unseen body passage admits only the later real known-person injury and retains knowledge-only terminal cover',()=>{
 const s=hiddenProneScene(16),action={type:'fire',unitId:'p',targetId:'e',aim:4},r=presentedActBattle(s,action);
 assert.equal(teamCanSee(s,'player',s.npcs[0]),false);assert.deepEqual(r.state,actBattle(s,action));assert.equal(r.state.npcs[0].hp,60);assert.equal(r.state.units[1].hp,63);
 const admitted=r.frames.flatMap(frame=>frame.impacts);assert.ok(admitted.some(hit=>hit.unitId==='e'&&hit.damage===37));assert.ok(admitted.every(hit=>hit.unitId==='e'&&hit.victimKind!=='npc'));
 for(const frame of r.frames)if(frame.shotVisual){assert.notEqual(frame.shotVisual.victimId,'hidden');assert.ok(frame.shotVisual.impact.x>14&&frame.shotVisual.impact.x<16);if(frame.shotVisual.material){assert.equal(frame.shotVisual.material,'stone');assert.equal(frame.shotVisual.outcome,'cover');assert.deepEqual(frame.impacts,[]);}}
});
