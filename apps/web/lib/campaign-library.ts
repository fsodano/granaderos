import {campaignRelativePath,compileCampaignPackage,validateCampaignManifest,validateCampaignRegistry} from '../../../packages/game/campaign-library.js';
import {sitePath} from './site-path.js';

export type CampaignEntry={id:string;name:string;revision:string;manifest:string};
export type LoadedCampaign={entry:CampaignEntry;manifest:any;content:any;presentation:any};
type Reader=(url:string,options?:RequestInit)=>Promise<{ok:boolean;status:number;json:()=>Promise<any>;arrayBuffer?:()=>Promise<ArrayBuffer>}>;
const verifiedResources=new WeakMap<Reader,Map<string,Promise<void>>>();
export async function verifyCampaignResources(value:any,{reader=fetch,signal,refresh=false}:{reader?:Reader;signal?:AbortSignal;refresh?:boolean}={}):Promise<void>{
 const content=value?.contentCampaign?.package??value?.campaignPackage??value,assets=content?.assets?.assets;
 if(!Array.isArray(assets)||!assets.length)return;
 const revision=content?.campaignOrigin?.revision??value?.campaignOrigin?.revision;
 const reinstall=revision?`Instalá la revisión ${revision} usada por esta partida.`:'Instalá la revisión usada por esta partida.';
 const descriptor=JSON.stringify([content.id,assets.map((asset:any)=>[asset.path,asset.sha256])]);
 let cache=verifiedResources.get(reader);if(!cache){cache=new Map();verifiedResources.set(reader,cache);}
 let verified=refresh?undefined:cache.get(descriptor);
 if(!verified){
  verified=(async()=>{
   for(let start=0;start<assets.length;start+=4)await Promise.all(assets.slice(start,start+4).map(async(asset:any)=>{
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    if(!campaignRelativePath(asset.path)||!asset.path.startsWith('assets/'))throw Error('La campaña tiene una ruta de recurso inválida.');
    const path=`/campaigns/${content.id}/${asset.path}`,response=await reader(sitePath(path),refresh?{cache:'no-store'}:undefined);
    if(!response.ok||!response.arrayBuffer)throw Error(`Falta un recurso de la campaña: ${path}. ${reinstall}`);
    const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(actual!==asset.sha256)throw Error(`El recurso cambió: ${path}. ${reinstall}`);
   }));
  })();
  cache.set(descriptor,verified);verified.catch(()=>{if(cache!.get(descriptor)===verified)cache!.delete(descriptor);});
 }
 await verified;
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
}
function relativeFile(base:string,path:string){
 if(!campaignRelativePath(path))throw Error('La campaña tiene una ruta de archivo inválida.');
 return `${base}/${path}`;
}
async function readJSON(path:string,reader:Reader,signal?:AbortSignal){
 const response=await reader(sitePath(path));
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(!response.ok)throw Error(`No se pudo cargar la campaña (${response.status}): ${path}`);
 return response.json();
}
export async function loadCampaignRegistry({reader=fetch,signal}:{reader?:Reader;signal?:AbortSignal}={}){
 const registry=await readJSON('/campaigns/index.json',reader,signal);
 validateCampaignRegistry(registry);
 return registry.campaigns as CampaignEntry[];
}
export async function loadInstalledCampaign(entry:CampaignEntry,{reader=fetch,signal}:{reader?:Reader;signal?:AbortSignal}={}):Promise<LoadedCampaign>{
 const manifestPath=relativeFile('/campaigns',entry.manifest),base=manifestPath.slice(0,manifestPath.lastIndexOf('/'));
 const manifest=await readJSON(manifestPath,reader,signal);validateCampaignManifest(manifest);
 if(manifest.id!==entry.id||manifest.name!==entry.name||manifest.revision!==entry.revision)throw Error('El índice y la campaña no coinciden.');
 const names=['content','world','maps','presentation','assets'] as const;
 const documents=await Promise.all(names.map(name=>readJSON(relativeFile(base,manifest[name]),reader,signal)));
 const [content,world,index,presentation,assets]=documents;
 if(!index||!Array.isArray(index.maps))throw Error('Falta el índice de mapas de la campaña.');
 const mapBase=relativeFile(base,manifest.maps).replace(/\/[^/]+$/,'');
 const maps:Record<string,any>=Object.create(null);
 const loaded=await Promise.all(index.maps.map(async(item:any)=>{
  if(!item||typeof item.id!=='string'||!item.id||typeof item.path!=='string')throw Error('El índice de mapas contiene una entrada inválida.');
  return [item.id,await readJSON(relativeFile(mapBase,item.path),reader,signal)] as const;
 }));
 for(const [id,map] of loaded){if(Object.hasOwn(maps,id))throw Error(`El mapa ${id} está repetido.`);maps[id]=map;}
 const resolved=compileCampaignPackage(manifest,{content,world,maps,presentation,assets});
 await verifyCampaignResources(resolved,{reader,signal});
 return {entry,manifest,content:resolved,presentation:resolved.presentation??presentation};
}
