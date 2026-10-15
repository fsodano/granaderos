import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {fundedRouteContent} from './funded-route-fixture.mjs';
import {stockAndCarriedAmmo} from './ammunition-balance.mjs';
import {prepareFreshTucumanAssault} from './fresh-campaign-route.mjs';

const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>decodeSave(encodeSave(c)).campaign;
const clock=c=>c.hour*3600+(c.secondOfHour??0);

test('default doctor preparation resolves two real queued encounters before touching recovery assignments',()=>{
 // Fresh authored subsystem, with the ordinary funded route's initial budget.
 // People, contracts, fortification and both enemy columns are Native results.
 let c=initialCampaign(42,fundedRouteContent());
 for(const id of [110,114,136,141,120,131])c=order(c,{type:'recruitCivic',id,term:'week'});
 c=order(c,{type:'wait',hours:6});assert.equal(c.recruited.length,6);
 while(c.sectors.retiro.fort<3)c=order(c,{type:'fortify',sector:'retiro'});
 const reserves=c.enemyReserves.remaining.coast;
 const first=launchEnemyGroup(c,'coast','retiro',{immediate:true}),second=launchEnemyGroup(c,'coast','retiro',{immediate:true});assert.ok(first&&second);
 assert.equal(c.enemyReserves.remaining.coast,reserves-first.initialStrength-second.initialStrength);
 c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter.groupId,first.id);
 const start=saved(c),before=structuredClone(start),events=[],entries=[],stop={boundedEntryDefenseComplete:true};
 let returned;
 assert.throws(()=>prepareFreshTucumanAssault(start,{report:event=>events.push(event),onCheckpoint:(name,campaign)=>{
  if(name!=='tucuman-preparation-input')return;
  entries.push(structuredClone(campaign));
  if(entries.length!==3)return;
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
  assert.equal(campaign.defeated,false);assert.equal(campaign.completed,false);
  for(const group of [first,second]){
   assert.equal(campaign.enemyGroups.find(g=>g.id===group.id).status,'defeated');
   assert.equal(campaign.encounterHistory.filter(row=>row.groupId===group.id&&row.outcome==='victory').length,1);
  }
  returned=structuredClone(campaign);throw stop;
 }}),error=>error===stop);
 assert.deepEqual(entries.slice(0,2).map(entry=>entry.pendingEncounter.groupId),[first.id,second.id]);
 const defenses=events.filter(event=>event.event==='tucumanRecoveryDefense');assert.deepEqual(defenses.map(event=>event.groupId),[first.id,second.id]);
 for(const defense of defenses){assert.equal(defense.summary.status,'victory');assert.ok(defense.summary.actions>0);assert.ok(defense.summary.turns<=80);assert.ok(defense.summary.elapsedSeconds>0);assert.equal(defense.campaign.pendingBattle,null);}
 assert.ok(clock(returned)>clock(start));assert.ok(stockAndCarriedAmmo(returned)<stockAndCarriedAmmo(start),'The actual defenses consume finite owned ammunition.');
 assert.deepEqual(saved(returned),returned);assert.deepEqual(start,before);
});
