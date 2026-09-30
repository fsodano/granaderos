import test from 'node:test';
import assert from 'node:assert/strict';
import {HEADQUARTERS_OPTIONS,headquartersFor,campaignChapters} from '../game/campaign-headquarters.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,isSupplied,campaignObjectives,availableActions} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {dailyIncome} from '../game/economy.js';
import {refillCost,firearmRepairCost} from '../game/equipment.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const create={type:'createOfficer',name:'Isabel',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}};
function content(id='salta'){const d=defaultContentPackage();d.headquarters=id;d.startingTerritory=defaultStartingTerritory(id);return d;}

test('headquarters validates plausible locality choices, controlled startup and older content defaults',()=>{
 for(const {id}of HEADQUARTERS_OPTIONS){const d=content(id);assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);const s=initialCampaign(8,d);assert.equal(s.location,id);assert.equal(s.squads[0].location,id);assert.equal(isSupplied(s,id),true);assert.equal(save(s).campaign.location,id);}
 for(const headquarters of [null,{},[],4,'missing','cell-27-28','uspallata','los_patos']){const d=content();d.headquarters=headquarters;assert.ok(validateContentPackage(d).length);assert.throws(()=>initialCampaign(8,d));}
 const occupied=content();occupied.startingTerritory.salta.owner='royalist';assert.throws(()=>initialCampaign(8,occupied),/control patriota/);
 const old=defaultContentPackage();delete old.headquarters;assert.equal(headquartersFor(initialCampaign(8,old)),'retiro');assert.equal(headquartersFor(initialCampaign()),'retiro');
 const implicit=content('mendoza');delete implicit.startingTerritory;const s=initialCampaign(8,implicit);assert.equal(s.location,'mendoza');assert.equal(s.sectors.mendoza.owner,'patriot');assert.equal(s.sectors.retiro.owner,'royalist');assert.ok(save(s));
});

test('an alternate headquarters starts a free officer, chapter, workshop and real peaceful scene with no Retiro control',()=>{
 let s=initialCampaign(8,content());assert.equal(s.phase,0);assert.match(campaignObjectives(s)[0].name,/Salta/);assert.match(availableActions(s).phase.objective,/Salta/);assert.match(s.log[0].text,/^Salta/);assert.deepEqual(hiringArrivalOptions(s).map(o=>o.id),['salta']);
 s=order(s,create);assert.equal(s.resources.treasury,3200);assert.equal(s.phase,1);assert.equal(s.operativeState[1000].location,'salta');assert.equal(s.cityLoyaltyEvents.find(e=>e.eventId==='quest-academy').sectorId,'salta');assert.equal(s.sectors.retiro.loyalty,25);
 s=order(s,{type:'purchaseEquipment',item:'firearm-1801'});assert.equal(s.armoryItems.length,1);assert.ok(s.resources.treasury<3200);assert.equal(s.sectors.retiro.owner,'royalist');
 // Prepared worn supplies isolate access and exact workshop payment.
 s.operativeState[1000].condition=40;s.operativeState[1000].rations=0;const repair=firearmRepairCost(s.operativeState[1000]),refill=refillCost(s.operativeState[1000]),funds=s.resources.treasury;
 s=order(s,{type:'repairWeapon',operativeId:1000});s=order(s,{type:'resupply',operativeId:1000});assert.equal(s.resources.treasury,funds-repair-refill);assert.equal(s.operativeState[1000].condition,100);assert.equal(s.operativeState[1000].rations,2);
 s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);assert.equal(b.mode,'exploration');assert.equal(b.sectorId,'salta');const active=save(s,b);const pair=syncBattleTime(active.campaign,active.battle);assert.equal(pair.error,null);s=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(save(s).campaign.location,'salta');
});

test('a real paid hire arrives at the chosen base and supply follows its connected controlled route',()=>{
 const d=content('mendoza');d.startingTerritory.cordoba.owner='patriot';d.startingTerritory.retiro.owner='patriot';let s=initialCampaign(8,d);
 assert.equal(isSupplied(s,'cordoba'),true);assert.equal(isSupplied(s,'retiro'),false);s=order(s,{type:'recruitCivic',id:110,term:'week'});assert.equal(s.hiringArrivals[0].destination,'mendoza');assert.equal(s.recruited.length,0);assert.equal(s.phase,0);s=order(save(s).campaign,{type:'wait',hours:6});assert.deepEqual(s.squad,[110]);assert.equal(s.operativeState[110].location,'mendoza');assert.equal(s.phase,1);assert.equal(s.contracts[110].started,6);s=order(s,{type:'travel',sector:'cordoba'});s=save(s).campaign;assert.equal(s.location,'cordoba');assert.equal(headquartersFor(s),'mendoza');assert.equal(s.squads[0].location,'cordoba');
 // Existing state may later open the route; the supply root stays in Mendoza.
 s.sectors.buenos_aires.owner='patriot';assert.equal(isSupplied(s,'retiro'),true);s.sectors.mendoza.owner='royalist';assert.equal(isSupplied(s,'retiro'),false);assert.equal(isSupplied(s,'cordoba'),false);
});

test('the selected headquarters receives the existing raid protection and its loss drives defeat instead of Retiro',()=>{
 let s=initialCampaign(8,content());s=order(s,{type:'wait',hours:120});assert.equal(s.defeated,false);assert.equal(s.sectors.salta.owner,'patriot');assert.equal(s.sectors.salta.damageUntil,0);assert.ok(!s.log.some(e=>e.text.includes('avanzar sobre Salta')));assert.ok(save(s));
 // Saved occupation isolates defeat settlement, not an enemy victory playthrough.
 s.sectors.retiro.owner='patriot';s.sectors.salta.owner='royalist';s=order(s,{type:'wait',hours:1});assert.equal(s.defeated,true);assert.match(s.log[0].text,/cuartel de Salta.*ha caído/);assert.equal(save(s).campaign.defeated,true);
 const captured=initialCampaign(8,content());captured.sectors.salta.owner='royalist';for(const action of [create,{type:'purchaseEquipment',item:'firearm-1801'}]){const n=dispatchCampaign(captured,action);assert.ok(n.lastError);assert.equal(n.resources.treasury,3200);assert.equal(n.officer,null);}
});

test('pinned headquarters survive travel and draft changes, while altered saved content is rejected',()=>{
 const d=content(),s=initialCampaign(8,d);d.headquarters='retiro';assert.equal(save(s).campaign.contentCampaign.package.headquarters,'salta');const bad=structuredClone(s);bad.contentCampaign.package.headquarters='mendoza';bad.contentCampaign.package.startingTerritory.mendoza.owner='patriot';assert.throws(()=>save(bad),/identidad/);assert.equal(campaignChapters(initialCampaign())[0].name,'I · Formación en Retiro');
});

test('a hired squad launches and saves an actual frontier attack supplied from the alternate headquarters',()=>{
 let s=order(initialCampaign(8,content('mendoza')),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'wait',hours:6});const funds=s.resources.treasury,income=dailyIncome(s);s=order(s,{type:'attack',sector:'uspallata'});assert.equal(s.pendingBattle.origin,'mendoza');assert.equal(s.pendingBattle.sector,'uspallata');assert.equal(s.hour,24);assert.equal(s.resources.treasury,funds+income-10);assert.equal(s.sectors.retiro.owner,'royalist');assert.equal(s.sectors.uspallata.owner,'royalist');const b=enterSector(s.pendingBattle),pair=save(s,b);assert.ok(b.units.some(u=>u.side==='enemy'));assert.equal(pair.campaign.location,'uspallata');assert.equal(headquartersFor(pair.campaign),'mendoza');assert.deepEqual(pair.battle,b);
});
