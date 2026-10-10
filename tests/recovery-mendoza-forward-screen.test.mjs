import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,firearmShotOptions} from '../game/tactical.js';
import {fight} from './opening-driver.mjs';
import {recoveryMendozaOrder} from './recovery-mendoza-driver.mjs';

const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=JSON.parse(fixture('recovery-mendoza-forward-screen.provenance.json'));
function readFixture(name){
 const gzip=fixture(name),raw=gunzipSync(gzip),expected=proof.files[name];
 assert.equal(sha(gzip),expected.gzipSha256);assert.equal(sha(raw),expected.rawSha256);
 return raw.toString();
}

test('the earned recovery assault wins with a paid forward screen and retains native deaths and gun expenditure',t=>{
 const input=decodeSave(readFixture('recovery-mendoza-earned-ready.save.json.gz'));
 const before=structuredClone(input),campaign=input.campaign,request=campaign.pendingBattle,previous=campaign.sectorStates.mendoza;
 const tape=JSON.parse(readFixture('recovery-mendoza-forward-screen-replay.json.gz'));
 assert.deepEqual([campaign.hour,campaign.secondOfHour],[417,105]);assert.equal(request.sector,'mendoza');
 assert.deepEqual(input.battle,enterSector(request,previous));
 for(const id of proof.priorDeadIds)assert.equal(campaign.operativeState[id].alive,false);
 const result=fight(request,previous,{controller:recoveryMendozaOrder});
 assert.equal(result.battle.status,'victory');assert.deepEqual(result.orders,tape.orders);assert.deepEqual(result.battle,tape.battle);
 assert.equal(result.battle.elapsedSeconds,825);assert.equal(result.battle.turn,7);
 assert.deepEqual(result.battle.units.filter(u=>u.side==='player'&&u.hp<=0).map(u=>Number(u.id)),[130,10]);
 let replay=input.battle,replayCampaign=campaign;
 for(let i=0;i<result.orders.length;i++){
  const action=result.orders[i];
  if(action.type==='fire'){
   const unit=replay.units.find(u=>u.id===action.unitId),target=replay.units.find(u=>u.id===action.targetId);
   const preview=firearmShotOptions(replay,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
   assert.ok(preview);assert.equal(Boolean(preview.interveningFriendly||preview.shots?.some(shot=>shot.interveningFriendly)),false);
  }
  replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null);
  if(i===tape.receipt.midpoint.orderIndex){
   const synced=syncBattleTime(replayCampaign,replay);assert.equal(synced.error,null);
   const restored=decodeSave(encodeSave(synced.campaign,synced.battle));replayCampaign=restored.campaign;replay=restored.battle;
  }
 }
 const original=syncBattleTime(campaign,result.battle),replayed=syncBattleTime(replayCampaign,replay);
 assert.equal(original.error,null);assert.equal(replayed.error,null);assert.deepEqual(replayed,original);
 const settle=pair=>{
  const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
  const settled=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
  assert.equal(settled.lastError,null);assert.deepEqual(decodeSave(encodeSave(settled)).campaign,settled);return settled;
 };
 const settled=settle(original);assert.deepEqual(settle(replayed),settled);assert.deepEqual(settled,decodeSave(tape.officialSettled).campaign);
 assert.equal(settled.sectors.mendoza.owner,'patriot');
 for(const id of [...proof.priorDeadIds,130,10])assert.equal(settled.operativeState[id].alive,false);
 const gun=result.battle.artillery.find(gun=>gun.id==='arsenal:cordoba:1');assert.equal(gun.loaded,false);assert.equal(gun.ammo,0);
 assert.deepEqual(input,before);
 t.diagnostic(JSON.stringify({orders:result.orders.length,priorDeaths:proof.priorDeadIds.length,newDeaths:[130,10],officialMidpointReplay:true,scope:'earned Mendoza segment; not a complete recovery campaign proof'}));
});
