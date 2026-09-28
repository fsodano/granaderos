import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {cartridgePrice} from '../game/campaign-rules.js';
import {initialCampaign,dispatchCampaign,deploymentCost} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {ammunitionRefund,returnAmmunition} from '../game/ammunition.js';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';
const content=(price=3)=>{const d=defaultContentPackage();Object.assign(d.rules,{startingTreasury:9000,deploymentCartridges:7,cartridgePrice:price});Object.assign(d.characters.find(c=>c.id==='person-110'),{arrivalHours:0,weapon:'firearm-1808'});d.weapons.find(w=>w.template===1808).damage=1;return d;};
const hired=d=>order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'week'});

test('cartridge price is optional, strictly bounded and pinned without changing older package identities',()=>{
 const d=defaultContentPackage(),identity=contentIdentity(d);assert.equal(Object.hasOwn(d.rules,'cartridgePrice'),false);const old=initialCampaign(45,d);assert.equal(cartridgePrice(old),1);assert.deepEqual(old.contentCampaign.identity,identity);assert.deepEqual(old.contentCampaign.package,d);assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);
 const authored=content();assert.deepEqual(parseContentPackage(encodeContentPackage(authored)),authored);let s=hired(authored);assert.equal(cartridgePrice(s),3);authored.rules.cartridgePrice=9;assert.equal(cartridgePrice(saved({campaign:s}).campaign),3);const changed=structuredClone(s);changed.contentCampaign.package.rules.cartridgePrice=9;assert.throws(()=>saved({campaign:changed}),/identidad/);
 for(const value of [-1,1000001,.5,null,'3',NaN]){const invalid=content(value);assert.ok(validateContentPackage(invalid).length);assert.throws(()=>initialCampaign(45,invalid));}
});

test('actual entry and saved return use the same price while keeping issued rounds as a quantity',()=>{
 const s=hired(content()),money=s.resources.treasury;assert.equal(deploymentCost(s),21);const p=visit(s);assert.equal(p.campaign.resources.treasury,money-21);assert.equal(p.campaign.pendingBattle.issuedCartridges,7);assert.deepEqual([p.battle.units[0].loaded,p.battle.units[0].ammo],[2,5]);const done=saved({campaign:leave(p)}).campaign;assert.equal(done.resources.treasury,money);const again=dispatchCampaign(done,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units});assert.ok(again.lastError);assert.equal(again.resources.treasury,money);
});

test('an actual paid assault, discharge, saved checkpoint and retreat refund only the six unspent cartridges',()=>{
 let s=hired(content());const money=s.resources.treasury;s=order(s,{type:'attack',sector:'buenos_aires'});assert.equal(s.resources.treasury,money-21);assert.equal(s.pendingBattle.issuedCartridges,7);const r=s.pendingBattle;
 // Compact geometry isolates accounting; the deployment, shot and retreat are ordinary orders.
 let b=createBattle(r.squad.map(u=>({...u,x:1,y:1})),{...r,seed:45,width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{...r.enemies[0],id:'guard',x:5,y:1,overwatch:false,patrol:false}],npcs:(r.npcs??[]).map((n,i)=>({...n,x:8+i%3,y:4+Math.floor(i/3)}))});b=actBattle(b,{type:'fire',unitId:'110',targetId:'guard'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded+b.units[0].ammo,6);const p=saved(sync({campaign:s,battle:b}));
 const report={type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.resources.treasury,money-3);assert.equal(s.location,'retiro');assert.equal(s.pendingBattle,null);assert.ok(dispatchCampaign(s,report).lastError);assert.equal(cartridgePrice(s),3);
});

test('zero price and blade primaries do not charge money, and unaffordable entries or assaults reject atomically',()=>{
 for(const blade of [false,true]){const d=content(blade?3:0);if(blade)d.characters.find(c=>c.id==='person-110').weapon='blade-1812';const s=hired(d),money=s.resources.treasury;assert.equal(deploymentCost(s),0);const p=visit(s);assert.equal(p.campaign.resources.treasury,money);assert.equal(p.campaign.pendingBattle.issuedCartridges,blade?0:7);assert.equal(leave(p).resources.treasury,money);}
 const poor=hired(content(1000000)),before=structuredClone(poor);for(const a of [{type:'visitSector'},{type:'attack',sector:'buenos_aires'}]){const denied=dispatchCampaign(poor,a);assert.ok(denied.lastError);assert.equal(denied.resources.treasury,poor.resources.treasury);assert.equal(denied.hour,poor.hour);assert.equal(denied.pendingBattle,null);assert.deepEqual(denied.operativeState,poor.operativeState);}assert.deepEqual(poor,before);
});

test('finite recovered rounds keep their quantity limit and over-limit treasury credit is rejected',()=>{
 const request={issuedCartridges:10,squad:[{id:3,loaded:1,ammo:9}],enemies:[{id:'enemy-0',ammo:12}]},reports=[{id:3,hp:80,loaded:1,ammo:21}],snapshot={units:[{id:'3',side:'player',loaded:1,ammo:21},{id:'enemy-0',side:'enemy',hp:0,ammo:0}]},s=initialCampaign(45,content());assert.equal(returnAmmunition(request,reports,snapshot),22);assert.equal(ammunitionRefund(s,request,reports,snapshot),66);snapshot.units[1].ammo=7;assert.equal(ammunitionRefund(s,request,reports,snapshot),45);s.resources.treasury=1000000000-44;assert.throws(()=>ammunitionRefund(s,request,reports,snapshot),/tesorería/);assert.equal(s.resources.treasury,1000000000-44);
});
