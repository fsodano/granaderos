import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {ammoCount} from '../game/ammo-types.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {transferRouteAmmunition,transferRouteSupply} from './route-ammunition-transfer.mjs';

function ready(){let s=initialCampaign(1812,defaultContentPackage());for(const id of [110,123])s=order(s,{type:'recruitCivic',id,term:'week'});return leave(saved(visit(s)));}
const held=(s,id)=>sectorInventoryModel(s,'retiro',rosterFor(s),id).personal;

test('actual paid soldiers share finite reserve by ordinary drop/pickup with exact saved replay and chambers retained',()=>{
 const start=ready(),before=structuredClone(start),donor=held(start,110),recipient=held(start,123);
 const result=transferRouteAmmunition(start,{recipientId:123,donorIds:[110],family:'ammoMusket',count:3});assert.deepEqual(start,before);
 assert.equal(result.transferred,3);assert.equal(result.transactions.length,1);assert.equal(result.transactions[0].source.count,3);
 assert.equal(ammoCount(held(result.campaign,110),'ammoMusket'),ammoCount(donor,'ammoMusket')-3);
 assert.equal(ammoCount(held(result.campaign,123),'ammoMusket'),ammoCount(recipient,'ammoMusket')+3);
 assert.equal(held(result.campaign,110).loaded,donor.loaded);assert.equal(held(result.campaign,123).loaded,recipient.loaded);
 let replay=saved({campaign:before}).campaign;
 for(const action of result.transactions.flatMap(row=>row.actions))replay=saved({campaign:order(replay,action)}).campaign;
 assert.deepEqual(replay,result.campaign);assert.deepEqual(saved({campaign:result.campaign}).campaign,result.campaign);
 assert.equal(result.campaign.resources.treasury,before.resources.treasury);assert.deepEqual(result.campaign.contracts,before.contracts);
});

test('missing or insufficient carried reserve cannot grant ammunition or alter the input checkpoint',()=>{
 const start=ready(),before=structuredClone(start);
 for(const [donorIds,count]of [[[],1],[[110],100]])assert.throws(()=>transferRouteAmmunition(start,{recipientId:123,donorIds,family:'ammoMusket',count}),/Actual donor reserve/);
 assert.deepEqual(start,before);
});

test('actual paid soldiers share carried dressings through the same saved public custody controls',()=>{
 const start=ready(),before=structuredClone(start),donor=held(start,123),recipient=held(start,110);
 assert.ok(donor.medkits>0);
 const result=transferRouteSupply(start,{recipientId:110,donorIds:[123],item:'medkits',count:1});assert.deepEqual(start,before);
 assert.equal(held(result.campaign,123).medkits,donor.medkits-1);assert.equal(held(result.campaign,110).medkits,recipient.medkits+1);
 assert.equal(held(result.campaign,123).loaded,donor.loaded);assert.equal(held(result.campaign,110).loaded,recipient.loaded);
 let replay=saved({campaign:before}).campaign;for(const action of result.transactions.flatMap(row=>row.actions))replay=saved({campaign:order(replay,action)}).campaign;
 assert.deepEqual(replay,result.campaign);assert.deepEqual(saved({campaign:result.campaign}).campaign,result.campaign);
 assert.equal(result.campaign.resources.treasury,before.resources.treasury);assert.deepEqual(result.campaign.contracts,before.contracts);
});
