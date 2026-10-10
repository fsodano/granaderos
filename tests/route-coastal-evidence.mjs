import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';

let sequence=0;
const phases={
 'before-battle-execution':{beforeOriginalBattleExecution:true,preExecutionInputIndependentlyCaptured:true},
 'native-combat-result':{afterOriginalBattleExecution:true,actualNativeCombatResultCaptured:true},
 'replay-initial-pair':{beforeExistingReplay:true,actualReplayInitialPairCaptured:true},
 'after-replay-before-exploration':{afterExistingReplay:true,beforeExistingExploration:true},
 'before-field-aid':{afterExistingExploration:true,beforeExistingFieldAid:true},
 'after-field-aid-before-settlement':{afterExistingFieldAid:true,beforeExistingSettlement:true},
 'before-existing-settlement':{afterExistingPairSave:true,beforeExistingSettlement:true},
 'native-returned-campaign-after-settlement':{afterExistingSettlement:true,beforeExistingCampaignSave:true},
 'saved-campaign-before-defeated-assertion':{afterExistingSettlement:true,afterExistingCampaignSave:true,beforeOriginalDefeatedAssertion:true},
 'before-clinic-hire-orders':{beforeExistingClinicHireOrders:true,beforeExistingClinicHireWait:true},
 'before-clinic-hire-wait':{afterExistingClinicHireOrders:true,beforeExistingClinicHireWait:true},
 'after-clinic-hire-wait':{afterExistingClinicHireWait:true,beforeExistingClinicWaitSave:true},
 'before-clinic-survivor-assertion':{beforeOriginalClinicSurvivorAssertion:true},
};

// Opt-in raw observations only. No game imports, native orders, synchronization,
// save normalization, settlement or assertions belong to this recorder.
export function beginRouteCoastalEvidence({routeKind,sector,battleId}){
 const directory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(!directory)return null;
 let output;
 const warn=error=>{try{console.error('Route coastal evidence error:',output??directory,String(error));}catch{}};
 try{
  const parent=join(directory,'coastal-boundaries');mkdirSync(parent,{recursive:true});
  const label=`${routeKind}-${sector}-${battleId}`.replace(/[^\w.-]/g,'_').slice(0,120);
  output=mkdtempSync(join(parent,`${process.pid}-${++sequence}-${label}-`));
  const artifacts=new Map(),accepted=[];
  const receipt={
   testFile:basename(process.argv[1]??''),pid:process.pid,runtime:process.execPath,nodeVersion:process.version,
   sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   buildRevision:process.env.GRANADEROS_CAMPAIGN_BUILD_REVISION??null,
   routeKind,sector,battleId,stages:[],diagnosticErrors:[],
   originalControllerInitialBattleCaptured:false,saveNormalizationPerformed:false,
   additionalOrders:0,additionalSynchronization:0,settlementExecuted:false,
   tacticalTrace:{
    scope:'Accepted existing local tactical helper calls in this sector: battle replay and postcombat exploration/field aid only.',
    excludes:'Controller internal calls, auto-bandage planning calls, campaign dispatches and tactical calls inside other helpers.',
    acceptedOrders:0,replayOrders:0,postcombatOrders:0,
    replayCompleted:false,postcombatCompleted:false,
    completeFullRouteActionTape:false,completeFullClinicalActionTape:false,
   },
  };
  const writeReceipt=()=>writeFileSync(join(output,'receipt.json'),JSON.stringify({...receipt,artifacts:[...artifacts.values()]},null,2)+'\n');
  const write=(name,value)=>{
   const bytes=JSON.stringify(structuredClone(value),null,2)+'\n';
   writeFileSync(join(output,name),bytes);
   artifacts.set(name,{path:name,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});
  };
  const guarded=fn=>{try{fn();}catch(error){
   receipt.diagnosticErrors.push(String(error));
   receipt.tacticalTrace.replayCompleted=false;receipt.tacticalTrace.postcombatCompleted=false;
   try{writeReceipt();}catch{}warn(error);
  }};
  writeReceipt();
  return {
   capture(stage,value){guarded(()=>{
    if(!Object.hasOwn(phases,stage))throw Error('Unknown coastal evidence stage.');
    write(stage+'.json',value);
    receipt.stages.push({stage,...phases[stage]});
    if(stage==='native-combat-result')receipt.tacticalTrace.expectedReplayOrders=Array.isArray(value.orders)?value.orders.length:null;
    if(stage==='after-replay-before-exploration')receipt.tacticalTrace.replayCompleted=receipt.diagnosticErrors.length===0&&receipt.tacticalTrace.replayOrders===receipt.tacticalTrace.expectedReplayOrders;
    if(stage==='after-field-aid-before-settlement')receipt.tacticalTrace.postcombatCompleted=receipt.diagnosticErrors.length===0;
    writeReceipt();
   });},
   accepted(action,{phase,before,after}){guarded(()=>{
    if(!['replay','postcombat'].includes(phase))throw Error('Unknown coastal tactical trace phase.');
    // The caller reaches this point only after its original tactical helper
    // accepts the native order and completes its existing synchronization.
    accepted.push(structuredClone({index:accepted.length,phase,action,
     before:{turn:before.battle.turn,phase:before.battle.phase,status:before.battle.status,elapsedSeconds:before.battle.elapsedSeconds,hour:before.campaign.hour,secondOfHour:before.campaign.secondOfHour},
     after:{turn:after.battle.turn,phase:after.battle.phase,status:after.battle.status,elapsedSeconds:after.battle.elapsedSeconds,hour:after.campaign.hour,secondOfHour:after.campaign.secondOfHour},
     nativeAccepted:true,existingSynchronizationCompleted:true,
    }));
    write('accepted-local-tactical-orders.json',accepted);
    receipt.tacticalTrace.acceptedOrders=accepted.length;
    receipt.tacticalTrace[phase==='replay'?'replayOrders':'postcombatOrders']++;
    writeReceipt();
   });},
  };
 }catch(error){warn(error);return null;}
}
