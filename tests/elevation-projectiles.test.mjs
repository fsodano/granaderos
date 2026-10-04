import test from 'node:test';
import assert from 'node:assert/strict';
import {absoluteBodyHeight,elevationSightClear,geometryCells,obstacleVolumesAt,usesElevationGeometry} from '../game/sight-geometry.js';
import {concealmentAt,pointProjectileFlight,projectileCells,projectileFlight,projectilePath} from '../game/projectile-cover.js';
import {createBattle,actBattle,actionCosts} from '../game/tactical.js';

const weapon={damage:58};
const actor=(id,x,tacticalLevel=0,extra={})=>({id,x,y:3,tacticalLevel,hp:100,stance:'standing',...extra});
const roof=(x,y=3,extra={})=>({id:`roof:1:${x},${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0,...extra});
const field=(units,upperSurfaces=[])=>({width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),upperSurfaces,units,props:[]});
const floorLine=()=>Array.from({length:7},(_,i)=>roof(i+1));

test('absolute body and muzzle heights use the supporting floor, never earned experience level',()=>{
 const a=actor('a',1,0,{level:8}),b=actor('b',7,1),s=field([a,b],[roof(7)]);
 assert.equal(absoluteBodyHeight(s,a,'muzzle'),1.4);assert.equal(absoluteBodyHeight(s,b,'muzzle'),4.4);
 assert.equal(absoluteBodyHeight(s,{...b,stance:'prone'},'torso'),3.2);assert.equal(absoluteBodyHeight(s,{...b,mounted:true},'head'),5.2);
 assert.equal(absoluteBodyHeight(s,{...b,unconscious:true},'head'),3.3);
 assert.equal(absoluteBodyHeight(s,{...b,x:6}),null);assert.equal(usesElevationGeometry({...s,upperSurfaces:[]},a,{...a,level:99}),false);
});

test('elevated traces include both endpoint columns and terminate for same-column or fractional sight',()=>{
 assert.deepEqual(projectileCells({x:4,y:3},{x:4,y:3}),[]);
 assert.deepEqual(geometryCells({x:4,y:3},{x:4,y:3}),[{x:4,y:3,entry:0,exit:1}]);
 for(const [a,b] of [[{x:1.2,y:3.1},{x:7.1,y:3.4}],[{x:7.1,y:3.4},{x:1.2,y:3.1}],[{x:1.5,y:1.5},{x:3.5,y:3.5}]]){
  const cells=geometryCells(a,b);assert.ok(cells.length>0&&cells.length<30);assert.equal(cells[0].entry,0);assert.equal(cells.at(-1).exit,1);
  assert.ok(cells.every(cell=>Number.isInteger(cell.x)&&Number.isInteger(cell.y)&&Number.isFinite(cell.entry)&&Number.isFinite(cell.exit)));
 }
 assert.throws(()=>geometryCells({x:NaN,y:0},{x:2,y:0}),RangeError);
});

test('street-to-roof and roof-to-street rays clear a lower wall using absolute height',()=>{
 const street=actor('street',1),high=actor('roof',7,1),s=field([street,high],[roof(7)]);
 Object.assign(s.tiles[3*s.width+4],{type:'wall',blocked:true,material:'stone',obstacleHeight:2.1});
 assert.equal(elevationSightClear(s,street,high),true);assert.equal(elevationSightClear(s,high,street),true);
 assert.equal(projectileFlight(s,street,high,weapon).victimId,'roof');assert.equal(projectileFlight(s,high,street,weapon).victimId,'street');
 assert.equal(projectilePath({...s,upperSurfaces:[]},street,{...high,tacticalLevel:0},weapon).blocked,true);
});

test('solid floor slabs stop vertical sight and bullets in either direction even in one column',()=>{
 const low=actor('low',4),high=actor('high',4,1),s=field([low,high],[roof(4)]);
 for(const [a,b] of [[low,high],[high,low]]){
  assert.equal(elevationSightClear(s,a,b),false);
  const path=projectileFlight(s,a,b,{damage:10000});assert.equal(path.blocked,true);assert.equal(path.victimId,null);assert.equal(path.obstacles[0].kind,'slab');
 }
 const slab=obstacleVolumesAt(s,{x:4,y:3}).find(volume=>volume.kind==='slab');assert.equal(slab.bottom,2.8);assert.equal(slab.top,3);
});

test('a ceiling in the starting or terminal column cannot be skipped by legacy traversal rules',()=>{
 const low=actor('low',1),high=actor('high',2,2),s=field([low,high],[roof(1),roof(2,3,{id:'roof:2:2,3',tacticalLevel:2,elevation:6,slabThickness:.4})]);
 for(const [a,b] of [[low,high],[high,low]]){
  const path=projectilePath(s,a,b,weapon);assert.equal(path.blocked,true);assert.equal(path.obstacles[0].x,a.x);assert.equal(path.obstacles[0].kind,'slab');assert.equal(elevationSightClear(s,a,b),false);
 }
 const terminal=field([low,actor('high',2,1)],[roof(2)]),path=projectilePath(terminal,...terminal.units,weapon);assert.equal(path.blocked,true);assert.equal(path.obstacles[0].x,2);
});

test('stacked bodies are selected by the ray height rather than roster order or XY alone',()=>{
 const a=actor('shooter',1),b=actor('roof',7,1),downstairs=actor('a-downstairs',7),s=field([a,downstairs,b],[roof(7)]),before=structuredClone(s);
 assert.equal(projectileFlight(s,a,b,weapon).victimId,'roof');assert.deepEqual(projectileFlight({...s,units:[...s.units].reverse()},a,b,weapon),projectileFlight(s,a,b,weapon));
 assert.equal(pointProjectileFlight(s,a,{x:7,y:3,tacticalLevel:1},weapon).victimId,'roof');
 const reverse=field([actor('shooter',1,1),actor('street',7),actor('a-upstairs',7,1)],[roof(1),roof(7)]);
 assert.equal(projectileFlight(reverse,reverse.units[0],reverse.units[1],weapon).victimId,'street');assert.deepEqual(s,before);
});

test('an elevated intervening ally intercepts the ray while downstairs bodies remain below it',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),friend=actor('friend',4,1),s=field([a,b,actor('downstairs',3),friend],floorLine());
 assert.equal(projectileFlight(s,a,b,weapon).victimId,'friend');
 assert.equal(projectileFlight({...s,units:[a,b,s.units[2]]},a,b,weapon).victimId,'b');
 friend.unconscious=true;friend.stance='prone';assert.equal(projectileFlight(s,a,b,weapon).victimId,'b');
});

test('elevated cover and furniture use their own floor offset and retain material resistance',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),s=field([a,b],floorLine());
 s.props=[{id:'below',type:'barrels',x:3,y:3},{id:'above',type:'barrels',x:5,y:3,tacticalLevel:1}];
 const path=projectilePath(s,a,b,weapon);assert.equal(path.obstacles.length,1);assert.equal(path.obstacles[0].tacticalLevel,1);assert.ok(Math.abs(path.damageFactor-(58-24*.5*Math.hypot(1,.3/6))/58)<1e-10,'the descending ray crosses only the last half of the raised barrel');
 Object.assign(s.upperSurfaces.find(surface=>surface.x===6),{blocked:true,obstacleHeight:.8,material:'stone'});
 assert.equal(projectilePath(s,a,b,weapon,'legs').blocked,true);assert.equal(projectilePath(s,a,b,weapon,'head').blocked,false);assert.equal(elevationSightClear(s,a,b),true);
 s.props[1].obstacleHeight=2;assert.equal(elevationSightClear(s,a,b),false);
 s.props[1].y=4;assert.equal(elevationSightClear(s,a,b),true);
});

test('elevated sight and projectile volumes preserve window openings and open doors',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),s=field([a,b],floorLine());
 s.props=[{id:'screen',type:'barrels',x:2,y:3,tacticalLevel:1,material:'stone',obstacleHeight:.8}];
 assert.equal(elevationSightClear(s,a,b),true);assert.equal(projectilePath(s,a,b,weapon).blocked,false);
 const ground=field([actor('a',1),actor('b',7)],[roof(10)]),window=ground.tiles[3*ground.width+2];
 Object.assign(window,{type:'window',blocked:true,blocksSight:false});
 assert.equal(elevationSightClear(ground,...ground.units),true);assert.equal(projectilePath(ground,...ground.units,weapon).blocked,false);
 ground.units[0].stance='prone';assert.equal(elevationSightClear(ground,...ground.units),false);assert.equal(projectilePath(ground,...ground.units,weapon).blocked,true);
 Object.assign(window,{type:'door',open:true,blocked:false});assert.equal(elevationSightClear(ground,...ground.units),true);assert.equal(projectilePath(ground,...ground.units,weapon).blocked,false);
});

test('roof concealment does not inherit downstairs grass, scrub or room contents',()=>{
 const high=actor('high',7,1),s=field([high],[roof(7,3,{cover:10})]);
 Object.assign(s.tiles[3*s.width+7],{type:'scrub',concealment:90});
 assert.equal(concealmentAt(s,high),10);assert.equal(concealmentAt(s,{...high,tacticalLevel:0}),90);
});

test('unsupported floors fail closed and a scattered ray can retain the original absolute aim height',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),s=field([a,b,actor('ground',8)],[roof(1),roof(7)]),scattered={...b,x:8};
 assert.equal(elevationSightClear(s,a,scattered),false);assert.equal(projectilePath(s,a,scattered,weapon).blocked,true);
 const missed={...s,units:s.units.filter(unit=>unit.id!==b.id)},path=projectileFlight(missed,a,scattered,weapon,'torso',{destinationHeight:absoluteBodyHeight(s,b,'torso')});
 assert.equal(path.blocked,false);assert.equal(path.victimId,null,'scatter above a street does not fall to a downstairs body');
});

test('forecast geometry checks only the supplied known bodies while actual flight can hit a hidden one',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),hidden=actor('hidden',4,1),s=field([a,b,hidden],floorLine());
 const known={...s,units:[a,b]};assert.equal(projectileFlight(known,a,b,weapon).victimId,'b');assert.equal(projectileFlight(s,a,b,weapon).victimId,'hidden');assert.equal(elevationSightClear(s,a,b),elevationSightClear(known,a,b));
});

test('the existing fire action spends its normal AP and one charge without hitting the downstairs actor',()=>{
 const s=createBattle([{id:'p',x:1,y:3,weapon:1800,marksmanship:100,loaded:1,condition:100}],{width:12,height:8,seed:45,tiles:field([]).tiles,enemies:[{id:'roof',x:7,y:3,hp:100,overwatch:false,patrol:false}]});
 s.upperSurfaces=[roof(7)];s.units[1].tacticalLevel=1;s.units[0].ap=100;
 s.units.push({...structuredClone(s.units[1]),id:'a-downstairs',tacticalLevel:0});
 const before=structuredClone(s),cost=actionCosts(s,s.units[0],s.units[1]);
 const after=actBattle(s,{type:'fire',unitId:'p',targetId:'roof',aim:4});assert.equal(after.lastError,null);
 assert.ok(after.units[1].hp<100);assert.equal(after.units[2].hp,100);assert.equal(after.units[0].loaded,0);assert.equal(after.units[0].ammo,s.units[0].ammo);assert.equal(after.units[0].ap,100-cost.fire-4*cost.aim);assert.deepEqual(s,before);
 const empty=structuredClone(s);empty.units[0].loaded=0;const denied=actBattle(empty,{type:'fire',unitId:'p',targetId:'roof',aim:4});assert.ok(denied.lastError);assert.deepEqual(denied.units,empty.units);assert.equal(denied.seed,empty.seed);
});
