import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,isSupplied,RECIPES} from '../game/campaign.js';
import {materialYield,productionHours,MATERIAL_STOCK} from '../game/industry.js';
import {cargoWeight} from '../game/logistics.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
test('powder is manufactured from finite ingredients and cannot be produced without them',()=>{
 let s=initialCampaign();const before={...s.resources};s=order(s,{type:'produce',recipe:'powder',sector:'retiro'});
 assert.equal(s.resources.saltpeter,before.saltpeter-15);assert.equal(s.resources.charcoal,before.charcoal-3);assert.equal(s.resources.sulfur,before.sulfur-2);assert.equal(s.resources.powder,before.powder);
 s=order(s,{type:'wait',hours:12});assert.equal(s.resources.powder,before.powder+20);
 s.resources.saltpeter=0;assert.match(dispatchCampaign(s,{type:'produce',recipe:'powder',sector:'retiro'}).lastError,/Salitre/);
});
test('regional control and damage govern material yields and workshop throughput',()=>{
 const s=initialCampaign();assert.deepEqual(materialYield(s,isSupplied),{});const base=productionHours(s,RECIPES.cannon,isSupplied);
 s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';assert.ok(materialYield(s,isSupplied).timber>0);assert.ok(materialYield(s,isSupplied).copper>0);assert.ok(productionHours(s,RECIPES.cannon,isSupplied)<base);
 s.sectors.cordoba.damageUntil=100;assert.equal(materialYield(s,isSupplied).timber,undefined);
 s.sectors.cordoba.owner='royalist';assert.equal(materialYield(s,isSupplied).copper,undefined);
});
test('material cargo arrives after actual delayed import and survives save migration',()=>{
 let s=initialCampaign();const before=s.resources.lead;s=order(s,{type:'contraband',offer:'materials'});const due=s.shipments[0].due;assert.equal(s.resources.lead,before);
 s=restoreCampaign(JSON.stringify(s));s=order(s,{type:'wait',hours:due});assert.equal(s.resources.lead,before+20);assert.equal(cargoWeight({lead:5,timber:10,sulfur:2}),17);
 const old=initialCampaign();for(const k of Object.keys(MATERIAL_STOCK))delete old.resources[k];const migrated=restoreCampaign(JSON.stringify(old));for(const k of Object.keys(MATERIAL_STOCK))assert.equal(migrated.resources[k],0);
});
test('cartridges and blades consume metal while uniforms consume leather',()=>{
 let s=initialCampaign();let before={...s.resources};s=order(s,{type:'produce',recipe:'cartridges',sector:'retiro'});assert.equal(s.resources.lead,before.lead-3);
 s=order(s,{type:'produce',recipe:'sabres',sector:'retiro'});assert.equal(s.resources.scrapIron,before.scrapIron-6);
 s=order(s,{type:'produce',recipe:'uniforms',sector:'retiro'});assert.equal(s.resources.leather,before.leather-10);
});
test('imported personal rifles cannot be equipped before arrival and blockades delay them',()=>{
 let s=initialCampaign();const cash=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:1802,quantity:1});assert.equal(s.resources.treasury,cash-420);assert.equal(s.armory[1802],undefined);assert.ok(s.equipmentShipments[0].due>=72&&s.equipmentShipments[0].due<=120);
 s.blockade=true;s=order(s,{type:'wait',hours:120});assert.equal(s.armory[1802],undefined);assert.equal(s.equipmentShipments.length,1);
 s=restoreCampaign(JSON.stringify(s));s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.armory[1802],1);assert.equal(s.equipmentShipments.length,0);
 s=order(s,{type:'wait',hours:1});assert.equal(s.armory[1802],1);
 s.equipmentShipments=[{item:1802,quantity:-1,due:10}];assert.throws(()=>restoreCampaign(JSON.stringify(s)),/pedidos de armas/);
});
