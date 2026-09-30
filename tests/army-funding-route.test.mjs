import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {artilleryCount} from '../game/economy.js';
import {prepareFreshArmyFunding,completeFreshArmyFunding} from './fresh-cuyo-route.mjs';

test('prepared foundry route pays for three finite cannons, militia training and army funding',()=>{
 // Prepared subsystem scene: this does not prove the route from a fresh campaign.
 let s=initialCampaign(42);s.resources.treasury=20000;s.phase=3;s.flags.foundry=true;s.location='mendoza';
 s.recruited=[3,4,10,2,7];s.squad=[...s.recruited];s.squads[0].members=[...s.squad];s.squads[0].location='mendoza';
 for(const id of s.recruited){s.operativeState[id].location='mendoza';s.contracts[id]={kind:'legacy',term:'month',started:0,expiresAt:null,paid:0};}
 for(const id of ['cordoba','mendoza'])Object.assign(s.sectors[id],{owner:'patriot',loyalty:65});
 s=order(s,{type:'transport',mode:'posta'});
 s=order(s,{type:'purchaseEquipment',item:'bronze4',quantity:1});assert.equal(s.merchants.mendoza.stock.bronze4,0);
 const before=structuredClone(s),first=prepareFreshArmyFunding(s);assert.deepEqual(s,before);
 assert.equal(artilleryCount(first),2);assert.equal(first.flags.armyFunded,false);assert.ok(first.hour>=24,'the second cannon waits for real merchant restocking');
 const final=completeFreshArmyFunding(first);
 assert.equal(artilleryCount(final),3);assert.equal(final.flags.armyFunded,true);assert.ok(final.hour>first.hour);
 assert.equal(final.sectors.cordoba.militia[0],3);assert.equal(final.operativeState[7].location,'cordoba');
 assert.deepEqual(saved({campaign:final}).campaign,final);
 assert.equal(final.completed,false);
});
