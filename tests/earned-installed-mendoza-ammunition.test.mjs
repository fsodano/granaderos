import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {incomeSummary} from '../game/economy.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {prepareStockMendozaAmmunition} from './created-cuyo-route.mjs';

test('the actual installed Mendoza force fetches its measured finite deficit from a controlled known source that can supply it',t=>{
 const stem='earned-installed-mendoza-before-ammunition',fixture=suffix=>readFileSync(new URL(`./fixtures/${stem}.${suffix}`,import.meta.url)),meta=JSON.parse(fixture('provenance.json')),compressed=fixture('save.json.gz'),raw=gunzipSync(compressed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(raw),meta.sha256);assert.equal(sha(compressed),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),field=meta.field,events=[];
 const carried=(c,id)=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);
 const known=(c,sector,type)=>sectorInventorySites(c,sector).flatMap(site=>sectorInventoryModel(c,site.id,rosterFor(c),field[0]).entries).filter(row=>JSON.parse(row.expected).ammoType===type).reduce((sum,row)=>sum+row.count,0);
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);assert.equal(field.length,29);
 const buenosAires=known(start,'buenos_aires','musket_75'),tucuman=known(start,'tucuman','musket_75'),retiro=known(start,'retiro','musket_75');
 assert.equal(tucuman,70);assert.equal(buenosAires,78);assert.equal(retiro,108);
 const result=prepareStockMendozaAmmunition(start,field,{report:event=>events.push(structuredClone(event))});
 const plan=events.find(event=>event.event==='stockCuyoAmmoPlan');assert.equal(plan.target,12);assert.equal(plan.deficit.ammoMusket,75);assert.ok(plan.deficit.ammoMusket>tucuman);
 const source=events.find(event=>event.event==='stockCuyoAmmoSource');assert.equal(source.sector,'buenos_aires');assert.deepEqual(source.path,['cordoba','buenos_aires']);assert.equal(source.hours,4);
 const trips=events.filter(event=>event.event==='stockCuyoCourierTravel');assert.deepEqual(trips.map(trip=>[trip.id,trip.destination]),[[9,'buenos_aires'],[9,'cordoba']]);
 const picked=events.filter(event=>event.event==='stockCuyoAmmoPickup'&&event.sector==='buenos_aires');assert.equal(picked.reduce((sum,event)=>sum+event.quantity,0),75);
 for(const event of picked){assert.ok(event.before>=event.quantity);assert.equal(event.after,event.before-event.quantity);assert.equal(event.sourceFamilyAfter,event.sourceFamilyBefore-event.quantity);assert.equal(JSON.parse(event.expected).ammoType,'musket_75');}
 assert.equal(known(result,'buenos_aires','musket_75'),buenosAires-75);assert.equal(known(result,'tucuman','musket_75'),tucuman);assert.equal(known(result,'retiro','musket_75'),retiro);
 const recovered=events.filter(event=>event.event==='finitePrimaryRecovered');assert.deepEqual(recovered.map(event=>[event.operativeId,event.weapon]),[[114,1801],[120,1801]]);
 for(const id of field){
  const u=carried(result,id),old=carried(start,id);assert.ok(u.loaded+ammoCount(u,ammoTypeFor(u))>=12);assert.equal(result.operativeState[id].alive,true);assert.equal(result.operativeState[id].location,'cordoba');
  if(![114,120].includes(id))for(const key of ['weapon','weaponMetadata','weaponInstanceId','weaponFittings','weaponFittingPattern','condition','ammunitionChoice'])assert.deepEqual(u[key],old[key],`The actual serving hand retains ${id} ${key}.`);
  for(const key of ['hp','maxHp','bleeding','medkits','headwear','outfit','legwear'])assert.deepEqual(result.operativeState[id][key],start.operativeState[id][key]);
 }
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(result.operativeState[id].alive,false);
 const artillery=c=>({depots:c.artilleryDepots,transfers:c.artilleryTransfers,field:Object.fromEntries(Object.entries(c.sectorStates).map(([id,scene])=>[id,(scene.artillery??[]).map(storedArtilleryRecord)]))});assert.deepEqual(artillery(result),artillery(start));
 const renewals=events.filter(event=>event.event==='stockCuyoRenewal').reduce((sum,event)=>sum+event.price,0),midnights=Math.floor(result.hour/24)-Math.floor(start.hour/24),legs=2;
 assert.equal(renewals,0);assert.equal(result.resources.treasury,start.resources.treasury+midnights*incomeSummary(start).daily-legs*10);
 assert.deepEqual([result.hour,result.secondOfHour],[649,1392]);assert.equal(result.pendingEncounter,null);assert.equal(result.pendingBattle,null);
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
 t.diagnostic(JSON.stringify({scope:meta.scope,field:field.length,deficit:75,source:source.sector,courier:9,travelHours:8,roundsAtSource:3,target:12,treasury:result.resources.treasury,clock:[result.hour,result.secondOfHour],priorDeathsPreserved:true,officialSaveRoundTrip:true}));
});
