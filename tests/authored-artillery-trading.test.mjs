import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {ARTILLERY} from '../game/artillery-definitions.js';
import {DEFAULT_ARTILLERY_TRADING,ARTILLERY_TRADING_FIELDS,artilleryTradingRules} from '../game/artillery-trading-rules.js';
import {artilleryMerchant,artillerySaleQuote,artilleryRepurchaseQuote} from '../game/artillery-trading.js';
import {depotTradeGun} from './artillery-trading-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {legacyMerchantGun} from './artillery-legacy-custody-fixture.mjs';
const content=extra=>({...defaultContentPackage(),artilleryTrading:{...structuredClone(DEFAULT_ARTILLERY_TRADING),...extra}});
const officer=d=>order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
const stock={type:'sellArtillery',kind:'stock',model:'swivel',stockCount:1};

test('optional commerce rules retain legacy identity and validate finite cash, percentages and named local overrides',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);assert.equal(d.artilleryTrading,undefined);assert.deepEqual(artilleryTradingRules(s),DEFAULT_ARTILLERY_TRADING);assert.deepEqual(saved({campaign:s}).campaign.contentCampaign.identity,s.contentCampaign.identity);
 const good=content({initialCash:1000000,buyPercent:0,resalePercent:100,buyingOverrides:{buenos_aires:29,retiro:100}});assert.deepEqual(parseContentPackage(encodeContentPackage(good)),good);assert.deepEqual(campaignContentReport(good).blocked,[]);
 const bad=[null,[],{}, {...good.artilleryTrading,enabled:1},{...good.artilleryTrading,extra:1}];for(const [key,,min,max]of ARTILLERY_TRADING_FIELDS)for(const value of [min-1,max+1,1.5,'3',null,NaN])bad.push({...good.artilleryTrading,[key]:value});for(const overrides of [null,[],{missing:10},{retiro:-1},{retiro:101},{retiro:'29'},{retiro:29.5}])bad.push({...good.artilleryTrading,buyingOverrides:overrides});
 for(const artilleryTrading of bad){const draft={...good,artilleryTrading};assert.ok(validateContentPackage(draft).length);assert.throws(()=>initialCampaign(42,draft));}
});

test('an actual fired depot keeps its authored old quote and both balances when commerce is closed',()=>{
 const d=content({initialCash:2000,buyPercent:25,resalePercent:70,buyingOverrides:{buenos_aires:29}});const s=depotTradeGun(d),gun=s.artilleryDepots.buenos_aires[0],offer={type:'sellArtillery',kind:'depot',artilleryId:gun.id};
 assert.equal(artillerySaleQuote(s,offer,true).price,116);assert.equal(artilleryMerchant(s).cash,2000);assertTradeRejected(s,offer);
 const old=legacyMerchantGun(s,{sector:'buenos_aires',artilleryId:gun.id});d.artilleryTrading.initialCash=999999;d.artilleryTrading.buyingOverrides.buenos_aires=99;
 const restored=saved({campaign:old}).campaign;assert.equal(artilleryTradingRules(restored).initialCash,2000);assert.equal(artilleryRepurchaseQuote(restored,gun.id,true).price,280);assertTradeRejected(restored,{type:'repurchaseArtillery',artilleryId:gun.id});
 const next=order(restored,{type:'wait',hours:1});assert.equal(next.merchants.buenos_aires.cash,2000);assert.deepEqual(next.artilleryMerchants,restored.artilleryMerchants);
});

test('disabled, underfunded and zero-price historical commerce cannot reopen equipment trades',()=>{
 for(const rules of [{enabled:false},{initialCash:0,buyPercent:100,resalePercent:0,buyingOverrides:{}},{initialCash:0,buyPercent:0,resalePercent:0,buyingOverrides:{}}]){
  const s=withStoredGear(officer(content(rules)),'swivel');assertTradeRejected(s,stock);assertTradeRejected(s,{type:'purchaseEquipment',item:'swivel'});
  const old=legacyMerchantGun(s,{kind:'stock',model:'swivel'});assertTradeRejected(saved({campaign:old}).campaign,{type:'repurchaseArtillery',artilleryId:old.artilleryMerchants.retiro.guns[0].id});
 }
});

test('historical quote percentages round integer pesos without permitting a transaction',()=>{
 for(const [price,buyPrice,resale]of [[100,29,29],[101,29,30]]){
  const d=content({buyPercent:29,resalePercent:29,buyingOverrides:{}});d.artilleryProfiles=structuredClone(ARTILLERY);d.artilleryProfiles.swivel.price=price;
  const s=withStoredGear(officer(d),'swivel');assert.equal(artillerySaleQuote(s,stock,true).price,buyPrice);assertTradeRejected(s,stock);
  const old=legacyMerchantGun(s,{kind:'stock',model:'swivel'}),id=old.artilleryMerchants.retiro.guns[0].id;assert.equal(artilleryRepurchaseQuote(old,id,true).price,resale);assertTradeRejected(old,{type:'repurchaseArtillery',artilleryId:id});assert.ok(saved({campaign:old}));
 }
});

test('a saved subsidy cannot generate money or duplicate finite merchant stock through blocked callbacks',()=>{
 const s=withStoredGear(officer(content({initialCash:500,buyPercent:100,resalePercent:25,buyingOverrides:{}})),'swivel'),cash=s.resources.treasury;
 assert.equal(artilleryMerchant(s).cash,500);assertTradeRejected(s,stock);assert.equal(s.resources.treasury,cash);
 const old=legacyMerchantGun(s,{kind:'stock',model:'swivel'}),id=old.artilleryMerchants.retiro.guns[0].id;
 for(let i=0;i<3;i++){assertTradeRejected(old,{type:'repurchaseArtillery',artilleryId:id});assertTradeRejected(old,stock);}
 assert.equal(old.resources.treasury,cash);assert.equal(artilleryMerchant(old).cash,500);assert.equal(saved({campaign:old}).campaign.artilleryMerchants.retiro.guns.length,1);
});

test('an authored headquarters retains its named legacy override without opening a trade',()=>{
 const d=content({initialCash:2000,buyPercent:31,resalePercent:60,buyingOverrides:{mendoza:67}});d.headquarters='mendoza';d.startingTerritory.mendoza={owner:'patriot',loyalty:65};const s=withStoredGear(officer(d),'swivel');
 assert.equal(s.location,'mendoza');assert.equal(artillerySaleQuote(s,stock,true).price,268);assertTradeRejected(s,stock);assert.equal(s.merchants.mendoza.cash,2000);assert.equal(saved({campaign:s}).campaign.contentCampaign.package.artilleryTrading.buyingOverrides.mendoza,67);
});
