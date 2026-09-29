import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,supplyTransferPreview} from '../game/tactical.js';
import {CHARACTER_SUPPLY_LABELS} from '../game/character-supplies.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {saved,tactical,leave,visit} from './local-contract-fixture.mjs';
const unit=(p,id)=>p.battle.units.find(u=>u.id===String(id));
const physical=b=>({units:b.units,drops:b.droppedWeapons,ground:b.groundItems,seed:b.seed,elapsed:b.elapsedSeconds});
const give=(b,a={})=>actBattle(b,{type:'transferSupply',unitId:'sender',targetId:'receiver',item:'medkits',count:3,...a});
const prepared=(exploration=false)=>createBattle([{id:'sender',x:1,y:1,medkits:4},{id:'receiver',x:2,y:1,medkits:0}],{width:8,height:8,exploration,enemies:exploration?[]:[{id:'guard',x:7,y:7,patrol:false}]});

test('actual paid soldiers share authored supplies, the recipient uses the received dressings on a critical arrival, and saved return retains each remainder',()=>{
 let p=supplyCareField();assert.equal(unit(p,111).medkits,0);assert.equal(unit(p,112).hp,1);assert.equal(unit(p,112).unconscious,true);
 p=tactical(p,{type:'transferSupply',unitId:'110',targetId:'111',item:'medkits',count:3});assert.equal(unit(p,110).medkits,1);assert.equal(unit(p,111).medkits,3);assert.equal(unit(p,112).hp,1);
 p=tactical(saved(p),{type:'heal',unitId:'111',targetId:'112'});p=tactical(saved(p),{type:'heal',unitId:'111',targetId:'112'});assert.equal(unit(p,111).medkits,1);assert.equal(unit(p,112).hp,15);assert.equal(unit(p,112).unconscious,false);
 const other=Object.keys(CHARACTER_SUPPLY_LABELS).filter(k=>k!=='medkits'),expected={};for(const item of other){expected[item]=[unit(p,110)[item]-1,unit(p,111)[item]+1];p=tactical(p,{type:'transferSupply',unitId:'110',targetId:'111',item,count:1});}
 const c=leave(saved(p));assert.equal(c.operativeState[110].medkits,1);assert.equal(c.operativeState[111].medkits,1);p=visit(saved({campaign:c}).campaign);assert.equal(unit(p,110).medkits,1);assert.equal(unit(p,111).medkits,1);assert.equal(unit(p,112).hp,15);for(const [item,amounts]of Object.entries(expected))assert.deepEqual([unit(p,110)[item],unit(p,111)[item]],amounts);assert.ok(saved(p));
});
test('each supported supply transfers the requested whole amount for one sender cost without changing either hand or the recipient AP',()=>{
 for(const item of Object.keys(CHARACTER_SUPPLY_LABELS)){const b=prepared();b.units[0][item]=9;b.units[1][item]=2;const ap=b.units[0].ap,recipientAP=b.units[1].ap,seed=b.seed;const n=give(b,{item,count:3});assert.equal(n.lastError,null);assert.equal(n.units[0][item],6);assert.equal(n.units[1][item],5);assert.equal(n.units[0].ap,ap-4);assert.equal(n.units[1].ap,recipientAP);assert.equal(n.seed,seed);for(const i of [0,1])for(const key of ['weapon','blade','loaded','inventory'])assert.deepEqual(n.units[i][key],b.units[i][key]);assert.ok(validateBattleSnapshot(n));}
});
test('a whole remaining supply bundle moves in one exploration second without requiring AP or creating a ground copy',()=>{
 const b=prepared(true);b.units[0].ap=0;b.units[1].ap=0;const n=give(b,{count:4});assert.equal(n.lastError,null);assert.equal(n.units[0].medkits,0);assert.equal(n.units[1].medkits,4);assert.equal(n.units[0].ap,0);assert.equal(n.units[1].ap,0);assert.equal(n.elapsedSeconds,b.elapsedSeconds+1);assert.deepEqual(n.groundItems,b.groundItems);assert.deepEqual(n.droppedWeapons,b.droppedWeapons);const repeated=give(n,{count:1});assert.ok(repeated.lastError);assert.deepEqual(physical(repeated),physical(n));
});
test('invalid quantities, stock, item types, recipient bounds, AP and geometry reject before moving any supplies',()=>{
 for(const [change,action]of [[()=>{},{count:0}],[()=>{},{count:-1}],[()=>{},{count:1.5}],[()=>{},{count:Infinity}],[()=>{},{count:NaN}],[()=>{},{count:'1'}],[()=>{},{count:undefined}],[()=>{},{count:5}],[()=>{},{item:'loaded'}],[()=>{},{item:'weapon'}],[()=>{},{item:'__proto__'}],[b=>b.units[0].ap=3,{}],[b=>b.units[1].x=5,{}],[b=>b.units[1].entangled=true,{}],[b=>b.units[1].medkits=999999,{}],[b=>{b.units[1].rations=100000;},{item:'rations',count:1}],[b=>b.tiles.find(t=>t.x===2&&t.y===1).blocked=true,{}],[()=>{},{targetId:'sender'}],[()=>{},{unitId:'guard'}]]){const b=prepared();change(b);const a={item:'medkits',count:3,...action},before=structuredClone(b);assert.ok(supplyTransferPreview(b,b.units.find(u=>u.id===(a.unitId||'sender')),b.units.find(u=>u.id===(a.targetId||'receiver')),a.item,a.count).reason);assert.deepEqual(b,before);const n=give(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
 for(const action of [{slot:'primary'},{inventoryKey:'spare'}]){const b=prepared(),n=give(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
});
