import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,firearmShotOptions,teamCanSee,transferPreview} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {recoveryMendozaDressingOrder,recoveryMendozaOrder} from './recovery-mendoza-driver.mjs';
import {recordRouteBattleFailure} from './route-failure-evidence.mjs';
import {admitEarnedArtilleryPair} from './earned-artillery-admission-fixture.mjs';

const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=JSON.parse(fixture('earned-original-mendoza-readiness.provenance.json'));
function load(){
 const name='earned-original-mendoza-readiness.native-input.json.gz',compressed=fixture(name),raw=gunzipSync(compressed),record=proof.files[name];
 assert.equal(sha(compressed),record.gzipSha256);assert.equal(compressed.length,record.gzipBytes);
 assert.equal(sha(raw),record.rawSha256);assert.equal(raw.length,record.rawBytes);
 assert.equal(proof.preExecutionInputIndependentlyCaptured,false,'retained arguments are not an independent initial capture');
 const input=JSON.parse(raw),{request}=input;let {campaign}=input;
 assert.deepEqual(request,campaign.pendingBattle);
 assert.deepEqual([campaign.hour,campaign.secondOfHour,campaign.resources.treasury],[872,3474,62765]);
 assert.deepEqual(request.squad.map(u=>u.id),proof.fieldIds);assert.deepEqual(request.artillery,[proof.gun]);
 const battle=enterSector(request,campaign.sectorStates.mendoza);
 assert.deepEqual(battle.units.filter(u=>u.side==='player').map(u=>Number(u.id)),proof.fieldIds);
 for(const unit of battle.units.filter(u=>u.side==='player')){
  assert.equal(unit.hp,unit.maxHp);assert.equal(unit.bleeding,0);assert.equal(unit.loaded,1);assert.equal(unit.ammo,11);
 }
 assert.equal(battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),2);
 const admitted=admitEarnedArtilleryPair({campaign,battle},{sectors:['retiro','buenos_aires','san_nicolas','san_lorenzo','cordoba','tucuman','salta'],scenes:{yatasto:'tucuman'},currentBattle:true,label:'original Mendoza readiness pair'});
 campaign=admitted.campaign;
 assert.deepEqual(admitted,{campaign,battle},'official admission preserves the complete earned campaign and freshly constructed native scene after marker-only legacy admission');
 return {input,campaign,request,battle};
}

test('the retained Mendoza request gives its two actual dressings to a qualified physician through a paid native relay',()=>{
 const {input,campaign,battle}=load(),before=structuredClone(input),donor=battle.units.find(u=>u.id==='142'),physician=battle.units.find(u=>u.id==='10');
 assert.equal(donor.medkits,2);assert.equal(physician.medical,98);assert.equal(physician.medkits,0);
 const action=recoveryMendozaDressingOrder(battle,donor);
 assert.deepEqual(action,{type:'transfer',unitId:'142',targetId:'10',item:'medkits',count:2,transferKind:'relay',transferRoute:transferPreview(battle,donor,physician,'medkits',2).route.map(u=>u.id)});
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 assert.equal(next.units.find(u=>u.id==='142').medkits,0);assert.equal(next.units.find(u=>u.id==='10').medkits,2);
 assert.equal(next.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),2);
 assert.ok(next.elapsedSeconds>battle.elapsedSeconds);assert.equal(next.seed,battle.seed,'a certain adjacent relay does not roll a throw');
 for(const unit of battle.units.filter(u=>u.side==='player')){
  const after=next.units.find(u=>u.id===unit.id);
  for(const key of ['hp','maxHp','bleeding','bandaged','weapon','loaded','ammo'])assert.equal(after[key],unit[key]);
 }
 const pair=syncBattleTime(campaign,next);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(restored,{campaign:pair.campaign,battle:pair.battle});assert.deepEqual(actBattle(structuredClone(battle),action),next);
 assert.equal(recoveryMendozaDressingOrder(next,next.units.find(u=>u.id==='142')),null);
 assert.deepEqual(input,before);
});

test('the complete earned Mendoza force wins natively with its real gun, linen, casualties and official order replay',t=>{
 const {input,campaign,request,battle:initial}=load(),before=structuredClone(input);
 const priorDead=Object.entries(campaign.operativeState).filter(([,r])=>!r.alive).map(([id])=>id);
 const result=fight(request,campaign.sectorStates.mendoza,{controller:recoveryMendozaOrder});
 t.diagnostic(JSON.stringify({status:result.battle.status,turns:result.battle.turn,actions:result.actions,orders:result.orders.length,elapsedSeconds:result.battle.elapsedSeconds,scope:'complete earned Mendoza segment; not a complete fresh recovery campaign'}));
 if(result.battle.status!=='victory')recordRouteBattleFailure({campaign,request,previous:campaign.sectorStates.mendoza,result,expectedOutcome:'victory',controller:recoveryMendozaOrder,executeBattle:fight});
 assert.equal(result.battle.status,'victory','retain the original native victory gate');
 assert.ok(result.battle.turn<=80);assert.ok(result.battle.elapsedSeconds>0);
 // openingControlWindow orders actual nonmilitia players by marksmanship.
 // The unique highest score is142, whose first proposal is the native relay.
 const orderIds=initial.units.filter(u=>u.side==='player'&&!u.militia).sort((a,b)=>b.marksmanship-a.marksmanship);
 assert.equal(orderIds[0].id,'142');assert.ok(orderIds[0].marksmanship>orderIds[1].marksmanship);
 assert.equal(result.orders[0].type,'transfer');assert.equal(result.orders[0].count,2);
 assert.deepEqual(result.orders.filter(action=>action.type==='transfer'),[result.orders[0]],'the same two carried dressings must not be transferred twice');
 const startGun=initial.artillery.find(g=>g.id===proof.gun.id),endGun=result.battle.artillery.find(g=>g.id===startGun.id);
 assert.ok(endGun);assert.equal(endGun.type,startGun.type);assert.equal(endGun.side,'player');
 const shots=result.orders.filter(action=>action.type==='artillery'&&action.artilleryId===startGun.id).length;
 assert.equal(Number(startGun.loaded)+startGun.ammo-Number(endGun.loaded)-endGun.ammo,shots,'every shot debits the same finite gun');
 let replay=structuredClone(initial),replayCampaign=campaign;
 for(let i=0;i<result.orders.length;i++){
  const action=result.orders[i];
  if(action.type==='transfer'){
   const donor=replay.units.find(u=>u.id===action.unitId),recipient=replay.units.find(u=>u.id===action.targetId),preview=transferPreview(replay,donor,recipient,action.item,action.count);
   assert.equal(preview.valid,true);assert.notEqual(preview.kind,'throw');
   assert.equal(donor.medkits,2);assert.equal(recipient.medkits,0);
  }
  if(action.type==='fire'){
   const unit=replay.units.find(u=>u.id===action.unitId),target=replay.units.find(u=>u.id===action.targetId);
   assert.ok(teamCanSee(replay,unit.side,target));
   const preview=firearmShotOptions(replay,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
   assert.ok(preview);assert.equal(Boolean(preview.interveningFriendly||preview.shots?.some(shot=>shot.interveningFriendly)),false);
  }
  replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null);
  if(i===Math.floor(result.orders.length/2)){
   const paired=syncBattleTime(replayCampaign,replay);assert.equal(paired.error,null);
   const restored=decodeSave(encodeSave(paired.campaign,paired.battle));replayCampaign=restored.campaign;replay=restored.battle;
  }
 }
 const actual=syncBattleTime(campaign,result.battle),replayed=syncBattleTime(replayCampaign,replay);
 assert.equal(actual.error,null);assert.equal(replayed.error,null);assert.deepEqual(replayed,actual);
 const settle=pair=>{
  const official=decodeSave(encodeSave(pair.campaign,pair.battle));
  const next=dispatchCampaign(official.campaign,{type:'battleResult',battleId:request.id,outcome:official.battle.status,survivors:official.battle.units.filter(u=>u.side==='player'),sectorState:official.battle});
  assert.equal(next.lastError,null);assert.deepEqual(decodeSave(encodeSave(next)).campaign,next);return next;
 };
 const settled=settle(actual);assert.deepEqual(settle(replayed),settled);assert.equal(settled.sectors.mendoza.owner,'patriot');
 assert.equal(settled.defeated,false,'a native route victory must leave the campaign playable');
 assert.equal(settled.pendingBattle,null);assert.equal(settled.pendingEncounter,null);
 const newDead=result.battle.units.filter(u=>u.side==='player'&&u.hp<=0).map(u=>u.id);
 for(const id of [...priorDead,...newDead])assert.equal(settled.operativeState[id].alive,false);
 for(const unit of result.battle.units.filter(u=>u.side==='player')){
  assert.equal(settled.operativeState[unit.id].hp,unit.hp);
  assert.equal(settled.operativeState[unit.id].bleeding,unit.bleeding);
  assert.equal(settled.operativeState[unit.id].medkits,unit.medkits);
 }
 assert.deepEqual(settled.sectorStates.mendoza.artillery.find(g=>g.id===endGun.id),endGun);
 assert.deepEqual(input,before);
 t.diagnostic(JSON.stringify({newDeaths:newDead,remainingGunCharges:Number(endGun.loaded)+endGun.ammo,artilleryShots:shots,officialMidpointReplay:true}));
});
