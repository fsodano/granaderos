import test from 'node:test';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import assert from 'node:assert/strict';
import {createBattle,actBattle,shotChance,firearmShotOptions,firearmProjectilePath,actionCosts,endTurn,canSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field(target={},actor={},extra={}){
  const state=createBattle([{id:'p',x:8,y:3,hp:100,maxHp:100,weapon:1800,loaded:0,experienceLevel:1,...target}],{
    width:24,height:10,seed:45,tiles:Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
    enemies:[{id:'e',x:2,y:3,facing:2,weapon:1800,marksmanship:100,condition:100,loaded:1,ap:12,patrol:false,...actor}],...extra,
  });
  state.units.find(u=>u.id==='e').ap=actor.ap??12;
  return state;
}
const actor=s=>s.units.find(u=>u.id==='e');
const wall=s=>Object.assign(s.tiles.find(t=>t.x===7&&t.y===3),{type:'wall',material:'stone',blocked:true,blocksSight:false,obstacleHeight:1.3});

test('shot option batches agree with shared chance and current geometry for every aim and body region',()=>{
  const s=field(),u=actor(s),target=s.units[0];wall(s);const before=structuredClone(s);
  const options=firearmShotOptions(s,u,target);assert.equal(options.length,15);
  for(const option of options){assert.equal(option.chance,shotChance(s,u,target,option.aim,option.hitLocation));assert.equal(option.damageFactor,firearmProjectilePath(s,u,target,option.hitLocation).damageFactor);}
  assert.deepEqual(s,before);s.tiles.find(t=>t.x===7&&t.y===3).obstacleHeight=0;
  assert.ok(firearmShotOptions(s,u,target).find(o=>o.hitLocation==='torso').chance>0,'a fresh call observes the changed obstacle');
});

test('a visible exposed head is selected when hard cover blocks the torso and legs',()=>{
  const s=field();wall(s);const u=actor(s),before=structuredClone(s),action=chooseEnemyAction(s,u);
  assert.equal(canSee(s,u,s.units[0]),true);assert.equal(action.type,'fire');assert.equal(action.hitLocation,'head');assert.equal(action.aim,0);
  assert.ok(actionCosts(s,u).fire+action.aim*actionCosts(s,u).aim<=u.ap);assert.deepEqual(s,before);
});

test('limited-AP shots can target a rider’s legs to break balance instead of paying for a low-accuracy head shot',()=>{
  const s=field({x:12,mounted:true},{ap:12}),action=chooseEnemyAction(s,actor(s));
  assert.equal(action.type,'fire');assert.equal(action.hitLocation,'legs');assert.equal(action.aim,0);
  const prone=field({x:12,stance:'prone',movementMode:'prone'},{ap:12});
  assert.notEqual(chooseEnemyAction(prone,actor(prone))?.hitLocation,'legs','an already prone target offers no new knockdown benefit');
});

test('a wounded target favors a reliable torso hit and remains worth firing at',()=>{
  const s=field({hp:16,bandaged:84},{ap:12}),action=chooseEnemyAction(s,actor(s));
  assert.equal(action.type,'fire');assert.equal(action.hitLocation,'torso');
});

test('partial penetration loss changes target selection even when nominal impact chance is the same',()=>{
  const s=field({id:'a',x:8,y:2});s.units.push({...structuredClone(s.units[0]),id:'b',y:4});
  // Sight through the authored screen is deliberate; full wood resistance
  // still reduces impact and must drive the native target choice.
  s.props=[{id:'wood',type:'barrels',x:7,y:2,obstacleHeight:3,blocksSight:false}];
  const u=actor(s),before=structuredClone(s),action=chooseEnemyAction(s,u);
  assert.equal(shotChance(s,u,s.units[0]),shotChance(s,u,s.units[2]));
  assert.equal(action.type,'fire');assert.equal(action.targetId,'b');assert.deepEqual(s,before);
});

test('hidden people and a visible target’s private supplies or energy do not change shot selection',()=>{
  const s=field(),other=structuredClone(s);Object.assign(other.units[0],{energy:2,medical:99,inventory:{secret:{count:1,weight:1}}});setTestAmmunition(other.units[0],500);
  other.units.push({...structuredClone(other.units[0]),id:'hidden',x:23,y:9,hp:100});
  assert.equal(canSee(other,actor(other),other.units[2]),false);
  assert.deepEqual(chooseEnemyAction(s,actor(s)),chooseEnemyAction(other,actor(other)));
});

test('real enemy turns execute the selected body region with normal charge, wear and save replay',()=>{
  const s=field();wall(s);const before=structuredClone(s),next=endTurn(s);
  assert.equal(next.units[0].lastHitLocation,'head');assert.ok(next.units[0].hp<100);assert.ok(actor(next).condition<100);
  assert.ok(actor(next).loaded+actor(next).ammo<actor(s).loaded+actor(s).ammo);
  assert.deepEqual(next,endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))));assert.doesNotThrow(()=>validateBattleSnapshot(next));assert.deepEqual(s,before);
});

test('a critical head reaction stops movement at the paid step and removes the incapacitated target’s remaining AP',()=>{
  const s=field({morale:100,hp:85,bandaged:15},{overwatch:true,ap:12}),next=actBattle(s,{type:'move',unitId:'p',x:10,y:3});
  assert.equal(next.lastError,null);assert.equal(next.units[0].x,9);assert.equal(next.units[0].lastHitLocation,'head');
  assert.ok(next.units[0].hp<15);assert.equal(next.units[0].ap,0);assert.equal(actor(next).ap,0);assert.equal(actor(next).loaded,0);
  assert.doesNotThrow(()=>validateBattleSnapshot(next));
});
