import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {addAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {prepareDeploymentExits} from '../game/deployment-return.js';
import {ammunitionSource} from '../game/ammunition.js';
import {secondaryLootField,secondaryOrder,secondaryRetreat} from './secondary-loot-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';

const report=p=>({type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
function reattack(){
 let p=secondaryLootField();
 const family=weaponAmmoType(p.battle.units.find(u=>u.id===p.target).weapon);
 p=secondaryOrder(p,{type:'loot',targetId:p.target,item:'weapon'});
 p=secondaryRetreat(p);
 let campaign=saved({campaign:order(p.campaign,report(p))}).campaign;
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 return {...saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires)}),family,target:p.target};
}

test('a repeat assault budgets the looted enemy gun once and rejects an invented replacement round',()=>{
 let p=reattack();
 const previous=p.campaign.sectorStates.buenos_aires.units.filter(u=>u.side==='enemy'&&!u.departure);
 assert.deepEqual(p.campaign.pendingBattle.ammunitionSources,previous.map(ammunitionSource));
 assert.equal(p.campaign.pendingBattle.ammunitionSources.find(u=>u.id===p.target).loaded,0);
 assert.equal(p.battle.units.find(u=>u.id===p.target).weaponDropped,true);
 const family=p.family;
 p=secondaryRetreat(p);
 const valid=order(p.campaign,report(p));assert.ok(saved({campaign:valid}));
 const forged=structuredClone(p),carrier=forged.battle.units.find(u=>u.id==='110');
 addAmmunition(carrier,family,1);syncUnitAmmunition(carrier);
 const rejected=dispatchCampaign(forged.campaign,report(forged));
 assert.match(rejected.lastError,/más munición/);
 assert.deepEqual(rejected.operativeState,p.campaign.operativeState);
 assert.deepEqual(rejected.resources,p.campaign.resources);
});

test('new occupation and defense forces use their own ammunition instead of an earlier field allowance',()=>{
 const p=reattack();
 for(const flag of [{occupationGroupIds:['new-occupation']},{defenseGroupId:'new-defense'}]){
  const request=structuredClone(p.campaign.pendingBattle);
  delete request.ammunitionSources;Object.assign(request,flag);
  prepareDeploymentExits(p.campaign,request);
  assert.equal(request.ammunitionSources,undefined);
  assert.deepEqual(request.enemies,p.campaign.pendingBattle.enemies);
 }
});
