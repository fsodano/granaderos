import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {fundedRouteContent} from './funded-route-fixture.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';

test('paid local squads reach distinct authored roof cells and retain finite gear and saved resident positions',()=>{
 // This declared clinic scenario tests preparation; campaign victories are
 // covered by the full native opening and funded recovery routes.
 const content=fundedRouteContent();content.headquarters='cordoba';content.startingTerritory.cordoba={owner:'patriot',loyalty:65};
 let c=initialCampaign(42,content);const ids=[110,114,115,123];
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);};
 for(const id of ids)order({type:'recruitCivic',id,term:'week'});
 for(let h=0;h<24&&c.hiringArrivals.length;h++)order({type:'wait',hours:1});assert.equal(c.hiringArrivals.length,0);
 for(const members of [[110,114],[115,123]])order({type:'createSquad',name:'Guardia del hospital',ids:members,sector:'cordoba'});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
 order({type:'unloadAmmunition',operativeId:110});assert.equal(c.operativeState[110].carriedLoaded,0);
 const before=structuredClone(c),events=[],staged=stageRouteRoofDefenders(c,ids,{report:event=>events.push(event)});
 assert.deepEqual(c,before);assert.deepEqual(stageRouteRoofDefenders(before,ids),staged);
 assert.equal(staged.resources.treasury,before.resources.treasury);assert.deepEqual(staged.contracts,before.contracts);
 assert.equal(staged.activeSquadId,before.activeSquadId);assert.deepEqual(staged.squads,before.squads);
 const evidence=events.find(event=>event.event==='routeRoofDefenders');assert.ok(evidence.elapsedSeconds>0);assert.ok(evidence.actions.some(action=>action.type==='move'));
 assert.equal(new Set(evidence.positions.map(point=>`${point.tacticalLevel}:${point.x}:${point.y}`)).size,ids.length);
 for(const id of ids){const old=before.operativeState[id],next=staged.operativeState[id];assert.equal(next.hp,old.hp);assert.equal(next.alive,old.alive);assert.equal(next.medkits,old.medkits);assert.equal(next.carriedAmmo,old.carriedAmmo);assert.equal(next.assignment,'rest');}
 assert.equal(staged.operativeState[110].carriedLoaded,1,'ordinary staging reloads the existing unloaded cartridge without changing total custody');
 const restored=decodeSave(encodeSave(staged)).campaign;assert.deepEqual(restored,staged);
 for(const squad of restored.squads.filter(squad=>squad.members.some(id=>ids.includes(id)))){
  let visit=dispatchCampaign(restored,{type:'selectSquad',id:squad.id});
  for(const operativeId of squad.members)visit=dispatchCampaign(visit,{type:'assignCare',operativeId,assignment:'active'});
  visit=dispatchCampaign(visit,{type:'visitSector'});assert.equal(visit.lastError,null);
  const battle=enterSector(visit.pendingBattle,visit.sectorStates.cordoba);
  for(const id of squad.members){const unit=battle.units.find(unit=>unit.id===String(id)),point=evidence.positions.find(point=>point.id===id);assert.deepEqual({x:unit.x,y:unit.y,tacticalLevel:unit.tacticalLevel},{x:point.x,y:point.y,tacticalLevel:point.tacticalLevel});}
 }
});
