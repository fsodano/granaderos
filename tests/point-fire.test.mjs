import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,pointFirePreview,canSee,actionCosts} from '../game/tactical.js';
import {pointProjectileFlight} from '../game/projectile-cover.js';
import {targetPreview} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

function field(extra={}){
  const s=createBattle([{id:'p',name:'Tirador',x:1,y:3,weapon:1800,marksmanship:100,loaded:1,condition:100,experienceLevel:1}],{
    width:14,height:8,seed:45,tiles:Array.from({length:112},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,blocksSight:false,cover:0})),
    enemies:[{id:'e',name:'Oculto',x:7,y:3,hp:100,maxHp:100,overwatch:false,patrol:false,experienceLevel:1},{id:'keep',x:12,y:7,overwatch:false,patrol:false}],...extra,
  });
  for(const unit of s.units)unit.ap=100;
  return s;
}
const fire=(s,extra={})=>actBattle(s,{type:'firePoint',unitId:'p',x:7,y:3,aim:4,...extra});
const barrier=(s,material='stone')=>Object.assign(s.tiles.find(t=>t.x===5&&t.y===3),{type:'wall',blocked:true,blocksSight:true,material});
function friend(s,extra={}){const u={...structuredClone(s.units[0]),id:'friend',name:'Aliado',x:4,y:3,...extra};s.units.push(u);return u;}
function rejected(s,action){const n=fire(s,action);assert.ok(n.lastError);for(const key of ['units','seed','elapsedSeconds','smoke','groundItems','droppedWeapons','phase','interrupt','enemyTurn'])assert.deepEqual(n[key],s[key],key);}

test('location previews cannot distinguish an empty tile from an unseen occupied one',()=>{
  const s=field();barrier(s);const empty=structuredClone(s);empty.units[1].y=4;
  assert.equal(canSee(s,s.units[0],s.units[1]),false);
  const before=structuredClone(s),point={x:7,y:3};
  assert.deepEqual(pointFirePreview(s,s.units[0],point,4),pointFirePreview(empty,empty.units[0],point,4));
  const preview=targetPreview(s,s.units[0],point,{mode:'fire',aim:4});
  assert.deepEqual(preview,targetPreview(empty,empty.units[0],point,{mode:'fire',aim:4}));
  assert.equal(preview.chance,undefined);assert.equal(preview.hitLocation,undefined);assert.equal(preview.pa,36);assert.equal(preview.valid,true);assert.match(preview.coverNote,/Sin objetivo confirmado/);assert.deepEqual(s,before);
});

test('a location shot spends the shared fire and aim cost, one load and condition without moving',()=>{
  const s=field(),before=structuredClone(s),n=fire(s);
  assert.equal(n.lastError,null);assert.equal(n.units[0].ap,64);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].ammo,s.units[0].ammo);assert.equal(n.units[0].condition,99);assert.equal(n.units[0].x,1);assert.equal(n.units[0].y,3);assert.equal(n.elapsedSeconds,6);assert.equal(n.smoke.length,1);assert.ok(n.units[1].hp<100);assert.equal(n.units[0].lastTargetId,undefined);assert.equal(n.units[0].lastShotPosition,undefined);assert.deepEqual(s,before);
});

test('hard cover stops a location shot even without sight, while wood absorbs part of its force',()=>{
  const clear=field(),stone=field(),wood=field();barrier(stone);barrier(wood,'wood');
  assert.equal(canSee(wood,wood.units[0],wood.units[1]),false);
  const a=fire(clear),b=fire(stone),c=fire(wood);
  assert.equal(b.lastError,null);assert.equal(b.units[1].hp,100);assert.equal(b.units[0].loaded,0);
  assert.ok(c.units[1].hp<100);assert.ok(c.units[1].hp>a.units[1].hp);assert.equal(c.units[0].ap,64);
  assert.ok(!c.log.some(line=>line.includes('Oculto')));assert.ok(!JSON.stringify(playerKnownBattle(c)).includes('Oculto'));
});

test('the first upright allied body intercepts the shot and an obstacle beyond it does not protect it',()=>{
  const s=field();friend(s);barrier(s);
  const n=fire(s);assert.ok(n.units[3].hp<s.units[3].hp);assert.equal(n.units[1].hp,100);assert.ok(n.log.some(line=>line.includes('hiere a Aliado')));
});

test('a fixed trajectory passes above a prone body instead of homing to its torso',()=>{
  const s=field();friend(s,{stance:'prone',movementMode:'prone'});
  const n=fire(s);assert.equal(n.units[3].hp,s.units[3].hp);assert.ok(n.units[1].hp<100);
  s.units[1].stance='prone';s.units[1].movementMode='prone';const both=fire(s);assert.equal(both.units[1].hp,100);assert.equal(both.units[3].hp,s.units[3].hp);
});

test('moved targets, dead bodies and departed soldiers do not pull the projectile off its path',()=>{
  const s=field();s.units[1].y=4;friend(s,{hp:0,unconscious:true});
  const n=fire(s);assert.equal(n.units[1].hp,100);assert.equal(n.units[3].hp,0);
  s.units[3].hp=100;s.units[3].fled=true;const departed=fire(s);assert.equal(departed.units[3].hp,100);
  assert.equal(departed.units[0].skillPractice?.marksmanship,s.units[0].skillPractice?.marksmanship);
});

test('seeded misses scatter to another cell and can strike someone outside the intended line',()=>{
  const s=field({seed:3});s.units[0].marksmanship=0;friend(s,{x:8,y:4});
  const n=fire(s,{aim:0});assert.equal(n.lastError,null);assert.equal(n.units[1].hp,100);assert.ok(n.units[3].hp<s.units[3].hp);assert.equal(n.units[0].loaded,0);assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{aim:0}),n);
});

test('finite blunderbuss pellets stop in wood and stone while pre-cover friendly injuries remain real',()=>{
  const s=field();s.units[0].weapon=1807;friend(s);s.units[1].x=6;barrier(s);
  const blocked=fire(s,{aim:0});assert.equal(blocked.lastError,null);assert.equal(blocked.units[1].hp,100);assert.ok(blocked.units[3].hp<s.units[3].hp);assert.equal(blocked.units[0].loaded,0);
  const wall=s.tiles.find(t=>t.x===5&&t.y===3);wall.material='wood';const wood=fire(s,{aim:0});assert.equal(wood.units[1].hp,100);assert.equal(wood.units[3].hp,blocked.units[3].hp);assert.ok(!wood.log.some(line=>line.includes('Oculto')));
  const hay=structuredClone(s);hay.units=hay.units.filter(u=>u.id!=='friend');hay.tiles.find(t=>t.x===5&&t.y===3).material='hay';const passed=fire(hay,{aim:4});assert.ok(passed.units[1].hp<100);assert.equal(passed.units[0].loaded,0);assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(hay))),{aim:4}),passed);
});

test('zero-depth corner cover, actual wall crossings and posture use the shared location geometry',()=>{
  const s=field();Object.assign(s.units[0],{x:1,y:1});Object.assign(s.units[1],{x:3,y:3});
  Object.assign(s.tiles.find(t=>t.x===2&&t.y===1),{blocked:true,type:'wall',material:'stone'});
  const tangent=pointProjectileFlight(s,s.units[0],{x:3,y:3},{damage:58});assert.equal(tangent.blocked,false);assert.equal(tangent.victimId,'e');assert.equal(tangent.damageFactor,1);
  Object.assign(s.tiles.find(t=>t.x===2&&t.y===2),{blocked:true,type:'wall',material:'stone'});
  const trace=pointProjectileFlight(s,s.units[0],{x:3,y:3},{damage:58});assert.equal(trace.blocked,true);assert.equal(trace.victimId,null);
  const window=field();Object.assign(window.tiles.find(t=>t.x===2&&t.y===3),{type:'window',blocked:true,blocksSight:false});
  assert.equal(pointProjectileFlight(window,window.units[0],{x:7,y:3},{damage:58}).blocked,false);
  window.units[0].stance='prone';assert.equal(pointProjectileFlight(window,window.units[0],{x:7,y:3},{damage:58}).blocked,true);
});

test('invalid point orders roll back equipment, RNG, time and tactical continuation',()=>{
  for(const action of [{x:-1},{x:14},{x:1.5},{x:'7'},{y:NaN},{x:1,y:3},{targetId:'e'},{hitLocation:'head'}])rejected(field(),action);
  for(const patch of [{ap:35},{activeSlot:'medical'},{loaded:0},{jammed:true},{knockedDown:true},{hp:0,unconscious:true},{routed:true},{surrendered:true}]){const s=field();Object.assign(s.units[0],patch);rejected(s,{});}
  const enemy=field();enemy.phase='enemy';rejected(enemy,{});
});

test('failed ignition keeps the load and reserve ammunition but consumes the attempted shot cost',()=>{
  const s=field();s.weather.rain=100;s.weather.humidity=100;
  const n=fire(s);assert.equal(n.lastError,null);assert.equal(n.units[0].jammed,true);assert.equal(n.units[0].loaded,1);assert.equal(n.units[0].ammo,s.units[0].ammo);assert.equal(n.units[0].condition,100);assert.equal(n.units[0].ap,64);assert.equal(n.smoke.length,0);assert.equal(n.units[1].hp,100);
});

test('empty exploration fire spends real time without free target practice or combat AP loss',()=>{
  const s=field({exploration:true,enemies:[]});barrier(s);s.units[0].marksmanship=40;
  const n=fire(s);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,100);assert.equal(n.units[0].loaded,0);assert.equal(n.elapsedSeconds,3);assert.equal(n.units[0].marksmanship,40);assert.deepEqual(n.units[0].skillPractice,s.units[0].skillPractice);
});

test('later bleeding ticks do not identify a casualty hidden behind a wall',()=>{
  const s=field();barrier(s,'wood');for(const enemy of s.units.filter(u=>u.side==='enemy'))enemy.ap=0;const n=fire(s);assert.ok(n.units[1].bleeding>0);
  const advanced=endTurn(n);assert.ok(!advanced.log.some(line=>line.includes('Oculto')));assert.ok(advanced.units[1].hp<n.units[1].hp);
});

test('a real interrupt accepts a location shot and survives save and deterministic continuation',()=>{
  // A sabre user must approach; a held facon can now throw from this position.
  const s=field({enemies:[{id:'e',x:7,y:3,weapon:1809,experienceLevel:1,agility:30,patrol:false}]});Object.assign(s.units[0],{agility:100,experienceLevel:10,ap:40});s.units[1].ap=24;
  const paused=endTurn(s);assert.equal(paused.phase,'interrupt');const n=fire(paused,{x:12,y:6,aim:0});assert.equal(n.lastError,null);assert.equal(n.phase,'interrupt');assert.equal(n.units[0].ap,paused.units[0].ap-actionCosts(paused,paused.units[0]).fire);assert.equal(n.elapsedSeconds,paused.elapsedSeconds);
  assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),{x:12,y:6,aim:0}),n);assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(n)))),endTurn(n));
});

test('location firing retains costs and equipment through actual campaign save and reload',()=>{
  const c=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(c.lastError,null);let b=enterSector(c.pendingBattle);const u=b.units.find(v=>v.id==='4');
  const destination=b.tiles.find(t=>Math.hypot(t.x-u.x,t.y-u.y)>4&&!b.units.some(v=>v.x===t.x&&v.y===t.y));
  b=actBattle(b,{type:'firePoint',unitId:u.id,x:destination.x,y:destination.y});assert.equal(b.lastError,null);
  const pair=syncBattleTime(c,b);assert.equal(pair.error,null);const loaded=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(loaded.battle.units,pair.battle.units);assert.equal(loaded.battle.elapsedSeconds,pair.battle.elapsedSeconds);assert.equal(loaded.battle.seed,pair.battle.seed);
});
