import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,deploymentCost,isSupplied} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {sync} from './local-contract-fixture.mjs';
import {enterSector} from '../game/world.js';
import {secondaryRetreat} from './secondary-loot-fixture.mjs';
import {ammoCount,totalAmmo,changeAmmo} from '../game/ammo-types.js';
import {ammunitionOrderQuote,ammunitionShopCapacity} from '../game/campaign-ammunition.js';
import {order,visit,leave,saved,tactical} from './local-contract-fixture.mjs';
import {withCarriedAmmo,withStoredGear,withStoredAmmo,assertTradeRejected} from './commerce-gear-fixture.mjs';

const content=()=>{const d=defaultContentPackage();Object.assign(d.rules,{startingTreasury:9000,cartridgePrice:3});d.characters.find(c=>c.id==='person-110').arrivalHours=0;return d;};
const hired=()=>order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'month'});
const supply=(s,family,quantity,direction)=>order(s,{type:'ammunition',operativeId:110,family,quantity,direction});
const carried=(s,family,quantity)=>withCarriedAmmo(s,110,family,quantity);
const reject=(s,action)=>{const before=structuredClone(s),n=dispatchCampaign(s,action);assert.ok(n.lastError);delete n.lastError;delete before.lastError;assert.deepEqual(n,before);};

test('finite owned cartridges and public sector transfers conserve each family without buying',()=>{
 let s=hired(),cash=s.resources.treasury;
 s=carried(s,'ammoPistol',20);assert.equal(s.resources.treasury,cash);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),20);assert.deepEqual(s.ammunitionShops,{});assertTradeRejected(s,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'buy'});
 s=supply(s,'ammoPistol',13,'store');assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),7);assert.equal(s.ammunitionStores.retiro.ammoPistol,13);
 s=saved({campaign:s}).campaign;s=supply(s,'ammoPistol',5,'take');assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),12);assert.equal(s.ammunitionStores.retiro.ammoPistol,8);assert.equal(s.resources.treasury,cash);
 const op=rosterFor(s).find(o=>o.id===110),quote=ammunitionOrderQuote(s,op,'ammoPistol',5,'take',true);assert.equal(quote.carried+quote.stored,20);assert.equal(quote.cost,0);
 for(const patch of [{quantity:61},{quantity:0},{quantity:.5},{family:'invented'},{direction:'take',quantity:9},{direction:'store',quantity:13},{operativeId:111}])reject(s,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:1,direction:'buy',...patch});
});

test('one-time starting cartridges and repeated deployment retain finite charges without purchase or refill',()=>{
 let s=hired();const cash=s.resources.treasury;assert.equal(deploymentCost(s),0);
 let p=visit(s);assert.equal(p.campaign.resources.treasury,cash);const unit=p.battle.units.find(u=>u.id==='110');assert.equal(unit.loaded+unit.ammo,10);
 p=tactical(p,{type:'dropSupply',item:'ammoMusket',count:3});s=leave(saved(p));assert.equal(s.operativeState[110].carriedLoaded,1);assert.equal(totalAmmo(s.operativeState[110]),6);assert.equal(s.resources.treasury,cash);assert.equal(s.sectorStates.retiro.groundItems.filter(g=>g.ammoType==='musket_75').reduce((n,g)=>n+g.count,0),3);
 assert.equal(deploymentCost(s),0);p=visit(saved({campaign:s}).campaign);assert.equal(p.campaign.resources.treasury,cash);assert.equal(p.battle.units.find(u=>u.id==='110').ammo,6);const again=leave(p);assert.equal(again.resources.treasury,cash);assert.equal(deploymentCost(again),0);
 assert.ok(dispatchCampaign(again,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')}).lastError);
});

test('mixed reserves survive actual weapon replacement, deployment and repeated restoration',()=>{
 let s=carried(hired(),'ammoPistol',8);s=leave(visit(s));const cash=s.resources.treasury,op=rosterFor(s).find(o=>o.id===110);assert.equal(op.weapon,1800);
 s=withStoredGear(s,'firearm-1805');const instance=s.armoryItems.find(i=>i.itemMetadata?.contentWeapon?.id==='firearm-1805');
 s=order(s,{type:'equip',operativeId:110,slot:'weapon',itemId:'firearm-1805',instanceId:instance.id});assert.equal(s.operativeState[110].carriedLoaded,0);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),9);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),8);
 const storedMusket=s.armoryItems.find(i=>i.item===1800);assert.ok(storedMusket);assert.equal(storedMusket.loaded,1);
 let p=visit(s);assert.equal(p.battle.units[0].loaded,0);assert.equal(ammoCount(p.battle.units[0],'ammoPistol'),8);assert.equal(ammoCount(p.battle.units[0],'ammoMusket'),9);assert.equal(p.campaign.resources.treasury,cash);
 const elapsed=p.battle.elapsedSeconds,shops=structuredClone(p.campaign.ammunitionShops);p=tactical(p,{type:'reload'});assert.equal(p.battle.units[0].loaded,1);assert.equal(ammoCount(p.battle.units[0],'ammoPistol'),7);assert.ok(p.battle.elapsedSeconds>elapsed);assert.deepEqual(p.campaign.ammunitionShops,shops);assert.equal(p.campaign.resources.treasury,cash);
 const returned=leave(p),restored=saved({campaign:returned}).campaign;assert.deepEqual(restored.armoryItems.find(i=>i.id===storedMusket.id),storedMusket);assert.deepEqual(restored,returned);assert.deepEqual(saved({campaign:restored}).campaign,restored);
});

test('family substitution or additional witnessed rounds cannot settle a battle',()=>{
 const p=visit(hired());
 for(const variant of ['create','convert']){
  const b=structuredClone(p.battle),u=b.units.find(u=>u.id==='110');
  if(variant==='create')changeAmmo(u,'ammoMusket',1);else{changeAmmo(u,'ammoMusket',-1);changeAmmo(u,'ammoPistol',1);}
  reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 }
});

test('old settled saves gain no stock and invalid custody records fail restoration',()=>{
 const s=hired(),old=structuredClone(s);delete old.ammunitionCustodyVersion;delete old.ammunitionStores;delete old.ammunitionShops;
 const migrated=saved({campaign:old}).campaign;assert.deepEqual(migrated.ammunitionStores,{});assert.deepEqual(migrated.ammunitionShops,{});assert.equal(migrated.resources.treasury,s.resources.treasury);assert.deepEqual(saved({campaign:migrated}).campaign,migrated);
 for(const mutate of [s=>s.ammunitionCustodyVersion=2,s=>delete s.ammunitionStores,s=>s.ammunitionStores.retiro={ammoPistol:-1},s=>s.ammunitionStores.retiro={invented:3},s=>s.ammunitionStores.nowhere={},s=>s.operativeState[110].carriedLoaded=2,s=>s.ammunitionShops.retiro={stock:{ammoMusket:9999},restockHours:0}]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>saved({campaign:bad}));}
});

test('ordinary elapsed time preserves finite owned stores and never restocks a saved depleted merchant',()=>{
 let state=withStoredAmmo(hired(),'retiro','ammoRifle',20);state.ammunitionShops.retiro={stock:{ammoMusket:0,ammoPistol:0,ammoRifle:0,ammoShot:0},restockHours:0};const shops=structuredClone(state.ammunitionShops),cash=state.resources.treasury;
 state=order(state,{type:'wait',hours:24});assert.deepEqual(state.ammunitionShops,shops);assert.equal(state.ammunitionStores.retiro.ammoRifle,20);assert.equal(state.resources.treasury,cash);assertTradeRejected(state,{type:'ammunition',operativeId:110,family:'ammoRifle',quantity:1,direction:'buy'});
 const pair=visit(state);reject(pair.campaign,{type:'ammunition',operativeId:110,family:'ammoRifle',quantity:1,direction:'take'});
});

test('departure and remote entry retain the same finite owned cartridges without a new purchase',()=>{
 let s=carried(hired(),'ammoRifle',3),cash=s.resources.treasury;
 s=order(s,{type:'travel',sector:'cell-27-27'});assert.equal(s.resources.treasury,cash);assert.equal(deploymentCost(s),0);
 const before=saved({campaign:s}).campaign,p=visit(before),u=p.battle.units.find(u=>u.id==='110');assert.equal(u.loaded,1);assert.equal(ammoCount(u,'ammoMusket'),9);assert.equal(ammoCount(u,'ammoRifle'),3);assert.equal(p.campaign.resources.treasury,s.resources.treasury);
 const returned=leave(p);assert.deepEqual(returned.ammunitionShops,s.ammunitionShops);assert.equal(ammoCount(returned.operativeState[110],'ammoRifle'),3);
 reject(returned,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:1,direction:'buy'});
});

test('actual partial loading survives retreat, storage, save and reentry without being completed',()=>{
 const d=content();Object.assign(d.weapons.find(w=>w.id==='firearm-1800'),{reloadAP:250,damage:1});
 let s=order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'month'});s=order(s,{type:'attack',sector:'buenos_aires'});const r=s.pendingBattle;
 const issued=enterSector(r),exit=issued.exits.find(e=>e.destination===r.origin);assert.ok(exit);
 const point=exit.edge==='N'?{x:1,y:0}:exit.edge==='S'?{x:1,y:19}:exit.edge==='W'?{x:0,y:1}:{x:19,y:1};
 const target={x:point.x===19?18:point.x===0?1:point.x+1,y:point.y};
 // Retain every issued enemy in compact declared geometry. Fire at an empty
 // nearby cell, perform actual partial work, then withdraw through the boundary.
 const enemies=issued.units.filter(u=>u.side==='enemy').map((u,i)=>{const at={x:exit.edge==='E'?0:19-i,y:exit.edge==='S'?0:19-i};return {...u,...at,patrolOrigin:at,overwatch:false,patrol:false};});
 let b=createBattle(r.squad.map(u=>({...u,...point})),{...r,width:20,height:20,tiles:Array.from({length:400},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies,npcs:r.npcs.map((n,i)=>({...n,x:8+i%3,y:7+Math.floor(i/3)}))});
 b=actBattle(b,{type:'firePoint',unitId:'110',...target});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,0);
 b=actBattle(b,{type:'reload',unitId:'110'});assert.equal(b.lastError,null);const progress=b.units[0].reloadProgress;assert.ok(progress>0&&progress<1);
 b=endTurn(b);assert.equal(b.status,'active');assert.equal(b.units[0].reloadProgress,progress);
 let p=secondaryRetreat(saved(sync({campaign:s,battle:b})));s=order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.operativeState[110].carriedReloadProgress,progress);const remaining=ammoCount(s.operativeState[110],'ammoMusket')-1;s=supply(s,'ammoMusket',1,'store');s=saved({campaign:s}).campaign;assert.equal(s.operativeState[110].carriedReloadProgress,progress);
 p=visit(s);assert.equal(p.battle.units[0].loaded,0);assert.equal(p.battle.units[0].reloadProgress,progress);assert.equal(p.battle.units[0].ammo,remaining);assert.equal(p.campaign.ammunitionStores.retiro.ammoMusket,1);
 s=leave(p);assert.equal(s.operativeState[110].carriedReloadProgress,progress);assert.equal(s.operativeState[110].carriedLoaded,0);assert.deepEqual(saved({campaign:s}).campaign,s);
});

test('old pending paid deployments settle once as physical stock and missing living reports reject',()=>{
 const p=visit(hired()),old=structuredClone(p);delete old.campaign.ammunitionCustodyVersion;delete old.campaign.ammunitionStores;delete old.campaign.ammunitionShops;
 const restored=saved(old),s=leave(restored);assert.equal(s.resources.treasury,p.campaign.resources.treasury);assert.equal(s.operativeState[110].carriedLoaded+s.operativeState[110].ammo,10);assert.equal(deploymentCost(s),0);
 reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:[]});
 const bad=structuredClone(p.battle);bad.units=bad.units.filter(u=>u.id!=='110');reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:bad,survivors:[]});
});

test('finite sector stores remain available after restoration while merchant purchases cannot create rounds',()=>{
 let state=withStoredAmmo(hired(),'retiro','ammoRifle',60),cash=state.resources.treasury;state.ammunitionShops.retiro={stock:{ammoMusket:0,ammoPistol:0,ammoRifle:0,ammoShot:0},restockHours:0};state=saved({campaign:state}).campaign;
 assertTradeRejected(state,{type:'ammunition',operativeId:110,family:'ammoRifle',quantity:1,direction:'buy'});
 state=supply(state,'ammoRifle',20,'take');assert.equal(state.ammunitionShops.retiro.stock.ammoRifle,0);assert.equal(state.ammunitionStores.retiro.ammoRifle,40);assert.equal(ammoCount(state.operativeState[110],'ammoRifle'),20);assert.equal(state.resources.treasury,cash);assert.deepEqual(saved({campaign:state}).campaign,state);
});

test('equivalent report inventory order is accepted while unknown snapshot families are rejected',()=>{
 const p=visit(carried(hired(),'ammoPistol',4)),reports=p.battle.units.filter(u=>u.side==='player').map(u=>({...u,inventory:Object.fromEntries(Object.entries(u.inventory).reverse())}));
 const action={type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:reports};
 const s=order(p.campaign,action);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),4);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),9);
 const bad=structuredClone(action);bad.sectorState.units.find(u=>u.id==='110').inventory.unknown={kind:'ammunition',ammoType:'unknown',count:1,weight:.04,name:'Inválido'};reject(p.campaign,bad);
});
