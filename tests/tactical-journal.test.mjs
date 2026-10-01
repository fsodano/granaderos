import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const tiles=()=>Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,blocksSight:false,cover:0}));
function care(visible=false){
 const s=createBattle([{id:'p',name:'Observador',x:1,y:3,facing:2}],{width:20,height:8,seed:45,tiles:tiles(),enemies:[
  {id:'medic',name:'Sanitario oculto',x:12,y:3,facing:2,medical:60,medkits:2,patrol:false,loaded:1,ammo:3},
  {id:'patient',name:'Herido oculto',x:13,y:3,hp:10,maxHp:100,bleeding:3,medical:0,medkits:0,patrol:false},
 ]});
 s.units[0].ap=0;s.units[1].ap=33;s.units[2].ap=0;
 if(!visible)for(const t of s.tiles.filter(t=>t.x===8))Object.assign(t,{type:'wall',blocked:true,blocksSight:true});
 return s;
}
function rearAttack({visible=false,hp=100}={}){
 const s=createBattle([{id:'p',name:'Centinela',x:10,y:3,facing:visible?6:2,hp,maxHp:100}],{width:20,height:8,seed:45,tiles:tiles(),enemies:[
  {id:'e',name:'Atacante oculto',x:5,y:3,facing:2,weapon:1800,marksmanship:100,loaded:1,condition:100,patrol:false,medical:0},
 ]});
 s.units[0].ap=0;s.units[1].ap=12;return s;
}

test('unseen care and equipment changes spend resources without entering the saved journal',()=>{
 const s=care(),before=structuredClone(s),n=endTurn(s);
 assert.equal(n.units[1].medkits,1);assert.equal(n.units[1].activeSlot,'primary');assert.equal(n.units[1].ap,0);assert.equal(n.units[2].bleeding,0);
 assert.ok(!n.log.some(line=>/oculto|prepara|venda/.test(line)));assert.deepEqual(s,before);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.deepEqual(restored.log,n.log);
 // Revealing the squad later must not reconstruct or disclose the old treatment.
 for(const t of restored.tiles)Object.assign(t,{type:'grass',blocked:false,blocksSight:false});
 assert.equal(teamCanSee(restored,'player',restored.units[1]),true);
 assert.deepEqual(restored.log,n.log);
 const renamed=care();renamed.units[1].name='Secreto distinto';renamed.units[2].name='Otro secreto';
 assert.deepEqual(endTurn(renamed).log,n.log);
});

test('visible enemy treatment keeps useful event messages',()=>{
 const s=care(true);assert.equal(teamCanSee(s,'player',s.units[1]),true);
 const n=endTurn(s);assert.equal(n.units[2].bleeding,0);
 assert.ok(n.log.some(line=>line.includes('Sanitario oculto venda a Herido oculto')));
 assert.ok(n.log.some(line=>line.includes('Sanitario oculto prepara')));
});

test('an unseen shooter still reports the squad injury and the anonymous sound',()=>{
 const s=rearAttack();assert.equal(teamCanSee(s,'player',s.units[1]),false);
 const n=endTurn(s);assert.ok(n.units[0].hp<s.units[0].hp);assert.equal(n.units[1].loaded,0);
 assert.ok(n.log.some(line=>line.includes('Un ataque alcanza a Centinela')));
 assert.ok(n.log.some(line=>line.includes('oye un disparo cerca de')));
 assert.ok(!n.log.some(line=>line.includes('Atacante oculto')));
});

test('an observed attacker remains named even if its shot kills the sole observer',()=>{
 const s=rearAttack({visible:true,hp:16});assert.equal(teamCanSee(s,'player',s.units[1]),true);
 const n=endTurn(s);assert.equal(n.units[0].hp,0);
 assert.ok(n.log.some(line=>line.includes('Atacante oculto hiere a Centinela')));
 assert.ok(n.log.some(line=>line.includes('Centinela cayó en combate')));
});

test('hidden enemy reloads preserve anonymous hearing without load or AP details',()=>{
 const s=rearAttack();Object.assign(s.units[1],{x:7,loaded:0,ap:45});setTestAmmunition(s.units[1],1);
 const n=endTurn(s);assert.equal(n.units[1].loaded,1);assert.equal(n.units[1].ammo,0);
 assert.ok(n.log.some(line=>line.includes('oye un ruido')));
 assert.ok(!n.log.some(line=>/Atacante oculto|recarga|45 PA/.test(line)));
});

test('visible enemy movement does not disclose the length or AP cost of its route',()=>{
 const s=createBattle([{id:'p',x:1,y:1,facing:2,ap:20}],{width:20,height:8,seed:45,tiles:tiles(),enemies:[{id:'e',name:'Avanzante',x:7,y:1,weapon:1809,patrol:false}]});
 s.units[0].ap=20;s.units[1].ap=24;
 const n=endTurn(s);assert.equal(n.phase,'interrupt');assert.equal(n.units[1].x,6);
 assert.ok(n.log.includes('Avanzante avanza.'));assert.ok(!n.log.some(line=>line.includes('Avanzante')&&/casillas|PA/.test(line)));
 assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(n)))),endTurn(n));
});

test('a hidden enemy interruption has no name, while an observed interrupter can be named',()=>{
 for(const visible of [false,true]){
  const s=rearAttack({visible});Object.assign(s.units[0],{ap:100,loaded:0,experienceLevel:1,agility:20});setTestAmmunition(s.units[0],1);
  Object.assign(s.units[1],{x:7,facing:6,ap:3,experienceLevel:10,agility:100,overwatch:true});
  const n=actBattle(s,{type:'reload',unitId:'p'});
  assert.equal(n.units[1].reactionTurn,1);
  assert.ok(n.log.some(line=>visible?line.includes('Atacante oculto interrumpen'):line==='El enemigo interrumpe.'));
  if(!visible)assert.ok(!n.log.some(line=>line.includes('Atacante oculto')));
 }
});

test('a hidden guard can intercept a visible target without leaking its name or injury',()=>{
 const s=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,marksmanship:100}],{width:20,height:8,seed:45,tiles:tiles(),enemies:[
  {id:'57',name:'Oficial visible',x:7,y:3,leadership:90,overwatch:false,patrol:false},
  {id:'3',name:'Guardia secreto',x:7,y:4,overwatch:false,patrol:false},
 ]});
 Object.assign(s.tiles.find(t=>t.x===5&&t.y===4),{type:'wall',blocked:true,blocksSight:true});
 for(const u of s.units)u.ap=100;
 assert.equal(teamCanSee(s,'player',s.units[1]),true);assert.equal(teamCanSee(s,'player',s.units[2]),false);
 const n=actBattle(s,{type:'fire',unitId:'p',targetId:'57',aim:4});
 assert.equal(n.lastError,null);assert.equal(n.units[1].hp,100);assert.ok(n.units[2].hp<100);assert.equal(n.units[2].interceptTurn,1);
 assert.ok(!n.log.some(line=>line.includes('Guardia secreto')));
});

test('entering night sight reports the visible advance without exposing the earlier route',()=>{
 const s=createBattle([{id:'p',x:1,y:1,facing:2,agility:100,experienceLevel:10}],{width:20,height:8,night:true,seed:45,tiles:tiles(),enemies:[{id:'e',name:'Avanzante nocturno',x:8,y:1,weapon:1813,patrol:false,experienceLevel:1}]});
 s.units[0].ap=20;s.units[1].ap=24;s.units[1].lastKnownEnemy={x:1,y:1,turn:1};
 assert.equal(teamCanSee(s,'player',s.units[1]),false);
 const n=endTurn(s);assert.equal(n.phase,'interrupt');assert.equal(teamCanSee(n,'player',n.units[1]),true);
 assert.ok(n.log.includes('Avanzante nocturno avanza.'));
 assert.ok(!n.log.some(line=>line.includes('Avanzante nocturno')&&/casillas|PA/.test(line)));
});
