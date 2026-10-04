import {wakeBatteryCrew} from './stationed-artillery-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_FOUNDRY} from '../game/campaign-foundry.js';
import {ORIGINAL_CAMPAIGN_ROLES} from '../game/campaign-roles.js';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {contentFixtureCache} from './content-fixture-cache.mjs';
// Real narrative foundry organization creates no stock or ammunition.
// These isolated legacy widget fixtures retain that historical campaign step.
// The declared engineer is Silva; this story role must survive the real battle.
export const depotTradeGun=contentFixtureCache(content=>{
 const d=content?structuredClone(content):defaultContentPackage();d.campaignRoles={...ORIGINAL_CAMPAIGN_ROLES,foundryEngineer:'person-136'};d.foundry={...DEFAULT_FOUNDRY,sector:'buenos_aires',setupCost:0};let s=fieldGun(d);s=order(s,{type:'foundry'});const gun=s.sectorStates.san_nicolas.artillery[0];s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'});const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'buenos_aires'});s=wakeBatteryCrew(s);if(s.hour<due)s=advanceCampaignHours(s,due-s.hour);assert.equal(s.location,'buenos_aires');assert.equal(s.artilleryDepots.buenos_aires[0].id,gun.id);s.artilleryMerchants??={};s=saved({campaign:s}).campaign;return wakeBatteryCrew(s);
});
export const fieldTradeGun=contentFixtureCache(content=>{
 const d=content?structuredClone(content):defaultContentPackage();d.campaignRoles={...ORIGINAL_CAMPAIGN_ROLES,foundryEngineer:'person-136'};d.foundry={...DEFAULT_FOUNDRY,sector:'san_nicolas',setupCost:0};let s=fieldGun(d);s=order(s,{type:'foundry'});assert.equal(s.flags.foundry,true);return saved({campaign:s}).campaign;
});
