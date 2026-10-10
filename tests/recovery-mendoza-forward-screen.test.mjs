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
 assert.deepEqual([campaign.hour,campaign.secondOfHour],[417,105]);assert.equal(request.sector,'mendoza');
 const initial=enterSector(request,previous);
 assert.equal(initial.wallGeometryVersion,2);assert.ok(initial.wallEdges.length>0);
 assert.ok(initial.tiles.every(tile=>!['wall','door','window'].includes(tile.type)));
 assert.deepEqual(initial.units,input.battle.units,'native admission retains the actually earned field roster and health');
 assert.deepEqual(initial.artillery,input.battle.artillery,'the actually paid finite gun enters without replenishment');
 for(const id of proof.priorDeadIds)assert.equal(campaign.operativeState[id].alive,false);
 const result=fight(request,previous,{controller:recoveryMendozaOrder});
 assert.equal(result.battle.status,'victory');assert.ok(result.battle.elapsedSeconds>0);
 const newDeaths=result.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0&&initial.units.some(old=>old.id===unit.id&&old.hp>0)).map(unit=>Number(unit.id));
 assert.ok(newDeaths.length>0,'native combat must retain its actual new casualties');
 for(const id of newDeaths)assert.equal(campaign.operativeState[id].alive,true,'a new casualty must have entered the earned assault alive');
 const midpoint=Math.floor(result.orders.length/2);
 let replay=structuredClone(initial),replayCampaign=campaign;
 for(let i=0;i<result.orders.length;i++){
  const action=result.orders[i];
  if(action.type==='fire'){
   const unit=replay.units.find(u=>u.id===action.unitId),target=replay.units.find(u=>u.id===action.targetId);
   const preview=firearmShotOptions(replay,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
   assert.ok(preview);assert.equal(Boolean(preview.interveningFriendly||preview.shots?.some(shot=>shot.interveningFriendly)),false);
  }
  replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null);
  if(i===midpoint){
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
 const settled=settle(original);assert.deepEqual(settle(replayed),settled);
 assert.equal(settled.sectors.mendoza.owner,'patriot');
 for(const id of [...proof.priorDeadIds,...newDeaths])assert.equal(settled.operativeState[id].alive,false);
 const gun=result.battle.artillery.find(gun=>gun.id==='arsenal:cordoba:1');assert.equal(gun.loaded,false);assert.equal(gun.ammo,0);
 assert.deepEqual(input,before);
 t.diagnostic(JSON.stringify({orders:result.orders.length,seconds:result.battle.elapsedSeconds,turn:result.battle.turn,priorDeaths:proof.priorDeadIds.length,newDeaths,officialMidpointReplay:true,scope:'earned native Mendoza segment; not a complete recovery campaign proof'}));
});
