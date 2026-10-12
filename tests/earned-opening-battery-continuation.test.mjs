import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {depotSelection} from '../game/artillery-depots.js';
import {artilleryTransportRules} from '../game/artillery-transport-rules.js';
import {prepareSaltaAssault} from './salta-route.mjs';
import provenance from './fixtures/opening-port-recovered-before-salta.provenance.json' with {type:'json'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('default earned opening retains the Cordoba road and delivers the canonical recovered swivel to Tucuman',t=>{
 const bytes=readFileSync(new URL('./fixtures/'+provenance.fixture,import.meta.url)),raw=gunzipSync(bytes);
 assert.equal(sha(bytes),provenance.gzipSha256);assert.equal(sha(raw),provenance.rawSha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),stop=Symbol('Actual canonical battery delivered'),events=[];
 let delivered,reserve,relief,relieved,cordoba,tucuman,selections;
 assert.throws(()=>prepareSaltaAssault(start,{report:event=>events.push(event),onCheckpoint:(name,c,detail)=>{
  if(process.env.GRANADEROS_OPENING_ROAD_CHECKPOINT_DIR)writeFileSync(join(process.env.GRANADEROS_OPENING_ROAD_CHECKPOINT_DIR,name+'.save.json'),encodeSave(c)+'\n');
  if(name==='support-battery-road-reserve')reserve=structuredClone(detail.reserve);
  if(name==='support-battery-victory'){
   if(detail.defense.sector==='tucuman')tucuman=structuredClone(detail.defense);
   if(detail.defense.sector==='cordoba')cordoba=structuredClone(detail.defense);
  }
  if(name==='support-battery-road-relief'){relief=structuredClone(detail.receipts);relieved=structuredClone(c);}
  if(name==='salta-battery-delivered'){delivered=structuredClone(c);selections=structuredClone(detail.selections);throw stop;}
 }}),error=>error===stop);
 assert.deepEqual(start,before);assert.ok(delivered&&reserve&&relief&&relieved&&cordoba&&tucuman);
 assert.equal(reserve.needed,true);assert.equal(reserve.hires.reduce((sum,h)=>sum+h.quote.total,0),63960);
 assert.equal(tucuman.status,'victory');assert.equal(cordoba.status,'victory');assert.equal(delivered.sectors.cordoba.owner,'patriot');
 assert.equal(delivered.enemyGroups.find(g=>g.id===cordoba.groupId).status,'defeated');
 assert.equal(relief.length,1);assert.equal(relief[0].patientId,142);assert.equal(relief[0].doctor,135);assert.equal(relief[0].hours,2);
 assert.deepEqual(relief[0].aid.steps,[{type:'useItem',unitId:'135',targetId:'142'}]);
 assert.equal(delivered.operativeState[142].alive,true);assert.equal(delivered.operativeState[142].captured,false);assert.equal(delivered.operativeState[142].bleeding,0);
 assert.equal(relieved.operativeState[142].weaponDropped,true);
 const dropped=relieved.sectorStates.cordoba.droppedWeapons.find(row=>row.unitId==='142');assert.ok(dropped);
 assert.equal(dropped.weapon,1802);assert.equal(dropped.loaded,1);
 assert.deepEqual(delivered.sectorStates.cordoba.droppedWeapons.find(row=>row.unitId==='142'),dropped,'The actual dropped loaded gun stays in its original custody after service ends.');
 assert.equal(delivered.recruited.includes(142),false);assert.equal(delivered.loadouts[142].weapon,0);assert.equal(delivered.operativeState[142].carriedLoaded,0);
 for(const id of [131,128,106,9])assert.equal(delivered.operativeState[id].alive,false);
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(delivered.operativeState[id].alive,false);assert.equal(delivered.operativeState[id].deathMinute,r.deathMinute);}
 const gun=delivered.artilleryDepots.tucuman.find(g=>g.id==='arsenal:ensenada:2');assert.ok(gun);
 assert.deepEqual(selections,[depotSelection(gun)]);
 assert.deepEqual(storedArtilleryRecord(gun),{id:'arsenal:ensenada:2',type:'swivel',side:'player',loaded:true,ammo:6});
 assert.ok(!delivered.sectorStates.ensenada.artillery.some(g=>g.id===gun.id));
 assert.ok(!delivered.artilleryTransfers.some(transfer=>transfer.gun.id===gun.id));
 const shipment=events.find(e=>e.event==='routeBatteryShipment'&&e.id===gun.id);assert.ok(shipment);
 assert.equal(shipment.from,'ensenada');assert.equal(shipment.to,'tucuman');assert.equal(shipment.cost,artilleryTransportRules(start).cartsFee);
 assert.ok(delivered.hour>=shipment.dueAt);assert.equal(events.some(e=>e.event==='finiteSupportProfile'),false);
 assert.equal(delivered.pendingBattle,null);assert.equal(delivered.pendingEncounter,null);assert.equal(delivered.defeated,false);
 assert.deepEqual(decodeSave(encodeSave(delivered)).campaign,delivered);
 t.diagnostic(JSON.stringify({scope:'Default earned original supply-battery continuation through native rear defenses, actual escaped-person relief and canonical finite swivel shipment; Salta and Yatasto remain separate.',clock:[delivered.hour,delivered.secondOfHour],treasury:delivered.resources.treasury,tucuman:{turns:tucuman.turns,actions:tucuman.actions},cordoba:{turns:cordoba.turns,actions:cordoba.actions},shipment,selections}));
});
