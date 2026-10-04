import {collectFiniteDressings} from './care-supply-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {initialCampaign as preparedCampaign} from './legacy-campaign-fixture.mjs';
import {assignedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';
import {contractQuote} from '../game/contracts.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {worldCell,WORLD_CELLS,ROAD_CELLS,cellStepHours} from '../game/world-cells.js';
import {campaignSeconds,strategicClockInterrupt} from '../game/strategic-clock.js';
import {receiveCorrespondence} from '../game/correspondence.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null);return next;};

test('continuous clock advances exact seconds and performs hourly work once',()=>{
 let s=initialCampaign();s=order(s,{type:'advanceStrategicTime',seconds:3599});assert.equal(s.hour,0);assert.equal(s.secondOfHour,3599);
 const saved=restoreCampaign(serializeCampaign(s));s=order(saved,{type:'advanceStrategicTime',seconds:1});assert.equal(s.hour,1);assert.equal(s.secondOfHour,0);
 const minute=order(s,{type:'advanceStrategicTime',seconds:60});assert.equal(campaignSeconds(minute),3660);
 assert.equal(dispatchCampaign(s,{type:'advanceStrategicTime',seconds:0}).lastError!==null,true);
 assert.equal(dispatchCampaign(s,{type:'advanceStrategicTime',seconds:3601}).lastError!==null,true);
});
test('strategic history preserves a fractional event time through saving and rejects invalid seconds',()=>{
 let s=order(preparedCampaign(),{type:'advanceStrategicTime',seconds:3570});
 s=order(s,{type:'travel',sector:'buenos_aires',queue:true});
 assert.equal(s.log[0].hour,0);assert.equal(s.log[0].secondOfHour,3570);
 assert.deepEqual(restoreCampaign(serializeCampaign(s)).log,s.log);
 for(const seconds of [-1,3600,0.5]){const invalid=structuredClone(s);invalid.log[0].secondOfHour=seconds;assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/registro/);}
 const legacy=structuredClone(s);delete legacy.log[0].secondOfHour;assert.ok(restoreCampaign(serializeCampaign(legacy)));
});
test('continuous medical work pauses when supplies run out and can resume after attention',()=>{
 let s=assignedCare({medicalKits:3,storedDressings:2});assert.equal(s.operativeState[DOCTOR].medkits,1);
 const before=s;s=order(s,{type:'advanceStrategicTime',seconds:3600});assert.equal(s.hour,1);assert.equal(s.operativeState[DOCTOR].medkits,0);assert.equal(s.operativeState[PATIENT].bleeding,0);
 assert.ok(strategicClockInterrupt(before,s));assert.ok(s.assignmentAttention.notice);
 const pausedHour=s.hour;s=collectFiniteDressings(s,DOCTOR,2);s=order(s,{type:'advanceStrategicTime',seconds:60});assert.equal(s.hour,pausedHour);assert.equal(s.secondOfHour,60);
});
test('clock interrupt detects skill gain, combat, training and group arrival',()=>{
 const before=preparedCampaign();
 const gained=structuredClone(before);gained.operativeState[3].trainedStats={marksmanship:1};assert.match(strategicClockInterrupt(before,gained),/habilidad/);
 const attacked={...before,pendingEncounter:{groupId:'raid'}};assert.match(strategicClockInterrupt(before,attacked),/combate/);
 const arrived={...before,travelNotice:{hour:1,events:[{name:'Primera escuadra',text:'llega a Retiro.'}]}};assert.match(strategicClockInterrupt(before,arrived),/llega/);
 const completed={...before,assignmentAttention:{notice:{events:[{code:'militia_complete'}]}}};assert.match(strategicClockInterrupt(before,completed),/asignaciones/);
 assert.equal(strategicClockInterrupt(before,structuredClone(before)),null);
});
test('first map selection previews a multi-waypoint route without sending the squad',()=>{
 const s=preparedCampaign(),before=structuredClone(s);
 const p=previewStrategicRoute(s,s.activeSquadId,'retiro','march',['buenos_aires','ensenada']);
 assert.equal(p.valid,true);assert.deepEqual(p.action.waypoints,['buenos_aires','ensenada']);assert.deepEqual(s,before);
 const sent=order(s,p.action);assert.equal(sent.hour,0);assert.equal(sent.squads[0].journey.path.at(-1),'retiro');assert.ok(sent.squads[0].journey.path.includes('ensenada'));
});
test('rural map travel is queued and does not teleport or advance time on confirmation',()=>{
 const s=preparedCampaign(),origin=worldCell(s.location),destination=WORLD_CELLS.find(c=>c.land&&!c.locality&&Math.abs(c.col-origin.col)+Math.abs(c.row-origin.row)===1);
 assert.ok(destination);
 const preview=previewStrategicRoute(s,s.activeSquadId,destination.location);assert.equal(preview.valid,true);assert.equal(preview.action.queue,true);
 const next=order(s,preview.action);assert.equal(next.location,s.location);assert.equal(next.hour,0);assert.deepEqual(next.squads[0].journey.path,preview.path);assert.ok(restoreCampaign(serializeCampaign(next)));
});
test('roads cost less than open terrain and horses require usable mounts for every member',()=>{
 const road=WORLD_CELLS.find(c=>c.land&&c.biome==='plains'&&ROAD_CELLS.has(c.id)),field=WORLD_CELLS.find(c=>c.land&&c.biome==='plains'&&!ROAD_CELLS.has(c.id));
 assert.ok(cellStepHours(road.id)<cellStepHours(field.id));
 const s=preparedCampaign();assert.equal(previewStrategicRoute(s,s.activeSquadId,'buenos_aires','horse').valid,false);
 for(const id of s.squad)s.horseState.horses.push({id:`test-${id}`,assignedTo:id,condition:100,stamina:100,returned:false});
 const ride=previewStrategicRoute(s,s.activeSquadId,'buenos_aires','horse'),walk=previewStrategicRoute(s,s.activeSquadId,'buenos_aires');assert.equal(ride.valid,true);assert.ok(ride.hours<walk.hours);
 s.horseState.horses[0].stamina=0;assert.equal(previewStrategicRoute(s,s.activeSquadId,'buenos_aires','horse').valid,false);
});
test('fourteen-day renewal banks exactly fourteen days and preserves permanent service',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'day'});const op=rosterFor(s).find(o=>o.id===100),q=contractQuote(s,op,'fortnight'),cash=s.resources.treasury;
 s=order(s,{type:'renewContract',id:100,term:'fortnight'});assert.equal(s.contracts[100].expiresAt,24+14*24);assert.equal(s.resources.treasury,cash-q.price);assert.equal(restoreCampaign(serializeCampaign(s)).contracts[100].term,'fortnight');
 assert.equal(contractQuote(preparedCampaign(),rosterFor(preparedCampaign()).find(o=>o.id===3),'fortnight').permanent,true);
});
test('recruitment prices preserve salary differences and require a meaningful weekly budget',()=>{
 const s=initialCampaign();const cheap=rosterFor(s).find(o=>o.id===100),elite=rosterFor(s).find(o=>o.tier==='elite');
 const q=contractQuote(s,cheap,'week');assert.ok(q.price>Math.ceil(cheap.monthlyPay/30)*7);assert.ok(contractQuote(s,elite,'week').price>q.price);assert.equal(q.price,contractQuote(s,cheap,'day').price*7);
});
test('received mail persists, deduplicates real event messages and rejects forged dates',()=>{
 const s=initialCampaign();assert.equal(s.correspondence,undefined);receiveCorrespondence(s,{id:'report-1',sender:'Cuartel',subject:'Parte',text:'La escuadra llegó.'});receiveCorrespondence(s,{id:'report-1',sender:'Otro',subject:'Otro',text:'Repetido'});
 assert.equal(s.correspondence.length,1);assert.equal(restoreCampaign(serializeCampaign(s)).correspondence[0].sender,'Cuartel');s.correspondence[0].hour=999;assert.throws(()=>restoreCampaign(serializeCampaign(s)),/correspondencia/);
});
