import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {hasPendingCivilians} from '../game/campaign-civilians.js';
import {hasPendingCivilianHarm} from '../game/campaign-civilian-harm.js';
import {localPackage,localNPC,A} from './local-contract-fixture.mjs';
import {collectLogisticsAttention,recordLogisticsNotice,validateLogisticsNotice,logisticsEventText} from '../game/logistics-attention.js';
import {addEquipment,equipmentCatalog,isImportedEquipment} from '../game/equipment.js';
import {artillerySaleQuote} from '../game/artillery-trading.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const save=(campaign,battle=null)=>decodeSave(encodeSave(campaign,battle));
const sync=p=>{const next=syncBattleTime(p.campaign,p.battle);assert.equal(next.error,null,next.error);return next;};
const enter=campaign=>{campaign=order(campaign,{type:'visitSector'});return save(campaign,enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]));};
const leave=p=>order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
function hired(content=null){let s=initialCampaign(42,content);s=order(s,{type:'recruitCivic',id:110,term:'month'});while(!s.recruited.includes(110))s=order(s,{type:'wait',hours:1});return s;}

for(const authored of [false,true])test(`${authored?'authored':'ordinary'} campaign retains physical cartridges and exact time through real entry, return and save`,()=>{
 let s=hired(authored?defaultContentPackage():null),p=enter(s);const rounds=unitAmmunitionByType(p.battle.units.find(u=>u.id==='110')),start=p.campaign.hour*3600+(p.campaign.secondOfHour??0);
 p.battle.elapsedSeconds+=7;p=sync(p);assert.equal(p.campaign.hour*3600+p.campaign.secondOfHour,start+7);
 const before=structuredClone(p.campaign);assert.deepEqual(sync(p).campaign,before);p=save(p.campaign,p.battle);
 s=restoreCampaign(serializeCampaign(leave(p)));assert.deepEqual(Object.keys(s.resources),['treasury']);assert.equal(s.pendingBattle,null);
 p=enter(s);assert.deepEqual(unitAmmunitionByType(p.battle.units.find(u=>u.id==='110')),rounds);assert.ok(p.battle.units.some(u=>u.id==='110'));
});

test('authored rural wounds have one owner across checkpoints, compressed map saves and reentry',()=>{
 let s=hired(localPackage());s=order(s,{type:'travel',sector:A});let p=enter(s);const npc=localNPC(p.battle),id=npc.operativeId,maximum=npc.hp;
 applyCivilianHarm(p.battle,npc,{source:p.battle.units.find(u=>u.id==='110'),damage:20,intentional:true});assert.equal(hasPendingCivilians(p.campaign,p.battle),true);
 p=sync(p);assert.equal(p.campaign.operativeState[id].hp,maximum-20);assert.equal(p.campaign.civilianHarm,undefined);assert.equal(hasPendingCivilianHarm(p.campaign,p.battle),false);
 const before=structuredClone(p.campaign);assert.deepEqual(sync(p).campaign,before);p=save(p.campaign,p.battle);s=restoreCampaign(serializeCampaign(leave(p)));
 assert.equal(s.sectorStates[A].tiles.format,'cell-tiles-v1');p=enter(s);assert.equal(localNPC(p.battle).hp,maximum-20);assert.equal(localNPC(p.battle).bleeding,2);assert.equal(p.campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);
});

test('rural civilian death cannot be charged twice or resurrected by a returned scene',()=>{
 let s=order(hired(localPackage()),{type:'travel',sector:A}),p=enter(s);const npc=localNPC(p.battle),id=npc.operativeId;
 applyCivilianHarm(p.battle,npc,{source:p.battle.units.find(u=>u.id==='110'),damage:npc.hp,intentional:true});p=sync(p);assert.equal(p.campaign.operativeState[id].alive,false);
 const before=structuredClone(p.campaign);assert.deepEqual(sync(p).campaign,before);p=save(p.campaign,p.battle);s=save(leave(p)).campaign;assert.equal(s.operativeState[id].hp,0);assert.equal(s.civilianHarm,undefined);
 p=enter(s);const corpse=localNPC(p.battle);assert.equal(corpse.hp,0);assert.equal(p.campaign.cityLoyaltyEvents.filter(e=>e.kind.startsWith('civilian')).length,0);
 const forged=structuredClone(p);localNPC(forged.battle).hp=1;assert.throws(()=>save(forged.campaign,forged.battle));
});

test('artillery delivery notices retain actual custody and the configured equipment port',()=>{
 const d=defaultContentPackage();d.imports={port:'buenos_aires',minHours:1,maxHours:1};let s=initialCampaign(42,d);s.hour=20;s.routes.carts=true;s.sectors.buenos_aires.owner='royalist';
 s.artilleryTransfers=[{id:'notice-piece',from:'retiro',to:'buenos_aires',mode:'carts',path:['retiro','buenos_aires'],departedAt:0,dueAt:18,gun:{id:'notice-piece',type:'swivel',side:'player',loaded:false,ammo:2}}];
 s.equipmentShipments=[{item:equipmentCatalog(s).find(isImportedEquipment).item,quantity:1,due:1}];
 const events=collectLogisticsAttention(s,{isSupplied:()=>true}),piece=events.find(e=>e.kind==='artillery'),imported=events.find(e=>e.kind==='equipment');assert.equal(piece.code,'route_cut');assert.equal(imported.sector,'buenos_aires');assert.equal(imported.code,'occupied');recordLogisticsNotice(s,24,0,events);validateLogisticsNotice(s);assert.match(logisticsEventText(piece),/pieza/);
 assert.deepEqual(collectLogisticsAttention(s,{isSupplied:()=>true}),[]);assert.equal(s.artilleryTransfers.length,1);assert.equal(s.artilleryDepots?.buenos_aires,undefined);
});

test('both artillery sale action shapes use one stock and merchant cash balance',()=>{
 let s=hired();addEquipment(s,'swivel',1);const cash=s.resources.treasury,quote=artillerySaleQuote(s,{kind:'stock',model:'swivel',stockCount:1},true);assert.equal(quote.available,true,quote.reason);
 s=order(s,{type:'sellArtillery',kind:'stock',model:'swivel',stockCount:1});assert.equal(s.resources.treasury,cash+quote.price);assert.equal(s.armory.swivel,0);assert.equal(s.artilleryMerchants.retiro.guns.length,1);assert.equal(s.artilleryMerchants.retiro.cash,undefined);assert.ok(save(s));
});
