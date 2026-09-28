import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_FOUNDRY} from '../game/campaign-foundry.js';
import {ORIGINAL_CAMPAIGN_ROLES} from '../game/campaign-roles.js';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
let depot,field;
export function depotTradeGun(content){
 if(!content&&depot)return structuredClone(depot);
 const d=content?structuredClone(content):defaultContentPackage();d.campaignRoles={...ORIGINAL_CAMPAIGN_ROLES,foundryEngineer:'person-114'};d.foundry={...DEFAULT_FOUNDRY,sector:'buenos_aires',setupCost:0};let s=fieldGun(d);s=order(s,{type:'foundry'});const gun=s.sectorStates.san_nicolas.artillery[0];s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'});const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'buenos_aires'});if(s.hour<due)s=order(s,{type:'wait',hours:due-s.hour});assert.equal(s.location,'buenos_aires');assert.equal(s.artilleryDepots.buenos_aires[0].id,gun.id);s=saved({campaign:s}).campaign;if(!content)depot=s;return structuredClone(s);
}
export function fieldTradeGun(content){
 if(!content&&field)return structuredClone(field);
 const d=content?structuredClone(content):defaultContentPackage();d.campaignRoles={...ORIGINAL_CAMPAIGN_ROLES,foundryEngineer:'person-114'};d.foundry={...DEFAULT_FOUNDRY,sector:'san_nicolas',setupCost:0};let s=fieldGun(d);s=order(s,{type:'foundry'});assert.equal(s.flags.foundry,true);s=saved({campaign:s}).campaign;if(!content)field=s;return structuredClone(s);
}
