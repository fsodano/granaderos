import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {actBattle,createBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {targetPreview,tacticalInputAction} from '../game/ja2-hud.js';
import {isAmmunitionStack,totalReserveAmmunition} from '../game/ammunition-types.js';
import {ammunitionShopCapacity} from '../game/campaign-ammunition.js';
import {AMMO_KEYS} from '../game/ammo-types.js';
import {stockAndCarriedAmmo} from './ammunition-balance.mjs';
const pistolStock=s=>s.ammunitionShops.retiro.stock.ammoPistol;
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const act=(b,a)=>{const n=actBattle(b,{unitId:'10',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const leave=(s,b)=>{const pair=syncBattleTime(s,b);assert.equal(pair.error,null);return order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});};
function field({finitePistols}={}){let s=order(initialCampaign(45),{type:'squad',ids:[10]});if(finitePistols!==undefined)s.ammunitionShops.retiro={stock:{...Object.fromEntries(AMMO_KEYS.map(key=>[key,ammunitionShopCapacity(key)])),ammoPistol:finitePistols},restockHours:0};s.loadouts[10]={weapon:1808,blade:1813};s=order(s,{type:'visitSector'});const r=s.pendingBattle,b=createBattle(r.squad.map(u=>({...u,x:1,y:1})),{...r,width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:[],props:[],npcs:r.npcs.map((npc,i)=>({...npc,x:10-i,y:6})),weather:{rain:false,humidity:0}});return {s,b};}
const shooting={type:'firePoint',x:5,y:1};
test('a fully loaded issued firearm remains loaded through returns without crediting its charges to stock',()=>{
 let {s,b}=field();const before=structuredClone(s.resources);assert.equal(b.units[0].loaded,2);assert.equal(s.pendingBattle.squad[0].preserveLoading,undefined);
 s=leave(s,b);assert.deepEqual(s.resources,before);assert.equal(totalReserveAmmunition(s.operativeState[10]),8);assert.equal(s.operativeState[10].carriedLoaded,2);assert.equal(s.operativeState[10].carriedAmmo,10);assert.equal(stockAndCarriedAmmo(s),10);
 for(let i=0;i<3;i++){s=order(save(s),{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units[0].loaded,2);assert.equal(b.units[0].ammo,8);s=leave(s,b);assert.deepEqual(s.resources,before);assert.equal(stockAndCarriedAmmo(s),10);}
});
test('paid town resupply replenishes loose rounds while an empty returned gun requires an actual reload',()=>{
 let {s,b}=field();const cash=s.resources.treasury,shop=pistolStock(s);b=act(b,shooting);b=act(b,shooting);assert.equal(b.units[0].loaded,0);assert.equal(b.units[0].ammo,8);
 s=leave(s,b);assert.equal(s.operativeState[10].carriedLoaded,0);assert.equal(totalReserveAmmunition(s.operativeState[10]),8);assert.equal(pistolStock(s),shop);assert.equal(stockAndCarriedAmmo(s),8);assert.equal(s.resources.treasury,cash);
 for(let i=0;i<2;i++){s=order(save(s),{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units[0].loaded,0);assert.equal(b.units[0].ammo,10);s=leave(s,b);assert.equal(pistolStock(s),shop-2);assert.equal(s.resources.treasury,cash-2);assert.equal(stockAndCarriedAmmo(s),10);assert.equal(pistolStock(s)+stockAndCarriedAmmo(s),shop+8);}
 s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);const input=tacticalInputAction(b,b.units[0],shooting);assert.equal(input.type,'reload');const ammo=b.units[0].ammo,time=b.elapsedSeconds;b=act(b,input);assert.ok(b.elapsedSeconds>time);assert.equal(b.units[0].loaded,2);assert.equal(b.units[0].ammo,ammo-2);s=leave(s,b);assert.equal(pistolStock(s),shop-2);assert.equal(s.resources.treasury,cash-2);assert.equal(totalReserveAmmunition(s.operativeState[10]),8);assert.equal(s.operativeState[10].carriedAmmo,10);assert.equal(stockAndCarriedAmmo(s),10);save(s);
});
test('a depleted finite supplier cannot refill an exhausted gun on save and reentry',()=>{
 // The shop starts with ten pistol rounds; the initial issue buys all ten.
 let {s,b}=field({finitePistols:10});assert.equal(pistolStock(s),0);b=act(b,shooting);b=act(b,shooting);const key=Object.entries(b.units[0].inventory).find(([,stack])=>isAmmunitionStack(stack)&&stack.ammoType==='pistol_69')[0];b=act(b,{type:'drop',item:`inventory:${key}`,count:8});s=leave(s,b);const cash=s.resources.treasury;
 s=order(save(s),{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);const u=b.units[0];assert.equal(u.loaded,0);assert.equal(u.ammo,0);assert.equal(targetPreview(b,u,{x:5,y:1},{mode:'fire'}).cursor,'empty');const failed=actBattle(b,{unitId:'10',...tacticalInputAction(b,u,shooting)});assert.ok(failed.lastError);assert.deepEqual(failed.units,b.units);assert.equal(failed.elapsedSeconds,b.elapsedSeconds);
 s=leave(s,b);assert.equal(pistolStock(s),0);assert.equal(s.resources.treasury,cash);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,ammunitionShopCapacity('ammoMusket'),'unlike musket rounds cannot reload this pistol');assert.equal(s.operativeState[10].carriedLoaded,0);assert.equal(s.sectorStates.retiro.groundItems.find(g=>g.ammoType==='pistol_69').count,8);save(s);
});
test('a partially discharged gun retains its last barrel and swapping it through the armory cannot refill it',()=>{
 let {s,b}=field();b=act(b,shooting);s=leave(s,b);assert.equal(s.operativeState[10].carriedLoaded,1);const total=stockAndCarriedAmmo(s);
 s=order(s,{type:'purchaseEquipment',item:1805});s=order(s,{type:'equip',operativeId:10,slot:'weapon',itemId:1805});const stored=s.armoryItems.find(i=>i.item===1808);assert.equal(stored.loaded,1);s=order(save(s),{type:'equip',operativeId:10,slot:'weapon',itemId:1808,instanceId:stored.id});assert.equal(s.operativeState[10].carriedLoaded,1);assert.equal(stockAndCarriedAmmo(s),total);save(s);
});
