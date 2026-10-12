import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {enterControlledPort,controlledPortAvailable} from './controlled-port-handover.mjs';
import {meetLocalIncomeRepresentative} from './route-town-income.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';

const proof=JSON.parse(readFileSync(new URL('./fixtures/earned-stock-controlled-ensenada.provenance.json',import.meta.url)));
const compressed=readFileSync(new URL('./fixtures/earned-stock-controlled-ensenada.save.json.gz',import.meta.url)),raw=gunzipSync(compressed),sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(sha(compressed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
const input=()=>decodeSave(raw.toString()).campaign,clock=c=>c.hour*3600+(c.secondOfHour??0);

// This genuine phase-3 checkpoint proves friendly-port behavior. The eventual
// post-Andes commander route still needs its own earned end-to-end receipt.
test('the already earned Ensenada port admits real travel and physical naval meetings without a repeated conquest or gun refill',t=>{
 const start=input(),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[928,3462]);assert.equal(start.sectors.ensenada.owner,'patriot');assert.equal(start.blockade,false);
 assert.equal(controlledPortAvailable(start),true);
 assert.equal(start.phase,3);assert.ok(!start.recruited.includes(57));assert.ok(start.artilleryArsenalRecoveries.ensenada);
 const entered=enterControlledPort(start,{fieldIds:[2,116],report:e=>events.push(e)}),c=entered.campaign;
 assert.equal(c.location,'ensenada');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.blockade,false);
 assert.ok(clock(c)>clock(start));assert.ok(entered.receipt.orders.some(({action})=>action.type==='travel'&&action.queue&&action.sector==='ensenada'));
 assert.equal(entered.receipt.orders.some(({action})=>['attack','beginAssault','battleResult'].includes(action.type)),false);
 assert.deepEqual(c.artilleryArsenalRecoveries,start.artilleryArsenalRecoveries);assert.deepEqual(c.artilleryDepots,start.artilleryDepots,'Travel must not create or refill a finite gun.');
 for(const id of [2,116])assert.equal(c.operativeState[id].location,'ensenada');
 const denied=dispatchCampaign(c,{type:'attack',sector:'ensenada'});assert.match(denied.lastError,/control patriota/);assert.equal(denied.pendingBattle,null);
 let met=meetLocalIncomeRepresentative(c,{sourceId:'ensenada',operativeId:2,report:e=>events.push(e)});
 assert.equal(met.townIncome.activations.ensenada.npcId,'local-ensenada');assert.equal(met.townIncome.activations.ensenada.sectorId,'ensenada');
 met=meetRecruits(met,['brown','bouchard'],2);
 for(const id of [5,6]){assert.ok(met.recruited.includes(id));assert.equal(met.operativeState[id].alive,true);assert.equal(met.operativeState[id].location,'ensenada');assert.equal(met.contracts[id].expiresAt,null);}
 assert.equal(met.conversations.brown.lastApproach,'recruit');assert.equal(met.conversations.bouchard.lastApproach,'recruit');
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(met.operativeState[id].alive,false);assert.equal(met.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(met.artilleryDepots,start.artilleryDepots);assert.deepEqual(decodeSave(encodeSave(met)).campaign,met);assert.deepEqual(start,before);
 const replay=enterControlledPort(decodeSave(encodeSave(start)).campaign,{fieldIds:[2,116]});assert.deepEqual(replay,entered,'Ordinary travel and its actual quotes replay through the official starting save.');
 t.diagnostic(JSON.stringify({scope:'Earned early controlled-port travel and meetings only',clock:[met.hour,met.secondOfHour],travelSeconds:entered.receipt.endSeconds-entered.receipt.startSeconds,renewals:entered.receipt.renewals.map(({id,quote})=>({id,cost:quote.price})),treasury:met.resources.treasury,portAgreement:true,navalOfficers:[5,6],noRepeatedConquest:true,finiteGunsUnchanged:true,exactSavedTravel:true}));
});

test('the genuine later naval clock preserves friendly ownership and requires clearing its real blockade before a port visit',t=>{
 let c=input();const original=structuredClone(c);
 // A later unguarded naval arrival is earned by ordinary hours. Existing paid
 // terms may end normally; no actor, ownership, group, resource or clock is set.
 for(let attempts=0;!c.blockade&&attempts<96;attempts++){
  assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
  const next=dispatchCampaign(c,{type:'wait',hours:1});assert.equal(next.lastError,null);c=decodeSave(encodeSave(next)).campaign;
 }
 assert.equal(c.blockade,true);assert.equal(c.sectors.ensenada.owner,'patriot');assert.equal(c.sectors.buenos_aires.owner,'patriot');
 assert.equal(controlledPortAvailable(c),false,'The default ending must select its existing native blocked-coast battle path.');
 const navy=c.enemyGroups.find(g=>g.theater==='coast'&&['waiting','engaged','stationed'].includes(g.status));assert.ok(navy);assert.equal(navy.target,'buenos_aires');assert.equal(navy.launchedAt,1008);
 const before=structuredClone(c);assert.throws(()=>enterControlledPort(c,{fieldIds:[2]}),/actual.*(encounter|blockade)/);
 assert.deepEqual(c,before);assert.deepEqual(c.artilleryDepots,original.artilleryDepots);assert.equal(c.completed,false);assert.equal(c.defeated,false);
 for(const [id,r]of Object.entries(original.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Actual naval clock and refused friendly-port visit only',clock:[c.hour,c.secondOfHour],navalGroup:navy.id,target:navy.target,status:navy.status,ensenadaOwner:c.sectors.ensenada.owner,blockade:c.blockade,officialSave:true}));
});
