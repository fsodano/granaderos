import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {deployedArtillery,unissuedArtilleryStock} from '../game/equipment.js';
import {artillerySaleOffers,artilleryTradePreview} from '../game/artillery-trade.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const stockOffer=(s,type)=>artillerySaleOffers(s,isSupplied).find(p=>p.action.stockType===type);
test('each purchased cannon type can be sold once, repurchased and deployed without adding a second load',()=>{
 for(const type of ['bronze4','field8','swivel']){
  let s=order(initialCampaign(),{type:'purchaseEquipment',item:type});
  s=order(s,{type:'configureArtillery',types:[type]});const initial=deployedArtillery(s)[0],count=ownedArtilleryCount(s),resources=structuredClone(s.resources),a=stockOffer(s,type).action;
  s=save(order(s,a));assert.equal(ownedArtilleryCount(s),count-1);assert.equal(s.resources.cannons,resources.cannons-1);assert.equal(s.armory[type],0);assert.equal(stockOffer(s,type),undefined);
  const gun=s.merchants.retiro.usedArtillery[0];assert.deepEqual({...gun,id:initial.id},initial);
  const stale=dispatchCampaign(s,a);assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},s);
  s=save(order(s,{type:'purchaseUsedArtillery',sector:'retiro',gunId:gun.id}));assert.equal(ownedArtilleryCount(s),count);assert.equal(s.resources.cannons,resources.cannons-1);
  assert.deepEqual(deployedArtillery(s),[{...gun,recovered:true}]);
 }
});
test('generic and local depot bronze stock cannot consume special guns or a remote depot',()=>{
 let s=initialCampaign();s.resources.cannons=2;s.armory.field8=1;s.armory.swivel=1;s.depots.retiro={cannons:1};s.depots.cordoba={cannons:4};
 assert.deepEqual(unissuedArtilleryStock(s),{camp:{field8:1,swivel:1,bronze4:0},depot:{field8:0,swivel:0,bronze4:1}});
 s=save(order(s,stockOffer(s,'bronze4').action));assert.equal(s.resources.cannons,2);assert.equal(s.armory.field8,1);assert.equal(s.armory.swivel,1);assert.equal(s.depots.retiro.cannons,0);assert.equal(s.depots.cordoba.cannons,4);
 assert.equal(stockOffer(s,'bronze4'),undefined);
 const generic=initialCampaign();generic.resources.cannons=1;const sold=order(generic,stockOffer(generic,'bronze4').action);assert.equal(sold.resources.cannons,0);assert.equal(sold.merchants.retiro.usedArtillery[0].type,'bronze4');
});
function emplaced(){
 let s=order(initialCampaign(45),{type:'purchaseEquipment',item:'field8'});
 // Controlled occupation and settlement isolate recovered gun custody, not balance.
 s.sectors.san_nicolas.owner='patriot';s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'cordoba'});
 const report=scriptedBattleReport(s);Object.assign(report.sectorState.artillery[0],{loaded:false,ammo:1,reloadProgress:.6});
 return save(order(s,report));
}
test('a secured workshop buys an actual emplaced gun and retains its exact remaining shot supplies',()=>{
 let s=emplaced();const gun=structuredClone(s.sectorStates.cordoba.artillery[0]);const p=artillerySaleOffers(s,isSupplied).find(p=>p.action.sourceKind==='deployed');assert.equal(p.valid,true);
 s=save(order(s,p.action));assert.equal(s.sectorStates.cordoba.artillery.length,0);assert.deepEqual(s.merchants.cordoba.usedArtillery,[{id:gun.id,type:gun.type,side:'player',loaded:false,ammo:1,reloadProgress:.6}]);
 s=save(order(s,{type:'purchaseUsedArtillery',sector:'cordoba',gunId:gun.id}));assert.equal(s.artilleryStores.cordoba[0].ammo,1);assert.equal(s.artilleryStores.cordoba[0].reloadProgress,.6);
});
test('missing crew, hostile ownership, wrong source, changed counts and empty stock reject sale atomically',()=>{
 const s=emplaced(),gun=s.sectorStates.cordoba.artillery[0],a={type:'sellArtillery',sourceKind:'deployed',sector:'cordoba',gunId:gun.id};
 for(const mutate of [s=>s.operativeState[s.squad[0]].hp=10,s=>s.sectorStates.cordoba.artillery[0].side='enemy']){const n=structuredClone(s);mutate(n);const rejected=dispatchCampaign(n,a);assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},n);}
 let stock=order(initialCampaign(),{type:'purchaseEquipment',item:'bronze4'});const action=stockOffer(stock,'bronze4').action;
 for(const patch of [{expectedCount:0},{expectedCount:undefined},{sourceKind:'unknown'},{sector:'cordoba'}])assert.ok(dispatchCampaign(stock,{...action,...patch}).lastError);
 const empty=initialCampaign();empty.artilleryStores={retiro:[{id:'stored',type:'swivel',side:'player',loaded:true,ammo:6}]};
 assert.equal(artilleryTradePreview(empty,{sector:'retiro',sourceKind:'stock',stockType:'swivel',expectedCount:0,gunId:'stored'},isSupplied).valid,false);
});
test('materialized stock avoids an existing gun identity and keeps its sequence through saves',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:'swivel'});
 const reserved=`merchant-artillery-${s.nextArmoryItemId}`;s.artilleryStores={retiro:[{id:reserved,type:'bronze4',side:'player',loaded:false,ammo:0}]};
 s=save(order(s,stockOffer(s,'swivel').action));const sold=s.merchants.retiro.usedArtillery[0];assert.notEqual(sold.id,reserved);assert.equal(s.artilleryStores.retiro[0].id,reserved);
 assert.equal(s.nextArmoryItemId,Number(sold.id.split('-').at(-1))+1);
});
