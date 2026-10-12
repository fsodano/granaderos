import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {incomeSummary} from '../game/economy.js';
import {queueSquadTravel} from '../game/squad-travel.js';
import {prepareStockMendozaAmmunition} from './created-cuyo-route.mjs';

test('an earned installed returning hire with an explicitly empty hand recovers one real local firearm before finite Cuyo allocation',()=>{
 const compressed=readFileSync(new URL('./fixtures/earned-installed-cuyo-empty-primary.save.json.gz',import.meta.url));
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/earned-installed-cuyo-empty-primary.provenance.json',import.meta.url)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),raw=gunzipSync(compressed);
 assert.equal(sha(compressed),provenance.gzipSha256);assert.equal(sha(raw),provenance.sha256);assert.equal(raw.length,provenance.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 const carried=(state,id)=>carriedAmmunition(rosterFor(state).find(op=>op.id===id),state.operativeState[id]);
 const model=state=>sectorInventoryModel(state,'cordoba',rosterFor(state),120);
 assert.deepEqual([start.hour,start.secondOfHour],[1029,544]);assert.equal(start.loadouts[120].weapon,0);assert.equal(start.operativeState[120].weaponDropped,false);assert.equal(start.operativeState[120].activeSlot,'unarmed');
 assert.equal(weaponSpecification(carried(start,120)),null);
 const source=model(start).entries.find(row=>row.reachable&&JSON.parse(row.expected).weapon===1801&&JSON.parse(row.expected).condition===100);assert.ok(source);assert.equal(source.count,1);
 const originalHands=new Map(provenance.field.filter(id=>id!==120).map(id=>{const u=carried(start,id);return [id,Object.fromEntries(['weapon','weaponMetadata','weaponInstanceId','condition','weaponFittings','weaponFittingPattern'].filter(key=>u[key]!==undefined).map(key=>[key,structuredClone(u[key])]))];}));
 const result=prepareStockMendozaAmmunition(start,provenance.field,{report:event=>events.push(structuredClone(event))});
 assert.deepEqual(start,before);assert.equal(result.loadouts[120].weapon,1801);assert.equal(result.operativeState[120].condition,100);
 assert.equal(model(result).entries.filter(row=>row.expected===source.expected).reduce((sum,row)=>sum+row.count,0),0,'the recovered gun leaves its original finite source');
 assert.deepEqual(events.filter(event=>event.event==='finitePrimaryRecovered'),[{event:'finitePrimaryRecovered',operativeId:120,sector:'cordoba',weapon:1801,instanceId:undefined}]);
 assert.deepEqual(events.filter(event=>event.event==='stockCuyoRecoveredGun').map(event=>event.id),[120]);
 for(const id of provenance.field){const u=carried(result,id);assert.ok(u.loaded+ammoCount(u,ammoTypeFor(u))>=12);assert.ok(result.operativeState[id].alive);for(const [key,value]of Object.entries(originalHands.get(id)??{}))assert.deepEqual(u[key],value,`the actual other primary keeps ${id} ${key}`);}
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(result.operativeState[id].alive,false);
 const renewals=events.filter(event=>event.event==='stockCuyoRenewal').reduce((sum,event)=>sum+event.price,0),trips=events.filter(event=>event.event==='stockCuyoCourierTravel'),booking=trips.reduce((sum,event)=>sum+event.cost,0),days=Math.floor(result.hour/24)-Math.floor(start.hour/24);
 let origin='cordoba',legs=0;
 for(const trip of trips){const draft={...start.squads.find(squad=>squad.id===start.activeSquadId),members:[trip.id],location:origin};delete draft.journey;legs+=queueSquadTravel(start,draft,{sector:trip.destination,mode:'posta'}).path.length-1;origin=trip.destination;}
 assert.equal(legs,2);assert.equal(booking,0);
 assert.equal(result.resources.treasury,start.resources.treasury+days*incomeSummary(start).daily-renewals-booking-legs*10,'queued posta charges its actual traversed legs');
 assert.equal(result.pendingBattle,null);assert.equal(result.pendingEncounter,null);assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
});
