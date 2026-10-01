import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,grenadeThrowPreview} from '../game/tactical.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {grenadeThrowCosts,grenadeThrowRange} from '../game/grenade-throw.js';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const secret='PRIVATE_GRENADE_PROJECTION';
const field=()=>createBattle([{id:'p',name:'Lanzador',x:2,y:3,facing:2,weapon:1800,loaded:1,ammo:4,strength:85,dexterity:85,marksmanship:85,activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',3,{condition:81,provenance:{secret}})}}],{width:28,height:12,seed:45,tiles:Array.from({length:336},(_,i)=>({x:i%28,y:Math.floor(i/28),type:'grass',blocked:false,cover:0})),enemies:[{id:'seen',name:'Guardia visible',x:8,y:3,patrol:false,overwatch:false},{id:secret,name:secret,x:26,y:10,inventory:{private:makeGrenadeStack('arsenal',2)}}],npcs:[{id:'civil',name:'Vecino',x:4,y:4,hp:15,maxHp:90,energy:0,unconscious:true,knockedDown:true,stance:'prone',ai:{secret}},{id:'hidden-civil',name:secret,x:26,y:9,hp:50,unconscious:true}]});
const controls=view=>view.orders.find(order=>order.unitId==='p');
test('the public grenade controls expose one fixed throw cost, no firearm aim, and legal point actions',()=>{
 const s=field(),u=s.units[0],view=playerKnownBattle(s),order=controls(view),cost=grenadeThrowCosts(u).total;
 assert.deepEqual(order.aim,[]);assert.equal(order.costs.throwGrenade,cost);for(const key of ['fire','aim','reload','reprime','melee'])assert.equal(order.costs[key],undefined,key);
 assert.equal(order.grenade.pa,cost);assert.deepEqual(order.grenade.range,grenadeThrowRange(u));assert.equal(order.grenade.blastRadius,3);assert.equal(order.grenade.kind,'grenade');assert.equal(order.grenade.grenadeType,'arsenal');assert.equal(order.grenade.count,3);assert.equal(order.grenade.condition,81);
 const use=order.orders.find(item=>item.id==='useItem');assert.equal(use.label,'Lanzar granada');assert.equal(use.pa,cost);assert.equal(use.disabled,false);
 const target=order.targets.find(target=>target.x===8&&target.y===3);assert.ok(target?.valid);assert.equal(target.attackType,'throwGrenade');assert.equal(target.targetId,undefined);assert.equal(target.hitLocation,undefined);assert.deepEqual(target.action,{type:'throwGrenade',x:8,y:3,aim:0});
 const next=actBattle(s,{unitId:'p',...target.action});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,u.ap-target.pa);assert.equal(next.units[0].inventory.grenade.count,2);
});
test('grenade metadata remains exact in own hands, inventory, cursor, ground and campaign projections',()=>{
 let s=field(),u=s.units[0];const source=inventoryUsage(u).slots.find(slot=>slot.entry?.item==='inventory:grenade').id;
 s=actBattle(s,{type:'pickupEquipment',unitId:'p',sourceId:source,count:1,expectedSource:equipmentFingerprint(u,source)});assert.equal(s.lastError,null);
 s.groundItems.push({id:'spent-lot',type:'item',item:'inventory:grenade',x:3,y:3,...makeGrenadeStack('arsenal',2,{condition:62,provenance:{secret}})});
 const view=playerKnownBattle(s),own=view.units.find(unit=>unit.id==='p'),hand=controls(view).hands.find(hand=>hand.side==='right');
 for(const record of [own.inventory.grenade,own.equipmentCursor.stack,view.groundItems[0]]){assert.equal(record.kind,'grenade');assert.equal(record.grenadeType,'arsenal');assert.equal(record.provenance,undefined);}
 assert.equal(own.inventory.grenade.count,2);assert.equal(own.equipmentCursor.stack.count,1);assert.equal(own.equipmentCursor.stack.condition,81);assert.equal(view.groundItems[0].count,2);assert.equal(view.groundItems[0].condition,62);assert.equal(hand.count,1);assert.equal(hand.grenadeType,'arsenal');assert.equal(hand.condition,81);assert.equal(controls(view).orders.find(order=>order.id==='useItem').disabled,true);
 const campaign=initialCampaign();campaign.operativeState[3].inventory={grenade:makeGrenadeStack('arsenal',2,{condition:73,provenance:{secret}})};
 const record=playerKnownCampaign(campaign).operatives.find(unit=>unit.id===3).inventory.grenade;assert.deepEqual(record,{kind:'grenade',grenadeType:'arsenal',name:'Granada de arsenal',count:2,weight:1,condition:73});assert.ok(!JSON.stringify(view).includes(secret));
});
test('public grenade point lists use only visible people and known allies; hidden changes cannot alter them',()=>{
 const s=field(),hidden=s.units.find(unit=>unit.id===secret);assert.equal(canSee(s,s.units[0],hidden),false);const before=playerKnownBattle(s),targets=controls(before).targets;
 assert.ok(targets.some(target=>target.x===4&&target.y===4));assert.ok(targets.every(target=>target.x<20));assert.ok(!JSON.stringify(before).includes(secret));assert.ok(targets.every(target=>target.targetId===undefined&&target.hitLocation===undefined));
 hidden.x=25;hidden.y=11;hidden.hp=7;hidden.inventory={};s.npcs[1].x=27;s.npcs[1].hp=1;assert.deepEqual(playerKnownBattle(s),before);
 const npc=before.npcs.find(npc=>npc.id==='civil');assert.equal(npc.hp,15);assert.equal(npc.maxHp,90);assert.equal(npc.unconscious,true);assert.equal(npc.knockedDown,true);assert.equal(npc.stance,'prone');assert.equal(npc.ai,undefined);
});
test('public blocked-point previews expose the near-side landing and no intended-target accuracy',()=>{
 const s=field();s.units.push({...structuredClone(s.units[0]),id:'ally',x:8,y:3});Object.assign(s.tiles.find(tile=>tile.x===4&&tile.y===3),{type:'wall',blocked:true,obstacleHeight:6});
 const view=playerKnownBattle(s),target=controls(view).targets.find(target=>target.x===8&&target.y===3),preview=grenadeThrowPreview(s,s.units[0],{x:8,y:3});
 assert.ok(target?.valid);assert.equal(target.blocked,true);assert.deepEqual(target.landing,preview.flight.landing);assert.ok(target.landing.x<4);assert.equal(target.chance,undefined);assert.ok(target.coverNote.includes(target.landingLabel));
 const before=structuredClone(s);target.landing.x=99;controls(view).grenade.range.maximum=99;assert.deepEqual(s,before);
});
test('exploration publishes zero throw AP and stowing the grenade restores normal firearm controls',()=>{
 const s=field();s.mode='exploration';s.units[0].ap=0;let order=controls(playerKnownBattle(s));assert.deepEqual(order.aim,[]);assert.equal(order.costs.throwGrenade,0);assert.equal(order.grenade.pa,0);assert.equal(order.orders.find(item=>item.id==='useItem').disabled,false);assert.ok(order.targets.every(target=>target.pa===0));
 s.units[0].activeSlot='primary';order=controls(playerKnownBattle(s));assert.equal(order.grenade,undefined);assert.equal(order.costs.throwGrenade,undefined);assert.equal(order.aim.length,5);assert.ok(Number.isFinite(order.costs.fire));
});
