import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave} from '../game/save.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {sectorDeploymentModel} from '../game/sector-deployment.js';
import {readyLivingNorthernAssaultPlan,requestReadyLivingNorthernInfantry} from './created-living-northern-request.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const input=()=>{const stem='./fixtures/earned-living-northern-ready',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),proof.decodedCampaignSha256);return {c,proof};};
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);

test('the actual fully recovered paid column quotes its real25-soldier northern occupation and retains the Córdoba commander without another supply or fixed-cohort operation',()=>{
 const {c}=input(),before=structuredClone(c),p=readyLivingNorthernAssaultPlan(c);assert.deepEqual(p.keepers,[57,101,107,130,142,106,147,118]);assert.deepEqual(p.field,[101,107,130,142,106,147,118]);assert.equal(p.hospital,'cordoba');assert.equal(p.target,'tucuman');assert.deepEqual(p.occupations,['enemy-group-8']);assert.equal(p.occupationSoldiers,25);assert.equal(c.enemyReserves.remaining.north,63);assert.deepEqual(c,before);
});

test('the complete actual ready infantry approach pays both public columns and admits the same real seven with finite stock and a strict official paired save against northern8',t=>{
 const {c:start,proof}=input(),before=structuredClone(start),events=[],p=readyLivingNorthernAssaultPlan(start),pair=requestReadyLivingNorthernInfantry(start,{report:e=>{events.push(e);if(process.env.GRANADEROS_LIVING_NORTHERN_REQUEST_EVENTS)appendFileSync(process.env.GRANADEROS_LIVING_NORTHERN_REQUEST_EVENTS,JSON.stringify(e)+'\n');}}),{campaign:c,battle,official}=pair;
 assert.deepEqual(start,before);assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.deepEqual(c.operativeState[57],start.operativeState[57]);assert.deepEqual(guns(c),guns(start));assert.equal(c.blockade,true);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual([c.hour,c.secondOfHour],[4650,259]);assert.equal(c.resources.treasury,start.resources.treasury-20);assert.equal(events.filter(e=>e.event==='livingNorthernReadyApproachRenewal').length,0);assert.deepEqual(c.contracts,start.contracts);
 const quotes=events.filter(e=>e.event==='livingNorthernReadyAssaultQuoted');assert.equal(quotes.length,2);assert.deepEqual(quotes.map(e=>e.ids.length),[6,1]);assert.deepEqual(quotes.flatMap(e=>e.ids),p.field);for(const row of quotes){assert.equal(row.quote.valid,true);assert.equal(row.quote.hours,4);assert.equal(row.quote.action.type,'attack');assert.deepEqual(row.quote.path,['cordoba','tucuman']);}
 assert.deepEqual(c.pendingBattle.occupationGroupIds,['enemy-group-8']);assert.deepEqual(c.pendingBattle.artillery,[]);assert.equal(c.pendingBattle.enemies.length,25);assert.deepEqual(c.pendingBattle.enemies,start.enemyGroups.find(g=>g.id==='enemy-group-8').units);assert.deepEqual(c.pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),p.field.slice().sort((a,b)=>a-b));assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));assert.deepEqual(sectorDeploymentModel(battle).units.map(u=>Number(u.id)).sort((a,b)=>a-b),p.field.slice().sort((a,b)=>a-b));assert.ok(!sectorDeploymentModel(battle).units.some(u=>u.id==='100'),'An old dead resident never joins current deployment admission.');
 for(const id of p.field){const r=c.operativeState[id],old=start.operativeState[id];for(const key of ['hp','maxHp','bleeding','energy','fatigue','asleep','medkits','carriedLoaded','ammo','inventory','activeSlot','headwear','outfit','legwear'])assert.deepEqual(r[key],old[key],`The real approach preserves ${id} ${key}.`);assert.equal(r.location,'tucuman');}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}for(const id of proof.nativeDeaths)assert.equal(c.operativeState[id].hp,0);
 const decoded=decodeSave(official);assert.deepEqual(decoded,{campaign:c,battle});
 t.diagnostic(JSON.stringify({scope:'Actual fully ready paid northern8 request and paired native admission only; no native victory/north completion/coast/ending proof',inputRawSha:proof.rawSha256,field:p.field,commander:57,occupation:p.occupations,enemies:25,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,elapsedSeconds:4*3600,travelFare:20,decodedCampaignSha:sha(JSON.stringify(decoded.campaign)),decodedBattleSha:sha(JSON.stringify(decoded.battle)),officialRawSha:sha(official)}));
 if(process.env.GRANADEROS_LIVING_NORTHERN_REQUEST_CAPTURE)writeFileSync(process.env.GRANADEROS_LIVING_NORTHERN_REQUEST_CAPTURE,official);
});
