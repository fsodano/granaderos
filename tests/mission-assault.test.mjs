import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {missionAssaultSquads} from '../game/mission-assault.js';
import {secureArea} from './secured-area-fixture.mjs';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function ready(){
 // Established-area fixture isolates multi-squad mission admission and return.
 let s=secureArea(initialCampaign(8));s.phase=1;s.flags.academy=true;s.sectors.san_nicolas.owner='patriot';
 for(const id of [100,101,102,103,104,107,108,112])s=order(s,{type:'recruitCivic',id,term:'week'});
 s=order(s,{type:'squad',ids:[100,101,102,103,104,107]});const first=s.activeSquadId;
 s=order(s,{type:'createSquad',ids:[108,112],name:'Apoyo del convento'});const second=s.activeSquadId;
 for(const id of [first,second]){s=order(s,{type:'selectSquad',id});s=order(s,{type:'travel',sector:'san_nicolas'});}
 return {s,ids:[second,first]};
}
test('explicit local squads deploy together with one commander and complete save and return records',()=>{
 let {s,ids}=ready();const before=structuredClone(s),stock=structuredClone(s.ammunitionShops),funds=s.resources.treasury;
 s=order(s,{type:'attack',sector:'san_lorenzo',squadIds:ids});
 assert.equal(s.pendingBattle.squad.length,8);assert.equal(s.pendingBattle.missionAllies.length,1);
 assert.deepEqual(s.pendingBattle.assaultSquads.map(q=>q.id),ids);assert.deepEqual(s.ammunitionShops,stock);assert.equal(s.resources.treasury,funds);
 assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 const pair=prepareCampaignBattle(s,{placement:true});assert.equal(pair.error,null,pair.error);
 assert.equal(pair.battle.deployment.units.length,8);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).battle,pair.battle);
 const report=scriptedBattleReport(s);s=order(s,report);
 assert.equal(s.flags.sanLorenzo,true);assert.equal(s.pendingBattle,null);
 for(const id of ids)assert.deepEqual(s.squads.find(q=>q.id===id).members,before.squads.find(q=>q.id===id).members);
 for(const id of [100,101,102,103,104,107,108,112])assert.equal(s.operativeState[id].location,'san_nicolas');
 assert.ok(!s.recruited.includes(57));assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('unselected squads remain outside the mission and legacy single-squad orders still work',()=>{
 const {s,ids}=ready(),next=order(s,{type:'attack',sector:'san_lorenzo'});
 assert.equal(next.pendingBattle.squad.length,2);assert.equal(next.pendingBattle.assaultSquads,undefined);
 assert.deepEqual(next.squads.find(q=>q.id===ids[1]),s.squads.find(q=>q.id===ids[1]));
});
test('foreign, duplicate, unavailable and stale support selections reject atomically',()=>{
 const {s,ids}=ready();
 for(const selection of [[],[ids[0],ids[0]],['unknown'],[ids[1]],ids.concat('unknown')]){
  const before=structuredClone(s),next=dispatchCampaign(s,{type:'attack',sector:'san_lorenzo',squadIds:selection});assert.ok(next.lastError);assert.deepEqual(s,before);assert.equal(next.pendingBattle,null);assert.deepEqual(next.resources,s.resources);
 }
 for(const change of [state=>state.squads.find(q=>q.id===ids[1]).location='retiro',state=>state.operativeState[100].asleep=true,state=>state.operativeState[100].assignment='rest',state=>state.operativeState[100].hp=10]){
  const changed=structuredClone(s);change(changed);const next=dispatchCampaign(changed,{type:'attack',sector:'san_lorenzo',squadIds:ids});assert.ok(next.lastError);assert.equal(next.pendingBattle,null);
 }
 assert.ok(missionAssaultSquads(s).every(q=>!q.reason));
});
test('mission manifest saves reject missing members, foreign origins and changed entry receipts',()=>{
 const {s,ids}=ready(),deployed=order(s,{type:'attack',sector:'san_lorenzo',squadIds:ids});
 for(const change of [state=>state.pendingBattle.assaultSquads[0].members.pop(),state=>state.pendingBattle.assaultSquads[0].origin='retiro',state=>state.pendingBattle.squad[0].entryEdge='W']){
  const bad=structuredClone(deployed);change(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));
 }
});

test('commander loss in a cleared multi-squad mission retains survivors without victory rewards',()=>{
 const {s,ids}=ready(),deployed=order(s,{type:'attack',sector:'san_lorenzo',squadIds:ids});
 const next=order(deployed,scriptedBattleReport(deployed,{units:[{id:57,hp:0},{id:100,hp:0}]}));
 assert.equal(next.defeated,true);assert.equal(next.flags.sanLorenzo,false);
 assert.equal(next.resources.treasury,deployed.resources.treasury);
 assert.equal(next.operativeState[100].alive,false);assert.equal(next.operativeState[102].captured,false);
 assert.deepEqual(restoreCampaign(serializeCampaign(next)),next);
});

test('a supporting soldier can physically withdraw and save before the mission is resolved',()=>{
 const {s,ids}=ready(),deployed=order(s,{type:'attack',sector:'san_lorenzo',squadIds:ids});
 let pair=prepareCampaignBattle(deployed);assert.equal(pair.error,null);
 const before=pair.battle.units.find(u=>u.id==='108');assert.equal(before.y,pair.battle.height-1);
 const exit=pair.battle.exits.find(e=>e.destination==='san_nicolas');assert.ok(exit);
 const battle=actBattle(pair.battle,{type:'exit',unitIds:['108'],exitId:exit.id});assert.equal(battle.lastError,null);
 assert.equal(battle.units.find(u=>u.id==='108').departure.destination,'san_nicolas');
 pair=syncBattleTime(pair.campaign,battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(restored.battle.units.find(u=>u.id==='108').departure,battle.units.find(u=>u.id==='108').departure);
 assert.equal(restored.campaign.pendingBattle.squad.length,8);
});
