import {mkdir,writeFile,rename,rm,readFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validateMap} from '../game/map-schema.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
export {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {verifyCampaignFolder} from './campaign-export.mjs';
import {validateCampaignManifest} from '../game/campaign-library.js';
import {refreshCampaignAssetFolder} from './refresh-campaign-assets.mjs';

const json=value=>JSON.stringify(value,null,2)+'\n';
export async function scaffoldCampaign(id,destination){
 const folder=resolve(destination);
 if(basename(folder)!==id)throw Error('The destination folder name must match the campaign id.');
 const documents=scaffoldDocuments(id),temporary=resolve(dirname(folder),`.${id}-${randomUUID()}`);
 await mkdir(dirname(folder),{recursive:true});await mkdir(temporary);
 try{
  await mkdir(resolve(temporary,'maps'));await mkdir(resolve(temporary,'assets'));
  for(const field of ['manifest','content','world','presentation','assets'])await writeFile(resolve(temporary,`${field}.json`),json(documents[field]));
  await writeFile(resolve(temporary,'maps/index.json'),json({maps:Object.keys(documents.maps).map(id=>({id,path:`${id}.json`}))}));
  for(const [id,map]of Object.entries(documents.maps)){const result=validateMap(map,{playable:true});if(!result.valid)throw Error(result.errors.join('\n'));await writeFile(resolve(temporary,`maps/${id}.json`),json(map));}
  await writeFile(resolve(temporary,'assets/guide.png'),documents.image);
  await verifyCampaignFolder(temporary);
  // mkdir is exclusive: an existing campaign is never overwritten.
  await mkdir(folder);await rename(temporary,folder);
  return folder;
 }catch(error){await rm(temporary,{recursive:true,force:true});throw error;}
}

export async function checkCampaign(directory){return verifyCampaignFolder(resolve(directory));}
export async function refreshAuthorAssets(directory){
 const folder=resolve(directory),manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));validateCampaignManifest(manifest);
 return refreshCampaignAssetFolder(folder,manifest.assets);
}

async function main(args){
 const [command,id,destination]=args;
 if(command==='check'&&id&&!destination){const content=await checkCampaign(id);console.log(`Campaign valid: ${content.id} (${content.campaignOrigin.revision})`);return;}
 if(command==='assets'&&id&&!destination){console.log(`Campaign assets updated: ${(await refreshAuthorAssets(id)).length}`);return;}
 if(command==='scaffold'&&id&&destination&&args.length===3){console.log(`Campaign created: ${await scaffoldCampaign(id,destination)}`);return;}
 throw Error('Usage: campaign-authoring.mjs check <folder> | assets <folder> | scaffold <new-id> <destination-folder>');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
