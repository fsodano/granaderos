import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';

test('the campaign screen shows the configured entry price and saves the actual charge and return',async t=>{
 const d=defaultContentPackage();d.rules={startingTreasury:8000,deploymentCartridges:7,enemyCartridges:13,militiaCartridges:6};d.characters.find(c=>c.id==='person-110').arrivalHours=0;let s=initialCampaign(8,d);
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'visitSector'}]){s=dispatchCampaign(s,action);assert.equal(s.lastError,null);}
 const paid=s.resources.treasury;const m=await mountCampaign(t,{campaign:s,battle:enterSector(s.pendingBattle)});await m.click('Volver a la campaña');assert.equal(m.read().campaign.resources.treasury,paid);assert.equal(m.read().campaign.pendingBattle,null);
 await m.click('Entrar al sector · 0 pesos');const current=m.read();assert.equal(current.campaign.resources.treasury,paid);assert.equal(current.campaign.pendingBattle.issuedCartridges,7);assert.equal(current.battle.units[0].loaded+current.battle.units[0].ammo,7);assert.deepEqual(m.saved(),{campaign:current.campaign,battle:current.battle});
});


test('the campaign control charges the authored cartridge price and keeps purchased cartridges on saved return',async t=>{
 const d=defaultContentPackage();Object.assign(d.rules,{startingTreasury:8000,deploymentCartridges:7,cartridgePrice:4});d.characters.find(c=>c.id==='person-110').arrivalHours=0;let s=initialCampaign(8,d);for(const a of [{type:'recruitCivic',id:110,term:'week'},{type:'visitSector'}]){s=dispatchCampaign(s,a);assert.equal(s.lastError,null);}
 const paid=s.resources.treasury,m=await mountCampaign(t,{campaign:s,battle:enterSector(s.pendingBattle)});await m.click('Volver a la campaña');assert.equal(m.read().campaign.resources.treasury,paid);await m.click('Entrar al sector · 0 pesos');const current=m.read();assert.equal(current.campaign.resources.treasury,paid);assert.equal(current.campaign.pendingBattle.issuedCartridges,7);assert.equal(current.battle.units[0].loaded+current.battle.units[0].ammo,7);assert.deepEqual(m.saved(),{campaign:current.campaign,battle:current.battle});
});
