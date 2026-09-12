import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runOpeningCampaign} from '../tests/opening-campaign.mjs';
import {prepareNorthernSquad,prepareTucumanSquad,prepareRescueSquad,stabilizeRescued,fightNorthernSector} from '../tests/northern-route.mjs';
import {encodeSave,decodeSave} from '../game/save.js';

const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--output'))throw Error('Usage: node tools/verify-northern-route.mjs [--output directory]');
const directory=args.length?resolve(args[1]):mkdtempSync(join(tmpdir(),'granaderos-northern-route-'));
mkdirSync(directory,{recursive:true});
const checkpoint=(name,campaign)=>{
 const path=join(directory,`${name}.save.json`);writeFileSync(path,encodeSave(campaign));
 assert.deepEqual(decodeSave(readFileSync(path,'utf8')).campaign,campaign);
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
const stable=stabilizeRescued(liberated.campaign,{report});const finalSave=checkpoint('rescued-stable',stable.campaign);
const summary={
 scope:'Opening and Córdoba victories, paid recovery and renewals, actual Tucumán defeat/capture, recapture, and finite emergency care. A complete winning campaign remains unverified.',
 seed:8,opening:opening.transcript,recovery:prepared.recovery,campaignOrders:prepared.events,
 cordoba:result.summary,cordobaRecovery:recovery.recovery,recoveryOrders:recovery.events,
 tucuman:tucuman.summary,captured:rescue.captives.map(({id,record})=>({id,hp:record.hp,sector:record.capturedSector})),
 rescueOrders:rescue.events,recapture:liberated.summary,emergencyCareOrders:stable.events,
 final:{hour:stable.campaign.hour,second:stable.campaign.secondOfHour,location:stable.campaign.location,phase:stable.campaign.phase,treasury:stable.campaign.resources.treasury},
 checkpoints:{opening:openingSave,prepared:preparedSave,cordoba:cordobaSave,tucumanPrepared:tucumanPreparedSave,tucumanDefeat:defeatSave,rescuePrepared:rescuePreparedSave,tucumanRescued:liberatedSave,rescuedStable:finalSave}
};
writeFileSync(join(directory,'report.json'),JSON.stringify(summary,null,2));
report({event:'verified',directory,finalSave,...summary.final});
