import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';

const cap=8,observed=new Map();
const reason='shared-contact-native-no-admitted-action';
let sequence=0;

// Observe an existing controller return only. The cap counts capture attempts
// and stores at most eight small decision keys per sector/deployment/start clock.
export function recordRouteControllerDecisionEvidence({battle,unit,sharedContacts,automatic}){
 const directory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(!directory)return;
 let output;
 try{
  const scope={sectorId:battle.sectorId??null,battleId:battle.battleId??null,startSeconds:battle.startSeconds??null};
  const scopeKey=JSON.stringify(scope);
  const decisionKey=JSON.stringify([unit.id,battle.turn,battle.phase,unit.stance,unit.ap,unit.hp,unit.bleeding]);
  let decisions=observed.get(scopeKey);
  if(decisions?.has(decisionKey)||decisions?.size>=cap)return;
  if(!decisions){decisions=new Set();observed.set(scopeKey,decisions);}
  decisions.add(decisionKey);
  const raw=structuredClone({battle,unit,sharedContacts,automatic});
  mkdirSync(directory,{recursive:true});
  const sector=String(scope.sectorId??'unknown').replace(/[^\w.-]/g,'_').slice(0,120);
  output=mkdtempSync(join(directory,`${process.pid}-${++sequence}-${sector}-controller-decision-`));
  const name='controller-decision.json',bytes=JSON.stringify(raw,null,2)+'\n';
  writeFileSync(join(output,name),bytes);
  const receipt={
   testFile:basename(process.argv[1]??''),pid:process.pid,runtime:process.execPath,nodeVersion:process.version,
   sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   buildRevision:process.env.GRANADEROS_CAMPAIGN_BUILD_REVISION??null,
   stage:reason,reason,phase:battle.phase,
   capturePhase:'after the existing native chooser and priority returns; before the unchanged shared-contact null return',
   scope,scopeKey,decisionKey,captureAttemptInScope:decisions.size,
   recordingCap:cap,capCountsAttempts:true,
   decisionKeyFields:['unit.id','battle.turn','battle.phase','unit.stance','unit.ap','unit.hp','unit.bleeding'],
   captureScope:'first eight distinct decision keys per sector/deployment/start clock; not a complete decision or action tape',
   rawDecisionIndependentlyCloned:true,controllerReturnValue:null,
   nativeResultKind:automatic===null?'null':automatic===undefined?'undefined':automatic.type??typeof automatic,
   rawAutomaticResultPresent:automatic!==undefined,
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
