import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-northern-handover.provenance.json',import.meta.url)));
function earnedInput(name){
 const record=metadata.records[name],bytes=readFileSync(new URL(`./fixtures/earned-northern-handover-${name}.save.json.gz`,import.meta.url)),raw=gunzipSync(bytes);
 assert.equal(sha(bytes),record.compressedSha256);assert.equal(sha(raw),record.sha256);assert.equal(raw.length,record.rawBytes);
 const campaign=decodeSave(raw.toString()).campaign;assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);return campaign;
}

test('the earned Salta handover interruption admits the actual local enemy and preserves the departed envoy journey',()=>{
 const c=earnedInput('counterattack'),before=structuredClone(c),expected=metadata.counterattack;
 assert.deepEqual([c.hour,c.secondOfHour],expected.clock);assert.equal(c.location,expected.location);
 assert.deepEqual(c.pendingEncounter,{groupId:expected.groupId,sector:expected.sector,arrivedAt:516});
 const group=c.enemyGroups.find(group=>group.id===expected.groupId),envoy=c.squads.find(q=>q.id===expected.envoySquadId);
 assert.equal(group.status,'waiting');assert.equal(group.target,'salta');assert.equal(c.sectors.salta.owner,'patriot');
 assert.deepEqual(envoy.members,expected.members);assert.equal(envoy.location,expected.location);assert.equal(envoy.journey.status,'moving');assert.equal(envoy.journey.path.at(-1),'tucuman');
 assert.ok(c.squads.some(q=>q.location==='salta'&&q.members.length));
 const refused=dispatchCampaign(c,{type:'visitMission',mission:'yatasto'});assert.match(refused.lastError,/encuentro|patrulla/i);
 for(const key of ['hour','secondOfHour','operativeState','resources','squads','pendingEncounter','enemyGroups'])assert.deepEqual(refused[key],c[key],`A blocked mission cannot change ${key}.`);
 assert.deepEqual(c,before);
});
