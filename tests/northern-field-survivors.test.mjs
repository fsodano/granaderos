import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {northernFieldSurvivors} from './northern-field-survivors.mjs';
const proof=JSON.parse(readFileSync(new URL('./fixtures/northern-field-survivors-earned-cordoba-84.provenance.json',import.meta.url)));
function fixture(){const raw=readFileSync(new URL('./fixtures/'+proof.fixture,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),proof.fixtureSha256);return JSON.parse(raw);}

test('earned morale2 survivor stays outside the field selection without changing native actor values',()=>{
 const c=fixture(),before=structuredClone(c),r=c.operativeState[116];
 assert.deepEqual(c.sourceClock,{hour:84,secondOfHour:670});
 assert.deepEqual([c.recruited.includes(116),r.alive,r.captured,r.location,r.morale],[true,true,false,'cordoba',2]);
 const selected=northernFieldSurvivors(c,c.recordedDoctorIds,c.actualRequestSector);
 assert.deepEqual(selected,[120,134,136,117,119,137,113,124,141,111,125]);
 assert.ok(!selected.includes(116));assert.equal(c.operativeState[116].alive,true);assert.equal(c.operativeState[116].hp,75);assert.equal(c.operativeState[116].morale,2);
 for(const id of selected){const record=c.operativeState[id];assert.ok(c.recruited.includes(id)&&record.alive&&!record.captured);assert.equal(record.location,'cordoba');assert.ok(record.morale>=40);}
 assert.deepEqual(c,before,'selection must not change assignments, health, native morale or serving identities');
});

test('the same earned records preserve clinic, doctor and actual-death exclusions',()=>{
 const c=fixture(),before=structuredClone(c);
 assert.deepEqual(c.recordedDoctorIds,[112,122]);
 for(const id of c.recordedDoctorIds){assert.equal(c.operativeState[id].location,'san_nicolas');assert.equal(c.operativeState[id].assignment,'rest');assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].morale,80);}
 assert.deepEqual(northernFieldSurvivors(c,c.recordedDoctorIds,'san_nicolas'),[]);
 assert.deepEqual(northernFieldSurvivors(c,[],'san_nicolas'),[112,122]);
 const dead=[1000,110,114,115,123,107,131];for(const id of dead){assert.equal(c.operativeState[id].alive,false);assert.ok(!northernFieldSurvivors(c,[],'san_nicolas').includes(id));}
 assert.deepEqual(c,before,'location and living/dead status remain the native recorded values');
});
