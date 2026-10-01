import test from 'node:test';
import assert from 'node:assert/strict';
import {knifeFlight} from '../game/knife-flight.js';
import {absoluteBodyHeight} from '../game/sight-geometry.js';
import {spacePoint,surfaceAt,validateTacticalSpace} from '../game/tactical-space.js';

const actor=(id,x,tacticalLevel=0,extra={})=>({id,x,y:3,tacticalLevel,hp:100,side:id==='a'?'player':'enemy',stance:'standing',...extra});
const roof=(x,y=3,extra={})=>({id:`roof:1:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0,...extra});
const field=(units,upperSurfaces=[])=>({width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),upperSurfaces,units,props:[]});
const floorLine=()=>Array.from({length:7},(_,i)=>roof(i+1));
const ground=(s,x,y=3)=>s.tiles[y*s.width+x];
function supported(s,result,expected){
 assert.deepEqual(result.landing,expected);
 assert.equal(surfaceAt(s,result.landing)?.blocked,false);
 const snapshot={...s,groundItems:[{...result.landing,id:'recovered',type:'item',item:'weapon',weapon:1813,count:1}]};
 validateTacticalSpace(snapshot);
}

test('ground body zones return the actual victim and one supported recovery position',()=>{
 const a=actor('a',1),b=actor('b',7),s=field([a,b]);
 for(const part of ['head','torso','legs']){
  const result=knifeFlight(s,a,b,part);
  assert.equal(result.victimId,'b');assert.equal(result.hitLocation,part);assert.equal(result.blocked,false);assert.equal(result.impact.kind,'body');
  assert.ok(result.impact.fraction>0&&result.impact.fraction<1);supported(s,result,spacePoint(b));
 }
});

test('the first body stops the knife, including friendly soldiers before later cover',()=>{
 const a=actor('a',1),b=actor('b',7),friend=actor('friend',4,0,{side:'player'}),s=field([a,b,friend]);
 Object.assign(ground(s,6),{type:'wall',blocked:true});
 const first=knifeFlight(s,a,b);assert.equal(first.victimId,friend.id);assert.equal(first.blocked,false);supported(s,first,spacePoint(friend));
 Object.assign(ground(s,3),{type:'wall',blocked:true});
 const stopped=knifeFlight(s,a,b);assert.equal(stopped.victimId,null);assert.equal(stopped.blocked,true);supported(s,stopped,{x:2,y:3,tacticalLevel:0});
});

test('living incapacitated silhouettes intercept low rays while dead and departed bodies do not',()=>{
 const a=actor('a',1),b=actor('b',7,0,{stance:'prone'}),body=actor('body',6,0,{unconscious:true}),s=field([a,b,body]);
 assert.equal(knifeFlight(s,a,b,'legs').victimId,'body');
 body.unconscious=false;body.knockedDown=true;assert.equal(knifeFlight(s,a,b,'legs').victimId,'body');
 for(const extra of [{hp:0},{departure:{edge:'E'}},{fled:true}]){
  assert.equal(knifeFlight({...s,units:[a,b,{...body,...extra}]},a,b,'legs').victimId,'b');
 }
});

test('a zero-width diagonal contact blocks on a wall but not on a body in that cell',()=>{
 const a=actor('a',1,0,{y:1}),b=actor('b',3,0,{y:3}),corner=actor('corner',2,0,{y:1}),s=field([a,b,corner]);
 assert.equal(knifeFlight(s,a,b).victimId,'b');
 Object.assign(ground(s,2,1),{type:'wall',blocked:true});
 const forward=knifeFlight(s,a,b),reverse=knifeFlight(s,b,a);
 assert.equal(forward.blocked,true);assert.equal(reverse.blocked,true);assert.equal(forward.victimId,null);
 supported(s,forward,spacePoint(a));supported(s,reverse,{x:2,y:2,tacticalLevel:0});
});

test('cover wins a simultaneous body intersection rather than allowing a hit through the obstacle',()=>{
 const a=actor('a',1),b=actor('b',7),s=field([a,b]);Object.assign(ground(s,7),{type:'wall',blocked:true});
 const result=knifeFlight(s,a,b);assert.equal(result.blocked,true);assert.equal(result.victimId,null);assert.equal(result.impact.kind,'cover');
 supported(s,result,{x:6,y:3,tacticalLevel:0});
});

test('low cover protects legs while window openings and open doors permit a clear direct ray',()=>{
 const a=actor('a',1),b=actor('b',7),s=field([a,b]);
 Object.assign(ground(s,6),{type:'window',blocked:true,blocksSight:false});
 assert.equal(knifeFlight(s,a,b,'head').victimId,'b');assert.equal(knifeFlight(s,a,b,'torso').victimId,'b');
 const low=knifeFlight(s,a,b,'legs');assert.equal(low.blocked,true);supported(s,low,{x:5,y:3,tacticalLevel:0});
 Object.assign(ground(s,6),{type:'door',blocked:false,open:true});assert.equal(knifeFlight(s,a,b,'legs').victimId,'b');
 ground(s,6).open=false;ground(s,6).blocked=true;assert.equal(knifeFlight(s,a,b).blocked,true);
});

test('knives never penetrate even low-resistance hay or wood, and recover before a furniture footprint',()=>{
 const a=actor('a',1),b=actor('b',7),s=field([a,b]);
 for(const material of ['hay','wood','adobe','stone']){
  s.props=[{id:'screen',type:'barrels',x:4,y:3,footprint:{width:2,height:1},material,obstacleHeight:2,projectileResistance:0}];
  const result=knifeFlight(s,a,b);assert.equal(result.blocked,true);assert.equal(result.victimId,null);assert.equal(result.impact.obstacleId,'prop:screen');supported(s,result,{x:3,y:3,tacticalLevel:0});
 }
 s.props[0].obstacleHeight=1.2;
 const insideFootprint=knifeFlight(s,a,b);assert.ok(insideFootprint.impact.x>4.5);supported(s,insideFootprint,{x:3,y:3,tacticalLevel:0});
});

test('roof rays select upstairs bodies and cover without colliding with the floor below',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),below=actor('below',4),friend=actor('friend',5,1,{side:'player'}),s=field([a,b,below,friend],floorLine());
 s.props=[{id:'downstairs',type:'barrels',x:3,y:3,obstacleHeight:2}];
 const hit=knifeFlight(s,a,b);assert.equal(hit.victimId,'friend');supported(s,hit,spacePoint(friend));
 s.props.push({id:'roof-cover',type:'barrels',x:3,y:3,tacticalLevel:1,obstacleHeight:2});
 const cover=knifeFlight(s,a,b);assert.equal(cover.blocked,true);supported(s,cover,{x:2,y:3,tacticalLevel:1});
});

test('a clear street-to-roof ray and its reverse hit the intended physical floor',()=>{
 const low=actor('low',1),high=actor('high',7,1),downstairs=actor('downstairs',7),s=field([low,high,downstairs],[roof(7)]);
 Object.assign(ground(s,4),{type:'wall',blocked:true,obstacleHeight:2.1});
 for(const [a,b] of [[low,high],[high,low]]){
  const result=knifeFlight(s,a,b);assert.equal(result.blocked,false);assert.equal(result.victimId,b.id);supported(s,result,spacePoint(b));
 }
});

test('same-column slab impacts stay on the top when descending and below the ceiling when ascending',()=>{
 const low=actor('low',4),high=actor('high',4,1),s=field([low,high],[roof(4)]);
 const up=knifeFlight(s,low,high),down=knifeFlight(s,high,low);
 for(const result of [up,down]){assert.equal(result.blocked,true);assert.equal(result.victimId,null);assert.equal(result.impact.kind,'slab');}
 assert.ok(Math.abs(up.impact.height-2.8)<1e-9);assert.ok(Math.abs(down.impact.height-3)<1e-9);
 supported(s,up,spacePoint(low));supported(s,down,spacePoint(high));
});

test('descending impact on an intermediate roof lands on its top instead of passing to the victim below',()=>{
 const a=actor('a',1,1),b=actor('b',7),s=field([a,b],[roof(1),roof(4)]);
 const result=knifeFlight(s,a,b);assert.equal(result.blocked,true);assert.equal(result.victimId,null);assert.equal(result.impact.kind,'slab');
 assert.ok(Math.abs(result.impact.height-3)<1e-9);supported(s,result,{x:4,y:3,tacticalLevel:1});
});

test('the vertical side of a slab cannot teleport a stopped knife underneath its far face',()=>{
 const a=actor('a',1),s=field([a],[roof(4)]),aim={x:7,y:3};
 const result=knifeFlight(s,a,aim,'torso',{destinationHeight:5});
 assert.equal(result.blocked,true);assert.equal(result.impact.kind,'slab');assert.ok(result.impact.height>2.8&&result.impact.height<3);
 supported(s,result,{x:3,y:3,tacticalLevel:0});
});

test('ceilings in the origin and destination columns remain part of the knife path',()=>{
 const low=actor('low',1),high=actor('high',2,2),s=field([low,high],[roof(1),roof(2,3,{id:'roof:2:2:3',tacticalLevel:2,elevation:6})]);
 const up=knifeFlight(s,low,high);assert.equal(up.blocked,true);assert.equal(up.impact.obstacleId,'slab:roof:1:1:3');supported(s,up,spacePoint(low));
 const adjacent=field([low,actor('high',2,1)],[roof(2)]),terminal=knifeFlight(adjacent,...adjacent.units);
 assert.equal(terminal.blocked,true);assert.equal(terminal.impact.obstacleId,'slab:roof:1:2:3');supported(adjacent,terminal,{x:2,y:3,tacticalLevel:0});
});

test('a clear miss above blocked roof furniture falls back on the roof and never through its slab',()=>{
 const a=actor('a',1,1),s=field([a],floorLine()),aim={x:7,y:3,tacticalLevel:1};
 s.props=[{id:'chest',type:'chest',x:7,y:3,tacticalLevel:1,blocksMovement:true}];
 const result=knifeFlight(s,a,aim);assert.equal(result.blocked,false);assert.equal(result.victimId,null);assert.equal(result.impact.kind,'miss');
 supported(s,result,{x:6,y:3,tacticalLevel:1});
});

test('a blocked landing floor does not push a missed knife through a wall or into its decor',()=>{
 const a=actor('a',1),s=field([a]),aim={x:7,y:3};
 Object.assign(ground(s,7),{type:'wall',blocked:true,obstacleHeight:.2});
 s.props=[{id:'bench',type:'bench',x:6,y:3,blocksMovement:true}];
 const result=knifeFlight(s,a,aim);assert.equal(result.blocked,false);supported(s,result,{x:5,y:3,tacticalLevel:0});
});

test('off-map misses stop their recovery position at the last supported map cell in every direction',()=>{
 const a=actor('a',5),s=field([a]);
 for(const [aim,expected] of [[{x:-4,y:3},{x:0,y:3,tacticalLevel:0}],[{x:20,y:3},{x:11,y:3,tacticalLevel:0}],[{x:5,y:-5},{x:5,y:0,tacticalLevel:0}],[{x:5,y:15},{x:5,y:7,tacticalLevel:0}]]){
  const result=knifeFlight(s,a,aim,'torso',{destinationHeight:1.1});assert.equal(result.blocked,false);assert.equal(result.victimId,null);supported(s,result,expected);
 }
});

test('scattered aim retains its original height above an unsupported roof cell and a downstairs body',()=>{
 const a=actor('a',1,1),target=actor('target',7,1),below=actor('below',8),s=field([a,below],[roof(1),roof(7)]),aim={...target,x:8};
 const result=knifeFlight(s,a,aim,'torso',{destinationHeight:absoluteBodyHeight(s,target,'torso')});
 assert.equal(result.blocked,false);assert.equal(result.victimId,null);supported(s,result,{x:8,y:3,tacticalLevel:0});
 assert.equal(knifeFlight(s,a,aim).blocked,true,'a missing aim floor requires the original absolute height');
});

test('a preview examines only supplied public bodies and never inserts the target as an unobserved body',()=>{
 const a=actor('a',1,1),b=actor('b',7,1),hidden=actor('hidden',4,1),s=field([a,b,hidden],floorLine());
 const known={...s,units:[a,b]},preview=knifeFlight(known,a,b);
 assert.equal(preview.victimId,'b');assert.equal(knifeFlight(s,a,b).victimId,'hidden');
 const changed={...s,units:[a,b,{...hidden,x:6,hp:12,unconscious:true}]};
 assert.deepEqual(knifeFlight({...changed,units:changed.units.filter(u=>u.id!=='hidden')},a,b),preview);
 const miss=knifeFlight({...known,units:[a]},a,b);assert.equal(miss.victimId,null);assert.equal(miss.impact.kind,'miss');supported(s,miss,spacePoint(b));
});

test('flight is pure and deterministic across body ordering and a JSON round trip',()=>{
 const a=actor('a',1,1,{level:99}),b=actor('b',7,1),s=field([a,b,actor('friend',4,1),actor('downstairs',4)],floorLine()),before=structuredClone(s);
 const result=knifeFlight(s,a,b);
 assert.deepEqual(knifeFlight(s,a,b),result);assert.deepEqual(knifeFlight({...s,units:[...s.units].reverse()},a,b),result);
 const copy=JSON.parse(JSON.stringify(s));assert.deepEqual(knifeFlight(copy,copy.units[0],copy.units[1]),result);assert.deepEqual(s,before);assert.equal(s.seed,45);
});

test('malformed or unbounded rays fail closed without losing the safe source landing',()=>{
 const a=actor('a',1),s=field([a]);
 for(const [point,options] of [[{x:Infinity,y:3},{}],[{x:9000,y:3},{destinationHeight:1.1}],[{x:7,y:3},{destinationHeight:NaN}],[{x:7,y:3,tacticalLevel:2},{}]]){
  const result=knifeFlight(s,a,point,'torso',options);assert.equal(result.blocked,true);assert.equal(result.victimId,null);assert.equal(result.impact.kind,'invalid');supported(s,result,spacePoint(a));
 }
});
