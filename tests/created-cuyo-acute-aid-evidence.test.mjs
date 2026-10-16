import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {actBattle,lookPreview} from '../game/tactical.js';
import {visit,tactical,sync,saved} from './local-contract-fixture.mjs';
import {stabilizeCreatedCuyoSurvivors,stabilizeCreatedCuyoBattleSurvivors} from './created-cuyo-route.mjs';
import {createRouteAcuteAidFailureObserver} from './route-care-failure-evidence.mjs';

const unit=(battle,id)=>battle.units.find(actor=>actor.id===String(id));
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null);return next;};
const withDirectory=(directory,run)=>{
 const previous=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(directory===undefined)delete process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 else process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=directory;
 try{return run();}finally{
  if(previous===undefined)delete process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
  else process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=previous;
 }
};

// Wounds, finite kits, local ownership and service are declared before the
// compiler and campaign factory. No earned, failed or historical input is used.
function setup({late=false}={}){
 const documents=scaffoldDocuments('declared-acute-aid-evidence'),base=documents.content.characters[0];
 documents.content.rules.startingTreasury=10000;
 documents.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 documents.world.expansion.buildingTargets={camp:0,'watch-post':0};
 documents.world.physical.caches={};
 documents.content.characters=['doctor','patient'].map((name,index)=>({...structuredClone(base),id:'acute-'+name,name,nickname:name,
  arrivalHours:0,monthlyPay:30,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:index===0?90:0},
  startingSupplies:{rations:0,torches:0,medkits:index===0?2:0,boleadoras:0},
  startingCondition:{hp:index===0?80:late?1:20,bleeding:index===0?0:late?6:1,bandaged:0,energy:100,fatigue:0},
 }));
 const declaration=structuredClone(documents),content=compileCampaignPackage(documents.manifest,documents);
 let campaign=initialCampaign(42,content);const [doctor,patient]=rosterFor(campaign).map(actor=>actor.id);
 for(const id of [doctor,patient])campaign=order(campaign,{type:'recruitCivic',id,term:'day'});
 campaign=order(campaign,{type:'createSquad',name:'Auxilio declarado',sector:'camp',ids:[doctor,patient]});
 assert.deepEqual(documents,declaration);
 return {campaign,doctor,patient};
}

const capture=directory=>{
 const entries=readdirSync(directory);assert.equal(entries.length,1);
 assert.match(entries[0],/-acute-field-aid-/);
 const root=join(directory,entries[0]);return {root,receipt:json(join(root,'receipt.json'))};
};

test('enabled acute-aid evidence leaves successful Native aid, paid service and finite results unchanged and writes nothing',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-acute-aid-success-'));
 try{
  const first=setup(),second=setup(),before=structuredClone(second.campaign),ordinaryEvents=[],observedEvents=[];
  assert.equal(createRouteAcuteAidFailureObserver(null,{directory:null}),undefined);
  const ordinary=withDirectory(undefined,()=>stabilizeCreatedCuyoSurvivors(first.campaign,{report:event=>ordinaryEvents.push(event)}));
  const observed=withDirectory(directory,()=>stabilizeCreatedCuyoSurvivors(second.campaign,{report:event=>observedEvents.push(event)}));
  assert.deepEqual(observed,ordinary);assert.deepEqual(observedEvents,ordinaryEvents);
  assert.equal(observed.operativeState[second.patient].bleeding,0);assert.ok(observed.operativeState[second.patient].hp>=15);
  assert.ok(observed.operativeState[second.doctor].medkits<before.operativeState[second.doctor].medkits);
  assert.deepEqual(observed.contracts,ordinary.contracts);assert.equal(observed.resources.treasury,ordinary.resources.treasury);
  assert.deepEqual(readdirSync(directory),[]);assert.deepEqual(second.campaign,before);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('a fresh late-aid death remains terminal and retains the actual initial, native, synchronized and saved-return boundaries',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-acute-aid-death-'));
 try{
  const fresh=setup({late:true}),before=structuredClone(fresh.campaign);
  let pair=visit(fresh.campaign);
  // Pay the first five seconds through real orders. The next medical-hand
  // order crosses Native's six-second wound tick; no clock or wound is set.
  for(let count=0;count<5;count++){
   const doctor=unit(pair.battle,fresh.doctor),point=pair.battle.tiles.find(point=>lookPreview(pair.battle,doctor,point).valid);
   assert.ok(point);pair=tactical(pair,{type:'look',unitId:String(fresh.doctor),x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0});
   assert.equal(unit(pair.battle,fresh.patient).hp,1);
  }
  assert.equal(pair.battle.bleedSeconds,5);
  const observer=createRouteAcuteAidFailureObserver(pair,{directory});
  assert.throws(()=>{
   try{stabilizeCreatedCuyoBattleSurvivors(pair,{execute:(current,action)=>{
    observer.before(current,action);const battle=actBattle(current.battle,action);observer.nativeResult(battle);assert.equal(battle.lastError,null);
    const synchronized=sync({campaign:current.campaign,battle});observer.synchronized(synchronized);
    const returned=saved(synchronized);observer.saveReturned(returned);return returned;
   }});}catch(error){observer.failed(error);throw error;}
  },/Every actual living Cuyo patient must survive ordered finite field aid/);
  // The failed result is never queried, normalized, replayed or continued.
  // Read only the observer's plain output after the unchanged assertion.
  const {root,receipt}=capture(directory),initial=json(join(root,'care-initial-medical-pair.json')),
   prior=json(join(root,'care-before.json')),action=json(join(root,'care-action.json')),
   native=json(join(root,'care-native-after.json')),synchronized=json(join(root,'care-synchronized-after.json')),
   returned=json(join(root,'care-save-returned-pair.json')),stopped=json(join(root,'care-stopped-pair.json'));
  assert.deepEqual(prior,initial);assert.deepEqual(action,{type:'weapon',unitId:String(fresh.doctor),slot:'medical'});
  assert.equal(unit(initial.battle,fresh.patient).hp,1);assert.equal(unit(initial.battle,fresh.patient).bleeding,6);
  assert.equal(native.lastError,null);assert.equal(unit(native,fresh.patient).hp,0);
  assert.equal(unit(synchronized.battle,fresh.patient).hp,0);assert.equal(unit(returned.battle,fresh.patient).hp,0);
  assert.deepEqual(returned,stopped);assert.equal(receipt.counters.orders,1);
  assert.equal(receipt.failureStage,'created-cuyo-acute-field-aid');assert.equal(receipt.stoppedPairStage,'save-returned');
  assert.equal(receipt.nativeActionAccepted,true);assert.equal(receipt.existingSynchronizationCaptured,true);assert.equal(receipt.existingSaveReturnCaptured,true);
  assert.equal(receipt.preExecutionPairIndependentlyCaptured,false);assert.equal(receipt.preExecutionPairRetained,true);
  assert.equal(receipt.additionalOrders,0);assert.equal(receipt.additionalSynchronization,0);assert.equal(receipt.settlementExecuted,false);
  assert.deepEqual(fresh.campaign,before);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

function refuseOnce(pair,observer){
 const action={type:'weapon',unitId:'absent-physician',slot:'medical'},before=structuredClone(pair);
 let actual,error,calls=0;
 const invoke=()=>{
  observer.before(pair,action);calls++;actual=actBattle(pair.battle,action);observer.nativeResult(actual);
  try{assert.equal(actual.lastError,null);}catch(original){error=original;observer.failed(original);throw original;}
 };
 assert.throws(invoke,caught=>caught===error);assert.equal(calls,1);assert.ok(actual.lastError);
 assert.deepEqual(pair,before);return {actual,error,action};
}

test('a fresh Native refusal is recorded once, keeps the exact thrown error and never synchronizes or continues its result',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-acute-aid-refusal-'));
 try{
  const fresh=setup(),pair=visit(fresh.campaign),observer=createRouteAcuteAidFailureObserver(pair,{directory});
  const {actual,error,action}=refuseOnce(pair,observer);observer.failed(error);
  // Only retained plain JSON is inspected after refusal. No game call follows.
  const {root,receipt}=capture(directory);
  assert.deepEqual(json(join(root,'care-native-after.json')),actual);assert.deepEqual(json(join(root,'care-action.json')),action);
  assert.deepEqual(json(join(root,'care-stopped-pair.json')),pair);
  assert.equal(receipt.error.message,error.message);assert.equal(receipt.error.code,error.code);
  assert.equal(receipt.nativeActionAccepted,false);assert.equal(receipt.existingSynchronizationCaptured,false);assert.equal(receipt.existingSaveReturnCaptured,false);
  assert.equal(receipt.stoppedPairStage,'before-action');assert.equal(receipt.counters.orders,1);
  assert.equal(readdirSync(root).includes('care-synchronized-after.json'),false);assert.equal(readdirSync(root).includes('care-save-returned-pair.json'),false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('a filesystem and diagnostic-message failure cannot replace the exact Native refusal assertion',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-acute-aid-filesystem-')),previousConsole=console.error;
 try{
  const blocked=join(directory,'ordinary-file');writeFileSync(blocked,'not a directory\n');
  const fresh=setup(),pair=visit(fresh.campaign),observer=createRouteAcuteAidFailureObserver(pair,{directory:blocked});
  console.error=()=>{throw Error('A diagnostic message must not replace the real error.');};
  const result=refuseOnce(pair,observer);assert.equal(result.error.code,'ERR_ASSERTION');
  assert.equal(readFileSync(blocked,'utf8'),'not a directory\n');assert.deepEqual(readdirSync(directory),['ordinary-file']);
 }finally{console.error=previousConsole;rmSync(directory,{recursive:true,force:true});}
});
