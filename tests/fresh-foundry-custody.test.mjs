import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {foundryFor} from '../game/campaign-foundry.js';
import {completeFreshArmyFunding} from './fresh-cuyo-route.mjs';

const metadata=JSON.parse(readFileSync(new URL('./fixtures/stock-foundry-earned-custody.provenance.json',import.meta.url)));
const fixture=(name,sha)=>{
 const raw=gunzipSync(readFileSync(new URL(`./fixtures/${name}`,import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
 return raw.toString();
};

test('earned stock funding secures its exact rear gun before the native occupation, then pays for the course and project with saved order replay',()=>{
 // This is the actual post-Mendoza care checkpoint. No casualty, ownership,
 // gun, supply or treasury value is changed to set up this regression.
 const start=decodeSave(fixture('stock-foundry-earned-pre-course.save.json.gz',metadata.inputSha256)).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[482,2550]);assert.equal(start.location,'mendoza');assert.equal(start.flags.armyFunded,false);assert.equal(ownedArtilleryCount(start),3);
 const rear=start.sectorStates.tucuman.artillery.find(gun=>gun.id==='arsenal:cordoba:1');
 assert.equal(start.sectors.tucuman.owner,'patriot');assert.equal(rear.loaded,false);assert.equal(rear.ammo,0);
 const original=[...start.artilleryDepots.mendoza.map(storedArtilleryRecord),storedArtilleryRecord(rear)].sort((a,b)=>a.id.localeCompare(b.id));
 const result=completeFreshArmyFunding(start,{report:event=>events.push({...event,campaign:undefined})});
 assert.deepEqual(start,before);assert.equal(result.flags.armyFunded,true);assert.equal(ownedArtilleryCount(result),3);
 assert.deepEqual([result.hour,result.secondOfHour],[572,2550]);assert.equal(result.resources.treasury,138128);
 assert.equal(result.sectors.tucuman.owner,'royalist','the genuine rear occupation remains part of the campaign');
 assert.deepEqual(result.artilleryDepots.mendoza.map(storedArtilleryRecord).sort((a,b)=>a.id.localeCompare(b.id)),original,'transport retains all three identities and every remaining shot');
 assert.equal(result.artilleryTransfers.length,0);assert.equal(result.sectorStates.tucuman.artillery.some(gun=>gun.id===rear.id),false);
 assert.deepEqual(result.artilleryArsenalRecoveries,start.artilleryArsenalRecoveries,'the foundry does not discover another arsenal');
 const shipment=events.filter(event=>event.event==='routeBatteryShipment');assert.equal(shipment.length,1);
 assert.deepEqual(shipment[0],{event:'routeBatteryShipment',id:rear.id,from:'tucuman',to:'mendoza',cost:0,dueAt:526,record:storedArtilleryRecord(rear),hour:490,campaign:undefined});
 const course=events.find(event=>event.action?.type==='militia'),secured=events.find(event=>event.event==='routeBatteryPrepared');
 assert.equal(secured.hour,526);assert.ok(course.hour>secured.hour,'all three real guns arrive before the course advances the clock');
 assert.equal(result.sectors.cordoba.owner,'patriot');assert.deepEqual(result.sectors.cordoba.militia,[3,0,0]);
 const funding=events.find(event=>event.action?.type==='fundArmy');assert.equal(events.filter(event=>event.action?.type==='fundArmy').length,1);
 assert.equal(funding.treasury,result.resources.treasury);
 assert.deepEqual(result.loadouts,start.loadouts);
 for(const [id,record]of Object.entries(start.operativeState)){
  for(const key of ['hp','maxHp','alive','captured','bleeding','ammo','medkits','condition','inventory','weaponInstanceId','weaponDropped','outfit','headwear','legwear'])assert.deepEqual(result.operativeState[id][key],record[key],`${id} retains ${key}`);
  assert.equal(result.operativeState[id].carriedLoaded??0,record.carriedLoaded??0);
 }
 // Every recorded transaction is replayed through the ordinary campaign API.
 // The midpoint round trip verifies queued gun custody as well as final state.
 const tape=JSON.parse(fixture('stock-foundry-native-funding-actions.json.gz',metadata.actionsSha256));assert.equal(tape.actions.length,124);
 let replay=decodeSave(encodeSave(start)).campaign;
 for(let i=0;i<tape.actions.length;i++){
  assert.ok(!['buy','purchase','battleResult'].includes(tape.actions[i].type));
  const cash=replay.resources.treasury;
  replay=dispatchCampaign(replay,tape.actions[i]);assert.equal(replay.lastError,null,JSON.stringify(tape.actions[i]));
  if(tape.actions[i].type==='fundArmy')assert.equal(replay.resources.treasury,cash-foundryFor(replay).fundingCost,'the native project pays its exact cost once');
  if(tape.actions[i].type==='militia')assert.equal(replay.resources.treasury,cash-60,'the actual rear course consumes its native fee');
  if(i===Math.floor(tape.actions.length/2))replay=decodeSave(encodeSave(replay)).campaign;
 }
 assert.deepEqual(replay,result);assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
});

test('the witnessed occupied-source checkpoint still rejects a fabricated replacement battery',()=>{
 const start=decodeSave(fixture('stock-foundry-native-occupied-source.save.json.gz',metadata.occupiedInputSha256)).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[528,2550]);assert.equal(start.sectors.tucuman.owner,'royalist');assert.equal(ownedArtilleryCount(start),2);
 assert.ok(start.sectorStates.tucuman.artillery.some(gun=>gun.id==='arsenal:cordoba:1'));
 assert.throws(()=>completeFreshArmyFunding(start,{report:event=>events.push({...event,campaign:undefined})}),/No remaining controlled physical arsenal can supply bronze4/);
 assert.deepEqual(start,before);assert.equal(start.flags.armyFunded,false);assert.equal(ownedArtilleryCount(start),2);
 assert.deepEqual(events.at(-1).selected,['arsenal:buenos_aires:1','arsenal:cordoba:2']);
});
