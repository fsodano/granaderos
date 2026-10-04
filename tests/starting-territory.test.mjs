import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,isSupplied,dailyIncome} from '../game/campaign.js';
import {worldOwner,WORLD_CELLS} from '../game/world-cells.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {militiaEligibility} from '../game/militia.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const saved=(s,b=null)=>decodeSave(encodeSave(s,b));
function content(){const d=defaultContentPackage();for(const id of ['buenos_aires','ensenada','mendoza'])d.startingTerritory[id]={owner:'patriot',loyalty:80};d.characters.find(c=>c.id==='person-110').arrivalHours=0;return d;}

test('starting territory accepts only supported complete maps and preserves the ordinary opening',()=>{
 const d=content();assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);const plain=initialCampaign(8),standard=initialCampaign(8,defaultContentPackage()),old=defaultContentPackage();delete old.startingTerritory;assert.deepEqual(standard.sectors,plain.sectors);assert.deepEqual(initialCampaign(8,old).sectors,plain.sectors);assert.deepEqual(standard.log,plain.log);
 const missing=defaultStartingTerritory();delete missing.cordoba;
 for(const value of [null,[],{},missing,{...d.startingTerritory,'cell-1-1':{owner:'patriot',loyalty:50}},...['neutral',null,4].map(owner=>({...d.startingTerritory,mendoza:{owner,loyalty:70}})),...[-1,101,1.5,'65',null].map(loyalty=>({...d.startingTerritory,mendoza:{owner:'patriot',loyalty}})),{...d.startingTerritory,mendoza:{owner:'patriot',loyalty:70,extra:1}},{...d.startingTerritory,mendoza:null},{...d.startingTerritory,retiro:{owner:'royalist',loyalty:65}}]){const invalid=content();invalid.startingTerritory=value;assert.ok(validateContentPackage(invalid).length);assert.throws(()=>initialCampaign(8,invalid));}
 for(const loyalty of [0,100]){d.startingTerritory.mendoza.loyalty=loyalty;assert.deepEqual(validateContentPackage(d),[]);}
});

test('authored control governs real arrivals and city instruction without granting forces or unspoken port income',()=>{
 const d=content(),s=initialCampaign(8,d);assert.equal(s.resources.treasury,3200);assert.deepEqual(s.recruited,[]);assert.deepEqual(s.squad,[]);assert.equal(s.phase,0);assert.ok(Object.values(s.flags).every(value=>value===false));assert.deepEqual(s.cityLoyaltyEvents,[]);assert.deepEqual(s.foundMoney,[]);assert.ok(Object.values(s.sectors).every(r=>r.militia.every(n=>n===0)));assert.deepEqual(s.garrisons,{});
 assert.ok(s.log[0].text.includes('Control inicial:'));assert.ok(!s.log[0].text.includes('Solo el cuartel'));
 assert.deepEqual(new Set(hiringArrivalOptions(s).map(x=>x.id)),new Set(['retiro','buenos_aires','ensenada','mendoza']));assert.equal(isSupplied(s,'buenos_aires'),true);assert.equal(isSupplied(s,'mendoza'),true,'owned local access has no route prerequisite');assert.equal(dailyIncome(s),0);assert.deepEqual(s.townIncome.activations,{});const nextDay=order(s,{type:'wait',hours:24});assert.equal(nextDay.resources.treasury,3200);assert.equal(saved(nextDay).campaign.resources.treasury,nextDay.resources.treasury);
 assert.equal(militiaEligibility(s,'retiro').eligible,true);const low=content();for(const id of ['retiro','buenos_aires','ensenada'])low.startingTerritory[id].loyalty=10;assert.equal(militiaEligibility(initialCampaign(8,low),'retiro').code,'loyalty');low.startingTerritory.ensenada.owner='royalist';assert.equal(militiaEligibility(initialCampaign(8,low),'retiro').code,'loyalty');assert.equal(militiaEligibility(initialCampaign(8,low),'ensenada').code,'control');low.startingTerritory.buenos_aires.owner='royalist';assert.equal(militiaEligibility(initialCampaign(8,low),'retiro').code,'control');
 for(const cell of WORLD_CELLS.filter(c=>c.locality==='buenos_aires'))assert.equal(worldOwner(s,cell.id),'patriot');const land=WORLD_CELLS.find(c=>c.land&&!c.locality);assert.equal(worldOwner(s,land.id),'neutral');assert.equal(worldOwner(s,'cordoba'),'royalist');
 const hired=order(s,{type:'recruitCivic',id:110,term:'week',destination:'mendoza'});assert.equal(hired.operativeState[110].location,'mendoza');assert.equal(hired.squad.includes(110),false);assert.ok(saved(hired));const denied=dispatchCampaign(s,{type:'recruitCivic',id:110,term:'week',destination:'cordoba'});assert.ok(denied.lastError);assert.equal(denied.resources.treasury,3200);
});

test('real travel enters an authored controlled locality without an assault and an occupied neighbor still requires combat',()=>{
 let s=order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);assert.equal(b.mode,'exploration');assert.ok(!b.units.some(u=>u.side==='enemy'));let pair=saved(s,b);pair=syncBattleTime(pair.campaign,pair.battle);assert.equal(pair.error,null);s=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 const blocked=dispatchCampaign(s,{type:'travel',sector:'san_nicolas'});assert.ok(blocked.lastError);s=order(s,{type:'attack',sector:'san_nicolas'});b=enterSector(s.pendingBattle);assert.ok(b.units.some(u=>u.side==='enemy'));assert.equal(s.sectors.san_nicolas.owner,'royalist');assert.ok(saved(s,b));
});

test('saved territorial changes and loyalty are not reset by the authored starting map or later draft edits',()=>{
 const d=content();let s=initialCampaign(8,d);d.startingTerritory.mendoza.owner='royalist';assert.equal(s.contentCampaign.package.startingTerritory.mendoza.owner,'patriot');
 // An established save represents later capture/loss; no battle victory is claimed.
 s.sectors.mendoza.owner='royalist';s.sectors.mendoza.loyalty=19;s.sectors.cordoba.owner='patriot';s.sectors.cordoba.loyalty=91;s=saved(s).campaign;assert.equal(s.sectors.mendoza.owner,'royalist');assert.equal(s.sectors.mendoza.loyalty,19);assert.equal(s.sectors.cordoba.owner,'patriot');assert.equal(s.sectors.cordoba.loyalty,91);assert.equal(s.contentCampaign.package.startingTerritory.mendoza.owner,'patriot');
 const altered=structuredClone(s);altered.contentCampaign.package.startingTerritory.mendoza.loyalty=22;assert.throws(()=>saved(altered),/identidad/);
});
