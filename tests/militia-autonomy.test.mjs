import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
const grid=(wall=6)=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:i%12===wall?'window':'grass',blocked:i%12===wall,blocksSight:false,cover:0}));
const gun=changes=>weaponMetadata({...defaultContentPackage().weapons.find(w=>w.id==='firearm-1805'),id:'defense-test-pistol',...changes});
function field({firstSide='player',militia={},enemies,wall=6}={}){return createBattle([{id:'officer',name:'Oficial',x:1,y:6,weapon:1813,medical:100,medkits:2},{id:'militia',name:'Defensor',militia:true,militiaRank:0,x:0,y:1,hp:100,maxHp:100,marksmanship:100,weapon:1805,loaded:0,ammo:2,priming:2,...militia}],{width:12,height:8,seed:42,firstSide,tiles:grid(wall),enemies:enemies??[{id:'enemy',x:10,y:1,hp:30,maxHp:30,weapon:1813,blade:1813,ammo:0,patrol:false}],hour:12});}
const defender=s=>s.units.find(u=>u.id==='militia');

test('a local defender independently loads and fires finite ammunition through normal combat rounds',()=>{
 let b=field();const before=structuredClone(defender(b));for(let i=0;i<5&&b.status==='active';i++)b=endTurn(b);assert.equal(b.lastError,null);assert.equal(b.status,'victory');const u=defender(b);assert.ok(u.loaded+u.ammo<before.loaded+before.ammo);assert.equal('priming'in u,false);assert.ok(u.condition<before.condition);assert.equal(u.hp,before.hp);assert.equal(u.militiaExperience,3);assert.ok(b.log.some(e=>e.includes('actúa la guarnición')));assert.ok(b.log.some(e=>e.includes('Defensor')&&e.includes('recarga')));assert.ok(validateBattleSnapshot(b));
});

test('militia spend remaining AP after actual reactions without receiving another issue in the allied phase',()=>{
 const b=field({wall:3,militia:{weaponMetadata:gun({fireAP:40,readyAP:0,capacity:3,damage:1,range:24}),loaded:3,ammo:0,priming:3},enemies:[{id:'enemy',x:9,y:1,hp:500,maxHp:500,weapon:1813,blade:1813,ammo:0,patrol:false}]});const next=endTurn(b),u=defender(next);assert.equal(next.lastError,null);assert.equal(u.loaded,1,JSON.stringify({log:next.log,unit:u}));assert.equal(u.condition,98);assert.equal(u.ammo,0);assert.equal(u.reactionTurn,1);assert.equal(u.reactionSpent,0);assert.equal(u.ap,100);assert.equal(next.elapsedSeconds,6);assert.ok(validateBattleSnapshot(next));
});

test('enemy-first contact defers the allied phase until the player responds and saved continuation is deterministic',()=>{
 const b=field({firstSide:'enemy'});assert.equal(b.enemyFirstAwaitingPlayer,true);assert.equal(defender(b).loaded,0);assert.equal(defender(b).ammo,2);assert.equal(b.log.filter(e=>e.includes('actúa la guarnición')).length,0);const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(b))),direct=endTurn(b),resumed=endTurn(restored);assert.equal(direct.lastError,null);assert.equal(direct.log.filter(e=>e.includes('actúa la guarnición')).length,1);assert.ok(defender(direct).loaded+defender(direct).ammo<2);for(const key of ['hp','ap','loaded','ammo','priming','militiaExperience','militiaCombatCredit'])assert.deepEqual(defender(resumed)[key],defender(direct)[key],key);assert.equal(resumed.seed,direct.seed);assert.equal(resumed.elapsedSeconds,direct.elapsedSeconds);
});

test('direct militia commands reject without spending health, gear, time or AP while medical treatment remains legal',()=>{
 const b=field({militia:{x:1,y:5,hp:40,bleeding:3}});for(const action of [{type:'move',x:2,y:5},{type:'fire',targetId:'enemy'},{type:'overwatch'},{type:'reload'},{type:'heal',targetId:'officer'},{type:'weapon',slot:'blade'}]){const denied=actBattle(b,{...action,unitId:'militia'});assert.match(denied.lastError,/milicias actúan por su cuenta/);assert.deepEqual(denied.units,b.units);assert.equal(denied.elapsedSeconds,b.elapsedSeconds);assert.equal(denied.seed,b.seed);}
 const cared=actBattle(b,{type:'heal',unitId:'officer',targetId:'militia'});assert.equal(cared.lastError,null);assert.ok(defender(cared).bleeding<defender(b).bleeding);assert.equal(cared.units.find(u=>u.id==='officer').medkits,1);assert.ok(validateBattleSnapshot(cared));
});

test('unconscious militia cannot attack or spend their finite equipment during the allied phase',()=>{
 const b=field({militia:{hp:10,loaded:1,ammo:2,bleeding:1}}),before=structuredClone(defender(b)),next=endTurn(b);assert.equal(next.lastError,null);assert.equal(defender(next).loaded,before.loaded);assert.equal(defender(next).ammo,before.ammo);assert.equal(defender(next).militiaExperience,undefined);assert.ok(defender(next).hp<before.hp);assert.ok(validateBattleSnapshot(next));
});
