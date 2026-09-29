import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,recruitmentStatus} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_FOUNDRY,FOUNDRY_LOCATIONS,foundryFor} from '../game/campaign-foundry.js';
import {hasWorkshop,campaignChapters} from '../game/campaign-headquarters.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {refillCost,firearmRepairCost} from '../game/equipment.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {foundryPackage} from './foundry-project-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
const setup=d=>{const id=operativeIdForCharacter(d,'engineer');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});return {s:order(s,{type:'wait',hours:6}),id};};

test('foundry definitions validate plausible locations, whole costs, bounded names and legacy defaults',()=>{
 for(const {id}of FOUNDRY_LOCATIONS){const d=foundryPackage();d.foundry.sector=id;assert.deepEqual(validateContentPackage(d),[]);assert.equal(saved({campaign:initialCampaign(42,d)}).campaign.contentCampaign.package.foundry.sector,id);}
 for(const patch of [{sector:'cell-0-0'},{sector:'los_patos'},{sector:'missing'},{sector:null},{name:''},{armyName:' '},{name:'x'.repeat(101)},{setupCost:-1},{setupCost:1.5},{fundingCost:1000001},{fundingCost:null},{extra:1}]){const d=foundryPackage();Object.assign(d.foundry,patch);assert.throws(()=>initialCampaign(42,d),/Fundición/);}
 for(const value of [null,[],{},false]){const d=foundryPackage();d.foundry=value;assert.throws(()=>initialCampaign(42,d),/Fundición/);}
 assert.deepEqual(foundryFor(initialCampaign()),DEFAULT_FOUNDRY);assert.deepEqual(foundryFor(initialCampaign(42,defaultContentPackage())),DEFAULT_FOUNDRY);
});

test('an authored foundry charges its two costs once and unlocks an actual supplied repair workshop outside Mendoza',()=>{
 const d=foundryPackage();let {s,id}=setup(d);s=order(s,{type:'travel',sector:'jujuy'});assert.equal(s.sectors.mendoza.owner,'royalist');assert.equal(hasWorkshop(s,'jujuy'),false);assert.match(dispatchCampaign(s,{type:'repairWeapon',operativeId:id}).lastError,/taller/);const before=s.resources.treasury;s=order(s,{type:'foundry'});assert.equal(s.resources.treasury,before-137);assert.equal(hasWorkshop(s,'jujuy'),true);assert.match(s.log[0].text,/Elena organiza Taller del Norte/);assert.equal(s.cityLoyaltyEvents.find(e=>e.eventId==='quest-foundry').sectorId,'jujuy');assert.equal(s.cityLoyaltyEvents.filter(e=>e.eventId==='quest-foundry').length,1);assert.equal(dispatchCampaign(s,{type:'foundry'}).resources.treasury,s.resources.treasury);
 // Prepared wear isolates actual repair/resupply access and exact existing prices.
 s.operativeState[id].condition=40;s.operativeState[id].rations=0;const repair=firearmRepairCost(s.operativeState[id]),resupply=refillCost(s.operativeState[id]),funds=s.resources.treasury;s=order(s,{type:'repairWeapon',operativeId:id});s=order(s,{type:'resupply',operativeId:id});assert.equal(s.resources.treasury,funds-repair-resupply);assert.equal(s.operativeState[id].condition,100);assert.equal(s.operativeState[id].rations,2);
 const treasury=s.resources.treasury;s=order(saved({campaign:s}).campaign,{type:'fundArmy'});assert.equal(s.resources.treasury,treasury-809);assert.match(s.log[0].text,/809 pesos.*Ejército del Norte Libre/);assert.ok(dispatchCampaign(s,{type:'fundArmy'}).lastError);s=leave(visit(s));assert.equal(saved({campaign:s}).campaign.flags.armyFunded,true);assert.equal(s.sectors.mendoza.owner,'royalist');
});

test('foundry costs allow free preparation and reject insufficient funds without partial flags, charges or loyalty rewards',()=>{
 const d=foundryPackage();d.rules.startingTreasury=0;d.characters.find(c=>c.id==='engineer').monthlyPay=0;d.foundry.setupCost=0;d.foundry.fundingCost=0;let {s}=setup(d);s=order(s,{type:'foundry'});s=order(s,{type:'fundArmy'});assert.equal(s.resources.treasury,0);assert.equal(s.flags.armyFunded,true);assert.ok(saved({campaign:s}));
 const paid=foundryPackage();let p=setup(paid).s;p.resources.treasury=136;const denied=dispatchCampaign(p,{type:'foundry'});assert.ok(denied.lastError);assert.equal(denied.resources.treasury,136);assert.equal(denied.flags.foundry,false);assert.equal(denied.cityLoyaltyEvents.some(e=>e.eventId==='quest-foundry'),false);p.resources.treasury=137;p=order(p,{type:'foundry'});assert.equal(p.resources.treasury,0);assert.ok(dispatchCampaign(p,{type:'fundArmy'}).lastError);assert.equal(p.flags.armyFunded,false);
});

test('prepared occupation and broken supply prevent service without deleting completed preparation',()=>{
 const d=foundryPackage(),{id}=setup(d);let s=setup(d).s;const occupied=structuredClone(s);occupied.sectors.jujuy.owner='royalist';assert.match(dispatchCampaign(occupied,{type:'foundry'}).lastError,/Jujuy/);s=order(s,{type:'foundry'});s=order(s,{type:'travel',sector:'jujuy'});s.sectors.jujuy.owner='royalist';assert.ok(dispatchCampaign(s,{type:'resupply',operativeId:id}).lastError);assert.equal(s.flags.foundry,true);s.sectors.jujuy.owner='patriot';s.sectors.salta.owner='royalist';assert.ok(dispatchCampaign(s,{type:'resupply',operativeId:id}).lastError);
});

test('foundry settings stay pinned and historical objective text uses authored names and funding while keeping original route gates',()=>{
 const d=foundryPackage(),s=initialCampaign(42,d);d.foundry.sector='retiro';assert.equal(foundryFor(saved({campaign:s}).campaign).sector,'jujuy');const bad=JSON.parse(encodeSave(s));bad.campaign.contentCampaign.package.foundry.setupCost=1;assert.throws(()=>decodeSave(JSON.stringify(bad)),/identidad/);
 const old=defaultContentPackage();old.foundry={...foundryPackage().foundry};const historical=initialCampaign(42,old),chapters=campaignChapters(historical);assert.match(chapters[3].name,/Taller del Norte/);assert.match(chapters[3].objective,/809 pesos/);assert.match(chapters[3].objective,/Mendoza.*Cuyo/);assert.match(chapters[4].name,/Ejército del Norte Libre/);assert.match(recruitmentStatus(historical,57,true).reason,/Taller del Norte/);assert.equal(historical.phase,0);
});
