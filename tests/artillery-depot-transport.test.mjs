import {wakeBatteryCrew} from './stationed-artillery-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {homeDepotGun} from './artillery-depot-fixture.mjs';
import {depotTradeGun} from './artillery-trading-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_ARTILLERY_TRANSPORT} from '../game/artillery-transport-rules.js';
import {artilleryTransportQuote,depotSelection} from '../game/artillery-transport.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
const same=(a,b)=>{for(const key of ['id','type','side','loaded','ammo','reloadProgress','facing'])assert.deepEqual(a[key],b[key],key);};
const send=(s,to='buenos_aires')=>({type:'transportArtillery',source:'depot',sector:s.location,artilleryId:s.artilleryDepots[s.location][0].id,to,mode:'carts'});

test('a finite issued and fired gun returns from the home depot to the front and enters actual combat without fresh ammunition',()=>{
 let s=homeDepotGun();const gun=structuredClone(s.artilleryDepots.retiro[0]),cash=s.resources.treasury,action=send(s);const quote=artilleryTransportQuote(s,'retiro',gun.id,'buenos_aires','carts','depot');assert.equal(quote.available,true,quote.reason);assert.equal(quote.hours,18);s=order(s,action);assert.deepEqual(s.artilleryDepots.retiro,[]);same(s.artilleryTransfers[0].gun,gun);assert.equal(s.resources.treasury,cash);assert.equal(ownedArtilleryCount(s),1);assert.ok(dispatchCampaign(s,action).lastError);s=saved({campaign:s}).campaign;
 const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'buenos_aires'});s=wakeBatteryCrew(s);if(s.hour<due)s=advanceCampaignHours(s,due-s.hour);s=wakeBatteryCrew(s);same(s.artilleryDepots.buenos_aires[0],gun);assert.equal(s.artilleryTransfers.length,0);s=order(s,{type:'configureArtillery',types:[depotSelection(gun)]});s=order(s,{type:'attack',sector:'ensenada'});const p=saved({campaign:s,battle:enterSector(s.pendingBattle)});same(p.battle.artillery[0],gun);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,gun.ammo);assert.deepEqual(p.campaign.artilleryDepots.buenos_aires,[]);
});

test('an exact owned gun with declared unfinished loading can leave its workshop depot and redeploy elsewhere',()=>{
 let s=depotTradeGun();s.artilleryDepots.buenos_aires[0].reloadProgress=.4;const gun=structuredClone(s.artilleryDepots.buenos_aires[0]);assertTradeRejected(s,{type:'sellArtillery',kind:'depot',artilleryId:gun.id});assertTradeRejected(s,{type:'repurchaseArtillery',artilleryId:gun.id});s=saved({campaign:s}).campaign;s=order(s,send(s,'san_nicolas'));const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'san_nicolas'});s=wakeBatteryCrew(s);if(s.hour<due)s=advanceCampaignHours(s,due-s.hour);s=wakeBatteryCrew(s);s=order(saved({campaign:s}).campaign,{type:'attack',sector:'santa_fe'});const p=saved({campaign:s,battle:enterSector(s.pendingBattle)});same(p.battle.artillery.find(g=>g.id===gun.id),gun);assert.equal(p.campaign.artilleryMerchants.buenos_aires?.guns.length??0,0);assert.equal(ownedArtilleryCount(p.campaign),1);
});

test('depot forwarding charges its authored fee once and rejects wrong origin, stale identity and duplicated saved custody',()=>{
 const d=defaultContentPackage();d.artilleryTransport={...DEFAULT_ARTILLERY_TRANSPORT,cartsHours:1,cartsFee:37};let s=homeDepotGun(d);const gun=structuredClone(s.artilleryDepots.retiro[0]),action=send(s),cash=s.resources.treasury;assert.equal(artilleryTransportQuote(s,'retiro',gun.id,'buenos_aires','carts','depot').hours,1);
 for(const change of [a=>a.source='field',a=>a.source='merchant',a=>a.sector='buenos_aires',a=>a.artilleryId='missing']){const bad={...action};change(bad);const rejected=dispatchCampaign(s,bad);assert.ok(rejected.lastError);assert.deepEqual(rejected.resources,s.resources);assert.deepEqual(rejected.artilleryDepots,s.artilleryDepots);}
 const poor=structuredClone(s);poor.resources.treasury=36;assert.ok(dispatchCampaign(poor,action).lastError);assert.deepEqual(poor.artilleryDepots.retiro,[gun]);
 s=order(s,action);assert.equal(s.resources.treasury,cash-37);const repeat=dispatchCampaign(s,action);assert.ok(repeat.lastError);assert.equal(repeat.resources.treasury,cash-37);s=saved({campaign:s}).campaign;const wire=JSON.parse(encodeSave(s));wire.campaign.artilleryDepots.retiro.push(structuredClone(gun));assert.throws(()=>decodeSave(JSON.stringify(wire)),/dos sectores/);s=advanceCampaignHours(s,1);same(s.artilleryDepots.buenos_aires[0],gun);assert.equal(s.resources.treasury,cash-37);
});
