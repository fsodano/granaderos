import {wakeBatteryCrew} from './stationed-artillery-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {artilleryTransportQuote,artilleryTransferDelay,localArtilleryDepot,depotSelection} from '../game/artillery-transport.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {deployedArtillery,artillerySelectionReason} from '../game/equipment.js';
import {dispatchCampaign} from '../game/campaign.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {artilleryProfilesFor} from '../game/artillery-definitions.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {fieldGun} from './artillery-transport-fixture.mjs';
const send=s=>order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:s.sectorStates.san_nicolas.artillery[0].id,to:'buenos_aires',mode:'carts'});
const assertSame=(a,b)=>{for(const key of ['id','type','side','loaded','ammo','reloadProgress','facing'])assert.deepEqual(a[key],b[key],key);};

test('an actually issued and fired gun travels once, arrives in a local depot and redeploys without fresh ammunition',()=>{
 let s=fieldGun();const gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]),cash=s.resources.treasury,at=s.hour;const quote=artilleryTransportQuote(s,'san_nicolas',gun.id,'buenos_aires','carts');assert.equal(quote.available,true,quote.reason);assert.equal(quote.hours,18);assert.equal(quote.crew,1);
 s=send(s);assert.equal(s.resources.treasury,cash);assert.equal(s.hour,at);assert.deepEqual(s.sectorStates.san_nicolas.artillery,[]);assert.equal(s.artilleryTransfers.length,1);assertSame(s.artilleryTransfers[0].gun,gun);assert.equal(ownedArtilleryCount(s),1);assert.ok(dispatchCampaign(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'}).lastError);
 s=saved({campaign:s}).campaign;s=advanceCampaignHours(s,17);assert.equal(s.artilleryTransfers.length,1);s=advanceCampaignHours(s,1);assert.equal(s.artilleryTransfers.length,0);assertSame(s.artilleryDepots.buenos_aires[0],gun);assert.deepEqual(localArtilleryDepot(s),[]);assert.equal(ownedArtilleryCount(s),1);
 s=order(saved({campaign:s}).campaign,{type:'travel',sector:'buenos_aires'});const token=depotSelection(gun);assert.equal(localArtilleryDepot(s).length,1);assert.equal(artillerySelectionReason(s,[token]),null);s=order(s,{type:'configureArtillery',types:[token]});s=saved({campaign:s}).campaign;assertSame(deployedArtillery(s)[0],gun);s=order(s,{type:'attack',sector:'ensenada'});assert.deepEqual(s.artilleryDepots.buenos_aires,[]);assertSame(s.pendingBattle.artillery[0],gun);assert.equal(s.pendingBattle.artillery[0].fromDepot,undefined);assert.equal(s.armory.swivel,0);
 const p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})});assertSame(p.battle.artillery[0],gun);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,6);assert.equal(ownedArtilleryCount(p.campaign),1);
});

test('a prepared interruption keeps the exact shipment until control returns and delivery cannot replay',()=>{
 let s=send(fieldGun()),gun=structuredClone(s.artilleryTransfers[0].gun);s.sectors.buenos_aires.owner='royalist';s=advanceCampaignHours(s,18);assert.equal(s.artilleryTransfers.length,1);assert.equal(s.artilleryDepots?.buenos_aires,undefined);assert.match(artilleryTransferDelay(s,s.artilleryTransfers[0]),/ocupación/);assertSame(saved({campaign:s}).campaign.artilleryTransfers[0].gun,gun);
 s.sectors.buenos_aires.owner='patriot';s=advanceCampaignHours(s,1);assert.equal(s.artilleryTransfers.length,0);assertSame(s.artilleryDepots.buenos_aires[0],gun);s=advanceCampaignHours(saved({campaign:s}).campaign,2);assert.equal(s.artilleryDepots.buenos_aires.length,1);assert.equal(ownedArtilleryCount(s),1);
});

test('explicit empty, stale remote and duplicate depot selections cannot create or borrow a transported gun',()=>{
 let s=advanceCampaignHours(send(fieldGun()),18);const gun=s.artilleryDepots.buenos_aires[0],token=depotSelection(gun);assert.ok(artillerySelectionReason(s,[token]));s.artillerySelectionExplicit=true;s.artillerySelection=[token];assert.deepEqual(deployedArtillery(s),[]);s=saved({campaign:s}).campaign;s=order(s,{type:'travel',sector:'buenos_aires'});s=wakeBatteryCrew(s);assert.equal(deployedArtillery(s)[0].id,gun.id);assert.ok(artillerySelectionReason(s,[token,token]));s=order(s,{type:'configureArtillery',types:[]});assert.deepEqual(deployedArtillery(s),[]);assert.equal(s.artilleryDepots.buenos_aires.length,1);s=order(s,{type:'attack',sector:'ensenada'});assert.deepEqual(s.pendingBattle.artillery,[]);assert.equal(s.artilleryDepots.buenos_aires.length,1);assert.ok(saved({campaign:s,battle:enterSector(s.pendingBattle)}));
});

test('prepared crew, control, hostile, route and mode boundaries reject atomically',()=>{
 const base=fieldGun(),gun=base.sectorStates.san_nicolas.artillery[0];const mutations=[s=>s.routes.carts=false,s=>s.sectors.buenos_aires.owner='royalist',s=>s.location='retiro',s=>s.sectorStates.san_nicolas.artillery[0].side='enemy',s=>s.squad=[],s=>{for(const id of s.squad)s.operativeState[id].assignment='rest';},s=>{for(const id of s.squad)s.operativeState[id].hp=14;},s=>s.sectorStates.san_nicolas.units.push({id:'hostile',side:'enemy',hp:100,energy:100,x:0,y:0}),s=>s.defeated=true];
 for(const mutate of mutations){const s=structuredClone(base);mutate(s);const before=structuredClone(s),result=dispatchCampaign(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'});assert.ok(result.lastError);delete result.lastError;delete before.lastError;assert.deepEqual(result,before);}
 for(const [to,mode]of [['buenos_aires','march'],['buenos_aires','mules'],['san_nicolas','carts'],['cell-1-1','carts'],['buenos_aires','flotilla']])assert.equal(artilleryTransportQuote(base,'san_nicolas',gun.id,to,mode).available,false);
 const pending=visit(base);assert.equal(artilleryTransportQuote(pending.campaign,'san_nicolas',gun.id,'buenos_aires','carts').available,false);
});

test('a paid flotilla takes the coastal duration and a prepared blockade delays the same saved gun',()=>{
 let s=order(fieldGun(),{type:'transport',mode:'flotilla'}),gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]);assert.equal(artilleryTransportQuote(s,'san_nicolas',gun.id,'buenos_aires','flotilla').hours,5);s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'flotilla'});s.blockade=true;s=advanceCampaignHours(s,5);assert.equal(s.artilleryTransfers.length,1);assert.match(artilleryTransferDelay(s,s.artilleryTransfers[0]),/bloqueo/);s=saved({campaign:s}).campaign;s.blockade=false;s=advanceCampaignHours(s,1);assertSame(s.artilleryDepots.buenos_aires[0],gun);
});

test('full saves reject malformed routes and duplicate gun ownership across fields, transfers and depots',()=>{
 const s=send(fieldGun()),gun=s.artilleryTransfers[0].gun;
 for(const mutate of [s=>s.artilleryTransfers[0].dueAt--,s=>s.artilleryTransfers[0].path=['san_nicolas','retiro','buenos_aires'],s=>s.artilleryTransfers[0].mode='mules',s=>s.artilleryTransfers[0].gun.loaded=true,s=>s.artilleryTransfers[0].gun.x=1,s=>s.artilleryTransfers=null,s=>s.artilleryDepots=null,s=>s.artilleryDepots={unknown:[]},s=>s.artilleryDepots={retiro:[structuredClone(gun)]},s=>s.sectorStates.san_nicolas.artillery.push({...structuredClone(gun),x:1,y:1})]){
  const wire=JSON.parse(encodeSave(s));mutate(wire.campaign);if(wire.campaign.artilleryTransfers?.[0]?.gun.loaded===true)wire.campaign.artilleryTransfers[0].gun.reloadProgress=.5;assert.throws(()=>decodeSave(JSON.stringify(wire)),/artillería|pieza|recarga|sectores/);
 }
});


test('a declared unfinished-load boundary keeps exact work and facing through transport, save and redeployment',()=>{
 // Crew loading has separate actual-AP coverage; this prepared fraction isolates custody.
 let s=fieldGun();s.sectorStates.san_nicolas.artillery[0].reloadProgress=.4;const gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]);
 s=advanceCampaignHours(send(saved({campaign:s}).campaign),18);assertSame(s.artilleryDepots.buenos_aires[0],gun);s=order(saved({campaign:s}).campaign,{type:'travel',sector:'buenos_aires'});
 assert.equal(deployedArtillery(s)[0].reloadProgress,.4);s=order(s,{type:'attack',sector:'ensenada'});const p=saved({campaign:s,battle:enterSector(s.pendingBattle)});assertSame(p.battle.artillery[0],gun);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,6);
});

test('declared destination threats and full depots delay arrival, and occupied depots cannot supply a battery',()=>{
 const transit=send(fieldGun()),gun=structuredClone(transit.artilleryTransfers[0].gun);
 let s=structuredClone(transit);s.sectorStates.buenos_aires={units:[{id:'guard',side:'enemy',hp:100,energy:100}]};
 assert.match(artilleryTransferDelay(s,s.artilleryTransfers[0]),/despejado/);s=advanceCampaignHours(s,18);assert.equal(s.artilleryTransfers.length,1);assert.equal(s.artilleryDepots?.buenos_aires,undefined);
 s.sectorStates.buenos_aires.units[0].hp=0;s=advanceCampaignHours(s,1);assertSame(s.artilleryDepots.buenos_aires[0],gun);
 let full=structuredClone(transit);full.artilleryDepots={buenos_aires:Array.from({length:2000},(_,i)=>({...gun,id:`stored-${i}`}))};assert.match(artilleryTransferDelay(full,full.artilleryTransfers[0]),/lleno/);const source=fieldGun();source.artilleryDepots=structuredClone(full.artilleryDepots);assert.match(artilleryTransportQuote(source,'san_nicolas',gun.id,'buenos_aires','carts').reason,/no tiene lugar/);full=advanceCampaignHours(full,18);assert.equal(full.artilleryTransfers.length,1);assert.equal(full.artilleryDepots.buenos_aires.length,2000);full.artilleryDepots.buenos_aires.pop();full=advanceCampaignHours(full,1);assert.equal(full.artilleryTransfers.length,0);assert.equal(full.artilleryDepots.buenos_aires.length,2000);assertSame(full.artilleryDepots.buenos_aires.at(-1),gun);
 s.location='buenos_aires';s.sectors.buenos_aires.owner='royalist';assert.deepEqual(localArtilleryDepot(s),[]);assert.deepEqual(deployedArtillery(s),[]);assert.equal(ownedArtilleryCount(s),0);assertSame(s.artilleryDepots.buenos_aires[0],gun);
});


test('prepared route geography and authored crew sizes constrain dispatch without changing the gun',()=>{
 const s=fieldGun(),gun=s.sectorStates.san_nicolas.artillery[0];for(const place of CAMPAIGN_SECTORS)s.sectors[place.id].owner='patriot';s.routes.flotilla=true;
 const inland=artilleryTransportQuote(s,'san_nicolas',gun.id,'mendoza','carts');assert.equal(inland.available,true,inland.reason);assert.deepEqual(inland.path,['san_nicolas','cordoba','mendoza']);assert.equal(inland.hours,36);
 for(const [to,mode] of [['uspallata','carts'],['jujuy','carts'],['mendoza','flotilla']])assert.match(artilleryTransportQuote(s,'san_nicolas',gun.id,to,mode).reason,/No hay una ruta/);
 s.operativeState[s.squad[0]].assignment='rest';s.contentCampaign.package.artilleryProfiles=structuredClone(artilleryProfilesFor(s));s.contentCampaign.package.artilleryProfiles.swivel.crew=6;const quote=artilleryTransportQuote(s,'san_nicolas',gun.id,'buenos_aires','carts');assert.equal(quote.available,false);assert.match(quote.reason,/6 combatientes/);const result=dispatchCampaign(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'});assert.match(result.lastError,/6 combatientes/);assert.deepEqual(result.sectorStates.san_nicolas.artillery,[gun]);assert.equal(result.artilleryTransfers,undefined);
});


test('saved transit and depot pieces reject invalid facing before they can poison a later deployment',()=>{
 const transit=send(fieldGun()),arrived=advanceCampaignHours(transit,18);
 for(const state of [transit,arrived])for(const facing of ['north',null,7,-7]){
  const wire=JSON.parse(encodeSave(state)),gun=wire.campaign.artilleryTransfers[0]?.gun??wire.campaign.artilleryDepots.buenos_aires[0];gun.facing=facing;assert.throws(()=>decodeSave(JSON.stringify(wire)),/artillería/);
 }
 for(const state of [transit,arrived]){const wire=JSON.parse(encodeSave(state)),gun=wire.campaign.artilleryTransfers[0]?.gun??wire.campaign.artilleryDepots.buenos_aires[0];delete gun.facing;assert.ok(decodeSave(JSON.stringify(wire)));}
});
