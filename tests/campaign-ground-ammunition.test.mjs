import {withCarriedAmmo} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {ammunitionByType,availableAmmunition} from '../game/ammunition-types.js';
import {actBattle} from '../game/tactical.js';
import {order,visit,leave,saved,tactical} from './local-contract-fixture.mjs';

const actor=(pair,id)=>pair.battle.units.find(unit=>unit.id===String(id));
const rifleRounds=owner=>ammunitionByType(owner).rifle_62??0;
const physical=battle=>({units:battle.units,groundItems:battle.groundItems,elapsedSeconds:battle.elapsedSeconds,seed:battle.seed});

test('partial typed ammunition recovery conserves the ground remainder and personal stock across successive saved deployments',()=>{
 const content=defaultContentPackage();
 for(const id of [110,111])content.characters.find(character=>character.id===`person-${id}`).arrivalHours=0;
 content.characters.find(character=>character.id==='person-111').weapon='firearm-1805';
 // Prepared funds cover both monthly contracts; the additional six cartridges are declared finite preexisting property.
 let campaign=initialCampaign(8,content);campaign.resources.treasury=15000;
 for(const id of [110,111])campaign=order(campaign,{type:'recruitCivic',id,term:'month'});
 campaign=withCarriedAmmo(campaign,110,'ammoRifle',6);
 let pair=visit(campaign);
 const treasury=pair.campaign.resources.treasury,shops=structuredClone(pair.campaign.ammunitionShops);
 const loaded=Object.fromEntries([110,111].map(id=>[id,actor(pair,id).loaded]));
 const compatible=availableAmmunition(actor(pair,111));
 pair=tactical(pair,{type:'drop',unitId:'110',item:'inventory:ammo:rifle_62',count:6});
 const groundId=pair.battle.groundItems.find(item=>item.ammoType==='rifle_62').id;
 const verify=(current,carried,remaining)=>{
  assert.equal(rifleRounds(actor(current,110)),0);
  assert.equal(rifleRounds(actor(current,111)),carried);
  const ground=current.battle.groundItems.find(item=>item.id===groundId);
  assert.equal(ground.ammoType,'rifle_62');assert.equal(ground.count,remaining);
  assert.equal(carried+remaining,6);
  assert.equal(availableAmmunition(actor(current,111)),compatible,'rifle rounds cannot refill the pistol reserve');
  for(const id of [110,111])assert.equal(actor(current,id).loaded,loaded[id]);
  assert.equal(current.campaign.resources.treasury,treasury);
  assert.deepEqual(current.campaign.ammunitionShops,shops);
  assert.equal(current.campaign.ammunitionStores.retiro?.ammoRifle??0,0);
 };
 const redeploy=current=>{
  const returned=saved({campaign:leave(saved(current))}).campaign;
  assert.equal(returned.resources.treasury,treasury,'field recovery cannot also refund the cartridges');
  assert.equal(rifleRounds(returned.operativeState[110]),0);
  assert.equal(rifleRounds(returned.operativeState[111]),rifleRounds(actor(current,111)));
  return visit(returned);
 };
 verify(pair,0,6);pair=redeploy(pair);verify(pair,0,6);
 for(const [quantity,carried,remaining] of [[2,2,4],[4,6,0]]){
  pair=tactical(pair,{type:'loot',unitId:'111',groundId,count:quantity});
  pair=saved(pair);verify(pair,carried,remaining);
  pair=redeploy(pair);verify(pair,carried,remaining);
 }
 const rejected=actBattle(pair.battle,{type:'loot',unitId:'111',groundId,count:1});
 assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(pair.battle));
 verify(redeploy(pair),6,0);
});
