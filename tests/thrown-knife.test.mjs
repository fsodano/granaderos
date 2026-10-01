import test from 'node:test';
import assert from 'node:assert/strict';
import {heldThrowingKnife,knifeThrowCosts,knifeThrowRange,knifeThrowChance,knifeThrowDamage} from '../game/thrown-knife.js';
import {createBattle,knifeThrowPreview,actBattle,actionCosts} from '../game/tactical.js';
import {chooseKnifeThrow,chooseEnemyAction} from '../game/tactical-ai.js';

const knife=()=>({id:'p',side:'player',x:1,y:2,weapon:1813,activeSlot:'primary',stance:'standing',facing:2,strength:75,agility:75,dexterity:75,marksmanship:75,energy:100,morale:80,hp:100,maxHp:100,condition:100,weaponInstanceId:'knife-owned',inventory:{}});
function field(){
 return createBattle([{...knife(),id:'p',x:5,y:3}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,blocksSight:false,cover:0})),enemies:[{id:'e',name:'Lanzador',x:1,y:3,weapon:1813,weaponInstanceId:'enemy-knife',marksmanship:95,dexterity:95,strength:90,agility:90,facing:2,patrol:false,overwatch:false}]});
}

test('a throwable knife must occupy the active hand, independent of character identity',()=>{
 for(const id of ['p','3','57','hired-48'])assert.equal(heldThrowingKnife({...knife(),id}).record.instanceId,'knife-owned');
 for(const state of [{activeSlot:'unarmed'},{activeSlot:'medical'},{weaponDropped:true},{weapon:1809},{weapon:1811},{weapon:1800,blade:1813}])assert.equal(heldThrowingKnife({...knife(),...state}),null);
 const secondary={...knife(),weapon:1805,activeSlot:'blade',blade:1813,bladeCondition:43,bladeInstanceId:'secondary'};
 assert.equal(heldThrowingKnife(secondary).slot,'blade');assert.equal(heldThrowingKnife(secondary).record.condition,43);assert.equal(heldThrowingKnife(secondary).record.instanceId,'secondary');
});

test('aim, posture and facing have separate costs, with no firearm readiness or ammunition effect',()=>{
 const u=knife(),point={x:6,y:2},base=knifeThrowCosts(u,point);
 assert.equal(knifeThrowCosts({...u,weaponReady:true,loaded:2,ammo:80,jammed:true},point).total,base.total);
 for(let aim=1;aim<=4;aim++){const c=knifeThrowCosts(u,point,aim);assert.ok(c.total>base.total);assert.equal(c.attack,base.attack);assert.equal(c.energy,base.energy);}
 const crouch=knifeThrowCosts({...u,stance:'crouched'},point),prone=knifeThrowCosts({...u,stance:'prone'},point);
 assert.ok(crouch.total>base.total);assert.ok(prone.total>crouch.total);assert.equal(prone.attack,base.attack);
 assert.ok(knifeThrowCosts({...u,facing:6},point).turn>0);
 assert.ok(knifeThrowCosts({...u,dexterity:20,agility:20},point).attack>base.attack);
});

test('strength and breath determine useful reach; beyond it accuracy falls before the physical limit',()=>{
 const u=knife(),range=knifeThrowRange(u),before=structuredClone(u);
 assert.ok(knifeThrowRange({...u,strength:30}).nominal<range.nominal);
 assert.ok(knifeThrowRange({...u,energy:20}).nominal<range.nominal);
 assert.ok(knifeThrowChance(u,range.nominal+.01)<knifeThrowChance(u,range.nominal)*.6);
 assert.ok(knifeThrowChance(u,range.maximum)>0);assert.equal(knifeThrowChance(u,range.maximum+.01),0);
 assert.ok(knifeThrowChance(u,4,4)>knifeThrowChance(u,4,0));
 for(const penalty of [{hp:40},{energy:30},{morale:20},{shock:8},{fatigue:90},{condition:20}])assert.ok(knifeThrowChance({...u,...penalty},4)<knifeThrowChance(u,4));
 assert.ok(knifeThrowDamage({...u,condition:30})<knifeThrowDamage(u));assert.deepEqual(u,before);
});

test('AI uses the same visible target, affordable cost and finite held knife rule',()=>{
 const s=field();s.phase='enemy';const u=s.units[1],target=s.units[0];u.ap=100;
 const before=structuredClone(s),order=chooseKnifeThrow(s,u,[target]);assert.equal(order.type,'throwKnife');
 const plan=knifeThrowPreview(s,u,target,order);assert.ok(plan.valid&&plan.chance>=65);assert.ok(plan.pa<=u.ap);
 assert.deepEqual(chooseKnifeThrow(s,u,[target]),order);assert.deepEqual(s,before);
 assert.equal(chooseEnemyAction(s,u).type,'throwKnife');
 assert.equal(chooseKnifeThrow(s,{...u,activeSlot:'unarmed'},[target]),null);
 assert.equal(chooseKnifeThrow(s,{...u,ap:1},[target]),null);
 assert.equal(chooseKnifeThrow(s,{...u,energy:5},[target]),null);
 assert.equal(chooseKnifeThrow(s,u,[]),null);
});

test('AI pays preparation in separate decisions and preserves a knife for an adjacent melee attack',()=>{
 const s=field();s.phase='enemy';const u=s.units[1],target=s.units[0];u.ap=100;u.stance='prone';u.movementMode='prone';
 assert.equal(chooseKnifeThrow(s,u,[target]).type,'stance');
 u.stance='standing';u.movementMode='walk';u.facing=1;
 assert.equal(chooseKnifeThrow(s,u,[target]).type,'look');
 u.facing=2;target.x=2;
 assert.equal(chooseEnemyAction(s,u).type,'melee');
});

test('AI rejects known interception and cover without inspecting a hidden soldier',()=>{
 const s=field();s.phase='enemy';const u=s.units[1],target=s.units[0];u.ap=100;
 s.units.push({...structuredClone(u),id:'friend',weaponInstanceId:'friend-knife',x:3,stance:'standing'});
 assert.equal(chooseKnifeThrow(s,u,[target]),null);
 s.units.pop();const wall=s.tiles.find(t=>t.x===3&&t.y===3);Object.assign(wall,{blocked:true,blocksSight:true,type:'wall',material:'stone'});
 assert.equal(chooseKnifeThrow(s,u,[target]),null);
});

test('ordinary hostile clicks retain paid knife melee approach instead of launching by distance',()=>{
 const s=field();const u=s.units[0],target=s.units[1];u.ap=100;u.facing=6;target.ap=0;
 const n=actBattle(s,{type:'useItem',unitId:u.id,targetId:target.id});assert.equal(n.lastError,null);
 assert.ok(n.units[0].x<u.x);assert.ok(n.units[0].ap<u.ap-actionCosts(s,u).melee);
 assert.equal(heldThrowingKnife(n.units[0]).record.instanceId,'knife-owned');assert.equal(n.groundItems.length,0);
});
