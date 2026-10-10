import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {actBattle} from '../game/tactical.js';
import {prepareNorthernOfficerRelief} from './fresh-northern-command.mjs';
import {visit,sync,leave} from './local-contract-fixture.mjs';

test('actual northern bleeding veterans use finite recovered dressings for paid self-care before a long native edge approach',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-officer-native-edge-urgent.save.json.gz',import.meta.url)));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/northern-officer-native-edge-urgent.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,input=structuredClone(start),events=[],stop=new Error('captured the real emergency checkpoint');
 assert.deepEqual([start.hour,start.secondOfHour],[467,2100]);assert.equal(start.sectors.tucuman.owner,'patriot');assert.equal(start.pendingBattle,null);
 for(const [id,hp,bleeding]of [[117,16,4],[108,31,3]]){assert.equal(start.operativeState[id].hp,hp);assert.equal(start.operativeState[id].bleeding,bleeding);assert.equal(start.operativeState[id].medkits,0);}
 assert.equal(start.operativeState[146].medkits,8);
 let staged=null,completed=null;
 assert.throws(()=>prepareNorthernOfficerRelief(start,{report:event=>events.push(structuredClone(event)),onCheckpoint:(stage,campaign)=>{
  if(stage==='northern-officer-emergency-input-tucuman')staged=structuredClone(campaign);
  if(stage==='northern-officer-emergency-tucuman'){completed=structuredClone(campaign);throw stop;}
 }}),error=>error===stop);
 assert.ok(staged&&completed);assert.deepEqual(start,input);
 const transfers=events.filter(row=>row.event==='provincialClinicRecovery');assert.deepEqual(transfers.map(({id,count})=>({id,count})),[{id:117,count:1},{id:108,count:1}]);
 for(const transfer of transfers){
  const before=sectorInventoryModel(start,'tucuman',rosterFor(start),transfer.id).entries.find(row=>row.key===transfer.source);
  const after=sectorInventoryModel(staged,'tucuman',rosterFor(staged),transfer.id).entries.find(row=>row.key===transfer.source);
  assert.ok(before?.reachable);assert.equal(JSON.parse(before.expected).item,'medkits');assert.equal(after?.count??0,before.count-transfer.count);
  assert.equal(staged.operativeState[transfer.id].medkits,1);
 }
 const aid=events.find(row=>row.event==='provincialEmergencyAid');assert.ok(aid?.officialMidpoint);assert.equal(aid.elapsedSeconds,6);
 assert.deepEqual(aid.steps.filter(action=>action.type==='useItem'),[{type:'useItem',unitId:'117',targetId:'117'},{type:'useItem',unitId:'108',targetId:'108'}]);
 let pair=visit(staged);
 for(let index=0;index<aid.steps.length;index++){
  const battle=actBattle(pair.battle,aid.steps[index]);assert.equal(battle.lastError,null);pair=sync({campaign:pair.campaign,battle});
  if(index===Math.floor(aid.steps.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 }
 assert.deepEqual(leave(pair),completed,'Every paid emergency order replays exactly across the official tactical save.');
 for(const id of [117,108]){assert.equal(completed.operativeState[id].alive,true);assert.equal(completed.operativeState[id].hp,start.operativeState[id].hp);assert.equal(completed.operativeState[id].bleeding,0);assert.equal(completed.operativeState[id].medkits,0);}
 assert.equal(completed.operativeState[146].medkits,8,'Self-care consumes recovered linen without spending or duplicating the remote doctor stock.');
 assert.equal(completed.resources.treasury,start.resources.treasury);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(completed.operativeState[id].alive,false);assert.equal(completed.operativeState[id].deathMinute,record.deathMinute);}
 assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);
});
