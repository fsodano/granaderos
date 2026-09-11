import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,itemUsePreview,movementStepCost,canSee} from '../game/tactical.js';
import {targetPreview,orderDescriptors} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field(actor={},patient={},extra={}){
  const s=createBattle([{id:'p',name:'Médico',x:2,y:2,activeSlot:'medical',medical:60,medkits:2,...actor},{id:'q',name:'Herido',x:6,y:2,hp:50,bleeding:4,...patient}],{
    width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===10?'wall':'grass',blocked:i%16===10,blocksSight:i%16===10,cover:0})),enemies:[{id:'e',x:14,y:8,patrol:false,overwatch:false}],...extra,
  });
  s.units[0].ap=actor.ap??60;s.units[1].ap=0;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;return s;
}
const use=s=>actBattle(s,{type:'useItem',unitId:'p',targetId:'q'});
const plan=s=>itemUsePreview(s,s.units[0],s.units[1]);
const reject=s=>{const n=use(s);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);};

test('one medical target click equals the actual movement and local treatment orders',()=>{
  const s=field(),p=plan(s),before=structuredClone(s);
  assert.equal(p.valid,true);assert.equal(p.movePa,24);assert.equal(p.actionPa,25);assert.equal(p.pa,49);assert.deepEqual(p.destination,{x:5,y:2});
  const manual=actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),{type:'heal',unitId:'p',targetId:'q'}),n=use(s);
  assert.deepEqual(n,manual);assert.equal(n.units[0].ap,11);assert.equal(n.units[0].medkits,1);assert.equal(n.units[1].hp,50);assert.equal(n.units[1].bleeding,0);assert.equal(n.elapsedSeconds,6);assert.deepEqual(s,before);
});

test('melee targeting walks and strikes while keeping unused AP instead of issuing a charge',()=>{
  const s=field({weapon:1813,activeSlot:'primary'});Object.assign(s.units[1],{side:'enemy',hp:100,bleeding:0,overwatch:false});
  const p=plan(s),n=use(s),manual=actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),{type:'melee',unitId:'p',targetId:'q'});
  assert.equal(p.pa,32);assert.deepEqual(n,manual);assert.equal(n.units[0].ap,28);assert.ok(n.units[1].hp<100);assert.equal(n.units[0].medkits,2);assert.ok(!n.log.some(line=>line.includes('ejecuta una carga')));
});

test('a prepared firearm keeps its normal ranged use and direct aliases stay local',()=>{
  const s=field({weapon:1800,activeSlot:'primary'});s.units[1].side='enemy';s.units[1].patrol=false;assert.equal(plan(s),null);
  const n=use(s);assert.equal(n.units[0].x,2);assert.equal(n.units[0].loaded,0);
  const medical=field(),bad=actBattle(medical,{type:'heal',unitId:'p',targetId:'q'});assert.ok(bad.lastError);assert.deepEqual(bad.units,medical.units);
  s.units[0].activeSlot='blade';s.units[0].blade=1813;const blade=actBattle(s,{type:'melee',unitId:'p',targetId:'q'});assert.ok(blade.lastError);assert.deepEqual(blade.units,s.units);
});

test('empty-handed targeting approaches and punches without spending the holstered firearm charge',()=>{
  const s=field({activeSlot:'unarmed',strength:100,dexterity:100,agility:100});Object.assign(s.units[1],{side:'enemy',hp:100,bleeding:0,patrol:false,overwatch:false,agility:1,dexterity:1,energy:100});
  const p=plan(s),n=use(s);assert.equal(p.movePa,24);assert.equal(p.actionPa,12);assert.equal(n.lastError,null);assert.equal(n.units[0].x,5);assert.equal(n.units[0].ap,24);assert.equal(n.units[0].loaded,s.units[0].loaded);assert.equal(n.units[0].ammo,s.units[0].ammo);assert.equal(n.units[0].activeSlot,'unarmed');assert.ok(n.units[1].hp<100);assert.ok(n.units[1].energy<90);
});

test('insufficient total AP, missing supplies, invalid patients and immobility reject atomically',()=>{
  const short=field({ap:48});assert.equal(plan(short).pa,49);assert.equal(plan(short).valid,false);assert.equal(targetPreview(short,short.units[0],short.units[1]).pa,49);
  for(const patch of [{ap:48},{medkits:0},{medical:0},{knockedDown:true},{entangled:true},{energy:0}])reject(field(patch));
  for(const patch of [{hp:0},{routed:true},{bleeding:0,bandaged:50},{departure:{edge:'E'}}])reject(field({},patch));
  const s=field();s.tiles.filter(t=>t.x===4).forEach(t=>{t.blocked=true;t.blocksSight=true;t.type='wall';});reject(s);
});

test('approach paths respect blocked corners and allow a paid detour',()=>{
  const s=field({ap:90},{x:5,y:4});Object.assign(s.tiles.find(t=>t.x===3&&t.y===2),{blocked:true,type:'wall',blocksSight:true});
  const p=plan(s);assert.equal(p.valid,true);let previous=s.units[0];for(const point of p.path){assert.ok(Number.isFinite(movementStepCost(s,s.units[0],previous,point)));previous=point;}
  const n=use(s);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,90-p.pa);assert.equal(n.units[1].bleeding,0);
});

test('exploration charges every walking second and then treatment without charging combat AP',()=>{
  const s=field({}, {},{exploration:true}),p=plan(s),n=use(s);
  assert.equal(p.movePa,24);assert.equal(n.elapsedSeconds,11);assert.equal(n.units[0].ap,60);assert.equal(n.units[1].hp,46);assert.equal(n.units[1].bleeding,0);assert.equal(n.units[1].bandaged,54);assert.equal(n.units[0].medkits,1);
  assert.deepEqual(n,actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),{type:'heal',unitId:'p',targetId:'q'}));
});

test('collapse or patient death during exploration preserves the walked cost and does not consume dressings',()=>{
  const tired=field({energy:2},{},{exploration:true}),n=use(tired);assert.equal(n.lastError,null);assert.ok(n.units[0].x>2&&n.units[0].x<5);assert.equal(n.units[0].unconscious,true);assert.equal(n.units[0].medkits,2);assert.ok(n.elapsedSeconds>0);assert.ok(n.units[1].bleeding>0);
  const dying=field({}, {hp:4,bleeding:4},{exploration:true}),after=use(dying);assert.equal(after.lastError,null);assert.equal(after.units[1].hp,0);assert.equal(after.units[0].medkits,2);assert.ok(after.elapsedSeconds>0);assert.doesNotThrow(()=>validateBattleSnapshot(after));
});

test('a reaction on the final approach tile still cancels the queued treatment',()=>{
  const s=field({agility:30,experienceLevel:1},{x:4,y:2},{enemies:[{id:'e',x:6,y:2,facing:6,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});s.units[2].ap=6;
  const n=use(s);assert.equal(n.lastError,null);assert.equal(n.units[0].x,3);assert.equal(n.units[2].reactionTurn,1);assert.equal(n.units[0].medkits,2);assert.equal(n.units[1].hp,0,'the intervening patient takes the reaction shot');assert.equal(n.units[1].bleeding,0);assert.ok(n.units[0].ap<60);assert.equal(n.elapsedSeconds,6);
});

test('a hidden blocker does not alter the preview or make the executed approach secretly reroute',()=>{
  const s=field({facing:6},{hp:10},{enemies:[{id:'hidden',x:5,y:2,facing:2,patrol:false,overwatch:false}]});
  assert.equal(canSee(s,s.units[0],s.units[2]),false);const p=plan(s),other=structuredClone(s);other.units[2].x=14;other.units[2].y=8;assert.deepEqual(plan(other),p);
  const n=use(s);assert.equal(n.lastError,null);assert.equal(n.units[0].x,4);assert.equal(n.units[0].y,2);assert.equal(n.units[0].medkits,2);assert.equal(n.units[0].ap,44);assert.ok(n.log.some(line=>line.includes('ruta está bloqueada')));
});

test('a visible contact during exploration stops the approach before item use',()=>{
  const s=field({facing:6},{hp:10},{exploration:true,enemies:[{id:'e',x:7,y:2,facing:2,patrol:false,overwatch:false}]});
  assert.equal(s.mode,'exploration');const n=use(s);assert.equal(n.mode,'combat');assert.equal(n.units[0].x,3);assert.equal(n.units[0].medkits,2);assert.equal(n.units[1].bleeding,4);assert.equal(n.elapsedSeconds,3);
});

test('an approach and aid fit within a saved real player interrupt and preserve its continuation',()=>{
  const s=field({x:1,y:1,agility:100,experienceLevel:10},{x:4,y:4,hp:10},{enemies:[{id:'e',x:7,y:1,weapon:1813,agility:30,experienceLevel:1,patrol:false}]});s.units[2].ap=24;
  const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.ok(paused.interrupt.unitIds.includes('p'));
  const treated=use(paused);assert.equal(treated.lastError,null);assert.equal(treated.phase,'interrupt');assert.equal(treated.units[0].medkits,1);assert.equal(treated.units[1].bleeding,0);assert.equal(treated.elapsedSeconds,6);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(treated)));assert.deepEqual(endTurn(restored),endTurn(treated));assert.deepEqual(use(validateBattleSnapshot(JSON.parse(JSON.stringify(paused)))),treated);
});

test('target and public previews disclose combined AP and the interruption risk without a new action button',()=>{
  const s=field(),p=targetPreview(s,s.units[0],s.units[1]);assert.equal(p.valid,true);assert.equal(p.pa,49);assert.equal(p.remaining,11);assert.equal(p.actionLabel,'Acercarse y vendar');assert.match(p.coverNote,/24 PA.*25 PA/);
  const descriptor=orderDescriptors(s,s.units[0],{target:s.units[1]}).find(o=>o.id==='useItem');assert.equal(descriptor.pa,49);assert.equal(descriptor.disabled,false);
  const view=playerKnownBattle(s),target=view.orders.find(o=>o.unitId==='p').targets.find(t=>t.targetId==='q');assert.equal(target.pa,49);assert.match(target.coverNote,/contacto/);assert.equal(target.path,undefined);
});
