import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,canSee,movementEnergy,getReachable} from '../game/tactical.js';
import {militiaPatrolOrder} from '../game/militia-patrol.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(militia={},enemy={})=>createBattle([{id:'m',militia:true,x:2,y:4,facing:2,weapon:1800,loaded:1,ammo:3,condition:44,weaponReady:true,...militia}],{width:32,height:12,seed:127,exploration:true,tiles:Array.from({length:384},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),enemies:enemy===null?[]:[{id:'e',x:27,y:4,facing:6,patrol:false,marksmanship:0,overwatch:false,...enemy}]});
const position=u=>({x:u.x,y:u.y});
test('militia scout one tile during exploration without AP or ammunition costs',()=>{
 const b=field();b.units[0].weaponReady=true;const before=structuredClone(b),m=b.units[0],n=actBattle(b,{type:'ambient'}),u=n.units[0];
 assert.equal(n.lastError,null);assert.equal(n.mode,'exploration');assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,b.turn);assert.equal(u.ap,m.ap);assert.ok(Math.hypot(u.x-m.x,u.y-m.y)>0);assert.ok(Math.hypot(u.x-m.x,u.y-m.y)<=Math.SQRT2);assert.ok(u.energy<m.energy);assert.equal(u.weaponReady,undefined);
 for(const key of ['loaded','ammo','condition','inventory'])assert.deepEqual(u[key],m[key]);assert.deepEqual(b,before);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('a militia-only patrol establishes real visual contact and ambient movement then stops',()=>{
 let b=field(),ticks=0;assert.equal(canSee(b,...b.units),false);while(b.mode==='exploration'&&ticks++<60)b=actBattle(b,{type:'ambient'});
 assert.ok(ticks<60);assert.equal(b.mode,'combat');assert.equal(b.sectorCleared,false);assert.ok(canSee(b,b.units[0],b.units[1])||canSee(b,b.units[1],b.units[0]));assert.equal(b.log.filter(line=>line.includes('Contacto visual')).length,1);assert.ok(b.units[1].hp>0);
 const n=actBattle(b,{type:'ambient'});assert.deepEqual(n.units,b.units);assert.equal(n.elapsedSeconds,b.elapsedSeconds);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('fixed map waypoints do not change when an unseen enemy changes position',()=>{
 const b=field(),hidden=structuredClone(b);hidden.units[1].x=30;hidden.units[1].y=10;
 const planned=s=>militiaPatrolOrder({...s,mode:'combat'},{...s.units[0],ap:100});assert.ok(planned(b));assert.deepEqual(planned(hidden),planned(b));assert.deepEqual(position(actBattle(hidden,{type:'ambient'}).units[0]),position(actBattle(b,{type:'ambient'}).units[0]));
});
test('a saved patrol retains its cadence, energy and next contact exactly',()=>{
 let b=actBattle(field(),{type:'ambient'});let saved=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));for(let i=0;i<20;i++){b=actBattle(b,{type:'ambient'});saved=actBattle(saved,{type:'ambient'});assert.deepEqual(saved,b);if(b.mode==='combat')break;}
});
test('incapacitated or bound militia cannot scout and hired soldiers remain under manual control',()=>{
 for(const patch of [{knockedDown:true,stance:'prone',weaponReady:undefined},{entangled:true},{hp:14,weaponReady:undefined},{militia:false}]){const b=field(patch);if(patch.knockedDown){b.units[0].knockedDown=true;b.units[0].stance='prone';}const n=actBattle(b,{type:'ambient'});assert.deepEqual(position(n.units[0]),position(b.units[0]));assert.equal(n.units[0].ap,b.units[0].ap);}
});


test('tired patrols recover in place, then pay energy for a legal step without spending AP',()=>{
 const b=field({energy:50},null);b.units[0].ap=7;const n=actBattle(b,{type:'ambient'});
 assert.equal(n.elapsedSeconds,6);assert.deepEqual(position(n.units[0]),position(b.units[0]));assert.equal(n.units[0].energy,60);assert.equal(n.units[0].ap,7);
 const moved=actBattle(n,{type:'ambient'}),u=moved.units[0];assert.notDeepEqual(position(u),position(n.units[0]));assert.equal(u.ap,7);assert.equal(u.energy,60-movementEnergy(n.units[0],moved.tiles.find(t=>t.x===u.x&&t.y===u.y)));assert.equal(moved.elapsedSeconds,12);assert.ok(validateBattleSnapshot(moved));
});

test('a 600-second wait and equal ambient ticks preserve the same finite patrol and a breath reserve',()=>{
 const b=field({},null),rested=endTurn(b);let stepped=b;
 for(let i=0;i<100;i++){const before=stepped;stepped=actBattle(stepped,{type:'ambient'});const u=stepped.units[0];assert.equal(u.unconscious,false);assert.ok(u.energy>=50);if(u.x!==before.units[0].x||u.y!==before.units[0].y)assert.ok(getReachable({...before,mode:'combat'},{...before.units[0],ap:100}).some(p=>p.x===u.x&&p.y===u.y));}
 assert.deepEqual(rested.units,stepped.units);assert.equal(rested.elapsedSeconds,600);assert.equal(stepped.elapsedSeconds,600);assert.ok(stepped.units[0].energy<100);
 for(const key of ['hp','ap','loaded','ammo','priming','condition','medkits','fatigue'])assert.equal(stepped.units[0][key],b.units[0][key],key);
 assert.ok(validateBattleSnapshot(rested));
});

test('actual paid garrison patrols survive campaign clock synchronization, save and reentry without replacement supplies',async()=>{
 const {combatMilitia}=await import('./militia-combat-fixture.mjs'),{visit,saved,sync,leave}=await import('./local-contract-fixture.mjs');
 let p=visit(combatMilitia().s);const before=structuredClone(p),start=p.battle.units.filter(u=>u.militia);assert.equal(start.length,3);
 for(let i=0;i<12;i++){p.battle=actBattle(p.battle,{type:'ambient'});assert.equal(p.battle.lastError,null);p=saved(sync(p));}
 assert.equal(p.battle.mode,'exploration');assert.equal(p.battle.elapsedSeconds,before.battle.elapsedSeconds+72);assert.ok(p.battle.units.some(u=>u.militia&&(u.x!==start.find(v=>v.id===u.id).x||u.y!==start.find(v=>v.id===u.id).y)));
 const restored=saved(p),direct=actBattle(p.battle,{type:'ambient'}),resumed=actBattle(restored.battle,{type:'ambient'});assert.deepEqual(resumed,direct);
 const retained=structuredClone(p.battle.units.filter(u=>u.militia)),returned=visit(saved({campaign:leave(p)}).campaign);
 for(const u of retained){const next=returned.battle.units.find(v=>v.id===u.id);assert.ok(next);for(const key of ['hp','maxHp','loaded','ammo','priming','condition','inventory','militiaRank','militiaExperience'])assert.deepEqual(next[key],u[key],`${u.id}: ${key}`);assert.deepEqual(position(next),position(u));}
 assert.deepEqual(before.battle.units.filter(u=>u.militia),start);
});

test('lost-contact combat uses the same map search and pays from the remaining allied budget',()=>{
 const b=field();b.mode='combat';b.units[0].ap=28;const before=structuredClone(b),n=endTurn(b),u=n.units[0];
 assert.equal(n.lastError,null);assert.equal(n.mode,'exploration','quiet rounds return to exploration after the paid patrol step');assert.equal(Math.abs(u.x-before.units[0].x)+Math.abs(u.y-before.units[0].y),1);assert.equal(u.carriedAP,20);assert.equal(getReachable(before,before.units[0]).find(p=>p.x===u.x&&p.y===u.y).cost,8);assert.equal(u.loaded,before.units[0].loaded);assert.equal(u.ammo,before.units[0].ammo);assert.deepEqual(position(n.units[1]),position(before.units[1]));assert.ok(validateBattleSnapshot(n));
 const short=structuredClone(b);short.units[0].ap=25;const held=endTurn(short);assert.deepEqual(position(held.units[0]),position(short.units[0]),'25 PA cannot fund a step and retain the 20-PA reserve');
});
