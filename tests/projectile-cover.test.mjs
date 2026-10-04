import test from 'node:test';
import assert from 'node:assert/strict';
import {projectileCells,projectileFlight,concealmentAt} from '../game/projectile-cover.js';
import {createBattle,actBattle,presentedActBattle,shotChance,canSee,hasLineOfSight,firearmProjectilePath} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview} from '../game/ja2-hud.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {playerKnownBattle} from '../game/player-known-state.js';

function field(extra={}){
  return createBattle([{id:'p',x:1,y:3,weapon:1800,marksmanship:100,loaded:1,condition:100,experienceLevel:1}],{
    width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
    enemies:[{id:'e',x:7,y:3,hp:100,maxHp:100,overwatch:false,patrol:false,experienceLevel:1}],...extra,
  });
}
function order(s,action){const next=actBattle(s,{unitId:'p',...action});assert.equal(next.lastError,null,next.lastError);return next;}
const lowWall=(s,extra={})=>Object.assign(s.tiles.find(tile=>tile.x===6&&tile.y===3),{type:'wall',blocked:true,blocksSight:false,material:'stone',obstacleHeight:.8,...extra});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
// The ordinary torso ray drops .3 across six horizontal cells.
const torsoLengthPerX=Math.hypot(1,.3/6);

test('projectile traversal includes narrow diagonal corners in both directions without repeated cells',()=>{
  const forward=projectileCells({x:1,y:1},{x:3,y:3}),back=projectileCells({x:3,y:3},{x:1,y:1});
  assert.ok(forward.some(cell=>cell.x===2&&cell.y===1));assert.ok(forward.some(cell=>cell.x===1&&cell.y===2));
  assert.equal(new Set(forward.map(cell=>`${cell.x},${cell.y}`)).size,forward.length);
  for(const cell of forward.filter(cell=>cell.x!==3||cell.y!==3))assert.ok(back.some(other=>other.x===cell.x&&other.y===cell.y));
  assert.deepEqual(projectileCells({x:1,y:1},{x:1,y:1}),[]);
});

test('visible head and torso can be exposed above cover while a leg shot stops in stone',()=>{
  const s=field(),[a,b]=s.units;lowWall(s);
  assert.equal(canSee(s,a,b),true);assert.equal(hasLineOfSight(s,a,b),true);
  assert.equal(firearmProjectilePath(s,a,b,'head').blocked,false);assert.equal(firearmProjectilePath(s,a,b,'torso').blocked,false);
  assert.equal(firearmProjectilePath(s,a,b,'legs').blocked,true);assert.equal(shotChance(s,a,b,0,'legs'),0);assert.ok(shotChance(s,a,b,0,'torso')>0);
});

test('a deliberate blocked shot spends its charge and AP but cannot damage through stone',()=>{
  const s=field();lowWall(s);const after=order(s,{type:'fire',targetId:'e',hitLocation:'legs',aim:4});
  assert.equal(after.units[1].hp,100);assert.equal(after.units[0].loaded,0);assert.equal(after.units[0].ap,s.units[0].ap-36);assert.equal(after.units[0].condition,99);
  assert.ok(after.log.some(message=>message.includes('cobertura detiene')));assert.equal(after.units[0].ammo,s.units[0].ammo);
});

test('wood spends its actual depth once across a furniture footprint and separate barriers add force loss',()=>{
  const clear=field(),wood=field({props:[{id:'barrels',type:'barrels',x:5,y:3,footprint:{width:2,height:1},obstacleHeight:2}]});
  const trace=firearmProjectilePath(wood,...wood.units);assert.equal(trace.obstacles.length,1);close(trace.damageFactor,(58-24*2*torsoLengthPerX)/58);
  const direct=order(clear,{type:'fire',targetId:'e',aim:4}),through=order(wood,{type:'fire',targetId:'e',aim:4});
  assert.ok(through.units[1].hp>direct.units[1].hp);assert.ok(through.units[1].hp<100);
  assert.deepEqual(presentedActBattle(wood,{unitId:'p',type:'fire',targetId:'e',aim:4}).state,through);
  assert.deepEqual(order(validateBattleSnapshot(JSON.parse(JSON.stringify(wood))),{type:'fire',targetId:'e',aim:4}),through);
  wood.props.push({id:'second',type:'barrels',x:4,y:3,obstacleHeight:2},{id:'third',type:'barrels',x:3,y:3,obstacleHeight:2});
  assert.equal(firearmProjectilePath(wood,...wood.units).blocked,true);
});

test('shooter posture and window sills change the path without treating an open window as a full wall',()=>{
  const s=field(),[a,b]=s.units;Object.assign(s.tiles.find(tile=>tile.x===2&&tile.y===3),{type:'window',blocked:true,blocksSight:false,material:'adobe'});
  assert.equal(firearmProjectilePath(s,a,b).blocked,false);
  assert.equal(firearmProjectilePath(s,{...a,stance:'prone'},b).blocked,true);
  const door=s.tiles.find(tile=>tile.x===2&&tile.y===3);Object.assign(door,{type:'door',open:true,blocked:false});
  assert.equal(firearmProjectilePath(s,{...a,stance:'prone'},b).blocked,false);
});

test('concealment can hide a distant soldier and reduce aim without absorbing a projectile',()=>{
  const s=field(),[a,b]=s.units;a.x=0;b.x=11;
  const ground=s.tiles.find(tile=>tile.x===b.x&&tile.y===b.y),baseline=shotChance(s,a,b);
  Object.assign(ground,{type:'scrub',concealment:80});
  assert.equal(concealmentAt(s,b),80);assert.equal(canSee(s,a,{...b,stance:'prone'}),false);
  assert.ok(shotChance(s,a,b)<baseline);assert.equal(firearmProjectilePath(s,a,b).damageFactor,1);
  const before=structuredClone(s);firearmProjectilePath(s,a,b);assert.deepEqual(s,before);
});

test('hay and wood have different resistance while distant props outside the ray have none',()=>{
  const s=field({props:[{id:'screen',type:'hay',x:6,y:3}]});
  close(firearmProjectilePath(s,...s.units).damageFactor,(58-3*torsoLengthPerX)/58);
  s.props[0].type='barrels';close(firearmProjectilePath(s,...s.units).damageFactor,(58-24*torsoLengthPerX)/58);
  s.props[0].y=4;assert.equal(firearmProjectilePath(s,...s.units).damageFactor,1);
});

test('a zero-length corner touch costs no material force but an actual diagonal wall crossing stops the ball',()=>{
  const s=field(),[a,b]=s.units;Object.assign(a,{x:1,y:1});Object.assign(b,{x:3,y:3});
  Object.assign(s.tiles.find(tile=>tile.x===2&&tile.y===1),{type:'wall',blocked:true,material:'stone'});
  assert.equal(hasLineOfSight(s,a,b),true);assert.equal(firearmProjectilePath(s,a,b).blocked,false);assert.equal(firearmProjectilePath(s,a,b).damageFactor,1);
  Object.assign(s.tiles.find(tile=>tile.x===2&&tile.y===2),{type:'wall',blocked:true,material:'stone'});
  assert.equal(firearmProjectilePath(s,a,b).blocked,true);
});

test('thin, deep and oblique paths lose force according to their crossed three-dimensional lengths',()=>{
  const barrier=(width=1)=>({id:'screen',type:'barrels',x:3,y:0,footprint:{width,height:8},obstacleHeight:2,projectileResistance:12,blocksSight:false});
  const thin=field({props:[barrier()]}),deep=field({props:[barrier(2)]}),angled=field({props:[barrier()]});angled.units[1].y=6;
  const t=firearmProjectilePath(thin,...thin.units),d=firearmProjectilePath(deep,...deep.units),a=firearmProjectilePath(angled,...angled.units);
  close(t.damageFactor,(58-12*torsoLengthPerX)/58);close(d.damageFactor,(58-24*torsoLengthPerX)/58);
  close(a.damageFactor,(58-12*Math.hypot(1,.5,.05))/58);assert.ok(d.damageFactor<a.damageFactor&&a.damageFactor<t.damageFactor);
  for(const s of [thin,deep,angled]){const before=structuredClone(s);firearmProjectilePath(s,...s.units);assert.deepEqual(s,before,'forecast makes no random or physical changes');}
});

test('height clipping spends only the part below the cover top and a deeper barrier stops at the exact interior point',()=>{
  const clipped=field({props:[{id:'low-screen',type:'hay',x:3,y:3,obstacleHeight:1.3,projectileResistance:12}]}),path=firearmProjectilePath(clipped,...clipped.units);
  // Height reaches1.3 at x3, halfway through the cell from2.5 to3.5.
  close(path.damageFactor,(58-12*.5*torsoLengthPerX)/58);
  const deep=field({props:[{id:'deep-screen',type:'barrels',x:3,y:3,footprint:{width:4,height:1},obstacleHeight:2,projectileResistance:24}]}),flight=projectileFlight(deep,...deep.units,{damage:58,range:18});
  const stopX=2.5+58/(24*torsoLengthPerX);assert.equal(flight.bodyImpacts.length,0);assert.equal(flight.terminal.blocked,true);assert.equal(flight.terminal.remainingImpact,0);
  close(flight.terminal.impact.x,stopX);close(flight.terminal.impact.height,1.4-.05*(stopX-1));assert.ok(stopX>2.5&&stopX<6.5);
});

test('an embedded body receives only entry-to-body loss before the remaining cover consumes the continued ball',()=>{
  const s=field({props:[{id:'screen',type:'hay',x:3,y:3,footprint:{width:4,height:1},obstacleHeight:2,projectileResistance:12,blocksMovement:false}]});
  s.units.push({...structuredClone(s.units[0]),id:'inside',x:4,y:3});const before=structuredClone(s),flight=projectileFlight(s,s.units[0],s.units[1],{damage:58,range:18});
  const hit=flight.bodyImpacts.find(hit=>hit.victimId==='inside');assert.ok(hit);close(hit.incomingImpact,58-12*torsoLengthPerX);close(hit.impact.x,3.5);
  assert.equal(flight.bodyImpacts.some(hit=>hit.victimId==='e'),false);assert.equal(flight.terminal.remainingImpact,0);
  close(flight.terminal.impact.x,3.5+(58-12*torsoLengthPerX-30)/(12*torsoLengthPerX));assert.deepEqual(s,before);
});

test('overlapping distinct materials add their lengths while a shared prop spanning cells is not debited twice',()=>{
  const s=field({props:[{id:'one',type:'hay',x:3,y:3,footprint:{width:2,height:1},obstacleHeight:2,projectileResistance:5},{id:'two',type:'barrels',x:4,y:3,footprint:{width:2,height:1},obstacleHeight:2,projectileResistance:7}]}),path=firearmProjectilePath(s,...s.units);
  close(path.damageFactor,(58-(5*2+7*2)*torsoLengthPerX)/58);assert.equal(path.obstacles.length,2);
  const permuted={...s,props:[...s.props].reverse()};assert.deepEqual(firearmProjectilePath(permuted,...permuted.units),path);
});

test('HUD reports obstruction as a paid shot warning and retains independent body targeting',()=>{
  const s=field(),[a,b]=s.units;lowWall(s);const before=structuredClone(s);
  const legs=targetPreview(s,a,b,{mode:'fire',hitLocation:'legs'});
  assert.equal(legs.valid,true);assert.equal(legs.chance,0);assert.match(legs.coverNote,/detiene.*consume la carga/);
  assert.match(targetPreview(s,a,b,{mode:'fire',hitLocation:'head'}).coverNote,/^Preparar: 6 PA · disparar: 6 PA\. Distancia: 6 casillas · alcance del arma: 18\.$/);assert.deepEqual(s,before);
});

test('blocked shots and cover metadata replay across tactical saves while malformed overrides reject',()=>{
  const s=field();lowWall(s);
  assert.deepEqual(order(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{type:'fire',targetId:'e',hitLocation:'legs',aim:4}),order(s,{type:'fire',targetId:'e',hitLocation:'legs',aim:4}));
  for(const [key,value]of [['obstacleHeight',-1],['obstacleHeight',11],['projectileResistance','24'],['concealment',101]]){
    const bad=field();bad.tiles[0][key]=value;assert.throws(()=>validateBattleSnapshot(bad));
    const prop=field({props:[{id:'bad',type:'table',x:4,y:3,[key]:value}]});assert.throws(()=>validateBattleSnapshot(prop));
  }
});

test('enemy scoring does not choose to fire a blocked torso shot when no AP remain for movement',()=>{
  const s=field(),[a,b]=s.units;Object.assign(a,{stance:'prone'});Object.assign(b,{ap:12,loaded:1,marksmanship:100,activeSlot:'primary'});lowWall(s,{obstacleHeight:1.3});
  const before=structuredClone(s),action=chooseEnemyAction(s,b);assert.notEqual(action?.type,'fire');assert.deepEqual(s,before);
});

test('blunderbuss spread traces each victim and cannot damage a friend or enemy through hard cover',()=>{
  const s=field({props:[{id:'barrier',type:'barrels',x:4,y:3,material:'stone',obstacleHeight:2}]});
  Object.assign(s.units[0],{weapon:1807});s.units[1].x=6;
  s.units.push({...structuredClone(s.units[0]),id:'friend',x:5,y:3});
  const next=order(s,{type:'fire',targetId:'e',aim:4});
  assert.equal(next.units[1].hp,100);assert.equal(next.units[2].hp,s.units[2].hp);assert.equal(next.units[0].loaded,0);
});

test('a successful breach removes the original ballistic overrides and leaves only low rubble',()=>{
  const s=field(),wall=s.tiles.find(tile=>tile.x===2&&tile.y===3);
  Object.assign(wall,{type:'wall',blocked:true,blocksSight:true,material:'adobe',obstacleHeight:2.5,projectileResistance:500});
  const next=order(s,{type:'breach',x:2,y:3}),rubble=next.tiles.find(tile=>tile.x===2&&tile.y===3);
  assert.equal(rubble.type,'rubble');assert.equal(rubble.obstacleHeight,undefined);assert.equal(rubble.projectileResistance,undefined);
  assert.equal(firearmProjectilePath(next,...next.units).blocked,false);assert.equal(firearmProjectilePath(next,...next.units).damageFactor,1);
});

test('the public order projection explains visible cover without exposing internal obstruction records',()=>{
  const s=field();lowWall(s,{obstacleHeight:1.3});
  const known=playerKnownBattle(s),target=known.orders.find(order=>order.unitId==='p').targets.find(target=>target.targetId==='e');
  assert.equal(target.chance,0);assert.match(target.coverNote,/cobertura detiene/);assert.equal(target.obstacles,undefined);
});
