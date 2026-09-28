import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_FOUNDRY} from '../game/campaign-foundry.js';
import {ORIGINAL_CAMPAIGN_ROLES} from '../game/campaign-roles.js';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
let depot,field;
export function depotTradeGun(){
 if(depot)return structuredClone(depot);
 const d=defaultContentPackage();d.campaignRoles={...ORIGINAL_CAMPAIGN_ROLES,foundryEngineer:'person-114'};d.foundry={...DEFAULT_FOUNDRY,sector:'buenos_aires',setupCost:0};let s=fieldGun(d);s=order(s,{type:'foundry'});const gun=s.sectorStates.san_nicolas.artillery[0];s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'});const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'buenos_aires'});if(s.hour<due)s=order(s,{type:'wait',hours:due-s.hour});assert.equal(s.location,'buenos_aires');assert.equal(s.artilleryDepots.buenos_aires[0].id,gun.id);depot=saved({campaign:s}).campaign;return structuredClone(depot);
}
export function fieldTradeGun(){
 if(field)return structuredClone(field);
 const d=defaultContentPackage();d.campaignRoles={...ORIGINAL_CAMPAIGN_ROLES,foundryEngineer:'person-114'};d.foundry={...DEFAULT_FOUNDRY,sector:'san_nicolas',setupCost:0};let s=fieldGun(d);s=order(s,{type:'foundry'});assert.equal(s.flags.foundry,true);field=saved({campaign:s}).campaign;return structuredClone(field);
}
