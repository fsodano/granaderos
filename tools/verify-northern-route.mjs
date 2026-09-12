import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runOpeningCampaign} from '../tests/opening-campaign.mjs';
import {prepareNorthernSquad,prepareTucumanSquad,prepareRescueSquad,stabilizeRescued,fightNorthernSector} from '../tests/northern-route.mjs';
import {recoverRescueForce} from '../tests/rescue-recovery.mjs';
import {prepareSaltaAssault,completeNorthernMission} from '../tests/salta-route.mjs';
import {cautiousCombatOrder} from '../tests/cautious-driver.mjs';
import {encodeSave,decodeSave} from '../game/save.js';

const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--output'))throw Error('Usage: node tools/verify-northern-route.mjs [--output directory]');
const directory=args.length?resolve(args[1]):mkdtempSync(join(tmpdir(),'granaderos-northern-route-'));
mkdirSync(directory,{recursive:true});
const checkpoint=(name,campaign,battle=null)=>{
 const path=join(directory,`${name}.save.json`);writeFileSync(path,encodeSave(campaign,battle));
 assert.deepEqual(decodeSave(readFileSync(path,'utf8')),{campaign,battle});
 return path;
};
const report=event=>console.log(JSON.stringify(event));
report({event:'openingStarted',seed:8});
const opening=runOpeningCampaign();const openingSave=checkpoint('opening',opening.campaign);
report({event:'openingVerified',battles:opening.transcript.map(({sector,status,turn,actions})=>({sector,status,turn,actions}))});
const prepared=prepareNorthernSquad(opening.campaign,{report});const preparedSave=checkpoint('prepared',prepared.campaign);
const result=fightNorthernSector(prepared.campaign,'cordoba',{report});const cordobaSave=checkpoint('cordoba',result.campaign);
const recovery=prepareTucumanSquad(result.campaign,{report});const tucumanPreparedSave=checkpoint('tucuman-prepared',recovery.campaign);
const tucuman=fightNorthernSector(recovery.campaign,'tucuman',{report,expectedOutcome:'defeat'});const defeatSave=checkpoint('tucuman-defeat',tucuman.campaign);
const rescue=prepareRescueSquad(tucuman.campaign,{report});const rescuePreparedSave=checkpoint('rescue-prepared',rescue.campaign);
const liberated=fightNorthernSector(rescue.campaign,'tucuman',{report});const liberatedSave=checkpoint('tucuman-rescued',liberated.campaign);
const stable=stabilizeRescued(liberated.campaign,{report});const stableSave=checkpoint('rescued-stable',stable.campaign);
const recovered=recoverRescueForce(stable.campaign,{report});const recoveredSave=checkpoint('rescued-recovered',recovered.campaign);
const joint=prepareSaltaAssault(recovered.campaign,{report});const jointSave=checkpoint('salta-deployment',joint.campaign,joint.battle);
const salta=fightNorthernSector(joint.campaign,'salta',{report,controller:cautiousCombatOrder});const saltaSave=checkpoint('salta',salta.campaign);
const yatasto=completeNorthernMission(salta.campaign,{report});const finalSave=checkpoint('yatasto',yatasto.campaign);
const summary={
 scope:'Fresh opening through Córdoba, actual Tucumán defeat and rescue, paid medical courier and recovery, joint Salta victory and Yatasto completion. Fifteen deaths remain permanent. A complete winning campaign remains unverified.',
 seed:8,opening:opening.transcript,recovery:prepared.recovery,campaignOrders:prepared.events,
 cordoba:result.summary,cordobaRecovery:recovery.recovery,recoveryOrders:recovery.events,
 tucuman:tucuman.summary,captured:rescue.captives.map(({id,record})=>({id,hp:record.hp,sector:record.capturedSector})),
 rescueOrders:rescue.events,recapture:liberated.summary,emergencyCareOrders:stable.events,
 rescueRecovery:recovered.recovery,rescueRecoveryOrders:recovered.events,saltaPreparationOrders:joint.events,salta:salta.summary,yatastoPreparationOrders:yatasto.events,
 final:{hour:yatasto.campaign.hour,second:yatasto.campaign.secondOfHour,location:yatasto.campaign.location,phase:yatasto.campaign.phase,treasury:yatasto.campaign.resources.treasury},
 checkpoints:{opening:openingSave,prepared:preparedSave,cordoba:cordobaSave,tucumanPrepared:tucumanPreparedSave,tucumanDefeat:defeatSave,rescuePrepared:rescuePreparedSave,tucumanRescued:liberatedSave,rescuedStable:stableSave,rescuedRecovered:recoveredSave,saltaDeployment:jointSave,salta:saltaSave,yatasto:finalSave}
};
writeFileSync(join(directory,'report.json'),JSON.stringify(summary,null,2));
report({event:'verified',directory,finalSave,...summary.final});
