import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
import {stageOpeningRearCover} from './opening-rear-guard.mjs';
import {prepareSaltaAssault} from './salta-route.mjs';
import {northernClinicDefenseOrder} from './northern-route.mjs';
import provenance from './fixtures/opening-port-recovered-before-salta.provenance.json' with {type:'json'};

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clock=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
function earnedInput(){
 const bytes=readFileSync(new URL('./fixtures/'+provenance.fixture,import.meta.url));
 assert.equal(sha(bytes),provenance.gzipSha256);const raw=gunzipSync(bytes);
 assert.equal(sha(raw),provenance.rawSha256);return decodeSave(raw.toString()).campaign;
}

test('earned port-funded rear cover wins the actual Tucuman raid with finite gear and permanent loss',t=>{
 const start=earnedInput(),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[263,504]);assert.equal(start.resources.treasury,88319);
 assert.equal(start.townIncome.activations.buenos_aires.approach,'direct');
 const ready=stageOpeningRearCover(start,{report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(ready.receipt.ids.length,15);assert.equal(ready.receipt.actions.length,3);
 const cover=events.find(event=>event.event==='routeRoofDefenders');assert.ok(cover);
 assert.ok(cover.actions.some(action=>action.type==='move'));assert.ok(cover.elapsedSeconds>0);
 assert.equal(cover.positions.length,15);assert.ok(cover.positions.every(position=>position.tacticalLevel===1));
 // Cover ends at an official save boundary before the separate paid battery
 // preparation. Native battle execution compares an exact second replay and
 // admits its campaign/battle pair before the ordinary result transaction.
 const resumed=decodeSave(encodeSave(ready.campaign)).campaign;assert.deepEqual(resumed,ready.campaign);
 const stop=Symbol('Stop after the settled Tucuman raid');let guard,guardState,raid,settled,defense;
 assert.throws(()=>prepareSaltaAssault(resumed,{encounterController:northernClinicDefenseOrder,report:event=>events.push(event),onCheckpoint:(name,campaign,detail)=>{
  if(name==='salta-rear-guard'){guard=structuredClone(detail.reservePreparation);guardState=structuredClone(campaign);}
  if(name==='support-battery-encounter')raid=structuredClone(campaign);
  if(name==='support-battery-settled'){settled=structuredClone(campaign);defense=structuredClone(detail.defense);throw stop;}
 }}),error=>error===stop);
 assert.ok(guard&&guardState&&raid&&settled&&defense);assert.equal(guard.hired,100);
 assert.equal(guard.hiringCost,252);assert.equal(guardState.contracts[100].paid,guard.hiringQuote.price);
 const receipt=guard.weaponReceipt,model=sectorInventoryModel(guardState,'cordoba',rosterFor(guardState),100);
 assert.equal(receipt.countBefore-receipt.countAfter,1);assert.equal(receipt.treasuryBefore,receipt.treasuryAfter);
 assert.equal(model.entries.find(row=>row.key===receipt.sourceKey)?.count??0,receipt.countAfter);
 const equipped=handRecord(model.personal,'primary');
 for(const [key,value]of Object.entries(JSON.parse(receipt.expected)))if(key!=='item')assert.deepEqual(equipped[key],value,'The recovered gun retains its actual '+key);
 assert.equal(raid.pendingEncounter.groupId,'enemy-group-3');assert.equal(raid.pendingEncounter.sector,'tucuman');
 assert.equal(defense.groupId,'enemy-group-3');assert.equal(defense.status,'victory');
 assert.equal(defense.turns,22);assert.equal(defense.actions,263);assert.equal(defense.elapsedSeconds,230);
 assert.equal(clock(settled),defense.startSeconds+defense.elapsedSeconds);
 assert.equal(settled.pendingBattle,null);assert.equal(settled.pendingEncounter,null);assert.equal(settled.defeated,false);
 assert.equal(settled.sectors.tucuman.owner,'patriot');assert.equal(settled.enemyGroups.find(group=>group.id===defense.groupId).status,'defeated');
 assert.ok(settled.encounterHistory.some(event=>event.groupId===defense.groupId&&event.outcome==='victory'));
 const deaths=start.recruited.filter(id=>start.operativeState[id].alive&&!settled.operativeState[id].alive);assert.deepEqual(deaths,[131]);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(settled.operativeState[id].alive,false);assert.equal(settled.operativeState[id].deathMinute,record.deathMinute);}
 assert.equal(settled.operativeState[122].hp,25);assert.equal(settled.operativeState[121].hp,26);
 for(const id of [122,121]){assert.equal(settled.operativeState[id].alive,true);assert.equal(settled.operativeState[id].bleeding,0);}
 assert.deepEqual(decodeSave(encodeSave(settled)).campaign,settled);
 t.diagnostic(JSON.stringify({scope:'Earned Tucuman raid and strict saved continuation only; no Cordoba rear raid, completed battery delivery, Salta or Yatasto claim.',group:defense.groupId,status:defense.status,turns:defense.turns,actions:defense.actions,newDeaths:deaths,clock:[settled.hour,settled.secondOfHour]}));
});
