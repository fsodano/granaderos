import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {artilleryTransportPath,artilleryTransportQuote,artilleryTransferDelay,deliverArtilleryTransfers} from '../game/artillery-transport.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';

// The issued and fired fixture provides real finite cargo. These declared
// control/occupation boundaries isolate transit through patriotic Buenos Aires.
const routeState=()=>{const s=fieldGun();s.sectors.ensenada.owner='patriot';return s;};
const action=s=>({type:'transportArtillery',sector:'san_nicolas',artilleryId:s.sectorStates.san_nicolas.artillery[0].id,to:'ensenada',mode:'carts'});
const quote=s=>artilleryTransportQuote(s,'san_nicolas',action(s).artilleryId,'ensenada','carts');
const occupy=s=>{
 const g=launchEnemyGroup(s,'coast','buenos_aires',{immediate:true});assert.ok(g);
 g.status='stationed';g.resolvedAt=s.hour;return g;
};

test('a known occupation of a patriotic intermediate town rejects the quote and dispatch without moving or charging the gun',()=>{
 const s=routeState(),open=quote(s);assert.equal(open.available,true,open.reason);assert.deepEqual(open.path,['san_nicolas','buenos_aires','ensenada']);assert.equal(open.hours,36);
 occupy(s);assert.equal(s.sectors.buenos_aires.owner,'patriot');const before=structuredClone(s),blocked=quote(s);
 assert.equal(blocked.available,false);assert.equal(blocked.path,null);assert.match(blocked.reason,/No hay una ruta/);
 const result=dispatchCampaign(s,action(s));assert.equal(result.lastError,blocked.reason);delete result.lastError;delete before.lastError;assert.deepEqual(result,before);
 assert.deepEqual(artilleryTransportPath(s,'ensenada','san_nicolas','carts'),null,'the reported play route is blocked in the other direction too');
 assert.deepEqual(artilleryTransportPath(s,'ensenada','san_nicolas','flotilla'),null);
 assert.deepEqual(artilleryTransportPath(s,'ensenada','san_nicolas','carts',{ignoreControl:true}),['ensenada','buenos_aires','san_nicolas'],'legacy migration reads geometry, not current occupation');
});

test('a clear alternative route remains available around known intermediate occupation',()=>{
 const s=routeState();for(const at of ['santa_fe','cordoba','tucuman'])s.sectors[at].owner='patriot';
 const g=occupy(s);g.target='santa_fe';g.route=['santa_fe'];
 assert.deepEqual(artilleryTransportPath(s,'san_nicolas','tucuman','carts'),['san_nicolas','cordoba','tucuman']);
});

test('a current scouting report blocks a waiting intermediate force without disclosing its private unit details',()=>{
 const s=routeState(),open=quote(s),g=launchEnemyGroup(s,'coast','buenos_aires',{immediate:true});assert.ok(g);
 assert.deepEqual(quote(s),open,'a remote waiting group without scouts is not route-preview evidence');
 s.sectors.buenos_aires.militia=[1,0,0];const blocked=quote(s);assert.equal(blocked.available,false);
 g.units[0].name='PRIVATE UNIT NAME';g.units[0].weapon=1802;g.units[0].ammo=999;
 assert.deepEqual(quote(s),blocked);assert.doesNotMatch(JSON.stringify(blocked),/PRIVATE UNIT NAME|999/);
});

test('hidden survivors and an unobserved marching target cannot change a transport quote or reveal a pre-arrival delay',()=>{
 const s=routeState(),open=quote(s),transit=order(s,action(s)),transfer=transit.artilleryTransfers[0];
 const hidden={id:'unseen-road-guard',side:'enemy',hp:100,energy:100,knownToPlayer:false};
 s.sectorStates.buenos_aires={units:[hidden]};transit.sectorStates.buenos_aires=structuredClone(s.sectorStates.buenos_aires);
 assert.deepEqual(quote(s),open);assert.equal(artilleryTransferDelay(transit,transfer),'');
 const g=launchEnemyGroup(s,'coast','buenos_aires');assert.ok(g);g.units[0].hp=15;g.arrivalAt+=5;
 assert.deepEqual(quote(s),open,'future targets, counts and timing are not preview evidence');
 hidden.hp=0;assert.deepEqual(quote(s),open);hidden.hp=100;hidden.knownToPlayer=true;
 assert.deepEqual(quote(s),open,'inventory discovery is not a living-enemy scouting report');
 hidden.routed=true;assert.deepEqual(quote(s),open);
});

test('an intermediate occupation after dispatch keeps exact saved cargo overdue, then delivers once after clearance',()=>{
 let s=routeState();s=order(s,action(s));const transfer=structuredClone(s.artilleryTransfers[0]),cash=s.resources.treasury;
 occupy(s);s=advanceCampaignHours(s,36);assert.equal(s.hour,transfer.dueAt);assert.equal(s.logisticsNotice.events.find(event=>event.kind==='artillery'&&event.id===transfer.id).code,'route_cut');
 assert.deepEqual(s.artilleryTransfers,[transfer]);assert.equal(s.artilleryDepots?.ensenada,undefined);assert.equal(s.resources.treasury,cash);assert.equal(ownedArtilleryCount(s),1);
 s=saved({campaign:s}).campaign;assert.deepEqual(s.artilleryTransfers,[transfer]);s=advanceCampaignHours(s,1);assert.equal(s.logisticsNotice,null);assert.deepEqual(s.artilleryTransfers,[transfer]);
 const g=s.enemyGroups.find(g=>g.target==='buenos_aires'&&g.status==='stationed');assert.ok(g);g.status='defeated';g.resolvedAt=s.hour;
 s=advanceCampaignHours(s,1);assert.deepEqual(s.artilleryTransfers,[]);assert.deepEqual(s.artilleryDepots.ensenada,[transfer.gun]);assert.equal(s.resources.treasury,cash);
 s=advanceCampaignHours(saved({campaign:s}).campaign,2);assert.deepEqual(s.artilleryDepots.ensenada,[transfer.gun]);assert.equal(ownedArtilleryCount(s),1);
});

test('an unseen capable intermediate survivor blocks the actual delivery without changing or duplicating its cargo',()=>{
 let s=routeState();s=order(s,action(s));const transfer=structuredClone(s.artilleryTransfers[0]);
 const hidden={id:'unseen-road-guard',side:'enemy',hp:100,energy:100,knownToPlayer:false};s.sectorStates.buenos_aires={units:[hidden]};
 assert.equal(artilleryTransferDelay(s,transfer),'');s.hour=transfer.dueAt;
 assert.match(artilleryTransferDelay(s,transfer),/ocupación/);assert.deepEqual(deliverArtilleryTransfers(s),[]);assert.deepEqual(s.artilleryTransfers,[transfer]);assert.equal(s.artilleryDepots?.ensenada,undefined);
 hidden.hp=0;assert.equal(deliverArtilleryTransfers(s).length,1);assert.deepEqual(s.artilleryDepots.ensenada,[transfer.gun]);assert.deepEqual(deliverArtilleryTransfers(s),[]);assert.deepEqual(s.artilleryDepots.ensenada,[transfer.gun]);
});
