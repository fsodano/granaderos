import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,groundSupplyPickupPreview} from '../game/tactical.js';
import {CHARACTER_SUPPLY_LABELS} from '../game/character-supplies.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {saved,tactical,leave,visit} from './local-contract-fixture.mjs';
const unit=(p,id)=>p.battle.units.find(u=>u.id===String(id));
const physical=b=>({units:b.units,ground:b.groundItems,drops:b.droppedWeapons,seed:b.seed,elapsed:b.elapsedSeconds});
const fixture=(exploration=false)=>{const b=createBattle([{id:'collector',x:1,y:1,medkits:0}],{width:8,height:8,exploration,enemies:exploration?[]:[{id:'guard',x:7,y:7,patrol:false}]});b.groundItems=[{id:'bundle',type:'medkits',x:2,y:1,count:5}];return b;};
const take=(b,a={})=>actBattle(b,{type:'loot',unitId:'collector',groundId:'bundle',count:2,...a});

test('partial pickup of an actual authored supply bundle retains both personal and ground remainders through repeated campaign return',()=>{
 let p=supplyCareField();p=tactical(p,{type:'dropSupply',unitId:'110',item:'medkits',count:4});const id=p.battle.groundItems.find(g=>g.id.startsWith('supply-')).id;p=tactical(p,{type:'loot',unitId:'111',groundId:id,count:1});assert.equal(unit(p,110).medkits,0);assert.equal(unit(p,111).medkits,1);assert.equal(p.battle.groundItems.find(g=>g.id===id).count,3);
 p=visit(saved({campaign:leave(saved(p))}).campaign);p=tactical(p,{type:'loot',unitId:'111',groundId:id,count:2});p=visit(saved({campaign:leave(saved(p))}).campaign);assert.equal(unit(p,110).medkits,0);assert.equal(unit(p,111).medkits,3);assert.equal(p.battle.groundItems.find(g=>g.id===id).count,1);assert.ok(saved(p));
});
test('every supported ground supply uses one eight-AP pickup or one exploration second and omitted quantities still collect the remainder',()=>{
 for(const item of Object.keys(CHARACTER_SUPPLY_LABELS)){let b=fixture();b.groundItems[0].type=item;b.units[0][item]=0;const ap=b.units[0].ap;b=take(b);assert.equal(b.lastError,null);assert.equal(b.units[0][item],2);assert.equal(b.groundItems[0].count,3);assert.equal(b.units[0].ap,ap-8);b=take(b,{count:undefined});assert.equal(b.lastError,null);assert.equal(b.units[0][item],5);assert.equal(b.groundItems[0].count,0);assert.equal(b.units[0].ap,ap-16);assert.ok(validateBattleSnapshot(b));}
 const b=fixture(true);b.units[0].ap=0;const n=take(b);assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds,b.elapsedSeconds+1);assert.equal(n.units[0].ap,0);assert.equal(n.groundItems[0].count,3);
});
test('invalid amounts, stale bundles, blocked access and unaffordable pickups reject without altering source, receiver or time',()=>{
 for(const [change,action]of [[()=>{},{count:null}],[()=>{},{count:0}],[()=>{},{count:-1}],[()=>{},{count:1.5}],[()=>{},{count:NaN}],[()=>{},{count:'2'}],[()=>{},{count:6}],[b=>b.groundItems[0].count=0,{}],[b=>b.groundItems[0].count=1.5,{}],[b=>b.groundItems[0].heldBy='guard',{}],[b=>b.groundItems[0].containerId='closed',{}],[b=>b.units[0].ap=7,{}],[b=>b.groundItems[0].x=6,{}],[b=>b.tiles.find(t=>t.x===2&&t.y===1).blocked=true,{}]]){const b=fixture();change(b);const before=structuredClone(b),a={count:2,...action};assert.ok(groundSupplyPickupPreview(b,b.units[0],'bundle',a.count).reason);assert.deepEqual(b,before);const n=take(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
 for(const action of [{targetId:'collector'},{dropIndex:0}]){const b=fixture();if(action.dropIndex===0)b.droppedWeapons=[{weapon:1800,x:2,y:1,loaded:0,condition:100}];const n=take(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
});
test('an overflowing whole bundle can be reduced to an exact accepted quantity without clipping or deleting the excess',()=>{
 const b=fixture();b.units[0].medkits=999999;assert.ok(groundSupplyPickupPreview(b,b.units[0],'bundle',5).reason);const refused=take(b,{count:5});assert.ok(refused.lastError);assert.deepEqual(physical(refused),physical(b));const accepted=take(b,{count:1});assert.equal(accepted.lastError,null);assert.equal(accepted.units[0].medkits,1000000);assert.equal(accepted.groundItems[0].count,4);assert.ok(validateBattleSnapshot(accepted));
});
