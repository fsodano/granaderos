import {refreshCampaignAssets} from './refresh-campaign-assets.mjs';
// Rebuild the balanced portrait expansion from its individually generated art.
import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'web/package.json'));
const sharp=require('sharp');
const rows=JSON.parse(await readFile(resolve(root,'assets/prompts/balanced-portraits.json'),'utf8'));
if(rows.length!==122||new Set(rows.map(row=>row.id)).size!==rows.length)throw Error('Expected 122 distinct portrait expansion IDs.');
// Fail before writing if generation has not finished.
for(const row of rows)await access(resolve(root,row.source));
const manifest=[];
for(const row of rows){
 const output=await sharp(resolve(root,row.source)).resize(384,384,{fit:'cover'}).webp({quality:86}).toBuffer();
 const filename=`${row.id}.webp`;
 for(const base of ['assets/web','campaigns/granaderos/assets']){
  await mkdir(resolve(root,base),{recursive:true});
  await writeFile(resolve(root,base,filename),output);
 }
 manifest.push({id:row.id,file:`/campaigns/granaderos/assets/${filename}`,source:row.source,size:[384,384],bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),fictional:true,method:row.method});
}
for(const base of ['assets/web','campaigns/granaderos/assets'])await writeFile(resolve(root,base,'balanced-portraits.json'),JSON.stringify(manifest,null,2)+'\n');
const catalog=rows.map(({id,name,gender,role,skinTone,spriteAppearance})=>({id,name,gender,role,skinTone,spriteAppearance,spriteSkinTone:skinTone,src:`/campaigns/granaderos/assets/${id}.webp`}));
const cataloguePath=resolve(root,'campaigns/granaderos/catalogue.json'),catalogue=JSON.parse(await readFile(cataloguePath,'utf8'));
catalogue.balancedPortraits=catalog;
await writeFile(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');
const presentationPath=resolve(root,'campaigns/granaderos/presentation.json'),presentation=JSON.parse(await readFile(presentationPath,'utf8'));
presentation.characterPortraits=presentation.characterPortraits.map(portrait=>{const updated=catalog.find(item=>item.id===portrait.id);return updated?{...portrait,...updated}:portrait;});
await writeFile(presentationPath,JSON.stringify(presentation,null,2)+'\n');
console.log(`Built ${manifest.length} distinct portraits for the balanced chooser.`);

await refreshCampaignAssets(root);
