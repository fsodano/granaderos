import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {DEFAULT_CAMPAIGN_RULES,campaignRules} from '../game/campaign-rules.js';
import {initialCampaign,dispatchCampaign,deploymentCost} from '../game/campaign.js';
import {prepareGarrison} from '../game/garrison.js';
import {oppositionFor} from '../game/narrative.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {defaultProfile} from '../game/character-profile.js';
import {secureArea} from './controlled-area-fixture.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const content=(rules={})=>{const d=defaultContentPackage();d.rules={startingTreasury:9000,deploymentCartridges:2,enemyCartridges:3,militiaCartridges:4,...rules};const c=d.characters.find(c=>c.id==='person-110');c.arrivalHours=0;c.weapon='firearm-1808';d.weapons.find(w=>w.id==='firearm-1808').capacity=8;return d;};
const hired=d=>order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});
function leave(s,b){const pair=syncBattleTime(s,b);assert.equal(pair.error,null);return order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});}

test('campaign rules round-trip, retain defaults and reject unknown, incomplete or invalid values',()=>{
 const d=content();assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);const old=content();delete old.rules;assert.deepEqual(campaignRules(initialCampaign(8,old)),DEFAULT_CAMPAIGN_RULES);assert.deepEqual(campaignRules(initialCampaign()),DEFAULT_CAMPAIGN_RULES);
 for(const rules of [null,[],{},42,{...d.rules,extra:1},{...d.rules,startingTreasury:-1},{...d.rules,startingTreasury:1000001},{...d.rules,enemyCartridges:101},{...d.rules,militiaCartridges:.5},{...d.rules,deploymentCartridges:-1}]){const invalid=content();invalid.rules=rules;assert.ok(validateContentPackage(invalid).length);assert.throws(()=>initialCampaign(8,invalid));}
});

test('starting funds are delivered once and zero funds still permit the free personal character',()=>{
 const d=content();let s=initialCampaign(8,d);assert.equal(s.resources.treasury,9000);s=order(s,{type:'recruitCivic',id:110,term:'week'});const paid=s.resources.treasury;assert.ok(paid<9000);s=save(s).campaign;assert.equal(s.resources.treasury,paid);
 d.rules.startingTreasury=1;assert.equal(campaignRules(s).startingTreasury,9000);const altered=structuredClone(s);altered.contentCampaign.package.rules.startingTreasury=1;assert.throws(()=>save(altered),/identidad/);
 s=initialCampaign(8,content({startingTreasury:0}));s=order(s,{type:'createOfficer',name:'Isabel',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});assert.equal(s.resources.treasury,0);assert.equal(s.recruited.length,1);
});

test('real sector entry caps loads, charges the configured amount and refunds only remaining cartridges once',()=>{
 let s=hired(content()),before=s.resources.treasury;assert.equal(deploymentCost(s),2);s=order(s,{type:'visitSector'});assert.equal(s.resources.treasury,before-2);assert.equal(s.pendingBattle.issuedCartridges,2);let b=enterSector(s.pendingBattle);assert.deepEqual([b.units[0].loaded,b.units[0].ammo],[2,0]);let pair=save(s,b);s=leave(pair.campaign,pair.battle);assert.equal(s.resources.treasury,before);assert.ok(dispatchCampaign(s,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units}).lastError);
 s=hired(content({deploymentCartridges:11}));before=s.resources.treasury;s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle);assert.deepEqual([b.units[0].loaded,b.units[0].ammo],[8,3]);assert.equal(s.resources.treasury,before-11);assert.equal(save(leave(s,b)).campaign.resources.treasury,before);
 const poor=hired(content());poor.resources.treasury=1;const rejected=dispatchCampaign(poor,{type:'visitSector'});assert.ok(rejected.lastError);assert.equal(rejected.resources.treasury,1);assert.equal(rejected.pendingBattle,null);
});

test('zero allocations and blade primaries receive no cartridges, while actual attacks use independent enemy budgets',()=>{
 let s=hired(content({deploymentCartridges:0,enemyCartridges:0}));assert.equal(deploymentCost(s),0);s=order(s,{type:'attack',sector:'buenos_aires'});let b=enterSector(s.pendingBattle);assert.ok(b.units.every(u=>u.loaded===0&&u.ammo===0));assert.ok(save(s,b));
 const d=content({deploymentCartridges:5,enemyCartridges:3});d.characters.find(c=>c.id==='person-110').weapon='blade-1812';d.oppositionEquipment.line='blade-1812';s=hired(d);assert.equal(deploymentCost(s),0);s=order(s,{type:'attack',sector:'buenos_aires'});b=enterSector(s.pendingBattle);assert.equal(b.units.find(u=>u.id==='110').loaded+b.units.find(u=>u.id==='110').ammo,0);assert.equal(b.units.find(u=>u.id==='enemy-0').loaded+b.units.find(u=>u.id==='enemy-0').ammo,3);assert.deepEqual([b.units.find(u=>u.id==='enemy-1').loaded,b.units.find(u=>u.id==='enemy-1').ammo],[0,0]);assert.ok(save(s,b));
 delete d.oppositionEquipment;const ordinary=oppositionFor({theater:'coast',squad:[{},{},{}],difficulty:2},initialCampaign(8,d));assert.ok(ordinary.enemies.every(u=>u.loaded+u.ammo===3));
});

test('trained militia receive the configured total once and save their spent supply on return',()=>{
 const d=content({militiaCartridges:9});d.militiaEquipment.green='firearm-1808';let s=order(secureArea(initialCampaign(8,d),'buenos_aires','ensenada'),{type:'createOfficer',name:'Isabel',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});s=order(s,{type:'militia',trainerId:1000,rank:0});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle),u=b.units.find(u=>u.militia);assert.deepEqual([u.loaded,u.ammo],[8,1]);
 // Prepare a nearby hostile in the actual issued militia scene to consume one shot.
 b.units.push({...structuredClone(b.units[0]),id:'target',side:'enemy',x:u.x+1,y:u.y,overwatch:false});b.mode='combat';b.sectorCleared=false;b=actBattle(b,{type:'fire',unitId:u.id,targetId:'target'});assert.equal(b.lastError,null);assert.equal(b.units.find(v=>v.id===u.id).loaded,7);s=leave(s,b);s=save(s).campaign;s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);u=b.units.find(v=>v.id===u.id);assert.deepEqual([u.loaded,u.ammo],[7,1]);assert.ok(save(s,b));
 const old=content({militiaCartridges:0});delete old.militiaEquipment;const state=initialCampaign(8,old);state.sectors.retiro.militia=[1,0,0];assert.deepEqual(prepareGarrison(state,'retiro').map(u=>[u.loaded,u.ammo]),[[0,0]]);
});
