import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {prepareCoastalFieldAid} from './coastal-medical-readiness.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const save=c=>decodeSave(encodeSave(c)).campaign;
const step=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,next.lastError);return next;};
function fixture(stem){const proof=JSON.parse(readFileSync(new URL('./fixtures/coastal-medical-readiness.provenance.json',import.meta.url))),meta=proof.fixtures[stem],packed=readFileSync(new URL('./fixtures/'+meta.path,import.meta.url));assert.equal(sha(packed),meta.gzipSha256);const raw=gunzipSync(packed);assert.equal(sha(raw),meta.rawSha256);return JSON.parse(raw);}
const pool=(c,id)=>sectorInventoryModel(c,c.location,rosterFor(c),id).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);

test('earned conscious field medic already carrying two dressings leaves native clinic state unchanged',()=>{
 const c=fixture('coastal-earned-ba-stable-005'),before=structuredClone(c),events=[];
 assert.deepEqual([c.hour,c.secondOfHour,c.location],[8,411,'buenos_aires']);assert.equal(c.operativeState[120].medkits,2);
 const result=prepareCoastalFieldAid(c,{report:e=>events.push(e)});
 assert.equal(result.readiness.medicId,120);assert.deepEqual(result.campaign,before);assert.deepEqual(c,before);assert.deepEqual(events,[]);
});

test('the same real two-piece reserve is recovered from its native drop with exact finite debit and saved replay',()=>{
 const c=fixture('coastal-earned-ba-stable-005'),before=structuredClone(c),id=120,events=[],drop={type:'sectorInventory',sector:c.location,operativeId:id,direction:'drop',item:'medkits',count:2};
 const oldPool=pool(c,id),dropped=step(c,drop);assert.equal(dropped.operativeState[id].medkits,0);assert.equal(pool(dropped,id),oldPool+2);
 const result=prepareCoastalFieldAid(dropped,{report:e=>events.push(e)}),after=result.campaign;
 assert.equal(after.operativeState[id].medkits,2);assert.equal(pool(after,id),oldPool);
 for(const [operativeId,r]of Object.entries(before.operativeState)){const n=after.operativeState[operativeId];assert.equal(n.alive,r.alive);assert.equal(n.hp,r.hp);assert.equal(n.bleeding,r.bleeding);assert.equal(n.medkits,r.medkits);assert.equal(n.ammo,r.ammo);assert.equal(n.carriedLoaded,r.carriedLoaded);assert.deepEqual(n.inventory,r.inventory);}
 assert.deepEqual(after.resources,before.resources);assert.deepEqual(after.contracts,before.contracts);assert.deepEqual(after.squad,before.squad);assert.deepEqual([after.hour,after.secondOfHour],[before.hour,before.secondOfHour]);
 const tape=[drop,...events.filter(e=>e.event==='coastalFieldAidOrder').map(e=>e.action)];assert.equal(tape.length,2);assert.equal(tape[1].type,'sectorInventory');assert.equal(tape[1].direction,'take');assert.equal(tape[1].count,2);
 let replay=save(step(save(c),tape[0]));replay=step(replay,tape[1]);assert.deepEqual(replay,after);assert.deepEqual(save(after),after);assert.deepEqual(c,before,'the input remains unchanged');
});

test('earned unconscious casualty cannot receive fabricated aid when every field dressing is spent',()=>{
 const p=fixture('coastal-earned-san-nicolas-empty-008'),before=structuredClone(p),patient=p.battle.units.find(u=>u.id==='141');
 assert.deepEqual([patient.hp,patient.bleeding,patient.unconscious],[9,4,true]);assert.equal(patient.tacticalLevel,0);assert.ok(p.battle.units.filter(u=>u.side==='player').every(u=>u.medkits===0));
 const aid=autoBandageBattle(p.battle);assert.deepEqual(aid.steps,[]);assert.deepEqual(aid.battle,p.battle);assert.deepEqual(aid.untreated.map(u=>u.id),['141']);assert.match(aid.stoppedReason,/vendas/);assert.deepEqual(p,before);
});
