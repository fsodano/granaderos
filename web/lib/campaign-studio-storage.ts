import {assertCampaignProjectEnvelope,decodeBase64,encodeBase64} from '../../game/campaign-editor-project.js';
import type {CampaignEditorProject} from './campaign-studio-files';
const DB_NAME='granaderos.campaign-studio.v1',STORE='projects';
function database():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('El navegador no permite guardar proyectos. Descargá una copia.'));return;}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('No se pudo abrir el almacenamiento de proyectos.'));
  request.onblocked=()=>reject(Error('Cerrá otras pestañas del estudio para actualizar su almacenamiento.'));
 });
}
async function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let result:T;
  const request=operation(tx.objectStore(STORE));request.onsuccess=()=>{result=request.result;};
  tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(Error('No se pudo guardar o leer el proyecto. Descargá una copia antes de salir.'));};
 });
}
/** Atomic durable record. IndexedDB stores binary Blobs, not localStorage image strings. */
export async function saveStudioProject(project:CampaignEditorProject):Promise<void>{
 assertCampaignProjectEnvelope(project);
 const value:any=structuredClone(project);value.resources=Object.fromEntries(Object.entries(project.resources).map(([path,resource])=>[path,{type:resource.type,bytes:new Blob([new Uint8Array(decodeBase64(resource.base64))],{type:resource.type})}]));
 await transaction('readwrite',store=>store.put(value,project.manifest.id));
}
export async function loadStudioProjects():Promise<CampaignEditorProject[]>{
 const records=await transaction<any[]>('readonly',store=>store.getAll()),projects:CampaignEditorProject[]=[];
 for(const record of records){
  const project=structuredClone(record);project.resources={};
  for(const [path,resource]of Object.entries(record.resources) as [string,{type:string;bytes:Blob}][]){if(!(resource.bytes instanceof Blob))throw Error('Un recurso guardado no contiene bytes válidos.');project.resources[path]={type:resource.type,base64:encodeBase64(new Uint8Array(await resource.bytes.arrayBuffer()))};}
  projects.push(assertCampaignProjectEnvelope(project) as CampaignEditorProject);
 }
 return projects.sort((a,b)=>a.manifest.id.localeCompare(b.manifest.id));
}
export async function deleteStudioProject(id:string):Promise<void>{await transaction('readwrite',store=>store.delete(id));}
