import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {finiteCacheCarrier} from './finite-cache-driver.mjs';

function doorway(){
 return createBattle([{id:'officer',x:1,y:2,hp:85,weapon:1802,loaded:1,ammo:9},{id:'doctor',x:3,y:2,hp:72,medical:65,medkits:1,weapon:1800,loaded:1,ammo:9}],{
  width:8,height:5,seed:8,exploration:true,enemies:[],props:[{id:'finite-chest',type:'chest',x:6,y:2,contents:[{item:'medkits',count:2,weight:.2}]}],
  tiles:Array.from({length:40},(_,i)=>({x:i%8,y:Math.floor(i/8),type:i%8===3&&Math.floor(i/8)!==2?'wall':'grass',blocked:i%8===3&&Math.floor(i/8)!==2,blocksSight:i%8===3&&Math.floor(i/8)!==2,cover:0})),
 });
}

test('an actual doorway occupant opens the finite cache route without relocating the enclosed first soldier',()=>{
 const battle=doorway(),before=structuredClone(battle),officer=battle.units.find(u=>u.id==='officer'),doctor=battle.units.find(u=>u.id==='doctor');
 assert.ok(!getReachable(battle,officer).some(point=>point.x===5&&point.y===2),'the doorway soldier physically blocks the first officer');
 assert.equal(finiteCacheCarrier({battle},['officer','doctor'],'finite-chest'),'doctor');
 const next=actBattle(battle,{type:'move',unitId:'doctor',x:5,y:2});assert.equal(next.lastError,null);
 assert.deepEqual({x:next.units[0].x,y:next.units[0].y},{x:officer.x,y:officer.y});assert.ok(getReachable(next,next.units[0]).some(point=>point.x===4&&point.y===2),'the ordinary walk clears the actual doorway');
 assert.equal(next.units[1].hp,doctor.hp);assert.equal(next.units[1].medkits,doctor.medkits);assert.ok(next.elapsedSeconds>battle.elapsedSeconds);assert.deepEqual(next.props.find(prop=>prop.id==='finite-chest').contents,battle.props.find(prop=>prop.id==='finite-chest').contents);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))).units,next.units);assert.deepEqual(battle,before);
});

test('an incapacitated doorway carrier cannot be selected or grant access to the finite cache',()=>{
 const battle=doorway();battle.units[1].hp=0;const before=structuredClone(battle);
 assert.equal(finiteCacheCarrier({battle},['doctor'],'finite-chest'),null);assert.deepEqual(battle,before);
});
