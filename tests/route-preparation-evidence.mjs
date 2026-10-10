import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';

let sequence=0;
const phases={
 'los-patos-preparation-input':'after recoverFreshUspallata; before any prepareFreshLosPatosAssault order',
 'los-patos-preparation-output':'after prepareFreshLosPatosAssault; before fight los_patos',
};

// Capture the raw campaign at an observed preparation boundary. This recorder
// has no game imports and cannot issue orders, normalize saves or settle battles.
export function recordRoutePreparationEvidence({campaign,stage,routeKind,inputCapture=null}){
 const directory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(!directory)return;
 let output;
 try{
  if(!Object.hasOwn(phases,stage))throw Error('Unknown route preparation evidence stage.');
  const rawCampaign=structuredClone(campaign);
  mkdirSync(directory,{recursive:true});
  output=mkdtempSync(join(directory,`${process.pid}-${++sequence}-${stage}-`));
  const name=`${stage}.campaign.json`,bytes=JSON.stringify(rawCampaign,null,2)+'\n';
  writeFileSync(join(output,name),bytes);
  const receipt={
   testFile:basename(process.argv[1]??''),pid:process.pid,runtime:process.execPath,nodeVersion:process.version,
   sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   buildRevision:process.env.GRANADEROS_CAMPAIGN_BUILD_REVISION??null,
   stage,sector:'los_patos',routeKind,inputCapture,
   capturePhase:phases[stage],rawCampaignIndependentlyCloned:true,
   prePreparationInputIndependentlyCaptured:stage==='los-patos-preparation-input',
   beforeFight:stage==='los-patos-preparation-output',pendingBattleId:rawCampaign.pendingBattle?.id??null,
   additionalOrders:0,additionalSynchronization:0,saveNormalizationPerformed:false,settlementExecuted:false,
   artifacts:[{path:name,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}],
  };
  writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return output;
 }catch(error){
  // Diagnostics must not replace an original preparation or battle error.
  try{console.error('Route preparation evidence error:',output??directory,String(error));}catch{}
 }
}
