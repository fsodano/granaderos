import {readFile,readdir,copyFile,mkdir,stat,rm,writeFile} from 'node:fs/promises';
import {resolve,join,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {campaignRelativePath,validateCampaignManifest,validateCampaignRegistry,compileCampaignPackage} from '../packages/game/campaign-library.js';
import {campaignContentReport} from '../packages/game/campaign-content.js';

function child(root,path){
 if(!campaignRelativePath(path))throw Error(`Invalid campaign file path: ${path}`);
 const file=resolve(root,path);
 if(!file.startsWith(resolve(root)+'/'))throw Error(`Campaign path escapes its folder: ${path}`);
 return file;
}
async function json(path){return JSON.parse(await readFile(path,'utf8'));}
async function plainFolder(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isSymbolicLink())throw Error(`Campaign files cannot contain a symbolic link: ${path}`);
  if(entry.isDirectory())await plainFolder(path);
 }
}
export async function discoverCampaigns(root){
 const directory=join(root,'content/campaigns'),campaigns=[];
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(!entry.isDirectory())continue;
  const manifestFile=join(directory,entry.name,'manifest.json');
  try{await stat(manifestFile);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const manifest=await json(manifestFile);validateCampaignManifest(manifest);
  if(manifest.id!==entry.name)throw Error(`Campaign folder must match its id: ${entry.name}`);
  campaigns.push({id:manifest.id,name:manifest.name,revision:manifest.revision,manifest:`${entry.name}/manifest.json`});
 }
 const registry={format:'granaderos-campaign-registry',version:1,campaigns};validateCampaignRegistry(registry);
 return registry;
}
export async function verifyCampaignFolder(directory){
 await plainFolder(directory);
 const manifest=await json(join(directory,'manifest.json'));validateCampaignManifest(manifest);
 const [content,world,index,presentation,assets]=await Promise.all(['content','world','maps','presentation','assets'].map(name=>json(child(directory,manifest[name]))));
 if(!index||!Array.isArray(index.maps))throw Error(`Invalid map index: ${manifest.id}`);
 const maps=Object.create(null);
 for(const entry of index.maps){
  if(!entry||typeof entry.id!=='string'||Object.hasOwn(maps,entry.id))throw Error(`Invalid or repeated map id: ${manifest.id}`);
  maps[entry.id]=await json(child(dirname(child(directory,manifest.maps)),entry.path));
 }
 const compiled=compileCampaignPackage(manifest,{content,world,maps,presentation,assets});
 const report=campaignContentReport(compiled);if(report.blocked.length)throw Error(report.blocked.join('\n'));
 for(const asset of assets.assets){
  const bytes=await readFile(child(directory,asset.path));
  if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error(`Campaign asset checksum mismatch: ${manifest.id}/${asset.path}`);
 }
 return compiled;
}
export async function stageCampaigns(root,destination){
 const registry=await discoverCampaigns(root),target=join(destination,'campaigns');await mkdir(target,{recursive:true});
 // Public editor examples are loose files, not registered campaign folders.
 // Keep those files while replacing the staged installed packages.
 for(const entry of await readdir(target,{withFileTypes:true})){
  if(entry.isDirectory())await rm(join(target,entry.name),{recursive:true,force:true});
  else if(entry.isSymbolicLink())throw Error(`Campaign export cannot contain a symbolic link: ${join(target,entry.name)}`);
 }
 for(const entry of await readdir(join(root,'content/campaigns'),{withFileTypes:true})){
  if(entry.isFile()&&entry.name.endsWith('.json'))await copyFile(join(root,'content/campaigns',entry.name),join(target,entry.name));
 }
 for(const entry of registry.campaigns){
  const source=join(root,'content/campaigns',entry.id);await verifyCampaignFolder(source);
  await stageFolder(source,join(target,entry.id));
 }
 await writeFile(join(target,'index.json'),JSON.stringify(registry,null,2)+'\n');
 return registry;
}
async function stageFolder(source,target,withinAssets=false){
 for(const entry of await readdir(source,{withFileTypes:true})){
  const from=join(source,entry.name),to=join(target,entry.name),assets=withinAssets||entry.name==='assets';
  if(entry.isDirectory())await stageFolder(from,to,assets);
  else if(entry.isFile()&&(withinAssets||entry.name.endsWith('.json'))){await mkdir(dirname(to),{recursive:true});await copyFile(from,to);}
  else if(entry.isSymbolicLink())throw Error(`Campaign export cannot contain a symbolic link: ${from}`);
 }
}
export function campaignFilesPlugin(root,basePath=''){
 return {name:'granaderos-campaign-files',configureServer(server){
  server.middlewares.use(`${basePath}/campaigns`,async(request,response,next)=>{
   try{
    const path=decodeURIComponent((request.url??'').split('?')[0]).replace(/^\//,'');
    if(path==='index.json'){response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify(await discoverCampaigns(root)));return;}
    const file=child(join(root,'content/campaigns'),path);
    const info=await stat(file);if(!info.isFile()){next();return;}
    const type=file.endsWith('.json')?'application/json':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':/\.jpe?g$/.test(file)?'image/jpeg':'application/octet-stream';
    response.setHeader('Content-Type',type);response.setHeader('Cache-Control','no-store');response.end(await readFile(file));
   }catch(error){if(error.code==='ENOENT'){next();return;}response.statusCode=400;response.end('Invalid campaign file.');}
  });
 }};
}
