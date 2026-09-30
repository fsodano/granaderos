import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {ARTILLERY} from '../game/artillery-definitions.js';
import {migrateEquipment,addEquipment,deployedArtillery} from '../game/equipment.js';
import {migrateArtilleryState,ownedArtilleryCount,validateCampaignArtillery,prepareSectorArtillery,supplyStationedArtillery} from '../game/campaign-artillery.js';
import {artilleryTransportQuote,artilleryTransportPreview,queueArtilleryTransport,dispatchArtilleryTransport,deliverArtilleryTransfers,validateArtilleryTransport} from '../game/artillery-transport.js';
import {artilleryMerchant,validateArtilleryMerchants,sellArtillery,repurchaseArtillery} from '../game/artillery-trading.js';
import {migrateMerchantWallets,merchantCash} from '../game/equipment-merchants.js';
import {merchantExchangeOffers,exchangeMerchantEquipment} from '../game/merchant-exchange.js';
import {storedEquipmentStack,validateEquipmentStorage} from '../game/stored-equipment.js';

const gun=(id='piece-1',type='swivel')=>({id,type,side:'player',loaded:false,ammo:2,reloadProgress:.4,facing:1.2});
function base(content={}){
 const s={version:1,artilleryVersion:1,nextArtilleryId:2,hour:0,location:'retiro',resources:{treasury:5000},armory:{},loadouts:{},flags:{},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(p=>[p.id,{owner:'patriot'}])),routes:{carts:true,flotilla:true},squad:[1,2,3],squads:[{id:'squad-1',members:[1,2,3],location:'retiro'}],operativeState:Object.fromEntries([1,2,3].map(id=>[id,{alive:true,hp:80,energy:100,assignment:'squad'}])),sectorStates:{retiro:{sectorId:'retiro',units:[],artillery:[{...gun(),x:4,y:5}]}},sceneStates:{},log:[],contentCampaign:{adapter:'character-weapons-v2',package:{weapons:[],...content}}};
 migrateEquipment(s);migrateArtilleryState(s);return s;
}
const checks=s=>{validateCampaignArtillery(s);validateArtilleryTransport(s);validateArtilleryMerchants(s);validateEquipmentStorage(s);};

test('configured transport and both interfaces preserve one cannon through delay, delivery and deployment',()=>{
 const profiles=structuredClone(ARTILLERY);profiles.swivel.crew=2;
 const s=base({artilleryProfiles:profiles,artilleryTransport:{enabled:true,cartsHours:7,flotillaHours:3,cartsFee:37,flotillaFee:51}}),before=structuredClone(gun());
 const a={sector:'retiro',gunId:before.id,destination:'buenos_aires',mode:'carts'},q=artilleryTransportPreview(s,a);
 assert.equal(q.valid,true,q.reason);assert.equal(q.hours,7);assert.equal(q.cost,37);assert.equal(q.crew,2);assert.equal(q.weight,504);
 const other=structuredClone(s);queueArtilleryTransport(s,a);dispatchArtilleryTransport(other,q.action);assert.deepEqual(s,other);assert.equal(s.resources.treasury,4963);assert.equal(ownedArtilleryCount(s),1);assert.deepEqual(s.artilleryTransfers[0].gun,before);assert.equal(s.convoys,undefined);checks(s);
 s.hour=7;s.sectors.buenos_aires.owner='royalist';assert.deepEqual(deliverArtilleryTransfers(s),[]);assert.equal(s.artilleryTransfers.length,1);
 s.sectors.buenos_aires.owner='patriot';s.sectorStates.buenos_aires={sectorId:'buenos_aires',units:[{side:'enemy',hp:50,energy:100}],artillery:[]};assert.deepEqual(deliverArtilleryTransfers(s),[]);
 s.sectorStates.buenos_aires.units[0].hp=0;assert.equal(deliverArtilleryTransfers(s).length,1);assert.deepEqual(deliverArtilleryTransfers(s),[]);assert.deepEqual(s.artilleryDepots.buenos_aires,[before]);checks(s);
 s.location='buenos_aires';s.squads[0].location=s.location;s.artillerySelectionExplicit=true;s.artillerySelection=[`depot:${before.id}`];
 const request={id:'next',sector:'ensenada',origin:s.location,artillery:deployedArtillery(s)};prepareSectorArtillery(s,request);s.pendingBattle=request;
 assert.equal(s.artilleryDepots.buenos_aires.length,0);assert.deepEqual(request.artillery,[before]);assert.equal(ownedArtilleryCount(s),1);checks(s);
});

test('transport rejects unavailable crew, excessive cargo and invalid destinations without changes',()=>{
 const s=base(),action={sector:'retiro',artilleryId:'piece-1',to:'buenos_aires',mode:'carts'};
 for(const mutate of [s=>s.squads[0].journey={status:'moving'},s=>s.squad.forEach(id=>s.operativeState[id].unconscious=true),s=>s.pendingEncounter={},s=>s.sectorStates.retiro.artillery[0].ammo=1000,s=>s.sectors.buenos_aires.owner='royalist',s=>s.routes.carts=false]){
  const bad=structuredClone(s);mutate(bad);const before=structuredClone(bad);assert.throws(()=>dispatchArtilleryTransport(bad,action));assert.deepEqual(bad,before);
 }
 for(const [to,mode]of [['retiro','carts'],['jujuy','carts'],['mendoza','flotilla'],['buenos_aires','mules'],['cell-1-1','carts']])assert.equal(artilleryTransportQuote(s,'retiro','piece-1',to,mode).available,false);
});

test('finite depot capacity delays the same gun and repeated delivery cannot duplicate it',()=>{
 const s=base();dispatchArtilleryTransport(s,{sector:'retiro',artilleryId:'piece-1',to:'buenos_aires',mode:'carts'});s.hour=18;
 s.artilleryDepots.buenos_aires=Array.from({length:2000},(_,i)=>gun(`stored-${i}`));assert.deepEqual(deliverArtilleryTransfers(s),[]);assert.equal(s.artilleryTransfers.length,1);
 s.artilleryDepots.buenos_aires.pop();deliverArtilleryTransfers(s);deliverArtilleryTransfers(s);assert.equal(s.artilleryDepots.buenos_aires.length,2000);assert.equal(s.artilleryDepots.buenos_aires.filter(g=>g.id==='piece-1').length,1);checks(s);
});

test('advanced saves retain physical deployed guns and migrate stores, traders and convoys once',()=>{
 const s=base();delete s.artilleryVersion;delete s.artilleryCustodyVersion;delete s.nextArtilleryId;delete s.artilleryDepots;delete s.artilleryTransfers;delete s.artilleryMerchants;
 s.resources.cannons=2;s.armory={field8:1,swivel:1};s.hour=10;
 s.artilleryStores={buenos_aires:[gun('received')]};s.merchants.retiro.usedArtillery=[gun('sold')];s.convoys=[{id:'old-transport',source:'retiro',destination:'buenos_aires',mode:'carts',goods:{cannons:1},due:18,artillery:[gun('travelling')]}];
 migrateArtilleryState(s);assert.equal(s.resources.cannons,undefined);assert.equal(s.armory.field8,1);assert.equal(s.armory.swivel,1);assert.deepEqual(s.sectorStates.retiro.artillery,[{...gun(),x:4,y:5}]);
 assert.equal(s.artilleryStores,undefined);assert.deepEqual(s.convoys,[]);assert.equal(s.merchants.retiro.usedArtillery,undefined);assert.deepEqual(s.artilleryMerchants.retiro.guns,[gun('sold')]);assert.deepEqual(s.artilleryTransfers[0].gun,gun('travelling'));assert.equal(ownedArtilleryCount(s),5);checks(s);
 const once=structuredClone(s);migrateArtilleryState(s);assert.deepEqual(s,once);
});

test('ambiguous legacy artillery owners reject conversion without modifying the save',()=>{
 const s=base();delete s.artilleryCustodyVersion;s.artilleryStores={retiro:[gun()]};const before=structuredClone(s);
 assert.throws(()=>migrateArtilleryState(s),/dos sectores/);assert.deepEqual(s,before);
});

test('published artillery cash migrates to one workshop drawer without granting new money',()=>{
 const s={artilleryMerchants:{retiro:{cash:73,guns:[gun('sold')]}}};migrateMerchantWallets(s);assert.equal(merchantCash(s,'retiro'),73);assert.deepEqual(s.artilleryMerchants.retiro,{guns:[gun('sold')]});assert.equal(s.merchants.retiro.cash,73);
 const once=structuredClone(s);migrateMerchantWallets(s);assert.deepEqual(s,once);
 const bad={merchants:{retiro:{cash:100}},artilleryMerchants:{retiro:{cash:73,guns:[]}}},before=structuredClone(bad);assert.throws(()=>migrateMerchantWallets(bad),/ambiguas/);assert.deepEqual(bad,before);
});

test('removing a current merchant cannot restore its cash or stock during admission',()=>{
 const s=base();s.merchants.retiro.cash=0;delete s.merchants.retiro;
 assert.throws(()=>migrateEquipment(s),/Faltan comerciantes/);assert.equal(s.merchants.retiro,undefined);
});

test('a mixed basket can exchange an authored firearm for a cannon with no temporary cash loan',()=>{
 const weapon={id:'pistola-canje',template:1805,name:'Pistola de canje',damage:20,fireAP:18,aimAP:0,reloadAP:50,range:12,capacity:1,weight:1.7,price:800,art:'/art/custom-pistol.png'};
 const s=base({weapons:[weapon]});addEquipment(s,weapon.id,1);const weaponRow=structuredClone(s.armoryItems[0]);
 s.artilleryMerchants.retiro={guns:[gun('sold-piece')]};s.resources.treasury=0;s.merchants.retiro.cash=0;
 const rows=merchantExchangeOffers(s,()=>true),sell=rows.find(r=>r.kind==='weapon'&&r.sell),buy=rows.find(r=>r.kind==='artillery'&&!r.sell);assert.equal(sell.price,320);assert.equal(buy.price,320);
 const plan=exchangeMerchantEquipment(s,{sector:'retiro',lines:[sell,buy].map(r=>({key:r.key,receipt:r.receipt,quantity:1}))},()=>true);
 assert.equal(plan.net,0);assert.equal(s.resources.treasury,0);assert.equal(merchantCash(s),0);assert.equal(s.armoryItems.length,0);assert.deepEqual(s.merchants.retiro.usedItems,[weaponRow]);assert.deepEqual(s.artilleryDepots.retiro,[gun('sold-piece')]);assert.deepEqual(s.artilleryMerchants.retiro.guns,[]);checks(s);
 assert.equal(storedEquipmentStack(s.merchants.retiro.usedItems[0]).contentWeapon.art,weapon.art);
});

test('direct artillery trading shares the basket drawer and preserves partial reload and facing',()=>{
 const s=base(),initial=s.resources.treasury+merchantCash(s);s.artilleryDepots.retiro=[gun('depot-piece')];
 sellArtillery(s,{kind:'depot',artilleryId:'depot-piece'},true);assert.deepEqual(artilleryMerchant(s).guns,[gun('depot-piece')]);assert.equal(s.resources.treasury+merchantCash(s),initial);
 repurchaseArtillery(s,'depot-piece',true);assert.deepEqual(s.artilleryDepots.retiro,[gun('depot-piece')]);assert.equal(s.resources.treasury+merchantCash(s),initial);checks(s);
});

test('batch artillery supply uses configured pesos and never consumes or creates old resources',()=>{
 const s=base({artillerySupply:{enabled:true,bronze4:12,field8:18,swivel:9,reserveLimit:5}}),cash=s.resources.treasury;
 const plan=supplyStationedArtillery(s,{sector:'retiro',gunId:'piece-1',count:3},()=>true);assert.equal(plan.cost,27);assert.equal(s.resources.treasury,cash-27);assert.equal(s.sectorStates.retiro.artillery[0].ammo,5);assert.equal(s.sectorStates.retiro.artillery[0].reloadProgress,.4);assert.deepEqual(Object.keys(s.resources),['treasury']);
 const before=structuredClone(s);assert.throws(()=>supplyStationedArtillery(s,{sector:'retiro',gunId:'piece-1',count:1},()=>true));assert.deepEqual(s,before);
});

test('a late failed deployment cannot remove any earlier selected piece',()=>{
 const s=base(),request={sector:'ensenada',origin:'retiro',artillery:[{...gun('reserve'),type:'bronze4'},{...gun('unavailable'),type:'field8'}]};s.armory.bronze4=1;
 const before=structuredClone(s),original=structuredClone(request);assert.throws(()=>prepareSectorArtillery(s,request));assert.deepEqual(s,before);assert.deepEqual(request,original);
});

test('an exchange rejects exhausted identity sequences before committing any sale',()=>{
 const s=base();s.armory.swivel=2;s.nextArtilleryId=999999999;
 const row=merchantExchangeOffers(s,()=>true).find(r=>r.key==='sell:artillery:stock:swivel'),before=structuredClone(s);
 assert.throws(()=>exchangeMerchantEquipment(s,{sector:'retiro',lines:[{key:row.key,receipt:row.receipt,quantity:2}]},()=>true),/registro/);assert.deepEqual(s,before);
});
