import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {resolveBlockedCoastJourney} from './blocked-coast-journey.mjs';
import {occupyingGroups} from '../game/enemy-groups.js';

const name='earned-stock-blocked-capital-journey',file=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url));
const proof=JSON.parse(file('provenance.json')),gzip=file('save.json.gz'),raw=gunzipSync(gzip),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(raw),proof.rawSha256);assert.equal(sha(gzip),proof.gzipSha256);assert.equal(raw.length,proof.rawBytes);
const guns=c=>[...Object.values(c.artilleryDepots).flat(),...Object.values(c.sectorStates).flatMap(scene=>scene.artillery??[])].filter(g=>g.side==='player').sort((a,b)=>a.id.localeCompare(b.id));

test('the earned paused capital journey uses twelve actual serving people, native blockade combat, finite stocks and exact saved replay',t=>{
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],proof.clock);assert.equal(start.resources.treasury,proof.treasury);
 assert.equal(start.location,'cordoba');assert.equal(start.squads.find(q=>q.id===start.activeSquadId).journey.reason,'blocked');
 assert.equal(start.sectors.buenos_aires.owner,'patriot');assert.equal(start.blockade,true);assert.ok(occupyingGroups(start,'buenos_aires').length);
 const result=resolveBlockedCoastJourney(start,{report:event=>{const {campaign,battle,...record}=event;events.push(record);}}),end=result.campaign,{receipt}=result;
 assert.deepEqual(receipt.field,[57,8,11,0,1,7,114,111,103,140,127,146]);assert.equal(new Set(receipt.field).size,12);
 assert.deepEqual(receipt.paid,[114,111,103,140,127,146]);assert.equal(receipt.physician,146);
 assert.ok(receipt.paid.every(id=>start.recruited.includes(id)&&start.contracts[id].kind==='paid'&&start.operativeState[id].alive&&start.operativeState[id].location==='mendoza'));
 assert.equal(receipt.orders.some(action=>action.type==='recruitCivic'),false,'The blockade response recalls serving veterans; the later default new coast hire is separate.');
 assert.equal(receipt.summary.status,'victory');assert.equal(receipt.summary.sector,'buenos_aires');assert.equal(receipt.summary.turns,10);assert.equal(receipt.summary.actions,422);assert.equal(receipt.summary.elapsedSeconds,2335);
 assert.deepEqual([end.hour,end.secondOfHour],[1454,3196]);assert.equal(end.resources.treasury,33668);
 assert.equal(end.blockade,false);assert.equal(occupyingGroups(end,'buenos_aires').length,0);assert.equal(end.enemyGroups.find(g=>g.id==='enemy-group-4').status,'defeated');assert.equal(end.location,'buenos_aires');assert.equal(end.pendingBattle,null);assert.equal(end.pendingEncounter,null);
 assert.deepEqual(receipt.losses.sort((a,b)=>a-b),[0,1,7,8,11,103,140]);
 const fieldAid=events.find(event=>event.event==='blockedCoastFieldAid');assert.ok(fieldAid);assert.deepEqual(fieldAid.treatedIds,[]);
 assert.equal(fieldAid.steps.length,3);assert.equal(fieldAid.steps.at(-1).type,'move');assert.equal(fieldAid.steps.at(-1).unitId,'146');
 assert.equal(receipt.summary.units.find(u=>u.id==='11').hp,3);assert.equal(end.operativeState[11].hp,0,'Paz dies during the actual five-second doctor approach; no aid success is invented.');
 for(const id of [57,114,111,127,146]){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].hp,end.operativeState[id].maxHp);assert.equal(end.operativeState[id].bleeding,0);assert.equal(end.operativeState[id].location,'buenos_aires');assert.ok(end.recruited.includes(id));}
 const linen=events.find(event=>event.event==='blockedCoastFiniteLinen');assert.deepEqual({operativeId:linen.operativeId,count:linen.count},{operativeId:146,count:2});assert.equal(end.operativeState[146].medkits,2,'The failed approach does not consume those two real dressings.');
 const beforeGuns=guns(start),afterGuns=guns(end);assert.deepEqual(afterGuns.map(g=>g.id),beforeGuns.map(g=>g.id));
 const fired=['arsenal:buenos_aires:1','arsenal:cordoba:2'];assert.equal(beforeGuns.filter(g=>fired.includes(g.id)).reduce((sum,g)=>sum+g.ammo+Number(g.loaded),0),4);assert.equal(afterGuns.filter(g=>fired.includes(g.id)).reduce((sum,g)=>sum+g.ammo+Number(g.loaded),0),0);
 for(const gun of beforeGuns.filter(g=>!fired.includes(g.id)))assert.deepEqual(afterGuns.find(g=>g.id===gun.id),gun,'The other three physical guns retain their exact records and finite charges.');
 for(const[id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,record.deathMinute);}
 assert.equal(end.completed,false);assert.equal(end.defeated,false);assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:proof.scope,field:receipt.field,summary:{turns:10,actions:422,seconds:2335},newDeaths:receipt.losses,finiteGunChargesSpent:4,reachableLinenCollected:2,successfulFieldAid:0,clock:[end.hour,end.secondOfHour],treasury:end.resources.treasury,strictSave:true,nativeFullTapeAndMidpointReplay:true}));
});
