import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runOpeningCampaign} from '../tests/opening-campaign.mjs';
import {prepareNorthernSquad,fightNorthernSector} from '../tests/northern-route.mjs';
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
const result=fightNorthernSector(prepared.campaign,'cordoba',{report});const finalSave=checkpoint('cordoba',result.campaign);
const summary={scope:'Opening, finite recovery, and Córdoba; the full campaign remains unverified.',seed:8,opening:opening.transcript,recovery:prepared.recovery,campaignOrders:prepared.events,cordoba:result.summary,final:{hour:result.campaign.hour,second:result.campaign.secondOfHour,location:result.campaign.location,phase:result.campaign.phase,treasury:result.campaign.resources.treasury},checkpoints:{opening:openingSave,prepared:preparedSave,cordoba:finalSave}};
writeFileSync(join(directory,'report.json'),JSON.stringify(summary,null,2));
report({event:'verified',directory,finalSave,...summary.final});
