import {scaffoldDocuments} from './campaign-scaffold.js';
import {campaignRelativePath,compileCampaignPackage,validateCampaignManifest} from './campaign-library.js';
import {validateCampaignData} from './campaign-data-validation.js';
import {validateContentPackage} from './content-package.js';
import {validateCampaignWorld} from './campaign-definition.js';
import {validateCampaignPresentation} from './campaign-presentation-validation.js';
import {validateMap} from './map-schema.js';
import {campaignContentReport} from './campaign-content.js';
import {CAMPAIGN_PROJECT_LIMITS,campaignResourceType,decodeBase64,encodeBase64,resourceSHA256} from './campaign-editor-bytes.js';
export {CAMPAIGN_PROJECT_LIMITS,campaignResourceType,decodeBase64,encodeBase64,resourceSHA256} from './campaign-editor-bytes.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>structuredClone(value);
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(id)&&!['constructor','prototype'].includes(id);
const validPath=path=>campaignRelativePath(path);
export function campaignMapFile(manifest,path){
 if(!validPath(manifest?.maps)||!validPath(path))throw Error('El índice de mapas contiene una ruta inválida.');
 const directory=manifest.maps.split('/').slice(0,-1).join('/');return directory?`${directory}/${path}`:path;
}
/** @returns {Promise<any>} */
export async function createCampaignProject(id,name){
 const {manifest,content,world,presentation,maps,assets,image}=scaffoldDocuments(id,name);
 return {format:'granaderos-editor-project',version:1,manifest,content,world,presentation,maps,mapIndex:{maps:Object.keys(maps).map(id=>({id,path:`${id}.json`}))},assets,resources:{'assets/guide.png':{type:'image/png',base64:encodeBase64(image)}}};
}
/** Combine raw editable documents for previews; do not add a pinned save origin. */
export function projectContent(project){
 const {campaignOrigin,campaignPackage,contentCampaign,...content}=copy(project.content);
 return {...content,scenario:project.manifest.scenario,world:copy(project.world),maps:copy(project.maps),presentation:copy(project.presentation),assets:copy(project.assets)};
}
/** @returns {any} */
export function updateProjectContent(project,next){
 const result=copy(project),{world,maps,presentation,assets,campaignOrigin,campaignPackage,contentCampaign,scenario,...content}=copy(next);
 result.content=content;
 if(world!==undefined)result.world=world;if(maps!==undefined)result.maps=maps;if(presentation!==undefined)result.presentation=presentation;if(assets!==undefined)result.assets=assets;
 // The manifest owns installed identity and trusted scenario selection.
 result.content.id=result.manifest.id;
 return result;
}
/** Atomic identity change across raw documents; external URLs stay untouched. */
export function renameCampaignProject(project,newId,newName){
 if(!validId(newId))throw Error('Usá un identificador con letras minúsculas, números y guiones.');
 if(newName!==undefined&&(typeof newName!=='string'||!newName.trim()||newName.length>100))throw Error('El nombre necesita entre 1 y 100 caracteres.');
 const oldId=project.manifest.id,prefix=`/campaigns/${oldId}/`,nextPrefix=`/campaigns/${newId}/`;
 const rewrite=value=>Array.isArray(value)?value.map(rewrite):object(value)?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,rewrite(child)])):typeof value==='string'&&value.startsWith(prefix)?nextPrefix+value.slice(prefix.length):value;
 const result=rewrite(copy(project));result.manifest.id=newId;result.content.id=newId;
 if(newName!==undefined){const oldName=result.manifest.name;result.manifest.name=newName;result.content.name=newName;if(result.presentation.title===oldName)result.presentation.title=newName;}
 if(newId!==oldId&&result.manifest.scenario==='granaderos-historical-v1'){result.manifest.scenario='generic-v1';result.content.scenario='generic-v1';}
 delete result.content.campaignOrigin;return result;
}
export function projectResourceBytes(project,path){
 const resource=project.resources?.[path];if(!resource)throw Error(`Falta el recurso ${path}.`);return decodeBase64(resource.base64);
}
/** @returns {Promise<any>} */
export async function setProjectResource(project,path,bytes,type=campaignResourceType(path),id){
 if(!validPath(path)||!path.startsWith('assets/')||!type||campaignResourceType(path)!==type)throw Error('El recurso necesita una ruta assets/ y un tipo PNG, JPEG, WebP o JSON.');
 if(!(bytes instanceof Uint8Array)||bytes.length>CAMPAIGN_PROJECT_LIMITS.fileBytes)throw Error('El archivo de recurso es demasiado grande.');
 const result=copy(project),existing=result.assets?.assets?.find(asset=>asset.path===path);
 const base=id??existing?.id??`asset-${path.slice(7).replace(/\.[^.]+$/,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,65)}`;
 if(!validId(base)||result.assets?.assets?.some(asset=>asset.path!==path&&asset.id===base))throw Error('El recurso necesita un identificador único.');
 result.resources??={};result.resources[path]={type,base64:encodeBase64(bytes)};
 result.assets??={version:1,assets:[]};result.assets.assets=result.assets.assets.filter(asset=>asset.path!==path);
 result.assets.assets.push({id:base,path,sha256:await resourceSHA256(bytes),type});
 assertCampaignProjectEnvelope(result);return result;
}
export function removeProjectResource(project,path){
 const result=copy(project);delete result.resources[path];result.assets.assets=result.assets.assets.filter(asset=>asset.path!==path);return result;
}
/** Structural admission only: invalid authored documents can remain as drafts. */
export function assertCampaignProjectEnvelope(project){
 if(!object(project)||project.format!=='granaderos-editor-project'||project.version!==1||!object(project.manifest)||!object(project.content)||!object(project.world)||!object(project.presentation)||!object(project.maps)||!object(project.mapIndex)||!object(project.assets)||!object(project.resources))throw Error('El archivo no es un proyecto de campaña compatible.');
 const errors=validateCampaignData(project);if(errors.length)throw Error(errors.join('\n'));
 if(!validId(project.manifest.id))throw Error('El proyecto necesita una identidad válida.');
 const entries=Object.entries(project.resources);if(entries.length>CAMPAIGN_PROJECT_LIMITS.files)throw Error('El proyecto contiene demasiados recursos.');
 let total=0;for(const [path,value]of entries){if(!validPath(path)||!path.startsWith('assets/')||!object(value)||typeof value.type!=='string')throw Error(`Recurso de proyecto inválido: ${path}.`);total+=decodeBase64(value.base64).length;}
 if(total>CAMPAIGN_PROJECT_LIMITS.totalBytes)throw Error('Los recursos del proyecto son demasiado grandes.');
 return project;
}
export function encodeCampaignProject(project){assertCampaignProjectEnvelope(project);return JSON.stringify(project,null,2);}
export function decodeCampaignProject(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>CAMPAIGN_PROJECT_LIMITS.totalBytes*2)throw Error('El archivo de proyecto es demasiado grande.');
 return assertCampaignProjectEnvelope(JSON.parse(text));
}
/** @returns {Promise<{valid:boolean,issues:any[],content?:any,checks?:any}>} */
export async function validateCampaignProject(project){
 const issues=[],add=(section,message,path)=>{if(!issues.some(issue=>issue.section===section&&issue.message===message&&issue.path===path))issues.push({section,message,...(path?{path}:{})});};
 try{assertCampaignProjectEnvelope(project);}catch(error){add('project',error.message);return {valid:false,issues};}
 try{validateCampaignManifest(project.manifest);}catch(error){add('manifest',error.message,'manifest.json');}
 const combined=projectContent(project);
 for(const message of validateCampaignWorld(project.world,{headquarters:project.content.headquarters??project.world.defaultHeadquarters}))add('world',message,project.manifest.world);
 for(const message of validateCampaignPresentation(project.presentation,combined))add('presentation',message,project.manifest.presentation);
 for(const message of validateContentPackage(combined))add('content',message,project.manifest.content);
 const paths=new Set(['manifest.json']);
 for(const field of ['content','world','presentation','maps','assets']){const path=project.manifest[field];if(!validPath(path)||paths.has(path))add('manifest',`La ruta ${field} es inválida o está repetida.`,path);else paths.add(path);}
 const seen=new Set();
 if(!Array.isArray(project.mapIndex.maps)||!project.mapIndex.maps.length)add('maps','El proyecto necesita un índice de mapas.',project.manifest.maps);
 else for(const entry of project.mapIndex.maps){
  if(!object(entry)||typeof entry.id!=='string'||!Object.hasOwn(project.maps,entry.id)||seen.has(entry.id)){add('maps','El índice contiene un mapa ausente o repetido.',project.manifest.maps);continue;}
  seen.add(entry.id);
  try{const path=campaignMapFile(project.manifest,entry.path);if(!path.endsWith('.json')||paths.has(path))add('maps','La ruta de mapa está repetida o no es JSON.',path);else paths.add(path);}catch(error){add('maps',error.message,project.manifest.maps);}
 }
 for(const [id,map]of Object.entries(project.maps)){
  if(!seen.has(id))add('maps',`El mapa ${id} no está en el índice.`,project.manifest.maps);
  const report=validateMap(map,{playable:project.manifest.scenario==='generic-v1'});for(const message of report.errors)add('maps',`Mapa ${id}: ${message}`,id);
 }
 const required=new Set();let checkedBytes=0;
 for(const asset of Array.isArray(project.assets.assets)?project.assets.assets:[]){
  if(!object(asset)||!validPath(asset.path)){add('assets','El catálogo tiene una ruta inválida.',project.manifest.assets);continue;}
  required.add(asset.path);if(paths.has(asset.path))add('assets','El recurso ocupa la ruta de un documento.',asset.path);
  try{const bytes=projectResourceBytes(project,asset.path);checkedBytes+=bytes.length;if(project.resources[asset.path].type!==asset.type)add('assets','El tipo del archivo y el catálogo no coinciden.',asset.path);if(await resourceSHA256(bytes)!==asset.sha256)add('assets','Los bytes del recurso no coinciden con su suma de control.',asset.path);}catch(error){add('assets',error.message,asset.path);}
 }
 for(const path of Object.keys(project.resources))if(!required.has(path))add('assets','El recurso no está declarado en assets.json.',path);
 let content;
 try{content=compileCampaignPackage(project.manifest,{content:project.content,world:project.world,maps:project.maps,presentation:project.presentation,assets:project.assets});const report=campaignContentReport(content);for(const message of report.blocked)add('content',message);}catch(error){add('package',error.message);}
 return {valid:issues.length===0,issues,...(content?{content}:{}),checks:{maps:Object.keys(project.maps).length,resources:required.size,resourceBytes:checkedBytes}};
}
