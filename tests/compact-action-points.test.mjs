import test from 'node:test';
import assert from 'node:assert/strict';
import {displayedAP,storedAP,formatAP} from '../game/action-points.js';
import {createBattle,actBattle,actionCosts,reloadPlan} from '../game/tactical.js';
import {targetPreview,equippedItemHelp} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=extra=>createBattle([{id:'p',name:'Patriota',x:1,y:1,weapon:1800,agility:100,dexterity:100,experienceLevel:10,...extra}],{seed:45,width:10,height:6,tiles:Array.from({length:60},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:2,y:1,patrol:false,overwatch:false}]});

test('compact AP preserve quarter points, full budgets and carryover without rounding affordable costs',()=>{
 for(const [units,label] of [[0,'0'],[1,'0,25'],[3,'0,75'],[6,'1,5'],[12,'3'],[45,'11,25'],[100,'25'],[120,'30']]){
  assert.equal(formatAP(units),label);assert.equal(storedAP(displayedAP(units)),units);
 }
 assert.equal(formatAP(undefined),'—');
 const s=field({activeSlot:'unarmed'}),u=s.units[0];
 assert.equal(formatAP(u.ap),'25');assert.equal(actionCosts(s,u).melee,12);
 assert.match(equippedItemHelp(s,u,{target:s.units[1]}),/Puños · 3 PA/);
 const before=structuredClone(s),preview=targetPreview(s,u,s.units[1]);
 assert.equal(formatAP(preview.pa),'3');assert.equal(formatAP(preview.remaining),'22');assert.deepEqual(s,before);
 u.ap=11;assert.equal(formatAP(u.ap),'2,75');assert.equal(targetPreview(s,u,s.units[1]).valid,false);
 const rejected=actBattle(s,{type:'melee',unitId:'p',targetId:'e'});assert.match(rejected.lastError,/PA insuficientes/);assert.deepEqual(rejected.units,s.units);
});

test('an old saved partial reload retains its exact work and deductions on the compact scale',()=>{
 const s=field({loaded:0,ammo:3});s.units[0].ap=20;
 const saved=JSON.stringify(s),restored=validateBattleSnapshot(JSON.parse(saved)),before=reloadPlan(restored.units[0],restored);
 assert.equal(formatAP(before.pa),'5');assert.equal(formatAP(before.remainingPA),'6,25');
 const loaded=actBattle(restored,{type:'reload',unitId:'p'});
 assert.equal(loaded.lastError,null);assert.equal(loaded.units[0].ap,0);assert.equal(loaded.units[0].loaded,0);assert.equal(loaded.units[0].ammo,3);
 assert.match(loaded.log.at(-1),/\(5 PA\).*faltan 6,25 PA/);
 const resumed=validateBattleSnapshot(JSON.parse(JSON.stringify(loaded)));resumed.units[0].ap=25;
 const plan=reloadPlan(resumed.units[0],resumed);assert.equal(formatAP(plan.pa),'6,25');
 const complete=actBattle(resumed,{type:'reload',unitId:'p'});
 assert.equal(complete.lastError,null);assert.equal(complete.units[0].ap,0);assert.equal(complete.units[0].loaded,1);assert.equal(complete.units[0].ammo,2);
 assert.equal(displayedAP(before.pa+plan.pa),11.25);assert.equal(JSON.stringify(s),saved);
});
