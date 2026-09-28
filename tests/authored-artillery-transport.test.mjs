import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {DEFAULT_ARTILLERY_TRANSPORT,ARTILLERY_TRANSPORT_FIELDS,artilleryTransportRules} from '../game/artillery-transport-rules.js';
import {artilleryTransportQuote} from '../game/artillery-transport.js';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
const content=(extra={})=>({...defaultContentPackage(),artilleryTransport:{...DEFAULT_ARTILLERY_TRANSPORT,...extra}});
const send=(s,mode='carts')=>({type:'transportArtillery',sector:'san_nicolas',artilleryId:s.sectorStates.san_nicolas.artillery[0].id,to:'buenos_aires',mode});
const quote=(s,mode='carts')=>artilleryTransportQuote(s,'san_nicolas',s.sectorStates.san_nicolas.artillery[0].id,'buenos_aires',mode);

test('optional transport rules preserve old package identity and reject partial, extra and invalid rate fields',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);assert.equal(d.artilleryTransport,undefined);assert.deepEqual(artilleryTransportRules(s),DEFAULT_ARTILLERY_TRANSPORT);assert.deepEqual(saved({campaign:s}).campaign.contentCampaign.identity,s.contentCampaign.identity);
 const valid=content({enabled:false,cartsHours:168,flotillaHours:1,cartsFee:1000000,flotillaFee:0});assert.deepEqual(parseContentPackage(encodeContentPackage(valid)),valid);assert.deepEqual(campaignContentReport(valid).blocked,[]);
 const invalid=[null,[],{}, {...valid.artilleryTransport,extra:1},{...valid.artilleryTransport,enabled:0}];for(const [key,,min,max]of ARTILLERY_TRANSPORT_FIELDS)for(const value of [min-1,max+1,1.5,'3',NaN,null])invalid.push({...valid.artilleryTransport,[key]:value});
 for(const artilleryTransport of invalid){const bad={...valid,artilleryTransport};assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(42,bad));}
});

test('actual paid and fired guns use pinned cart and flotilla rates and pay one dispatch fee only',()=>{
 for(const [mode,duration,fee]of [['carts',3,37],['flotilla',2,19]]){
  const d=content({cartsHours:3,flotillaHours:2,cartsFee:37,flotillaFee:19});let s=fieldGun(d);if(mode==='flotilla')s=order(s,{type:'transport',mode});const original=structuredClone(s.sectorStates.san_nicolas.artillery[0]),cash=s.resources.treasury,at=s.hour;
  assert.equal(quote(s,mode).hours,duration);assert.equal(quote(s,mode).cost,fee);s=order(s,send(s,mode));assert.equal(s.resources.treasury,cash-fee);assert.equal(s.hour,at);assert.equal(s.artilleryTransfers[0].dueAt,at+duration);d.artilleryTransport[`${mode}Hours`]=99;d.artilleryTransport[`${mode}Fee`]=999;
  s=saved({campaign:s}).campaign;assert.equal(artilleryTransportRules(s)[`${mode}Hours`],duration);s=order(s,{type:'wait',hours:duration-1});assert.equal(s.artilleryTransfers.length,1);s=order(s,{type:'wait',hours:1});assert.equal(s.artilleryTransfers.length,0);assert.equal(s.resources.treasury,cash-fee);const gun=s.artilleryDepots.buenos_aires[0];for(const key of ['id','type','loaded','ammo','facing'])assert.deepEqual(gun[key],original[key],key);
 }
});

test('disabled transport, insufficient funds and repeated orders reject without moving a gun or charging twice',()=>{
 const disabled=fieldGun(content({enabled:false,cartsFee:37})),denied=dispatchCampaign(disabled,send(disabled));assert.match(denied.lastError,/no permite/);assert.deepEqual(denied.sectorStates,disabled.sectorStates);assert.deepEqual(denied.resources,disabled.resources);
 const s=fieldGun(content({cartsFee:37}));s.resources.treasury=36;assert.match(quote(s).reason,/pesos/);const poor=dispatchCampaign(s,send(s));assert.deepEqual(poor.resources,s.resources);assert.deepEqual(poor.sectorStates,s.sectorStates);assert.equal(poor.artilleryTransfers,undefined);
 s.resources.treasury=37;const action=send(s),sent=order(s,action);assert.equal(sent.resources.treasury,0);const repeat=dispatchCampaign(sent,action);assert.ok(repeat.lastError);assert.equal(repeat.resources.treasury,0);assert.deepEqual(repeat.artilleryTransfers,sent.artilleryTransfers);
});

test('a delayed paid shipment retains its authored schedule across full saves without another charge',()=>{
 let s=fieldGun(content({cartsHours:3,cartsFee:37}));const money=s.resources.treasury;s=order(s,send(s));const at=s.hour;s.sectors.buenos_aires.owner='royalist';s=order(s,{type:'wait',hours:3});assert.equal(s.artilleryTransfers.length,1);assert.equal(s.artilleryTransfers[0].dueAt,at+3);s=saved({campaign:s}).campaign;
 const wire=JSON.parse(encodeSave(s));wire.campaign.artilleryTransfers[0].dueAt=at+18;assert.throws(()=>decodeSave(JSON.stringify(wire)),/ruta.*artillería/);
 s.sectors.buenos_aires.owner='patriot';s=order(s,{type:'wait',hours:1});assert.equal(s.artilleryTransfers.length,0);assert.equal(s.artilleryDepots.buenos_aires.length,1);assert.equal(s.resources.treasury,money-37);
});
