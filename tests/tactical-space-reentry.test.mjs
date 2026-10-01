import {weaponAmmoType} from '../game/ammunition-types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {actBattle,createBattle} from '../game/tactical.js';
import {buildTerrace} from '../game/buildings.js';
import {enterSector} from '../game/world.js';
import {spaceKey,sameCell,tacticalLevel,validateTacticalSpace} from '../game/tactical-space.js';
import {propBlocksAt} from '../game/props.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
function authoredTerrace(state){
 const building=state.buildings.find(b=>state.tiles.some(t=>t.x===b.x-1&&t.y===b.y+1&&!t.blocked&&!propBlocksAt(state,t.x,t.y)));
 assert.ok(building);building.roof='terrace';
 Object.assign(state,buildTerrace(building,{climbPoints:[{id:'west',from:{x:building.x-1,y:building.y+1},to:{x:building.x,y:building.y+1}}]}));
 const below=state.tiles.find(t=>t.buildingId===building.id&&!t.blocked&&!propBlocksAt(state,t.x,t.y)&&t.type==='floor');assert.ok(below);
 return {x:below.x,y:below.y};
}
function paidVisit(){
 let campaign=initialCampaign();const treasury=campaign.resources.treasury;
 for(const action of [{type:'recruitCivic',id:128,term:'day'},{type:'recruitCivic',id:142,term:'day'},{type:'visitSector'}]){campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);}
 assert.ok(campaign.resources.treasury<treasury);const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);return pair;
}
test('paid squad save retains stacked soldiers, finite dropped ammunition, roof geometry and resident reentry',()=>{
 let {campaign,battle}=paidVisit();const unit=battle.units.find(u=>u.side==='player'),reserveBefore=unit.ammo;
 battle=actBattle(battle,{type:'drop',unitId:unit.id,item:`inventory:ammo:${weaponAmmoType(unit.weapon)}`,count:1});assert.equal(battle.lastError,null);
 ({campaign,battle}=syncBattleTime(campaign,battle));
 const at=authoredTerrace(battle),players=battle.units.filter(u=>u.side==='player');
 Object.assign(players[0],at,{tacticalLevel:1});Object.assign(players[1],at,{tacticalLevel:0});
 // Controlled persistence fixture: author the upper placement before movement exists.
 const dropped=battle.groundItems.find(g=>g.ammoType===weaponAmmoType(unit.weapon));assert.ok(dropped);Object.assign(dropped,at,{tacticalLevel:1});
 const original=structuredClone(battle),loaded=decodeSave(encodeSave(campaign,battle));
 assert.deepEqual(loaded.battle,original);assert.equal(players[0].ammo+loaded.battle.groundItems.find(g=>g.id===dropped.id).count,reserveBefore);
 const request={...loaded.campaign.pendingBattle,squad:loaded.battle.units.filter(u=>u.side==='player').map(u=>({...u,entryReason:'resident'}))};
 const entered=enterSector(request,loaded.battle),again=enterSector(request,entered);
 for(const state of [entered,again]){
  assert.deepEqual(state.upperSurfaces,original.upperSurfaces);assert.deepEqual(state.climbLinks,original.climbLinks);assert.deepEqual(state.groundItems,original.groundItems);
  for(const player of players){const resident=state.units.find(u=>u.id===player.id);assert.equal(spaceKey(resident),spaceKey(player));assert.equal(resident.ammo,player.ammo);}
  assert.equal(new Set(state.units.map(u=>u.id)).size,state.units.length);
  assert.notEqual(spaceKey(state.units[0]),spaceKey(state.units[1]));assert.equal(state.mode,'exploration');
 }
 assert.deepEqual(battle,original,'reentry must not mutate the saved sector');
 for(const mutate of [b=>delete b.upperSurfaces,b=>b.groundItems.find(g=>g.id===dropped.id).tacticalLevel=2,b=>b.units[0].tacticalLevel=2]){const broken=structuredClone(battle);mutate(broken);assert.throws(()=>decodeSave(encodeSave(campaign,broken)));}
});
test('roof residents, corpses, lights and furniture persist while strategic arrivals use the ground boundary',()=>{
 const request={sector:'retiro',exploration:true,squad:[{id:'resident'}],enemies:[],npcs:[{id:'civilian',name:'Vecino',x:1,y:4}]};
 const previous=enterSector(request),at=authoredTerrace(previous);
 Object.assign(previous.units[0],at,{tacticalLevel:1});
 const roof=previous.upperSurfaces.find(p=>!sameCell(p,previous.units[0])&&p.x!==at.x);
 Object.assign(previous.npcs[0],{x:roof.x,y:roof.y,tacticalLevel:1});
 const corpse=createBattle([],{enemies:[{id:'fallen',hp:0,maxHp:80,x:at.x,y:at.y}]}).units[0];
 assert.equal(corpse.hp,0);Object.assign(corpse,{x:at.x+1,y:at.y+1,tacticalLevel:1,knownToPlayer:true});previous.units.push(corpse);
 const prop={id:'roof-cache',type:'chest',x:roof.x,y:roof.y+1,tacticalLevel:1,blocksMovement:true};previous.props.push(prop);
 previous.lights.push({x:at.x,y:at.y,tacticalLevel:1,radius:3,intensity:.8});validateBattleSnapshot(previous);
 const entered=enterSector({...request,squad:[{id:'resident',entryReason:'resident'},{id:'arrival',tacticalLevel:1,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:7}}]},previous);
 assert.equal(spaceKey(entered.units.find(u=>u.id==='resident')),spaceKey(previous.units[0]));
 assert.equal(spaceKey(entered.npcs[0]),spaceKey(previous.npcs[0]));assert.deepEqual(entered.units.find(u=>u.id==='fallen'),corpse);
 assert.deepEqual(entered.props.find(p=>p.id==='roof-cache'),prop);assert.deepEqual(entered.lights,previous.lights);
 const arrival=entered.units.find(u=>u.id==='arrival');assert.equal(arrival.x,0);assert.equal(tacticalLevel(arrival),0);
 validateTacticalSpace(entered);
});
