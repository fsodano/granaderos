import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,isSupplied} from '../game/campaign.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {DEFAULT_ARTILLERY_SUPPLY,ARTILLERY_SUPPLY_FIELDS,artillerySupplyRules} from '../game/artillery-supply-rules.js';
import {artillerySupplyQuote} from '../game/artillery-supply.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {issuedBattery,wonBattery,fireStationed,exhaustStationed} from './stationed-artillery-fixture.mjs';
import {emptyBattery} from './artillery-supply-fixture.mjs';
const gun=s=>s.sectorStates.san_nicolas.artillery[0],buy=s=>({type:'resupplyArtillery',sector:'san_nicolas',artilleryId:gun(s).id});
const quote=s=>artillerySupplyQuote(s,'san_nicolas',gun(s).id,isSupplied(s,s.location));
test('optional artillery supply rules preserve older content identity and validate all prices, limits and permissions',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);assert.equal(d.artillerySupply,undefined);assert.deepEqual(artillerySupplyRules(s),DEFAULT_ARTILLERY_SUPPLY);assert.deepEqual(saved({campaign:s}).campaign.contentCampaign.identity,s.contentCampaign.identity);
 d.artillerySupply={...DEFAULT_ARTILLERY_SUPPLY,enabled:false,swivel:0,field8:1000000,reserveLimit:1000};assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.deepEqual(campaignContentReport(d).blocked,[]);
 const invalid=[null,[],{}, {...d.artillerySupply,extra:1},{...d.artillerySupply,enabled:0}];for(const [key,,min,max]of ARTILLERY_SUPPLY_FIELDS)for(const value of [min-1,max+1,1.5,'3',NaN,null])invalid.push({...d.artillerySupply,[key]:value});
 for(const artillerySupply of invalid){const bad={...d,artillerySupply};assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(42,bad));}
});
test('a truly exhausted emplaced gun stays empty through closed purchases, saves and ordinary loading',()=>{
 const s=emptyBattery(),before=structuredClone(gun(s));assert.deepEqual(quote(s),{available:true,reason:'',cost:10,limit:6});assertTradeRejected(s,buy(s));
 const p=visit(saved({campaign:s}).campaign),piece=p.battle.artillery[0],actor=p.battle.units.find(u=>u.side==='player'&&u.hp>=15&&!u.routed&&Math.hypot(u.x-piece.x,u.y-piece.y)<=1.5);assert.ok(actor);
 const denied=actBattle(p.battle,{type:'artilleryReload',unitId:actor.id,artilleryId:piece.id});assert.ok(denied.lastError);assert.deepEqual(denied.artillery,p.battle.artillery);assert.deepEqual(denied.units,p.battle.units);
 const returned=saved({campaign:leave(p)}).campaign;assert.equal(gun(returned).id,before.id);assert.equal(gun(returned).ammo,0);assert.equal(gun(returned).loaded,false);
});
test('repeated old refill callbacks cannot create reserves, take money or change the saved gun',()=>{
 const s=emptyBattery();for(let i=0;i<6;i++)assertTradeRejected(s,buy(s));assert.equal(gun(s).ammo,0);assert.equal(saved({campaign:s}).campaign.sectorStates.san_nicolas.artillery[0].ammo,0);
});
test('a lower authored supply cap preserves the initial bundle and quotes only the actual reserve left after real consumption without refilling',()=>{
 const d=defaultContentPackage();d.artillerySupply={...DEFAULT_ARTILLERY_SUPPLY,reserveLimit:2};const issued=issuedBattery(d);assert.equal(issued.pendingBattle.artillery[0].ammo,6);assert.equal(saved({campaign:issued,battle:enterSector(issued.pendingBattle)}).campaign.pendingBattle.artillery[0].ammo,6);let s=wonBattery(d);
 const retained=structuredClone(gun(s));assert.ok(retained.ammo+Number(retained.loaded)<7,'the actual victory spends finite issued charges');assert.equal(quote(s).available,retained.ammo<2);assert.deepEqual(gun(saved({campaign:s}).campaign),retained);
 // The real victory need not fire a fixed number of rounds. If it leaves a
 // reserve above the authored cap, spend those charges through ordinary fire.
 if(retained.ammo>=2){let p=visit(s);while(p.battle.artillery[0].ammo>=2)p=fireStationed(p);s=leave(p);}
 assert.ok(gun(s).ammo>0&&gun(s).ammo<2);assert.equal(quote(s).available,true);assert.equal(gun(saved({campaign:s}).campaign).ammo,gun(s).ammo);
 s=leave(exhaustStationed(visit(s)));assert.equal(gun(s).ammo,0);assert.equal(gun(s).loaded,false);assert.equal(quote(s).available,true);assertTradeRejected(s,buy(s));assert.equal(gun(s).ammo,0);assert.equal(quote(s).available,true);
});
test('authored, zero-price and disabled legacy quotes cannot refill actual fired campaign pieces',()=>{
 for(const [price,enabled]of [[37,true],[0,true],[11,false]]){const d=defaultContentPackage();d.artillerySupply={...DEFAULT_ARTILLERY_SUPPLY,swivel:price,enabled,reserveLimit:6};let s=leave(exhaustStationed(visit(wonBattery(d))));const funds=s.resources.treasury;assert.equal(gun(s).ammo,0);assert.equal(gun(s).loaded,false);assert.equal(quote(s).cost,price);d.artillerySupply.swivel=999;
  assertTradeRejected(s,buy(s));assert.equal(s.resources.treasury,funds);assert.equal(gun(s).ammo,0);assert.equal(saved({campaign:s}).campaign.contentCampaign.package.artillerySupply.swivel,price);
 }
});
test('remote, hostile, disconnected, busy, unavailable and unaffordable prepared boundaries reject without changing custody',()=>{
 const base=emptyBattery(),cases=[s=>s.location='retiro',s=>s.sectors.san_nicolas.owner='royalist',s=>gun(s).side='enemy',s=>s.sectors.buenos_aires.owner='royalist',s=>s.squad=[],s=>s.resources.treasury=9,s=>{for(const id of s.squad)s.operativeState[id].assignment='rest';},s=>s.defeated=true];
 for(const edit of cases){const s=structuredClone(base);edit(s);const n=assertTradeRejected(s,buy(s));assert.deepEqual(n.resources,s.resources);assert.deepEqual(n.sectorStates,s.sectorStates);}
 const p=visit(base);assert.equal(artillerySupplyQuote(p.campaign,'san_nicolas',gun(base).id,true).available,false);const rejected=dispatchCampaign(p.campaign,buy(base));assert.ok(rejected.lastError);assert.deepEqual(rejected.sectorStates,p.campaign.sectorStates);
 const unknown=dispatchCampaign(base,{type:'resupplyArtillery',sector:'san_nicolas',artilleryId:'missing'});assert.ok(unknown.lastError);assert.deepEqual(unknown.resources,base.resources);
 const hostile=structuredClone(base),old=hostile.sectorStates.san_nicolas.units.find(u=>u.side==='enemy');Object.assign(old,{hp:100,energy:100,routed:false,unconscious:false,fled:false,surrendered:false,departure:false});assert.match(quote(hostile).reason,/enemigos/);assert.ok(dispatchCampaign(hostile,buy(hostile)).lastError);
});
test('closed refill preserves prepared unfinished loading and uses each configured model quote without altering other pieces',()=>{
 const s=emptyBattery(),g=gun(s);g.reloadProgress=.4;const modelPrices={bronze4:20,field8:30,swivel:10};
 for(const [type,price]of Object.entries(modelPrices)){const prepared=structuredClone(s);gun(prepared).type=type;assert.equal(quote(prepared).cost,price);const next=assertTradeRejected(prepared,buy(prepared));assert.equal(next.resources.treasury,prepared.resources.treasury);assert.deepEqual(gun(next),gun(prepared));assert.equal(saved({campaign:next}).campaign.sectorStates.san_nicolas.artillery[0].reloadProgress,.4);}
});
