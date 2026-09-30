import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {ARTILLERY} from '../game/artillery-definitions.js';
import {DEFAULT_ARTILLERY_TRADING,ARTILLERY_TRADING_FIELDS,artilleryTradingRules} from '../game/artillery-trading-rules.js';
import {artilleryMerchant,artillerySaleQuote,artilleryRepurchaseQuote} from '../game/artillery-trading.js';
import {depotTradeGun} from './artillery-trading-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
const content=extra=>({...defaultContentPackage(),artilleryTrading:{...structuredClone(DEFAULT_ARTILLERY_TRADING),...extra}});
const officer=d=>order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
const stock={type:'sellArtillery',kind:'stock',model:'swivel',stockCount:1};

test('optional commerce rules retain legacy identity and validate finite cash, percentages and named local overrides',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);assert.equal(d.artilleryTrading,undefined);assert.deepEqual(artilleryTradingRules(s),DEFAULT_ARTILLERY_TRADING);assert.deepEqual(saved({campaign:s}).campaign.contentCampaign.identity,s.contentCampaign.identity);
 const good=content({initialCash:1000000,buyPercent:0,resalePercent:100,buyingOverrides:{buenos_aires:29,retiro:100}});assert.deepEqual(parseContentPackage(encodeContentPackage(good)),good);assert.deepEqual(campaignContentReport(good).blocked,[]);
 const bad=[null,[],{}, {...good.artilleryTrading,enabled:1},{...good.artilleryTrading,extra:1}];for(const [key,,min,max]of ARTILLERY_TRADING_FIELDS)for(const value of [min-1,max+1,1.5,'3',null,NaN])bad.push({...good.artilleryTrading,[key]:value});for(const overrides of [null,[],{missing:10},{retiro:-1},{retiro:101},{retiro:'29'},{retiro:29.5}])bad.push({...good.artilleryTrading,buyingOverrides:overrides});
 for(const artilleryTrading of bad){const draft={...good,artilleryTrading};assert.ok(validateContentPackage(draft).length);assert.throws(()=>initialCampaign(42,draft));}
});

test('an actual fired depot gun trades at its authored local rate and saved workshop money never resets',()=>{
 const d=content({initialCash:2000,buyPercent:25,resalePercent:70,buyingOverrides:{buenos_aires:29}});let s=depotTradeGun(d);const gun=structuredClone(s.artilleryDepots.buenos_aires[0]),cash=s.resources.treasury,offer={type:'sellArtillery',kind:'depot',artilleryId:gun.id};assert.equal(artillerySaleQuote(s,offer,true).price,116);assert.equal(artilleryMerchant(s).cash,2000);s=order(s,offer);assert.equal(s.merchants.buenos_aires.cash,1884);assert.equal(s.resources.treasury,cash+116);
 d.artilleryTrading.initialCash=999999;d.artilleryTrading.buyingOverrides.buenos_aires=99;s=saved({campaign:s}).campaign;assert.equal(artilleryTradingRules(s).initialCash,2000);assert.equal(artilleryRepurchaseQuote(s,gun.id,true).price,280);s=order(s,{type:'repurchaseArtillery',artilleryId:gun.id});assert.equal(s.resources.treasury,cash-164);assert.equal(s.merchants.buenos_aires.cash,2164);for(const key of ['id','type','loaded','ammo','reloadProgress','facing'])assert.deepEqual(s.artilleryDepots.buenos_aires[0][key],gun[key]);s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(s.merchants.buenos_aires.cash,2164);
});

test('disabled or underfunded commerce rejects atomically and zero-price exchange keeps both balances unchanged',()=>{
 for(const rules of [{enabled:false},{initialCash:0,buyPercent:100,resalePercent:0,buyingOverrides:{}}]){
  let s=order(officer(content(rules)),{type:'purchaseEquipment',item:'swivel'}),offer=stock;
  if(rules.enabled!==false){s=order(s,stock);const id=s.artilleryMerchants.retiro.guns[0].id;s=order(s,{type:'repurchaseArtillery',artilleryId:id});offer={type:'sellArtillery',kind:'depot',artilleryId:id};}
  const result=dispatchCampaign(s,offer);assert.ok(result.lastError);assert.deepEqual(result.armory,s.armory);assert.deepEqual(result.artilleryDepots,s.artilleryDepots);assert.deepEqual(result.resources,s.resources);assert.deepEqual(result.artilleryMerchants,s.artilleryMerchants);
 }
 let s=order(officer(content({initialCash:0,buyPercent:0,resalePercent:0,buyingOverrides:{}})),{type:'purchaseEquipment',item:'swivel'});const cash=s.resources.treasury,drawer=s.merchants.retiro.cash;s=order(s,stock);const gun=s.artilleryMerchants.retiro.guns[0];assert.equal(s.resources.treasury,cash);assert.equal(s.merchants.retiro.cash,drawer);s=order(saved({campaign:s}).campaign,{type:'repurchaseArtillery',artilleryId:gun.id});assert.equal(s.resources.treasury,cash);assert.equal(s.merchants.retiro.cash,drawer);assert.equal(s.artilleryDepots.retiro[0].id,gun.id);
});

test('authored percentages round integer pesos without floating-point discount errors',()=>{
 for(const [price,buyPrice,resale]of [[100,29,29],[101,29,30]]){const d=content({buyPercent:29,resalePercent:29,buyingOverrides:{}});d.artilleryProfiles=structuredClone(ARTILLERY);d.artilleryProfiles.swivel.price=price;let s=order(officer(d),{type:'purchaseEquipment',item:'swivel'});const cash=s.resources.treasury;assert.equal(artillerySaleQuote(s,stock,true).price,buyPrice);s=order(s,stock);const id=s.artilleryMerchants.retiro.guns[0].id;assert.equal(s.resources.treasury,cash+buyPrice);assert.equal(artilleryRepurchaseQuote(s,id,true).price,resale);s=order(s,{type:'repurchaseArtillery',artilleryId:id});assert.equal(s.resources.treasury,cash+buyPrice-resale);assert.ok(saved({campaign:s}));}
});

test('an authored subsidy spends finite workshop funds and stops when the next offer is unaffordable',()=>{
 let s=order(officer(content({initialCash:500,buyPercent:100,resalePercent:25,buyingOverrides:{}})),{type:'purchaseEquipment',item:'swivel'});
 const cash=s.resources.treasury,total=cash+artilleryMerchant(s).cash;assert.equal(artilleryMerchant(s).cash,900,'the original purchase funds the shared wallet');
 s=order(s,stock);const id=s.artilleryMerchants.retiro.guns[0].id;s=order(s,{type:'repurchaseArtillery',artilleryId:id});assert.equal(s.resources.treasury,cash+300);assert.equal(artilleryMerchant(s).cash,600);
 const offer={type:'sellArtillery',kind:'depot',artilleryId:id};s=order(s,offer);s=order(s,{type:'repurchaseArtillery',artilleryId:id});assert.equal(artilleryMerchant(s).cash,300);assert.equal(s.resources.treasury+artilleryMerchant(s).cash,total);
 assert.match(artillerySaleQuote(s,offer,true).reason,/taller no tiene suficientes pesos/);const rejected=dispatchCampaign(saved({campaign:s}).campaign,offer);assert.ok(rejected.lastError);assert.equal(rejected.merchants.retiro.cash,300);assert.equal(rejected.artilleryDepots.retiro.length,1);
});

test('an actual authored headquarters uses its own named override instead of a hardcoded Mendoza preference',()=>{
 const d=content({initialCash:2000,buyPercent:31,resalePercent:60,buyingOverrides:{mendoza:67}});d.headquarters='mendoza';d.startingTerritory.mendoza={owner:'patriot',loyalty:65};let s=order(officer(d),{type:'purchaseEquipment',item:'swivel'});assert.equal(s.location,'mendoza');assert.equal(artillerySaleQuote(s,stock,true).price,268);const cash=s.resources.treasury;s=order(s,stock);assert.equal(s.resources.treasury,cash+268);assert.equal(s.merchants.mendoza.cash,2000+400-268);assert.equal(saved({campaign:s}).campaign.contentCampaign.package.artilleryTrading.buyingOverrides.mendoza,67);
});
