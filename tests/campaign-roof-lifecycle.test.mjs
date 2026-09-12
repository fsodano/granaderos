import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,climbPreview,getReachable} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {sameCell,spaceKey,spacePoint,tacticalLevel} from '../game/tactical-space.js';

const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const soldier=battle=>battle.units.find(unit=>unit.side==='player'&&unit.id==='128');
const act=(battle,action)=>{const next=actBattle(battle,{unitId:'128',...action});assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const sync=(campaign,battle)=>{const next=syncBattleTime(campaign,battle);assert.equal(next.error,null);return next;};
function start(){
 let campaign=initialCampaign(45);assert.equal(campaign.squad.length,0);assert.deepEqual(Object.entries(campaign.sectors).filter(([,s])=>s.owner==='patriot').map(([id])=>id),['retiro']);
 // Strategic precondition: Buenos Aires has already been liberated. Roof use itself follows only real orders.
 campaign.sectors.buenos_aires.owner='patriot';
 const treasury=campaign.resources.treasury;campaign=order(campaign,{type:'recruitCivic',id:128,term:'day'});assert.ok(campaign.resources.treasury<treasury);assert.deepEqual(campaign.squad,[128]);
 campaign=order(campaign,{type:'travel',sector:'buenos_aires'});assert.equal(campaign.location,'buenos_aires');assert.ok(campaign.hour>0);
 campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);assert.equal(pair.battle.mode,'exploration');assert.equal(tacticalLevel(soldier(pair.battle)),0);return pair;
}
function reachAccess(battle){
 const actor=soldier(battle),routes=getReachable(battle,actor),access=battle.climbLinks?.map(link=>({link,route:routes.find(point=>sameCell(point,link.from))})).filter(choice=>choice.route).sort((a,b)=>a.route.cost-b.route.cost||a.link.id.localeCompare(b.link.id))[0];
 assert.ok(access,'the authored Buenos Aires roof needs an accessible climb point from the real deployment');
 const {link}=access,next=act(battle,{type:'move',...spacePoint(link.from)});assert.ok(sameCell(soldier(next),link.from));assert.equal(next.mode,'exploration');assert.equal(soldier(next).ap,actor.ap);assert.ok(soldier(next).energy<actor.energy);return {battle:next,link};
}
function climb(battle,link){
 const actor=soldier(battle),preview=climbPreview(battle,actor,{linkId:link.id});assert.equal(preview.valid,true,preview.reason);
 const next=act(battle,{type:'climb',linkId:link.id});assert.equal(soldier(next).ap,actor.ap);assert.equal(soldier(next).energy,actor.energy-preview.energy);assert.ok(next.elapsedSeconds>battle.elapsedSeconds);assert.ok(sameCell(soldier(next),preview.destination));return next;
}
function leave(campaign,battle){
 const pair=sync(campaign,battle);return order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
}

test('a paid recruit travels to controlled Buenos Aires, climbs a real roof, uses carried items and resumes the exact tactical state',()=>{
 let {campaign,battle}=start();const initial=soldier(battle),ap=initial.ap,torches=initial.torches,ammo=initial.ammo,grade=initial.experienceLevel;
 const approach=reachAccess(battle);battle=climb(approach.battle,approach.link);assert.equal(tacticalLevel(soldier(battle)),1);assert.equal(soldier(battle).experienceLevel,grade);
 const buildingId=battle.upperSurfaces.find(surface=>sameCell(surface,soldier(battle))).buildingId;
 assert.equal(battle.buildings.find(building=>building.id===buildingId).architecture,'house');assert.equal(battle.buildings.find(building=>building.id===buildingId).roof,'terrace');
 const roof=battle.upperSurfaces.find(surface=>surface.buildingId===buildingId&&!surface.blocked&&!sameCell(surface,soldier(battle))&&Math.hypot(surface.x-soldier(battle).x,surface.y-soldier(battle).y)<=2);
 assert.ok(roof);battle=act(battle,{type:'move',...spacePoint(roof)});assert.ok(sameCell(soldier(battle),roof));
 battle=act(battle,{type:'weapon',slot:'supply',supplyKey:'torches'});battle=act(battle,{type:'useItem',...spacePoint(roof)});
 const light=battle.lights.findLast(light=>light.type==='torch');assert.ok(light);assert.equal(spaceKey(light),spaceKey(roof));assert.equal(soldier(battle).torches,torches-1);
 battle=act(battle,{type:'drop',item:'ammo',count:3});const pile=battle.groundItems.find(item=>item.type==='item'&&item.item==='ammo'&&sameCell(item,roof));assert.ok(pile);assert.equal(pile.count,3);assert.equal(soldier(battle).ammo,ammo-3);assert.equal(soldier(battle).ap,ap);
 ({campaign,battle}=sync(campaign,battle));const before=structuredClone(battle),resume=decodeSave(encodeSave(campaign,battle));assert.deepEqual(resume.battle,before);assert.deepEqual(resume.campaign,campaign);
 const action={type:'loot',groundId:pile.id,count:1},expected=act(battle,action);battle=act(resume.battle,action);assert.deepEqual(battle,expected,'resuming preserves the next legal item transaction, energy, AP and clock');
 assert.equal(battle.groundItems.find(item=>item.id===pile.id).count,2);assert.equal(soldier(battle).ammo,ammo-2);assert.equal(soldier(battle).ap,ap);
});

test('real campaign return and reentry retain the roof resident, finite equipment and geometry before a legal descent',()=>{
 let {campaign,battle}=start();const initialReserve=campaign.resources.cartridges,originalAmmo=soldier(battle).ammo,originalLoaded=soldier(battle).loaded,originalTorches=soldier(battle).torches;
 const approach=reachAccess(battle),link=approach.link;battle=climb(approach.battle,link);
 battle=act(battle,{type:'weapon',slot:'supply',supplyKey:'torches'});battle=act(battle,{type:'useItem',...spacePoint(soldier(battle))});battle=act(battle,{type:'drop',item:'ammo',count:2});
 const occupant=spaceKey(soldier(battle)),pile=battle.groundItems.find(item=>item.type==='item'&&item.item==='ammo'&&sameCell(item,soldier(battle))),geometry=structuredClone({surfaces:battle.upperSurfaces,links:battle.climbLinks}),remaining=structuredClone(battle.lights.findLast(light=>light.type==='torch'));
 campaign=leave(campaign,battle);assert.equal(campaign.pendingBattle,null);assert.equal(spaceKey(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id==='128')),occupant);assert.equal(campaign.sectorStates.buenos_aires.groundItems.find(item=>item.id===pile.id).count,2);
 campaign=decodeSave(encodeSave(campaign)).campaign;campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);({campaign,battle}=pair);
 assert.equal(spaceKey(soldier(battle)),occupant);assert.deepEqual(battle.upperSurfaces,geometry.surfaces);assert.deepEqual(battle.climbLinks,geometry.links);assert.equal(battle.mode,'exploration');assert.equal(new Set(battle.units.map(unit=>unit.id)).size,battle.units.length);
 assert.equal(campaign.resources.cartridges,initialReserve-2,'reentry replenishes the carried deficit from finite reserve');assert.equal(soldier(battle).ammo,originalAmmo);assert.equal(campaign.resources.cartridges+soldier(battle).ammo+soldier(battle).loaded+pile.count,initialReserve+originalAmmo+originalLoaded);assert.equal(soldier(battle).loaded,originalLoaded);assert.equal(soldier(battle).torches,originalTorches-1);assert.deepEqual(battle.groundItems.find(item=>item.id===pile.id),pile);assert.deepEqual(battle.lights.find(light=>light.id===remaining.id),remaining);
 const saved=decodeSave(encodeSave(campaign,battle));assert.deepEqual(saved.battle,battle);battle=act(saved.battle,{type:'loot',groundId:pile.id,count:2});assert.equal(soldier(battle).ammo,originalAmmo+2);assert.equal(battle.groundItems.find(item=>item.id===pile.id).count,0);assert.equal(campaign.resources.cartridges+soldier(battle).ammo+soldier(battle).loaded,initialReserve+originalAmmo+originalLoaded);
 const rejected=actBattle(battle,{type:'loot',unitId:'128',groundId:pile.id,count:1});assert.ok(rejected.lastError);assert.deepEqual(rejected.units,battle.units);assert.deepEqual(rejected.groundItems,battle.groundItems);assert.equal(rejected.elapsedSeconds,battle.elapsedSeconds);
 if(!sameCell(soldier(battle),link.to))battle=act(battle,{type:'move',...spacePoint(link.to)});battle=climb(battle,link);assert.equal(tacticalLevel(soldier(battle)),0);assert.ok(sameCell(soldier(battle),link.from));
 campaign=leave(campaign,battle);assert.equal(tacticalLevel(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id==='128')),0);assert.equal(campaign.sectorStates.buenos_aires.groundItems.find(item=>item.id===pile.id).count,0);assert.equal(campaign.resources.cartridges+(campaign.operativeState[128].carriedAmmo??0),initialReserve+originalAmmo+originalLoaded);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
});
