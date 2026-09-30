import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,lootSearchPreview} from '../game/tactical.js';
import {nearbyLootOptions,lootBatchSelectionModel,groundLootPiles} from '../game/ja2-hud.js';
import {weaponRecord} from '../game/weapon-definition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const fields={version:1,medkits:3,rations:2,torches:0,boleadoras:0};
function field(hp=14){
 const s=createBattle([{id:'p',x:1,y:1,medkits:0,rations:0,ammo:0,blade:0}],{width:8,height:8,exploration:true,enemies:[],npcs:[{id:'resident',name:'Vecina',x:2,y:1,hp,energy:100,civilianSupplies:{...fields}}]});
 const gun=weaponRecord(createBattle([{id:'gun',weapon:1800,loaded:1,condition:47,weaponInstanceId:'resident-gun'}],{width:8,height:8,exploration:true,enemies:[]}).units[0]);
 s.npcs[0].civilianWeapons={version:1,primary:gun,blade:null};
 s.groundItems=[{id:'loose',type:'medkits',x:2,y:1,count:2},{id:'held',type:'medkits',x:2,y:1,count:5,heldBy:'resident'},{id:'closed',type:'medkits',x:2,y:1,count:7,containerId:'chest'}];return s;
}
const physical=s=>({units:s.units,npcs:s.npcs,ground:s.groundItems,drops:s.droppedWeapons,seed:s.seed,elapsed:s.elapsedSeconds});

test('a conscious resident exposes only loose ground items; held and container stock are not shown',()=>{
 const s=field(100),u=s.units[0],point=s.npcs[0],options=nearbyLootOptions(s,u,point);
 assert.deepEqual(options.map(o=>o.action),[{type:'loot',groundId:'loose'}]);assert.equal(lootSearchPreview(s,u,point).available,true);assert.deepEqual(groundLootPiles(s,[u]),[{x:2,y:1,count:1}]);
 s.groundItems[0].count=0;assert.deepEqual(nearbyLootOptions(s,u,point),[]);assert.equal(lootSearchPreview(s,u,point).available,false);assert.deepEqual(groundLootPiles(s,[u]),[]);
});
test('an unconscious resident exposes finite named supplies and a loaded gun with exact batch ownership',()=>{
 const s=field(),u=s.units[0],point=s.npcs[0],options=nearbyLootOptions(s,u,point);assert.equal(options.length,4);
 const dressings=options.find(o=>o.action.targetId==='resident'&&o.action.item==='medkits'),gun=options.find(o=>o.action.item==='weapon');assert.equal(dressings.label,'Vendas');assert.equal(dressings.count,3);assert.equal(gun.count,1);assert.equal(gun.loaded,1);assert.equal(gun.condition,47);
 const model=lootBatchSelectionModel(s,u,point,{[dressings.id]:2,[gun.id]:1});assert.equal(model.preview.valid,true,model.preview.reason);
 const n=actBattle(s,{unitId:'p',...model.action});assert.equal(n.lastError,null,n.lastError);assert.equal(n.units[0].medkits,2);assert.equal(n.npcs[0].civilianSupplies.medkits,1);assert.equal(n.npcs[0].civilianWeapons.primary,null);assert.equal(n.npcs[0].hp,14);
 const received=Object.values(n.units[0].inventory).find(r=>r.instanceId==='resident-gun');assert.equal(received.loaded,1);assert.equal(received.condition,47);assert.deepEqual(n.groundItems.map(({knownToPlayer,...g})=>g),s.groundItems);assert.equal(n.elapsedSeconds,s.elapsedSeconds+1);assert.ok(validateBattleSnapshot(n));
});
test('stale civilian supply or weapon quantities reject the entire selection without taking an earlier ground item',()=>{
 const s=field();for(const [item,count]of [['medkits',4],['weapon',2],['medkits',0]]){
  const action={type:'lootBatch',unitId:'p',items:[{groundId:'loose',count:1},{targetId:'resident',item,count}]},n=actBattle(s,action);
  assert.ok(n.lastError,`${item}:${count}`);assert.deepEqual(physical(n),physical(s));
 }
});
test('body search works after loose stock is gone, but departed and unseen civilians remain unavailable',()=>{
 const s=field(),u=s.units[0],n=s.npcs[0];s.groundItems=[];assert.equal(lootSearchPreview(s,u,n).available,true);assert.equal(nearbyLootOptions(s,u,n).length,3);
 n.departure=true;assert.equal(lootSearchPreview(s,u,n).available,false);assert.deepEqual(nearbyLootOptions(s,u,n),[]);
 delete n.departure;n.x=6;for(const tile of s.tiles.filter(t=>t.x===3))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});assert.equal(lootSearchPreview(s,u,n).available,false);assert.deepEqual(nearbyLootOptions(s,u,n),[]);
});
