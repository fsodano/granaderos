import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,isSupplied,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {grenadeOffer,grenadeStock,GRENADE_PRICE,GRENADE_STOCK_CAP,advanceMerchants} from '../game/equipment.js';
import {makeGrenadeStack,isGrenadeStack} from '../game/grenades.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const rosterOp=(s,id=110)=>rosterFor(s).find(o=>o.id===id);
const personal=(s,id=110)=>sectorInventoryModel(s,s.location,rosterFor(s),id).personal;
const actor=(b,id=110)=>b.units.find(u=>u.id===String(id));
const count=u=>Object.values(u.inventory??{}).filter(isGrenadeStack).reduce((n,v)=>n+v.count,0)+(isGrenadeStack(u.equipmentCursor?.stack)?u.equipmentCursor.stack.count:0);
const buy=(s,quantity=1,id=110)=>order(s,grenadeOffer(s,rosterOp(s,id),isSupplied,quantity).action);
const reject=(s,a)=>{const original=structuredClone(s),next=dispatchCampaign(s,a);assert.ok(next.lastError);assert.deepEqual(s,original);assert.deepEqual({...next,lastError:null},{...s,lastError:null});return next;};
function hire(s,id=110){const cash=s.resources.treasury;s=order(s,{type:'recruitCivic',id,term:'week'});assert.ok(s.resources.treasury<cash);assert.equal(count(s.operativeState[id]),0);return s;}
function cuyRoute(){
 let s=initialCampaign(8);
 // The phase and liberated corridor are this focused late-campaign fixture.
 // Hiring, travel, money, stock, inventory and all later custody are real orders.
 s.phase=3;for(const id of ['buenos_aires','cordoba','mendoza'])s.sectors[id].owner='patriot';
 s=hire(s);assert.equal(grenadeOffer(s,rosterOp(s),isSupplied).available,false);
 s=order(s,{type:'travel',sector:'mendoza'});assert.equal(s.location,'mendoza');assert.ok(s.hour>0);assert.equal(isSupplied(s,'mendoza'),true);return s;
}
function cursorAction(u,type,options={}){return {type,unitId:u.id,expectedSource:equipmentFingerprint(u,type==='pickupEquipment'?options.sourceId:'cursor'),...(options.destinationId?{expectedDestination:equipmentFingerprint(u,options.destinationId)}:{}),...options};}
function arrange(s,type,options={},id=110){const u=personal(s,id);return order(s,{...cursorAction(u,type,options),type:'sectorInventory',sector:s.location,operativeId:id,direction:'arrange',kind:'cursor',cursorAction:type});}
function visit(s){
 s=order(s,{type:'visitSector'});const request=s.pendingBattle;
 const b=createBattle(request.squad.map((u,i)=>({...u,x:2+i,y:2})),{...request,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],props:[],npcs:[]});
 return {s,b};
}
function leave(s,b){const synced=syncBattleTime(s,b);assert.equal(synced.error,null);return order(synced.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});}

test('the only grenade source is a finite paid Mendoza arsenal lot unlocked during Cuyo',()=>{
 const start=initialCampaign();assert.equal(start.grenadeSupplyVersion,1);assert.deepEqual(start.recruited,[]);assert.ok(Object.values(start.operativeState).every(u=>count(u)===0&&u.grenades===undefined));
 assert.deepEqual(Object.fromEntries(Object.entries(start.merchants).map(([id,m])=>[id,m.grenades.arsenal])),{retiro:0,cordoba:0,mendoza:6,ensenada:0});
 let s=cuyRoute();const before=structuredClone(s),offer=grenadeOffer(s,rosterOp(s),isSupplied,2);assert.equal(offer.available,true);assert.equal(offer.price,GRENADE_PRICE);assert.equal(offer.stock,GRENADE_STOCK_CAP);assert.match(offer.note,/no se reponen/);
 s=order(s,offer.action);assert.equal(s.resources.treasury,before.resources.treasury-160);assert.equal(s.merchants.mendoza.cash,before.merchants.mendoza.cash+160);assert.equal(grenadeStock(s),4);assert.equal(count(s.operativeState[110]),2);
 assert.deepEqual(s.operativeState[110].inventory['grenade:arsenal'],makeGrenadeStack('arsenal',2));
 for(const key of ['hour','secondOfHour','seed','contracts'])assert.deepEqual(s[key],before[key],key);assert.equal(s.resources.grenades,undefined);assert.deepEqual(save(s),s);
 s=buy(save(s),4);assert.equal(count(s.operativeState[110]),6);assert.equal(grenadeStock(s),0);
 assert.match(reject(s,grenadeOffer(s,rosterOp(s),isSupplied).action).lastError,/no tiene suficientes/);
 for(let hour=0;hour<240;hour++)advanceMerchants(s,isSupplied);assert.equal(grenadeStock(s),0);assert.equal(count(s.operativeState[110]),6);assert.deepEqual(save(s),s);
});

test('campaign purchase gates reject early, absent, unavailable, unsafe, over-capacity and underfunded buyers without spending or issuing',()=>{
 const ready=cuyRoute(),action=grenadeOffer(ready,rosterOp(ready),isSupplied,2).action;
 for(const change of [
  s=>s.phase=2,s=>s.location='retiro',s=>s.sectors.mendoza.owner='royalist',s=>s.sectors.cordoba.owner='royalist',
  s=>s.squads[0].location='retiro',s=>s.operativeState[110].alive=false,s=>s.operativeState[110].captured=true,
  s=>s.operativeState[110].hp=14,s=>s.operativeState[110].asleep=true,s=>s.operativeState[110].energy=0,s=>s.operativeState[110].unconscious=true,
  s=>s.resources.treasury=159,s=>s.operativeState[110].inventory=Object.fromEntries(Array.from({length:12},(_,i)=>[`ballast-${i}`,{name:`Cajón ${i}`,count:1,weight:4}]))
 ]){const s=structuredClone(ready);change(s);assert.equal(grenadeOffer(s,rosterOp(s),isSupplied,2).available,false);reject(s,action);}
 for(const patch of [{operativeId:999},{quantity:0},{quantity:-1},{quantity:1.5},{quantity:7},{grenadeType:'modern'}])reject(ready,{...action,...patch});
 const pending=order(ready,{type:'visitSector'});reject(pending,action);
});

test('legacy saves receive the one lot once while canonical missing, malformed and mixed stock is rejected',()=>{
 let s=cuyRoute();const old=structuredClone(s);delete old.grenadeSupplyVersion;for(const merchant of Object.values(old.merchants))delete merchant.grenades;
 s=restoreCampaign(serializeCampaign(old));assert.equal(s.grenadeSupplyVersion,1);assert.equal(grenadeStock(s),6);s=buy(s,6);assert.equal(grenadeStock(s),0);
 assert.deepEqual(save(save(s)),s);assert.equal(grenadeStock(save(s)),0);
 for(const mutate of [bad=>delete bad.merchants.mendoza.grenades,bad=>bad.merchants.mendoza.grenades=null,bad=>bad.merchants.mendoza.grenades={arsenal:7},bad=>bad.merchants.mendoza.grenades={arsenal:-1},bad=>bad.merchants.mendoza.grenades={arsenal:0,modern:0},bad=>bad.merchants.retiro.grenades.arsenal=1,bad=>bad.grenadeSupplyVersion=2,bad=>delete bad.grenadeSupplyVersion]){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));
 }
 const mixed=structuredClone(s);delete mixed.grenadeSupplyVersion;for(const merchant of Object.values(mixed.merchants))delete merchant.grenades;assert.throws(()=>restoreCampaign(serializeCampaign(mixed)),/mezcla/);
});

test('purchased grenades retain exact cursor, ground and recipient custody across saves, reports and reentry without respawning',()=>{
 let s=hire(buy(cuyRoute(),3),111);assert.equal(grenadeStock(s),3);
 // Provenance is assigned to this existing paid lot, never another object.
 Object.assign(s.operativeState[110].inventory['grenade:arsenal'],{name:'Remesa de Cuyo',condition:81,proof:{lot:4,arsenal:'Mendoza'}});
 const sourceId=inventoryUsage(personal(s)).slots.find(p=>p.entry?.item==='inventory:grenade:arsenal').id;
 s=arrange(s,'pickupEquipment',{sourceId,count:2});assert.equal(s.operativeState[110].equipmentCursor.stack.count,2);s=save(s);
 let b;({s,b}=visit(s));assert.equal(actor(b).equipmentCursor.stack.name,'Remesa de Cuyo');assert.equal(count(actor(b)),3);
 ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));
 b=act(b,{type:'drop',unitId:'110',item:'cursor',count:1});assert.equal(actor(b).equipmentCursor.stack.count,1);
 b=act(b,{type:'transfer',unitId:'110',targetId:'111',item:'cursor',count:1});assert.equal(actor(b).equipmentCursor,undefined);assert.equal(count(actor(b,111)),1);
 const ground=b.groundItems.find(isGrenadeStack);assert.equal(ground.count,1);assert.equal(ground.condition,81);assert.deepEqual(ground.proof,{lot:4,arsenal:'Mendoza'});
 s=leave(s,b);assert.equal(count(s.operativeState[110]),1);assert.equal(count(s.operativeState[111]),1);assert.equal(grenadeStock(s),3);s=save(s);
 const recipient=Object.values(s.operativeState[111].inventory).find(isGrenadeStack);assert.equal(recipient.name,'Remesa de Cuyo');assert.equal(recipient.condition,81);assert.deepEqual(recipient.proof,ground.proof);
 const row=sectorInventoryModel(s,'mendoza',rosterFor(s),111).entries.find(e=>JSON.parse(e.expected).kind==='grenade');assert.ok(row?.reachable);
 s=order(s,{type:'sectorInventory',sector:'mendoza',operativeId:111,direction:'take',sourceKey:row.key,expected:row.expected,count:1});assert.equal(count(s.operativeState[111]),2);
 s=order(save(s),{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.mendoza);assert.equal(count(actor(b)),1);assert.equal(count(actor(b,111)),2);assert.equal(b.groundItems.filter(isGrenadeStack).reduce((n,g)=>n+g.count,0),0);
 s=leave(s,b);s=hire(s,112);assert.equal(grenadeStock(s),3);assert.equal(count(s.operativeState[112]),0);assert.equal(s.recruited.reduce((n,id)=>n+count(s.operativeState[id]),0)+grenadeStock(s),6);assert.deepEqual(save(s),s);
});

test('malformed grenade records cannot enter campaign or live tactical saves',()=>{
 const s=buy(cuyRoute(),2),pair=visit(s);
 for(const patch of [{weight:.1},{grenadeType:'modern'},{condition:null},{ammoType:'musket_75'},{weapon:1800},{fittings:{}},{blastRadius:99}]){
  const bad=structuredClone(s);Object.assign(bad.operativeState[110].inventory['grenade:arsenal'],patch);assert.throws(()=>save(bad));
  const battle=structuredClone(pair.b);Object.assign(actor(battle).inventory['grenade:arsenal'],patch);assert.throws(()=>decodeSave(encodeSave(pair.s,battle)));
 }
});
