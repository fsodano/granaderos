import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {syncBattleTime} from '../game/time.js';
import {withdrawCommandToRear} from './command-reserve-driver.mjs';
import {withdrawCoastalCommandToRear} from './coastal-command-reserve.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const name='./fixtures/earned-stock-coast-capital-defense',proof=JSON.parse(readFileSync(new URL(`${name}.provenance.json`,import.meta.url))),gzip=readFileSync(new URL(`${name}.save.json.gz`,import.meta.url)),raw=gunzipSync(gzip);
 assert.equal(sha(gzip),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
 const campaign=decodeSave(raw.toString()).campaign;
 assert.deepEqual([campaign.hour,campaign.secondOfHour,campaign.resources.treasury],[...proof.clock,proof.treasury]);
 return {campaign,proof};
}

test('the earned coastal commander uses the authorized west–north corner and pays his real Retiro exit without changing physical stock',t=>{
 const {campaign,proof}=fixture(),beforeCampaign=structuredClone(campaign),request=campaign.pendingBattle;
 assert.equal(request.sector,'buenos_aires');assert.equal(request.defenseGroupId,proof.nativeDefenseGroupId);assert.equal(request.enemies.length,21);
 const initial=enterSector(request,campaign.sectorStates.buenos_aires),start=enterSector(request,campaign.sectorStates.buenos_aires,{placement:true}),before=structuredClone(start),commander=initial.units.find(u=>u.id==='57'),model=sectorDeploymentModel(start);
 assert.deepEqual([commander.x,commander.y,commander.entryEdge],[0,25,'W']);assert.equal(initial.exits.find(e=>e.destination==='retiro').edge,'N');
 assert.throws(()=>withdrawCommandToRear(initial,57,'retiro')(start),/Debe alcanzar el borde de esta salida/,'The original edge mismatch must remain refused.');
 const actions=[],result=withdrawCoastalCommandToRear(initial,57,'retiro',{onOrder:action=>actions.push(action)})(start),withdrawn=result.units.find(u=>u.id==='57');
 assert.ok(model.entryCells.W.some(p=>p.x===withdrawn.x&&p.y===withdrawn.y));assert.deepEqual([withdrawn.x,withdrawn.y],[0,0]);
 assert.deepEqual(withdrawn.departure,{exitId:'buenos_aires:retiro',edge:'N',destination:'retiro',x:0,y:0,elapsedSeconds:3,mountId:null});
 assert.equal(result.elapsedSeconds,3);assert.ok(withdrawn.energy<commander.energy);assert.equal(result.status,'active');assert.equal(result.deploymentComplete,true);
 const physical=['hp','maxHp','bleeding','bandaged','ammo','loaded','loadedAmmoType','reloadProgress','ammunition','ammunitionVersion','medkits','rations','tonic','grenades','toolkitPoints','weapon','weaponInstanceId','weaponMetadata','condition','weaponFittings','weaponFittingPattern','blade','bladeInstanceId','bladeMetadata','bladeCondition','bladeFittingPattern','inventory','headwear','outfit','legwear'];
 for(const unit of result.units){
  const old=initial.units.find(u=>u.id===unit.id);assert.ok(old);
  for(const key of physical)assert.deepEqual(unit[key],old[key],`${unit.id}: ${key} remains in physical custody`);
  if(unit.hp<=0)assert.deepEqual(unit,old,'Every prior casualty stays in the scene.');
  if(unit.side==='player'&&unit.id!=='57')assert.equal(unit.departure,undefined);
 }
 assert.deepEqual(result.artillery,initial.artillery);assert.deepEqual(result.groundItems,initial.groundItems);
 let replay=enterSector(request,campaign.sectorStates.buenos_aires,{placement:true});
 for(const action of actions){replay=action.type==='exit'?actBattle(replay,action):sectorDeploymentAction(replay,action);assert.equal(replay.lastError,null);if(action.type==='confirmDeployment')replay=decodeSave(encodeSave(campaign,replay)).battle;}
 assert.deepEqual(replay,result,'Every placement and crossing replays through the official deployment save.');
 const pair=syncBattleTime(campaign,result);assert.equal(pair.error,null);assert.equal(pair.campaign.hour*3600+pair.campaign.secondOfHour,campaign.hour*3600+campaign.secondOfHour+3);assert.equal(pair.campaign.resources.treasury,campaign.resources.treasury);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
 assert.deepEqual(campaign,beforeCampaign);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Earned native defense deployment and paid boundary withdrawal only; no defense victory or port arrival.',group:request.defenseGroupId,authorizedArrival:'W',exit:'N',commanderHP:withdrawn.hp,seconds:result.elapsedSeconds,retainedNativeEnemies:request.enemies.length,retainedField:proof.fieldIds.length,orders:actions.length,officialReplay:true}));
});

test('a coastal withdrawal cannot invent a placement on the opposite arrival edge',()=>{
 const {campaign}=fixture(),initial=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires),start=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires,{placement:true}),before=structuredClone(start),actions=[];
 assert.throws(()=>withdrawCoastalCommandToRear(initial,57,'ensenada',{onOrder:action=>actions.push(action)})(start),/actual arrival edge must have a legal cell/);
 assert.deepEqual(start,before);assert.deepEqual(actions,[]);
});
