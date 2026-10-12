import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {prepareStockCuyoBatteryGuard} from './stock-cuyo-battery-defense.mjs';

test('the actual installed northern checkpoint books its immediate Cuyo guard at the quoted service and price',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/earned-installed-salta-first-aid.save.json.gz',import.meta.url)));
 const start=decodeSave(raw.toString('utf8')).campaign,before=structuredClone(start);
 const result=prepareStockCuyoBatteryGuard(start),guard=rosterFor(start).find(op=>op.id===result.guardId),quote=contractQuote(start,guard,'day');
 assert.equal(result.guardId,142);assert.equal(result.arrival.travelHours,0);
 assert.equal(result.campaign.hiringArrivals.some(row=>row.operativeId===result.guardId),false);
 assert.equal(result.campaign.recruited.filter(id=>id===result.guardId).length,1);
 assert.equal(result.campaign.operativeState[result.guardId].location,'cordoba');
 assert.equal(result.campaign.resources.treasury,start.resources.treasury-quote.total);
 assert.deepEqual([result.campaign.hour,result.campaign.secondOfHour],[start.hour,start.secondOfHour]);
 const service=result.campaign.contracts[result.guardId];
 assert.equal(service.started*3600+(service.startedSecond??0),start.hour*3600+start.secondOfHour);
 assert.equal(contractExpiresSeconds(service),start.hour*3600+start.secondOfHour+quote.hours*3600);
 assert.equal(service.paid,quote.price);assert.equal(service.term,'day');
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(result.campaign)).campaign,result.campaign);
});
