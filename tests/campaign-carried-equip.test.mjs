import {stockAndCarriedAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,createBattle,reloadCost} from '../game/tactical.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {playerKnownCampaign} from '../game/player-known-state.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const fixture=(loaded=1,progress)=>{const s=initialCampaign(45);s.operativeState[10].inventory={musket:{weapon:1800,count:1,weight:4,loaded,condition:62,jammed:true,instanceId:'held-musket',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'held-socket',condition:47}},...(progress?{reloadProgress:progress}:{})}};return s;};
const model=s=>sectorInventoryModel(s,'retiro',rosterFor(s),10);
const equip=(s,key='musket',slot='primary')=>order(s,{type:'sectorInventory',sector:'retiro',operativeId:10,direction:'equip',inventoryKey:key,expected:JSON.stringify(s.operativeState[10].inventory[key]),slot});
const roundtrip=s=>{assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);return s;};
const unchanged=s=>({...s,lastError:null});

test('map equips a loaded fitted gun without scouting, cost, healing or ammunition creation',()=>{
 const s=fixture(),before=structuredClone(s);assert.ok(model(s).reason);assert.equal(model(s).carriedReason,null);
 const n=equip(s),r=n.operativeState[10];assert.deepEqual(s,before);assert.equal(n.loadouts[10].weapon,1800);assert.equal(r.carriedLoaded,1);assert.equal(r.carriedAmmo,1);assert.equal(r.condition,62);assert.equal(r.jammed,true);assert.equal(r.weaponInstanceId,'held-musket');assert.equal(r.weaponFittings.bayonet.instanceId,'held-socket');
 assert.equal(r.inventory.musket,undefined);assert.ok(Object.values(r.inventory).some(i=>i.weapon===rosterFor(s).find(o=>o.id===10).weapon));
 assert.deepEqual(n.resources,s.resources);assert.equal(n.hour,s.hour);assert.equal(n.seed,s.seed);assert.equal(r.hp,s.operativeState[10].hp);assert.equal(r.energy,s.operativeState[10].energy);roundtrip(n);
 const known=playerKnownCampaign(n).operatives.find(u=>u.id===10);assert.equal(known.carriedLoaded,1);assert.equal(known.carriedAmmo,1);
});
test('empty and partially loaded map guns enter visits, attacks and defenses without an automatic reload',()=>{
 for(const scenario of ['visit','attack','defense'])for(const progress of [undefined,.5]){
  let s=equip(fixture(0,progress));const cash=s.resources.cartridges;
  if(scenario==='visit')s=order(s,{type:'visitSector'});
  if(scenario==='attack'){s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});}
  if(scenario==='defense'){launchEnemyGroup(s,'coast','retiro',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});}
  const u=s.pendingBattle.squad.find(u=>u.id===10);assert.equal(u.loaded,0);assert.equal(u.ammo,10);assert.equal(u.reloadProgress,progress);assert.equal(s.operativeState[10].carriedLoaded,undefined);assert.equal(s.operativeState[10].carriedReloadProgress,undefined);
  assert.equal(s.resources.cartridges,cash-s.pendingBattle.issuedCartridges);const b=enterSector(s.pendingBattle,s.sectorStates[s.pendingBattle.sector]);assert.equal(b.units.find(u=>u.id==='10').reloadProgress,progress);assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
 }
});
test('loaded map charge remains with its gun after visit without entering stock twice',()=>{
 let s=equip(fixture());const stock=s.resources.cartridges;s=order(s,{type:'visitSector'});const u=s.pendingBattle.squad.find(u=>u.id===10);assert.equal(u.loaded,1);assert.equal(u.ammo,9);assert.equal(s.resources.cartridges,stock-s.pendingBattle.issuedCartridges+1);
 const b=enterSector(s.pendingBattle,s.sectorStates.retiro);s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(stockAndCarriedAmmo(s),stock+1);assert.equal(s.operativeState[10].carriedAmmo,1);assert.equal(s.operativeState[10].carriedLoaded,1);roundtrip(s);
});
test('swapping back stores exact loaded work and identity in the backpack',()=>{
 for(const [loaded,progress] of [[1,undefined],[0,.5]]){
  let s=equip(fixture(loaded,progress)),r=s.operativeState[10];const key=Object.keys(r.inventory).find(k=>r.inventory[k].instanceId!=='held-musket');s=equip(s,key);r=s.operativeState[10];const stored=Object.values(r.inventory).find(i=>i.instanceId==='held-musket');assert.equal(stored.loaded,loaded);assert.equal(stored.reloadProgress,progress);assert.equal(r.carriedAmmo,0);assert.equal(stored.fittings.bayonet.condition,47);roundtrip(s);
 }
});
test('an armory swap preserves the outgoing charge or partial work and restores it when re-equipped',()=>{
 for(const [loaded,progress] of [[1,undefined],[0,.5]]){
  let s=equip(fixture(loaded,progress));s=order(s,{type:'purchaseEquipment',item:1805,quantity:1});s=order(s,{type:'equip',operativeId:10,slot:'weapon',itemId:1805});
  const stored=s.armoryItems.find(i=>i.instanceId==='held-musket');assert.equal(stored.loaded,loaded);assert.equal(stored.reloadProgress,progress);assert.equal(s.operativeState[10].carriedAmmo,0);roundtrip(s);
  for(const change of [item=>item.loaded=3,item=>item.reloadProgress=1]){const bad=structuredClone(s);change(bad.armoryItems.find(i=>i.id===stored.id));assert.throws(()=>decodeSave(encodeSave(bad)));}
  s=order(s,{type:'sellEquipment',instanceId:stored.id});roundtrip(s);s=order(s,{type:'purchaseUsedEquipment',sector:'retiro',instanceId:stored.id});assert.deepEqual(s.armoryItems.find(i=>i.id===stored.id),stored);
  s=order(s,{type:'equip',operativeId:10,slot:'weapon',itemId:1800,instanceId:stored.id});assert.equal(s.operativeState[10].carriedLoaded,loaded);assert.equal(s.operativeState[10].carriedReloadProgress,progress);assert.equal(s.operativeState[10].carriedAmmo,loaded);roundtrip(s);
 }
});
test('stale items, wrong slots, full packs, sleep, transit and occupation reject atomically',()=>{
 const base=fixture(),action={type:'sectorInventory',sector:'retiro',operativeId:10,direction:'equip',inventoryKey:'musket',expected:JSON.stringify(base.operativeState[10].inventory.musket),slot:'primary'};
 for(const mutate of [s=>s.operativeState[10].inventory.musket.condition=50,s=>s.operativeState[10].asleep=true,s=>s.sectors.retiro.owner='royalist',s=>s.operativeState[10].hp=5,s=>{for(let i=0;i<12;i++)s.operativeState[10].inventory['extra'+i]={count:1,weight:0};}]){
  const s=structuredClone(base);mutate(s);const n=dispatchCampaign(s,action);assert.ok(n.lastError);assert.deepEqual(unchanged(n),unchanged(s));
 }
 for(const a of [{...action,slot:'blade'},{...action,count:2},{...action,inventoryKey:'missing'}]){const n=dispatchCampaign(base,a);assert.ok(n.lastError);assert.deepEqual(unchanged(n),unchanged(base));}
 const traveling=order(base,{type:'travel',sector:'buenos_aires',queue:true});assert.ok(dispatchCampaign(traveling,action).lastError);
});
test('malformed loading state cannot be saved for a full, dropped or different weapon',()=>{
 const s=equip(fixture(0,.5));for(const mutate of [r=>r.carriedLoaded=2,r=>r.carriedLoaded=-1,r=>r.carriedLoaded=.5,r=>r.carriedLoaded=1,r=>r.carriedReloadProgress=1,r=>r.carriedReloadProgress=0,r=>r.weaponDropped=true,r=>delete r.carriedLoaded]){const bad=structuredClone(s);mutate(bad.operativeState[10]);assert.throws(()=>decodeSave(encodeSave(bad)));}
});

const leave=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
const flatBattle=s=>createBattle(s.pendingBattle.squad.map((u,i)=>({...u,x:2+i,y:2})),{...s.pendingBattle,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:[],props:[],npcs:[]});
test('prepared load and unfinished work survive repeated returns and charge only the remaining reload',()=>{
 for(const [weapon,loaded,progress] of [[1800,0,.5],[1808,1,.5],[1800,0,undefined]]){
  const f=fixture(loaded,progress);Object.assign(f.operativeState[10].inventory.musket,{weapon,fittings:{},jammed:false});let s=equip(f);const stock=s.resources.cartridges;
  for(let i=0;i<3;i++){s=order(roundtrip(s),{type:'visitSector'});s=leave(s,flatBattle(s));assert.equal(s.operativeState[10].carriedLoaded,loaded);assert.equal(s.operativeState[10].carriedReloadProgress,progress);assert.equal(stockAndCarriedAmmo(s),stock+loaded);}
  s=order(s,{type:'visitSector'});let b=flatBattle(s),u=b.units.find(u=>u.id==='10'),cost=reloadCost(u,b),ammo=u.ammo;
  b=actBattle(b,{type:'reload',unitId:'10'});assert.equal(b.lastError,null);u=b.units.find(u=>u.id==='10');assert.equal(b.elapsedSeconds,Math.max(1,Math.ceil(cost*.06)));assert.equal(u.ammo,ammo-1);assert.equal(u.loaded,loaded+1);assert.equal(u.reloadProgress,undefined);s=leave(s,b);assert.equal(stockAndCarriedAmmo(s),stock+loaded);assert.equal(s.operativeState[10].carriedLoaded,loaded+1);roundtrip(s);
 }
});
test('map drop, recovery, and secondary equip preserve prepared guns without duplicating a charge',()=>{
 for(const [loaded,progress] of [[1,undefined],[0,.5]]){
  let s=equip(fixture(loaded,progress));s=order(s,{type:'visitSector'});s=leave(s,flatBattle(s));const stock=s.resources.cartridges;
  s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:10,direction:'drop',item:'primary'});assert.equal(s.operativeState[10].carriedLoaded,undefined);assert.equal(s.operativeState[10].carriedAmmo,0);
  const row=model(s).entries.find(row=>row.loaded===loaded);assert.ok(row.reachable);s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:10,direction:'take',sourceKey:row.key,expected:row.expected});const key=Object.keys(s.operativeState[10].inventory).find(k=>s.operativeState[10].inventory[k].instanceId==='held-musket');s=equip(s,key);
  s.operativeState[10].inventory.knife={weapon:1813,count:1,weight:.5,condition:83};s=equip(s,'knife','blade');assert.equal(s.loadouts[10].blade,1813);assert.equal(s.operativeState[10].carriedLoaded,loaded);assert.equal(s.operativeState[10].carriedReloadProgress,progress);assert.equal(s.operativeState[10].carriedAmmo,loaded);assert.equal(s.resources.cartridges,stock);roundtrip(s);
 }
});

test('capture and rescue retain prepared loading and keep captive rounds out of shared stock',()=>{
 const f=fixture(1,.5);Object.assign(f.operativeState[10].inventory.musket,{weapon:1808,fittings:{},jammed:false});let s=equip(f);s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});
 let b=createBattle(s.pendingBattle.squad.map((u,i)=>({...u,x:2+i,y:15,...(u.id===10?{hp:10,bandaged:u.maxHp-10,unconscious:true}: {})})),{...s.pendingBattle,width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:s.pendingBattle.enemies.map((u,i)=>({...u,x:18,y:i,ap:0})),props:[],npcs:[]});
 b=actBattle(b,{type:'exit',unitIds:['3','4'],exitId:b.exits.find(e=>e.destination==='buenos_aires').id});assert.equal(b.lastError,null);assert.equal(b.status,'retreat');const stock=s.resources.cartridges,returned=b.units.filter(u=>['3','4'].includes(u.id)).reduce((sum,u)=>sum+u.ammo+u.loaded,0);
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(stockAndCarriedAmmo(s),stock+returned);assert.deepEqual(s.operativeState[10].capturedAmmunition,{loaded:1,ammo:9,preserveLoading:true,reloadProgress:.5});assert.equal(s.operativeState[10].carriedAmmo,0);roundtrip(s);
 const invalid=structuredClone(s);invalid.operativeState[10].capturedAmmunition.reloadProgress=1;assert.throws(()=>decodeSave(encodeSave(invalid)));
 s=order(s,{type:'attack',sector:'san_nicolas'});const legacy=structuredClone(s);delete legacy.operativeState[10].capturedAmmunition.preserveLoading;delete legacy.operativeState[10].capturedAmmunition.reloadProgress;const pooled=order(legacy,scriptedBattleReport(legacy));s=order(s,scriptedBattleReport(s));assert.equal(s.operativeState[10].captured,false);assert.equal(s.operativeState[10].carriedLoaded,1);assert.equal(s.operativeState[10].carriedReloadProgress,.5);assert.equal(s.operativeState[10].carriedAmmo,1);assert.equal(s.resources.cartridges,pooled.resources.cartridges-1);roundtrip(s);
});
test('a weapon passed through the armory can be dropped by its new owner after a shared visit',()=>{
 let s=equip(fixture());s=order(s,{type:'visitSector'});s=leave(s,flatBattle(s));
 s=order(s,{type:'purchaseEquipment',item:1805,quantity:1});s=order(s,{type:'equip',operativeId:10,slot:'weapon',itemId:1805});const stored=s.armoryItems.find(i=>i.instanceId==='held-musket');s=order(s,{type:'equip',operativeId:3,slot:'weapon',itemId:1800,instanceId:stored.id});
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:3,direction:'drop',item:'primary'});assert.equal(s.operativeState[3].weaponDropped,true);assert.equal(s.operativeState[3].carriedAmmo,0);const gun=s.sectorStates.retiro.groundItems.find(g=>g.instanceId==='held-musket');assert.equal(gun.loaded,1);assert.equal(gun.fittings.bayonet.instanceId,'held-socket');roundtrip(s);
});
