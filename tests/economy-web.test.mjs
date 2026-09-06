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
 for(const key of ['production','shipments','depots','convoys','horseState'])assert.equal(s[key],undefined);
 for(const type of ['produce','contraband','supplyTransfer','horseAction']){const n=dispatchCampaign(s,{type});assert.ok(n.lastError);assert.deepEqual(n.resources,s.resources);}
});
test('daily income matches the screen, pays once at midnight, and survives a reload',()=>{
 let s=initialCampaign();const income=dailyIncome(s);assert.equal(income,440);assert.deepEqual(incomeSummary(s),{daily:440,hoursUntilPayment:24});
 s=step(s,{type:'wait',hours:23});assert.equal(s.resources.treasury,3200);assert.equal(incomeSummary(s).hoursUntilPayment,1);
 s=decodeSave(encodeSave(s)).campaign;s=step(s,{type:'wait',hours:1});assert.equal(s.resources.treasury,3200+income);
 s=step(s,{type:'wait',hours:1});assert.equal(s.resources.treasury,3200+income);
 s=step(s,{type:'wait',hours:47});assert.equal(s.resources.treasury,3200+3*income);
});
test('control, damage and blockade change the same income used for payment',()=>{
 let s=initialCampaign();s.sectors.mendoza.owner='patriot';assert.equal(dailyIncome(s),540,'local income does not require a supply chain');
 s.sectors.mendoza.damageUntil=48;assert.equal(incomeSources(s).find(x=>x.id==='mendoza').income,25);
 s.blockade=true;const income=dailyIncome(s);s=step(s,{type:'wait',hours:24});assert.equal(s.resources.treasury,3200+income);
 s.sectors.mendoza.owner='royalist';assert.equal(incomeSources(s).find(x=>x.id==='mendoza').income,0);
 s.blockade=false;s.sectors.mendoza.owner='patriot';s.hour=48;assert.equal(dailyIncome(s),540);
});
test('campaign purchases, diplomacy and transport only require pesos',()=>{
 let s=initialCampaign();s=step(s,{type:'academy'});assert.equal(s.resources.treasury,2900);
 s=step(s,{type:'transport',mode:'posta'});s=step(s,{type:'fortify',sector:'retiro'});assert.equal(s.resources.treasury,2600);
 s.sectors.salta.owner='patriot';s=step(s,{type:'diplomacy',kind:'northPact'});assert.equal(s.resources.treasury,2300);
 s=step(s,{type:'purchaseEquipment',item:'bronze4',quantity:3});assert.equal(s.armory.bronze4,3);assert.deepEqual(s.resources,{treasury:200});
 const before=structuredClone(s);const denied=dispatchCampaign(s,{type:'purchaseEquipment',item:'field8'});assert.ok(denied.lastError);assert.deepEqual(denied.armory,before.armory);assert.deepEqual(denied.resources,before.resources);
});
test('cash is found through tactical looting and paid once after save and re-entry',()=>{
 let s=step(officer(),{type:'visitSector'}),b=enterSector(s.pendingBattle);const ground=b.groundItems.find(g=>g.type==='money');assert.ok(ground);
 const initial=s.resources.treasury;assert.equal(b.units[0].inventory?.[ground.id],undefined);
 const far=structuredClone(b);far.units[0].x=far.width-1;far.units[0].y=far.height-1;assert.ok(actBattle(far,{type:'loot',unitId:'1000',groundId:ground.id}).lastError);
 b=actBattle(b,{type:'loot',unitId:'1000',groundId:ground.id});assert.equal(b.lastError,null);assert.ok(actBattle(b,{type:'loot',unitId:'1000',groundId:ground.id}).lastError);
 const synced=syncBattleTime(s,b);assert.equal(synced.error,null);s=synced.campaign;b=synced.battle;const loaded=decodeSave(encodeSave(s,b));s=loaded.campaign;b=loaded.battle;
 const leave=()=>{s=step(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});};
 const issued=s.pendingBattle.issuedCartridges;leave();assert.equal(s.resources.treasury,initial+issued+sectorCash('retiro'));assert.deepEqual(s.foundMoney,['retiro']);
 const cash=s.resources.treasury;s=decodeSave(encodeSave(s)).campaign;s=step(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.groundItems.find(g=>g.type==='money').count,0);leave();assert.equal(s.resources.treasury,cash);
});
test('old economy saves are rejected without conversion; invalid cash is rejected',()=>{
 const old=initialCampaign();delete old.economyVersion;assert.throws(()=>restoreCampaign(JSON.stringify(old)),/economía anterior/);
 for(const value of [-1,NaN,1.5,1e10]){const s=initialCampaign();s.resources.treasury=value;assert.throws(()=>restoreCampaign(JSON.stringify(s)));}
 const oldStock=initialCampaign();oldStock.resources.horses=2;assert.throws(()=>restoreCampaign(JSON.stringify(oldStock)),/economía/);
});
