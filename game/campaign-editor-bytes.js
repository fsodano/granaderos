/** Binary helpers shared by the browser editor and Node folder tools. */
export const CAMPAIGN_PROJECT_LIMITS=Object.freeze({files:4096,fileBytes:16*1024*1024,totalBytes:128*1024*1024,jsonBytes:8*1024*1024});
export function encodeBase64(bytes){
 if(!(bytes instanceof Uint8Array))throw Error('El recurso necesita bytes válidos.');
 let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(binary);
}
export function decodeBase64(value){
 if(typeof value!=='string'||value.length>Math.ceil(CAMPAIGN_PROJECT_LIMITS.fileBytes/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('El recurso contiene bytes codificados inválidos.');
 const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
export async function resourceSHA256(bytes){
 const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export const CAMPAIGN_RESOURCE_TYPES=Object.freeze({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',json:'application/json'});
export function campaignResourceType(path){return CAMPAIGN_RESOURCE_TYPES[path.split('.').at(-1)]??null;}
