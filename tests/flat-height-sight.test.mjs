import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,hasLineOfSight,canSee,shotChance,meleePreview,getReachable} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {obstacleVolumesAt} from '../game/sight-geometry.js';

const floor=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
const roof=()=>({id:'distant-roof',x:10,y:6,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0});
const field=(extra={})=>createBattle([{id:'p',x:1,y:3,weapon:1800,marksmanship:100,loaded:1}],{width:12,height:8,seed:45,tiles:floor(),enemies:[{id:'e',x:5,y:3,patrol:false,overwatch:false},{id:'reserve',x:11,y:7,patrol:false,overwatch:false}],...extra});
const pair=s=>s.units.slice(0,2);
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));

test('a distant roof cannot change tall furniture sight, in either direction or after a save',()=>{
 const s=field({props:[{id:'screen',type:'hay',x:3,y:3,obstacleHeight:2,blocksSight:true}]}),before=structuredClone(s);
 for(const scene of [s,{...s,upperSurfaces:[roof()]},restored(s)]){
  const [a,b]=pair(scene);assert.equal(hasLineOfSight(scene,a,b),false);assert.equal(hasLineOfSight(scene,b,a),false);
  assert.equal(canSee(scene,a,b),false);
 }
 assert.deepEqual(s,before);
 const shown=playerKnownBattle(s);assert.ok(!shown.units.some(u=>u.id==='e'));
});

test('authored opacity without a movement barrier remains sight-only on flat and roof maps',()=>{
 const s=field(),[a,b]=pair(s),screen=s.tiles.find(t=>t.x===3&&t.y===3);screen.blocksSight=true;
 assert.equal(screen.blocked,false);assert.deepEqual(obstacleVolumesAt(s,screen),[],'the sight flag creates no projectile resistance');
 for(const scene of [s,{...s,upperSurfaces:[roof()]},restored(s)]){
  assert.equal(hasLineOfSight(scene,a,b),false);assert.equal(hasLineOfSight(scene,b,a),false);
  assert.equal(canSee(scene,a,b),false);
  assert.ok(getReachable(scene,a).some(point=>point.x===screen.x&&point.y===screen.y),'authored opacity does not block walking');
 }
 screen.blocksSight=false;assert.equal(hasLineOfSight(s,a,b),true);
});

test('low furniture, a window sill and an open door use the same posture ray on every map',()=>{
 for(const elevated of [false,true])for(const kind of ['prop','window','open-door']){
  const s=field(elevated?{upperSurfaces:[roof()]}:{}),[a,b]=pair(s);
  if(kind==='prop')s.props=[{id:'low',type:'table',x:3,y:3,obstacleHeight:.8}];
  else Object.assign(s.tiles.find(t=>t.x===3&&t.y===3),kind==='window'?{type:'window',blocked:true,blocksSight:false}:{type:'door',open:true,blocked:false,blocksSight:false});
  assert.equal(hasLineOfSight(s,a,b),true,`${kind}/${elevated}`);
  assert.equal(hasLineOfSight(s,{...a,stance:'prone'},{...b,stance:'prone'}),kind==='open-door',`${kind}/${elevated}/prone`);
 }
});

test('a distant roof changes neither local smoke sight nor aim, including bodies above the cloud',()=>{
 const s=field(),[a,b]=pair(s);Object.assign(a,{x:1,y:1,marksmanship:100});Object.assign(b,{x:7,y:4});
 s.smoke=[{x:4,y:3,radius:2,turns:3}];const elevated={...s,upperSurfaces:[roof()]};
 assert.equal(canSee(s,a,b),false);assert.equal(canSee(elevated,a,b),false);
 assert.equal(shotChance(s,a,b),shotChance(elevated,a,b));
 s.smoke[0].radius=1;assert.equal(canSee(s,a,b),true);assert.equal(shotChance(s,a,b),shotChance(elevated,a,b));
 const highA={...a,mounted:true},highB={...b,mounted:true},clear={...s,smoke:[]};
 assert.equal(canSee(s,highA,highB),canSee(clear,highA,highB));
 assert.equal(shotChance(s,highA,highB),shotChance(clear,highA,highB));
 assert.equal(shotChance(s,highA,highB),shotChance(elevated,highA,highB));
});

test('zero-length corner contact stays clear but a crossed wall blocks flat and roof maps',()=>{
 const s=field(),[a,b]=pair(s);Object.assign(a,{x:1,y:1});Object.assign(b,{x:3,y:3});
 Object.assign(s.tiles.find(t=>t.x===2&&t.y===1),{type:'wall',blocked:true,blocksSight:true});
 for(const scene of [s,{...s,upperSurfaces:[roof()]}])assert.equal(hasLineOfSight(scene,a,b),true);
 Object.assign(s.tiles.find(t=>t.x===2&&t.y===2),{type:'wall',blocked:true,blocksSight:true});
 for(const scene of [s,{...s,upperSurfaces:[roof()]}])assert.equal(hasLineOfSight(scene,a,b),false);
});

test('a selected closed door exposes its own face without exposing an actor in its volume',()=>{
 const s=field(),[a,b]=pair(s),door=s.tiles.find(t=>t.x===3&&t.y===3);Object.assign(door,{type:'door',doorId:'closed',open:false,blocked:true,blocksSight:true});
 assert.equal(hasLineOfSight(s,a,door),true);assert.equal(hasLineOfSight(s,a,{x:3,y:3}),false);
 assert.equal(hasLineOfSight(s,a,{...b,x:3,type:'door'}),false);assert.equal(hasLineOfSight(s,a,b),false);
});

test('tall cover rejects targeted fire and direct blade contact while paid movement can go around it',()=>{
 const s=field({props:[{id:'screen',type:'hay',x:2,y:3,obstacleHeight:2}]}),[a,b]=pair(s);
 Object.assign(a,{blade:1812,activeSlot:'blade'});Object.assign(b,{x:3,ap:0});
 s.units.push({...structuredClone(a),id:'observer',x:3,y:4,activeSlot:'primary',facing:0});
 assert.equal(meleePreview(s,a,b).valid,false);
 for(const type of ['melee','charge']){const n=actBattle(s,{type,unitId:'p',targetId:'e'});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);}
 const firearm=structuredClone(s);firearm.units[0].activeSlot='primary';
 const shot=actBattle(firearm,{type:'fire',unitId:'p',targetId:'e'});assert.ok(shot.lastError);assert.deepEqual(shot.units,firearm.units);
 const route=getReachable(s,a).find(p=>p.x===2&&p.y===4);assert.ok(route&&route.cost>0);
 const moved=actBattle(s,{type:'move',unitId:'p',x:2,y:4});assert.equal(moved.lastError,null);assert.ok(moved.units[0].ap<a.ap);assert.ok(hasLineOfSight(moved,moved.units[0],moved.units[1]));
 assert.deepEqual(actBattle(restored(s),{type:'move',unitId:'p',x:2,y:4}),moved);
});
