import test from 'node:test';
import assert from 'node:assert/strict';
import {projectileFlight,projectilePath,firearmRay} from '../game/projectile-cover.js';
import {projectileTrajectoryPoint,projectileTrajectorySlope,projectileTrajectoryLength} from '../game/projectile-trajectory.js';
import {COMBAT_BALANCE,penetratingFirearmDamage} from '../game/combat-balance.js';
import {shotLoadFlight,SHOT_LOAD_PATTERN} from '../game/shot-load.js';
import {createBattle,actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const flat=(width=32,height=16)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const weapon={id:1805,damage:42,range:8,loadPattern:'single'};
const source={id:'p',side:'player',x:1,y:3,hp:100};
const aim={x:10,y:5,stance:'standing'};
function arena(width=32,height=16){
 const s={width,height,tiles:flat(width,height),units:[{...source}],npcs:[],props:[]};
 wall(s,8,5);return s;
}
function wall(s,x,y,fields={}){Object.assign(s.tiles.find(t=>t.x===x&&t.y===y),{type:'wall',blocked:true,blocksSight:false,material:'stone',...fields});}
const trace=(s,w=weapon,target=aim,options={})=>projectileFlight(s,s.units[0],target,w,'torso',options);

test('one exposed stone side face redirects finite force to a real off-axis body without mutating the world or drawing RNG',()=>{
 const s=arena();s.units.push({id:'e',side:'enemy',x:12,y:4,hp:100});const before=structuredClone(s);let rolls=0;
 const f=trace(s,weapon,aim,{resolveBody:()=>{rolls++;return true;}});assert.deepEqual(s,before);assert.equal(rolls,0,'21 force cannot pass a torso');
 assert.equal(f.ricochets.length,1);assert.equal(f.segments.length,2);const bounce=f.ricochets[0],hit=f.bodyImpacts[0];
 close(bounce.impact.x,7.75);close(bounce.impact.y,4.5);close(bounce.impact.height,1.175);assert.deepEqual(bounce.normal,{x:0,y:-1,height:0});
 assert.equal(bounce.incomingImpact,42);assert.equal(bounce.remainingImpact,21);assert.equal(hit.victimId,'e');assert.equal(hit.victimKind,'unit');assert.equal(hit.hitLocation,'torso');
 close(hit.impact.x,11.5);close(hit.impact.y,11/3);close(hit.impact.height,1.05);assert.equal(hit.incomingImpact,21);assert.equal(hit.ricochetDamageReduction,.5);assert.equal(hit.coverDamageFactor,1);
 assert.equal(hit.segmentIndex,1);assert.ok(hit.distance>bounce.distance);assert.equal(f.terminal.termination,'body');
 for(const segment of f.segments)assert.deepEqual(projectileTrajectoryPoint(segment.trajectoryModel,segment.terminalFraction),segment.destination);
 const path=projectilePath(s,s.units[0],aim,weapon);assert.equal(path.blocked,true);assert.equal(path.damageFactor,0);assert.equal(path.ricochets.length,1,'cover-only forecast uses the same entry face');
});

test('normal incidence, unsupported or implicit materials, top edges and zero-depth corners do not reflect',()=>{
 const headOn=arena();headOn.units[0].y=5;const f=trace(headOn,weapon,{x:10,y:5});assert.equal(f.ricochets,undefined);assert.equal(f.terminal.blocked,true);assert.ok(f.terminal.impact.x>7.5&&f.terminal.impact.x<8.5);
 for(const fields of [{material:'wood'},{material:'adobe'},{material:undefined},{type:'door'},{type:'window'},{blocked:false}]){const s=arena();wall(s,8,5,fields);assert.equal(trace(s).ricochets,undefined,JSON.stringify(fields));}
 const top=arena();wall(top,8,5,{obstacleHeight:1.4});assert.equal(trace(top,weapon,aim,{destinationHeight:1.4}).ricochets,undefined);
 const corner=arena();wall(corner,8,5,{blocked:false});corner.units[0]={...source,x:1,y:1};wall(corner,2,1);const touched=trace(corner,weapon,{x:3,y:3});assert.equal(touched.ricochets,undefined);assert.equal(touched.obstacles.some(o=>o.sourceId==='surface:0:2,1'),false);
});

test('adjacent stone cells and overlapping hard objects cannot manufacture an exposed or ambiguous entry face',()=>{
 const joined=arena();wall(joined,8,5,{projectileResistance:1});wall(joined,8,4,{projectileResistance:1});assert.equal(trace(joined).ricochets,undefined,'the shared horizontal stone face is internal');
 const overlap=arena();overlap.props=[{id:'same-entry',type:'chest',material:'stone',x:8,y:5,obstacleHeight:2.5}];const f=trace(overlap);assert.equal(f.ricochets,undefined,'two simultaneous hard source faces are ambiguous');assert.equal(f.terminal.blocked,true);
 const footprint=arena();wall(footprint,8,5,{blocked:false});footprint.props=[{id:'stone-object',type:'chest',material:'stone',x:8,y:5,obstacleHeight:2.5,footprint:{width:3,height:2}}];const p=trace(footprint);assert.equal(p.ricochets.length,1);assert.equal(p.ricochets[0].sourceId,'prop:stone-object');close(p.ricochets[0].impact.x,7.75);
});

test('the second shallow stone face spends material depth and stops rather than granting another reflection',()=>{
 const s=arena(40,16);wall(s,17,2);const f=trace(s,{...weapon,damage:52,range:22});assert.equal(f.ricochets.length,1);assert.equal(f.segments.length,2);assert.equal(f.terminal.blocked,true);
 const stopped=f.obstacles.find(o=>o.stopped);assert.equal(stopped.sourceId,'surface:0:17,2');assert.ok(f.terminal.impact.x>16.75&&f.terminal.impact.x<17.5);assert.ok(f.terminal.impact.y<2.5);close(stopped.resistance,26);
});

test('force spent before and after reflection stays separate from cover tuning and typed body recipients',()=>{
 const s=arena(40,16);s.units.push({id:'same',side:'enemy',x:4,y:4,hp:100});s.npcs.push({id:'same',x:12,y:4,hp:100});let rolls=0;
 const f=trace(s,{...weapon,damage:150,range:22},aim,{resolveBody:()=>{rolls++;return true;}});assert.deepEqual(f.bodyImpacts.map(h=>`${h.victimKind}:${h.victimId}`),['unit:same','npc:same']);assert.equal(rolls,2);assert.equal(new Set(f.bodyImpacts.map(h=>`${h.victimKind}:${h.victimId}`)).size,f.bodyImpacts.length);
 const first=f.bodyImpacts[0],last=f.bodyImpacts[1];close(f.ricochets[0].incomingImpact,150-first.bodyResistance);close(last.incomingImpact,(150-first.bodyResistance)*.5);close(penetratingFirearmDamage(150,last,0),last.incomingImpact);assert.ok(last.bodyDamageReduction>0);assert.ok(last.ricochetDamageReduction>0);
 assert.ok(last.distance>first.distance);assert.ok(last.fraction>first.fraction);
});

test('the curve retains the original drop onset, exact height and derivative on both sides of the reflection',()=>{
 const s=arena(48,16),w={...weapon,range:3},point={x:28,y:9};const budget=Math.hypot(point.x-source.x,point.y-source.y),f=trace(s,w,point);assert.equal(f.ricochets.length,1);
 const [a,b]=f.segments;close(projectileTrajectorySlope(a.trajectoryModel,a.terminalFraction),projectileTrajectorySlope(b.trajectoryModel,0));assert.deepEqual(a.destination,b.source);assert.equal(b.trajectoryModel.dropStart,0,'the original 2R onset is already spent');
 const initialSlope=(1.1-1.4)/Math.hypot(point.x-source.x,point.y-source.y),height=distance=>1.4+initialSlope*distance-.1*Math.max(0,distance-2*w.range)**2/(4*w.range);
 for(const segment of f.segments)for(const part of [0,.5,1]){const t=segment.terminalFraction*part,d=segment.fromDistance+segment.trajectoryModel.horizontalDistance*t;close(projectileTrajectoryPoint(segment.trajectoryModel,t).height,height(d));}
 assert.equal(f.terminal.termination,'ground');assert.ok(f.terminal.distance<budget);close(f.terminal.impact.height,0);
});

test('global range and each map edge are spent once, while ground and actual roof slabs remain hard stops',()=>{
 const s=arena(32,6),first=firearmRay(s,s.units[0],aim,weapon),f=trace(s);assert.equal(first.termination,'edge');assert.equal(f.terminal.termination,'range');close(f.terminal.distance,16);assert.ok(f.terminal.distance>Math.hypot(first.destination.x-source.x,first.destination.y-source.y));
 const edge=arena(16,16),atEdge=trace(edge,{...weapon,range:22});assert.equal(atEdge.terminal.termination,'edge');close(atEdge.terminal.impact.x,15.5);assert.ok(atEdge.terminal.distance<44);
 const roof=arena();roof.units.push({id:'below',side:'enemy',x:12,y:4,hp:100});roof.upperSurfaces=[{id:'roof',x:12,y:4,tacticalLevel:1,elevation:1.2,type:'floor',kind:'roof',blocked:false,cover:0,material:'stone'}];const stopped=trace(roof);assert.equal(stopped.ricochets.length,1);assert.equal(stopped.terminal.termination,'slab');assert.equal(stopped.bodyImpacts.length,0);
});

test('post-reflection material pays exact arc length, merges one footprint and exhausts force before a later body',()=>{
 const s=arena();s.props=[{id:'wide-wood',type:'chest',x:12,y:3,footprint:{width:3,height:3},obstacleHeight:2.5}];s.units.push({id:'later',side:'enemy',x:15,y:3,hp:100});let rolls=0;
 const f=trace(s,weapon,aim,{resolveBody:()=>{rolls++;return true;}}),wood=f.obstacles.filter(o=>o.sourceId==='prop:wide-wood');assert.equal(wood.length,1);close(wood[0].resistance,21);assert.equal(f.bodyImpacts.length,0);assert.equal(rolls,0);assert.equal(f.terminal.blocked,true);
 const model=f.segments[1].trajectoryModel,entry=(11.5-model.source.x)/(model.destination.x-model.source.x);close(projectileTrajectoryLength(model,entry,f.segments[1].terminalFraction),21/24);assert.ok(f.terminal.impact.x>11.5&&f.terminal.impact.x<12.5);
});

test('each of nine finite pellets shares the one-reflection rule and its selected-load range without extra geometry RNG',()=>{
 const s=arena(),w={...weapon,id:1807,damage:75,range:6,loadPattern:'cone'},before=structuredClone(s),f=shotLoadFlight(s,s.units[0],aim,w);assert.deepEqual(s,before);assert.equal(f.pellets.length,9);close(SHOT_LOAD_PATTERN.reduce((sum,p)=>sum+p.weight,0),1);assert.ok(f.pellets.some(p=>p.flight.ricochets?.length===1));
 for(const pellet of f.pellets){assert.equal(pellet.weight,1/9);assert.ok((pellet.flight.ricochets?.length??0)<=1);for(const bounce of pellet.flight.ricochets??[]){close(bounce.incomingImpact,75/9);close(bounce.remainingImpact,75/18);}assert.ok((pellet.flight.terminal.distance??Math.hypot(pellet.flight.terminal.impact.x-source.x,pellet.flight.terminal.impact.y-source.y))<=18+1e-9);}
 const short=shotLoadFlight(s,s.units[0],aim,{...w,range:3});assert.ok(short.pellets.every(p=>(p.flight.terminal.distance??Math.hypot(p.flight.terminal.impact.x-source.x,p.flight.terminal.impact.y-source.y))<=9+1e-9));
});

test('a real finite native pistol order injures the reflected bystander with paid costs and exact ordinary presented replay',()=>{
 const s=arena();const b=createBattle([{...source,id:107,weapon:1805,loaded:1,ammo:2,condition:100,marksmanship:100}],{...s,seed:8,hour:12,enemies:[{id:'reserve',x:25,y:10,hp:100}],npcs:[{id:'resident',name:'Residente',x:12,y:4,hp:100}],deferContact:true});
 const action={type:'firePoint',unitId:'107',x:10,y:5,aim:4},u=b.units[0],before=structuredClone(b),next=actBattle(b,action);assert.equal(next.lastError,null);assert.deepEqual(b,before);assert.deepEqual(presentedActBattle(b,action).state,next);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(b))),action),next);
 assert.equal(next.npcs[0].hp,81);assert.equal(next.units[0].hp,u.hp);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].ammo,2);assert.equal(next.units[0].condition,99);assert.equal(u.ap-next.units[0].ap,19);assert.equal(next.elapsedSeconds,6);assert.equal(next.seed,1276464017);assert.equal(next.smoke.length,1);assert.equal(next.units.find(v=>v.id==='reserve').hp,100);
 assert.equal(COMBAT_BALANCE.firearmRicochetLimit,1);assert.equal(COMBAT_BALANCE.firearmRicochetForceRetention,.5);
});
