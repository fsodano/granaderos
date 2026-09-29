import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,deploymentCost,isSupplied} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {sync} from './local-contract-fixture.mjs';
import {ammoCount,totalAmmo} from '../game/ammo-types.js';
import {ammunitionOrderQuote,ammunitionShopCapacity} from '../game/campaign-ammunition.js';
import {order,visit,leave,saved,tactical} from './local-contract-fixture.mjs';

const content=()=>{const d=defaultContentPackage();Object.assign(d.rules,{startingTreasury:9000,cartridgePrice:3});d.characters.find(c=>c.id==='person-110').arrivalHours=0;return d;};
const hired=()=>order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'month'});
const supply=(s,family,quantity,direction='buy')=>order(s,{type:'ammunition',operativeId:110,family,quantity,direction});
const reject=(s,action)=>{const before=structuredClone(s),n=dispatchCampaign(s,action);assert.ok(n.lastError);delete n.lastError;delete before.lastError;assert.deepEqual(n,before);};

test('purchases and sector storage conserve each family, money and finite merchant stock',()=>{
 let s=hired(),cash=s.resources.treasury;
 s=supply(s,'ammoPistol',20);assert.equal(s.resources.treasury,cash-60);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),20);assert.equal(s.ammunitionShops.retiro.stock.ammoPistol,ammunitionShopCapacity('ammoPistol')-20);
 s=supply(s,'ammoPistol',13,'store');assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),7);assert.equal(s.ammunitionStores.retiro.ammoPistol,13);
 s=saved({campaign:s}).campaign;s=supply(s,'ammoPistol',5,'take');assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),12);assert.equal(s.ammunitionStores.retiro.ammoPistol,8);assert.equal(s.resources.treasury,cash-60);
 const op=rosterFor(s).find(o=>o.id===110),quote=ammunitionOrderQuote(s,op,'ammoPistol',5,'take',true);assert.equal(quote.carried+quote.stored,20);assert.equal(quote.cost,0);
 for(const patch of [{quantity:61},{quantity:0},{quantity:.5},{family:'invented'},{direction:'take',quantity:9},{direction:'store',quantity:13},{operativeId:111}])reject(s,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'buy',...patch});
});

test('deployment buys only a supplied town shortfall and return preserves physical rounds without a refund',()=>{
 let s=hired();const cash=s.resources.treasury;assert.equal(deploymentCost(s),30);
 let p=visit(s);assert.equal(p.campaign.resources.treasury,cash-30);const unit=p.battle.units.find(u=>u.id==='110');assert.equal(unit.loaded+unit.ammo,10);
 p=tactical(p,{type:'dropSupply',item:'ammoMusket',count:3});s=leave(saved(p));assert.equal(s.operativeState[110].carriedLoaded,1);assert.equal(totalAmmo(s.operativeState[110]),6);assert.equal(s.resources.treasury,cash-30);assert.equal(s.sectorStates.retiro.groundItems.filter(g=>g.type==='ammoMusket').reduce((n,g)=>n+g.count,0),3);
 assert.equal(deploymentCost(s),9);p=visit(saved({campaign:s}).campaign);assert.equal(p.campaign.resources.treasury,cash-39);assert.equal(p.battle.units.find(u=>u.id==='110').ammo,9);const again=leave(p);assert.equal(again.resources.treasury,cash-39);assert.equal(deploymentCost(again),0);
 assert.ok(dispatchCampaign(again,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')}).lastError);
});

test('mixed reserves survive actual weapon replacement, deployment and repeated restoration',()=>{
 let s=supply(hired(),'ammoPistol',8);s=leave(visit(s));const cash=s.resources.treasury,op=rosterFor(s).find(o=>o.id===110);assert.equal(op.weapon,1800);
 s=order(s,{type:'purchaseEquipment',item:'firearm-1805'});const instance=s.armoryItems.find(i=>i.contentWeapon.id==='firearm-1805');
 s=order(s,{type:'equip',operativeId:110,slot:'weapon',itemId:'firearm-1805',instanceId:instance.id});assert.equal(s.operativeState[110].carriedLoaded,0);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),10);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),8);
 const p=visit(s);assert.equal(p.battle.units[0].loaded,1);assert.equal(ammoCount(p.battle.units[0],'ammoPistol'),9);assert.equal(ammoCount(p.battle.units[0],'ammoMusket'),10);assert.equal(p.campaign.resources.treasury,cash-130-6);
 const returned=leave(p),restored=saved({campaign:returned}).campaign;assert.deepEqual(restored,returned);assert.deepEqual(saved({campaign:restored}).campaign,restored);
});

test('family substitution or additional witnessed rounds cannot settle a battle',()=>{
 const p=visit(hired());
 for(const variant of ['create','convert']){
  const b=structuredClone(p.battle),u=b.units.find(u=>u.id==='110');
  if(variant==='create'){u.ammunition.ammoMusket++;u.ammo++;}else{u.ammunition.ammoMusket--;u.ammunition.ammoPistol=1;}
  reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 }
});

test('old settled saves gain no stock and invalid custody records fail restoration',()=>{
 const s=hired(),old=structuredClone(s);delete old.ammunitionCustodyVersion;delete old.ammunitionStores;delete old.ammunitionShops;
 const migrated=saved({campaign:old}).campaign;assert.deepEqual(migrated.ammunitionStores,{});assert.deepEqual(migrated.ammunitionShops,{});assert.equal(migrated.resources.treasury,s.resources.treasury);assert.deepEqual(saved({campaign:migrated}).campaign,migrated);
 for(const mutate of [s=>s.ammunitionCustodyVersion=2,s=>delete s.ammunitionStores,s=>s.ammunitionStores.retiro={ammoPistol:-1},s=>s.ammunitionStores.retiro={invented:3},s=>s.ammunitionStores.nowhere={},s=>s.operativeState[110].carriedLoaded=2,s=>s.ammunitionShops.retiro={stock:{ammoMusket:9999},restockHours:0}]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>saved({campaign:bad}));}
});

test('stock replenishes only after supplied time and unavailable orders do not change ownership',()=>{
 let s=supply(hired(),'ammoRifle',20);s=supply(s,'ammoRifle',20,'store');const before=s.ammunitionShops.retiro.stock.ammoRifle;
 s=order(s,{type:'wait',hours:23});assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,before);s=order(s,{type:'wait',hours:1});assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,before+6);assert.equal(s.ammunitionStores.retiro.ammoRifle,20);
 const op=rosterFor(s).find(o=>o.id===110),quote=ammunitionOrderQuote(s,op,'ammoRifle',1,'buy',false);assert.equal(quote.available,false);assert.match(quote.reason,/comunicada/);
 const p=visit(s);reject(p.campaign,{type:'ammunition',operativeId:110,family:'ammoRifle',quantity:1,direction:'buy'});assert.equal(isSupplied(s,'retiro'),true);
});


test('departure buys at the supplied town once and remote entry retains the same owned cartridges',()=>{
 let s=supply(hired(),'ammoRifle',3),cash=s.resources.treasury;
 s=order(s,{type:'travel',sector:'cell-27-27'});assert.equal(s.resources.treasury,cash-30);assert.equal(deploymentCost(s),0);
 const before=saved({campaign:s}).campaign,p=visit(before),u=p.battle.units.find(u=>u.id==='110');assert.equal(u.loaded,1);assert.equal(ammoCount(u,'ammoMusket'),9);assert.equal(ammoCount(u,'ammoRifle'),3);assert.equal(p.campaign.resources.treasury,s.resources.treasury);
 const returned=leave(p);assert.deepEqual(returned.ammunitionShops,s.ammunitionShops);assert.equal(ammoCount(returned.operativeState[110],'ammoRifle'),3);
 reject(returned,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:1,direction:'buy'});
});

test('actual partial loading survives retreat, storage, save and reentry without being completed',()=>{
 const d=content();Object.assign(d.weapons.find(w=>w.id==='firearm-1800'),{reloadAP:250,damage:1});
 let s=order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'month'});s=order(s,{type:'attack',sector:'buenos_aires'});const r=s.pendingBattle;
 let b=createBattle(r.squad.map(u=>({...u,x:1,y:1})),{...r,width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'guard',x:5,y:1,weapon:1813,ammo:0,overwatch:false,patrol:false}],npcs:r.npcs.map((n,i)=>({...n,x:8+i%3,y:4+Math.floor(i/3)}))});
 b=actBattle(b,{type:'fire',unitId:'110',targetId:'guard'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,0);
 b=actBattle(b,{type:'reload',unitId:'110'});assert.equal(b.lastError,null);const progress=b.units[0].reloadProgress;assert.ok(progress>0&&progress<1);
 let p=saved(sync({campaign:s,battle:b}));s=order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.operativeState[110].carriedReloadProgress,progress);s=supply(s,'ammoMusket',1,'store');s=saved({campaign:s}).campaign;assert.equal(s.operativeState[110].carriedReloadProgress,progress);
 p=visit(s);assert.equal(p.battle.units[0].loaded,0);assert.equal(p.battle.units[0].reloadProgress,progress);assert.equal(p.battle.units[0].ammo,10);assert.equal(p.campaign.ammunitionStores.retiro.ammoMusket,1);
 s=leave(p);assert.equal(s.operativeState[110].carriedReloadProgress,progress);assert.equal(s.operativeState[110].carriedLoaded,0);assert.deepEqual(saved({campaign:s}).campaign,s);
});

test('old pending paid deployments settle once as physical stock and missing living reports reject',()=>{
 const p=visit(hired()),old=structuredClone(p);delete old.campaign.ammunitionCustodyVersion;delete old.campaign.ammunitionStores;delete old.campaign.ammunitionShops;delete old.campaign.operativeState[110].ammunition;delete old.campaign.operativeState[110].ammo;delete old.campaign.operativeState[110].carriedLoaded;
 const restored=saved(old),s=leave(restored);assert.equal(s.resources.treasury,p.campaign.resources.treasury);assert.equal(s.operativeState[110].carriedLoaded+s.operativeState[110].ammo,10);assert.equal(deploymentCost(s),0);
 reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:[]});
 const bad=structuredClone(p.battle);bad.units=bad.units.filter(u=>u.id!=='110');reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:bad,survivors:[]});
});

test('a depleted merchant cannot sell or reissue stored stock through a restored campaign',()=>{
 let s=hired(),cash=s.resources.treasury;
 for(let i=0;i<3;i++){s=supply(s,'ammoRifle',20);s=supply(s,'ammoRifle',20,'store');}
 assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,0);assert.equal(s.ammunitionStores.retiro.ammoRifle,60);assert.equal(s.resources.treasury,cash-180);
 s=saved({campaign:s}).campaign;
 reject(s,{type:'ammunition',operativeId:110,family:'ammoRifle',quantity:1,direction:'buy'});
 s=supply(s,'ammoRifle',20,'take');assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,0);assert.equal(s.ammunitionStores.retiro.ammoRifle,40);assert.equal(ammoCount(s.operativeState[110],'ammoRifle'),20);assert.equal(s.resources.treasury,cash-180);
});

test('equivalent report family order is accepted while unknown report families are rejected',()=>{
 const p=visit(supply(hired(),'ammoPistol',4)),reports=p.battle.units.filter(u=>u.side==='player').map(u=>({...u,ammunition:Object.fromEntries(Object.entries(u.ammunition).reverse())}));
 const action={type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:reports};
 const s=order(p.campaign,action);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),4);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),9);
 const bad=structuredClone(action);bad.survivors[0].ammunition.unknown=0;reject(p.campaign,bad);
});
