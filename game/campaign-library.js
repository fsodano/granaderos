import {resolveContent} from './content-package.js';
import {validateCampaignWorld} from './campaign-definition.js';
import {validateMap} from './map-schema.js';
import {campaignContentReport} from './campaign-content.js';
import {validateCampaignData} from './campaign-data-validation.js';
import {campaignRelativePath,validateCampaignAssets,validateSelectedCampaignAssets} from './campaign-assets.js';
export {campaignRelativePath} from './campaign-assets.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const identifier=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value)&&!['constructor','prototype'].includes(value);
const text=(value,max=100)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function validateCampaignManifest(manifest){
 const dataErrors=validateCampaignData(manifest);need(!dataErrors.length,dataErrors.join('\n'));
 need(object(manifest)&&manifest.format==='granaderos-campaign'&&manifest.version===1,'El manifiesto de campaña no es compatible.');
 need(identifier(manifest.id)&&text(manifest.name)&&text(manifest.revision,80),'La campaña necesita identidad, nombre y revisión.');
 need(['generic-v1','granaderos-historical-v1'].includes(manifest.scenario),'El escenario de campaña no es compatible.');
 for(const key of ['content','world','maps','presentation','assets'])need(campaignRelativePath(manifest[key])&&manifest[key].endsWith('.json'),`La referencia ${key} no es válida.`);
 return manifest;
}
export function validateCampaignRegistry(value){
 const dataErrors=validateCampaignData(value);need(!dataErrors.length,dataErrors.join('\n'));
 need(object(value)&&value.format==='granaderos-campaign-registry'&&value.version===1&&Array.isArray(value.campaigns)&&value.campaigns.length>0&&value.campaigns.length<=100,'El catálogo de campañas no es compatible.');
 const ids=new Set();
 for(const entry of value.campaigns){need(object(entry)&&identifier(entry.id)&&!ids.has(entry.id)&&text(entry.name)&&text(entry.revision,80)&&entry.manifest===`${entry.id}/manifest.json`,'La entrada de campaña no es válida.');ids.add(entry.id);}
 return value;
}
export function compileCampaignPackage(manifest,documents){
 need(object(documents),'La campaña necesita documentos válidos.');
 const {content,world,maps,presentation,assets}=documents;
 validateCampaignManifest(manifest);
 const dataErrors=validateCampaignData({manifest,content,world,maps,presentation,assets});need(!dataErrors.length,dataErrors.join('\n'));
 need(object(content)&&content.id===manifest.id,'El contenido pertenece a otra campaña.');
 for(const key of ['characters','weapons','placements'])need(Array.isArray(content[key]),`El contenido necesita una lista de ${key}.`);
 const errors=validateCampaignWorld(world,{headquarters:content.headquarters??world?.defaultHeadquarters});need(!errors.length,errors.slice(0,12).join('\n'));
 need(object(maps)&&Object.keys(maps).length>0,'La campaña necesita mapas tácticos.');
 for(const [id,doc]of Object.entries(maps)){need(/^[a-z][a-z0-9_-]{0,79}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id)&&doc?.id===id,`El mapa ${id} tiene otra identidad.`);need(doc.width===20&&doc.height===16,`Mapa ${id}: se necesitan 20 columnas y 16 filas.`);const result=validateMap(doc,{playable:manifest.scenario==='generic-v1'});need(result.valid,`Mapa ${id}: ${result.errors.slice(0,4).join('; ')}`);if(manifest.scenario==='generic-v1')need(doc.spawns.some(s=>s.side==='enemy'),`Mapa ${id}: falta una aparición adversaria.`);for(const building of doc.buildings??[])need(!building.architecture||Object.hasOwn(world.buildings.types,building.architecture),`El mapa ${id} necesita el estilo ${building.architecture}.`);}
 for(const sector of world.sectors)need(Object.hasOwn(maps,sector.id),`Falta el mapa de la localidad ${sector.id}.`);
 for(const scene of Object.keys(world.sceneExits??{}))need(Object.hasOwn(maps,scene),`Falta el mapa de la escena ${scene}.`);
 need(object(presentation)&&object(assets)&&Array.isArray(assets.assets),'La campaña necesita presentación y recursos.');
 const assetErrors=[...validateCampaignAssets(assets),...validateSelectedCampaignAssets(manifest.id,assets,[presentation,content,world,maps])];need(!assetErrors.length,assetErrors.slice(0,12).join('\n'));
 const genericDefaults=manifest.scenario==='generic-v1'?{errands:[],roadsideDiscoveries:[],includeOriginalResidents:false}:{};
 const definitions=resolveContent({...genericDefaults,...content,scenario:manifest.scenario,world,maps,presentation,assets,campaignOrigin:{version:1,id:manifest.id,revision:manifest.revision}});
 const report=campaignContentReport(definitions);need(!report.blocked.length,report.blocked.join('\n'));
 return definitions;
}
