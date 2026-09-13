import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,planLoot,canSee,getReachable} from '../game/tactical.js';
import {chooseScavengingAction} from '../game/tactical-ai-scavenging.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {AMMUNITION_TYPES,availableAmmunition} from '../game/ammunition-types.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';

function field(patch={}){
 const s=createBattle([{id:'p',x:12,y:3,experienceLevel:1}],{width:20,height:8,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:6,y:3,facing:2,weapon:1800,weaponInstanceId:'old-musket',loaded:0,ammo:0,priming:20,medkits:0,patrol:false,marksmanship:100,inventory:{},...patch}]});
 s.units[0].ap=0;s.units[1].ap=patch.ap??8;return s;
}
const enemy=s=>s.units[1];
const ammo=(x=7,y=3,count=5,id='cartridges')=>({id,type:'item',item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,x,y,count,weight:.04});
const gun=(x=7,y=3)=>({id:'pistol',type:'item',item:'weapon',x,y,count:1,weapon:1806,weight:1.3,loaded:1,condition:83,jammed:false,instanceId:'recovered-pistol'});
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));

test('an actual enemy turn picks finite cartridges with ordinary AP and preserves save continuation',()=>{
 const s=field();s.groundItems=[ammo()];const before=structuredClone(s);
 assert.deepEqual(chooseEnemyAction(s,enemy(s)),{type:'loot',unitId:'e',groundId:'cartridges',count:5});
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(enemy(n).ammo,5);assert.equal(enemy(n).loaded,0);assert.equal(enemy(n).ap,0);assert.equal(n.groundItems[0].count,0);assert.equal(n.elapsedSeconds,6);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
test('recovered cartridges fund a separate paid reload and shot with no free rounds',()=>{
 const s=field({ap:100});s.units[0].facing=6;s.groundItems=[ammo(7,3,1)];const n=endTurn(s);
 assert.equal(n.lastError,null);assert.equal(n.groundItems[0].count,0);assert.equal(enemy(n).ammo,0);assert.equal(enemy(n).loaded,0);assert.ok(n.log.some(line=>line.includes('recoge')));assert.ok(n.log.some(line=>line.includes('recarga')));assert.ok(n.units[0].hp<100);assert.doesNotThrow(()=>restored(n));
});
test('a loaded found pistol is picked up, separately equipped and fired while the old gun is retained',()=>{
 const s=field({ap:20});s.groundItems=[gun()];const n=endTurn(s);
 assert.equal(n.lastError,null);assert.equal(n.groundItems[0].count,0);assert.equal(enemy(n).weaponInstanceId,'recovered-pistol');assert.equal(enemy(n).loaded,0);assert.equal(enemy(n).condition,82);assert.equal(enemy(n).ammo,0);assert.equal(enemy(n).ap,0);assert.ok(n.units[0].hp<100);assert.ok(Object.values(enemy(n).inventory).some(r=>r.instanceId==='old-musket'));assert.doesNotThrow(()=>restored(n));
});
test('dropped fitted weapons preserve identity, loading and fitting condition through real recovery',()=>{
 const s=field({ap:14,weaponDropped:true,activeSlot:'unarmed'});s.units[0].x=19;s.units[0].y=7;s.tiles.filter(t=>t.x===10).forEach(t=>{t.blocked=true;t.blocksSight=true;t.type='wall';});
 s.droppedWeapons=[{x:7,y:3,weapon:1800,weight:4,loaded:1,condition:63,jammed:false,instanceId:'dropped-musket',fittings:{bayonet:{weapon:1811,condition:47,instanceId:'socket',fittingPattern:'india_socket'}},taken:false}];
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(n.droppedWeapons[0].taken,true);assert.equal(enemy(n).weaponInstanceId,'dropped-musket');assert.equal(enemy(n).loaded,1);assert.equal(enemy(n).weaponFittings.bayonet.instanceId,'socket');assert.equal(enemy(n).weaponFittings.bayonet.condition,47);assert.equal(enemy(n).ap,0);assert.deepEqual(n,endTurn(restored(s)));
});
test('visible supplies can be approached with paid steps before the separate pickup',()=>{
 const s=field({ap:24});s.groundItems=[ammo(9,3)];const choice=chooseEnemyAction(s,enemy(s));assert.equal(choice.type,'move');assert.equal(choice.x,8);assert.equal(choice.y,3);
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(enemy(n).x,8);assert.equal(enemy(n).ammo,5);assert.equal(n.groundItems[0].count,0);assert.equal(enemy(n).ap,0);assert.doesNotThrow(()=>restored(n));
});
test('hidden supplies and hidden bodies do not change the selected action',()=>{
 const s=field({ap:8});s.night=true;s.groundItems=[ammo(3,3,99,'behind')];assert.equal(canSee(s,enemy(s),s.groundItems[0]),false);
 const baseline=chooseEnemyAction({...s,groundItems:[]},enemy(s));assert.deepEqual(chooseEnemyAction(s,enemy(s)),baseline);
 s.units.push(setTestAmmunition({...structuredClone(s.units[0]),id:'hidden-body',x:2,y:7,hp:0,weaponInstanceId:'body-musket'},999));assert.deepEqual(chooseEnemyAction(s,enemy(s)),baseline);
});
test('nearby bodies have finite searchable ammunition; distant bodies and wounded allies do not expose it',()=>{
 const s=field();s.units.push(setTestAmmunition({...structuredClone(s.units[0]),id:'body',x:7,y:3,hp:0,loaded:0,weaponInstanceId:'body-musket'},19));
 const n=endTurn(s);assert.equal(enemy(n).ammo,12);assert.equal(n.units[2].ammo,7);assert.doesNotThrow(()=>restored(n));
 s.units[2].x=9;const hidden=structuredClone(s);setTestAmmunition(hidden.units[2],0);assert.deepEqual(chooseEnemyAction(s,enemy(s)),chooseEnemyAction(hidden,enemy(hidden)));
 s.units[2].x=7;s.units[2].side='enemy';s.units[2].hp=10;s.units[2].unconscious=true;assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'loot');
});
test('full packs, unaffordable pickup, depleted sources and jammed recovered guns are rejected without changes',()=>{
 for(const patch of [{ap:7},{rations:20},{loaded:1},{ammo:1}]){const s=field(patch);s.groundItems=[ammo()];assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'loot');}
 for(const change of [g=>g.count=0,g=>g.heldBy='p']){const s=field();s.groundItems=[ammo()];change(s.groundItems[0]);const before=structuredClone(s);assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'loot');assert.deepEqual(s,before);}
 const s=field({ap:30});s.groundItems=[{...gun(),jammed:true}];assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'loot');
});
test('the pickup plan uses the same finite capacity and does not mutate donor or receiver during scoring',()=>{
 const s=field({rations:14,ap:8});s.groundItems=[ammo(7,3,100)];assert.equal(inventoryUsage(enemy(s)).used,11);
 const before=structuredClone(s),choice=chooseEnemyAction(s,enemy(s));assert.equal(choice.count,12);const plan=planLoot(s,enemy(s),choice);assert.equal(availableAmmunition(plan.receiver,enemy(s).weapon),12);assert.equal(plan.remaining,88);assert.deepEqual(s,before);
 const n=endTurn(s);assert.equal(enemy(n).ammo,12);assert.equal(n.groundItems[0].count,88);
});
test('reaction scavenging permits a local pickup but never starts a search trip',()=>{
 const s=field({ap:18});s.phase='interrupt';s.groundItems=[ammo(9,3)];assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'loot');
 const choice=chooseEnemyAction(s,enemy(s));assert.ok(!choice||choice.type!=='move'||Math.hypot(choice.x-enemy(s).x,choice.y-enemy(s).y)<=1.5);
 s.groundItems[0].x=7;assert.equal(chooseEnemyAction(s,enemy(s)).type,'loot');
});
test('the public command boundary still refuses player pickup commands for enemy soldiers',()=>{
 const s=field();s.groundItems=[ammo()];const order=chooseEnemyAction(s,enemy(s));const n=actBattle(s,order);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.deepEqual(n.groundItems,s.groundItems);assert.equal(n.elapsedSeconds,0);
});


test('scavenging does not lead into a blocked pickup or newly exposed approach',()=>{
 const s=field({ap:40,y:4});s.groundItems=[ammo(9,3)];Object.assign(s.units[0],{x:9,y:6,facing:1});
 assert.equal(canSee(s,enemy(s),s.groundItems[0]),true);assert.equal(canSee(s,s.units[0],enemy(s)),false);
 const paths=()=>getReachable(s,enemy(s));assert.equal(chooseScavengingAction(s,enemy(s),[],paths)?.type,'move');assert.equal(chooseScavengingAction(s,enemy(s),[s.units[0]],paths),null);
 const blocked=field({ap:40});blocked.groundItems=[ammo(8,3)];blocked.tiles.filter(t=>t.x===7).forEach(t=>{t.type='wall';t.blocked=true;t.blocksSight=true;});
 assert.equal(chooseScavengingAction(blocked,enemy(blocked),[],()=>getReachable(blocked,enemy(blocked))),null);
});
test('two depleted soldiers cannot recover the same cartridges twice',()=>{
 const s=field();s.groundItems=[ammo(7,3,1)];s.units.push({...structuredClone(enemy(s)),id:'e2',x:6,y:4,weaponInstanceId:'other-musket'});
 const n=endTurn(s);assert.equal(n.groundItems[0].count,0);assert.equal(n.units.filter(u=>u.side==='enemy').reduce((sum,u)=>sum+u.ammo+u.loaded,0),1);assert.doesNotThrow(()=>restored(n));
});
test('recovery and firing during a reaction survive a saved nested interruption without repeating pickup',()=>{
 const s=field({experienceLevel:5,ap:20});s.groundItems=[gun()];
 Object.assign(s.units[0],{ap:24,agility:30,experienceLevel:1});s.units.push({...structuredClone(s.units[0]),id:'observer',x:12,y:5,ap:20,agility:100,experienceLevel:10});
 const paused=actBattle(s,{type:'move',unitId:'p',x:11,y:3});
 assert.equal(paused.lastError,null);assert.equal(paused.phase,'interrupt');assert.equal(paused.interrupt.returnTo,'reaction');assert.equal(paused.groundItems[0].count,0);assert.equal(enemy(paused).weaponInstanceId,'recovered-pistol');assert.equal(enemy(paused).loaded,0);assert.equal(enemy(paused).ap,0);
 const n=endTurn(restored(paused));assert.deepEqual(n,endTurn(paused));assert.equal(n.groundItems[0].count,0);assert.equal(enemy(n).weaponInstanceId,'recovered-pistol');assert.equal(enemy(n).loaded,0);assert.equal(n.elapsedSeconds,6);assert.doesNotThrow(()=>restored(n));
});
