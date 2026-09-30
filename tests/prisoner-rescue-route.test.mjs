import test from 'node:test';import assert from 'node:assert/strict';
import {runPrisonerRescue} from './prisoner-rescue-route.mjs';
import {totalReserveAmmunition} from '../game/ammunition-types.js';

test('paid relief starts at the real arrival edge, fights, releases prisoners and escorts them back with permanent losses',()=>{
 const {initial,campaign,battle,orders,savedDepartures}=runPrisonerRescue();
 const entry=initial.battle,players=entry.units.filter(u=>u.side==='player');
 assert.equal(players.length,6);assert.ok(players.every(u=>u.x===entry.width-1));assert.ok(initial.campaign.resources.treasury>=0);assert.equal(entry.artillery.filter(g=>g.side==='player'&&g.type==='swivel').length,1);
 assert.ok(orders.some(a=>a.type==='fire'));assert.ok(orders.some(a=>a.type==='move'));assert.equal(orders.filter(a=>a.type==='free').length,3);
 // This route clears the guard force before evacuation. It does not establish
 // a stealth rescue or escape while hostile guards still contest the field.
 assert.ok(orders.some(a=>a.type==='explore'));assert.equal(battle.sectorCleared,true);assert.equal(battle.status,'retreat');assert.ok(battle.turn<=20);
 assert.equal(battle.npcs.filter(n=>n.detentionEscape).length,3);
 assert.equal(campaign.location,'jujuy');assert.equal(campaign.sectors.humahuaca.owner,'royalist');assert.equal(campaign.resources.treasury,initial.campaign.resources.treasury);
 for(const id of [3,4,10]){const before=initial.campaign.operativeState[id],after=campaign.operativeState[id];assert.equal(after.captured,false);assert.equal(after.location,'jujuy');assert.equal(after.hp,before.hp);assert.equal(campaign.loadouts[id].weapon,0);assert.equal(campaign.loadouts[id].blade,0);assert.deepEqual(after.inventory,{});assert.ok(campaign.recruited.includes(id));}
 const fallen=battle.units.filter(u=>u.side==='player'&&u.hp<=0);assert.ok(fallen.length>0);
 for(const unit of fallen){assert.equal(campaign.operativeState[unit.id].alive,false);assert.equal(campaign.operativeState[unit.id].hp,0);}
 const evacuees=battle.units.filter(u=>u.side==='player'&&u.departure?.destination==='jujuy');
 assert.equal(evacuees.length,players.length-fallen.length);assert.equal(savedDepartures,evacuees.length);
 const shots=orders.filter(a=>a.type==='artillery'),gun=entry.artillery.find(g=>g.side==='player'),returnedGun=battle.artillery.find(g=>g.id===gun.id);
 assert.ok(shots.length>0,'the paid gun must contribute through actual finite shots');
 assert.equal(returnedGun.ammo+Number(returnedGun.loaded),gun.ammo+Number(gun.loaded)-shots.length);
 const rounds=units=>units.reduce((sum,u)=>sum+(u.loaded??0)+totalReserveAmmunition(u),0);assert.ok(rounds(battle.units.filter(u=>u.side==='player'))<rounds(players));
 const caches=Object.values(campaign.detentionRecords).filter(r=>r.escape).flatMap(r=>r.escape.cacheIds);assert.ok(caches.length>0);assert.equal(new Set(caches).size,caches.length);assert.ok(caches.every(id=>campaign.sectorStates.humahuaca.groundItems.some(g=>g.id===id&&g.count>0)));
});
