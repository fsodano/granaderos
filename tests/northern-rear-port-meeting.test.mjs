import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {meetNorthernRearPort} from './fresh-northern-fixture.mjs';
import {order,saved,visit,tactical,leave} from './local-contract-fixture.mjs';
import {playerKnownBattle} from '../game/player-known-state.js';

test('the native night port meeting finds the edge resident and follows public memory around the window wall',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-rear-port-native-campaign.json.gz',import.meta.url))),provenance=JSON.parse(readFileSync(new URL('./fixtures/northern-rear-port-native-campaign.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),provenance.sourceSha256);
 const start=JSON.parse(raw),before=structuredClone(start),events=[];
 assert.deepEqual(saved({campaign:start}).campaign,start,'the earned native input is an official campaign save');
 const final=meetNorthernRearPort(start,146,{report:event=>events.push(event)}),event=events.find(row=>row.event==='northernRearPortAgreement');
 assert.ok(event);assert.deepEqual(start,before);
 assert.equal(final.resources.treasury,start.resources.treasury);assert.equal(final.activeSquadId,start.activeSquadId);
 assert.equal(final.operativeState[146].assignment,start.operativeState[146].assignment);assert.equal(final.operativeState[146].medkits,start.operativeState[146].medkits);
 assert.equal(final.pendingBattle,null);assert.ok(final.townIncome.activations.buenos_aires);
 for(const id of provenance.priorDeadOperatives)assert.equal(final.operativeState[id].alive,false);
 assert.deepEqual(saved({campaign:final}).campaign,final);

 // Replay the reported ordinary orders through the native dispatcher. A
 // midway official save must preserve the window discovery and occluded walk.
 const rear=start.squads.find(row=>row.location==='buenos_aires'&&row.members.includes(146)&&!row.journey);
 let campaign=order(start,rear?{type:'selectSquad',id:rear.id}:{type:'createSquad',ids:[146],name:'Administración de retaguardia',sector:'buenos_aires'});
 campaign=order(campaign,{type:'assignCare',operativeId:146,assignment:'active'});
 let pair=visit(campaign),seen=false,occluded=false,firstKnown=null;
 for(const [index,action]of event.actions.entries()){
  assert.ok(['look','move'].includes(action.type),'search and approach use ordinary physical orders');
  const wasKnown=playerKnownBattle(pair.battle).npcs.some(npc=>npc.id==='local-buenos_aires');
  pair=tactical(pair,action);
  const npc=playerKnownBattle(pair.battle).npcs.find(npc=>npc.id==='local-buenos_aires');
  if(npc&&!seen){firstKnown={hour:pair.campaign.hour,second:pair.campaign.secondOfHour,npc:structuredClone(npc)};seen=true;}
  if(!occluded&&seen&&wasKnown&&!npc&&action.type==='move'){occluded=true;pair=saved(pair);}
  if(index===Math.floor(event.actions.length/2))pair=saved(pair);
 }
 assert.ok(seen);assert.ok(occluded,'the real window approach loses sight before entering through the open door');
 assert.deepEqual(firstKnown,event.firstObserved);
 const npc=playerKnownBattle(pair.battle).npcs.find(npc=>npc.id==='local-buenos_aires'),actor=pair.battle.units.find(unit=>unit.id==='146');
 assert.ok(npc,'the conversation requires fresh public visibility');assert.ok(Math.abs(actor.x-npc.x)+Math.abs(actor.y-npc.y)<=1);
 campaign=order(pair.campaign,{type:'talkNPC',npcId:npc.id,unitId:146,approach:'direct',sectorState:pair.battle});
 assert.equal(campaign.lastConversation.outcome,'incomeActivated');
 campaign=leave(saved({campaign,battle:pair.battle}));
 if(start.operativeState[146].assignment!=='active')campaign=order(campaign,{type:'assignCare',operativeId:146,assignment:start.operativeState[146].assignment});
 campaign=order(campaign,{type:'selectSquad',id:start.activeSquadId});
 assert.deepEqual(saved({campaign}).campaign,final,'the saved action replay retains the exact meeting and restored field state');
});
