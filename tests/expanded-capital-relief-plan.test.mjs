import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractQuote} from '../game/contracts.js';
import {rosterFor,civicStatus} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {expandedCapitalReliefPlan,prepareCreatedExpandedCapitalReturn} from './created-expanded-capital-return.mjs';

const sha=v=>createHash('sha256').update(v).digest('hex');
function fixture(){
 const stem='./fixtures/earned-coastal-river-victory',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),gzip=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(gzip);
 assert.equal(sha(gzip),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
 const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),proof.campaignSha256);
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.clock,proof.treasury]);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

test('the unchanged genuine river victory quotes three healthy returned veterans without clearing their public refusal or adding initial stock',()=>{
 const c=fixture(),before=structuredClone(c),plan=expandedCapitalReliefPlan(c),roster=rosterFor(c);
 assert.deepEqual(plan.field,[2,10,101,117,102,6,116,107,122]);assert.equal(plan.keepers.length,10);assert.ok(plan.keepers.includes(57));
 assert.deepEqual(plan.candidates.map(row=>row.id),[105,145,109]);
 assert.deepEqual(plan.candidates.map(row=>row.day.price),[9600,7380,8160]);
 assert.deepEqual(plan.candidates.map(row=>row.week.price),[67200,51660,57120]);
 for(const row of plan.candidates){
  assert.equal(row.returnMarker.sectorId,'mendoza');assert.equal(row.day.available,false);assert.equal(row.week.available,false);assert.equal(civicStatus(c,row.id).available,false);
  assert.deepEqual(row.day,contractQuote(c,roster.find(op=>op.id===row.id),'day'));
  assert.equal(c.operativeState[row.id].startingCartridgesIssued,true);assert.equal(c.operativeState[row.id].medkits,0);
 }
 assert.deepEqual(c,before);
});

test('field quotation keeps three physical empty guns independent of infantry count and funds the complete bounded service horizon',()=>{
 const c=fixture(),plan=expandedCapitalReliefPlan(c),smaller=expandedCapitalReliefPlan(c,{fieldSize:10});
 assert.equal(plan.fieldSize,12);assert.equal(plan.fieldDressings,60);assert.equal(plan.batterySize,3);
 assert.equal(smaller.fieldSize,10);assert.equal(smaller.candidates.length,1);assert.equal(smaller.batterySize,3);
 assert.equal(plan.serviceWeeks,6);assert.equal(plan.retainedWeekly,3696);assert.equal(plan.candidateWeekly,175980);assert.equal(plan.requiredTreasury,1088056);
 const actual=c.sectorStates.santa_fe.artillery.filter(g=>g.side==='player'&&g.type==='bronze4');assert.equal(actual.length,3);assert.ok(actual.every(g=>!g.loaded&&g.ammo===0));
 assert.throws(()=>expandedCapitalReliefPlan(c,{fieldSize:8}),/Retain every actual river survivor/);
 assert.throws(()=>expandedCapitalReliefPlan(c,{maxRestHours:601}),/600-hour/);
});

test('the quotation excludes wounded former carriers and never budgets occupied capital loot as current medical supply',()=>{
 const c=fixture(),plan=expandedCapitalReliefPlan(c);
 assert.ok(plan.candidates.every(row=>c.operativeState[row.id].hp===c.operativeState[row.id].maxHp&&!c.operativeState[row.id].bleeding));
 assert.ok([106,142,147].every(id=>!plan.candidates.some(row=>row.id===id)));
 const ensenada=sectorInventoryModel(c,'ensenada',rosterFor(c)),known=ensenada.entries.filter(row=>JSON.parse(row.expected).item==='medkits');
 assert.equal(known.reduce((sum,row)=>sum+row.count,0),35);
 const occupied=sectorInventoryModel(c,'buenos_aires',rosterFor(c),57);assert.ok(occupied.reason);assert.ok(c.enemyGroups.some(group=>group.target==='buenos_aires'&&group.status==='stationed'));
 assert.equal(c.operativeState[57].location,'san_nicolas');assert.equal(c.operativeState[57].alive,true);
});

test('expanded preparation rejects an unbounded saving policy before it can issue first aid or alter the earned input',()=>{
 const c=fixture(),before=structuredClone(c),events=[];
 assert.throws(()=>prepareCreatedExpandedCapitalReturn(c,{maxSavingHours:24001,report:e=>events.push(e)}),/bounded income-saving/);
 assert.equal(events.length,0);assert.deepEqual(c,before);
});
