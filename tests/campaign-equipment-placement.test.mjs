import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {inventoryUsage,equipmentFingerprint,pocketFingerprint} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';
import {encodeSave,decodeSave} from '../game/save.js';import {enterSector} from '../game/world.js';
import {addAmmunition,ammunitionByType} from '../game/ammunition-types.js';
import {syncCarriedAmmunition} from '../game/campaign-ammunition.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const fresh=()=>order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const model=s=>sectorInventoryModel(s,'retiro',rosterFor(s),110);
const actor=s=>model(s).personal;
const pocket=(s,item)=>inventoryUsage(actor(s)).slots.find(p=>p.entry?.item===item).id;
const action=(s,from,to,kind='equipment')=>({type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind,sourceId:from,destinationId:to,expectedSource:kind==='equipment'?equipmentFingerprint(actor(s),from):pocketFingerprint(model(s).usage.slots.find(p=>p.id===from)),expectedDestination:kind==='equipment'?equipmentFingerprint(actor(s),to):pocketFingerprint(model(s).usage.slots.find(p=>p.id===to))});
const move=(s,from,to,kind)=>order(s,action(s,from,to,kind));
const save=s=>{const restored=decodeSave(encodeSave(s));assert.deepEqual(restored.campaign,s);return restored.campaign;};
const reject=(s,a)=>{const n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},{...s,lastError:null});};
test('campaign dragging stores and restores a fitted gun with its exact unfinished reload',()=>{
 let s=fresh();Object.assign(s.operativeState[110],{carriedLoaded:0,carriedAmmo:3,carriedReloadProgress:.5,condition:61,weaponInstanceId:'drag-rifle',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:73,instanceId:'drag-bayonet'}}});
 addAmmunition(s.operativeState[110],'musket_75',3);syncCarriedAmmunition(s.operativeState[110]);
 const before=structuredClone(s);s=move(s,'hand:right','large-4');assert.equal(handLayout(actor(s)).right,null);
 const gun=model(s).usage.slots.find(p=>p.id==='large-4').entry;assert.equal(gun.weapon,1800);
 s=move(save(s),'large-4','hand:right');const r=s.operativeState[110];
 for(const key of ['carriedLoaded','carriedAmmo','carriedReloadProgress','condition','weaponInstanceId','weaponFittings'])assert.deepEqual(r[key],before.operativeState[110][key],key);
 for(const key of ['hour','secondOfHour','resources','seed','sectorStates'])assert.deepEqual(s[key],before[key],key);
 s=order(save(s),{type:'visitSector'});const b=enterSector(s.pendingBattle),u=b.units.find(u=>u.id==='110');assert.equal(u.loaded,0);assert.equal(u.reloadProgress,.5);assert.equal(u.weaponFittings.bayonet.instanceId,'drag-bayonet');assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
});
test('pockets and both hands can hold supplies and ordinary objects, with layout retained on deployment',()=>{
 let s=fresh();s.operativeState[110].inventory={note:{name:'Carta',count:1,weight:.1,condition:47,instanceId:'drag-note'}};
 s=move(s,pocket(s,'medkits'),'hand:right');s=move(s,pocket(s,'torches'),'hand:left');s=move(s,pocket(s,'inventory:note'),'hand:right');
 assert.equal(handLayout(actor(s)).right,'inventory:note');assert.equal(handLayout(actor(s)).left,'torches');assert.equal(s.operativeState[110].inventory.note.condition,47);
 s=move(s,'hand:right','small-8');assert.equal(handLayout(actor(s)).right,null);assert.equal(model(s).usage.slots.find(p=>p.id==='small-8').entry.item,'inventory:note');
 s=move(s,'small-8','small-7','pocket');const layout=s.operativeState[110].pocketOrder;s=save(s);
 assert.equal(s.operativeState[110].carriedLoaded,undefined,'rearranging ordinary objects must not cancel initial loading');
 s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle),u=b.units.find(u=>u.id==='110');assert.deepEqual(u.pocketOrder,layout);assert.ok(u.loaded>0);assert.equal(handLayout(u).left,'torches');
});
test('second-pistol swaps retain independent charges and conditions',()=>{
 let s=fresh();s.loadouts[110]={weapon:1805,blade:0};Object.assign(s.operativeState[110],{carriedAmmo:4,carriedLoaded:1,condition:81,weaponInstanceId:'drag-first',offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:57,instanceId:'drag-second'}});
 addAmmunition(s.operativeState[110],'pistol_69',3);syncCarriedAmmunition(s.operativeState[110]);
 s=move(s,'hand:left','hand:right');const r=s.operativeState[110];assert.equal(r.carriedLoaded,2);assert.equal(r.carriedAmmo,5);assert.equal(r.condition,57);assert.equal(r.offHand.loaded,1);assert.equal(r.offHand.condition,81);assert.equal(r.offHand.instanceId,'drag-first');save(s);
 assert.deepEqual(ammunitionByType(r),{pistol_69:3},'swapping unlike pistols does not change prepared cartridge types');
});
test('incompatible pockets, blocked hands, stale gestures and unavailable soldiers reject without effects',()=>{
 let s=fresh();reject(s,action(s,'hand:right','small-8'));reject(s,action(s,pocket(s,'medkits'),'hand:left'));
 const a=action(s,'hand:right','large-4');
 for(const mutate of [s=>s.operativeState[110].condition=42,s=>s.operativeState[110].asleep=true,s=>s.operativeState[110].hp=5,s=>s.operativeState[110].energy=0,s=>s.squads[0].location='buenos_aires',s=>s.sectors.retiro.owner='royalist']){const n=structuredClone(s);mutate(n);reject(n,a);}
 for(const patch of [{expectedSource:undefined},{expectedDestination:'stale'},{count:2},{kind:'unknown'},{destinationId:'missing'}])reject(s,{...a,...patch});
 reject(order(s,{type:'visitSector'}),a);
});

test('a same-model empty replacement stays empty instead of receiving initial issue ammunition',()=>{
 let s=fresh();s.operativeState[110].inventory={replacement:{weapon:1800,count:1,weight:4,loaded:0,condition:100}};
 assert.equal(s.operativeState[110].carriedLoaded,undefined);
 s=move(s,pocket(s,'inventory:replacement'),'hand:right');assert.equal(s.operativeState[110].carriedLoaded,0);
 s=order(save(s),{type:'visitSector'});const b=enterSector(s.pendingBattle);assert.equal(b.units.find(u=>u.id==='110').loaded,0);
});
