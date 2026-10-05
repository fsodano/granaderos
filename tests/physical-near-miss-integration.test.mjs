import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {ammoCount} from '../game/ammo-types.js';
import {weaponFor,actionCosts} from '../game/tactical.js';
import {getFirearmNearMissFeedback} from '../game/firearm-near-miss-feedback.js';
import {contextualBanter} from '../game/tactical-feedback.js';
import {speechFor} from '../game/characters.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
import {encodeSave} from '../game/save.js';
import {preparedPhysicalNearMiss,performPhysicalNearMiss,replayPhysicalNearMissPaidPrefix,issuePhysicalNearMiss,physicalNearMissSaved,physicalNearMissActor} from './physical-near-miss-fixture.mjs';

const sourceId='enemy-1',nearFrames=shown=>shown.frames.filter(frame=>frame.nearMissIds?.length);
const stamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
const campaignOrder=(campaign,action)=>{
 const before=structuredClone(campaign),next=dispatchCampaign(campaign,action);
 assert.equal(next.lastError,null,next.lastError);assert.deepEqual(campaign,before);
 return physicalNearMissSaved({campaign:next}).campaign;
};

function assertDischarge(preparation,result,{jammed=false}={}){
 const before=physicalNearMissActor(preparation.pair.battle,sourceId),after=physicalNearMissActor(result.ordinary,sourceId);
 assert.equal(before.loaded,1);assert.equal(after.loaded,jammed?1:0);
 assert.equal(after.ap,0);assert.equal(before.ap,actionCosts(preparation.pair.battle,before,physicalNearMissActor(preparation.pair.battle)).fire);
 assert.equal(after.condition,before.condition-(jammed?0:1));assert.equal(after.jammed,jammed);
 assert.equal(ammoCount(after),ammoCount(before));assert.deepEqual(after.inventory,before.inventory);
 assert.deepEqual(after.weaponMetadata,before.weaponMetadata);
 assert.equal(result.ordinary.elapsedSeconds-preparation.pair.battle.elapsedSeconds,6);
 assert.equal(stamp(result.pair.campaign)-stamp(preparation.pair.campaign),6);
 assert.equal(result.pair.campaign.resources.treasury,preparation.pair.campaign.resources.treasury);
 assert.deepEqual(result.pair.campaign.contracts,preparation.pair.campaign.contracts);
 assert.equal(result.shown.frames.filter(frame=>frame.type==='projectile'&&frame.shotVisual?.discharge!==false).length,jammed?0:1);
 assert.deepEqual(issuePhysicalNearMiss(physicalNearMissSaved(preparation.pair),{type:'endTurn'}).pair,result.pair,'the actual hostile order has exact official saved replay');
}

function returned(preparation,result){
 const history=[{type:'endTurn'}];let pair=result.pair;
 for(const id of ['110','107']){
  const unit=physicalNearMissActor(pair.battle,id);
  pair=issuePhysicalNearMiss(pair,{type:'move',unitId:id,x:unit.x,y:0},history).pair;
 }
 const exit=pair.battle.exits.find(candidate=>candidate.destination==='retiro');assert.ok(exit);
 pair=issuePhysicalNearMiss(pair,{type:'exit',unitIds:['110','107'],exitId:exit.id},history).pair;
 assert.equal(pair.battle.status,'retreat');
 let replay=physicalNearMissSaved(preparation.pair);
 for(const action of history)replay=issuePhysicalNearMiss(replay,action).pair;
 assert.deepEqual(replay,pair,'all paid field orders replay through official saves and ordinary/presented execution');
 const field=structuredClone(pair.battle),request=pair.campaign.pendingBattle;
 const action={type:'battleResult',battleId:request.id,outcome:field.status,sectorState:field,survivors:field.units.filter(unit=>unit.side==='player')};
 let campaign=campaignOrder(pair.campaign,action),replayedCampaign=campaignOrder(replay.campaign,{...action,sectorState:replay.battle,survivors:replay.battle.units.filter(unit=>unit.side==='player')});
 assert.deepEqual(campaign,replayedCampaign);
 assert.equal(campaign.resources.treasury,preparation.pair.campaign.resources.treasury);
 assert.deepEqual(campaign.contracts,preparation.pair.campaign.contracts);
 const repeated=dispatchCampaign(campaign,action);assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null},campaign);
 assert.equal(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===sourceId).loaded,0);
 const visitInput=campaign,beforeVisit=structuredClone(campaign);
 campaign=dispatchCampaign(visitInput,{type:'visitSector'});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(visitInput,beforeVisit,'the real visit preserves its settled input');
 const entered=prepareCampaignBattle(campaign);assert.equal(entered.error,null,entered.error);
 const reentry=physicalNearMissSaved(entered);
 for(const id of ['110','107']){
  const before=physicalNearMissActor(field,id),after=physicalNearMissActor(reentry.battle,id);
  for(const key of ['hp','bleeding','loaded','condition','medkits','inventory','weaponMetadata','skillPractice','trainedStats','practiceSeed'])assert.deepEqual(after[key],before[key],`reentry preserves actual ${id}.${key}`);
  assert.equal(ammoCount(after),ammoCount(before));
 }
 assert.deepEqual(getFirearmNearMissFeedback(field,reentry.battle),[]);
 assert.equal(contextualBanter(field,reentry.battle,3),null,'reentry cannot replay a transient near-shot quote');
 return {field,reentry,history};
}

test('a paid current kinetic and air-drag hostile miss emits one physical own-player event and survives official replay, return and reentry',t=>{
 const preparation=preparedPhysicalNearMiss(),initial=structuredClone(preparation.pair);
 assert.deepEqual(replayPhysicalNearMissPaidPrefix(preparation),preparation.handoff,'quoted paid hires, six-hour arrivals, actual attack and handoff have complete official replay');
 assert.deepEqual(preparation.quotes,[{id:110,price:420},{id:107,price:588}]);
 assert.equal(preparation.pair.campaign.resources.treasury,2192);
 const target=physicalNearMissActor(preparation.pair.battle),source=physicalNearMissActor(preparation.pair.battle,sourceId),weapon=weaponFor(source);
 assert.equal(weapon.id,1800);assert.ok(weapon.projectileEnergy&&weapon.projectileAirDrag);
 const result=performPhysicalNearMiss(preparation);assertDischarge(preparation,result);
 assert.equal(physicalNearMissActor(result.ordinary).hp,target.hp);assert.equal(physicalNearMissActor(result.ordinary).bleeding,0);
 assert.deepEqual(getFirearmNearMissFeedback(preparation.pair.battle,result.ordinary),['110']);
 const frames=nearFrames(result.shown);assert.equal(frames.length,1);
 const frame=frames[0],index=result.shown.frames.indexOf(frame);
 assert.deepEqual(frame.nearMissIds,['110']);assert.equal(frame.unitId,null);assert.equal(frame.type,'impact');
 for(const key of ['shotVisual','targetPoint','source','attackerId','victimId','trajectoryModel'])assert.equal(Object.hasOwn(frame,key),false);
 assert.deepEqual(frame.impacts,[]);assert.equal(battleFrameDuration(frame),0);assert.equal(battleFrameFocus(frame),null);
 assert.ok(result.shown.frames.slice(0,index).some(previous=>previous.type==='projectile'),'the notice follows a real discharged projectile');
 const banter=contextualBanter(preparation.pair.battle,frame.state,3,frame);
 assert.equal(banter?.id,'110');assert.equal(banter?.text,speechFor(target,'near'));assert.match(banter.text,/Bajemos la cabeza/);
 assert.equal(contextualBanter(preparation.pair.battle,frame.state,3,frame),null,'the same paid presentation frame cannot repeat the quote');
 assert.deepEqual(getFirearmNearMissFeedback(preparation.pair.battle,result.pair.battle),[],'official save restoration retains gameplay, not transient event evidence');
 assert.equal(contextualBanter(preparation.pair.battle,result.pair.battle,3),null);
 assert.doesNotMatch(encodeSave(result.pair.campaign,result.pair.battle),/nearMissIds|firearmNearMissFeedback/);
 assert.deepEqual(preparation.pair,initial);
 const lifecycle=returned(preparation,result);
 t.diagnostic(JSON.stringify({scope:'paid native kit in a declared pre-admission flat firing boundary; no conquest claim',quotes:preparation.quotes,treasury:2192,paidOrders:preparation.paidHistory.length,fieldOrders:lifecycle.history.length,source:{id:sourceId,weapon:weapon.id,kinetic:weapon.projectileEnergy,air:weapon.projectileAirDrag,AP:12,charges:[source.loaded,physicalNearMissActor(result.ordinary,sourceId).loaded],condition:[source.condition,physicalNearMissActor(result.ordinary,sourceId).condition]},target:{id:'110',hp:target.hp,after:physicalNearMissActor(result.ordinary).hp},seconds:6,seed:result.ordinary.seed,near:frame.nearMissIds}));
});

test('paid early material stop, real ignition failure and actual wound emit no near event; omitted old speech stays neutral',t=>{
 const receipts=[];
 for(const control of ['stop','misfire','hit']){
  const preparation=preparedPhysicalNearMiss({control}),result=performPhysicalNearMiss(preparation);
  assertDischarge(preparation,result,{jammed:control==='misfire'});
  assert.deepEqual(getFirearmNearMissFeedback(preparation.pair.battle,result.ordinary),[]);assert.deepEqual(nearFrames(result.shown),[]);
  const source=physicalNearMissActor(result.ordinary,sourceId),target=physicalNearMissActor(result.ordinary);
  if(control==='stop'){
   assert.equal(target.hp,85);
   const stop=result.shown.frames.find(frame=>frame.shotVisual?.outcome==='cover');assert.ok(stop);
   assert.ok(stop.shotVisual.impact.x<target.x-2,'the actual projectile stops before the paid player; intended target history does not imply passage');
   assert.ok(source.lastTargetId==='110','the negative control reaches the old mistaken target-history trigger');
  }else if(control==='misfire'){
   assert.equal(target.hp,85);assert.equal(source.loaded,1);assert.equal(source.condition,100);
   assert.match(result.ordinary.log.join(' '),/fallo de chispa/);assert.equal(result.ordinary.smoke.length,0);
  }else{
   assert.ok(target.hp<85);assert.ok(target.bleeding>0);
   assert.ok(result.shown.frames.some(frame=>frame.impacts.some(impact=>impact.unitId==='110'&&impact.damage>0)));
  }
  receipts.push({control,hp:target.hp,bleeding:target.bleeding,loaded:source.loaded,condition:source.condition,jammed:source.jammed,seed:result.ordinary.seed});
 }
 const fresh=preparedPhysicalNearMiss(),old=preparedPhysicalNearMiss({omittedSpeech:true}),a=performPhysicalNearMiss(fresh),b=performPhysicalNearMiss(old);
 assert.equal(speechFor(physicalNearMissActor(old.pair.battle),'near'),null);assert.deepEqual(getFirearmNearMissFeedback(old.pair.battle,b.ordinary),['110']);
 for(const unit of a.ordinary.units){
  const other=b.ordinary.units.find(actor=>actor.id===unit.id);
  for(const key of ['hp','bleeding','ap','morale','loaded','condition','inventory','weaponMetadata','medkits','skillPractice','trainedStats','practiceSeed'])assert.deepEqual(other[key],unit[key],`omitted speech leaves actual ${unit.id}.${key} unchanged`);
 }
 for(const key of ['seed','elapsedSeconds','turn','phase','smoke','log'])assert.deepEqual(b.ordinary[key],a.ordinary[key]);
 const oldFrame=nearFrames(b.shown)[0];assert.ok(oldFrame);assert.equal(contextualBanter(old.pair.battle,oldFrame.state,3,oldFrame),null);
 assert.equal(contextualBanter(old.pair.battle,oldFrame.state,6,oldFrame),null,'a consumed silent old pin cannot backfill another line');
 assert.deepEqual(b.pair,issuePhysicalNearMiss(physicalNearMissSaved(old.pair),{type:'endTurn'}).pair);
 t.diagnostic(JSON.stringify({scope:'distinct declared initial stone, rain and seed8 hit boundaries; no edited outcome or receipt',receipts,oldSpeech:'omitted before initialCampaign; same paid physical result'}));
});
