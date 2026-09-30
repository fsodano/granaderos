import {totalReserveAmmunition} from '../game/ammunition-types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign} from '../game/campaign.js';
import {dailyIncome,incomeSources,incomeSummary,sectorCash} from '../game/economy.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const step=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const officer=()=>step(initialCampaign(),{type:'createOfficer',name:'Ana del Sur',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
test('fresh economy has one resource and retired orders cannot consume funds',()=>{
 const s=initialCampaign();assert.deepEqual(s.resources,{treasury:3200});
 for(const key of ['production','shipments','depots','convoys'])assert.equal(s[key],undefined);
 for(const type of ['produce','contraband','supplyTransfer']){const n=dispatchCampaign(s,{type});assert.ok(n.lastError);assert.deepEqual(n.resources,s.resources);}
});
test('daily income matches the screen, pays once at midnight, and survives a reload',()=>{
 let s=initialCampaign();const income=dailyIncome(s);assert.equal(income,52);assert.deepEqual(incomeSummary(s),{daily:52,hoursUntilPayment:24});
 s=step(s,{type:'wait',hours:23});assert.equal(s.resources.treasury,3200);assert.equal(incomeSummary(s).hoursUntilPayment,1);
 s=decodeSave(encodeSave(s)).campaign;s=step(s,{type:'wait',hours:1});assert.equal(s.resources.treasury,3200+income);
 s=step(s,{type:'wait',hours:1});assert.equal(s.resources.treasury,3200+income);
 for(const hours of [23,24]){const before=s.resources.treasury,nextIncome=incomeSummary(s).daily;s=step(s,{type:'wait',hours});assert.equal(s.resources.treasury,before+nextIncome);}assert.equal(s.hour,72);assert.equal(s.resources.treasury,3357);
});
test('control, damage and blockade change the same income used for payment',()=>{
 let s=initialCampaign();s.sectors.mendoza.owner='patriot';assert.equal(dailyIncome(s),64,'an isolated town earns half its loyalty-scaled base');
 s.sectors.mendoza.damageUntil=48;assert.equal(incomeSources(s).find(x=>x.id==='mendoza').income,3);
 s.blockade=true;const income=dailyIncome(s);s=step(s,{type:'wait',hours:24});assert.equal(s.resources.treasury,3200+income);
 s.sectors.mendoza.owner='royalist';assert.equal(incomeSources(s).find(x=>x.id==='mendoza').income,0);
 s.blockade=false;s.sectors.mendoza.owner='patriot';s=step(s,{type:'wait',hours:24});assert.equal(s.hour,48);assert.ok(incomeSources(s).find(x=>x.id==='mendoza').income>3,'expired damage restores the local contribution');
});
test('campaign purchases, diplomacy and transport use treasury and finite stock',()=>{
 let s=initialCampaign();assert.ok(dispatchCampaign(s,{type:'academy'}).lastError);assert.equal(s.resources.treasury,3200);
 s=step(s,{type:'transport',mode:'posta'});s=step(s,{type:'fortify',sector:'retiro'});assert.equal(s.resources.treasury,2900);
 s.sectors.salta.owner='patriot';s=step(s,{type:'diplomacy',kind:'northPact'});assert.equal(s.resources.treasury,2600);
 s=step(s,{type:'purchaseEquipment',item:'bronze4',quantity:1});assert.equal(s.armory.bronze4,1);assert.equal(s.merchants.retiro.stock.bronze4,0);assert.deepEqual(s.resources,{treasury:1900});
 const before=structuredClone(s);const denied=dispatchCampaign(s,{type:'purchaseEquipment',item:'bronze4'});assert.ok(denied.lastError);assert.deepEqual(denied.armory,before.armory);assert.deepEqual(denied.resources,before.resources);
});
test('cash is found through tactical looting and paid once after save and re-entry',()=>{
 let s=step(officer(),{type:'visitSector'}),b=enterSector(s.pendingBattle);const ground=b.groundItems.find(g=>g.type==='money');assert.ok(ground);
 const initial=s.resources.treasury;assert.equal(b.units[0].inventory?.[ground.id],undefined);
 const far=structuredClone(b);far.units[0].x=far.width-1;far.units[0].y=far.height-1;assert.ok(actBattle(far,{type:'loot',unitId:'1000',groundId:ground.id}).lastError);
 b=actBattle(b,{type:'loot',unitId:'1000',groundId:ground.id});assert.equal(b.lastError,null);assert.ok(actBattle(b,{type:'loot',unitId:'1000',groundId:ground.id}).lastError);
 const synced=syncBattleTime(s,b);assert.equal(synced.error,null);s=synced.campaign;b=synced.battle;const loaded=decodeSave(encodeSave(s,b));s=loaded.campaign;b=loaded.battle;
 const leave=()=>{s=step(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});};
 const issued=s.pendingBattle.issuedCartridges;leave();assert.equal(s.resources.treasury,initial+sectorCash('retiro'));assert.deepEqual(s.foundMoney,['retiro']);assert.equal(totalReserveAmmunition(s.operativeState[1000])+(s.operativeState[1000].carriedLoaded??0),issued);
 const cash=s.resources.treasury;s=decodeSave(encodeSave(s)).campaign;s=step(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.groundItems.find(g=>g.type==='money').count,0);leave();assert.equal(s.resources.treasury,cash);
});
test('old economy saves are rejected without conversion; invalid cash is rejected',()=>{
 const old=initialCampaign();delete old.economyVersion;assert.throws(()=>restoreCampaign(JSON.stringify(old)),/economía anterior/);
 for(const value of [-1,NaN,1.5,1e10]){const s=initialCampaign();s.resources.treasury=value;assert.throws(()=>restoreCampaign(JSON.stringify(s)));}
 const oldStock=initialCampaign();oldStock.resources.horses=2;assert.throws(()=>restoreCampaign(JSON.stringify(oldStock)),/economía/);
});
