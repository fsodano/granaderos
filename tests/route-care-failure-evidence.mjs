import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';

let sequence=0;

// Retain an observed care failure only. This recorder cannot issue orders,
// synchronize time, settle a deployment, or replace the caller's assertion.
export function recordRouteCareFailure({boundary,pair,counters,lastInvocation,error}){
 const directory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(!directory)return;
 let output;
 try{
  mkdirSync(directory,{recursive:true});
  output=mkdtempSync(join(directory,`${process.pid}-${++sequence}-mendoza-care-`));
  const artifacts=[];
  const write=(name,value)=>{
   const bytes=JSON.stringify(value,null,2)+'\n';
   writeFileSync(join(output,name),bytes);
   artifacts.push({path:name,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});
  };
  if(boundary){
   write('care-before.json',boundary.before);
   write('care-action.json',boundary.action);
   if(boundary.nativeAfter!==undefined)write('care-native-after.json',boundary.nativeAfter);
   if(boundary.synchronization!==undefined)write('care-synchronized-after.json',boundary.synchronization);
  }
  write('care-stopped-pair.json',pair);
  const receipt={
   testFile:basename(process.argv[1]??''),pid:process.pid,runtime:process.execPath,nodeVersion:process.version,
   sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   failureStage:'stock-mendoza-survivor-care',lastInvocation,
   error:{name:error.name,code:error.code??null,message:error.message},counters,
   captureScope:'latest tactical invocation only; not a full care action tape',
   preExecutionPairIndependentlyCaptured:Boolean(boundary),
   boundaryOrder:boundary?.order??null,
   nativeAfterCaptured:boundary?.nativeAfter!==undefined,
   nativeActionAccepted:boundary?.nativeAfter===undefined?null:boundary.nativeAfter.lastError===null,
   existingSynchronizationCaptured:boundary?.synchronization!==undefined,
   failureOccurredInLatestTacticalInvocation:lastInvocation==='tactical'&&Boolean(boundary),
   fullCareOrdersAvailable:false,fullCareTapeCaptured:false,
   additionalOrders:0,additionalSynchronization:0,settlementExecuted:false,artifacts,
  };
  writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }catch(evidenceError){
  // Diagnostics must not hide the original clinical loss or assertion.
  console.error('Route care failure evidence error:',output??directory,String(evidenceError));
 }
}
