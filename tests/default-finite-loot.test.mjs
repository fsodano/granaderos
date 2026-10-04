import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {actBattle,createBattle} from '../game/tactical.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {inventoryUsage,applyItemQuantity,validateItemStack} from '../game/tactical-inventory.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {authoredEnvironment,validateEnvironment} from '../game/environment-interactions.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {buildSectorMap} from '../game/maps.js';
import {order,visit,tactical,saved,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';

const ID='1000',CACHE='retiro:armory-cache';
const actor=p=>p.battle.units.find(u=>u.id===ID);
const chest=p=>p.battle.props.find(prop=>prop.id===CACHE);
const physical=b=>({units:b.units,props:b.props,groundItems:b.groundItems,seed:b.seed,elapsedSeconds:b.elapsedSeconds});

test('the default opening can acquire a gun, typed cartridges, dressings and a real toolkit without a shop or respawn',()=>{
 let campaign=order(initialCampaign(8),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'workshop',doctrine:'line_marksman',crisis:'rescue'}});
 const money=campaign.resources.treasury;let p=visit(campaign);
 assert.ok(chest(p));assert.equal(chest(p).open,false);assert.equal(actor(p).toolkitPoints,0);
 p=takeFiniteCache(p,ID,[{weapon:1800,count:1},{ammoType:'musket_75',count:12},{item:'medkits',count:3},{kind:'repair-kit',count:1}]);
 assert.equal(chest(p).open,true);
 const key=Object.keys(actor(p).inventory).find(key=>actor(p).inventory[key].weapon===1800);
 p=tactical(p,{type:'equipLoot',unitId:ID,inventoryKey:key});
 assert.equal(actor(p).weapon,1800);assert.equal(actor(p).weaponInstanceId,'cache:retiro:gun:0');
 assert.equal(ammunitionByType(actor(p)).musket_75,12);assert.equal(actor(p).medkits,5);
 assert.equal(repairMaterialPoints(actor(p)),100);
 const toolkit=inventoryUsage(actor(p)).items.find(item=>item.kind==='repair-kit');
 assert.equal(toolkit.slotSize,2);assert.equal(toolkit.weight,2);assert.equal(toolkit.count,1);
 const remaining=structuredClone(chest(p).contents);p=saved(p);assert.deepEqual(chest(p).contents,remaining);
 const kitKey=Object.keys(actor(p).inventory).find(key=>actor(p).inventory[key].kind==='repair-kit');
 p=tactical(p,{type:'drop',unitId:ID,item:`inventory:${kitKey}`,count:1});
 const groundId=p.battle.groundItems.find(item=>item.kind==='repair-kit').id;
 assert.equal(repairMaterialPoints(actor(p)),0);
 p=visit(saved({campaign:leave(saved(p))}).campaign);
 assert.deepEqual(chest(p).contents,remaining,'entry keeps the consumed container quantities');
 assert.equal(p.battle.groundItems.find(item=>item.id===groundId).repairPoints,100);
 p=tactical(p,{type:'loot',unitId:ID,groundId,count:1});assert.equal(repairMaterialPoints(actor(p)),100);
 assert.equal(p.battle.groundItems.find(item=>item.id===groundId).count,0);
 p=tactical(p,{type:'reload',unitId:ID});assert.equal(actor(p).loaded,1);assert.equal(ammunitionByType(actor(p)).musket_75,11);
 const before=physical(p.battle),bad=actBattle(p.battle,{type:'loot',unitId:ID,groundId,count:1});
 assert.ok(bad.lastError);assert.deepEqual(physical(bad),before);
 campaign=saved({campaign:leave(saved(p))}).campaign;
 assert.equal(campaign.resources.treasury,money);assert.equal(campaign.operativeState[1000].medkits,5);
 assert.equal(repairMaterialPoints(campaign.operativeState[1000]),100);
 p=visit(campaign);assert.deepEqual(chest(p).contents,remaining);assert.equal(p.battle.groundItems.find(item=>item.id===groundId).count,0);
 assert.equal(actor(p).loaded,1);assert.equal(ammunitionByType(actor(p)).musket_75,11);
 assert.equal(rosterFor(p.campaign).find(op=>op.id===1000).weapon,1800);
});

test('finite depot caches use existing chests and preserve the original Mendoza and Yatasto caches',()=>{
 for(const [sector,definition]of Object.entries(FINITE_SECTOR_CACHES)){
  const map=buildSectorMap({sector,squad:[],enemies:[]}),authored=authoredEnvironment(sector,map),cache=authored.containers.find(container=>container.id===definition.chest);
  assert.ok(cache,sector);assert.doesNotThrow(()=>validateEnvironment(cache));
  assert.equal(cache.contents.filter(item=>item.kind==='repair-kit').length,1);
  assert.equal(cache.contents.find(item=>item.item==='medkits').count,12);
  const shirts=cache.contents.filter(item=>item.kind==='outfit');
  assert.equal(shirts.length,sector==='retiro'?1:0);
  if(sector==='retiro')assert.deepEqual(shirts[0],{item:'inventory:linen-shirt:retiro',kind:'outfit',outfit:'linen_shirt',count:1,weight:.6,condition:100,instanceId:'cache:retiro:linen-shirt'});
 }
 const m=authoredEnvironment('mendoza',buildSectorMap({sector:'mendoza',squad:[],enemies:[]}));
 assert.equal(m.containers.length,1);assert.equal(m.containers[0].contents.find(item=>item.item==='medkits').count,3);
 const y=authoredEnvironment('yatasto',buildSectorMap({sector:'yatasto',squad:[],enemies:[]}));
 assert.equal(y.containers[0].contents.filter(item=>item.kind==='repair-kit').length,0);
 assert.equal(y.containers[0].contents.length,4);
});

test('a toolkit occupies a large pocket and forged or multiplied repair points reject',()=>{
 const kit={item:'inventory:kit',kind:'repair-kit',name:'Herramientas',count:1,weight:2,repairPoints:100};
 const inventory=Object.fromEntries(Array.from({length:4},(_,i)=>[`gun${i}`,{weapon:1800,count:1,weight:4,loaded:0,condition:100}]));
 const u=createBattle([{id:'p',inventory}],{exploration:true,enemies:[]}).units[0];
 assert.throws(()=>applyItemQuantity(u,kit),/espacio|bolsillo/);
 for(const patch of [{count:2},{repairPoints:0},{repairPoints:101},{repairPoints:1.5},{repairPoints:Infinity},{weight:0},{weapon:1800},{ammoType:'musket_75'},{kind:'inventory'}])assert.throws(()=>validateItemStack({...kit,...patch}),JSON.stringify(patch));
});
