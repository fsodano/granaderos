import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {deployedArtillery,unissuedArtilleryStock} from '../game/equipment.js';
import {artillerySaleOffers,artilleryTradePreview} from '../game/artillery-trade.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {enterSector} from '../game/world.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const stockOffer=(s,type)=>artillerySaleOffers(s,isSupplied).find(p=>p.action.stockType===type);
test('each declared finite cannon type deploys once and closed commerce cannot materialize another load',()=>{
 for(const type of ['bronze4','field8','swivel']){
  let s=withStoredGear(initialCampaign(),type);s=order(s,{type:'configureArtillery',types:[type]});const initial=deployedArtillery(s)[0],count=ownedArtilleryCount(s),a=stockOffer(s,type).action;
  assertTradeRejected(s,a);assertTradeRejected(s,{type:'purchaseUsedArtillery',sector:'retiro',gunId:initial.id});assert.equal(ownedArtilleryCount(s),count);assert.equal(s.armory[type],1);
  s=save(s);s.sectors.buenos_aires.owner='royalist';s=order(s,{type:'attack',sector:'buenos_aires'});assert.equal(s.armory[type],0);assert.equal(s.pendingBattle.artillery.length,1);assert.equal(s.pendingBattle.artillery[0].type,type);assert.equal(s.pendingBattle.artillery[0].ammo,initial.ammo);assert.equal(s.pendingBattle.artillery[0].loaded,initial.loaded);
 }
});
test('unissued models and local physical guns cannot consume a remote depot',()=>{
 let s=initialCampaign();s.armory.field8=1;s.armory.swivel=1;
 const local={id:'local-bronze',type:'bronze4',side:'player',loaded:false,ammo:2},remote={...local,id:'remote-bronze',ammo:4};
 s.artilleryDepots={retiro:[local],cordoba:[remote]};
 assert.deepEqual(unissuedArtilleryStock(s),{camp:{field8:1,swivel:1,bronze4:0},depot:{field8:0,swivel:0,bronze4:0}});
 assert.equal(stockOffer(s,'bronze4'),undefined);
 const offer=artillerySaleOffers(s,isSupplied).find(p=>p.action.gunId===local.id);assert.ok(offer);
 assert.ok(!artillerySaleOffers(s,isSupplied).some(p=>p.action.gunId===remote.id));
 assertTradeRejected(s,offer.action);s=save(s);assert.equal(s.armory.field8,1);assert.equal(s.armory.swivel,1);assert.deepEqual(s.artilleryDepots.retiro,[local]);assert.deepEqual(s.artilleryDepots.cordoba,[remote]);
});

function emplaced(){
 let s=withStoredGear(initialCampaign(45),'field8');
 // Controlled occupation and settlement isolate recovered gun custody, not balance.
 s.sectors.san_nicolas.owner='patriot';s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'cordoba'});
 const report=scriptedBattleReport(s);Object.assign(report.sectorState.artillery[0],{loaded:false,ammo:1,reloadProgress:.6});
 return save(order(s,report));
}
test('closed sale callbacks retain an actual emplaced gun and its exact remaining finite supplies',()=>{
 const s=emplaced(),gun=structuredClone(s.sectorStates.cordoba.artillery[0]),p=artillerySaleOffers(s,isSupplied).find(p=>p.action.sourceKind==='deployed');assert.equal(p.valid,true);
 assertTradeRejected(s,p.action);assertTradeRejected(s,{type:'purchaseUsedArtillery',sector:'cordoba',gunId:gun.id});assert.deepEqual(save(s).sectorStates.cordoba.artillery,[gun]);
});
test('missing crew, hostile ownership, wrong source, changed counts and empty stock reject sale atomically',()=>{
 const s=emplaced(),gun=s.sectorStates.cordoba.artillery[0],a={type:'sellArtillery',sourceKind:'deployed',sector:'cordoba',gunId:gun.id};
 for(const mutate of [s=>s.operativeState[s.squad[0]].hp=10,s=>s.sectorStates.cordoba.artillery[0].side='enemy']){const n=structuredClone(s);mutate(n);const rejected=dispatchCampaign(n,a);assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},n);}
 let stock=withStoredGear(initialCampaign(),'bronze4');const action=stockOffer(stock,'bronze4').action;
 for(const patch of [{expectedCount:0},{expectedCount:undefined},{sourceKind:'unknown'},{sector:'cordoba'}])assert.ok(dispatchCampaign(stock,{...action,...patch}).lastError);
 const empty=initialCampaign();empty.artilleryDepots={retiro:[{id:'stored',type:'swivel',side:'player',loaded:true,ammo:6}]};
 assert.equal(artilleryTradePreview(empty,{sector:'retiro',sourceKind:'stock',stockType:'swivel',expectedCount:0,gunId:'stored'},isSupplied).valid,false);
});
test('ordinary stock deployment avoids an existing gun identity and retains its serial sequence through saves',()=>{
 let s=withStoredGear(initialCampaign(),'swivel');const reserved=`piece-${s.nextArtilleryId++}`;s.artilleryDepots={retiro:[{id:reserved,type:'bronze4',side:'player',loaded:false,ammo:0}]};
 const a=stockOffer(s,'swivel').action;assertTradeRejected(s,a);s=order(s,{type:'configureArtillery',types:['swivel']});s.sectors.buenos_aires.owner='royalist';s=order(save(s),{type:'attack',sector:'buenos_aires'});
 const deployed=s.pendingBattle.artillery[0];assert.notEqual(deployed.id,reserved);assert.equal(s.artilleryDepots.retiro[0].id,reserved);assert.equal(s.nextArtilleryId,Number(deployed.id.split('-').at(-1))+1);assert.equal(decodeSave(encodeSave(s,enterSector(s.pendingBattle))).campaign.pendingBattle.artillery[0].id,deployed.id);
});
