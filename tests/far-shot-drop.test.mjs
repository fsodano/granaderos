import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,weaponFor} from '../game/tactical.js';
import {firearmRay,projectileFlight,projectilePath} from '../game/projectile-cover.js';
import {projectileTrajectory,projectileTrajectoryPoint,projectileTrajectoryIntervals,projectileTrajectoryLength,projectileTrajectoryAdvance,projectileTrajectorySamples} from '../game/projectile-trajectory.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {shotLoadFlight} from '../game/shot-load.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const field=(extra={})=>createBattle([{id:'p',x:1,y:3,facing:2,weapon:1805,marksmanship:100,ammo:2,condition:100}],{width:48,height:12,seed:11,tiles:Array.from({length:576},(_,i)=>({x:i%48,y:Math.floor(i/48),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[],...extra});
const ball={damage:200,range:1,loadPattern:'single'};
const shape=(s,point,weapon=ball,hitLocation='torso',extra={})=>firearmRay(s,s.units[0],{stance:'standing',...point},weapon,hitLocation,extra).trajectoryModel;
const screen=(id,x,width,resistance,height=3)=>({id,type:'barrels',x,y:3,footprint:{width,height:1},obstacleHeight:height,projectileResistance:resistance,blocksSight:false});
const trace=(s,point,weapon=ball,extra={})=>projectileFlight(s,s.units[0],{stance:'standing',...point},weapon,'torso',extra);
// Independent arc primitive in horizontal distance for a flat original aim.
const flatArc=s=>{const u=Math.max(0,s-2),v=.05*u;return Math.min(2,s)+.5*(u*Math.hypot(1,v)+Math.asinh(v)/.05);};

test('near shots and the exact two-range boundary preserve original geometry and seeded paid effects',()=>{
 const s=field({enemies:[{id:'e',x:8,y:3,morale:100,patrol:false,overwatch:false}]}),p=s.units[0],e=s.units[1],w=weaponFor(p),before=structuredClone(s);
 const ray=firearmRay(s,p,e,w),near=projectileFlight(s,p,e,w);
 assert.deepEqual(ray,{source:{x:1,y:3,height:1.4,tacticalLevel:0},aim:{x:8,y:3,height:1.1,tacticalLevel:0},destination:{x:17,y:3,height:1.4+(1.1-1.4)*16/7,tacticalLevel:0},termination:'range'});
 assert.equal(near.trajectory,undefined);assert.equal(near.trajectoryModel,undefined);assert.equal(near.terminal.fraction,undefined);assert.equal(near.bodyImpacts[0].hitLocation,'torso');close(near.bodyImpacts[0].impact.height,1.4+(1.1-1.4)*6.5/7);
 const edge=firearmRay(s,p,{x:17,y:3,stance:'standing'},w);assert.equal(edge.trajectoryModel,undefined);close(edge.destination.height,1.1);
 const n=actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim:4});
 assert.equal(n.lastError,null);assert.equal(n.units[0].ap,81);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].ammo,p.ammo);assert.equal(n.units[0].condition,99);assert.equal(n.elapsedSeconds,6);assert.equal(n.units[1].hp,60);assert.equal(n.seed,322324079);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{type:'fire',unitId:'p',targetId:'e',aim:4}),n);assert.deepEqual(s,before);
});

test('far selected torso and head intent use the real falling body region without changing the original aim or cap',()=>{
 const s=field({enemies:[{id:'e',x:32,y:3,morale:100,patrol:false,overwatch:false}]}),[p,e]=s.units,w=weaponFor(p),before=structuredClone(s);
 for(const [aim,region]of [['torso','legs'],['head','torso']]){
  const ray=firearmRay(s,p,e,w,aim),flight=projectileFlight(s,p,e,w,aim),hit=flight.bodyImpacts[0];
  assert.equal(ray.destination.x,e.x);assert.equal(ray.aim.height,aim==='torso'?1.1:1.6);assert.equal(hit.hitLocation,region);assert.equal(flight.hitLocation,region);assert.equal(hit.bodyResistance,COMBAT_BALANCE.firearmBodyResistance[region]);
  close(hit.impact.height,projectileTrajectoryPoint(ray.trajectoryModel,hit.fraction).height);close(hit.impact.x,31.5);assert.ok(hit.impact.height<ray.source.height+(ray.aim.height-ray.source.height)*hit.fraction);
  assert.deepEqual(flight.trajectory.at(-1),{...flight.terminal.impact,fraction:flight.terminal.fraction});
 }
 assert.deepEqual(s,before);
});

test('a falling ball can pass below an intended body and stops at exact solid ground before any body roll',()=>{
 const s=field({enemies:[{id:'e',x:32,y:3,stance:'prone',morale:100,patrol:false,overwatch:false}]}),[p,e]=s.units,w=weaponFor(p);let rolls=0;
 const ray=firearmRay(s,p,e,w),flight=projectileFlight(s,p,e,w,'torso',{resolveBody:()=>{rolls++;return true;}});
 assert.equal(flight.victimId,null);assert.deepEqual(flight.bodyImpacts,[]);assert.equal(rolls,0);assert.equal(flight.terminal.termination,'ground');assert.equal(flight.terminal.remainingImpact,0);assert.equal(flight.terminal.blocked,true);
 close(flight.terminal.impact.height,0);assert.ok(flight.terminal.impact.x<31.5);assert.ok(flight.terminal.fraction<1);close(projectileTrajectoryPoint(ray.trajectoryModel,flight.terminal.fraction).height,0);
 assert.deepEqual(flight.trajectory.at(-1),{...flight.terminal.impact,fraction:flight.terminal.fraction});assert.equal(flight.obstacles.at(-1).kind,'ground');
});

test('the exact curve clips height reentry, its turning apex, and zero-depth tangents',()=>{
 const model=projectileTrajectory({x:0,y:0,height:1,tacticalLevel:0},{x:8,y:0,height:3,tacticalLevel:0},{range:1,dropIncrement:.5}),cell={entry:0,exit:1};
 const spans=projectileTrajectoryIntervals(model,cell,1.55,1.6);assert.equal(spans.length,2);
 for(const span of spans){close(projectileTrajectoryPoint(model,span.entry).height,span===spans[0]?1.55:1.6);close(projectileTrajectoryPoint(model,span.exit).height,span===spans[0]?1.6:1.55);}
 const tangent=projectileTrajectoryIntervals(model,cell,1.625,2);assert.equal(tangent.length,1);close(tangent[0].entry,.375);close(tangent[0].exit,.375);
 assert.deepEqual(projectileTrajectoryIntervals(model,cell,1.626,2),[]);
 const constant=projectileTrajectory({x:0,y:0,height:1},{x:8,y:0,height:1},{range:1,dropIncrement:.5});const boundary=projectileTrajectoryIntervals(constant,{entry:0,exit:.25},1,1);assert.deepEqual(boundary,[{entry:0,exit:.25}]);
 assert.equal(projectileTrajectoryPoint(null,.5),null);assert.equal(projectileTrajectoryPoint(model,Infinity),null);
});

test('one object crossing the drop seam pays exact arc depth once and the original source cover exemption stays global',()=>{
 const s=field({props:[screen('wide',1,8,7)]}),point={x:9,y:3},model=shape(s,point,ball,'torso',{destinationHeight:1.4});
 const flight=trace(s,point,ball,{destinationHeight:1.4}),path=projectilePath(s,s.units[0],{...point,stance:'standing'},ball,'torso',{destinationHeight:1.4});
 const expected=7*(flatArc(7.5)-flatArc(.5));assert.equal(flight.obstacles.length,1);close(flight.obstacles[0].resistance,expected);close(path.damageFactor,(200-expected)/200);assert.deepEqual(path.obstacles,flight.obstacles);
 close(projectileTrajectoryLength(model,.5/8,7.5/8),flatArc(7.5)-flatArc(.5));assert.equal(flight.obstacles[0].sourceId,'prop:wide');close(flight.obstacles[0].fraction,.5/8);
 const extra=field({props:[screen('first',3,5,7),screen('second',4,3,11)]}),overlap=trace(extra,point,ball,{destinationHeight:1.4});
 close(overlap.obstacles[0].resistance,7*(flatArc(6.5)-flatArc(1.5)));close(overlap.obstacles[1].resistance,11*(flatArc(5.5)-flatArc(2.5)));assert.equal(overlap.obstacles.length,2);
});

test('curved material exit and reentry charge only the two real spans of the same object',()=>{
 const s=field({props:[screen('arched-path',1,11,7,2.1)]}),point={x:11,y:3},flight=trace(s,point,ball,{destinationHeight:3.4}),model=shape(s,point,ball,'torso',{destinationHeight:3.4});
 assert.equal(flight.obstacles.length,2);assert.ok(flight.obstacles.every(o=>o.sourceId==='prop:arched-path'));
 close(flight.obstacles[0].fraction,.05);close(flight.obstacles[1].fraction,.8);
 const length=projectileTrajectoryLength(model,.05,.4)+projectileTrajectoryLength(model,.8,1);close(flight.obstacles.reduce((sum,o)=>sum+o.resistance,0),7*length);
 close(flight.terminal.remainingImpact,200-7*length);assert.ok(length<projectileTrajectoryLength(model,.05,1),'the portion above the material spends no force');
});

test('an oblique falling path charges only its exact height-clipped three-dimensional material length',()=>{
 const s=field({props:[{...screen('low-screen',3,4,7,1.2),y:0,footprint:{width:4,height:8}}]});Object.assign(s.units[0],{x:1,y:1});
 const point={x:11,y:6},model=shape(s,point,ball,'torso',{destinationHeight:1.4}),flight=trace(s,point,ball,{destinationHeight:1.4});
 const entry=2+Math.sqrt((1.4-1.2)/.025),exit=5.5*Math.hypot(1,.5),obstacles=flight.obstacles.filter(o=>o.sourceId==='prop:low-screen');assert.equal(obstacles.length,1);
 close(obstacles[0].fraction,entry/Math.hypot(10,5));close(projectileTrajectoryPoint(model,obstacles[0].fraction).height,1.2);close(obstacles[0].resistance,7*(flatArc(exit)-flatArc(entry)));
 const path=projectilePath(s,s.units[0],{...point,stance:'standing'},ball,'torso',{destinationHeight:1.4});assert.deepEqual(path.obstacles,flight.obstacles);assert.equal(flight.terminal.termination,'ground');
});

test('material loss is progressive before ordered typed bodies without seam duplicates or geometry RNG',()=>{
 const s=field({props:[screen('wide',2,6,7)],enemies:[{id:'same',x:4,y:3,morale:100,patrol:false,overwatch:false}],npcs:[{id:'same',x:5,y:3,hp:100}]}),point={x:9,y:3},before=structuredClone(s),calls=[];
 const flight=trace(s,point,ball,{destinationHeight:1.4,resolveBody:hit=>{calls.push(`${hit.victimKind}:${hit.victimId}`);return true;}});
 assert.deepEqual(calls,['unit:same','npc:same']);assert.equal(flight.obstacles.length,1);assert.equal(flight.bodyImpacts.length,2);
 const first=flight.bodyImpacts[0],second=flight.bodyImpacts[1];close(first.incomingImpact,200-7*(flatArc(2.5)-flatArc(.5)));close(second.incomingImpact,200-first.bodyResistance-7*(flatArc(3.5)-flatArc(.5)));
 close(flight.terminal.remainingImpact,200-first.bodyResistance-second.bodyResistance-7*(flatArc(6.5)-flatArc(.5)));assert.deepEqual(s,before);
});

test('exact curved exhaustion inside overlapping material or at its body boundary stops before further contact',()=>{
 const point={x:11,y:3},s=field({props:[screen('screen',3,3,7)],enemies:[{id:'e',x:6,y:3,morale:100,patrol:false,overwatch:false}]}),power=7*(flatArc(4.5)-flatArc(1.5));let rolls=0;
 const exact=trace(s,point,{...ball,damage:power},{destinationHeight:1.4,resolveBody:()=>{rolls++;return true;}});
 assert.equal(exact.bodyImpacts.length,0);assert.equal(rolls,0);assert.equal(exact.terminal.remainingImpact,0);close(exact.terminal.impact.x,5.5);close(exact.obstacles[0].resistance,power);
 const positive=trace(s,point,{...ball,damage:power+1e-8},{destinationHeight:1.4});assert.equal(positive.bodyImpacts.length,1);close(positive.bodyImpacts[0].incomingImpact,1e-8,1e-11);
 const overlap=field({props:[screen('a',3,5,7),screen('b',4,3,11)]}),end=4.2,force=7*(flatArc(end)-flatArc(1.5))+11*(flatArc(end)-flatArc(2.5)),stopped=trace(overlap,point,{...ball,damage:force},{destinationHeight:1.4});
 close(stopped.terminal.impact.x,1+end);close(stopped.terminal.impact.height,1.4-.025*(end-2)**2);assert.equal(stopped.terminal.remainingImpact,0);close(stopped.obstacles.reduce((sum,o)=>sum+o.resistance,0),force);
 const model=shape(overlap,point,ball,'torso',{destinationHeight:1.4}),fraction=projectileTrajectoryAdvance(model,.15,.8,projectileTrajectoryLength(model,.15,.42));close(fraction,.42);
});

test('real upper slabs still stop a falling shot and a hard corner contact costs no penetrable material',()=>{
 const s=field();s.units[0].tacticalLevel=1;s.upperSurfaces=[{id:'source',x:1,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0},{id:'stop',x:37,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}];
 const shot=trace(s,{x:41,y:3,tacticalLevel:1},{damage:42,range:8,loadPattern:'single'},{destinationHeight:4.1});assert.equal(shot.terminal.termination,'slab');assert.equal(shot.terminal.remainingImpact,0);assert.equal(shot.terminal.impact.tacticalLevel,1);assert.ok(shot.terminal.impact.height>=2.75&&shot.terminal.impact.height<=3);assert.deepEqual(shot.bodyImpacts,[]);
 const diagonal=field();Object.assign(diagonal.units[0],{x:1,y:1});Object.assign(diagonal.tiles.find(t=>t.x===4&&t.y===3),{type:'wall',blocked:true,material:'stone',obstacleHeight:3});
 const tangent=trace(diagonal,{x:7,y:7},{damage:42,range:1,loadPattern:'single'},{destinationHeight:1.4});assert.ok(tangent.trajectoryModel);assert.deepEqual(tangent.obstacles,[]);assert.equal(tangent.terminal.remainingImpact,42);
});

test('world bounds, capped pellets and legacy cone paths do not gain extra range or far drop',()=>{
 const s=field(),p=s.units[0],target={x:32,y:3,stance:'standing'},weapon={damage:42,range:8,loadPattern:'single'};
 const capped=projectileFlight(s,p,target,weapon,'torso',{maxDistance:12});assert.equal(capped.trajectoryModel,undefined);close(capped.terminal.impact.x,13);close(capped.terminal.impact.height,1.4+(1.1-1.4)*12/31);
 const pellet=shotLoadFlight(s,p,target,{...weapon,loadPattern:'cone'});assert.equal(pellet.pellets.length,9);assert.ok(pellet.pellets.every(p=>p.flight.trajectory===undefined));for(const p of pellet.pellets)close(Math.hypot(p.flight.destination.x-1,p.flight.destination.y-3),8);
 const legacy=projectileFlight(s,p,target,{damage:42,range:8,loadPattern:'cone'});assert.equal(legacy.bodyImpacts,undefined);assert.equal(legacy.trajectoryModel,undefined);assert.equal(legacy.blocked,false);
 const ballLoad=weaponFor({...p,weapon:1807,ammunitionChoice:'ammoMusket'});assert.equal(ballLoad.range,8);assert.equal(ballLoad.loadPattern,'single');close(firearmRay(s,p,target,ballLoad).trajectoryModel.dropStart,16/31);
 const shotLoad=weaponFor({...p,weapon:1807,ammunitionChoice:'ammoShot'});assert.equal(shotLoad.range,6);assert.equal(shotLoad.loadPattern,'cone');assert.equal(projectileFlight(s,p,target,shotLoad).trajectoryModel,undefined);
 p.x=45;const edge=firearmRay(s,p,{x:46,y:3,stance:'standing'},weapon);assert.equal(edge.termination,'edge');assert.equal(edge.destination.x,47.5);assert.equal(edge.trajectoryModel,undefined);
});

test('inspection samples have bounded admitted-map allocation and never replace exact curve heights',()=>{
 const model=projectileTrajectory({x:0,y:0,height:1.4,tacticalLevel:0},{x:127.5,y:127.5,height:1.4,tacticalLevel:0},{range:1,dropIncrement:COMBAT_BALANCE.firearmFarDropIncrement}),samples=projectileTrajectorySamples(model,.99);
 assert.ok(samples.length<=1418);assert.equal(samples[0].fraction,0);assert.equal(samples.at(-1).fraction,.99);
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],mid=(a.fraction+b.fraction)/2;assert.ok(b.fraction>a.fraction);close(projectileTrajectoryPoint(model,mid).height,(a.height+b.height)/2,1e-4+1e-12);
 }
});
