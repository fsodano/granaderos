import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,weaponFor,actionCosts} from '../game/tactical.js';
import {shotLoadFlight,SHOT_LOAD_PATTERN} from '../game/shot-load.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {projectileTrajectoryPoint} from '../game/projectile-trajectory.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const field=(extra={})=>createBattle([{id:'p',x:1,y:8,facing:2,weapon:1807,loaded:1,ammo:2,condition:100,marksmanship:100,wisdom:100,dexterity:100}],{width:48,height:16,seed:45,tiles:Array.from({length:768},(_,i)=>({x:i%48,y:Math.floor(i/48),type:'grass',cover:0,blocked:false,blocksSight:false})),enemies:[],...extra});
const body=(id,x,y=8)=>({id,x,y,hp:100,maxHp:100,morale:100,patrol:false,overwatch:false});
const point={x:7,y:8,stance:'standing'};
const central=(s,weapon=weaponFor(s.units[0]),options={})=>shotLoadFlight(s,s.units[0],point,weapon,'torso',options).pellets[0].flight;
// Independent arc primitive for constant original height after the 2R onset.
const flatArc=(distance,range)=>{const onset=2*range,u=Math.max(0,distance-onset),slope=COMBAT_BALANCE.firearmFarDropIncrement/(2*range);return Math.min(distance,onset)+.5*(u*Math.hypot(1,slope*u)+Math.asinh(slope*u)/slope);};

test('nine weighted pellets preserve all near contacts and original slopes without geometry RNG',()=>{
 const s=field({enemies:[body('near',4)]}),u=s.units[0],target=s.units[1],weapon=weaponFor(u),before=structuredClone(s),load=shotLoadFlight(s,u,target,weapon);
 assert.equal(load.pelletCount,9);assert.equal(load.totalForce,weapon.damage);assert.deepEqual(load.pellets.map(p=>p.index),[0,1,2,3,4,5,6,7,8]);
 close(SHOT_LOAD_PATTERN.reduce((sum,p)=>sum+p.weight,0),1);
 for(const pellet of load.pellets){
  assert.equal(pellet.weight,1/9);
  const pattern=SHOT_LOAD_PATTERN[pellet.index],destination={...target,x:target.x,y:u.y+pattern.side*COMBAT_BALANCE.shotLoadHorizontalSpread*(target.x-u.x)};
  const old=projectileFlight(s,u,destination,{...weapon,damage:weapon.damage*pellet.weight,loadPattern:'single'},'torso',{forceBudget:weapon.damage*pellet.weight,destinationHeight:1.1+pattern.up*COMBAT_BALANCE.shotLoadVerticalSpread*(target.x-u.x),maxDistance:weapon.range,physicalHitLocation:true});
  const strip=({fraction,impact,...entry})=>entry;
  assert.deepEqual(pellet.flight.bodyImpacts.map(strip),old.bodyImpacts.map(strip));
  for(let i=0;i<old.bodyImpacts.length;i++)for(const coordinate of ['x','y','height'])close(pellet.flight.bodyImpacts[i].impact[coordinate],old.bodyImpacts[i].impact[coordinate]);
  const model=pellet.flight.trajectoryModel;assert.ok(model);
  const onset=projectileTrajectoryPoint(model,model.dropStart);
  close(onset.height,model.source.height+model.rise*model.dropStart);
  close(Math.hypot(onset.x-u.x,onset.y-u.y),2*weapon.range);
  for(const hit of pellet.flight.bodyImpacts)close(hit.incomingImpact,weapon.damage/9);
 }
 assert.deepEqual(s,before);
});

test('an actual paid point shot reaches a later body as legs on the falling central ray',()=>{
 const s=field({enemies:[body('tail',17)]}),u=s.units[0],before=structuredClone(s),weapon=weaponFor(u),flight=central(s),hit=flight.bodyImpacts[0],distance=hit.impact.x-u.x;
 const straightHeight=1.4+(1.1-1.4)*distance/(point.x-u.x),drop=COMBAT_BALANCE.firearmFarDropIncrement*(distance-2*weapon.range)**2/(4*weapon.range);
 assert.equal(hit.victimId,'tail');assert.equal(hit.hitLocation,'legs');assert.ok(straightHeight>.6);assert.ok(hit.impact.height<.6);close(hit.impact.height,straightHeight-drop);
 close(distance,15.5);close(Math.hypot(flight.destination.x-u.x,flight.destination.y-u.y),18);assert.equal(flight.terminal.termination,'body');
 const action={type:'firePoint',unitId:'p',x:point.x,y:point.y,aim:4},next=actBattle(s,action),shown=presentedActBattle(s,action);
 assert.equal(next.lastError,null);assert.equal(next.units[1].hp,94);assert.equal(next.units[1].knockedDown,false);assert.equal(next.units[0].hp,100);
 assert.equal(next.units[0].ap,u.ap-actionCosts(s,u,point).fire-4*actionCosts(s,u,point).aim);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].ammo,2);assert.equal(next.units[0].condition,99);assert.equal(next.elapsedSeconds,6);assert.equal(next.seed,2711868186);
 assert.deepEqual(shown.state,next);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),next);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);assert.deepEqual(s,before);
});

test('a horizontal prone pellet falls to exact ground before a later body or passage draw',()=>{
 const s=field({enemies:[body('past-ground',37)]});s.units[0].stance='prone';const before=structuredClone(s);let draws=0;
 const load=shotLoadFlight(s,s.units[0],{x:13,y:8,stance:'prone'},{damage:75,range:12,loadPattern:'cone'},'torso',{destinationHeight:.25,resolveBody:()=>{draws++;return true;}}),flight=load.pellets[0].flight;
 const stop=24+Math.sqrt(.25*4*12/COMBAT_BALANCE.firearmFarDropIncrement);
 assert.equal(flight.terminal.termination,'ground');assert.equal(flight.terminal.blocked,true);assert.equal(flight.terminal.remainingImpact,0);close(flight.terminal.impact.x,1+stop);close(flight.terminal.impact.height,0);assert.ok(stop>24&&stop<36);
 assert.deepEqual(flight.bodyImpacts,[]);assert.equal(draws,0);assert.deepEqual(flight.trajectory.at(-1),{...flight.terminal.impact,fraction:flight.terminal.fraction});assert.deepEqual(s,before);
});

test('the falling tail pays exact height-clipped arc depth and merges one object across the onset',()=>{
 const prop={id:'low-hay',type:'hay',x:14,y:8,footprint:{width:6,height:1},obstacleHeight:1.3,projectileResistance:3,blocksSight:false},s=field({props:[prop]}),before=structuredClone(s),flight=central(s,undefined,{destinationHeight:1.4}),range=weaponFor(s.units[0]).range;
 const entry=2*range+Math.sqrt((1.4-1.3)*4*range/COMBAT_BALANCE.firearmFarDropIncrement),length=flatArc(3*range,range)-flatArc(entry,range),receipt=flight.obstacles[0];
 assert.equal(flight.obstacles.length,1);assert.equal(receipt.sourceId,'prop:low-hay');close(receipt.fraction,entry/(3*range));close(receipt.resistance,3*length);close(flight.terminal.remainingImpact,75/9-3*length);
 const seam=field({props:[{...prop,id:'wide',x:11,footprint:{width:8,height:1},obstacleHeight:3,projectileResistance:.1}]}),crossing=central(seam,undefined,{destinationHeight:1.4});
 assert.equal(crossing.obstacles.length,1);close(crossing.obstacles[0].resistance,.1*(flatArc(17.5,range)-flatArc(9.5,range)));close(crossing.terminal.remainingImpact,75/9-crossing.obstacles[0].resistance);
 const end=17.5,force=3*(flatArc(end,range)-flatArc(entry,range)),stopped=central(s,{damage:9*force,range,loadPattern:'cone'},{destinationHeight:1.4});
 assert.equal(stopped.terminal.remainingImpact,0);assert.equal(stopped.terminal.termination,'prop');close(stopped.terminal.impact.x,1+end);close(stopped.obstacles[0].resistance,force);assert.ok(stopped.obstacles[0].stopped);assert.deepEqual(s,before);
});

test('hard roofs and map edges stop the extended pellet tail without spending another body force',()=>{
 const s=field({enemies:[body('past-roof',35)]});s.upperSurfaces=[{id:'roof',x:33,y:8,tacticalLevel:1,elevation:1.25,type:'floor',kind:'roof',blocked:false,cover:0}];let draws=0;
 const flight=shotLoadFlight(s,s.units[0],{x:13,y:8,stance:'standing'},{damage:75,range:12,loadPattern:'cone'},'torso',{destinationHeight:1.4,resolveBody:()=>{draws++;return true;}}).pellets[0].flight;
 assert.equal(flight.terminal.termination,'slab');assert.equal(flight.terminal.impact.tacticalLevel,1);assert.equal(flight.terminal.remainingImpact,0);close(flight.terminal.impact.x,1+24+Math.sqrt((1.4-1.25)*4*12/COMBAT_BALANCE.firearmFarDropIncrement));close(flight.terminal.impact.height,1.25);assert.deepEqual(flight.bodyImpacts,[]);assert.equal(draws,0);
 const edge=field();edge.units[0].x=45;const bounded=shotLoadFlight(edge,edge.units[0],{x:46,y:8,stance:'standing'},weaponFor(edge.units[0]),'torso',{destinationHeight:1.4});
 for(const p of bounded.pellets){assert.equal(p.flight.terminal.termination,'edge');close(p.flight.terminal.impact.x,47.5);assert.equal(p.flight.trajectoryModel,undefined);assert.ok(p.flight.terminal.impact.y>=-.5&&p.flight.terminal.impact.y<=15.5);assert.deepEqual(p.flight.bodyImpacts,[]);}
});

test('oblique spread keeps all nine angular slopes and uses the selected effective load range',()=>{
 const s=field();Object.assign(s.units[0],{x:10,y:3});const u=s.units[0],target={x:16,y:6,stance:'standing'},distance=Math.hypot(6,3),range=6,before=structuredClone(s),flight=shotLoadFlight(s,u,target,{damage:28,range,loadPattern:'cone'},'torso',{destinationHeight:1.4});
 for(const pellet of flight.pellets){
  const pattern=SHOT_LOAD_PATTERN[pellet.index],side=pattern.side*COMBAT_BALANCE.shotLoadHorizontalSpread,vx=6/distance-3/distance*side,vy=3/distance+6/distance*side,model=pellet.flight.trajectoryModel;
  assert.ok(model);close(model.horizontalDistance,3*range);close((model.destination.y-u.y)/(model.destination.x-u.x),vy/vx);
  const onset=projectileTrajectoryPoint(model,2/3),at=(d)=>projectileTrajectoryPoint(model,d/(3*range));
  close(onset.height,1.4+pattern.up*COMBAT_BALANCE.shotLoadVerticalSpread*2*range/Math.hypot(vx,vy));
  close(at(2*range-1).height,1.4+pattern.up*COMBAT_BALANCE.shotLoadVerticalSpread*(2*range-1)/Math.hypot(vx,vy));
  close(at(3*range).height,model.destination.height-COMBAT_BALANCE.firearmFarDropIncrement*range/4);
  assert.equal(pellet.weight,1/9);
 }
 const nativePrimary=weaponFor({...u,weapon:1800}),nativeAlternative=weaponFor({...u,weapon:1800,ammunitionChoice:'ammoShot'});assert.equal(nativePrimary.range,18);assert.equal(nativeAlternative.range,6);assert.equal(nativeAlternative.loadPattern,'cone');
 close(shotLoadFlight(s,u,target,nativeAlternative,'torso',{destinationHeight:1.4}).pellets[0].flight.trajectoryModel.horizontalDistance,18);
 const pistolAlternative=weaponFor({...u,weapon:1805,ammunitionChoice:'ammoShot'});assert.equal(pistolAlternative.range,3);close(shotLoadFlight(s,u,target,pistolAlternative,'torso',{destinationHeight:1.4}).pellets[0].flight.trajectoryModel.horizontalDistance,9);
 assert.deepEqual(s,before);
});
