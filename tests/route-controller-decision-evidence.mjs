import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';

const cap=8,observed=new Map(),boundarySampling=new Set();
const reason='shared-contact-native-no-admitted-action';
let sequence=0;
const scopeOf=battle=>({sectorId:battle.sectorId??null,battleId:battle.battleId??null,startSeconds:battle.startSeconds??null});

// Observe an existing controller return only. The cap counts capture attempts
// and stores at most eight small decision keys per sector/deployment/start clock.
export function recordRouteControllerDecisionEvidence({battle,unit,sharedContacts,automatic,boundary=null,decision=null}){
 const directory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(!directory)return;
 let output;
 try{
  const scope=scopeOf(battle);
  const scopeKey=JSON.stringify(scope);
  if(boundarySampling.has(scopeKey)&&!boundary&&!decision)return;
  const decisionKey=JSON.stringify(boundary?['paired-order',boundary.orderIndex,boundary.events.map(event=>event.kind)]:decision?['first-roof-coordinator-return']:[unit.id,battle.turn,battle.phase,unit.stance,unit.ap,unit.hp,unit.bleeding]);
  let decisions=observed.get(scopeKey);
  if(decisions?.has(decisionKey)||decisions?.size>=cap)return;
  if(!decisions){decisions=new Set();observed.set(scopeKey,decisions);}
  decisions.add(decisionKey);
  const raw=structuredClone(boundary?{battle,unit,boundary}:decision?{battle,unit,decision}:{battle,unit,sharedContacts,automatic});
  const captureReason=boundary?'first-actual-own-field-event':decision?'first-existing-roof-coordinator-return':reason;
  mkdirSync(directory,{recursive:true});
  const sector=String(scope.sectorId??'unknown').replace(/[^\w.-]/g,'_').slice(0,120);
  output=mkdtempSync(join(directory,`${process.pid}-${++sequence}-${sector}-controller-decision-`));
  const name='controller-decision.json',bytes=JSON.stringify(raw,null,2)+'\n';
  writeFileSync(join(output,name),bytes);
  const receipt={
   testFile:basename(process.argv[1]??''),pid:process.pid,runtime:process.execPath,nodeVersion:process.version,
   sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   buildRevision:process.env.GRANADEROS_CAMPAIGN_BUILD_REVISION??null,
   stage:captureReason,reason:captureReason,phase:battle.phase,
   capturePhase:boundary?(boundary.existingSynchronizationCompleted===false?'after one existing accepted Native order; before any campaign synchronization; actual prior and returned battles only':'after one existing accepted Native order and its existing synchronization; actual prior and returned battles only'):decision?'after the existing roof coordinator call; before the unchanged move-only return; no Native order executed by this observation':'after the existing native chooser and priority returns; before the unchanged shared-contact null return',
   scope,scopeKey,decisionKey,captureAttemptInScope:decisions.size,
   recordingCap:cap,capCountsAttempts:true,
   decisionKeyFields:boundary?['boundary.orderIndex','boundary.events.kind']:decision?['first-roof-coordinator-return']:['unit.id','battle.turn','battle.phase','unit.stance','unit.ap','unit.hp','unit.bleeding'],
   captureScope:boundary?'first own wound, death and rout plus distinct field-physician wound, death, rout and aid boundaries within the same eight-attempt scope cap; not internal Native frames or a complete action tape':decision?'first existing eligible roof-rifle coordinator return within the same eight-attempt scope cap; no internal quote or complete decision tape':'first eight distinct decision keys per sector/deployment/start clock; not a complete decision or action tape',
   rawDecisionIndependentlyCloned:true,
   ...(boundary?{nativeOrderAccepted:true,existingSynchronizationCompleted:boundary.existingSynchronizationCompleted!==false,controllerReturnObserved:false,preExecutionInputIndependentlyCaptured:false,trueInitialBattleCaptured:false}:decision?
    {controllerReturnObserved:true,nativeOrderExecuted:false,ordinaryResultKind:decision.ordinaryResultKind,coordinatorResultKind:decision.coordinatorResultKind,returnedResultKind:decision.returnedResultKind,preExecutionInputIndependentlyCaptured:false,trueInitialBattleCaptured:false}:
    {controllerReturnValue:null,nativeResultKind:automatic===null?'null':automatic===undefined?'undefined':automatic.type??typeof automatic,rawAutomaticResultPresent:automatic!==undefined}),
   additionalSelectors:0,additionalPreviews:0,additionalOrders:0,additionalSynchronization:0,
   saveNormalizationPerformed:false,settlementExecuted:false,
   artifacts:[{path:name,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}],
  };
  writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }catch(error){
  // Diagnostics cannot replace the original controller return or gameplay error.
  try{console.error('Route controller decision evidence error:',output??directory,String(error));}catch{}
 }
}

// Opt-in sampling reuses an existing actual order boundary. Suppress
// early shared-null samples only for this scope, so they cannot spend its cap.
// No reducer, selector, preview, save operation or controller call belongs here.
export function beginRouteControllerBoundaryEvidence({initial,fieldPhysicianIds=[],existingSynchronizationCompleted=true}){
 if(!process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR)return null;
 try{
  const scopeKey=JSON.stringify(scopeOf(initial)),ownIds=new Set(initial.units.filter(unit=>unit.side==='player').map(unit=>unit.id));
  const physicians=new Set(fieldPhysicianIds.map(String)),seen=new Set();
  boundarySampling.add(scopeKey);
  return ({before,after,action,index})=>{
   try{
    const prior=new Map(before.units.filter(unit=>ownIds.has(unit.id)).map(unit=>[unit.id,unit]));
    const own=after.units.filter(unit=>ownIds.has(unit.id)),events=[];
    const add=(kind,ids)=>{if(ids.length&&!seen.has(kind))events.push({kind,unitIds:ids});};
    const wounded=own.filter(unit=>{const old=prior.get(unit.id);return old?.hp>0&&(unit.hp<old.hp||(unit.bleeding??0)>(old.bleeding??0));}).map(unit=>unit.id);
    const dead=own.filter(unit=>prior.get(unit.id)?.hp>0&&unit.hp<=0).map(unit=>unit.id);
    const routed=own.filter(unit=>prior.has(unit.id)&&!prior.get(unit.id).routed&&unit.routed).map(unit=>unit.id);
    add('first-own-wound',wounded);add('first-own-death',dead);add('first-own-rout',routed);
    add('first-field-physician-wound',wounded.filter(id=>physicians.has(id)));
    add('first-field-physician-death',dead.filter(id=>physicians.has(id)));
    add('first-field-physician-rout',routed.filter(id=>physicians.has(id)));
    const physician=prior.get(String(action.unitId));
    add('first-field-physician-aid',action.type==='useItem'&&physicians.has(String(action.unitId))&&physician?.activeSlot==='medical'?[physician.id]:[]);
    if(!events.length)return;
    for(const event of events)seen.add(event.kind);
    const actor=after.units.find(unit=>unit.id===events[0].unitIds[0])??prior.get(events[0].unitIds[0]);
    recordRouteControllerDecisionEvidence({battle:after,unit:actor,boundary:{orderIndex:index,action,events,fieldPhysicianIds:[...physicians],before,...(existingSynchronizationCompleted?{}:{existingSynchronizationCompleted:false}),
     boundaryScope:'One actual top-level accepted order. Internal attacks/rout steps inside endTurn are not separately observed.',
     woundMeaning:'First newly lower own HP or higher bleeding visible at an accepted order boundary; direct death may coincide.',
     routMeaning:'First actual own routed false-to-true transition; retained morale/log describe its Native cause.'}});
   }catch(error){try{console.error('Route controller boundary evidence error:',String(error));}catch{}}
  };
 }catch(error){try{console.error('Route controller boundary evidence error:',String(error));}catch{}return null;}
}
