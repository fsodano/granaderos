import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,isSupplied} from '../game/campaign.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {DEFAULT_ARTILLERY_SUPPLY,ARTILLERY_SUPPLY_FIELDS,artillerySupplyRules} from '../game/artillery-supply-rules.js';
import {artillerySupplyQuote} from '../game/artillery-supply.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {wonBattery,fireStationed} from './stationed-artillery-fixture.mjs';
import {emptyBattery,reloadPiece} from './artillery-supply-fixture.mjs';
const gun=s=>s.sectorStates.san_nicolas.artillery[0],buy=s=>({type:'resupplyArtillery',sector:'san_nicolas',artilleryId:gun(s).id});
const quote=s=>artillerySupplyQuote(s,'san_nicolas',gun(s).id,isSupplied(s,s.location));
test('optional artillery supply rules preserve older content identity and validate all prices, limits and permissions',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);assert.equal(d.artillerySupply,undefined);assert.deepEqual(artillerySupplyRules(s),DEFAULT_ARTILLERY_SUPPLY);assert.deepEqual(saved({campaign:s}).campaign.contentCampaign.identity,s.contentCampaign.identity);
 d.artillerySupply={...DEFAULT_ARTILLERY_SUPPLY,enabled:false,swivel:0,field8:1000000,reserveLimit:1000};assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.deepEqual(campaignContentReport(d).blocked,[]);
 const invalid=[null,[],{}, {...d.artillerySupply,extra:1},{...d.artillerySupply,enabled:0}];for(const [key,,min,max]of ARTILLERY_SUPPLY_FIELDS)for(const value of [min-1,max+1,1.5,'3',NaN,null])invalid.push({...d.artillerySupply,[key]:value});
 for(const artillerySupply of invalid){const bad={...d,artillerySupply};assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(42,bad));}
});
test('a truly exhausted emplaced gun buys one paid reserve, preserves full saves and loads only through its ordinary crew order',()=>{
 let s=emptyBattery();const before=structuredClone(gun(s)),money=s.resources.treasury,hour=s.hour,stock=structuredClone(s.armory);assert.deepEqual(quote(s),{available:true,reason:'',cost:10,limit:6});s=order(s,buy(s));assert.equal(s.resources.treasury,money-10);assert.equal(s.hour,hour);assert.deepEqual(s.armory,stock);assert.deepEqual(gun(s),{...before,ammo:1});s=saved({campaign:s}).campaign;
 let p=visit(s);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,1);p=reloadPiece(p);assert.equal(p.battle.artillery[0].loaded,true);assert.equal(p.battle.artillery[0].ammo,0);const returned=saved({campaign:leave(p)}).campaign;assert.equal(gun(returned).id,before.id);assert.equal(gun(returned).ammo,0);assert.equal(gun(returned).loaded,true);
});
test('supply is limited by the pinned reserve cap and rejected orders preserve finite money and gun state',()=>{
 let s=emptyBattery();const funds=s.resources.treasury;for(let i=0;i<6;i++)s=order(s,buy(s));assert.equal(gun(s).ammo,6);assert.equal(s.resources.treasury,funds-60);assert.equal(quote(s).available,false);const no=dispatchCampaign(s,buy(s));assert.match(no.lastError,/límite/);assert.deepEqual(no.sectorStates,s.sectorStates);assert.deepEqual(no.resources,s.resources);
});
test('a lower authored supply cap preserves the initial bundle and permits buying only after real consumption falls below it',()=>{
 const d=defaultContentPackage();d.artillerySupply={...DEFAULT_ARTILLERY_SUPPLY,reserveLimit:2};let s=wonBattery(d);assert.equal(gun(s).ammo,6);assert.match(quote(s).reason,/límite/);assert.equal(saved({campaign:s}).campaign.sectorStates.san_nicolas.artillery[0].ammo,6);
 let p=visit(s);for(let i=0;i<5;i++)p=reloadPiece(fireStationed(p));s=leave(p);assert.equal(gun(s).ammo,1);assert.equal(quote(s).available,true);s=order(s,buy(s));assert.equal(gun(s).ammo,2);assert.equal(quote(s).available,false);
});
test('authored prices, zero-price supply and disabled replenishment apply to actual paid and fired campaign pieces',()=>{
 for(const [price,enabled]of [[37,true],[0,true],[11,false]]){const d=defaultContentPackage();d.artillerySupply={...DEFAULT_ARTILLERY_SUPPLY,swivel:price,enabled,reserveLimit:6};let s=leave(reloadPiece(fireStationed(visit(wonBattery(d)))));const funds=s.resources.treasury;assert.equal(gun(s).ammo,5);assert.equal(quote(s).cost,price);d.artillerySupply.swivel=999;
  if(enabled){s=order(s,buy(s));assert.equal(s.resources.treasury,funds-price);assert.equal(gun(s).ammo,6);assert.equal(saved({campaign:s}).campaign.contentCampaign.package.artillerySupply.swivel,price);}else{const no=dispatchCampaign(s,buy(s));assert.match(no.lastError,/no permite/);assert.equal(no.resources.treasury,funds);assert.deepEqual(no.sectorStates,s.sectorStates);}
 }
});
test('remote, hostile, disconnected, busy, unavailable and unaffordable prepared boundaries reject without changing custody',()=>{
 const base=emptyBattery(),cases=[s=>s.location='retiro',s=>s.sectors.san_nicolas.owner='royalist',s=>gun(s).side='enemy',s=>s.sectors.buenos_aires.owner='royalist',s=>s.squad=[],s=>s.resources.treasury=9,s=>{for(const id of s.squad)s.operativeState[id].assignment='rest';},s=>s.defeated=true];
 for(const edit of cases){const s=structuredClone(base);edit(s);assert.equal(quote(s).available,false);const n=dispatchCampaign(s,buy(s));assert.ok(n.lastError);assert.deepEqual(n.resources,s.resources);assert.deepEqual(n.sectorStates,s.sectorStates);}
 const p=visit(base);assert.equal(artillerySupplyQuote(p.campaign,'san_nicolas',gun(base).id,true).available,false);const rejected=dispatchCampaign(p.campaign,buy(base));assert.ok(rejected.lastError);assert.deepEqual(rejected.sectorStates,p.campaign.sectorStates);
 const unknown=dispatchCampaign(base,{type:'resupplyArtillery',sector:'san_nicolas',artilleryId:'missing'});assert.ok(unknown.lastError);assert.deepEqual(unknown.resources,base.resources);
 const hostile=structuredClone(base),old=hostile.sectorStates.san_nicolas.units.find(u=>u.side==='enemy');Object.assign(old,{hp:100,energy:100,routed:false,unconscious:false,fled:false,surrendered:false,departure:false});assert.match(quote(hostile).reason,/enemigos/);assert.ok(dispatchCampaign(hostile,buy(hostile)).lastError);
});
test('finite supply preserves prepared unfinished loading and uses each configured model quote without altering other pieces',()=>{
 const s=emptyBattery(),g=gun(s);g.reloadProgress=.4;const modelPrices={bronze4:20,field8:30,swivel:10};
 for(const [type,price]of Object.entries(modelPrices)){const prepared=structuredClone(s);gun(prepared).type=type;const next=order(prepared,buy(prepared));assert.equal(next.resources.treasury,prepared.resources.treasury-price);assert.deepEqual(gun(next),{...gun(prepared),ammo:1});assert.equal(saved({campaign:next}).campaign.sectorStates.san_nicolas.artillery[0].reloadProgress,.4);}
});
