import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractQuote} from '../game/contracts.js';
import {rosterFor,civicStatus,dispatchCampaign} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {expandedCapitalReliefPlan,prepareCreatedExpandedCapitalReturn,expandedCapitalWaitNotice} from './created-expanded-capital-return.mjs';

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

test('the relief quotation retains a serving returnee after his actual paid-clock journey to another friendly province',()=>{
 const input=fixture(),original=structuredClone(input),before=expandedCapitalReliefPlan(input);
 let c=input;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+' '+c.lastError);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);};
 order({type:'createSquad',ids:[101],sector:'santa_fe',name:'Regreso a Córdoba'});
 const squadId=c.activeSquadId;
 order({type:'configureArtillery',types:[]});
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 assert.equal(c.squads.find(q=>q.id===squadId).journey.legHours,4);
 for(let hour=0;hour<4;hour++)order({type:'wait',hours:1});
 assert.equal(c.hour,input.hour+4);assert.equal(c.secondOfHour,input.secondOfHour);
 assert.equal(c.squads.find(q=>q.id===squadId).journey,undefined);
 assert.equal(c.operativeState[101].location,'cordoba');
 assert.equal(c.operativeState[57].location,'san_nicolas');
 assert.equal(c.operativeState[117].location,'santa_fe');
 const arrived=structuredClone(c),plan=expandedCapitalReliefPlan(c),saved=decodeSave(encodeSave(c)).campaign;
 assert.deepEqual(plan.keepers,before.keepers);
 assert.deepEqual(plan.field,before.field);
 assert.deepEqual(plan.candidates,before.candidates);
 assert.equal(plan.requiredTreasury,before.requiredTreasury);
 assert.deepEqual(expandedCapitalReliefPlan(saved),plan);
 assert.deepEqual(c,arrived);assert.deepEqual(input,original);
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

test('a real public zero-time assignment notice is acknowledged by a second paid-clock wait and reproduces through the official save',()=>{
 const input=fixture(),before=structuredClone(input);let c=dispatchCampaign(input,{type:'assignCare',operativeId:2,assignment:'patient'});assert.equal(c.lastError,null);
 const startedSeconds=c.hour*3600+c.secondOfHour,money=c.resources.treasury,paused=dispatchCampaign(c,{type:'wait',hours:1});assert.equal(paused.lastError,null);
 const notice=expandedCapitalWaitNotice(paused,{startedSeconds,requestedHours:1});assert.ok(notice.events.some(e=>e.operativeId===2&&e.code==='healing_complete'));assert.ok(notice.events.every(e=>!Object.hasOwn(e,'binding')));
 assert.equal(paused.resources.treasury,money);assert.equal(paused.hour*3600+paused.secondOfHour,startedSeconds);
 const next=dispatchCampaign(paused,{type:'wait',hours:1}),replay=dispatchCampaign(decodeSave(encodeSave(paused)).campaign,{type:'wait',hours:1});assert.equal(next.lastError,null);
 assert.equal(next.hour*3600+next.secondOfHour,startedSeconds+3600);assert.equal(next.assignmentAttention.notice,null);assert.deepEqual(replay,next);assert.deepEqual(input,before);
});

test('the expanded zero-time guard rejects absent notices, wrong requested periods and any unresolved contact',()=>{
 const c=fixture(),startedSeconds=c.hour*3600+c.secondOfHour;
 assert.throws(()=>expandedCapitalWaitNotice(c,{startedSeconds,requestedHours:1}),/actual matching public assignment notice/);
 let paused=dispatchCampaign(c,{type:'assignCare',operativeId:2,assignment:'patient'});paused=dispatchCampaign(paused,{type:'wait',hours:1});assert.equal(paused.lastError,null);
 assert.throws(()=>expandedCapitalWaitNotice(paused,{startedSeconds,requestedHours:2}),/actual matching public assignment notice/);
 const blocked=structuredClone(paused);blocked.pendingEncounter={groupId:'unresolved-control',sector:'santa_fe'};
 assert.throws(()=>expandedCapitalWaitNotice(blocked,{startedSeconds,requestedHours:1}),/actual contact/);
});
