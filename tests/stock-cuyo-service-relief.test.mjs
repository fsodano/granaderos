import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {relieveStockCuyoService} from './stock-cuyo-service-relief.mjs';

test('earned stock Córdoba replaces the actual renewal refusal with paid relief and exact finite returned equipment through a midpoint save',t=>{
 const compressed=readFileSync(new URL('./fixtures/stock-cuyo-native-edge-service-ready.save.json.gz',import.meta.url)),metadata=JSON.parse(readFileSync(new URL('./fixtures/stock-cuyo-native-edge-service-ready.provenance.json',import.meta.url))),sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(compressed),metadata.gzipSha256);const raw=gunzipSync(compressed);assert.equal(sha(raw),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),field=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured&&start.operativeState[id].location==='cordoba'),originalField=[...field],events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[463,1435]);assert.equal(start.resources.treasury,121674);assert.equal(field.length,14);assert.equal(start.operativeState[130].morale,0);assert.equal(start.contracts[130].expiresAt,474);assert.equal(contractRenewalQuote(start,rosterFor(start).find(op=>op.id===130),'day').available,false);
 const quote=contractQuote(start,rosterFor(start).find(op=>op.id===138),'week');assert.equal(quote.available,true);assert.equal(quote.total,46200);
 const result=relieveStockCuyoService(start,field,{report:event=>events.push(structuredClone(event))}),done=result.campaign,receipt=result.receipts[0];assert.equal(result.receipts.length,1);assert.equal(receipt.dismissed,130);assert.equal(receipt.replacement,138);assert.equal(receipt.returned.length,9);assert.equal(receipt.total,quote.total);assert.equal(receipt.price,quote.price);assert.equal(receipt.guarantee,quote.guarantee);assert.equal(receipt.arrivalHours,6);assert.equal(receipt.arrival-receipt.booked,6*3600);
 assert.deepEqual([done.hour,done.secondOfHour],[469,1435]);assert.equal(done.resources.treasury,start.resources.treasury-quote.total);assert.equal(done.operativeState[130].alive,true);assert.equal(done.operativeState[130].hp,start.operativeState[130].hp);assert.equal(done.operativeState[130].morale,0);assert.equal(done.operativeState[130].location,'cordoba');assert.ok(!done.recruited.includes(130));assert.equal(done.contracts[130],undefined);assert.ok(done.recruited.includes(138));assert.equal(done.contracts[138].kind,'paid');assert.equal(done.contracts[138].term,'week');assert.equal(done.contracts[138].started,469);assert.equal(done.contracts[138].startedSecond,1435);assert.equal(done.contracts[138].expiresAt,637);assert.equal(done.contracts[138].expiresSecond,1435);assert.equal(done.contracts[138].paid,quote.price);
 assert.equal(result.field.length,field.length);assert.equal(result.field[field.indexOf(130)],138);for(const id of field.filter(id=>id!==130)){assert.ok(result.field.includes(id));assert.ok(done.recruited.includes(id));assert.equal(done.operativeState[id].alive,true);}
 assert.equal(receipt.gun.weapon,1800);assert.equal(receipt.gun.loaded,1);assert.equal(receipt.family,'musket_75');assert.equal(receipt.ammoCount,11);assert.equal(availableAmmunition(done.operativeState[138],receipt.family),11);const model=sectorInventoryModel(done,'cordoba',rosterFor(done),138),gun=handRecord(model.personal,'primary');for(const [key,value]of Object.entries(receipt.gun))if(!['item','count'].includes(key))assert.deepEqual(gun[key],value);
 for(const returned of receipt.returned){const remaining=model.entries.find(row=>row.key===returned.key);if([receipt.gunSource,receipt.ammoSource].includes(returned.key))assert.equal(remaining,undefined);else assert.deepEqual(JSON.parse(remaining.expected),returned.stack,'Unused returned property stays in its exact original local custody.');}
 let replay=structuredClone(start),dismissal=null;
 for(let index=0;index<result.orders.length;index++){
  const previous=structuredClone(replay),action=result.orders[index];replay=dispatchCampaign(replay,action);assert.equal(replay.lastError,null);
  if(action.type==='dismiss'){dismissal=structuredClone(replay);assert.deepEqual({hour:replay.hour,second:replay.secondOfHour,treasury:replay.resources.treasury},{hour:previous.hour,second:previous.secondOfHour,treasury:previous.resources.treasury});for(const [key,value]of Object.entries(receipt.condition))assert.deepEqual(replay.operativeState[130][key],value);const returned=sectorInventoryModel(replay,'cordoba',rosterFor(replay),field.find(id=>id!==130)).entries;for(const item of receipt.returned)assert.deepEqual(JSON.parse(returned.find(row=>row.key===item.key).expected),item.stack);}
  if(index===Math.floor(result.orders.length/2))replay=decodeSave(encodeSave(replay)).campaign;
 }
 assert.ok(dismissal);assert.deepEqual(decodeSave(encodeSave(replay)).campaign,done);assert.deepEqual(start,before);assert.deepEqual(field,originalField);for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(done.operativeState[id].alive,false);assert.deepEqual(decodeSave(encodeSave(done)).campaign,done);assert.equal(events.filter(event=>event.event==='stockCuyoServiceRelief').length,1);
 const unchanged=relieveStockCuyoService(done,result.field);assert.deepEqual(unchanged.campaign,done);assert.deepEqual(unchanged.field,result.field);assert.deepEqual(unchanged.receipts,[]);assert.deepEqual(unchanged.orders,[]);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],dismissed:receipt.dismissed,replacement:receipt.replacement,returnedStacks:receipt.returned.length,paidQuote:receipt.total,arrivalHours:receipt.arrivalHours,clock:[done.hour,done.secondOfHour],field:result.field,weapon:receipt.gun.weapon,loaded:receipt.gun.loaded,reserveRounds:receipt.ammoCount,publicOrders:result.orders.length,exactMidpointReplay:true,earlierDeathsPermanent:true}));
});
