import test from 'node:test';
import assert from 'node:assert/strict';
import {grenadeFlight,grenadeBlastExposure} from '../game/grenade-flight.js';
import {spacePoint,surfaceAt,validateTacticalSpace} from '../game/tactical-space.js';

const person=(x,y=3,tacticalLevel=0,extra={})=>({id:'actor',x,y,tacticalLevel,stance:'standing',hp:100,...extra});
const roof=(x,y=3,extra={})=>({id:`roof:1:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0,...extra});
const field=(upperSurfaces=[])=>({width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),upperSurfaces,units:[],props:[]});
const ground=(s,x,y=3)=>s.tiles[y*s.width+x];
const wall=(s,x,y=3,extra={})=>Object.assign(ground(s,x,y),{type:'wall',blocked:true,obstacleHeight:6,...extra});
function supported(s,result){
 assert.ok(result.landing);assert.equal(surfaceAt(s,result.landing)?.blocked,false);
 validateTacticalSpace({...s,groundItems:[{id:'grenade',type:'item',item:'grenade',count:1,...result.landing}]});
}

test('a clear lob has a curved path and lands at its requested floor without body interception',()=>{
 const s=field(),a=person(1),target=person(8),before=structuredClone(s);
 s.units=[{...a,id:'a'},{...person(4),id:'hidden'},{...target,id:'enemy'}];
 const result=grenadeFlight(s,a,target);
 assert.equal(result.blocked,false);assert.equal(result.impact.kind,'land');assert.deepEqual(result.landing,spacePoint(target));supported(s,result);
 assert.equal(result.points[0].height,1.4);assert.equal(result.points.at(-1).height,0);
 assert.ok(Math.max(...result.points.map(p=>p.height))>1.4);
 assert.deepEqual(grenadeFlight({...s,units:[]},a,target),result);assert.equal(s.seed,before.seed);
});

test('range geometry includes low furniture while a high wall stops the lob on its near side',()=>{
 const s=field(),a=person(1),target=person(8);
 s.props=[{id:'bench',type:'bench',x:4,y:3,blocksMovement:true}];
 assert.equal(grenadeFlight(s,a,target).blocked,false);
 wall(s,4);const result=grenadeFlight(s,a,target);
 assert.equal(result.blocked,true);assert.equal(result.impact.kind,'cover');assert.ok(result.landing.x<4);supported(s,result);
 assert.ok(result.points.every(p=>p.fraction<=result.impact.fraction));
});

test('an overhead slab prevents passing through a closed doorway and an open door clears a low lob',()=>{
 const s=field(),a=person(1),target=person(4);
 Object.assign(ground(s,3),{type:'door',open:false,blocked:true});
 const closed=grenadeFlight(s,a,target);assert.equal(closed.blocked,true);assert.ok(closed.landing.x<3);supported(s,closed);
 Object.assign(ground(s,3),{open:true,blocked:false});
 const open=grenadeFlight(s,a,target);assert.equal(open.blocked,false);assert.deepEqual(open.landing,spacePoint(target));
 const indoors=field([roof(1),roof(2),roof(3),roof(4)]);
 Object.assign(ground(indoors,3),{type:'door',open:false,blocked:true});
 assert.equal(grenadeFlight(indoors,a,target).blocked,true);
});

test('a diagonal corner touches both physical columns and cannot slip through high corner cover',()=>{
 const s=field(),a=person(1,1),target=person(4,4);wall(s,2,1);
 const forward=grenadeFlight(s,a,target),reverse=grenadeFlight(s,target,a);
 for(const result of [forward,reverse]){assert.equal(result.blocked,true);supported(s,result);}
 assert.deepEqual(forward.landing,spacePoint(a));
});

test('roof throws clear downstairs furniture and land on the selected upper surface',()=>{
 const s=field(Array.from({length:8},(_,i)=>roof(i+1))),a=person(1,3,1),target=person(8,3,1);
 s.props=[{id:'downstairs',type:'barrels',x:4,y:3,obstacleHeight:2}];
 const result=grenadeFlight(s,a,target);assert.equal(result.blocked,false);assert.deepEqual(result.landing,spacePoint(target));supported(s,result);
 s.props.push({id:'upstairs',type:'barrels',x:4,y:3,tacticalLevel:1,obstacleHeight:6});
 const blocked=grenadeFlight(s,a,target);assert.equal(blocked.blocked,true);assert.equal(blocked.impact.obstacleId,'prop:upstairs');assert.equal(blocked.landing.tacticalLevel,1);supported(s,blocked);
});

test('a ceiling over the thrower blocks an upward lob and cannot teleport it upstairs',()=>{
 const s=field([roof(1,3,{elevation:2}),roof(7)]),a=person(1),target=person(7,3,1);
 const result=grenadeFlight(s,a,target);assert.equal(result.blocked,true);assert.equal(result.impact.kind,'slab');assert.equal(result.impact.obstacleId,'slab:roof:1:1:3');assert.equal(result.landing.tacticalLevel,0);supported(s,result);
});

test('same-column floor separation blocks both upward and downward throws',()=>{
 const s=field([roof(4)]),low=person(4),high=person(4,3,1);
 const up=grenadeFlight(s,low,high),down=grenadeFlight(s,high,low);
 assert.equal(up.blocked,true);assert.equal(down.blocked,true);assert.equal(up.impact.kind,'slab');assert.equal(down.impact.kind,'slab');
 assert.deepEqual(up.landing,spacePoint(low));assert.deepEqual(down.landing,spacePoint(high));supported(s,up);supported(s,down);
});

test('a descending lob catches an intervening roof rather than reaching the ground through it',()=>{
 const s=field([roof(1),roof(6)]),a=person(1,3,1),target=person(8);
 const result=grenadeFlight(s,a,target);assert.equal(result.blocked,true);assert.equal(result.impact.kind,'slab');assert.equal(result.landing.tacticalLevel,1);supported(s,result);
 assert.ok(result.impact.height>=3-1e-9);
});

test('blocked upper landing furniture never causes a fallback through the same roof',()=>{
 const s=field(Array.from({length:8},(_,i)=>roof(i+1))),a=person(1,3,1),target=person(8,3,1);
 s.props=[{id:'chest',type:'chest',x:8,y:3,tacticalLevel:1,blocksMovement:true}];
 const result=grenadeFlight(s,a,target);assert.equal(result.blocked,true);assert.equal(result.landing.tacticalLevel,1);assert.ok(result.landing.x<8);supported(s,result);
});

test('raised terrain catches a low segment before a lower destination',()=>{
 const s=field(),a=person(1),target=person(5);ground(s,4).elevation=3;
 const result=grenadeFlight(s,a,target);assert.equal(result.blocked,true);assert.equal(result.impact.obstacleId,'ground:4,3');assert.ok(result.landing.x<4);supported(s,result);
});

test('invalid or unsupported targets fail closed with a supported source fallback',()=>{
 const s=field(),a=person(1);
 for(const target of [{x:Infinity,y:3},{x:9000,y:3},{x:7,y:3,tacticalLevel:2},{x:2.5,y:3}]){
  const result=grenadeFlight(s,a,target);assert.equal(result.blocked,true);assert.equal(result.impact.kind,'invalid');assert.deepEqual(result.landing,spacePoint(a));supported(s,result);
 }
});

test('blast falls with physical distance, includes its edge and excludes outside points',()=>{
 const s=field(),origin=person(1);
 const center=grenadeBlastExposure(s,origin,origin,4),near=grenadeBlastExposure(s,origin,person(2),4),edge=grenadeBlastExposure(s,origin,person(5),4),outside=grenadeBlastExposure(s,origin,person(6),4);
 assert.equal(center.multiplier,1);assert.ok(near.multiplier>edge.multiplier);assert.ok(edge.multiplier>0);assert.equal(outside.multiplier,0);
 assert.equal(near.exposure,1);assert.equal(near.blocked,false);
});

test('blast respects closed doors and diagonal corner walls with no team exemption in geometry',()=>{
 const s=field(),origin=person(1),target=person(4);Object.assign(ground(s,3),{type:'door',open:false,blocked:true});
 assert.equal(grenadeBlastExposure(s,origin,target,5).multiplier,0);
 Object.assign(ground(s,3),{open:true,blocked:false});assert.ok(grenadeBlastExposure(s,origin,target,5).multiplier>0);
 wall(s,2,1);assert.equal(grenadeBlastExposure(s,person(1,1),person(4,4),6).multiplier,0);
 const baseline=grenadeBlastExposure(s,origin,target,5);
 for(const side of ['player','enemy','civilian'])assert.deepEqual(grenadeBlastExposure(s,origin,{...target,side},5),baseline);
});

test('low cover partially shields an upright target and fully shields a prone or unconscious target',()=>{
 const s=field(),origin=person(1),target=person(4);
 s.props=[{id:'bench',type:'bench',x:3,y:3,blocksMovement:true}];
 const partial=grenadeBlastExposure(s,origin,target,5);
 assert.ok(partial.exposure>0&&partial.exposure<1);assert.ok(partial.multiplier>0);
 for(const extra of [{stance:'prone'},{unconscious:true},{knockedDown:true}])assert.equal(grenadeBlastExposure(s,origin,{...target,...extra},5).multiplier,0);
});

test('blast cannot cross a solid floor in either direction, including the same column',()=>{
 const s=field([roof(4)]),low=person(4),high=person(4,3,1);
 for(const [origin,target] of [[low,high],[high,low]])assert.equal(grenadeBlastExposure(s,origin,target,5).multiplier,0);
 const open=field([roof(1)]);assert.ok(grenadeBlastExposure(open,person(1,3,1),person(6),6).multiplier>0,'an unobstructed ray from an edge can reach a lower floor');
});

test('helpers are pure and deterministic after JSON resume and hidden roster changes',()=>{
 const s=field([roof(1)]),a=person(1,3,1),target=person(6),before=structuredClone(s);
 const flight=grenadeFlight(s,a,target),blast=grenadeBlastExposure(s,a,target,8),copy=JSON.parse(JSON.stringify(s));
 assert.deepEqual(grenadeFlight(copy,a,target),flight);assert.deepEqual(grenadeBlastExposure(copy,a,target,8),blast);
 s.units=[person(2),person(4,3,0,{id:'enemy',hp:1,unconscious:true})];
 assert.deepEqual(grenadeFlight(s,a,target),flight);assert.deepEqual(grenadeBlastExposure(s,a,target,8),blast);
 delete s.units;delete before.units;assert.deepEqual(s,before);
 for(const radius of [NaN,Infinity,-1])assert.equal(grenadeBlastExposure(s,a,target,radius).multiplier,0);
 assert.equal(grenadeBlastExposure(s,a,{x:6,y:3,tacticalLevel:8},8).multiplier,0);
});

test('prop landing checks use the whole footprint and retain legacy one-cell defaults',()=>{
 const s=field(),a=person(1),target=person(8);
 s.props=[{id:'wide',type:'barrels',x:6,y:2,footprint:{width:3,height:2},blocksMovement:true,obstacleHeight:.01}];
 const wide=grenadeFlight(s,a,target);assert.equal(wide.blocked,true);assert.ok(wide.landing.x<6);supported(s,wide);
 s.props=[{id:'legacy',type:'barrels',x:7,y:3,blocksMovement:true,obstacleHeight:.01}];
 const legacy=grenadeFlight(s,a,target);assert.equal(legacy.blocked,false);assert.deepEqual(legacy.landing,spacePoint(target));supported(s,legacy);
});

test('an obstruction intersecting the ray at fraction zero still blocks blast',()=>{
 const s=field(),origin=person(1),target=person(4);wall(s,1);
 const result=grenadeBlastExposure(s,origin,target,5);assert.equal(result.blocked,true);assert.equal(result.exposure,0);assert.equal(result.multiplier,0);
});
