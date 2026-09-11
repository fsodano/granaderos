import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,weaponFor,bladeFor,carriedWeight} from '../game/tactical.js';
import {FISTS,BUTTSTOCK,unarmedChance,unarmedImpact} from '../game/unarmed-combat.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const battle=()=>createBattle([{id:'p',x:1,y:1,weapon:1800,blade:1810,activeSlot:'unarmed',strength:100,dexterity:100,agility:100}],{width:10,height:8,tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:2,y:1,morale:100,energy:30}],seed:45});

test('empty hands use punches with breath loss, not an imaginary bayonet',()=>{
 const s=battle(),n=actBattle(s,{type:'useItem',unitId:'p',targetId:'e'}),target=n.units[1];
 assert.equal(n.lastError,null);assert.equal(weaponFor(n.units[0]).id,FISTS.id);assert.ok(target.hp>=90);assert.equal(target.energy,0);assert.equal(target.unconscious,true);
 assert.equal(n.units[0].ap,s.units[0].ap-12);assert.equal(n.units[0].loaded,1);assert.equal(n.units[0].ammo,s.units[0].ammo);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('an incapacitated victim can be looted once without generating equipment',()=>{
 const s=actBattle(battle(),{type:'useItem',unitId:'p',targetId:'e'}),n=actBattle(s,{type:'loot',unitId:'p',targetId:'e',item:'weapon'});
 assert.equal(n.lastError,null);assert.equal(n.units[1].weaponDropped,true);assert.equal(n.units[1].loaded,0);
 assert.equal(Object.values(n.units[0].inventory).filter(r=>r.weapon===1800).length,1);
 const again=actBattle(n,{type:'loot',unitId:'p',targetId:'e',item:'weapon'});assert.ok(again.lastError);assert.deepEqual(again.units,n.units);
});
test('a dropped primary leaves an equipped secondary usable; no unowned blade is supplied',()=>{
 const s=battle(),u=s.units[0];u.weaponDropped=true;u.activeSlot='blade';assert.equal(weaponFor(u).id,1810);
 u.activeSlot='primary';assert.equal(bladeFor(u).id,FISTS.id);u.weaponDropped=false;assert.equal(bladeFor(u).id,BUTTSTOCK.id);
 delete u.blade;u.activeSlot='blade';assert.equal(bladeFor(u).id,FISTS.id);
});
test('putting the gun away preserves its load and carried weight',()=>{
 const s=battle();s.units[0].activeSlot='primary';const weight=carriedWeight(s.units[0]);
 const n=actBattle(s,{type:'weapon',unitId:'p',slot:'unarmed'});assert.equal(n.lastError,null);assert.equal(n.units[0].loaded,1);assert.equal(carriedWeight(n.units[0]),weight);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('punch accuracy and breath impact respond to condition, skill and awareness',()=>{
 const strong={strength:100,dexterity:100,agility:100,energy:100},weak={strength:20,dexterity:20,agility:20,energy:20},target={agility:75,dexterity:75,energy:100};
 assert.ok(unarmedChance(strong,target)>unarmedChance(weak,target));assert.ok(unarmedImpact(strong).breathLoss>unarmedImpact(weak).breathLoss);
 assert.ok(unarmedChance(weak,target,{aware:false})>unarmedChance(weak,target));
});
test('an explicit out-of-reach punch or legacy unarmed charge spends no AP or supplies',()=>{
 const s=battle();s.units[1].x=5;
 for(const type of ['melee','charge']){const n=actBattle(s,{type,unitId:'p',targetId:'e'});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);}
});
