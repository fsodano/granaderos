import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {missionContacts} from '../game/missions.js';
import {fightNorthernSector} from './northern-route.mjs';
import {stabilizeFreshMissionAllies} from './fresh-campaign-route.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stem='./fixtures/earned-original-san-lorenzo-before-settlement';
const proof=JSON.parse(readFileSync(new URL(`${stem}.provenance.json`,import.meta.url))),compressed=readFileSync(new URL(`${stem}.json.gz`,import.meta.url)),raw=gunzipSync(compressed);
assert.equal(sha(compressed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
const earned=JSON.parse(raw);assert.equal(sha(earned.readySave),proof.sourceReadySaveSha256);
const input=()=>decodeSave(earned.readySave),clock=s=>s.hour*3600+(s.secondOfHour??0);
const ally=b=>b.units.find(u=>u.id==='57'&&u.missionAlly),kits=b=>b.units.filter(u=>u.side==='player').reduce((n,u)=>n+(u.medkits??0),0);

// Replay the exact earned native combat tape. This bounded file does not
// repeat preparation or claim the later original route has completed.
function replayEarnedCombat(request,previous){
 const ready=input();assert.deepEqual(request,ready.campaign.pendingBattle);assert.equal(previous,undefined);
 let battle=enterSector(request,previous);
 for(const action of earned.nativeResult.orders){battle=action.type==='endTurn'?endTurn(battle):actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action));}
 assert.deepEqual(battle,earned.nativeResult.battle);
 assert.equal(battle.status,'victory');assert.equal(battle.turn,proof.nativeTurns);assert.equal(earned.nativeResult.actions,proof.nativeActions);
 return {...earned.nativeResult,battle};
}

test('the default northern settlement preserves the original earned victory and its untreated mission wound',()=>{
 const start=input().campaign,before=structuredClone(start),result=fightNorthernSector(start,'san_lorenzo',{executeBattle:replayEarnedCombat});
 const synchronized=syncBattleTime(start,earned.nativeResult.battle);assert.equal(synchronized.error,null);
 const restored=decodeSave(encodeSave(synchronized.campaign,synchronized.battle));
 const original=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:start.pendingBattle.id,outcome:'victory',survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
 assert.equal(original.lastError,null);assert.deepEqual(result.campaign,original);assert.equal(result.summary.beforeSettlement,undefined);
 assert.deepEqual([original.missionAllies.san_lorenzo.hp,original.missionAllies.san_lorenzo.bleeding],[17,6]);assert.deepEqual(start,before);
});

test('the original San Lorenzo route gives its real ally finite field aid before settlement and keeps every paid order in saved replay',t=>{
 const start=input().campaign,before=structuredClone(start),events=[];
 const result=fightNorthernSector(start,'san_lorenzo',{executeBattle:replayEarnedCombat,beforeSettlement:stabilizeFreshMissionAllies,report:event=>events.push(event)}),s=result.campaign,battle=s.sectorStates.san_lorenzo,field=result.summary.beforeSettlement;
 assert.equal(s.pendingBattle,null);assert.equal(s.defeated,false);assert.equal(s.flags.sanLorenzo,true);assert.equal(s.phase,2);
 assert.deepEqual([ally(earned.nativeResult.battle).hp,ally(earned.nativeResult.battle).bleeding],[17,6]);
 assert.deepEqual([ally(battle).hp,ally(battle).bleeding,ally(battle).bandaged],[15,0,73]);assert.equal(ally(battle).maxHp,88);
 assert.deepEqual(field.orders.map(a=>a.type),['explore','weapon','move','useItem','weapon','move','useItem','move','useItem']);
 assert.deepEqual(field.orders.filter(a=>a.type==='useItem').map(a=>[a.unitId,a.targetId]),[['125','57'],['124','111'],['124','57']]);
 assert.equal(field.elapsedSeconds,52);assert.equal(clock(s)-clock(start),earned.nativeResult.battle.elapsedSeconds+52);
 assert.equal(kits(earned.nativeResult.battle),18);assert.equal(kits(battle),15);assert.equal(s.resources.treasury,start.resources.treasury+250,'settlement credits only the existing native victory funds');
 for(const u of earned.nativeResult.battle.units){
  const after=battle.units.find(v=>v.id===u.id);assert.equal(after.loaded,u.loaded);assert.equal(after.ammo,u.ammo);assert.deepEqual(after.inventory,u.inventory);
  if(u.hp<=0)assert.equal(after.hp,0,'field care cannot restore a native death');
 }
 for(const id of [...proof.earlierCapitalDeaths,...proof.nativeBattleDeaths]){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);}
 assert.equal(s.operativeState[57].alive,true);assert.equal(s.operativeState[57].bleeding,0);
 const later=missionContacts(s).find(n=>n.id==='yatasto-san-martin');assert.equal(later.hp,15);assert.equal(later.bleeding,0,'the later mission contact carries the actually treated wound');
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);assert.deepEqual(start,before);
 const aid=events.find(e=>e.event==='freshMissionAllyFieldAid');assert.deepEqual(aid.steps,field.orders);assert.deepEqual(aid.untreated,[]);assert.equal(aid.stoppedReason,null);assert.equal(aid.dressingsSpent,3);assert.equal(aid.treasuryAfter,aid.treasuryBefore);
 t.diagnostic(JSON.stringify({scope:'Exact earned combat plus finite post-victory aid and settlement; no later-route completion claim',nativeActions:158,nativeOrders:180,fieldOrders:field.orders.length,fieldSeconds:52,dressingsSpent:3,ally:{hp:15,bleeding:0,bandaged:73},clock:[s.hour,s.secondOfHour],nativeDeaths:proof.nativeBattleDeaths,officialMidpointReplay:true}));
});

test('the settlement callback rejects a replacement health result that has no native paid orders',()=>{
 const start=input().campaign,before=structuredClone(start);
 assert.throws(()=>fightNorthernSector(start,'san_lorenzo',{executeBattle:replayEarnedCombat,beforeSettlement:pair=>{
  const forged=structuredClone(pair);ally(forged.battle).hp=88;ally(forged.battle).bleeding=0;return forged;
 }}),/field aid cannot replace native order results/);
 assert.deepEqual(start,before);
});
