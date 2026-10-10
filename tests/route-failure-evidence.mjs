import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

let sequence=0;

// Opt-in diagnostics for a real failed route. Capture the actual result once;
// do not choose more orders, repeat deployment or settle the campaign.
export function recordRouteBattleFailure({campaign,request,previous,result,expectedOutcome,controller,deploy,executeBattle,returnedCampaign,failureStage='battle-outcome'}){
 const directory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 if(!directory)return;
 let output;
 try{
  const id=String(request.id).replace(/[^\w.-]/g,'_').slice(0,120);
  mkdirSync(directory,{recursive:true});
  output=mkdtempSync(join(directory,`${process.pid}-${++sequence}-${id}-`));
  const artifacts=[];
  const writeBytes=(name,bytes)=>{
   writeFileSync(join(output,name),bytes);
   artifacts.push({path:name,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});
  };
  const write=(name,value)=>writeBytes(name,JSON.stringify(value,null,2)+'\n');
  write('native-input.json',{campaign,request,previous});
  write('native-result.json',result);
  // A caller can supply its already completed settlement. Capture that value
  // without dispatching another campaign action or changing the battle result.
  if(returnedCampaign!==undefined)write('returned-campaign.json',returnedCampaign);
  const receipt={
   testFile:basename(process.argv[1]??''),pid:process.pid,runtime:process.execPath,nodeVersion:process.version,
   sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   battleId:request.id,sector:request.sector,expectedOutcome,actualOutcome:result.battle.status,
   failureStage,returnedCampaignProvided:returnedCampaign!==undefined,
   inputCapturePhase:'retained arguments after execution and reporting',preExecutionInputIndependentlyCaptured:false,
   previousExists:previous!==undefined,ordersAvailable:Array.isArray(result.orders),orders:result.orders?.length??null,
   controller:controller?.name??null,deploy:deploy?.name??null,executeBattle:executeBattle?.name??null,
   trueInitialBattleCaptured:false,officialTerminalPair:false,additionalOrders:0,settlementExecuted:false,artifacts,
  };
  try{
   // Raw input stays separate: clock synchronization and save decoding can add
   // saved fields. Neither operation may alter the actual route result.
   const pair=syncBattleTime(structuredClone(campaign),structuredClone(result.battle));
   assert.equal(pair.error,null);
   const save=encodeSave(pair.campaign,pair.battle),restored=decodeSave(save);
   assert.deepEqual(restored.campaign,pair.campaign);
   assert.deepEqual(restored.battle,pair.battle);
   writeBytes('terminal.save.json',save+'\n');
   receipt.officialTerminalPair=true;
  }catch(error){receipt.officialTerminalPairError=String(error);}
  writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }catch(error){
  // A diagnostic failure must not replace or suppress the victory assertion.
  console.error('Route failure evidence error:',output??directory,String(error));
 }
}
