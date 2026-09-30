import {stockAndCarriedAmmo,stockAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle,reloadCost} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {planReturnAmmunition} from '../game/ammunition.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {addAmmunition,ammunitionByType,totalReserveAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {initializeUnitAmmunition,syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {addAmmoCounts,unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {AMMO_KEYS} from '../game/ammo-types.js';
const merchantAmmo=c=>Object.values(c.ammunitionShops).reduce((n,shop)=>n+AMMO_KEYS.reduce((sum,key)=>sum+shop.stock[key],0),0);
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,n.lastError);return n;};
const act=(b,a)=>{const n=actBattle(b,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=c=>decodeSave(encodeSave(c)).campaign;
const leave=(c,b)=>{const pair=syncBattleTime(c,b);assert.equal(pair.error,null);return order(pair.campaign,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});};
function partial(weapon=1802,ap=20,{finiteStock=false}={}){
 let c=initialCampaign(45);if(finiteStock)c.ammunitionShops.retiro={stock:Object.fromEntries(AMMO_KEYS.map(key=>[key,10])),restockHours:0};c.hour=12;c.loadouts[3]={weapon,blade:1813};c=order(c,{type:'visitSector'});const r=c.pendingBattle;
 assert.equal(r.squad.find(u=>u.id===3).preserveLoading,undefined);
 r.enemies=[initializeUnitAmmunition({id:'e',x:5,y:6,hp:15,bandaged:85,patrol:false,weapon:1813,loaded:0,ammo:0,agility:0,overwatch:false})];
 // Start an unfinished-loading scenario without destroying the previously
 // issued charge: put that exact prepared type back into the test reserve.
 const squad=r.squad.map((raw,i)=>{const u={...structuredClone(raw),x:1,y:1+i};if(i===0&&u.loaded){addAmmunition(u,weaponAmmoType(u.weapon),u.loaded);u.loaded=0;syncUnitAmmunition(u);}return u;});
 let b=createBattle(squad,{...r,width:32,height:8,tiles:Array.from({length:256},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),exploration:false,enemies:r.enemies});
 b.units.find(u=>u.id==='3').ap=ap;b=act(b,{type:'reload',unitId:'3'});const worker=structuredClone(b.units.find(u=>u.id==='3'));assert.ok(worker.reloadProgress>0);assert.equal(worker.ap,0);
 b=act(b,{type:'fire',unitId:'4',targetId:'e',aim:4});assert.equal(b.status,'victory');b=act(b,{type:'explore'});
 return {c,b,worker};
}
test('ordinary held guns keep paid reload work and any completed barrel through return and repeated saves',()=>{
 for(const [weapon,ap] of [[1802,20],[1808,30]]){
  let {c,b,worker}=partial(weapon,ap);const stock=stockAmmo(c),returned=b.units.filter(u=>u.side==='player').reduce((n,u)=>n+totalReserveAmmunition(u)+u.loaded,0);
  c=leave(c,b);assert.equal(stockAndCarriedAmmo(c),stock+returned);assert.equal(c.operativeState[3].carriedLoaded,worker.loaded);assert.equal(c.operativeState[3].carriedAmmo,totalReserveAmmunition(worker)+worker.loaded);assert.deepEqual(ammunitionByType(c.operativeState[3]),ammunitionByType(worker));assert.equal(c.operativeState[3].carriedReloadProgress,worker.reloadProgress);
  for(let i=0;i<3;i++){
   const before=stockAndCarriedAmmo(c),cash=c.resources.treasury,shop=merchantAmmo(c);c=order(save(c),{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.retiro);const u=b.units.find(u=>u.id==='3');assert.equal(u.reloadProgress,worker.reloadProgress);assert.equal(u.loaded,worker.loaded);c=leave(c,b);assert.equal(stockAndCarriedAmmo(c)+merchantAmmo(c),before+shop);assert.equal(c.resources.treasury,cash-(stockAndCarriedAmmo(c)-before));assert.equal(stockAndCarriedAmmo(c)-before,i===0?1:0);
  }
  c=order(save(c),{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.retiro);const u=b.units.find(u=>u.id==='3'),cost=reloadCost(u,b),before=b.elapsedSeconds,ammo=u.ammo;
  b=act(b,{type:'reload',unitId:'3'});assert.equal(b.elapsedSeconds-before,Math.max(1,Math.ceil(cost*.06)));const loaded=b.units.find(u=>u.id==='3');assert.equal(loaded.reloadProgress,undefined);assert.equal(loaded.loaded,worker.loaded+1);assert.equal(loaded.ammo,ammo-1);c=leave(c,b);assert.equal(c.operativeState[3].carriedReloadProgress,undefined);assert.equal(c.operativeState[3].carriedLoaded,worker.loaded+1);save(c);
 }
});
test('no reserve ammunition blocks loading without discarding previously paid work',()=>{
 let {c,b,worker}=partial(1802,20,{finiteStock:true});assert.equal(c.ammunitionShops.retiro.stock.ammoRifle,0);const item=`inventory:${Object.entries(worker.inventory).find(([,stack])=>stack.ammoType===weaponAmmoType(worker.weapon))[0]}`;b=act(b,{type:'drop',unitId:'3',item,count:totalReserveAmmunition(worker)});c=leave(c,b);c=order(save(c),{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.retiro);const u=b.units.find(u=>u.id==='3');assert.equal(u.ammo,0);assert.equal(u.reloadProgress,worker.reloadProgress);
 const failed=actBattle(b,{type:'reload',unitId:'3'});assert.ok(failed.lastError);assert.deepEqual(failed.units,b.units);assert.equal(failed.elapsedSeconds,b.elapsedSeconds);c=leave(c,b);assert.equal(c.operativeState[3].carriedReloadProgress,worker.reloadProgress);save(c);
 const before=structuredClone(c),events=[],prepared=finishReloadsBeforeMarch(c,{report:event=>events.push(event)});
 assert.deepEqual(c,before);assert.equal(prepared.operativeState[3].carriedReloadProgress,worker.reloadProgress);assert.equal(prepared.operativeState[3].carriedLoaded,worker.loaded);
 assert.equal(stockAndCarriedAmmo(prepared),stockAndCarriedAmmo(c));assert.ok(events.some(event=>event.id===3&&event.event==='reloadUnavailable'&&event.ammo===0));save(prepared);
});
test('captured ordinary partial work enters custody while departed work remains with its owner',()=>{
 const {c,b,worker}=partial(1808,30),request=c.pendingBattle;
 for(const kind of ['captured','departed']){
  const entries=request.squad.map(u=>({unitId:String(u.id),kind:u.id===3?kind:'resident'})),plan=planReturnAmmunition(request,b,entries);
  const retained={};for(const u of b.units.filter(u=>u.side==='player'))addAmmoCounts(retained,unitAmmunitionByType(u));
  assert.equal(plan.creditedCartridges,0);assert.deepEqual(plan.creditedAmmunition,{});assert.deepEqual(plan.retainedAmmunition,retained);
  if(kind==='captured'){assert.deepEqual(plan.custody[3],{loaded:worker.loaded,ammo:totalReserveAmmunition(worker),preserveLoading:true,reloadProgress:worker.reloadProgress});assert.equal(plan.carried[3],undefined);}
  else {assert.deepEqual(plan.carried[3],{loaded:worker.loaded,reloadProgress:worker.reloadProgress});assert.equal(plan.custody[3],undefined);}
 }
});
test('the route controller completes actual reload orders before marching and never erases work directly',()=>{
 const {c,b}=partial();const returned=leave(c,b),before=structuredClone(returned),events=[];const ready=finishReloadsBeforeMarch(returned,{report:e=>events.push(e)});
 assert.deepEqual(returned,before);assert.equal(ready.operativeState[3].carriedLoaded,1);assert.equal(ready.operativeState[3].carriedReloadProgress,undefined);assert.ok(ready.secondOfHour>returned.secondOfHour);assert.equal(stockAndCarriedAmmo(ready),stockAndCarriedAmmo(returned)+1);assert.equal(merchantAmmo(ready),merchantAmmo(returned)-1);assert.equal(ready.resources.treasury,returned.resources.treasury-1);assert.deepEqual(events.map(e=>e.id),[3,4]);assert.equal(ready.operativeState[4].carriedLoaded,2);assert.ok(events[0].paidPAEquivalent>0);assert.equal(finishReloadsBeforeMarch(ready),ready);save(ready);
});
