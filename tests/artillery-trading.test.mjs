import {wakeBatteryCrew} from './stationed-artillery-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {ARTILLERY} from '../game/artillery-definitions.js';
import {artilleryMerchant,artillerySaleQuote,artilleryRepurchaseQuote,artillerySaleOffers} from '../game/artillery-trading.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {depotSelection} from '../game/artillery-transport.js';
import {depotTradeGun,fieldTradeGun} from './artillery-trading-fixture.mjs';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {legacyMerchantGun} from './artillery-legacy-custody-fixture.mjs';
const officer=d=>order(initialCampaign(42,d??defaultContentPackage()),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
const blockedSale=(s,offer)=>assertTradeRejected(s,{type:'sellArtillery',...offer});
const same=(a,b)=>{for(const k of ['id','type','side','ammo','loaded','reloadProgress','facing'])assert.deepEqual(a[k],b[k],k);};

test('an actually fired and transported gun survives closed trades before finite redeployment',()=>{
 let s=depotTradeGun();const gun=structuredClone(s.artilleryDepots.buenos_aires[0]),offer={kind:'depot',artilleryId:gun.id};
 assert.equal(artillerySaleQuote(s,offer,isSupplied(s,s.location)).price,160);assert.equal(artilleryMerchant(s).cash,1200);blockedSale(s,offer);assertTradeRejected(s,{type:'repurchaseArtillery',artilleryId:gun.id});
 s=saved({campaign:s}).campaign;same(s.artilleryDepots.buenos_aires[0],gun);assert.equal(ownedArtilleryCount(s),1);
 s=order(s,{type:'configureArtillery',types:[depotSelection(gun)]});s=order(s,{type:'travel',sector:'retiro'});s=wakeBatteryCrew(s);assert.equal(s.artilleryDepots.buenos_aires.length,1);s=order(s,{type:'travel',sector:'buenos_aires'});s=wakeBatteryCrew(s);s=order(s,{type:'attack',sector:'ensenada'});
 const p=saved({campaign:s,battle:enterSector(s.pendingBattle)});same(p.battle.artillery[0],gun);assert.equal(p.campaign.artilleryDepots.buenos_aires.length,0);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,6);
});

test('a fired emplacement preserves unfinished work and old merchant custody remains save-compatible',()=>{
 const s=fieldTradeGun();s.sectorStates.san_nicolas.artillery[0].reloadProgress=.4;const gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]),offer={kind:'field',sector:'san_nicolas',artilleryId:gun.id};assert.equal(artillerySaleQuote(s,offer,true).available,true);
 blockedSale(s,offer);same(saved({campaign:s}).campaign.sectorStates.san_nicolas.artillery[0],gun);
 const old=saved({campaign:legacyMerchantGun(s,{kind:'field',sector:'san_nicolas',artilleryId:gun.id})}).campaign;
 same(old.artilleryMerchants.san_nicolas.guns[0],gun);assert.equal(old.artilleryMerchants.san_nicolas.guns[0].x,undefined);assert.equal(artilleryRepurchaseQuote(old,gun.id,true).price,320);assertTradeRejected(old,{type:'repurchaseArtillery',artilleryId:gun.id});
});

test('finite declared stock receives one identity and its authored ammunition only on ordinary deployment',()=>{
 const d=defaultContentPackage();d.rules.startingTreasury=10000;d.artilleryProfiles=structuredClone(ARTILLERY);d.artilleryProfiles.swivel.initialLoaded=false;d.artilleryProfiles.swivel.initialAmmo=2;
 let s=officer(d);for(const model of ['bronze4','field8','swivel'])s=withStoredGear(s,model);const initialCount=s.nextArtilleryId;
 for(const model of ['bronze4','field8','swivel']){const offer=artillerySaleOffers(s).find(o=>o.model===model);assert.equal(offer.stockCount,1);blockedSale(s,offer);assert.equal(s.armory[model],1);}
 assert.equal(s.nextArtilleryId,initialCount);s=order(saved({campaign:s}).campaign,{type:'attack',sector:'buenos_aires'});const p=saved({campaign:s,battle:enterSector(s.pendingBattle)});
 assert.equal(p.battle.artillery.length,3);assert.equal(new Set(p.battle.artillery.map(g=>g.id)).size,3);assert.equal(p.campaign.nextArtilleryId,initialCount+3);assert.equal(p.battle.artillery.find(g=>g.type==='swivel').loaded,false);assert.equal(p.battle.artillery.find(g=>g.type==='swivel').ammo,2);
});

test('prepared access, cash, crew and hostile boundaries reject trades without changing custody',()=>{
 const base=fieldTradeGun(),gun=base.sectorStates.san_nicolas.artillery[0],offer={kind:'field',sector:'san_nicolas',artilleryId:gun.id};
 const changes=[s=>s.location='retiro',s=>s.sectors.san_nicolas.owner='royalist',s=>s.sectors.buenos_aires.owner='royalist',s=>s.squad=[],s=>{for(const id of s.squad)s.operativeState[id].assignment='rest';},s=>{for(const id of s.squad)s.operativeState[id].hp=14;},s=>s.sectorStates.san_nicolas.artillery[0].side='enemy',s=>s.merchants.san_nicolas.cash=159,s=>s.defeated=true,s=>s.sectorStates.san_nicolas.units.push({id:'hostile',side:'enemy',hp:100,energy:100})];
 for(const change of changes){const s=structuredClone(base);change(s);const before=structuredClone(s),result=dispatchCampaign(s,{type:'sellArtillery',...offer});assert.ok(result.lastError);delete result.lastError;delete before.lastError;assert.deepEqual(result,before);}
 const pending=visit(base);assert.equal(artillerySaleQuote(pending.campaign,offer,true).available,false);const sold=legacyMerchantGun(base,{kind:'field',sector:'san_nicolas',artilleryId:gun.id});sold.resources.treasury=319;assert.equal(artilleryRepurchaseQuote(sold,gun.id,true).available,false);const poor=assertTradeRejected(sold,{type:'repurchaseArtillery',artilleryId:gun.id});assert.deepEqual(poor.resources,sold.resources);assert.deepEqual(poor.artilleryMerchants,sold.artilleryMerchants);
 const remote=structuredClone(sold);remote.location='retiro';assert.equal(artilleryRepurchaseQuote(remote,gun.id,true).available,false);
});

test('full saves reject invalid shop money, excessive stock, changed load and duplicated physical ownership',()=>{
 let s=depotTradeGun();const gun=s.artilleryDepots.buenos_aires[0];s=legacyMerchantGun(s,{sector:'buenos_aires',artilleryId:gun.id});
 for(const mutate of [s=>s.artilleryMerchants=null,s=>s.artilleryMerchants.unknown={cash:1,guns:[]},s=>s.merchants.buenos_aires.cash=-1,s=>s.merchants.buenos_aires.cash=1.5,s=>s.artilleryMerchants.buenos_aires.extra=true,s=>s.artilleryMerchants.buenos_aires.guns[0].x=1,s=>s.artilleryMerchants.buenos_aires.guns[0].facing='north',s=>{s.artilleryMerchants.buenos_aires.guns[0].loaded=true;s.artilleryMerchants.buenos_aires.guns[0].reloadProgress=.4;},s=>s.artilleryDepots.buenos_aires.push(structuredClone(gun)),s=>s.artilleryMerchants.buenos_aires.guns=Array.from({length:101},(_,i)=>({...gun,id:`offer-${i}`}))]){const wire=JSON.parse(encodeSave(s));mutate(wire.campaign);assert.throws(()=>decodeSave(JSON.stringify(wire)),/artillería|pieza|taller|recarga|sectores|caja|comerciante/);}
});

test('prepared store capacity, local buying rates and serial boundaries preserve finite inventory',()=>{
 const base=fieldTradeGun(),gun=base.sectorStates.san_nicolas.artillery[0],offer={kind:'field',sector:'san_nicolas',artilleryId:gun.id};let full=structuredClone(base);full.artilleryMerchants={san_nicolas:{guns:Array.from({length:100},(_,i)=>({id:`shop-${i}`,type:'swivel',side:'player',loaded:false,ammo:0}))}};assert.match(artillerySaleQuote(full,offer,true).reason,/espacio/);assert.ok(dispatchCampaign(full,{type:'sellArtillery',...offer}).lastError);
 const crew=structuredClone(base);crew.operativeState[crew.squad[0]].assignment='rest';crew.contentCampaign.package.artilleryProfiles=structuredClone(ARTILLERY);crew.contentCampaign.package.artilleryProfiles.swivel.crew=6;assert.match(artillerySaleQuote(crew,offer,true).reason,/6 combatientes/);
 const sold=legacyMerchantGun(base,{kind:'field',sector:'san_nicolas',artilleryId:gun.id});sold.artilleryDepots={san_nicolas:Array.from({length:2000},(_,i)=>({id:`stored-${i}`,type:'swivel',side:'player',loaded:false,ammo:0}))};assert.match(artilleryRepurchaseQuote(sold,gun.id,true).reason,/lleno/);assert.ok(dispatchCampaign(sold,{type:'repurchaseArtillery',artilleryId:gun.id}).lastError);
 let stock=withStoredGear(officer(),'swivel');const stockOffer=artillerySaleOffers(stock).find(o=>o.kind==='stock');stock.nextArtilleryId=1000000000;assert.match(artillerySaleQuote(stock,stockOffer,true).reason,/registro/);assert.ok(dispatchCampaign(stock,{type:'sellArtillery',...stockOffer}).lastError);
 for(const [location,price]of [['retiro',160],['cordoba',120],['mendoza',200]]){const s=structuredClone(stock);s.nextArtilleryId=1;s.location=location;assert.equal(artillerySaleQuote(s,stockOffer,true).price,price);}
});
