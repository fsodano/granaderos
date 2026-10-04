import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,actionCosts,firearmShotOptions,canSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const second=(extra={})=>({weapon:1808,count:1,weight:1.3,loaded:2,condition:100,jammed:false,instanceId:'left-pistol',...extra});
function field(target={},actor={}){
 const s=createBattle([{id:'p',x:8,y:3,facing:6,hp:100,maxHp:100,weapon:1800,loaded:0,experienceLevel:1,...target}],{
  width:24,height:10,seed:45,tiles:Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',x:2,y:3,facing:2,weapon:1805,weaponInstanceId:'right-pistol',loaded:1,ammo:0,condition:100,marksmanship:100,experienceLevel:1,offHand:second(),patrol:false,...actor}],
 });enemy(s).ap=actor.ap??20;return s;
}
const enemy=s=>s.units.find(u=>u.id==='e');
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));

test('AI values both owned pistol impacts when choosing a body region and preserves the single-pistol choice',()=>{
 const s=field({hp:80}),u=enemy(s),before=structuredClone(s),pair=chooseEnemyAction(s,u),single=chooseEnemyAction(s,{...u,leftHandItem:null});
 assert.deepEqual(pair,{type:'fire',unitId:'e',targetId:'p',aim:2,hitLocation:'torso'});
 assert.deepEqual(single,{type:'fire',unitId:'e',targetId:'p',aim:2,hitLocation:'head'});
 assert.ok(actionCosts(s,u,s.units[0]).fire+pair.aim*actionCosts(s,u,s.units[0]).aim<=u.ap);assert.deepEqual(s,before);
});

test('AI can select a useful second-pistol shot when the main projectile stops in the same cover',()=>{
 const s=field({hp:16},{weapon:1806,offHand:second({weapon:1805,loaded:1}),ap:13}),u=enemy(s);
 Object.assign(s.tiles.find(t=>t.x===7&&t.y===3),{type:'wall',material:'wood',blocked:true,blocksSight:false,obstacleHeight:3,projectileResistance:38});
 assert.equal(canSee(s,u,s.units[0]),true);const before=structuredClone(s),choice=chooseEnemyAction(s,u);
 assert.deepEqual(choice,{type:'fire',unitId:'e',targetId:'p',aim:2,hitLocation:'head'});
 const selected=firearmShotOptions(s,u,s.units[0],2).find(o=>o.aim===choice.aim&&o.hitLocation===choice.hitLocation);assert.equal(selected.chance,0);assert.ok(selected.shots[1].chance>0);assert.ok(selected.shots[1].damageFactor>0);
 assert.notEqual(chooseEnemyAction(s,{...u,leftHandItem:null})?.type,'fire');assert.deepEqual(s,before);
});

test('unavailable second pistols preserve ordinary AI aim and empty-main maintenance',()=>{
 for(const extra of [{offHand:second({loaded:0,reloadProgress:.5})},{offHand:second({jammed:true})},{offHand:second({condition:0})},{leftHandItem:null}]){
  const s=field({},extra),u=enemy(s),before=structuredClone(s);assert.deepEqual(chooseEnemyAction(s,u),chooseEnemyAction(s,{...u,offHand:undefined,leftHandItem:null}));assert.deepEqual(s,before);
 }
 for(const patch of [{loaded:0,ammo:1,ap:32},{jammed:true,priming:1,ap:100}]){
  const s=field({},patch),u=enemy(s),choice=chooseEnemyAction(s,u);assert.equal(choice.type,patch.jammed?'reprime':'reload');assert.deepEqual(choice,chooseEnemyAction(s,{...u,offHand:undefined,leftHandItem:null}));
 }
});

test('AI paired choices use known bodies and do not read hidden targets or private supplies',()=>{
 const s=field(),other=structuredClone(s);Object.assign(other.units[0],{energy:2,ammo:500,medical:99,inventory:{secret:{count:1,weight:1}}});
 other.units.push({...structuredClone(other.units[0]),id:'hidden',x:23,y:9,hp:100});assert.equal(canSee(other,enemy(other),other.units[2]),false);
 assert.deepEqual(chooseEnemyAction(other,enemy(other)),chooseEnemyAction(s,enemy(s)));
 const obstructed=field({stance:'prone',movementMode:'prone'},{ap:8});obstructed.units.push({...structuredClone(enemy(obstructed)),id:'friend',x:5,y:3,offHand:undefined,weaponInstanceId:'friend-gun'});
 const options=firearmShotOptions(obstructed,enemy(obstructed),obstructed.units[0],0);assert.ok(options.every(o=>o.shots.every(shot=>shot.interveningFriendly)));assert.ok(options.some(o=>o.shots.some(shot=>shot.conditional&&shot.chance>0)));assert.notEqual(chooseEnemyAction(obstructed,enemy(obstructed))?.type,'fire');
});

test('a real enemy turn pays the paired order once and replays each physical gun across a save',()=>{
 const s=field({hp:250,maxHp:250},{ap:14}),u=enemy(s),choice=chooseEnemyAction(s,u),before=structuredClone(s);
 assert.equal(choice.type,'fire');assert.equal(actionCosts(s,u,s.units[0]).fire+choice.aim*actionCosts(s,u,s.units[0]).aim,u.ap);
 const next=endTurn(s),after=enemy(next);assert.equal(next.lastError,null);assert.equal(after.loaded,0);assert.equal(after.offHand.loaded,1);assert.equal(after.ammo,0);assert.equal(after.condition,99);assert.equal(after.offHand.condition,99);assert.equal(after.weaponInstanceId,'right-pistol');assert.equal(after.offHand.instanceId,'left-pistol');assert.equal(after.ap,0);assert.ok(next.units[0].hp<250);assert.equal(next.elapsedSeconds,6);
 assert.deepEqual(next,endTurn(restore(s)));assert.doesNotThrow(()=>restore(next));assert.deepEqual(s,before);
});
